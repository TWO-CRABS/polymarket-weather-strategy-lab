/**
 * server/data/feed.js — live market feed.
 *
 * Strategy: REST polling is the guaranteed baseline (one `POST /books` batch
 * per POLL_MS for every tracked token). The CLOB market WebSocket is an
 * optional accelerator: when it connects it applies `book` / `best_bid_ask` /
 * `last_trade_price` frames immediately and schedules targeted REST refreshes
 * for `price_change` deltas. It can never break the feed — any WS failure just
 * leaves the poll baseline in charge (status degraded → live on recovery).
 *
 * Feed keeps per-token:
 *   - top-of-book quote {ts,bid,ask,mid,last,hash} in a 15-minute ring buffer
 *     (rolling signals + /api/markets/:id/history)
 *   - the latest normalized order book for book-walk execution
 */
import { nowMs } from "../util.js";
import { WsAdapter } from "./feedWs.js";

/** Feed status precedence. */
const STATUS = Object.freeze({
  CONNECTING: "connecting",
  LIVE: "live",
  DEGRADED: "degraded",
  OFFLINE: "offline",
});

/** CLOB /books hard limit is 500 token ids per request. */
const POLL_BOOK_CHUNK = 500;

function quoteFromBook(book, previous, marker) {
  const bid = book && book.bestBid > 0 ? book.bestBid : previous ? previous.bid : 0;
  const ask = book && book.bestAsk > 0 ? book.bestAsk : previous ? previous.ask : 0;
  let mid = null;
  if (book && book.mid !== null && book.mid !== undefined) mid = book.mid;
  else if (bid > 0 && ask > 0) mid = (bid + ask) / 2;
  else if (previous && previous.mid > 0) mid = previous.mid;
  const rawLast =
    book && book.lastTradePrice !== null && book.lastTradePrice !== undefined
      ? book.lastTradePrice
      : previous
        ? previous.last
        : null;
  const last = sanitizeLast(rawLast, bid, ask, mid);
  return {
    ts: marker,
    bid,
    ask,
    mid: mid ?? 0,
    last,
    hash: book?.hash ?? (previous ? previous.hash : ""),
  };
}

/**
 * CLOB `/book` 的 `last_trade_price` 是“该市场最近一笔成交”的价格，可能来自
 * 同一市场的另一侧 token（例如 YES=4¢ 时 NO 成交在 96¢，YES 的 book 也会带回 0.961）。
 * 若 last 与当前盘口/中间价偏离过大，则视为跨 token 污染丢弃（回退使用 mid）。
 */
function sanitizeLast(last, bid, ask, mid) {
  if (!Number.isFinite(last) || !(last > 0 && last < 1)) return null;
  const ref = mid > 0 ? mid : bid > 0 && ask > 0 ? (bid + ask) / 2 : null;
  if (ref !== null && Math.abs(last - ref) > 0.25) return null;
  return last;
}

export class Feed {
  /**
   * @param {{clob: import("./clob.js").ClobClient, pollMs?: number, staleMs?: number,
   *   mode?: "auto"|"ws"|"poll", ringMinutes?: number, wsUrl?: string,
   *   wsReconnectSchedule?: number[], wsReconcileMs?: number, wsPingMs?: number,
   *   log?: (level:string,msg:string)=>void}} cfg
   */
  constructor(cfg) {
    this.clob = cfg.clob;
    this.pollMs = cfg.pollMs ?? 1000;
    this.staleMs = cfg.staleMs ?? Math.max(3 * this.pollMs, 5000);
    this.mode =
      cfg.mode === "ws" || cfg.mode === "poll" || cfg.mode === "off" || cfg.mode === "auto" ? cfg.mode : "auto";
    this.ringMinutes = cfg.ringMinutes ?? 15;
    this.wsUrl = cfg.wsUrl ?? "wss://ws-subscriptions-clob.polymarket.com/ws/market";
    this.wsReconnectSchedule = cfg.wsReconnectSchedule ?? [1000, 2000, 5000, 15_000, 30_000];
    this.wsReconcileMs = cfg.wsReconcileMs ?? 5000;
    this.wsCitiesPerConnection = Math.max(1, Math.floor(Number(cfg.wsCitiesPerConnection)) || 20);
    this.wsPingMs = cfg.wsPingMs ?? 10_000;
    this.log = cfg.log ?? (() => {});

    this.ringCapacity = Math.max(60, Math.ceil((this.ringMinutes * 60_000) / this.pollMs) + 10);

    /** @type {Map<string, any>} tokenId -> {marketId, outcome} */
    this.tokens = new Map();
    /** @type {Map<string, any>} marketId -> MarketSnapshot (mutated in place) */
    this.markets = new Map();
    /** @type {Map<string, Array<{ts:number,bid:number,ask:number,mid:number,last:number|null,hash:string}>>} */
    this.series = new Map();
    /** @type {Map<string, any>} tokenId -> normalized book */
    this.books = new Map();

    this.statusValue = STATUS.OFFLINE;
    this.lastUpdate = 0;
    this.latencyMs = 0;
    this.lastError = null;
    this._consecutiveErrors = 0;
    this._running = false;
    this._pollTimer = null;
    this._polling = false;
    this._lastSignature = new Map();

    this._wsConnected = false;
    this._wsAdapter = null;
    this._allowWs = this.mode !== "poll";

    /** @type {Array<(market:any)=>void>} */
    this._marketListeners = [];
    /** @type {Array<(status:object)=>void>} */
    this._statusListeners = [];
  }

  onMarketUpdate(fn) {
    this._marketListeners.push(fn);
  }

  onStatus(fn) {
    this._statusListeners.push(fn);
  }

  /* ------------------------------- control ------------------------------- */

  start() {
    if (this._running) return;
    if (this.mode === "off") return; // deterministic offline mode: zero network
    this._running = true;
    this._setStatus(this.tokens.size ? STATUS.CONNECTING : STATUS.OFFLINE);
    if (this._allowWs) {
      this._wsAdapter = new WsAdapter(this, {
        url: this.wsUrl,
        reconnectSchedule: this.wsReconnectSchedule,
        pingMs: this.wsPingMs,
        reconcileMs: this.wsReconcileMs,
        citiesPerConnection: this.wsCitiesPerConnection,
        log: this.log,
      });
      this._wsAdapter.start();
    }
    // A fixed-rate poll loop (never chain-scheduled) so one slow batch cannot
    // stall the whole feed; overlapping polls are skipped.
    this._pollTimer = setInterval(() => {
      if (this._polling) return;
      this._pollOnce().catch((err) => this.log("warn", `feed poll crashed: ${err.message}`));
    }, this.pollMs);
    if (typeof this._pollTimer.unref === "function") this._pollTimer.unref();
    this._statusTimer = setInterval(() => this._emitStatus(), 5000);
    if (typeof this._statusTimer.unref === "function") this._statusTimer.unref();
    this._pollOnce().catch(() => {});
  }

  stop() {
    this._running = false;
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._statusTimer) clearInterval(this._statusTimer);
    this._pollTimer = null;
    this._statusTimer = null;
    if (this._wsAdapter) {
      this._wsAdapter.stop();
      this._wsAdapter = null;
    }
    this._setStatus(STATUS.OFFLINE);
  }

  get running() {
    return this._running;
  }

  /**
   * Replace the tracked market set (active runs + idle showcase markets).
   * Market objects are shared with the discovery cache so live quotes are
   * visible through `/api/markets` without a copy step.
   * @param {Array<any>} markets MarketSnapshot[]
   */
  setTracked(markets) {
    const tokens = new Map();
    const nextMarkets = new Map();
    for (const market of markets) {
      if (!market?.id || !market.tokens?.yesTokenId) continue;
      nextMarkets.set(market.id, market);
      tokens.set(market.tokens.yesTokenId, { marketId: market.id, outcome: "YES" });
      if (market.tokens.noTokenId) {
        tokens.set(market.tokens.noTokenId, { marketId: market.id, outcome: "NO" });
      }
    }
    const removedTokens = [...this.tokens.keys()].filter((id) => !tokens.has(id));
    this.tokens = tokens;
    this.markets = nextMarkets;
    for (const tokenId of removedTokens) {
      this.series.delete(tokenId);
      this.books.delete(tokenId);
      this._lastSignature.delete(tokenId);
    }
    // re-subscribe the WS stream to the new token set (best effort)
    if (this._wsAdapter) this._wsAdapter.resubscribe();
  }

  snapshots() {
    return [...this.markets.values()];
  }

  getSnapshot(marketId) {
    return this.markets.get(marketId) || null;
  }

  /** Latest normalized book for a token (null when unknown). */
  getBook(tokenId) {
    return this.books.get(tokenId) || null;
  }

  /** Latest ring-buffer sample for a token. */
  getLatest(tokenId) {
    const series = this.series.get(tokenId);
    return series && series.length ? series[series.length - 1] : null;
  }

  /**
   * @param {string} tokenId
   * @param {number} seconds
   * @returns {Array<{ts:number,bid:number,ask:number,mid:number,last:number|null}>}
   */
  getHistory(tokenId, seconds) {
    const series = this.series.get(tokenId) || [];
    const cutoff = nowMs() - Math.max(1, seconds) * 1000;
    return series.filter((p) => p.ts >= cutoff);
  }

  status() {
    const now = nowMs();
    const ageMs = this.lastUpdate > 0 ? now - this.lastUpdate : Infinity;
    const liveWindowMs = Math.max(5000, 3 * this.pollMs);
    let status = this.statusValue;
    if (this._running) {
      if (!this.lastUpdate || ageMs > 30_000) status = STATUS.OFFLINE;
      else if (ageMs > liveWindowMs) status = STATUS.DEGRADED;
      else if (status === STATUS.CONNECTING) status = STATUS.LIVE; // poll baseline healthy
    }
    return {
      status,
      lastUpdate: this.lastUpdate,
      marketsTracked: this.markets.size,
      latencyMs: this.latencyMs,
      mode: this._wsConnected ? "ws" : "poll",
      tokens: this.tokens.size,
      wsBatches: this._wsAdapter ? this._wsAdapter.channels.size : 0,
      wsConnectedBatches: this._wsAdapter
        ? [...this._wsAdapter.channels.values()].filter((channel) => channel.connected).length
        : 0,
      ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : null,
      lastError: this.lastError,
    };
  }

  /* -------------------------------- polling ------------------------------- */

  async _pollOnce(force = false) {
    if (!this._running || this._polling) return;
    if (this.tokens.size === 0) {
      this._setStatus(STATUS.OFFLINE);
      return;
    }
    this._polling = true;
    const started = nowMs();
    try {
      const tokenIds = [...this.tokens.keys()];
      let received = 0;
      for (let i = 0; i < tokenIds.length; i += POLL_BOOK_CHUNK) {
        const batch = tokenIds.slice(i, i + POLL_BOOK_CHUNK);
        let books;
        try {
          // hot path: one batch request, no per-token fallback (never stall),
          // short timeout so a slow upstream cannot freeze the feed loop
          books = await this.clob.getBooks(batch, {
            chunkSize: POLL_BOOK_CHUNK,
            fallback: false,
            timeoutMs: 6000,
          });
        } catch (err) {
          this._consecutiveErrors += 1;
          this.lastError = err.message;
          continue;
        }
        for (const tokenId of batch) {
          const book = books.get(tokenId);
          if (book) {
            received += 1;
            this._applyBook(tokenId, book);
          }
        }
      }
      this.latencyMs = Math.round(nowMs() - started);
      if (received > 0) {
        this._consecutiveErrors = 0;
        this.lastUpdate = nowMs();
        this._refreshSnapshots();
        this._setStatus(STATUS.LIVE);
      } else if (this.lastUpdate > 0) {
        this._consecutiveErrors += 1;
        this._setStatus(STATUS.DEGRADED);
      } else {
        this._consecutiveErrors += 1;
        this._setStatus(STATUS.OFFLINE);
      }
      void force;
      this._refreshStaleness();
    } finally {
      this._polling = false;
    }
  }

  async _fallbackToken(tokenId) {
    try {
      const book = await this.clob.getBook(tokenId);
      if (book) {
        this._applyBook(tokenId, book);
        return;
      }
    } catch {
      /* fall through to midpoint */
    }
    try {
      const mid = await this.clob.getMidpoint(tokenId);
      if (mid !== null && Number.isFinite(mid) && mid >= 0 && mid <= 1) {
        const previous = this.getLatest(tokenId);
        this._pushSample(tokenId, {
          ts: nowMs(),
          bid: previous ? previous.bid : 0,
          ask: previous ? previous.ask : 0,
          mid,
          last: previous ? previous.last : null,
          hash: previous ? previous.hash : "",
        });
      }
    } catch {
      /* give up on this token for this poll */
    }
  }

  /* ------------------------------ book state ------------------------------ */

  _applyBook(tokenId, book) {
    if (!book || !this.tokens.has(tokenId)) return;
    const previousBook = this.books.get(tokenId);
    const merged = previousBook
      ? {
          ...book,
          tickSize: book.tickSize > 0 ? book.tickSize : previousBook.tickSize,
          minOrderSize: book.minOrderSize > 0 ? book.minOrderSize : previousBook.minOrderSize,
        }
      : book;
    this.books.set(tokenId, merged);
    const previous = this.getLatest(tokenId);
    const sample = quoteFromBook(merged, previous, nowMs());
    this._pushSample(tokenId, sample);
    this._emitMarketForToken(tokenId);
  }

  _pushSample(tokenId, sample) {
    let series = this.series.get(tokenId);
    if (!series) {
      series = [];
      this.series.set(tokenId, series);
    }
    const last = series[series.length - 1];
    if (last && sample.ts <= last.ts) return; // out-of-order/duplicate: drop
    if (last && sample.bid === last.bid && sample.ask === last.ask && sample.mid === last.mid && sample.last === last.last) {
      sample.hash = sample.hash || last.hash;
    }
    series.push(sample);
    if (series.length > this.ringCapacity) series.splice(0, series.length - this.ringCapacity);
  }

  /** Recompute every tracked MarketSnapshot from its two token quotes. */
  _refreshSnapshots() {
    const now = nowMs();
    for (const [marketId, market] of this.markets) {
      const yesQuote = this.getLatest(market.tokens.yesTokenId);
      const noQuote = market.tokens.noTokenId ? this.getLatest(market.tokens.noTokenId) : null;
      if (!yesQuote) continue;
      market.quotes = {
        YES: { bid: yesQuote.bid, ask: yesQuote.ask, mid: yesQuote.mid, last: yesQuote.last },
        NO: noQuote
          ? { bid: noQuote.bid, ask: noQuote.ask, mid: noQuote.mid, last: noQuote.last }
          : market.quotes?.NO ?? { bid: 0, ask: 0, mid: 0, last: null },
      };
      market.spread = yesQuote.bid > 0 && yesQuote.ask > 0 ? Math.max(0, yesQuote.ask - yesQuote.bid) : market.spread;
      market.impliedProbability = yesQuote.mid > 0 ? yesQuote.mid : market.impliedProbability;
      market.updatedAt = Math.max(yesQuote.ts, noQuote ? noQuote.ts : 0);
      market.stale = now - market.updatedAt > this.staleMs;
      const signature = `${market.quotes.YES.bid}|${market.quotes.YES.ask}|${market.quotes.YES.mid}|${market.quotes.NO.bid}|${market.quotes.NO.ask}|${market.quotes.NO.mid}|${market.stale}`;
      if (this._lastSignature.get(marketId) === signature) continue;
      this._lastSignature.set(marketId, signature);
      for (const listener of this._marketListeners) {
        try {
          listener(market);
        } catch (err) {
          this.log("warn", `feed market listener failed: ${err.message}`);
        }
      }
    }
  }

  _emitMarketForToken(tokenId) {
    const info = this.tokens.get(tokenId);
    if (!info) return;
    const market = this.markets.get(info.marketId);
    if (!market) return;
    const yesQuote = this.getLatest(market.tokens.yesTokenId);
    if (!yesQuote) return;
    const noQuote = market.tokens.noTokenId ? this.getLatest(market.tokens.noTokenId) : null;
    market.quotes = {
      YES: { bid: yesQuote.bid, ask: yesQuote.ask, mid: yesQuote.mid, last: yesQuote.last },
      NO: noQuote
        ? { bid: noQuote.bid, ask: noQuote.ask, mid: noQuote.mid, last: noQuote.last }
        : market.quotes?.NO ?? { bid: 0, ask: 0, mid: 0, last: null },
    };
    market.spread = yesQuote.bid > 0 && yesQuote.ask > 0 ? Math.max(0, yesQuote.ask - yesQuote.bid) : market.spread;
    market.impliedProbability = yesQuote.mid > 0 ? yesQuote.mid : market.impliedProbability;
    market.updatedAt = Math.max(yesQuote.ts, noQuote ? noQuote.ts : 0);
    market.stale = nowMs() - market.updatedAt > this.staleMs;
    const signature = `${market.quotes.YES.bid}|${market.quotes.YES.ask}|${market.quotes.YES.mid}|${market.quotes.NO.bid}|${market.quotes.NO.ask}|${market.quotes.NO.mid}|${market.stale}`;
    if (this._lastSignature.get(market.id) === signature) return;
    this._lastSignature.set(market.id, signature);
    for (const listener of this._marketListeners) {
      try {
        listener(market);
      } catch (err) {
        this.log("warn", `feed market listener failed: ${err.message}`);
      }
    }
  }

  _setStatus(next) {
    if (this.statusValue === next) return;
    this.statusValue = next;
    this._emitStatus();
  }

  /** Force a `feed` status event (5s cadence + on change). */
  _emitStatus() {
    const payload = this.status();
    for (const listener of this._statusListeners) {
      try {
        listener(payload);
      } catch (err) {
        this.log("warn", `feed status listener failed: ${err.message}`);
      }
    }
  }

  /** Flip `stale` for tracked markets whose last update exceeded staleMs. */
  _refreshStaleness() {
    const now = nowMs();
    for (const market of this.markets.values()) {
      const next = now - (market.updatedAt || 0) > this.staleMs;
      if (market.stale !== next) {
        market.stale = next;
        for (const listener of this._marketListeners) {
          try {
            listener(market);
          } catch (err) {
            this.log("warn", `feed market listener failed: ${err.message}`);
          }
        }
      }
    }
  }
}

export { STATUS };
export default Feed;
