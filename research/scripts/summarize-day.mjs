// Build a per-city summary of today's highest-temperature events from the saved sample.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const j = JSON.parse(await fs.readFile(path.join(SAMPLES, "events-highest-2026-11-08-false.json"), "utf8"));
const rows = [];
for (const e of j.events) {
  const markets = e.markets.map((m) => {
    const prices = JSON.parse(m.outcomePrices);
    return {
      id: m.id,
      title: m.groupItemTitle,
      yesMid: +prices[0],
      bestBid: m.bestBid ?? null,
      bestAsk: m.bestAsk ?? null,
      tick: m.orderPriceMinTickSize,
      volume: +(m.volume ?? 0),
      accepting: m.acceptingOrders,
      closed: m.closed,
      tokenYes: JSON.parse(m.clobTokenIds)[0],
      negRisk: m.negRisk,
    };
  });
  const yesSum = markets.reduce((a, m) => a + m.yesMid, 0);
  const bestBidSum = markets.reduce((a, m) => a + (m.bestBid ?? 0), 0);
  const bestAskSum = markets.reduce((a, m) => a + (m.bestAsk ?? 1), 0);
  const unit = markets.some((m) => /°F/.test(m.title)) ? "F" : "C";
  rows.push({
    id: e.id,
    slug: e.slug,
    title: e.title,
    city: e.title.replace(/^Highest temperature in /, "").replace(/ on .*$/, ""),
    eventDate: e.eventDate,
    startTime: e.startTime,
    endDate: e.endDate,
    negRisk: e.negRisk,
    negRiskMarketID: e.negRiskMarketID,
    seriesSlug: e.seriesSlug,
    unit,
    bracketCount: markets.length,
    first: markets[0].title,
    last: markets.at(-1).title,
    yesSum: +yesSum.toFixed(3),
    bidSum: +bestBidSum.toFixed(3),
    askSum: +bestAskSum.toFixed(3),
    totalVolume: +markets.reduce((a, m) => a + m.volume, 0).toFixed(2),
    ticks: [...new Set(markets.map((m) => m.tick))],
    allAccepting: markets.every((m) => m.accepting),
    resolutionSource: (e.markets[0].resolutionSource ?? "").slice(0, 90),
    markets,
  });
}
await fs.writeFile(path.join(SAMPLES, "events-today-summary.json"), JSON.stringify(rows, null, 1));
console.log("cities:", rows.length);
console.log("units:", rows.reduce((a, r) => ((a[r.unit] = (a[r.unit] ?? 0) + 1), a), {}));
console.log("brackets per event:", [...new Set(rows.map((r) => r.bracketCount))]);
console.log("ticks:", [...new Set(rows.flatMap((r) => r.ticks))]);
console.log("resolution hosts:", [...new Set(rows.map((r) => { try { return new URL(r.resolutionSource).host; } catch { return "(none)"; } }))]);
console.log("\ncity / unit / brackets / yesSum / bidSum / askSum / volume / allAcc");
for (const r of rows) console.log(`${r.city.padEnd(14)} ${r.unit} ${String(r.bracketCount).padStart(2)} yes=${r.yesSum} bid=${r.bidSum} ask=${r.askSum} vol=${r.totalVolume} acc=${r.allAccepting}`);
const zeroBid = rows.flatMap((r) => r.markets).filter((m) => (m.bestBid ?? 0) === 0).length;
const total = rows.flatMap((r) => r.markets).length;
console.log(`\nmarkets with no bid: ${zeroBid}/${total}`);
console.log("sample unit-F event:", JSON.stringify(rows.find((r) => r.unit === "F")?.markets.slice(0, 3)));
console.log("sample markets[0] full:", JSON.stringify(rows[0].markets[0]));
