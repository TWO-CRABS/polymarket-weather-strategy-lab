// Live test of the public CLOB market WebSocket for weather markets.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

const nyc = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-nyc-highest-temperature-in-nyc-on-november-8-2026.json"), "utf8"));
const qd = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-slug.json"), "utf8"));
const pick = (ev, t) => JSON.parse(ev.markets.find((m) => m.groupItemTitle === t).clobTokenIds)[0];
const nycActive = pick(nyc, "62-63°F");
const nycSecond = pick(nyc, "60-61°F");
const qdActive = pick(qd, "13°C");
const all = nyc.markets.flatMap((m) => JSON.parse(m.clobTokenIds));

const log = [];
const frames = [];
const t0 = Date.now();
const ws = new WebSocket(URL);
const send = (obj) => ws.send(JSON.stringify(obj));
let pingSent = 0;

const timer = setTimeout(() => {
  console.log("\n--- closing after 45s ---");
  try { ws.close(); } catch {}
  finish();
}, 45000);

const finish = async () => {
  clearTimeout(timer);
  const summary = {
    url: URL,
    duration_ms: Date.now() - t0,
    opened: ws.readyState,
    total_frames: frames.length,
    by_event_type: frames.reduce((a, f) => ((a[f.type] = (a[f.type] ?? 0) + 1), a), {}),
    pong_received: frames.some((f) => f.type === "PONG"),
    assets_subscribed: { nycActive, nycSecond, qdActive, count_all_nyc: all.length },
    first_frames: frames.slice(0, 8),
  };
  await fs.writeFile(path.join(SAMPLES, "ws-market-probe.json"), JSON.stringify(summary, null, 1));
  await fs.writeFile(path.join(SAMPLES, "ws-market-frames.jsonl"), frames.map((f) => JSON.stringify(f)).join("\n"));
  console.log("\nSUMMARY:", JSON.stringify({ ...summary, first_frames: undefined }, null, 1));
  for (const f of frames.slice(0, 10)) console.log(`\n[${f.t}] type=${f.type} ${JSON.stringify(f.raw).slice(0, 900)}`);
  process.exit(0);
};

ws.onopen = () => {
  console.log("OPEN", Date.now() - t0, "ms");
  send({ assets_ids: [nycActive, nycSecond, qdActive], type: "market", custom_feature_enabled: true });
  console.log("sent subscribe (assets_ids x3)");
  // after 15s, add the whole NYC event
  setTimeout(() => {
    console.log("sending operation=subscribe for all NYC tokens:", all.length);
    send({ operation: "subscribe", assets_ids: all.slice(3) });
  }, 15000);
  // heartbeats at 10s and 25s
  setTimeout(() => { ws.send("PING"); pingSent++; console.log("sent PING #1"); }, 10000);
  setTimeout(() => { ws.send("PING"); pingSent++; console.log("sent PING #2"); }, 25000);
};

ws.onmessage = (e) => {
  const t = Date.now() - t0;
  const data = typeof e.data === "string" ? e.data : "<binary>";
  if (data === "PONG" || data === "pong") {
    frames.push({ t, type: "PONG", raw: data });
    console.log("<< PONG");
    return;
  }
  let m;
  try { m = JSON.parse(data); } catch { frames.push({ t, type: "nonjson", raw: data }); return; }
  const arr = Array.isArray(m) ? m : [m];
  for (const one of arr) {
    const type = one.event_type ?? one.type ?? (one.error ? "error" : "unknown");
    frames.push({ t, type, raw: one });
    const extra = type === "book" ? `bids=${one.bids?.length} asks=${one.asks?.length} asset=${one.asset_id?.slice(0, 8)}` : type === "last_trade_price" ? `price=${one.price} side=${one.side}` : type === "price_change" ? `changes=${one.price_changes?.length}` : JSON.stringify(one).slice(0, 200);
    console.log(`<< [${t}ms] ${type} ${extra}`);
  }
};

ws.onerror = (e) => { console.log("ERROR", e.message ?? e); frames.push({ t: Date.now() - t0, type: "ws_error", raw: String(e.message ?? e) }); };
ws.onclose = (e) => { console.log("CLOSE", e.code, e.reason); finish(); };
