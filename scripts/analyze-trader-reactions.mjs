/**
 * scripts/analyze-trader-reactions.mjs — build the trader-reaction leaderboard
 * from LIVE public data (no auth, no fabricated users).
 *
 * Pipeline per temperature event:
 *   1. Gamma: event + bracket markets (clobTokenIds, tick size, titles).
 *   2. AviationWeather METAR: the resolution station's observations around the
 *      event's local day (station + date anchor parsed from resolutionSource).
 *   3. Warming nodes: METAR reports that moved the station temperature into a
 *      higher bracket than the previous report (pure logic in
 *      server/research/traderReaction.js).
 *   4. Data API /v2/trades: the event's public trade tape (paged with cursor),
 *      including maker rows (taker_only=false), via ClobClient.getPublicTrades.
 *   5. Data API /v2/prices-history: 60s midpoint series for each target YES
 *      token around its node → baseline at node-120s + first reprice.
 *   6. Aggregate per wallet: ahead events / qualified events, reaction rate,
 *      Wilson lower bound; eligible = qualified>=100 && wilsonLower>0.9.
 *
 * Writes shared/traderReactionLeaderboard.js:
 *   export const TRADER_REACTION_LEADERBOARD = { generatedAt,
 *     qualifiedWarmingNodes, users:[{wallet,pseudonym,reactionRate,per100,
 *     ahead,qualified,wilsonLower,eligible}] };
 *
 * Usage:
 *   node scripts/analyze-trader-reactions.mjs
 *   node scripts/analyze-trader-reactions.mjs --dates=2026-11-09,2026-11-10,2026-11-11
 *   node scripts/analyze-trader-reactions.mjs --max-events=8 --no-cache --verbose
 *
 * Caching (24h, OS temp) keeps reruns cheap because the underlying data does
 * not change for closed events. `--no-cache` forces fresh fetches.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { fetchJson } from "../server/util.js";
import { ClobClient } from "../server/data/clob.js";
import {
  REACTION_DEFAULTS,
  computeTraderReactionStats,
  filterLocalDay,
  findWarmingNodes,
  normalizeTrade,
  parseBracketTitle,
  parseMetarReports,
  parseResolutionSource,
} from "../server/research/traderReaction.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const OUT_FILE = path.join(PROJECT_ROOT, "shared", "traderReactionLeaderboard.js");
const CACHE_DIR = path.join(os.tmpdir(), "pmw-trader-reaction-cache");
const GAMMA = "https://gamma-api.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const METAR = "https://aviationweather.gov/api/data/metar";
const TAG_HIGHEST_TEMPERATURE = 104596;

const KNOWN_KARACHI_SLUG = "highest-temperature-in-karachi-on-november-9-2026";

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const hit = args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const hasFlag = (name) => args.includes(`--${name}`);
const VERBOSE = hasFlag("verbose");
const USE_CACHE = !hasFlag("no-cache");
const MAX_EVENTS = Number(getArg("max-events", 6));
const TOP_PER_DATE = Number(getArg("top-per-date", 2));
const CACHE_MAX_AGE_MS = 24 * 3600 * 1000;

const log = (...parts) => console.log(...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------------- */
/* Small cached JSON fetcher                                                 */
/* ------------------------------------------------------------------------- */

let cacheHits = 0;
let cacheMisses = 0;

async function cachedJson(url, label = url) {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
  if (USE_CACHE) {
    try {
      const stat = await fs.stat(cacheFile);
      if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
        cacheHits += 1;
        return JSON.parse(await fs.readFile(cacheFile, "utf8"));
      }
    } catch {
      /* cache miss */
    }
  }
  const json = await fetchJson(url, { timeoutMs: 30_000, retries: 2, label });
  cacheMisses += 1;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(json), "utf8");
  return json;
}

/* ------------------------------------------------------------------------- */
/* Gamma event discovery                                                     */
/* ------------------------------------------------------------------------- */

async function fetchEventBySlug(slug) {
  return cachedJson(`${GAMMA}/events/slug/${encodeURIComponent(slug)}`, `event ${slug}`);
}

async function listEventsForDate(dateIso) {
  const url =
    `${GAMMA}/events/keyset?tag_id=${TAG_HIGHEST_TEMPERATURE}&closed=true` +
    `&end_date_min=${dateIso}T00:00:00Z&end_date_max=${dateIso}T23:59:59Z` +
    `&order=endDate&ascending=false&limit=100`;
  const json = await cachedJson(url, `events ${dateIso}`);
  const events = Array.isArray(json?.events) ? json.events : [];
  const scored = events.map((event) => {
    const markets = Array.isArray(event.markets) ? event.markets : [];
    const volume = markets.reduce((sum, market) => sum + (Number(market.volumeNum ?? market.volume) || 0), 0);
    return { slug: event.slug, title: event.title, volume, markets: markets.length };
  });
  scored.sort((a, b) => b.volume - a.volume);
  return scored;
}

/** Build market rows with parsed brackets from one event. */
function normalizeEventMarkets(event) {
  const markets = [];
  for (const raw of Array.isArray(event?.markets) ? event.markets : []) {
    let tokenIds = [];
    try {
      tokenIds = JSON.parse(raw.clobTokenIds ?? "[]");
    } catch {
      tokenIds = [];
    }
    if (!Array.isArray(tokenIds) || tokenIds.length < 2) continue;
    const title = String(raw.groupItemTitle ?? raw.question ?? "");
    const bracket = parseBracketTitle(title) ?? parseBracketTitle(raw.question ?? "");
    if (!bracket) continue;
    let outcomes = [];
    try {
      outcomes = JSON.parse(raw.outcomes ?? '["Yes","No"]');
    } catch {
      outcomes = ["Yes", "No"];
    }
    const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
    const noIndex = yesIndex === 0 ? 1 : 0;
    markets.push({
      id: String(raw.id ?? ""),
      marketId: String(raw.id ?? ""),
      title: String(raw.question ?? title),
      label: title,
      bracket,
      tickSize: Number(raw.orderPriceMinTickSize ?? 0.001) || 0.001,
      yesToken: String(tokenIds[yesIndex] ?? tokenIds[0]),
      noToken: String(tokenIds[noIndex] ?? tokenIds[1]),
    });
  }
  return markets;
}

/* ------------------------------------------------------------------------- */
/* Live data fetches                                                         */
/* ------------------------------------------------------------------------- */

async function fetchMetar(station, dateParam) {
  const url = `${METAR}?ids=${encodeURIComponent(station)}&format=json&date=${encodeURIComponent(dateParam ?? "")}&hours=30`;
  const raw = await cachedJson(url, `metar ${station}`);
  return parseMetarReports(Array.isArray(raw) ? raw : []);
}

const pricesCache = new Map();

async function fetchPriceHistory(tokenId, startSec, endSec) {
  const key = `${tokenId}:${startSec}:${endSec}`;
  if (pricesCache.has(key)) return pricesCache.get(key);
  const url =
    `${DATA}/v2/prices-history?token_id=${encodeURIComponent(tokenId)}` +
    `&start=${startSec}&end=${endSec}&bucket_seconds=60`;
  const json = await cachedJson(url, `prices ${tokenId.slice(0, 10)}`);
  const rows = Array.isArray(json?.data) ? json.data : [];
  const points = rows
    .map((row) => ({ ts: Number(row.timestamp), price: Number(row.price) }))
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.price) && point.price >= 0 && point.price <= 1)
    .sort((a, b) => a.ts - b.ts);
  pricesCache.set(key, points);
  return points;
}

async function fetchAllEventTrades(clob, eventId) {
  const trades = [];
  let cursor = null;
  let pages = 0;
  for (;;) {
    pages += 1;
    const page = await clob.getPublicTrades({
      eventId: String(eventId),
      limit: 1000,
      cursor,
      takerOnly: false,
    });
    const rows = page.data ?? [];
    for (const row of rows) {
      const trade = normalizeTrade(row);
      if (trade) trades.push(trade);
    }
    const next = page.pagination?.next_cursor ?? null;
    if (!page.pagination?.has_more || !next || pages >= 20) break;
    cursor = next;
    await sleep(250);
  }
  return trades;
}

/* ------------------------------------------------------------------------- */
/* Per-event analysis                                                        */
/* ------------------------------------------------------------------------- */

async function analyzeEvent(slug, clob) {
  const event = await fetchEventBySlug(slug);
  if (!event || event.closed !== true) {
    return { slug, status: "skipped", reason: "event missing or not closed" };
  }
  const markets = normalizeEventMarkets(event);
  if (markets.length === 0) return { slug, status: "skipped", reason: "no parsable bracket markets" };
  const resolution = parseResolutionSource(event.resolutionSource);
  if (!resolution) return { slug, status: "skipped", reason: "no METAR resolutionSource" };
  if (!resolution.dateParam) return { slug, status: "skipped", reason: "resolutionSource has no date anchor" };

  const metarRows = await fetchMetar(resolution.station, resolution.dateParam);
  if (metarRows.length === 0) return { slug, status: "skipped", reason: "no METAR rows" };
  const localRows = filterLocalDay(metarRows, resolution.anchorSec);
  const nodes = findWarmingNodes({
    metarRows: localRows,
    markets,
    dayStartSec: resolution.anchorSec - 27 * 3600,
    dayEndSec: resolution.anchorSec - 3 * 3600,
  }).map((node) => ({
    ...node,
    eventSlug: slug,
    eventTitle: event.title,
    nodeId: `${slug}:${node.nodeTs}`,
  }));

  const trades = await fetchAllEventTrades(clob, event.id);
  const priceByToken = new Map();
  const dayStartSec = resolution.anchorSec - 27 * 3600;
  const dayEndSec = resolution.anchorSec - 3 * 3600;
  for (const node of nodes) {
    if (priceByToken.has(node.yesToken)) continue;
    const start = Math.max(node.nodeTs - 900, dayStartSec - 900);
    const end = Math.min(node.nodeTs + REACTION_DEFAULTS.maxRepriceWaitSec, dayEndSec + 900);
    try {
      priceByToken.set(node.yesToken, await fetchPriceHistory(node.yesToken, start, end));
      await sleep(120);
    } catch (err) {
      log(`  ! price history failed for ${node.bracket} (${node.yesToken.slice(0, 10)}…): ${err.message}`);
      priceByToken.set(node.yesToken, []);
    }
  }

  const stats = computeTraderReactionStats({
    warmingNodes: nodes,
    targetMarketTrades: trades,
    priceByToken,
  });

  return {
    slug,
    status: "ok",
    eventTitle: event.title,
    eventId: event.id,
    station: resolution.station,
    eventDate: event.eventDate,
    marketCount: markets.length,
    trades: trades.length,
    wallets: new Set(trades.map((trade) => trade.wallet)).size,
    warmingNodes: nodes.length,
    qualifiedNodes: stats.qualifiedWarmingNodes,
    users: stats.users.length,
    stats,
    raw: { nodes, trades, priceByToken },
  };
}

/* ------------------------------------------------------------------------- */
/* Main                                                                      */
/* ------------------------------------------------------------------------- */

async function main() {
  const startedAt = Date.now();
  log("Trader reaction research — live Polymarket + AviationWeather data");
  log(`cache: ${USE_CACHE ? CACHE_DIR : "disabled"} · defaults`, JSON.stringify(REACTION_DEFAULTS));

  /* 1. pick events */
  const explicitSlugs = String(getArg("slugs", "") || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const explicitDates = String(getArg("dates", "") || "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean);

  const today = new Date();
  const utcDate = (offsetDays) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offsetDays));
    return date.toISOString().slice(0, 10);
  };
  const recentDates = explicitDates.length
    ? explicitDates
    : [utcDate(-3), utcDate(-2), utcDate(-1)];

  const selected = [];
  const seen = new Set();
  const addSlug = (slug, note) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    selected.push({ slug, note });
  };

  // Karachi Nov 9 is a mandated sample; keep it even if it is older than the window.
  addSlug(KNOWN_KARACHI_SLUG, "mandated Karachi 2026-11-09");
  if (explicitSlugs.length) explicitSlugs.forEach((slug) => addSlug(slug, "explicit --slugs"));

  // A few recent liquid events for breadth.
  for (const date of recentDates.slice(0, 4)) {
    try {
      const events = await listEventsForDate(date);
      const picks = events
        .filter((event) => event.slug !== KNOWN_KARACHI_SLUG && !/polyv2/i.test(event.slug ?? ""))
        .slice(0, TOP_PER_DATE);
      for (const pick of picks) addSlug(pick.slug, `${date} top-volume ($${Math.round(pick.volume)})`);
      log(`date ${date}: ${events.length} closed events, selected ${picks.map((pick) => pick.slug).join(", ") || "none"}`);
    } catch (err) {
      log(`date ${date}: event listing failed: ${err.message}`);
    }
    if (selected.length >= MAX_EVENTS) break;
  }

  const events = selected.slice(0, MAX_EVENTS);
  log(`\nevents to analyse (${events.length}):`);
  for (const event of events) log(`  - ${event.slug}  [${event.note}]`);

  /* 2. analyse each event */
  const clob = new ClobClient({ maxRps: 4, timeoutMs: 30_000, log: (level, message) => log(`  [${level}] ${message}`) });
  const results = [];
  for (const event of events) {
    log(`\n→ ${event.slug}`);
    try {
      const result = await analyzeEvent(event.slug, clob);
      results.push(result);
      if (result.status === "ok") {
        log(
          `  ok: station=${result.station} markets=${result.marketCount} trades=${result.trades} wallets=${result.wallets} ` +
            `warmingNodes=${result.warmingNodes} qualified=${result.qualifiedNodes} users=${result.users}`,
        );
      } else {
        log(`  skipped: ${result.reason}`);
      }
    } catch (err) {
      results.push({ slug: event.slug, status: "error", reason: err.message });
      log(`  error: ${err.message}`);
    }
    await sleep(300);
  }

  /* 3. aggregate all events */
  const okResults = results.filter((result) => result.status === "ok");
  const allNodes = [];
  const allTrades = [];
  const allPrices = new Map();
  for (const result of okResults) {
    if (!result.raw) continue;
    for (const node of result.raw.nodes) allNodes.push(node);
    for (const trade of result.raw.trades) allTrades.push(trade);
    for (const [tokenId, points] of result.raw.priceByToken) allPrices.set(tokenId, points);
  }

  const aggregate = computeTraderReactionStats({
    warmingNodes: allNodes,
    targetMarketTrades: allTrades,
    priceByToken: allPrices,
  });

  /* 4. write leaderboard */
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    qualifiedWarmingNodes: aggregate.qualifiedWarmingNodes,
    users: aggregate.users.map((user) => ({
      wallet: user.wallet,
      pseudonym: user.pseudonym,
      reactionRate: user.reactionRate,
      per100: user.per100,
      ahead: user.ahead,
      qualified: user.qualified,
      wilsonLower: user.wilsonLower,
      eligible: user.eligible,
    })),
  };
  const header = [
    "/**",
    " * shared/traderReactionLeaderboard.js — GENERATED FILE, do not edit by hand.",
    " *",
    " * Source: scripts/analyze-trader-reactions.mjs (live Gamma + AviationWeather METAR",
    " * + Data API v2 trades/prices-history). No users are fabricated: every row is a",
    " * real proxy wallet observed trading a target bracket around a METAR warming node.",
    " *",
    ` * generatedAt: ${generatedAt}`,
    ` * events: ${okResults.length} analysed / ${results.length} selected`,
    ` * warming nodes: ${aggregate.totals.warmingNodes} found, ${aggregate.qualifiedWarmingNodes} qualified (baseline + reprice)`,
    ` * users: ${aggregate.users.length} wallets with >=1 qualified observation; eligible: ${aggregate.users.filter((user) => user.eligible).length}`,
    " * definition: ahead = direction-correct trade (BUY YES or SELL NO target) inside",
    " * node ±120s and strictly before the first >= max(0.05, 2 ticks) target reprice;",
    " * qualified (per wallet) = qualified nodes where the wallet traded the target at all.",
    " */",
    "",
    "export const TRADER_REACTION_LEADERBOARD = " + JSON.stringify(payload, null, 2) + ";",
    "",
    "export default TRADER_REACTION_LEADERBOARD;",
    "",
  ].join("\n");
  await fs.writeFile(OUT_FILE, header, "utf8");

  /* 5. report */
  log("\n" + "=".repeat(78));
  log("LEADERBOARD SUMMARY");
  log("=".repeat(78));
  for (const result of results) {
    log(
      result.status === "ok"
        ? `  OK      ${result.slug} — trades=${result.trades} wallets=${result.wallets} nodes=${result.warmingNodes}/${result.qualifiedNodes} qualified`
        : `  ${result.status.toUpperCase().padEnd(7)} ${result.slug} — ${result.reason}`,
    );
  }
  log("-".repeat(78));
  log(`qualifiedWarmingNodes: ${aggregate.qualifiedWarmingNodes} / ${aggregate.totals.warmingNodes} warming nodes`);
  log(`trades analysed: ${allTrades.length} · wallets: ${aggregate.totals.users} with qualified observations · eligible: ${aggregate.users.filter((user) => user.eligible).length}`);
  log(`cache hits/misses: ${cacheHits}/${cacheMisses} · elapsed ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  log(`written: ${path.relative(PROJECT_ROOT, OUT_FILE)}`);
  log("\nTop users by Wilson lower bound:");
  for (const user of aggregate.users.slice(0, 15)) {
    log(
      `  ${user.wallet.slice(0, 10)}… ${String(user.pseudonym).padEnd(24)} ` +
        `ahead=${user.ahead}/${user.qualified} rate=${(user.reactionRate * 100).toFixed(1)}% wilson=${user.wilsonLower.toFixed(3)}` +
        `${user.eligible ? " ELIGIBLE" : ""}`,
    );
  }
  if (aggregate.users.length === 0) {
    log("  (no wallet traded a target bracket inside a qualified node window)");
  }

  if (okResults.length === 0) {
    log("\nFAIL: no event could be analysed.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("analyze-trader-reactions failed:", err);
  process.exitCode = 1;
});
