/**
 * tests/engine.test.js — unit tests for the pure simulation-engine modules.
 *
 * Covers docs/03 §2 (signal), §3 (execution), §5 (portfolio), §10 acceptance
 * items 2-16 and docs/04 §5/§6 (fees, P&L identities, metrics golden fixture
 * T1-T6). Pure unit tests: no server, no clock, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  FIXED_NOW,
  MARKET_TWO_SIDED,
  ORDER_BOOK_ASKS_ONLY,
  ORDER_BOOK_BIDS_ONLY,
  ORDER_BOOK_DOCS_WALK,
  ORDER_BOOK_THIN,
  ORDER_BOOK_TWO_SIDED,
  UP_20_SERIES,
  buildSeries,
  makeOrderBook,
  makeSeries,
  round,
} from "./fixtures/index.js";
import {
  calcTakerFee,
  FEES,
  buyCost,
  estimateExitFee,
  feeRateFor,
  sellProceeds,
} from "../server/engine/fee.js";
import {
  createSignalState,
  evaluateSignal,
  findRefIndex,
  pickPrice,
} from "../server/engine/signal.js";
import {
  bookMid,
  ceilToTick,
  floorShares,
  floorToTick,
  simulateBuy,
  simulateSell,
} from "../server/engine/execution.js";
import { planFallbackOrders, preRiskChecks, recordObservationSignal, processMarkets, recordRejectedEntry } from "../server/engine/runTrading.js";
import { Portfolio } from "../server/engine/portfolio.js";
import {
  computeMetrics,
  maxDrawdownPct,
  resampleEquity,
  sharpeFromEquity,
} from "../server/engine/metrics.js";
import {
  DEFAULT_STRATEGY,
  STRATEGY_PRESETS,
  clone,
  deepMerge,
  normalizeStrategy,
  validateStrategy,
} from "../shared/contract.js";

function approx(actual, expected, tolerance = 1e-6, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || "value"}: expected ${expected}, got ${actual} (tol ${tolerance})`,
  );
}

/** Balanced preset config, optionally patched, normalized through the contract. */
function configWith(overrides = {}) {
  const base = clone(STRATEGY_PRESETS.find((preset) => preset.id === "balanced").config);
  return validateStrategy(deepMerge(base, overrides)).normalized;
}

/* ------------------------------------------------------------------------- */
/* Fee wrapper (server/engine/fee.js)                                        */
/* ------------------------------------------------------------------------- */

test("fee wrapper re-exports the official contract fee (docs/04 AC-01)", () => {
  for (const [price, expected] of [[0.05, 0.2375], [0.3, 1.05], [0.5, 1.25], [0.7, 1.05], [0.95, 0.2375]]) {
    assert.equal(calcTakerFee(100, price), expected);
  }
  assert.equal(FEES.takerFeeRate, 0.05);
});

test("feeRateFor prefers the market feeSchedule and falls back to the official rate", () => {
  assert.equal(feeRateFor({ feeSchedule: { rate: 0.05 } }), 0.05);
  assert.equal(feeRateFor({ feeSchedule: { rate: 0.1 } }), 0.1);
  assert.equal(feeRateFor({ feeSchedule: { rate: 0 } }), 0);
  assert.equal(feeRateFor({ feeSchedule: null }), FEES.takerFeeRate);
  assert.equal(feeRateFor({}), FEES.takerFeeRate);
  assert.equal(feeRateFor(null), FEES.takerFeeRate);
});

test("buyCost / sellProceeds parts match the docs/04 worked example B", () => {
  const buy = buyCost(98.32, 0.245);
  assert.equal(buy.notional, 24.0884);
  assert.equal(buy.fee, 0.90934);
  assert.equal(buy.total, 24.99774);

  const sell = sellProceeds(98.32, 0.4);
  assert.equal(sell.fee, 1.17984);
  assert.equal(sell.notional, 39.328);
  assert.equal(sell.net, 38.14816);

  assert.equal(estimateExitFee(98.32, 0.4), 1.17984);
});

/* ------------------------------------------------------------------------- */
/* Signal evaluator (server/engine/signal.js)                                */
/* ------------------------------------------------------------------------- */

test("pickPrice validates each price field per docs/03 §2.1", () => {
  const valid = { bid: 0.3, ask: 0.32, mid: 0.31, last: 0.31 };
  assert.equal(pickPrice(valid, "mid"), 0.31);
  assert.equal(pickPrice(valid, "best_bid"), 0.3);
  assert.equal(pickPrice(valid, "best_ask"), 0.32);
  assert.equal(pickPrice(valid, "last"), 0.31);

  // one-sided / locked / crossed books invalidate mid
  assert.equal(pickPrice({ bid: 0.3, ask: 0 }, "mid"), null);
  assert.equal(pickPrice({ bid: 0, ask: 0.32 }, "mid"), null);
  assert.equal(pickPrice({ bid: 0.3, ask: 0.3 }, "mid"), null);
  assert.equal(pickPrice({ bid: 0.32, ask: 0.3 }, "mid"), null);
  assert.equal(pickPrice({ bid: 0, ask: 0.32 }, "best_bid"), null);
  assert.equal(pickPrice({ bid: 0.3, ask: 1 }, "best_ask"), null);
  // last: placeholder null (never traded) is invalid
  assert.equal(pickPrice({ bid: 0.3, ask: 0.32, last: null }, "last"), null);
  assert.equal(pickPrice(null, "mid"), null);
});

test("findRefIndex returns the newest sample at or before the target ts", () => {
  const series = [{ ts: 0 }, { ts: 1_000 }, { ts: 2_000 }];
  assert.equal(findRefIndex(series, 1_500), 1);
  assert.equal(findRefIndex(series, 2_000), 2);
  assert.equal(findRefIndex(series, 0), 0);
  assert.equal(findRefIndex(series, -1), -1);
  assert.equal(findRefIndex([], 5), -1);
});

test("+20% in 60s produces exactly one UP -> YES signal (docs/03 §2.6 / §10.2)", () => {
  const config = configWith();
  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const now = FIXED_NOW + 60_000;
  const result = evaluateSignal({ market: MARKET_TWO_SIDED, series, config, now, state: createSignalState() });

  assert.ok(result.signal, `expected a signal, got reason=${result.reason}`);
  assert.equal(result.signal.direction, "up");
  assert.equal(result.signal.outcome, "YES");
  assert.equal(result.signal.tokenId, MARKET_TWO_SIDED.tokens.yesTokenId);
  assert.equal(result.signal.marketId, MARKET_TWO_SIDED.id);
  assert.equal(result.signal.fromPrice, 0.3);
  assert.equal(result.signal.toPrice, 0.36);
  assert.equal(result.signal.changePct, 20);
  assert.equal(result.signal.absChange, 0.06);
  assert.equal(result.signal.windowSec, 60);
  assert.equal(result.signal.priceField, "mid");
  assert.equal(result.signal.reason, "signal");
  assert.equal(result.state.count, 1);
});

test("-20% in 60s produces a DOWN -> NO signal (docs/03 §10.3)", () => {
  const config = configWith();
  const prices = [...Array.from({ length: 60 }, () => 0.36), 0.288];
  const series = buildSeries({ prices });
  const now = FIXED_NOW + 60_000;
  const result = evaluateSignal({ market: MARKET_TWO_SIDED, series, config, now, state: createSignalState() });
  assert.ok(result.signal);
  assert.equal(result.signal.direction, "down");
  assert.equal(result.signal.outcome, "NO");
  assert.equal(result.signal.tokenId, MARKET_TWO_SIDED.tokens.noTokenId);
  assert.equal(result.signal.changePct, -20);
  assert.equal(result.signal.absChange, -0.072);
});

test("threshold boundary is inclusive: 19.9% no signal, 20.0% signal (docs/03 §10.4)", () => {
  const config = configWith();
  const now = FIXED_NOW + 60_000;

  const below = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), round(0.3 * 1.199, 6)] });
  const belowResult = evaluateSignal({
    market: MARKET_TWO_SIDED, series: below, config, now, state: createSignalState(),
  });
  assert.equal(belowResult.signal, null);
  assert.equal(belowResult.reason, "no_trigger");

  const exact = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const exactResult = evaluateSignal({
    market: MARKET_TWO_SIDED, series: exact, config, now, state: createSignalState(),
  });
  assert.ok(exactResult.signal);
  assert.equal(exactResult.signal.changePct, 20);
});

test("minAbsMove filters a 20% move whose absolute change is too small", () => {
  const config = configWith({ signal: { minAbsMove: 0.1 } });
  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const result = evaluateSignal({
    market: MARKET_TWO_SIDED, series, config, now: FIXED_NOW + 60_000, state: createSignalState(),
  });
  assert.equal(result.signal, null);
  assert.equal(result.reason, "no_trigger");
});

test("p_ref >= 0.01 hard floor rejects the low-price degenerate move (docs/03 §2.5 / §10.5)", () => {
  const config = configWith();
  const prices = [...Array.from({ length: 60 }, () => 0.002), 0.003];
  const series = buildSeries({ prices });
  const result = evaluateSignal({
    market: MARKET_TWO_SIDED, series, config, now: FIXED_NOW + 60_000, state: createSignalState(),
  });
  assert.equal(result.signal, null);
  assert.equal(result.reason, "below_price_floor");
});

test("confirmationTicks needs consecutive qualifying ticks, with re-arm after firing", () => {
  const config = configWith({ signal: { confirmationTicks: 2 } });
  const basePrices = [...Array.from({ length: 60 }, () => 0.3), 0.36, 0.36, 0.3, 0.36, 0.36];
  const state = createSignalState();

  const at = (index) => {
    const series = buildSeries({ prices: basePrices.slice(0, index + 1) });
    return evaluateSignal({
      market: MARKET_TWO_SIDED, series, config, now: FIXED_NOW + index * 1000, state,
    });
  };

  const first = at(60); // first qualifying tick
  assert.equal(first.signal, null);
  assert.equal(first.reason, "awaiting_confirmation");
  assert.equal(first.state.streak.up, 1);

  const second = at(61); // second consecutive tick -> fire
  assert.ok(second.signal, `expected signal, got ${second.reason}`);
  assert.equal(second.state.count, 1);
  assert.equal(second.state.rearm.up, false);

  const third = at(62); // price back to flat -> re-arms
  assert.equal(third.signal, null);
  assert.equal(third.reason, "no_trigger");
  assert.equal(third.state.rearm.up, true);

  const fourth = at(63); // trigger again but only 1 confirmed tick so far
  assert.equal(fourth.signal, null);
  assert.equal(fourth.reason, "awaiting_confirmation");

  const fifth = at(64); // two consecutive triggers -> fire attempt hits the 300s cooldown
  assert.equal(fifth.signal, null);
  assert.equal(fifth.reason, "cooldown");
});

test("cooldown suppresses same-direction repeats; opposite direction counts separately", () => {
  const config = configWith({ signal: { cooldownSec: 300 } });
  const state = createSignalState();
  state.rearm.up = true;
  state.rearm.down = true;
  state.lastSignalTs.up = FIXED_NOW;
  state.lastSignalTs.down = 0;

  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const now = FIXED_NOW + 60_000;
  const result = evaluateSignal({ market: MARKET_TWO_SIDED, series, config, now, state });
  assert.equal(result.signal, null);
  assert.equal(result.reason, "cooldown");

  // the down direction has no cooldown yet: a down move still fires
  const downSeries = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.36), 0.288] });
  const downResult = evaluateSignal({
    market: MARKET_TWO_SIDED, series: downSeries, config, now, state: createSignalState(),
  });
  assert.ok(downResult.signal);
  assert.equal(downResult.signal.direction, "down");
});

test("maxSignalsPerMarket caps generated entry signals", () => {
  const config = configWith({ signal: { maxSignalsPerMarket: 1 } });
  const state = createSignalState();
  state.count = 1;
  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const result = evaluateSignal({
    market: MARKET_TWO_SIDED, series, config, now: FIXED_NOW + 60_000, state,
  });
  assert.equal(result.signal, null);
  assert.equal(result.reason, "market_signal_cap");
});

test("direction config suppresses the other direction (docs/03 §2.3)", () => {
  const upSeries = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] });
  const downSeries = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.36), 0.288] });
  const now = FIXED_NOW + 60_000;

  const upOnlyOnDown = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series: downSeries,
    config: configWith({ signal: { direction: "up" } }),
    now,
    state: createSignalState(),
  });
  assert.equal(upOnlyOnDown.signal, null);

  const downOnlyOnUp = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series: upSeries,
    config: configWith({ signal: { direction: "down" } }),
    now,
    state: createSignalState(),
  });
  assert.equal(downOnlyOnUp.signal, null);
});

test("stale quotes, missing windows, future samples and bad quotes yield no signal", () => {
  const config = configWith();
  const upPrices = [...Array.from({ length: 60 }, () => 0.3), 0.36];
  const series = buildSeries({ prices: upPrices });

  const stale = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series,
    config,
    now: FIXED_NOW + 60_000 + 6_000, // > max(3*tick, 5s)
    state: createSignalState(),
  });
  assert.equal(stale.signal, null);
  assert.equal(stale.reason, "stale");

  // no sample at/before now-windowSec -> window not ready
  const shortSeries = buildSeries({
    startTs: FIXED_NOW + 30_000,
    prices: [0.3, 0.36],
  });
  const noRef = evaluateSignal({
    market: MARKET_TWO_SIDED, series: shortSeries, config, now: FIXED_NOW + 31_000, state: createSignalState(),
  });
  assert.equal(noRef.signal, null);
  assert.equal(noRef.reason, "window_not_ready");

  const future = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series: [makeSeries(FIXED_NOW, [0.3, 0.36])[1], { ...makeSeries(FIXED_NOW, [0.3, 0.36])[1], ts: FIXED_NOW + 60_000 }],
    config,
    now: FIXED_NOW,
    state: createSignalState(),
  });
  assert.equal(future.signal, null);
  assert.equal(future.reason, "future_sample");

  const empty = evaluateSignal({ market: MARKET_TWO_SIDED, series: [], config, now: FIXED_NOW, state: createSignalState() });
  assert.equal(empty.reason, "no_samples");

  const badQuoteSeries = [
    { ts: FIXED_NOW - 60_000, bid: 0.3, ask: 0.32, mid: 0.31, last: 0.31 },
    { ts: FIXED_NOW, bid: 0, ask: 0, mid: null, last: null },
  ];
  const badQuote = evaluateSignal({
    market: MARKET_TWO_SIDED, series: badQuoteSeries, config, now: FIXED_NOW, state: createSignalState(),
  });
  assert.equal(badQuote.signal, null);
  assert.equal(badQuote.reason, "invalid_now_price");
});

test("price band and spread guards run before the trigger (docs/03 §2.3)", () => {
  const now = FIXED_NOW + 60_000;
  const ceilingSeries = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.99] });
  const ceiling = evaluateSignal({
    market: MARKET_TWO_SIDED, series: ceilingSeries, config: configWith(), now, state: createSignalState(),
  });
  assert.equal(ceiling.signal, null);
  assert.equal(ceiling.reason, "above_price_ceiling");

  const floorSeries = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.01] });
  const floor = evaluateSignal({
    market: MARKET_TWO_SIDED, series: floorSeries, config: configWith(), now, state: createSignalState(),
  });
  assert.equal(floor.signal, null);
  assert.equal(floor.reason, "outside_price_band");

  const wideMarket = { ...MARKET_TWO_SIDED, spread: 0.1 };
  const wide = evaluateSignal({
    market: wideMarket,
    series: buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] }),
    config: configWith(),
    now,
    state: createSignalState(),
  });
  assert.equal(wide.signal, null);
  assert.equal(wide.reason, "spread_too_wide");

  // requireSpreadOk=false lets the same market through
  const loose = evaluateSignal({
    market: wideMarket,
    series: buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.3), 0.36] }),
    config: configWith({ signal: { requireSpreadOk: false } }),
    now,
    state: createSignalState(),
  });
  assert.ok(loose.signal);
});

/* ------------------------------------------------------------------------- */
/* Execution (server/engine/execution.js)                                    */
/* ------------------------------------------------------------------------- */

test("rejected entry persists the quote snapshot at rejection time", () => {
  const now = Date.now();
  const market = {
    id: "m-reject-snapshot",
    city: "Wellington",
    bracket: "18°C",
    impliedProbability: 0.81,
    spread: 0.24,
    liquidityUsd: 167.12,
    bookDepthUsd: 210.5,
    stale: false,
    acceptingOrders: true,
    closed: false,
    tokens: { yesTokenId: "yes-snap", noTokenId: "no-snap" },
    quotes: {
      YES: { bid: 0.65, ask: 0.89, mid: 0.77, last: 0.81 },
      NO: { bid: 0.11, ask: 0.35, mid: 0.23, last: null },
    },
  };
  const run = {
    id: "run_reject_snapshot",
    trades: [],
    filledTradeCount: 0,
    _spreadCost: 0,
    _depthSlippageCost: 0,
    store: { appendRecord() {} },
    sse: { broadcast() {} },
    portfolio: { snapshots: () => [], positionsValue: () => 0 },
  };
  recordRejectedEntry(run, { id: "sig_snap", tokenId: "yes-snap", outcome: "YES" }, market, "spread_too_wide", now, {
    reason: "fallback_entry",
    detail: "点差 24.00¢ > 上限 8.00¢",
  });
  const trade = run.trades[0];
  assert.equal(trade.status, "rejected");
  assert.equal(trade.rejectReason, "spread_too_wide");
  assert.equal(trade.rejectDetail, "点差 24.00¢ > 上限 8.00¢");
  assert.equal(trade.marketSnapshot.spread, 0.24);
  assert.equal(trade.marketSnapshot.impliedProbability, 0.81);
  assert.equal(trade.marketSnapshot.liquidityUsd, 167.12);
  assert.equal(trade.marketSnapshot.quotes.YES.bid, 0.65);
  assert.equal(trade.marketSnapshot.quotes.YES.ask, 0.89);
  assert.equal(trade.marketSnapshot.quotes.NO.bid, 0.11);
});

test("price-band blocked momentum returns a non-tradable candidate (13C collapse case)", () => {
  const config = configWith({
    universe: { minPrice: 0.03, maxPrice: 0.97 },
    signal: { windowSec: 10, moveThresholdPct: 10, minAbsMove: 0.5, direction: "both", confirmationTicks: 1 },
  });
  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.895), 0.005] });
  const now = FIXED_NOW + 60_000;
  const result = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series,
    config,
    now,
    state: createSignalState(),
  });
  assert.equal(result.signal, null);
  assert.equal(result.reason, "outside_price_band");
  assert.ok(result.candidate);
  assert.equal(result.candidate.direction, "down");
  assert.equal(result.candidate.outcome, "NO");
  assert.equal(result.candidate.fromPrice, 0.895);
  assert.equal(result.candidate.toPrice, 0.005);
  assert.equal(result.candidate.blockReason, "outside_price_band");
});

test("observation signal is recorded without entry and respects its own cooldown", () => {
  const config = configWith({
    universe: { minPrice: 0.03, maxPrice: 0.97 },
    signal: { windowSec: 10, moveThresholdPct: 10, minAbsMove: 0.5, direction: "both", confirmationTicks: 1, cooldownSec: 10 },
  });
  const now = FIXED_NOW + 60_000;
  const series = buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.895), 0.005] });
  const candidate = evaluateSignal({
    market: MARKET_TWO_SIDED,
    series,
    config,
    now,
    state: createSignalState(),
  }).candidate;
  const appended = [];
  const broadcast = [];
  const run = {
    id: "run_observation",
    config,
    signals: [],
    _observationLast: new Map(),
    store: { appendRecord(runId, type, value) { appended.push({ runId, type, value }); } },
    sse: { broadcast(type, data, runId) { broadcast.push({ type, data, runId }); } },
  };
  const observation = recordObservationSignal(run, MARKET_TWO_SIDED, candidate, now);
  assert.ok(observation);
  assert.equal(observation.kind, "observation");
  assert.equal(observation.tradable, false);
  assert.equal(observation.blockReason, "outside_price_band");
  assert.equal(run.signals.length, 1);
  assert.equal(appended.length, 1);
  assert.equal(broadcast[0].type, "signal");
  // Same market/direction inside the cooldown must not duplicate.
  assert.equal(recordObservationSignal(run, MARKET_TWO_SIDED, candidate, now + 5_000), null);
  assert.equal(run.signals.length, 1);
});

test("sample timestamp changes trigger evaluation even when book hash is unchanged", async () => {
  const config = configWith({
    universe: { minPrice: 0.03, maxPrice: 0.97 },
    signal: { windowSec: 10, moveThresholdPct: 10, minAbsMove: 0.5, direction: "both", confirmationTicks: 1, cooldownSec: 10 },
  });
  const market = {
    ...MARKET_TWO_SIDED,
    closed: false,
    stale: false,
    quotes: { YES: { bid: 0.894, ask: 0.896, mid: 0.895 }, NO: { bid: 0.104, ask: 0.106, mid: 0.105 } },
  };
  let historyCalls = 0;
  const source = {
    getBook: () => ({ hash: "same-hash", bids: [], asks: [] }),
    getLatest: () => ({ ts: 1_000 + historyCalls, bid: 0, ask: 0, mid: 0.895, last: null }),
    getHistory: () => {
      historyCalls += 1;
      return buildSeries({ prices: [...Array.from({ length: 60 }, () => 0.895), 0.005] });
    },
  };
  const run = {
    id: "run_sample_trigger",
    config,
    marketIds: [market.id],
    markets: new Map([[market.id, market]]),
    signalStates: new Map(),
    signals: [],
    _lastBookHash: new Map(),
    _lastSampleTs: new Map(),
    _observationLast: new Map(),
    portfolio: { positionsForMarket: () => [], positions: new Map(), equity: () => 100, cash: 100 },
    store: { appendRecord() {} },
    sse: { broadcast() {} },
    source,
    _lastPersisted: 0,
  };
  await processMarkets(run, FIXED_NOW + 60_000);
  const firstCalls = historyCalls;
  await new Promise((resolve) => setImmediate(resolve));
  source.getLatest = () => ({ ts: 2_000, bid: 0, ask: 0, mid: 0.895, last: null });
  await processMarkets(run, FIXED_NOW + 61_000);
  assert.equal(historyCalls, firstCalls + 1, "sample ts change must evaluate again");
});

test("ceilToTick / floorToTick / floorShares", () => {
  assert.equal(ceilToTick(0.3212, 0.001), 0.322);
  assert.equal(ceilToTick(0.32, 0.001), 0.32);
  assert.equal(ceilToTick(1, 0.001), 0.999);
  assert.equal(floorToTick(0.3218, 0.001), 0.321);
  assert.equal(floorToTick(0.32, 0.001), 0.32);
  assert.equal(floorToTick(0.0005, 0.001), 0.001);
  assert.equal(floorShares(98.329), 98.32);
  assert.equal(floorShares(5.999), 5.99);
  assert.equal(floorShares(0.009), 0);
});

test("BUY walks asks ascending and computes VWAP/fee on the fill (docs/03 §10.10)", () => {
  const result = simulateBuy({
    book: ORDER_BOOK_DOCS_WALK,
    budgetUsd: 20,
    slippageBufferBps: 400, // limit 0.52 permits both levels
  });
  assert.equal(result.ok, true);
  assert.equal(result.shares, 30);
  assert.equal(result.price, 0.513333);
  assert.equal(result.notional, 15.39999);
  assert.equal(result.fee, 0.37473);
  assert.equal(result.totalCost, 15.77472);
  assert.equal(result.status, "partial", "depth exhausted while budget remained");
  assert.deepEqual(result.bookLevels, [{ price: 0.5, size: 10 }, { price: 0.52, size: 20 }]);
});

test("price protection at bps=0 caps the fill at the best ask (docs/03 §3.1)", () => {
  const result = simulateBuy({ book: ORDER_BOOK_DOCS_WALK, budgetUsd: 20, slippageBufferBps: 0 });
  assert.equal(result.shares, 10);
  assert.equal(result.price, 0.5);
  assert.equal(result.limitPrice, 0.5);
  assert.equal(result.status, "partial");

  const protectedFill = simulateBuy({
    book: makeOrderBook({ asks: [{ price: 0.3, size: 100 }, { price: 0.4, size: 100 }] }),
    budgetUsd: 1_000,
    slippageBufferBps: 1_000, // limit = 0.33
  });
  assert.equal(protectedFill.shares, 100);
  assert.equal(protectedFill.limitPrice, 0.33);
  assert.deepEqual(protectedFill.bookLevels, [{ price: 0.3, size: 100 }]);
});

test("BUY spends the notional budget fully; the fee is charged on top of it", () => {
  const book = makeOrderBook({ asks: [{ price: 0.5, size: 100 }] });
  const result = simulateBuy({ book, budgetUsd: 6 });
  assert.equal(result.ok, true);
  assert.equal(result.shares, 12);
  assert.equal(result.price, 0.5);
  assert.equal(result.notional, 6);
  assert.equal(result.fee, 0.15);
  assert.equal(result.totalCost, 6.15);
  assert.equal(result.status, "filled");
});

test("BUY trims by 0.01 shares so notional + fee fits available cash", () => {
  const book = makeOrderBook({ asks: [{ price: 0.5, size: 100 }] });
  const result = simulateBuy({ book, budgetUsd: 6, cashUsd: 6.05 });
  assert.equal(result.ok, true);
  assert.ok(result.notional + result.fee <= 6.05 + 1e-9);
  assert.ok(result.shares < 12);
  assert.ok(result.notional < 6);

  // Trimming may go below 5 shares: market BUYs have no share minimum, only $1 notional.
  const lessCash = simulateBuy({ book, budgetUsd: 6, cashUsd: 2.5 });
  assert.equal(lessCash.ok, true);
  assert.ok(lessCash.shares < 5);
  assert.ok(lessCash.notional >= 1 - 1e-9);
  assert.ok(lessCash.notional + lessCash.fee <= 2.5 + 1e-9);
});

test("BUY top-up: a $1 budget at high prices still meets the $1 exchange minimum", () => {
  for (const price of [0.52, 0.72, 0.95]) {
    const book = makeOrderBook({ asks: [{ price, size: 1000 }] });
    const fill = simulateBuy({ book, budgetUsd: 1, cashUsd: 100 });
    assert.equal(fill.ok, true, `price ${price} should fill`);
    assert.ok(fill.notional >= 1 - 1e-9, `notional ${fill.notional} must reach $1`);
    assert.ok(fill.notional <= 1 + price * 0.01 + 1e-9, "top-up is limited to one 0.01-share lot");
    assert.ok(fill.shares > 0);
    assert.equal(fill.fee, calcTakerFee(fill.shares, fill.price));
  }
});

test("BUY rejects below the $1 market-buy minimum / without liquidity / with no cash", () => {
  // Market BUY only needs $1 notional; 3 shares at 40¢ = $1.20 is a valid order.
  const thin = simulateBuy({ book: ORDER_BOOK_THIN, budgetUsd: 100 });
  assert.equal(thin.ok, true);
  assert.equal(thin.shares, 3);
  assert.equal(thin.notional, 1.2);
  assert.equal(thin.price, 0.4);

  assert.equal(simulateBuy({ book: makeOrderBook({}), budgetUsd: 100 }).rejectReason, "no_liquidity");
  assert.equal(simulateBuy({ book: ORDER_BOOK_BIDS_ONLY, budgetUsd: 100 }).rejectReason, "no_liquidity");
  assert.equal(simulateBuy({ book: ORDER_BOOK_DOCS_WALK, budgetUsd: 0 }).rejectReason, "insufficient_cash");
  assert.equal(simulateBuy({ book: ORDER_BOOK_DOCS_WALK, budgetUsd: -5 }).rejectReason, "insufficient_cash");

  // $1 notional floor: $0.55 at 10¢ (5.5 shares) is below $1 => rejected.
  const cheap = makeOrderBook({ asks: [{ price: 0.1, size: 100 }] });
  assert.equal(simulateBuy({ book: cheap, budgetUsd: 0.55 }).rejectReason, "below_min_order");
  // $1.15 at 10¢ = 11.5 shares => accepted.
  const dollarOk = simulateBuy({ book: cheap, budgetUsd: 1.15 });
  assert.equal(dollarOk.ok, true);
  assert.ok(dollarOk.notional >= 1 - 1e-9, "notional must meet the $1 floor");

  // No 5-share minimum for market BUY: $1.01 at 72¢ = 1.4 shares => valid (matches Polymarket UI).
  const high = makeOrderBook({ asks: [{ price: 0.72, size: 100 }] });
  const small = simulateBuy({ book: high, budgetUsd: 1.01 });
  assert.equal(small.ok, true);
  assert.ok(small.shares < 5);
  assert.ok(small.notional >= 1 - 1e-9);
});

test("BUY fee always equals calcTakerFee(shares, vwap) — AC-03", () => {
  for (const budget of [6, 20, 50, 100, 250]) {
    const result = simulateBuy({ book: ORDER_BOOK_TWO_SIDED, budgetUsd: budget, slippageBufferBps: 500 });
    if (result.ok) {
      assert.equal(result.fee, calcTakerFee(result.shares, result.price), `budget ${budget}`);
    }
  }
});

test("SELL walks bids descending, fee is deducted from proceeds", () => {
  const partial = simulateSell({ book: ORDER_BOOK_DOCS_WALK, shares: 15, slippageBufferBps: 0 });
  assert.equal(partial.ok, true);
  assert.equal(partial.shares, 10);
  assert.equal(partial.price, 0.48);
  assert.equal(partial.notional, 4.8);
  assert.equal(partial.fee, 0.1248);
  assert.equal(partial.totalCost, 4.6752);
  assert.equal(partial.status, "partial");

  const full = simulateSell({ book: ORDER_BOOK_DOCS_WALK, shares: 10 });
  assert.equal(full.status, "filled");
  assert.equal(full.shares, 10);

  const walked = simulateSell({
    book: ORDER_BOOK_DOCS_WALK,
    shares: 25,
    slippageBufferBps: 1_000, // limit 0.432 -> both levels
  });
  assert.equal(walked.shares, 25);
  assert.equal(walked.price, 0.468);
  assert.equal(walked.notional, 11.7);
  assert.equal(walked.fee, 0.31122);
  assert.equal(walked.totalCost, 11.38878);
  assert.equal(walked.status, "filled");
  assert.deepEqual(walked.bookLevels, [{ price: 0.48, size: 10 }, { price: 0.46, size: 15 }]);
});

test("SELL has no 5-share floor (market sell of a 1.1-share position is valid)", () => {
  // Market SELL is not a limit order: the 5-share min_order_size does not apply.
  const thin = simulateSell({ book: ORDER_BOOK_THIN, shares: 10 });
  assert.equal(thin.ok, true);
  assert.equal(thin.shares, 3);
  assert.equal(thin.status, "partial");
  assert.equal(thin.notional, 1.14);

  // Official UI example: sell 1.1 shares into a 92¢ bid.
  const smallBook = makeOrderBook({ bids: [{ price: 0.92, size: 10 }] });
  const small = simulateSell({ book: smallBook, shares: 1.1 });
  assert.equal(small.ok, true);
  assert.equal(small.shares, 1.1);
  assert.equal(small.price, 0.92);
  assert.equal(small.notional, 1.012);
  assert.equal(small.status, "filled");

  assert.equal(simulateSell({ book: ORDER_BOOK_DOCS_WALK, shares: 0 }).rejectReason, "below_min_order");
  assert.equal(simulateSell({ book: makeOrderBook({}), shares: 10 }).rejectReason, "no_liquidity");
  assert.equal(simulateSell({ book: ORDER_BOOK_ASKS_ONLY, shares: 10 }).rejectReason, "no_liquidity");
});

test("bookMid uses a valid two-sided book, otherwise the supplied mid", () => {
  assert.equal(bookMid({ bestBid: 0.3, bestAsk: 0.32 }), 0.31);
  assert.equal(bookMid({ bestBid: 0.32, bestAsk: 0.3, mid: 0.31 }), 0.31);
  assert.equal(bookMid({ bestBid: 0, bestAsk: 0, mid: 0.25 }), 0.25);
  assert.equal(bookMid(null), null);
});

/* ------------------------------------------------------------------------- */
/* Portfolio ledger (server/engine/portfolio.js)                             */
/* ------------------------------------------------------------------------- */

const TOKENS = {
  yes: MARKET_TWO_SIDED.tokens.yesTokenId,
  no: MARKET_TWO_SIDED.tokens.noTokenId,
};

/** Build the docs/04 §6.5 golden ledger T1-T6. */
function buildGoldenLedger() {
  const portfolio = new Portfolio({ initialCapital: 1000, feeRate: 0.05 });
  const equityPoints = [{ ts: FIXED_NOW, equity: 1000 }];
  const trades = [];
  let ts = FIXED_NOW;

  const record = (action, details) => {
    ts += 1_000;
    if (action === "buy") portfolio.buy({ ts, ...details });
    else if (action === "sell") return portfolio.sell({ ts, ...details });
    else if (action === "settle") return portfolio.settleMarket(details.marketId, details.payoutPerShare, ts);
    return undefined;
  };
  const sample = () => {
    equityPoints.push({ ts, equity: portfolio.equity() });
  };

  // T1 BUY YES 100 @ 0.21 (reference mid 0.20)
  const t1Fee = calcTakerFee(100, 0.21);
  record("buy", {
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 100, price: 0.21, fee: t1Fee, midPrice: 0.2,
  });
  trades.push({ fee: t1Fee });
  sample();
  // T2 SELL YES 100 @ 0.24 (reference mid 0.25)
  const t2Fee = calcTakerFee(100, 0.24);
  record("sell", { tokenId: TOKENS.yes, shares: 100, price: 0.24, fee: t2Fee });
  trades.push({ fee: t2Fee });
  sample();
  // T3 BUY NO 50 @ 0.62 (reference mid 0.61)
  const t3Fee = calcTakerFee(50, 0.62);
  record("buy", {
    tokenId: TOKENS.no, marketId: MARKET_TWO_SIDED.id, outcome: "NO",
    city: "New York", bracket: "13°C", shares: 50, price: 0.62, fee: t3Fee, midPrice: 0.61,
  });
  trades.push({ fee: t3Fee });
  sample();
  // T4 settlement: NO wins, payout 1.00/share, no fee
  record("settle", { marketId: MARKET_TWO_SIDED.id, payoutPerShare: 1 });
  trades.push({ fee: 0 });
  sample();
  // T5 BUY YES 100 @ 0.71 (reference mid 0.70)
  const t5Fee = calcTakerFee(100, 0.71);
  record("buy", {
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 100, price: 0.71, fee: t5Fee, midPrice: 0.7,
  });
  trades.push({ fee: t5Fee });
  sample();
  // T6 SELL YES 100 @ 0.66 (reference mid 0.67)
  const t6Fee = calcTakerFee(100, 0.66);
  record("sell", { tokenId: TOKENS.yes, shares: 100, price: 0.66, fee: t6Fee });
  trades.push({ fee: t6Fee });
  sample();

  return { portfolio, equityPoints, trades };
}

test("golden ledger T1-T6 matches docs/04 §6.5 cash/equity/fees exactly", () => {
  const { portfolio, equityPoints, trades } = buildGoldenLedger();

  assert.equal(portfolio.initialCapital, 1000);
  assert.deepEqual(equityPoints.map((point) => point.equity), [
    1000, 998.1705, 1001.2585, 1000.1695, 1019.6695, 1017.64, 1012.518,
  ]);
  approx(portfolio.cash, 1012.518, 1e-6);
  assert.equal(portfolio.positions.size, 0);
  approx(portfolio.realizedPnl, 12.518, 1e-6);
  approx(portfolio.unrealizedPnl(), 0, 1e-6);
  approx(portfolio.feesPaid, 4.482, 1e-6);
  approx(portfolio.turnoverUsd, 213, 1e-6);
  assert.deepEqual(portfolio.closedRoundPnls.map((v) => round(v, 4)), [1.2585, 18.411, -7.1515]);
  approx(trades.reduce((sum, trade) => sum + trade.fee, 0), portfolio.feesPaid, 1e-9);
  approx(portfolio.equity(), 1012.518, 1e-6);
});

test("ledger identities hold after every action: equity = cash + positionsValue = capital + realized + unrealized", () => {
  const { portfolio } = buildGoldenLedger();
  approx(portfolio.equity(), portfolio.cash + portfolio.positionsValue(), 1e-6);
  approx(
    portfolio.equity(),
    portfolio.initialCapital + portfolio.realizedPnl + portfolio.unrealizedPnl(),
    1e-6,
  );
  assert.equal(portfolio.equity(), 1012.518);
});

test("cost basis includes entry fees and avgPrice is the break-even price", () => {
  const portfolio = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  const fee = calcTakerFee(100, 0.5); // 1.25
  portfolio.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 100, price: 0.5, fee, midPrice: 0.5,
  });
  const position = portfolio.getPosition(TOKENS.yes);
  assert.equal(position.costBasis, 51.25);
  assert.equal(position.avgPrice, 0.5125);
  assert.equal(position.shares, 100);
  assert.equal(position.entryFee, 1.25);
  assert.equal(position.estExitFee, calcTakerFee(100, 0.5));
  approx(portfolio.cash, 948.75, 1e-6);
  approx(portfolio.equity(), 998.75, 1e-6); // 948.75 cash + 50 mark
});

test("partial sell realises P&L pro-rata and keeps the remaining cost basis", () => {
  const portfolio = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  const entryFee = calcTakerFee(100, 0.5); // 1.25
  portfolio.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 100, price: 0.5, fee: entryFee, midPrice: 0.5,
  });
  const exitFee = calcTakerFee(40, 0.6); // 0.48
  const result = portfolio.sell({ tokenId: TOKENS.yes, shares: 40, price: 0.6, fee: exitFee });
  assert.equal(result.soldShares, 40);
  assert.equal(result.net, 23.52);
  assert.equal(result.costBasisPortion, 20.5);
  assert.equal(result.realizedPnl, 3.02);
  assert.equal(result.closedRoundPnl, null);
  assert.equal(result.position.shares, 60);
  assert.equal(result.position.costBasis, 30.75);
  assert.equal(result.position.avgPrice, 0.5125);
  approx(portfolio.feesPaid, 1.73, 1e-6);
  approx(portfolio.realizedPnl, 3.02, 1e-6);
});

test("settlement pays 1 / 0 / 0.5 per share with no fee (docs/03 §4.3)", () => {
  // winner
  const win = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  const winFee = calcTakerFee(10, 0.4);
  win.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 10, price: 0.4, fee: winFee, midPrice: 0.4,
  });
  const winResults = win.settleMarket(MARKET_TWO_SIDED.id, 1, FIXED_NOW + 5_000);
  assert.equal(winResults.length, 1);
  assert.equal(winResults[0].payout, 10);
  approx(winResults[0].realizedPnl, 10 - (4 + winFee), 1e-6);
  assert.equal(win.feesPaid, winFee, "settlement must not charge a fee");
  assert.equal(win.positions.size, 0);
  assert.equal(win.equity(), 1_000 + 10 - 4 - winFee);

  // loser
  const lose = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  lose.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 10, price: 0.4, fee: winFee, midPrice: 0.4,
  });
  const loseResults = lose.settleMarket(MARKET_TWO_SIDED.id, 0, FIXED_NOW + 5_000);
  assert.equal(loseResults[0].payout, 0);
  approx(loseResults[0].realizedPnl, -(4 + winFee), 1e-6);
  assert.equal(lose.closedRoundPnls.length, 1);

  // 50/50
  const half = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  half.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 10, price: 0.4, fee: winFee, midPrice: 0.4,
  });
  const halfResults = half.settleMarket(MARKET_TWO_SIDED.id, 0.5, FIXED_NOW + 5_000);
  assert.equal(halfResults[0].payout, 5);
  approx(halfResults[0].realizedPnl, 5 - (4 + winFee), 1e-6);

  // unknown result -> no-op, positions kept (docs/03 §4.3 resolution_pending)
  const pending = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  pending.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 10, price: 0.4, fee: winFee, midPrice: 0.4,
  });
  assert.deepEqual(pending.settleMarket(MARKET_TWO_SIDED.id, null, FIXED_NOW), []);
  assert.equal(pending.positions.size, 1);
});

test("markToMarket updates marks from valid mids and keeps the last mark otherwise", () => {
  const portfolio = new Portfolio({ initialCapital: 1_000, feeRate: 0.05 });
  portfolio.buy({
    tokenId: TOKENS.yes, marketId: MARKET_TWO_SIDED.id, outcome: "YES",
    city: "New York", bracket: "13°C", shares: 100, price: 0.5, fee: calcTakerFee(100, 0.5), midPrice: 0.5,
  });
  portfolio.markToMarket(new Map([[TOKENS.yes, 0.6]]));
  approx(portfolio.positionsValue(), 60, 1e-6);
  approx(portfolio.unrealizedPnl(), 60 - 51.25, 1e-6);

  portfolio.markToMarket(new Map([[TOKENS.yes, 0]])); // invalid mark is ignored
  approx(portfolio.positionsValue(), 60, 1e-6);

  const snapshots = portfolio.snapshots();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].outcome, "YES");
  assert.ok(Number.isFinite(snapshots[0].impliedProbability));
});

/* ------------------------------------------------------------------------- */
/* Metrics (server/engine/metrics.js) — docs/04 §6.5 golden fixture          */
/* ------------------------------------------------------------------------- */

test("metrics golden fixture T1-T6 matches docs/04 §6.5 / AC-06", () => {
  const { portfolio, equityPoints } = buildGoldenLedger();
  const metrics = computeMetrics({
    initialCapital: portfolio.initialCapital,
    equityPoints,
    closedRoundPnls: portfolio.closedRoundPnls,
    realizedPnl: portfolio.realizedPnl,
    unrealizedPnl: portfolio.unrealizedPnl(),
    feesPaid: portfolio.feesPaid,
    trades: 5,
    turnoverUsd: portfolio.turnoverUsd,
    exposureUsd: portfolio.exposureUsd(),
    tickIntervalMs: 1000,
  });

  approx(metrics.totalReturnPct, 1.2518, 1e-6, "totalReturnPct");
  approx(metrics.realizedPnl, 12.518, 1e-6, "realizedPnl");
  approx(metrics.unrealizedPnl, 0, 1e-6, "unrealizedPnl");
  approx(metrics.feesPaid, 4.482, 1e-6, "feesPaid");
  assert.equal(metrics.trades, 5);
  assert.equal(metrics.closedTrades, 3);
  approx(metrics.winRate, 0.6667, 1e-4, "winRate fraction");
  approx(metrics.avgWin, 9.83475, 1e-5, "avgWin");
  approx(metrics.avgLoss, 7.1515, 1e-5, "avgLoss");
  approx(metrics.profitFactor, 2.7504, 1e-4, "profitFactor");
  approx(metrics.expectancy, 4.17267, 1e-5, "expectancy");
  approx(metrics.maxDrawdownPct, 0.7014, 1e-4, "maxDrawdownPct");
  approx(metrics.turnoverUsd, 213, 1e-6, "turnoverUsd");
  approx(metrics.feeDragPct, 0.4482, 1e-6, "feeDragPct");
  assert.equal(metrics.sharpe, null, "fewer than 30 samples -> null Sharpe");
  approx(metrics.exposureUsd, 0, 1e-6, "exposureUsd");

  // JSON-safe: no NaN / Infinity anywhere
  for (const [key, value] of Object.entries(metrics)) {
    assert.ok(value === null || Number.isFinite(value), `${key} must be finite or null, got ${value}`);
  }
});

test("metrics edge cases: no trades -> predegrade to null/0, no Infinity/NaN", () => {
  const metrics = computeMetrics({
    initialCapital: 1_000,
    equityPoints: [{ ts: FIXED_NOW, equity: 1_000 }],
    closedRoundPnls: [],
    realizedPnl: 0,
    unrealizedPnl: 0,
    feesPaid: 0,
    trades: 0,
    turnoverUsd: 0,
    exposureUsd: 0,
  });
  assert.equal(metrics.closedTrades, 0);
  assert.equal(metrics.winRate, 0);
  assert.equal(metrics.avgWin, null);
  assert.equal(metrics.avgLoss, null);
  assert.equal(metrics.profitFactor, null);
  assert.equal(metrics.expectancy, null);
  assert.equal(metrics.sharpe, null);
  assert.equal(metrics.totalReturnPct, 0);
  assert.equal(metrics.maxDrawdownPct, 0);
  for (const value of Object.values(metrics)) {
    assert.ok(value === null || Number.isFinite(value));
  }

  // only winners -> no losses to divide by -> profitFactor null
  const winnersOnly = computeMetrics({
    initialCapital: 1_000,
    equityPoints: [{ ts: FIXED_NOW, equity: 1_100 }],
    closedRoundPnls: [60, 40],
    realizedPnl: 100,
    feesPaid: 2,
    trades: 4,
    turnoverUsd: 500,
    exposureUsd: 0,
  });
  assert.equal(winnersOnly.profitFactor, null);
  assert.equal(winnersOnly.winRate, 1);
  assert.equal(winnersOnly.expectancy, 50);
});

test("maxDrawdownPct is peak-to-trough on the equity curve", () => {
  assert.equal(maxDrawdownPct([
    { ts: 0, equity: 1000 },
    { ts: 1, equity: 900 },
    { ts: 2, equity: 950 },
    { ts: 3, equity: 800 },
  ]), 20);
  assert.equal(maxDrawdownPct([{ ts: 0, equity: 1000 }]), 0);
  assert.equal(maxDrawdownPct([]), 0);
});

test("resampleEquity interpolates on the fixed grid; Sharpe needs enough samples", () => {
  const grid = resampleEquity(
    [{ ts: 0, equity: 100 }, { ts: 1_000, equity: 110 }, { ts: 2_000, equity: 120 }],
    500,
  );
  assert.deepEqual(grid, [100, 105, 110, 115, 120]);

  assert.equal(sharpeFromEquity(Array.from({ length: 29 }, (_, i) => 100 + i), 5_000), null);
  // constant equity => zero std => null, not Infinity
  assert.equal(sharpeFromEquity(Array.from({ length: 31 }, () => 100), 5_000), null);

  const noisy = Array.from({ length: 31 }, (_, i) => 1000 + (i % 2 === 0 ? i * 2 : -i * 1.5));
  const sharpe = sharpeFromEquity(noisy, 5_000);
  assert.ok(Number.isFinite(sharpe), `expected finite sharpe, got ${sharpe}`);
});

test("periodic fallback plan: rank-1 YES + rank-3 NO over tradable candidates", () => {
  const mk = (id, prob, extra = {}) => ({
    id,
    city: "Test",
    bracket: id,
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: Math.max(0.001, prob - 0.01), ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
    ...extra,
  });
  const run = {
    marketIds: ["m1", "m2", "m3", "m4", "m5"],
    markets: new Map([
      ["m1", mk("m1", 0.8)],
      ["m2", mk("m2", 0.5)],
      ["m3", mk("m3", 0.3)],
      ["m4", mk("m4", 0.2, { closed: true })],
      ["m5", mk("m5", 0.7, { acceptingOrders: false })],
    ]),
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05 }, execution: { fallbackMinTopGapPct: 0 } },
  };
  const legs = planFallbackOrders(run);
  assert.deepEqual(
    legs.map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["1:YES:m1", "3:NO:m3"],
    "closed / not-accepting markets are excluded before ranking",
  );
  // Fewer than 3 tradable candidates => only the rank-1 YES leg.
  const onlyTwo = { ...run, marketIds: ["m1", "m2"] };
  assert.deepEqual(
    planFallbackOrders(onlyTwo).map((leg) => `${leg.rank}:${leg.outcome}`),
    ["1:YES"],
  );
});

test("failed fallback leg is retried even after another leg in the same event fills", () => {
  const mk = (id, prob, eventId) => ({
    id,
    city: "Alpha",
    bracket: id,
    eventId,
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["a1", mk("a1", 0.8, "evt-a")],
    ["a2", mk("a2", 0.5, "evt-a")],
    ["a3", mk("a3", 0.3, "evt-a")],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map([["a3-n", { marketId: "a3" }]]) },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05 }, execution: { fallbackMinTopGapPct: 0 } },
    _fallbackPending: new Map([
      ["event:evt-a|a1|YES", { eventKey: "event:evt-a", marketId: "a1", outcome: "YES", rank: 1 }],
    ]),
  };
  // a3 NO already filled; a1 YES failed -> only retry a1, don't add a3 again.
  assert.deepEqual(
    planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["1:YES:a1"],
  );
  run._fallbackPending.clear();
  // No pending failed leg and the event already has a position -> no new legs.
  assert.deepEqual(planFallbackOrders(run), []);
});

test("fallback skips the whole event when nominal rank-1 has no YES ask instead of buying a lower bracket", () => {
  const mk = (id, prob, { yesAsk = prob + 0.01, noAsk = 1 - prob + 0.01 } = {}) => ({
    id,
    city: "Qingdao",
    bracket: id,
    eventId: "evt-q",
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: yesAsk, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: noAsk, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["15c", mk("15c", 0.998, { yesAsk: 0 })],
    ["14c", mk("14c", 0.0005, { yesAsk: 0.001 })],
    ["16c", mk("16c", 0.0005, { yesAsk: 0.001 })],
    ["13c", mk("13c", 0.0005, { yesAsk: 0.001, noAsk: 0.001 })],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.01, maxPrice: 0.99, maxSpread: 0.08 } },
    _fallbackPending: new Map(),
  };
  // 15°C YES ask=0: do not substitute 16°C.
  assert.deepEqual(planFallbackOrders(run), []);

  // Once 15°C has a YES ask, it is rank-1; no lower bracket substitution.
  markets.get("15c").quotes.YES.ask = 0.999;
  const legs = planFallbackOrders(run);
  assert.equal(legs[0].market.id, "15c");
  assert.equal(legs[0].rank, 1);
  assert.equal(legs[0].outcome, "YES");
});

test("stale fallback pending target is dropped when the rank changes", () => {
  const mk = (id, prob, eventId) => ({
    id,
    city: "Alpha",
    bracket: id,
    eventId,
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["a1", mk("a1", 0.4, "evt-a")],
    ["a2", mk("a2", 0.8, "evt-a")],
    ["a3", mk("a3", 0.3, "evt-a")],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05 }, execution: { fallbackMinTopGapPct: 0 } },
    _fallbackPending: new Map([
      ["event:evt-a|a1|YES", { eventKey: "event:evt-a", marketId: "a1", outcome: "YES", rank: 1 }],
    ]),
  };
  // a2 is now rank-1; a1 pending is stale and must not be bought.
  const legs = planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`);
  assert.deepEqual(legs, ["1:YES:a2", "3:NO:a3"]);
  assert.ok(!run._fallbackPending.has("event:evt-a|a1|YES"));

  // With a position in the event, the stale pending is dropped and no new leg is added.
  run.portfolio.positions = new Map([["a3-n", { marketId: "a3" }]]);
  run._fallbackPending.set("event:evt-a|a1|YES", { eventKey: "event:evt-a", marketId: "a1", outcome: "YES", rank: 1 });
  assert.deepEqual(planFallbackOrders(run), []);
});

test("fallback YES leg requires the configured probability gap to rank-2", () => {
  const mk = (id, prob) => ({
    id,
    city: "GapCity",
    bracket: id,
    eventId: "evt-gap",
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const makeRun = (p1, p2, p3) => ({
    marketIds: ["g1", "g2", "g3"],
    markets: new Map([
      ["g1", mk("g1", p1)],
      ["g2", mk("g2", p2)],
      ["g3", mk("g3", p3)],
    ]),
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.01, maxPrice: 0.99, maxSpread: 0.1 }, execution: { fallbackMinTopGapPct: 40 } },
    _fallbackPending: new Map(),
  });

  // 70% vs 20% = 50 points -> buy YES; rank-3 NO unaffected.
  assert.deepEqual(
    planFallbackOrders(makeRun(0.7, 0.2, 0.1)).map((leg) => `${leg.rank}:${leg.outcome}`),
    ["1:YES", "3:NO"],
  );
  // 60% vs 30% = 30 points < 40 -> no YES leg, but rank-3 NO remains.
  assert.deepEqual(
    planFallbackOrders(makeRun(0.6, 0.3, 0.1)).map((leg) => `${leg.rank}:${leg.outcome}`),
    ["3:NO"],
  );
  // Exactly 40 points qualifies.
  assert.deepEqual(
    planFallbackOrders(makeRun(0.7, 0.3, 0.1)).map((leg) => `${leg.rank}:${leg.outcome}`),
    ["1:YES", "3:NO"],
  );
});

test("fallback pending YES is dropped when the probability gap no longer qualifies", () => {
  const mk = (id, prob) => ({
    id,
    city: "GapCity",
    bracket: id,
    eventId: "evt-gap",
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const run = {
    marketIds: ["g1", "g2", "g3"],
    markets: new Map([
      ["g1", mk("g1", 0.6)],
      ["g2", mk("g2", 0.3)],
      ["g3", mk("g3", 0.1)],
    ]),
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.01, maxPrice: 0.99, maxSpread: 0.1 }, execution: { fallbackMinTopGapPct: 40 } },
    _fallbackPending: new Map([
      ["event:evt-gap|g1|YES", { eventKey: "event:evt-gap", marketId: "g1", outcome: "YES", rank: 1 }],
    ]),
  };
  assert.deepEqual(planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}`), ["3:NO"]);
  assert.ok(!run._fallbackPending.has("event:evt-gap|g1|YES"));
});

test("periodic fallback plan is independent per city/date event group", () => {
  const mk = (id, prob, eventId) => ({
    id,
    city: id.startsWith("a") ? "Alpha" : "Beta",
    bracket: id,
    eventId,
    impliedProbability: prob,
    spread: 0.01,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["a1", mk("a1", 0.8, "evt-a")],
    ["a2", mk("a2", 0.5, "evt-a")],
    ["a3", mk("a3", 0.3, "evt-a")],
    ["b1", mk("b1", 0.6, "evt-b")],
    ["b2", mk("b2", 0.5, "evt-b")],
    ["b3", mk("b3", 0.4, "evt-b")],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05 }, execution: { fallbackMinTopGapPct: 0 } },
  };

  const legs = planFallbackOrders(run);
  assert.deepEqual(
    legs.map((leg) => `${leg.market.city}:${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["Alpha:1:YES:a1", "Alpha:3:NO:a3", "Beta:1:YES:b1", "Beta:3:NO:b3"],
    "each city/date event gets its own rank-1 YES + rank-3 NO",
  );

  // Holding Alpha must NOT block Beta's fallback.
  run.portfolio.positions = new Map([["a1-y", { marketId: "a1" }]]);
  assert.deepEqual(
    planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["1:YES:b1", "3:NO:b3"],
  );
});

test("periodic fallback ranks by probability even when the top bracket has a wide spread", () => {
  // Real case: Shenzhen 26°C (57%) had a 6¢ spread > maxSpread 5¢; filtering it out
  // shifted rank-1 to 27°C and rank-3 to 28°C. Fallback ranking must stay
  // probability-based; the execution path may still report spread cost.
  const mk = (id, prob, spread) => ({
    id,
    city: "Shenzhen",
    bracket: id,
    eventId: "evt-sz",
    impliedProbability: prob,
    spread,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["26c", mk("26c", 0.575, 0.06)],
    ["27c", mk("27c", 0.215, 0.03)],
    ["25c", mk("25c", 0.16, 0.04)],
    ["28c", mk("28c", 0.0375, 0.023)],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05 }, execution: { fallbackMinTopGapPct: 0 } },
  };
  assert.deepEqual(
    planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["1:YES:26c", "3:NO:25c"],
  );
});

test("fallback candidates are not filtered by price band, liquidity or spread", () => {
  const mk = (id, prob, { liquidityUsd = 1000, spread = 0.01 } = {}) => ({
    id,
    city: "Alpha",
    bracket: id,
    eventId: "evt-fallback",
    impliedProbability: prob,
    liquidityUsd,
    spread,
    closed: false,
    acceptingOrders: true,
    tokens: { yesTokenId: `${id}-y`, noTokenId: `${id}-n` },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  });
  const markets = new Map([
    ["x1", mk("x1", 0.99, { liquidityUsd: 0, spread: 0.5 })],
    ["x2", mk("x2", 0.5)],
    ["x3", mk("x3", 0.01, { liquidityUsd: 0, spread: 0.4 })],
  ]);
  const run = {
    marketIds: [...markets.keys()],
    markets,
    portfolio: { positions: new Map() },
    config: { universe: { minPrice: 0.02, maxPrice: 0.98, maxSpread: 0.05, minLiquidityUsd: 500 } },
  };
  assert.deepEqual(
    planFallbackOrders(run).map((leg) => `${leg.rank}:${leg.outcome}:${leg.market.id}`),
    ["1:YES:x1", "3:NO:x3"],
  );
});

test("order-time checks reject low liquidity and wide spread (price/liquidity are not universe filters)", () => {
  const now = Date.now();
  const market = {
    id: "m-order",
    city: "Alpha",
    bracket: "1",
    endDate: new Date(now + 4 * 3600_000).toISOString(),
    tradingCutoff: new Date(now + 4 * 3600_000).toISOString(),
    negRisk: false,
    impliedProbability: 0.5,
    liquidityUsd: 100,
    spread: 0.01,
    stale: false,
    acceptingOrders: true,
    tokens: { yesTokenId: "m-order-y", noTokenId: "m-order-n" },
    quotes: {
      YES: { bid: 0.49, ask: 0.51, mid: 0.5, last: null },
      NO: { bid: 0.49, ask: 0.51, mid: 0.5, last: null },
    },
  };
  const run = {
    killSwitchTripped: false,
    status: "running",
    peakEquity: 100,
    dayStartEquity: 100,
    portfolio: { equity: () => 100, positions: new Map(), positionsForMarket: () => [] },
    config: {
      risk: { killSwitch: false, maxDrawdownPct: 20, dailyLossLimitUsd: 0 },
      universe: {
        minPrice: 0.02,
        maxPrice: 0.98,
        minLiquidityUsd: 500,
        maxSpread: 0.05,
        minTimeToResolutionSec: 300,
        maxTimeToResolutionSec: 86_400,
      },
      execution: { maxPositions: 5, maxPositionsPerMarket: 1 },
    },
  };
  const signal = { outcome: "YES" };

  const liquidityCheck = preRiskChecks(run, market, signal, now);
  assert.equal(liquidityCheck.reason, "liquidity_too_low");
  assert.match(liquidityCheck.detail, /流动性.*下限/);
  market.liquidityUsd = 1000;
  market.spread = 0.2;
  const spreadCheck = preRiskChecks(run, market, signal, now);
  assert.equal(spreadCheck.reason, "spread_too_wide");
  assert.match(spreadCheck.detail, /点差.*上限/);
  market.spread = 0.01;
  assert.equal(preRiskChecks(run, market, signal, now).ok, true);

  // With a live book, liquidity is checked against target-side executable asks,
  // not Gamma's aggregate liquidity field.
  const thinAskBook = {
    asks: [{ price: 0.51, size: 10 }],
    bids: [{ price: 0.49, size: 1000 }],
  };
  const thin = preRiskChecks(run, market, signal, now, { book: thinAskBook });
  assert.equal(thin.reason, "liquidity_too_low");
  assert.match(thin.detail, /可成交 YES ask 深度/);
});
