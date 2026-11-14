/**
 * Compare the user's weather BUY-NO market bracket against the event's settled
 * winning bracket. Approximate range brackets by their midpoint.
 *
 * Reads raw trades from data/trader-analysis/<wallet>/trades.jsonl, fetches
 * Gamma event resolutions (cached), and writes shared/traderNoSettlement.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WALLET = "0x6011655c4afb76f36dd1b08a137a1ba73466b31e";
const RAW_FILE = path.join(PROJECT_ROOT, "data", "trader-analysis", WALLET, "trades.jsonl");
const CACHE_DIR = path.join(PROJECT_ROOT, "data", "trader-analysis", WALLET, "events");
const OUT_FILE = path.join(PROJECT_ROOT, "shared", "traderNoSettlement.json");
const GAMMA = "https://gamma-api.polymarket.com";
const BOUNDARY = Date.parse("2026-05-21T16:00:00Z");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseBracket(text) {
  const source = String(text || "");
  const match = /be\s+(.+?)\s+on\s+/i.exec(source);
  const label = (match?.[1] || "").trim();
  const unit = /°F/i.test(label) ? "F" : /°C/i.test(label) ? "C" : null;
  if (!unit) return null;
  const between = /between\s+(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/i.exec(label);
  if (between) {
    const lo = Number(between[1]);
    const hi = Number(between[2]);
    return { label, unit, lo, hi, mid: (lo + hi) / 2 };
  }
  const orBelow = /(-?\d+(?:\.\d+)?)\s*°[CF]\s*or below/i.exec(label);
  if (orBelow) {
    const hi = Number(orBelow[1]);
    return { label, unit, lo: -Infinity, hi, mid: hi };
  }
  const orHigher = /(-?\d+(?:\.\d+)?)\s*°[CF]\s*or higher/i.exec(label);
  if (orHigher) {
    const lo = Number(orHigher[1]);
    return { label, unit, lo, hi: Infinity, mid: lo };
  }
  const exact = /(-?\d+(?:\.\d+)?)\s*°[CF]/i.exec(label);
  if (exact) {
    const value = Number(exact[1]);
    return { label, unit, lo: value, hi: value, mid: value };
  }
  return null;
}

function toCelsius(value, unit) {
  return unit === "F" ? (value - 32) * 5 / 9 : value;
}

async function fetchEvent(slug) {
  const file = path.join(CACHE_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    /* fetch */
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(`${GAMMA}/events/slug/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const event = await res.json();
      const summary = {
        slug,
        closed: event?.closed === true,
        winningMarket: null,
      };
      for (const market of event?.markets || []) {
        let prices = [];
        try { prices = JSON.parse(market.outcomePrices ?? "[]"); } catch { prices = []; }
        if (Number(prices[0]) > 0.5) {
          summary.winningMarket = {
            title: market.question || "",
            label: market.groupItemTitle || market.question || "",
            outcomePrices: prices,
          };
          break;
        }
      }
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(summary), "utf8");
      return summary;
    } catch (error) {
      if (attempt === 3) return { slug, closed: false, error: error.message, winningMarket: null };
      await sleep(700 * (attempt + 1));
    }
  }
  return null;
}

const text = await fs.readFile(RAW_FILE, "utf8");
const trades = text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const noBuys = trades.filter((trade) => (
  /highest-temperature-/i.test(trade.event_slug || "")
  && String(trade.side).toUpperCase() === "BUY"
  && String(trade.outcome).toLowerCase().startsWith("n")
));
const slugs = [...new Set(noBuys.map((trade) => trade.event_slug).filter(Boolean))];
console.log(`NO BUY trades=${noBuys.length}, events=${slugs.length}`);

const events = new Map();
let next = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= slugs.length) return;
    const event = await fetchEvent(slugs[index]);
    if (event) events.set(slugs[index], event);
    if ((index + 1) % 100 === 0) console.log(`fetched ${index + 1}/${slugs.length} events`);
    await sleep(120);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

let total = 0;
let resolved = 0;
let below = 0;
let above = 0;
let equal = 0;
let skippedUnresolved = 0;
let skippedParse = 0;
let belowNotional = 0;
let comparableNotional = 0;
const byPeriod = new Map();
const examples = [];
for (const trade of noBuys) {
  total += 1;
  const event = events.get(trade.event_slug);
  if (!event?.closed || !event.winningMarket) {
    skippedUnresolved += 1;
    continue;
  }
  const marketBracket = parseBracket(trade.title);
  const settlementBracket = parseBracket(event.winningMarket.label) || parseBracket(event.winningMarket.title);
  if (!marketBracket || !settlementBracket) {
    skippedParse += 1;
    continue;
  }
  resolved += 1;
  comparableNotional += Number(trade.size) * Number(trade.price);
  const marketC = toCelsius(marketBracket.mid, marketBracket.unit);
  const settlementC = toCelsius(settlementBracket.mid, settlementBracket.unit);
  const periodKey = trade.timestamp * 1000 >= BOUNDARY ? "after" : "before";
  const period = byPeriod.get(periodKey) || { total: 0, below: 0, above: 0, equal: 0 };
  period.total += 1;
  const notional = Number(trade.size) * Number(trade.price);
  if (marketC < settlementC - 1e-6) {
    below += 1;
    belowNotional += notional;
    period.below += 1;
    if (examples.length < 12) examples.push({
      title: trade.title,
      market: marketBracket.label,
      settlement: settlementBracket.label,
      ts: trade.timestamp,
      notional: Number(notional.toFixed(2)),
    });
  } else if (marketC > settlementC + 1e-6) {
    above += 1;
    period.above += 1;
  } else {
    equal += 1;
    period.equal += 1;
  }
  byPeriod.set(periodKey, period);
}

const payload = {
  wallet: WALLET,
  generatedAt: new Date().toISOString(),
  totalWeatherNoBuyTrades: noBuys.length,
  uniqueEvents: slugs.length,
  resolvedComparable: resolved,
  below: below,
  above: above,
  equal: equal,
  belowRatio: resolved ? below / resolved : 0,
  belowRatioAll: noBuys.length ? below / noBuys.length : 0,
  belowNotional: Number(belowNotional.toFixed(2)),
  comparableNotional: Number(comparableNotional.toFixed(2)),
  skippedUnresolvedEvents: skippedUnresolved,
  skippedParse: skippedParse,
  byPeriod: Object.fromEntries([...byPeriod.entries()].map(([key, value]) => [key, {
    ...value,
    belowRatio: value.total ? value.below / value.total : 0,
  }])),
  examples,
};
await fs.writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify(payload, null, 2));
