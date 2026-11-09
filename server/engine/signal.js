/**
 * server/engine/signal.js — rolling-window momentum signal (docs/03 §2).
 *
 * Definition (single source of truth: docs/03-strategy-spec.md):
 *   p_now  = latest valid YES-token sample
 *   p_ref  = latest valid sample with ts <= now - windowSec*1000
 *   retPct = (p_now / p_ref - 1) * 100
 *   UP     : retPct >= +moveThresholdPct AND absMove >= +minAbsMove
 *   DOWN   : retPct <= -moveThresholdPct AND absMove <= -minAbsMove
 * Hard guards (independent of config): p_ref >= 0.01, p_now <= 0.99.
 * Confirmation: consecutive qualifying ticks per direction with re-arm.
 * Cooldown: per (market, direction); counted from entry signal generation.
 * Limit: maxSignalsPerMarket generated entry signals.
 *
 * UP -> BUY YES token; DOWN -> BUY NO token (docs/03 §2.4).
 */
import { toNum } from "../util.js";

export const DEFAULT_SIGNAL_STATE = Object.freeze({
  streak: { up: 0, down: 0 },
  rearm: { up: true, down: true },
  lastSignalTs: { up: 0, down: 0 },
  count: 0,
});

/** Fresh mutable signal state for one market. */
export function createSignalState() {
  return {
    streak: { up: 0, down: 0 },
    rearm: { up: true, down: true },
    lastSignalTs: { up: 0, down: 0 },
    count: 0,
  };
}

/**
 * Extract the configured price from one quote/sample.
 * Returns null when the field is invalid per docs/03 §2.1 (no fallback).
 * @param {{bid?:number,ask?:number,mid?:number,last?:number|null}|null} sample
 * @param {"mid"|"last"|"best_bid"|"best_ask"} field
 * @returns {number|null}
 */
export function pickPrice(sample, field) {
  if (!sample) return null;
  const bid = toNum(sample.bid, 0);
  const ask = toNum(sample.ask, 0);
  switch (field) {
    case "best_bid":
      return bid > 0 && bid < 1 ? bid : null;
    case "best_ask":
      return ask > 0 && ask < 1 ? ask : null;
    case "last": {
      const last = sample.last;
      return last !== null && last !== undefined && Number.isFinite(last) && last > 0 && last < 1 ? last : null;
    }
    case "mid":
    default:
      if (bid > 0 && ask > 0 && ask < 1 && bid < ask) return (bid + ask) / 2;
      return null;
  }
}

/** Binary search: index of the newest sample with ts <= targetTs, or -1. */
export function findRefIndex(series, targetTs) {
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].ts <= targetTs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Evaluate one market at one tick.
 * @param {{market:any, series:Array<any>, config:any, now:number, state:object}} args
 * @returns {{signal:any|null, state:object, reason?:string}}
 */
export function evaluateSignal({ market, series, config, now, state }) {
  const cfg = config;
  const s = cfg.signal;
  const u = cfg.universe;
  const next = state || createSignalState();

  if (!market || !Array.isArray(series) || series.length === 0) {
    return { signal: null, state: next, reason: "no_samples" };
  }
  // newest sample not from the future (clock-skew guard)
  const pNowSample = series[series.length - 1];
  if (!pNowSample || pNowSample.ts > now + 2000) return { signal: null, state: next, reason: "future_sample" };

  const staleMs = Math.max(3 * cfg.sim.tickIntervalMs, 5000);
  if (now - pNowSample.ts > staleMs) return { signal: null, state: next, reason: "stale" };

  const priceField = s.priceField;
  const pNow = pickPrice(pNowSample, priceField);
  if (pNow === null) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "invalid_now_price" };
  }
  if (pNow > 1 || pNow <= 0) return { signal: null, state: next, reason: "invalid_now_price" };

  const targetTs = now - s.windowSec * 1000;
  const refIndex = findRefIndex(series, targetTs);
  if (refIndex < 0) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "window_not_ready" };
  }
  const pRefSample = series[refIndex];
  const pRef = pickPrice(pRefSample, priceField);
  if (pRef === null) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "invalid_ref_price" };
  }

  const tolMs = Math.max(2000, cfg.sim.tickIntervalMs);
  if (now - pRefSample.ts > s.windowSec * 1000 + tolMs) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "window_not_ready" };
  }

  // >= 2 distinct valid timestamps inside the window
  const seen = new Set();
  for (let i = refIndex; i < series.length; i += 1) {
    const sample = series[i];
    if (sample.ts < targetTs) continue;
    if (pickPrice(sample, priceField) !== null) seen.add(sample.ts);
    if (seen.size >= 2) break;
  }
  if (seen.size < 2) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "window_not_ready" };
  }

  // Hard degeneracy floor: p_ref below 1¢ is not a meaningful momentum anchor.
  if (pRef < 0.01) {
    next.streak.up = 0;
    next.streak.down = 0;
    return { signal: null, state: next, reason: "below_price_floor" };
  }

  const retPct = (pNow / pRef - 1) * 100;
  const absMove = pNow - pRef;
  // docs/03 §0: comparisons use a 1e-9 tolerance so an exact +20.0% (float
  // artefact 19.999999999999996) still fires, while 19.9% does not.
  const EPS = 1e-9;
  const up =
    retPct >= s.moveThresholdPct - EPS && absMove >= s.minAbsMove - EPS && s.direction !== "down";
  const down =
    retPct <= -s.moveThresholdPct + EPS && absMove <= -s.minAbsMove + EPS && s.direction !== "up";

  if (!up && !down) {
    next.streak.up = 0;
    next.streak.down = 0;
    next.rearm.up = true;
    next.rearm.down = true;
    return { signal: null, state: next, reason: "no_trigger" };
  }

  const direction = up ? "up" : "down";
  // Price band / spread 不再吞掉动量：把它作为 blockReason 返回给上层，
  // 由 processMarkets 决定记录 observation（不产生交易）或忽略。
  let blockReason = null;
  if (pRef < Math.max(0.01, u.minPrice)) blockReason = "below_price_floor";
  else if (pNow > Math.min(0.99, u.maxPrice)) blockReason = "above_price_ceiling";
  else if (pNow < u.minPrice || pRef > u.maxPrice) blockReason = "outside_price_band";
  else if (s.requireSpreadOk && Number.isFinite(market.spread) && market.spread > u.maxSpread) {
    blockReason = "spread_too_wide";
  }

  if (blockReason) {
    next.streak.up = 0;
    next.streak.down = 0;
    return {
      signal: null,
      state: next,
      reason: blockReason,
      candidate: {
        direction,
        outcome: direction === "up" ? "YES" : "NO",
        fromPrice: Number(pRef.toFixed(6)),
        toPrice: Number(pNow.toFixed(6)),
        changePct: Number(retPct.toFixed(4)),
        absChange: Number(absMove.toFixed(6)),
        windowSec: s.windowSec,
        priceField,
        blockReason,
      },
    };
  }

  next.streak[direction] += 1;
  if (!up) next.streak.up = 0;
  if (!down) next.streak.down = 0;

  if (next.streak[direction] < s.confirmationTicks) return { signal: null, state: next, reason: "awaiting_confirmation" };
  if (!next.rearm[direction]) return { signal: null, state: next, reason: "awaiting_rearm" };
  if (now - next.lastSignalTs[direction] < s.cooldownSec * 1000) return { signal: null, state: next, reason: "cooldown" };
  if (next.count >= s.maxSignalsPerMarket) return { signal: null, state: next, reason: "market_signal_cap" };

  // fire: reset streak + disarm until a non-trigger tick re-arms
  next.streak[direction] = 0;
  next.rearm[direction] = false;
  next.lastSignalTs[direction] = now;
  next.count += 1;

  const outcome = direction === "up" ? "YES" : "NO";
  const tokenId = outcome === "YES" ? market.tokens.yesTokenId : market.tokens.noTokenId;
  return {
    signal: {
      ts: now,
      runId: null,
      marketId: market.id,
      city: market.city,
      bracket: market.bracket,
      direction,
      outcome,
      tokenId,
      fromPrice: Number(pRef.toFixed(6)),
      toPrice: Number(pNow.toFixed(6)),
      changePct: Number(retPct.toFixed(4)),
      absChange: Number(absMove.toFixed(6)),
      windowSec: s.windowSec,
      priceField,
      kind: "entry",
      tradable: true,
      reason: "signal",
    },
    state: next,
  };
}

/** Reset per-market signal state (after a re-selection). */
export function resetSignalState() {
  return createSignalState();
}
