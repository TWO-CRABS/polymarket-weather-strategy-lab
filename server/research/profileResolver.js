/** Resolve a public Polymarket profile (display handle + pseudonym) by wallet. */
import fs from "node:fs/promises";
import path from "node:path";

const GAMMA = "https://gamma-api.polymarket.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const memory = new Map();
const stores = new Map();
const pending = new Map();

function walletLike(value) {
  return /^0x[0-9a-f]{40}(-|$)/i.test(String(value || ""));
}

async function readStore(cacheFile) {
  if (!cacheFile) return { version: 1, entries: {} };
  if (stores.has(cacheFile)) return stores.get(cacheFile);
  let store = { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    if (parsed && parsed.entries && typeof parsed.entries === "object") store = parsed;
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
  return entry && Number(entry.fetchedAt) > Date.now() - CACHE_TTL_MS;
}

async function fetchProfile(address) {
  try {
    const res = await fetch(`${GAMMA}/public-profile?address=${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const name = String(data?.name || "").trim();
    const pseudonym = String(data?.pseudonym || "").trim();
    return {
      wallet: address,
      name: name && !walletLike(name) ? name : "",
      pseudonym,
      proxyWallet: String(data?.proxyWallet || ""),
    };
  } catch {
    return { wallet: address, name: "", pseudonym: "" };
  }
}

export async function getPublicProfile(wallet, { cacheFile = "" } = {}) {
  const address = String(wallet || "").trim().toLowerCase();
  if (!address) return null;

  const memKey = `${cacheFile}|${address}`;
  const memEntry = memory.get(memKey);
  if (fresh(memEntry)) return memEntry.profile;

  const store = await readStore(cacheFile);
  const diskEntry = store.entries[address];
  if (fresh(diskEntry)) {
    memory.set(memKey, diskEntry);
    return diskEntry.profile;
  }

  if (pending.has(memKey)) return pending.get(memKey);
  const promise = (async () => {
    const profile = await fetchProfile(address);
    const entry = { fetchedAt: Date.now(), profile };
    memory.set(memKey, entry);
    store.entries[address] = entry;
    try {
      await writeStore(cacheFile, store);
    } catch {
      /* keep serving the in-memory result */
    }
    pending.delete(memKey);
    return profile;
  })();
  pending.set(memKey, promise);
  return promise;
}
