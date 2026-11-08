// CLOB edge cases: one-sided book, empty book, batch errors, field formats.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const CLOB = "https://clob.polymarket.com";
const qd = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-slug.json"), "utf8"));
const thin = JSON.parse(qd.markets.find((m) => m.groupItemTitle === "13°C").clobTokenIds);
const v2 = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-polyv2-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const emptyTok = JSON.parse(v2.markets[0].clobTokenIds);

const j = async (url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  return { status: r.status, text, headers: r.headers };
};
const show = async (label, url, init) => {
  const r = await j(url, init);
  console.log(`\n=== ${label} [${r.status}] ${r.text.slice(0, 700)}`);
  return r;
};

await show("midpoint one-sided (no bids)", `${CLOB}/midpoint?token_id=${thin[0]}`);
await show("spread one-sided", `${CLOB}/spread?token_id=${thin[0]}`);
await show("price SELL one-sided", `${CLOB}/price?token_id=${thin[0]}&side=SELL`);
await show("price BUY one-sided", `${CLOB}/price?token_id=${thin[0]}&side=BUY`);
await show("price SELL empty", `${CLOB}/price?token_id=${emptyTok[0]}&side=SELL`);
await show("midpoint empty", `${CLOB}/midpoint?token_id=${emptyTok[0]}`);
await show("spread empty", `${CLOB}/spread?token_id=${emptyTok[0]}`);
await show("last-trade-price empty", `${CLOB}/last-trade-price?token_id=${emptyTok[0]}`);

// batch with one bogus token
await show("books batch valid+bogus", `${CLOB}/books`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: thin[0] }, { token_id: "1" }]),
});
await show("books batch bogus only", `${CLOB}/books`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: "1" }]),
});
await show("books batch missing token_id", `${CLOB}/books`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: thin[0] }, {}]),
});
await show("books GET", `${CLOB}/books`);

await show("midpoints batch", `${CLOB}/midpoints`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: thin[0] }, { token_id: thin[1] }]),
});
await show("spreads batch one-sided", `${CLOB}/spreads`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: thin[0] }, { token_id: emptyTok[0] }]),
});
await show("last-trades-prices batch", `${CLOB}/last-trades-prices`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify([{ token_id: thin[0] }, { token_id: emptyTok[0] }]),
});

// verify /price semantics on NO token with two-sided book
const nyc = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const t = JSON.parse(nyc.markets.find((m) => m.groupItemTitle === "62-63°F").clobTokenIds)[1];
const b = await j(`${CLOB}/book?token_id=${t}`);
const bj = JSON.parse(b.text);
console.log(`\nNO token book bids=${bj.bids.length} bestBid=${bj.bids.at(-1)?.price} asks=${bj.asks.length} bestAsk=${bj.asks.at(-1)?.price}`);
await show("NO price BUY", `${CLOB}/price?token_id=${t}&side=BUY`);
await show("NO price SELL", `${CLOB}/price?token_id=${t}&side=SELL`);
