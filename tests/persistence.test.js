/**
 * tests/persistence.test.js — docs/06 §8 restart-recovery contract.
 *
 * Verifies that after a graceful process restart with the same DATA_DIR:
 *   - saved strategies are still listed/served;
 *   - historical runs and their JSONL journals survive (list/detail/trades);
 *   - a run that was active when the server stopped is recovered as `stopped`
 *     (never a zombie "running" run).
 *
 * Deterministic: FEED_MODE=off + REPLAY_FIXTURE, random port, temp DATA_DIR.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { fixtureStrategy, writeReplayFixture } from "./fixtures/replay.js";
import {
  makeTempDataDir,
  removeDir,
  startServer,
  waitFor,
} from "./helpers/server.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForStatus(server, runId, statuses, timeoutMs = 20_000) {
  return waitFor(
    async () => {
      const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
      if (res.status !== 200) return null;
      return statuses.includes(res.json?.run?.status) ? res.json : null;
    },
    { timeoutMs, intervalMs: 100, label: `run ${runId} -> ${statuses.join("|")}` },
  );
}

test("restart recovery: strategies + run history persist, active run becomes stopped", async () => {
  const dataDir = await makeTempDataDir("pmw-persist-");
  const fixturePath = await writeReplayFixture(dataDir);
  const env = { FEED_MODE: "off", REPLAY_FIXTURE: fixturePath, DISCOVERY_MS: "3600000" };

  let strategyId;
  let endedRunId;
  let activeRunId;

  /* ------------------------------ first boot ------------------------------ */
  let server = await startServer({ dataDir, env });
  try {
    const strategy = await server.http.post("/api/strategies", fixtureStrategy());
    assert.equal(strategy.status, 201);
    strategyId = strategy.json.strategy.id;

    const ended = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy(),
      replay: { speed: 100 },
    });
    assert.equal(ended.status, 201);
    endedRunId = ended.json.run.id;
    const finished = await waitForStatus(server, endedRunId, ["ended", "stopped", "error"]);
    assert.equal(finished.run.status, "ended");

    // long-running replay (speed 1) so the server is stopped mid-run
    const active = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy({ speed: 1 }),
      replay: { speed: 1 },
    });
    assert.equal(active.status, 201);
    activeRunId = active.json.run.id;
    const running = await waitForStatus(server, activeRunId, ["running", "ended", "stopped", "error"]);
    if (running.run.status !== "running") {
      // fixture may finish before we can stop it; mark the test as data-race
      // tolerant but still require a terminal state.
      await waitForStatus(server, activeRunId, ["ended", "stopped", "error"]);
    }
    const beforeRestart = await server.http.get(`/api/runs/${encodeURIComponent(endedRunId)}/trades`);
    assert.equal(beforeRestart.json.total, 3);
  } finally {
    await server.stop();
  }
  // let the OS release file handles before the second boot
  await delay(300);

  /* ----------------------------- second boot ------------------------------ */
  server = await startServer({ dataDir, env });
  try {
    // strategies survived
    const strategies = await server.http.get("/api/strategies");
    assert.equal(strategies.status, 200);
    assert.ok(
      strategies.json.strategies.some((entry) => entry.id === strategyId),
      "saved strategy must survive a restart",
    );
    const one = await server.http.get(`/api/strategies/${encodeURIComponent(strategyId)}`);
    assert.equal(one.status, 200);
    assert.equal(one.json.strategy.id, strategyId);

    // run index survived
    const runs = await server.http.get("/api/runs");
    assert.equal(runs.status, 200);
    const endedRecord = runs.json.runs.find((run) => run.id === endedRunId);
    assert.ok(endedRecord, "finished run must survive a restart");
    assert.equal(endedRecord.status, "ended");

    // finished run detail + journal-based trades are still available
    const detail = await server.http.get(`/api/runs/${encodeURIComponent(endedRunId)}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.run.status, "ended");
    assert.ok(detail.json.metrics, "metrics persisted for the ended run");
    assert.equal(detail.json.metrics.trades, 3);
    const trades = await server.http.get(`/api/runs/${encodeURIComponent(endedRunId)}/trades`);
    assert.equal(trades.status, 200);
    assert.equal(trades.json.total, 3, "JSONL journal replay after restart");

    // the run that was active during shutdown is recovered as stopped
    const recovered = await server.http.get(`/api/runs/${encodeURIComponent(activeRunId)}`);
    assert.equal(recovered.status, 200);
    assert.ok(
      ["stopped", "ended"].includes(recovered.json.run.status),
      `recovered run status ${recovered.json.run.status} must not be running/starting`,
    );
    if (recovered.json.run.status === "stopped") {
      assert.match(String(recovered.json.run.note ?? ""), /restart|stopped/i);
    }

    // a fresh run still works after recovery
    const fresh = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy(),
      replay: { speed: 100 },
    });
    assert.equal(fresh.status, 201);
    const freshDone = await waitForStatus(server, fresh.json.run.id, ["ended", "stopped", "error"]);
    assert.equal(freshDone.run.status, "ended");
  } finally {
    await server.stop();
    await removeDir(dataDir);
  }
});
