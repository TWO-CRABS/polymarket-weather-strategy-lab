// WS behavior: no-heartbeat idle, wrong subscription key, invalid asset id.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const qd = JSON.parse(await fs.readFile(path.join(SAMPLES, "event-slug.json"), "utf8"));
const token = JSON.parse(qd.markets.find((m) => m.groupItemTitle === "13°C").clobTokenIds)[0];

const run = (label, frame, ms, opts = {}) =>
  new Promise((resolve) => {
    const out = { label, frame, duration_ms: ms, opened: false, close: null, messages: [] };
    const t0 = Date.now();
    const ws = new WebSocket(URL);
    const to = setTimeout(() => { out.timed_out = true; try { ws.close(); } catch {} }, ms);
    ws.onopen = () => {
      out.opened = true;
      out.open_ms = Date.now() - t0;
      ws.send(typeof frame === "string" ? frame : JSON.stringify(frame));
    };
    ws.onmessage = (e) => {
      const d = typeof e.data === "string" ? e.data : "<bin>";
      out.messages.push({ t: Date.now() - t0, data: d.slice(0, 700) });
    };
    ws.onerror = (e) => (out.error = String(e.message ?? e));
    ws.onclose = (e) => {
      out.close = { code: e.code, reason: e.reason, at_ms: Date.now() - t0 };
      clearTimeout(to);
      resolve(out);
    };
    // resolve at timeout+small delay even if close never fires
    setTimeout(() => { clearTimeout(to); resolve(out); }, ms + 1500);
  });

const a = await run("idle-no-ping", { assets_ids: [token], type: "market" }, 40000);
console.log("A idle-no-ping:", JSON.stringify({ opened: a.opened, close: a.close, timed_out: a.timed_out, msgs: a.messages.length, types: a.messages.map((m) => m.data.slice(0, 40)) }, null, 1));

const b = await run("wrong-key-asset_ids", { asset_ids: [token], type: "market" }, 6000);
console.log("B wrong-key:", JSON.stringify({ opened: b.opened, close: b.close, msgs: b.messages.map((m) => m.data.slice(0, 300)) }, null, 1));

const c = await run("invalid-token", { assets_ids: ["1"], type: "market" }, 6000);
console.log("C invalid-token:", JSON.stringify({ opened: c.opened, close: c.close, msgs: c.messages.map((m) => m.data.slice(0, 300)) }, null, 1));

const d = await run("bad-json", "{not json", 6000);
console.log("D bad-json:", JSON.stringify({ opened: d.opened, close: d.close, msgs: d.messages.map((m) => m.data.slice(0, 300)) }, null, 1));

await fs.writeFile(path.join(SAMPLES, "ws-market-edge-cases.json"), JSON.stringify({ idle: a, wrongKey: b, invalidToken: c, badJson: d }, null, 1));
