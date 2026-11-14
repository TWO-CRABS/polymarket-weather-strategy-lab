/**
 * shared/contract.js — Single source of truth for the whole system.
 *
 * This module is dependency-free, side-effect-free and imports nothing.
 * It is used by:
 *   - the Node backend (server/**) for strategy validation + fee accounting
 *   - the browser frontend (web/**) for the same validation, defaults, presets
 *   - tests (tests/**) as the reference implementation of the fee model
 *
 * IMPORTANT: do not change field names or semantics without updating
 * docs/07-api-contract.md and notifying both backend and frontend owners.
 *
 * Simulation only. Nothing here places real orders or handles keys/funds.
 */

export const CONTRACT_VERSION = "1.0.0";
export const STRATEGY_VERSION = 1;

/** Polymarket fee model for weather markets (verified from official docs/API). */
export const FEES = Object.freeze({
  model: "weather_taker",
  /** feeType returned by Gamma for temperature markets */
  feeType: "weather_fees",
  /** taker fee rate for the Weather category */
  takerFeeRate: 0.05,
  /** maker fee rate for the Weather category */
  makerFeeRate: 0,
  /** share of fees redistributed to market makers */
  makerRebateRate: 0.25,
  /** fees are rounded to 5 decimal places */
  feeDecimals: 5,
  /** formula exponent (fee = shares * rate * p * (1-p)) */
  exponent: 1,
  takerOnly: true,
  /** smallest non-zero fee, in USDC */
  minFeeUsd: 0.00001,
});

/**
 * Official order constraints:
 * - MARKET orders are amount-denominated on the BUY side: minimum **$1 notional**,
 *   NO share minimum (Polymarket UI: "盘口买入需高于 1 美元" / "market buy must be over $1").
 * - MARKET SELL orders are share-denominated but have **NO 5-share minimum**:
 *   official UI allows selling a 1.1-share position against the best bid.
 * - LIMIT orders require the CLOB `min_order_size`, normally **5 shares**;
 *   the simulator only places market (taker/FAK) orders, so it does not enforce
 *   this limit-order share floor.
 */
export const ORDER_RULES = Object.freeze({
  /** Market BUY: minimum notional in USD (no share minimum). */
  marketBuyMinUsd: 1,
  /** Limit orders: CLOB min_order_size in shares (not simulated here). */
  limitMinShares: 5,
});

/**
 * Official taker fee in USDC for a weather-market fill.
 * Official formula: fee = C x feeRate x p x (1 - p), rounded to 5 decimals.
 * @param {number} shares number of shares (contracts) filled
 * @param {number} price execution price in USDC per share (0..1)
 * @param {number} [rate=FEES.takerFeeRate]
 * @returns {number} fee in USDC
 */
export function calcTakerFee(shares, price, rate = FEES.takerFeeRate) {
  if (!Number.isFinite(shares) || !Number.isFinite(price) || shares <= 0) return 0;
  const p = Math.min(1, Math.max(0, price));
  const raw = shares * rate * p * (1 - p);
  return roundTo(raw, FEES.feeDecimals);
}

/** Round half-up to `decimals` places, avoiding float dust (0.1+0.2 style). */
export function roundTo(value, decimals) {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** cents (0-100) -> probability (0-1) */
export const centsToProb = (cents) => roundTo(cents / 100, 6);
/** probability (0-1) -> cents (0-100) */
export const probToCents = (prob) => roundTo(prob * 100, 2);

/* ------------------------------------------------------------------------- */
/* Strategy configuration                                                    */
/* ------------------------------------------------------------------------- */

export const RUN_MODES = Object.freeze(["live", "replay"]);
export const PRICE_FIELDS = Object.freeze(["mid", "last", "best_bid", "best_ask"]);
export const DIRECTIONS = Object.freeze(["up", "down", "both"]);
export const SIZING_MODES = Object.freeze(["fixed_stake", "pct_equity"]);
export const FILL_MODELS = Object.freeze(["book_walk"]);
export const OUTCOMES = Object.freeze(["YES", "NO"]);
export const TRADE_SIDES = Object.freeze(["BUY", "SELL"]);
export const RUN_STATUSES = Object.freeze([
  "created", "starting", "running", "paused", "stopping", "stopped", "ended", "error",
]);
export const EXIT_REASONS = Object.freeze([
  "take_profit", "stop_loss", "max_hold", "opposite_signal", "hold_to_resolution",
  "resolution", "manual", "risk_kill_switch", "metar_release_rotate",
]);
export const REJECT_REASONS = Object.freeze([
  "no_liquidity", "spread_too_wide", "liquidity_too_low", "below_min_order", "insufficient_cash",
  "max_positions", "max_positions_per_market", "market_not_accepting_orders",
  "stale_market", "risk_blocked", "unknown",
]);

/** Hard limits used by both server validation and frontend sliders. */
export const LIMITS = Object.freeze({
  universe: {
    minPrice: [0.0001, 0.5],
    maxPrice: [0.5, 0.9999],
    minLiquidityUsd: [0, 1_000_000],
    maxSpread: [0.001, 0.2],
    minTimeToResolutionSec: [300, 604_800],
    maxTimeToResolutionSec: [3600, 1_209_600],
  },
  signal: {
    windowSec: [10, 3600],
    moveThresholdPct: [1, 500],
    minAbsMove: [0, 0.5],
    confirmationTicks: [1, 30],
    cooldownSec: [0, 86_400],
    maxSignalsPerMarket: [1, 100],
    metarReleaseWindowSec: [10, 600],
    metarReleaseMinProbabilityPct: [1, 99],
    copyTraderFallbackDelaySec: [0, 300],
    copyTraderMinReactionRatePct: [0, 100],
    copyTraderSubstituteCount: [1, 10],
  },
  execution: {
    sizingValue: [1, 100_000],
    maxPositionUsd: [1, 100_000],
    maxPositions: [1, 10_000],
    maxPositionsPerMarket: [1, 10],
    slippageBufferBps: [0, 1000],
    fallbackMinTopGapPct: [0, 100],
  },
  exit: {
    takeProfitPct: [1, 1000],
    stopLossPct: [1, 1000],
    maxHoldSec: [10, 604_800],
  },
  risk: {
    bankrollUsd: [10, 10_000_000],
    maxDrawdownPct: [1, 100],
    dailyLossLimitUsd: [0, 10_000_000],
  },
  fees: {
    takerFeeRate: [0, 0.2],
  },
  sim: {
    tickIntervalMs: [250, 60_000],
    replayLookbackMin: [5, 1440],
    speed: [1, 100],
  },
});

/** Canonical default strategy (balanced-ish baseline, 需求 example disabled). */
export const DEFAULT_STRATEGY = Object.freeze({
  version: STRATEGY_VERSION,
  name: "未命名策略",
  description: "",
  universe: {
    cities: [],
    minPrice: 0.02,
    maxPrice: 0.98,
    minLiquidityUsd: 500,
    maxSpread: 0.03,
    minTimeToResolutionSec: 900,
    maxTimeToResolutionSec: 129600,
    onlyAcceptingOrders: true,
  },
  signal: {
    priceField: "mid",
    windowSec: 60,
    moveThresholdPct: 20,
    minAbsMove: 0.01,
    direction: "both",
    entryMode: "momentum",
    /** price_band 模式：以同一事件最高概率括号为界，只买其左侧（更低温度）的合格括号。 */
    onlyLeftSideOfMaxProbability: false,
    entryPriceByOutcome: {
      YES: { min: null, max: null },
      NO: { min: null, max: null },
    },
    confirmationTicks: 1,
    cooldownSec: 300,
    maxSignalsPerMarket: 5,
    requireSpreadOk: true,
    /** 动量成立但价格带/点差不允许入场时，记录不可交易的观察信号 */
    recordObservation: true,
    /** METAR 温度发布窗口信号 */
    metarReleaseEnabled: true,
    metarReleaseWindowSec: 300,
    metarReleaseMinProbabilityPct: 50,
    metarReleaseRequireRising: true,
    /** 跟买/跟卖某个公开钱包；替补使用 reaction leaderboard 前三 */
    copyTraderEnabled: false,
    copyTraderMode: "release",
    copyTraderUser: "",
    copyTraderFallbackDelaySec: 30,
    copyTraderMinReactionRatePct: 90,
    copyTraderSubstituteCount: 3,
    mirrorTakerOnly: true,
  },
  execution: {
    orderType: "market",
    sizingMode: "fixed_stake",
    sizingValue: 25,
    maxPositionUsd: 50,
    maxPositions: 5,
    maxPositionsPerMarket: 1,
    fillModel: "book_walk",
    slippageBufferBps: 0,
    /** 周期性兜底：每个观察窗口到期时若空仓，买入概率第 1 高选项的 YES + 第 3 高选项的 NO。 */
    fallbackBuyEachWindow: false,
    /** 兜底买 YES 的最低概率差（百分点）：rank1 - rank2 >= 该值才买。 */
    fallbackMinTopGapPct: 40,
    /** METAR 发布节点前后 5 分钟默认禁止兜底建仓。 */
    fallbackAllowInMetarWindow: false,
  },
  exit: {
    takeProfitPct: 50,
    targetPriceByOutcome: { YES: null, NO: null },
    stopLossPct: 30,
    maxHoldSec: 3600,
    holdToResolution: false,
    exitOnOppositeSignal: false,
  },
  risk: {
    bankrollUsd: 1000,
    maxDrawdownPct: 20,
    dailyLossLimitUsd: 100,
    killSwitch: true,
  },
  fees: {
    model: FEES.model,
    takerFeeRate: FEES.takerFeeRate,
  },
  sim: {
    mode: "live",
    tickIntervalMs: 1000,
    replayLookbackMin: 60,
    speed: 10,
  },
});

/** Deep clone helper (structuredClone is available in Node 17+ and modern browsers). */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Merge `patch` into `base` recursively; arrays and primitives are replaced. */
export function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return clone(patch ?? base);
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out = clone(base);
    for (const [k, v] of Object.entries(patch)) {
      out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : clone(v);
    }
    return out;
  }
  return clone(patch ?? base);
}

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Normalize a (possibly partial) strategy config: fill defaults, coerce
 * numeric strings, drop unknown top-level keys. Never throws.
 * @returns {object} normalized config (deep cloned)
 */
export function normalizeStrategy(input = {}) {
  const src = isPlainObject(input) ? input : {};
  const merged = deepMerge(DEFAULT_STRATEGY, src);

  // Defensive: a caller may send null/primitive group values. Never throw.
  const groups = ["universe", "signal", "execution", "exit", "risk", "fees", "sim"];
  for (const group of groups) {
    if (!isPlainObject(merged[group])) merged[group] = clone(DEFAULT_STRATEGY[group]);
  }

  // version is validated (only 1 accepted) rather than silently coerced.
  const versionRaw = src.version;
  merged.version =
    versionRaw === undefined || versionRaw === null
      ? STRATEGY_VERSION
      : Number.isFinite(Number(versionRaw))
        ? Number(versionRaw)
        : versionRaw;

  merged.name = String(merged.name || "未命名策略").slice(0, 120);
  merged.description = String(merged.description || "").slice(0, 2000);

  const num = (v, fallback) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };

  for (const group of groups) {
    for (const [key, value] of Object.entries(merged[group])) {
      // 删除已废弃/未知字段（例如旧版 maxMarkets / selectionMode），保证配置只含当前 schema。
      if (!(key in DEFAULT_STRATEGY[group])) {
        delete merged[group][key];
        continue;
      }
      if (Array.isArray(value)) continue;
      if (typeof DEFAULT_STRATEGY[group][key] === "number") {
        merged[group][key] = num(value, DEFAULT_STRATEGY[group][key]);
      }
    }
  }

  merged.universe.cities = Array.isArray(merged.universe.cities)
    ? merged.universe.cities.map((c) => String(c).trim()).filter(Boolean)
    : [];

  // 布尔开关：兼容从 JSON 表单传入的 "true"/"false"
  const coerceBool = (value, fallback = false) => {
    if (typeof value === "boolean") return value;
    if (value === "false" || value === 0 || value === "0") return false;
    if (value === "true" || value === 1 || value === "1") return true;
    return value === undefined || value === null ? fallback : Boolean(value);
  };
  if (typeof merged.execution.fallbackBuyEachWindow !== "boolean") {
    merged.execution.fallbackBuyEachWindow = coerceBool(merged.execution.fallbackBuyEachWindow);
  }
  merged.execution.fallbackAllowInMetarWindow = coerceBool(merged.execution.fallbackAllowInMetarWindow);
  if (typeof merged.signal.recordObservation !== "boolean") {
    merged.signal.recordObservation = coerceBool(merged.signal.recordObservation, true);
  }
  merged.signal.metarReleaseEnabled = coerceBool(merged.signal.metarReleaseEnabled, true);
  merged.signal.metarReleaseRequireRising = coerceBool(merged.signal.metarReleaseRequireRising, true);
  merged.signal.copyTraderEnabled = coerceBool(merged.signal.copyTraderEnabled, false);
  merged.signal.copyTraderMode = String(merged.signal.copyTraderMode || "release").trim().toLowerCase();
  merged.signal.entryMode = String(merged.signal.entryMode || "momentum").trim().toLowerCase();
  merged.signal.onlyLeftSideOfMaxProbability = coerceBool(merged.signal.onlyLeftSideOfMaxProbability, false);
  merged.signal.mirrorTakerOnly = coerceBool(merged.signal.mirrorTakerOnly, true);
  merged.signal.copyTraderUser = String(merged.signal.copyTraderUser || "").trim().toLowerCase();
  const normalizeOutcomeBands = (value) => {
    const source = value && typeof value === "object" ? value : {};
    return {
      YES: {
        min: num(source.YES?.min, null),
        max: num(source.YES?.max, null),
      },
      NO: {
        min: num(source.NO?.min, null),
        max: num(source.NO?.max, null),
      },
    };
  };
  merged.signal.entryPriceByOutcome = normalizeOutcomeBands(merged.signal.entryPriceByOutcome);
  const targetSource = merged.exit.targetPriceByOutcome && typeof merged.exit.targetPriceByOutcome === "object"
    ? merged.exit.targetPriceByOutcome
    : {};
  merged.exit.targetPriceByOutcome = {
    YES: num(targetSource.YES, null),
    NO: num(targetSource.NO, null),
  };
  if (merged.signal.copyTraderUser && !/^0x[a-f0-9]{40}$/.test(merged.signal.copyTraderUser)) {
    merged.signal.copyTraderUser = "";
  }

  // sim.mode is validated by validateStrategy (invalid values must be rejected,
  // see docs/03 §1.1), so it is deliberately not coerced here.
  return merged;
}

/**
 * Validate a normalized strategy config.
 * @param {object} input raw or partial strategy config
 * @returns {{valid:boolean, errors:string[], warnings:string[], normalized:object}}
 */
export function validateStrategy(input = {}) {
  const cfg = normalizeStrategy(input);
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  const inRange = (value, [min, max], label) => {
    if (!Number.isFinite(value) || value < min || value > max) {
      err(`${label} 必须在 ${min} 到 ${max} 之间，当前为 ${value}`);
      return false;
    }
    return true;
  };

  const u = cfg.universe;
  const s = cfg.signal;
  const e = cfg.execution;
  const x = cfg.exit;
  const r = cfg.risk;
  const sim = cfg.sim;

  if (cfg.version !== STRATEGY_VERSION) {
    err(`version 仅支持 ${STRATEGY_VERSION}，当前为 ${String(cfg.version)}`);
  }
  if (!RUN_MODES.includes(sim.mode)) err(`sim.mode 非法: ${sim.mode}`);
  if (!PRICE_FIELDS.includes(s.priceField)) err(`signal.priceField 非法: ${s.priceField}`);
  if (!DIRECTIONS.includes(s.direction)) err(`signal.direction 非法: ${s.direction}`);
  if (!SIZING_MODES.includes(e.sizingMode)) err(`execution.sizingMode 非法: ${e.sizingMode}`);

  inRange(u.minPrice, LIMITS.universe.minPrice, "universe.minPrice");
  inRange(u.maxPrice, LIMITS.universe.maxPrice, "universe.maxPrice");
  inRange(u.minLiquidityUsd, LIMITS.universe.minLiquidityUsd, "universe.minLiquidityUsd");
  inRange(u.maxSpread, LIMITS.universe.maxSpread, "universe.maxSpread");
  inRange(u.minTimeToResolutionSec, LIMITS.universe.minTimeToResolutionSec, "universe.minTimeToResolutionSec");
  inRange(u.maxTimeToResolutionSec, LIMITS.universe.maxTimeToResolutionSec, "universe.maxTimeToResolutionSec");
  if (u.minPrice >= u.maxPrice) err("universe.minPrice 必须小于 universe.maxPrice");
  if (u.minTimeToResolutionSec >= u.maxTimeToResolutionSec) {
    err("universe.minTimeToResolutionSec 必须小于 maxTimeToResolutionSec");
  }

  inRange(s.windowSec, LIMITS.signal.windowSec, "signal.windowSec");
  inRange(s.moveThresholdPct, LIMITS.signal.moveThresholdPct, "signal.moveThresholdPct");
  inRange(s.minAbsMove, LIMITS.signal.minAbsMove, "signal.minAbsMove");
  inRange(s.confirmationTicks, LIMITS.signal.confirmationTicks, "signal.confirmationTicks");
  inRange(s.cooldownSec, LIMITS.signal.cooldownSec, "signal.cooldownSec");
  inRange(s.maxSignalsPerMarket, LIMITS.signal.maxSignalsPerMarket, "signal.maxSignalsPerMarket");
  inRange(s.metarReleaseWindowSec, LIMITS.signal.metarReleaseWindowSec, "signal.metarReleaseWindowSec");
  inRange(s.metarReleaseMinProbabilityPct, LIMITS.signal.metarReleaseMinProbabilityPct, "signal.metarReleaseMinProbabilityPct");
  inRange(s.copyTraderFallbackDelaySec, LIMITS.signal.copyTraderFallbackDelaySec, "signal.copyTraderFallbackDelaySec");
  inRange(s.copyTraderMinReactionRatePct, LIMITS.signal.copyTraderMinReactionRatePct, "signal.copyTraderMinReactionRatePct");
  inRange(s.copyTraderSubstituteCount, LIMITS.signal.copyTraderSubstituteCount, "signal.copyTraderSubstituteCount");
  if (s.copyTraderEnabled && s.copyTraderUser && !/^0x[a-fA-F0-9]{40}$/.test(s.copyTraderUser)) {
    err(`signal.copyTraderUser 必须为空或 0x 开头的 40 字节钱包地址，当前为 ${s.copyTraderUser}`);
  }
  if (!["release", "mirror"].includes(s.copyTraderMode)) {
    err(`signal.copyTraderMode 必须是 release 或 mirror，当前为 ${s.copyTraderMode}`);
  }
  if (!["momentum", "price_band", "node_temp_no"].includes(s.entryMode)) {
    err(`signal.entryMode 必须是 momentum、price_band 或 node_temp_no，当前为 ${s.entryMode}`);
  }
  for (const outcome of ["YES", "NO"]) {
    const band = s.entryPriceByOutcome?.[outcome];
    if (band?.min !== null && band?.min !== undefined) {
      if (!(Number(band.min) >= 0 && Number(band.min) <= 1)) err(`signal.entryPriceByOutcome.${outcome}.min 必须在 0–1 之间`);
    }
    if (band?.max !== null && band?.max !== undefined) {
      if (!(Number(band.max) >= 0 && Number(band.max) <= 1)) err(`signal.entryPriceByOutcome.${outcome}.max 必须在 0–1 之间`);
    }
    if (band?.min !== null && band?.max !== null && Number(band.min) > Number(band.max)) {
      err(`signal.entryPriceByOutcome.${outcome}.min 不能大于 max`);
    }
    const target = x.targetPriceByOutcome?.[outcome];
    if (target !== null && target !== undefined && !(Number(target) > 0 && Number(target) <= 1)) {
      err(`exit.targetPriceByOutcome.${outcome} 必须在 0–1 之间`);
    }
  }

  inRange(e.sizingValue, LIMITS.execution.sizingValue, "execution.sizingValue");
  inRange(e.maxPositionUsd, LIMITS.execution.maxPositionUsd, "execution.maxPositionUsd");
  inRange(e.maxPositions, LIMITS.execution.maxPositions, "execution.maxPositions");
  inRange(e.maxPositionsPerMarket, LIMITS.execution.maxPositionsPerMarket, "execution.maxPositionsPerMarket");
  inRange(e.slippageBufferBps, LIMITS.execution.slippageBufferBps, "execution.slippageBufferBps");

  inRange(x.takeProfitPct, LIMITS.exit.takeProfitPct, "exit.takeProfitPct");
  inRange(x.stopLossPct, LIMITS.exit.stopLossPct, "exit.stopLossPct");
  inRange(x.maxHoldSec, LIMITS.exit.maxHoldSec, "exit.maxHoldSec");

  inRange(r.bankrollUsd, LIMITS.risk.bankrollUsd, "risk.bankrollUsd");
  inRange(r.maxDrawdownPct, LIMITS.risk.maxDrawdownPct, "risk.maxDrawdownPct");
  inRange(r.dailyLossLimitUsd, LIMITS.risk.dailyLossLimitUsd, "risk.dailyLossLimitUsd");

  inRange(cfg.fees.takerFeeRate, LIMITS.fees.takerFeeRate, "fees.takerFeeRate");
  inRange(sim.tickIntervalMs, LIMITS.sim.tickIntervalMs, "sim.tickIntervalMs");
  inRange(sim.replayLookbackMin, LIMITS.sim.replayLookbackMin, "sim.replayLookbackMin");
  inRange(sim.speed, LIMITS.sim.speed, "sim.speed");

  // Degenerate-strategy warnings: the requirement's naive +/-20%/1min rule is
  // dominated by spread + fees on cheap brackets. Warn, never hard-block.
  if (s.moveThresholdPct <= 20 && s.minAbsMove < 0.01) {
    warn("百分比阈值较低且未设置最小绝对变动：在 0.001-0.01 的低价区间，±20% 仅 0.0002-0.002，容易被点差和手续费吞噬");
  }
  if (u.minPrice < 0.01) warn("universe.minPrice 低于 0.01：极端概率区间流动性差、点差大，建议 >= 0.02");
  if (s.priceField === "last") warn("使用 last 作为信号价可能长时间不更新，建议 mid 或 best_ask");
  if (u.maxSpread > 0.05) warn("允许的点差过宽（> 5¢），市价单滑点/成本会非常高");
  if (x.stopLossPct > 70) warn("止损幅度过大（> 70%），单笔风险可能超过仓位");
  if (e.sizingMode === "pct_equity" && e.sizingValue > 50) warn("单笔使用超过 50% 权益，回撤风险极高");
  if (e.sizingMode === "fixed_stake" && e.sizingValue > r.bankrollUsd) err("单笔固定金额不能大于初始资金");
  if (r.killSwitch && r.maxDrawdownPct < 5) warn("最大回撤熔断阈值过低（< 5%），策略可能刚开始就被停机");
  if (sim.mode === "replay" && sim.replayLookbackMin < s.windowSec / 60) {
    err("回放窗口必须大于信号窗口，否则无法计算滚动收益");
  }

  return { valid: errors.length === 0, errors, warnings, normalized: cfg };
}

/**
 * Strategy presets (保守 / 均衡 / 激进). Also served by GET /api/meta.
 * Parameter names follow docs/02 and docs/03.
 */
export const STRATEGY_PRESETS = Object.freeze([
  {
    id: "no-price-band",
    label: "NO 89–98 入场 · 99 止盈",
    description: "只监听 NO。目标 NO 卖价在 89–98¢ 时入场，只买同一事件最高概率温度左侧（更低温度）的合格括号，右侧不买；NO 买一价达到 99¢ 时止盈。",
    config: {
      ...clone(DEFAULT_STRATEGY),
      name: "NO 89–98 入场 · 99 止盈",
      universe: {
        ...clone(DEFAULT_STRATEGY.universe),
        minPrice: 0.01,
        maxPrice: 0.99,
        minLiquidityUsd: 0,
        maxSpread: 0.2,
      },
      signal: {
        ...clone(DEFAULT_STRATEGY.signal),
        direction: "down",
        entryMode: "price_band",
        onlyLeftSideOfMaxProbability: true,
        entryPriceByOutcome: {
          YES: { min: null, max: null },
          NO: { min: 0.89, max: 0.98 },
        },
        windowSec: 60,
        moveThresholdPct: 20,
        minAbsMove: 0.01,
        confirmationTicks: 1,
        cooldownSec: 300,
        maxSignalsPerMarket: 100,
        metarReleaseEnabled: false,
        copyTraderEnabled: false,
      },
      execution: {
        ...clone(DEFAULT_STRATEGY.execution),
        sizingMode: "fixed_stake",
        sizingValue: 25,
        maxPositionUsd: 50,
        maxPositions: 100,
        maxPositionsPerMarket: 1,
        fallbackBuyEachWindow: false,
      },
      exit: {
        ...clone(DEFAULT_STRATEGY.exit),
        takeProfitPct: 100,
        stopLossPct: 100,
        maxHoldSec: 86_400,
        holdToResolution: false,
        targetPriceByOutcome: { YES: null, NO: 0.99 },
      },
      risk: {
        ...clone(DEFAULT_STRATEGY.risk),
        bankrollUsd: 1000,
        maxDrawdownPct: 100,
        dailyLossLimitUsd: 0,
        killSwitch: false,
      },
      sim: { ...clone(DEFAULT_STRATEGY.sim), tickIntervalMs: 1000 },
    },
  },
  {
    id: "node-temp-no",
    label: "节点最新温度买NO · 100¢以下买 / 100¢卖或结算",
    description: "在 METAR 发布节点后 7 分钟内轮询最新温度；按四舍五入后的温度，从高到低买入所有低于该温度的 NO 市场，只要卖价低于 100¢ 就买；到 100¢ 卖出，否则持有到结算。",
    config: {
      ...clone(DEFAULT_STRATEGY),
      name: "节点最新温度买NO",
      universe: {
        ...clone(DEFAULT_STRATEGY.universe),
        minPrice: 0.001,
        maxPrice: 0.999,
        minLiquidityUsd: 0,
        maxSpread: 0.2,
      },
      signal: {
        ...clone(DEFAULT_STRATEGY.signal),
        direction: "down",
        entryMode: "node_temp_no",
        entryPriceByOutcome: {
          YES: { min: null, max: null },
          NO: { min: null, max: 0.999 },
        },
        maxSignalsPerMarket: 100,
        metarReleaseEnabled: false,
        copyTraderEnabled: false,
      },
      execution: {
        ...clone(DEFAULT_STRATEGY.execution),
        sizingMode: "fixed_stake",
        sizingValue: 25,
        maxPositionUsd: 50,
        maxPositions: 500,
        maxPositionsPerMarket: 1,
        fallbackBuyEachWindow: false,
      },
      exit: {
        ...clone(DEFAULT_STRATEGY.exit),
        takeProfitPct: 1000,
        stopLossPct: 100,
        maxHoldSec: 604_800,
        holdToResolution: false,
        targetPriceByOutcome: { YES: null, NO: 1 },
      },
      risk: {
        ...clone(DEFAULT_STRATEGY.risk),
        bankrollUsd: 1000,
        maxDrawdownPct: 100,
        dailyLossLimitUsd: 0,
        killSwitch: false,
      },
      sim: { ...clone(DEFAULT_STRATEGY.sim), tickIntervalMs: 1000 },
    },
  },
]);

/* ------------------------------------------------------------------------- */
/* Entity shapes (JSDoc typedefs for editors; runtime objects are plain JS)   */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} MarketSnapshot
 * @property {string} id                Gamma market id
 * @property {string} conditionId
 * @property {string} eventId
 * @property {string} slug
 * @property {string} question
 * @property {string} city
 * @property {string} station           ICAO station code when known
 * @property {string} bracket           e.g. "13°C" / "12°C or below"
 * @property {{yesTokenId:string,noTokenId:string}} tokens
 * @property {{YES:Quote,NO:Quote}} quotes
 * @property {number} spread            YES best ask - best bid, USDC
 * @property {number} impliedProbability YES mid, 0..1
 * @property {number} liquidityUsd
 * @property {number} volume24hUsd
 * @property {number} tickSize
 * @property {number} minOrderShares
 * @property {string} endDate           ISO timestamp
 * @property {string} eventStartTime    ISO timestamp
 * @property {boolean} acceptingOrders
 * @property {boolean} closed
 * @property {boolean} negRisk
 * @property {{rate:number,exponent:number,takerOnly:boolean}|null} feeSchedule
 * @property {number} updatedAt         epoch ms
 * @property {boolean} stale
 * @typedef {{bid:number,ask:number,mid:number,last:number|null}} Quote
 */

/**
 * @typedef {Object} Signal
 * @property {string} id
 * @property {number} ts
 * @property {string} runId
 * @property {string} marketId
 * @property {string} city
 * @property {string} bracket
 * @property {"up"|"down"} direction
 * @property {"YES"|"NO"} outcome
 * @property {string} tokenId
 * @property {number} fromPrice
 * @property {number} toPrice
 * @property {number} changePct
 * @property {number} absChange
 * @property {number} windowSec
 * @property {string} priceField
 * @property {string} reason
 */

/**
 * @typedef {Object} Trade
 * @property {string} id
 * @property {number} ts
 * @property {string} runId
 * @property {string} marketId
 * @property {string|null} [city] market display metadata for old/stopped runs
 * @property {string|null} [bracket]
 * @property {string|null} [endDate]
 * @property {string|null} [question]
 * @property {string|null} [eventSlug]
 * @property {string} tokenId
 * @property {"YES"|"NO"} outcome
 * @property {"BUY"|"SELL"} side
 * @property {number} shares
 * @property {number} price            VWAP fill price
 * @property {number} notional         shares * price
 * @property {number} fee              official taker fee in USDC
 * @property {number} slippageCost     VWAP vs reference price, USDC
 * @property {number} totalCost        notional + fee (BUY) or notional - fee (SELL)
 * @property {number} cashDelta        negative for BUY, positive for SELL
 * @property {number} realizedPnl      realized P&L on SELL, 0 otherwise
 * @property {number} [referenceMid]   optional: mid at fill time, for spread-cost attribution
 * @property {number} [spreadCost]     optional: shares * |referenceQuote - referenceMid| (USDC)
 * @property {string|null} signalId
 * @property {string} reason           one of EXIT_REASONS, "signal" or "fallback_entry"
 * @property {"filled"|"partial"|"rejected"} status
 * @property {string|null} rejectReason
 * @property {Array<{price:number,size:number}>} bookLevels consumed
 * @property {Object|null} [marketSnapshot] quote snapshot at rejection time
 * @property {string|null} [rejectDetail] human-readable threshold/current-value explanation
 */

/**
 * @typedef {Object} Position
 * @property {string} marketId
 * @property {string} tokenId
 * @property {"YES"|"NO"} outcome
 * @property {string} city
 * @property {string} bracket
 * @property {string} [endDate]
 * @property {number} shares
 * @property {number} avgPrice        costBasis / shares (fees included)
 * @property {number} costBasis       notional + entry fees
 * @property {number} midPrice
 * @property {number} marketValue     shares * midPrice
 * @property {number} unrealizedPnl   marketValue - costBasis
 * @property {number} entryTs
 * @property {number} entryFee
 * @property {number} estExitFee      shares * rate * mid * (1-mid)
 * @property {number} impliedProbability
 */

/**
 * @typedef {Object} EquityPoint
 * @property {number} ts
 * @property {number} equity
 * @property {number} cash
 * @property {number} positionsValue
 * @property {number} realizedPnl
 * @property {number} unrealizedPnl
 * @property {number} drawdownPct
 */

/**
 * @typedef {Object} Metrics
 * @property {number} totalReturnPct
 * @property {number} realizedPnl
 * @property {number} unrealizedPnl
 * @property {number} feesPaid
 * @property {number} trades
 * @property {number} closedTrades
 * @property {number} winRate
 * @property {number} avgWin
 * @property {number} avgLoss
 * @property {number} profitFactor
 * @property {number} expectancy
 * @property {number} sharpe
 * @property {number} maxDrawdownPct
 * @property {number} exposureUsd
 * @property {number} turnoverUsd
 * @property {number} feeDragPct
 */

/**
 * @typedef {Object} RunSummary
 * @property {string} id
 * @property {string} strategyId
 * @property {string} strategyName
 * @property {"live"|"replay"} mode
 * @property {string} status
 * @property {number} startedAt
 * @property {number|null} endedAt
 * @property {number} initialCapital
 * @property {number} equity
 * @property {number} cash
 * @property {number} positionsValue
 * @property {Metrics} metrics
 * @property {number} signalsCount
 * @property {number} marketsTracked
 * @property {"connecting"|"live"|"degraded"|"offline"} feedStatus
 */

/* ------------------------------------------------------------------------- */
/* SSE event names (server -> browser)                                       */
/* ------------------------------------------------------------------------- */

export const SSE_EVENTS = Object.freeze([
  "hello",        // { serverTime, contractVersion, presets? }
  "meta",         // { cities, feeModel, presets, marketCount }
  "market",       // { market: MarketSnapshot }
  "markets",      // { markets: MarketSnapshot[] } (batch on start)
  "signal",       // { signal: Signal }
  "trade",        // { trade: Trade, position?: Position }
  "positions",    // { positions: Position[], positionsValue }
  "equity",       // { point: EquityPoint, metrics: Metrics }
  "metrics",      // { metrics: Metrics }
  "run",          // { run: RunSummary }
  "feed",         // { status, lastUpdate, marketsTracked, latencyMs }
  "log",          // { level, message, ts }
  "heartbeat",    // { ts }
]);

/** Exit reason -> Chinese label used by API and UI */
export const EXIT_REASON_LABELS = Object.freeze({
  signal: "信号入场",
  take_profit: "止盈",
  stop_loss: "止损",
  max_hold: "超时",
  opposite_signal: "反向信号",
  hold_to_resolution: "持有到结算",
  resolution: "市场结算",
  manual: "手动平仓",
  risk_kill_switch: "风控熔断",
  fallback_entry: "兜底建仓", // 入场原因：周期空仓兜底（第 1 高 YES / 第 3 高 NO）
  metar_release: "温度发布信号",
  metar_release_rotate: "温度发布轮换卖出",
  copy_trade: "跟单交易",
  mirror_trade: "镜像跟单",
  price_band: "价格带入场",
  node_temp_no: "节点温度买NO",
  rejected: "订单被拒",
});

/** Reject reason -> Chinese label used by API and UI */
export const REJECT_REASON_LABELS = Object.freeze({
  no_liquidity: "盘口无流动性",
  spread_too_wide: "点差过宽",
  liquidity_too_low: "流动性不足",
  below_min_order: "低于最小下单量",
  insufficient_cash: "现金不足",
  max_positions: "达到最大持仓数",
  max_positions_per_market: "达到单市场持仓上限",
  market_not_accepting_orders: "市场暂停接单",
  stale_market: "行情过期",
  risk_blocked: "风控拦截",
  unknown: "未知原因",
});
