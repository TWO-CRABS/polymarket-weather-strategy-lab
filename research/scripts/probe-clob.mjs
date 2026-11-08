// Probe CLOB public read endpoints for a live weather event's tokens.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const CLOB = "https://clob.polymarket.com";

const event = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-slug.json"), "utf8"));
console.log("event:", event.id, event.slug, "markets:", event.markets.length);
const mk = event.markets.map((m) => ({
  id: m.id,
  q: m.question,
  groupItemTitle: m.groupItemTitle,
  cond: m.conditionId,
  tokens: JSON.parse(m.clobTokenIds),
  outcomes: m.outcomes,
  prices: m.outcomePrices,
  tick: m.orderPriceMinTickSize,
  negRisk: m.negRisk,
  accepting: m.acceptingOrders,
  bestBid: m.bestBid,
  bestAsk: m.bestAsk,
  spread: m.spread,
  lastTradePrice: m.lastTradePrice,
  volume: m.volume,
  liquidity: m.liquidity,
  feesEnabled: m.feesEnabled,
  feeType: m.feeType,
  feeSchedule: m.feeSchedule,
  endDate: m.endDate,
  eventStartTime: m.eventStartTime,
  resolutionSource: m.resolutionSource,
}));
console.log(JSON.stringify(mk, null, 1).slice(0, 3000));

const get = async (name, url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
  console.log(`\n=== ${name} [${r.status}] ${r.headers.get("content-type")} ${text.length}B`);
  console.log(text.length > 1200 ? text.slice(0, 1200) + "…" : text);
  return { status: r.status, text };
};

// pick the 13C bracket (mid-price) as the "active" token, and the top bracket as likely thin
const active = mk.find((m) => m.groupItemTitle === "13°C") ?? mk[Math.floor(mk.length / 2)];
const tail = mk[mk.length - 1];
console.log("\nACTIVE:", active.id, active.groupItemTitle, active.tokens);
console.log("TAIL:", tail.id, tail.groupItemTitle, tail.tokens);

await get("clob-book-active", `${CLOB}/book?token_id=${active.tokens[0]}`);
await get("clob-book-tail", `${CLOB}/book?token_id=${tail.tokens[0]}`);

const books = await get("clob-books", `${CLOB}/books`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: active.tokens[0] }, { token_id: active.tokens[1] }]),
});
await get("clob-price-buy", `${CLOB}/price?token_id=${active.tokens[0]}&side=BUY`);
await get("clob-price-sell", `${CLOB}/price?token_id=${active.tokens[0]}&side=SELL`);
await get("clob-prices", `${CLOB}/prices`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify([
    { token_id: active.tokens[0], side: "BUY" },
    { token_id: active.tokens[0], side: "SELL" },
    { token_id: active.tokens[1], side: "BUY" },
  ]),
});
await get("clob-midpoint", `${CLOB}/midpoint?token_id=${active.tokens[0]}`);
await get("clob-midpoints", `${CLOB}/midpoints`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: active.tokens[0] }, { token_id: active.tokens[1] }]),
});
await get("clob-spread", `${CLOB}/spread?token_id=${active.tokens[0]}`);
await get("clob-spreads", `${CLOB}/spreads`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: active.tokens[0] }, { token_id: active.tokens[1] }]),
});
await get("clob-last-trade-price", `${CLOB}/last-trade-price?token_id=${active.tokens[0]}`);
await get("clob-last-trade-price-tail", `${CLOB}/last-trade-price?token_id=${tail.tokens[0]}`);
await get("clob-last-trades-prices", `${CLOB}/last-trades-prices`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: active.tokens[0] }, { token_id: tail.tokens[0] }]),
});
await get("clob-tick-size", `${CLOB}/tick-size?token_id=${active.tokens[0]}`);
await get("clob-time", `${CLOB}/time`);
await get("clob-book-bogus", `${CLOB}/book?token_id=1`);
await get("clob-books-empty", `${CLOB}/books`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "[]",
});

// empty / one-sided book search across all brackets
for (const m of mk) {
  const r = await fetch(`${CLOB}/book?token_id=${m.tokens[0]}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => null);
  console.log(`book ${m.groupItemTitle}: [${r.status}] bids=${j?.bids?.length} asks=${j?.asks?.length} tick=${j?.tick_size} min=${j?.min_order_size} neg=${j?.neg_risk}`);
  if (j && (j.bids.length === 0 || j.asks.length === 0)) {
    await fs.writeFile(path.join(SAMPLES, `clob-book-onesided-${m.groupItemTitle.replace(/[^\w]+/g, "_")}.json`), JSON.stringify(j, null, 1));
  }
}
