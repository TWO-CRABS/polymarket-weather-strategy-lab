/**
 * server/engine/portfolio.js — cash / positions / P&L ledger (docs/04 §6.1).
 *
 * Invariants (asserted by tests/docs):
 *   equity = cash + positionsValue
 *   equity = initialCapital + realizedPnl + unrealizedPnl
 *   feesPaid = Σ trade.fee
 * costBasis includes entry fees (break-even probability), sells realise P&L
 * pro-rata, settlement pays 1/0 (or 0.5 for the rare 50/50) with no fee.
 */
import { calcTakerFee, roundTo } from "../../shared/contract.js";
import { money } from "../util.js";

export class Portfolio {
  /** @param {{initialCapital:number, feeRate?:number}} cfg */
  constructor(cfg) {
    this.initialCapital = cfg.initialCapital;
    this.cash = cfg.initialCapital;
    this.feeRate = cfg.feeRate ?? 0.05;
    /** @type {Map<string, any>} tokenId -> position */
    this.positions = new Map();
    this.realizedPnl = 0;
    this.feesPaid = 0;
    this.turnoverUsd = 0;
    /** @type {number[]} per-round realized P&L (closed positions incl. settlement) */
    this.closedRoundPnls = [];
  }

  /**
   * Apply a filled BUY.
   * @returns {any} position snapshot
   */
  buy({ tokenId, marketId, outcome, city, bracket, shares, price, fee, ts, midPrice, impliedProbability }) {
    const notional = roundTo(shares * price, 5);
    const cost = roundTo(notional + fee, 5);
    this.cash = roundTo(this.cash - cost, 6);
    this.feesPaid = roundTo(this.feesPaid + fee, 6);
    this.turnoverUsd = roundTo(this.turnoverUsd + notional, 6);

    const existing = this.positions.get(tokenId);
    if (existing) {
      existing.shares = roundTo(existing.shares + shares, 2);
      existing.costBasis = roundTo(existing.costBasis + cost, 6);
      existing.entryFee = roundTo(existing.entryFee + fee, 6);
      existing.midPrice = midPrice ?? existing.midPrice;
      existing.impliedProbability = impliedProbability ?? existing.impliedProbability;
      return this.positionSnapshot(existing);
    }
    const position = {
      marketId,
      tokenId,
      outcome,
      city,
      bracket,
      shares,
      costBasis: cost,
      entryFee: fee,
      entryTs: ts,
      midPrice: midPrice ?? price,
      impliedProbability: impliedProbability ?? midPrice ?? price,
      roundRealizedPnl: 0,
    };
    this.positions.set(tokenId, position);
    return this.positionSnapshot(position);
  }

  /**
   * Apply a filled SELL (pro-rata cost basis).
   * @returns {{soldShares:number, net:number, costBasisPortion:number, realizedPnl:number,
   *            closedRoundPnl:number|null, position:any|null}}
   */
  sell({ tokenId, shares, price, fee, ts }) {
    const position = this.positions.get(tokenId);
    if (!position) {
      return { soldShares: 0, net: 0, costBasisPortion: 0, realizedPnl: 0, closedRoundPnl: null, position: null };
    }
    const soldShares = roundTo(Math.min(shares, position.shares), 2);
    if (soldShares <= 0) {
      return { soldShares: 0, net: 0, costBasisPortion: 0, realizedPnl: 0, closedRoundPnl: null, position: null };
    }
    const notional = roundTo(soldShares * price, 5);
    const net = roundTo(notional - fee, 5);
    const costBasisPortion = roundTo(position.costBasis * (soldShares / position.shares), 6);
    const realizedPnl = roundTo(net - costBasisPortion, 6);

    this.cash = roundTo(this.cash + net, 6);
    this.feesPaid = roundTo(this.feesPaid + fee, 6);
    this.turnoverUsd = roundTo(this.turnoverUsd + notional, 6);
    this.realizedPnl = roundTo(this.realizedPnl + realizedPnl, 6);

    position.shares = roundTo(position.shares - soldShares, 2);
    position.costBasis = roundTo(position.costBasis - costBasisPortion, 6);
    position.roundRealizedPnl = roundTo(position.roundRealizedPnl + realizedPnl, 6);
    void ts;

    let closedRoundPnl = null;
    if (position.shares <= 1e-9) {
      closedRoundPnl = position.roundRealizedPnl;
      this.closedRoundPnls.push(closedRoundPnl);
      this.positions.delete(tokenId);
      return { soldShares, net, costBasisPortion, realizedPnl, closedRoundPnl, position: null };
    }
    return {
      soldShares,
      net,
      costBasisPortion,
      realizedPnl,
      closedRoundPnl,
      position: this.positionSnapshot(position),
    };
  }

  /**
   * Settle all positions of one market.
   * @param {string} marketId
   * @param {number|null} payoutPerShare 1 for winner, 0 for loser, 0.5 for 50/50
   * @param {number} ts epoch ms
   * @returns {Array<{position:any, payout:number, realizedPnl:number, closedRoundPnl:number}>}
   */
  settleMarket(marketId, payoutPerShare, ts) {
    if (payoutPerShare === null || payoutPerShare === undefined) return [];
    const results = [];
    for (const position of [...this.positions.values()]) {
      if (position.marketId !== marketId) continue;
      const payout = roundTo(position.shares * payoutPerShare, 5);
      const realizedPnl = roundTo(payout - position.costBasis, 6);
      this.cash = roundTo(this.cash + payout, 6);
      this.realizedPnl = roundTo(this.realizedPnl + realizedPnl, 6);
      position.roundRealizedPnl = roundTo(position.roundRealizedPnl + realizedPnl, 6);
      const closedRoundPnl = position.roundRealizedPnl;
      this.closedRoundPnls.push(closedRoundPnl);
      results.push({ position: this.positionSnapshot(position), payout, realizedPnl, closedRoundPnl, ts });
      this.positions.delete(position.tokenId);
    }
    return results;
  }

  /** Refresh marks from a tokenId -> mid map (missing/invalid marks keep previous). */
  markToMarket(midByToken) {
    for (const position of this.positions.values()) {
      const mid = midByToken.get(position.tokenId);
      if (Number.isFinite(mid) && mid > 0 && mid < 1) position.midPrice = mid;
    }
  }

  /** @returns {number} Σ shares × mid */
  positionsValue() {
    let value = 0;
    for (const position of this.positions.values()) value += position.shares * position.midPrice;
    return roundTo(value, 6);
  }

  unrealizedPnl() {
    let pnl = 0;
    for (const position of this.positions.values()) pnl += position.shares * position.midPrice - position.costBasis;
    return roundTo(pnl, 6);
  }

  equity() {
    return roundTo(this.cash + this.positionsValue(), 6);
  }

  exposureUsd() {
    return this.positionsValue();
  }

  positionsForMarket(marketId) {
    return [...this.positions.values()].filter((p) => p.marketId === marketId);
  }

  getPosition(tokenId) {
    const position = this.positions.get(tokenId);
    return position ? this.positionSnapshot(position) : null;
  }

  /** Contract Position shape (docs/07 §3.4), numbers rounded for display. */
  positionSnapshot(position) {
    const shares = position.shares;
    const costBasis = position.costBasis;
    const avgPrice = shares > 0 ? costBasis / shares : 0;
    const marketValue = shares * position.midPrice;
    return {
      marketId: position.marketId,
      tokenId: position.tokenId,
      outcome: position.outcome,
      city: position.city,
      bracket: position.bracket,
      shares: money(shares, 2),
      avgPrice: money(avgPrice, 6),
      costBasis: money(costBasis, 5),
      midPrice: money(position.midPrice, 6),
      marketValue: money(marketValue, 5),
      unrealizedPnl: money(marketValue - costBasis, 5),
      entryTs: position.entryTs,
      entryFee: money(position.entryFee, 5),
      estExitFee: calcTakerFee(shares, position.midPrice, this.feeRate),
      impliedProbability: money(position.impliedProbability ?? position.midPrice, 6),
    };
  }

  /** All positions as contract Position objects, newest first. */
  snapshots() {
    return [...this.positions.values()]
      .sort((a, b) => b.entryTs - a.entryTs)
      .map((p) => this.positionSnapshot(p));
  }
}

export default Portfolio;
