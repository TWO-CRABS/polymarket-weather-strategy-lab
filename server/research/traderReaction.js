/**
 * server/research/traderReaction.js —?pure research logic: did traders react to
 * METAR warming nodes before the temperature-bracket market repriced?
 *
 * Research question
 * -----------------
 * Polymarket city-temperature events have one bracket market per temperature
 * range. A METAR observation that pushes the station's reported temperature
 * into a NEW (higher) bracket is a public information node: if the market is
 * efficient the target (new-bracket) YES token should reprice shortly after
 * that observation. This module measures, for each qualified warming node,
 * which wallets traded the target market in the correct direction (BUY YES or
 * SELL NO) inside `node ± pre/postWindowSec` but strictly BEFORE the first
 * significant reprice. Their aggregate behaviour is reported per wallet as
 * `ahead / qualified` with a Wilson lower bound.
 *
 * Everything in this module is PURE: no network, no clock, no randomness. The
 * live fetches live in `scripts/analyze-trader-reactions.mjs`; fixtures live in
 * `tests/trader-reaction.test.js`.
 *
 * Terminology / defaults
 * ----------------------
 * - nodeTs            epoch seconds of the METAR report that entered a new bracket.
 *                     reaction window is ±300s (±5 min) by default.
 * - baseline          target YES mid at `nodeTs - preWindowSec` (default 300s).
 * - reprice           first target YES mid after `nodeTs` whose absolute move vs
 *                     baseline is >= max(minMove, 1 × tickSize), searched for at
 *                     most maxRepriceWaitSec (default 300s); sign is recorded.
 * - direction-correct (BUY, YES) or (SELL, NO) on the target market's own tokens;
 *                     a wallet already net long target YES / short NO before the
 *                     node also counts as ahead (pre-positioned holder).
 * - ahead             pre-positioned holder, or direction-correct trade with
 *                     ts < reprice.ts inside the ±pre/post window.
 * - qualified (user)  denominator is ALL qualified warming nodes; `involved`
 *                     records how many of them the wallet participated in.
 * - eligible          qualified >= 100 AND wilsonLower > 0.9 (per Lead contract).
 */

/** Default tunables (documented in the script and the QA report). */
export const REACTION_DEFAULTS = Object.freeze({
  /** window before the METAR node (seconds) */
  preWindowSec: 300,
  /** window after the METAR node (seconds) */
  postWindowSec: 300,
  /** baseline/reprice tolerance */
  minMove: 0.05,
  /** price ticks used in max(minMove, 1 tick) */
  tickMultiplier: 1,
  /** lowest usable baseline mid (midpoint sentinels like 0.0005 are not tradeable) */
  minBaselineMid: 0.01,
  /** highest usable baseline mid */
  maxBaselineMid: 0.99,
  /** give up looking for a reprice after this long (seconds) */
  maxRepriceWaitSec: 5 * 60,
  /** Wilson z-score for a 95% two-sided interval */
  wilsonZ: 1.96,
  /** eligibility thresholds from the task contract */
  eligibleMinQualified: 100,
  eligibleMinWilson: 0.9,
});

const SEC = 1_000;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Coerce epoch-like values (seconds, ms, ISO string) into epoch seconds. */
export function toEpochSec(value) {
  if (isFiniteNumber(value)) {
    return Math.floor(value > 1e12 ? value / SEC : value);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return Math.floor(ms / SEC);
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n > 1e12 ? n / SEC : n);
  }
  return null;
}

/**
 * Parse a bracket label from a market title/question.
 *
 * Supported shapes:
 *   "29°C or below" / "51°F or below"     -> (-Inf, x+1)
 *   "30°C"                                -> [30, 31)
 *   "39°C or higher" / "70°F or above"    -> [x, Inf)
 *   "62-63°F"                             -> [62, 64)
 *
 * @param {string} title
 * @returns {{unit:"C"|"F", lo:number, hi:number, label:string}|null}
 */
export function parseBracketTitle(title) {
  const text = String(title ?? "").trim();
  if (!text) return null;
  let match = /(\d+(?:\.\d+)?)\s*°C\s*or\s*below/i.exec(text);
  if (match) return { unit: "C", lo: -Infinity, hi: Number(match[1]) + 1, label: text };
  match = /(\d+(?:\.\d+)?)\s*°C\s*or\s*(?:above|higher)/i.exec(text);
  if (match) return { unit: "C", lo: Number(match[1]), hi: Infinity, label: text };
  match = /(\d+(?:\.\d+)?)\s*°C\b/i.exec(text);
  if (match) return { unit: "C", lo: Number(match[1]), hi: Number(match[1]) + 1, label: text };
  match = /(\d+)\s*-\s*(\d+)\s*°F/i.exec(text);
  if (match) return { unit: "F", lo: Number(match[1]), hi: Number(match[2]) + 1, label: text };
  match = /(\d+(?:\.\d+)?)\s*°F\s*or\s*below/i.exec(text);
  if (match) return { unit: "F", lo: -Infinity, hi: Number(match[1]) + 1, label: text };
  match = /(\d+(?:\.\d+)?)\s*°F\s*or\s*(?:above|higher)/i.exec(text);
  if (match) return { unit: "F", lo: Number(match[1]), hi: Infinity, label: text };
  match = /(\d+(?:\.\d+)?)\s*°F\b/i.exec(text);
  if (match) return { unit: "F", lo: Number(match[1]), hi: Number(match[1]) + 1, label: text };
  return null;
}

/** Celsius -> Fahrenheit. */
export function cToF(celsius) {
  return (celsius * 9) / 5 + 32;
}

/**
 * Find the bracket that contains a temperature, converting °C to °F when the
 * bracket set is Fahrenheit-based.
 * @param {number} tempC observed temperature in °C
 * @param {Array<{bracket:object}>} markets market rows carrying a parsed `bracket`
 * @returns {object|null} the matching market row
 */
export function bracketForTemp(tempC, markets) {
  if (!isFiniteNumber(tempC)) return null;
  const celsius = markets.find((market) => market?.bracket?.unit === "C");
  const unit = celsius ? "C" : "F";
  const value = unit === "F" ? cToF(tempC) : tempC;
  for (const market of markets) {
    const bracket = market?.bracket;
    if (!bracket || bracket.unit !== unit) continue;
    if (value >= bracket.lo && value < bracket.hi) return market;
  }
  return null;
}

/**
 * Normalize raw AviationWeather METAR JSON rows.
 * `obsTime`/`reportTime` may be epoch seconds or ISO strings; `temp` is °C.
 * Rows without a usable temperature/time are dropped.
 * @param {Array<object>} rows
 * @returns {Array<{ts:number, tempC:number, raw:string, station:string}>}
 */
export function parseMetarReports(rows) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const ts = toEpochSec(row.obsTime ?? row.reportTime ?? row.receiptTime);
    const rawTemp = row.temp;
    const hasTemp = rawTemp !== null && rawTemp !== undefined && rawTemp !== "";
    const tempC = hasTemp ? Number(rawTemp) : NaN;
    if (ts === null || !Number.isFinite(tempC)) continue;
    out.push({
      ts,
      tempC,
      raw: String(row.rawOb ?? ""),
      station: String(row.icaoId ?? ""),
    });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

/**
 * Restrict METAR rows to the station-local event day.
 * The resolution-source anchor is local "03:00 next day" (verified for
 * Karachi/Qingdao/NYC), so local noon is anchor-15h and the local day is
 * [anchor-27h, anchor-3h).
 * @param {Array<{ts:number}>} rows
 * @param {number} anchorSec epoch seconds of the resolution URL's `date=`
 * @returns {Array<object>} rows inside the local day, oldest first
 */
export function filterLocalDay(rows, anchorSec) {
  const start = anchorSec - 27 * 3600;
  const end = anchorSec - 3 * 3600;
  return rows.filter((row) => row.ts >= start && row.ts < end);
}

/**
 * Extract the METAR station + anchor from a Gamma `resolutionSource` URL.
 * @param {string} resolutionSource
 * @returns {{station:string, anchorSec:number, dateParam:string|null}|null}
 */
export function parseResolutionSource(resolutionSource) {
  const text = String(resolutionSource ?? "");
  const station = /[?&]ids=([^&]+)/.exec(text)?.[1] ?? "";
  const dateParam = /[?&]date=([^&]+)/.exec(text)?.[1] ?? null;
  const anchorSec = dateParam ? toEpochSec(decodeURIComponent(dateParam)) : null;
  if (!station || anchorSec === null) return null;
  return { station: decodeURIComponent(station), anchorSec, dateParam };
}

/**
 * Warming nodes = METAR observations (inside the local day) whose temperature
 * moved into a bracket higher than the previous observation's bracket.
 *
 * One node per upward bracket transition; a repeated observation in the same
 * bracket does not create a new node. The first observation of the day is not a
 * node (there is no "previous" to warm from).
 *
 * @param {{metarRows:Array<{ts:number,tempC:number}>, markets:Array<object>,
 *          anchorSec?:number, dayStartSec?:number, dayEndSec?:number}} args
 * @returns {Array<{eventKey?:string, nodeTs:number, tempC:number, bracket:string,
 *   marketId:string, yesToken:string, noToken:string, tickSize:number,
 *   market:object, prevBracket:string|null}>}
 */
export function findWarmingNodes(args) {
  const { metarRows = [], markets = [], anchorSec } = args;
  const startSec = isFiniteNumber(args.dayStartSec)
    ? args.dayStartSec
    : isFiniteNumber(anchorSec)
      ? anchorSec - 27 * 3600
      : -Infinity;
  const endSec = isFiniteNumber(args.dayEndSec)
    ? args.dayEndSec
    : isFiniteNumber(anchorSec)
      ? anchorSec - 3 * 3600
      : Infinity;

  const rows = (Array.isArray(metarRows) ? metarRows : [])
    .filter((row) => isFiniteNumber(row?.ts) && isFiniteNumber(row?.tempC))
    .filter((row) => row.ts >= startSec && row.ts < endSec)
    .sort((a, b) => a.ts - b.ts);

  const nodes = [];
  let previousMarket = null;
  for (const row of rows) {
    const market = bracketForTemp(row.tempC, markets);
    if (!market) continue;
    if (previousMarket) {
      const prevLo = previousMarket.bracket?.lo ?? -Infinity;
      const nextLo = market.bracket?.lo ?? -Infinity;
      if (nextLo > prevLo) {
        nodes.push({
          nodeTs: row.ts,
          tempC: row.tempC,
          bracket: market.bracket.label,
          marketId: String(market.id ?? market.marketId ?? ""),
          yesToken: String(market.yesToken ?? ""),
          noToken: String(market.noToken ?? ""),
          tickSize: isFiniteNumber(market.tickSize) && market.tickSize > 0 ? market.tickSize : 0.001,
          market,
          prevBracket: previousMarket.bracket?.label ?? null,
        });
      }
    }
    previousMarket = market;
  }
  return nodes;
}

/**
 * Latest price point at or before `targetTs` (points sorted or not).
 * @param {Array<{ts:number,price:number}>} points
 * @param {number} targetTs epoch seconds
 * @returns {{ts:number,price:number}|null}
 */
export function baselineAt(points, targetTs) {
  if (!Array.isArray(points) || !isFiniteNumber(targetTs)) return null;
  let best = null;
  for (const point of points) {
    if (!isFiniteNumber(point?.ts) || !isFiniteNumber(point?.price)) continue;
    if (point.ts <= targetTs && (!best || point.ts > best.ts)) best = point;
  }
  return best;
}

/**
 * First significant reprice after a node.
 * Reprice threshold = max(minMove, tickMultiplier × tickSize), compared on the
 * absolute YES-mid move from the baseline.
 *
 * @param {{points:Array<{ts:number,price:number}>, nodeTs:number, baselinePrice:number,
 *   tickSize?:number, minMove?:number, tickMultiplier?:number, maxWaitSec?:number}} args
 * @returns {{ts:number, price:number, move:number, direction:"up"|"down",
 *   threshold:number}|null}
 */
export function findReprice(args) {
  const {
    points = [],
    nodeTs,
    baselinePrice,
    tickSize = 0.001,
    minMove = REACTION_DEFAULTS.minMove,
    tickMultiplier = REACTION_DEFAULTS.tickMultiplier,
    maxWaitSec = REACTION_DEFAULTS.maxRepriceWaitSec,
  } = args;
  if (!isFiniteNumber(nodeTs) || !isFiniteNumber(baselinePrice)) return null;
  const threshold = Math.max(minMove, tickMultiplier * (isFiniteNumber(tickSize) && tickSize > 0 ? tickSize : 0.001));
  const deadline = nodeTs + maxWaitSec;
  let best = null;
  for (const point of points) {
    if (!isFiniteNumber(point?.ts) || !isFiniteNumber(point?.price)) continue;
    if (point.ts <= nodeTs || point.ts > deadline) continue;
    const move = point.price - baselinePrice;
    if (Math.abs(move) < threshold) continue;
    if (!best || point.ts < best.ts) {
      best = { ts: point.ts, price: point.price, move, direction: move > 0 ? "up" : "down", threshold };
    }
  }
  return best;
}

/**
 * Normalize one raw `/v2/trades` row.
 * @param {object} trade
 * @returns {{wallet:string, pseudonym:string, side:string, outcome:string,
 *   tokenId:string, conditionId:string, ts:number, size:number, price:number,
 *   marketTitle:string, eventSlug:string}|null}
 */
export function normalizeTrade(trade) {
  if (!trade || typeof trade !== "object") return null;
  const wallet = String(trade.proxy_wallet ?? trade.wallet ?? "").toLowerCase();
  const ts = toEpochSec(trade.timestamp);
  if (!wallet || ts === null) return null;
  const side = String(trade.side ?? "").toUpperCase();
  const outcome = String(trade.outcome ?? "");
  return {
    wallet,
    pseudonym: String(trade.pseudonym ?? trade.name ?? ""),
    side,
    outcome,
    tokenId: String(trade.token_id ?? ""),
    conditionId: String(trade.condition_id ?? ""),
    ts,
    size: Number(trade.size) || 0,
    price: Number(trade.price) || 0,
    marketTitle: String(trade.title ?? ""),
    eventSlug: String(trade.event_slug ?? ""),
  };
}

/**
 * True when an object already looks like normalizeTrade()'s output (so
 * callers may pass raw API rows or pre-normalized trades interchangeably).
 * @param {any} trade
 * @returns {boolean}
 */
export function isNormalizedTrade(trade) {
  return Boolean(
    trade
    && typeof trade === "object"
    && typeof trade.wallet === "string"
    && typeof trade.tokenId === "string"
    && isFiniteNumber(trade.ts),
  );
}

/** True when a trade bets the temperature bracket UP: BUY YES or SELL NO. */
export function isDirectionCorrect(trade) {
  const side = String(trade?.side ?? "").toUpperCase();
  const outcome = String(trade?.outcome ?? "").toLowerCase();
  const isYes = outcome === "yes";
  const isNo = outcome === "no";
  return (side === "BUY" && isYes) || (side === "SELL" && isNo);
}

/**
 * Wilson score interval lower bound for a binomial proportion.
 * @param {number} successes
 * @param {number} trials
 * @param {number} [z=1.96]
 * @returns {number} 0..1 (0 when trials <= 0)
 */
export function wilsonLowerBound(successes, trials, z = REACTION_DEFAULTS.wilsonZ) {
  const n = Number(trials);
  const k = Number(successes);
  if (!isFiniteNumber(n) || !isFiniteNumber(k) || n <= 0) return 0;
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return Math.max(0, centre - margin);
}

/**
 * Core aggregation.
 *
 * @param {{
 *   warmingNodes: Array<{nodeTs:number, yesToken:string, noToken:string, tickSize?:number,
 *     marketId?:string, bracket?:string, nodeId?:string}>,
 *   targetMarketTrades: Array<object>,
 *   priceByToken: Map<string, Array<{ts:number,price:number}>>|object,
 *   options?: Partial<typeof REACTION_DEFAULTS>,
 * }} input
 * @returns {{qualifiedWarmingNodes:number, nodes:Array<object>,
 *   users:Array<{wallet:string,pseudonym:string,reactionRate:number,per100:number,
 *   ahead:number,qualified:number,wilsonLower:number,eligible:boolean}>,
 *   totals:{warmingNodes:number, qualifiedNodes:number, users:number,
 *   aheadTrades:number, aheadWallets:number, directionCorrectTrades:number}}}
 */
export function computeTraderReactionStats(input) {
  const options = { ...REACTION_DEFAULTS, ...(input?.options ?? {}) };
  const warmingNodes = Array.isArray(input?.warmingNodes) ? input.warmingNodes : [];
  const trades = (Array.isArray(input?.targetMarketTrades) ? input.targetMarketTrades : [])
    .map((trade) => (isNormalizedTrade(trade) ? trade : normalizeTrade(trade)))
    .filter(Boolean);
  const priceLookup = input?.priceByToken instanceof Map
    ? (tokenId) => input.priceByToken.get(tokenId) ?? []
    : (tokenId) => input?.priceByToken?.[tokenId] ?? [];

  const tradesByToken = new Map();
  for (const trade of trades) {
    if (!tradesByToken.has(trade.tokenId)) tradesByToken.set(trade.tokenId, []);
    tradesByToken.get(trade.tokenId).push(trade);
  }

  const nodes = [];
  let directionCorrectTotal = 0;

  for (let index = 0; index < warmingNodes.length; index += 1) {
    const node = warmingNodes[index] ?? {};
    const nodeTs = toEpochSec(node.nodeTs);
    const yesToken = String(node.yesToken ?? "");
    if (nodeTs === null || !yesToken) continue;
    const tickSize = isFiniteNumber(node.tickSize) && node.tickSize > 0 ? node.tickSize : 0.001;

    const points = priceLookup(yesToken) ?? [];
    const baseline = baselineAt(points, nodeTs - options.preWindowSec);
    const baselinePrice = baseline?.price;
    const baselineValid = isFiniteNumber(baselinePrice)
      && baselinePrice >= options.minBaselineMid
      && baselinePrice <= options.maxBaselineMid;
    const reprice = baselineValid
      ? findReprice({
          points,
          nodeTs,
          baselinePrice,
          tickSize,
          minMove: options.minMove,
          tickMultiplier: options.tickMultiplier,
          maxWaitSec: options.maxRepriceWaitSec,
        })
      : null;

    const nodeResult = {
      nodeId: node.nodeId ?? `node_${index}`,
      eventSlug: node.eventSlug ?? null,
      bracket: node.bracket ?? null,
      marketId: node.marketId ?? null,
      nodeTs,
      tempC: isFiniteNumber(node.tempC) ? node.tempC : null,
      tickSize,
      baselineTs: baseline?.ts ?? null,
      baselinePrice: isFiniteNumber(baselinePrice) ? baselinePrice : null,
      baselineValid,
      repriceTs: reprice?.ts ?? null,
      repricePrice: reprice?.price ?? null,
      repriceMove: reprice?.move ?? null,
      repriceDirection: reprice?.direction ?? null,
      qualified: Boolean(reprice),
      preWindowSec: options.preWindowSec,
      postWindowSec: options.postWindowSec,
      windowStart: nodeTs - options.preWindowSec,
      windowEnd: nodeTs + options.postWindowSec,
      directionCorrectTrades: 0,
      aheadTrades: 0,
      aheadWallets: [],
      involvedWallets: [],
      prePositionedWallets: [],
    };

    const tokenTrades = tradesByToken.get(yesToken) ?? [];
    const noTokenStr = String(node.noToken ?? "");
    const noTokenTrades = noTokenStr ? tradesByToken.get(noTokenStr) ?? [] : [];
    const involved = new Map();
    let directionCorrectCount = 0;

    for (const trade of [...tokenTrades, ...noTokenTrades]) {
      if (trade.ts < nodeResult.windowStart || trade.ts > nodeResult.windowEnd) continue;
      const entry = involved.get(trade.wallet) ?? { wallet: trade.wallet, pseudonym: trade.pseudonym };
      if (trade.pseudonym && !entry.pseudonym) entry.pseudonym = trade.pseudonym;
      involved.set(trade.wallet, entry);
      if (!isDirectionCorrect(trade)) continue;
      if (trade.tokenId !== yesToken && trade.tokenId !== noTokenStr) continue;
      directionCorrectCount += 1;
      directionCorrectTotal += 1;
      // "ahead" only exists once a reprice happened; after it the info is public.
      if (!reprice || trade.ts >= reprice.ts) continue;
      nodeResult.aheadWallets.push(trade.wallet);
    }

    // A user who already held the target YES (or was short NO) before the
    // METAR node was already positioned for the warming outcome. Count that as
    // an ahead observation even when there is no fill inside the ±window.
    if (nodeResult.qualified && nodeTs !== null) {
      const netYes = new Map();
      for (const trade of [...tokenTrades, ...noTokenTrades]) {
        if (trade.ts >= nodeTs) continue;
        if (trade.tokenId !== yesToken && trade.tokenId !== noTokenStr) continue;
        const size = Number(trade.size) || 0;
        if (!(size > 0)) continue;
        const side = String(trade.side || "").toUpperCase();
        const sign = trade.tokenId === yesToken
          ? (side === "BUY" ? 1 : side === "SELL" ? -1 : 0)
          : (side === "SELL" ? 1 : side === "BUY" ? -1 : 0);
        if (!sign) continue;
        const entry = involved.get(trade.wallet) ?? { wallet: trade.wallet, pseudonym: trade.pseudonym };
        if (trade.pseudonym && !entry.pseudonym) entry.pseudonym = trade.pseudonym;
        involved.set(trade.wallet, entry);
        netYes.set(trade.wallet, (netYes.get(trade.wallet) ?? 0) + sign * size);
      }
      for (const [wallet, net] of netYes) {
        if (!(net > 0)) continue;
        nodeResult.prePositionedWallets.push(wallet);
        nodeResult.aheadWallets.push(wallet);
      }
    }

    // dedupe per wallet/node: one ahead event even with multiple fills
    nodeResult.aheadWallets = [...new Set(nodeResult.aheadWallets)];
    nodeResult.involvedWallets = [...involved.keys()];
    nodeResult.directionCorrectTrades = directionCorrectCount;
    nodeResult.aheadTrades = nodeResult.aheadWallets.length;
    nodes.push(nodeResult);
  }

  // Aggregate per wallet from node/wallet sets (never per fill).
  const qualifiedByWallet = new Map();
  const aheadByWallet = new Map();
  const pseudonymByWallet = new Map();
  for (const node of nodes) {
    if (!node.qualified) continue;
    for (const wallet of node.involvedWallets) {
      qualifiedByWallet.set(wallet, (qualifiedByWallet.get(wallet) ?? 0) + 1);
    }
    for (const wallet of node.aheadWallets) {
      aheadByWallet.set(wallet, (aheadByWallet.get(wallet) ?? 0) + 1);
    }
  }
  for (const trade of trades) {
    if (!pseudonymByWallet.has(trade.wallet) && trade.pseudonym) {
      pseudonymByWallet.set(trade.wallet, trade.pseudonym);
    }
  }
  let aheadTradeTotal = 0;
  for (const count of aheadByWallet.values()) aheadTradeTotal += count;

  const users = [];
  const qualifiedNodeCount = nodes.filter((node) => node.qualified).length;
  for (const [wallet, involved] of qualifiedByWallet) {
    if (involved <= 0) continue;
    const ahead = Math.min(aheadByWallet.get(wallet) ?? 0, qualifiedNodeCount);
    // Recommended formula: denominator is ALL qualified warming nodes, not
    // only the nodes in which this wallet happened to trade. The latter
    // inflates 1/1 or 2/2 users into misleading 100% rates.
    const reactionRate = qualifiedNodeCount > 0 ? ahead / qualifiedNodeCount : 0;
    const lower = wilsonLowerBound(ahead, qualifiedNodeCount, options.wilsonZ);
    users.push({
      wallet,
      pseudonym: pseudonymByWallet.get(wallet) ?? "",
      reactionRate: Number(reactionRate.toFixed(6)),
      per100: Number((reactionRate * 100).toFixed(3)),
      ahead,
      qualified: qualifiedNodeCount,
      involved,
      wilsonLower: Number(lower.toFixed(6)),
      eligible: qualifiedNodeCount >= options.eligibleMinQualified && lower > options.eligibleMinWilson,
    });
  }
  users.sort((a, b) => (
    b.wilsonLower - a.wilsonLower
    || b.qualified - a.qualified
    || b.ahead - a.ahead
    || a.wallet.localeCompare(b.wallet)
  ));

  return {
    qualifiedWarmingNodes: nodes.filter((node) => node.qualified).length,
    nodes,
    users,
    totals: {
      warmingNodes: nodes.length,
      qualifiedNodes: nodes.filter((node) => node.qualified).length,
      users: users.length,
      aheadTrades: aheadTradeTotal,
      aheadWallets: aheadByWallet.size,
      directionCorrectTrades: directionCorrectTotal,
    },
  };
}

export default {
  REACTION_DEFAULTS,
  parseBracketTitle,
  bracketForTemp,
  cToF,
  parseMetarReports,
  filterLocalDay,
  parseResolutionSource,
  findWarmingNodes,
  baselineAt,
  findReprice,
  normalizeTrade,
  isNormalizedTrade,
  isDirectionCorrect,
  wilsonLowerBound,
  computeTraderReactionStats,
};
