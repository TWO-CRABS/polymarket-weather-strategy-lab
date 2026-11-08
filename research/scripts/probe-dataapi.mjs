// Probe data-api prices-history and trades.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const DATA = "https://data-api.polymarket.com";

const ev = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const m = ev.markets.find((x) => x.groupItemTitle === "62-63°F");
const token = JSON.parse(m.clobTokenIds)[0];
console.log("token:", token, "conditionId:", m.conditionId);

const call = async (name, url) => {
  const t0 = Date.now();
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  const ms = Date.now() - t0;
  await fs.writeFile(path.join(SAMPLES, `${name}.json`), text);
  let body; try { body = JSON.parse(text); } catch { body = null; }
  const rl = Object.fromEntries([...r.headers].filter(([k]) => /rate|retry|limit/i.test(k)));
  console.log(`\n=== ${name} [${r.status}] ${ms}ms ${text.length}B rl=${JSON.stringify(rl)}`);
  console.log(String(url).replace(DATA, ""));
  if (body && body.data) {
    console.log(`data points=${body.data.length} first=${JSON.stringify(body.data[0])} last=${JSON.stringify(body.data.at(-1))}`);
    console.log(`pagination=${JSON.stringify(body.pagination)}`);
    const res = new Set(body.data.map((p) => p.resolution_seconds));
    const ts = body.data.map((p) => p.timestamp);
    const gaps = [];
    for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] !== res.values().next().value) gaps.push(ts[i] - ts[i - 1]);
    console.log(`unique resolution_seconds=${[...res]} span=${ts.at(-1) - ts[0]}s gaps(non-uniform)=${gaps.length} sampleGaps=${gaps.slice(0, 5)}`);
  } else {
    console.log(text.length > 600 ? text.slice(0, 600) + "…" : text);
  }
  return body;
};

await call("data-prices-1d-60", `${DATA}/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=60`);
await call("data-prices-1d-300", `${DATA}/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=300`);
await call("data-prices-1h-60", `${DATA}/v2/prices-history?token_id=${token}&interval=1h&bucket_seconds=60`);
await call("data-prices-1w-60", `${DATA}/v2/prices-history?token_id=${token}&interval=1w&bucket_seconds=60`);
await call("data-prices-1m-60", `${DATA}/v2/prices-history?token_id=${token}&interval=1m&bucket_seconds=60`);
await call("data-prices-1m-default", `${DATA}/v2/prices-history?token_id=${token}&interval=1m`);
await call("data-prices-max-default", `${DATA}/v2/prices-history?token_id=${token}&interval=max`);
await call("data-prices-15d-60", `${DATA}/v2/prices-history?token_id=${token}&start=${Math.floor(Date.now() / 1000) - 15 * 86400}&end=${Math.floor(Date.now() / 1000)}&bucket_seconds=60`);
await call("data-prices-asof", `${DATA}/v2/prices-history?token_id=${token}&as_of=${Math.floor(Date.now() / 1000) - 3600}`);
await call("data-prices-bad-token", `${DATA}/v2/prices-history?token_id=1&interval=1d`);
await call("data-prices-no-time", `${DATA}/v2/prices-history?token_id=${token}`);
await call("data-prices-bucket-1", `${DATA}/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=1`);
await call("data-prices-bucket-30", `${DATA}/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=30`);

const cond = m.conditionId;
await call("data-trades-market", `${DATA}/trades?market=${cond}&limit=5`);
await call("data-trades-condition", `${DATA}/trades?market=${cond}&limit=5&takerOnly=false`);
await call("data-trades-none", `${DATA}/trades?limit=5`);
await call("data-trades-user-market", `${DATA}/trades?market=${cond}&limit=5&filterType=CASH&filterAmount=0`);
