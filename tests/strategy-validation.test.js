/**
 * tests/strategy-validation.test.js — shared/contract.js strategy schema.
 *
 * Covers docs/03 §1 (schema), §9 (presets) and §10 items 1/5/18 (validation
 * behaviour), plus docs/04 AC-11 (warnings must be non-blocking).
 * Pure unit test: imports shared/contract.js only, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STRATEGY,
  STRATEGY_PRESETS,
  LIMITS,
  clone,
  normalizeStrategy,
  validateStrategy,
} from "../shared/contract.js";

/** Build a valid default config and apply a patch. */
function cfg(patch = {}) {
  return clone({ ...DEFAULT_STRATEGY, ...patch });
}

/** Assert a patch makes validation fail and mentions the expected field fragment. */
function expectInvalid(patch, fragment) {
  const result = validateStrategy(patch);
  assert.equal(result.valid, false, `expected invalid for ${JSON.stringify(fragment)}`);
  assert.ok(result.errors.length > 0, "expected at least one error");
  assert.ok(
    result.errors.some((message) => message.includes(fragment)),
    `errors should mention "${fragment}" but were: ${JSON.stringify(result.errors)}`,
  );
  return result;
}

function patchSignal(patch) {
  return { signal: { ...clone(DEFAULT_STRATEGY.signal), ...patch } };
}
function patchUniverse(patch) {
  return { universe: { ...clone(DEFAULT_STRATEGY.universe), ...patch } };
}
function patchExecution(patch) {
  return { execution: { ...clone(DEFAULT_STRATEGY.execution), ...patch } };
}
function patchExit(patch) {
  return { exit: { ...clone(DEFAULT_STRATEGY.exit), ...patch } };
}
function patchRisk(patch) {
  return { risk: { ...clone(DEFAULT_STRATEGY.risk), ...patch } };
}
function patchFees(patch) {
  return { fees: { ...clone(DEFAULT_STRATEGY.fees), ...patch } };
}
function patchSim(patch) {
  return { sim: { ...clone(DEFAULT_STRATEGY.sim), ...patch } };
}

test("default strategy is valid with no errors and normalized to itself", () => {
  const result = validateStrategy();
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.normalized, clone(DEFAULT_STRATEGY));
});

test("normalizeStrategy fills defaults and coerces numeric strings", () => {
  const normalized = normalizeStrategy({
    signal: { windowSec: "90", moveThresholdPct: "15.5", minAbsMove: "0.02" },
    execution: { sizingValue: "35" },
    sim: { speed: "20" },
  });
  assert.equal(normalized.signal.windowSec, 90);
  assert.equal(normalized.signal.moveThresholdPct, 15.5);
  assert.equal(normalized.signal.minAbsMove, 0.02);
  assert.equal(normalized.execution.sizingValue, 35);
  assert.equal(normalized.sim.speed, 20);
  // untouched groups keep their defaults
  assert.equal(normalized.risk.bankrollUsd, DEFAULT_STRATEGY.risk.bankrollUsd);
  assert.equal(normalized.exit.takeProfitPct, DEFAULT_STRATEGY.exit.takeProfitPct);
  assert.equal(normalized.version, 1);
});

test("removed universe fields are dropped for backward compatibility", () => {
  const normalized = normalizeStrategy({
    universe: { cities: ["London"], maxMarkets: 8, selectionMode: "per_event" },
  });
  assert.equal(normalized.universe.cities.length, 1);
  assert.ok(!("maxMarkets" in normalized.universe), "maxMarkets must be ignored/removed");
  assert.ok(!("selectionMode" in normalized.universe), "selectionMode must be ignored/removed");
});

test("signal.recordObservation defaults true and preserves explicit false", () => {
  assert.equal(normalizeStrategy({}).signal.recordObservation, true);
  assert.equal(normalizeStrategy({ signal: { recordObservation: false } }).signal.recordObservation, false);
  assert.equal(normalizeStrategy({ signal: { recordObservation: "false" } }).signal.recordObservation, false);
});

test("normalizeStrategy trims city list and keeps it an array", () => {
  const normalized = normalizeStrategy({
    universe: { cities: [" New York ", "London", "", "  "] },
  });
  assert.deepEqual(normalized.universe.cities, ["New York", "London"]);
  const bad = normalizeStrategy({ universe: { cities: "New York" } });
  assert.deepEqual(bad.universe.cities, []);
});

test("normalizeStrategy never throws on garbage input", () => {
  for (const input of [undefined, null, 42, "strategy", [], { signal: null }, { universe: 7 }]) {
    const result = validateStrategy(input);
    assert.equal(typeof result.valid, "boolean");
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
    assert.ok(result.normalized && typeof result.normalized === "object");
  }
});

test("version must be 1 (numeric strings allowed) — docs/03 §1.1", () => {
  const bad = validateStrategy({ version: 2 });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((message) => message.includes("version")));
  assert.equal(bad.normalized.version, 2);

  const good = validateStrategy({ version: "1" });
  assert.equal(good.valid, true);
  assert.equal(good.normalized.version, 1);

  const missing = validateStrategy({});
  assert.equal(missing.valid, true);
  assert.equal(missing.normalized.version, 1);

  const garbage = validateStrategy({ version: "v1" });
  assert.equal(garbage.valid, false);
});

test("out-of-range signal limits produce errors (docs/03 §1.1)", () => {
  expectInvalid(patchSignal({ windowSec: 9 }), "signal.windowSec");
  expectInvalid(patchSignal({ windowSec: 3601 }), "signal.windowSec");
  expectInvalid(patchSignal({ moveThresholdPct: 0 }), "signal.moveThresholdPct");
  expectInvalid(patchSignal({ moveThresholdPct: 501 }), "signal.moveThresholdPct");
  expectInvalid(patchSignal({ minAbsMove: -0.01 }), "signal.minAbsMove");
  expectInvalid(patchSignal({ minAbsMove: 0.51 }), "signal.minAbsMove");
  expectInvalid(patchSignal({ confirmationTicks: 0 }), "signal.confirmationTicks");
  expectInvalid(patchSignal({ confirmationTicks: 31 }), "signal.confirmationTicks");
  expectInvalid(patchSignal({ cooldownSec: -1 }), "signal.cooldownSec");
  expectInvalid(patchSignal({ cooldownSec: 86_401 }), "signal.cooldownSec");
  expectInvalid(patchSignal({ maxSignalsPerMarket: 0 }), "signal.maxSignalsPerMarket");
  expectInvalid(patchSignal({ maxSignalsPerMarket: 101 }), "signal.maxSignalsPerMarket");
});

test("out-of-range universe limits produce errors", () => {
  expectInvalid(patchUniverse({ minPrice: 0.00001 }), "universe.minPrice");
  expectInvalid(patchUniverse({ minPrice: 0.6 }), "universe.minPrice");
  expectInvalid(patchUniverse({ maxPrice: 0.4 }), "universe.maxPrice");
  expectInvalid(patchUniverse({ maxPrice: 1.0 }), "universe.maxPrice");
  expectInvalid(patchUniverse({ minLiquidityUsd: -1 }), "universe.minLiquidityUsd");
  expectInvalid(patchUniverse({ maxSpread: 0 }), "universe.maxSpread");
  expectInvalid(patchUniverse({ maxSpread: 0.3 }), "universe.maxSpread");
  expectInvalid(patchUniverse({ minTimeToResolutionSec: 299 }), "universe.minTimeToResolutionSec");
  expectInvalid(patchUniverse({ maxTimeToResolutionSec: 3_000 }), "universe.maxTimeToResolutionSec");
});

test("out-of-range execution / exit / risk / fees / sim limits produce errors", () => {
  expectInvalid(patchExecution({ sizingValue: 0 }), "execution.sizingValue");
  expectInvalid(patchExecution({ sizingValue: 100_001 }), "execution.sizingValue");
  expectInvalid(patchExecution({ maxPositionUsd: 0 }), "execution.maxPositionUsd");
  expectInvalid(patchExecution({ maxPositions: 0 }), "execution.maxPositions");
  expectInvalid(patchExecution({ maxPositions: 10_001 }), "execution.maxPositions");
  expectInvalid(patchExecution({ maxPositionsPerMarket: 0 }), "execution.maxPositionsPerMarket");
  expectInvalid(patchExecution({ maxPositionsPerMarket: 11 }), "execution.maxPositionsPerMarket");
  expectInvalid(patchExecution({ slippageBufferBps: -1 }), "execution.slippageBufferBps");
  expectInvalid(patchExecution({ slippageBufferBps: 1001 }), "execution.slippageBufferBps");

  expectInvalid(patchExit({ takeProfitPct: 0 }), "exit.takeProfitPct");
  expectInvalid(patchExit({ takeProfitPct: 1001 }), "exit.takeProfitPct");
  expectInvalid(patchExit({ stopLossPct: 0 }), "exit.stopLossPct");
  expectInvalid(patchExit({ maxHoldSec: 9 }), "exit.maxHoldSec");
  expectInvalid(patchExit({ maxHoldSec: 604_801 }), "exit.maxHoldSec");

  expectInvalid(patchRisk({ bankrollUsd: 9 }), "risk.bankrollUsd");
  expectInvalid(patchRisk({ maxDrawdownPct: 0 }), "risk.maxDrawdownPct");
  expectInvalid(patchRisk({ maxDrawdownPct: 101 }), "risk.maxDrawdownPct");
  expectInvalid(patchRisk({ dailyLossLimitUsd: -1 }), "risk.dailyLossLimitUsd");

  expectInvalid(patchFees({ takerFeeRate: -0.01 }), "fees.takerFeeRate");
  expectInvalid(patchFees({ takerFeeRate: 0.21 }), "fees.takerFeeRate");

  expectInvalid(patchSim({ tickIntervalMs: 100 }), "sim.tickIntervalMs");
  expectInvalid(patchSim({ tickIntervalMs: 60_001 }), "sim.tickIntervalMs");
  expectInvalid(patchSim({ replayLookbackMin: 4 }), "sim.replayLookbackMin");
  expectInvalid(patchSim({ replayLookbackMin: 1_441 }), "sim.replayLookbackMin");
  expectInvalid(patchSim({ speed: 0 }), "sim.speed");
  expectInvalid(patchSim({ speed: 101 }), "sim.speed");
});

test("invalid enum values produce errors (docs/07 §2, docs/03 §1.1)", () => {
  expectInvalid(patchSignal({ priceField: "vwap" }), "signal.priceField");
  expectInvalid(patchSignal({ direction: "sideways" }), "signal.direction");
  expectInvalid(patchExecution({ sizingMode: "kelly" }), "execution.sizingMode");
  expectInvalid(patchSim({ mode: "paper" }), "sim.mode");
});

test("cross-field consistency: price band, time-to-resolution window, stake vs bankroll", () => {
  expectInvalid(patchUniverse({ minPrice: 0.6, maxPrice: 0.4 }), "universe.minPrice");
  expectInvalid(
    patchUniverse({ minTimeToResolutionSec: 604_800, maxTimeToResolutionSec: 3_600 }),
    "universe.minTimeToResolutionSec",
  );

  // fixed_stake above the bankroll is a hard error
  const tooBig = validateStrategy({
    execution: { ...clone(DEFAULT_STRATEGY.execution), sizingMode: "fixed_stake", sizingValue: 2_000 },
    risk: { ...clone(DEFAULT_STRATEGY.risk), bankrollUsd: 1_000 },
  });
  assert.equal(tooBig.valid, false);
  assert.ok(tooBig.errors.some((message) => message.includes("单笔固定金额不能大于初始资金")));

  // pct_equity > 50% only warns
  const pct = validateStrategy({
    execution: { ...clone(DEFAULT_STRATEGY.execution), sizingMode: "pct_equity", sizingValue: 60 },
  });
  assert.equal(pct.valid, true);
  assert.ok(pct.warnings.some((message) => message.includes("50%")));
});

test("degenerate-config warnings are non-blocking (docs/04 §5.10, AC-11)", () => {
  const cases = [
    [patchUniverse({ minPrice: 0.005 }), "universe.minPrice"],
    [patchSignal({ moveThresholdPct: 20, minAbsMove: 0 }), "百分比阈值"],
    [patchSignal({ priceField: "last" }), "last"],
    [patchUniverse({ maxSpread: 0.1 }), "点差"],
    [patchExit({ stopLossPct: 90 }), "止损"],
    [patchRisk({ maxDrawdownPct: 3, killSwitch: true }), "熔断"],
    [patchExecution({ sizingMode: "pct_equity", sizingValue: 60 }), "50%"],
  ];
  for (const [patch, fragment] of cases) {
    const result = validateStrategy(patch);
    assert.equal(result.valid, true, `warning case must stay valid: ${fragment}`);
    assert.ok(
      result.warnings.some((message) => message.includes(fragment)),
      `expected warning about "${fragment}", got ${JSON.stringify(result.warnings)}`,
    );
  }
});

test("replay lookback shorter than the signal window is an error (docs/03 §1.1)", () => {
  // 5 min lookback cannot serve a 3600s (60 min) rolling window
  const result = expectInvalid(
    {
      ...patchSignal({ windowSec: 3_600 }),
      ...patchSim({ mode: "replay", replayLookbackMin: 5 }),
    },
    "回放窗口",
  );
  assert.equal(result.valid, false);

  // lookback 60 min with a 60s window is fine
  const ok = validateStrategy({
    ...patchSignal({ windowSec: 60 }),
    ...patchSim({ mode: "replay", replayLookbackMin: 60 }),
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.errors, []);
});

test("all bounds are inclusive at the LIMITS edges", () => {
  const minConfig = {
    universe: {
      ...clone(DEFAULT_STRATEGY.universe),
      minPrice: LIMITS.universe.minPrice[0],
      maxPrice: LIMITS.universe.maxPrice[0],
      minLiquidityUsd: LIMITS.universe.minLiquidityUsd[0],
      maxSpread: LIMITS.universe.maxSpread[0],
      minTimeToResolutionSec: LIMITS.universe.minTimeToResolutionSec[0],
      maxTimeToResolutionSec: LIMITS.universe.maxTimeToResolutionSec[0],
    },
    signal: {
      ...clone(DEFAULT_STRATEGY.signal),
      windowSec: LIMITS.signal.windowSec[0],
      moveThresholdPct: LIMITS.signal.moveThresholdPct[0],
      minAbsMove: LIMITS.signal.minAbsMove[0],
      confirmationTicks: LIMITS.signal.confirmationTicks[0],
      cooldownSec: LIMITS.signal.cooldownSec[0],
      maxSignalsPerMarket: LIMITS.signal.maxSignalsPerMarket[0],
    },
    execution: {
      ...clone(DEFAULT_STRATEGY.execution),
      sizingValue: LIMITS.execution.sizingValue[0],
      maxPositionUsd: LIMITS.execution.maxPositionUsd[0],
      maxPositions: LIMITS.execution.maxPositions[0],
      maxPositionsPerMarket: LIMITS.execution.maxPositionsPerMarket[0],
      slippageBufferBps: LIMITS.execution.slippageBufferBps[0],
    },
    exit: {
      ...clone(DEFAULT_STRATEGY.exit),
      takeProfitPct: LIMITS.exit.takeProfitPct[0],
      stopLossPct: LIMITS.exit.stopLossPct[0],
      maxHoldSec: LIMITS.exit.maxHoldSec[0],
    },
    risk: {
      ...clone(DEFAULT_STRATEGY.risk),
      bankrollUsd: LIMITS.risk.bankrollUsd[0],
      maxDrawdownPct: LIMITS.risk.maxDrawdownPct[0],
      dailyLossLimitUsd: LIMITS.risk.dailyLossLimitUsd[0],
    },
    fees: { ...clone(DEFAULT_STRATEGY.fees), takerFeeRate: LIMITS.fees.takerFeeRate[0] },
    sim: {
      ...clone(DEFAULT_STRATEGY.sim),
      tickIntervalMs: LIMITS.sim.tickIntervalMs[0],
      replayLookbackMin: LIMITS.sim.replayLookbackMin[0],
      speed: LIMITS.sim.speed[0],
    },
  };
  // fixed_stake sizingValue must not exceed the bankroll
  minConfig.execution.sizingMode = "fixed_stake";
  minConfig.execution.sizingValue = Math.min(minConfig.execution.sizingValue, minConfig.risk.bankrollUsd);
  const minResult = validateStrategy(minConfig);
  assert.equal(minResult.valid, true, `min-edge config invalid: ${JSON.stringify(minResult.errors)}`);

  const maxConfig = {
    universe: {
      ...clone(DEFAULT_STRATEGY.universe),
      minPrice: LIMITS.universe.minPrice[1],
      maxPrice: LIMITS.universe.maxPrice[1],
      minLiquidityUsd: LIMITS.universe.minLiquidityUsd[1],
      maxSpread: LIMITS.universe.maxSpread[1],
      minTimeToResolutionSec: LIMITS.universe.minTimeToResolutionSec[1],
      maxTimeToResolutionSec: LIMITS.universe.maxTimeToResolutionSec[1],
    },
    signal: {
      ...clone(DEFAULT_STRATEGY.signal),
      windowSec: LIMITS.signal.windowSec[1],
      moveThresholdPct: LIMITS.signal.moveThresholdPct[1],
      minAbsMove: LIMITS.signal.minAbsMove[1],
      confirmationTicks: LIMITS.signal.confirmationTicks[1],
      cooldownSec: LIMITS.signal.cooldownSec[1],
      maxSignalsPerMarket: LIMITS.signal.maxSignalsPerMarket[1],
    },
    execution: {
      ...clone(DEFAULT_STRATEGY.execution),
      sizingValue: LIMITS.execution.sizingValue[1],
      maxPositionUsd: LIMITS.execution.maxPositionUsd[1],
      maxPositions: LIMITS.execution.maxPositions[1],
      maxPositionsPerMarket: LIMITS.execution.maxPositionsPerMarket[1],
      slippageBufferBps: LIMITS.execution.slippageBufferBps[1],
    },
    exit: {
      ...clone(DEFAULT_STRATEGY.exit),
      takeProfitPct: LIMITS.exit.takeProfitPct[1],
      stopLossPct: LIMITS.exit.stopLossPct[1],
      maxHoldSec: LIMITS.exit.maxHoldSec[1],
    },
    risk: {
      ...clone(DEFAULT_STRATEGY.risk),
      bankrollUsd: LIMITS.risk.bankrollUsd[1],
      maxDrawdownPct: LIMITS.risk.maxDrawdownPct[1],
      dailyLossLimitUsd: LIMITS.risk.dailyLossLimitUsd[1],
    },
    fees: { ...clone(DEFAULT_STRATEGY.fees), takerFeeRate: LIMITS.fees.takerFeeRate[1] },
    sim: {
      ...clone(DEFAULT_STRATEGY.sim),
      tickIntervalMs: LIMITS.sim.tickIntervalMs[1],
      replayLookbackMin: LIMITS.sim.replayLookbackMin[1],
      speed: LIMITS.sim.speed[1],
    },
  };
  const maxResult = validateStrategy(maxConfig);
  assert.equal(maxResult.valid, true, `max-edge config invalid: ${JSON.stringify(maxResult.errors)}`);
});

test("STRATEGY_PRESETS are all valid and match docs/03 §9 parameter table", () => {
  const byId = Object.fromEntries(STRATEGY_PRESETS.map((preset) => [preset.id, preset]));

  for (const preset of STRATEGY_PRESETS) {
    const result = validateStrategy(preset.config);
    assert.equal(result.valid, true, `preset ${preset.id} invalid: ${JSON.stringify(result.errors)}`);
    assert.deepEqual(result.errors, []);
    assert.equal(result.normalized.version, 1);
    assert.equal(preset.config.exit.holdToResolution, false, "presets must let TP/SL work");
  }

  const noBand = byId["no-price-band"].config;
  assert.equal(noBand.signal.entryMode, "price_band");
  assert.equal(noBand.signal.onlyLeftSideOfMaxProbability, true);
  assert.equal(noBand.signal.direction, "down");
  assert.deepEqual(noBand.signal.entryPriceByOutcome.NO, { min: 0.89, max: 0.98 });
  assert.equal(noBand.exit.targetPriceByOutcome.NO, 0.99);
  assert.equal(noBand.universe.minPrice, 0.01);
  assert.equal(noBand.universe.maxPrice, 0.99);
  assert.equal(noBand.execution.sizingValue, 25);
  assert.equal(noBand.execution.maxPositions, 100);

  const nodeTempNo = byId["node-temp-no"].config;
  assert.equal(nodeTempNo.signal.entryMode, "node_temp_no");
  assert.equal(nodeTempNo.signal.entryPriceByOutcome.NO.max, 0.999);
  assert.equal(nodeTempNo.execution.maxPositions, 500);
  assert.equal(nodeTempNo.exit.targetPriceByOutcome.NO, 1);
});

test("every LIMITS entry is a sane [min, max] pair", () => {
  for (const [group, limits] of Object.entries(LIMITS)) {
    for (const [field, pair] of Object.entries(limits)) {
      assert.ok(Array.isArray(pair) && pair.length === 2, `${group}.${field} must be [min,max]`);
      const [min, max] = pair;
      assert.equal(typeof min, "number");
      assert.equal(typeof max, "number");
      assert.ok(min <= max, `${group}.${field}: min ${min} > max ${max}`);
    }
  }
});
