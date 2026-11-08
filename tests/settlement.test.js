/**
 * tests/settlement.test.js — 官方裁决后，一直持有的仓位必须自动兑付并正确计入盈亏。
 *
 * 覆盖 docs/03 §4.3 的边界：
 *  1) live 运行中，市场 endDate 已过且官方 resolution 返回 resolved → handleSettlements
 *     自动按 1/0 兑付：现金入账、持仓删除、Trade(reason=resolution, fee=0)、
 *     realizedPnl / closedTrades / winRate / totalReturnPct 等指标正确；
 *  2) 官方裁决为输（payout=0）→ 已实现亏损正确；
 *  3) 市场 closed 但裁决未出（payout=null）→ 不结算、持仓保留、标记 resolution_pending；
 *  4) replay 模式不做结算（持仓按最后 mid 估值）。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Run } from "../server/engine/run.js";
import { makeTrade, recordTrade } from "../server/engine/runTrading.js";
import {
  DEFAULT_STRATEGY,
  calcTakerFee,
  clone,
  normalizeStrategy,
  roundTo,
} from "../shared/contract.js";

const NOW = Date.parse("2026-11-09T02:00:00Z"); // 市场已过期

function makeDeps() {
  const logs = [];
  return {
    logs,
    sse: {
      broadcast() {},
      log(level, message) {
        logs.push({ level, message });
      },
    },
    store: {
      appendRecord() {},
      async upsertRunRecord() {},
      async saveNow() {},
      getRunRecord() {
        return null;
      },
    },
    log() {},
  };
}

function makeMarket({ id = "settle-m1", endDate = "2026-11-09T00:00:00Z" } = {}) {
  return {
    id,
    conditionId: `0x${id}`,
    eventId: "settle-event",
    slug: id,
    question: "Will the highest temperature be 10°C?",
    city: "Test",
    station: "TEST",
    bracket: "10°C",
    tokens: { yesTokenId: `${id}-yes`, noTokenId: `${id}-no` },
    quotes: {
      YES: { bid: 0.39, ask: 0.41, mid: 0.4, last: 0.4 },
      NO: { bid: 0.59, ask: 0.61, mid: 0.6, last: 0.6 },
    },
    spread: 0.02,
    impliedProbability: 0.4,
    liquidityUsd: 10_000,
    volume24hUsd: 10_000,
    tickSize: 0.001,
    minOrderShares: 5,
    endDate,
    eventStartTime: endDate,
    acceptingOrders: false,
    closed: false,
    negRisk: true,
    feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
    updatedAt: NOW,
    stale: false,
  };
}

function makeConfig(overrides = {}) {
  return normalizeStrategy({
    ...clone(DEFAULT_STRATEGY),
    name: "settlement test",
    risk: { ...clone(DEFAULT_STRATEGY.risk), bankrollUsd: 1000, killSwitch: false },
    universe: {
      ...clone(DEFAULT_STRATEGY.universe),
      minPrice: 0.02,
      maxPrice: 0.98,
      maxSpread: 0.05,
    },
    sim: { ...clone(DEFAULT_STRATEGY.sim), mode: "live" },
    ...overrides,
  });
}

/** 从 1000 USDC 现金开始，手动买入 10 股 @0.40（含官方 taker 费）。 */
function makeRunWithPosition({ mode = "live", market = makeMarket(), resolution = null } = {}) {
  const deps = makeDeps();
  const run = new Run({
    id: "run_settlement_test",
    record: { strategyName: "settlement test", createdAt: NOW - 120_000 },
    config: makeConfig(),
    sse: deps.sse,
    store: deps.store,
    log: deps.log,
  });
  run.setMarkets([market]);
  run.source = { mode };
  run.status = "running";
  run.startedAt = NOW - 120_000;
  run.resolutionProvider = async () => resolution;

  const shares = 10;
  const price = 0.4;
  const fee = calcTakerFee(shares, price);
  const notional = roundTo(shares * price, 5);
  const totalCost = roundTo(notional + fee, 5);
  const position = run.portfolio.buy({
    tokenId: market.tokens.yesTokenId,
    marketId: market.id,
    outcome: "YES",
    city: market.city,
    bracket: market.bracket,
    shares,
    price,
    fee,
    ts: NOW - 60_000,
    midPrice: price,
    impliedProbability: price,
  });
  const buyTrade = makeTrade(run, {
    market,
    tokenId: market.tokens.yesTokenId,
    outcome: "YES",
    side: "BUY",
    shares,
    price,
    notional,
    fee,
    slippageCost: 0,
    spreadCost: 0,
    realizedPnl: 0,
    totalCost,
    cashDelta: -totalCost,
    signalId: null,
    reason: "signal",
    status: "filled",
    rejectReason: null,
    bookLevels: [],
    ts: NOW - 60_000,
  });
  recordTrade(run, buyTrade, position);
  run.sampleEquity(NOW - 30_000);
  return { run, deps, market, shares, price, fee, notional, totalCost };
}

test("official resolution settles a held position at 1/0 and computes P&L + metrics", async () => {
  const { run, market, shares, price, totalCost } = makeRunWithPosition({
    resolution: { status: "resolved", closed: true, yesWon: true, payout: 1, outcomePrices: [1, 0] },
  });
  const cashBefore = run.portfolio.cash; // 1000 - 4.12 = 995.88
  assert.equal(run.portfolio.positions.size, 1);

  await run._handleSettlements(NOW);

  // 兑付 10 股 × 1.00，现金入账，持仓删除，结算不收费
  assert.equal(run.portfolio.positions.size, 0, "position must be removed after settlement");
  assert.equal(run.portfolio.cash, roundTo(cashBefore + shares * 1, 6));
  assert.ok(run._settledMarkets.has(market.id));

  const settlementTrade = run.trades.find((trade) => trade.reason === "resolution");
  assert.ok(settlementTrade, "expected a reason=resolution Trade");
  assert.equal(settlementTrade.side, "SELL");
  assert.equal(settlementTrade.shares, shares);
  assert.equal(settlementTrade.price, 1);
  assert.equal(settlementTrade.fee, 0, "settlement must not charge a fee");
  assert.equal(settlementTrade.realizedPnl, roundTo(shares * 1 - totalCost, 6));
  assert.equal(settlementTrade.status, "filled");

  run.sampleEquity(NOW);
  const metrics = run.currentMetrics();
  assert.equal(metrics.realizedPnl, roundTo(shares * 1 - totalCost, 6));
  assert.equal(metrics.unrealizedPnl, 0);
  assert.equal(metrics.closedTrades, 1);
  assert.equal(metrics.winRate, 1);
  assert.equal(metrics.feesPaid, calcTakerFee(shares, price));
  assert.equal(metrics.trades, 1, "resolution trade is not counted as a new entry");
  assert.equal(metrics.totalReturnPct, roundTo((run.portfolio.equity() - 1000) / 1000 * 100, 4));

  // 全部持仓已结算、市场 closed → 运行自动 ended
  run._checkAutoEnd(NOW);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(run.status, "ended");
});

test("losing resolution settles at 0 and records the realized loss", async () => {
  const { run, market, shares, totalCost } = makeRunWithPosition({
    resolution: { status: "resolved", closed: true, yesWon: false, payout: 0, outcomePrices: [0, 1] },
  });
  const cashBefore = run.portfolio.cash;

  await run._handleSettlements(NOW);

  assert.equal(run.portfolio.positions.size, 0);
  assert.equal(run.portfolio.cash, cashBefore, "payout 0 adds no cash");
  assert.ok(run._settledMarkets.has(market.id));

  const settlementTrade = run.trades.find((trade) => trade.reason === "resolution");
  assert.ok(settlementTrade);
  assert.equal(settlementTrade.price, 0);
  assert.equal(settlementTrade.fee, 0);
  assert.equal(settlementTrade.realizedPnl, roundTo(0 - totalCost, 6));
  assert.equal(settlementTrade.realizedPnl, roundTo(-totalCost, 6));
  assert.equal(shares, 10);

  run.sampleEquity(NOW);
  const metrics = run.currentMetrics();
  assert.equal(metrics.realizedPnl, roundTo(-totalCost, 6));
  assert.equal(metrics.closedTrades, 1);
  assert.equal(metrics.winRate, 0);
  assert.equal(metrics.avgWin, null);
  assert.equal(metrics.profitFactor, 0, "no wins with losses => profitFactor 0");
  assert.equal(metrics.avgLoss, totalCost);
});

test("closed but unresolved market keeps the position and marks resolution_pending", async () => {
  const { run, market } = makeRunWithPosition({
    resolution: { status: "pending", closed: true, yesWon: null, payout: null, outcomePrices: [] },
  });
  const cashBefore = run.portfolio.cash;

  await run._handleSettlements(NOW);

  assert.equal(run.portfolio.positions.size, 1, "position must stay open while resolution is pending");
  assert.equal(run.portfolio.cash, cashBefore);
  assert.equal(market.resolutionPending, true);
  assert.equal(run.trades.filter((trade) => trade.reason === "resolution").length, 0);
  assert.equal(run._settledMarkets.has(market.id), false);
});

test("replay runs never settle positions (they end marked-to-market)", async () => {
  const { run, market } = makeRunWithPosition({
    mode: "replay",
    resolution: { status: "resolved", closed: true, yesWon: true, payout: 1, outcomePrices: [1, 0] },
  });
  const cashBefore = run.portfolio.cash;

  await run._handleSettlements(NOW);

  assert.equal(run.portfolio.positions.size, 1);
  assert.equal(run.portfolio.cash, cashBefore);
  assert.equal(run._settledMarkets.has(market.id), false);
});
