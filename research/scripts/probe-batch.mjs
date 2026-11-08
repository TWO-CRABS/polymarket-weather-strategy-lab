import fs from "node:fs/promises";
const ev = JSON.parse(await fs.readFile(new URL("../samples/event-slug.json", import.meta.url), "utf8"));
const toks = ev.markets.map((m) => JSON.parse(m.clobTokenIds)[0]);
const body = JSON.stringify(toks.map((t) => ({ token_id: t })));
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  const r = await fetch("https://clob.polymarket.com/books", { method: "POST", headers: { "content-type": "application/json" }, body });
  const j = await r.json();
  console.log("batch", toks.length, "tokens", r.status, Date.now() - t0 + "ms", "items", j.length, "orderMatches", j.every((b, k) => b.asset_id === toks[k]), "bytes", JSON.stringify(j).length);
}
