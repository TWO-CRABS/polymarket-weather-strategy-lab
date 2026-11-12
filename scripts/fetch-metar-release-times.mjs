#!/usr/bin/env node
/**
 * scripts/fetch-metar-release-times.mjs — 生成 / 更新 data/metar-release-times.json。
 *
 * 用法（在项目根目录执行）：
 *   node scripts/fetch-metar-release-times.mjs --all            # 全部支持城市（香港除外）
 *   node scripts/fetch-metar-release-times.mjs --city=Shenzhen  # 单个/多个城市
 *   node scripts/fetch-metar-release-times.mjs --city=NYC --force
 *   node scripts/fetch-metar-release-times.mjs --due            # 仅刷新“已过本地 00:10 且今日未刷新”的城市
 *
 * 选项：
 *   --all                 全部支持城市（48 个，香港除外）
 *   --city=<name>         指定城市；可重复或用逗号分隔（支持 NYC / Sao Paulo 等别名）
 *   --due                 只处理当前到点且今日未刷新的城市
 *   --force               忽略“今日已刷新”幂等检查，强制重算
 *   --no-gamma            跳过当前 Gamma tag 104596 的 station 校正，直接用静态兜底表
 *   --hours=<n>           METAR 回看小时数（默认 48）
 *   --json                仅输出最终 JSON 摘要（便于自动化）
 *   -h, --help            帮助
 *
 * 说明：数据来源 aviationweather.gov（与 Polymarket 官方裁决同源）。单个城市失败
 * 不中断整体流程；只有“所有城市都失败”时以非零码退出。脚本不会 commit 任何东西。
 */
import { DEFAULT_METAR_RELEASE_TIMES_PATH, metarReleaseTimes } from "../server/data/metarReleaseTimesStore.js";
import {
  METAR_LOOKBACK_HOURS,
  METAR_RELEASE_STATIONS,
  canonicalMetarCity,
  fetchGammaStationMap,
  metarReleaseCities,
  refreshMetarReleaseCity,
} from "../server/data/metarReleaseRefresh.js";
import { isMetarReleaseDue, metarReleaseDueCities } from "../server/data/metarReleaseScheduler.js";

const LOG_PREFIX = "[metar-release-times]";

/** @param {string} message */
function info(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

/** @param {string} message */
function warn(message) {
  console.warn(`${LOG_PREFIX} WARN ${message}`);
}

function printUsage() {
  console.log(`Usage:
  node scripts/fetch-metar-release-times.mjs --all
  node scripts/fetch-metar-release-times.mjs --city=Shenzhen[,Qingdao] [--force]
  node scripts/fetch-metar-release-times.mjs --due [--force]

Options:
  --all          all supported cities (Hong Kong excluded)
  --city=<name>  one or more cities (repeatable / comma separated, aliases ok)
  --due          only cities past local 00:10 that are not yet refreshed today
  --force        ignore the same-day idempotence check
  --no-gamma     skip the current Gamma tag ${104596} station lookup
  --hours=<n>    METAR lookback hours (default ${METAR_LOOKBACK_HOURS})
  --json         print only the final JSON summary
  -h, --help     show this help`);
}

/** 解析 argv；未知参数直接报错退出（避免静默跑错范围）。 */
function parseArgs(argv) {
  /** @type {{all:boolean, due:boolean, force:boolean, noGamma:boolean, json:boolean, help:boolean, cityNames:string[], hours:number}} */
  const args = {
    all: false,
    due: false,
    force: false,
    noGamma: false,
    json: false,
    help: false,
    cityNames: [],
    hours: METAR_LOOKBACK_HOURS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") args.all = true;
    else if (token === "--due") args.due = true;
    else if (token === "--force") args.force = true;
    else if (token === "--no-gamma") args.noGamma = true;
    else if (token === "--json") args.json = true;
    else if (token === "-h" || token === "--help") args.help = true;
    else if (token === "--city") args.cityNames.push(...splitCities(argv[++i]));
    else if (token.startsWith("--city=")) args.cityNames.push(...splitCities(token.slice("--city=".length)));
    else if (token === "--hours") args.hours = Number(argv[++i]);
    else if (token.startsWith("--hours=")) args.hours = Number(token.slice("--hours=".length));
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.hours) || args.hours <= 0) args.hours = METAR_LOOKBACK_HOURS;
  return args;
}

/** "--city=A,B" / 重复 --city 都支持。 */
function splitCities(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function main() {
  return run().catch((err) => {
    console.error(`${LOG_PREFIX} FATAL ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}

async function run() {
  /** @type {ReturnType<typeof parseArgs>} */
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${LOG_PREFIX} ${err.message}`);
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    printUsage();
    return;
  }
  const log = args.json ? () => {} : (level, message) => (level === "warn" ? warn(message) : info(message));
  const now = Date.now();

  // ---- 城市选择 ---------------------------------------------------------
  /** @type {string[]} */
  let cities;
  /** @type {string[]} */
  const unknownCities = [];
  if (args.cityNames.length > 0) {
    cities = [];
    for (const raw of args.cityNames) {
      const city = canonicalMetarCity(raw);
      if (city === "Hong Kong") {
        warn("Hong Kong is excluded from METAR release times; skipped");
        continue;
      }
      if (!METAR_RELEASE_STATIONS[city]) {
        unknownCities.push(raw);
        continue;
      }
      if (!cities.includes(city)) cities.push(city);
    }
  } else if (args.all) {
    cities = metarReleaseCities();
  } else if (args.due) {
    cities = metarReleaseDueCities({ store: metarReleaseTimes, now });
  } else {
    console.error(`${LOG_PREFIX} choose one of --all / --city=<name> / --due`);
    printUsage();
    process.exitCode = 2;
    return;
  }

  // --due 可与 --all/--city 组合：取交集。
  if (args.due && !args.all && args.cityNames.length === 0) {
    cities = metarReleaseDueCities({ store: metarReleaseTimes, now, cities });
  } else if (args.due) {
    cities = cities.filter((city) => isMetarReleaseDue(city, metarReleaseTimes.getCity(city), now));
  }

  if (unknownCities.length > 0) {
    warn(`unknown city names skipped: ${unknownCities.join(", ")}`);
  }
  if (cities.length === 0) {
    if (args.due && unknownCities.length === 0) {
      info("no cities are due for a METAR release refresh");
      return;
    }
    console.error(`${LOG_PREFIX} no target cities selected`);
    process.exitCode = unknownCities.length > 0 ? 2 : 1;
    return;
  }

  // ---- 当前 Gamma station 校正（失败则用静态兜底表） ---------------------
  /** @type {Record<string,string>} */
  let gammaStationMap = {};
  if (!args.noGamma) {
    try {
      info(`resolving current Gamma tag ${104596} stations ...`);
      gammaStationMap = await fetchGammaStationMap({ log });
    } catch (err) {
      warn(`Gamma station lookup unavailable (${err.message}); using static station table`);
    }
  }
  for (const city of cities) {
    const staticStation = METAR_RELEASE_STATIONS[city] || "";
    const gammaStation = gammaStationMap[city] || "";
    if (gammaStation && staticStation && gammaStation !== staticStation) {
      warn(`station mismatch for ${city}: Gamma=${gammaStation} static=${staticStation}; using Gamma`);
    }
  }

  // ---- 逐城市刷新 -------------------------------------------------------
  const summary = {
    startedAt: new Date(now).toISOString(),
    finishedAt: "",
    filePath: DEFAULT_METAR_RELEASE_TIMES_PATH,
    cities,
    updated: /** @type {any[]} */ ([]),
    skipped: /** @type {any[]} */ ([]),
    failed: /** @type {any[]} */ ([]),
  };

  info(`refreshing ${cities.length} city(ies)${args.force ? " (force)" : ""} ...`);
  for (const city of cities) {
    try {
      const result = await refreshMetarReleaseCity(city, metarReleaseTimes, {
        now,
        force: args.force,
        gammaStationMap,
        hours: args.hours,
        log,
      });
      if (result.ok && result.skipped) {
        summary.skipped.push({ city, reason: result.reason, station: result.station });
        info(`- ${city}: skipped (${result.reason}) station=${result.station || "?"}`);
      } else if (result.ok) {
        const row = {
          city,
          station: result.station,
          observationDate: result.observationDate,
          refreshedAtLocalDate: result.refreshedAtLocalDate,
          minuteOffsetsUtc: result.minuteOffsetsUtc,
          samples: result.samples,
        };
        summary.updated.push(row);
        info(
          `+ ${city}: station=${row.station} observation=${row.observationDate} samples=${row.samples} utcMinutes=[${row.minuteOffsetsUtc.join(",")}]`,
        );
      } else {
        summary.failed.push({ city, reason: result.reason, message: result.message || "", station: result.station || "" });
        warn(`! ${city}: ${result.reason}${result.message ? ` (${result.message})` : ""}`);
      }
    } catch (err) {
      summary.failed.push({ city, reason: err.code || "error", message: err.message });
      warn(`! ${city}: ${err.message}`);
    }
  }
  await metarReleaseTimes.flush();

  // ---- 汇总 -------------------------------------------------------------
  summary.finishedAt = new Date().toISOString();
  const data = metarReleaseTimes.getData();
  const cityCount = Object.keys(data.cities).length;
  const allFailed = summary.updated.length === 0 && summary.skipped.length === 0 && summary.failed.length > 0;
  const output = {
    ...summary,
    dataVersion: data.version,
    dataSource: data.source,
    dataBasis: data.basis,
    dataCityCount: cityCount,
    allFailed,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    info(
      `done: updated=${summary.updated.length} skipped=${summary.skipped.length} failed=${summary.failed.length}`,
    );
    if (summary.failed.length > 0) {
      info(`failed cities: ${summary.failed.map((row) => `${row.city}(${row.reason})`).join(", ")}`);
    }
    info(`data file: ${summary.filePath}`);
    info(`data file cities: ${cityCount}`);
    for (const city of Object.keys(data.cities).sort((a, b) => a.localeCompare(b))) {
      const entry = data.cities[city];
      info(
        `  ${city}: ${entry.station} observation=${entry.observationDate} refreshed=${entry.refreshedAtLocalDate} samples=${entry.samples} utcMinutes=[${entry.minuteOffsetsUtc.join(",")}]`,
      );
    }
  }
  if (cityCount === 0 || allFailed) process.exitCode = 1;
}

main();
