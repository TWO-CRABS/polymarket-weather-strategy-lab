/**
 * City distribution and city-local trading-hour heatmap for one trader.
 * Reads the local raw trades and writes shared/traderCityAnalysis.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timezoneForCity } from "../shared/cityTimezones.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WALLET = "0x6011655c4afb76f36dd1b08a137a1ba73466b31e";
const RAW_FILE = path.join(PROJECT_ROOT, "data", "trader-analysis", WALLET, "trades.jsonl");
const OUT_FILE = path.join(PROJECT_ROOT, "shared", "traderCityAnalysis.json");

const text = await fs.readFile(RAW_FILE, "utf8");
const rows = text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

function cityFromTrade(trade) {
  const title = String(trade.title || "");
  const match = /highest temperature in (.+?) be /i.exec(title);
  if (match) return match[1].trim();
  const slug = String(trade.event_slug || "");
  const slugMatch = /highest-temperature-in-(.+?)-on-/i.exec(slug);
  return slugMatch ? slugMatch[1].split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ") : "";
}

function localHour(timestamp, timeZone) {
  try {
    return Number(new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(Number(timestamp) * 1000)));
  } catch {
    return null;
  }
}

const cityMap = new Map();
let weatherTrades = 0;
let withTimezone = 0;
for (const trade of rows) {
  if (!/highest-temperature-/i.test(String(trade.event_slug || ""))) continue;
  const city = cityFromTrade(trade);
  if (!city) continue;
  weatherTrades += 1;
  if (!cityMap.has(city)) {
    cityMap.set(city, { city, count: 0, notional: 0, hours: Array(24).fill(0) });
  }
  const bucket = cityMap.get(city);
  const notional = Number(trade.size) * Number(trade.price);
  bucket.count += 1;
  bucket.notional += Number.isFinite(notional) ? notional : 0;
  const zone = timezoneForCity(city);
  const hour = zone ? localHour(trade.timestamp, zone) : null;
  if (hour !== null && hour >= 0 && hour < 24) {
    bucket.hours[hour] += 1;
    withTimezone += 1;
  }
}

const cities = [...cityMap.values()]
  .map((city) => ({ ...city, notional: Number(city.notional.toFixed(2)) }))
  .sort((a, b) => b.count - a.count);

const payload = {
  wallet: WALLET,
  generatedAt: new Date().toISOString(),
  weatherTrades,
  withTimezone,
  cityCount: cities.length,
  cities,
};
await fs.writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ weatherTrades, withTimezone, cityCount: cities.length, top: cities.slice(0, 10).map((c) => [c.city, c.count]) }, null, 2));
