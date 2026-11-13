import test from "node:test";
import assert from "node:assert/strict";
import { Portfolio } from "../server/engine/portfolio.js";
import { processCopyTrades } from "../server/engine/copyTrade.js";

const NODE_NOW = Date.UTC(2026, 10, 12, 10, 0, 0);
const FAKE_STORE = { getCity: () => ({ station: "TEST", minuteOffsetsUtc: [0] }), getAll: () => ({}) };
const PRIMARY = "0x1111111111111111111111111111111111111111";
const SUB = "0x2222222222222222222222222222222222222222";

function makeRun({ copyUser = PRIMARY, trades = [], withPosition = false, subscribe = true } = {}) {
  const market = {
    id: "t1",
    eventId: "evt",
    city: "TestCity",
    bracket: "35°C",
    conditionId: "0xcondition",
    closed: false,
    acceptingOrders: true,
    stale: false,
    tokens: { yesTokenId: "t1y", noTokenId: "t1n" },
    quotes: {
      YES: { bid: 0.54, ask: 0.56, mid: 0.55, last: null },
      NO: { bid: 0.44, ask: 0.46, mid: 0.45, last: null },
    },
    impliedProbability: 0.55,
    spread: 0.02,
    liquidityUsd: 1000,
    bookDepthUsd: 1000,
    endDate: "2026-11-12T16:00:00.000Z",
    tradingCutoff: "2026-11-12T16:00:00.000Z",
    tickSize: 0.01,
    minOrderShares: 5,
    feeSchedule: { rate: 0.05 },
  };
  const books = new Map([
    ["t1y", { asks: [{ price: 0.56, size: 1000 }], bids: [{ price: 0.54, size: 1000 }], bestAsk: 0.56, bestBid: 0.54 }],
    ["t1n", { asks: [], bids: [{ price: 0.44, size: 1000 }], bestAsk: 0, bestBid: 0.44 }],
  ]);
  const portfolio = new Portfolio({ initialCapital: 1000, feeRate: 0.05 });
  if (withPosition) {
    portfolio.buy({
      tokenId: "t1y", marketId: "t1", outcome: "YES", city: "TestCity", bracket: "35°C",
      shares: 10, price: 0.5, fee: 0, ts: NODE_NOW - 10_000, midPrice: 0.54,
    });
  }
  const run = {
    id: "run_copy_test",
    mode: "live",
    status: "running",
    killSwitchTripped: false,
    startedAt: NODE_NOW - 600_000,
    marketIds: subscribe ? ["t1"] : ["other"],
    markets: new Map([["t1", market]]),
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
      getPublicTrades: async ({ user }) => ({
        data: trades.filter((trade) => trade.proxy_wallet === user),
      }),
    },
    store: { appendRecord: () => {} },
    sse: { broadcast: () => {} },
    currentMetrics: () => ({}),
    config: {
      universe: { minPrice: 0.001, maxPrice: 0.999, minLiquidityUsd: 0, maxSpread: 0.2, minTimeToResolutionSec: 0, maxTimeToResolutionSec: 1_000_000 },
      signal: {
        priceField: "mid", windowSec: 60, moveThresholdPct: 20, minAbsMove: 0.01, direction: "both",
        confirmationTicks: 1, cooldownSec: 0, maxSignalsPerMarket: 100, recordObservation: true,
        metarReleaseEnabled: true, metarReleaseWindowSec: 120, metarReleaseMinProbabilityPct: 50,
        metarReleaseRequireRising: true, copyTraderEnabled: true, copyTraderUser: copyUser,
        copyTraderFallbackDelaySec: 30, copyTraderMinReactionRatePct: 90,
      },
      execution: { sizingMode: "fixed_stake", sizingValue: 100, maxPositionUsd: 100, maxPositions: 10, maxPositionsPerMarket: 1, slippageBufferBps: 0, fallbackAllowInMetarWindow: false },
      exit: { holdToResolution: true, takeProfitPct: 50, stopLossPct: 30, maxHoldSec: 3600, exitOnOppositeSignal: false },
      risk: { bankrollUsd: 1000, maxDrawdownPct: 100, dailyLossLimitUsd: 0, killSwitch: false },
      fees: { takerFeeRate: 0.05 },
      sim: { tickIntervalMs: 1000 },
    },
    _copyTradeSeen: new Set(),
    _copyTradeLastPoll: 0,
    _copyPrimaryNode: null,
  };
  return run;
}

function trade({ wallet = PRIMARY, side = "BUY", outcome = "Yes", tokenId = "t1y", condition = "0xcondition" } = {}) {
  return {
    proxy_wallet: wallet,
    side,
    token_id: tokenId,
    condition_id: condition,
    timestamp: Math.floor(NODE_NOW / 1000),
    outcome,
    price: 0.55,
    transaction_hash: `0x${Math.random().toString(16).slice(2)}`,
  };
}

test("copy trade buys a subscribed weather market with normal risk", async () => {
  const run = makeRun({ trades: [trade()] });
  await processCopyTrades(run, NODE_NOW, { store: FAKE_STORE, substitutes: [] });
  assert.equal(run.signals.length, 1);
  assert.equal(run.signals[0].reason, "copy_trade");
  assert.ok(run.portfolio.positionsForMarket("t1").some((p) => p.outcome === "YES"));
});

test("copy SELL only follows when the token is held", async () => {
  const run = makeRun({ trades: [trade({ side: "SELL" })], withPosition: true });
  await processCopyTrades(run, NODE_NOW, { store: FAKE_STORE, substitutes: [] });
  assert.equal(run.portfolio.positionsForMarket("t1").length, 0);
  assert.ok(run.trades.some((t) => t.reason === "copy_trade" && t.side === "SELL"));
});

test("copy trade ignores non-subscribed markets", async () => {
  const run = makeRun({ trades: [trade({ condition: "0xother" })], subscribe: false });
  await processCopyTrades(run, NODE_NOW, { store: FAKE_STORE, substitutes: [] });
  assert.equal(run.signals.length, 0);
});

test("substitute is used after primary silence delay", async () => {
  const run = makeRun({ trades: [trade({ wallet: SUB })] });
  await processCopyTrades(run, NODE_NOW + 31_000, { store: FAKE_STORE, substitutes: [SUB] });
  assert.equal(run.signals.length, 1);
  assert.equal(run.signals[0].copySource, "substitute");
});

test("only one substitute is copied for the same city node", async () => {
  const other = "0x3333333333333333333333333333333333333333";
  const run = makeRun({
    copyUser: "",
    trades: [trade({ wallet: SUB }), trade({ wallet: other })],
  });
  await processCopyTrades(run, NODE_NOW, { store: FAKE_STORE, substitutes: [SUB, other] });
  assert.equal(run.signals.length, 1);
  assert.equal(run.signals[0].copyNodeTs, Math.floor(NODE_NOW / 1000) * 1000);
});
