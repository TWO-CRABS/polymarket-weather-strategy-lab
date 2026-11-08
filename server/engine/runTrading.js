/**
 * server/engine/runTrading.js — market-level trading logic for one Run.
 *
 * Extracted from run.js (pure refactor): settlement polling, per-market signal
 * → exit → entry flow, risk pre-checks, FAK book-walk fills and trade
 * bookkeeping. Every function receives the owning `Run` instance; behaviour
 * is identical to the previous Run methods (docs/03 §3–§6).
 */
import { calcTakerFee } from "./fee.js";
import { bookMid, simulateBuy, simulateSell } from "./execution.js";
import { evaluateSignal, createSignalState } from "./signal.js";
import { newId, roundTo } from "../util.js";

export const RESOLUTION_POLL_MS = 20_000;

/* ------------------------------- settlement ------------------------------ */

export async function handleSettlements(run, now) {
  if (!run.source || run.source.mode !== "live" || typeof run.resolutionProvider !== "function") return;
  for (const market of run.markets.values()) {
    if (run._settledMarkets.has(market.id)) continue;
    const endMs = Date.parse(market.endDate);
    const due = market.closed || (Number.isFinite(endMs) && endMs <= now);
    if (!due) continue;
    if (run.portfolio.positionsForMarket(market.id).length === 0) {
      run._settledMarkets.add(market.id);
      continue;
    }
    const last = run._resolutionChecks.get(market.id) || 0;
    if (now - last < RESOLUTION_POLL_MS) continue;
    run._resolutionChecks.set(market.id, now);
    let resolution = null;
    try {
      resolution = await run.resolutionProvider(market.id);
    } catch (err) {
      run.log("warn", `resolution check failed for ${market.id}: ${err.message}`);
    }
    if (!resolution) continue;
    if (resolution.status === "resolved" && resolution.payout !== null) {
      settleMarket(run, market, resolution.payout, now);
    } else if (resolution.closed) {
      market.resolutionPending = true;
    }
  }
}

export function settleMarket(run, market, payoutPerShare, now) {
  const results = run.portfolio.settleMarket(market.id, payoutPerShare, now);
  for (const result of results) {
    const position = result.position;
    const trade = makeTrade(run, {
      market,
      tokenId: position.tokenId,
      outcome: position.outcome,
      side: "SELL",
      shares: position.shares,
      price: payoutPerShare,
      notional: result.payout,
      fee: 0,
      slippageCost: 0,
      spreadCost: 0,
      realizedPnl: result.realizedPnl,
      totalCost: result.payout,
      cashDelta: result.payout,
      signalId: null,
      reason: "resolution",
      status: "filled",
      rejectReason: null,
      bookLevels: [],
      ts: now,
    });
    recordTrade(run, trade, null);
  }
  run._settledMarkets.add(market.id);
  market.closed = true;
  run.sse.log("info", `市场结算 ${market.city} ${market.bracket}（兑付 ${payoutPerShare}）`, run.id);
}

/* ------------------------------ per market ------------------------------- */

export async function processMarkets(run, now) {
  for (const market of run.markets.values()) {
    if (!market || market.closed) continue;
    const yesBook = run.source?.getBook ? run.source.getBook(market.tokens.yesTokenId) : null;
    const hash = yesBook?.hash || "";
    const lastHash = run._lastBookHash.get(market.id);
    let signal = null;
    if (!lastHash || lastHash !== hash) {
      const windowSec = Math.max(run.config.signal.windowSec * 2, run.config.signal.windowSec + 120);
      const series = run.source?.getHistory ? run.source.getHistory(market.tokens.yesTokenId, windowSec) : [];
      const result = evaluateSignal({
        market,
        series,
        config: run.config,
        now,
        state: run.signalStates.get(market.id) || createSignalState(),
      });
      run.signalStates.set(market.id, result.state);
      signal = result.signal;
      if (hash) run._lastBookHash.set(market.id, hash);
      if (signal) {
        signal.id = newId("sig");
        signal.runId = run.id;
        run.signals.push(signal);
        run.store.appendRecord(run.id, "signal", signal);
        run.sse.broadcast("signal", { signal }, run.id);
      }
    }

    await evaluateExits(run, market, now, signal);
    if (signal) await tryEntry(run, signal, market, now);
  }
}

/** Exit plan: settlement handled earlier; then SL > TP > maxHold > opposite. */
export async function evaluateExits(run, market, now, signal) {
  const positions = run.portfolio.positionsForMarket(market.id);
  if (positions.length === 0) return;
  if (run.config.exit.holdToResolution) return;
  for (const position of positions) {
    const quote = position.outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
    const bid = quote?.bid ?? 0;
    if (!(bid > 0)) continue; // no executable bid this tick; retry next tick
    const shares = position.shares;
    const exitFee = calcTakerFee(shares, bid);
    const netProceeds = shares * bid - exitFee;
    const retLiqPct = position.costBasis > 0 ? (netProceeds / position.costBasis - 1) * 100 : 0;
    const holdSec = (now - position.entryTs) / 1000;

    let reason = null;
    if (retLiqPct <= -run.config.exit.stopLossPct) reason = "stop_loss";
    else if (retLiqPct >= run.config.exit.takeProfitPct) reason = "take_profit";
    else if (holdSec >= run.config.exit.maxHoldSec) reason = "max_hold";
    else if (signal && run.config.exit.exitOnOppositeSignal && signal.outcome !== position.outcome) {
      reason = "opposite_signal";
    }
    if (!reason) continue;
    await executeExit(run, position, market, reason, now);
  }
}

export async function executeExit(run, position, market, reason, now) {
  const book = run.source?.getBook ? run.source.getBook(position.tokenId) : null;
  if (!book || !Array.isArray(book.bids) || book.bids.length === 0) {
    recordExitRejection(run, position, market, reason, "no_liquidity", now);
    return;
  }
  const fill = simulateSell({
    book,
    shares: position.shares,
    feeRate: feeRate(run, market),
    slippageBufferBps: run.config.execution.slippageBufferBps,
    tickSize: market.tickSize,
    minOrderShares: market.minOrderShares,
  });
  if (!fill.ok) {
    recordExitRejection(run, position, market, reason, fill.rejectReason, now);
    return;
  }
  const reference = book.bestBid;
  const result = run.portfolio.sell({
    tokenId: position.tokenId,
    shares: fill.shares,
    price: fill.price,
    fee: fill.fee,
    ts: now,
  });
  if (result.soldShares <= 0) return;
  const trade = makeTrade(run, {
    market,
    tokenId: position.tokenId,
    outcome: position.outcome,
    side: "SELL",
    shares: result.soldShares,
    price: fill.price,
    notional: fill.notional,
    fee: fill.fee,
    slippageCost: roundTo(Math.abs(fill.price - reference) * result.soldShares, 5),
    spreadCost: roundTo(Math.abs(reference - (bookMid(book) ?? reference)) * result.soldShares, 5),
    realizedPnl: result.realizedPnl,
    totalCost: fill.totalCost,
    cashDelta: fill.totalCost,
    signalId: null,
    reason,
    status: fill.status,
    rejectReason: null,
    bookLevels: fill.bookLevels,
    ts: now,
  });
  recordTrade(run, trade, result.position);
  if (result.closedRoundPnl !== null) {
    run.sse.broadcast("metrics", { metrics: run.currentMetrics() }, run.id);
  }
}

export function recordExitRejection(run, position, market, reason, rejectReason, now) {
  const key = `${position.tokenId}|${reason}|${rejectReason}`;
  if (run._rejectedExitKeys.has(key)) return; // avoid one log line per tick
  run._rejectedExitKeys.add(key);
  const trade = makeTrade(run, {
    market,
    tokenId: position.tokenId,
    outcome: position.outcome,
    side: "SELL",
    shares: position.shares,
    price: 0,
    notional: 0,
    fee: 0,
    slippageCost: 0,
    spreadCost: 0,
    realizedPnl: 0,
    totalCost: 0,
    cashDelta: 0,
    signalId: null,
    reason,
    status: "rejected",
    rejectReason,
    bookLevels: [],
    ts: now,
  });
  recordTrade(run, trade, null);
}

/* --------------------------------- entry ---------------------------------- */

export function feeRate(run, market) {
  return market.feeSchedule?.rate ?? run.config.fees.takerFeeRate ?? 0.05;
}

/** Fixed risk pre-check order (docs/03 §6). */
export function preRiskChecks(run, market, signal, now) {
  if (run.killSwitchTripped || run.status !== "running") return { ok: false, reason: "risk_blocked" };
  const equity = run.portfolio.equity();
  if (run.config.risk.killSwitch && equity < run.peakEquity) {
    const drawdownPct = ((run.peakEquity - equity) / run.peakEquity) * 100;
    if (drawdownPct >= run.config.risk.maxDrawdownPct) return { ok: false, reason: "risk_blocked" };
  }
  if (run.config.risk.dailyLossLimitUsd > 0 && equity - run.dayStartEquity <= -run.config.risk.dailyLossLimitUsd) {
    return { ok: false, reason: "risk_blocked" };
  }
  if (!market.acceptingOrders) return { ok: false, reason: "market_not_accepting_orders" };
  if (market.stale) return { ok: false, reason: "stale_market" };
  if (Number.isFinite(market.spread) && market.spread > run.config.universe.maxSpread) {
    return { ok: false, reason: "spread_too_wide" };
  }
  const ttrSec = (Date.parse(market.endDate) - now) / 1000;
  if (!Number.isFinite(ttrSec)) return { ok: false, reason: "risk_blocked" };
  if (ttrSec < run.config.universe.minTimeToResolutionSec || ttrSec > run.config.universe.maxTimeToResolutionSec) {
    return { ok: false, reason: "risk_blocked" };
  }
  const yesMid = market.impliedProbability;
  if (
    !Number.isFinite(yesMid) ||
    yesMid < run.config.universe.minPrice ||
    yesMid > run.config.universe.maxPrice
  ) {
    return { ok: false, reason: "risk_blocked" };
  }
  const quote = signal.outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
  const bestAsk = quote?.ask ?? 0;
  if (!(bestAsk > 0)) return { ok: false, reason: "no_liquidity" };
  if (bestAsk < run.config.universe.minPrice || bestAsk > run.config.universe.maxPrice) {
    return { ok: false, reason: "risk_blocked" };
  }
  if (run.portfolio.positions.size >= run.config.execution.maxPositions) {
    return { ok: false, reason: "max_positions" };
  }
  if (run.portfolio.positionsForMarket(market.id).length >= run.config.execution.maxPositionsPerMarket) {
    return { ok: false, reason: "max_positions_per_market" };
  }
  return { ok: true };
}

/** Notional budget (docs/03 §3.2): `sizingValue`/`pct_equity` target the ORDER
 *  NOTIONAL; the official taker fee is debited from cash separately. */
export function computeBudget(run, market) {
  const equity = run.portfolio.equity();
  const execution = run.config.execution;
  const targetUsd =
    execution.sizingMode === "pct_equity" ? (equity * execution.sizingValue) / 100 : execution.sizingValue;
  const marketCost = run.portfolio
    .positionsForMarket(market.id)
    .reduce((sum, position) => sum + position.costBasis, 0);
  return Math.min(targetUsd, run.portfolio.cash, execution.maxPositionUsd - marketCost);
}

export async function tryEntry(run, signal, market, now) {
  if (run.portfolio.positionsForMarket(market.id).length > 0) return; // no pyramiding by default
  const risk = preRiskChecks(run, market, signal, now);
  if (!risk.ok) {
    recordRejectedEntry(run, signal, market, risk.reason, now);
    return;
  }
  const budgetUsd = computeBudget(run, market);
  if (!(budgetUsd > 0)) {
    recordRejectedEntry(run, signal, market, "insufficient_cash", now);
    return;
  }
  const book = run.source?.getBook ? run.source.getBook(signal.tokenId) : null;
  if (!book) {
    recordRejectedEntry(run, signal, market, "no_liquidity", now);
    return;
  }
  const fill = simulateBuy({
    book,
    budgetUsd,
    cashUsd: run.portfolio.cash,
    feeRate: feeRate(run, market),
    slippageBufferBps: run.config.execution.slippageBufferBps,
    tickSize: market.tickSize,
  });
  if (!fill.ok) {
    recordRejectedEntry(run, signal, market, fill.rejectReason, now);
    return;
  }
  if (fill.notional + fill.fee > run.portfolio.cash + 1e-9) {
    recordRejectedEntry(run, signal, market, "insufficient_cash", now);
    return;
  }
  const quote = signal.outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
  const reference = quote?.ask ?? fill.price;
  const portfolioPosition = run.portfolio.buy({
    tokenId: signal.tokenId,
    marketId: market.id,
    outcome: signal.outcome,
    city: market.city,
    bracket: market.bracket,
    shares: fill.shares,
    price: fill.price,
    fee: fill.fee,
    ts: now,
    midPrice: quote?.mid ?? fill.price,
    impliedProbability: market.impliedProbability,
  });
  const trade = makeTrade(run, {
    market,
    tokenId: signal.tokenId,
    outcome: signal.outcome,
    side: "BUY",
    shares: fill.shares,
    price: fill.price,
    notional: fill.notional,
    fee: fill.fee,
    slippageCost: roundTo(Math.abs(fill.price - reference) * fill.shares, 5),
    spreadCost: roundTo(Math.abs(reference - (bookMid(book) ?? reference)) * fill.shares, 5),
    realizedPnl: 0,
    totalCost: fill.totalCost,
    cashDelta: -fill.totalCost,
    signalId: signal.id,
    reason: "signal",
    status: fill.status,
    rejectReason: null,
    bookLevels: fill.bookLevels,
    ts: now,
  });
  recordTrade(run, trade, portfolioPosition);
  run.sampleEquity(now);
}

/* ----------------------------- bookkeeping -------------------------------- */

export function makeTrade(run, fields) {
  const {
    market, tokenId, outcome, side, shares, price, notional, fee, slippageCost, spreadCost,
    realizedPnl, totalCost, cashDelta, signalId, reason, status, rejectReason, bookLevels, ts,
  } = fields;
  return {
    id: newId("trd"),
    ts,
    runId: run.id,
    marketId: market.id,
    tokenId,
    outcome,
    side,
    shares: roundTo(shares, 2),
    price: roundTo(price, 6),
    notional: roundTo(notional, 5),
    fee: roundTo(fee, 5),
    slippageCost: roundTo(slippageCost || 0, 5),
    spreadCost: roundTo(spreadCost || 0, 5),
    totalCost: roundTo(totalCost, 5),
    cashDelta: roundTo(cashDelta, 5),
    realizedPnl: roundTo(realizedPnl || 0, 5),
    signalId: signalId ?? null,
    reason,
    status,
    rejectReason: rejectReason ?? null,
    bookLevels,
  };
}

export function recordTrade(run, trade, position) {
  run.trades.push(trade);
  if (trade.status !== "rejected" && trade.reason !== "resolution") run.filledTradeCount += 1;
  if (trade.status !== "rejected") {
    run._spreadCost = roundTo(run._spreadCost + (trade.spreadCost || 0), 6);
    run._depthSlippageCost = roundTo(run._depthSlippageCost + (trade.slippageCost || 0), 6);
  }
  run.store.appendRecord(run.id, "trade", trade);
  run.sse.broadcast("trade", { trade, position: position ?? null }, run.id);
  run.sse.broadcast(
    "positions",
    { positions: run.portfolio.snapshots(), positionsValue: run.portfolio.positionsValue() },
    run.id,
  );
}

export function recordRejectedEntry(run, signal, market, rejectReason, now) {
  const trade = makeTrade(run, {
    market,
    tokenId: signal.tokenId,
    outcome: signal.outcome,
    side: "BUY",
    shares: 0,
    price: 0,
    notional: 0,
    fee: 0,
    slippageCost: 0,
    spreadCost: 0,
    realizedPnl: 0,
    totalCost: 0,
    cashDelta: 0,
    signalId: signal.id,
    reason: "signal",
    status: "rejected",
    rejectReason,
    bookLevels: [],
    ts: now,
  });
  recordTrade(run, trade, null);
}
