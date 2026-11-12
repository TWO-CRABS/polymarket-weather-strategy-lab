/**
 * server/data/metarReleaseScheduler.js — METAR 发布时刻的按城市调度器。
 *
 * 规则：每个城市在“站点本地 00:10”后（若当天尚未刷新）触发一次
 * refreshMetarReleaseCity；进程重启时同样按该规则补跑（catch-up）。
 * 其它任何时刻都不发 API 请求。失败城市在 retryDelayMs 后才允许重试，
 * 避免 30s tick 造成的请求风暴。
 *
 * 测试可注入 now() / refresh() / cities，完全不触网。
 *
 * @module server/data/metarReleaseScheduler
 */
import { timezoneForCity } from "../../shared/cityTimezones.js";
import { metarReleaseTimes } from "./metarReleaseTimesStore.js";
import { metarReleaseCities, refreshMetarReleaseCity } from "./metarReleaseRefresh.js";

/** 触发刷新的站点本地时刻：00:10。 */
export const METAR_RELEASE_LOCAL_HOUR = 0;
export const METAR_RELEASE_LOCAL_MINUTE = 10;
/** 站点本地一天中达到该分钟数（含 00:10 之后的所有时间）即视为“到点”。 */
const DUE_MINUTE_OF_DAY = METAR_RELEASE_LOCAL_HOUR * 60 + METAR_RELEASE_LOCAL_MINUTE;
/** 失败重试间隔（默认 10 分钟，指数退避到 maxRetryDelayMs）。 */
export const METAR_RELEASE_RETRY_DELAY_MS = 10 * 60_000;
/** 指数退避上限（默认 60 分钟）。 */
export const METAR_RELEASE_MAX_RETRY_DELAY_MS = 60 * 60_000;
/** 每个城市本地日最多尝试次数（超过后等下一个本地日，避免上游故障时刷屏请求）。 */
export const METAR_RELEASE_MAX_ATTEMPTS_PER_DAY = 6;
/** 默认 tick 间隔（30s）。 */
export const METAR_RELEASE_CHECK_INTERVAL_MS = 30_000;

/** Date | number | ISO string → epoch ms。 */
function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

/**
 * 用 Intl 计算某城市在给定时刻的本地日期 / 本地时间。
 * 未知时区返回 null。
 *
 * @param {string} cityName
 * @param {number|Date} [at]
 * @returns {{timeZone:string, localDate:string, localHour:number,
 *   localMinute:number, localTime:string, minutesOfDay:number}|null}
 */
export function metarReleaseCityLocalState(cityName, at = Date.now()) {
  const timeZone = timezoneForCity(cityName);
  if (!timeZone) return null;
  const instant = new Date(toEpochMs(at));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const pick = (type) => parts.find((part) => part.type === type)?.value || "";
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    const hour = Number(pick("hour"));
    const minute = Number(pick("minute"));
    if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    const pad = (value) => String(value).padStart(2, "0");
    return {
      timeZone,
      localDate: `${year}-${month}-${day}`,
      localHour: hour,
      localMinute: minute,
      localTime: `${pad(hour)}:${pad(minute)}`,
      minutesOfDay: hour * 60 + minute,
    };
  } catch {
    return null;
  }
}

/**
 * 该城市此刻是否需要刷新：
 * 本地时间已到/过 00:10，且 entry.refreshedAtLocalDate !== 本地今天。
 * 这同时覆盖了“正好 00:10”与“启动补跑（晚于 00:10）”两种情况。
 *
 * @param {string} cityName
 * @param {{refreshedAtLocalDate?: string}|null} entry
 * @param {number|Date} [at]
 * @returns {boolean}
 */
export function isMetarReleaseDue(cityName, entry, at = Date.now()) {
  const state = metarReleaseCityLocalState(cityName, at);
  if (!state) return false;
  if (state.minutesOfDay < DUE_MINUTE_OF_DAY) return false;
  return entry?.refreshedAtLocalDate !== state.localDate;
}

/**
 * 当前到点且尚未刷新今天的城市列表（供脚本 --due 与运维检查复用）。
 *
 * @param {{store?: {getCity:(city:string)=>any}, now?: number|Date, cities?: string[]}} [opts]
 * @returns {string[]}
 */
export function metarReleaseDueCities(opts = {}) {
  const store = opts.store ?? metarReleaseTimes;
  const at = opts.now ?? Date.now();
  const cities = Array.isArray(opts.cities) ? opts.cities : metarReleaseCities();
  const due = [];
  for (const city of cities) {
    let entry = null;
    try {
      entry = typeof store?.getCity === "function" ? store.getCity(city) : null;
    } catch {
      entry = null;
    }
    if (isMetarReleaseDue(city, entry, at)) due.push(city);
  }
  return due;
}

/**
 * 创建（但不启动）调度器；暴露 runOnce() 便于测试/运维手动触发。
 *
 * @param {{
 *   store?: {getCity:(city:string)=>any, replaceCity:(city:string, entry:object)=>Promise<any>},
 *   log?: (level:string, msg:string)=>void,
 *   now?: () => number|Date,
 *   refresh?: (city:string, store:any, opts:object)=>Promise<any>,
 *   checkIntervalMs?: number,
 *   retryDelayMs?: number,
 *   maxRetryDelayMs?: number,
 *   maxAttemptsPerDay?: number,
 *   cities?: string[],
 *   immediate?: boolean,
 * }} [opts]
 */
export function createMetarReleaseScheduler(opts = {}) {
  const store = opts.store ?? metarReleaseTimes;
  const log = typeof opts.log === "function" ? opts.log : () => {};
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const refresh = typeof opts.refresh === "function" ? opts.refresh : refreshMetarReleaseCity;
  const checkIntervalMs = Number.isFinite(opts.checkIntervalMs)
    ? Math.max(10, opts.checkIntervalMs)
    : METAR_RELEASE_CHECK_INTERVAL_MS;
  const retryDelayMs = Number.isFinite(opts.retryDelayMs)
    ? Math.max(0, opts.retryDelayMs)
    : METAR_RELEASE_RETRY_DELAY_MS;
  const cities = Array.isArray(opts.cities) && opts.cities.length > 0 ? [...opts.cities] : metarReleaseCities();
  const maxAttemptsPerDay = Number.isFinite(opts.maxAttemptsPerDay)
    ? Math.max(1, opts.maxAttemptsPerDay)
    : METAR_RELEASE_MAX_ATTEMPTS_PER_DAY;
  const maxRetryDelayMs = Number.isFinite(opts.maxRetryDelayMs)
    ? Math.max(0, opts.maxRetryDelayMs)
    : METAR_RELEASE_MAX_RETRY_DELAY_MS;
  if (!store || typeof store.getCity !== "function") {
    throw new TypeError("METAR release scheduler requires a store exposing getCity()");
  }

  /** @type {Map<string, {count:number, last:number}>} `${city}|${localDate}` → 尝试状态 */
  const attemptState = new Map();
  /** @type {Set<string>} 正在刷新中的城市（防重入） */
  const inFlight = new Set();
  let timer = null;
  let ticking = false;
  let stopped = false;

  /** 一次 tick：检查所有城市本地时间，到点且未刷新今日的触发一次 refresh。 */
  async function tick() {
    if (stopped) return { checkedAt: Date.now(), results: [], stopped: true };
    if (ticking) return { checkedAt: Date.now(), results: [], busy: true };
    ticking = true;
    /** @type {Array<{city:string, result?:any, error?:string}>} */
    const results = [];
    try {
      const nowMs = toEpochMs(now());
      for (const city of cities) {
        if (stopped) break;
        if (inFlight.has(city)) continue;
        const state = metarReleaseCityLocalState(city, nowMs);
        if (!state || state.minutesOfDay < DUE_MINUTE_OF_DAY) continue;
        let entry = null;
        try {
          entry = store.getCity(city);
        } catch (err) {
          log("warn", `METAR release scheduler could not read "${city}": ${err.message}`);
        }
        if (entry?.refreshedAtLocalDate === state.localDate) continue;
        const attemptKey = `${city}|${state.localDate}`;
        const attempt = attemptState.get(attemptKey) || { count: 0, last: 0 };
        if (attempt.count >= maxAttemptsPerDay) continue;
        // 指数退避：第 1 次失败后 10min，之后 20/40/60min 封顶。
        const retryDelay = Math.min(retryDelayMs * 2 ** Math.max(0, attempt.count - 1), maxRetryDelayMs);
        if (attempt.count > 0 && nowMs - attempt.last < retryDelay) continue;

        inFlight.add(city);
        attemptState.set(attemptKey, { count: attempt.count + 1, last: nowMs });
        try {
          const result = await refresh(city, store, { now: nowMs, log });
          results.push({ city, result });
          if (result?.ok && result?.skipped) {
            log("info", `METAR release refresh skipped for ${city}: ${result.reason || "already refreshed"}`);
          } else if (result?.ok) {
            log(
              "info",
              `METAR release times refreshed for ${city} (${result.station || "?"}), observation ${result.observationDate}`,
            );
          } else {
            log("warn", `METAR release refresh incomplete for ${city}: ${result?.reason || "unknown"}`);
          }
        } catch (err) {
          results.push({ city, error: err.message });
          log("warn", `METAR release refresh failed for ${city}: ${err.message}`);
        } finally {
          inFlight.delete(city);
        }
      }
    } finally {
      ticking = false;
    }
    return { checkedAt: Date.now(), results };
  }

  /** @type {{stop: () => void, runOnce: () => Promise<any>, isRunning: () => boolean, cities: () => string[]}} */
  const handle = {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      if (activeScheduler === handle) activeScheduler = null;
    },
    runOnce: tick,
    isRunning: () => timer !== null && !stopped,
    cities: () => [...cities],
  };

  if (opts.immediate !== false) {
    // 启动即补跑：任一城市本地时间已过 00:10 且今日未刷新则立刻刷新。
    tick().catch((err) => log("warn", `METAR release scheduler startup tick failed: ${err.message}`));
  }
  timer = setInterval(() => {
    tick().catch((err) => log("warn", `METAR release scheduler tick failed: ${err.message}`));
  }, checkIntervalMs);
  if (timer && typeof timer.unref === "function") timer.unref();

  return handle;
}

/** 当前进程内活动调度器（start 幂等，重复 start 会先停掉旧实例）。 */
let activeScheduler = null;

/**
 * 启动按城市 METAR 发布时刻调度器。
 *
 * @param {{
 *   store?: {getCity:(city:string)=>any, replaceCity:(city:string, entry:object)=>Promise<any>},
 *   log?: (level:string, msg:string)=>void,
 *   now?: () => number|Date,
 *   refresh?: (city:string, store:any, opts:object)=>Promise<any>,
 *   checkIntervalMs?: number,
 *   retryDelayMs?: number,
 *   maxRetryDelayMs?: number,
 *   maxAttemptsPerDay?: number,
 *   cities?: string[],
 *   immediate?: boolean,
 * }} [opts]
 * @returns {{stop: () => void, runOnce: () => Promise<any>, isRunning: () => boolean, cities: () => string[]}}
 */
export function startMetarReleaseScheduler(opts = {}) {
  if (activeScheduler) activeScheduler.stop();
  activeScheduler = createMetarReleaseScheduler(opts);
  return activeScheduler;
}

/** 停止当前进程级调度器（未启动时为空操作）。 */
export function stopMetarReleaseScheduler() {
  if (activeScheduler) activeScheduler.stop();
  activeScheduler = null;
}
