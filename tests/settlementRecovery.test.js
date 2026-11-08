/**
 * tests/settlementRecovery.test.js
 *
 * 覆盖“停止 / 服务重启后仍持有的仓位继续等待官方裁决并补记结算”的边界：
 *  1) journal 成交回放重建组合（部分卖出、结算后持仓）与真实 Portfolio 一致；
 *  2) 重启恢复：从 store + journal 恢复 settler，自动兑付并更新 run record；
 *  3) 手动停止：live 运行停止后仍有持仓 → 注册 settler 继续结算。
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Store } from "../server/store.js";
import { RunManager } from "../server/engine/runManager.js";
import { Portfolio } from "../server/engine/portfolio.js";
import { rehydratePortfolio } from "../server/engine/settlementRecovery.js";
import { calcTakerFee, roundTo } from "../shared/contract.js";

// Store.scheduleSave() 的防抖 timer 是 unref 的（生产环境由 HTTP server 保活）；
// 单测里保留一个 ref'd timer，避免 await 防抖保存时 event loop 提前退出。
const keepAlive = setInterval(() => {}, 1000);
after(() => clearInterval(keepAlive));

const T0 = Date.parse("2026-11-08T10:00:00Z");

function makeTrade(overrides = {}) {
  const shares = overrides.shares ?? 10;
  const price = overrides.price ?? 0.4;
  const fee = overrides.fee ?? calcTakerFee(shares, price);
  return {
    id: `trd_${overrides.idSuffix ?? Math.random().toString(36).slice(2)}`,
    ts: overrides.ts ?? T0,
    runId: overrides.runId ?? "run_recover_1",
    marketId: overrides.marketId ?? "m1",
    tokenId: overrides.tokenId ?? "m1-yes",
    outcome: overrides.outcome ?? "YES",
    side: overrides.side ?? "BUY",
    shares,
    price,
    notional: roundTo(shares * price, 5),
    fee,
    slippageCost: 0,
    spreadCost: 0,
    totalCost: roundTo(shares * price + fee, 5),
    cashDelta: -roundTo(shares * price + fee, 5),
    realizedPnl: overrides.realizedPnl ?? 0,
    signalId: null,
    reason: overrides.reason ?? "signal",
    status: overrides.status ?? "filled",
    rejectReason: null,
    bookLevels: [],
    city: "Test",
    bracket: "10°C",
    ...overrides,
  };
}

async function makeTempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "poly-settle-recovery-"));
  const store = new Store({
    dataDir: dir,
    storeFile: path.join(dir, "store.json"),
    runsDir: path.join(dir, "runs"),
  });
  await store.init();
  return { dir, store };
}

function makeRecord(id, overrides = {}) {
  return {
    id,
    strategyId: null,
    strategyName: "recovery test",
    mode: "live",
    status: "stopped",
    createdAt: T0 - 600_000,
    startedAt: T0 - 600_000,
    endedAt: T0 - 300_000,
    initialCapital: 1000,
    equity: 1000,
    cash: 1000,
    positionsValue: 0,
    metrics: null,
    signalsCount: 0,
    marketsTracked: 1,
    marketIds: ["m1"],
    feedStatus: "offline",
    stopReason: "manual",
    note: "",
    config: { sim: { tickIntervalMs: 1000, mode: "live" }, risk: { bankrollUsd: 1000 } },
    ...overrides,
  };
}

function makeDiscovery(payout = 1) {
  return {
    onRefresh() {},
    async getResolution() {
      return { status: "resolved", closed: true, yesWon: payout === 1, payout, outcomePrices: [payout, 1 - payout] };
    },
  };
}

function makeManager(store, discovery) {
  return new RunManager({
    store,
    sse: { broadcast() {}, log() {} },
    discovery,
    feed: {},
    clob: {},
    config: {},
    log() {},
  });
}

test("rehydratePortfolio replays journal trades into the same cash/positions/P&L as live portfolio ops", () => {
  const buyA = makeTrade({ idSuffix: "a", shares: 10, price: 0.4 });
  const buyB = makeTrade({ idSuffix: "b", shares: 10, price: 0.5, ts: T0 + 1000 });
  const sell = makeTrade({
    idSuffix: "c",
    side: "SELL",
    shares: 12,
    price: 0.6,
    fee: calcTakerFee(12, 0.6),
    realizedPnl: 1.509,
    ts: T0 + 2000,
  });
  const settle = makeTrade({
    idSuffix: "d",
    side: "SELL",
    shares: 8,
    price: 1,
    fee: 0,
    realizedPnl: 4.302,
    reason: "resolution",
    ts: T0 + 3000,
  });

  const replayed = rehydratePortfolio(1000, [buyA, buyB, sell, settle]);

  const manual = new Portfolio({ initialCapital: 1000 });
  manual.buy({ tokenId: "m1-yes", marketId: "m1", outcome: "YES", city: "Test", bracket: "10°C", shares: 10, price: 0.4, fee: buyA.fee, ts: T0, midPrice: 0.4, impliedProbability: 0.4 });
  manual.buy({ tokenId: "m1-yes", marketId: "m1", outcome: "YES", city: "Test", bracket: "10°C", shares: 10, price: 0.5, fee: buyB.fee, ts: T0 + 1000, midPrice: 0.5, impliedProbability: 0.5 });
  manual.sell({ tokenId: "m1-yes", shares: 12, price: 0.6, fee: sell.fee, ts: T0 + 2000 });
  manual.settleMarket("m1", 1, T0 + 3000);

  assert.equal(replayed.cash, manual.cash);
  assert.equal(replayed.feesPaid, manual.feesPaid);
  assert.equal(replayed.realizedPnl, manual.realizedPnl);
  assert.equal(replayed.positions.size, 0);
  assert.deepEqual(replayed.closedRoundPnls, manual.closedRoundPnls);
});

test("server restart: recovered settler settles held positions and updates the run record", async () => {
  const { dir, store } = await makeTempStore();
  try {
    await store.upsertRunRecord(makeRecord("run_recover_1"));
    const buy = makeTrade({ idSuffix: "buy", shares: 10, price: 0.4 });
    await store.appendRecord("run_recover_1", "trade", buy);
    await store.saveNow();

    const manager = makeManager(store, makeDiscovery(1));

    // 恢复前：详情已能从 journal 重建出持仓
    const before = await manager.getRunDetail("run_recover_1");
    assert.equal(before.positions.length, 1);
    assert.equal(before.positions[0].shares, 10);
    assert.equal(before.positions[0].costBasis, buy.totalCost);
    assert.equal(before.run.pendingSettlements, 0, "record was persisted before recovery counted it");

    const recovered = await manager.recoverSettlements();
    assert.equal(recovered, 1);
    assert.equal(manager._settlers.size, 1);
    let record = store.getRunRecord("run_recover_1");
    assert.equal(record.pendingSettlements, 1, "recovery marks the position as pending settlement");
    assert.equal(record.settlementRecovered, true);

    // 一轮结算轮询：官方裁决 resolved → 自动兑付
    await manager._settlementTick();

    record = store.getRunRecord("run_recover_1");
    assert.equal(manager._settlers.size, 0, "settler removed after positions are settled");
    assert.equal(record.pendingSettlements, 0);
    assert.equal(record.settledPositions, 1);
    assert.equal(record.cash, roundTo(995.88 + 10, 5));
    assert.equal(record.equity, roundTo(1005.88, 5));
    assert.equal(record.metrics.closedTrades, 1);
    assert.equal(record.metrics.realizedPnl, roundTo(10 - buy.totalCost, 6));

    const journal = await store.readRecords("run_recover_1", { type: "trade", limit: 100 });
    const resolutionTrade = journal.items.find((trade) => trade.reason === "resolution");
    assert.ok(resolutionTrade, "resolution trade must be appended to the journal");
    assert.equal(resolutionTrade.fee, 0);
    assert.equal(resolutionTrade.price, 1);

    const after = await manager.getRunDetail("run_recover_1");
    assert.equal(after.positions.length, 0);
    assert.equal(after.run.pendingSettlements, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("manual stop: a live run with positions registers a settler that keeps polling", async () => {
  const { dir, store } = await makeTempStore();
  try {
    await store.upsertRunRecord(makeRecord("run_manual_stop", { status: "stopped" }));
    const buy = makeTrade({ idSuffix: "manual", shares: 10, price: 0.4, runId: "run_manual_stop" });
    await store.appendRecord("run_manual_stop", "trade", buy);
    await store.saveNow();

    const manager = makeManager(store, makeDiscovery(0));
    const fakeRun = {
      id: "run_manual_stop",
      mode: "live",
      status: "stopped",
      markets: new Map([["m1", { id: "m1", city: "Test", bracket: "10°C", closed: true, endDate: "2026-11-08T12:00:00Z" }]]),
      portfolio: rehydratePortfolio(1000, [buy]),
      trades: [],
    };
    assert.equal(manager._trackRunSettlement(fakeRun), true);
    assert.equal(manager._settlers.size, 1);

    await manager._settlementTick();

    const record = store.getRunRecord("run_manual_stop");
    assert.equal(record.pendingSettlements, 0);
    assert.equal(record.settledPositions, 1);
    assert.equal(record.metrics.realizedPnl, roundTo(-buy.totalCost, 6), "payout 0 => full cost basis lost");
    assert.equal(manager._settlers.size, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
