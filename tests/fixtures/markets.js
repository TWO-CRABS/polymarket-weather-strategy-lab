/**
 * tests/fixtures/markets.js — deterministic market snapshots and order books.
 *
 * Canonical book: YES bid 0.30 / ask 0.32 (mid 0.31, spread 0.02), NO side
 * mirrored at 0.68 / 0.70 — the exact "two-sided book at 0.30/0.32" fixture.
 * Every snapshot is built from shared test builders (no clock, no network).
 */
import {
  FIXED_NOW,
  makeLevel,
  makeMarketSnapshot,
  makeOrderBook,
  makeQuote,
  round,
} from "./builders.js";

/** Canonical two-sided market: YES 0.30/0.32, NO 0.68/0.70. */
export const MARKET_TWO_SIDED = makeMarketSnapshot();

/** Second bracket of the same NYC event (12°C), used for multi-market tests. */
export const MARKET_BRACKET_12C = makeMarketSnapshot({
  id: "mkt_nyc_12c",
  conditionId: "0xcond_nyc_12c",
  slug: "nyc-highest-temperature-12c-20261108",
  question: "Will the highest temperature in New York be 12°C on November 8?",
  bracket: "12°C",
  tokens: { yesTokenId: "tok_yes_nyc_12c", noTokenId: "tok_no_nyc_12c" },
  yesBid: 0.10,
  yesAsk: 0.12,
  liquidityUsd: 2_000,
});

/** Third bracket of the same NYC event (14°C). */
export const MARKET_BRACKET_14C = makeMarketSnapshot({
  id: "mkt_nyc_14c",
  conditionId: "0xcond_nyc_14c",
  slug: "nyc-highest-temperature-14c-20261108",
  question: "Will the highest temperature in New York be 14°C on November 8?",
  bracket: "14°C",
  tokens: { yesTokenId: "tok_yes_nyc_14c", noTokenId: "tok_no_nyc_14c" },
  yesBid: 0.50,
  yesAsk: 0.52,
  liquidityUsd: 8_000,
});

/** All three NYC brackets, deterministic order. */
export const MARKET_SET = Object.freeze([MARKET_TWO_SIDED, MARKET_BRACKET_12C, MARKET_BRACKET_14C]);

/** Wide-spread market: YES 0.20/0.30 = 0.10 spread (docs/04 AC-10 boundary). */
export const MARKET_WIDE_SPREAD = makeMarketSnapshot({
  id: "mkt_wide",
  yesBid: 0.20,
  yesAsk: 0.30,
  liquidityUsd: 800,
});

/** Cheap bracket: YES 0.004/0.006 (mid 0.005) — below the 0.02 recommendation. */
export const MARKET_LOW_PRICE = makeMarketSnapshot({
  id: "mkt_low_price",
  yesBid: 0.004,
  yesAsk: 0.006,
  bracket: "3°C or below",
});

/** One-sided book: no bids at all. */
export const MARKET_ONE_SIDED = makeMarketSnapshot({
  id: "mkt_one_sided",
  quotes: {
    YES: makeQuote({ bid: null, ask: 0.32 }),
    NO: makeQuote({ bid: 0.68, ask: null }),
  },
  spread: 0,
});

/** Frozen / non-accepting market (order book disabled). */
export const MARKET_NOT_ACCEPTING = makeMarketSnapshot({
  id: "mkt_not_accepting",
  acceptingOrders: false,
  closed: true,
});

/** Stale market snapshot (older than the freshness threshold). */
export const MARKET_STALE = makeMarketSnapshot({
  id: "mkt_stale",
  updatedAt: FIXED_NOW - 30_000,
  stale: true,
});

/** Market close to resolution (< minTimeToResolutionSec). */
export const MARKET_NEAR_RESOLUTION = makeMarketSnapshot({
  id: "mkt_near_resolution",
  endDate: new Date(FIXED_NOW + 120_000).toISOString(),
});

/* ------------------------------------------------------------------------- */
/* Order books                                                               */
/* ------------------------------------------------------------------------- */

/** Canonical two-sided book: asks 0.32×100 / 0.34×200 / 0.36×500, bids 0.30×150 / 0.28×300 / 0.26×500. */
export const ORDER_BOOK_TWO_SIDED = makeOrderBook({
  asks: [makeLevel(0.32, 100), makeLevel(0.34, 200), makeLevel(0.36, 500)],
  bids: [makeLevel(0.30, 150), makeLevel(0.28, 300), makeLevel(0.26, 500)],
});

/** docs/03 §10.10 walk example: asks [0.50×10, 0.52×20]. */
export const ORDER_BOOK_DOCS_WALK = makeOrderBook({
  asks: [makeLevel(0.50, 10), makeLevel(0.52, 20)],
  bids: [makeLevel(0.48, 10), makeLevel(0.46, 20)],
});

/** docs/03 example B entry book: YES ask 0.245 × 500 shares. */
export const ORDER_BOOK_ENTRY_0245 = makeOrderBook({
  asks: [makeLevel(0.245, 500)],
  bids: [makeLevel(0.235, 500)],
});

/** Depth-hungry book for partial-fill tests: only 3 shares available. */
export const ORDER_BOOK_THIN = makeOrderBook({
  asks: [makeLevel(0.40, 3)],
  bids: [makeLevel(0.38, 3)],
});

/** Empty book (no liquidity at all). */
export const ORDER_BOOK_EMPTY = makeOrderBook({});

/** One-sided book (asks only). */
export const ORDER_BOOK_ASKS_ONLY = makeOrderBook({
  asks: [makeLevel(0.32, 100)],
});

/** One-sided book (bids only). */
export const ORDER_BOOK_BIDS_ONLY = makeOrderBook({
  bids: [makeLevel(0.30, 100)],
});

/**
 * Price-protection book: best ask 0.30 then a 0.40 level. A 1000 bps buffer
 * (limit ≈ 0.33) must consume only the 0.30 level.
 */
export const ORDER_BOOK_PRICE_PROTECTION = makeOrderBook({
  asks: [makeLevel(0.30, 100), makeLevel(0.40, 100)],
  bids: [makeLevel(0.28, 100), makeLevel(0.20, 100)],
});

/** Quote fixtures for rendering/probability tests. */
export const QUOTE_TWO_SIDED = makeQuote({ bid: 0.30, ask: 0.32 });
export const QUOTE_WIDE = makeQuote({ bid: 0.20, ask: 0.30 });
export const QUOTE_EMPTY = makeQuote({});

/** Computed helper: expected YES mid of the canonical market (0.31). */
export const CANONICAL_YES_MID = round((0.30 + 0.32) / 2, 6);

export default {
  MARKET_TWO_SIDED,
  MARKET_BRACKET_12C,
  MARKET_BRACKET_14C,
  MARKET_SET,
  MARKET_WIDE_SPREAD,
  MARKET_LOW_PRICE,
  MARKET_ONE_SIDED,
  MARKET_NOT_ACCEPTING,
  MARKET_STALE,
  MARKET_NEAR_RESOLUTION,
  ORDER_BOOK_TWO_SIDED,
  ORDER_BOOK_DOCS_WALK,
  ORDER_BOOK_ENTRY_0245,
  ORDER_BOOK_THIN,
  ORDER_BOOK_EMPTY,
  ORDER_BOOK_ASKS_ONLY,
  ORDER_BOOK_BIDS_ONLY,
  ORDER_BOOK_PRICE_PROTECTION,
  QUOTE_TWO_SIDED,
  QUOTE_WIDE,
  QUOTE_EMPTY,
  CANONICAL_YES_MID,
};
