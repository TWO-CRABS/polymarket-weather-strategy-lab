/**
 * tests/api-conformance.test.js — every REST/SSE/static surface of docs/07.
 *
 * Boots the real server with FEED_MODE=off + REPLAY_FIXTURE (temp DATA_DIR,
 * random 88xx port, zero upstream network) and exercises:
 *   health, meta, markets (+history/events), strategies CRUD+validate,
 *   runs create/list/get/stop/delete/trades/equity/signals/positions,
 *   documented error codes/statuses, SSE framing/filtering, static hosting.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import {
  CONTRACT_VERSION,
  DEFAULT_STRATEGY,
  clone,
  calcTakerFee,
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
let savedStrategyId;
let completedRunId;

before(async () => {
  dataDir = await makeTempDataDir("pmw-api-");
  fixturePath = await writeReplayFixture(dataDir);
  server = await startServer({
    dataDir,
    env: { FEED_MODE: "off", REPLAY_FIXTURE: fixturePath, DISCOVERY_MS: "3600000" },
  });
});

after(async () => {
  if (server) await server.stop();
  if (dataDir) await removeDir(dataDir);
});

async function waitForRun(runId, terminal, timeoutMs = 20_000) {
  return waitFor(
    async () => {
      const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
      if (res.status !== 200) return null;
      return terminal.includes(res.json?.run?.status) ? res.json : null;
    },
    { timeoutMs, intervalMs: 100, label: `run ${runId} terminal ${terminal.join("|")}` },
  );
}

function assertErrorEnvelope(res, status, code) {
  assert.equal(res.status, status, `expected HTTP ${status}, got ${res.status}: ${res.text.slice(0, 200)}`);
  assert.ok(res.json && typeof res.json === "object", "error body must be JSON");
  assert.ok(res.json.error && typeof res.json.error === "object", "error envelope `{error:{...}}`");
  assert.equal(res.json.error.code, code);
  assert.equal(typeof res.json.error.message, "string");
  assert.ok(res.json.error.message.length > 0);
}

/* ------------------------------------------------------------------------- */
/* 4.1 health / meta                                                          */
/* ------------------------------------------------------------------------- */

test("GET /api/health returns the documented shape (docs/07 §4.1)", async () => {
  const res = await server.http.get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"].startsWith("application/json"), true);
  const body = res.json;
  assert.equal(body.status, "ok");
  assert.equal(typeof body.now, "number");
  assert.ok(body.now > 1_600_000_000_000);
  assert.equal(typeof body.uptimeSec, "number");
  assert.ok(body.uptimeSec >= 0);
  assert.ok(body.feed && typeof body.feed === "object");
  for (const key of ["status", "marketsTracked", "lastUpdate", "latencyMs"]) {
    assert.ok(key in body.feed, `health.feed.${key} missing`);
  }
  assert.equal(body.feed.status, "offline");
  assert.deepEqual(Object.keys(body.runs).sort(), ["active", "total"]);
});

test("GET /api/meta returns presets/limits/fee model (docs/07 §4.1)", async () => {
  const res = await server.http.get("/api/meta");
  assert.equal(res.status, 200);
  const body = res.json;
  assert.equal(body.contractVersion, CONTRACT_VERSION);
  assert.equal(typeof body.serverTime, "number");
  assert.ok(Array.isArray(body.cities));
  assert.equal(body.presets.length, 3);
  for (const preset of body.presets) {
    assert.equal(typeof preset.id, "string");
    assert.equal(typeof preset.label, "string");
    assert.equal(typeof preset.description, "string");
    assert.equal(typeof preset.config, "object");
    assert.equal(preset.config.fees.takerFeeRate, 0.05);
  }
  assert.equal(body.feeModel.takerFeeRate, 0.05);
  assert.equal(body.feeModel.model, "weather_taker");
  assert.ok(body.limits && body.limits.signal && body.limits.execution);
  assert.deepEqual(body.priceFields, ["mid", "last", "best_bid", "best_ask"]);
  assert.deepEqual(body.directions, ["up", "down", "both"]);
});

/* ------------------------------------------------------------------------- */
/* 4.2 markets / events                                                       */
/* ------------------------------------------------------------------------- */

test("market endpoints + documented 404s (offline mode)", async () => {
  const markets = await server.http.get("/api/markets?city=New%20York&limit=5&includeClosed=true");
  assert.equal(markets.status, 200);
  assert.deepEqual(Object.keys(markets.json).sort(), ["count", "markets", "updatedAt"]);
  assert.ok(Array.isArray(markets.json.markets));
  assert.equal(markets.json.count, 0);

  assertErrorEnvelope(await server.http.get("/api/markets/market_does_not_exist"), 404, "MARKET_NOT_FOUND");
  assertErrorEnvelope(
    await server.http.get("/api/markets/market_does_not_exist/history?seconds=60"),
    404,
    "MARKET_NOT_FOUND",
  );

  const events = await server.http.get("/api/events");
  assert.equal(events.status, 200);
  assert.ok(Array.isArray(events.json.events));
});

/* ------------------------------------------------------------------------- */
/* 4.3 strategies                                                             */
/* ------------------------------------------------------------------------- */

test("strategy CRUD + validate endpoint (docs/07 §4.3)", async () => {
  // validate: valid
  const valid = await server.http.post("/api/strategies/validate", fixtureStrategy());
  assert.equal(valid.status, 200);
  assert.equal(valid.json.valid, true);
  assert.deepEqual(valid.json.errors, []);
  assert.ok(Array.isArray(valid.json.warnings));
  assert.equal(valid.json.normalized.signal.windowSec, 60);

  // validate: degenerate config -> valid with warnings (never blocks)
  const degenerate = await server.http.post(
    "/api/strategies/validate",
    clone({ ...DEFAULT_STRATEGY, signal: { ...DEFAULT_STRATEGY.signal, minAbsMove: 0 } }),
  );
  assert.equal(degenerate.status, 200);
  assert.equal(degenerate.json.valid, true);
  assert.ok(degenerate.json.warnings.length > 0);

  // validate: invalid -> {valid:false, errors:[...]} with HTTP 200
  const invalid = await server.http.post("/api/strategies/validate", {
    signal: { ...clone(DEFAULT_STRATEGY.signal), windowSec: 5 },
  });
  assert.equal(invalid.status, 200);
  assert.equal(invalid.json.valid, false);
  assert.ok(invalid.json.errors.some((message) => message.includes("signal.windowSec")));

  // list (empty at boot)
  const list0 = await server.http.get("/api/strategies");
  assert.equal(list0.status, 200);
  assert.ok(Array.isArray(list0.json.strategies));

  // create
  const create = await server.http.post("/api/strategies", fixtureStrategy());
  assert.equal(create.status, 201);
  const strategy = create.json.strategy;
  assert.match(strategy.id, /^strat_/);
  assert.equal(typeof strategy.name, "string");
  assert.equal(typeof strategy.description, "string");
  assert.equal(typeof strategy.updatedAt, "number");
  assert.equal(strategy.config.signal.windowSec, 60);
  savedStrategyId = strategy.id;

  // get by id
  const get = await server.http.get(`/api/strategies/${encodeURIComponent(strategy.id)}`);
  assert.equal(get.status, 200);
  assert.equal(get.json.strategy.id, strategy.id);

  // list now contains it
  const list1 = await server.http.get("/api/strategies");
  assert.ok(list1.json.strategies.some((entry) => entry.id === strategy.id));

  // update (PUT overwrites)
  const updatedConfig = clone(strategy.config);
  updatedConfig.name = "QA updated strategy";
  updatedConfig.signal.moveThresholdPct = 2;
  const update = await server.http.put(`/api/strategies/${encodeURIComponent(strategy.id)}`, updatedConfig);
  assert.equal(update.status, 200);
  assert.equal(update.json.strategy.name, "QA updated strategy");
  assert.equal(update.json.strategy.config.signal.moveThresholdPct, 2);

  // update invalid -> 400 INVALID_STRATEGY with details
  const badUpdate = await server.http.put(`/api/strategies/${encodeURIComponent(strategy.id)}`, {
    signal: { windowSec: 5 },
  });
  assertErrorEnvelope(badUpdate, 400, "INVALID_STRATEGY");
  assert.ok(Array.isArray(badUpdate.json.error.details));

  // create invalid -> 400 INVALID_STRATEGY
  assertErrorEnvelope(
    await server.http.post("/api/strategies", { signal: { windowSec: 5 } }),
    400,
    "INVALID_STRATEGY",
  );

  // unknown id -> 404
  assertErrorEnvelope(
    await server.http.get("/api/strategies/strat_does_not_exist"),
    404,
    "STRATEGY_NOT_FOUND",
  );
});

test("delete strategy (204) and then GET/UPDATE/DELETE are 404", async () => {
  const del = await server.http.delete(`/api/strategies/${encodeURIComponent(savedStrategyId)}`);
  assert.equal(del.status, 204);
  assert.equal(del.text, "");
  assertErrorEnvelope(
    await server.http.get(`/api/strategies/${encodeURIComponent(savedStrategyId)}`),
    404,
    "STRATEGY_NOT_FOUND",
  );
  assertErrorEnvelope(
    await server.http.put(`/api/strategies/${encodeURIComponent(savedStrategyId)}`, fixtureStrategy()),
    404,
    "STRATEGY_NOT_FOUND",
  );
  assertErrorEnvelope(
    await server.http.delete(`/api/strategies/${encodeURIComponent(savedStrategyId)}`),
    404,
    "STRATEGY_NOT_FOUND",
  );
});

/* ------------------------------------------------------------------------- */
/* 4.4 runs: request validation + documented errors                           */
/* ------------------------------------------------------------------------- */

test("POST /api/runs rejects invalid mode/strategy/strategyId and empty universe", async () => {
  const badMode = await server.http.post("/api/runs", { mode: "paper" });
  assertErrorEnvelope(badMode, 400, "INVALID_MODE");

  const badStrategy = await server.http.post("/api/runs", {
    mode: "replay",
    strategy: { ...fixtureStrategy(), signal: { ...DEFAULT_STRATEGY.signal, windowSec: 5 } },
  });
  assertErrorEnvelope(badStrategy, 400, "INVALID_STRATEGY");
  assert.ok(Array.isArray(badStrategy.json.error.details));

  assertErrorEnvelope(
    await server.http.post("/api/runs", { mode: "replay", strategyId: "strat_does_not_exist" }),
    404,
    "STRATEGY_NOT_FOUND",
  );

  // live mode with FEED_MODE=off has no markets -> documented 409
  assertErrorEnvelope(await server.http.post("/api/runs", { mode: "live" }), 409, "NO_MARKETS");

  // nothing was created
  const list = await server.http.get("/api/runs");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.json.runs));
});

/* ------------------------------------------------------------------------- */
/* 4.4 runs: full lifecycle + sub-resources                                   */
/* ------------------------------------------------------------------------- */

test("replay run lifecycle: create -> running/ended -> trades/equity/signals/positions", async () => {
  const create = await server.http.post("/api/runs", {
    mode: "replay",
    strategy: fixtureStrategy(),
    replay: { speed: 100 },
  });
  assert.equal(create.status, 201);
  const summary = create.json.run;
  assert.match(summary.id, /^run_/);
  completedRunId = summary.id;

  // RunSummary keys documented in docs/07 §3.7
  for (const key of [
    "id", "strategyId", "strategyName", "mode", "status", "startedAt", "endedAt",
    "initialCapital", "equity", "cash", "positionsValue", "metrics", "signalsCount",
    "marketsTracked", "pendingSettlements", "settledPositions", "feedStatus",
  ]) {
    assert.ok(key in summary, `RunSummary.${key} missing`);
  }

  const detail = await waitForRun(summary.id, ["ended", "error", "stopped"]);
  assert.equal(detail.run.status, "ended");
  assert.equal(detail.run.mode, "replay");
  assert.equal(detail.run.initialCapital, 1000);
  assert.equal(detail.run.signalsCount, 2);
  for (const key of ["run", "config", "metrics", "positions"]) {
    assert.ok(key in detail, `run detail.${key} missing`);
  }
  // optional costBreakdown must be internally consistent when present
  if (detail.costBreakdown) {
    assert.equal(typeof detail.costBreakdown.feesPaid, "number");
    assert.equal(typeof detail.costBreakdown.totalFriction, "number");
  }

  // RunSummary via list
  const list = await server.http.get("/api/runs");
  assert.ok(list.json.runs.some((run) => run.id === summary.id));

  // trades
  const trades = await server.http.get(`/api/runs/${encodeURIComponent(summary.id)}/trades`);
  assert.equal(trades.status, 200);
  assert.deepEqual(Object.keys(trades.json).sort(), ["total", "trades"]);
  assert.equal(trades.json.total, 3);
  for (const trade of trades.json.trades) {
    for (const key of [
      "id", "ts", "runId", "marketId", "tokenId", "outcome", "side", "shares", "price",
      "notional", "fee", "slippageCost", "totalCost", "cashDelta", "realizedPnl",
      "signalId", "reason", "status", "rejectReason", "bookLevels",
    ]) {
      assert.ok(key in trade, `Trade.${key} missing`);
    }
    assert.equal(trade.fee, calcTakerFee(trade.shares, trade.price));
  }

  // pagination
  const paged = await server.http.get(`/api/runs/${encodeURIComponent(summary.id)}/trades?limit=1&offset=1`);
  assert.equal(paged.status, 200);
  assert.equal(paged.json.trades.length, 1);
  assert.equal(paged.json.total, 3);

  // equity
  const equity = await server.http.get(`/api/runs/${encodeURIComponent(summary.id)}/equity`);
  assert.equal(equity.status, 200);
  assert.deepEqual(Object.keys(equity.json).sort(), ["points", "total"]);
  assert.ok(equity.json.total >= 10);
  for (const point of equity.json.points) {
    for (const key of ["ts", "equity", "cash", "positionsValue", "realizedPnl", "unrealizedPnl", "drawdownPct"]) {
      assert.ok(key in point, `EquityPoint.${key} missing`);
    }
  }

  // signals
  const signals = await server.http.get(`/api/runs/${encodeURIComponent(summary.id)}/signals`);
  assert.equal(signals.status, 200);
  assert.deepEqual(Object.keys(signals.json).sort(), ["signals", "total"]);
  assert.equal(signals.json.total, 2);
  for (const signal of signals.json.signals) {
    for (const key of [
      "id", "ts", "runId", "marketId", "city", "bracket", "direction", "outcome",
      "tokenId", "fromPrice", "toPrice", "changePct", "absChange", "windowSec",
      "priceField", "reason",
    ]) {
      assert.ok(key in signal, `Signal.${key} missing`);
    }
  }

  // positions (open position from the DOWN leg still marked at end)
  const positions = await server.http.get(`/api/runs/${encodeURIComponent(summary.id)}/positions`);
  assert.equal(positions.status, 200);
  for (const key of ["positions", "positionsValue", "cash", "equity"]) {
    assert.ok(key in positions.json, `positions.${key} missing`);
  }
  assert.ok(Array.isArray(positions.json.positions));
  for (const position of positions.json.positions) {
    for (const key of [
      "marketId", "tokenId", "outcome", "shares", "avgPrice", "costBasis", "midPrice",
      "marketValue", "unrealizedPnl", "entryTs", "entryFee", "estExitFee", "impliedProbability",
    ]) {
      assert.ok(key in position, `Position.${key} missing`);
    }
  }

  // stop is idempotent on a finished run
  const stop = await server.http.post(`/api/runs/${encodeURIComponent(summary.id)}/stop`);
  assert.equal(stop.status, 200);
  assert.equal(stop.json.run.id, summary.id);
});

test("GET /api/runs supports strategyId runs and per-run 404s", async () => {
  // save a strategy and start a run from it
  const create = await server.http.post("/api/strategies", fixtureStrategy());
  assert.equal(create.status, 201);
  const strategyId = create.json.strategy.id;
  const runCreate = await server.http.post("/api/runs", {
    mode: "replay",
    strategyId,
    replay: { speed: 100 },
  });
  assert.equal(runCreate.status, 201);
  assert.equal(runCreate.json.run.strategyId, strategyId);
  assert.equal(runCreate.json.run.strategyName, create.json.strategy.name);

  const runId = runCreate.json.run.id;
  await waitForRun(runId, ["ended", "stopped", "error"]);

  // delete run -> 204 then all sub-resources 404
  const del = await server.http.delete(`/api/runs/${encodeURIComponent(runId)}`);
  assert.equal(del.status, 204);
  for (const sub of ["", "/trades", "/equity", "/signals", "/positions"]) {
    const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}${sub}`);
    assertErrorEnvelope(res, 404, "RUN_NOT_FOUND");
  }
  assertErrorEnvelope(
    await server.http.post(`/api/runs/${encodeURIComponent(runId)}/stop`),
    404,
    "RUN_NOT_FOUND",
  );

  // clean up the saved strategy
  const delStrategy = await server.http.delete(`/api/strategies/${encodeURIComponent(strategyId)}`);
  assert.equal(delStrategy.status, 204);
});

test("POST /api/runs/batch-delete validates input and deletes multiple runs", async () => {
  const ids = [];
  for (let i = 0; i < 2; i += 1) {
    const create = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy(),
      replay: { speed: 100 },
    });
    assert.equal(create.status, 201);
    ids.push(create.json.run.id);
  }
  // invalid bodies
  assertErrorEnvelope(
    await server.http.post("/api/runs/batch-delete", { ids: [] }),
    400,
    "INVALID_BODY",
  );
  assertErrorEnvelope(
    await server.http.post("/api/runs/batch-delete", {
      ids: Array.from({ length: 201 }, (_, i) => `run_overflow_${i}`),
    }),
    400,
    "INVALID_BODY",
  );
  // batch delete: unknown ids are reported, not fatal
  const res = await server.http.post("/api/runs/batch-delete", {
    ids: [...ids, "run_does_not_exist"],
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.deleted.length, 2);
  assert.equal(res.json.failed.length, 1);
  assert.equal(res.json.failed[0].id, "run_does_not_exist");
  assert.equal(res.json.failed[0].reason, "RUN_NOT_FOUND");
  for (const id of ids) {
    assertErrorEnvelope(await server.http.get(`/api/runs/${encodeURIComponent(id)}`), 404, "RUN_NOT_FOUND");
  }
});

/* ------------------------------------------------------------------------- */
/* 5. SSE                                                                     */
/* ------------------------------------------------------------------------- */

test("GET /api/stream: text/event-stream framing, hello/meta, runId filter", async () => {
  const filteredRunId = "run_filter_check";
  const sse = await server.sse(`/api/stream?runId=${filteredRunId}`);
  assert.match(
    sse.response.headers.get("content-type") ?? "",
    /^text\/event-stream/,
    "SSE content type",
  );
  assert.match(sse.response.headers.get("cache-control") ?? "", /no-cache/);

  const events = [];
  const pump = (async () => {
    for (;;) {
      try {
        // eslint-disable-next-line no-await-in-loop
        events.push(await sse.next(null, { timeoutMs: 8_000 }));
      } catch {
        break;
      }
    }
  })();

  try {
    await waitFor(() => events.some((event) => event.event === "hello"), {
      timeoutMs: 5_000, label: "SSE hello",
    });
    await waitFor(() => events.some((event) => event.event === "meta"), {
      timeoutMs: 5_000, label: "SSE meta",
    });
    const hello = events.find((event) => event.event === "hello");
    assert.equal(hello.data.contractVersion, CONTRACT_VERSION);
    assert.equal(typeof hello.data.serverTime, "number");
    const meta = events.find((event) => event.event === "meta");
    assert.ok(Array.isArray(meta.data.presets));
    assert.equal(meta.data.feeModel.takerFeeRate, 0.05);

    // a run created while this filtered stream is open must NOT be delivered:
    // the filter only passes run-scoped events for `filteredRunId`.
    // (Global `log` lines are documented as server logs, not run-scoped, so
    // they are allowed through.)
    const create = await server.http.post("/api/runs", {
      mode: "replay",
      strategy: fixtureStrategy({ speed: 1 }),
    });
    assert.equal(create.status, 201);
    const otherRunId = create.json.run.id;

    await delay(1_200);
    const runScoped = events.filter((event) =>
      ["run", "signal", "trade", "positions", "equity", "metrics"].includes(event.event),
    );
    assert.deepEqual(
      runScoped,
      [],
      `filtered SSE stream received run-scoped events: ${runScoped.map((event) => event.event).join(",")}`,
    );
    assert.ok(events.every((event) => ["hello", "meta", "log", "heartbeat"].includes(event.event)));

    // stop the background run and let it settle
    await server.http.post(`/api/runs/${encodeURIComponent(otherRunId)}/stop`);
  } finally {
    await sse.close();
    await pump.catch(() => {});
  }
});

/* ------------------------------------------------------------------------- */
/* 4.5 static hosting + misc errors                                           */
/* ------------------------------------------------------------------------- */

test("static hosting serves /, /web, /shared, /design with correct MIME", async () => {
  const index = await server.http.get("/");
  assert.equal(index.status, 200);
  assert.match(index.headers["content-type"], /^text\/html/);
  assert.match(index.text, /<!DOCTYPE html>/i);
  assert.match(index.text, /PolyTemp/);

  const appJs = await server.http.get("/web/app.js");
  assert.equal(appJs.status, 200);
  assert.match(appJs.headers["content-type"], /^(text|application)\/javascript/);
  assert.match(appJs.text, /import /);

  const contractJs = await server.http.get("/shared/contract.js");
  assert.equal(contractJs.status, 200);
  assert.match(contractJs.headers["content-type"], /^(text|application)\/javascript/);
  assert.match(contractJs.text, /calcTakerFee/);

  const css = await server.http.get("/web/styles.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /^text\/css/);

  const prototype = await server.http.get("/design/prototype/index.html");
  assert.equal(prototype.status, 200);
  assert.match(prototype.headers["content-type"], /^text\/html/);

  // HEAD works and has no body
  const head = await server.http.request("/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.text, "");
  assert.ok(Number(head.headers["content-length"]) > 0);
});

test("unknown routes, static 404s, traversal and malformed bodies", async () => {
  assertErrorEnvelope(await server.http.get("/api/does-not-exist"), 404, "NOT_FOUND");
  assertErrorEnvelope(await server.http.get("/definitely-not-a-page"), 404, "NOT_FOUND");
  assertErrorEnvelope(await server.http.get("/web/no-such-file.js"), 404, "NOT_FOUND");

  // path traversal must never escape the static roots
  for (const probe of ["/web/%2e%2e/server/index.js", "/web/..%2fserver%2findex.js", "/web/%2e%2e%2fpackage.json"]) {
    const res = await server.http.get(probe);
    assert.ok([404, 403].includes(res.status), `traversal ${probe} returned ${res.status}`);
    assert.ok(res.json?.error?.code, `traversal ${probe} must return a JSON error`);
  }

  // malformed JSON body -> 400 INVALID_BODY
  const malformed = await server.http.request("/api/strategies/validate", {
    method: "POST",
    body: "{not valid json",
    headers: { "content-type": "application/json" },
  });
  assertErrorEnvelope(malformed, 400, "INVALID_BODY");

  // static routes only support GET/HEAD
  assertErrorEnvelope(await server.http.post("/", {}), 405, "METHOD_NOT_ALLOWED");
});
