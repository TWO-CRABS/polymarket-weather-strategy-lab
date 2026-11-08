// Final discovery probe: canonical "highest temperature" listing for today+upcoming.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const G = "https://gamma-api.polymarket.com";
const TODAY = "2026-11-08";

const targets = [
  ["events-highest-window", `${G}/events/keyset?tag_id=104596&closed=false&end_date_min=${TODAY}&end_date_max=2026-11-10T23:59:59Z&order=endDate&ascending=false&limit=100`],
  ["events-highest-open", `${G}/events/keyset?tag_id=104596&closed=false&end_date_min=${TODAY}&order=endDate&ascending=false&limit=100`],
  ["events-weather-tag-window", `${G}/events/keyset?tag_id=84&closed=false&end_date_min=${TODAY}&end_date_max=2026-11-10T23:59:59Z&order=endDate&ascending=false&limit=100`],
  ["events-highest-500", `${G}/events/keyset?tag_id=104596&closed=false&end_date_min=${TODAY}&order=endDate&ascending=false&limit=500`],
  ["markets-highest-window", `${G}/markets/keyset?tag_id=104596&closed=false&end_date_min=${TODAY}&end_date_max=2026-11-10T23:59:59Z&order=endDate&ascending=false&limit=5`],
  ["event-slug-tomorrow", `${G}/events/slug/highest-temperature-in-qingdao-on-november-9-2026`],
];

for (const [name, url] of targets) {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) });
  const text = await r.text();
  await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
  const j = JSON.parse(text);
  const arr = j.events ?? j.markets ?? (Array.isArray(j) ? j : [j]);
  console.log(`\n=== ${name} [${r.status}] ${(text.length / 1024).toFixed(0)}KB count=${arr.length}`);
  if (j.next_cursor) console.log("next_cursor:", j.next_cursor.slice(0, 40) + "…");
  const rows = arr.map((e) => ({
    id: e.id,
    date: (e.endDate ?? "").slice(0, 10),
    slug: e.slug,
    title: e.title,
    mkts: e.markets?.length,
    neg: e.negRisk,
    aug: e.negRiskAugmented,
    vol: e.volume,
  }));
  const byDate = rows.reduce((a, x) => ((a[x.date] = (a[x.date] ?? 0) + 1), a), {});
  console.log("by endDate:", JSON.stringify(byDate));
  console.log("first 5:", JSON.stringify(rows.slice(0, 5), null, 0));
  console.log("last 3:", JSON.stringify(rows.slice(-3), null, 0));
  console.log("polyv2 slugs:", rows.filter((x) => /polyv2/.test(x.slug ?? "")).length, " lowest:", rows.filter((x) => /lowest/.test(x.title ?? "")).length);
  if (name === "event-slug-tomorrow") {
    console.log("event fields:", Object.keys(j).join(","));
    console.log("market0:", JSON.stringify(j.markets[0]).slice(0, 500));
  }
}
