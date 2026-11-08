// Quantify 60s returns from prices-history for two weather tokens.
import fs from "node:fs/promises";
import path from "node:path";

const S = path.resolve(import.meta.dirname, "../samples");
const DATA = "https://data-api.polymarket.com";
const tokens = {
  "NYC 62-63F": "39041798960195011479451440838091616993544734051864111077768085622126502863894",
  "Qingdao 13C": "32128651339227986179394223933165322263117899155965245915826868410059996579797",
};
for (const [label, token] of Object.entries(tokens)) {
  const r = await fetch(`${DATA}/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=60`);
  const j = await r.json();
  const pts = j.data;
  const map = new Map(pts.map((p) => [p.timestamp, p.price]));
  const rets = [];
  let prev = null;
  for (const p of pts) {
    if (prev && p.timestamp - prev.timestamp === 60) rets.push({ t: p.timestamp, r: p.price / prev.price - 1, from: prev.price, to: p.price });
    prev = p;
  }
  const big = rets.filter((x) => Math.abs(x.r) >= 0.2);
  const sorted = [...rets].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  console.log(`\n${label}: points=${pts.length} spanMin=${((pts.at(-1).timestamp - pts[0].timestamp) / 60).toFixed(0)} adjacent60s=${rets.length} |ret|>=20%: ${big.length}`);
  console.log("max moves:", sorted.slice(0, 5).map((x) => `${x.from}->${x.to} ${(x.r * 100).toFixed(1)}%`).join(" | "));
  console.log("price range:", Math.min(...pts.map((p) => p.price)), "-", Math.max(...pts.map((p) => p.price)), "distinct prices:", new Set(pts.map((p) => p.price)).size);
  await fs.writeFile(path.join(S, `data-returns-60s-${label.replace(/[^\w]+/g, "-")}.json`), JSON.stringify({ label, token, points: pts.length, adjacent60s: rets.length, moves20pct: big.length, maxMoves: sorted.slice(0, 10) }, null, 1));
}
