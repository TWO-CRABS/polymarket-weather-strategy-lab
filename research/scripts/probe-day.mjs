// Enumerate today's highest-temperature events: open vs closed counts, city list.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const G = "https://gamma-api.polymarket.com";
const day = process.argv[2] ?? "2026-11-08";

for (const closed of ["false", "any"]) {
  const url = `${G}/events/keyset?tag_id=104596&closed=${closed}&end_date_min=${day}T00:00:00Z&end_date_max=${day}T23:59:59Z&order=endDate&ascending=false&limit=100`;
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const j = await r.json();
  const arr = j.events ?? [];
  await fs.writeFile(path.join(SAMPLES, `events-highest-${day}-${closed}.json`), JSON.stringify(j));
  console.log(`\nclosed=${closed} count=${arr.length} cursor=${j.next_cursor ? "yes" : "no"}`);
  console.log("titles:", arr.map((e) => e.title.replace("Highest temperature in ", "").replace(/\?$/, "")).join(" | "));
  console.log("market states:", JSON.stringify(arr.slice(0, 3).map((e) => ({ slug: e.slug, closed: e.closed, active: e.active, markets: e.markets.map((m) => `${m.groupItemTitle}:${m.closed}/${m.acceptingOrders}`) }))).slice(0, 700));
}
