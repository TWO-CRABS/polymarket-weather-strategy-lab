// Compare Gamma cached top-of-book vs live CLOB book, and measure request latency.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const S = path.join(ROOT, "samples");
const C = "https://clob.polymarket.com";
const ev = JSON.parse(await fs.readFile(path.join(S, "event-slug.json"), "utf8"));
const rows = [];
for (const m of ev.markets) {
  const tok = JSON.parse(m.clobTokenIds)[0];
  const t0 = Date.now();
  const r = await fetch(`${C}/book?token_id=${tok}`);
  const ms = Date.now() - t0;
  const b = await r.json();
  const liveBid = b.bids.length ? +b.bids.at(-1).price : null;
  const liveAsk = b.asks.length ? +b.asks.at(-1).price : null;
  rows.push({
    bracket: m.groupItemTitle,
    gammaBid: m.bestBid ?? null,
    gammaAsk: m.bestAsk ?? null,
    liveBid,
    liveAsk,
    bidDiff: m.bestBid == null ? null : +(liveBid - m.bestBid).toFixed(4),
    askDiff: m.bestAsk == null ? null : +(liveAsk - m.bestAsk).toFixed(4),
    ms,
    depth: `${b.bids.length}/${b.asks.length}`,
  });
}
console.table(rows);
const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
console.log("book latency ms: min", lat[0], "median", lat[Math.floor(lat.length / 2)], "max", lat.at(-1));
console.log("gamma vs live mismatches:", rows.filter((r) => r.bidDiff !== 0 || r.askDiff !== 0).length, "/", rows.length);
await fs.writeFile(path.join(S, "gamma-vs-clob-topofbook.json"), JSON.stringify(rows, null, 1));
