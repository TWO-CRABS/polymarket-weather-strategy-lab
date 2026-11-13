/**
 * Enrich every qualified warming node with all transaction-level ahead trades:
 *   target BUY YES / target SELL NO / other BUY NO / other SELL YES
 * inside [nodeTs-300, nodeTs+300]. A wallet/node pair still counts as one ahead
 * observation; multiple transactions are stored for display and per-trade P&L.
 *
 * Run: node scripts/enrich-ahead-trades.mjs [--force] [--limit=20]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS_DIR = path.join(PROJECT_ROOT, "data", "trader-reactions", "events");
const GAMMA = "https://gamma-api.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const VERSION = 2;
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) || 0 : 0;
const slugArg = process.argv.find((arg) => arg.startsWith("--slug="));
const onlySlug = slugArg ? slugArg.split("=").slice(1).join("=") : "";
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

function bracketFromTitle(market) {
  const text = String(market?.groupItemTitle || market?.question || "").trim();
  const match = /(-?\d+(?:\.\d+)?)\s*°\s*([CF])/i.exec(text);
  return match ? `${Number(match[1])}°${match[2].toUpperCase()}` : text;
}

function marketOutcome(market) {
  try {
    const prices = JSON.parse(market?.outcomePrices ?? "[]");
    if (prices.length >= 2) return Number(prices[0]) > Number(prices[1]);
  } catch {
    /* ignore */
  }
  return null;
}

function tradePayout(market, outcome) {
  const yes = marketOutcome(market);
  if (yes === null) return null;
  return String(outcome || "").toLowerCase().startsWith("y") ? (yes ? 1 : 0) : (yes ? 0 : 1);
}

async function eventTrades(eventId) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ event_id: String(eventId), limit: "1000", taker_only: "false" });
    if (cursor) params.set("cursor", cursor);
    const json = await fetchJson(`${DATA}/v2/trades?${params.toString()}`);
    rows.push(...(Array.isArray(json?.data) ? json.data : []));
    const next = json?.pagination?.next_cursor;
    if (!json?.pagination?.has_more || !next) break;
    cursor = next;
    await sleep(120);
  }
  return rows;
}

function findMarketForTrade(trade, marketsByCondition, marketsByToken) {
  const condition = String(trade.condition_id || "").toLowerCase();
  if (condition && marketsByCondition.has(condition)) return marketsByCondition.get(condition);
  const token = String(trade.token_id || "");
  return marketsByToken.get(token) || null;
}

async function enrichFact(fact) {
  if (!fact?.eventId) return 0;
  const event = await fetchJson(`${GAMMA}/events/${encodeURIComponent(fact.eventId)}`);
  const markets = Array.isArray(event?.markets) ? event.markets : [];
  const marketsByCondition = new Map();
  const marketsByToken = new Map();
  for (const market of markets) {
    if (market.conditionId) marketsByCondition.set(String(market.conditionId).toLowerCase(), market);
    try {
      for (const token of JSON.parse(market.clobTokenIds ?? "[]")) marketsByToken.set(String(token), market);
    } catch {
      /* ignore */
    }
  }
  const trades = await eventTrades(event.id);
  let updated = 0;
  for (const node of fact.nodes || []) {
    if (!node.qualified) continue;
    const targetBracket = String(node.bracket || "").trim();
    const targetMarket = markets.find((market) => bracketFromTitle(market) === targetBracket) || null;
    const preSet = new Set(node.prePositionedWallets || []);
    const nodeTrades = [];
    for (const trade of trades) {
      const ts = Number(trade.timestamp);
      if (!(ts >= node.nodeTs - 300 && ts <= node.nodeTs + 300)) continue;
      const market = findMarketForTrade(trade, marketsByCondition, marketsByToken);
      if (!market) continue;
      const isTarget = targetMarket && String(market.conditionId || "").toLowerCase() === String(targetMarket.conditionId || "").toLowerCase();
      const side = String(trade.side || "").toUpperCase();
      const outcome = String(trade.outcome || "").toUpperCase();
      const qualifies = isTarget
        ? (side === "BUY" && outcome.startsWith("Y")) || (side === "SELL" && outcome.startsWith("N"))
        : (side === "BUY" && outcome.startsWith("N")) || (side === "SELL" && outcome.startsWith("Y"));
      if (!qualifies) continue;
      const size = Number(trade.size) || 0;
      const price = Number(trade.price) || 0;
      if (!size || !price) continue;
      const payout = tradePayout(market, outcome);
      const pnl = payout === null ? null : side === "BUY" ? size * (payout - price) : size * (price - payout);
      nodeTrades.push({
        wallet: String(trade.proxy_wallet || "").toLowerCase(),
        ts,
        side,
        outcome,
        size,
        price,
        amount: Number((size * price).toFixed(2)),
        pnl: pnl === null ? null : Number(pnl.toFixed(2)),
        marketBracket: bracketFromTitle(market),
        target: Boolean(isTarget),
        transactionHash: String(trade.transaction_hash || ""),
      });
    }
    nodeTrades.sort((a, b) => a.ts - b.ts);
    const tradeWallets = new Set(nodeTrades.map((trade) => trade.wallet).filter(Boolean));
    const aheadWallets = new Set([...preSet, ...tradeWallets]);
    node.aheadTrades = nodeTrades.slice(0, 2000);
    node.aheadWallets = [...aheadWallets].sort();
    node.involvedWallets = [...new Set([...(node.involvedWallets || []), ...tradeWallets])].sort();
    node.aheadTradesVersion = VERSION;
    updated += 1;
  }
  return updated;
}

const files = (await fs.readdir(EVENTS_DIR)).filter((name) => name.endsWith(".json"));
const candidates = [];
for (const file of files) {
  if (onlySlug && !file.includes(onlySlug)) continue;
  const full = path.join(EVENTS_DIR, file);
  let fact;
  try {
    fact = JSON.parse(await fs.readFile(full, "utf8"));
  } catch {
    continue;
  }
  if (!force && (fact.nodes || []).every((node) => node.aheadTradesVersion === VERSION)) continue;
  if (!(fact.nodes || []).some((node) => node.qualified)) continue;
  candidates.push({ file, full, fact });
  if (limit && candidates.length >= limit) break;
}
let next = 0;
let done = 0;
let updatedNodes = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= candidates.length) return;
    const { file, full, fact } = candidates[index];
    try {
      updatedNodes += await enrichFact(fact);
      await fs.writeFile(full, `${JSON.stringify(fact)}\n`, "utf8");
      done += 1;
      if (done % 10 === 0) console.log(`enriched ${done}/${candidates.length} qualified events, ${updatedNodes} nodes`);
    } catch (err) {
      console.log(`error ${file}: ${err.message}`);
    }
    await sleep(80);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`done: ${done}/${candidates.length} events, ${updatedNodes} nodes`);
