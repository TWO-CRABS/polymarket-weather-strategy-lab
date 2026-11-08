/**
 * tests/fixtures/series.js — deterministic price series.
 *
 * The canonical series is a 1-second-step YES-mid sequence that produces an
 * exact +20% move at t=60s and an exact -20% move at t=120s (docs/03 §2.6
 * examples A and §10 items 2-3):
 *
 *   t =   0.. 59s  mid 0.30   (flat reference leg)
 *   t =  60..119s  mid 0.36   (+20.0% vs the 0.30 reference)
 *   t = 120s       mid 0.288  (-20.0% vs the 0.36 reference)
 *
 * Everything here is pure data: no clock, no randomness, no network.
 */
import { FIXED_NOW, makeReplaySeries, makeSeries, makeTick, round } from "./builders.js";

/** 60 flat reference seconds. */
export const FLAT_LEG = Array.from({ length: 60 }, () => 0.30);

/** Full +20% then -20% leg prices (0.30 -> 0.36 -> 0.288). */
export const MOMENTUM_UP_THEN_DOWN_PRICES = Object.freeze([
  ...FLAT_LEG,
  ...Array.from({ length: 60 }, () => 0.36),
  0.288,
]);

/** Just the +20% move: 0.30 flat for 60s, then 0.36. */
export const UP_20_PRICES = Object.freeze([...FLAT_LEG, 0.36]);

/** Just the -20% move: 0.36 flat for 60s, then 0.288. */
export const DOWN_20_PRICES = Object.freeze([
  ...Array.from({ length: 60 }, () => 0.36),
  0.288,
]);

/** 19.9% 高: 0.30 -> 0.3597 (must NOT trigger a 20% threshold). */
export const MOVE_1990_PRICES = Object.freeze([...FLAT_LEG, round(0.30 * 1.199, 6)]);

/** 20.0% 但绝对变动不足: 0.30 -> 0.36 is +0.06, below a 0.10 threshold. */
export const MOVE_20_SMALL_ABS_PRICES = Object.freeze([...FLAT_LEG, 0.36]);

/**
 * Low-price degenerate leg: 0.002 -> 0.003 is +50% but must be rejected by the
 * hard `p_ref >= 0.01` floor (docs/03 §2.5).
 */
export const LOW_PRICE_DEGENERATE_PRICES = Object.freeze([
  ...Array.from({ length: 60 }, () => 0.002),
  0.003,
]);

/** Held-flat series (no move at all). */
export const FLAT_60S_PRICES = Object.freeze([...FLAT_LEG, 0.30]);

/** One isolated sample that leaves the rolling window without a reference. */
export const SINGLE_SAMPLE_PRICES = Object.freeze([0.30]);

/**
 * Tick series for the canonical momentum fixture, starting at FIXED_NOW.
 * @param {{startTs?: number, stepMs?: number, prices?: number[]}} [opts]
 * @returns {Array<ReturnType<typeof makeTick>>}
 */
export function buildSeries(opts = {}) {
  const startTs = opts.startTs ?? FIXED_NOW;
  const stepMs = opts.stepMs ?? 1000;
  const prices = opts.prices ?? MOMENTUM_UP_THEN_DOWN_PRICES;
  return makeSeries(startTs, prices, { stepMs });
}

/** Canonical 121-point series +20% then -20% (1s steps). */
export const MOMENTUM_SERIES = Object.freeze(buildSeries());

/** +20% only series. */
export const UP_20_SERIES = Object.freeze(buildSeries({ prices: UP_20_PRICES }));

/** -20% only series. */
export const DOWN_20_SERIES = Object.freeze(buildSeries({ prices: DOWN_20_PRICES }));

/**
 * Replay price-history fixture in the normalized `{ts, price}` shape used by
 * server/data/clob.js (oldest first, 60s buckets). 10 minutes of data:
 * flat 0.30 for 5 minutes, then 0.36 (exact +20%), then 0.288 (-20%).
 * @returns {Array<{ts:number, price:number}>}
 */
export function buildReplayHistory() {
  const prices = [
    ...Array.from({ length: 6 }, () => 0.30),
    ...Array.from({ length: 6 }, () => 0.36),
    ...Array.from({ length: 6 }, () => 0.288),
  ];
  return makeReplaySeries(FIXED_NOW - 15 * 60_000, prices, { stepMs: 60_000 });
}

/** Canonical replay history (18 points, 60s step). */
export const REPLAY_HISTORY = Object.freeze(buildReplayHistory());

export default {
  FLAT_LEG,
  MOMENTUM_UP_THEN_DOWN_PRICES,
  UP_20_PRICES,
  DOWN_20_PRICES,
  MOVE_1990_PRICES,
  MOVE_20_SMALL_ABS_PRICES,
  LOW_PRICE_DEGENERATE_PRICES,
  FLAT_60S_PRICES,
  SINGLE_SAMPLE_PRICES,
  MOMENTUM_SERIES,
  UP_20_SERIES,
  DOWN_20_SERIES,
  REPLAY_HISTORY,
  buildSeries,
  buildReplayHistory,
};
