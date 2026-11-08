/**
 * server/util.js — small dependency-free utilities shared by the backend:
 * ids, rounding, dates, HTTP JSON client with retry/backoff, rate limiter.
 */
import { randomBytes } from "node:crypto";
import { roundTo } from "../shared/contract.js";

/** Round half-up helper (delegates to shared/contract.js for a single truth). */
export { roundTo };

/** Current epoch milliseconds. */
export function nowMs() {
  return Date.now();
}

/** Generate a contract id such as `run_1ab2c3` (base36 suffix). */
export function newId(prefix) {
  const value = BigInt(`0x${randomBytes(8).toString("hex")}`);
  return `${prefix}_${value.toString(36)}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Coerce to finite number or return `fallback`. */
export function toNum(value, fallback = 0) {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce to finite number or null. */
export function toNumOrNull(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** `Number.isFinite(n) ? roundTo(n, d) : 0` */
export function money(n, decimals = 5) {
  return Number.isFinite(n) ? roundTo(n, decimals) : 0;
}

/** Percent helper: returns rounded number, never NaN. */
export function pct(n, decimals = 4) {
  return Number.isFinite(n) ? roundTo(n, decimals) : 0;
}

/** Parse a JSON-encoded array field from Gamma (they are JSON *strings*). */
export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parse a date-like value into epoch ms, or null. */
export function parseDateMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** ISO string for an epoch-ms value. */
export function toIso(ms) {
  return new Date(ms).toISOString();
}

/** Split an array into chunks of at most `size` items. */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** Application-level error shaped for the REST error envelope. */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code machine-readable error code (see docs/07)
   * @param {string} message human message (Chinese preferred for UI)
   * @param {{details?: unknown, cause?: Error}} [opts]
   */
  constructor(status, code, message, opts = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = opts.details;
    if (opts.cause) this.cause = opts.cause;
  }
}

/** Upstream (Polymarket) failure; mapped to 502/429 by the API layer. */
export class UpstreamError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, cause?: Error, bodyText?: string}} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "UpstreamError";
    this.status = opts.status ?? 502;
    this.code = this.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR";
    if (opts.cause) this.cause = opts.cause;
    this.bodyText = opts.bodyText;
  }
}

const BACKOFF_BASE_MS = 300;

function backoffMs(attempt) {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), 3000) + Math.floor(Math.random() * 100);
}

/**
 * Fetch JSON from an upstream endpoint with timeout + exponential-backoff retry.
 * Treats malformed JSON as an upstream error (never throws a raw SyntaxError).
 *
 * @param {string} url
 * @param {{method?: string, body?: unknown, headers?: Record<string,string>,
 *          timeoutMs?: number, retries?: number, label?: string}} [opts]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, opts = {}) {
  const {
    method = "GET",
    body = null,
    headers = {},
    timeoutMs = 8000,
    retries = 2,
    label = url,
  } = opts;

  const init = {
    method,
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== null && body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let json = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          if (res.ok) throw new UpstreamError(`Malformed JSON from ${label}`);
        }
      }
      if (!res.ok) {
        const err = new UpstreamError(`Upstream ${res.status} for ${label}`, {
          status: res.status,
          bodyText: text.slice(0, 300),
        });
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt <= retries + 1) {
          await sleep(backoffMs(attempt) + (res.status === 429 ? 500 : 0));
          continue;
        }
        throw err;
      }
      return json;
    } catch (err) {
      if (err instanceof UpstreamError && err.status > 0 && err.status < 500 && err.status !== 429) {
        throw err; // client errors are not retryable
      }
      if (attempt > retries + 1) {
        throw err instanceof UpstreamError
          ? err
          : new UpstreamError(`Fetch failed for ${label}: ${err.message}`, { cause: err });
      }
      await sleep(backoffMs(attempt));
    }
  }
}

/**
 * Serialized rate limiter: at most one task per `minIntervalMs` across the
 * whole process, which keeps the aggregate upstream budget gentle.
 */
export class RateLimiter {
  constructor(minIntervalMs = 500) {
    this.minIntervalMs = Math.max(0, minIntervalMs);
    this._last = 0;
    this._chain = Promise.resolve();
  }

  /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
  schedule(task) {
    const run = async () => {
      const wait = this._last + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this._last = Date.now();
      }
    };
    const result = this._chain.then(run, run);
    this._chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
