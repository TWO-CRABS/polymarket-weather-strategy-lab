/**
 * tests/rolling.test.js
 *
 * 只做当天市场 + UTC 00:00 每日滚动：
 *  - Run.rollUniverse 切换活跃 marketIds，旧市场 closed、旧仓位保留；
 *  - RunManager.rollDailyUniverses 只在 UTC 日期变化时滚动一次；
 *  - 新一天暂无市场时不滚动、不重复告警，run 继续 running。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Run } from "../server/engine/run.js";
import { RunManager } from "../server/engine/runManager.js";
import { DEFAULT_STRATEGY, clone, normalizeStrategy } from "../shared/contract.js";
import { utcDateKey } from "../server/util.js";

function makeStore() {
  return {
    appendRecord() {},
    async upsertRunRecord() {},
    async saveNow() {},
    getRunRecord() {
      return null;
    },
  };
}

function makeMarket(id, dateKey, prob = 0.5) {
  const endDate = `${dateKey}T12:00:00.000Z`;
  return {
    id,
    eventId: `evt-${id}`,
    conditionId: `0x${id}`,
    endDate,
    city: "Alpha",
    station: "TEST",
    bracket: id,
    question: `Will Alpha be ${id}?`,
    tokens: { yesTokenId: `${id}-yes`, noTokenId: `${id}-no` },
    impliedProbability: prob,
    liquidityUsd: 1000,
    spread: 0.01,
    acceptingOrders: true,
    closed: false,
    negRisk: true,
    tickSize: 0.001,
    feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
    quotes: {
      YES: { bid: prob - 0.01, ask: prob + 0.01, mid: prob, last: null },
      NO: { bid: 1 - prob - 0.01, ask: 1 - prob + 0.01, mid: 1 - prob, last: null },
    },
  };
}

function makeRun() {
  const config = normalizeStrategy(clone(DEFAULT_STRATEGY));
  return new Run({
    id: "run_roll_test",
    record: { strategyName: "rolling test", createdAt: Date.now() - 60_000 },
    config,
    sse: { broadcast() {}, log() {} },
    store: makeStore(),
    log() {},
  });
}

test("rollUniverse switches active markets, closes old markets and keeps old positions", () => {
  const run = makeRun();
  const oldDate = "2026-11-08";
  const newDate = "2026-11-09";
  const oldMarket = makeMarket("old-1", oldDate, 0.4);
  const newMarket = makeMarket("new-1", newDate, 0.3);
  run.source = { mode: "live", status: () => ({ status: "live" }) };
  run.status = "running";
  run.universeDate = oldDate;
  run.setMarkets([oldMarket]);
  run._fallbackNextAt = 123;
  run.portfolio.buy({
    tokenId: oldMarket.tokens.yesTokenId,
    marketId: oldMarket.id,
    outcome: "YES",
    city: oldMarket.city,
    bracket: oldMarket.bracket,
    shares: 10,
    price: 0.4,
    fee: 0.12,
    ts: Date.now() - 60_000,
    midPrice: 0.4,
    impliedProbability: 0.4,
  });

  const count = run.rollUniverse([newMarket], newDate, Date.now());

  assert.equal(count, 1);
  assert.deepEqual(run.marketIds, ["new-1"]);
  assert.equal(run.universeDate, newDate);
  assert.equal(oldMarket.closed, true, "old market must stop trading");
  assert.equal(run.markets.get("old-1"), oldMarket, "old market retained for settlement");
  assert.equal(run.markets.get("new-1"), newMarket);
  assert.equal(run.portfolio.positions.size, 1, "old position must be kept");
  assert.equal(run._fallbackNextAt, null);
  assert.equal(run.view().marketsTracked, 1);
  assert.equal(run.view().universeDate, newDate);
});

test("rollUniverse merges city-local days: closes only departed markets and keeps current ones", () => {
  const run = makeRun();
  const oldDate = "2026-11-08";
  const newDate = "2026-11-09";
  const oldMarket = makeMarket("old-1", oldDate, 0.4);
  const keepMarket = makeMarket("keep-1", newDate, 0.5);
  const newMarket = makeMarket("new-1", newDate, 0.3);
  run.source = { mode: "live", status: () => ({ status: "live" }) };
  run.status = "running";
  run.universeDate = oldDate;
  run.setMarkets([oldMarket, keepMarket]);

  run.rollUniverse([keepMarket, newMarket], newDate, Date.now());

  assert.deepEqual(run.marketIds.sort(), ["keep-1", "new-1"]);
  assert.equal(oldMarket.closed, true, "departed market must stop trading");
  assert.equal(keepMarket.closed, false, "still-current market must remain open");
  assert.equal(run.markets.get("old-1"), oldMarket, "old market retained for settlement");
});

test("RunManager rolls when the active city-local-day set changes and retries when no markets", () => {
  const today = utcDateKey();
  const todayMarket = makeMarket("today-1", today, 0.5);
  const discovery = {
    onRefresh() {},
    getCandidateMarkets: () => [todayMarket],
    getMarket: () => null,
    getMarkets: () => [],
  };
  const manager = new RunManager({
    store: makeStore(),
    sse: { broadcast() {}, log() {} },
    discovery,
    feed: { setTracked() {} },
    clob: {},
    config: { replayFixture: null, idleFeedMarkets: 0 },
    log() {},
  });
  const calls = [];
  const run = {
    id: "run_roll",
    mode: "live",
    status: "running",
    config: normalizeStrategy(clone(DEFAULT_STRATEGY)),
    marketIds: [],
    universeDate: "2000-01-01",
    sse: { log() {} },
    rollUniverse(markets, dateKey) {
      calls.push({ markets: markets.length, dateKey });
      run.marketIds = markets.map((market) => market.id);
      run.universeDate = dateKey;
    },
  };
  manager.active.set(run.id, run);

  assert.equal(manager.rollDailyUniverses(Date.now()), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].dateKey, today);
  assert.equal(manager.rollDailyUniverses(Date.now() + 1000), false, "same active set must not roll twice");
  assert.equal(calls.length, 1);

  // No markets for a new day: keep run running, do not roll, retry later.
  const emptyDiscovery = {
    onRefresh() {},
    getCandidateMarkets: () => [],
    getMarket: () => null,
    getMarkets: () => [],
  };
  const manager2 = new RunManager({
    store: makeStore(),
    sse: { broadcast() {}, log() {} },
    discovery: emptyDiscovery,
    feed: { setTracked() {} },
    clob: {},
    config: { replayFixture: null, idleFeedMarkets: 0 },
    log() {},
  });
  const calls2 = [];
  const run2 = { ...run, universeDate: "2000-01-01", rollUniverse: () => calls2.push(1) };
  manager2.active.set(run2.id, run2);
  assert.equal(manager2.rollDailyUniverses(Date.now()), false);
  assert.equal(calls2.length, 0);
  assert.equal(run2.status, "running");
});
