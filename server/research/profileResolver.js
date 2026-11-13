/** Resolve a public Polymarket profile (display handle + pseudonym) by wallet. */
const GAMMA = "https://gamma-api.polymarket.com";
const cache = new Map();

function walletLike(value) {
  return /^0x[0-9a-f]{40}(-|$)/i.test(String(value || ""));
}

export async function getPublicProfile(wallet) {
  const address = String(wallet || "").trim().toLowerCase();
  if (!address) return null;
  if (cache.has(address)) return cache.get(address);
  try {
    const res = await fetch(`${GAMMA}/public-profile?address=${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const name = String(data?.name || "").trim();
    const pseudonym = String(data?.pseudonym || "").trim();
    const profile = {
      wallet: address,
      name: name && !walletLike(name) ? name : "",
      pseudonym,
      proxyWallet: String(data?.proxyWallet || ""),
    };
    cache.set(address, profile);
    return profile;
  } catch {
    const fallback = { wallet: address, name: "", pseudonym: "" };
    cache.set(address, fallback);
    return fallback;
  }
}
