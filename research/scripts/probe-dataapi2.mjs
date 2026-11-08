// Probe Data API v2 trades / tokens / status live.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const DATA = "https://data-api.polymarket.com";
const ev = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const m = ev.markets.find((x) => x.groupItemTitle === "62-63°F");
const cond = m.conditionId;
const token = JSON.parse(m.clobTokenIds)[0];

const call = async (name, url) => {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
  console.log(`\n=== ${name} [${r.status}] ${text.length}B ${url.replace(DATA, "")}`);
  console.log(text.length > 1800 ? text.slice(0, 1800) + "…" : text);
  return { r, text };
};

await call("data-trades-by-condition", `${DATA}/v2/trades?condition=${cond}&limit=3`);
await call("data-trades-by-event", `${DATA}/v2/trades?event_id=${ev.id}&limit=3`);
await call("data-trades-by-user", `${DATA}/v2/trades?user=0x983eedfbd75803602e4a6e6ea9aab6dc6b9c6748&limit=2`);
await call("data-trades-global", `${DATA}/v2/trades?limit=2`);
await call("data-trades-side", `${DATA}/v2/trades?condition=${cond}&side=BUY&limit=2`);
await call("data-trades-bad-condition", `${DATA}/v2/trades?condition=0x1234&limit=2`);
await call("data-tokens", `${DATA}/v2/tokens?token_id=${token}`);
await call("data-tokens-condition", `${DATA}/v2/tokens?condition=${cond}`);
await call("data-status", `${DATA}/v2/status`);
await call("data-prices-history-1h", `${DATA}/v2/prices-history?token_id=${token}&interval=1h&bucket_seconds=60`);
