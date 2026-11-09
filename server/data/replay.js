/**
 * server/data/replay.js — historical replay data source (docs/03 §8).
 *
 * Two ways to obtain data:
 *   1. LIVE HISTORY (default): Data API `v2/prices-history` minute prices for
 *      every selected YES token over `replayLookbackMin`, merged into one
 *      time-ordered timeline and pumped at `sim.speed`.
 *   2. FIXTURE (`REPLAY_FIXTURE=/abs/path.json`): deterministic local JSON,
 *      zero network calls. Schema:
 *
 *   {
 *     "asOf": 1794120000000,                       // optional epoch ms
 *     "markets": [{
 *       "id": "fix-m1", "city": "Test City", "bracket": "10°C",
 *       "question": "Will the highest temperature in Test City be 10°C or below on November 8?",
 *       "tokens": { "yesTokenId": "yes1", "noTokenId": "no1" },
 *       "tickSize": 0.001, "minOrderShares": 5,
 *       "endDate": "2026-11-09T12:00:00Z",           // optional, defaults asOf+24h
 *       "liquidityUsd": 10000, "spread": 0.01, "negRisk": true,
 *       "feeSchedule": { "rate": 0.05, "exponent": 1, "takerOnly": true }
 *     }],
 *     "series": {                                    // tokenId -> ascending points
 *       "yes1": [{ "ts": 1794067200000, "mid": 0.20, "bid": 0.199, "ask": 0.201 }],
 *       "no1":  [{ "ts": 1794067200000, "mid": 0.80, "bid": 0.799, "ask": 0.801 }]  // optional; derived as 1−YES when omitted
 *     }
 *   }
 *
 * Fills always use a synthetic order book around the historical mid (spread and
 * depth simulated; engine/execution code path identical to live). NO-token
 * prices are the binary complement when a NO series is not supplied.
 */
import fs from "node:fs";
import { FEES } from "../../shared/contract.js";
import { UpstreamError, clamp, nowMs, sleep, toNumOrNull } from "../util.js";

const DEFAULT_HALF_SPREAD = 0.005;
const DEPTH_SIZES = [300, 500, 800];

function cloneMarket(market) {
  return JSON.parse(JSON.stringify(market));
}

/** Mid price from a fixture point (mid preferred, else bid/ask average). */
function pointPrice(point) {
  const mid = toNumOrNull(point?.mid ?? point?.price);
  if (mid !== null && mid > 0 && mid < 1) return mid;
  const bid = toNumOrNull(point?.bid);
  const ask = toNumOrNull(point?.ask);
  if (bid !== null && ask !== null && bid > 0 && ask > 0 && bid < ask) return (bid + ask) / 2;
  return null;
}

function normalizeFixtureMarket(raw, fallbackAsOf) {
  if (!raw || typeof raw !== "object") return null;
  const tokens = raw.tokens || {};
  const yesTokenId = String(tokens.yesTokenId ?? tokens.yes ?? "");
  const noTokenId = String(tokens.noTokenId ?? tokens.no ?? "");
  if (!yesTokenId || !noTokenId) return null;
  const asOf = Number.isFinite(Number(raw.asOf)) ? Number(raw.asOf) : fallbackAsOf;
  const endDateMs = Number.isFinite(Date.parse(raw.endDate || ""))
    ? Date.parse(raw.endDate)
    : asOf + 86_400_000;
  const tickSize = Number.isFinite(Number(raw.tickSize)) && Number(raw.tickSize) > 0 ? Number(raw.tickSize) : 0.001;
  const feeSchedule = raw.feeSchedule && typeof raw.feeSchedule === "object"
    ? {
        rate: Number.isFinite(Number(raw.feeSchedule.rate)) ? Number(raw.feeSchedule.rate) : FEES.takerFeeRate,
        exponent: Number.isFinite(Number(raw.feeSchedule.exponent)) ? Number(raw.feeSchedule.exponent) : FEES.exponent,
        takerOnly: raw.feeSchedule.takerOnly !== false,
      }
    : { rate: FEES.takerFeeRate, exponent: FEES.exponent, takerOnly: FEES.takerOnly };
  return {
    id: String(raw.id),
    conditionId: String(raw.conditionId ?? ""),
    eventId: String(raw.eventId ?? ""),
    slug: String(raw.slug ?? raw.id),
    question: String(raw.question ?? ""),
    city: String(raw.city ?? ""),
    station: String(raw.station ?? ""),
    bracket: String(raw.bracket ?? ""),
    tokens: { yesTokenId, noTokenId },
    quotes: {
      YES: { bid: 0, ask: 0, mid: 0, last: null },
      NO: { bid: 0, ask: 0, mid: 0, last: null },
    },
    spread: Number.isFinite(Number(raw.spread)) ? Number(raw.spread) : 0.01,
    impliedProbability: Number.isFinite(Number(raw.impliedProbability)) ? Number(raw.impliedProbability) : 0.5,
    liquidityUsd: Number.isFinite(Number(raw.liquidityUsd)) ? Number(raw.liquidityUsd) : 10_000,
    volume24hUsd: Number.isFinite(Number(raw.volume24hUsd)) ? Number(raw.volume24hUsd) : 0,
    tickSize,
    minOrderShares: Number.isFinite(Number(raw.minOrderShares)) && Number(raw.minOrderShares) > 0
      ? Number(raw.minOrderShares)
      : 5,
    endDate: new Date(endDateMs).toISOString(),
    eventStartTime: String(raw.eventStartTime ?? ""),
    acceptingOrders: raw.acceptingOrders !== false,
    closed: Boolean(raw.closed),
    negRisk: raw.negRisk !== false,
    feeSchedule,
    updatedAt: nowMs(),
    stale: false,
    eventTitle: String(raw.eventTitle ?? ""),
    eventSlug: String(raw.eventSlug ?? ""),
    protocolVersion: "fixture",
    outcomes: ["Yes", "No"],
  };
}

/**
 * Load fixture markets from a REPLAY_FIXTURE file (synchronous, tiny).
 * @param {string} fixturePath absolute path
 * @returns {Array<any>} normalized MarketSnapshot[]
 */
export function loadFixtureMarkets(fixturePath) {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const fixture = JSON.parse(raw);
  const asOf = Number.isFinite(Number(fixture.asOf)) ? Number(fixture.asOf) : Date.now();
  const markets = [];
  for (const entry of Array.isArray(fixture.markets) ? fixture.markets : []) {
    const market = normalizeFixtureMarket(entry, asOf);
    if (market) markets.push(market);
  }
  return markets;
}

/** Read + normalize fixture prices: tokenId -> [{ts, price}] */
function loadFixtureSeries(fixturePath, markets) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const series = new Map();
  const rawSeries = fixture.series && typeof fixture.series === "object" ? fixture.series : {};
  for (const [tokenId, points] of Object.entries(rawSeries)) {
    if (!Array.isArray(points)) continue;
    const cleaned = points
      .map((point) => ({ ts: Number(point?.ts ?? point?.timestamp), price: pointPrice(point) }))
      .filter((point) => Number.isFinite(point.ts) && point.price !== null);
    cleaned.sort((a, b) => a.ts - b.ts);
    if (cleaned.length > 0) series.set(String(tokenId), cleaned);
  }
  // derive a NO series from YES when missing (binary complement)
  for (const market of markets) {
    const yes = series.get(market.tokens.yesTokenId);
    const no = series.get(market.tokens.noTokenId);
    if (yes && !no) series.set(market.tokens.noTokenId, yes.map((p) => ({ ts: p.ts, price: 1 - p.price })));
  }
  return series;
}

/** Synthetic two-sided book around a mid price. */
function synthBook(price, tickSize, halfSpread) {
  const tick = tickSize > 0 ? tickSize : 0.001;
  const mid = clamp(price, tick, 1 - tick);
  const bid = clamp(mid - halfSpread, tick, 1 - tick);
  const ask = clamp(mid + halfSpread, tick, 1 - tick);
  const safeBid = bid < ask ? bid : Math.max(tick, mid - tick);
  const safeAsk = bid < ask ? ask : Math.min(1 - tick, mid + tick);
  const asks = DEPTH_SIZES.map((size, i) => ({
    price: clamp(safeAsk + i * tick * 2, tick, 0.999),
    size,
  }));
  const bids = DEPTH_SIZES.map((size, i) => ({
    price: clamp(safeBid - i * tick * 2, 0.001, 1 - tick),
    size,
  }));
  return {
    bids,
    asks,
    bestBid: bids[0].price,
    bestAsk: asks[0].price,
    mid,
    lastTradePrice: mid,
    tickSize: tick,
    minOrderSize: 5,
    hash: `replay:${mid.toFixed(6)}`,
  };
}

export class ReplaySource {
  /**
   * @param {{clob: import("./clob.js").ClobClient, markets:any[], lookbackMin:number,
   *   speed:number, tickIntervalMs?:number, fixturePath?:string|null,
   *   log?: (level:string,msg:string)=>void}} cfg
   */
  constructor(cfg) {
    this.clob = cfg.clob;
    this.mode = "replay";
    this.lookbackMin = cfg.lookbackMin ?? 60;
    this.speed = Math.max(1, cfg.speed ?? 10);
    this.tickIntervalMs = cfg.tickIntervalMs ?? 1000;
    this.fixturePath = cfg.fixturePath || null;
    this.log = cfg.log ?? (() => {});
    this.selected = cfg.markets ?? [];
    this.marketIds = this.selected.map((m) => m.id);
    /** @type {Map<string, any>} marketId -> market clone with quotes */
    this.markets = new Map();
    /** @type {Map<string, Array<{ts:number, price:number}>>} tokenId -> price series */
    this.series = new Map();
    /** @type {Map<string, {marketId:string, side:"YES"|"NO", tickSize:number}>} */
    this.tokenMeta = new Map();
    /** @type {Map<string, string>} marketId -> yesTokenId */
    this.yesTokenByMarket = new Map();
    /** @type {number[]} union timeline (ms) */
    this.timeline = [];
    this.cursor = 0;
    this.stepMs = 60_000;
    this.running = false;
    this.paused = false;
    this.done = false;
    this.statusValue = "connecting";
    this.loaded = false;
    this.lastUpdate = 0;
    this.latencyMs = 0;
    this.dataWindow = { start: 0, end: 0 };
    this.sourceKind = this.fixturePath ? "fixture" : "prices-history";
  }

  /** Load market data. Throws UpstreamError when no usable history exists. */
  async load() {
    if (this.fixturePath) return this._loadFixture();
    let timer = null;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new UpstreamError("replay 历史行情加载超时（>20s），请稍后重试或改用 fixture 回放")),
        20_000,
      );
      if (typeof timer.unref === "function") timer.unref();
    });
    try {
      await Promise.race([this._loadLiveHistory(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Parallel Data API history load (concurrency 4, no shared rate limiter). */
  async _loadLiveHistory() {
    const cutoff = nowMs() - this.lookbackMin * 60_000;
    const timestampSet = new Set();
    const queue = this.selected.filter((market) => market.tokens?.yesTokenId);
    const concurrency = Math.min(4, Math.max(1, queue.length));
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length && this.running !== false) {
        const market = queue[cursor];
        cursor += 1;
        let history = [];
        try {
          history = await this.clob.getPriceHistory(market.tokens.yesTokenId, {
            interval: "1d",
            bucketSeconds: 60,
            bypassLimiter: true,
          });
        } catch (err) {
          this.log("warn", `replay history failed for ${market.id}: ${err.message}`);
          continue;
        }
        const points = history.filter((point) => point.ts >= cutoff && point.price > 0 && point.price < 1);
        if (points.length < 2) continue;
        this.series.set(market.tokens.yesTokenId, points);
        if (market.tokens?.noTokenId) {
          this.series.set(market.tokens.noTokenId, points.map((p) => ({ ts: p.ts, price: 1 - p.price })));
        }
        for (const point of points) timestampSet.add(point.ts);
        this._registerMarket(market);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    this._finishLoad(timestampSet);
  }

  _loadFixture() {
    const markets = loadFixtureMarkets(this.fixturePath);
    const series = loadFixtureSeries(this.fixturePath, markets);
    const timestampSet = new Set();
    this.selected = markets;
    this.marketIds = markets.map((m) => m.id);
    for (const market of markets) {
      const yesSeries = series.get(market.tokens.yesTokenId);
      if (!yesSeries || yesSeries.length < 2) {
        this.log("warn", `fixture market ${market.id} has no usable series; skipped`);
        continue;
      }
      this.series.set(market.tokens.yesTokenId, yesSeries);
      const noSeries = series.get(market.tokens.noTokenId);
      if (noSeries) this.series.set(market.tokens.noTokenId, noSeries);
      for (const point of yesSeries) timestampSet.add(point.ts);
      const first = yesSeries[0];
      market.quotes.YES = { bid: first.price, ask: first.price, mid: first.price, last: first.price };
      market.impliedProbability = first.price;
      this._registerMarket(market);
    }
    this._finishLoad(timestampSet);
  }

  _registerMarket(market) {
    const clone = cloneMarket(market);
    clone.closed = false;
    clone.stale = false;
    this.markets.set(market.id, clone);
    this.yesTokenByMarket.set(market.id, market.tokens.yesTokenId);
    this.tokenMeta.set(market.tokens.yesTokenId, {
      marketId: market.id,
      side: "YES",
      tickSize: clone.tickSize || 0.001,
    });
    if (market.tokens.noTokenId) {
      this.tokenMeta.set(market.tokens.noTokenId, {
        marketId: market.id,
        side: "NO",
        tickSize: clone.tickSize || 0.001,
      });
    }
    this.marketIds = [...this.markets.keys()];
  }

  _finishLoad(timestampSet) {
    if (timestampSet.size < 2) {
      throw new UpstreamError("replay 无可用历史行情（prices-history 为空或 fixture series 缺失），请稍后重试或换用 live 模式");
    }
    this.timeline = [...timestampSet].sort((a, b) => a - b);
    if (this.timeline.length > 1) this.stepMs = this.timeline[1] - this.timeline[0];
    this.cursor = this.timeline[0];
    this.dataWindow = { start: this.timeline[0], end: this.timeline[this.timeline.length - 1] };
    this.loaded = true;
    this.lastUpdate = nowMs();
    this.statusValue = "live";
  }

  /**
   * Pump the timeline; awaits onPoint for every timestamp.
   * @param {{onReady?:Function, onPoint:(ts:number)=>Promise<void>|void, onDone?:Function, onError?:Function}} handlers
   */
  async start(handlers) {
    try {
      this.running = true;
      this.statusValue = "connecting";
      await this.load();
      if (typeof handlers.onReady === "function") handlers.onReady();
      for (let i = 0; i < this.timeline.length; i += 1) {
        while (this.paused && this.running) await sleep(100);
        if (!this.running) break;
        this.cursor = this.timeline[i];
        this.lastUpdate = nowMs();
        await handlers.onPoint(this.cursor);
        if (i < this.timeline.length - 1) {
          const gap = this.timeline[i + 1] - this.timeline[i];
          const wall = Math.min(2000, Math.max(1, gap / this.speed));
          await sleep(wall);
        }
      }
      this.statusValue = "offline";
      if (this.running && typeof handlers.onDone === "function") handlers.onDone();
      this.done = true;
      this.running = false;
    } catch (err) {
      this.running = false;
      this.statusValue = "offline";
      if (typeof handlers.onError === "function") handlers.onError(err);
    }
  }

  stop() {
    this.running = false;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  /** YES price of a market at (or before) the replay cursor. */
  priceAt(marketId) {
    const market = this.markets.get(marketId);
    if (!market) return null;
    const series = this.series.get(market.tokens?.yesTokenId);
    if (!series || series.length === 0) return null;
    let lo = 0;
    let hi = series.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid].ts <= this.cursor) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found >= 0 ? series[found].price : series[0].price;
  }

  /** Build the current snapshot for one market with synthetic quotes. */
  snapshot(marketId) {
    const market = this.markets.get(marketId);
    if (!market) return null;
    const price = this.priceAt(marketId);
    if (price === null) return null;
    const tick = market.tickSize || 0.001;
    const half = Math.max(tick, DEFAULT_HALF_SPREAD);
    const yesBook = synthBook(price, tick, half);
    const noBook = synthBook(1 - price, tick, half);
    market.quotes = {
      YES: { bid: yesBook.bestBid, ask: yesBook.bestAsk, mid: yesBook.mid, last: yesBook.mid },
      NO: { bid: noBook.bestBid, ask: noBook.bestAsk, mid: noBook.mid, last: noBook.mid },
    };
    market.spread = Math.max(0, yesBook.bestAsk - yesBook.bestBid);
    market.impliedProbability = yesBook.mid;
    market.updatedAt = this.cursor;
    market.stale = false;
    return market;
  }

  getMarkets() {
    return this.marketIds.map((id) => this.snapshot(id)).filter(Boolean);
  }

  getMarket(marketId) {
    return this.snapshot(marketId);
  }

  /** Synthetic order book for a token at the replay cursor. */
  getBook(tokenId) {
    const meta = this.tokenMeta.get(tokenId);
    if (!meta) return null;
    const price = this.priceAt(meta.marketId);
    if (price === null) return null;
    const tokenPrice = meta.side === "YES" ? price : 1 - price;
    const half = Math.max(meta.tickSize, DEFAULT_HALF_SPREAD);
    const book = synthBook(tokenPrice, meta.tickSize, half);
    book.tokenId = tokenId;
    book.hash = `replay:${this.cursor}:${tokenId}`;
    return book;
  }

  /** Quote samples up to the cursor (signal input). */
  getHistory(tokenId, seconds) {
    const meta = this.tokenMeta.get(tokenId);
    if (!meta) return [];
    let series = this.series.get(tokenId);
    if (!series && meta.side === "NO") {
      const yesTokenId = this.yesTokenByMarket.get(meta.marketId);
      const yesSeries = yesTokenId ? this.series.get(yesTokenId) : null;
      if (yesSeries) series = yesSeries.map((p) => ({ ts: p.ts, price: 1 - p.price }));
    }
    if (!series) return [];
    const cutoff = this.cursor - Math.max(1, seconds) * 1000;
    const samples = [];
    const half = Math.max(meta.tickSize, DEFAULT_HALF_SPREAD);
    for (const point of series) {
      if (point.ts > this.cursor) break;
      if (point.ts < cutoff) continue;
      const book = synthBook(point.price, meta.tickSize, half);
      samples.push({
        ts: point.ts,
        bid: book.bestBid,
        ask: book.bestAsk,
        mid: book.mid,
        last: book.mid,
        hash: `replay:${point.ts}:${tokenId}`,
      });
    }
    return samples;
  }

  getLatest(tokenId) {
    const history = this.getHistory(tokenId, 3600);
    return history.length ? history[history.length - 1] : null;
  }

  status() {
    return {
      status: this.statusValue,
      lastUpdate: this.lastUpdate,
      marketsTracked: this.markets.size,
      latencyMs: this.latencyMs,
      mode: "replay",
      tokens: this.tokenMeta.size,
      progress:
        this.timeline.length > 1
          ? Math.min(1, Math.max(0, (this.cursor - this.dataWindow.start) / (this.dataWindow.end - this.dataWindow.start)))
          : 0,
      dataWindow: this.dataWindow,
      source: this.sourceKind,
    };
  }
}

export { synthBook };
export default ReplaySource;
