/**
 * tests/selection.test.js
 *
 * 新选市场语义：
 *  - live 只选当天（UTC 观察日）市场；
 *  - 按城市事件纳入全部可交易括号，不按价格/流动性/点差过滤，不设数量上限；
 *  - 城市多选、TTR 窗口仍生效。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { RunManager } from "../server/engine/runManager.js";
import { DEFAULT_STRATEGY, clone, normalizeStrategy } from "../shared/contract.js";
import { cityLocalDateKey } from "../shared/cityTimezones.js";
import { utcDateKey } from "../server/util.js";

function makeMarket({ id, eventId, city, bracket, dateKey, impliedProbability = 0.5, liquidityUsd = 1000, spread = 0.01, tradingCutoff = null }) {
  const endDate = `${dateKey}T12:00:00.000Z`;
  return {
    id,
    eventId,
    conditionId: `0x${id}`,
    eventStartTime: endDate,
    endDate,
    tradingCutoff: tradingCutoff || undefined,
    city,
    station: `${city}-ST`,
    bracket: bracket || id,
    question: `Will ${city} be ${bracket || id}?`,
    tokens: { yesTokenId: `${id}-yes`, noTokenId: `${id}-no` },
    impliedProbability,
    liquidityUsd,
    volume24hUsd: liquidityUsd,
    spread,
    acceptingOrders: true,
    closed: false,
    negRisk: true,
    tickSize: 0.001,
    minOrderShares: 5,
    feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
    quotes: {
      YES: { bid: Math.max(0, impliedProbability - 0.01), ask: impliedProbability + 0.01, mid: impliedProbability, last: null },
      NO: { bid: Math.max(0, 1 - impliedProbability - 0.01), ask: 1 - impliedProbability + 0.01, mid: 1 - impliedProbability, last: null },
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
      minPrice: 0.02,
      maxPrice: 0.98,
      minLiquidityUsd: 500,
      maxSpread: 0.03,
      minTimeToResolutionSec: 300,
      maxTimeToResolutionSec: 1_209_600,
      ...overrides,
    },
  });
}

const TODAY = utcDateKey();
const TOMORROW = utcDateKey(Date.now() + 24 * 3600_000);

test("live selection is today-only, full-event, no quantity cap and no per-market filters", () => {
  const markets = [];
  // 3 events today: Alpha/Beta/Gamma; include extreme price/liq/spread brackets
  for (const [city, eventId, probs] of [
    ["Alpha", "evt-alpha", [0.99, 0.5, 0.0005]],
    ["Beta", "evt-beta", [0.7, 0.2]],
    ["Gamma", "evt-gamma", [0.6, 0.3, 0.1]],
  ]) {
    probs.forEach((prob, i) => {
      markets.push(
        makeMarket({
          id: `${eventId}-${i}`,
          eventId,
          city,
          bracket: `${i}`,
          dateKey: TODAY,
          impliedProbability: prob,
          liquidityUsd: i === 0 ? 0 : 1000,
          spread: i === 0 ? 0.2 : 0.01,
        }),
      );
    });
  }
  markets.push(makeMarket({ id: "tomorrow-1", eventId: "evt-tomorrow", city: "Alpha", bracket: "T", dateKey: TOMORROW }));

  const manager = makeManager(markets);
  const picked = manager.selectMarkets(makeConfig(), "live", { dateKey: TODAY });
  assert.equal(picked.length, 8, "all today's event brackets included, no maxMarkets cap");
  assert.ok(!picked.some((market) => market.id === "tomorrow-1"), "tomorrow must be excluded");
  assert.ok(picked.some((market) => market.impliedProbability > 0.98), "price band must NOT filter selection");
  assert.ok(picked.some((market) => market.liquidityUsd === 0), "liquidity must NOT filter selection");
  assert.ok(picked.some((market) => market.spread > 0.03), "spread must NOT filter selection");
});

test("city multi-select restricts events; empty cities = all", () => {
  const markets = [
    makeMarket({ id: "a1", eventId: "evt-a", city: "Alpha", bracket: "1", dateKey: TODAY }),
    makeMarket({ id: "a2", eventId: "evt-a", city: "Alpha", bracket: "2", dateKey: TODAY }),
    makeMarket({ id: "b1", eventId: "evt-b", city: "Beta", bracket: "1", dateKey: TODAY }),
  ];
  const manager = makeManager(markets);
  const selected = manager.selectMarkets(makeConfig({ cities: ["Alpha"] }), "live", { dateKey: TODAY });
  assert.deepEqual(selected.map((market) => market.id).sort(), ["a1", "a2"]);
  const all = manager.selectMarkets(makeConfig({ cities: [] }), "live", { dateKey: TODAY });
  assert.equal(all.length, 3);
});

test("live selection follows each city's current local observation day", () => {
  const now = Date.now();
  const at = new Date(now);
  const laDate = cityLocalDateKey("Los Angeles", at);
  const szDate = cityLocalDateKey("Shenzhen", at);
  const la = makeMarket({
    id: "la-local",
    eventId: "evt-la",
    city: "Los Angeles",
    bracket: "1",
    dateKey: laDate,
    tradingCutoff: new Date(now + 3600_000).toISOString(),
  });
  const sz = makeMarket({
    id: "sz-local",
    eventId: "evt-sz",
    city: "Shenzhen",
    bracket: "1",
    dateKey: szDate,
    tradingCutoff: new Date(now + 3600_000).toISOString(),
  });
  const laPrevious = makeMarket({
    id: "la-previous",
    eventId: "evt-la-prev",
    city: "Los Angeles",
    bracket: "0",
    dateKey: new Date(Date.parse(`${laDate}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10),
    tradingCutoff: new Date(now + 3600_000).toISOString(),
  });
  const manager = makeManager([la, sz, laPrevious]);
  const picked = manager.selectMarkets(makeConfig(), "live", { dateKey: utcDateKey() });
  assert.deepEqual(picked.map((market) => market.id).sort(), ["la-local", "sz-local"]);
});

test("TTR window still filters events by actual trading cutoff", () => {
  const now = Date.now();
  const near = makeMarket({
    id: "near",
    eventId: "evt-near",
    city: "Alpha",
    bracket: "1",
    dateKey: TODAY,
    tradingCutoff: new Date(now + 10 * 60_000).toISOString(), // 10 min
  });
  const far = makeMarket({
    id: "far",
    eventId: "evt-far",
    city: "Beta",
    bracket: "1",
    dateKey: TODAY,
    tradingCutoff: new Date(now + 4 * 3600_000).toISOString(), // 4h
  });
  const manager = makeManager([near, far]);
  const picked = manager.selectMarkets(
    makeConfig({ minTimeToResolutionSec: 3600, maxTimeToResolutionSec: 86_400 }),
    "live",
    { dateKey: TODAY },
  );
  assert.deepEqual(picked.map((market) => market.id), ["far"]);
});
