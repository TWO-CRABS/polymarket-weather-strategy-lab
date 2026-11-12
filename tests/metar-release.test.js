import test from "node:test";
import assert from "node:assert/strict";
import { Portfolio } from "../server/engine/portfolio.js";
import { processMetarRelease } from "../server/engine/metarRelease.js";
import { releaseNodeForCity, isFallbackBlockedAtMetarRelease } from "../server/engine/metarReleaseWindow.js";
import { fallbackBlockedByMetarRelease } from "../server/engine/runTrading.js";

const NODE_NOW = Date.UTC(2026, 10, 12, 10, 0, 30);
const FAKE_STORE = {
  getCity: () => ({ station: "TEST", minuteOffsetsUtc: [0] }),
  getAll: () => ({ TestCity: { station: "TEST", minuteOffsetsUtc: [0] } }),
};

function market(id, bracket, probability, token) {
  return {
    id,
    eventId: "evt-test",
    city: "TestCity",
    bracket,
    conditionId: `0x${id}`,
    closed: false,
    acceptingOrders: true,
    stale: false,
    tokens: { yesTokenId: `${token}y`, noTokenId: `${token}n` },
    quotes: {
      YES: { bid: probability - 0.01, ask: probability + 0.01, mid: probability, last: null },
      NO: { bid: 1 - probability - 0.01, ask: 1 - probability + 0.01, mid: 1 - probability, last: null },
    },
    impliedProbability: probability,
    spread: 0.02,
    liquidityUsd: 1000,
    bookDepthUsd: 1000,
    endDate: "2026-11-12T16:00:00.000Z",
    tradingCutoff: "2026-11-12T16:00:00.000Z",
    tickSize: 0.01,
    minOrderShares: 5,
    feeSchedule: { rate: 0.05 },
  };
}

function makeRun({ now = NODE_NOW, pBase = 0.4, pNow = 0.55, requireRising = true, minPct = 50, hold = true } = {}) {
  const target = market("t1", "35°C", pNow, "t1");
  const other = market("t2", "36°C", 0.3, "t2");
  const books = new Map([
    ["t1y", { asks: [{ price: pNow + 0.01, size: 1000 }], bids: [{ price: pNow - 0.01, size: 1000 }], bestAsk: pNow + 0.01, bestBid: pNow - 0.01 }],
    ["t1n", { asks: [], bids: [{ price: 1 - pNow - 0.01, size: 1000 }], bestAsk: 0, bestBid: 1 - pNow - 0.01 }],
    ["t2y", { asks: [], bids: [{ price: 0.29, size: 1000 }], bestAsk: 0, bestBid: 0.29 }],
    ["t2n", { asks: [], bids: [], bestAsk: 0, bestBid: 0 }],
  ]);
  const portfolio = new Portfolio({ initialCapital: 1000, feeRate: 0.05 });
  portfolio.buy({
    tokenId: "t1n", marketId: "t1", outcome: "NO", city: "TestCity", bracket: "35°C",
    shares: 10, price: 0.45, fee: 0, ts: now - 10_000, midPrice: 0.45,
  });
  portfolio.buy({
    tokenId: "t2y", marketId: "t2", outcome: "YES", city: "TestCity", bracket: "36°C",
    shares: 10, price: 0.3, fee: 0, ts: now - 10_000, midPrice: 0.3,
  });
  const run = {
    id: "run_metar_test",
    status: "running",
    killSwitchTripped: false,
    ticks: 1,
    startedAt: now - 600_000,
    marketIds: ["t1", "t2"],
    markets: new Map([["t1", target], ["t2", other]]),
    portfolio,
    signals: [],
    trades: [],
    filledTradeCount: 0,
    _spreadCost: 0,
    _depthSlippageCost: 0,
    peakEquity: 1000,
    sampleEquity: () => {},
    source: {
      getBook: (tokenId) => books.get(tokenId) || null,
      getHistory: (tokenId) => (tokenId === "t1y"
        ? [
            { ts: now - 120_000, bid: pBase - 0.01, ask: pBase + 0.01, mid: pBase },
            { ts: now - 1_000, bid: pNow - 0.01, ask: pNow + 0.01, mid: pNow },
          ]
        : []),
    },
    store: { appendRecord: () => {} },
    sse: { broadcast: () => {} },
    currentMetrics: () => ({}),
    config: {
      universe: { minPrice: 0.001, maxPrice: 0.999, minLiquidityUsd: 0, maxSpread: 0.2, minTimeToResolutionSec: 0, maxTimeToResolutionSec: 1_000_000 },
      signal: {
        priceField: "mid", windowSec: 60, moveThresholdPct: 20, minAbsMove: 0.01, direction: "both",
        confirmationTicks: 1, cooldownSec: 0, maxSignalsPerMarket: 100, recordObservation: true,
        metarReleaseEnabled: true, metarReleaseWindowSec: 120, metarReleaseMinProbabilityPct: minPct,
        metarReleaseRequireRising: requireRising, copyTraderEnabled: false, copyTraderUser: "",
        copyTraderFallbackDelaySec: 30, copyTraderMinReactionRatePct: 90,
      },
      execution: { sizingMode: "fixed_stake", sizingValue: 100, maxPositionUsd: 100, maxPositions: 10, maxPositionsPerMarket: 1, slippageBufferBps: 0, fallbackAllowInMetarWindow: false },
      exit: { holdToResolution: hold, takeProfitPct: 50, stopLossPct: 30, maxHoldSec: 3600, exitOnOppositeSignal: false },
      risk: { bankrollUsd: 1000, maxDrawdownPct: 100, dailyLossLimitUsd: 0, killSwitch: false },
      fees: { takerFeeRate: 0.05 },
      sim: { tickIntervalMs: 1000 },
    },
    _metarReleaseState: new Map(),
    _metarReleaseLockedGroups: new Set(),
  };
  return { run, target, other };
}

test("METAR release helper finds configurable window and honours city nodes", () => {
  assert.equal(releaseNodeForCity("TestCity", NODE_NOW, 120, FAKE_STORE)?.nodeTs, Date.UTC(2026, 10, 12, 10, 0, 0));
  assert.equal(releaseNodeForCity("TestCity", NODE_NOW + 121_000, 120, FAKE_STORE), null);
  assert.equal(releaseNodeForCity("Hong Kong", NODE_NOW, 120, FAKE_STORE), null);
  assert.equal(isFallbackBlockedAtMetarRelease("TestCity", NODE_NOW, 300, FAKE_STORE), true);
  const exactNode = Date.UTC(2026, 10, 12, 10, 0, 0);
  assert.equal(isFallbackBlockedAtMetarRelease("TestCity", exactNode + 300_000, 300, FAKE_STORE), true);
  assert.equal(isFallbackBlockedAtMetarRelease("TestCity", exactNode + 300_001, 300, FAKE_STORE), false);
  assert.equal(isFallbackBlockedAtMetarRelease("Hong Kong", NODE_NOW, 300, FAKE_STORE), false);
});

test("fallback guard respects allow switch and disabled release signal", () => {
  const run = (enabled, allow) => ({
    config: {
      signal: { metarReleaseEnabled: enabled },
      execution: { fallbackAllowInMetarWindow: allow },
    },
  });
  const shenzhenNode = Date.UTC(2026, 10, 12, 10, 0, 0);
  assert.equal(fallbackBlockedByMetarRelease(run(true, false), { city: "Shenzhen" }, shenzhenNode), true);
  assert.equal(fallbackBlockedByMetarRelease(run(true, true), { city: "Shenzhen" }, shenzhenNode), false);
  assert.equal(fallbackBlockedByMetarRelease(run(false, false), { city: "Shenzhen" }, shenzhenNode), false);
  assert.equal(fallbackBlockedByMetarRelease(run(true, false), { city: "Shenzhen" }, shenzhenNode + 300_001), false);
});

test("release signal buys the rising > threshold YES and rotates target NO/other YES", async () => {
  const { run } = makeRun();
  await processMetarRelease(run, NODE_NOW, { store: FAKE_STORE });
  assert.equal(run.signals.length, 1);
  assert.equal(run.signals[0].reason, "metar_release");
  assert.equal(run.signals[0].outcome, "YES");
  assert.ok(run.portfolio.positionsForMarket("t1").some((p) => p.outcome === "YES"));
  assert.equal(run.portfolio.positionsForMarket("t1").some((p) => p.outcome === "NO"), false);
  assert.equal(run.portfolio.positionsForMarket("t2").length, 0);
  assert.ok(run.trades.some((t) => t.reason === "metar_release_rotate" && t.side === "SELL"));
  assert.ok(run.trades.some((t) => t.reason === "metar_release" && t.side === "BUY"));
});

test("release signal is not created when probability is flat or outside the node window", async () => {
  const flat = makeRun({ pBase: 0.55, pNow: 0.55 });
  await processMetarRelease(flat.run, NODE_NOW, { store: FAKE_STORE });
  assert.equal(flat.run.signals.length, 0);

  const outside = makeRun();
  await processMetarRelease(outside.run, NODE_NOW + 121_000, { store: FAKE_STORE });
  assert.equal(outside.run.signals.length, 0);
});

test("user-configured probability threshold and rising toggle are honoured", async () => {
  const offRising = makeRun({ pBase: 0.55, pNow: 0.55, requireRising: false, minPct: 50 });
  await processMetarRelease(offRising.run, NODE_NOW, { store: FAKE_STORE });
  assert.equal(offRising.run.signals.length, 1);

  const highThreshold = makeRun({ pBase: 0.4, pNow: 0.55, minPct: 60 });
  await processMetarRelease(highThreshold.run, NODE_NOW, { store: FAKE_STORE });
  assert.equal(highThreshold.run.signals.length, 0);
});
