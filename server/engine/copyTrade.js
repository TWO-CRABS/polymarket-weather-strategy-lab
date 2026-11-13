/**
 * Copy-trade signal.
 *
 * Weather-only, release-window scoped. The primary wallet has priority; when
 * it is silent for the configured delay, the top reaction-rate wallets from the
 * static leaderboard are tried in order. All orders use normal risk checks.
 */
import fs from "node:fs";
import { newId } from "../util.js";
import { releaseNodeForCity } from "./metarReleaseWindow.js";
import { executeExit, tryEntry } from "./runTrading.js";

const POLL_MS = 2_000;
const TRADE_WINDOW_SEC = 180;
const CITY_LEADERBOARDS_PATH = new URL("../../shared/traderReactionLeaderboards.json", import.meta.url);
let cityLeaderboardsCache = null;
let cityLeaderboardsMtime = 0;

function cityLeaderboards() {
  try {
    const stat = fs.statSync(CITY_LEADERBOARDS_PATH);
    if (!cityLeaderboardsCache || stat.mtimeMs !== cityLeaderboardsMtime) {
      cityLeaderboardsCache = JSON.parse(fs.readFileSync(CITY_LEADERBOARDS_PATH, "utf8"));
      cityLeaderboardsMtime = stat.mtimeMs;
    }
    return cityLeaderboardsCache;
  } catch {
    return null;
  }
}

function normalizedWallet(value) {
  return String(value || "").trim().toLowerCase();
}

function leaderboardSubstitutes(city, minRatePct, count = 3) {
  const cityUsers = cityLeaderboards()?.cities?.[city]?.users;
  const users = Array.isArray(cityUsers) ? cityUsers : [];
  return users
    .filter((user) => user && user.wallet)
    .filter((user) => user.eligible === true)
    .filter((user) => Number(user.reactionRate) * 100 >= minRatePct)
    .slice(0, Math.max(1, Math.min(10, Number(count) || 3)))
    .map((user, index) => ({
      wallet: normalizedWallet(user.wallet),
      label: user.pseudonym || "",
      rank: index + 1,
    }))
    .filter((user) => user.wallet);
}

function candidateWallets(run, city, opts = {}) {
  const cfg = run.config.signal;
  const primary = normalizedWallet(cfg.copyTraderUser);
  const subs = Array.isArray(opts.substitutes)
    ? opts.substitutes.map((value) => (
      typeof value === "string"
        ? { wallet: normalizedWallet(value), label: "", rank: null }
        : { ...value, wallet: normalizedWallet(value.wallet) }
    )).filter((user) => user.wallet)
    : leaderboardSubstitutes(
      city,
      Number(cfg.copyTraderMinReactionRatePct) || 90,
      Number(cfg.copyTraderSubstituteCount) || 3,
    );
  const all = [];
  if (primary) all.push({ wallet: primary, source: "primary", label: "", rank: null });
  for (const sub of subs) {
    if (!all.some((item) => item.wallet === sub.wallet)) {
      all.push({ wallet: sub.wallet, source: "substitute", label: sub.label || "", rank: sub.rank ?? null });
    }
  }
  return all;
}

function activeReleaseWindow(run, now, store) {
  const cfg = run.config.signal;
  const windowSec = Number(cfg.metarReleaseWindowSec) || 120;
  const groups = new Map();
  for (const marketId of run.marketIds || []) {
    const market = run.markets?.get?.(marketId);
    if (!market || market.closed) continue;
    const city = market.city;
    const node = releaseNodeForCity(city, now, windowSec, store);
    if (!node) continue;
    if (!groups.has(city)) groups.set(city, { city, node, markets: new Map(), conditions: new Map() });
    const group = groups.get(city);
    group.markets.set(market.id, market);
    if (market.conditionId) group.conditions.set(String(market.conditionId).toLowerCase(), market);
  }
  if (!groups.size) return null;
  const list = [...groups.values()];
  const nodeTs = Math.max(...list.map((g) => g.node.nodeTs));
  const allowedMarketIds = new Set();
  const byCondition = new Map();
  for (const group of list) {
    for (const id of group.markets.keys()) allowedMarketIds.add(id);
    for (const [condition, market] of group.conditions) byCondition.set(condition, market);
  }
  return { nodeTs, groups: list, allowedMarketIds, byCondition };
}

async function fetchUserTrades(run, wallet, now, nodeTs) {
  if (typeof run.source?.getPublicTrades !== "function") return [];
  const windowMs = (Number(run.config.signal.metarReleaseWindowSec) || 300) * 1000;
  const start = Math.max(
    Number(run.startedAt || 0),
    Number(nodeTs) - windowMs,
    now - TRADE_WINDOW_SEC * 1000,
  );
  const end = Math.floor(now / 1000);
  try {
    const result = await run.source.getPublicTrades({
      user: wallet,
      limit: 200,
      start: Math.floor(start / 1000),
      end,
      takerOnly: true,
    });
    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    return [];
  }
}

function marketForTrade(run, trade, active) {
  const condition = String(trade?.condition_id || "").toLowerCase();
  const byCondition = active.byCondition.get(condition);
  if (byCondition) return byCondition;
  const tokenId = String(trade?.token_id || "");
  for (const market of run.markets?.values?.() || []) {
    if (market.tokens?.yesTokenId === tokenId || market.tokens?.noTokenId === tokenId) return market;
  }
  return null;
}

function tradeSignal(run, market, trade, candidate, now, nodeTs) {
  const outcome = String(trade.outcome || "").toLowerCase().startsWith("y") ? "YES" : "NO";
  const tokenId = outcome === "YES" ? market.tokens?.yesTokenId : market.tokens?.noTokenId;
  return {
    id: newId("sig"),
    ts: now,
    runId: run.id,
    marketId: market.id,
    city: market.city,
    bracket: market.bracket,
    direction: outcome === "YES" ? "up" : "down",
    outcome,
    tokenId,
    fromPrice: Number(trade.price) || null,
    toPrice: Number(trade.price) || null,
    changePct: 0,
    absChange: 0,
    windowSec: Number(run.config.signal.metarReleaseWindowSec) || 120,
    priceField: "last",
    kind: "entry",
    tradable: true,
    reason: "copy_trade",
    copyTraderWallet: normalizedWallet(candidate.wallet || trade.proxy_wallet),
    copyTraderLabel: candidate.label || "",
    copySource: candidate.source,
    copySubstituteRank: candidate.rank ?? null,
    copyNodeTs: nodeTs ?? null,
  };
}

async function copyOneTrade(run, market, trade, candidate, now, nodeTs) {
  const nodeKey = nodeTs ? `${market.city || ""}|${Number(nodeTs)}` : "";
  if (nodeKey && run._copyNodeSignals?.has(nodeKey)) return false;
  const side = String(trade.side || "").toUpperCase();
  const tradeKey = `${trade.transaction_hash || ""}|${trade.proxy_wallet || ""}|${trade.token_id || ""}|${side}|${trade.timestamp || ""}`;
  if (run._copyTradeSeen.has(tradeKey)) return false;
  run._copyTradeSeen.add(tradeKey);
  const outcome = String(trade.outcome || "").toLowerCase().startsWith("y") ? "YES" : "NO";
  const tokenId = outcome === "YES" ? market.tokens?.yesTokenId : market.tokens?.noTokenId;
  if (!tokenId) return false;
  if (side === "BUY") {
    if (run.portfolio.positionsForMarket(market.id).some((p) => p.tokenId === tokenId)) return false;
    const signal = tradeSignal(run, market, trade, candidate, now, nodeTs);
    if (nodeKey) run._copyNodeSignals.add(nodeKey);
    run.signals.push(signal);
    run.store.appendRecord(run.id, "signal", signal);
    run.sse.broadcast("signal", { signal }, run.id);
    await tryEntry(run, signal, market, now, { reason: "copy_trade" });
    return true;
  }
  if (side === "SELL") {
    const position = run.portfolio.positionsForMarket(market.id).find((p) => p.tokenId === tokenId);
    if (!position) return false;
    await executeExit(run, position, market, "copy_trade", now);
    return true;
  }
  return false;
}

/**
 * @param {any} run
 * @param {number} now
 */
export async function processCopyTrades(run, now, opts = {}) {
  const cfg = run.config.signal;
  if (!cfg?.copyTraderEnabled) return;
  if (run.mode === "replay") return;
  if (!(now - (run._copyTradeLastPoll || 0) >= POLL_MS)) return;
  run._copyTradeLastPoll = now;
  if (!run._copyTradeSeen) run._copyTradeSeen = new Set();
  const active = activeReleaseWindow(run, now, opts.store);
  if (!active) return;
  if (!run._copyPrimaryNodes) run._copyPrimaryNodes = new Map();
  if (!run._copyNodeDone) run._copyNodeDone = new Map();
  if (!run._copyNodeSignals) run._copyNodeSignals = new Set();
  const hasPrimary = active.groups.some((group) => candidateWallets(run, group.city, opts).some((candidate) => candidate.source === "primary"));
  const fallbackDelayMs = hasPrimary
    ? Math.max(0, Number(cfg.copyTraderFallbackDelaySec) || 0) * 1000
    : 0;

  for (const group of active.groups) {
    const nodeKey = `${group.city || ""}|${Number(group.node.nodeTs)}`;
    if (run._copyNodeDone.get(group.city) === group.node.nodeTs) continue;
    if (run._copyNodeSignals.has(nodeKey)) {
      run._copyNodeDone.set(group.city, group.node.nodeTs);
      continue;
    }
    const alreadySignaled = (run.signals || []).some((signal) => (
      signal.reason === "copy_trade"
      && signal.city === group.city
      && Number(signal.copyNodeTs) === Number(group.node.nodeTs)
    ));
    if (alreadySignaled) {
      run._copyNodeDone.set(group.city, group.node.nodeTs);
      run._copyNodeSignals.add(nodeKey);
      continue;
    }
    const candidates = candidateWallets(run, group.city, opts);
    if (!candidates.length) continue;
    candidateLoop: for (const candidate of candidates) {
      if (candidate.source === "substitute" && now < group.node.nodeTs + fallbackDelayMs) continue;
      const trades = await fetchUserTrades(run, candidate.wallet, now, group.node.nodeTs);
      if (!trades.length) continue;
      const windowMs = (Number(cfg.metarReleaseWindowSec) || 300) * 1000;
      const eligible = trades
        .filter((trade) => Number(trade.timestamp) * 1000 >= Math.max(Number(run.startedAt || 0), Number(group.node.nodeTs) - windowMs))
        .filter((trade) => marketForTrade(run, trade, {
          byCondition: group.conditions,
          allowedMarketIds: new Set(group.markets.keys()),
        }))
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
      for (const trade of eligible) {
        const market = marketForTrade(run, trade, {
          byCondition: group.conditions,
          allowedMarketIds: new Set(group.markets.keys()),
        });
        if (!market) continue;
        const copied = await copyOneTrade(run, market, trade, candidate, now, group.node.nodeTs);
        if (copied) {
          if (nodeKey) run._copyNodeSignals.add(nodeKey);
          run._copyNodeDone.set(group.city, group.node.nodeTs);
          if (candidate.source === "primary") run._copyPrimaryNodes.set(group.city, group.node.nodeTs);
          break candidateLoop;
        }
      }
    }
  }
}
