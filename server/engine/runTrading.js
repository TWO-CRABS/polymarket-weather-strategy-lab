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
import { effectiveTradingEndMs, sideDepthUsd } from "../data/gamma.js";
import { isFallbackBlockedAtMetarRelease } from "./metarReleaseWindow.js";
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

/**
 * Record a non-tradable probability-shift observation. It never calls tryEntry
 * and never affects maxSignalsPerMarket/cooldown of entry signals.
 */
export function recordObservationSignal(run, market, candidate, now) {
  if (!candidate || run.config.signal.recordObservation === false) return null;
  // Keep the p_ref>=1¢ hard floor: don't create noise from degenerate prices.
  if (!(Number(candidate.fromPrice) >= 0.01)) return null;
  const direction = candidate.direction === "down" ? "down" : "up";
  const key = `${market.id}|${direction}`;
  const cooldownMs = Math.max(10, Number(run.config.signal.cooldownSec) || 0) * 1000;
  if (!run._observationLast) run._observationLast = new Map();
  const last = run._observationLast.get(key) || 0;
  if (now - last < cooldownMs) return null;

  const outcome = direction === "up" ? "YES" : "NO";
  const observation = {
    id: newId("sig"),
    ts: now,
    runId: run.id,
    marketId: market.id,
    city: market.city,
    bracket: market.bracket,
    direction,
    outcome,
    tokenId: outcome === "YES" ? market.tokens.yesTokenId : market.tokens.noTokenId,
    fromPrice: candidate.fromPrice,
    toPrice: candidate.toPrice,
    changePct: candidate.changePct,
    absChange: candidate.absChange,
    windowSec: candidate.windowSec,
    priceField: candidate.priceField,
    kind: "observation",
    tradable: false,
    blockReason: candidate.blockReason,
    reason: candidate.blockReason,
  };
  run._observationLast.set(key, now);
  run.signals.push(observation);
  run.store.appendRecord(run.id, "signal", observation);
  run.sse.broadcast("signal", { signal: observation }, run.id);
  return observation;
}

export async function processMarkets(run, now) {
  for (const market of run.markets.values()) {
    if (!market || market.closed) continue;
    if (run.config.signal.entryMode === "price_band") {
      await processPriceBandMarket(run, market, now);
      continue;
    }
    // Release signal owns this event group until its node window ends; do not
    // let momentum/fallback buy back positions that were just rotated.
    if (run._metarReleaseLockedGroups?.has(fallbackEventKey(market))) continue;
    const yesBook = run.source?.getBook ? run.source.getBook(market.tokens.yesTokenId) : null;
    const hash = yesBook?.hash || "";
    const lastHash = run._lastBookHash.get(market.id);
    const latest = run.source?.getLatest ? run.source.getLatest(market.tokens.yesTokenId) : null;
    const sampleTs = Number(latest?.ts ?? market.updatedAt ?? 0) || 0;
    if (!run._lastSampleTs) run._lastSampleTs = new Map();
    const lastSampleTs = run._lastSampleTs.get(market.id) || 0;
    let signal = null;
    if (!lastHash || lastHash !== hash || (sampleTs > 0 && sampleTs !== lastSampleTs)) {
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
      if (sampleTs > 0) run._lastSampleTs.set(market.id, sampleTs);
      if (signal) {
        signal.id = newId("sig");
        signal.runId = run.id;
        run.signals.push(signal);
        run.store.appendRecord(run.id, "signal", signal);
        run.sse.broadcast("signal", { signal }, run.id);
      } else if (result.candidate) {
        recordObservationSignal(run, market, result.candidate, now);
      }
    }

    await evaluateExits(run, market, now, signal);
    if (signal) await tryEntry(run, signal, market, now);
  }
  // 全局兜底：每个观察窗口周期检查一次，空仓则建两笔兜底仓（第 1 高 YES + 第 3 高 NO）
  if (run.config.signal.entryMode !== "price_band") {
    await maybePeriodicFallback(run, now);
  }
}

/** Price-band entry: buy the configured outcome when executable ask is in range. */
async function processPriceBandMarket(run, market, now) {
  const positions = run.portfolio.positionsForMarket(market.id);
  await evaluateExits(run, market, now, null);
  if (positions.length > 0) return;
  const direction = run.config.signal.direction === "down" ? "down" : "up";
  const outcome = direction === "up" ? "YES" : "NO";
  const quote = outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
  const ask = Number(quote?.ask);
  if (!(ask > 0)) return;
  const band = run.config.signal.entryPriceByOutcome?.[outcome] || {};
  const min = band.min !== null && band.min !== undefined && Number.isFinite(Number(band.min)) ? Number(band.min) : run.config.universe.minPrice;
  const max = band.max !== null && band.max !== undefined && Number.isFinite(Number(band.max)) ? Number(band.max) : run.config.universe.maxPrice;
  if (ask < min || ask > max) return;
  const cooldownMs = Math.max(1, Number(run.config.signal.cooldownSec) || 0) * 1000;
  const key = `${market.id}|${outcome}|price_band`;
  if (now - (run._priceBandLastSignal?.get(key) || 0) < cooldownMs) return;
  if (!run._priceBandLastSignal) run._priceBandLastSignal = new Map();
  run._priceBandLastSignal.set(key, now);
  const tokenId = outcome === "YES" ? market.tokens.yesTokenId : market.tokens.noTokenId;
  const signal = {
    id: newId("sig"),
    ts: now,
    runId: run.id,
    marketId: market.id,
    city: market.city,
    bracket: market.bracket,
    direction,
    outcome,
    tokenId,
    fromPrice: ask,
    toPrice: ask,
    changePct: 0,
    absChange: 0,
    windowSec: 0,
    priceField: "ask",
    kind: "entry",
    tradable: true,
    reason: "price_band",
  };
  run.signals.push(signal);
  run.store.appendRecord(run.id, "signal", signal);
  run.sse.broadcast("signal", { signal }, run.id);
  await tryEntry(run, signal, market, now, { reason: "price_band" });
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
    const targetPrice = Number(run.config.exit.targetPriceByOutcome?.[position.outcome]);

    let reason = null;
    if (Number.isFinite(targetPrice) && targetPrice > 0 && bid >= targetPrice) reason = "take_profit";
    else if (retLiqPct <= -run.config.exit.stopLossPct) reason = "stop_loss";
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

/** Human-readable rejection detail for the trade table. */
function rejectDetailCents(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}¢` : "—";
}

function rejectDetailMoney(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "—";
}

function rejectDetailDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 3600) return `${(value / 3600).toFixed(1)}h`;
  if (Math.abs(value) >= 60) return `${(value / 60).toFixed(1)}m`;
  return `${value.toFixed(1)}s`;
}

/** Fixed risk pre-check order (docs/03 §6). */
export function preRiskChecks(run, market, signal, now, opts = {}) {
  const fail = (reason, detail) => ({ ok: false, reason, detail });
  const side = signal.outcome === "YES" ? "YES" : "NO";
  const targetQuote = market.quotes?.[side];
  if (run.killSwitchTripped || run.status !== "running") {
    return fail("risk_blocked", "运行已停止或风控熔断，禁止新开仓");
  }
  const equity = run.portfolio.equity();
  if (run.config.risk.killSwitch && equity < run.peakEquity) {
    const drawdownPct = ((run.peakEquity - equity) / run.peakEquity) * 100;
    if (drawdownPct >= run.config.risk.maxDrawdownPct) {
      return fail(
        "risk_blocked",
        `当前回撤 ${drawdownPct.toFixed(2)}% ≥ 上限 ${Number(run.config.risk.maxDrawdownPct).toFixed(2)}%`,
      );
    }
  }
  if (run.config.risk.dailyLossLimitUsd > 0 && equity - run.dayStartEquity <= -run.config.risk.dailyLossLimitUsd) {
    return fail(
      "risk_blocked",
      `当日亏损 ${rejectDetailMoney(run.dayStartEquity - equity)} ≥ 日亏上限 ${rejectDetailMoney(run.config.risk.dailyLossLimitUsd)}`,
    );
  }
  if (!market.acceptingOrders) {
    return fail("market_not_accepting_orders", "市场不可接单（acceptingOrders=false）");
  }
  if (market.stale) return fail("stale_market", "行情已过期（stale=true）");
  // 下单时流动性按“目标方向可成交深度”判断：
  // BUY 只统计保护价以内的 asks；SELL 只统计 bids；top10 档。
  // 没有盘口快照时回退 Gamma liquidity 字段，兼容旧记录/测试。
  const targetAsk = Number(targetQuote?.ask);
  let executableDepth = null;
  if (targetAsk > 0) {
    const bps = Number(run.config.execution?.slippageBufferBps) || 0;
    const buyLimit = Math.min(0.999, targetAsk * (1 + bps / 10000));
    if (opts.book) {
      executableDepth = sideDepthUsd(opts.book, "BUY", { limitPrice: buyLimit, levels: 10 });
    } else if (Number(market.executableDepthUsd?.[side]?.ask) > 0) {
      executableDepth = Number(market.executableDepthUsd[side].ask);
    }
  }
  if (Number.isFinite(executableDepth)) {
    if (executableDepth < run.config.universe.minLiquidityUsd) {
      return fail(
        "liquidity_too_low",
        `可成交 ${side} ask 深度 ${rejectDetailMoney(executableDepth)} < 下限 ${rejectDetailMoney(run.config.universe.minLiquidityUsd)}`,
      );
    }
  } else if (Number.isFinite(market.liquidityUsd) && market.liquidityUsd < run.config.universe.minLiquidityUsd) {
    return fail(
      "liquidity_too_low",
      `流动性 ${rejectDetailMoney(market.liquidityUsd)} < 下限 ${rejectDetailMoney(run.config.universe.minLiquidityUsd)}`,
    );
  }
  if (Number.isFinite(market.spread) && market.spread > run.config.universe.maxSpread) {
    return fail(
      "spread_too_wide",
      `点差 ${rejectDetailCents(market.spread)} > 上限 ${rejectDetailCents(run.config.universe.maxSpread)}`,
    );
  }
  const ttrSec = (effectiveTradingEndMs(market) - now) / 1000;
  if (!Number.isFinite(ttrSec)) return fail("risk_blocked", "无法计算距交易截止时间");
  if (ttrSec < run.config.universe.minTimeToResolutionSec || ttrSec > run.config.universe.maxTimeToResolutionSec) {
    return fail(
      "risk_blocked",
      `距截止 ${rejectDetailDuration(ttrSec)}，超出允许范围 ${rejectDetailDuration(run.config.universe.minTimeToResolutionSec)}–${rejectDetailDuration(run.config.universe.maxTimeToResolutionSec)}`,
    );
  }
  const yesMid = market.impliedProbability;
  if (
    !Number.isFinite(yesMid) ||
    yesMid < run.config.universe.minPrice ||
    yesMid > run.config.universe.maxPrice
  ) {
    return fail(
      "risk_blocked",
      `YES 中间价 ${rejectDetailCents(yesMid)} 超出价格带 ${rejectDetailCents(run.config.universe.minPrice)}–${rejectDetailCents(run.config.universe.maxPrice)}`,
    );
  }
  const quote = signal.outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
  const bestAsk = quote?.ask ?? 0;
  if (!(bestAsk > 0)) return fail("no_liquidity", `${signal.outcome || "目标"} 盘口没有有效卖价`);
  const outcomeBand = run.config.signal?.entryPriceByOutcome?.[signal.outcome] || {};
  const entryMin = outcomeBand.min !== null && outcomeBand.min !== undefined && Number.isFinite(Number(outcomeBand.min))
    ? Number(outcomeBand.min)
    : run.config.universe.minPrice;
  const entryMax = outcomeBand.max !== null && outcomeBand.max !== undefined && Number.isFinite(Number(outcomeBand.max))
    ? Number(outcomeBand.max)
    : run.config.universe.maxPrice;
  if (bestAsk < entryMin || bestAsk > entryMax) {
    return fail(
      "risk_blocked",
      `目标 ${signal.outcome} 卖价 ${rejectDetailCents(bestAsk)} 超出 ${signal.outcome} 入场价格带 ${rejectDetailCents(entryMin)}–${rejectDetailCents(entryMax)}`,
    );
  }
  if (run.portfolio.positions.size >= run.config.execution.maxPositions) {
    return fail(
      "max_positions",
      `持仓数 ${run.portfolio.positions.size} ≥ 上限 ${run.config.execution.maxPositions}`,
    );
  }
  if (run.portfolio.positionsForMarket(market.id).length >= run.config.execution.maxPositionsPerMarket) {
    return fail(
      "max_positions_per_market",
      `该市场持仓 ${run.portfolio.positionsForMarket(market.id).length} ≥ 上限 ${run.config.execution.maxPositionsPerMarket}`,
    );
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
  const reject = (rejectReason, detail = null) => {
    recordRejectedEntry(run, signal, market, rejectReason, now, { reason, detail });
    return { ok: false, reason: rejectReason, detail };
  };
  if (run.portfolio.positionsForMarket(market.id).length > 0) {
    // no pyramiding by default; do not spam rejected trades for this silent guard
    return { ok: false, reason: "max_positions_per_market", silent: true };
  }
  const risk = preRiskChecks(run, market, signal, now, {
    book: run.source?.getBook ? run.source.getBook(signal.tokenId) : null,
  });
  if (!risk.ok) return reject(risk.reason, risk.detail);
  const budgetUsd = computeBudget(run, market);
  if (!(budgetUsd > 0)) {
    return reject(
      "insufficient_cash",
      `可用下单预算 ${rejectDetailMoney(budgetUsd)} ≤ 0（现金/仓位上限不足）`,
    );
  }
  const book = run.source?.getBook ? run.source.getBook(signal.tokenId) : null;
  if (!book) return reject("no_liquidity", `${signal.outcome || "目标"} token 没有盘口数据`);
  const fill = simulateBuy({
    book,
    budgetUsd,
    cashUsd: run.portfolio.cash,
    feeRate: feeRate(run, market),
    slippageBufferBps: run.config.execution.slippageBufferBps,
    tickSize: market.tickSize,
  });
  if (!fill.ok) return reject(fill.rejectReason, `盘口撮合失败（${fill.rejectReason}）`);
  if (fill.notional + fill.fee > run.portfolio.cash + 1e-9) {
    return reject(
      "insufficient_cash",
      `现金不足：需要 ${rejectDetailMoney(fill.notional + fill.fee)}，可用 ${rejectDetailMoney(run.portfolio.cash)}`,
    );
  }
  const quote = signal.outcome === "YES" ? market.quotes?.YES : market.quotes?.NO;
  const reference = quote?.ask ?? fill.price;
  const portfolioPosition = run.portfolio.buy({
    tokenId: signal.tokenId,
    marketId: market.id,
    outcome: signal.outcome,
    city: market.city,
    bracket: market.bracket,
    endDate: market.endDate,
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
    if (!yes) continue;
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

function marketHasOpenPosition(run, marketId) {
  for (const position of run.portfolio.positions.values()) {
    if (position.marketId === marketId) return true;
  }
  return false;
}

function fallbackPendingKey(eventKey, marketId, outcome) {
  return `${eventKey}|${marketId}|${outcome}`;
}

/** True when this event group is inside a known METAR release guard window. */
export function fallbackBlockedByMetarRelease(run, market, now) {
  if (run?.config?.signal?.metarReleaseEnabled !== true) return false;
  if (!run?.config?.execution?.fallbackAllowInMetarWindow) {
    // Imported lazily to keep the data-store module out of engine unit fixtures.
    return isFallbackBlockedAtMetarRelease(market?.city, now, 300);
  }
  return false;
}

/**
 * 城市/日期事件内的兜底 legs。
 * - 初始/事件无持仓：按当前概率排名生成 rank-1 YES + rank-3 NO。
 * - 同组已有持仓：不再新增普通 legs，但此前失败的 leg 必须每窗口重试；
 *   这样 36°C NO 成交后，34°C YES 的失败 leg 仍会继续尝试。
 */
export function planFallbackOrders(run, now = Date.now()) {
  if (!run._fallbackPending) run._fallbackPending = new Map();
  const legs = [];
  const planned = new Set();
  const pushLeg = (leg) => {
    const key = fallbackPendingKey(leg.eventKey, leg.market.id, leg.outcome);
    if (planned.has(key)) return;
    planned.add(key);
    legs.push(leg);
  };
  for (const group of groupFallbackCandidates(run)) {
    // METAR 发布节点前后 5 分钟内默认暂停兜底（pending 保留，窗口后再重试）。
    if (fallbackBlockedByMetarRelease(run, group.candidates[0]?.market, now)) continue;
    const rank1 = group.candidates[0];
    const rank2 = group.candidates[1];
    const rank3 = group.candidates[2];
    const rawGapPct = Number(run.config.execution?.fallbackMinTopGapPct);
    const minGapPct = Math.max(0, Math.min(100, Number.isFinite(rawGapPct) ? rawGapPct : 40));
    const topGapPct = rank1 ? (rank1.prob - (rank2?.prob ?? 0)) * 100 : 0;
    const yesGapOk = Boolean(rank1) && topGapPct >= minGapPct - 1e-9;

    // 每窗口重新排名：pending 只有在原目标仍是当前 rank-1 YES / rank-3 NO
    // 时才继续重试；排名变化后丢弃旧目标，避免买了已经过时的括号。
    for (const pending of [...run._fallbackPending.values()]) {
      if (pending.eventKey !== group.key) continue;
      const market = run.markets?.get?.(pending.marketId);
      const stillCurrentLeg =
        (pending.outcome === "YES" && rank1?.market.id === pending.marketId && yesGapOk) ||
        (pending.outcome === "NO" && rank3?.market.id === pending.marketId);
      if (!market || market.closed || market.acceptingOrders === false || marketHasOpenPosition(run, pending.marketId) || !stillCurrentLeg) {
        run._fallbackPending.delete(fallbackPendingKey(pending.eventKey, pending.marketId, pending.outcome));
      }
    }

    // 名义第 1 高没有 YES 卖盘时，整组跳过，不降级买下一档。
    if (!rank1 || !(Number(rank1.market.quotes?.YES?.ask) > 0)) continue;

    const hasPosition = eventHasOpenPosition(run, group.marketIds);
    if (hasPosition) {
      // 同组已有持仓：不新增普通 legs，只重试仍然对应当前排名目标的失败 leg。
      for (const pending of run._fallbackPending.values()) {
        if (pending.eventKey !== group.key) continue;
        const market = run.markets?.get?.(pending.marketId);
        if (!market || market.closed || market.acceptingOrders === false || marketHasOpenPosition(run, pending.marketId)) continue;
        pushLeg({ market, outcome: pending.outcome, rank: pending.rank, eventKey: group.key, retry: true });
      }
      continue;
    }

    // 只对 YES leg 增加“第一高 - 第二高 ≥ 40 个百分点”的门槛；NO leg 不受影响。
    if (yesGapOk && !marketHasOpenPosition(run, rank1.market.id)) {
      pushLeg({ market: rank1.market, outcome: "YES", rank: 1, eventKey: group.key });
    }
    // 第 3 高只有存在 NO 卖盘时才生成 NO leg。
    if (
      rank3 &&
      !marketHasOpenPosition(run, rank3.market.id) &&
      Number(rank3.market.quotes?.NO?.ask) > 0
    ) {
      pushLeg({ market: rank3.market, outcome: "NO", rank: 3, eventKey: group.key });
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

  const legs = planFallbackOrders(run, now);
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
    const pendingKey = fallbackPendingKey(leg.eventKey, market.id, outcome);
    if (!run._fallbackPending) run._fallbackPending = new Map();
    // 每个 leg 先登记为 pending；成功/静默跳过时移除，失败则保留到下个窗口重试。
    if (result.ok || result.silent) run._fallbackPending.delete(pendingKey);
    else run._fallbackPending.set(pendingKey, { eventKey: leg.eventKey, marketId: market.id, outcome, rank });
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
    marketSnapshot, rejectDetail,
  } = fields;
  return {
    id: newId("trd"),
    ts,
    runId: run.id,
    marketId: market.id,
    city: market.city ?? null,
    bracket: market.bracket ?? null,
    endDate: market.endDate ?? null,
    question: market.question ?? null,
    eventSlug: market.eventSlug ?? null,
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
    marketSnapshot: marketSnapshot ?? null,
    rejectDetail: rejectDetail ?? null,
  };
}

/** Capture the quote at the exact rejection tick (not a later refreshed market). */
export function captureMarketSnapshot(market) {
  if (!market) return null;
  const quote = (side) => {
    const q = market.quotes?.[side];
    if (!q) return null;
    const clean = (value) => (Number.isFinite(Number(value)) ? roundTo(Number(value), 6) : null);
    return {
      bid: clean(q.bid),
      ask: clean(q.ask),
      mid: clean(q.mid),
      last: clean(q.last),
    };
  };
  return {
    impliedProbability: Number.isFinite(Number(market.impliedProbability))
      ? roundTo(Number(market.impliedProbability), 6)
      : null,
    spread: Number.isFinite(Number(market.spread)) ? roundTo(Number(market.spread), 6) : null,
    liquidityUsd: Number.isFinite(Number(market.liquidityUsd)) ? roundTo(Number(market.liquidityUsd), 5) : null,
    bookDepthUsd: Number.isFinite(Number(market.bookDepthUsd)) ? roundTo(Number(market.bookDepthUsd), 5) : null,
    executableDepthUsd: market.executableDepthUsd ?? null,
    tradingCutoff: market.tradingCutoff || null,
    stale: Boolean(market.stale),
    acceptingOrders: market.acceptingOrders !== false,
    closed: Boolean(market.closed),
    quotes: {
      YES: quote("YES"),
      NO: quote("NO"),
    },
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
    marketSnapshot: captureMarketSnapshot(market),
    rejectDetail: opts.detail || null,
    ts: now,
  });
  recordTrade(run, trade, null);
}
