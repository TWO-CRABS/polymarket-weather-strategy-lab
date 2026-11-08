/**
 * tests/fixtures/replay.js — deterministic REPLAY_FIXTURE builder.
 *
 * Writes the JSON schema documented in server/data/replay.js:
 *   { asOf?, markets: [...], series: { <tokenId>: [{ts, mid|bid/ask}] } }
 *
 * Scenario (two NYC brackets, 60s buckets, timeline = asOf-10m .. asOf-1m):
 *  market A: 0.30 flat, then +20% to 0.36 at t=asOf-5m (UP -> BUY YES),
 *            then 0.60 at t=asOf-4m -> +54% net vs cost -> take_profit SELL.
 *  market B: 0.70 flat, then -20% to 0.56 at t=asOf-5m (DOWN -> BUY NO),
 *            no exit -> position open when the replay timeline is exhausted.
 *
 * No network, no clock: every timestamp is derived from FIXED_NOW.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { FIXED_NOW, clone } from "./builders.js";

export const REPLAY_STEP_MS = 60_000;
export const REPLAY_POINTS = 10;

/** Epoch ms of the first replay point (asOf - 10 minutes). */
export const REPLAY_START_TS = FIXED_NOW - REPLAY_POINTS * REPLAY_STEP_MS;

/** Build the deterministic replay fixture object. */
export function buildReplayFixture() {
  const at = (minuteOffset) => REPLAY_START_TS + minuteOffset * REPLAY_STEP_MS;
  const yesA = [
    0.3, 0.3, 0.3, 0.3, 0.3, // t = -10m .. -6m (flat reference)
    0.36, // t = -5m  (+20% -> UP signal -> BUY YES)
    0.6, 0.6, 0.6, 0.6, // t = -4m .. -1m (+54% net -> take_profit SELL)
  ];
  const yesB = [
    0.7, 0.7, 0.7, 0.7, 0.7,
    0.56, // t = -5m  (-20% -> DOWN signal -> BUY NO)
    0.56, 0.56, 0.56, 0.56,
  ];

  return {
    asOf: FIXED_NOW,
    markets: [
      {
        id: "fix-nyc-13c",
        city: "New York",
        station: "KLGA",
        bracket: "13°C",
        question: "Will the highest temperature in New York be 13°C on November 8?",
        tokens: { yesTokenId: "fix-yes-a", noTokenId: "fix-no-a" },
        tickSize: 0.001,
        minOrderShares: 5,
        endDate: new Date(FIXED_NOW + 24 * 3600 * 1000).toISOString(),
        liquidityUsd: 10_000,
        spread: 0.01,
        negRisk: true,
        feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
      },
      {
        id: "fix-nyc-12c",
        city: "New York",
        station: "KLGA",
        bracket: "12°C",
        question: "Will the highest temperature in New York be 12°C on November 8?",
        tokens: { yesTokenId: "fix-yes-b", noTokenId: "fix-no-b" },
        tickSize: 0.001,
        minOrderShares: 5,
        endDate: new Date(FIXED_NOW + 24 * 3600 * 1000).toISOString(),
        liquidityUsd: 10_000,
        spread: 0.01,
        negRisk: true,
        feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true },
      },
    ],
    series: {
      "fix-yes-a": yesA.map((mid, index) => ({ ts: at(index), mid })),
      "fix-yes-b": yesB.map((mid, index) => ({ ts: at(index), mid })),
      // NO series omitted on purpose: the server derives 1 - YES.
    },
  };
}

/** Write the fixture JSON into `dir` and return its absolute path. */
export async function writeReplayFixture(dir, fileName = "replay-fixture.json") {
  const fixturePath = path.join(dir, fileName);
  await fs.writeFile(fixturePath, `${JSON.stringify(buildReplayFixture(), null, 2)}\n`, "utf8");
  return fixturePath;
}

/**
 * Strategy tuned for the fixture: tiny threshold so the moves are detected,
 * single confirmation tick, no cooldown, book-walk market orders.
 * @param {{bankrollUsd?: number, speed?: number, overrides?: object}} [opts]
 */
export function fixtureStrategy(opts = {}) {
  const base = {
    version: 1,
    name: "QA replay fixture",
    description: "deterministic integration fixture",
    universe: {
      cities: [],
      maxMarkets: 2,
      minPrice: 0.02,
      maxPrice: 0.98,
      minLiquidityUsd: 0,
      maxSpread: 0.05,
      minTimeToResolutionSec: 900,
      maxTimeToResolutionSec: 129_600,
      onlyAcceptingOrders: true,
    },
    signal: {
      priceField: "mid",
      windowSec: 60,
      moveThresholdPct: 1,
      minAbsMove: 0,
      direction: "both",
      confirmationTicks: 1,
      cooldownSec: 0,
      maxSignalsPerMarket: 10,
      requireSpreadOk: true,
    },
    execution: {
      orderType: "market",
      sizingMode: "fixed_stake",
      sizingValue: 25,
      maxPositionUsd: 50,
      maxPositions: 5,
      maxPositionsPerMarket: 2,
      fillModel: "book_walk",
      slippageBufferBps: 0,
    },
    exit: {
      takeProfitPct: 50,
      stopLossPct: 30,
      maxHoldSec: 86_400,
      holdToResolution: false,
      exitOnOppositeSignal: false,
    },
    risk: {
      bankrollUsd: opts.bankrollUsd ?? 1_000,
      maxDrawdownPct: 20,
      dailyLossLimitUsd: 100,
      killSwitch: true,
    },
    fees: { model: "weather_taker", takerFeeRate: 0.05 },
    sim: {
      mode: "replay",
      tickIntervalMs: 1_000,
      replayLookbackMin: 5,
      speed: opts.speed ?? 100,
    },
  };
  return clone(merge(base, opts.overrides));
}

/** Minimal deep merge used only inside the fixture module. */
function merge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value)
      ? merge(base?.[key] && typeof base[key] === "object" ? base[key] : {}, value)
      : value;
  }
  return out;
}

export default { buildReplayFixture, writeReplayFixture, fixtureStrategy, REPLAY_START_TS, REPLAY_STEP_MS };
