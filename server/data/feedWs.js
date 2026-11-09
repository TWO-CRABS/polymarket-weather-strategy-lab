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

/**
 * Group tracked markets into WS subscription batches by city.
 * Default: about 20 cities per WebSocket subscription.
 * @param {Iterable<any>} markets
 * @param {Map<string,any>|Set<string>|Iterable<string>} tokens tracked token ids
 * @param {number} citiesPerConnection
 * @returns {Array<{cities:string[], tokens:string[]}>}
 */
export function buildWsBatches(markets, tokens, citiesPerConnection = 20) {
  const tracked = tokens instanceof Map ? new Set(tokens.keys()) : new Set(tokens || []);
  const cityMarkets = new Map();
  for (const market of markets || []) {
    if (!market?.id || !market.tokens?.yesTokenId) continue;
    const city = String(market.city || market.eventTitle || market.id);
    if (!cityMarkets.has(city)) cityMarkets.set(city, []);
    cityMarkets.get(city).push(market);
  }
  const cities = [...cityMarkets.keys()].sort((a, b) => a.localeCompare(b));
  const size = Math.max(1, Math.floor(Number(citiesPerConnection)) || 20);
  const batches = [];
  for (let i = 0; i < cities.length; i += size) {
    const chunk = cities.slice(i, i + size);
    const assets = [];
    const seen = new Set();
    for (const city of chunk) {
      for (const market of cityMarkets.get(city)) {
        for (const token of [market.tokens.yesTokenId, market.tokens.noTokenId]) {
          if (!token || !tracked.has(token) || seen.has(token)) continue;
          seen.add(token);
          assets.push(token);
        }
      }
    }
    if (assets.length > 0) batches.push({ cities: chunk, tokens: assets });
  }
  return batches;
}

export class WsAdapter {
  /**
   * @param {import("./feed.js").Feed} feed parent feed (owns tokens/books/status)
   * @param {{url:string, reconnectSchedule:number[], pingMs:number,
   *   reconcileMs:number, citiesPerConnection?:number, log?:Function}} opts
   */
  constructor(feed, opts) {
    this.feed = feed;
    this.url = opts.url;
    this.reconnectSchedule = opts.reconnectSchedule ?? [1000, 2000, 5000, 15_000, 30_000];
    this.pingMs = opts.pingMs ?? 10_000;
    this.reconcileMs = opts.reconcileMs ?? 2500;
    this.citiesPerConnection = Math.max(1, Math.floor(Number(opts.citiesPerConnection)) || 20);
    this.log = opts.log ?? (() => {});
    this.disabled = false;
    /** @type {Map<number, WsChannel>} */
    this.channels = new Map();
    this._reconcileTimer = null;
    this._pendingRefresh = new Set();
    this._pendingRefreshTimer = null;
  }

  start() {
    if (this.disabled) return;
    this._syncChannels();
    this._startReconcile();
  }

  stop() {
    this.disabled = true;
    for (const channel of this.channels.values()) channel.stop();
    this.channels.clear();
    if (this._reconcileTimer) clearInterval(this._reconcileTimer);
    if (this._pendingRefreshTimer) clearTimeout(this._pendingRefreshTimer);
    this._reconcileTimer = null;
    this._pendingRefreshTimer = null;
    this.feed._wsConnected = false;
  }

  /** Rebuild/sync subscription batches after the tracked token set changes. */
  resubscribe() {
    if (this.disabled) return;
    this._syncChannels();
    this._startReconcile();
  }

  _buildBatches() {
    return buildWsBatches(this.feed.markets.values(), this.feed.tokens, this.citiesPerConnection);
  }

  _syncChannels() {
    const plans = this._buildBatches();
    const wanted = new Set(plans.map((_plan, index) => index));
    for (const [index, channel] of [...this.channels]) {
      if (wanted.has(index)) continue;
      channel.stop();
      this.channels.delete(index);
      this.log("info", `ws batch #${index + 1} closed (no longer needed)`);
    }
    plans.forEach((plan, index) => {
      const signature = plan.tokens.join("|");
      const existing = this.channels.get(index);
      if (!existing) {
        const channel = new WsChannel(this, index, plan);
        this.channels.set(index, channel);
        if (this.feed._running) channel.connect();
        return;
      }
      if (existing.signature === signature) return;
      existing.update(plan);
      existing.disabled = false;
      if (existing.connected) {
        existing.sendSubscription();
        this.log(
          "info",
          `ws batch #${index + 1} resubscribed (${plan.cities.length} cities / ${plan.tokens.length} assets)`,
        );
      } else if (this.feed._running) {
        existing.connect();
      }
    });
    this._updateWsStatus();
  }

  _startReconcile() {
    if (this._reconcileTimer || !this.feed._running) return;
    this._reconcileTimer = setInterval(() => {
      this.feed._pollOnce(true).catch(() => {});
    }, this.reconcileMs);
    if (typeof this._reconcileTimer.unref === "function") this._reconcileTimer.unref();
  }

  _updateWsStatus() {
    const connected = [...this.channels.values()].some((channel) => channel.connected);
    this.feed._wsConnected = connected;
    if (!this.feed._running) return;
    if (connected) this.feed._setStatus(STATUS.LIVE);
    else this.feed._setStatus(this.feed.lastUpdate > 0 ? STATUS.DEGRADED : STATUS.CONNECTING);
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

/** One WebSocket connection responsible for one city batch. */
class WsChannel {
  constructor(adapter, index, plan) {
    this.adapter = adapter;
    this.index = index;
    this.ws = null;
    this.connected = false;
    this.failures = 0;
    this.reconnectIndex = 0;
    this.disabled = false;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this.update(plan);
  }

  update(plan) {
    this.tokens = plan.tokens;
    this.cities = plan.cities;
    this.signature = this.tokens.join("|");
  }

  connect() {
    const adapter = this.adapter;
    if (this.disabled || !adapter.feed._running || this.ws || this.tokens.length === 0) return;
    let ws;
    try {
      ws = new WebSocket(adapter.url);
    } catch (err) {
      this._onFailure(`websocket init failed: ${err.message}`);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.connected = true;
      this.failures = 0;
      this.reconnectIndex = 0;
      adapter.feed._wsConnected = true;
      adapter._updateWsStatus();
      adapter.log(
        "info",
        `ws batch #${this.index + 1} connected (${this.cities.length} cities / ${this.tokens.length} assets)`,
      );
      this.sendSubscription();
      this._startPing();
    };
    ws.onmessage = (event) => {
      try {
        adapter._handleMessage(event.data);
      } catch (err) {
        adapter.log("warn", `ws message ignored: ${err.message}`);
      }
    };
    ws.onerror = () => this._onFailure("websocket error");
    ws.onclose = () => this._onFailure(this.connected ? "websocket closed" : "websocket closed before open");
  }

  sendSubscription() {
    if (!this.connected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({ type: "market", assets_ids: this.tokens }));
    } catch (err) {
      this.adapter.log("warn", `ws batch #${this.index + 1} subscribe failed: ${err.message}`);
    }
  }

  _onFailure(reason) {
    const adapter = this.adapter;
    this.failures += 1;
    const wasConnected = this.connected;
    this.connected = false;
    this.ws = null;
    this._stopPing();
    adapter.feed.lastError = reason;
    adapter._updateWsStatus();
    if (wasConnected) adapter.log("warn", `ws batch #${this.index + 1} lost: ${reason}`);
    if (this.failures >= 6 && adapter.feed.mode === "ws") {
      this.disabled = true;
      adapter.log("warn", `ws batch #${this.index + 1} disabled after repeated failures; REST polling covers it`);
      return;
    }
    if (!adapter.feed._running || !adapter.feed._allowWs || this.disabled) return;
    const delay = adapter.reconnectSchedule[Math.min(this.reconnectIndex, adapter.reconnectSchedule.length - 1)];
    this.reconnectIndex += 1;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
    if (typeof this._reconnectTimer.unref === "function") this._reconnectTimer.unref();
  }

  _startPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = setInterval(() => {
      if (!this.connected || !this.ws) return;
      try {
        this.ws.send("PING");
      } catch {
        /* reconnect handles it */
      }
    }, this.adapter.pingMs);
    if (typeof this._pingTimer.unref === "function") this._pingTimer.unref();
  }

  _stopPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._pingTimer = null;
    this._reconnectTimer = null;
  }

  stop() {
    this.disabled = true;
    this._stopPing();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.connected = false;
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
