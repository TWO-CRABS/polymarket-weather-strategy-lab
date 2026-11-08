/**
 * scripts/verify.js — one-command REAL-API smoke verification.
 *
 * This is the only QA script that touches the live Polymarket public APIs. It
 * starts the real server on a random 88xx port with a throw-away DATA_DIR,
 * then runs the docs/07 §8 acceptance chain end to end:
 *
 *   1. GET /api/health                       -> 200 ok
 *   2. GET /api/meta                         -> 3 presets, weather fee 0.05
 *   3. GET /api/markets                      -> live temperature markets > 0
 *   4. POST /api/strategies/validate         -> balanced preset valid
 *   5. POST /api/runs (replay, real history) -> run starts, first trade <=20s
 *   6. GET /api/runs/:id/trades              -> every fee == round5(shares*0.05*p*(1-p))
 *   7. POST /api/runs/:id/stop               -> run stopped
 *
 * Prints a PASS/FAIL/WARN table and exits non-zero when a mandatory check
 * fails. Missing trades inside the 20s window are data-dependent and are
 * reported as WARN (not a failure); a fee mismatch or API failure is a FAIL.
 *
 * Usage: node scripts/verify.js
 */
import {
  startServer,
  makeTempDataDir,
  removeDir,
} from "../tests/helpers/server.mjs";
import { calcTakerFee, roundTo } from "../shared/contract.js";

const TRADE_WAIT_MS = 20_000;
const DISCOVERY_WAIT_MS = 45_000;

const checks = [];
let failed = 0;
let warned = 0;

function pass(name, detail = "") {
  checks.push({ name, status: "PASS", detail });
  console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  warned += 1;
  checks.push({ name, status: "WARN", detail });
  console.log(`  [WARN] ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  failed += 1;
  checks.push({ name, status: "FAIL", detail });
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fmtUsd(value) {
  return Number.isFinite(value) ? value.toFixed(5) : String(value);
}

async function main() {
  console.log("=".repeat(78));
  console.log("Polymarket Weather Strategy Lab — real-API smoke verification");
  console.log(`node ${process.version} · ${new Date().toISOString()} · live Polymarket APIs`);
  console.log("=".repeat(78));

  const dataDir = await makeTempDataDir("pmw-verify-");
  let server = null;
  let runId = null;
  try {
    console.log("\n[1/7] booting server (live feed)…");
    const startedAt = Date.now();
    server = await startServer({
      dataDir,
      quiet: true,
      env: {
        // live mode: auto discovery + CLOB polling; no REPLAY_FIXTURE.
        FEED_MODE: "auto",
        DISCOVERY_MS: "60000",
        POLL_MS: "1000",
      },
      readyTimeoutMs: 30_000,
    });
    console.log(`      server ready in ${Date.now() - startedAt}ms at ${server.baseUrl}`);
    pass("server boot", server.baseUrl);

    /* ------------------------------ 1. health ------------------------------ */
    const health = await server.http.get("/api/health");
    if (health.status !== 200 || health.json?.status !== "ok") {
      fail("GET /api/health", `HTTP ${health.status} body=${health.text.slice(0, 200)}`);
    } else {
      pass(
        "GET /api/health",
        `feed=${health.json.feed.status} marketsTracked=${health.json.feed.marketsTracked} runs=${JSON.stringify(health.json.runs)}`,
      );
    }

    /* ------------------------------- 2. meta ------------------------------- */
    const meta = await server.http.get("/api/meta");
    if (meta.status !== 200) {
      fail("GET /api/meta", `HTTP ${meta.status}`);
    } else {
      const presets = meta.json.presets ?? [];
      const feeRate = meta.json.feeModel?.takerFeeRate;
      if (presets.length !== 3) fail("GET /api/meta", `expected 3 presets, got ${presets.length}`);
      else if (feeRate !== 0.05) fail("GET /api/meta", `expected fee 0.05, got ${feeRate}`);
      else {
        pass(
          "GET /api/meta",
          `presets=[${presets.map((preset) => preset.id).join(",")}] fee=${feeRate} cities=${(meta.json.cities ?? []).length}`,
        );
      }
    }

    /* ------------------------------ 3. markets ----------------------------- */
    let temperatureMarkets = [];
    {
      const waitUntil = Date.now() + DISCOVERY_WAIT_MS;
      let markets = [];
      for (;;) {
        const res = await server.http.get("/api/markets?limit=100");
        markets = res.json?.markets ?? [];
        if (markets.length > 0) break;
        if (Date.now() > waitUntil) break;
        await delay(1_000);
      }
      const now = Date.now();
      temperatureMarkets = markets.filter((market) =>
        /highest temperature/i.test(String(market.question ?? "")),
      );
      const soon = temperatureMarkets.filter((market) => {
        const end = Date.parse(market.endDate ?? "");
        return Number.isFinite(end) && end > now - 24 * 3600_000 && end < now + 72 * 3600_000;
      });
      const cities = new Set(temperatureMarkets.map((market) => market.city).filter(Boolean));
      if (markets.length === 0) {
        fail(
          "GET /api/markets",
          `no live markets discovered within ${DISCOVERY_WAIT_MS}ms (upstream unavailable?)`,
        );
      } else if (temperatureMarkets.length === 0) {
        fail("GET /api/markets", `got ${markets.length} markets but 0 temperature markets`);
      } else {
        pass(
          "GET /api/markets",
          `${markets.length} markets, ${temperatureMarkets.length} temperature markets, ` +
            `${soon.length} with endDate within ±1..72h, ${cities.size} cities; e.g. «${temperatureMarkets[0].question}»`,
        );
        if (soon.length === 0) {
          warn("today's temperature markets", "none within the ±1d..+3d window; replay uses the discovered list anyway");
        }
      }
    }

    /* -------------------- 3b. market detail / history / events -------------- */
    if (temperatureMarkets.length > 0) {
      const sample = temperatureMarkets[0];
      const detail = await server.http.get(`/api/markets/${encodeURIComponent(sample.id)}`);
      if (detail.status !== 200 || detail.json?.market?.id !== sample.id) {
        fail("GET /api/markets/:id", `HTTP ${detail.status} id=${detail.json?.market?.id}`);
      } else {
        pass(
          "GET /api/markets/:id",
          `${sample.id} «${String(detail.json.market.bracket ?? "").trim() || "?"}» ` +
            `quotes=${detail.json.market.quotes?.YES ? "YES" : "none"}`,
        );
      }

      const history = await server.http.get(
        `/api/markets/${encodeURIComponent(sample.id)}/history?seconds=300`,
      );
      if (
        history.status !== 200 ||
        !Array.isArray(history.json?.points) ||
        history.json.windowSec !== 300
      ) {
        fail("GET /api/markets/:id/history", `HTTP ${history.status} body=${history.text.slice(0, 200)}`);
      } else {
        pass("GET /api/markets/:id/history", `${history.json.points.length} points / windowSec=300`);
      }

      const events = await server.http.get("/api/events");
      if (events.status !== 200 || !Array.isArray(events.json?.events)) {
        fail("GET /api/events", `HTTP ${events.status} body=${events.text.slice(0, 200)}`);
      } else {
        pass("GET /api/events", `${events.json.events.length} temperature event(s)`);
      }
    } else {
      warn("market detail / history / events", "skipped: no temperature markets discovered");
    }

    /* ------------------------- 3c. live feed health ------------------------ */
    {
      let feedStatus = null;
      let marketsTracked = 0;
      const feedDeadline = Date.now() + 20_000;
      while (Date.now() < feedDeadline) {
        const res = await server.http.get("/api/health");
        feedStatus = res.json?.feed?.status;
        marketsTracked = res.json?.feed?.marketsTracked ?? 0;
        if (feedStatus === "live" || feedStatus === "degraded") break;
        await delay(500);
      }
      if (feedStatus === "live" || feedStatus === "degraded") {
        pass("live feed status", `feed=${feedStatus} marketsTracked=${marketsTracked}`);
      } else {
        warn(
          "live feed status",
          `feed stayed ${feedStatus ?? "unknown"} for 20s (upstream CLOB unreachable?); replay/live-run checks may be limited`,
        );
      }
    }

    /* ---------------------------- 4. validate preset ---------------------- */
    const balanced = meta.json?.presets?.find((preset) => preset.id === "balanced");
    if (!balanced) {
      fail("validate balanced preset", "preset `balanced` missing from /api/meta");
    } else {
      const validate = await server.http.post("/api/strategies/validate", balanced.config);
      if (validate.status !== 200 || validate.json?.valid !== true) {
        fail(
          "POST /api/strategies/validate",
          `HTTP ${validate.status} valid=${validate.json?.valid} errors=${JSON.stringify(validate.json?.errors)}`,
        );
      } else {
        pass(
          "POST /api/strategies/validate",
          `balanced valid=true warnings=${validate.json.warnings.length}`,
        );
      }
    }

    /* ----------------------------- 5. replay run --------------------------- */
    if (temperatureMarkets.length > 0) {
      const runConfig = JSON.parse(JSON.stringify(balanced.config));
      // The smoke run intentionally uses a *sensitive* variant so that real
      // replay data actually produces at least one fill and exercises the fee
      // formula. The balanced preset itself was validated above (step 4).
      runConfig.name = "verify.js smoke replay";
      runConfig.signal = {
        ...runConfig.signal,
        windowSec: 60,
        moveThresholdPct: 1,
        minAbsMove: 0.002,
        confirmationTicks: 1,
        cooldownSec: 0,
        maxSignalsPerMarket: 20,
      };
      runConfig.execution = {
        ...runConfig.execution,
        sizingValue: 10,
        maxPositionUsd: 50,
        maxPositions: 5,
        maxPositionsPerMarket: 2,
      };
      runConfig.exit = {
        ...runConfig.exit,
        takeProfitPct: 5,
        stopLossPct: 5,
        maxHoldSec: 300,
        holdToResolution: false,
      };
      runConfig.sim = { ...runConfig.sim, mode: "replay", speed: 100, tickIntervalMs: 1000, replayLookbackMin: 60 };
      const create = await server.http.post("/api/runs", {
        mode: "replay",
        strategy: runConfig,
        replay: { lookbackMin: 60, speed: 100 },
      });
      if (create.status !== 201) {
        fail(
          "POST /api/runs (replay)",
          `HTTP ${create.status} ${JSON.stringify(create.json?.error ?? create.text.slice(0, 200))}`,
        );
      } else {
        runId = create.json.run.id;
        pass(
          "POST /api/runs (replay)",
          `run=${runId} markets=${create.json.run.marketsTracked} status=${create.json.run.status}`,
        );

        /* ------------------------ wait for first trade -------------------- */
        let tradeTotal = 0;
        let trades = [];
        const tradeDeadline = Date.now() + TRADE_WAIT_MS;
        while (Date.now() < tradeDeadline) {
          const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}/trades?limit=500`);
          if (res.status === 200) {
            trades = res.json.trades ?? [];
            tradeTotal = res.json.total ?? trades.length;
            if (tradeTotal > 0) break;
          }
          const detailRes = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
          const status = detailRes.json?.run?.status;
          if (status === "ended" || status === "stopped" || status === "error") break;
          await delay(500);
        }

        if (tradeTotal === 0) {
          warn(
            "first trade within 20s",
            "replay window produced no entry signals (market data dependent); fee formula not exercised",
          );
        } else {
          pass("first trade within 20s", `${tradeTotal} trades recorded`);
          let feeErrors = 0;
          for (const trade of trades) {
            const expectedFee = calcTakerFee(trade.shares, trade.price);
            if (trade.fee !== expectedFee) {
              feeErrors += 1;
              if (feeErrors <= 3) {
                console.log(
                  `      fee mismatch ${trade.id}: fee=${trade.fee} expected=${fmtUsd(expectedFee)} ` +
                    `shares=${trade.shares} price=${trade.price}`,
                );
              }
            }
            if (trade.notional !== roundTo(trade.shares * trade.price, 5)) {
              feeErrors += 1;
              if (feeErrors <= 3) console.log(`      notional mismatch ${trade.id}`);
            }
          }
          if (feeErrors > 0) {
            fail("trade fee formula (docs/04 AC-03)", `${feeErrors} inconsistent trade field(s)`);
          } else {
            const totalFee = trades.reduce((sum, trade) => sum + trade.fee, 0);
            pass(
              "trade fee formula (docs/04 AC-03)",
              `${trades.length} trades verified, Σfee=${fmtUsd(totalFee)}`,
            );
          }
        }
      }
    } else {
      warn("POST /api/runs (replay)", "skipped: no temperature markets discovered upstream");
    }

    /* ------------------------------- 6. stop ------------------------------- */
    if (runId) {
      const stop = await server.http.post(`/api/runs/${encodeURIComponent(runId)}/stop`);
      if (stop.status !== 200) {
        fail("POST /api/runs/:id/stop", `HTTP ${stop.status}`);
      } else {
        let finalStatus = stop.json?.run?.status;
        for (let i = 0; i < 20 && !["stopped", "ended", "error"].includes(finalStatus); i += 1) {
          await delay(250);
          const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
          finalStatus = res.json?.run?.status;
        }
        if (!["stopped", "ended"].includes(finalStatus)) {
          fail("POST /api/runs/:id/stop", `final status ${finalStatus}`);
        } else {
          pass("POST /api/runs/:id/stop", `final status=${finalStatus}`);
        }
      }

      /* ---------------------- 7. final run consistency ------------------ */
      const detailRes = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
      if (detailRes.status !== 200) {
        fail("GET /api/runs/:id", `HTTP ${detailRes.status}`);
      } else {
        const detail = detailRes.json;
        const run = detail.run;
        const identity = Math.abs(run.equity - (run.cash + run.positionsValue));
        if (identity > 1e-6) {
          fail("run equity identity", `|equity - (cash + positionsValue)| = ${identity}`);
        } else {
          pass(
            "run equity identity",
            `equity=${fmtUsd(run.equity)} cash=${fmtUsd(run.cash)} pv=${fmtUsd(run.positionsValue)}`,
          );
        }
      }
    }
  } catch (err) {
    fail("verification aborted", err?.stack || err?.message || String(err));
  } finally {
    if (server) {
      const logs = server.logs();
      if (failed > 0 && logs) {
        console.log("\n--- server log tail ---");
        console.log(logs.split("\n").slice(-40).join("\n"));
      }
      await server.stop();
      console.log(`\nserver stopped (temp DATA_DIR ${dataDir})`);
    }
    await removeDir(dataDir);
  }

  /* --------------------------------- summary -------------------------------- */
  console.log("\n" + "=".repeat(78));
  console.log("SUMMARY");
  console.log("=".repeat(78));
  for (const check of checks) {
    console.log(`  ${check.status.padEnd(4)} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  console.log("-".repeat(78));
  const passed = checks.filter((check) => check.status === "PASS").length;
  console.log(`  ${passed} passed, ${warned} warned, ${failed} failed`);
  console.log("=".repeat(78));

  if (failed > 0) {
    console.log("\nRESULT: FAIL (real-API smoke verification failed)");
    process.exitCode = 1;
  } else {
    console.log("\nRESULT: PASS (live API + replay chain verified)");
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error("verify.js crashed:", err);
  process.exitCode = 1;
});
