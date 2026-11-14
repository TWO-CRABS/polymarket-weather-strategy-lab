/**
 * Fetch all public trades for one wallet, store raw rows locally, and produce a
 * before/after 2026-05-22 behavior analysis for the Trader Analysis tab.
 *
 * Usage: node scripts/fetch-trader-analysis.mjs [wallet] [--force]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = "https://data-api.polymarket.com";
const DEFAULT_WALLET = "0x6011655c4afb76f36dd1b08a137a1ba73466b31e";
const wallet = String(process.argv.find((arg) => /^0x[a-fA-F0-9]{40}$/.test(arg)) || DEFAULT_WALLET).toLowerCase();
const force = process.argv.includes("--force");
const DATA_DIR = path.join(PROJECT_ROOT, "data", "trader-analysis", wallet);
const RAW_FILE = path.join(DATA_DIR, "trades.jsonl");
const META_FILE = path.join(DATA_DIR, "meta.json");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "shared", "traderAnalysis.json");
const BOUNDARY = Date.parse("2026-05-21T16:00:00Z"); // 2026-05-22 00:00 Asia/Shanghai
const BOUNDARY_LABEL = "2026-05-22 00:00 Asia/Shanghai";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, tries = 5) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error(last?.message || String(last));
}

function tradeKey(trade) {
  return [
    trade.transaction_hash || "",
    trade.proxy_wallet || "",
    trade.token_id || "",
    trade.side || "",
    trade.timestamp || "",
    trade.size || "",
    trade.price || "",
  ].join("|");
}

function dayKey(ts, timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000));
}

function hourKey(ts, timeZone = "Asia/Shanghai") {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(new Date(ts * 1000)));
}

function analyzePeriod(trades, from, to, label) {
  const rows = trades.filter((trade) => trade.timestamp * 1000 >= from && trade.timestamp * 1000 < to);
  const notional = rows.reduce((sum, trade) => sum + Number(trade.size) * Number(trade.price), 0);
  const buys = rows.filter((trade) => String(trade.side).toUpperCase() === "BUY").length;
  const sells = rows.length - buys;
  const yes = rows.filter((trade) => String(trade.outcome).toLowerCase().startsWith("y")).length;
  const weather = rows.filter((trade) => /highest-temperature-/i.test(String(trade.event_slug || ""))).length;
  const markets = new Map();
  const events = new Map();
  const days = new Set();
  const hours = Array(24).fill(0);
  for (const trade of rows) {
    const key = trade.condition_id || trade.slug || "unknown";
    const current = markets.get(key) || {
      conditionId: key,
      slug: trade.slug || "",
      title: trade.title || "",
      eventSlug: trade.event_slug || "",
      count: 0,
      notional: 0,
    };
    current.count += 1;
    current.notional += Number(trade.size) * Number(trade.price);
    markets.set(key, current);
    const eventKey = trade.event_slug || "unknown";
    const event = events.get(eventKey) || { eventSlug: eventKey, count: 0, notional: 0 };
    event.count += 1;
    event.notional += Number(trade.size) * Number(trade.price);
    events.set(eventKey, event);
    days.add(dayKey(trade.timestamp));
    hours[hourKey(trade.timestamp)] += 1;
  }
  const sortedMarkets = [...markets.values()].sort((a, b) => b.count - a.count);
  const sortedEvents = [...events.values()].sort((a, b) => b.count - a.count);
  return {
    label,
    from: from,
    to: to,
    tradeCount: rows.length,
    buyCount: buys,
    sellCount: sells,
    buyRatio: rows.length ? buys / rows.length : 0,
    yesCount: yes,
    noCount: rows.length - yes,
    notional: Number(notional.toFixed(2)),
    avgNotional: rows.length ? Number((notional / rows.length).toFixed(2)) : 0,
    avgPrice: rows.length ? Number((rows.reduce((sum, t) => sum + Number(t.price), 0) / rows.length).toFixed(4)) : 0,
    avgSize: rows.length ? Number((rows.reduce((sum, t) => sum + Number(t.size), 0) / rows.length).toFixed(2)) : 0,
    marketCount: markets.size,
    eventCount: events.size,
    activeDays: days.size,
    tradesPerActiveDay: days.size ? Number((rows.length / days.size).toFixed(2)) : 0,
    weatherTradeCount: weather,
    weatherRatio: rows.length ? weather / rows.length : 0,
    firstTs: rows.length ? Math.min(...rows.map((t) => t.timestamp)) : null,
    lastTs: rows.length ? Math.max(...rows.map((t) => t.timestamp)) : null,
    hourly: hours,
    topMarkets: sortedMarkets.slice(0, 8).map((market) => ({ ...market, notional: Number(market.notional.toFixed(2)) })),
    topEvents: sortedEvents.slice(0, 8).map((event) => ({ ...event, notional: Number(event.notional.toFixed(2)) })),
  };
}

async function fetchAllTrades() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let existing = [];
  if (!force) {
    try {
      const text = await fs.readFile(RAW_FILE, "utf8");
      existing = text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      existing = [];
    }
  }
  if (existing.length) {
    // A complete previous fetch is reused; the manifest is only a hint.
    try {
      const meta = JSON.parse(await fs.readFile(META_FILE, "utf8"));
      if (meta?.complete && meta.wallet === wallet) return existing;
    } catch {
      /* re-fetch */
    }
  }
  const seen = new Set();
  const rows = [];
  let cursor = null;
  let page = 0;
  for (; page < 1000; page += 1) {
    const params = new URLSearchParams({ user: wallet, limit: "1000", taker_only: "false" });
    if (cursor) params.set("cursor", cursor);
    const json = await fetchJson(`${DATA}/v2/trades?${params.toString()}`);
    const data = Array.isArray(json?.data) ? json.data : [];
    for (const trade of data) {
      const key = tradeKey(trade);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(trade);
    }
    const next = json?.pagination?.next_cursor;
    if (!json?.pagination?.has_more || !next) break;
    cursor = next;
    if ((page + 1) % 10 === 0) {
      console.log(`fetched ${rows.length} trades (${page + 1} pages)`);
      const tmp = `${RAW_FILE}.tmp`;
      await fs.writeFile(tmp, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
      await fs.rename(tmp, RAW_FILE);
      await fs.writeFile(META_FILE, JSON.stringify({ wallet, complete: false, pages: page + 1, count: rows.length, cursor }), "utf8");
    }
    await sleep(80);
  }
  await fs.writeFile(RAW_FILE, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await fs.writeFile(META_FILE, JSON.stringify({ wallet, complete: true, pages: page + 1, count: rows.length, fetchedAt: Date.now() }), "utf8");
  return rows;
}

const trades = await fetchAllTrades();
console.log(`total trades: ${trades.length}`);
const boundaryTs = Math.floor(BOUNDARY / 1000);
const before = analyzePeriod(trades, 0, BOUNDARY, "5月22日之前");
const after = analyzePeriod(trades, BOUNDARY, Number.MAX_SAFE_INTEGER, "5月22日至今");
const timestamps = trades.map((trade) => Number(trade.timestamp)).filter(Number.isFinite);
const payload = {
  wallet,
  generatedAt: new Date().toISOString(),
  boundary: BOUNDARY,
  boundaryLabel: BOUNDARY_LABEL,
  totalTrades: trades.length,
  firstTradeTs: timestamps.length ? Math.min(...timestamps) : null,
  lastTradeTs: timestamps.length ? Math.max(...timestamps) : null,
  before,
  after,
};
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote ${OUTPUT_FILE}`);
console.log(JSON.stringify({ total: trades.length, before: before.tradeCount, after: after.tradeCount }, null, 2));
