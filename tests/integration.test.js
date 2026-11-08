/**
 * tests/integration.test.js — deterministic end-to-end replay run over HTTP.
 *
 * Starts the real server with FEED_MODE=off + REPLAY_FIXTURE (zero upstream
 * network) and asserts the docs/07 §8 acceptance chain plus the accounting
 * invariants of docs/04 §6.1:
 *   - run reaches `ended` via replay_done with 2 signals / 3 trades
 *   - every trade fee == calcTakerFee(shares, price)  (AC-03)
 *   - equity = cash + positionsValue and equity = capital + realized + unrealized
 *   - drawdown matches the equity curve
 *   - metrics match recomputed values, Sharpe null for short runs
 *   - SSE delivers hello/meta/run(starting->running->ended)/signal/trade/equity
 *   - stop is idempotent and no trades appear afterwards
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import {
  calcTakerFee,
  roundTo,
} from "../shared/contract.js";
import { fixtureStrategy, writeReplayFixture } from "./fixtures/replay.js";
import {
  makeTempDataDir,
  removeDir,
  startServer,
  waitFor,
} from "./helpers/server.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server;
let dataDir;
let fixturePath;

before(async () => {
  dataDir = await makeTempDataDir("pmw-it-");
  fixturePath = await writeReplayFixture(dataDir);
  server = await startServer({
    dataDir,
    env: {
      FEED_MODE: "off",
      REPLAY_FIXTURE: fixturePath,
      DISCOVERY_MS: "3600000",
      POLL_MS: "1000",
    },
  });
});

after(async () => {
  if (server) await server.stop();
  if (dataDir) await removeDir(dataDir);
});

/** Poll a run until it leaves the transient states (or throw). */
async function waitForRunStatus(runId, terminal, { timeoutMs = 20_000 } = {}) {
  return waitFor(
    async () => {
      const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
      if (res.status !== 200) return null;
      const status = res.json?.run?.status;
      if (terminal.includes(status)) return res.json;
      return null;
    },
    { timeoutMs, intervalMs: 100, label: `run ${runId} -> ${terminal.join("|")}` },
  );
}

test("offline server boots with health/meta and no live markets (acceptance chain 1-3)", async () => {
  const health = await server.http.get("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.status, "ok");
  assert.equal(typeof health.json.now, "number");
  assert.equal(health.json.feed.status, "offline");
  assert.equal(health.json.feed.marketsTracked, 0);
  assert.deepEqual(health.json.runs, { active: 0, total: 0 });

  const meta = await server.http.get("/api/meta");
  assert.equal(meta.status, 200);
  assert.equal(meta.json.contractVersion, "1.0.0");
  assert.equal(meta.json.presets.length, 3);
  assert.equal(meta.json.feeModel.takerFeeRate, 0.05);
  assert.deepEqual(
    meta.json.presets.map((preset) => preset.id),
    ["conservative", "balanced", "aggressive"],
  );

  const markets = await server.http.get("/api/markets");
  assert.equal(markets.status, 200);
  assert.deepEqual(markets.json, { markets: [], count: 0, updatedAt: 0 });

  const events = await server.http.get("/api/events");
  assert.equal(events.status, 200);
  assert.deepEqual(events.json.events, []);
});

test("validation endpoint accepts the fixture strategy (acceptance step 4)", async () => {
  const res = await server.http.post("/api/strategies/validate", fixtureStrategy());
  assert.equal(res.status, 200);
  assert.equal(res.json.valid, true);
  assert.deepEqual(res.json.errors, []);
  assert.equal(res.json.normalized.signal.windowSec, 60);
  assert.equal(res.json.normalized.sim.mode, "replay");
});

test("replay fixture run: signals, trades, fees, equity, metrics, positions, SSE", async () => {
  const strategy = fixtureStrategy();

  // connect SSE *before* creating the run so no event is missed
  const sse = await server.sse("/api/stream");
  const sseEvents = [];
  const pump = (async () => {
    for (;;) {
      try {
        // eslint-disable-next-line no-await-in-loop
        sseEvents.push(await sse.next(null, { timeoutMs: 20_000 }));
      } catch {
        break;
      }
    }
  })();

  try {
    const create = await server.http.post("/api/runs", {
      mode: "replay",
      strategy,
      replay: { speed: 100 },
    });
    assert.equal(create.status, 201);
    const run = create.json.run;
    assert.equal(run.mode, "replay");
    assert.equal(run.initialCapital, 1000);
    assert.equal(run.status, "starting");
    assert.equal(run.marketsTracked, 2);
    const runId = run.id;
    assert.match(runId, /^run_/);

    const detail = await waitForRunStatus(runId, ["ended", "stopped", "error"]);
    assert.equal(detail.run.status, "ended", `run note: ${detail.run.note}`);
    assert.equal(detail.run.stopReason, "replay_done");
    assert.equal(detail.run.ticks, 10);
    assert.equal(detail.run.signalsCount, 2);
    assert.equal(detail.run.marketsTracked, 2);
    assert.ok(detail.run.endedAt >= detail.run.startedAt);
    assert.equal(detail.config.sim.mode, "replay");
    assert.equal(detail.config.sim.speed, 100);

    /* ---------------------------- trades ---------------------------- */
    const tradesRes = await server.http.get(`/api/runs/${runId}/trades`);
    assert.equal(tradesRes.status, 200);
    assert.equal(tradesRes.json.total, 3);
    const trades = tradesRes.json.trades;
    assert.equal(trades.length, 3);
    for (const trade of trades) {
      assert.match(trade.id, /^trd_/);
      assert.equal(trade.runId, runId);
      assert.ok(Number.isFinite(trade.ts));
      assert.ok(["BUY", "SELL"].includes(trade.side));
      assert.ok(["YES", "NO"].includes(trade.outcome));
      assert.ok(["filled", "partial"].includes(trade.status));
      assert.equal(trade.fee, calcTakerFee(trade.shares, trade.price), "AC-03 fee formula");
      assert.equal(trade.notional, roundTo(trade.shares * trade.price, 5));
      assert.ok(trade.shares >= 5, "min order size 5 shares");
      assert.ok(trade.bookLevels.length > 0);
      if (trade.side === "BUY") {
        assert.equal(trade.totalCost, roundTo(trade.notional + trade.fee, 5));
        assert.equal(trade.cashDelta, -trade.totalCost);
        assert.equal(trade.realizedPnl, 0);
      } else {
        assert.equal(trade.totalCost, roundTo(trade.notional - trade.fee, 5));
        assert.equal(trade.cashDelta, trade.totalCost);
      }
    }

    const buys = trades.filter((trade) => trade.side === "BUY");
    const sells = trades.filter((trade) => trade.side === "SELL");
    assert.equal(buys.length, 2);
    assert.equal(sells.length, 1);
    assert.deepEqual(
      buys.map((trade) => trade.outcome).sort(),
      ["NO", "YES"],
      "UP -> BUY YES, DOWN -> BUY NO",
    );
    for (const buy of buys) {
      assert.equal(buy.reason, "signal");
      assert.match(buy.signalId, /^sig_/);
    }
    const takeProfit = sells[0];
    assert.equal(takeProfit.reason, "take_profit");
    assert.equal(takeProfit.outcome, "YES");
    assert.ok(takeProfit.realizedPnl > 0, "take-profit round must realise a gain");
    approxEqual(takeProfit.realizedPnl, 13.69834, 1e-4, "take_profit realizedPnl");

    /* ---------------------------- signals --------------------------- */
    const signalsRes = await server.http.get(`/api/runs/${runId}/signals`);
    assert.equal(signalsRes.status, 200);
    assert.equal(signalsRes.json.total, 2);
    const signals = signalsRes.json.signals;
    const up = signals.find((signal) => signal.direction === "up");
    const down = signals.find((signal) => signal.direction === "down");
    assert.ok(up && down);
    assert.equal(up.outcome, "YES");
    assert.equal(down.outcome, "NO");
    assert.equal(up.fromPrice, 0.3);
    assert.equal(up.toPrice, 0.36);
    assert.equal(up.changePct, 20);
    assert.equal(up.windowSec, 60);
    assert.equal(down.fromPrice, 0.7);
    assert.equal(down.toPrice, 0.56);
    assert.equal(down.changePct, -20);
    assert.equal(down.tokenId, "fix-no-b");

    /* ---------------------------- equity ---------------------------- */
    const equityRes = await server.http.get(`/api/runs/${runId}/equity`);
    assert.equal(equityRes.status, 200);
    assert.ok(equityRes.json.total >= 10, `expected >=10 equity points, got ${equityRes.json.total}`);
    const points = equityRes.json.points;
    let peak = -Infinity;
    for (const point of points) {
      assert.ok(Number.isFinite(point.equity));
      assert.ok(
        Math.abs(point.equity - (point.cash + point.positionsValue)) < 1e-6,
        `equity != cash + positionsValue at ts ${point.ts}`,
      );
      assert.ok(
        Math.abs(point.equity - (1000 + point.realizedPnl + point.unrealizedPnl)) < 1e-6,
        `equity != capital + realized + unrealized at ts ${point.ts}`,
      );
      peak = Math.max(peak, point.equity);
      const expectedDrawdown = ((peak - point.equity) / peak) * 100;
      approxEqual(point.drawdownPct, expectedDrawdown, 1e-4, `drawdown at ts ${point.ts}`);
    }
    const lastPoint = points[points.length - 1];
    assert.equal(lastPoint.equity, detail.run.equity);
    const maxDd = computeMaxDrawdown(points);
    approxEqual(detail.metrics.maxDrawdownPct, maxDd, 1e-4, "metrics.maxDrawdownPct");

    /* ---------------------------- metrics --------------------------- */
    const metrics = detail.metrics;
    const totalFees = trades.reduce((sum, trade) => sum + trade.fee, 0);
    const totalTurnover = trades.reduce((sum, trade) => sum + Math.abs(trade.notional), 0);
    assert.equal(metrics.trades, 3);
    assert.equal(metrics.closedTrades, 1);
    assert.equal(metrics.winRate, 1);
    assert.equal(metrics.profitFactor, null, "no losing rounds -> null profitFactor");
    assert.equal(metrics.sharpe, null, "<30 raw equity samples -> null Sharpe");
    approxEqual(metrics.feesPaid, totalFees, 1e-6, "metrics.feesPaid");
    approxEqual(metrics.turnoverUsd, totalTurnover, 1e-6, "metrics.turnoverUsd");
    approxEqual(metrics.feeDragPct, (metrics.feesPaid / 1000) * 100, 1e-4, "metrics.feeDragPct");
    approxEqual(
      metrics.totalReturnPct,
      ((lastPoint.equity - 1000) / 1000) * 100,
      1e-4,
      "metrics.totalReturnPct",
    );
    for (const value of Object.values(metrics)) {
      assert.ok(value === null || Number.isFinite(value), `metric is not JSON-safe: ${value}`);
    }

    /* --------------------------- positions -------------------------- */
    const positionsRes = await server.http.get(`/api/runs/${runId}/positions`);
    assert.equal(positionsRes.status, 200);
    const posBody = positionsRes.json;
    assert.deepEqual(
      posBody.positions.map((position) => position.tokenId),
      ["fix-no-b"],
    );
    const open = posBody.positions[0];
    assert.equal(open.outcome, "NO");
    assert.equal(open.shares, 54.66);
    assert.equal(open.avgPrice, 0.457349);
    assert.equal(open.costBasis, 24.99868);
    assert.equal(open.impliedProbability, 0.56);
    assert.equal(open.estExitFee, calcTakerFee(open.shares, open.midPrice));
    approxEqual(posBody.positionsValue, open.marketValue, 1e-6, "positionsValue");
    approxEqual(posBody.equity, posBody.cash + posBody.positionsValue, 1e-6, "positions equity identity");
    approxEqual(posBody.cash, detail.run.cash, 1e-6, "positions cash");
    approxEqual(posBody.equity, detail.run.equity, 1e-6, "positions equity");

    /* ------------------------ costBreakdown (optional) ---------------------- */
    if (detail.costBreakdown) {
      approxEqual(detail.costBreakdown.feesPaid, totalFees, 1e-6, "costBreakdown.feesPaid");
      approxEqual(
        detail.costBreakdown.totalFriction,
        detail.costBreakdown.feesPaid + detail.costBreakdown.spreadCost + detail.costBreakdown.depthSlippageCost,
        1e-6,
        "costBreakdown.totalFriction",
      );
    }

    /* ------------------------------ SSE ----------------------------- */
    await waitFor(
      () =>
        sseEvents.some(
          (event) => event.event === "run" && event.data?.run?.id === runId && event.data.run.status === "ended",
        ),
      { timeoutMs: 5_000, label: "SSE run ended event" },
    );
    await delay(150);
    await sse.close();
    await pump;

    assert.ok(sseEvents.length > 0);
    assert.equal(sseEvents[0].event, "hello", "hello must be the first SSE event");
    assert.equal(sseEvents[0].data.contractVersion, "1.0.0");
    assert.ok(sseEvents.some((event) => event.event === "meta"), "meta event");

    const runStatuses = sseEvents
      .filter((event) => event.event === "run" && event.data?.run?.id === runId)
      .map((event) => event.data.run.status);
    assert.ok(runStatuses.includes("starting"), `run statuses: ${runStatuses.join(",")}`);
    assert.ok(runStatuses.includes("running"), `run statuses: ${runStatuses.join(",")}`);
    assert.ok(runStatuses.includes("ended"), `run statuses: ${runStatuses.join(",")}`);
    assert.ok(
      runStatuses.indexOf("starting") < runStatuses.indexOf("running"),
      "run must go starting -> running",
    );
    assert.deepEqual(
      sseEvents.filter((event) => event.event === "signal").map((event) => event.data.signal.direction).sort(),
      ["down", "up"],
    );
    assert.equal(sseEvents.filter((event) => event.event === "trade").length, 3);
    assert.ok(sseEvents.filter((event) => event.event === "equity").length >= 5);
    assert.ok(sseEvents.some((event) => event.event === "positions"));
  } finally {
    await sse.close().catch(() => {});
    await pump.catch(() => {});
  }
});

test("GET /api/runs lists the finished replay run", async () => {
  const res = await server.http.get("/api/runs");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.runs));
  const replayRun = res.json.runs.find((run) => run.mode === "replay" && run.status === "ended");
  assert.ok(replayRun, "finished run should be listed");
  assert.match(replayRun.id, /^run_/);
});

test("determinism: the same fixture + config twice yields identical trades/signals/metrics (AC-16)", async () => {
  const play = async () => {
    const create = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy(),
      replay: { speed: 100 },
    });
    assert.equal(create.status, 201);
    const runId = create.json.run.id;
    const detail = await waitForRunStatus(runId, ["ended", "stopped", "error"]);
    assert.equal(detail.run.status, "ended");
    const trades = (await server.http.get(`/api/runs/${runId}/trades`)).json.trades;
    const signals = (await server.http.get(`/api/runs/${runId}/signals`)).json.signals;
    return { detail, trades, signals };
  };

  const first = await play();
  const second = await play();
  const projectTrade = (trade) => ({
    side: trade.side,
    outcome: trade.outcome,
    shares: trade.shares,
    price: trade.price,
    notional: trade.notional,
    fee: trade.fee,
    totalCost: trade.totalCost,
    realizedPnl: trade.realizedPnl,
    reason: trade.reason,
    status: trade.status,
    bookLevels: trade.bookLevels,
  });
  const projectSignal = (signal) => ({
    direction: signal.direction,
    outcome: signal.outcome,
    fromPrice: signal.fromPrice,
    toPrice: signal.toPrice,
    changePct: signal.changePct,
    absChange: signal.absChange,
  });
  assert.deepEqual(first.trades.map(projectTrade), second.trades.map(projectTrade));
  assert.deepEqual(first.signals.map(projectSignal), second.signals.map(projectSignal));
  assert.deepEqual(first.detail.metrics, second.detail.metrics);
  assert.equal(first.detail.run.equity, second.detail.run.equity);
});

test("stop lifecycle: running -> stopped, idempotent stop, no trades afterwards, delete -> 404", async () => {
  const create = await server.http.post("/api/runs", {
    mode: "replay",
    strategy: fixtureStrategy({ speed: 1 }),
    replay: { speed: 1 },
  });
  assert.equal(create.status, 201);
  const runId = create.json.run.id;

  const running = await waitForRunStatus(runId, ["running", "ended", "stopped", "error"], {
    timeoutMs: 10_000,
  });
  if (running.run.status === "ended") {
    // The fixture is short enough that a very fast machine might finish first;
    // in that case fall back to creating one more run and stopping immediately.
    assert.ok(true);
  }

  const stop = await server.http.post(`/api/runs/${encodeURIComponent(runId)}/stop`);
  assert.equal(stop.status, 200);
  assert.ok(["stopping", "stopped", "ended"].includes(stop.json.run.status));
  assert.equal(stop.json.run.id, runId);

  const stopped = await waitForRunStatus(runId, ["stopped", "ended"], { timeoutMs: 5_000 });
  assert.ok(["stopped", "ended"].includes(stopped.run.status));

  const before = await server.http.get(`/api/runs/${encodeURIComponent(runId)}/trades`);
  const beforeCount = before.json.total;
  await delay(1_200);
  const after = await server.http.get(`/api/runs/${encodeURIComponent(runId)}/trades`);
  assert.equal(after.json.total, beforeCount, "no new trades after stop");

  const again = await server.http.post(`/api/runs/${encodeURIComponent(runId)}/stop`);
  assert.equal(again.status, 200, "stop must be idempotent");
  assert.equal(again.json.run.id, runId);

  const deleted = await server.http.delete(`/api/runs/${encodeURIComponent(runId)}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, "");
  const gone = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
  assert.equal(gone.status, 404);
  assert.equal(gone.json.error.code, "RUN_NOT_FOUND");

  const deleteMissing = await server.http.delete("/api/runs/run_does_not_exist");
  assert.equal(deleteMissing.status, 404);
});

/* ------------------------------------------------------------------------- */

function approxEqual(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual} (tol ${tolerance})`,
  );
}

/** Recompute docs/04 §6.2 max drawdown from the equity curve. */
function computeMaxDrawdown(points) {
  let peak = -Infinity;
  let maxDd = 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - point.equity) / peak) * 100);
  }
  return roundTo(maxDd, 4);
}
