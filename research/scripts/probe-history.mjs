// Determine what prices-history actually reports (mid vs last trade), and pagination behavior.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const CLOB = "https://clob.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const nyc = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const token = JSON.parse(nyc.markets.find((m) => m.groupItemTitle === "62-63°F").clobTokenIds)[0];

for (let i = 0; i < 4; i++) {
  const book = await (await fetch(`${CLOB}/book?token_id=${token}`)).json();
  const bid = +book.bids.at(-1).price, ask = +book.asks.at(-1).price;
  const mid = await (await fetch(`${CLOB}/midpoint?token_id=${token}`)).json();
  const ltp = await (await fetch(`${CLOB}/last-trade-price?token_id=${token}`)).json();
  const now = Math.floor(Date.now() / 1000);
  const hist = await (await fetch(`${DATA}/v2/prices-history?token_id=${token}&as_of=${now}`)).json();
  console.log(`bid=${bid} ask=${ask} mid=${mid.mid} lastTrade=${ltp.price}/${ltp.side} | as_of hist=${JSON.stringify(hist.data)}`);
  await new Promise((r) => setTimeout(r, 4000));
}

// pagination with small limit
const p1 = await (await fetch(`${DATA}/v2/prices-history?token_id=${token}&interval=1h&bucket_seconds=60&limit=5`)).json();
console.log(`\nlimit=5 points=${p1.data.length} pagination=${JSON.stringify(p1.pagination)}`);
const p2 = await (await fetch(`${DATA}/v2/prices-history?token_id=${token}&interval=1h&bucket_seconds=60&limit=5&cursor=${encodeURIComponent(p1.pagination.next_cursor)}`)).json();
console.log(`page2 points=${p2.data.length} first=${JSON.stringify(p2.data[0])} pagination=${JSON.stringify(p2.pagination)}`);
await fs.writeFile(path.join(SAMPLES, "data-prices-pagination.json"), JSON.stringify({ p1, p2 }, null, 1));

// 30-day 60s should be empty per docs
const old = await fetch(`${DATA}/v2/prices-history?token_id=${token}&start=${Math.floor(Date.now() / 1000) - 30 * 86400}&end=${Math.floor(Date.now() / 1000)}&bucket_seconds=60`);
const oj = await old.json();
console.log(`\n30d@60 [${old.status}] points=${oj.data?.length} err=${oj.error ?? ""}`);
console.log(`range cap check 15d+1: `, await (async () => {
  const r = await fetch(`${DATA}/v2/prices-history?token_id=${token}&start=${Math.floor(Date.now() / 1000) - 16 * 86400}&end=${Math.floor(Date.now() / 1000)}`);
  const t = await r.text();
  return `${r.status} ${t.slice(0, 200)}`;
})());
