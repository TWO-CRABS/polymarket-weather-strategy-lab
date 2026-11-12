/**
 * METAR release-window signal.
 *
 * Ordering: fallback entry in `processMarkets` runs first; this module runs
 * after it. A release signal only uses normal risk checks (no bypass mode).
 */
import { newId, roundTo } from "../util.js";
import { pickPrice } from "./signal.js";
import { releaseNodeForCity } from "./metarReleaseWindow.js";
import { executeExit, fallbackEventKey, tryEntry } from "./runTrading.js";

const BUY_RETRY_MS = 10_000;

function positionsForMarket(run, marketId) {
  if (typeof run.portfolio?.positionsForMarket === "function") {
    return run.portfolio.positionsForMarket(marketId);
  }
  return [...(run.portfolio?.positions?.values?.() || [])].filter((p) => p.marketId === marketId);
}

function liveYesMid(market) {
  const q = market?.quotes?.YES;
  if (!q) return null;
  const bid = Number(q.bid);
  const ask = Number(q.ask);
  if (bid > 0 && ask > 0 && ask < 1 && bid < ask) return (bid + ask) / 2;
  const implied = Number(market.impliedProbability);
  return implied > 0 && implied < 1 ? implied : null;
}

function probabilityAt(series, ts) {
  let out = null;
  for (const sample of series || []) {
    if (Number(sample?.ts) > ts) break;
    const p = pickPrice(sample, "mid");
    if (p !== null) out = p;
  }
  return out;
}

function candidatesForGroup(run, group) {
  const out = [];
  for (const market of group.markets) {
    if (market.closed || market.acceptingOrders === false) continue;
    const pNow = liveYesMid(market);
    if (pNow === null) continue;
    const token = market.tokens?.yesTokenId;
    if (!token) continue;
    const history = run.source?.getHistory ? run.source.getHistory(token, 600) : [];
    out.push({ market, pNow, history });
  }
  return out;
}

function makeSignal(run, node, target, now) {
  const fromPrice = target.pBase ?? target.pNow;
  return {
    id: newId("sig"),
    ts: now,
    runId: run.id,
    marketId: target.market.id,
    city: target.market.city,
    bracket: target.market.bracket,
    direction: "up",
    outcome: "YES",
    tokenId: target.market.tokens.yesTokenId,
    fromPrice: roundTo(fromPrice, 6),
    toPrice: roundTo(target.pNow, 6),
    changePct: target.pBase ? roundTo((target.pNow / target.pBase - 1) * 100, 4) : 0,
    absChange: roundTo(target.pNow - fromPrice, 6),
    windowSec: run.config.signal.metarReleaseWindowSec,
    priceField: "mid",
    kind: "entry",
    tradable: true,
    reason: "metar_release",
    releaseNodeTs: node.nodeTs,
    pBase: target.pBase,
    pNow: target.pNow,
  };
}

function pruneStates(run, now) {
  const state = run._metarReleaseState;
  if (!state) return;
  for (const [key, item] of state) {
    const windowMs = Number(run.config.signal.metarReleaseWindowSec) * 1000;
    if (now > item.nodeTs + windowMs) {
      state.delete(key);
      run._metarReleaseLockedGroups?.delete(item.groupKey);
    }
  }
}

/**
 * Process all active city/date groups at most once per release node.
 * @param {any} run
 * @param {number} now
 */
export async function processMetarRelease(run, now, opts = {}) {
  const cfg = run.config?.signal;
  if (!cfg?.metarReleaseEnabled) return;
  if (!run._metarReleaseState) run._metarReleaseState = new Map();
  if (!run._metarReleaseLockedGroups) run._metarReleaseLockedGroups = new Set();
  pruneStates(run, now);

  const groups = new Map();
  for (const marketId of run.marketIds || []) {
    const market = run.markets?.get?.(marketId);
    if (!market || market.closed) continue;
    const key = fallbackEventKey(market);
    if (!groups.has(key)) groups.set(key, { key, city: market.city, markets: [], marketIds: new Set() });
    const group = groups.get(key);
    group.markets.push(market);
    group.marketIds.add(market.id);
  }

  const threshold = Number(cfg.metarReleaseMinProbabilityPct) / 100;
  const windowSec = Number(cfg.metarReleaseWindowSec) || 120;
  for (const group of groups.values()) {
    const node = releaseNodeForCity(group.city, now, windowSec, opts.store);
    if (!node) continue;
    const stateKey = `${group.key}|${node.nodeTs}`;
    let state = run._metarReleaseState.get(stateKey);
    if (!state) {
      state = {
        nodeTs: node.nodeTs,
        groupKey: group.key,
        targetMarketId: null,
        signalId: null,
        buyDone: false,
        lastBuyAttemptAt: 0,
      };
      run._metarReleaseState.set(stateKey, state);
    }

    if (!state.targetMarketId) {
      let best = null;
      for (const candidate of candidatesForGroup(run, group)) {
        if (!(candidate.pNow > threshold)) continue;
        const pBase = probabilityAt(candidate.history, node.nodeTs);
        if (cfg.metarReleaseRequireRising && !(pBase !== null && candidate.pNow > pBase)) continue;
        if (!best || candidate.pNow > best.pNow) best = { ...candidate, pBase };
      }
      if (!best) continue;
      const signal = makeSignal(run, node, best, now);
      state.targetMarketId = best.market.id;
      state.signalId = signal.id;
      state.targetMarket = best.market;
      state.signal = signal;
      run._metarReleaseLockedGroups.add(group.key);
      run.signals.push(signal);
      run.store.appendRecord(run.id, "signal", signal);
      run.sse.broadcast("signal", { signal }, run.id);
    }

    const target = run.markets?.get?.(state.targetMarketId);
    if (!target) continue;

    // Sell target NO and other YES first. Reports use the existing rejected-exit
    // dedupe so a no-bid market does not spam every tick.
    for (const position of positionsForMarket(run, target.id)) {
      if (position.outcome !== "NO") continue;
      await executeExit(run, position, target, "metar_release_rotate", now);
    }
    for (const other of group.markets) {
      if (other.id === target.id) continue;
      for (const position of positionsForMarket(run, other.id)) {
        if (position.outcome !== "YES") continue;
        await executeExit(run, position, other, "metar_release_rotate", now);
      }
    }

    // Do not buy until all wrong-side positions have been sold.
    const wrongSideRemaining =
      positionsForMarket(run, target.id).some((p) => p.outcome === "NO") ||
      group.markets.some(
        (m) => m.id !== target.id && positionsForMarket(run, m.id).some((p) => p.outcome === "YES"),
      );
    if (wrongSideRemaining) continue;

    if (positionsForMarket(run, target.id).some((p) => p.outcome === "YES")) {
      state.buyDone = true;
      continue;
    }
    if (state.buyDone) continue;
    if (now - (state.lastBuyAttemptAt || 0) < BUY_RETRY_MS) continue;
    state.lastBuyAttemptAt = now;
    const result = await tryEntry(run, state.signal, target, now, { reason: "metar_release" });
    if (result?.ok) state.buyDone = true;
  }
}

/** Test helper: probability of a sample series at or before ts. */
export function releaseProbabilityAt(series, ts) {
  return probabilityAt(series, ts);
}
