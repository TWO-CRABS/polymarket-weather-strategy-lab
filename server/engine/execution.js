/**
 * server/engine/execution.js — FAK marketable-order simulation (docs/03 §3).
 *
 * BUY  walks asks from low to high, SELL walks bids from high to low.
 * The buy budget is fee-aware: each level consumes
 * `qty × price × (1 + rate × (1 − price))` from the budget so
 * `notional + fee <= budget` holds at all times.
 * Price protection: buyLimit = ceilToTick(min(0.999, bestAsk×(1+bps/1e4))),
 *                   sellLimit = floorToTick(max(0.001, bestBid×(1−bps/1e4))).
 * Orders below the market minimum (default 5 shares) are rejected whole.
 */
import { FEES, calcTakerFee, roundTo } from "../../shared/contract.js";
import { toNum } from "../util.js";

export function ceilToTick(price, tickSize) {
  const tick = tickSize > 0 ? tickSize : 0.001;
  return roundTo(Math.min(0.999, Math.ceil((price - 1e-12) / tick) * tick), 6);
}

export function floorToTick(price, tickSize) {
  const tick = tickSize > 0 ? tickSize : 0.001;
  return roundTo(Math.max(0.001, Math.floor((price + 1e-12) / tick) * tick), 6);
}

/** Floor to 0.01 shares (docs/03: shares rounded down to 0.01). */
export function floorShares(value) {
  return Math.floor((value + 1e-9) * 100) / 100;
}

/**
 * @typedef {Object} FillResult
 * @property {boolean} ok
 * @property {"filled"|"partial"|"rejected"} status
 * @property {string|null} rejectReason
 * @property {number} shares filled shares (2dp)
 * @property {number} price VWAP (6dp)
 * @property {number} notional shares×price (5dp)
 * @property {number} fee official taker fee (5dp)
 * @property {number} totalCost BUY: notional+fee; SELL: notional−fee
 * @property {Array<{price:number,size:number}>} bookLevels
 * @property {number} limitPrice protective limit used
 */

function rejected(reason, extra = {}) {
  return {
    ok: false,
    status: "rejected",
    rejectReason: reason,
    shares: 0,
    price: 0,
    notional: 0,
    fee: 0,
    totalCost: 0,
    bookLevels: [],
    limitPrice: 0,
    ...extra,
  };
}

/**
 * Simulate a FAK BUY (marketable) against asks.
 * @param {{book:any, budgetUsd:number, feeRate?:number, slippageBufferBps?:number,
 *          tickSize?:number, minOrderShares?:number}} args
 * @returns {FillResult}
 */
export function simulateBuy(args) {
  const {
    book,
    budgetUsd,
    feeRate = FEES.takerFeeRate,
    slippageBufferBps = 0,
    tickSize = book?.tickSize || 0.001,
    minOrderShares = book?.minOrderSize || 5,
  } = args;
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) return rejected("insufficient_cash");
  const asks = Array.isArray(book?.asks) ? book.asks : [];
  if (asks.length === 0) return rejected("no_liquidity");

  const bestAsk = asks[0].price;
  if (!(bestAsk > 0 && bestAsk < 1)) return rejected("no_liquidity");
  const limitPrice = ceilToTick(Math.min(0.999, bestAsk * (1 + slippageBufferBps / 10000)), tickSize);

  let remaining = budgetUsd;
  let filled = 0;
  let notional = 0;
  const bookLevels = [];
  let stoppedByLimit = false;
  let processedAllLevels = true;

  for (const level of asks) {
    if (level.price > limitPrice + 1e-9) {
      stoppedByLimit = true;
      processedAllLevels = false;
      break;
    }
    const unitCost = level.price * (1 + feeRate * (1 - level.price));
    if (!(unitCost > 0)) {
      processedAllLevels = false;
      break;
    }
    const affordable = floorShares(remaining / unitCost);
    const qty = floorShares(Math.min(level.size, affordable));
    if (qty <= 0) {
      processedAllLevels = false; // budget cannot afford the cheapest level
      break;
    }
    filled = roundTo(filled + qty, 2);
    notional += qty * level.price;
    remaining -= qty * level.price;
    bookLevels.push({ price: level.price, size: qty });
  }
  // depth exhausted while budget remained => partial fill (docs/03 §3.3).
  // If the leftover budget cannot even buy the 0.01-share minimum lot, the
  // budget is effectively exhausted, so the order counts as filled.
  const minLotCost = 0.01 * asks[0].price * (1 + feeRate);
  const bookExhausted = processedAllLevels && !stoppedByLimit && remaining > minLotCost + 1e-9;

  if (filled <= 0) return rejected("no_liquidity", { limitPrice });

  let price = roundTo(notional / filled, 6);
  let fee = calcTakerFee(filled, price, feeRate);
  // trim 0.01-share lots until notional+fee fits the budget
  let guard = 0;
  while (notional + fee > budgetUsd + 1e-9 && filled - 0.01 >= minOrderShares && guard < 100000) {
    guard += 1;
    filled = roundTo(filled - 0.01, 2);
    notional = roundTo(filled * price, 5);
    fee = calcTakerFee(filled, price, feeRate);
    // keep bookLevels consistent with the trimmed amount (approximate last level)
    let excess = 0.01;
    for (let i = bookLevels.length - 1; i >= 0 && excess > 1e-9; i -= 1) {
      const cut = Math.min(bookLevels[i].size, excess);
      bookLevels[i].size = roundTo(bookLevels[i].size - cut, 2);
      excess -= cut;
      if (bookLevels[i].size <= 0) bookLevels.splice(i, 1);
    }
  }
  if (notional + fee > budgetUsd + 1e-9) return rejected("insufficient_cash", { limitPrice });
  if (filled < minOrderShares - 1e-9) return rejected("below_min_order", { limitPrice });

  price = roundTo(notional / filled, 6);
  fee = calcTakerFee(filled, price, feeRate);
  const notionalFinal = roundTo(filled * price, 5);
  const status = stoppedByLimit || bookExhausted ? "partial" : "filled";
  return {
    ok: true,
    status,
    rejectReason: null,
    shares: filled,
    price,
    notional: notionalFinal,
    fee,
    totalCost: roundTo(notionalFinal + fee, 5),
    bookLevels,
    limitPrice,
  };
}

/**
 * Simulate a FAK SELL (marketable) against bids.
 * @param {{book:any, shares:number, feeRate?:number, slippageBufferBps?:number,
 *          tickSize?:number, minOrderShares?:number}} args
 * @returns {FillResult}
 */
export function simulateSell(args) {
  const {
    book,
    shares,
    feeRate = FEES.takerFeeRate,
    slippageBufferBps = 0,
    tickSize = book?.tickSize || 0.001,
    minOrderShares = book?.minOrderSize || 5,
  } = args;
  if (!Number.isFinite(shares) || shares <= 0) return rejected("below_min_order");
  const bids = Array.isArray(book?.bids) ? book.bids : [];
  if (bids.length === 0) return rejected("no_liquidity");

  const bestBid = bids[0].price;
  if (!(bestBid > 0 && bestBid < 1)) return rejected("no_liquidity");
  const limitPrice = floorToTick(Math.max(0.001, bestBid * (1 - slippageBufferBps / 10000)), tickSize);

  let remaining = roundTo(shares, 2);
  let filled = 0;
  let notional = 0;
  const bookLevels = [];
  let stoppedByLimit = false;

  for (const level of bids) {
    if (level.price < limitPrice - 1e-9) {
      stoppedByLimit = true;
      break;
    }
    const qty = floorShares(Math.min(level.size, remaining));
    if (qty <= 0) break;
    filled = roundTo(filled + qty, 2);
    notional += qty * level.price;
    remaining = roundTo(remaining - qty, 2);
    bookLevels.push({ price: level.price, size: qty });
    if (remaining <= 0) break;
  }

  if (filled <= 0) return rejected("no_liquidity", { limitPrice });
  if (filled < minOrderShares - 1e-9) return rejected("below_min_order", { limitPrice });

  const price = roundTo(notional / filled, 6);
  const fee = calcTakerFee(filled, price, feeRate);
  const notionalFinal = roundTo(filled * price, 5);
  const status = filled >= roundTo(shares, 2) - 1e-9 ? "filled" : "partial";
  return {
    ok: true,
    status,
    rejectReason: null,
    shares: filled,
    price,
    notional: notionalFinal,
    fee,
    totalCost: roundTo(notionalFinal - fee, 5),
    bookLevels,
    limitPrice,
    stoppedByLimit,
  };
}

/** Reference mid for a book (for spread-cost attribution, docs/04 §5.6). */
export function bookMid(book) {
  if (!book) return null;
  const bid = toNum(book.bestBid, 0);
  const ask = toNum(book.bestAsk, 0);
  if (bid > 0 && ask > 0 && bid < ask) return (bid + ask) / 2;
  if (book.mid !== null && book.mid !== undefined) return book.mid;
  return null;
}
