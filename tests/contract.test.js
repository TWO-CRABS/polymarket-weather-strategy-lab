/**
 * tests/contract.test.js — fee model + contract constants.
 *
 * Covers docs/04 AC-01/AC-02/AC-03 (fee model, rounding, symmetry, min fee)
 * and the enum/constant surface that docs/07 and both clients depend on.
 * Pure unit test: imports shared/contract.js only, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTRACT_VERSION,
  STRATEGY_VERSION,
  FEES,
  calcTakerFee,
  roundTo,
  centsToProb,
  probToCents,
  DEFAULT_STRATEGY,
  STRATEGY_PRESETS,
  LIMITS,
  RUN_MODES,
  RUN_STATUSES,
  PRICE_FIELDS,
  DIRECTIONS,
  SIZING_MODES,
  FILL_MODELS,
  OUTCOMES,
  TRADE_SIDES,
  EXIT_REASONS,
  REJECT_REASONS,
  SSE_EVENTS,
  EXIT_REASON_LABELS,
  REJECT_REASON_LABELS,
} from "../shared/contract.js";

/** docs/04 §5.3 / §7 AC-01 — 100 shares at the five official price points. */
const OFFICIAL_100_SHARE_VECTORS = Object.freeze([
  [0.05, 0.2375],
  [0.30, 1.05],
  [0.50, 1.25],
  [0.70, 1.05],
  [0.95, 0.2375],
]);

test("contract version and version constants match docs/07 §1", () => {
  assert.equal(CONTRACT_VERSION, "1.0.0");
  assert.equal(STRATEGY_VERSION, 1);
});

test("fee model constants match docs/04 §5.1 and docs/07 §6", () => {
  assert.equal(FEES.model, "weather_taker");
  assert.equal(FEES.feeType, "weather_fees");
  assert.equal(FEES.takerFeeRate, 0.05);
  assert.equal(FEES.makerFeeRate, 0);
  assert.equal(FEES.makerRebateRate, 0.25);
  assert.equal(FEES.feeDecimals, 5);
  assert.equal(FEES.exponent, 1);
  assert.equal(FEES.takerOnly, true);
  assert.equal(FEES.minFeeUsd, 0.00001);
  assert.ok(Object.isFrozen(FEES), "FEES must be frozen");
  // Taker-only: maker rebate must never be subtracted from the taker fee.
  assert.equal(FEES.makerFeeRate, 0);
});

test("AC-01: 100-share official fee vectors are exact (docs/04 §5.3)", () => {
  for (const [price, expected] of OFFICIAL_100_SHARE_VECTORS) {
    const fee = calcTakerFee(100, price);
    assert.equal(fee, expected, `100 shares @ ${price} => ${expected}, got ${fee}`);
  }
  // spot-check the raw formula for the 0.30 leg (float trap documented in §5.4)
  assert.equal(roundTo(100 * 0.05 * 0.3 * (1 - 0.3), 5), 1.05);
});

test("AC-01: fee scales linearly with shares", () => {
  assert.equal(calcTakerFee(1, 0.5), 0.0125);
  assert.equal(calcTakerFee(10, 0.5), 0.125);
  assert.equal(calcTakerFee(1_000, 0.5), 12.5);
  assert.equal(calcTakerFee(2_500, 0.30), 26.25);
});

test("AC-02: half-up 5dp rounding table (docs/04 §5.4)", () => {
  // 1 share @ 0.99: 0.000495 -> 0.00050
  assert.equal(calcTakerFee(1, 0.99), 0.0005);
  // 1 share @ 0.9999: 0.0000049995 -> below the minimum fee -> 0
  assert.equal(calcTakerFee(1, 0.9999), 0);
  // float trap: 100*0.05*0.3*0.7 must land on 1.05000, not 1.0500000000000003
  assert.equal(calcTakerFee(100, 0.3), 1.05);
  // every returned fee is representable with at most 5 decimal places
  for (const price of [0.013, 0.077, 0.123, 0.333, 0.499, 0.666, 0.777, 0.913, 0.987]) {
    const fee = calcTakerFee(37.37, price);
    const scaled = fee * 1e5;
    assert.ok(Math.abs(scaled - Math.round(scaled)) < 1e-6, `fee ${fee} has >5 dp`);
  }
});

test("AC-02: minimum non-zero fee — anything < 0.00001 is zero", () => {
  // exactly at the displayed precision but below minFeeUsd -> 0
  assert.equal(calcTakerFee(1, 0.9999), 0);
  assert.equal(calcTakerFee(0.0001, 0.5), 0);
  // 0.0005 shares @ 0.5 = 6.25e-6 raw -> rounds to the 0.00001 minimum
  assert.equal(calcTakerFee(0.0005, 0.5), 0.00001);
  // a genuinely tiny fee rounds to 0, never negative
  assert.equal(calcTakerFee(0.001, 0.5), 0.00001);
  assert.ok(calcTakerFee(0.001, 0.5) >= 0);
});

test("AC-01 symmetry: fee(p) === fee(1 - p) for equal shares", () => {
  const shares = [1, 13.37, 100, 250.5, 1_000];
  const prices = [0.01, 0.05, 0.1, 0.2, 0.3, 0.35, 0.5, 0.65, 0.7, 0.8, 0.9, 0.95, 0.99];
  for (const qty of shares) {
    for (const p of prices) {
      assert.equal(
        calcTakerFee(qty, p),
        calcTakerFee(qty, roundTo(1 - p, 6)),
        `fee symmetry broken for shares=${qty} p=${p}`,
      );
    }
  }
});

test("AC-03: fee always equals round5(shares * 0.05 * p * (1 - p))", () => {
  const cases = [
    [100, 0.21],
    [100, 0.24],
    [50, 0.62],
    [100, 0.71],
    [100, 0.66],
    [98.32, 0.245],
    [3.5, 0.05],
    [12.34, 0.987],
  ];
  for (const [shares, price] of cases) {
    const expected = roundTo(shares * 0.05 * price * (1 - price), 5);
    assert.equal(calcTakerFee(shares, price), expected, `fee formula mismatch for ${shares}@${price}`);
  }
  // fee uses the fill price (VWAP), not the mid — passing the mid yields a
  // different number whenever mid != price.
  assert.notEqual(calcTakerFee(100, 0.21), calcTakerFee(100, 0.20));
});

test("negative / zero / non-finite inputs are guarded to 0", () => {
  const badShares = [0, -1, -100.5, NaN, Infinity, -Infinity];
  for (const shares of badShares) {
    assert.equal(calcTakerFee(shares, 0.5), 0, `bad shares ${shares}`);
  }
  const badPrices = [NaN, Infinity, -Infinity];
  for (const price of badPrices) {
    assert.equal(calcTakerFee(100, price), 0, `bad price ${price}`);
  }
  // out-of-range prices are clamped into [0,1] where the formula is 0 anyway
  assert.equal(calcTakerFee(100, -0.5), 0);
  assert.equal(calcTakerFee(100, 1.5), 0);
  assert.equal(calcTakerFee(100, 0), 0);
  assert.equal(calcTakerFee(100, 1), 0);
  assert.equal(calcTakerFee(100, 0.5, NaN), 0);
});

test("calcTakerFee accepts an explicit rate (fallback = FEES.takerFeeRate)", () => {
  assert.equal(calcTakerFee(100, 0.5, 0.1), 2.5);
  assert.equal(calcTakerFee(100, 0.5, FEES.takerFeeRate), calcTakerFee(100, 0.5));
  assert.equal(calcTakerFee(100, 0.5, 0), 0);
});

test("roundTo is half-up at the requested precision", () => {
  assert.equal(roundTo(1.0500000000000003, 5), 1.05);
  assert.equal(roundTo(0.23750000000000002, 5), 0.2375);
  assert.equal(roundTo(1.005, 2), 1.01);
  assert.equal(roundTo(2.5, 0), 3);
  assert.equal(roundTo(1.23456, 4), 1.2346);
  assert.equal(roundTo(1.23454, 4), 1.2345);
  assert.equal(roundTo(NaN, 5), 0);
  assert.equal(roundTo(Infinity, 5), 0);
});

test("cents <-> probability conversions round-trip", () => {
  for (const cents of [1, 5, 30, 31, 50, 70, 95, 99]) {
    assert.equal(centsToProb(cents), roundTo(cents / 100, 6));
    assert.equal(probToCents(centsToProb(cents)), cents);
  }
  assert.equal(centsToProb(31), 0.31);
  assert.equal(probToCents(0.31), 31);
});

test("docs/07 §3 entity enums are exactly the documented sets", () => {
  assert.deepEqual([...RUN_MODES], ["live", "replay"]);
  assert.deepEqual([...PRICE_FIELDS], ["mid", "last", "best_bid", "best_ask"]);
  assert.deepEqual([...DIRECTIONS], ["up", "down", "both"]);
  assert.deepEqual([...SIZING_MODES], ["fixed_stake", "pct_equity"]);
  assert.deepEqual([...FILL_MODELS], ["book_walk"]);
  assert.deepEqual([...OUTCOMES], ["YES", "NO"]);
  assert.deepEqual([...TRADE_SIDES], ["BUY", "SELL"]);
  assert.deepEqual(
    [...RUN_STATUSES],
    ["created", "starting", "running", "paused", "stopping", "stopped", "ended", "error"],
  );
  for (const reason of [
    "take_profit", "stop_loss", "max_hold", "opposite_signal", "hold_to_resolution",
    "resolution", "manual", "risk_kill_switch",
  ]) {
    assert.ok(EXIT_REASONS.includes(reason), `EXIT_REASONS missing ${reason}`);
    assert.ok(EXIT_REASON_LABELS[reason], `EXIT_REASON_LABELS missing ${reason}`);
  }
  for (const reason of [
    "no_liquidity", "spread_too_wide", "below_min_order", "insufficient_cash",
    "max_positions", "max_positions_per_market", "market_not_accepting_orders",
    "stale_market", "risk_blocked", "unknown",
  ]) {
    assert.ok(REJECT_REASONS.includes(reason), `REJECT_REASONS missing ${reason}`);
    assert.ok(REJECT_REASON_LABELS[reason], `REJECT_REASON_LABELS missing ${reason}`);
  }
});

test("SSE_EVENTS covers docs/07 §5 event table", () => {
  const documented = [
    "hello", "meta", "market", "markets", "signal", "trade", "positions",
    "equity", "metrics", "run", "feed", "log", "heartbeat",
  ];
  for (const event of documented) {
    assert.ok(SSE_EVENTS.includes(event), `SSE_EVENTS missing ${event}`);
  }
  assert.equal(new Set(SSE_EVENTS).size, SSE_EVENTS.length, "SSE_EVENTS has duplicates");
});

test("default strategy + presets are structurally complete and frozen", () => {
  for (const group of ["universe", "signal", "execution", "exit", "risk", "fees", "sim"]) {
    assert.ok(DEFAULT_STRATEGY[group] && typeof DEFAULT_STRATEGY[group] === "object", `missing ${group}`);
  }
  assert.equal(STRATEGY_PRESETS.length, 1);
  assert.deepEqual(
    STRATEGY_PRESETS.map((p) => p.id),
    ["no-price-band"],
  );
  for (const preset of STRATEGY_PRESETS) {
    assert.ok(preset.label && preset.description, `preset ${preset.id} needs label/description`);
    assert.equal(preset.config.fees.takerFeeRate, FEES.takerFeeRate);
  }
  assert.equal(STRATEGY_PRESETS[0].config.signal.entryMode, "price_band");
  assert.equal(STRATEGY_PRESETS[0].config.signal.onlyLeftmostInEvent, true);
  assert.equal(STRATEGY_PRESETS[0].config.signal.direction, "down");
  assert.deepEqual(STRATEGY_PRESETS[0].config.signal.entryPriceByOutcome.NO, { min: 0.89, max: 0.98 });
  assert.equal(STRATEGY_PRESETS[0].config.exit.targetPriceByOutcome.NO, 0.99);
});
