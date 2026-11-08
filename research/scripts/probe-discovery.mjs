// Probe Gamma discovery endpoints; save raw bodies to ../samples and print compact summaries.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");

const targets = [
  ["tags-weather", "https://gamma-api.polymarket.com/tags/slug/weather"],
  ["tags-daily-temperature", "https://gamma-api.polymarket.com/tags/slug/daily-temperature"],
  ["tags-highest-temperature", "https://gamma-api.polymarket.com/tags/slug/highest-temperature"],
  ["series-qingdao", "https://gamma-api.polymarket.com/series?slug=qingdao-daily-weather"],
  ["event-slug", "https://gamma-api.polymarket.com/events/slug/highest-temperature-in-qingdao-on-november-8-2026"],
  ["events-keyset-tag103040", "https://gamma-api.polymarket.com/events/keyset?tag_id=103040&closed=false&limit=5"],
  ["events-keyset-tag104596", "https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&limit=5"],
  ["events-keyset-series", "https://gamma-api.polymarket.com/events/keyset?series_id=11590&closed=false&limit=5"],
  ["events-legacy-series", "https://gamma-api.polymarket.com/events?series_id=11590&closed=false&limit=5&order=endDate&ascending=false"],
  ["events-legacy-tag", "https://gamma-api.polymarket.com/events?tag_id=103040&closed=false&limit=5&order=endDate&ascending=true"],
];

const summary = (name, url, status, ct, text) => {
  console.log(`\n=== ${name} [${status}] ${ct} ${text.length}B`);
  console.log(url);
  let j;
  try { j = JSON.parse(text); } catch { console.log(text.slice(0, 300)); return; }
  const arr = Array.isArray(j) ? j : (j.events ?? j.markets ?? [j]);
  console.log("top-level:", Array.isArray(j) ? "array" : Object.keys(j).join(","));
  if (!Array.isArray(arr)) return;
  console.log("count:", arr.length);
  for (const e of arr.slice(0, 5)) {
    if (e.markets) {
      console.log(` event id=${e.id} slug=${e.slug} end=${e.endDate} closed=${e.closed} active=${e.active} negRisk=${e.negRisk} markets=${e.markets.length} title=${String(e.title).slice(0, 70)}`);
      const m = e.markets[0];
      if (m) console.log(`   m0 id=${m.id} cond=${String(m.conditionId).slice(0, 12)}… accepting=${m.acceptingOrders} tick=${m.orderPriceMinTickSize} groupItemTitle=${m.groupItemTitle} outcomes=${m.outcomes}`);
    } else {
      console.log(" item:", JSON.stringify(e).slice(0, 260));
    }
  }
  if (j.next_cursor) console.log("next_cursor:", j.next_cursor.slice(0, 60) + "…");
  if (j.pagination) console.log("pagination:", JSON.stringify(j.pagination));
};

for (const [name, url] of targets) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
    summary(name, url, r.status, r.headers.get("content-type"), text);
  } catch (e) {
    console.log(`\n=== ${name} ERROR ${e.message}`);
  }
}
