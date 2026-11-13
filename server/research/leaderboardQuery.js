/**
 * On-demand city leaderboard aggregation over the incremental local event facts.
 * Used by GET /api/trader-leaderboards for arbitrary date ranges.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wilsonLowerBound } from "./traderReaction.js";

export const CITY_ELIGIBLE_MIN_QUALIFIED = 20;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_EVENTS_DIR = path.join(PROJECT_ROOT, "data", "trader-reactions", "events");

function dateInRange(date, fromDate, toDate) {
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

export async function queryCityLeaderboard({
  city,
  fromDate = "",
  toDate = "",
  limit = 100,
  eventType = "all",
  eventsDir = DEFAULT_EVENTS_DIR,
} = {}) {
  const wantedCity = String(city || "").trim();
  const allCities = !wantedCity || ["__all__", "all", "*"].includes(wantedCity.toLowerCase());
  if (!allCities && !wantedCity) throw new Error("city is required");
  const type = ["all", "trade", "pre"].includes(String(eventType || "all")) ? String(eventType || "all") : "all";
  let files = [];
  try {
    files = (await fs.readdir(eventsDir)).filter((name) => name.endsWith(".json"));
  } catch {
    files = [];
  }
  const facts = [];
  let availableFrom = null;
  let availableTo = null;
  for (const file of files) {
    let fact;
    try {
      fact = JSON.parse(await fs.readFile(path.join(eventsDir, file), "utf8"));
    } catch {
      continue;
    }
    if (!fact || !fact.eventDate) continue;
    if (!allCities && fact.city !== wantedCity) continue;
    if (availableFrom === null || fact.eventDate < availableFrom) availableFrom = fact.eventDate;
    if (availableTo === null || fact.eventDate > availableTo) availableTo = fact.eventDate;
    if (!dateInRange(fact.eventDate, fromDate, toDate)) continue;
    facts.push(fact);
  }

  const nodes = [];
  const names = new Map();
  for (const fact of facts) {
    for (const [wallet, name] of Object.entries(fact.names || {})) {
      if (name && !names.has(wallet)) names.set(wallet, name);
    }
    for (const node of fact.nodes || []) {
      if (!node.qualified) continue;
      nodes.push({
        ...node,
        eventSlug: fact.slug,
        eventDate: fact.eventDate,
        city: fact.city,
      });
    }
  }

  const qualifiedWarmingNodes = nodes.length;
  const involved = new Map();
  const ahead = new Map();
  const eventsByWallet = new Map();
  for (const node of nodes) {
    const preSet = new Set(node.prePositionedWallets || []);
    const matchingAhead = (node.aheadWallets || []).filter((wallet) => {
      const pre = preSet.has(wallet);
      if (type === "pre") return pre;
      if (type === "trade") return !pre;
      return true;
    });
    if (type === "all") {
      for (const wallet of node.involvedWallets || []) involved.set(wallet, (involved.get(wallet) || 0) + 1);
    } else {
      for (const wallet of matchingAhead) involved.set(wallet, (involved.get(wallet) || 0) + 1);
    }
    for (const wallet of matchingAhead) {
      ahead.set(wallet, (ahead.get(wallet) || 0) + 1);
      const list = eventsByWallet.get(wallet) || [];
      list.push({
        eventSlug: node.eventSlug,
        eventDate: node.eventDate,
        city: node.city,
        nodeTs: node.nodeTs,
        bracket: node.bracket,
        marketId: node.marketId,
        ahead: true,
        prePositioned: preSet.has(wallet),
        baselinePrice: node.baselinePrice,
        repriceTs: node.repriceTs,
        repricePrice: node.repricePrice,
        repriceDirection: node.repriceDirection,
        trades: (node.aheadTrades || []).filter((trade) => trade.wallet === wallet),
      });
      eventsByWallet.set(wallet, list);
    }
  }

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
      eligible: qualifiedWarmingNodes >= CITY_ELIGIBLE_MIN_QUALIFIED && rate > 0.9,
      events: (eventsByWallet.get(wallet) || []).sort((a, b) => a.nodeTs - b.nodeTs),
    };
  }).sort((a, b) => (
    b.wilsonLower - a.wilsonLower
    || b.ahead - a.ahead
    || a.wallet.localeCompare(b.wallet)
  ));

  return {
    city: allCities ? "__all__" : wantedCity,
    cityLabel: allCities ? "所有城市" : wantedCity,
    fromDate: fromDate || availableFrom || "",
    toDate: toDate || availableTo || "",
    availableFrom,
    availableTo,
    qualifiedWarmingNodes,
    eligibleMin: CITY_ELIGIBLE_MIN_QUALIFIED,
    eventCount: facts.length,
    eventType: type,
    userCount: users.length,
    eligibleCount: users.filter((user) => user.eligible).length,
    users: users.slice(0, Math.max(1, Math.min(500, Number(limit) || 100))),
  };
}
