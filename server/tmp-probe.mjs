// scratch live probe (deleted before delivery)
const nowIso = new Date().toISOString();
const out = {};
const get = async (url, opts) => {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), ...opts });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* noop */ }
    return { status: res.status, ms: Date.now() - t0, json, text: json ? undefined : text.slice(0, 300) };
  } catch (e) {
    return { error: e.name + ": " + e.message, ms: Date.now() - t0 };
  }
};

const cases = [
  ["keyset endmin", `https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&limit=50&order=endDate&ascending=true&end_date_min=${encodeURIComponent(nowIso)}`],
  ["keyset plain limit", `https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&limit=50`],
  ["public-search", "https://gamma-api.polymarket.com/public-search?q=highest%20temperature&limit_per_type=10&events_status=active"],
  ["legacy events", "https://gamma-api.polymarket.com/events?tag_id=104596&closed=false&limit=20&order=endDate&ascending=true&end_date_min=" + encodeURIComponent(nowIso)],
];
for (const [name, url] of cases) {
  const r = await get(url);
  const list = r.json && (r.json.events || r.json);
  const sample = Array.isArray(list) ? list.slice(0, 6).map((e) => ({ id: e.id, title: e.title, endDate: e.endDate, closed: e.closed, active: e.active, mc: e.markets && e.markets.length })) : r.json;
  out[name] = { status: r.status, ms: r.ms, count: Array.isArray(list) ? list.length : undefined, sample, error: r.error };
}
console.log(JSON.stringify(out, null, 1));

// pick a live market for CLOB probes
const evRes = await get(`https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&limit=50&order=endDate&ascending=true&end_date_min=${encodeURIComponent(nowIso)}`);
const evs = (evRes.json && evRes.json.events) || [];
let token = null; let tokenNo = null; let picked = null;
for (const ev of evs) {
  for (const m of ev.markets || []) {
    let ids = [];
    try { ids = JSON.parse(m.clobTokenIds || "[]"); } catch { /* noop */ }
    if (ids.length >= 2 && m.acceptingOrders && !m.closed) { token = ids[0]; tokenNo = ids[1]; picked = { event: ev.title, question: m.question, id: m.id, version: m.version }; break; }
  }
  if (token) break;
}
console.log("picked", JSON.stringify(picked));
if (token) {
  const book = await get(`https://clob.polymarket.com/book?token_id=${token}`);
  const books = await get("https://clob.polymarket.com/books", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ token_id: token }, { token_id: tokenNo }]) });
  const hist = await get(`https://data-api.polymarket.com/v2/prices-history?token_id=${token}&interval=1d&bucket_seconds=60`);
  const hist2 = await get(`https://data-api.polymarket.com/v2/prices-history?token_id=${token}&interval=1m&bucket_seconds=60`);
  const last = await get(`https://clob.polymarket.com/last-trade-price?token_id=${token}`);
  const mid = await get(`https://clob.polymarket.com/midpoint?token_id=${token}`);
  const summ = (r) => ({ status: r.status, ms: r.ms, err: r.error, shape: r.json ? (Array.isArray(r.json) ? "array" : Object.keys(r.json).join(",")) : undefined });
  console.log("book", JSON.stringify({ ...summ(book), asks0: book.json && book.json.asks && book.json.asks[0], asksLast: book.json && book.json.asks && book.json.asks.at(-1), bidsLast: book.json && book.json.bids && book.json.bids.at(-1), minOrderSize: book.json && book.json.min_order_size, tickSize: book.json && book.json.tick_size, lastTradePrice: book.json && book.json.last_trade_price }));
  console.log("books", JSON.stringify(summ(books)));
  console.log("hist1d", JSON.stringify({ ...summ(hist), data: hist.json && hist.json.data && hist.json.data.slice(0, 3), n: hist.json && hist.json.data && hist.json.data.length }));
  console.log("hist1m", JSON.stringify({ ...summ(hist2), n: hist2.json && hist2.json.data && hist2.json.data.length, data: hist2.json && hist2.json.data && hist2.json.data.slice(0, 3) }));
  console.log("last", JSON.stringify({ ...summ(last), json: last.json }));
  console.log("mid", JSON.stringify({ ...summ(mid), json: mid.json }));
}
