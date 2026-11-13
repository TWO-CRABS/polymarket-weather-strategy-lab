/**
 * Per-user, per-market trade amount and settled P&L for one event.
 *
 * Uses Polymarket's public event + v2 trades APIs. This is intentionally
 * on-demand (the leaderboard has thousands of user/event pairs); results are
 * memory-cached for the lifetime of the process because historical trades are
 * immutable.
 */
const GAMMA = "https://gamma-api.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const eventTradesCache = new Map();
const eventCache = new Map();

async function fetchJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw new Error(last?.message || String(last));
}

async function eventBySlug(slug) {
  if (eventCache.has(slug)) return eventCache.get(slug);
  const event = await fetchJson(`${GAMMA}/events/slug/${encodeURIComponent(slug)}`);
  eventCache.set(slug, event);
  return event;
}

async function eventTrades(eventId) {
  if (eventTradesCache.has(eventId)) return eventTradesCache.get(eventId);
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ event_id: String(eventId), limit: "1000", taker_only: "false" });
    if (cursor) params.set("cursor", cursor);
    const json = await fetchJson(`${DATA}/v2/trades?${params.toString()}`);
    rows.push(...(Array.isArray(json?.data) ? json.data : []));
    const next = json?.pagination?.next_cursor;
    if (!json?.pagination?.has_more || !next) break;
    cursor = next;
  }
  eventTradesCache.set(eventId, rows);
  return rows;
}

function targetMarket(event, bracket) {
  const wanted = String(bracket || "").trim().toLowerCase();
  const markets = Array.isArray(event?.markets) ? event.markets : [];
  return markets.find((market) => {
    const label = String(market.groupItemTitle || market.question || "").trim().toLowerCase();
    return label === wanted || label.includes(wanted);
  }) || null;
}

function outcomeYes(market) {
  try {
    const prices = JSON.parse(market?.outcomePrices ?? "[]");
    if (prices.length >= 2) return Number(prices[0]) > Number(prices[1]);
  } catch {
    /* fall through */
  }
  return null;
}

function settlementTemp(event) {
  const markets = Array.isArray(event?.markets) ? event.markets : [];
  for (const market of markets) {
    let prices;
    try {
      prices = JSON.parse(market.outcomePrices ?? "[]");
    } catch {
      continue;
    }
    if (Number(prices[0]) <= 0.5) continue;
    const label = String(market.groupItemTitle || market.question || "").trim();
    const bracket = /(-?\d+(?:\.\d+)?)\s*°\s*[CF]/i.exec(label);
    if (bracket) return `${bracket[1]}°${bracket[0].includes("F") || bracket[0].includes("f") ? "F" : "C"}`;
    return label || null;
  }
  return null;
}

export async function getEventTradeMetrics({ slug, wallet, bracket } = {}) {
  const eventSlug = String(slug || "").trim();
  const user = String(wallet || "").trim().toLowerCase();
  if (!eventSlug || !user) throw new Error("slug and wallet are required");
  const event = await eventBySlug(eventSlug);
  const market = targetMarket(event, bracket);
  if (!market) return { tradeAmount: 0, profit: 0, tradeCount: 0, winning: null, reason: "market not found" };

  const trades = await eventTrades(event.id);
  const targetCondition = String(market.conditionId || "").toLowerCase();
  const targetTokens = new Set(
    (() => {
      try {
        return JSON.parse(market.clobTokenIds ?? "[]").map(String);
      } catch {
        return [];
      }
    })(),
  );
  const userTrades = trades.filter((trade) => {
    if (String(trade.proxy_wallet || "").toLowerCase() !== user) return false;
    if (targetCondition && String(trade.condition_id || "").toLowerCase() === targetCondition) return true;
    return targetTokens.has(String(trade.token_id || ""));
  });

  let shares = 0;
  let cash = 0;
  let tradeAmount = 0;
  for (const trade of userTrades) {
    const size = Number(trade.size) || 0;
    const price = Number(trade.price) || 0;
    if (!size || !price) continue;
    const side = String(trade.side || "").toUpperCase();
    const isYes = String(trade.outcome || "").toLowerCase().startsWith("y");
    tradeAmount += size * price;
    if (side === "BUY") {
      cash -= size * price;
      shares += isYes ? size : -size;
    } else if (side === "SELL") {
      cash += size * price;
      shares -= isYes ? size : -size;
    }
  }
  const winning = outcomeYes(market);
  const payout = winning === null ? null : winning ? 1 : 0;
  const profit = payout === null ? null : cash + shares * payout;
  return {
    tradeAmount: Number(tradeAmount.toFixed(2)),
    profit: profit === null ? null : Number(profit.toFixed(2)),
    tradeCount: userTrades.length,
    winning,
    shares: Number(shares.toFixed(4)),
    settlementTemp: settlementTemp(event),
  };
}
