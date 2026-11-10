/**
 * server/engine/settlementRecovery.js
 *
 * 结算恢复（post-stop / post-restart settlement）：
 *  - 从运行日志（journal trades）重建持仓与现金；
 *  - 为“已停止/已结束但仍有未结算持仓”的 live 运行提供轻量 settler，
 *    继续轮询官方裁决并补记 `reason=resolution` 的兑付 Trade。
 *
 * 边界（docs/03 §4.3）：
 *  - 只有 live 运行会被恢复结算；replay 运行结束时按最后 mid 估值；
 *  - 官方裁决必须 `closed=true` 且 outcomePrices 明确，否则继续 pending；
 *  - 兑付不收费，`realizedPnl = payout − costBasis`。
 */
import { Portfolio } from "./portfolio.js";
import { handleSettlements } from "./runTrading.js";

/**
 * 用 journal 中的成交记录重建组合（含部分成交、卖出、已结算）。
 * 顺序按 ts 升序；同 ts 保持 journal 原顺序（稳定排序）。
 * @param {number} initialCapital
 * @param {any[]} tradeRecords journal trade data items
 * @returns {Portfolio}
 */
export function rehydratePortfolio(initialCapital, tradeRecords = []) {
  const portfolio = new Portfolio({ initialCapital });
  const ordered = tradeRecords
    .map((trade, index) => ({ trade, index }))
    .filter(({ trade }) => trade && trade.status !== "rejected")
    .sort((a, b) => (a.trade.ts ?? 0) - (b.trade.ts ?? 0) || a.index - b.index)
    .map(({ trade }) => trade);

  for (const trade of ordered) {
    if (trade.reason === "resolution") {
      portfolio.settleMarket(trade.marketId, trade.price, trade.ts ?? Date.now());
      continue;
    }
    if (trade.side === "BUY") {
      portfolio.buy({
        tokenId: trade.tokenId,
        marketId: trade.marketId,
        outcome: trade.outcome,
        city: trade.city,
        bracket: trade.bracket,
        endDate: trade.endDate ?? null,
        shares: trade.shares,
        price: trade.price,
        fee: trade.fee,
        ts: trade.ts ?? Date.now(),
        midPrice: trade.midPrice ?? trade.price,
        impliedProbability: trade.impliedProbability ?? null,
      });
    } else if (trade.side === "SELL") {
      portfolio.sell({
        tokenId: trade.tokenId,
        shares: trade.shares,
        price: trade.price,
        fee: trade.fee,
        ts: trade.ts ?? Date.now(),
      });
    }
  }
  return portfolio;
}

/**
 * 从 journal trades 还原市场占位对象（结算 Trade / 兑付只需要 id/city/bracket）。
 * 已过期的市场不会重新出现在 discovery 里，因此这里不依赖行情源。
 * @param {any[]} tradeRecords
 * @returns {Map<string, any>}
 */
export function marketsFromTrades(tradeRecords = []) {
  /** @type {Map<string, any>} */
  const markets = new Map();
  for (const trade of tradeRecords) {
    if (!trade?.marketId || markets.has(trade.marketId)) continue;
    markets.set(trade.marketId, {
      id: trade.marketId,
      city: trade.city ?? "",
      bracket: trade.bracket ?? "",
      endDate: trade.endDate ?? null,
      question: trade.question ?? "",
      eventSlug: trade.eventSlug ?? "",
      tokens: { yesTokenId: null, noTokenId: null },
      quotes: {},
      closed: true, // 已停止/过期的运行：直接进入“待裁决”轮询
      acceptingOrders: false,
      endDate: null,
      impliedProbability: null,
    });
  }
  return markets;
}

/**
 * 构造一个仅供 `handleSettlements()` 使用的最小 run 形状。
 * 它不会交易、不会 tick 行情，只负责官方裁决 → 兑付记账。
 */
export function createSettler({
  id,
  status = "stopped",
  markets,
  portfolio,
  store,
  sse,
  log,
  resolutionProvider,
  settledMarketIds = [],
}) {
  return {
    id,
    mode: "live",
    status,
    markets,
    marketIds: [...markets.keys()],
    portfolio,
    source: { mode: "live" },
    resolutionProvider,
    _settledMarkets: new Set(settledMarketIds),
    _resolutionChecks: new Map(),
    trades: [],
    filledTradeCount: 0,
    _spreadCost: 0,
    _depthSlippageCost: 0,
    store,
    sse,
    log: typeof log === "function" ? log : () => {},
  };
}

/** 轮询一次官方裁决；返回剩余未结算持仓数。 */
export async function settlePendingPositions(settler, now = Date.now()) {
  await handleSettlements(settler, now);
  return settler.portfolio.positions.size;
}
