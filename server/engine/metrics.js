/**
 * server/engine/metrics.js — Metrics aggregation (docs/04 §6.2).
 *
 * All outputs are JSON-safe: undefined quantities are `null`, never NaN/∞.
 * Definitions follow the contract exactly (field names in docs/07 §3.6):
 *   trades        filled/partial trade count excluding settlement payouts
 *   closedTrades  fully-closed position rounds (incl. settlement)
 *   winRate       winning rounds / closedTrades (0..1; UI formats as %)
 *   avgWin/avgLoss mean winning round P&L / mean |losing round P&L|
 *   profitFactor  Σwins / |Σlosses|, null when there are no losses
 *   expectancy    Σ realized round P&L / closedTrades
 *   sharpe        equity resampled every 5×tickIntervalMs, annualised, null < 30 samples
 *   maxDrawdownPct max((peak − equity)/peak)×100 over the equity curve
 *   feeDragPct    feesPaid / initialCapital × 100
 */
import { roundTo } from "../../shared/contract.js";
import { pct, money } from "../util.js";

/**
 * Resample an equity curve on a fixed time grid via linear interpolation.
 * @param {Array<{ts:number,equity:number}>} points sorted by ts
 * @param {number} stepMs
 * @returns {number[]} equity values on the grid (first point included)
 */
export function resampleEquity(points, stepMs) {
  if (!Array.isArray(points) || points.length === 0 || !(stepMs > 0)) return [];
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const start = sorted[0].ts;
  const end = sorted[sorted.length - 1].ts;
  if (end - start < stepMs) return [sorted[sorted.length - 1].equity];
  const out = [];
  let cursor = 0;
  for (let ts = start; ts <= end; ts += stepMs) {
    while (cursor + 1 < sorted.length && sorted[cursor + 1].ts <= ts) cursor += 1;
    const a = sorted[cursor];
    const b = sorted[Math.min(cursor + 1, sorted.length - 1)];
    let value;
    if (b.ts === a.ts) value = a.equity;
    else {
      const t = (ts - a.ts) / (b.ts - a.ts);
      value = a.equity + (b.equity - a.equity) * Math.min(1, Math.max(0, t));
    }
    out.push(value);
  }
  return out;
}

/** Sample sharpe ratio of an equity series (risk-free = 0, annualised).
 *  Requires >= 30 raw equity samples (docs/04 §6.2: fewer => null).
 *  @param {number[]} values resampled equity values on the step grid
 *  @param {number} stepMs
 *  @param {number} [rawSampleCount] number of underlying equity points
 */
export function sharpeFromEquity(values, stepMs, rawSampleCount = values.length) {
  if (!Array.isArray(values) || values.length < 30 || rawSampleCount < 30) return null;
  const returns = [];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1] <= 0) continue;
    returns.push(values[i] / values[i - 1] - 1);
  }
  if (returns.length < 29) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (!(std > 0)) return null;
  const periodsPerYear = (365 * 86400 * 1000) / stepMs;
  const annualised = (mean / std) * Math.sqrt(periodsPerYear);
  return Number.isFinite(annualised) ? roundTo(annualised, 4) : null;
}

export function maxDrawdownPct(equityPoints) {
  let peak = -Infinity;
  let maxDd = 0;
  for (const point of equityPoints) {
    if (!Number.isFinite(point.equity)) continue;
    peak = Math.max(peak, point.equity);
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - point.equity) / peak) * 100);
  }
  return roundTo(maxDd, 4);
}

/**
 * @param {{initialCapital:number, equityPoints:Array<{ts:number,equity:number}>,
 *   closedRoundPnls:number[], realizedPnl:number, unrealizedPnl:number,
 *   feesPaid:number, trades:number, turnoverUsd:number, exposureUsd:number,
 *   tickIntervalMs?:number}} input
 * @returns {object} Metrics
 */
export function computeMetrics(input) {
  const {
    initialCapital,
    equityPoints = [],
    closedRoundPnls = [],
    realizedPnl = 0,
    unrealizedPnl = 0,
    feesPaid = 0,
    trades = 0,
    turnoverUsd = 0,
    exposureUsd = 0,
    tickIntervalMs = 1000,
  } = input;

  const lastPoint = equityPoints.length ? equityPoints[equityPoints.length - 1] : null;
  const equity = lastPoint ? lastPoint.equity : initialCapital;
  const totalReturnPct = initialCapital > 0 ? ((equity - initialCapital) / initialCapital) * 100 : 0;

  const closedTrades = closedRoundPnls.length;
  const wins = closedRoundPnls.filter((pnl) => pnl > 0);
  const losses = closedRoundPnls.filter((pnl) => pnl < 0);
  const winRate = closedTrades > 0 ? wins.length / closedTrades : 0;
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : null;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : null;
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
  const expectancy = closedTrades > 0 ? closedRoundPnls.reduce((a, b) => a + b, 0) / closedTrades : null;

  const stepMs = Math.max(250, 5 * tickIntervalMs);
  const resampled = resampleEquity(equityPoints, stepMs);
  const sharpe = sharpeFromEquity(resampled, stepMs, equityPoints.length);

  return {
    totalReturnPct: pct(totalReturnPct),
    realizedPnl: money(realizedPnl),
    unrealizedPnl: money(unrealizedPnl),
    feesPaid: money(feesPaid),
    trades: Math.max(0, Math.trunc(trades)),
    closedTrades,
    winRate: pct(winRate),
    avgWin: avgWin === null ? null : money(avgWin),
    avgLoss: avgLoss === null ? null : money(avgLoss),
    profitFactor: profitFactor === null ? null : pct(profitFactor, 4),
    expectancy: expectancy === null ? null : money(expectancy),
    sharpe,
    maxDrawdownPct: maxDrawdownPct(equityPoints),
    exposureUsd: money(exposureUsd),
    turnoverUsd: money(turnoverUsd),
    feeDragPct: initialCapital > 0 ? pct((feesPaid / initialCapital) * 100) : 0,
  };
}

export default computeMetrics;
