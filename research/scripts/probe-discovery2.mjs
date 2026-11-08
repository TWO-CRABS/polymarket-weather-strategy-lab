// Probe Gamma filtering / sorting / series enumeration.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");

const targets = [
  ["events-keyset-order-enddate", "https://gamma-api.polymarket.com/events/keyset?tag_id=103040&closed=false&limit=5&order=endDate&ascending=false"],
  ["events-keyset-endmin", "https://gamma-api.polymarket.com/events/keyset?tag_id=103040&closed=false&limit=5&end_date_min=2026-11-08"],
  ["events-legacy-endmin", "https://gamma-api.polymarket.com/events?tag_id=103040&closed=false&limit=10&end_date_min=2026-11-08T00:00:00Z&order=endDate&ascending=true"],
  ["series-daily", "https://gamma-api.polymarket.com/series?recurrence=daily&closed=false&limit=100"],
  ["public-search-params", "https://gamma-api.polymarket.com/public-search?q=highest%20temperature&limit_per_type=3&events_status=active"],
  ["markets-keyset-tag", "https://gamma-api.polymarket.com/markets/keyset?tag_id=103040&closed=false&limit=3"],
];

const brief = (e) => `id=${e.id} slug=${e.slug} end=${e.endDate ?? e.endDateIso} closed=${e.closed} active=${e.active} accepting=${e.acceptingOrders} markets=${e.markets?.length ?? "-"} title=${String(e.title ?? e.question).slice(0, 60)}`;

for (const [name, url] of targets) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
    console.log(`\n=== ${name} [${r.status}] ${text.length}B`);
    const j = JSON.parse(text);
    if (Array.isArray(j)) {
      console.log("array count:", j.length);
      if (name === "series-daily") {
        const weather = j.filter((s) => /weather/i.test(s.slug ?? "") || /weather|temperature/i.test(s.title ?? ""));
        console.log("weather-ish series:", weather.length, "total:", j.length);
        console.log("sample slugs:", j.slice(0, 8).map((s) => s.slug).join(", "));
        console.log("weather slugs:", weather.slice(0, 60).map((s) => s.slug).join(", "));
        console.log("first weather series keys:", Object.keys(weather[0] ?? {}).join(","));
        console.log("has events field:", "events" in (weather[0] ?? {}), weather[0]?.events?.length);
      } else {
        console.log(j.slice(0, 6).map(brief).join("\n"));
      }
    } else {
      console.log("top-level:", Object.keys(j).join(","));
      const arr = j.events ?? j.markets ?? [];
      console.log("count:", arr.length);
      console.log(arr.slice(0, 6).map(brief).join("\n"));
      if (j.next_cursor) console.log("next_cursor:", j.next_cursor.slice(0, 50) + "…");
      if (j.pagination) console.log("pagination:", JSON.stringify(j.pagination));
      if (j.tags) console.log("tags:", JSON.stringify(j.tags.slice(0, 5)));
      if (j.series) console.log("series:", JSON.stringify(j.series));
    }
  } catch (e) {
    console.log(`\n=== ${name} ERROR ${e.message}`);
  }
}
