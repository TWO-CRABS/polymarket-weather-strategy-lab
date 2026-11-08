// scratch inspection script (deleted before delivery)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const samples = path.join(root, "research", "samples");
const file = process.argv[2];
const json = JSON.parse(fs.readFileSync(path.join(samples, file), "utf8"));
const mode = process.argv[3] || "keys";

const summarize = (obj, depth = 1) => {
  if (Array.isArray(obj)) return `[array ${obj.length}]`;
  if (obj === null) return null;
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === "object") out[k] = Array.isArray(v) ? `[array ${v.length}]` : `{obj ${Object.keys(v).length}}`;
    else if (typeof v === "string" && v.length > 120) out[k] = v.slice(0, 120) + "…";
    else out[k] = v;
  }
  return out;
};

if (mode === "keys") {
  console.log(JSON.stringify(summarize(json), null, 1));
} else if (mode === "event") {
  const { markets, ...rest } = json;
  console.log(JSON.stringify(summarize(rest), null, 1));
  console.log("markets:", markets.length);
  console.log(JSON.stringify(markets[0], null, 1).slice(0, 3000));
} else if (mode === "events") {
  const list = json.events || json;
  console.log("count", list.length);
  for (const ev of list) {
    const ms = ev.markets || [];
    console.log(JSON.stringify({
      id: ev.id,
      title: ev.title,
      slug: ev.slug,
      closed: ev.closed,
      active: ev.active,
      endDate: ev.endDate,
      negRisk: ev.negRisk,
      marketCount: ms.length,
      tags: (ev.tags || []).map((t) => t.slug || t.label).slice(0, 4),
      firstMarket: ms[0] ? { question: ms[0].question, clobTokenIds: typeof ms[0].clobTokenIds, groupItemTitle: ms[0].groupItemTitle, bestBid: ms[0].bestBid, bestAsk: ms[0].bestAsk, outcomePrices: ms[0].outcomePrices, volumeNum: ms[0].volumeNum, liquidityNum: ms[0].liquidityNum, feesEnabled: ms[0].feesEnabled, feeType: ms[0].feeType, version: ms[0].version, orderPriceMinTickSize: ms[0].orderPriceMinTickSize } : null,
    }));
  }
} else if (mode === "market") {
  const markets = json.markets || json;
  console.log("count", markets.length);
  for (const m of markets) {
    console.log(JSON.stringify({ id: m.id, question: m.question, groupItemTitle: m.groupItemTitle, clobTokenIds: m.clobTokenIds, outcomes: m.outcomes, outcomePrices: m.outcomePrices, bestBid: m.bestBid, bestAsk: m.bestAsk, spread: m.spread, volumeNum: m.volumeNum, liquidityNum: m.liquidityNum, negRisk: m.negRisk, feeType: m.feeType, feeSchedule: m.feeSchedule, orderPriceMinTickSize: m.orderPriceMinTickSize, orderMinSize: m.orderMinSize, acceptingOrders: m.acceptingOrders, closed: m.closed, endDate: m.endDate, eventStartTime: m.eventStartTime, version: m.version, positionIds: m.positionIds }, null, 1));
  }
} else if (mode === "raw") {
  console.log(JSON.stringify(json, null, 1).slice(0, Number(process.argv[4] || 8000)));
}
