/**
 * tests/fixtures/builders.js — deterministic test-fixture builders.
 *
 * Rules enforced by this file:
 *  - no network, no randomness, no wall-clock: every fixture is derived from
 *    the exported FIXED_* constants so tests are bit-for-bit reproducible;
 *  - English identifiers only (the product itself is Chinese-first);
 *  - shapes follow the JSDoc typedefs in shared/contract.js so the same
 *    fixture can drive pure-unit tests and HTTP integration tests.
 */

/** Fixed "now" used by every fixture: 2026-11-08T00:00:00Z (08:00 Asia/Shanghai). */
export const FIXED_NOW = Date.UTC(2026, 10, 8, 0, 0, 0);

/** Fixed run/strategy ids so fixtures never depend on random id generation. */
export const FIXED_RUN_ID = "run_fixture0001";
export const FIXED_STRATEGY_ID = "strat_fixture001";

/** Round half-up to `decimals` places (local helper; fixtures stay dependency-free). */
export function round(value, decimals = 6) {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Deep clone via JSON (fixtures are plain JSON data only). */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build a contract `Quote` ({bid, ask, mid, last}).
 * Missing sides are `null`; `mid` falls back to the available side when the
 * book is one-sided (quote-only helper — the engine decides validity itself).
 *
 * @param {{bid?: number|null, ask?: number|null, last?: number|null, mid?: number|null}} [parts]
 * @returns {{bid: number|null, ask: number|null, mid: number|null, last: number|null}}
 */
export function makeQuote(parts = {}) {
  const bid = Number.isFinite(parts.bid) ? Number(parts.bid) : null;
  const ask = Number.isFinite(parts.ask) ? Number(parts.ask) : null;
  let mid = null;
  if (Number.isFinite(parts.mid)) mid = Number(parts.mid);
  else if (bid !== null && ask !== null) mid = round((bid + ask) / 2, 6);
  else if (bid !== null) mid = bid;
  else if (ask !== null) mid = ask;
  const last = Number.isFinite(parts.last) ? Number(parts.last) : null;
  return { bid, ask, mid, last };
}

/**
 * Build one order-book level.
 * @param {number} price
 * @param {number} size
 * @returns {{price: number, size: number}}
 */
export function makeLevel(price, size) {
  return { price, size };
}

/**
 * Build a normalized two-sided order book from level arrays.
 * Asks are sorted ascending, bids descending (the way the walker consumes them).
 *
 * @param {{asks?: Array<{price:number,size:number}>, bids?: Array<{price:number,size:number}>}} [parts]
 * @returns {{asks: Array<{price:number,size:number}>, bids: Array<{price:number,size:number}>,
 *            bestAsk: number|null, bestBid: number|null, mid: number|null}}
 */
export function makeOrderBook(parts = {}) {
  const asks = [...(parts.asks ?? [])].map((l) => makeLevel(Number(l.price), Number(l.size)))
    .sort((a, b) => a.price - b.price);
  const bids = [...(parts.bids ?? [])].map((l) => makeLevel(Number(l.price), Number(l.size)))
    .sort((a, b) => b.price - a.price);
  const bestAsk = asks.length ? asks[0].price : null;
  const bestBid = bids.length ? bids[0].price : null;
  const mid = bestAsk !== null && bestBid !== null ? round((bestAsk + bestBid) / 2, 6) : null;
  return { asks, bids, bestAsk, bestBid, mid };
}

/**
 * Build a `MarketSnapshot` (docs/07 §3.1) with a deterministic two-sided book.
 * Defaults: New York / 13°C bracket, YES bid 0.30 / ask 0.32 (mid 0.31),
 * NO bid 0.68 / ask 0.70, tick 0.001, min order 5 shares, Weather fee 0.05.
 *
 * @param {object} [overrides] shallow overrides; `tokens`, `quotes`, `feeSchedule`
 *   are merged one level deep with the defaults.
 * @returns {object}
 */
export function makeMarketSnapshot(overrides = {}) {
  const yesBid = overrides.yesBid ?? 0.30;
  const yesAsk = overrides.yesAsk ?? 0.32;
  const noBid = overrides.noBid ?? round(1 - yesAsk, 6);
  const noAsk = overrides.noAsk ?? round(1 - yesBid, 6);
  const quotes = overrides.quotes ?? {
    YES: makeQuote({ bid: yesBid, ask: yesAsk, last: round((yesBid + yesAsk) / 2, 6) }),
    NO: makeQuote({ bid: noBid, ask: noAsk, last: round((noBid + noAsk) / 2, 6) }),
  };
  const spread =
    Number.isFinite(overrides.spread) ? overrides.spread : round(quotes.YES.ask - quotes.YES.bid, 6);

  const base = {
    id: "mkt_nyc_13c",
    conditionId: "0xcond_nyc_13c",
    eventId: "evt_nyc_20261108",
    slug: "nyc-highest-temperature-13c-20261108",
    question: "Will the highest temperature in New York be 13°C on November 8?",
    city: "New York",
    station: "KLGA",
    bracket: "13°C",
    tokens: { yesTokenId: "tok_yes_nyc_13c", noTokenId: "tok_no_nyc_13c" },
    quotes,
    spread,
    impliedProbability: overrides.impliedProbability ?? quotes.YES.mid,
    liquidityUsd: 5_000,
    volume24hUsd: 1_200,
    tickSize: 0.001,
    minOrderShares: 5,
    endDate: new Date(FIXED_NOW + 4 * 3600 * 1000).toISOString(),
    eventStartTime: new Date(FIXED_NOW - 8 * 3600 * 1000).toISOString(),
    acceptingOrders: true,
    closed: false,
    negRisk: true,
    feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
    updatedAt: FIXED_NOW,
    stale: false,
  };

  const merged = { ...base, ...overrides };
  merged.tokens = { ...base.tokens, ...(overrides.tokens ?? {}) };
  merged.feeSchedule = overrides.feeSchedule === undefined
    ? base.feeSchedule
    : overrides.feeSchedule === null
      ? null
      : { ...base.feeSchedule, ...overrides.feeSchedule };
  merged.quotes = overrides.quotes ?? base.quotes;
  merged.spread = Number.isFinite(overrides.spread) ? overrides.spread : spread;
  return merged;
}

/**
 * Build one historical/price tick.
 * The default book straddles the mid by ±0.001 (one tick) so `mid` is exact
 * for non-clamped prices, which keeps rolling-window fixtures unambiguous.
 * @param {number} ts epoch ms
 * @param {number} mid mid price (0..1)
 * @param {{bid?: number, ask?: number, last?: number|null, price?: number}} [parts]
 * @returns {{ts:number, bid:number, ask:number, mid:number, last:number|null, price:number}}
 */
export function makeTick(ts, mid, parts = {}) {
  const bid = Number.isFinite(parts.bid) ? parts.bid : round(Math.max(0.001, mid - 0.001), 6);
  const ask = Number.isFinite(parts.ask) ? parts.ask : round(Math.min(0.999, mid + 0.001), 6);
  const last = parts.last === undefined ? mid : parts.last;
  return {
    ts,
    bid,
    ask,
    mid,
    last,
    price: Number.isFinite(parts.price) ? parts.price : mid,
  };
}

/**
 * Build a 1s-step tick series from an array of prices.
 * @param {number} startTs
 * @param {number[]} prices
 * @param {{stepMs?: number}} [opts]
 * @returns {Array<ReturnType<typeof makeTick>>}
 */
export function makeSeries(startTs, prices, opts = {}) {
  const stepMs = opts.stepMs ?? 1000;
  return prices.map((price, index) => makeTick(startTs + index * stepMs, price));
}

/**
 * Build a replay price-history series in the normalized `{ts, price}` shape
 * used by server/data/clob.js `getPriceHistory()` (oldest first).
 * @param {number} startTs
 * @param {number[]} prices
 * @param {{stepMs?: number}} [opts]
 * @returns {Array<{ts:number, price:number}>}
 */
export function makeReplaySeries(startTs, prices, opts = {}) {
  const stepMs = opts.stepMs ?? 60_000;
  return prices.map((price, index) => ({ ts: startTs + index * stepMs, price }));
}

export default {
  FIXED_NOW,
  FIXED_RUN_ID,
  FIXED_STRATEGY_ID,
  round,
  makeQuote,
  makeLevel,
  makeOrderBook,
  makeMarketSnapshot,
  makeTick,
  makeSeries,
  makeReplaySeries,
};
