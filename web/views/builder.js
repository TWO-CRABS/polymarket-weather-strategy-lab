/**
 * web/views/builder.js — 策略构建视图
 *
 * 参数分组：universe / signal / execution / exit / risk / fees / sim
 * 数据来源：/shared/contract.js（默认值、取值范围、校验函数）
 * 实时校验：POST /api/strategies/validate（debounce 350ms；服务端不可用时回退本地契约校验）
 * 保存策略：POST/PUT /api/strategies
 * 启动运行：POST /api/runs {strategy, mode} → 跳转 #/dashboard?run=<id>
 */

import {
  DEFAULT_STRATEGY,
  STRATEGY_PRESETS,
  FEES,
  LIMITS,
  PRICE_FIELDS,
  DIRECTIONS,
  SIZING_MODES,
  calcTakerFee,
  normalizeStrategy,
  validateStrategy,
} from "/shared/contract.js";
import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";

const PRICE_FIELD_LABELS = {
  mid: "中间价 mid",
  last: "最新成交价 last",
  best_bid: "买一价 best_bid",
  best_ask: "卖一价 best_ask",
};
const DIRECTION_LABELS = { up: "仅上涨", down: "仅下跌", both: "双向" };
const SIZING_LABELS = {
  fixed_stake: "固定名义金额（USD）",
  pct_equity: "按权益百分比（%）",
};
const MODE_LABELS = { live: "实时", replay: "回放" };

const LIM = LIMITS;

/** 分组字段定义：label / 范围来自 shared/contract.js 的 LIMITS。 */
const GROUP_DEFS = [
  {
    key: "universe",
    step: "01",
    title: "市场范围",
    desc: "城市、价格带、流动性、点差与距结算时间过滤；不选城市 = 全部城市。",
    fields: [
      { path: "universe.cities", kind: "cities", label: "城市（多选，不选 = 全部城市）" },
      { path: "universe.maxMarkets", label: "最大市场数", unit: "个", min: LIM.universe.maxMarkets[0], max: LIM.universe.maxMarkets[1], step: 1, help: "按流动性/成交额选取" },
      { path: "universe.minPrice", label: "最低 YES 价格", unit: "USDC 0–1", min: LIM.universe.minPrice[0], max: LIM.universe.minPrice[1], step: 0.001, help: "0.02 = 2¢，过滤极端低价" },
      { path: "universe.maxPrice", label: "最高 YES 价格", unit: "USDC 0–1", min: LIM.universe.maxPrice[0], max: LIM.universe.maxPrice[1], step: 0.001, help: "0.98 = 98¢" },
      { path: "universe.minLiquidityUsd", label: "最小流动性", unit: "USD", min: LIM.universe.minLiquidityUsd[0], max: LIM.universe.minLiquidityUsd[1], step: 100 },
      { path: "universe.maxSpread", label: "最大点差", unit: "USDC", min: LIM.universe.maxSpread[0], max: LIM.universe.maxSpread[1], step: 0.001, help: "0.03 = 3¢；市价单点差成本显著" },
      { path: "universe.minTimeToResolutionSec", label: "最短距结算", unit: "秒", min: LIM.universe.minTimeToResolutionSec[0], max: LIM.universe.minTimeToResolutionSec[1], step: 60, help: "900 = 15 分钟" },
      { path: "universe.maxTimeToResolutionSec", label: "最长距结算", unit: "秒", min: LIM.universe.maxTimeToResolutionSec[0], max: LIM.universe.maxTimeToResolutionSec[1], step: 600, help: "129600 = 36 小时" },
      { path: "universe.onlyAcceptingOrders", kind: "toggle", label: "仅接受可接单市场", help: "关闭后可能纳入暂停接单市场（不建议）" },
    ],
  },
  {
    key: "signal",
    step: "02",
    title: "信号规则",
    desc: "滚动窗口动量：窗口内涨跌幅 ≥ 阈值触发；UP 买入 YES，DOWN 买入 NO。",
    fields: [
      { path: "signal.priceField", kind: "select", label: "参考价格字段", options: PRICE_FIELDS.map((v) => ({ value: v, label: PRICE_FIELD_LABELS[v] || v })) },
      { path: "signal.windowSec", label: "观察窗口", unit: "秒", min: LIM.signal.windowSec[0], max: LIM.signal.windowSec[1], step: 10, slider: true, out: (v) => `${v}s`, help: "需求示例：60 秒" },
      { path: "signal.moveThresholdPct", label: "触发阈值", unit: "%（±）", min: LIM.signal.moveThresholdPct[0], max: LIM.signal.moveThresholdPct[1], step: 1, slider: true, out: (v) => `±${v}%`, help: "需求示例：20（±20%）" },
      { path: "signal.minAbsMove", label: "最小绝对变动", unit: "USDC", min: LIM.signal.minAbsMove[0], max: LIM.signal.minAbsMove[1], step: 0.001, help: "过滤低价噪声；0.01 = 1¢，强烈建议 ≥ 0.01" },
      { path: "signal.direction", kind: "select", label: "信号方向", options: DIRECTIONS.map((v) => ({ value: v, label: DIRECTION_LABELS[v] || v })) },
      { path: "signal.confirmationTicks", label: "确认 Tick 数", unit: "次", min: LIM.signal.confirmationTicks[0], max: LIM.signal.confirmationTicks[1], step: 1 },
      { path: "signal.cooldownSec", label: "同市场冷却", unit: "秒", min: LIM.signal.cooldownSec[0], max: LIM.signal.cooldownSec[1], step: 10 },
      { path: "signal.maxSignalsPerMarket", label: "单市场最大信号数", unit: "次", min: LIM.signal.maxSignalsPerMarket[0], max: LIM.signal.maxSignalsPerMarket[1], step: 1 },
      { path: "signal.requireSpreadOk", kind: "toggle", label: "点差超限时跳过信号", help: "真实成交成本的一部分，建议保持开启" },
    ],
  },
  {
    key: "execution",
    step: "03",
    title: "执行与仓位",
    desc: "市价单按真实盘口逐档吃单（VWAP），计入滑点与官方 taker 手续费。",
    fields: [
      { path: "execution.orderType", kind: "readonly", label: "订单类型", valueLabel: "市价单 · IOC（模拟撮合）" },
      { path: "execution.sizingMode", kind: "select", label: "仓位模式", options: SIZING_MODES.map((v) => ({ value: v, label: SIZING_LABELS[v] || v })) },
      { path: "execution.sizingValue", label: "单笔仓位", unit: "USD / %", min: LIM.execution.sizingValue[0], max: LIM.execution.sizingValue[1], step: 1, slider: true, out: (v) => `${v}`, help: "fixed_stake 为订单名义额（USD）；pct_equity 为权益百分比；手续费另从现金扣除" },
      { path: "execution.maxPositionUsd", label: "单笔名义上限", unit: "USD", min: LIM.execution.maxPositionUsd[0], max: LIM.execution.maxPositionUsd[1], step: 1 },
      { path: "execution.maxPositions", label: "最大并发持仓", unit: "个", min: LIM.execution.maxPositions[0], max: LIM.execution.maxPositions[1], step: 1 },
      { path: "execution.maxPositionsPerMarket", label: "单市场持仓上限", unit: "个", min: LIM.execution.maxPositionsPerMarket[0], max: LIM.execution.maxPositionsPerMarket[1], step: 1 },
      { path: "execution.fillModel", kind: "readonly", label: "撮合模型", valueLabel: "逐档吃单 book_walk" },
      { path: "execution.slippageBufferBps", label: "滑点保护", unit: "bps", min: LIM.execution.slippageBufferBps[0], max: LIM.execution.slippageBufferBps[1], step: 1, help: "允许超出买一价的最大比例" },
    ],
  },
  {
    key: "exit",
    step: "04",
    title: "退出规则",
    desc: "止盈 / 止损 / 超时 / 反向信号 / 持有到结算，按优先级依次判定。",
    fields: [
      { path: "exit.takeProfitPct", label: "止盈", unit: "%（相对入场价）", min: LIM.exit.takeProfitPct[0], max: LIM.exit.takeProfitPct[1], step: 1, slider: true, out: (v) => `+${v}%` },
      { path: "exit.stopLossPct", label: "止损", unit: "%", min: LIM.exit.stopLossPct[0], max: LIM.exit.stopLossPct[1], step: 1, slider: true, out: (v) => `-${v}%` },
      { path: "exit.maxHoldSec", label: "最长持仓", unit: "秒", min: LIM.exit.maxHoldSec[0], max: LIM.exit.maxHoldSec[1], step: 10, help: "3600 = 1 小时" },
      { path: "exit.holdToResolution", kind: "toggle", label: "持有到市场结算", help: "开启后未触发止盈/止损的仓位持有至结算价兑付" },
      { path: "exit.exitOnOppositeSignal", kind: "toggle", label: "反向信号出现时平仓" },
    ],
  },
  {
    key: "risk",
    step: "05",
    title: "风控",
    desc: "初始资金、回撤熔断与单日亏损上限；熔断触发后停止开新仓。",
    fields: [
      { path: "risk.bankrollUsd", label: "初始资金", unit: "USD", min: LIM.risk.bankrollUsd[0], max: LIM.risk.bankrollUsd[1], step: 100 },
      { path: "risk.maxDrawdownPct", label: "最大回撤熔断", unit: "%", min: LIM.risk.maxDrawdownPct[0], max: LIM.risk.maxDrawdownPct[1], step: 1, slider: true, out: (v) => `${v}%` },
      { path: "risk.dailyLossLimitUsd", label: "单日最大亏损", unit: "USD", min: LIM.risk.dailyLossLimitUsd[0], max: LIM.risk.dailyLossLimitUsd[1], step: 10 },
      { path: "risk.killSwitch", kind: "toggle", label: "启用回撤熔断 kill switch", help: "触发后自动停机并记录 risk_kill_switch" },
    ],
  },
  {
    key: "fees",
    step: "06",
    title: "费率",
    desc: "Polymarket 天气市场官方 taker 费，按成交价逐笔计提并计入成本。",
    fields: [
      { path: "fees.model", kind: "readonly", label: "费率模型", valueLabel: FEES.model },
      { path: "fees.takerFeeRate", label: "taker 费率", unit: "小数（0.05 = 5%）", min: LIM.fees.takerFeeRate[0], max: LIM.fees.takerFeeRate[1], step: 0.001, help: `官方 ${FEES.takerFeeRate * 100}% · 仅 taker 收取 · 保留 ${FEES.feeDecimals} 位小数` },
      { kind: "html", html: `<div class="fee-formula"><div><span class="field-label">官方手续费公式</span><code>fee = shares × ${FEES.takerFeeRate} × p × (1 − p)</code></div><div class="fee-formula-note"><span class="tag-amber">${FEES.takerFeeRate * 100}%</span> 天气市场 taker 费率 · maker 返佣 ${FEES.makerRebateRate * 100}% · 最小非零费用 ${FEES.minFeeUsd} USDC</div></div>` },
    ],
  },
  {
    key: "sim",
    step: "07",
    title: "模拟设置",
    desc: "实时 / 回放模式、tick 间隔与回放倍速；回放用于复现与无行情时演示。",
    fields: [
      { path: "sim.mode", kind: "select", label: "运行模式", options: [{ value: "live", label: "实时（live）" }, { value: "replay", label: "回放（replay）" }] },
      { path: "sim.tickIntervalMs", label: "tick 间隔", unit: "毫秒", min: LIM.sim.tickIntervalMs[0], max: LIM.sim.tickIntervalMs[1], step: 250 },
      { path: "sim.replayLookbackMin", label: "回放窗口", unit: "分钟", min: LIM.sim.replayLookbackMin[0], max: LIM.sim.replayLookbackMin[1], step: 5 },
      { path: "sim.speed", label: "回放速度", unit: "倍", min: LIM.sim.speed[0], max: LIM.sim.speed[1], step: 1, help: "回放模式下的时间压缩倍率" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 字段说明（点击/悬停 ? 查看）                                          */
/* ------------------------------------------------------------------ */

const FIELD_TIPS = {
  "universe.cities": "只在这些城市的最高温市场里交易；不勾选 = 全部城市。城市越少可选市场越少，可能长时间没有信号。",
  "universe.maxMarkets": "从符合条件的温度市场中按流动性/成交量选前 N 个参与。10–20 个比较均衡。",
  "universe.minPrice": "只交易 YES 中间价 ≥ 该值的市场（0.02 = 2¢）。过滤极端低价括号，避免 1 个 tick 就产生 ±100% 的假信号。",
  "universe.maxPrice": "只交易 YES 中间价 ≤ 该值的市场（0.98 = 98¢）。过滤接近确定的极端高价括号。",
  "universe.minLiquidityUsd": "市场流动性低于该值不参与。数据源流动性可能偏高，建议同时用点差过滤。",
  "universe.maxSpread": "买一卖一价差超过该值不参与且不触发信号（0.03 = 3¢）。市价单先承担点差，点差过宽会吃掉利润。",
  "universe.minTimeToResolutionSec": "距市场结算至少还有多少秒才参与（900 = 15 分钟）。太近时价格已基本确定，交易价值低。",
  "universe.maxTimeToResolutionSec": "距市场结算最多还有多少秒（129600 = 36 小时）。太远时价格波动慢、资金占用久。",
  "universe.onlyAcceptingOrders": "只交易当前可接单的市场；关闭后可能选到暂停/已关闭的市场，不建议关闭。",
  "signal.priceField": "用哪个价格计算涨跌幅：mid=中间价（推荐，稳定）；last=最新成交（可能很久不更新）；best_bid/best_ask=买一/卖一价（会随盘口跳动）。",
  "signal.windowSec": "回看多少秒内的涨跌幅。60 秒就是需求里的『1 分钟』。",
  "signal.moveThresholdPct": "窗口内涨跌幅达到 ±该百分比就触发。20 = ±20%。",
  "signal.minAbsMove": "同时要求绝对价格变动 ≥ 该值（0.01 = 1¢）。低价区间 0.001→0.0012 也是 +20%，但只涨 0.02¢，必须过滤。",
  "signal.direction": "只做上涨信号、只做下跌信号，或双向都做。UP 买入 YES，DOWN 买入 NO。",
  "signal.confirmationTicks": "需要连续多少个 tick 都满足条件才触发；2 次确认可过滤瞬间毛刺。",
  "signal.cooldownSec": "同一市场触发一次后，多少秒内不再开新仓。",
  "signal.maxSignalsPerMarket": "整个运行期间该市场最多触发几次信号。",
  "signal.requireSpreadOk": "实时点差超过『最大点差』时跳过本次信号，避免在流动性差的时刻成交。建议保持开启。",
  "execution.orderType": "系统只模拟市价单（IOC/FAK）：立即按真实盘口成交，不挂单等待。",
  "execution.sizingMode": "固定名义金额：每次固定下单多少 USD 名义额；按权益百分比：每次用当前总权益的百分之几。",
  "execution.sizingValue": "每次下单的目标名义额（fixed_stake 为 USD，pct_equity 为 %）。市价 BUY 最低 $1 名义额；手续费从现金另扣，不占这里的预算。",
  "execution.maxPositionUsd": "单笔/单市场累计成本上限（USD），与设定的仓位金额取较小者。",
  "execution.maxPositions": "同时最多持有多少个不同市场的仓位（并发持仓数）。",
  "execution.maxPositionsPerMarket": "同一个市场最多同时持有几笔仓位，防止过度集中。",
  "execution.fillModel": "逐档吃单（book_walk）：从最优卖价开始按盘口深度成交，计算加权平均成交价 VWAP。",
  "execution.slippageBufferBps": "允许成交价超出买一价的最大比例（bps，100 = 1%）。0 = 只吃最优一档；调大可吃更深流动性但成本更高。",
  "exit.takeProfitPct": "按含费成本计算的净收益率达到 +X% 时卖出止盈。",
  "exit.stopLossPct": "按含费成本计算的净亏损达到 −X% 时卖出止损。",
  "exit.maxHoldSec": "持仓超过该秒数强制平仓（3600 = 1 小时）。",
  "exit.holdToResolution": "开启后止盈/止损/超时/反向信号全部不生效，只等市场结算按 1/0 兑付；短线策略应关闭。",
  "exit.exitOnOppositeSignal": "持有 YES 时出现已确认的 DOWN 信号（或反之）则平仓；仅在『持有到结算』关闭时生效。",
  "risk.bankrollUsd": "模拟账户的初始资金（paper trading，不涉及真实资金）。",
  "risk.maxDrawdownPct": "权益从历史最高点回撤超过该百分比时触发熔断，停止开新仓。",
  "risk.dailyLossLimitUsd": "当日累计已实现亏损超过该金额时停止开新仓。",
  "risk.killSwitch": "熔断开关：触发后运行状态变为 stopped 并记录 risk_kill_switch（不会强制平仓已有持仓）。",
  "fees.model": "Polymarket 天气市场官方 taker 费率模型，系统在每笔成交上自动计提。",
  "fees.takerFeeRate": "官方天气市场 taker 费率 = 0.05（5%）。手续费 = 股数 × 费率 × 价格 × (1−价格)，从账户现金另扣，不占用订单名义额。",
  "sim.mode": "live 使用官方实时行情；replay 使用历史分钟价回放，适合复现和无行情时演示。",
  "sim.tickIntervalMs": "引擎每多少毫秒处理一次行情（1000 = 1 秒）。",
  "sim.replayLookbackMin": "回放模式下回看最近多少分钟的历史数据。",
  "sim.speed": "回放时的时间压缩倍率，50 = 50 倍速。",
};

/** 字段说明的「?」按钮（悬停/点击/键盘聚焦显示说明气泡）。 */
function fieldTipDot(path) {
  const text = FIELD_TIPS[path];
  if (!text) return "";
  return `<button type="button" class="help-dot" data-tip="${escapeAttr(text)}" aria-label="说明：${escapeAttr(text)}">?</button>`;
}

const MODE_HINT = {
  live: "实时模式使用 Polymarket 官方行情（Gamma + CLOB）驱动本地模拟撮合。",
  replay: "回放模式使用历史分钟价驱动同一引擎，适合无行情 / 复现验证。",
};

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let target = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (typeof target[keys[i]] !== "object" || target[keys[i]] === null) target[keys[i]] = {};
    target = target[keys[i]];
  }
  target[keys[keys.length - 1]] = value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function metaCities(store) {
  const raw = (store && store.meta && Array.isArray(store.meta.cities)) ? store.meta.cities : [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { name: item, station: "" };
      if (!item || typeof item !== "object") return null;
      const name = item.name || item.city || item.label || "";
      if (!name) return null;
      return { name, station: item.station || item.icao || item.code || "" };
    })
    .filter(Boolean);
}

function briefCityCode(city) {
  if (city.station) return city.station.slice(0, 2).toUpperCase();
  return city.name.slice(0, 2).toUpperCase();
}

function presetList(store) {
  const fromMeta = store && store.meta && Array.isArray(store.meta.presets) ? store.meta.presets : null;
  return fromMeta && fromMeta.length ? fromMeta : STRATEGY_PRESETS;
}

function modeLabel(mode) {
  return MODE_LABELS[mode] || mode;
}

function escapeAttr(value) {
  return ui.escapeHtml(value == null ? "" : String(value));
}

/* ------------------------------------------------------------------ */
/* 视图挂载                                                            */
/* ------------------------------------------------------------------ */

export async function mount(root, ctx) {
  const state = {
    cfg: normalizeStrategy(DEFAULT_STRATEGY),
    presetId: "",
    editingStrategyId: null,
    mode: "live",
    validation: { valid: true, errors: [], warnings: [], source: "local" },
    validating: true,
    startBusy: false,
    saveBusy: false,
    previewOpen: false,
    destroyed: false,
  };
  const timers = { validate: 0 };
  let validateController = null;
  let tipEl = null;

  /* -------------------- 字段说明气泡 -------------------- */

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "field-tip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showFieldTip(dot) {
    const text = dot.getAttribute("data-tip");
    if (!text) return;
    const tip = ensureTip();
    tip.textContent = text;
    tip.hidden = false;
    const rect = dot.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - tr.width - 10,
      Math.max(10, rect.left + rect.width / 2 - tr.width / 2),
    );
    // 默认显示在下方（字段标签多在面板顶部，避免遮住标题）；空间不足再翻到上方。
    let top = rect.bottom + 8;
    if (top + tr.height > window.innerHeight - 10) top = rect.top - tr.height - 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function hideFieldTip() {
    if (tipEl) tipEl.hidden = true;
  }

  function helpDotFrom(event) {
    return event.target instanceof Element ? event.target.closest(".help-dot") : null;
  }

  function onHelpOver(event) {
    const dot = helpDotFrom(event);
    if (dot) showFieldTip(dot);
  }

  function onHelpOut(event) {
    const dot = helpDotFrom(event);
    if (!dot) return;
    const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest(".help-dot") : null;
    if (to !== dot) hideFieldTip();
  }

  function onHelpFocus(event) {
    const dot = helpDotFrom(event);
    if (dot) showFieldTip(dot);
  }

  function onHelpBlur(event) {
    if (helpDotFrom(event)) hideFieldTip();
  }

  function onHelpClick(event) {
    const dot = helpDotFrom(event);
    if (!dot) return;
    event.preventDefault();
    event.stopPropagation();
    showFieldTip(dot);
  }

  // 1) 初始配置：已保存策略 > 预设 > 默认
  const presets = presetList(ctx.store);
  try {
    if (ctx.params && ctx.params.strategy) {
      const strategyId = ctx.params.strategy;
      let strategy = (ctx.store.strategies || []).find((item) => item.id === strategyId);
      if (!strategy) {
        const data = await api.getJSON(`/api/strategies/${encodeURIComponent(strategyId)}`);
        strategy = data && data.strategy;
      }
      if (strategy) {
        state.cfg = normalizeStrategy(strategy.config || strategy);
        state.cfg.name = strategy.name || state.cfg.name;
        state.editingStrategyId = strategy.id || strategyId;
        state.presetId = "";
      }
    } else if (ctx.params && ctx.params.preset) {
      const preset = presets.find((item) => item.id === ctx.params.preset);
      if (preset) {
        state.cfg = normalizeStrategy(preset.config);
        state.presetId = preset.id;
      }
    } else if (ctx.store.meta && Array.isArray(ctx.store.meta.presets)) {
      // 默认载入“均衡”预设，便于新用户直接启动需求中的 ±20%/1min 策略
      const balanced = presets.find((item) => item.id === "balanced");
      if (balanced) {
        state.cfg = normalizeStrategy(balanced.config);
        state.presetId = balanced.id;
      }
    }
  } catch (error) {
    const { title, detail } = api.describeError(error);
    ui.toast(title, { type: "warn", detail });
  }
  state.mode = state.cfg.sim.mode === "replay" ? "replay" : "live";
  state.cfg.sim.mode = state.mode;

  // 2) 页面骨架
  root.innerHTML = renderShell();
  const panelsEl = root.querySelector("#builderPanels");
  const validationList = root.querySelector("#validationList");
  const validationBadge = root.querySelector("#validationBadge");

  if (panelsEl) panelsEl.innerHTML = renderSkeleton();

  // 3) 首帧渲染表单
  renderForm();

  /* -------------------- 渲染 -------------------- */

  function renderShell() {
    return `<section class="view is-active" id="view-builder" aria-labelledby="builderTitle">
      <div class="view-head">
        <div>
          <h1 id="builderTitle">策略构建</h1>
          <p class="sub">组合城市温度市场参数，保存策略或直接启动实时模拟验证。所有价格为 YES 中间价（¢），概率为隐含概率（%）。</p>
        </div>
        <div class="view-actions">
          <div class="segmented" role="group" aria-label="运行模式">
            <button type="button" class="seg is-active" data-mode="live">实时</button>
            <button type="button" class="seg" data-mode="replay">回放</button>
          </div>
          <span class="chip chip-ghost" id="presetChip">自定义策略</span>
          <button class="btn btn-ghost" type="button" id="btnReset">重置</button>
          <button class="btn btn-ghost" type="button" id="btnSave">保存策略</button>
          <button class="btn btn-primary" type="button" id="btnStart"><span aria-hidden="true">▶</span> 启动实时模拟</button>
        </div>
      </div>

      <div class="callout" role="note">
        <span class="callout-ico" aria-hidden="true">⚠</span>
        <div>
          <strong>需求策略解释：±20% / 1 分钟动量 —— 小心低价区间的手续费陷阱</strong>
          <ul class="callout-list">
            <li>信号：窗口内价格变动 <code>ret = (p_now / p_ref − 1) × 100</code>；<code>ret ≥ +20%</code> → UP → 买入 <b>YES</b>，<code>ret ≤ −20%</code> → DOWN → 买入 <b>NO</b>。</li>
            <li>陷阱：从 0.001 → 0.0012 也是 +20%，但每股只变动 0.0002 USDC，而盘口点差通常 ≥ 1¢、官方 taker 费 <code>fee = shares × 5% × p × (1 − p)</code> 还会再扣一层，单笔期望大概率为负。</li>
            <li>建议：<code>minAbsMove</code> ≥ 0.01（1¢）、<code>minPrice</code> ≥ 0.02；校验面板会对退化配置给出<b>警告</b>（不阻止运行，但请先理解成本结构）。</li>
          </ul>
        </div>
      </div>

      <div class="builder-grid">
        <div class="builder-main" id="builderPanels"></div>
        <aside class="builder-side" aria-label="参数校验与成本估算">
          <section class="panel panel-sticky" aria-labelledby="h-validation">
            <header class="panel-head">
              <span class="panel-step">✓</span>
              <div class="panel-title"><h2 id="h-validation">校验摘要</h2><p>参数变更后实时校验（服务端 + 本地契约）。</p></div>
              <span class="badge badge-ghost" id="validationBadge">校验中</span>
            </header>
            <div class="panel-body">
              <div class="validation-list" id="validationList" aria-live="polite">${ui.skeletonLines(3)}</div>
              <div class="cost-box" id="costEstimate" aria-label="单笔交易成本估算"></div>
              <div class="side-actions">
                <button class="btn btn-primary btn-block" type="button" id="btnStartSide"><span aria-hidden="true">▶</span> 启动模拟运行</button>
                <button class="btn btn-ghost btn-block" type="button" id="btnPreviewJson" aria-expanded="false">查看策略 JSON</button>
              </div>
              <pre class="json-preview mono" id="jsonPreview" hidden></pre>
              <p class="footnote">模拟盘仅用于策略验证：不提交链上订单、不接触私钥，所有成交为本地撮合结果。快捷键：<b>Alt + R</b> 刷新数据。</p>
            </div>
          </section>
        </aside>
      </div>
    </section>`;
  }

  function renderSkeleton() {
    return `<section class="panel"><div class="panel-body">${ui.skeletonLines(4)}</div></section>`.repeat(3);
  }

  function renderForm() {
    if (!panelsEl) return;
    panelsEl.innerHTML = [
      renderBasicsPanel(),
      ...GROUP_DEFS.map(renderGroup),
    ].join("");
    syncAllRangeStyles();
    updatePresetChip();
    updateModeUI();
    renderValidation();
    renderCostEstimate();
    renderJsonPreview();
    updateButtons();
  }

  function renderBasicsPanel() {
    return `<section class="panel" aria-labelledby="h-basics">
      <header class="panel-head">
        <span class="panel-step">✦</span>
        <div class="panel-title"><h2 id="h-basics">策略基本信息</h2><p>策略名称与描述会保存到策略库，并显示在运行历史中。</p></div>
        <span class="badge badge-ghost" id="draftBadge">草稿</span>
      </header>
      <div class="panel-body">
        <div class="field-row-2">
          <div class="field">
            <label class="field-label" for="f-name">策略名称</label>
            <input class="input" id="f-name" type="text" maxlength="120" data-path="name" data-kind="text" value="${escapeAttr(state.cfg.name)}" placeholder="例如：均衡 · ±20%/1min 动量">
            <span class="field-help">最多 120 字符</span>
          </div>
          <div class="field">
            <label class="field-label" for="f-description">策略描述</label>
            <input class="input" id="f-description" type="text" maxlength="2000" data-path="description" data-kind="text" value="${escapeAttr(state.cfg.description)}" placeholder="可选：记录假设、适用行情与风险">
            <span class="field-help">最多 2000 字符</span>
          </div>
        </div>
        <div class="preset-select-row" style="margin-top: var(--sp-4)">
          <label class="field-label" for="presetSelect" style="flex: none">载入预设</label>
          <select class="input" id="presetSelect" aria-describedby="presetHint">
            <option value="">当前配置（自定义）</option>
            ${presets.map((preset) => `<option value="${escapeAttr(preset.id)}">${escapeAttr(preset.label)}</option>`).join("")}
          </select>
          <button class="btn btn-ghost" type="button" id="btnApplyPreset">载入选中预设</button>
          <span class="field-help" id="presetHint">预设只覆盖参数，不自动保存；载入后仍可自由修改。</span>
        </div>
      </div>
    </section>`;
  }

  function renderGroup(group) {
    return `<section class="panel" aria-labelledby="h-${group.key}">
      <header class="panel-head">
        <span class="panel-step">${group.step}</span>
        <div class="panel-title"><h2 id="h-${group.key}">${ui.escapeHtml(group.title)}</h2><p>${ui.escapeHtml(group.desc)}</p></div>
        <span class="badge badge-ghost">${group.fields.filter((f) => f.kind !== "html" && f.kind !== "readonly").length} 项参数</span>
      </header>
      <div class="panel-body">${renderFields(group.fields)}</div>
    </section>`;
  }

  function renderFields(fields) {
    let out = "";
    let row = [];
    const flush = () => {
      if (row.length) {
        out += `<div class="field-row field-row-4">${row.join("")}</div>`;
        row = [];
      }
    };
    for (const field of fields) {
      if (field.kind === "html") {
        flush();
        out += field.html;
        continue;
      }
      const isBlock = field.slider || field.kind === "cities";
      if (isBlock) {
        flush();
        out += renderField(field);
      } else {
        row.push(renderField(field));
        if (row.length === 4) flush();
      }
    }
    flush();
    return out;
  }

  function fieldId(path) {
    return `f-${path.replace(/[.]/g, "-")}`;
  }

  function renderField(field) {
    const id = fieldId(field.path || "x");
    const value = getPath(state.cfg, field.path);
    const label = ui.escapeHtml(field.label);
    const unit = field.unit ? ` <span class="hint">${ui.escapeHtml(field.unit)}</span>` : "";
    const help = field.help ? `<span class="field-help">${ui.escapeHtml(field.help)}</span>` : "";
    const dot = fieldTipDot(field.path);

    if (field.kind === "cities") return renderCitiesField(field);

    if (field.kind === "toggle") {
      const hintLine = field.help || dot ? `<p class="hint">${dot}${field.help ? ui.escapeHtml(field.help) : ""}</p>` : "";
      return `<div class="field switch-field">
        <label class="switch-row" for="${id}">
          <span class="field-label">${label}</span>
          <span class="switch"><input type="checkbox" id="${id}" data-path="${field.path}" data-kind="toggle" ${value ? "checked" : ""}><i aria-hidden="true"></i></span>
        </label>
        ${hintLine}
      </div>`;
    }

    if (field.kind === "readonly") {
      return `<div class="field">
        <span class="field-label">${label}${dot}</span>
        <div class="input input-ro num" id="${id}">${ui.escapeHtml(field.valueLabel || value)}</div>
      </div>`;
    }

    if (field.kind === "select") {
      return `<div class="field">
        <label class="field-label" for="${id}">${label}${dot}</label>
        <select class="input" id="${id}" data-path="${field.path}" data-kind="select">
          ${(field.options || []).map((opt) => `<option value="${escapeAttr(opt.value)}" ${String(value) === String(opt.value) ? "selected" : ""}>${ui.escapeHtml(opt.label)}</option>`).join("")}
        </select>
        ${help}
      </div>`;
    }

    if (field.slider) {
      const pct = Number.isFinite(value) ? ((value - field.min) / (field.max - field.min)) * 100 : 0;
      const outText = field.out ? field.out(value) : String(value);
      const mid = field.min + (field.max - field.min) / 2;
      const fmtScale = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
      return `<div class="slider-row" data-slider-path="${field.path}">
        <div class="slider-head">
          <label class="field-label" for="${id}">${label}${unit}${dot}</label>
          <output class="range-val" id="${id}-out" data-out-for="${field.path}" for="${id}">${ui.escapeHtml(outText)}</output>
        </div>
        <input class="range" type="range" id="${id}" data-path="${field.path}" data-kind="range"
          min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" style="--pct:${pct}%">
        <div class="range-scale"><span>${fmtScale(field.min)}</span><span>${fmtScale(mid)}</span><span>${fmtScale(field.max)}</span></div>
        ${help}
      </div>`;
    }

    // number
    return `<div class="field">
      <label class="field-label" for="${id}">${label}${unit}${dot}</label>
      <input class="input num" type="number" id="${id}" data-path="${field.path}" data-kind="number"
        data-min="${field.min}" data-max="${field.max}" data-step="${field.step}"
        min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" inputmode="decimal">
      ${help || `<span class="field-help">范围 ${field.min} – ${field.max}</span>`}
    </div>`;
  }

  function renderCitiesField(field) {
    const cities = metaCities(ctx.store);
    const selected = Array.isArray(state.cfg.universe.cities) ? state.cfg.universe.cities : [];
    const selectedSet = new Set(selected);
    if (cities.length) {
      return `<div class="field" data-cities-wrap>
        <span class="field-label" id="lb-cities">${ui.escapeHtml(field.label)}${fieldTipDot("universe.cities")}</span>
        <div class="city-picker" role="group" aria-labelledby="lb-cities">
          ${cities.map((city) => `<label class="city-option ${selectedSet.has(city.name) ? "is-on" : ""}">
            <input type="checkbox" value="${escapeAttr(city.name)}" data-city="${escapeAttr(city.name)}" ${selectedSet.has(city.name) ? "checked" : ""}>
            <span class="city-code" aria-hidden="true">${ui.escapeHtml(briefCityCode(city))}</span>
            <span class="city-name">${ui.escapeHtml(city.name)}</span>
            ${city.station ? `<span class="city-meta">${ui.escapeHtml(city.station)}</span>` : ""}
          </label>`).join("")}
        </div>
        <span class="field-help" id="citiesHelp">${citiesHelpText(selected)}</span>
      </div>`;
    }
    return `<div class="field" data-cities-wrap>
      <label class="field-label" for="f-universe-cities-csv">${ui.escapeHtml(field.label)}${fieldTipDot("universe.cities")}</label>
      <input class="input" id="f-universe-cities-csv" type="text" data-path="universe.cities" data-kind="cities-csv"
        value="${escapeAttr(selected.join(", "))}" placeholder="留空 = 全部城市；多个城市用英文逗号分隔">
      <span class="field-help" id="citiesHelp">城市元数据暂不可用；可手动输入城市名，例如 New York, London。</span>
    </div>`;
  }

  function citiesHelpText(selected) {
    if (!selected.length) return "不勾选 = 全部城市（当前：全部城市）";
    return `已选 ${selected.length} 个城市：${selected.map((name) => ui.escapeHtml(name)).join("、")}`;
  }

  /* -------------------- 控件同步 -------------------- */

  function syncAllRangeStyles() {
    if (!panelsEl) return;
    panelsEl.querySelectorAll('input[type="range"][data-path]').forEach((input) => {
      const field = findField(input.dataset.path);
      const value = Number(input.value);
      const pct = field && Number.isFinite(value)
        ? ((value - field.min) / (field.max - field.min)) * 100
        : 0;
      input.style.setProperty("--pct", `${Math.max(0, Math.min(100, pct))}%`);
      const output = panelsEl.querySelector(`[data-out-for="${input.dataset.path}"]`);
      if (output && field) output.textContent = field.out ? field.out(value) : String(value);
    });
  }

  function findField(path) {
    for (const group of GROUP_DEFS) {
      for (const field of group.fields) {
        if (field.path === path) return field;
      }
    }
    return null;
  }

  function syncFieldUI(path) {
    if (!panelsEl) return;
    const field = findField(path);
    const value = getPath(state.cfg, path);
    if (field && field.slider) {
      const input = panelsEl.querySelector(`#${fieldId(path)}`);
      if (input && Number(input.value) !== Number(value)) input.value = String(value);
      if (input) {
        const pct = ((value - field.min) / (field.max - field.min)) * 100;
        input.style.setProperty("--pct", `${Math.max(0, Math.min(100, pct))}%`);
      }
      const output = panelsEl.querySelector(`[data-out-for="${path}"]`);
      if (output) output.textContent = field.out ? field.out(value) : String(value);
    }
  }

  function updatePresetChip() {
    const chip = root.querySelector("#presetChip");
    const select = root.querySelector("#presetSelect");
    if (chip) {
      if (state.presetId) {
        const preset = presets.find((item) => item.id === state.presetId);
        chip.textContent = `预设 · ${preset ? preset.label : state.presetId}`;
      } else {
        chip.textContent = state.editingStrategyId ? "已保存策略" : "自定义策略";
      }
    }
    if (select) select.value = state.presetId || "";
    const draftBadge = root.querySelector("#draftBadge");
    if (draftBadge) draftBadge.textContent = state.editingStrategyId ? "已保存" : "草稿";
  }

  function updateModeUI() {
    state.cfg.sim.mode = state.mode;
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      const active = btn.dataset.mode === state.mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const simSelect = root.querySelector(`#${fieldId("sim.mode")}`);
    if (simSelect) simSelect.value = state.mode;
    ["btnStart", "btnStartSide"].forEach((id) => {
      const btn = root.querySelector(`#${id}`);
      if (btn) btn.innerHTML = `<span aria-hidden="true">▶</span> 启动${state.mode === "live" ? "实时模拟" : "回放"}`;
    });
    const tip = root.querySelector("#modeHint");
    if (tip) tip.textContent = MODE_HINT[state.mode] || "";
  }

  function updateButtons() {
    const hasErrors = !state.validation.valid;
    const busy = state.startBusy || state.saveBusy;
    const startBtns = ["#btnStart", "#btnStartSide"].map((sel) => root.querySelector(sel)).filter(Boolean);
    for (const btn of startBtns) {
      btn.disabled = busy || hasErrors;
      btn.title = hasErrors ? "参数校验未通过，请先修正错误" : "";
      if (state.startBusy) btn.innerHTML = '<span class="spin" aria-hidden="true"></span> 启动中…';
      else if (!hasErrors) btn.innerHTML = `<span aria-hidden="true">▶</span> 启动${state.mode === "live" ? "实时模拟" : "回放"}`;
    }
    const saveBtn = root.querySelector("#btnSave");
    if (saveBtn) {
      saveBtn.disabled = busy || hasErrors;
      saveBtn.textContent = state.saveBusy ? "保存中…" : "保存策略";
    }
    const resetBtn = root.querySelector("#btnReset");
    if (resetBtn) resetBtn.disabled = busy;
  }

  /* -------------------- 校验 -------------------- */

  function buildPayload() {
    const cfg = normalizeStrategy(state.cfg);
    cfg.name = String(state.cfg.name || "").trim().slice(0, 120) || "未命名策略";
    cfg.description = String(state.cfg.description || "").trim().slice(0, 2000);
    cfg.sim.mode = state.mode;
    return cfg;
  }

  function scheduleValidate(delay = 350) {
    if (state.destroyed) return;
    if (timers.validate) clearTimeout(timers.validate);
    timers.validate = window.setTimeout(() => {
      timers.validate = 0;
      validateNow();
    }, delay);
  }

  async function validateNow() {
    if (state.destroyed) return state.validation;
    const cfg = buildPayload();
    if (validateController) validateController.abort();
    const controller = new AbortController();
    validateController = controller;
    state.validating = true;
    renderValidation();
    let result;
    try {
      const res = await api.postJSON("/api/strategies/validate", cfg, { signal: controller.signal, timeoutMs: 8000 });
      if (controller.signal.aborted || validateController !== controller) return state.validation;
      result = {
        valid: Boolean(res && res.valid),
        errors: Array.isArray(res && res.errors) ? res.errors : [],
        warnings: Array.isArray(res && res.warnings) ? res.warnings : [],
        source: "server",
      };
    } catch (error) {
      if (controller.signal.aborted || validateController !== controller) return state.validation;
      if (error && error.code === "INVALID_STRATEGY") {
        const local = validateStrategy(cfg);
        result = {
          valid: false,
          errors: (error.details && error.details.length ? error.details : local.errors.length ? local.errors : [error.message]),
          warnings: local.warnings,
          source: "server",
        };
      } else {
        const local = validateStrategy(cfg);
        result = {
          valid: local.valid,
          errors: local.errors,
          warnings: local.warnings,
          source: "local",
          offline: true,
        };
      }
    }
    state.validating = false;
    state.validation = result;
    renderValidation();
    renderCostEstimate();
    updateButtons();
    return result;
  }

  function renderValidation() {
    if (!validationList) return;
    if (state.validating) {
      validationList.innerHTML = ui.skeletonLines(3);
      if (validationBadge) {
        validationBadge.className = "badge badge-ghost";
        validationBadge.textContent = "校验中";
      }
      return;
    }
    const { valid, errors, warnings, source, offline } = state.validation;
    const items = [];
    if (valid) {
      items.push(`<div class="validation-item ok">
        <span class="v-ico" aria-hidden="true">✓</span>
        <div><strong>参数校验通过</strong><span>${offline ? "服务端暂不可用，已使用本地契约校验" : "服务端校验通过，参数可运行"}</span></div>
      </div>`);
    } else {
      items.push(`<div class="validation-item err">
        <span class="v-ico" aria-hidden="true">✕</span>
        <div><strong>参数校验未通过（${errors.length} 项）</strong><span>修正后才能保存 / 启动运行</span></div>
      </div>`);
    }
    for (const message of errors) {
      items.push(`<div class="validation-item err"><span class="v-ico" aria-hidden="true">✕</span><div><strong>错误</strong><span>${ui.escapeHtml(message)}</span></div></div>`);
    }
    for (const message of warnings) {
      items.push(`<div class="validation-item warn"><span class="v-ico" aria-hidden="true">!</span><div><strong>警告</strong><span>${ui.escapeHtml(message)}</span></div></div>`);
    }
    if (!errors.length && !warnings.length && valid) {
      items.push(`<div class="validation-item ok"><span class="v-ico" aria-hidden="true">i</span><div><span>没有发现退化配置或成本警告。</span></div></div>`);
    }
    if (offline) {
      items.push(`<div class="validation-item warn"><span class="v-ico" aria-hidden="true">!</span><div><span>无法连接服务端校验接口：请确认 <code>node server/index.js</code> 已启动。</span></div></div>`);
    }
    validationList.innerHTML = items.join("");
    if (validationBadge) {
      if (!valid) {
        validationBadge.className = "badge badge-down";
        validationBadge.textContent = `${errors.length} 个错误`;
      } else if (warnings.length) {
        validationBadge.className = "badge badge-amber";
        validationBadge.textContent = `通过 · ${warnings.length} 警告`;
      } else {
        validationBadge.className = "badge badge-up";
        validationBadge.textContent = "通过";
      }
    }
  }

  /* -------------------- 成本估算 -------------------- */

  function renderCostEstimate() {
    const box = root.querySelector("#costEstimate");
    if (!box) return;
    const cfg = state.cfg;
    const p = 0.5;
    const notional = cfg.execution.sizingMode === "pct_equity"
      ? (Number(cfg.risk.bankrollUsd) * Number(cfg.execution.sizingValue)) / 100
      : Number(cfg.execution.sizingValue);
    const safeNotional = Number.isFinite(notional) && notional > 0 ? notional : 0;
    const shares = safeNotional / p;
    const fee = calcTakerFee(shares, p, Number(cfg.fees.takerFeeRate));
    const spreadCost = (Number(cfg.universe.maxSpread) / 2) * shares;
    const slipCost = (Number(cfg.execution.slippageBufferBps) / 10000) * safeNotional;
    const total = fee + spreadCost + slipCost;
    const breakevenPct = safeNotional > 0 ? (total / safeNotional) * 100 : 0;
    // docs/04 §5.10：最低盈利涨幅门槛 = 2 × (半价差 + feeRate×p×(1−p)) / p × 100%
    // 以 p = 50¢、半价差 1¢ 为参照点（工例门槛 9.0%）。
    const refHalfSpread = 0.01;
    const minProfitableMovePct = (2 * (refHalfSpread + FEES.takerFeeRate * p * (1 - p))) / p * 100;
    const thresholdPct = Number(cfg.signal.moveThresholdPct) || 0;
    const belowThreshold = Number.isFinite(thresholdPct) && thresholdPct < minProfitableMovePct;
    box.innerHTML = `<div class="cost-box-head"><span>单笔交易成本估算</span><span class="mono">p = 50¢</span></div>
      <div class="cost-row"><span>名义金额</span><strong class="num">${ui.fmtMoney(safeNotional)}</strong></div>
      <div class="cost-row"><span>预计手续费 <span class="tag-amber">taker ${(FEES.takerFeeRate * 100).toFixed(0)}%</span></span><strong class="num amber">${ui.fmtMoney(fee)}</strong></div>
      <div class="cost-row"><span>点差成本（半价差估算）</span><strong class="num">${ui.fmtMoney(spreadCost)}</strong></div>
      <div class="cost-row"><span>滑点保护成本</span><strong class="num">${ui.fmtMoney(slipCost)}</strong></div>
      <div class="cost-row total"><span>合计成本</span><strong class="num amber">${ui.fmtMoney(total)}</strong></div>
      <div class="cost-row"><span>盈亏平衡所需价格变动</span><strong class="num">${ui.fmtPct(breakevenPct, 2)}</strong></div>
      <div class="cost-row"><span>最低盈利涨幅门槛 <span class="hint">p=50¢ · 半价差 1¢</span></span><strong class="num ${belowThreshold ? "amber" : ""}">${ui.fmtPct(minProfitableMovePct, 2)}</strong></div>
      <p class="footnote">当前阈值 ±${ui.fmtNum(thresholdPct, 0)}% ${belowThreshold ? "<b class=\"amber\">低于</b>该门槛：即使触发也大概率被点差 + 手续费吞噬，含费期望可能为负。" : "高于该门槛：理论上可覆盖双边摩擦，但仍依赖胜率。"}</p>`;
  }

  /* -------------------- JSON 预览 -------------------- */

  function renderJsonPreview() {
    const preview = root.querySelector("#jsonPreview");
    if (!preview || !state.previewOpen) return;
    preview.textContent = JSON.stringify(buildPayload(), null, 2);
    preview.hidden = false;
  }

  /* -------------------- 交互 -------------------- */

  function applyPreset(presetId) {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    state.cfg = normalizeStrategy(preset.config);
    state.presetId = preset.id;
    state.editingStrategyId = null;
    state.mode = state.cfg.sim.mode === "replay" ? "replay" : "live";
    state.cfg.sim.mode = state.mode;
    renderForm();
    scheduleValidate(0);
    ui.toast(`已载入预设：${preset.label}`, { type: "info", timeout: 2600 });
  }

  function resetForm() {
    state.cfg = normalizeStrategy(DEFAULT_STRATEGY);
    state.cfg.sim.mode = "live";
    state.presetId = "";
    state.editingStrategyId = null;
    state.mode = "live";
    renderForm();
    scheduleValidate(0);
    ui.toast("已重置为默认参数", { type: "info", timeout: 2200 });
  }

  async function startRun() {
    if (state.startBusy) return;
    const validation = await validateNow();
    if (!validation.valid) {
      ui.toast("参数校验未通过，无法启动", { type: "error", detail: validation.errors[0] || "" });
      validationList?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const payload = buildPayload();
    state.startBusy = true;
    updateButtons();
    try {
      const res = await api.postJSON("/api/runs", { strategy: payload, mode: state.mode }, { timeoutMs: 20000 });
      const run = res && res.run;
      if (!run || !run.id) throw new Error("服务端未返回运行 ID");
      ctx.rememberRun(run.id);
      ui.toast("模拟运行已启动", {
        type: "success",
        detail: `${run.strategyName || payload.name} · ${modeLabel(state.mode)} · ${run.id}`,
        timeout: 3200,
      });
      ctx.navigate(`/dashboard?run=${encodeURIComponent(run.id)}`);
    } catch (error) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail, timeout: 7000 });
      if (error && error.code === "NO_MARKETS") {
        ui.toast("建议切换到回放模式再试一次", { type: "info", timeout: 6000 });
      }
    } finally {
      state.startBusy = false;
      updateButtons();
    }
  }

  async function saveStrategy() {
    if (state.saveBusy) return;
    const payload = buildPayload();
    if (!payload.name || !payload.name.trim() || payload.name === "未命名策略") {
      ui.toast("请先填写策略名称", { type: "warn" });
      root.querySelector("#f-name")?.focus();
      return;
    }
    const validation = await validateNow();
    if (!validation.valid) {
      ui.toast("参数校验未通过，无法保存", { type: "error", detail: validation.errors[0] || "" });
      return;
    }
    state.saveBusy = true;
    updateButtons();
    try {
      let res;
      if (state.editingStrategyId) {
        res = await api.putJSON(`/api/strategies/${encodeURIComponent(state.editingStrategyId)}`, payload);
      } else {
        res = await api.postJSON("/api/strategies", payload);
      }
      const strategy = res && res.strategy;
      if (strategy && strategy.id) state.editingStrategyId = strategy.id;
      await ctx.refreshStrategies(false);
      updatePresetChip();
      ui.toast("策略已保存", { type: "success", detail: payload.name, timeout: 2600 });
    } catch (error) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    } finally {
      state.saveBusy = false;
      updateButtons();
    }
  }

  function setMode(mode) {
    if (mode !== "live" && mode !== "replay") return;
    state.mode = mode;
    state.cfg.sim.mode = mode;
    updateModeUI();
    updateButtons();
    scheduleValidate(200);
  }

  function onControlEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // 城市多选
    const cityInput = target.closest("input[data-city]");
    if (cityInput) {
      const name = cityInput.dataset.city;
      const set = new Set(Array.isArray(state.cfg.universe.cities) ? state.cfg.universe.cities : []);
      if (cityInput.checked) set.add(name);
      else set.delete(name);
      state.cfg.universe.cities = [...set];
      cityInput.closest(".city-option")?.classList.toggle("is-on", cityInput.checked);
      const help = root.querySelector("#citiesHelp");
      if (help) help.textContent = citiesHelpText(state.cfg.universe.cities);
      state.presetId = "";
      updatePresetChip();
      scheduleValidate();
      return;
    }

    // 预设选择
    if (target.id === "presetSelect" && event.type === "change") {
      const presetId = target.value;
      if (presetId) applyPreset(presetId);
      return;
    }

    const control = target.closest("[data-path]");
    if (!control) return;
    const path = control.dataset.path;
    const kind = control.dataset.kind || "number";
    let changed = false;

    if (kind === "toggle") {
      setPath(state.cfg, path, Boolean(control.checked));
      changed = true;
    } else if (kind === "select") {
      const value = control.value;
      setPath(state.cfg, path, value);
      if (path === "sim.mode") {
        state.mode = value === "replay" ? "replay" : "live";
        updateModeUI();
      }
      changed = true;
    } else if (kind === "range" || kind === "number") {
      if (control.value === "" || control.value === "-") return;
      const num = Number(control.value);
      if (!Number.isFinite(num)) return;
      setPath(state.cfg, path, num);
      if (kind === "range") syncFieldUI(path);
      changed = true;
    } else if (kind === "text") {
      setPath(state.cfg, path, String(control.value));
      changed = true;
    } else if (kind === "cities-csv") {
      const cities = String(control.value)
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
      state.cfg.universe.cities = cities;
      changed = true;
    }

    if (!changed) return;
    state.presetId = "";
    updatePresetChip();
    if (event.type === "change" && kind === "number") {
      const field = findField(path);
      if (field) {
        const clamped = clamp(Number(control.value), field.min, field.max);
        if (Number(control.value) !== clamped || String(control.value) !== String(clamped)) {
          control.value = String(clamped);
          setPath(state.cfg, path, clamped);
        }
      }
    }
    scheduleValidate();
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#btnApplyPreset")) {
      const select = root.querySelector("#presetSelect");
      const presetId = select ? select.value : "";
      if (presetId) applyPreset(presetId);
      else ui.toast("请先在“载入预设”下拉框选择一个预设", { type: "info", timeout: 2400 });
      return;
    }
    if (target.closest("#btnReset")) {
      resetForm();
      return;
    }
    if (target.closest("#btnSave")) {
      saveStrategy();
      return;
    }
    if (target.closest("#btnStart") || target.closest("#btnStartSide")) {
      startRun();
      return;
    }
    if (target.closest("#btnPreviewJson")) {
      state.previewOpen = !state.previewOpen;
      const btn = root.querySelector("#btnPreviewJson");
      const preview = root.querySelector("#jsonPreview");
      if (btn) btn.setAttribute("aria-expanded", state.previewOpen ? "true" : "false");
      if (preview) {
        preview.hidden = !state.previewOpen;
        if (state.previewOpen) renderJsonPreview();
      }
      return;
    }
    const modeBtn = target.closest("[data-mode]");
    if (modeBtn && modeBtn.dataset.mode) {
      setMode(modeBtn.dataset.mode);
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      hideFieldTip();
      return;
    }
    // 数字输入框回车立即触发校验，避免等待 debounce
    if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.matches("input[data-path]")) {
      event.preventDefault();
      validateNow();
    }
  }

  root.addEventListener("input", onControlEvent);
  root.addEventListener("change", onControlEvent);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("mouseover", onHelpOver);
  root.addEventListener("mouseout", onHelpOut);
  root.addEventListener("focusin", onHelpFocus);
  root.addEventListener("focusout", onHelpBlur);
  root.addEventListener("click", onHelpClick);
  window.addEventListener("scroll", hideFieldTip, true);

  // 首屏校验
  scheduleValidate(60);

  return {
    async refresh() {
      await ctx.refreshStrategies(false);
      await validateNow();
    },
    onGlobalKey() {
      /* 构建页无全局运行控制 */
    },
    destroy() {
      state.destroyed = true;
      if (timers.validate) clearTimeout(timers.validate);
      timers.validate = 0;
      if (validateController) {
        try {
          validateController.abort();
        } catch {
          /* ignore */
        }
        validateController = null;
      }
      root.removeEventListener("input", onControlEvent);
      root.removeEventListener("change", onControlEvent);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("mouseover", onHelpOver);
      root.removeEventListener("mouseout", onHelpOut);
      root.removeEventListener("focusin", onHelpFocus);
      root.removeEventListener("focusout", onHelpBlur);
      root.removeEventListener("click", onHelpClick);
      window.removeEventListener("scroll", hideFieldTip, true);
      if (tipEl) {
        tipEl.remove();
        tipEl = null;
      }
    },
  };
}
