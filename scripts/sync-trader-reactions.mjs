/**
 * scripts/sync-trader-reactions.mjs
 *
 * Incremental, city-independent trader-reaction leaderboard builder.
 *
 * Stores one compact fact file per analysed weather event under
 * data/trader-reactions/events/<slug>.json, plus a manifest. Re-running only
 * fetches events that are not yet in the local store; the final per-city and
 * global rankings are recomputed from the local facts.
 *
 * Usage:
 *   node scripts/sync-trader-reactions.mjs --incremental --from=2026-10-23
 *   node scripts/sync-trader-reactions.mjs --all-cities --from=2026-10-23 --to=2026-11-12
 *   node scripts/sync-trader-reactions.mjs --force --city="Shenzhen"
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ClobClient } from "../server/data/clob.js";
import { extractCity } from "../server/data/gamma.js";
import {
  REACTION_DEFAULTS,
  computeTraderReactionStats,
  filterLocalDay,
  findWarmingNodes,
  normalizeTrade,
  parseBracketTitle,
  parseMetarReports,
  parseResolutionSource,
  wilsonLowerBound,
} from "../server/research/traderReaction.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = path.join(PROJECT_ROOT, "data", "trader-reactions");
const EVENTS_DIR = path.join(DATA_ROOT, "events");
const MANIFEST_PATH = path.join(DATA_ROOT, "manifest.json");
const LOCK_PATH = path.join(DATA_ROOT, "sync.lock");
const RAW_CACHE_DIR = path.join(DATA_ROOT, "raw-cache");
const CITY_LEADERBOARD_FILE = path.join(PROJECT_ROOT, "shared", "traderReactionLeaderboards.js");
const GLOBAL_LEADERBOARD_FILE = path.join(PROJECT_ROOT, "shared", "traderReactionLeaderboard.js");
const GAMMA = "https://gamma-api.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const METAR = "https://aviationweather.gov/api/data/metar";
const TAG = 104596;
const SIGNATURE = JSON.stringify({ v: 3, ...REACTION_DEFAULTS });
const START_DATE = "2026-10-23";
const CITY_ELIGIBLE_MIN_QUALIFIED = 20;

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const hasFlag = (name) => args.includes(`--${name}`);
const FORCE = hasFlag("force");
const INCREMENTAL = hasFlag("incremental") || !hasFlag("all-cities");
const ALL_CITIES = hasFlag("all-cities") || INCREMENTAL;
const FROM = String(getArg("from", START_DATE));
const TO = String(getArg("to", new Date().toISOString().slice(0, 10)));
const ONLY_CITY = String(getArg("city", "") || "").trim();
const MAX_EVENTS = Number(getArg("max-events", 0)) || 0;

const log = (...parts) => console.log(...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dateRange(from, to) {
  const out = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new Error("bad date range");
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

async function fetchJson(url, label = url, tries = 5) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(35_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      await sleep(600 * (i + 1));
    }
  }
  throw new Error(`${label}: ${last?.message || last}`);
}

async function cachedJson(url, label) {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
  const file = path.join(RAW_CACHE_DIR, `${hash}.json`);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < 86_400_000) return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    /* miss */
  }
  const json = await fetchJson(url, label);
  await fs.mkdir(RAW_CACHE_DIR, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(json)}\n`, "utf8");
  return json;
}

async function listEventsForDate(dateIso) {
  const url =
    `${GAMMA}/events/keyset?tag_id=${TAG}&closed=true` +
    `&end_date_min=${dateIso}T00:00:00Z&end_date_max=${dateIso}T23:59:59Z` +
    `&order=endDate&ascending=false&limit=100`;
  const json = await cachedJson(url, `events ${dateIso}`);
  return Array.isArray(json?.events) ? json.events : [];
}

function normalizeMarkets(event) {
  const out = [];
  for (const raw of Array.isArray(event?.markets) ? event.markets : []) {
    let tokenIds = [];
    try { tokenIds = JSON.parse(raw.clobTokenIds ?? "[]"); } catch { tokenIds = []; }
    if (!Array.isArray(tokenIds) || tokenIds.length < 2) continue;
    const title = String(raw.groupItemTitle ?? raw.question ?? "");
    const bracket = parseBracketTitle(title) ?? parseBracketTitle(raw.question ?? "");
    if (!bracket) continue;
    let outcomes = [];
    try { outcomes = JSON.parse(raw.outcomes ?? '["Yes","No"]'); } catch { outcomes = ["Yes", "No"]; }
    const yesIndex = outcomes.findIndex((o) => String(o).toLowerCase() === "yes");
    const noIndex = yesIndex === 0 ? 1 : 0;
    out.push({
      id: String(raw.id ?? ""),
      marketId: String(raw.id ?? ""),
      title: String(raw.question ?? title),
      bracket,
      tickSize: Number(raw.orderPriceMinTickSize ?? 0.001) || 0.001,
      yesToken: String(tokenIds[yesIndex] ?? tokenIds[0]),
      noToken: String(tokenIds[noIndex] ?? tokenIds[1]),
    });
  }
  return out;
}

async function fetchAllTrades(clob, eventId) {
  const trades = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const res = await clob.getPublicTrades({ eventId: String(eventId), limit: 1000, cursor, takerOnly: false });
    for (const row of res.data || []) {
      const trade = normalizeTrade(row);
      if (trade) trades.push(trade);
    }
    const next = res.pagination?.next_cursor;
    if (!res.pagination?.has_more || !next) break;
    cursor = next;
    await sleep(180);
  }
  return trades;
}

async function fetchPrices(tokenId, startSec, endSec) {
  const url = `${DATA}/v2/prices-history?token_id=${encodeURIComponent(tokenId)}&start=${startSec}&end=${endSec}&bucket_seconds=60`;
  let json = await cachedJson(url, `prices ${tokenId.slice(0, 10)}`);
  let rows = Array.isArray(json?.data) ? json.data : [];
  // Data API v2 history only covers a rolling ~15-day window. Older events
  // (the October backfill) need the CLOB legacy max-history endpoint.
  if (!rows.length) {
    const legacyUrl = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=max&fidelity=1`;
    json = await cachedJson(legacyUrl, `legacy prices ${tokenId.slice(0, 10)}`);
    rows = Array.isArray(json?.history) ? json.history : Array.isArray(json?.data) ? json.data : [];
  }
  return rows
    .map((row) => ({
      ts: Number(row.t ?? row.timestamp),
      price: Number(row.p ?? row.price),
    }))
    .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.price) && p.price > 0 && p.price < 1)
    .filter((p) => p.ts >= startSec && p.ts <= endSec)
    .sort((a, b) => a.ts - b.ts);
}

async function analyzeEvent(event, clob) {
  if (!event || event.closed !== true) return { status: "skipped", reason: "not closed" };
  const markets = normalizeMarkets(event);
  if (!markets.length) return { status: "skipped", reason: "no bracket markets" };
  const resolution = parseResolutionSource(event.resolutionSource);
  if (!resolution?.dateParam) return { status: "skipped", reason: "no resolution station/date" };
  const city = extractCity(event.title, markets[0]?.title);
  if (!city || city.toLowerCase() === "hong kong") return { status: "skipped", reason: "excluded city" };
  if (ONLY_CITY && city.toLowerCase() !== ONLY_CITY.toLowerCase()) return { status: "skipped", reason: "city filter" };

  const metarRaw = await cachedJson(
    `${METAR}?ids=${encodeURIComponent(resolution.station)}&format=json&date=${encodeURIComponent(resolution.dateParam)}&hours=48`,
    `metar ${resolution.station}`,
  );
  const localRows = filterLocalDay(parseMetarReports(Array.isArray(metarRaw) ? metarRaw : []), resolution.anchorSec);
  const nodes = findWarmingNodes({
    metarRows: localRows,
    markets,
    dayStartSec: resolution.anchorSec - 27 * 3600,
    dayEndSec: resolution.anchorSec - 3 * 3600,
  }).map((node) => ({ ...node, eventSlug: event.slug, eventTitle: event.title, nodeId: `${event.slug}:${node.nodeTs}` }));
  if (!nodes.length) return { status: "skipped", reason: "no warming nodes", city };

  const trades = await fetchAllTrades(clob, event.id);
  const priceByToken = new Map();
  const dayStartSec = resolution.anchorSec - 27 * 3600;
  const dayEndSec = resolution.anchorSec - 3 * 3600;
  for (const node of nodes) {
    if (priceByToken.has(node.yesToken)) continue;
    const start = Math.max(node.nodeTs - 900, dayStartSec - 900);
    const end = Math.min(node.nodeTs + 300, dayEndSec + 900);
    priceByToken.set(node.yesToken, await fetchPrices(node.yesToken, start, end));
    await sleep(100);
  }
  const stats = computeTraderReactionStats({ warmingNodes: nodes, targetMarketTrades: trades, priceByToken });
  const eventDate = new Date(resolution.anchorSec * 1000).toISOString().slice(0, 10);
  return {
    status: "ok",
    slug: event.slug,
    city,
    eventDate,
    station: resolution.station,
    eventId: String(event.id),
    marketCount: markets.length,
    trades: trades.length,
    wallets: new Set(trades.map((t) => t.wallet)).size,
    warmingNodes: nodes.length,
    qualifiedNodes: stats.qualifiedWarmingNodes,
    nodes: stats.nodes.map((node) => ({
      nodeId: node.nodeId,
      nodeTs: node.nodeTs,
      tempC: node.tempC,
      bracket: node.bracket,
      qualified: node.qualified,
      baselinePrice: node.baselinePrice,
      repriceTs: node.repriceTs,
      repricePrice: node.repricePrice,
      repriceDirection: node.repriceDirection,
      aheadWallets: node.aheadWallets,
      prePositionedWallets: node.prePositionedWallets,
      involvedWallets: node.involvedWallets,
    })),
    names: Object.fromEntries(stats.users.map((u) => [u.wallet, u.pseudonym])),
    signature: SIGNATURE,
    analyzedAt: new Date().toISOString(),
  };
}

function factToAggregate(fact) {
  return {
    city: fact.city,
    nodes: fact.nodes || [],
    names: fact.names || {},
  };
}

function aggregateFacts(facts, nowIso) {
  const cities = new Map();
  const globalNodes = [];
  const globalNames = new Map();
  for (const fact of facts) {
    if (!fact?.city) continue;
    if (!cities.has(fact.city)) {
      cities.set(fact.city, { city: fact.city, nodes: [], names: new Map() });
    }
    const city = cities.get(fact.city);
    for (const node of fact.nodes || []) {
      if (!node.qualified) continue;
      const enriched = {
        ...node,
        eventSlug: fact.slug,
        eventDate: fact.eventDate,
        city: fact.city,
      };
      city.nodes.push(enriched);
      globalNodes.push(enriched);
    }
    for (const [wallet, name] of Object.entries(fact.names || {})) {
      if (name && !city.names.has(wallet)) city.names.set(wallet, name);
      if (name && !globalNames.has(wallet)) globalNames.set(wallet, name);
    }
  }
  const build = (nodes, names, cityName = null, includeEvents = false) => {
    const qualifiedWarmingNodes = nodes.length;
    const involved = new Map();
    const ahead = new Map();
    const eventsByWallet = new Map();
    for (const node of nodes) {
      for (const wallet of node.involvedWallets || []) involved.set(wallet, (involved.get(wallet) || 0) + 1);
      for (const wallet of node.aheadWallets || []) {
        ahead.set(wallet, (ahead.get(wallet) || 0) + 1);
        if (!includeEvents) continue;
        const list = eventsByWallet.get(wallet) || [];
        list.push({
          eventSlug: node.eventSlug,
          eventDate: node.eventDate,
          city: node.city,
          nodeTs: node.nodeTs,
          bracket: node.bracket,
          marketId: node.marketId,
          ahead: true,
          prePositioned: (node.prePositionedWallets || []).includes(wallet),
          baselinePrice: node.baselinePrice,
          repriceTs: node.repriceTs,
          repricePrice: node.repricePrice,
          repriceDirection: node.repriceDirection,
        });
        eventsByWallet.set(wallet, list);
      }
    }
    const eligibleMin = cityName ? CITY_ELIGIBLE_MIN_QUALIFIED : REACTION_DEFAULTS.eligibleMinQualified;
    const users = [...involved.entries()].map(([wallet, involvedCount]) => {
      const aheadCount = Math.min(ahead.get(wallet) || 0, qualifiedWarmingNodes);
      const rate = qualifiedWarmingNodes > 0 ? aheadCount / qualifiedWarmingNodes : 0;
      const wilson = wilsonLowerBound(aheadCount, qualifiedWarmingNodes);
      return {
        wallet,
        pseudonym: names.get(wallet) || "",
        reactionRate: Number(rate.toFixed(6)),
        per100: Number((rate * 100).toFixed(3)),
        ahead: aheadCount,
        qualified: qualifiedWarmingNodes,
        involved: involvedCount,
        wilsonLower: Number(wilson.toFixed(6)),
        eligible: cityName
          ? qualifiedWarmingNodes >= CITY_ELIGIBLE_MIN_QUALIFIED && rate > 0.9
          : qualifiedWarmingNodes >= eligibleMin && wilson > REACTION_DEFAULTS.eligibleMinWilson,
        events: includeEvents ? (eventsByWallet.get(wallet) || []).sort((a, b) => a.nodeTs - b.nodeTs) : undefined,
      };
    }).sort((a, b) => b.wilsonLower - a.wilsonLower || b.ahead - a.ahead || a.wallet.localeCompare(b.wallet));
    return { city: cityName, qualifiedWarmingNodes, eligibleMin, users };
  };
  const cityPayload = {};
  for (const [city, info] of [...cities.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    cityPayload[city] = build(info.nodes, info.names, city, true);
  }
  const global = build(globalNodes, globalNames, null, false);
  return {
    generatedAt: nowIso,
    fromDate: FROM,
    toDate: TO,
    signature: SIGNATURE,
    qualifiedWarmingNodes: global.qualifiedWarmingNodes,
    users: global.users,
    cities: cityPayload,
  };
}

async function writeLeaderboards(payload) {
  const cityHeader = [
    "/**",
    " * shared/traderReactionLeaderboards.js 鈥?GENERATED FILE, do not edit by hand.",
    " * City-independent reaction leaderboards from local incremental facts.",
    ` * generatedAt: ${payload.generatedAt}`,
    ` * range: ${payload.fromDate} .. ${payload.toDate}`,
    ` * qualified warming nodes (global): ${payload.qualifiedWarmingNodes}`,
    " */",
    "",
    `export const TRADER_REACTION_LEADERBOARDS = ${JSON.stringify(payload, null, 2)};`,
    "",
    "export default TRADER_REACTION_LEADERBOARDS;",
    "",
  ].join("\n");
  await fs.writeFile(CITY_LEADERBOARD_FILE, cityHeader, "utf8");

  const globalHeader = [
    "/**",
    " * shared/traderReactionLeaderboard.js 鈥?GENERATED FILE, do not edit by hand.",
    " * Global compatibility leaderboard; see traderReactionLeaderboards.js for cities.",
    ` * generatedAt: ${payload.generatedAt}`,
    ` * range: ${payload.fromDate} .. ${payload.toDate}`,
    ` * qualified warming nodes: ${payload.qualifiedWarmingNodes}`,
    " */",
    "",
    `export const TRADER_REACTION_LEADERBOARD = ${JSON.stringify({
      generatedAt: payload.generatedAt,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      qualifiedWarmingNodes: payload.qualifiedWarmingNodes,
      users: payload.users,
    }, null, 2)};`,
    "",
    "export default TRADER_REACTION_LEADERBOARD;",
    "",
  ].join("\n");
  await fs.writeFile(GLOBAL_LEADERBOARD_FILE, globalHeader, "utf8");

  // Compact JSON consumed by the web leaderboard view. The generated JS module
  // above is intentionally complete for research/copy code; this file is capped
  // so the browser never downloads tens of megabytes.
  const uiPayload = {
    generatedAt: payload.generatedAt,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    qualifiedWarmingNodes: payload.qualifiedWarmingNodes,
    cities: Object.fromEntries(
      Object.entries(payload.cities).map(([city, info]) => [
        city,
        {
          city,
          qualifiedWarmingNodes: info.qualifiedWarmingNodes,
          eligibleMin: info.eligibleMin,
          userCount: info.users.length,
          eligibleCount: info.users.filter((user) => user.eligible).length,
          users: info.users.slice(0, 100).map((user) => ({
            ...user,
            events: Array.isArray(user.events) ? user.events.slice(0, 50) : [],
          })),
        },
      ]),
    ),
  };
  await fs.writeFile(
    path.join(PROJECT_ROOT, "shared", "traderReactionLeaderboards.json"),
    `${JSON.stringify(uiPayload)}\n`,
    "utf8",
  );
}

async function acquireLock() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  try {
    const old = JSON.parse(await fs.readFile(LOCK_PATH, "utf8"));
    if (old?.pid && old.pid !== process.pid) {
      try { process.kill(old.pid, 0); return false; } catch { /* stale */ }
    }
  } catch { /* no lock */ }
  await fs.writeFile(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return true;
}

async function main() {
  if (!(await acquireLock())) {
    log("another trader-reaction sync is running; exiting");
    return;
  }
  try {
    await fs.mkdir(EVENTS_DIR, { recursive: true });
    let manifest = await readJson(MANIFEST_PATH, { version: 1, signature: SIGNATURE, events: {}, lastProcessedDate: null });
    if (manifest.signature !== SIGNATURE && FORCE) {
      // Algorithm changed: old facts are not comparable. Keep raw cache, rebuild facts.
      await fs.rm(EVENTS_DIR, { recursive: true, force: true });
      await fs.mkdir(EVENTS_DIR, { recursive: true });
      manifest = { version: 1, signature: SIGNATURE, events: {}, lastProcessedDate: null };
      await writeJsonAtomic(MANIFEST_PATH, manifest);
    }
    if (manifest.signature !== SIGNATURE) {
      throw new Error("algorithm signature changed; run once with --force to rebuild facts");
    }

    const dates = dateRange(FROM, TO);
    const clob = new ClobClient({ maxRps: 5, timeoutMs: 25_000, log: () => {} });
    let processed = 0;
    for (const date of dates) {
      let listings;
      try {
        listings = await listEventsForDate(date);
      } catch (err) {
        log(`date ${date}: listing failed: ${err.message}`);
        continue;
      }
      log(`date ${date}: ${listings.length} closed events`);
      for (const event of listings) {
        if (!event?.slug || /polyv2/i.test(event.slug)) continue;
        if (!FORCE && manifest.events?.[event.slug]?.signature === SIGNATURE) continue;
        if (MAX_EVENTS && processed >= MAX_EVENTS) break;
        try {
          const result = await analyzeEvent(event, clob);
          if (result.status !== "ok") {
            log(`  skip ${event.slug}: ${result.reason}`);
            manifest.events[event.slug] = {
              signature: SIGNATURE,
              date,
              city: result.city || null,
              status: result.status,
              reason: result.reason,
              processedAt: new Date().toISOString(),
            };
          } else {
            await writeJsonAtomic(path.join(EVENTS_DIR, `${event.slug}.json`), result);
            manifest.events[event.slug] = {
              signature: SIGNATURE,
              date,
              city: result.city,
              status: "ok",
              qualifiedNodes: result.qualifiedNodes,
              processedAt: result.analyzedAt,
            };
            processed += 1;
            log(`  ok ${event.slug} [${result.city}] nodes=${result.warmingNodes} qualified=${result.qualifiedNodes}`);
          }
          manifest.lastProcessedDate = date;
          await writeJsonAtomic(MANIFEST_PATH, manifest);
        } catch (err) {
          log(`  error ${event.slug}: ${err.message}`);
        }
        await sleep(120);
      }
      if (MAX_EVENTS && processed >= MAX_EVENTS) break;
      manifest.lastProcessedDate = date;
      await writeJsonAtomic(MANIFEST_PATH, manifest);
    }

    // Rebuild rankings from every locally stored fact (not only this run).
    const files = (await fs.readdir(EVENTS_DIR).catch(() => [])).filter((f) => f.endsWith(".json"));
    const facts = [];
    for (const file of files) {
      const fact = await readJson(path.join(EVENTS_DIR, file), null);
      if (fact?.status === "ok") facts.push(fact);
    }
    const payload = aggregateFacts(facts, new Date().toISOString());
    await writeLeaderboards(payload);
    log(`facts=${facts.length} cities=${Object.keys(payload.cities).length} qualified=${payload.qualifiedWarmingNodes}`);
  } finally {
    await fs.rm(LOCK_PATH, { force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error("sync-trader-reactions failed:", err);
  process.exitCode = 1;
});
