/**
 * server/engine/fee.js — official Weather taker fee helpers.
 *
 * The single source of truth is `shared/contract.js`:
 *   fee = round5(shares × takerFeeRate × p × (1 − p))
 * Nothing here re-implements the formula; everything delegates.
 */
import { calcTakerFee, FEES, roundTo } from "../../shared/contract.js";

export { calcTakerFee, FEES, roundTo };

/** Fee rate for a market (market feeSchedule when present, else official FEES). */
export function feeRateFor(market) {
  const rate = market?.feeSchedule?.rate;
  return Number.isFinite(rate) && rate >= 0 ? rate : FEES.takerFeeRate;
}

/** @returns {{notional:number, fee:number, total:number}} buy cash outflow parts */
export function buyCost(shares, price, rate = FEES.takerFeeRate) {
  const notional = roundTo(shares * price, 5);
  const fee = calcTakerFee(shares, price, rate);
  return { notional, fee, total: roundTo(notional + fee, 5) };
}

/** @returns {{notional:number, fee:number, net:number}} sell cash inflow parts */
export function sellProceeds(shares, price, rate = FEES.takerFeeRate) {
  const notional = roundTo(shares * price, 5);
  const fee = calcTakerFee(shares, price, rate);
  return { notional, fee, net: roundTo(notional - fee, 5) };
}

/** Estimate fee shown in Position.estExitFee (display only, never charged). */
export function estimateExitFee(shares, price, rate = FEES.takerFeeRate) {
  return calcTakerFee(shares, price, rate);
}
