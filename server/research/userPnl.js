/** Cached monthly P&L for a wallet, from Polymarket's Data API v2 user-pnl series. */
import fs from "node:fs/promises";
import path from "node:path";

const DATA = "https://data-api.polymarket.com";
const TTL_MS = 24 * 60 * 60 * 1000;
const memory = new Map();
const stores = new Map();
const pending = new Map();

async function readStore(cacheFile) {
  if (!cacheFile) return { version: 1, entries: {} };
  if (stores.has(cacheFile)) return stores.get(cacheFile);
  let store = { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    if (parsed?.entries && typeof parsed.entries === "object") store = parsed;
  } catch {
    /* first run */
  }
  stores.set(cacheFile, store);
  return store;
}

async function writeStore(cacheFile, store) {
  if (!cacheFile) return;
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  const tmp = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tmp, cacheFile);
}

function fresh(entry) {
  return entry && Number(entry.fetchedAt) > Date.now() - TTL_MS;
}

async function fetchMonthlyPnl(wallet) {
  const res = await fetch(`${DATA}/v2/user-pnl?user=${encodeURIComponent(wallet)}&interval=1m`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const points = Array.isArray(json?.data?.points) ? json.data.points : [];
  if (!points.length) return { wallet, monthPnl: null, realizedMonthPnl: null, points: 0 };
  const first = points[0];
  const last = points[points.length - 1];
  const economic = Number(last.economic_pnl) - Number(first.economic_pnl);
  const realized = Number(last.realized_pnl) - Number(first.realized_pnl);
  return {
    wallet,
    monthPnl: Number.isFinite(economic) ? Number(economic.toFixed(2)) : null,
    realizedMonthPnl: Number.isFinite(realized) ? Number(realized.toFixed(2)) : null,
    volume: Number.isFinite(Number(last.volume)) ? Number(last.volume) : null,
    tradeCount: Number.isFinite(Number(last.trade_count)) ? Number(last.trade_count) : null,
    points: points.length,
    from: Number(first.timestamp) || null,
    to: Number(last.timestamp) || null,
  };
}

export async function getMonthlyPnl(wallet, { cacheFile = "" } = {}) {
  const address = String(wallet || "").trim().toLowerCase();
  if (!address) return null;
  const memKey = `${cacheFile}|${address}`;
  const memEntry = memory.get(memKey);
  if (fresh(memEntry)) return memEntry.value;
  const store = await readStore(cacheFile);
  const diskEntry = store.entries[address];
  if (fresh(diskEntry)) {
    memory.set(memKey, diskEntry);
    return diskEntry.value;
  }
  if (pending.has(memKey)) return pending.get(memKey);
  const promise = (async () => {
    try {
      const value = await fetchMonthlyPnl(address);
      const entry = { fetchedAt: Date.now(), value };
      memory.set(memKey, entry);
      store.entries[address] = entry;
      await writeStore(cacheFile, store).catch(() => {});
      pending.delete(memKey);
      return value;
    } catch {
      pending.delete(memKey);
      return { wallet: address, monthPnl: null, realizedMonthPnl: null, points: 0 };
    }
  })();
  pending.set(memKey, promise);
  return promise;
}
