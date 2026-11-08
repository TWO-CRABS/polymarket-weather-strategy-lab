/**
 * tests/selection.test.js
 *
 * universe.selectionMode 选市场方式：
 *  - per_market（默认）：按流动性取前 N 个市场，可能拆散城市事件；
 *  - per_event：按城市/日期事件整组纳入，容量不足时跳过整组，不拆事件；
 *    这样城市内概率排名（兜底的第 1/第 3 高）才是真实排名。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { RunManager } from "../server/engine/runManager.js";
import { DEFAULT_STRATEGY, clone, normalizeStrategy } from "../shared/contract.js";

const NOW = Date.now();

function makeMarket(id, eventId, city, impliedProbability, liquidityUsd = 1000) {
  const endDate = new Date(NOW + 2 * 3600_000).toISOString();
  return {
    id,
    eventId,
    conditionId: `0x${id}`,
    eventStartTime: endDate,
    endDate,
    city,
    station: `${city}-ST`,
    bracket: id,
    question: `Will ${city} be ${id}?`,
    tokens: { yesTokenId: `${id}-yes`, noTokenId: `${id}-no` },
    impliedProbability,
    liquidityUsd,
    volume24hUsd: liquidityUsd,
    spread: 0.01,
    acceptingOrders: true,
    closed: false,
    tickSize: 0.001,
    minOrderShares: 5,
    feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
    quotes: {
      YES: { bid: impliedProbability - 0.01, ask: impliedProbability + 0.01, mid: impliedProbability, last: null },
      NO: { bid: 1 - impliedProbability - 0.01, ask: 1 - impliedProbability + 0.01, mid: 1 - impliedProbability, last: null },
    },
  };
}

function makeManager(markets) {
  const discovery = {
    onRefresh() {},
    getCandidateMarkets() {
      return markets;
    },
  };
  return new RunManager({
    store: {},
    sse: { broadcast() {}, log() {} },
    discovery,
    feed: {},
    clob: {},
    config: { replayFixture: null },
    log() {},
  });
}

function makeConfig(overrides = {}) {
  return normalizeStrategy({
    ...clone(DEFAULT_STRATEGY),
    universe: {
      ...clone(DEFAULT_STRATEGY.universe),
      maxMarkets: 12,
      minPrice: 0.02,
      maxPrice: 0.98,
      minLiquidityUsd: 0,
      maxSpread: 0.2,
      minTimeToResolutionSec: 300,
      maxTimeToResolutionSec: 1_209_600,
      ...overrides,
    },
  });
}

function buildMarkets() {
  const alpha = [0.8, 0.5, 0.3].map((p, i) => makeMarket(`a${i}`, "evt-alpha", "Alpha", p, 1000));
  const beta = [0.6, 0.5, 0.4].map((p, i) => makeMarket(`b${i}`, "evt-beta", "Beta", p, 500));
  const gamma = [0.4, 0.3, 0.2].map((p, i) => makeMarket(`g${i}`, "evt-gamma", "Gamma", p, 100));
  return [...alpha, ...beta, ...gamma];
}

test("per_event keeps each city/date event complete and skips groups that do not fit", () => {
  const manager = makeManager(buildMarkets());

  const full = manager.selectMarkets(makeConfig({ selectionMode: "per_event", maxMarkets: 9 }), "live");
  assert.equal(full.length, 9);
  assert.deepEqual(
    [...new Set(full.map((market) => market.eventId))].sort(),
    ["evt-alpha", "evt-beta", "evt-gamma"],
  );
  for (const eventId of ["evt-alpha", "evt-beta", "evt-gamma"]) {
    assert.equal(full.filter((market) => market.eventId === eventId).length, 3, `${eventId} must be complete`);
  }

  // Only one full event fits in 4 slots: pick Alpha (highest aggregate liquidity),
  // never split Beta across the boundary.
  const one = manager.selectMarkets(makeConfig({ selectionMode: "per_event", maxMarkets: 4 }), "live");
  assert.equal(one.length, 3);
  assert.ok(one.every((market) => market.eventId === "evt-alpha"));
});

test("per_event includes every open bracket of an eligible event even if it fails per-market filters", () => {
  const markets = buildMarkets();
  const outOfBand = markets.find((market) => market.id === "a1");
  outOfBand.impliedProbability = 0.99; // fails universe price band (maxPrice 0.98)

  const manager = makeManager(markets);
  const perEvent = manager.selectMarkets(makeConfig({ selectionMode: "per_event", maxMarkets: 9 }), "live");
  assert.ok(perEvent.some((market) => market.id === "a1"), "per_event must keep the full event bracket set");
  assert.equal(perEvent.filter((market) => market.eventId === "evt-alpha").length, 3);

  // per_market keeps the legacy per-market filter: a1 is excluded.
  const perMarket = manager.selectMarkets(makeConfig({ selectionMode: "per_market", maxMarkets: 9 }), "live");
  assert.ok(!perMarket.some((market) => market.id === "a1"));
});

test("per_market keeps the legacy top-N-by-liquidity behavior (may split events)", () => {
  const manager = makeManager(buildMarkets());
  const picked = manager.selectMarkets(makeConfig({ selectionMode: "per_market", maxMarkets: 4 }), "live");
  assert.equal(picked.length, 4);
  // Markets are sorted by liquidity/volume: a0..a2 (1000) come before b* (500).
  const events = new Set(picked.map((market) => market.eventId));
  assert.ok(events.has("evt-alpha"));
});
