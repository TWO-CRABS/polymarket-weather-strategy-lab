/** Simple account mirror mode: poll one trader's public fills and mirror BUY/SELL. */
import { newId } from "../util.js";
import { normalizeTrade } from "../research/traderReaction.js";
import { executeExit, tryEntry } from "./runTrading.js";

const POLL_MS = 2_000;

function normalizedWallet(value) {
  return String(value || "").trim().toLowerCase();
}

function tradeKey(trade) {
  return [
    trade.transaction_hash || trade.transactionHash || "",
    trade.proxy_wallet || trade.wallet || "",
    trade.token_id || trade.tokenId || "",
    trade.side || "",
    trade.timestamp || trade.ts || "",
  ].join("|");
}

function marketForTrade(run, trade) {
  const condition = String(trade.condition_id || trade.conditionId || "").toLowerCase();
  const tokenId = String(trade.token_id || trade.tokenId || "");
  for (const market of run.markets?.values?.() || []) {
    if (condition && String(market.conditionId || "").toLowerCase() === condition) return market;
    if (tokenId && (market.tokens?.yesTokenId === tokenId || market.tokens?.noTokenId === tokenId)) return market;
  }
  return null;
}

function mirrorSignal(run, market, trade, now) {
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
    windowSec: 0,
    priceField: "last",
    kind: "entry",
    tradable: true,
    reason: "mirror_trade",
    mirrorTraderWallet: normalizedWallet(trade.proxy_wallet || run.config.signal.copyTraderUser),
    mirrorTradeSide: String(trade.side || "").toUpperCase(),
    mirrorTradeTs: Number(trade.timestamp) * 1000 || now,
  };
}

async function copyMirrorTrade(run, market, trade, now) {
  const key = tradeKey(trade);
  if (run._mirrorSeen.has(key)) return false;
  run._mirrorSeen.add(key);
  const side = String(trade.side || "").toUpperCase();
  const outcome = String(trade.outcome || "").toLowerCase().startsWith("y") ? "YES" : "NO";
  const tokenId = outcome === "YES" ? market.tokens?.yesTokenId : market.tokens?.noTokenId;
  if (!tokenId) return false;
  if (side === "BUY") {
    if (run.portfolio.positionsForMarket(market.id).some((position) => position.tokenId === tokenId)) return false;
    const signal = mirrorSignal(run, market, trade, now);
    run.signals.push(signal);
    run.store.appendRecord(run.id, "signal", signal);
    run.sse.broadcast("signal", { signal }, run.id);
    await tryEntry(run, signal, market, now, { reason: "mirror_trade" });
    return true;
  }
  if (side === "SELL") {
    const position = run.portfolio.positionsForMarket(market.id).find((item) => item.tokenId === tokenId);
    if (!position) return false;
    await executeExit(run, position, market, "mirror_trade", now);
    return true;
  }
  return false;
}

export async function processMirrorTrades(run, now) {
  const cfg = run.config.signal;
  if (!cfg?.copyTraderEnabled || cfg.copyTraderMode !== "mirror") return;
  if (run.mode === "replay") return;
  const wallet = normalizedWallet(cfg.copyTraderUser);
  if (!wallet) return;
  if (!(now - (run._mirrorLastPoll || 0) >= POLL_MS)) return;
  const previousPoll = run._mirrorLastPoll || 0;
  run._mirrorLastPoll = now;
  if (!run._mirrorSeen) run._mirrorSeen = new Set();
  if (typeof run.source?.getPublicTrades !== "function") return;
  const startMs = Math.max(Number(run.startedAt || now - 60_000), previousPoll ? previousPoll - 5_000 : now - 60_000);
  try {
    const result = await run.source.getPublicTrades({
      user: wallet,
      limit: 200,
      start: Math.floor(startMs / 1000),
      end: Math.floor(now / 1000),
      takerOnly: cfg.mirrorTakerOnly !== false,
    });
    const trades = (Array.isArray(result?.data) ? result.data : [])
      .map((row) => normalizeTrade(row))
      .filter(Boolean)
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    for (const trade of trades) {
      const market = marketForTrade(run, trade);
      if (!market || market.closed) continue;
      await copyMirrorTrade(run, market, trade, now);
    }
  } catch {
    /* transient upstream errors: retry on next tick */
  }
}
