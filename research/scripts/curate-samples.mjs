// Curate research/samples: keep representative raw samples, derive compact ones, delete bulk duplicates.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const S = path.join(ROOT, "samples");
const read = async (f) => JSON.parse(await fs.readFile(path.join(S, f), "utf8"));
const write = (f, obj) => fs.writeFile(path.join(S, f), JSON.stringify(obj, null, 1));

// 1) full single market + event-level object (without the huge description)
const ev = await read("event-slug.json");
const m = ev.markets.find((x) => x.groupItemTitle === "13°C");
await write("market-weather-full.json", m);
const { markets, description, ...eventHead } = ev;
await write("event-level-fields.json", eventHead);

// 2) compact today's listing
const today = await read("events-highest-2026-11-08-false.json");
await write(
  "events-today-2026-11-08.json",
  today.events.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    eventDate: e.eventDate,
    endDate: e.endDate,
    startTime: e.startTime,
    negRisk: e.negRisk,
    negRiskMarketID: e.negRiskMarketID,
    seriesSlug: e.seriesSlug,
    volume: e.volume,
    marketCount: e.markets.length,
    firstBracket: e.markets[0]?.groupItemTitle,
    lastBracket: e.markets.at(-1)?.groupItemTitle,
    markets: e.markets.map((mk) => ({
      id: mk.id,
      conditionId: mk.conditionId,
      question: mk.question,
      groupItemTitle: mk.groupItemTitle,
      outcomes: mk.outcomes,
      outcomePrices: mk.outcomePrices,
      clobTokenIds: mk.clobTokenIds,
      bestBid: mk.bestBid ?? null,
      bestAsk: mk.bestAsk ?? null,
      spread: mk.spread ?? null,
      lastTradePrice: mk.lastTradePrice ?? null,
      orderPriceMinTickSize: mk.orderPriceMinTickSize,
      orderMinSize: mk.orderMinSize,
      negRisk: mk.negRisk,
      acceptingOrders: mk.acceptingOrders,
      volume: mk.volume,
      liquidity: mk.liquidity,
      feesEnabled: mk.feesEnabled,
      feeType: mk.feeType,
      feeSchedule: mk.feeSchedule,
      endDate: mk.endDate,
      eventStartTime: mk.eventStartTime,
      resolutionSource: mk.resolutionSource,
    })),
  }))
);

// 3) trim WS frame log
const raw = await fs.readFile(path.join(S, "ws-market-frames.jsonl"), "utf8");
const lines = raw.split("\n").filter(Boolean);
await fs.writeFile(path.join(S, "ws-market-frames-sample.jsonl"), lines.slice(0, 25).join("\n") + "\n");
await fs.rm(path.join(S, "ws-market-frames.jsonl"));

// 4) delete bulk duplicates / one-off probes
const drop = [
  "events-highest-open.json", "events-highest-500.json", "events-highest-window.json",
  "events-weather-tag-window.json", "events-highest-2026-11-08-any.json", "events-highest-2026-11-08-false.json",
  "series-daily.json", "events-legacy-endmin.json", "events-keyset-endmin.json", "events-keyset-order-enddate.json",
  "events-keyset-series.json", "events-legacy-series.json", "events-legacy-tag.json", "events-keyset-tag103040.json",
  "markets-keyset-tag.json", "public-search-params.json", "data-prices-history-1h.json",
  "event-nyc-polyv2-highest-temperature-atomic-in-nyc-on-november-8-2026.json",
  "event-nyc-polyv2-highest-temperature-buckets-in-nyc-on-november-8-2026.json",
  "event-nyc-polyv2-highest-temperature-thresholds-in-nyc-on-november-8-2026.json",
  "clob-book-tail.json", "data-prices-bad-token.json", "data-prices-no-time.json",
  "data-trades-none.json", "data-trades-user-market.json", "data-trades-condition.json",
  "clob-price-buy.json", "clob-price-sell.json", "clob-book-bogus.json",
];
for (const f of drop) await fs.rm(path.join(S, f), { force: true });

const left = await fs.readdir(S);
let total = 0;
for (const f of left) total += (await fs.stat(path.join(S, f))).size;
console.log("kept", left.length, "files,", (total / 1024 / 1024).toFixed(2), "MB");
for (const f of (await fs.readdir(S)).sort()) console.log(" ", f, (await fs.stat(path.join(S, f))).size);
