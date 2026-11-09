/**
 * server/data/clob.js — read-only Polymarket CLOB / Data API client.
 *
 * Endpoints used (public, no auth):
 *   GET  /book?token_id=                 single order book
 *   POST /books                          batch order books (<= 500 ids)
 *   GET  /midpoint?token_id=             midpoint
 *   GET  /price?token_id=&side=          best price for one side
 *   GET  /last-trade-price?token_id=     last trade
 *   GET  https://data-api.polymarket.com/v2/prices-history  historical prices
 *   GET  /prices-history (legacy fallback)
 *
 * All parsing is defensive: string numbers, snake_case and camelCase,
 * empty books and one-sided books are normal in thin weather markets.
 */
import { fetchJson, RateLimiter, UpstreamError, toNum, toNumOrNull } from "../util.js";

const BOOK_CHUNK = 500; // CLOB /books hard limit per request

/** Parse `[{price,size}]` strings into numbers, dropping invalid levels. */
function parseLevels(levels, direction) {
  if (!Array.isArray(levels)) return [];
  const out = [];
  for (const level of levels) {
    const price = toNum(level?.price, NaN);
    const size = toNum(level?.size, NaN);
    if (!Number.isFinite(price) || price <= 0 || price > 1) continue;
    if (!Number.isFinite(size) || size <= 0) continue;
    out.push({ price, size });
  }
  out.sort((a, b) => (direction === "asc" ? a.price - b.price : b.price - a.price));
  return out;
}

/** Normalize a raw CLOB book (REST or WS) into the engine shape. */
export function normalizeBook(raw) {  if (!raw || typeof raw !== "object") return null;
  const tokenId = String(raw.asset_id ?? raw.assetId ?? raw.token_id ?? raw.tokenId ?? "");
  const bids = parseLevels(raw.bids, "desc");
  const asks = parseLevels(raw.asks, "asc");
  const bestBid = bids.length ? bids[0].price : 0;
  const bestAsk = asks.length ? asks[0].price : 0;
  const lastTradePrice = toNumOrNull(raw.last_trade_price ?? raw.lastTradePrice);
  const tickSize = toNum(raw.tick_size ?? raw.tickSize, 0.001);
  const minOrderSize = toNum(raw.min_order_size ?? raw.minOrderSize, 5);
  const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : null;
  return {
    tokenId,
    bids,
    asks,
    bestBid,
    bestAsk,
    mid,
    lastTradePrice,
    hash: String(raw.hash ?? ""),
    tickSize: tickSize > 0 ? tickSize : 0.001,
    minOrderSize: minOrderSize > 0 ? minOrderSize : 5,
    negRisk: Boolean(raw.neg_risk ?? raw.negRisk),
    updatedAt: Date.now(),
  };
}

/**
 * Apply WS `price_change` deltas to a normalized book.
 * `side: "BUY"` updates a bid level, `"SELL"` updates an ask level; size 0
 * removes the level. Returns the updated book (mutated) or null when unknown.
 * @param {any} book
 * @param {Array<{asset_id?:string, price:string|number, size:string|number, side:string}>} changes
 */
export function applyBookChanges(book, changes) {
  if (!book || !Array.isArray(changes)) return book || null;
  for (const change of changes) {
    const price = toNum(change?.price, NaN);
    const size = toNum(change?.size, NaN);
    const side = String(change?.side || "").toUpperCase();
    if (!Number.isFinite(price) || price <= 0 || price > 1 || !Number.isFinite(size) || size < 0) continue;
    const levels = side === "SELL" ? book.asks : book.bids;
    const index = levels.findIndex((level) => Math.abs(level.price - price) < 1e-9);
    if (size === 0) {
      if (index >= 0) levels.splice(index, 1);
    } else if (index >= 0) {
      levels[index].size = size;
    } else {
      levels.push({ price, size });
      levels.sort((a, b) => (side === "SELL" ? a.price - b.price : b.price - a.price));
    }
  }
  book.bestBid = book.bids.length ? book.bids[0].price : 0;
  book.bestAsk = book.asks.length ? book.asks[0].price : 0;
  book.mid = book.bestBid > 0 && book.bestAsk > 0 ? (book.bestBid + book.bestAsk) / 2 : null;
  book.updatedAt = Date.now();
  return book;
}

/** seconds -> ms heuristic for history payloads */
function tsToMs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}

export class ClobClient {
  /**
   * @param {{maxRps?: number, timeoutMs?: number, log?: (level:string,msg:string)=>void}} [opts]
   */
  constructor(opts = {}) {
    const maxRps = opts.maxRps && opts.maxRps > 0 ? opts.maxRps : 2;
    this.maxRps = maxRps;
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.log = opts.log ?? (() => {});
    this.limiter = new RateLimiter(Math.ceil(1000 / maxRps));
    this.clobBase = "https://clob.polymarket.com";
    this.dataBase = "https://data-api.polymarket.com";
  }

  /** Recover from a wedged request chain (feed poll watchdog). */
  resetLimiter() {
    this.limiter = new RateLimiter(Math.ceil(1000 / this.maxRps));
  }

  /** Throttled JSON request helper. */
  _request(url, opts = {}) {
    return this.limiter.schedule(() =>
      fetchJson(url, { timeoutMs: this.timeoutMs, retries: 1, ...opts }),
    );
  }

  /**
   * @param {string} tokenId
   * @returns {Promise<ReturnType<typeof normalizeBook>>}
   */
  async getBook(tokenId) {
    const json = await this._request(`${this.clobBase}/book?token_id=${encodeURIComponent(tokenId)}`);
    return normalizeBook(json);
  }

  /**
   * Batch books. Endpoint max 500 ids per request; `chunkSize` lets callers
   * keep steady-state polls small (feed) while discovery primes in big batches.
   * @param {string[]} tokenIds
   * @param {{chunkSize?: number, fallback?: boolean, timeoutMs?: number}} [opts]
   * @returns {Promise<Map<string, ReturnType<typeof normalizeBook>>>}
   */
  async getBooks(tokenIds, opts = {}) {
    const chunkSize = Math.min(BOOK_CHUNK, Math.max(1, opts.chunkSize ?? BOOK_CHUNK));
    const allowFallback = opts.fallback !== false;
    const requestOpts = opts.timeoutMs
      ? { method: "POST", body: null, timeoutMs: opts.timeoutMs, retries: 0 }
      : { method: "POST", body: null };
    const ids = [...new Set(tokenIds.filter(Boolean))];
    const books = new Map();
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunkIds = ids.slice(i, i + chunkSize);
      const body = chunkIds.map((token_id) => ({ token_id }));
      let json;
      try {
        json = await this._request(`${this.clobBase}/books`, { ...requestOpts, body });
      } catch (err) {
        this.log("warn", `batch /books failed (${chunkIds.length} tokens): ${err.message}`);
        continue;
      }
      const list = Array.isArray(json) ? json : json && Array.isArray(json.books) ? json.books : [];
      for (const raw of list) {
        const book = normalizeBook(raw);
        if (book?.tokenId) books.set(book.tokenId, book);
      }
      if (!allowFallback) continue;
      // fall back to per-token calls for ids the batch silently omitted
      for (const id of chunkIds) {
        if (books.has(id)) continue;
        try {
          const book = await this.getBook(id);
          if (book) books.set(id, book);
        } catch {
          /* keep going: one bad token must not fail the whole poll */
        }
      }
    }
    return books;
  }

  /** @returns {Promise<number|null>} midpoint, 0..1 */
  async getMidpoint(tokenId) {
    const json = await this._request(`${this.clobBase}/midpoint?token_id=${encodeURIComponent(tokenId)}`);
    return toNumOrNull(json?.mid);
  }

  /** @param {"BUY"|"SELL"} side @returns {Promise<number|null>} */
  async getPrice(tokenId, side) {
    const json = await this._request(
      `${this.clobBase}/price?token_id=${encodeURIComponent(tokenId)}&side=${side}`,
    );
    return toNumOrNull(json?.price);
  }

  /** @returns {Promise<number|null>} */
  async getLastTradePrice(tokenId) {
    const json = await this._request(
      `${this.clobBase}/last-trade-price?token_id=${encodeURIComponent(tokenId)}`,
    );
    const price = toNumOrNull(json?.price);
    // CLOB returns "0.5" placeholder with an empty side when nothing traded
    if (json && json.side === "") return null;
    return price;
  }

  /**
   * Historical price series for one token, oldest first.
   * @param {string} tokenId
   * @param {{interval?: string, bucketSeconds?: number, bypassLimiter?: boolean}} [opts]
   * @returns {Promise<Array<{ts:number, price:number}>>}
   */
  async getPriceHistory(tokenId, opts = {}) {
    const interval = opts.interval ?? "1d";
    const bucketSeconds = opts.bucketSeconds ?? 60;
    const url =
      `${this.dataBase}/v2/prices-history?token_id=${encodeURIComponent(tokenId)}` +
      `&interval=${encodeURIComponent(interval)}&bucket_seconds=${bucketSeconds}`;
    const request = opts.bypassLimiter
      ? (u) => fetchJson(u, { timeoutMs: 8000, retries: 0, label: "prices-history" })
      : (u) => this._request(u);
    try {
      const json = await request(url);
      const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
      return this._mapHistory(rows);
    } catch (err) {
      this.log("warn", `v2 prices-history failed for ${tokenId}: ${err.message}; trying legacy`);
      return this._legacyPriceHistory(tokenId, opts.bypassLimiter);
    }
  }

  /** Legacy CLOB history fallback: `GET /prices-history?market=<token>&interval=max&fidelity=1` */
  async _legacyPriceHistory(tokenId, bypassLimiter = false) {
    const url = `${this.clobBase}/prices-history?market=${encodeURIComponent(tokenId)}&interval=max&fidelity=1`;
    try {
      const json = bypassLimiter
        ? await fetchJson(url, { timeoutMs: 8000, retries: 0, label: "legacy prices-history" })
        : await this._request(url);
      const rows = Array.isArray(json) ? json : Array.isArray(json?.history) ? json.history : [];
      return this._mapHistory(rows);
    } catch (err) {
      this.log("warn", `legacy prices-history failed for ${tokenId}: ${err.message}`);
      return [];
    }
  }

  _mapHistory(rows) {
    const points = [];
    for (const row of rows) {
      const ts = tsToMs(row?.timestamp ?? row?.t);
      const price = toNumOrNull(row?.price ?? row?.p);
      if (ts === null || price === null) continue;
      if (price < 0 || price > 1) continue;
      points.push({ ts, price });
    }
    points.sort((a, b) => a.ts - b.ts);
    return points;
  }
}

export { UpstreamError };
export default ClobClient;
