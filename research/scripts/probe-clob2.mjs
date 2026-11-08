// Probe CLOB price endpoints against a two-sided book to pin down side semantics.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const CLOB = "https://clob.polymarket.com";

const ev = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const m = ev.markets.find((x) => x.groupItemTitle === "62-63°F");
const tokens = JSON.parse(m.clobTokenIds);
console.log("token YES:", tokens[0], "\nGamma bestBid/bestAsk:", m.bestBid, m.bestAsk, "tick:", m.orderPriceMinTickSize);

const j = async (url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, text, headers: r.headers };
};
const save = (name, text) => fs.writeFile(path.join(SAMPLES, `${name}.json`), text);

const book = await j(`${CLOB}/book?token_id=${tokens[0]}`);
await save("clob-book-twosided", book.text);
const bids = book.body.bids, asks = book.body.asks;
const bestBid = bids.length ? Math.max(...bids.map((x) => +x.price)) : null;
const bestAsk = asks.length ? Math.min(...asks.map((x) => +x.price)) : null;
console.log(`\nbook: bids=${bids.length} asks=${asks.length} firstBid=${bids[0]?.price} lastBid=${bids.at(-1)?.price} firstAsk=${asks[0]?.price} lastAsk=${asks.at(-1)?.price}`);
console.log(`computed bestBid=${bestBid} bestAsk=${bestAsk}`);
console.log("key order:", Object.keys(book.body).join(","));

const pb = await j(`${CLOB}/price?token_id=${tokens[0]}&side=BUY`);
const ps = await j(`${CLOB}/price?token_id=${tokens[0]}&side=SELL`);
console.log(`/price side=BUY -> ${pb.text}   side=SELL -> ${ps.text}`);
await save("clob-price-buy-twosided", pb.text);
await save("clob-price-sell-twosided", ps.text);

const batch = await j(`${CLOB}/prices`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: tokens[0], side: "BUY" }, { token_id: tokens[0], side: "SELL" }]),
});
console.log(`/prices -> ${batch.status} ${batch.text}`);
await save("clob-prices-twosided", batch.text);

const mid = await j(`${CLOB}/midpoint?token_id=${tokens[0]}`);
const spr = await j(`${CLOB}/spread?token_id=${tokens[0]}`);
const ltp = await j(`${CLOB}/last-trade-price?token_id=${tokens[0]}`);
const tick = await j(`${CLOB}/tick-size?token_id=${tokens[0]}`);
console.log(`/midpoint -> ${mid.text}\n/spread -> ${spr.text}\n/last-trade-price -> ${ltp.text}\n/tick-size -> ${tick.text}`);
await save("clob-midpoint-twosided", mid.text);
await save("clob-spread-twosided", spr.text);
await save("clob-last-trade-price-twosided", ltp.text);
await save("clob-tick-size-twosided", tick.text);

// no-side / invalid params
const noSide = await j(`${CLOB}/price?token_id=${tokens[0]}`);
console.log(`/price no side -> ${noSide.status} ${noSide.text.slice(0, 300)}`);
const badSide = await j(`${CLOB}/price?token_id=${tokens[0]}&side=HOLD`);
console.log(`/price side=HOLD -> ${badSide.status} ${badSide.text.slice(0, 300)}`);
const badToken = await j(`${CLOB}/book?token_id=1`);
console.log(`/book token_id=1 -> ${badToken.status} ${badToken.text.slice(0, 300)}`);
const noToken = await j(`${CLOB}/book`);
console.log(`/book no token -> ${noToken.status} ${noToken.text.slice(0, 300)}`);

// empty book on a polyv2 token
const v2 = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-polyv2-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8")).markets[0];
const v2tokens = JSON.parse(v2.clobTokenIds);
const v2book = await j(`${CLOB}/book?token_id=${v2tokens[0]}`);
console.log(`\nv2 empty book -> ${v2book.status} ${v2book.text}`);
await save("clob-book-empty", v2book.text);
const v2price = await j(`${CLOB}/price?token_id=${v2tokens[0]}&side=BUY`);
const v2mid = await j(`${CLOB}/midpoint?token_id=${v2tokens[0]}`);
const v2ltp = await j(`${CLOB}/last-trade-price?token_id=${v2tokens[0]}`);
console.log(`v2 /price BUY -> ${v2price.status} ${v2price.text}\nv2 /midpoint -> ${v2mid.status} ${v2mid.text}\nv2 /last-trade-price -> ${v2ltp.status} ${v2ltp.text}`);

// CLOB trades endpoints (likely auth)
const tr = await j(`${CLOB}/trades?token_id=${tokens[0]}`);
console.log(`\nGET /trades?token_id -> ${tr.status} ${tr.text.slice(0, 300)}`);
const tr2 = await j(`${CLOB}/trades`);
console.log(`GET /trades -> ${tr2.status} ${tr2.text.slice(0, 200)}`);

// CLOB market data endpoints
for (const p of ["/markets", "/sampling-markets", "/neg-risk?token_id=" + tokens[0], "/rewards/markets/" + m.id]) {
  const r = await j(CLOB + p);
  console.log(`GET ${p} -> ${r.status} ${String(r.text).slice(0, 160)}`);
}
