/**
 * server/data/metarReleaseTimesStore.js — METAR 发布时刻数据存储。
 *
 * 数据文件 `data/metar-release-times.json` 结构（version 1）：
 * {
 *   version: 1,
 *   source: "https://aviationweather.gov/api/data/metar",
 *   basis: "obsTime",
 *   cities: {
 *     "City": {
 *       station: "ZGSZ",                 // ICAO station (resolutionSource 同源)
 *       observationDate: "YYYY-MM-DD",   // 站点本地“昨天”观察日
 *       refreshedAtLocalDate: "YYYY-MM-DD", // 站点本地刷新日（今天）
 *       minuteOffsetsUtc: [0],           // 该站 METAR 的 UTC 分钟偏移（去噪后）
 *       samples: 24,                     // 参与统计的 METAR 观测条数
 *       updatedAt: "ISO"                 // 刷新时间（UTC ISO）
 *     }
 *   }
 * }
 *
 * 设计约束：
 * - 每次只更新一个城市，整文件原子写（临时文件 + rename），更新成功后刷新内存缓存。
 * - 文件缺失 / 损坏 / 单条 entry 非法时优雅降级（空数据或跳过该条），绝不使服务启动失败。
 * - 写操作串行化（写链），避免并发刷新互相覆盖。
 *
 * @module server/data/metarReleaseTimesStore
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 数据文件版本。 */
export const METAR_RELEASE_TIMES_VERSION = 1;
/** 官方裁决数据源（与 Polymarket resolutionSource 同一个 AWC 接口）。 */
export const METAR_RELEASE_TIMES_SOURCE = "https://aviationweather.gov/api/data/metar";
/** 时刻统计基准字段：METAR 的 obsTime（实际观测时间，UTC）。 */
export const METAR_RELEASE_TIMES_BASIS = "obsTime";

/** 默认数据文件绝对路径：<project>/data/metar-release-times.json */
export const DEFAULT_METAR_RELEASE_TIMES_PATH = fileURLToPath(
  new URL("../../data/metar-release-times.json", import.meta.url),
);

/** 香港市场不参与（resolutionSource 可能为空，且不属于本系统时区列表）。 */
export const EXCLUDED_METAR_RELEASE_CITY = "Hong Kong";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATION_RE = /^[A-Z0-9]{3,5}$/;

/**
 * 空数据结构。
 * @returns {{version:number, source:string, basis:string, cities:Record<string, any>}}
 */
export function emptyMetarReleaseTimesData() {
  return {
    version: METAR_RELEASE_TIMES_VERSION,
    source: METAR_RELEASE_TIMES_SOURCE,
    basis: METAR_RELEASE_TIMES_BASIS,
    cities: {},
  };
}

/** 规范化单个城市 entry；非法输入抛出 TypeError（由调用方决定忽略或上报）。 */
export function normalizeMetarReleaseEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("METAR release entry must be an object");
  }
  const station = String(entry.station ?? "").trim().toUpperCase();
  if (!STATION_RE.test(station)) {
    throw new TypeError(`invalid METAR station: ${JSON.stringify(entry.station)}`);
  }
  const observationDate = String(entry.observationDate ?? "").trim();
  const refreshedAtLocalDate = String(entry.refreshedAtLocalDate ?? "").trim();
  if (!DATE_KEY_RE.test(observationDate)) {
    throw new TypeError(`invalid observationDate: ${JSON.stringify(entry.observationDate)}`);
  }
  if (!DATE_KEY_RE.test(refreshedAtLocalDate)) {
    throw new TypeError(`invalid refreshedAtLocalDate: ${JSON.stringify(entry.refreshedAtLocalDate)}`);
  }
  const rawOffsets = Array.isArray(entry.minuteOffsetsUtc) ? entry.minuteOffsetsUtc : [];
  const offsets = new Set();
  for (const raw of rawOffsets) {
    const minute = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new TypeError(`invalid UTC minute offset: ${JSON.stringify(raw)}`);
    }
    offsets.add(minute);
  }
  const samples = entry.samples === undefined ? 0 : Number(entry.samples);
  if (!Number.isInteger(samples) || samples < 0) {
    throw new TypeError(`invalid samples: ${JSON.stringify(entry.samples)}`);
  }
  const updatedAt = entry.updatedAt ? String(entry.updatedAt) : new Date().toISOString();
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new TypeError(`invalid updatedAt: ${JSON.stringify(entry.updatedAt)}`);
  }
  return {
    station,
    observationDate,
    refreshedAtLocalDate,
    minuteOffsetsUtc: [...offsets].sort((a, b) => a - b),
    samples,
    updatedAt,
  };
}

/** 深拷贝一条 entry（防止调用方改到内存缓存）。 */
function cloneEntry(entry) {
  return {
    ...entry,
    minuteOffsetsUtc: Array.isArray(entry.minuteOffsetsUtc) ? [...entry.minuteOffsetsUtc] : [],
  };
}

/**
 * METAR 发布时刻存储：同步加载 + 原子异步写。
 *
 * 用法：
 *   const store = new MetarReleaseTimesStore({ filePath });
 *   store.getCity("Shenzhen");              // entry | null
 *   await store.replaceCity("Shenzhen", e); // 原子落盘 + 更新缓存
 *   store.reload();                         // 重新从磁盘读取
 */
export class MetarReleaseTimesStore {
  /**
   * @param {{filePath?: string, log?: (level:string, msg:string)=>void}} [opts]
   */
  constructor(opts = {}) {
    this.filePath = opts.filePath || DEFAULT_METAR_RELEASE_TIMES_PATH;
    this.log = typeof opts.log === "function" ? opts.log : () => {};
    /** @type {{version:number, source:string, basis:string, cities:Record<string, any>}} */
    this.data = emptyMetarReleaseTimesData();
    this._writeChain = Promise.resolve();
    // 构造即同步加载，保证 import 后缓存立即可用（缺失/损坏时为空数据）。
    this.reload();
  }

  /**
   * 从磁盘重新加载（缺失 → 空数据；损坏 → 空数据 + warn）。
   * @returns {Record<string, ReturnType<typeof normalizeMetarReleaseEntry>>}
   */
  reload() {
    this.data = this._readFromDisk();
    return this.getAll();
  }

  /** 单个城市 entry 的拷贝；未知城市返回 null。 */
  getCity(city) {
    const key = String(city ?? "").trim();
    if (!key) return null;
    const entry = this.data.cities[key];
    if (entry) return cloneEntry(entry);
    // 大小写不敏感兜底（文件键是规范城市名）。
    const lower = key.toLowerCase();
    for (const name of Object.keys(this.data.cities)) {
      if (name.toLowerCase() === lower) return cloneEntry(this.data.cities[name]);
    }
    return null;
  }

  /** 全部城市 entry（浅拷贝映射；entry 为拷贝）。 */
  getAll() {
    /** @type {Record<string, any>} */
    const out = {};
    for (const [city, entry] of Object.entries(this.data.cities)) out[city] = cloneEntry(entry);
    return out;
  }

  /** 完整数据快照（含 version/source/basis）。 */
  getData() {
    return {
      version: this.data.version,
      source: this.data.source,
      basis: this.data.basis,
      cities: this.getAll(),
    };
  }

  /** 已加载的城市数量。 */
  get size() {
    return Object.keys(this.data.cities).length;
  }

  /**
   * 原子更新单个城市：写临时文件 → rename 覆盖 → 更新内存缓存。
   * 写操作串行执行，失败时不改动内存缓存（旧数据保留）。
   *
   * @param {string} city 规范城市名（如 "Shenzhen"）
   * @param {object} entry 城市 entry（见模块注释）
   * @returns {Promise<object>} 已写入并规范化的 entry
   */
  async replaceCity(city, entry) {
    const key = String(city ?? "").trim();
    if (!key) throw new TypeError("city is required");
    if (key === EXCLUDED_METAR_RELEASE_CITY) {
      throw new Error(`METAR release times are not tracked for ${EXCLUDED_METAR_RELEASE_CITY}`);
    }
    const normalized = normalizeMetarReleaseEntry(entry);

    const write = this._writeChain.then(async () => {
      const nextCities = { ...this.data.cities, [key]: normalized };
      const payload = JSON.stringify(
        {
          version: this.data.version || METAR_RELEASE_TIMES_VERSION,
          source: this.data.source || METAR_RELEASE_TIMES_SOURCE,
          basis: this.data.basis || METAR_RELEASE_TIMES_BASIS,
          cities: nextCities,
        },
        null,
        2,
      );
      await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      try {
        await fsp.writeFile(tmp, `${payload}\n`, "utf8");
        await fsp.rename(tmp, this.filePath);
      } catch (err) {
        await fsp.rm(tmp, { force: true }).catch(() => {});
        throw err;
      }
      // rename 成功后才更新内存缓存，保证内存与磁盘一致。
      this.data = { ...this.data, cities: nextCities };
      return cloneEntry(normalized);
    });
    // 写链吞掉错误，避免一次失败阻塞后续写入；调用方仍拿到 rejection。
    this._writeChain = write.then(
      () => undefined,
      () => undefined,
    );
    return write;
  }

  /** 等待所有排队中的磁盘写入完成。 */
  async flush() {
    await this._writeChain;
  }

  /* ------------------------------- internal ------------------------------ */

  _readFromDisk() {
    const empty = emptyMetarReleaseTimesData();
    let text;
    try {
      text = fs.readFileSync(this.filePath, "utf8");
    } catch (err) {
      if (err && err.code !== "ENOENT") {
        this.log("warn", `metar-release-times.json unreadable (${err.code || err.message}); using empty data`);
      }
      return empty;
    }
    if (!text || !text.trim()) return empty;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.log("warn", `metar-release-times.json corrupt (${err.message}); using empty data`);
      return empty;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      this.log("warn", "metar-release-times.json has unexpected shape; using empty data");
      return empty;
    }
    /** @type {Record<string, any>} */
    const cities = {};
    if (parsed.cities && typeof parsed.cities === "object" && !Array.isArray(parsed.cities)) {
      for (const [city, rawEntry] of Object.entries(parsed.cities)) {
        if (city === EXCLUDED_METAR_RELEASE_CITY) continue; // 兜底：历史文件若含香港则忽略
        try {
          cities[city] = normalizeMetarReleaseEntry(rawEntry);
        } catch (err) {
          this.log("warn", `metar-release-times.json entry "${city}" ignored: ${err.message}`);
        }
      }
    }
    return {
      version: Number.isInteger(parsed.version) ? parsed.version : METAR_RELEASE_TIMES_VERSION,
      source: typeof parsed.source === "string" && parsed.source ? parsed.source : METAR_RELEASE_TIMES_SOURCE,
      basis: typeof parsed.basis === "string" && parsed.basis ? parsed.basis : METAR_RELEASE_TIMES_BASIS,
      cities,
    };
  }
}

/**
 * 进程级单例：import 即自动加载 `data/metar-release-times.json`。
 * 运行期刷新/读取统一走该实例，保证内存缓存一致。
 */
export const metarReleaseTimes = new MetarReleaseTimesStore();

export default metarReleaseTimes;
