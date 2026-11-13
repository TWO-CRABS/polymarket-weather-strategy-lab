/**
 * Mark every stored ahead trade as Taker (active) or Maker (passive).
 * Taker fills are fetched from the same public event-trades endpoint with
 * taker_only=true and matched by transaction/wallet/side/outcome/timestamp.
 *
 * Run: node scripts/mark-taker-trades.mjs [--force] [--limit=10]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS_DIR = path.join(PROJECT_ROOT, "data", "trader-reactions", "events");
const DATA = "https://data-api.polymarket.com";
const VERSION = 1;
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) || 0 : 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error(last?.message || String(last));
}

function tradeKey(trade) {
  return [
    String(trade.transaction_hash || trade.transactionHash || "").toLowerCase(),
    String(trade.wallet || trade.proxy_wallet || "").toLowerCase(),
    String(trade.side || "").toUpperCase(),
    String(trade.outcome || "").toUpperCase(),
    Number(trade.ts ?? trade.timestamp),
    Number(trade.size),
  ].join("|");
}

async function takerKeys(eventId) {
  const keys = new Set();
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ event_id: String(eventId), limit: "1000", taker_only: "true" });
    if (cursor) params.set("cursor", cursor);
    const json = await fetchJson(`${DATA}/v2/trades?${params.toString()}`);
    for (const trade of json.data || []) keys.add(tradeKey(trade));
    const next = json?.pagination?.next_cursor;
    if (!json?.pagination?.has_more || !next) break;
    cursor = next;
    await sleep(100);
  }
  return keys;
}

async function markFact(fact) {
  if (!fact?.eventId) return 0;
  const keys = await takerKeys(fact.eventId);
  let marked = 0;
  for (const node of fact.nodes || []) {
    for (const trade of node.aheadTrades || []) {
      trade.taker = keys.has(tradeKey(trade));
      marked += 1;
    }
    node.takerMarkedVersion = VERSION;
  }
  return marked;
}

const files = (await fs.readdir(EVENTS_DIR)).filter((name) => name.endsWith(".json"));
const candidates = [];
for (const file of files) {
  const full = path.join(EVENTS_DIR, file);
  let fact;
  try {
    fact = JSON.parse(await fs.readFile(full, "utf8"));
  } catch {
    continue;
  }
  if (!(fact.nodes || []).some((node) => (node.aheadTrades || []).length)) continue;
  if (!force && (fact.nodes || []).every((node) => node.takerMarkedVersion === VERSION)) continue;
  candidates.push({ file, full, fact });
  if (limit && candidates.length >= limit) break;
}

let next = 0;
let done = 0;
let marked = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= candidates.length) return;
    const { file, full, fact } = candidates[index];
    try {
      marked += await markFact(fact);
      await fs.writeFile(full, `${JSON.stringify(fact)}\n`, "utf8");
      done += 1;
      if (done % 10 === 0) console.log(`marked ${done}/${candidates.length} events, ${marked} trades`);
    } catch (err) {
      console.log(`error ${file}: ${err.message}`);
    }
    await sleep(80);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`done: ${done}/${candidates.length} events, ${marked} trades`);
