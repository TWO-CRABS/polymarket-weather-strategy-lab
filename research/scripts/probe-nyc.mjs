// Compare legacy (v1) and polyv2 event variants for NYC Nov 8.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const slugs = [
  "highest-temperature-in-nyc-on-november-8-2026",
  "polyv2-highest-temperature-in-nyc-on-november-8-2026",
  "polyv2-highest-temperature-thresholds-in-nyc-on-november-8-2026",
  "polyv2-highest-temperature-atomic-in-nyc-on-november-8-2026",
  "polyv2-highest-temperature-buckets-in-nyc-on-november-8-2026",
];
for (const slug of slugs) {
  const r = await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`, { signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  const j = JSON.parse(text);
  await fs.writeFile(path.join(SAMPLES, `event-nyc-${slug}.json`), text);
  console.log(`\n=== ${slug} [${r.status}] id=${j.id} negRisk=${j.negRisk} enableNegRisk=${j.enableNegRisk} augmented=${j.negRiskAugmented} markets=${j.markets?.length}`);
  for (const m of j.markets ?? []) {
    console.log(
      [
        `m=${m.id}`,
        `v=${m.version}`,
        `"${m.groupItemTitle}"`,
        `out=${m.outcomes}`,
        `ask=${m.bestAsk}`,
        `bid=${m.bestBid}`,
        `last=${m.lastTradePrice}`,
        `vol=${m.volume}`,
        `acc=${m.acceptingOrders}`,
        `tick=${m.orderPriceMinTickSize}`,
        `clob=${m.clobTokenIds ? "yes" : "null"}`,
        `pos=${m.positionIds ? m.positionIds.length : "null"}`,
      ].join(" ")
    );
  }
}
