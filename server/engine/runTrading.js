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
import { effectiveTradingEndMs } from "../data/gamma.js";
import { newId, roundTo } from "../util.js";

export const RESOLUTION_POLL_MS = 20_000;

/* ------------------------------- settlement ------------------------------ */

export async function handleSettlements(run, now) {
  if (!run.source || run.source.mode !== "live" || typeof run.resolutionProvider !== "function") return;
  for (const market of run.markets.values()) {
    if (run._settledMarkets.has(market.id)) continue;
    const endMs = effectiveTradingEndMs(market);
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
  // 全局兜底：每个观察窗口周期检查一次，空仓则建两笔兜底仓（第 1 高 YES + 第 3 高 NO）
  await maybePeriodicFallback(run, now);
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
  if (Number.isFinite(market.liquidityUsd) && market.liquidityUsd < run.config.universe.minLiquidityUsd) {
    return { ok: false, reason: "liquidity_too_low" };
  }
  if (Number.isFinite(market.spread) && market.spread > run.config.universe.maxSpread) {
    return { ok: false, reason: "spread_too_wide" };
  }
  const ttrSec = (effectiveTradingEndMs(market) - now) / 1000;
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

export async function tryEntry(run, signal, market, now, opts = {}) {
  const reason = opts.reason || "signal";
  const reject = (rejectReason) => {
    recordRejectedEntry(run, signal, market, rejectReason, now, { reason });
    return { ok: false, reason: rejectReason };
  };
  if (run.portfolio.positionsForMarket(market.id).length > 0) {
    // no pyramiding by default; do not spam rejected trades for this silent guard
    return { ok: false, reason: "max_positions_per_market", silent: true };
  }
  const risk = preRiskChecks(run, market, signal, now);
  if (!risk.ok) return reject(risk.reason);
  const budgetUsd = computeBudget(run, market);
  if (!(budgetUsd > 0)) return reject("insufficient_cash");
  const book = run.source?.getBook ? run.source.getBook(signal.tokenId) : null;
  if (!book) return reject("no_liquidity");
  const fill = simulateBuy({
    book,
    budgetUsd,
    cashUsd: run.portfolio.cash,
    feeRate: feeRate(run, market),
    slippageBufferBps: run.config.execution.slippageBufferBps,
    tickSize: market.tickSize,
  });
  if (!fill.ok) return reject(fill.rejectReason);
  if (fill.notional + fill.fee > run.portfolio.cash + 1e-9) return reject("insufficient_cash");
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
    reason,
    status: fill.status,
    rejectReason: null,
    bookLevels: fill.bookLevels,
    ts: now,
  });
  recordTrade(run, trade, portfolioPosition);
  run.sampleEquity(now);
  return { ok: true, trade, fill };
}

/* -------------- periodic fallback entries (per city/date event) ------------ */

/**
 * 周期兜底（execution.fallbackBuyEachWindow），**按城市/日期事件独立**：
 * 每个观察窗口（signal.windowSec）检查一次；对每个“当前没有持仓”的事件组
 * （negRisk 温度组，按 eventId 或 city+date 分组）：
 *   ① 组内概率第 1 高 → BUY YES
 *   ② 组内概率第 3 高 → BUY NO（组内可交易候选不足 3 个时只做第 1 笔）
 * 各城市互不影响：某城市已有持仓只跳过该城市；资金/仓位上限不足时剩余城市
 * 在后续周期继续尝试。周期按行情时间推进；仍走正常风控/仓位/手续费链路。
 */

/** 城市/日期事件分组 key（优先 eventId，快照缺 eventId 时回退 city+endDate）。 */
export function fallbackEventKey(market) {
  if (market?.eventId) return `event:${market.eventId}`;
  return `place:${market?.city || "未知"}|${String(market?.endDate || "").slice(0, 10)}`;
}

/** 可交易候选按 YES 隐含概率降序排列。 */
export function collectFallbackCandidates(run) {
  const candidates = [];
  for (const marketId of run.marketIds) {
    const market = run.markets.get(marketId);
    if (!market || market.closed || market.acceptingOrders === false) continue;
    const yes = market.quotes?.YES;
    const prob = Number(market.impliedProbability);
    if (!yes || !(yes.ask > 0)) continue;
    if (!Number.isFinite(prob)) continue;
    candidates.push({ market, prob });
  }
  candidates.sort((a, b) => b.prob - a.prob);
  return candidates;
}

/** 按城市/日期事件分组，组内按概率降序；组间按组内最高概率降序（稳定、可复现）。 */
export function groupFallbackCandidates(run) {
  const groups = new Map();
  for (const candidate of collectFallbackCandidates(run)) {
    const key = fallbackEventKey(candidate.market);
    if (!groups.has(key)) groups.set(key, { key, candidates: [], marketIds: new Set() });
    const group = groups.get(key);
    group.candidates.push(candidate);
    group.marketIds.add(candidate.market.id);
  }
  const list = [...groups.values()].map((group) => ({
    ...group,
    candidates: group.candidates.sort((a, b) => b.prob - a.prob),
  }));
  list.sort((a, b) => b.candidates[0].prob - a.candidates[0].prob || a.key.localeCompare(b.key));
  return list;
}

function eventHasOpenPosition(run, marketIds) {
  for (const position of run.portfolio.positions.values()) {
    if (marketIds.has(position.marketId)) return true;
  }
  return false;
}

/**
 * 各城市独立兜底计划：只对“没有任何持仓”的事件组生成 legs。
 * @returns {Array<{market:any, outcome:"YES"|"NO", rank:number, eventKey:string}>}
 */
export function planFallbackOrders(run) {
  const legs = [];
  for (const group of groupFallbackCandidates(run)) {
    if (eventHasOpenPosition(run, group.marketIds)) continue;
    if (group.candidates[0]) {
      legs.push({ market: group.candidates[0].market, outcome: "YES", rank: 1, eventKey: group.key });
    }
    if (group.candidates[2]) {
      legs.push({ market: group.candidates[2].market, outcome: "NO", rank: 3, eventKey: group.key });
    }
  }
  return legs;
}

export async function maybePeriodicFallback(run, now) {
  const execution = run.config.execution || {};
  if (!execution.fallbackBuyEachWindow) return { checked: false };
  const windowMs = Math.max(0, Number(run.config.signal.windowSec) || 0) * 1000;
  if (!(windowMs > 0)) return { checked: false };
  if (run._fallbackNextAt === null) {
    run._fallbackNextAt = now + windowMs;
    return { checked: false };
  }
  if (now < run._fallbackNextAt) return { checked: false };
  // 每个窗口最多检查一次；按 now 重新对齐，避免长缺口后连续补发
  run._fallbackNextAt = now + windowMs;

  const legs = planFallbackOrders(run);
  if (!legs.length) return { checked: true, skipped: "no_leg" };

  const results = [];
  let stoppedReason = null;
  const maxPositions = Number(execution.maxPositions) || 5;
  for (const leg of legs) {
    // 风险约束优先：仓位/现金不足时停止本次循环，剩余城市下个周期继续
    if (run.portfolio.positions.size >= maxPositions) {
      stoppedReason = "max_positions";
      break;
    }
    if (!(computeBudget(run, leg.market) > 0)) {
      stoppedReason = "insufficient_cash";
      break;
    }
    const { market, outcome, rank } = leg;
    const quote = outcome === "YES" ? market.quotes.YES : market.quotes.NO;
    const signal = {
      id: null,
      runId: run.id,
      ts: now,
      marketId: market.id,
      city: market.city,
      bracket: market.bracket,
      direction: outcome === "YES" ? "up" : "down",
      outcome,
      tokenId: outcome === "YES" ? market.tokens.yesTokenId : market.tokens.noTokenId,
      fromPrice: quote?.mid ?? quote?.ask ?? 0,
      toPrice: quote?.mid ?? quote?.ask ?? 0,
      changePct: 0,
      absChange: 0,
      windowSec: run.config.signal.windowSec,
      priceField: "mid",
      reason: "fallback_entry",
    };
    const result = await tryEntry(run, signal, market, now, { reason: "fallback_entry" });
    results.push({ ...result, outcome, rank, marketId: market.id, eventKey: leg.eventKey });
    if (result.ok) {
      run.sse.log(
        "info",
        `周期兜底建仓（${market.city} ${market.bracket}）：概率第 ${rank} 高 → ${outcome === "YES" ? "买 YES" : "买 NO"} ${result.trade.shares} 股 @ ${result.trade.price}`,
        run.id,
      );
    } else {
      run.sse.log("warn", `周期兜底建仓（${market.city}）第 ${rank} 高（${outcome}）未成交：${result.reason}`, run.id);
    }
  }
  return { checked: true, legs: results, stoppedReason };
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

export function recordRejectedEntry(run, signal, market, rejectReason, now, opts = {}) {
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
    reason: opts.reason || "signal",
    status: "rejected",
    rejectReason,
    bookLevels: [],
    ts: now,
  });
  recordTrade(run, trade, null);
}
