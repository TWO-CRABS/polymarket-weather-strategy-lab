/**
 * server/data/feedWs.js — optional CLOB market WebSocket accelerator.
 *
 * The REST poll in feed.js is the guaranteed baseline; this adapter only makes
 * quotes fresher. It never throws into the feed: every failure falls back to
 * polling (status degraded until the next good update).
 *
 * Protocol verified live (2026-11-08):
 *   - connect wss://ws-subscriptions-clob.polymarket.com/ws/market (no auth)
 *   - send  { "type": "market", "assets_ids": ["<tokenId>", ...] }
 *   - server sends JSON arrays of frames: { event_type: "book" | "price_change"
 *     | "last_trade_price" | "tick_size_change" | "best_bid_ask", ... }
 *   - text PING every 10s keeps the connection alive (server replies PONG);
 *     after reconnect the subscription must be re-sent (no replay).
 */
import { nowMs, toNumOrNull } from "../util.js";
import { applyBookChanges } from "./clob.js";

const STATUS = Object.freeze({
  CONNECTING: "connecting",
  LIVE: "live",
  DEGRADED: "degraded",
});

export class WsAdapter {
  /**
   * @param {import("./feed.js").Feed} feed parent feed (owns tokens/books/status)
   * @param {{url:string, reconnectSchedule:number[], pingMs:number,
   *   reconcileMs:number, log?:Function}} opts
   */
  constructor(feed, opts) {
    this.feed = feed;
    this.url = opts.url;
    this.reconnectSchedule = opts.reconnectSchedule ?? [1000, 2000, 5000, 15_000, 30_000];
    this.pingMs = opts.pingMs ?? 10_000;
    this.reconcileMs = opts.reconcileMs ?? 2500;
    this.log = opts.log ?? (() => {});
    this.ws = null;
    this.connected = false;
    this.failures = 0;
    this.reconnectIndex = 0;
    this.disabled = false;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._reconcileTimer = null;
    this._pendingRefresh = new Set();
    this._pendingRefreshTimer = null;
  }

  start() {
    if (this.disabled) return;
    this._connect();
  }

  stop() {
    this.disabled = true;
    this._stopTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.connected = false;
    this.feed._wsConnected = false;
  }

  /** Re-send the subscription after the tracked token set changes. */
  resubscribe() {
    if (!this.connected || !this.ws) return;
    const assets = [...this.feed.tokens.keys()];
    try {
      this.ws.send(JSON.stringify({ type: "market", assets_ids: assets }));
    } catch {
      /* reconnect handles it */
    }
  }

  /* ------------------------------ connection ----------------------------- */

  _connect() {
    if (this.disabled || !this.feed._running || this.ws) return;
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      this._onFailure(`websocket init failed: ${err.message}`);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.failures = 0;
      this.reconnectIndex = 0;
      this.feed._wsConnected = true;
      const assets = [...this.feed.tokens.keys()];
      this.log("info", `ws market feed connected (${assets.length} assets)`);
      if (assets.length > 0) {
        try {
          ws.send(JSON.stringify({ type: "market", assets_ids: assets }));
        } catch (err) {
          this.log("warn", `ws subscribe failed: ${err.message}`);
        }
      }
      this._startPing(ws);
      this._startReconcile();
      this.feed._setStatus(STATUS.LIVE);
    };
    ws.onmessage = (event) => {
      try {
        this._handleMessage(event.data);
      } catch (err) {
        this.log("warn", `ws message ignored: ${err.message}`);
      }
    };
    ws.onerror = () => this._onFailure("websocket error");
    ws.onclose = () => this._onFailure(this.connected ? "websocket closed" : "websocket closed before open");
  }

  _onFailure(reason) {
    this.failures += 1;
    const wasConnected = this.connected;
    this.connected = false;
    this.ws = null;
    this._stopTimers();
    this.feed._wsConnected = false;
    this.feed.lastError = reason;
    if (wasConnected) this.log("warn", `ws market feed lost: ${reason}`);
    this.feed._setStatus(this.feed.lastUpdate > 0 ? STATUS.DEGRADED : STATUS.CONNECTING);
    if (this.failures >= 6 && this.feed.mode === "ws") {
      this.disabled = true;
      this.log("warn", "ws unavailable after repeated failures; using REST polling only");
      return;
    }
    if (!this.feed._running || !this.feed._allowWs) return;
    const delay = this.reconnectSchedule[Math.min(this.reconnectIndex, this.reconnectSchedule.length - 1)];
    this.reconnectIndex += 1;
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
    if (typeof this._reconnectTimer.unref === "function") this._reconnectTimer.unref();
  }

  _stopTimers() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this._reconcileTimer) clearInterval(this._reconcileTimer);
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._reconcileTimer = null;
  }

  _startPing(ws) {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = setInterval(() => {
      if (!this.connected) return;
      try {
        ws.send("PING");
      } catch {
        /* reconnect handles it */
      }
    }, this.pingMs);
    if (typeof this._pingTimer.unref === "function") this._pingTimer.unref();
  }

  _startReconcile() {
    if (this._reconcileTimer) clearInterval(this._reconcileTimer);
    this._reconcileTimer = setInterval(() => {
      this.feed._pollOnce(true).catch(() => {});
    }, this.reconcileMs);
    if (typeof this._reconcileTimer.unref === "function") this._reconcileTimer.unref();
  }

  /* -------------------------------- frames ------------------------------- */

  _handleMessage(raw) {
    if (typeof raw !== "string" || raw === "PONG" || raw === "PING") return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const events = Array.isArray(payload) ? payload : [payload];
    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const body = event.payload && typeof event.payload === "object" ? event.payload : event;
      const type = String(body.type ?? event.type ?? event.event_type ?? "").toLowerCase();
      if (type === "book") this._applyBookFrame(body);
      else if (type === "price_change") this._applyPriceChange(body);
      else if (type === "last_trade_price") this._applyLastTrade(body);
      else if (type === "best_bid_ask") this._applyBestBidAsk(body);
      else if (type === "tick_size_change") this._applyTickSize(body);
    }
    this.feed.lastUpdate = nowMs();
    this.feed._refreshSnapshots();
    this.feed._setStatus(STATUS.LIVE);
  }

  _assetId(body) {
    return String(body.asset_id ?? body.assetId ?? "");
  }

  _applyBookFrame(body) {
    const tokenId = this._assetId(body);
    if (!tokenId || !this.feed.tokens.has(tokenId)) return;
    const book = normalizeWsBook({
      tokenId,
      bids: this._parseLevels(body.bids, "desc"),
      asks: this._parseLevels(body.asks, "asc"),
      hash: String(body.hash ?? ""),
      lastTradePrice: toNumOrNull(body.last_trade_price ?? body.lastTradePrice),
      tickSize: toNumOrNull(body.tick_size ?? body.tickSize) ?? undefined,
    });
    this.feed._applyBook(tokenId, book);
  }

  _parseLevels(levels, direction) {
    if (!Array.isArray(levels)) return [];
    const parsed = levels
      .map((level) => ({ price: toNumOrNull(level?.price), size: toNumOrNull(level?.size) }))
      .filter(
        (level) =>
          level.price !== null && level.price > 0 && level.price <= 1 && level.size !== null && level.size > 0,
      );
    parsed.sort((a, b) => (direction === "asc" ? a.price - b.price : b.price - a.price));
    return parsed;
  }

  _applyPriceChange(body) {
    const changes = Array.isArray(body.price_changes)
      ? body.price_changes
      : Array.isArray(body.priceChanges)
        ? body.priceChanges
        : [];
    const byToken = new Map();
    for (const change of changes) {
      const tokenId = String(change?.asset_id ?? change?.assetId ?? "");
      if (!tokenId || !this.feed.tokens.has(tokenId)) continue;
      if (!byToken.has(tokenId)) byToken.set(tokenId, []);
      byToken.get(tokenId).push(change);
    }
    const missing = [];
    for (const [tokenId, deltas] of byToken) {
      const book = this.feed.books.get(tokenId);
      if (!book) {
        missing.push(tokenId);
        continue;
      }
      applyBookChanges(book, deltas);
      this.feed._applyBook(tokenId, { ...book, hash: book.hash });
    }
    if (missing.length > 0) {
      // first delta before the initial snapshot: fetch just this token
      for (const tokenId of missing.slice(0, 5)) this._queueTokenRefresh(tokenId);
    }
  }

  _applyLastTrade(body) {
    const tokenId = this._assetId(body);
    if (!tokenId || !this.feed.tokens.has(tokenId)) return;
    const price = toNumOrNull(body.price);
    const previous = this.feed.getLatest(tokenId);
    if (price === null || price <= 0 || price >= 1) return;
    this.feed._pushSample(tokenId, {
      ts: nowMs(),
      bid: previous ? previous.bid : 0,
      ask: previous ? previous.ask : 0,
      mid: previous && previous.mid > 0 ? previous.mid : price,
      last: price,
      hash: previous ? previous.hash : "",
    });
  }

  _applyBestBidAsk(body) {
    const tokenId = this._assetId(body);
    if (!tokenId || !this.feed.tokens.has(tokenId)) return;
    const bid = toNumOrNull(body.best_bid ?? body.bestBid);
    const ask = toNumOrNull(body.best_ask ?? body.bestAsk);
    if (bid === null || ask === null || bid <= 0 || ask <= 0 || bid >= ask) return;
    const previous = this.feed.getLatest(tokenId);
    this.feed._pushSample(tokenId, {
      ts: nowMs(),
      bid,
      ask,
      mid: (bid + ask) / 2,
      last: previous ? previous.last : null,
      hash: previous ? previous.hash : "",
    });
  }

  _applyTickSize(body) {
    const tokenId = this._assetId(body);
    if (!tokenId) return;
    const book = this.feed.books.get(tokenId);
    if (!book) return;
    const next = toNumOrNull(body.new_tick_size ?? body.newTickSize);
    if (next !== null && next > 0) book.tickSize = next;
  }

  _queueTokenRefresh(tokenId) {
    this._pendingRefresh.add(tokenId);
    if (this._pendingRefreshTimer) return;
    this._pendingRefreshTimer = setTimeout(async () => {
      this._pendingRefreshTimer = null;
      const ids = [...this._pendingRefresh];
      this._pendingRefresh.clear();
      if (ids.length === 0) return;
      try {
        const books = await this.feed.clob.getBooks(ids, { chunkSize: 50, fallback: false });
        for (const [id, book] of books) this.feed._applyBook(id, book);
        this.feed._refreshSnapshots();
      } catch (err) {
        this.feed.lastError = err.message;
      }
    }, 120);
    if (typeof this._pendingRefreshTimer.unref === "function") this._pendingRefreshTimer.unref();
  }
}

/** Build a normalized book from WS frame fields. */
export function normalizeWsBook(frame) {
  const bestBid = frame.bids.length ? frame.bids[0].price : 0;
  const bestAsk = frame.asks.length ? frame.asks[0].price : 0;
  return {
    tokenId: frame.tokenId,
    bids: frame.bids,
    asks: frame.asks,
    bestBid,
    bestAsk,
    mid: bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : null,
    lastTradePrice: frame.lastTradePrice ?? null,
    hash: frame.hash ?? "",
    tickSize: frame.tickSize > 0 ? frame.tickSize : 0.001,
    minOrderSize: 5,
    negRisk: false,
    updatedAt: nowMs(),
  };
}

export default WsAdapter;
