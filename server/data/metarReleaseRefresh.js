/**
 * server/data/metarReleaseRefresh.js — 单城市 METAR 发布时刻刷新。
 *
 * 数据来源与 Polymarket 官方裁决完全同源：
 *   GET https://aviationweather.gov/api/data/metar?ids=<ICAO>&format=json
 *       &date=<now ISO>&hours=48
 *
 * 算法（每个城市本地日 00:10 后触发一次，见 metarReleaseScheduler.js）：
 *   1. 站点 ICAO：优先当前 Gamma tag 104596 事件的 resolutionSource
 *      （`ids=XXXX`）；其次内置静态兜底表 METAR_RELEASE_STATIONS；再次现有
 *      data entry 的 station。
 *   2. 拉取最近 48h 报文，仅保留 metarType === "METAR"（SPECI 特殊观测不计入，
 *      与官方规则一致）。
 *   3. 按城市 IANA 时区筛出“站点本地昨天”的观测。
 *   4. 以 obsTime 为准，统计各 UTC 分钟偏移出现的次数，保留次数
 *      >= max(2, ceil(maxCount * 0.5)) 的分钟 → minuteOffsetsUtc。
 *   5. 只更新该城市 entry（observationDate = 本地昨天，
 *      refreshedAtLocalDate = 本地今天，samples = 观测条数）。
 *
 * 香港不参与（不写入、刷新直接抛错）。station 缺失时抛清晰错误且不改动旧数据。
 * 其余上游/无数据问题以 {ok:false, reason} 返回，由调用方决定跳过或重试。
 *
 * @module server/data/metarReleaseRefresh
 */
import { localDateKeyForTimeZone, timezoneForCity } from "../../shared/cityTimezones.js";
import { fetchJson } from "../util.js";
import { extractCity, extractStation } from "./gamma.js";

/** Aviation Weather Center METAR 接口（官方裁决源）。 */
export const METAR_API_URL = "https://aviationweather.gov/api/data/metar";
/** Polymarket Gamma API。 */
export const GAMMA_API = "https://gamma-api.polymarket.com";
/** 温度市场 tag（“Highest temperature”）。 */
export const WEATHER_TAG_ID = 104596;
/** 拉取窗口（小时）：覆盖站点本地昨天 + 今天的部分观测。 */
export const METAR_LOOKBACK_HOURS = 48;
/** 不参与统计的城市（官方 resolutionSource 可能为空）。 */
export const EXCLUDED_METAR_RELEASE_CITY = "Hong Kong";

/**
 * 香港除外的全部支持城市 → ICAO 站点（静态兜底表）。
 * 键为 shared/cityTimezones.js 的规范城市名；站点来自当前正式市场的
 * resolutionSource（tag 104596，2026-11-12 校验）。
 * @type {Readonly<Record<string, string>>}
 */
export const METAR_RELEASE_STATIONS = Object.freeze({
  Amsterdam: "EHAM",
  Ankara: "LTAC",
  Atlanta: "KATL",
  Austin: "KAUS",
  Beijing: "ZBAA",
  "Buenos Aires": "SAEZ",
  Busan: "RKPK",
  "Cape Town": "FACT",
  Chengdu: "ZUUU",
  Chicago: "KORD",
  Chongqing: "ZUCK",
  Dallas: "KDAL",
  Denver: "KDEN",
  Guangzhou: "ZGGG",
  Helsinki: "EFHK",
  Houston: "KHOU",
  Istanbul: "LTFM",
  Jeddah: "OEJN",
  Karachi: "OPKC",
  "Kuala Lumpur": "WMKK",
  London: "EGLC",
  "Los Angeles": "KLAX",
  Lucknow: "VILK",
  Madrid: "LEMD",
  Manila: "RPLL",
  "Mexico City": "MMMX",
  Miami: "KMIA",
  Milan: "LIMC",
  Moscow: "UUWW",
  Munich: "EDDM",
  "New York City": "KLGA",
  "Panama City": "MPMG",
  Paris: "LFPB",
  Qingdao: "ZSQD",
  "San Francisco": "KSFO",
  "São Paulo": "SBGR",
  Seattle: "KSEA",
  Seoul: "RKSI",
  Shanghai: "ZSPD",
  Shenzhen: "ZGSZ",
  Singapore: "WSSS",
  Taipei: "RCSS",
  "Tel Aviv": "LLBG",
  Tokyo: "RJTT",
  Toronto: "CYYZ",
  Warsaw: "EPWA",
  Wellington: "NZWN",
  Wuhan: "ZHHH",
});

/** 外部市场名 / 历史策略里的城市别名 → 规范城市名。 */
const CITY_ALIASES = Object.freeze({
  NYC: "New York City",
  "New York": "New York City",
  "Seoul (Incheon)": "Seoul",
  "Sao Paulo": "São Paulo",
  "Tel-Aviv": "Tel Aviv",
  "Cape-town": "Cape Town",
});

/** METAR 发布时刻相关的可预期错误（城市/站点配置问题）。 */
export class MetarReleaseError extends Error {
  /**
   * @param {"city-required"|"city-excluded"|"city-unsupported"|"station-missing"|"store-invalid"} code
   * @param {string} message
   * @param {{cause?: Error}} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "MetarReleaseError";
    this.code = code;
    if (opts.cause) this.cause = opts.cause;
  }
}

/* ------------------------------- city utils ------------------------------ */

/** 城市别名 / 大小写归一化到规范城市名（未知城市原样返回）。 */
export function canonicalMetarCity(cityName) {
  const raw = String(cityName ?? "").trim();
  if (!raw) return "";
  if (Object.prototype.hasOwnProperty.call(METAR_RELEASE_STATIONS, raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(CITY_ALIASES, raw)) return CITY_ALIASES[raw];
  const lower = raw.toLowerCase();
  for (const name of Object.keys(METAR_RELEASE_STATIONS)) {
    if (name.toLowerCase() === lower) return name;
  }
  return raw;
}

/** 全部支持城市（规范名，已排除香港），按字母序。 */
export function metarReleaseCities() {
  return Object.keys(METAR_RELEASE_STATIONS).sort((a, b) => a.localeCompare(b));
}

/** 城市是否支持 METAR 发布时刻统计。 */
export function isMetarReleaseCitySupported(cityName) {
  const city = canonicalMetarCity(cityName);
  return Boolean(city) && city !== EXCLUDED_METAR_RELEASE_CITY && Boolean(METAR_RELEASE_STATIONS[city]);
}

/** 城市 → ICAO；未知/香港返回 ""。 */
export function metarStationForCity(cityName) {
  const city = canonicalMetarCity(cityName);
  return METAR_RELEASE_STATIONS[city] || "";
}

/** 城市 → IANA 时区；未知城市返回 null。 */
export function timezoneForMetarCity(cityName) {
  return timezoneForCity(canonicalMetarCity(cityName));
}

/* -------------------------------- date utils ----------------------------- */

/** `YYYY-MM-DD` 加减天数（纯日历运算，与时区无关）。 */
export function addDaysToDateKey(dateKey, delta) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""));
  if (!match) return "";
  const days = Number(delta) || 0;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
}

/** Date | number | ISO string → epoch ms（非法时回退到当前时间）。 */
function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

/** METAR 观测时间（obsTime 秒/毫秒，或 reportTime ISO 兜底）→ epoch ms。 */
export function metarObservationMs(row) {
  if (!row || typeof row !== "object") return null;
  const obs = row.obsTime;
  if (typeof obs === "number" && Number.isFinite(obs) && obs > 0) {
    return obs < 1e12 ? obs * 1000 : obs;
  }
  if (typeof obs === "string" && obs.trim()) {
    const numeric = Number(obs);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(obs);
    if (Number.isFinite(parsed)) return parsed;
  }
  const reportTime = row.reportTime;
  if (typeof reportTime === "string" && reportTime) {
    const parsed = Date.parse(reportTime);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** 是否为常规 METAR（SPECI 特殊观测不计入官方裁决，直接排除）。 */
export function isRoutineMetar(row) {
  return Boolean(row) && String(row.metarType ?? "").trim().toUpperCase() === "METAR";
}

/**
 * 筛选“站点本地昨天”的常规 METAR（按 obsTime 去重，保留首条）。
 *
 * @param {any[]} rows AWC METAR JSON 行
 * @param {{timeZone: string, nowMs?: number, now?: number|Date}} opts
 * @returns {{todayLocal:string, observationDate:string, metars:any[], totalRows:number}}
 */
export function selectPreviousDayMetars(rows, opts = {}) {
  const timeZone = opts.timeZone;
  const nowMs = toEpochMs(opts.nowMs ?? opts.now ?? Date.now());
  const list = Array.isArray(rows) ? rows : [];
  const todayLocal = localDateKeyForTimeZone(timeZone, new Date(nowMs));
  const observationDate = addDaysToDateKey(todayLocal, -1);
  /** @type {Map<number, any>} */
  const byTime = new Map();
  for (const row of list) {
    if (!isRoutineMetar(row)) continue;
    const ms = metarObservationMs(row);
    if (!Number.isFinite(ms)) continue;
    if (localDateKeyForTimeZone(timeZone, new Date(ms)) !== observationDate) continue;
    if (!byTime.has(ms)) byTime.set(ms, row);
  }
  const metars = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  return { todayLocal, observationDate, metars, totalRows: list.length };
}

/**
 * 由“站点本地昨天”的 METAR 推导 UTC 分钟偏移集合。
 *
 * 出现次数 >= max(2, ceil(maxCount * 0.5)) 的分钟视为该站常规发布分钟；
 * 偶发的非正点观测被过滤掉。samples 为去重后的观测条数。
 *
 * @param {any[]} metars
 * @returns {{minuteOffsetsUtc:number[], samples:number, counts:Record<string, number>}}
 */
export function deriveMinuteOffsetsUtc(metars) {
  const list = Array.isArray(metars) ? metars : [];
  /** @type {Map<number, number>} */
  const counts = new Map();
  const seen = new Set();
  for (const row of list) {
    const ms = metarObservationMs(row);
    if (!Number.isFinite(ms) || seen.has(ms)) continue;
    seen.add(ms);
    const minute = new Date(ms).getUTCMinutes();
    counts.set(minute, (counts.get(minute) || 0) + 1);
  }
  const samples = seen.size;
  if (samples === 0) return { minuteOffsetsUtc: [], samples: 0, counts: {} };
  const maxCount = Math.max(...counts.values());
  const threshold = Math.max(2, Math.ceil(maxCount * 0.5));
  const minuteOffsetsUtc = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([minute]) => minute)
    .sort((a, b) => a - b);
  /** @type {Record<string, number>} */
  const sortedCounts = {};
  for (const [minute, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    sortedCounts[String(minute)] = count;
  }
  return { minuteOffsetsUtc, samples, counts: sortedCounts };
}

/* -------------------------------- upstream ------------------------------- */

/** 构造 AWC METAR JSON URL（date=窗口结束时间，hours=回看小时数）。 */
export function buildMetarUrl({ station, nowMs = Date.now(), hours = METAR_LOOKBACK_HOURS } = {}) {
  const params = new URLSearchParams({
    ids: String(station ?? "").trim().toUpperCase(),
    format: "json",
    date: new Date(toEpochMs(nowMs)).toISOString(),
    hours: String(hours),
  });
  return `${METAR_API_URL}?${params.toString()}`;
}

/**
 * 拉取一个站点的 METAR JSON 行。空数组代表该窗口无报文。
 * @param {{station:string, nowMs?:number, hours?:number, fetchImpl?:typeof fetch, timeoutMs?:number}} opts
 * @returns {Promise<any[]>}
 */
export async function fetchMetarRows(opts = {}) {
  const station = String(opts.station ?? "").trim().toUpperCase();
  if (!station) throw new MetarReleaseError("station-missing", "METAR station is required");
  const fetchImpl = typeof opts.fetchImpl === "function" ? opts.fetchImpl : globalThis.fetch;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 15_000;
  const url = buildMetarUrl({ station, nowMs: opts.nowMs, hours: opts.hours });
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new MetarReleaseError("fetch-failed", `METAR fetch failed for ${station}: ${err.message}`, { cause: err });
  }
  if (!response || !response.ok) {
    throw new MetarReleaseError(
      "upstream-error",
      `METAR API returned HTTP ${response?.status ?? "?"} for ${station}`,
    );
  }
  let json;
  try {
    json = await response.json();
  } catch (err) {
    throw new MetarReleaseError("upstream-error", `METAR API returned invalid JSON for ${station}`, { cause: err });
  }
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && (json.error || json.message)) {
    throw new MetarReleaseError("upstream-error", `METAR API error for ${station}: ${json.error || json.message}`);
  }
  return [];
}

/**
 * 当前 Gamma tag 104596 事件的 city → ICAO 映射（resolutionSource 同源）。
 * 用于：生成脚本刷新前校验/纠正静态兜底表；某城市静态表缺失时的动态查找。
 * 单个事件解析失败会 skip，网络失败向上抛出（由调用方回退）。
 *
 * @param {{fetchJsonImpl?: typeof fetchJson, maxPages?: number, log?: (level:string,msg:string)=>void}} [opts]
 * @returns {Promise<Record<string,string>>}
 */
export async function fetchGammaStationMap(opts = {}) {
  const fetchJsonImpl = typeof opts.fetchJsonImpl === "function" ? opts.fetchJsonImpl : fetchJson;
  const maxPages = Math.max(1, Number.isFinite(opts.maxPages) ? opts.maxPages : 3);
  const log = typeof opts.log === "function" ? opts.log : () => {};
  /** @type {Record<string,string>} */
  const map = {};
  let cursor = "";
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      tag_id: String(WEATHER_TAG_ID),
      closed: "false",
      limit: "100",
      order: "endDate",
      ascending: "true",
    });
    if (cursor) params.set("after_cursor", cursor);
    const json = await fetchJsonImpl(`${GAMMA_API}/events/keyset?${params.toString()}`, {
      timeoutMs: 15_000,
      retries: 1,
      label: "gamma metar station map",
    });
    const events = Array.isArray(json?.events) ? json.events : Array.isArray(json) ? json : [];
    for (const event of events) {
      const city = canonicalMetarCity(extractCity(String(event?.title || "")));
      if (!city || city === EXCLUDED_METAR_RELEASE_CITY) continue;
      let station = "";
      for (const market of Array.isArray(event?.markets) ? event.markets : []) {
        station = extractStation(market, event);
        if (station) break;
      }
      if (!station && typeof event?.resolutionSource === "string") {
        const match = /[?&]ids=([A-Z]{4})(?:[&,]|$)/.exec(event.resolutionSource);
        if (match) [, station] = match;
      }
      if (station && !map[city]) map[city] = station.toUpperCase();
    }
    cursor = json?.next_cursor || "";
    if (!cursor || events.length === 0) break;
  }
  log("info", `gamma station map resolved ${Object.keys(map).length} cities`);
  return map;
}

/* ------------------------------- resolution ------------------------------ */

/**
 * 解析城市 ICAO。优先级：显式 opts.station → 当前 Gamma map → 静态兜底表 →
 * 现有 data entry → 抛 station-missing。
 */
function resolveStation(city, store, opts) {
  if (Object.prototype.hasOwnProperty.call(opts, "station")) {
    const explicit = String(opts.station ?? "").trim().toUpperCase();
    if (!explicit) {
      throw new MetarReleaseError("station-missing", `No METAR station configured for city "${city}"`);
    }
    return explicit;
  }
  const gammaStation = opts.gammaStationMap && typeof opts.gammaStationMap === "object" ? opts.gammaStationMap[city] : "";
  if (gammaStation) return String(gammaStation).trim().toUpperCase();
  const fallback = METAR_RELEASE_STATIONS[city];
  if (fallback) return fallback;
  const existing = store && typeof store.getCity === "function" ? store.getCity(city) : null;
  if (existing && existing.station) return String(existing.station).trim().toUpperCase();
  throw new MetarReleaseError("station-missing", `No METAR station known for city "${city}"`);
}

function assertStore(store) {
  if (!store || typeof store.getCity !== "function" || typeof store.replaceCity !== "function") {
    throw new MetarReleaseError("store-invalid", "METAR release-times store must expose getCity() and replaceCity()");
  }
}

/* -------------------------------- refresh -------------------------------- */

/**
 * 刷新单个城市的 METAR 发布时刻（每个站点本地日最多一次，见 scheduler）。
 *
 * 幂等：unless opts.force，若 store 中 refreshedAtLocalDate === 城市本地今天，
 * 直接返回 {ok:true, skipped:true, reason:"already-refreshed"}，不发网络请求。
 *
 * @param {string} city 城市名（支持别名，如 NYC）
 * @param {import("./metarReleaseTimesStore.js").MetarReleaseTimesStore} store
 * @param {{
 *   now?: number|Date,
 *   station?: string,
 *   gammaStationMap?: Record<string,string>,
 *   metarRows?: any[],
 *   fetchImpl?: typeof fetch,
 *   hours?: number,
 *   timeoutMs?: number,
 *   force?: boolean,
 *   log?: (level:string, msg:string)=>void,
 * }} [opts]
 * @returns {Promise<{
 *   ok: boolean, skipped: boolean, city: string, station?: string,
 *   reason?: string, message?: string,
 *   observationDate?: string, refreshedAtLocalDate?: string,
 *   minuteOffsetsUtc?: number[], samples?: number,
 *   entry?: object, counts?: Record<string, number>, rawRows?: number,
 * }>}
 */
export async function refreshMetarReleaseCity(city, store, opts = {}) {
  const log = typeof opts.log === "function" ? opts.log : () => {};
  const canonical = canonicalMetarCity(city);
  if (!canonical) throw new MetarReleaseError("city-required", "city is required");
  if (canonical === EXCLUDED_METAR_RELEASE_CITY) {
    throw new MetarReleaseError(
      "city-excluded",
      `METAR release times are not tracked for ${EXCLUDED_METAR_RELEASE_CITY}`,
    );
  }
  const timeZone = timezoneForCity(canonical);
  if (!timeZone) {
    throw new MetarReleaseError("city-unsupported", `City "${city}" has no supported city timezone`);
  }
  assertStore(store);

  const nowMs = toEpochMs(opts.now ?? Date.now());
  const todayLocal = localDateKeyForTimeZone(timeZone, new Date(nowMs));
  const existing = store.getCity(canonical);
  if (!opts.force && existing && existing.refreshedAtLocalDate === todayLocal) {
    return {
      ok: true,
      skipped: true,
      reason: "already-refreshed",
      city: canonical,
      station: existing.station,
      entry: existing,
      refreshedAtLocalDate: existing.refreshedAtLocalDate,
      observationDate: existing.observationDate,
      minuteOffsetsUtc: existing.minuteOffsetsUtc,
      samples: existing.samples,
    };
  }

  const station = resolveStation(canonical, store, opts);
  const observationDate = addDaysToDateKey(todayLocal, -1);

  /** @type {any[]} */
  let rows;
  if (Array.isArray(opts.metarRows)) {
    rows = opts.metarRows;
  } else {
    try {
      rows = await fetchMetarRows({
        station,
        nowMs,
        hours: Number.isFinite(opts.hours) ? opts.hours : METAR_LOOKBACK_HOURS,
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
      });
    } catch (err) {
      log("warn", `METAR fetch failed for ${canonical} (${station}): ${err.message}`);
      return {
        ok: false,
        skipped: false,
        reason: err.code || "fetch-failed",
        message: err.message,
        city: canonical,
        station,
        observationDate,
        refreshedAtLocalDate: todayLocal,
      };
    }
  }

  const { metars } = selectPreviousDayMetars(rows, { timeZone, nowMs });
  if (metars.length === 0) {
    log("warn", `no METAR observations for ${canonical} (${station}) on local ${observationDate}`);
    return {
      ok: false,
      skipped: false,
      reason: "no-observations",
      city: canonical,
      station,
      observationDate,
      refreshedAtLocalDate: todayLocal,
      samples: 0,
      rawRows: rows.length,
    };
  }
  if (metars.length < 2) {
    log("warn", `insufficient METAR samples for ${canonical} (${station}) on local ${observationDate}`);
    return {
      ok: false,
      skipped: false,
      reason: "insufficient-samples",
      city: canonical,
      station,
      observationDate,
      refreshedAtLocalDate: todayLocal,
      samples: metars.length,
      rawRows: rows.length,
    };
  }

  const { minuteOffsetsUtc, samples, counts } = deriveMinuteOffsetsUtc(metars);
  const entry = {
    station,
    observationDate,
    refreshedAtLocalDate: todayLocal,
    minuteOffsetsUtc,
    samples,
    updatedAt: new Date(nowMs).toISOString(),
  };
  const saved = await store.replaceCity(canonical, entry);
  if (minuteOffsetsUtc.length === 0) {
    log("warn", `METAR release minutes for ${canonical} (${station}) are empty after filtering`);
  }
  log(
    "info",
    `METAR release times refreshed for ${canonical} (${station}): ${samples} samples, UTC minutes [${minuteOffsetsUtc.join(", ")}]`,
  );
  return {
    ok: true,
    skipped: false,
    city: canonical,
    station,
    entry: saved,
    observationDate,
    refreshedAtLocalDate: todayLocal,
    minuteOffsetsUtc,
    samples,
    counts,
    rawRows: rows.length,
  };
}
