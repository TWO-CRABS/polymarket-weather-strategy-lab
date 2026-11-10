/**
 * server/data/gamma.js — Polymarket Gamma market discovery + normalization.
 *
 * Discovery paths (all public, verified live 2026-11-08):
 *   1. GET /public-search?q=highest%20temperature&limit_per_type=50  (primary;
 *      returns events with fully nested markets[])
 *   2. GET /events/keyset?tag_id=104596&closed=false&limit=100&order=endDate
 *      &ascending=true&end_date_min=<ISO>                            (fallback)
 *   3. GET /events?tag_id=104596&closed=false&...                    (legacy fallback)
 *
 * Resolution checks:
 *   GET /markets?id=<marketId>  -> [{ closed, outcomePrices, ... }]
 *
 * A normalized MarketSnapshot is emitted per °C bracket market exactly as
 * documented in docs/07-api-contract.md §3.1 (plus a few additive metadata
 * fields: eventTitle / eventSlug / protocolVersion).
 */
import { FEES } from "../../shared/contract.js";
import { cityLocalDayEndMs } from "../../shared/cityTimezones.js";
import { fetchJson, nowMs, parseDateMs, parseJsonArray, toNum, toNumOrNull } from "../util.js";

const GAMMA = "https://gamma-api.polymarket.com";
const WEATHER_TAG_ID = 104596; // "Highest temperature"
const TEMPERATURE_TITLE = /^highest temperature in (.+?) on (.+?)\?$/i;
/** Discovery window: everything ending from today 00:00Z to now + 36h. */
const DISCOVERY_HORIZON_MS = 36 * 3600_000;
const MAX_DISCOVERY_PAGES = 4;
const POLYV2_SLUG = /^polyv2[-_]/i;

/**
 * 实际交易截止（毫秒）：温度 negRisk 市场交易到城市本地观察日 24:00（次日当地 00:00，DST 感知）；
 * 非温度市场回退到 endDate。优先使用快照里的 tradingCutoff。
 */
export function effectiveTradingEndMs(market) {
  if (!market) return NaN;
  const explicit = Date.parse(market.tradingCutoff);
  if (Number.isFinite(explicit)) return explicit;
  const end = Date.parse(market.endDate);
  if (!Number.isFinite(end)) return NaN;
  // Weather events use endDate=observation day 12:00Z; real cutoff is the
  // station-local end of that observation day (next local 00:00).
  if (market.negRisk && new Date(end).getUTCHours() === 12) {
    const dateKey = new Date(end).toISOString().slice(0, 10);
    const localEnd = cityLocalDayEndMs(market.city, dateKey);
    if (Number.isFinite(localEnd)) return localEnd;
    return end + 12 * 3600_000;
  }
  return end;
}

/**
 * 事件级实际交易截止。事件 keyset 摘要可能没有 negRisk 字段，因此用
 * “温度事件 endDate 固定为观察日 12:00Z”判定，并按城市时区换算到当地 24:00。
 */
export function effectiveEventTradingEndMs(event) {
  const end = parseDateMs(event?.endDate);
  if (!Number.isFinite(end)) return NaN;
  if (new Date(end).getUTCHours() === 12) {
    const dateKey = new Date(end).toISOString().slice(0, 10);
    const city = event?.city || extractCity(String(event?.title || ""));
    const localEnd = cityLocalDayEndMs(city, dateKey);
    if (Number.isFinite(localEnd)) return localEnd;
    return end + 12 * 3600_000;
  }
  return end;
}

/** Common city aliases used by Polymarket event titles. */
const CITY_ALIASES = {
  nyc: "New York City",
  "new york": "New York City",
  la: "Los Angeles",
  sf: "San Francisco",
  dc: "Washington",
  "washington dc": "Washington",
  "sao paulo": "São Paulo",
  "são paulo": "São Paulo",
  istanbul: "Istanbul",
  moscow: "Moscow",
};

/**
 * Canonical city extraction. The market question is preferred because event
 * titles are abbreviated ("NYC") while questions use the full name.
 * @param {string} title event title
 * @param {string} [question] market question
 */
export function extractCity(title, question) {
  let city = "";
  const fromQuestion = /highest temperature in (.+?) be /i.exec(question || "");
  if (fromQuestion) city = fromQuestion[1];
  if (!city) {
    const fromTitle = /highest temperature in (.+?) on /i.exec(title || "");
    if (fromTitle) city = fromTitle[1];
  }
  city = city.replace(/\s+/g, " ").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const alias = CITY_ALIASES[city.toLowerCase()];
  return alias || city;
}

/** Extract an ICAO station code (e.g. KLGA / ZUCK) from resolution metadata. */
export function extractStation(market, event) {
  const sources = [market?.resolutionSource, event?.resolutionSource, market?.description, event?.description];
  for (const text of sources) {
    if (typeof text !== "string") continue;
    const ids = /[?&]ids=([A-Z]{4})(?:[&,]|$)/.exec(text);
    if (ids) return ids[1];
    const paren = /\(([A-Z]{4})\)/.exec(text);
    if (paren) return paren[1];
  }
  return "";
}

/** Parse Gamma's JSON-encoded `feeSchedule` (or synthesize from FEES). */
export function normalizeFeeSchedule(raw) {
  if (raw && typeof raw === "object") {
    return {
      rate: toNum(raw.rate, FEES.takerFeeRate),
      exponent: toNum(raw.exponent, FEES.exponent),
      takerOnly: raw.takerOnly !== false,
    };
  }
  if (raw && typeof raw === "string") {
    try {
      return normalizeFeeSchedule(JSON.parse(raw));
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Normalize one Gamma market into a MarketSnapshot.
 * @param {any} market raw Gamma market
 * @param {any} event owning event
 * @param {number} now epoch ms
 * @returns {object|null} null when the market cannot be traded/parsed
 */
export function normalizeMarket(market, event, now = nowMs()) {
  if (!market || typeof market !== "object") return null;
  const clobTokenIds = parseJsonArray(market.clobTokenIds).filter(Boolean);
  const positionIds = parseJsonArray(market.positionIds).filter(Boolean);
  const tokenIds = clobTokenIds.length >= 2 ? clobTokenIds : positionIds;
  if (tokenIds.length < 2) return null;

  const eventTitle = String(event?.title || "");
  const question = String(market.question || "");
  const city = extractCity(eventTitle, question);
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices).map((p) => toNum(p, NaN));
  const yesPrice = Number.isFinite(outcomePrices[0]) ? outcomePrices[0] : null;

  const bestBid = toNumOrNull(market.bestBid);
  const bestAsk = toNumOrNull(market.bestAsk);
  const mid =
    yesPrice !== null && yesPrice > 0 && yesPrice < 1
      ? yesPrice
      : bestBid !== null && bestAsk !== null && bestBid > 0 && bestAsk > 0
        ? (bestBid + bestAsk) / 2
        : null;
  const yesBid = bestBid !== null && bestBid > 0 ? bestBid : 0;
  const yesAsk = bestAsk !== null && bestAsk > 0 ? bestAsk : 0;
  const quotedSpread = toNumOrNull(market.spread);
  const spread = yesBid > 0 && yesAsk > 0 ? Math.max(0, yesAsk - yesBid) : quotedSpread ?? 1;
  const noMid = mid !== null ? 1 - mid : null;

  const closed = Boolean(market.closed) || Boolean(event?.closed) || Boolean(market.archived);
  const endDateRaw = market.endDate || event?.endDate || "";
  const endDateMs = parseDateMs(endDateRaw);
  const isNegRisk = Boolean(market.negRisk);
  const isWeatherCutoff = Number.isFinite(endDateMs) && isNegRisk && new Date(endDateMs).getUTCHours() === 12;
  const observationDateKey = Number.isFinite(endDateMs) ? new Date(endDateMs).toISOString().slice(0, 10) : "";
  const tradingCutoffMs = isWeatherCutoff
    ? cityLocalDayEndMs(city, observationDateKey)
    : endDateMs;
  const feeSchedule = normalizeFeeSchedule(market.feeSchedule);
  const takerFee =
    feeSchedule ??
    (market.feesEnabled && market.feeType === FEES.feeType
      ? { rate: FEES.takerFeeRate, exponent: FEES.exponent, takerOnly: FEES.takerOnly }
      : null);

  const tickSize = toNum(market.orderPriceMinTickSize, 0.001);
  const minOrderSize = toNum(market.orderMinSize, 5);

  return {
    id: String(market.id ?? ""),
    conditionId: String(market.conditionId ?? ""),
    eventId: String(event?.id ?? ""),
    slug: String(market.slug ?? ""),
    question,
    city,
    station: extractStation(market, event),
    bracket:
      String(market.groupItemTitle || "").trim() ||
      (/(?:be|between)\s+(.+?)\s+on\b/i.exec(question)?.[1]?.trim() ?? ""),
    tokens: { yesTokenId: tokenIds[0], noTokenId: tokenIds[1] },
    quotes: {
      YES: { bid: yesBid, ask: yesAsk, mid: mid ?? 0, last: null },
      NO: { bid: 0, ask: 0, mid: noMid ?? 0, last: null },
    },
    spread,
    impliedProbability: mid ?? 0,
    liquidityUsd: toNum(market.liquidityNum ?? market.liquidityClob ?? market.liquidity, 0),
    volume24hUsd: toNum(market.volume24hr ?? market.volume24h, 0),
    /** additive: real top-of-book depth in USDC, filled by discovery priming */
    bookDepthUsd: 0,
    tickSize: tickSize > 0 ? tickSize : 0.001,
    minOrderShares: minOrderSize > 0 ? minOrderSize : 5,
    endDate: endDateMs ? new Date(endDateMs).toISOString() : "",
    /**
     * 温度（negRisk）市场的实际交易截止：城市本地观察日 24:00（次日当地 00:00）。
     * Gamma 的 endDate 是观察日 12:00Z（约为裁决窗口起点），CLOB 实测交易/价格
     * 更新持续到次日 00:00Z 之后（Nov 7 伦敦 closedTime=Nov 8 00:41Z）。
     */
    tradingCutoff: tradingCutoffMs ? new Date(tradingCutoffMs).toISOString() : "",
    eventStartTime: String(market.eventStartTime || event?.startDate || ""),
    acceptingOrders: Boolean(market.acceptingOrders) && !closed && event?.active !== false,
    closed,
    negRisk: Boolean(market.negRisk),
    feeSchedule: takerFee,
    updatedAt: now,
    stale: false,
    /* additive metadata (ignored by contract consumers) */
    eventTitle,
    eventSlug: String(event?.slug ?? ""),
    protocolVersion: String(market.version || "v1"),
    outcomes: outcomes.length ? outcomes : ["Yes", "No"],
  };
}

/** Normalize a whole event (null when the title is not a highest-temperature event). */export function normalizeEvent(rawEvent, now = nowMs()) {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const title = String(rawEvent.title || "");
  const match = TEMPERATURE_TITLE.exec(title.trim());
  if (!match) return null;
  // Polymarket Protocol V2 duplicates share the title but use position ids that
  // are not CLOB-tradeable; they are published as polyv2-* events.
  if (POLYV2_SLUG.test(String(rawEvent.slug || ""))) return null;
  if (!Array.isArray(rawEvent.markets) || rawEvent.markets.length === 0) return null;

  const markets = [];
  for (const raw of rawEvent.markets) {
    const normalized = normalizeMarket(raw, rawEvent, now);
    if (normalized && normalized.id) markets.push(normalized);
  }
  if (markets.length === 0) return null;

  const dateMs = parseDateMs(rawEvent.endDate);
  return {
    id: String(rawEvent.id ?? ""),
    title,
    slug: String(rawEvent.slug ?? ""),
    city: extractCity(title),
    date: dateMs ? new Date(dateMs).toISOString().slice(0, 10) : "",
    endDate: dateMs ? new Date(dateMs).toISOString() : "",
    closed: Boolean(rawEvent.closed),
    active: rawEvent.active !== false,
    negRisk: Boolean(rawEvent.negRisk),
    marketCount: markets.length,
    markets,
  };
}

/**
 * Fetch raw temperature events: daily-temperature tag 104596 keyset with a
 * date window and cursor pagination (verified live), then public-search as a
 * fallback. Filters out stale events and Polymarket V2 duplicate events.
 */
export async function fetchTemperatureEvents(log = () => {}) {
  const now = nowMs();
  const lookbackStart = new Date(now - 48 * 3600_000).toISOString();
  const horizon = new Date(now + DISCOVERY_HORIZON_MS).toISOString();

  const collected = new Map();
  const addEvents = (events) => {
    for (const event of events) {
      if (!event || POLYV2_SLUG.test(String(event.slug || ""))) continue;
      if (!TEMPERATURE_TITLE.test(String(event.title || "").trim())) continue;
      const endMs = parseDateMs(event.endDate);
      if (!Number.isFinite(endMs)) continue;
      // 温度事件 endDate 是观察日 12:00Z；实际交易到城市本地观察日 24:00。
      // 事件摘要可能没有 negRisk 字段，不能依赖它，否则会过早丢弃当天事件。
      const cutoffMs = effectiveEventTradingEndMs(event);
      if (!Number.isFinite(cutoffMs) || cutoffMs <= now) continue; // exclude expired/stale events
      collected.set(String(event.id ?? event.slug), event);
    }
  };

  let cursor = null;
  for (let page = 0; page < MAX_DISCOVERY_PAGES; page += 1) {
    const params = new URLSearchParams({
      tag_id: String(WEATHER_TAG_ID),
      closed: "false",
      limit: "100",
      order: "endDate",
      ascending: "true",
      end_date_min: lookbackStart,
      end_date_max: horizon,
    });
    if (cursor) params.set("after_cursor", cursor);
    try {
      const json = await fetchJson(`${GAMMA}/events/keyset?${params.toString()}`, {
        timeoutMs: 15_000,
        retries: 1,
        label: "gamma events keyset",
      });
      const events = Array.isArray(json?.events) ? json.events : Array.isArray(json) ? json : [];
      addEvents(events);
      cursor = json?.next_cursor || null;
      if (!cursor || events.length === 0) break;
    } catch (err) {
      log("warn", `keyset discovery page ${page} failed: ${err.message}`);
      break;
    }
  }

  if (collected.size === 0) {
    try {
      const json = await fetchJson(
        `${GAMMA}/public-search?q=highest%20temperature&limit_per_type=100`,
        { timeoutMs: 15_000, retries: 1, label: "gamma public-search" },
      );
      const events = Array.isArray(json) ? json : Array.isArray(json?.events) ? json.events : [];
      addEvents(events);
    } catch (err) {
      log("warn", `public-search discovery failed: ${err.message}`);
    }
  }
  return [...collected.values()];
}

/** Fetch one raw Gamma market by id (used for resolution polling). */
export async function fetchMarketById(marketId) {
  // Gamma 的单市场接口是路径参数 /markets/{id}；
  // 旧代码用 /markets?id= 会静默返回 []，导致官方裁决永远 pending。
  const json = await fetchJson(`${GAMMA}/markets/${encodeURIComponent(marketId)}`, {
    timeoutMs: 8000,
    retries: 1,
    label: "gamma market",
  });
  const list = Array.isArray(json) ? json : json ? [json] : [];
  return list[0] || null;
}

/** Top-5-level bid+ask depth in USDC (real executable liquidity proxy). */
export function bookDepthUsd(book) {
  if (!book) return 0;
  let depth = 0;
  for (const level of (book.asks || []).slice(0, 5)) depth += level.price * level.size;
  for (const level of (book.bids || []).slice(0, 5)) depth += level.price * level.size;
  return depth;
}

/** Is this a mid-range, accepting bracket that a momentum strategy can trade? */
export function isTradeableMarket(market) {
  if (!market || market.closed) return false;
  const mid = market.impliedProbability;
  if (!(mid >= 0.02 && mid <= 0.98)) return false;
  const endMs = parseDateMs(market.endDate);
  if (!Number.isFinite(endMs) || endMs <= nowMs()) return false;
  if (!market.acceptingOrders) return false;
  if (!(market.quotes?.YES?.ask > 0) && !(market.quotes?.NO?.ask > 0)) return false;
  return true;
}

/** Sort for the UI market grid: tradeable mid-range first, then activity. */
export function compareMarketsForUi(a, b) {
  const t = (market) => (isTradeableMarket(market) ? 1 : 0);
  return (
    t(b) - t(a) ||
    (b.volume24hUsd || 0) - (a.volume24hUsd || 0) ||
    (b.bookDepthUsd || 0) - (a.bookDepthUsd || 0) ||
    (b.liquidityUsd || 0) - (a.liquidityUsd || 0)
  );
}

/**
 * Sort for strategy selection: real 24h volume first (active brackets move and
 * fill), then executable top-of-book depth, then Gamma liquidity as tie-break.
 */
export function compareMarketsForSelection(a, b) {
  return (
    (b.volume24hUsd || 0) - (a.volume24hUsd || 0) ||
    (b.bookDepthUsd || 0) - (a.bookDepthUsd || 0) ||
    (b.liquidityUsd || 0) - (a.liquidityUsd || 0)
  );
}

/**
 * Live temperature-market discovery with a ~60s cache.
 * Holds every open highest-temperature bracket market plus a small resolution
 * cache used by live runs to settle positions after a market closes.
 */
export class TemperatureDiscovery {
  /** @param {{intervalMs?: number, clob?: import("./clob.js").ClobClient,
   *   log?: (level:string,msg:string)=>void}} [opts] */
  constructor(opts = {}) {
    this.intervalMs = opts.intervalMs ?? 60_000;
    this.clob = opts.clob ?? null;
    this.log = opts.log ?? (() => {});
    /** @type {Map<string, any>} marketId -> MarketSnapshot */
    this.markets = new Map();
    /** @type {Map<string, any>} tokenId -> normalized book (discovery priming) */
    this.books = new Map();
    /** @type {Map<string, any>} eventId -> event summary */
    this.events = new Map();
    /** @type {Map<string, {checkedAt:number, result:any}>} */
    this._resolutionCache = new Map();
    this.updatedAt = 0;
    this.lastError = null;
    this._refreshing = false;
    this._timer = null;
    /** @type {Array<(payload:{markets:any[],events:any[]})=>void>} */
    this._listeners = [];
  }

  onRefresh(fn) {
    this._listeners.push(fn);
  }

  /** Refresh the whole universe from Gamma. Never throws. */
  async refresh() {
    if (this._refreshing) return { ok: false, reason: "busy" };
    this._refreshing = true;
    try {
      const rawEvents = await fetchTemperatureEvents(this.log);
      const now = nowMs();
      const markets = new Map();
      const events = new Map();
      for (const rawEvent of rawEvents) {
        const event = normalizeEvent(rawEvent, now);
        if (!event) continue;
        const openMarkets = event.markets.filter((m) => {
          // 温度市场在观察日 12:00Z 之后仍可交易到城市本地 24:00。
          const cutoffMs = effectiveTradingEndMs(m);
          return !m.closed && Number.isFinite(cutoffMs) && cutoffMs > now;
        });
        if (openMarkets.length === 0) continue;
        events.set(event.id, {
          id: event.id,
          title: event.title,
          slug: event.slug,
          city: event.city,
          date: event.date,
          marketCount: openMarkets.length,
          endDate: event.endDate,
        });
        for (const market of openMarkets) markets.set(market.id, market);
      }
      this.markets = markets;
      this.events = events;
      // Populate real top-of-book quotes for EVERY discovered market so the
      // universe filter and the market grid work on executable prices rather
      // than inflated Gamma liquidity fields (batch /books, 500 ids/request).
      await this._primeQuotes();
      this.updatedAt = now;
      this.lastError = null;
      const payload = { markets: this.getMarkets(), events: this.getEvents() };
      for (const listener of this._listeners) {
        try {
          listener(payload);
        } catch (err) {
          this.log("warn", `discovery listener failed: ${err.message}`);
        }
      }
      return { ok: true, marketCount: markets.size, eventCount: events.size };
    } catch (err) {
      this.lastError = err.message;
      this.log("warn", `discovery refresh failed: ${err.message}`);
      return { ok: false, reason: err.message };
    } finally {
      this._refreshing = false;
    }
  }

  start(intervalMs = this.intervalMs) {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.refresh().catch(() => {});
    }, intervalMs);
    if (typeof this._timer.unref === "function") this._timer.unref();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /**
   * Prime every discovered market with real /books quotes. One batch per ≤500
   * tokens (verified fast); failure keeps the Gamma-embedded quotes.
   */
  async _primeQuotes() {
    const markets = [...this.markets.values()];
    if (!this.clob || markets.length === 0 || typeof this.clob.getBooks !== "function") return;
    const tokenIds = [];
    for (const market of markets) {
      if (market.tokens?.yesTokenId) tokenIds.push(market.tokens.yesTokenId);
      // NO quotes are derived as the binary complement of YES for the grid;
      // the live feed fetches real NO books for markets it tracks.
    }
    if (tokenIds.length === 0) return;
    const started = nowMs();
    try {
      const books = await this.clob.getBooks(tokenIds, { chunkSize: 500, fallback: false });
      for (const [tokenId, book] of books) this.books.set(tokenId, book);
      for (const market of markets) this._applyBooksToMarket(market);
      this.log(
        "info",
        `discovery primed ${markets.length} markets with ${books.size}/${tokenIds.length} YES books in ${nowMs() - started}ms`,
      );
    } catch (err) {
      this.log("warn", `discovery quote priming failed: ${err.message}`);
    }
  }

  _applyBooksToMarket(market) {
    const yesBook = market.tokens?.yesTokenId ? this.books.get(market.tokens.yesTokenId) : null;
    const noBook = market.tokens?.noTokenId ? this.books.get(market.tokens.noTokenId) : null;
    let yesMid = null;
    let yesBid = 0;
    let yesAsk = 0;
    let yesLast = null;
    if (yesBook) {
      yesBid = yesBook.bestBid > 0 ? yesBook.bestBid : 0;
      yesAsk = yesBook.bestAsk > 0 ? yesBook.bestAsk : 0;
      if (yesBid > 0 && yesAsk > 0) yesMid = (yesBid + yesAsk) / 2;
      else if (yesBook.mid !== null && yesBook.mid !== undefined) yesMid = yesBook.mid;
      yesLast = yesBook.lastTradePrice ?? null;
      market.tickSize = yesBook.tickSize > 0 ? yesBook.tickSize : market.tickSize;
      market.minOrderShares = yesBook.minOrderSize > 0 ? yesBook.minOrderSize : market.minOrderShares;
      market.negRisk = Boolean(yesBook.negRisk);
    }
    let noMid = null;
    let noBid = 0;
    let noAsk = 0;
    if (noBook) {
      noBid = noBook.bestBid > 0 ? noBook.bestBid : 0;
      noAsk = noBook.bestAsk > 0 ? noBook.bestAsk : 0;
      if (noBid > 0 && noAsk > 0) noMid = (noBid + noAsk) / 2;
      else if (noBook.mid !== null && noBook.mid !== undefined) noMid = noBook.mid;
    }
    if (yesMid !== null) {
      const clamp01 = (v) => Math.min(0.999, Math.max(0.001, v));
      const derivedNo =
        yesBid > 0 && yesAsk > 0
          ? { bid: clamp01(1 - yesAsk), ask: clamp01(1 - yesBid), mid: 1 - yesMid, last: null }
          : { bid: 0, ask: 0, mid: 1 - yesMid, last: null };
      market.quotes = {
        YES: { bid: yesBid, ask: yesAsk, mid: yesMid, last: yesLast },
        NO: noBook
          ? { bid: noBid, ask: noAsk, mid: noMid ?? 1 - yesMid, last: noBook.lastTradePrice ?? null }
          : derivedNo,
      };
      market.impliedProbability = yesMid;
      if (yesBid > 0 && yesAsk > 0) market.spread = Math.max(0, yesAsk - yesBid);
    }
    market.bookDepthUsd = bookDepthUsd(yesBook) + bookDepthUsd(noBook);
    market.updatedAt = nowMs();
    market.stale = false;
  }

  /**
   * Active markets (optionally filtered), tradeable/mid-range first.
   * @param {{city?: string, limit?: number, includeClosed?: boolean}} [opts]
   */
  getMarkets(opts = {}) {
    const { city, limit, includeClosed = false } = opts;
    const now = nowMs();
    let list = [...this.markets.values()];
    if (!includeClosed) {
      list = list.filter((m) => {
        if (m.closed) return false;
        const cutoff = effectiveTradingEndMs(m);
        return Number.isFinite(cutoff) && cutoff > now;
      });
    }
    if (city) {
      const needle = city.toLowerCase();
      list = list.filter((m) => m.city.toLowerCase() === needle || m.city.toLowerCase().includes(needle));
    }
    list.sort(compareMarketsForUi);
    if (limit && limit > 0) list = list.slice(0, limit);
    return list;
  }

  /** All tradable (not closed, not expired) markets, for universe selection. */
  getCandidateMarkets() {
    const now = nowMs();
    return [...this.markets.values()].filter((market) => {
      if (market.closed) return false;
      const cutoff = effectiveTradingEndMs(market);
      return Number.isFinite(cutoff) && cutoff > now;
    });
  }

  getMarket(marketId) {
    return this.markets.get(marketId) || null;
  }

  getEvents() {
    const now = nowMs();
    return [...this.events.values()]
      .filter((event) => {
        const cutoffMs = effectiveEventTradingEndMs(event);
        return !Number.isFinite(cutoffMs) || cutoffMs > now - 3_600_000;
      })
      .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  }

  getCities(dateKey = null) {
    const cities = new Set();
    for (const market of this.markets.values()) {
      if (!market.city) continue;
      if (dateKey) {
        const day = (() => {
          const ms = Date.parse(market.endDate);
          return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
        })();
        if (day !== dateKey) continue;
      }
      cities.add(market.city);
    }
    return [...cities].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Poll Gamma for the official resolution of one market.
   * @param {string} marketId
   * @param {{force?: boolean}} [opts]
   * @returns {Promise<{status:"open"|"pending"|"resolved", closed:boolean,
   *   yesWon:boolean|null, payout:number|null, outcomePrices:number[]}>}
   */
  async getResolution(marketId, opts = {}) {
    const cached = this._resolutionCache.get(marketId);
    if (!opts.force && cached && nowMs() - cached.checkedAt < 30_000) return cached.result;
    const result = { status: "pending", closed: false, yesWon: null, payout: null, outcomePrices: [] };
    try {
      const raw = await fetchMarketById(marketId);
      if (raw) {
        result.closed = Boolean(raw.closed);
        const prices = parseJsonArray(raw.outcomePrices).map((p) => toNum(p, NaN));
        result.outcomePrices = prices;
        if (result.closed && prices.length >= 2) {
          if (prices[0] >= 0.99 && prices[1] <= 0.01) {
            result.status = "resolved";
            result.yesWon = true;
            result.payout = 1;
          } else if (prices[0] <= 0.01 && prices[1] >= 0.99) {
            result.status = "resolved";
            result.yesWon = false;
            result.payout = 0;
          } else if (Math.abs(prices[0] - 0.5) < 1e-9 && Math.abs(prices[1] - 0.5) < 1e-9) {
            result.status = "resolved";
            result.yesWon = null;
            result.payout = 0.5;
          }
        } else if (!result.closed) {
          result.status = "open";
        }
      }
    } catch (err) {
      this.log("warn", `resolution lookup failed for ${marketId}: ${err.message}`);
    }
    this._resolutionCache.set(marketId, { checkedAt: nowMs(), result });
    return result;
  }
}

export { GAMMA, WEATHER_TAG_ID };
