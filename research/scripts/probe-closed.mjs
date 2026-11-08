// Closed/resolved market behavior + keyset cursor pagination sanity.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const G = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

// old (May 2026) weather market from an event still closed=false but stale
const old = JSON.parse(await fs.readFile(path.join(SAMPLES, "events-keyset-tag103040.json"), "utf8")).events[0];
const om = old.markets[0];
console.log("stale event:", old.slug, "endDate", old.endDate, "closed", old.closed, "market", om.id, "closed", om.closed, "accepting", om.acceptingOrders, "tokens", om.clobTokenIds);
if (om.clobTokenIds) {
  const tok = JSON.parse(om.clobTokenIds)[0];
  for (const p of [`/book?token_id=${tok}`, `/price?token_id=${tok}&side=SELL`, `/midpoint?token_id=${tok}`, `/last-trade-price?token_id=${tok}`, `/tick-size?token_id=${tok}`]) {
    const r = await fetch(CLOB + p);
    console.log(`CLOB ${p.split("?")[0]} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
const gm = await (await fetch(`${G}/markets/${om.id}`)).json();
console.log("gamma market closed:", gm.closed, "acceptingOrders:", gm.acceptingOrders, "archived:", gm.archived, "resolutionSource:", (gm.resolutionSource ?? "").slice(0, 60), "umaResolutionStatus:", gm.umaResolutionStatus);

// keyset cursor round-trip
const u1 = `${G}/events/keyset?tag_id=104596&closed=false&end_date_min=2026-11-08T00:00:00Z&end_date_max=2026-11-09T23:59:59Z&order=endDate&ascending=false&limit=10`;
const p1 = await (await fetch(u1)).json();
const u2 = `${u1}&after_cursor=${encodeURIComponent(p1.next_cursor)}`;
const p2 = await (await fetch(u2)).json();
const ids1 = new Set(p1.events.map((e) => e.id));
console.log(`\nkeyset page1=${p1.events.length} page2=${p2.events.length} overlap=${p2.events.filter((e) => ids1.has(e.id)).length} cursor2=${p2.next_cursor ? "yes" : "null"}`);
console.log("page1 dates:", p1.events.map((e) => e.endDate.slice(0, 10)).join(","));
console.log("page2 dates:", p2.events.map((e) => e.endDate.slice(0, 10)).join(","));
await fs.writeFile(path.join(SAMPLES, "gamma-keyset-pagination.json"), JSON.stringify({ page1Ids: [...ids1], page2Ids: p2.events.map((e) => e.id) }, null, 1));
