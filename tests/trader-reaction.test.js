/**
 * tests/trader-reaction.test.js — pure fixtures for the trader-reaction
 * research logic. No network, no clock, no server: every input is inline.
 *
 * Covers server/research/traderReaction.js:
 *   bracket parsing / temperature→bracket mapping, METAR normalization and
 *   local-day filtering, resolutionSource parsing, warming-node detection,
 *   baseline lookup, reprice detection, Wilson lower bound, and the full
 *   per-wallet aggregation (dedupe, direction correctness, ahead-only-before
 *   reprice, eligibility, sorting, determinism).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  REACTION_DEFAULTS,
  baselineAt,
  bracketForTemp,
  cToF,
  computeTraderReactionStats,
  filterLocalDay,
  findReprice,
  findWarmingNodes,
  isDirectionCorrect,
  isNormalizedTrade,
  normalizeTrade,
  parseBracketTitle,
  parseMetarReports,
  parseResolutionSource,
  toEpochSec,
  wilsonLowerBound,
} from "../server/research/traderReaction.js";

/* ------------------------------------------------------------------------- */
/* Bracket parsing + temperature mapping                                     */
/* ------------------------------------------------------------------------- */

test("parseBracketTitle understands °C / °F / range / below / above labels", () => {
  assert.deepEqual(parseBracketTitle("29°C or below"), { unit: "C", lo: -Infinity, hi: 30, label: "29°C or below" });
  assert.deepEqual(parseBracketTitle("30°C"), { unit: "C", lo: 30, hi: 31, label: "30°C" });
  assert.deepEqual(parseBracketTitle("39°C or higher"), { unit: "C", lo: 39, hi: Infinity, label: "39°C or higher" });
  assert.deepEqual(parseBracketTitle("62-63°F"), { unit: "F", lo: 62, hi: 64, label: "62-63°F" });
  assert.deepEqual(parseBracketTitle("51°F or below"), { unit: "F", lo: -Infinity, hi: 52, label: "51°F or below" });
  assert.deepEqual(parseBracketTitle("70°F or above"), { unit: "F", lo: 70, hi: Infinity, label: "70°F or above" });
  assert.equal(parseBracketTitle("Will it rain?"), null);
  assert.equal(parseBracketTitle(""), null);
  assert.equal(parseBracketTitle(null), null);
});

test("bracketForTemp maps °C and converts to °F for Fahrenheit events", () => {
  const celsiusMarkets = [
    { id: "a", bracket: parseBracketTitle("29°C or below") },
    { id: "b", bracket: parseBracketTitle("30°C") },
    { id: "c", bracket: parseBracketTitle("31°C") },
    { id: "d", bracket: parseBracketTitle("39°C or higher") },
  ];
  assert.equal(bracketForTemp(23, celsiusMarkets).id, "a");
  assert.equal(bracketForTemp(29.9, celsiusMarkets).id, "a");
  assert.equal(bracketForTemp(30, celsiusMarkets).id, "b");
  assert.equal(bracketForTemp(30.7, celsiusMarkets).id, "b");
  assert.equal(bracketForTemp(31.2, celsiusMarkets).id, "c");
  assert.equal(bracketForTemp(42, celsiusMarkets).id, "d");

  const fahrenheitMarkets = [
    { id: "lo", bracket: parseBracketTitle("51°F or below") },
    { id: "a", bracket: parseBracketTitle("52-53°F") },
    { id: "b", bracket: parseBracketTitle("62-63°F") },
    { id: "hi", bracket: parseBracketTitle("70°F or higher") },
  ];
  // 17.2°C = 62.96°F -> 62-63°F
  assert.equal(bracketForTemp(17.2, fahrenheitMarkets).id, "b");
  // 11.7°C = 53.06°F -> 52-53°F
  assert.equal(bracketForTemp(11.7, fahrenheitMarkets).id, "a");
  assert.equal(bracketForTemp(21.5, fahrenheitMarkets).id, "hi");
  assert.equal(bracketForTemp(NaN, fahrenheitMarkets), null);
  assert.equal(cToF(0), 32);
  assert.equal(cToF(100), 212);
});

/* ------------------------------------------------------------------------- */
/* Epoch / METAR / resolution source                                         */
/* ------------------------------------------------------------------------- */

test("toEpochSec accepts seconds, ms and ISO strings", () => {
  assert.equal(toEpochSec(1794212400), 1794212400);
  assert.equal(toEpochSec(1794212400000), 1794212400);
  assert.equal(toEpochSec("2026-11-09T08:20:00.000Z"), 1794212400);
  assert.equal(toEpochSec(null), null);
  assert.equal(toEpochSec("not-a-date"), null);
});

test("parseMetarReports normalizes fields, drops invalid rows and sorts", () => {
  const rows = [
    { obsTime: "2026-11-09T08:20:00.000Z", reportTime: "2026-11-09T08:20:00.000Z", temp: 7, rawOb: "METAR X 090820Z", icaoId: "EGLC" },
    { obsTime: 1794208800, temp: 6.5, rawOb: "METAR X 090800Z", icaoId: "EGLC" },
    { reportTime: "2026-11-09T06:00:00.000Z", temp: null, rawOb: "bad", icaoId: "EGLC" },
    { temp: 9 }, // no time
    null,
  ];
  const parsed = parseMetarReports(rows);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((row) => row.ts), [1794208800, 1794212400]);
  assert.equal(parsed[1].tempC, 7);
  assert.equal(parsed[1].station, "EGLC");
  assert.equal(parseMetarReports(null).length, 0);
});

test("filterLocalDay uses the resolution anchor (local 03:00 next day)", () => {
  const anchor = 1794298800; // 2026-11-10T03:00:00Z (London local 03:00 next day)
  const start = anchor - 27 * 3600;
  const end = anchor - 3 * 3600;
  const rows = [
    { ts: start - 1, tempC: 1 },
    { ts: start, tempC: 2 },
    { ts: end - 1, tempC: 3 },
    { ts: end, tempC: 4 },
  ];
  assert.deepEqual(filterLocalDay(rows, anchor).map((row) => row.tempC), [2, 3]);
});

test("parseResolutionSource extracts station + UTC anchor from Gamma URL", () => {
  const url = "https://aviationweather.gov/api/data/metar?ids=OPKC&format=raw&date=2026-11-09T22:00:00Z&hours=30";
  const parsed = parseResolutionSource(url);
  assert.equal(parsed.station, "OPKC");
  assert.equal(parsed.anchorSec, 1794261600);
  assert.equal(parseResolutionSource(""), null);
  assert.equal(parseResolutionSource("https://example.com"), null);
  assert.equal(parseResolutionSource("https://aviationweather.gov/api/data/metar?ids=OPKC&format=raw"), null);
});

/* ------------------------------------------------------------------------- */
/* Warming nodes                                                             */
/* ------------------------------------------------------------------------- */

function celsiusMarkets() {
  return ["29°C or below", "30°C", "31°C", "32°C", "33°C", "34°C", "35°C", "36°C", "37°C", "38°C", "39°C or higher"]
    .map((label, index) => ({
      id: `m${index}`,
      marketId: `m${index}`,
      label,
      bracket: parseBracketTitle(label),
      yesToken: `yes${index}`,
      noToken: `no${index}`,
      tickSize: 0.001,
    }));
}

function metar(ts, tempC, station = "OPKC") {
  return { ts, tempC, raw: `METAR ${station}`, station };
}

test("findWarmingNodes only emits upward bracket transitions inside the local day", () => {
  const markets = celsiusMarkets();
  const anchor = 1794271200; // 2026-11-10T00:00Z -> local day Nov 9 Karachi
  const dayStart = anchor - 27 * 3600;
  const dayEnd = anchor - 3 * 3600;
  const rows = [
    metar(dayStart - 60, 40), // outside day: ignored even though hot
    metar(dayStart + 0, 23), // first observation: not a node
    metar(dayStart + 1800, 24), // same bracket (29 or below): not a node
    metar(dayStart + 3600, 22), // cooling: not a node
    metar(dayStart + 5400, 30), // 29-or-below -> 30°C: node
    metar(dayStart + 7200, 30.4), // same bracket: not a node
    metar(dayStart + 9000, 31), // 30 -> 31: node
    metar(dayStart + 10800, 33), // 31 -> 33: node (skips 32)
    metar(dayStart + 12600, 32.9), // 32.9 is 32°C bracket: LOWER than 33 -> not a node
    metar(dayEnd + 60, 38), // outside day: ignored
    metar(dayStart + 14400, 35), // 33 -> 35: node
  ];
  const nodes = findWarmingNodes({ metarRows: rows, markets, dayStartSec: dayStart, dayEndSec: dayEnd });
  assert.deepEqual(nodes.map((node) => node.bracket), ["30°C", "31°C", "33°C", "35°C"]);
  assert.deepEqual(nodes.map((node) => node.tempC), [30, 31, 33, 35]);
  assert.deepEqual(nodes.map((node) => node.yesToken), ["yes1", "yes2", "yes4", "yes6"]);
  assert.equal(nodes[0].prevBracket, "29°C or below");
  assert.equal(findWarmingNodes({ metarRows: [], markets }).length, 0);
});

test("findWarmingNodes works for °F bracket sets via C→F conversion", () => {
  const markets = ["51°F or below", "52-53°F", "56-57°F", "58-59°F", "60-61°F", "62-63°F", "70°F or higher"]
    .map((label) => ({ label, bracket: parseBracketTitle(label), yesToken: `yes-${label}` }));
  const base = 1794271200;
  // 12.2C=54.0F (54-55 not in set -> 52-53? no: 54 not in 52-53 or 56-57) — use values in set
  const rows = [
    metar(base + 0, 12.8), // 55.0F -> 54-55 not in set: no bracket match (skipped)
    metar(base + 3600, 13.3), // 55.9F -> 55.9 not in set -> skipped
    metar(base + 7200, 13.9), // 57.0F -> 56-57: first mapped bracket, not a node
    metar(base + 10800, 15), // 59.0F -> 58-59: node
    metar(base + 14400, 16.1), // 61.0F -> 60-61: node
    metar(base + 18000, 16.7), // 62.1F -> 62-63: node
  ];
  const nodes = findWarmingNodes({ metarRows: rows, markets, dayStartSec: base - 60, dayEndSec: base + 86400 });
  assert.deepEqual(nodes.map((node) => node.bracket), ["58-59°F", "60-61°F", "62-63°F"]);
  assert.deepEqual(nodes.map((node) => node.yesToken), ["yes-58-59°F", "yes-60-61°F", "yes-62-63°F"]);
});

/* ------------------------------------------------------------------------- */
/* Baseline + reprice                                                        */
/* ------------------------------------------------------------------------- */

test("baselineAt returns the newest point at or before the target", () => {
  const points = [{ ts: 100, price: 0.2 }, { ts: 200, price: 0.3 }, { ts: 300, price: 0.4 }];
  assert.deepEqual(baselineAt(points, 200), { ts: 200, price: 0.3 });
  assert.deepEqual(baselineAt(points, 250), { ts: 200, price: 0.3 });
  assert.deepEqual(baselineAt(points, 50), null);
  // unsorted input is fine; invalid points ignored
  assert.deepEqual(baselineAt([{ ts: 300, price: 0.4 }, { ts: 100, price: 0.2 }, { ts: 999, price: NaN }], 300), { ts: 300, price: 0.4 });
  assert.equal(baselineAt(null, 100), null);
});

test("findReprice uses max(minMove, 2 ticks), first qualifying point after the node", () => {
  const point = (ts, price) => ({ ts, price });
  const nodeTs = 1000;
  const points = [
    point(900, 0.30), // before node
    point(1020, 0.32), // +0.02 < 0.05
    point(1060, 0.36), // +0.06 >= 0.05 -> reprice up
    point(1200, 0.20), // bigger move later, but not first
  ];
  const reprice = findReprice({ points, nodeTs, baselinePrice: 0.30, tickSize: 0.001, minMove: 0.05 });
  assert.equal(reprice.ts, 1060);
  assert.equal(reprice.price, 0.36);
  approx(reprice.move, 0.06, 1e-9);
  assert.equal(reprice.direction, "up");
  approx(reprice.threshold, 0.05, 1e-9);

  // 2 ticks dominate when they are larger than minMove
  const ticksNull = findReprice({ points: [point(1100, 0.26)], nodeTs, baselinePrice: 0.30, tickSize: 0.03, minMove: 0.001 });
  assert.equal(ticksNull, null, "0.03 tick × 2 = 0.06 > 0.04 move");
  const ticksHit = findReprice({ points: [point(1100, 0.38)], nodeTs, baselinePrice: 0.30, tickSize: 0.03, minMove: 0.001 });
  assert.equal(ticksHit.threshold, 0.06);
  approx(ticksHit.move, 0.08, 1e-9);

  // downward reprices count too
  const down = findReprice({ points: [point(1100, 0.20)], nodeTs, baselinePrice: 0.30, tickSize: 0.001 });
  assert.equal(down.direction, "down");
  approx(down.move, -0.1, 1e-9);

  // maxWait cuts off late moves
  assert.equal(
    findReprice({ points: [point(1000 + 7000, 0.6)], nodeTs, baselinePrice: 0.30, maxWaitSec: 3600 }),
    null,
  );
  // no baseline => null
  assert.equal(findReprice({ points, nodeTs, baselinePrice: NaN }), null);
});

/* ------------------------------------------------------------------------- */
/* Wilson lower bound                                                        */
/* ------------------------------------------------------------------------- */

test("wilsonLowerBound matches known values and edge cases", () => {
  approx(wilsonLowerBound(10, 10), 0.72246, 1e-4);
  approx(wilsonLowerBound(5, 5), 0.56551, 1e-4);
  approx(wilsonLowerBound(1, 1), 0.20654, 1e-4);
  approx(wilsonLowerBound(5, 10), 0.23659, 1e-4);
  assert.equal(wilsonLowerBound(0, 10), 0);
  assert.equal(wilsonLowerBound(0, 0), 0);
  assert.equal(wilsonLowerBound(-1, 5), 0);
  assert.ok(wilsonLowerBound(0, 100) === 0);
  for (const [k, n] of [[0, 1], [1, 2], [3, 7], [99, 100], [100, 100]]) {
    const lower = wilsonLowerBound(k, n);
    assert.ok(lower >= 0 && lower <= 1, `wilson(${k}/${n}) out of range: ${lower}`);
  }
});

/* ------------------------------------------------------------------------- */
/* Trade normalization + direction                                           */
/* ------------------------------------------------------------------------- */

test("normalizeTrade / isNormalizedTrade / isDirectionCorrect", () => {
  const raw = {
    proxy_wallet: "0xABC",
    side: "BUY",
    token_id: "yes-token",
    condition_id: "0xcond",
    size: 12.5,
    price: 0.4,
    timestamp: 1794212400,
    outcome: "Yes",
    pseudonym: "Tester",
  };
  const trade = normalizeTrade(raw);
  assert.equal(trade.wallet, "0xabc");
  assert.equal(trade.tokenId, "yes-token");
  assert.equal(trade.ts, 1794212400);
  assert.equal(trade.side, "BUY");
  assert.equal(trade.outcome, "Yes");
  assert.equal(normalizeTrade({ proxy_wallet: "", timestamp: 1 }), null);
  assert.equal(normalizeTrade({ proxy_wallet: "0x1", timestamp: null }), null);

  assert.equal(isNormalizedTrade(trade), true);
  assert.equal(isNormalizedTrade(raw), false);

  assert.equal(isDirectionCorrect({ side: "BUY", outcome: "Yes" }), true);
  assert.equal(isDirectionCorrect({ side: "SELL", outcome: "No" }), true);
  assert.equal(isDirectionCorrect({ side: "BUY", outcome: "No" }), false);
  assert.equal(isDirectionCorrect({ side: "SELL", outcome: "Yes" }), false);
  assert.equal(isDirectionCorrect({}), false);
});

/* ------------------------------------------------------------------------- */
/* Full aggregation                                                          */
/* ------------------------------------------------------------------------- */

function nodeFixtures() {
  // Node A: baseline 0.30 at ts=880, reprices up to 0.40 at ts=1060.
  // Node B: baseline 0.50 at ts=1880, never reprices -> unqualified.
  return {
    nodes: [
      {
        nodeId: "A",
        eventSlug: "event-a",
        nodeTs: 1000,
        tempC: 30,
        bracket: "30°C",
        yesToken: "yes-a",
        noToken: "no-a",
        tickSize: 0.001,
        marketId: "m-a",
      },
      {
        nodeId: "B",
        eventSlug: "event-a",
        nodeTs: 2000,
        tempC: 31,
        bracket: "31°C",
        yesToken: "yes-b",
        noToken: "no-b",
        tickSize: 0.001,
        marketId: "m-b",
      },
    ],
    priceByToken: new Map([
      ["yes-a", [{ ts: 880, price: 0.3 }, { ts: 1060, price: 0.4 }]],
      ["yes-b", [{ ts: 1880, price: 0.5 }, { ts: 2300, price: 0.52 }]],
    ]),
  };
}

function tradeFixtures() {
  const base = {
    proxy_wallet: "",
    side: "BUY",
    token_id: "yes-a",
    condition_id: "cond-a",
    size: 10,
    price: 0.3,
    outcome: "Yes",
    title: "A",
    event_slug: "event-a",
  };
  return [
    // W1: two BUY YES ahead of reprice at +60 -> deduped to one ahead event
    { ...base, proxy_wallet: "0xw1", timestamp: 970, pseudonym: "W1" },
    { ...base, proxy_wallet: "0xw1", timestamp: 1020, pseudonym: "W1" },
    // W2: SELL NO ahead (direction-correct for warming)
    { ...base, proxy_wallet: "0xw2", token_id: "no-a", outcome: "No", side: "SELL", timestamp: 1040, pseudonym: "W2" },
    // W3: BUY YES after the reprice -> involved but NOT ahead
    { ...base, proxy_wallet: "0xw3", timestamp: 1120, pseudonym: "W3" },
    // W4: SELL YES (wrong direction) -> involved but NOT ahead
    { ...base, proxy_wallet: "0xw4", side: "SELL", timestamp: 1010, pseudonym: "W4" },
    // W5: trade on an unrelated token -> excluded entirely
    { ...base, proxy_wallet: "0xw5", token_id: "other-token", condition_id: "cond-other", timestamp: 1010, pseudonym: "W5" },
    // W6: outside the ±120s window -> excluded
    { ...base, proxy_wallet: "0xw6", timestamp: 1300, pseudonym: "W6" },
    // W1 also trades node B in-window, but node B is unqualified -> no extra count
    { ...base, proxy_wallet: "0xw1", token_id: "yes-b", condition_id: "cond-b", timestamp: 1950, pseudonym: "W1" },
    // Already-normalized trade must be accepted (regression: double normalization)
    { wallet: "0xw7", pseudonym: "W7", side: "BUY", outcome: "Yes", tokenId: "yes-a", conditionId: "cond-a", ts: 990, size: 5, price: 0.31, marketTitle: "A", eventSlug: "event-a" },
  ];
}

test("computeTraderReactionStats aggregates ahead/qualified per wallet (dedupe + direction + window)", () => {
  const { nodes, priceByToken } = nodeFixtures();
  const stats = computeTraderReactionStats({
    warmingNodes: nodes,
    targetMarketTrades: tradeFixtures(),
    priceByToken,
  });

  assert.equal(stats.totals.warmingNodes, 2);
  assert.equal(stats.qualifiedWarmingNodes, 1);
  assert.equal(stats.totals.qualifiedNodes, 1);
  assert.equal(stats.nodes[0].qualified, true);
  assert.equal(stats.nodes[0].baselinePrice, 0.3);
  assert.equal(stats.nodes[0].repriceTs, 1060);
  assert.equal(stats.nodes[0].repriceDirection, "up");
  assert.equal(stats.nodes[0].aheadTrades, 3, "W1 + W2 + W7 ahead, deduped per wallet");
  assert.deepEqual(stats.nodes[0].aheadWallets.sort(), ["0xw1", "0xw2", "0xw7"]);
  assert.equal(stats.nodes[0].directionCorrectTrades, 5, "W1x2 BUY YES, W2 SELL NO, W3 BUY YES (post-reprice), W7 BUY YES");
  assert.equal(stats.nodes[1].qualified, false);
  assert.equal(stats.nodes[1].aheadTrades, 0);

  const byWallet = new Map(stats.users.map((user) => [user.wallet, user]));
  assert.equal(byWallet.size, 5, "W1,W2,W3,W4,W7 involved in the qualified node; W5/W6 excluded");
  assert.deepEqual([...byWallet.keys()].sort(), ["0xw1", "0xw2", "0xw3", "0xw4", "0xw7"]);

  assert.equal(byWallet.get("0xw1").ahead, 1);
  assert.equal(byWallet.get("0xw1").qualified, 1);
  assert.equal(byWallet.get("0xw1").reactionRate, 1);
  assert.equal(byWallet.get("0xw1").per100, 100);
  approx(byWallet.get("0xw1").wilsonLower, 0.20654, 1e-4);
  assert.equal(byWallet.get("0xw1").eligible, false);
  assert.equal(byWallet.get("0xw1").pseudonym, "W1");

  assert.equal(byWallet.get("0xw2").ahead, 1);
  assert.equal(byWallet.get("0xw3").ahead, 0);
  assert.equal(byWallet.get("0xw3").reactionRate, 0);
  assert.equal(byWallet.get("0xw3").wilsonLower, 0);
  assert.equal(byWallet.get("0xw4").ahead, 0);
  assert.equal(byWallet.get("0xw7").ahead, 1, "pre-normalized trades are accepted");

  // sorted by wilsonLower desc
  for (let i = 1; i < stats.users.length; i += 1) {
    assert.ok(stats.users[i - 1].wilsonLower >= stats.users[i].wilsonLower);
  }
  assert.equal(stats.totals.users, 5);
  assert.equal(stats.totals.aheadWallets, 3);
  // 5 direction-correct fills around node A + 1 around unqualified node B
  assert.equal(stats.totals.directionCorrectTrades, 6);
});

test("reaction rate uses all qualified warming nodes as the denominator", () => {
  const { nodes, priceByToken } = nodeFixtures();
  // Make node B qualified too; W1 is ahead on A and B, W2 only on A.
  priceByToken.set("yes-b", [{ ts: 1880, price: 0.5 }, { ts: 2100, price: 0.6 }]);
  const stats = computeTraderReactionStats({
    warmingNodes: nodes,
    targetMarketTrades: tradeFixtures(),
    priceByToken,
  });
  assert.equal(stats.qualifiedWarmingNodes, 2);
  const byWallet = new Map(stats.users.map((user) => [user.wallet, user]));
  assert.equal(byWallet.get("0xw1").ahead, 2);
  assert.equal(byWallet.get("0xw1").qualified, 2);
  assert.equal(byWallet.get("0xw1").reactionRate, 1);
  assert.equal(byWallet.get("0xw2").ahead, 1);
  assert.equal(byWallet.get("0xw2").qualified, 2);
  assert.equal(byWallet.get("0xw2").reactionRate, 0.5, "not inflated to 1/1=100%");
  assert.equal(byWallet.get("0xw3").reactionRate, 0);
  assert.equal(byWallet.get("0xw1").involved, 2);
  assert.equal(byWallet.get("0xw2").involved, 1);
});

test("computeTraderReactionStats eligibility thresholds are configurable", () => {
  const { nodes, priceByToken } = nodeFixtures();
  const stats = computeTraderReactionStats({
    warmingNodes: nodes,
    targetMarketTrades: tradeFixtures(),
    priceByToken,
    options: { eligibleMinQualified: 1, eligibleMinWilson: 0.2 },
  });
  const byWallet = new Map(stats.users.map((user) => [user.wallet, user]));
  assert.equal(byWallet.get("0xw1").eligible, true);
  assert.equal(byWallet.get("0xw2").eligible, true);
  assert.equal(byWallet.get("0xw3").eligible, false);
  assert.equal(byWallet.get("0xw4").eligible, false);
  // contract default: eligible iff qualified>=100 && wilsonLower>0.9
  const defaults = computeTraderReactionStats({ warmingNodes: nodes, targetMarketTrades: tradeFixtures(), priceByToken });
  for (const user of defaults.users) {
    assert.equal(user.eligible, user.qualified >= 100 && user.wilsonLower > 0.9);
  }
});

test("baseline quality gates disqualify sentinel/absent baselines", () => {
  const { nodes } = nodeFixtures();
  const trades = tradeFixtures();
  // sentinel baseline 0.0005 is below minBaselineMid -> node unqualified even if the mid 'moves'
  const stats = computeTraderReactionStats({
    warmingNodes: [nodes[0]],
    targetMarketTrades: trades,
    priceByToken: new Map([["yes-a", [{ ts: 880, price: 0.0005 }, { ts: 1060, price: 0.2 }]]]),
  });
  assert.equal(stats.qualifiedWarmingNodes, 0);
  assert.equal(stats.users.length, 0);

  // missing history -> unqualified
  const missing = computeTraderReactionStats({
    warmingNodes: [nodes[0]],
    targetMarketTrades: trades,
    priceByToken: new Map(),
  });
  assert.equal(missing.qualifiedWarmingNodes, 0);
  assert.equal(missing.nodes[0].baselineValid, false);
});

test("computeTraderReactionStats is deterministic and defaults are exposed", () => {
  const { nodes, priceByToken } = nodeFixtures();
  const run = () => computeTraderReactionStats({
    warmingNodes: nodes,
    targetMarketTrades: tradeFixtures(),
    priceByToken,
  });
  assert.deepEqual(run(), run());
  assert.equal(REACTION_DEFAULTS.preWindowSec, 120);
  assert.equal(REACTION_DEFAULTS.postWindowSec, 120);
  assert.equal(REACTION_DEFAULTS.minMove, 0.05);
  assert.equal(REACTION_DEFAULTS.eligibleMinQualified, 100);
  assert.equal(REACTION_DEFAULTS.eligibleMinWilson, 0.9);
});

function approx(actual, expected, tolerance = 1e-6, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || "value"}: expected ${expected}, got ${actual} (tol ${tolerance})`,
  );
}
