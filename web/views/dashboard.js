/**
 * web/views/dashboard.js — 实时看板（核心视图）
 *
 * 数据来源：
 *  - REST 快照：GET /api/runs/:id、/trades、/equity、/signals、/positions、/markets
 *  - SSE：/api/stream?runId= 过滤本 run 的事件
 *    hello / meta / markets / market / signal / trade / positions / equity /
 *    metrics / run / feed / log / heartbeat
 *  - 断线重连后通过 REST 补齐快照（reconnected → resync）
 *
 * 展示口径（docs/04 §5.11 / §6）：
 *  - 主口径永远是含费盈亏：equity = cash + positionsValue，交易行手续费 5 位小数
 *  - P&L 同时用颜色 + 符号 + ▲/▼ 箭头 + 涨/跌文本表达，不依赖颜色
 *  - 价格 ¢、概率 %、金额 $、时间 Asia/Shanghai
 */

import {
  CONTRACT_VERSION,
} from "/shared/contract.js";
import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";
import { createLineChart, drawSparkline } from "/web/components/charts.js";

const MODE_LABELS = { live: "实时", replay: "回放" };
const ACTIVE_STATUSES = new Set(["created", "starting", "running", "paused", "stopping"]);
const EQUITY_RANGES = [
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 0, label: "全部" },
];

const MAX_SIGNALS = 300;
const MAX_TRADES = 500;
const MAX_EQUITY = 4000;
const MAX_LOGS = 120;

const TRADE_GROUP_OPTIONS = [
  { value: "none", label: "不分组" },
  { value: "city", label: "按城市" },
  { value: "market", label: "按市场" },
  { value: "side", label: "按方向" },
  { value: "outcome", label: "按 YES/NO" },
  { value: "reason", label: "按原因" },
];

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 契约里的 winRate 是 0–1 小数（部分实现可能返回 0–100），统一显示为 %。 */
function winRatePct(metrics) {
  const value = num(metrics && metrics.winRate);
  if (value === null) return null;
  return value <= 1 ? value * 100 : value;
}

function modeLabel(mode) {
  return MODE_LABELS[mode] || mode || "—";
}

function cityLabel(market) {
  if (!market) return "未知市场";
  const city = market.city || "未知城市";
  return market.station ? `${city} · ${market.station}` : city;
}

function bracketLabel(market) {
  return (market && (market.bracket || market.question)) || "—";
}

function marketName(market) {
  return `${cityLabel(market)} ${bracketLabel(market)}`.trim();
}

/** 卡片日期短标签（MM/DD，用于区分同一城市不同日期的市场）。 */
function shortDate(iso) {
  if (!iso) return "";
  const ts = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const date = new Date(ts);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function quoteOf(market, side = "YES") {
  return (market && market.quotes && market.quotes[side]) || {};
}

function midOf(market, side = "YES") {
  const quote = quoteOf(market, side);
  const mid = num(quote.mid);
  return mid !== null ? mid : null;
}

function priceText(price) {
  const value = num(price);
  if (value === null || value <= 0) return "—";
  return ui.fmtCents(value, 1);
}

function feeText(fee) {
  return ui.fmtMoney(num(fee) || 0, 5);
}

function fmtIso(iso) {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ui.fmtDateTime(ts) : iso;
}

/**
 * 温度市场实际交易截止：观察日 24:00 UTC（次日 00:00Z）。
 * 官方 Gamma 的 endDate 是观察日 12:00Z，不是真实截止时间（CLOB 实测交易到 00:00Z 后）。
 */
function tradingCutoffMs(market) {
  const explicit = Date.parse(market?.tradingCutoff);
  if (Number.isFinite(explicit)) return explicit;
  const endMs = Date.parse(market?.endDate);
  if (!Number.isFinite(endMs)) return NaN;
  if (market?.negRisk && new Date(endMs).getUTCHours() === 12) return endMs + 12 * 3600_000;
  return endMs;
}

function utcDateParts(ms) {
  const date = new Date(ms);
  return {
    day: `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`,
    year: date.getUTCFullYear(),
  };
}

/** 交易截止提示：观察日 24:00 UTC。 */
function tradingEndHint(market) {
  const endMs = Date.parse(market?.endDate);
  if (!Number.isFinite(endMs)) return "";
  return `${utcDateParts(endMs).day} 24:00 UTC`;
}

/** 结算提示：观察日次日 00:00 UTC 后首份 METAR（通常 ~00:30–01:00 UTC）。 */
function settlementHint(market) {
  const cutoffMs = tradingCutoffMs(market);
  if (!Number.isFinite(cutoffMs)) return "";
  const next = new Date(cutoffMs);
  const label = `${String(next.getUTCMonth() + 1).padStart(2, "0")}/${String(next.getUTCDate()).padStart(2, "0")}`;
  return `${label} 00:00 UTC 后（首份 METAR）`;
}

/** 官方 Polymarket 事件页（zh）。 */
function polymarketEventUrl(market) {
  const slug = market?.eventSlug;
  return slug ? `https://polymarket.com/zh/event/${encodeURIComponent(slug)}` : null;
}

function marketLinkHtml(market, city, bracket) {
  const label = `<span class="mkt-name"><b>${ui.escapeHtml(city)}</b><span>${ui.escapeHtml(bracket)}</span></span>`;
  const url = polymarketEventUrl(market);
  if (!url) return label;
  return `<a class="mkt-link" href="${ui.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="在 Polymarket 查看该事件">${label}</a>`;
}

function bracketSortKey(market) {
  const text = String((market && market.bracket) || "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (match) return Number(match[0]);
  return 999;
}

/** 市场 YES 展示价：点差 > 10¢ 时按官方展示规则回退到 last（docs/04 §6.4）；
 *  极端括号可能出现 bid=0 → mid=0，此时优先用 last/隐含概率兜底显示。 */
function yesDisplay(market) {
  const spread = num(market && market.spread);
  const mid = midOf(market, "YES");
  const last = num(quoteOf(market, "YES").last);
  const implied = num(market && market.impliedProbability);
  if (spread !== null && spread > 0.1 && last) return { value: last, isLast: true };
  if (mid !== null && mid > 0) return { value: mid, isLast: false };
  if (implied !== null && implied > 0) return { value: implied, isLast: false };
  if (last) return { value: last, isLast: true };
  if (mid !== null) return { value: mid, isLast: false };
  return { value: null, isLast: false };
}

function groupMarkets(markets) {
  const groups = new Map();
  for (const market of markets) {
    const key = market.eventId || `${market.city || "未知城市"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(market);
  }
  const list = [...groups.entries()].map(([key, items]) => {
    items.sort((a, b) => bracketSortKey(a) - bracketSortKey(b));
    const sum = items.reduce((acc, item) => {
      const prob = num(item.impliedProbability) !== null ? item.impliedProbability : midOf(item, "YES");
      return acc + (prob || 0);
    }, 0);
    const first = items[0];
    return {
      key,
      city: (first && first.city) || "未知城市",
      date: first && first.endDate ? ui.fmtDate(Date.parse(first.endDate)) : "",
      markets: items,
      sum,
      sumOk: Math.abs(sum - 1) <= 0.05,
    };
  });
  list.sort((a, b) => String(a.city).localeCompare(String(b.city), "zh-CN"));
  return list;
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export async function mount(root, ctx) {
  const runId = (ctx.params && ctx.params.run) || ctx.store.currentRunId || null;
  const instance = {
    refresh: null,
    onGlobalKey: null,
    destroy: null,
  };

  if (!runId) {
    renderNoRun(root, ctx);
    return instance;
  }

  const state = {
    runId,
    run: null,
    config: null,
    metrics: {},
    costBreakdown: null,
    positions: [],
    trades: [],
    signals: [],
    equity: [],
    markets: new Map(),
    series: new Map(),
    selectedMarketId: null,
    marketHistory: [],
    logs: [],
    feed: { status: "connecting", marketsTracked: 0, latencyMs: null, lastUpdate: 0 },
    streamStatus: "connecting",
    streamAttempt: 0,
    equityRange: 0,
    tradeGroupBy: "none",
    tradeFilter: "all",
    error: null,
    destroyed: false,
    lastTickAt: Date.now(),
  };

  let stream = null;
  let equityChart = null;
  let marketChart = null;
  let tickTimer = 0;
  let marketsTimer = 0;
  let historyController = null;
  let historySeq = 0;
  let stopBusy = false;

  /* -------------------- 外壳 -------------------- */

  root.innerHTML = renderShell();
  const el = {
    runTag: root.querySelector("#dashRunId"),
    runSwitcher: root.querySelector("#runSwitcher"),
    sub: root.querySelector("#dashSub"),
    statusPill: root.querySelector("#dashStatusPill"),
    settleBadge: root.querySelector("#dashSettleBadge"),
    connBanner: root.querySelector("#connBanner"),
    connBannerText: root.querySelector("#connBannerText"),
    errorBox: root.querySelector("#dashError"),
    content: root.querySelector("#dashContent"),
    metricGrid: root.querySelector("#metricGrid"),
    marketGrid: root.querySelector("#marketGrid"),
    marketFoot: root.querySelector("#marketFoot"),
    signalFeed: root.querySelector("#signalFeed"),
    signalBadge: root.querySelector("#signalCountBadge"),
    tradesBody: root.querySelector("#tradesBody"),
    tradesEmpty: root.querySelector("#tradesEmpty"),
    tradeBadge: root.querySelector("#tradeCountBadge"),
    tradeGroupBy: root.querySelector("#tradeGroupBy"),
    tradeFilter: root.querySelector("#tradeFilter"),
    positionsBody: root.querySelector("#positionsBody"),
    positionsEmpty: root.querySelector("#positionsEmpty"),
    positionBadge: root.querySelector("#positionBadge"),
    costList: root.querySelector("#costList"),
    costBadge: root.querySelector("#costDragBadge"),
    logList: root.querySelector("#logList"),
    feedChips: root.querySelector("#feedChips"),
    selectedMeta: root.querySelector("#selectedMeta"),
    selectedTitle: root.querySelector("#selectedTitle"),
    equityCanvas: root.querySelector("#equityChart"),
    marketCanvas: root.querySelector("#marketChart"),
    baselineLabel: root.querySelector("#chartBaseline"),
    chartRangeLabel: root.querySelector("#chartRangeLabel"),
    chartLatest: root.querySelector("#chartLatest"),
    equityTableWrap: root.querySelector("#equityTableWrap"),
    equityTableBody: root.querySelector("#equityTableBody"),
    stopBtn: root.querySelector("#btnStop"),
  };

  el.tradeGroupBy?.addEventListener("change", () => {
    state.tradeGroupBy = el.tradeGroupBy.value;
    state.tradeFilter = "all";
    renderTrades();
  });
  el.tradeFilter?.addEventListener("change", () => {
    state.tradeFilter = el.tradeFilter.value;
    renderTrades();
  });

  // 图表实例（画布在外壳里已存在，先创建，之后 setData）
  equityChart = createLineChart(el.equityCanvas, {
    color: "#22D3EE",
    seriesName: "总权益（含费）",
    yFormat: (value) => ui.fmtMoney(value),
    xFormat: (ts) => ui.fmtTime(ts),
    ariaLabel: "总权益（含费）随时间变化的折线图",
    baseline: null,
    baselineLabel: "初始资金",
  });
  marketChart = createLineChart(el.marketCanvas, {
    color: "#67E8F9",
    seriesName: "YES 中间价",
    yFormat: (value) => ui.fmtCents(value, 1),
    xFormat: (ts) => ui.fmtTime(ts),
    ariaLabel: "选中市场 YES 价格走势图",
    fill: true,
  });

  root.addEventListener("click", onRootClick);
  root.addEventListener("change", onRootChange);

  /* -------------------- REST 快照 -------------------- */

  async function fetchSnapshot(options = {}) {
    const { silent = false } = options;
    try {
      const detail = await api.getJSON(`/api/runs/${encodeURIComponent(runId)}`);
      if (!detail || !detail.run) {
        throw new api.ApiError("运行不存在", { code: "RUN_NOT_FOUND", status: 404 });
      }
      state.run = detail.run;
      state.config = detail.config || null;
      state.metrics = detail.metrics || detail.run.metrics || {};
      state.costBreakdown = detail.costBreakdown || null;
      state.positions = Array.isArray(detail.positions) ? detail.positions : [];
      // 快照里的 feedStatus 作为初始行情状态（SSE feed 事件到达后会覆盖）。
      if (detail.run.feedStatus) {
        state.feed.status = detail.run.feedStatus;
        if (num(detail.run.marketsTracked) !== null) state.feed.marketsTracked = detail.run.marketsTracked;
      }
      state.selectedMarketId = state.selectedMarketId || null;
      state.runId = detail.run.id || runId;
      ctx.store.currentRun = detail.run;
      ctx.store.currentRunId = state.runId;
      ctx.store.runStatuses.set(state.runId, detail.run.status);
      ctx.rememberRun(state.runId);

      const [tradesRes, equityRes, signalsRes, marketsRes] = await Promise.allSettled([
        api.getJSON(`/api/runs/${encodeURIComponent(runId)}/trades?limit=${MAX_TRADES}`),
        api.getJSON(`/api/runs/${encodeURIComponent(runId)}/equity?limit=${MAX_EQUITY}`),
        api.getJSON(`/api/runs/${encodeURIComponent(runId)}/signals?limit=200`),
        api.getJSON("/api/markets?limit=500"),
      ]);

      if (tradesRes.status === "fulfilled" && tradesRes.value) {
        state.trades = Array.isArray(tradesRes.value.trades) ? tradesRes.value.trades : state.trades;
      }
      if (equityRes.status === "fulfilled" && equityRes.value) {
        const points = Array.isArray(equityRes.value.points) ? equityRes.value.points : [];
        state.equity = points.filter((p) => num(p && p.equity) !== null);
      }
      if (signalsRes.status === "fulfilled" && signalsRes.value) {
        state.signals = Array.isArray(signalsRes.value.signals) ? signalsRes.value.signals : state.signals;
      }
      if (marketsRes.status === "fulfilled" && marketsRes.value) {
        applyMarkets(marketsRes.value.markets || []);
      }
      return { ok: true };
    } catch (error) {
      state.error = api.describeError(error);
      if (!silent) console.error("[dashboard] 快照加载失败", error);
      return { ok: false, error };
    }
  }

  function applyMarkets(markets) {
    if (!Array.isArray(markets)) return;
    const map = new Map();
    for (const market of markets) {
      if (market && market.id) map.set(market.id, market);
    }
    state.markets = map;
    for (const market of markets) {
      if (!market || !market.id) continue;
      const display = yesDisplay(market);
      if (display.value !== null) {
        const list = state.series.get(market.id) || [];
        list.push(display.value);
        while (list.length > 60) list.shift();
        state.series.set(market.id, list);
      }
    }
  }

  /* -------------------- 首帧 -------------------- */

  renderShellPlaceholders();
  const snapshot = await fetchSnapshot();
  if (state.destroyed) return instance;
  if (!snapshot.ok) {
    renderError(state.error);
    return instance;
  }
  selectInitialMarket();
  renderAll();
  loadRunOptions();
  appendLog("info", `已加载运行 ${state.runId} 快照（${state.trades.length} 笔成交 / ${state.equity.length} 个权益点）`);

  // 选中市场走势
  if (state.selectedMarketId) loadMarketHistory(state.selectedMarketId);

  // SSE
  stream = api.connectStream({
    runId: state.runId,
    onEvent: handleStreamEvent,
    onStatus: handleStreamStatus,
  });

  tickTimer = window.setInterval(onTick, 1000);

  instance.refresh = async () => {
    const result = await fetchSnapshot();
    if (result.ok) {
      renderAll();
      loadRunOptions();
      if (state.selectedMarketId) loadMarketHistory(state.selectedMarketId);
      ui.toast("看板数据已刷新", { type: "info", timeout: 1600 });
    } else {
      ui.toast("刷新失败", { type: "error", detail: state.error ? state.error.detail : "" });
    }
  };
  instance.onGlobalKey = (key) => {
    if (key === "stop") triggerStop();
  };
  instance.destroy = destroy;

  return instance;

  /* ================= 渲染 ================= */

  function renderShell() {
    return `<section class="view is-active" id="view-dashboard" aria-labelledby="dashTitle">
      <div class="conn-banner" id="connBanner" role="status" aria-live="polite" hidden>
        <span class="spin" aria-hidden="true"></span>
        <span id="connBannerText">实时通道断开，重连中…</span>
      </div>
      <div id="dashError"></div>
      <div id="dashContent">
        <div class="view-head">
          <div>
            <h1 id="dashTitle">实时看板 <span class="run-tag mono" id="dashRunId">—</span></h1>
            <p class="sub" id="dashSub">正在加载运行数据…</p>
          </div>
          <div class="view-actions run-controls">
            <label class="run-switch" title="切换查看其他运行">
              <span class="sr-only">切换运行</span>
              <select class="input" id="runSwitcher" aria-label="切换运行"></select>
            </label>
            <span id="dashStatusPill"></span>
            <span id="dashSettleBadge" class="badge badge-amber" hidden></span>
            <div class="segmented segmented-sm" role="group" aria-label="权益曲线时间范围">
              ${EQUITY_RANGES.map((range) => `<button type="button" class="seg ${range.seconds === 0 ? "is-active" : ""}" data-range="${range.seconds}">${range.label}</button>`).join("")}
            </div>
            <button type="button" class="btn btn-ghost" id="btnRefresh">刷新</button>
            <button type="button" class="btn btn-danger-ghost" id="btnStop" title="快捷键 Alt+S"><span aria-hidden="true">■</span> 停止</button>
          </div>
        </div>

        <div class="metric-grid" id="metricGrid"></div>

        <div class="dash-grid">
          <section class="panel span-4" aria-labelledby="h-markets">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-markets">温度市场行情 <span class="live-label"><span class="live-dot live-dot-sm" aria-hidden="true"></span>LIVE</span></h2>
                <p>城市 · 温度区间 · YES 价格（¢）· 隐含概率（%）· 点差 · 流动性</p>
              </div>
              <span class="badge badge-ghost" id="marketCountBadge">—</span>
            </header>
            <div class="market-grid" id="marketGrid"></div>
            <div class="chart-foot" id="marketFoot"><span class="muted">点击市场卡片查看价格走势</span></div>
          </section>

          <section class="panel span-5" aria-labelledby="h-equity">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-equity">权益 / 盈亏曲线</h2>
                <p>总权益（含费）vs 初始资金基准 · 手续费已计入</p>
              </div>
              <span class="badge badge-cyan" id="equityPointBadge">0 点</span>
            </header>
            <div class="chart-wrap">
              <canvas id="equityChart" class="chart-canvas" aria-label="总权益（含费）随时间变化的折线图" role="img"></canvas>
            </div>
            <div class="chart-foot">
              <span><i class="swatch swatch-cyan" aria-hidden="true"></i>总权益（含费）</span>
              <span><i class="swatch swatch-muted" aria-hidden="true"></i>初始资金 <b class="mono" id="chartBaseline">—</b></span>
              <span class="muted" id="chartLatest">最新 —</span>
              <span class="muted" id="chartRangeLabel">全部区间</span>
              <button type="button" class="link-btn" id="btnEquityTable" aria-expanded="false" aria-controls="equityTableWrap">查看数据表</button>
            </div>
            <div class="table-wrap" id="equityTableWrap" hidden>
              <table class="data-table">
                <caption class="sr-only">权益曲线数据点（时间为 Asia/Shanghai）</caption>
                <thead><tr><th scope="col">时间</th><th scope="col" class="num-col">总权益</th><th scope="col" class="num-col">已实现盈亏</th><th scope="col" class="num-col">未实现盈亏</th><th scope="col" class="num-col">回撤</th></tr></thead>
                <tbody id="equityTableBody"></tbody>
              </table>
            </div>
          </section>

          <section class="panel span-3" aria-labelledby="h-signals">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-signals">信号流</h2>
                <p>方向 · 市场 · 变动 · 时间</p>
              </div>
              <span class="badge badge-ghost" id="signalCountBadge">0 条</span>
            </header>
            <div class="signal-feed" id="signalFeed" aria-live="off"></div>
          </section>

          <section class="panel span-4" aria-labelledby="h-selected">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-selected">选中市场 · 价格走势</h2>
                <p id="selectedTitle">尚未选择市场</p>
              </div>
              <span class="badge badge-ghost" id="selectedProbBadge">—</span>
            </header>
            <div class="feed-chip-row" id="selectedMeta"></div>
            <div class="chart-wrap">
              <canvas id="marketChart" class="chart-canvas chart-canvas-sm" aria-label="选中市场 YES 价格走势图" role="img"></canvas>
            </div>
          </section>

          <section class="panel span-5" aria-labelledby="h-trades">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-trades">成交明细 <span class="live-label"><span class="live-dot live-dot-sm" aria-hidden="true"></span>STREAM</span></h2>
                <p>每笔市价单的成交价、手续费（5 位小数）、滑点与已实现盈亏</p>
              </div>
              <div class="trade-controls">
                <label class="trade-control">
                  <span>分组</span>
                  <select class="input input-xs" id="tradeGroupBy" aria-label="成交明细分组方式">
                    ${TRADE_GROUP_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
                  </select>
                </label>
                <label class="trade-control">
                  <span>筛选</span>
                  <select class="input input-xs" id="tradeFilter" aria-label="成交明细筛选">
                    <option value="all">全部</option>
                  </select>
                </label>
                <span class="badge badge-ghost" id="tradeCountBadge">0 笔</span>
              </div>
            </header>
            <div class="table-wrap table-scroll">
              <table class="data-table table-trades">
                <caption class="sr-only">成交明细：时间、市场、方向、数量、成交价、名义金额、手续费、滑点、已实现盈亏、原因与状态</caption>
                <thead>
                  <tr>
                    <th scope="col">时间</th>
                    <th scope="col">市场</th>
                    <th scope="col">方向</th>
                    <th scope="col" class="num-col">数量</th>
                    <th scope="col" class="num-col">成交价</th>
                    <th scope="col" class="num-col">名义</th>
                    <th scope="col" class="num-col">手续费</th>
                    <th scope="col" class="num-col">滑点</th>
                    <th scope="col" class="num-col">已实现盈亏</th>
                    <th scope="col">原因</th>
                    <th scope="col">状态</th>
                  </tr>
                </thead>
                <tbody id="tradesBody"></tbody>
              </table>
              <div class="empty-hint" id="tradesEmpty" hidden>暂无成交 · 等待信号触发</div>
            </div>
          </section>

          <section class="panel span-3" aria-labelledby="h-costs">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-costs">成本拆解</h2>
                <p>手续费 / 滑点 / 费用拖累</p>
              </div>
              <span class="badge badge-amber" id="costDragBadge">—</span>
            </header>
            <div class="cost-list" id="costList"></div>
          </section>

          <section class="panel span-7" aria-labelledby="h-positions">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-positions">当前持仓</h2>
                <p>按 YES/NO 中间价标记，含未实现盈亏与预估退出费</p>
              </div>
              <span class="badge badge-ghost" id="positionBadge">0 个</span>
            </header>
            <div class="table-wrap">
              <table class="data-table table-positions">
                <caption class="sr-only">当前持仓：市场、方向、数量、含费均价、现价、市值、未实现盈亏、隐含概率与预估退出费</caption>
                <thead>
                  <tr>
                    <th scope="col">市场</th>
                    <th scope="col">方向</th>
                    <th scope="col" class="num-col">数量</th>
                    <th scope="col" class="num-col">含费均价</th>
                    <th scope="col" class="num-col">现价</th>
                    <th scope="col" class="num-col">市值</th>
                    <th scope="col" class="num-col">未实现盈亏</th>
                    <th scope="col" class="num-col">隐含概率</th>
                    <th scope="col" class="num-col">预估退出费</th>
                  </tr>
                </thead>
                <tbody id="positionsBody"></tbody>
              </table>
              <div class="empty-hint" id="positionsEmpty" hidden>暂无持仓 · 等待信号触发</div>
            </div>
          </section>

          <section class="panel span-5" aria-labelledby="h-log">
            <header class="panel-head">
              <div class="panel-title">
                <h2 id="h-log">行情与系统日志</h2>
                <p>行情健康度、SSE 连接与引擎日志</p>
              </div>
              <span class="badge badge-ghost" id="feedBadge">—</span>
            </header>
            <div class="feed-chip-row" id="feedChips"></div>
            <div class="log-list" id="logList" aria-live="off"></div>
          </section>
        </div>
      </div>
    </section>`;
  }

  function renderShellPlaceholders() {
    if (el.metricGrid) {
      el.metricGrid.innerHTML = Array.from({ length: 9 }, () => `<article class="metric"><span class="skel skel-line" style="width:52%"></span><span class="skel skel-line" style="width:76%;height:22px"></span><span class="skel skel-line" style="width:40%"></span></article>`).join("");
    }
    if (el.marketGrid) el.marketGrid.innerHTML = ui.skeletonLines(6);
    if (el.signalFeed) el.signalFeed.innerHTML = '<div class="sig-empty">正在加载信号…</div>';
    if (el.tradesBody) el.tradesBody.innerHTML = "";
    if (el.positionsBody) el.positionsBody.innerHTML = "";
    if (el.costList) el.costList.innerHTML = ui.skeletonLines(4);
    if (el.logList) el.logList.innerHTML = ui.skeletonLines(3);
  }

  function renderAll() {
    if (state.destroyed) return;
    renderHeader();
    renderMetrics();
    renderMarkets();
    renderSelectedMarket();
    renderSignals();
    renderTrades();
    renderPositions();
    renderCosts();
    renderFeedChips();
    renderLog();
    renderEquityChart();
  }

  /* -------------------- 头部 -------------------- */

  function renderHeader() {
    const run = state.run || {};
    if (el.runTag) el.runTag.textContent = run.id || state.runId;
    if (el.statusPill) el.statusPill.innerHTML = ui.runStatusPill(run.status || "running");
    renderSettlementBadge(run);
    updateSubtitle();
    const active = ACTIVE_STATUSES.has(run.status);
    if (el.stopBtn) {
      el.stopBtn.disabled = !active || stopBusy;
      el.stopBtn.title = active ? "停止当前模拟运行（快捷键 Alt+S）" : "当前运行已停止/结束";
    }
    setErrorBox(null);
  }

  function renderSettlementBadge(run) {
    if (!el.settleBadge) return;
    const pending = num(run.pendingSettlements) || 0;
    const settled = num(run.settledPositions) || 0;
    if (pending <= 0 && settled <= 0) {
      el.settleBadge.hidden = true;
      el.settleBadge.textContent = "";
      return;
    }
    el.settleBadge.hidden = false;
    el.settleBadge.className = `badge ${pending > 0 ? "badge-amber" : "badge-ghost"}`;
    el.settleBadge.textContent = pending > 0 ? `待结算 ${pending}` : `已结算 ${settled}`;
    el.settleBadge.title = pending > 0
      ? "市场已停止交易，等待官方裁决后自动兑付（运行停止或服务重启后也会继续结算）"
      : "官方裁决已兑付，结算不收费";
  }

  function updateSubtitle() {
    if (!el.sub || !state.run) return;
    const run = state.run;
    const started = num(run.startedAt) || Date.now();
    const end = num(run.endedAt) || Date.now();
    const elapsed = Math.max(0, end - started);
    const marketsTracked = num(run.marketsTracked) || num(state.feed.marketsTracked) || state.markets.size;
    el.sub.textContent = [
      run.strategyName || "未命名策略",
      modeLabel(run.mode),
      `已运行 ${ui.fmtDuration(elapsed)}`,
      `行情 ${ui.feedStatusLabel(state.feed.status)}`,
      `${marketsTracked} 个市场`,
      `契约 v${CONTRACT_VERSION}`,
    ].join(" · ");
  }

  function setErrorBox(error) {
    if (!el.errorBox) return;
    if (!error) {
      el.errorBox.innerHTML = "";
      return;
    }
    el.errorBox.innerHTML = ui.errorState({
      title: error.title || "加载失败",
      message: error.detail || "",
      actionHtml: '<button type="button" class="btn btn-ghost" data-nav="/history">返回运行历史</button> <button type="button" class="btn btn-primary" data-nav="/builder">新建策略运行</button>',
    });
  }

  /* -------------------- 指标卡 -------------------- */

  function metricCard(label, valueHtml, subHtml, opts = {}) {
    const valueCls = opts.valueCls ? ` ${opts.valueCls}` : "";
    const subCls = opts.subCls ? ` ${opts.subCls}` : "";
    return `<article class="metric">
      <span class="metric-label">${ui.escapeHtml(label)}</span>
      <strong class="metric-value num${valueCls}">${valueHtml}</strong>
      <span class="metric-sub${subCls}">${subHtml}</span>
    </article>`;
  }

  function renderMetrics() {
    if (!el.metricGrid) return;
    const run = state.run || {};
    const metrics = state.metrics || {};
    const positions = state.positions || [];
    const equity = num(run.equity) !== null ? run.equity : (metrics.equity !== undefined ? metrics.equity : null);
    const initialCapital = num(run.initialCapital) !== null ? run.initialCapital : (state.config && state.config.risk ? state.config.risk.bankrollUsd : null);
    const cash = num(run.cash);
    const totalReturn = num(metrics.totalReturnPct);
    const realized = num(metrics.realizedPnl);
    const unrealized = num(metrics.unrealizedPnl);
    const fees = num(metrics.feesPaid);
    const wins = winRatePct(metrics);
    const profitFactor = num(metrics.profitFactor);
    const maxDd = num(metrics.maxDrawdownPct);
    const currentDd = state.equity.length ? num(state.equity[state.equity.length - 1].drawdownPct) : null;
    const trades = num(metrics.trades);
    const signalsCount = num(run.signalsCount) !== null ? run.signalsCount : state.signals.length;
    const expectancy = num(metrics.expectancy);
    const sharpe = num(metrics.sharpe);
    const feeDrag = num(metrics.feeDragPct);

    const cards = [
      metricCard(
        "总权益（含费）",
        ui.escapeHtml(ui.fmtMoney(equity)),
        `现金 ${ui.escapeHtml(ui.fmtMoney(cash))}`,
        { valueCls: "is-flat" },
      ),
      metricCard(
        "策略总收益率",
        totalReturn === null ? "—" : ui.pnlSpan(totalReturn, { digits: 2 }),
        `初始资金 ${ui.escapeHtml(ui.fmtMoney(initialCapital))}`,
      ),
      metricCard(
        "已实现盈亏",
        realized === null ? "—" : ui.pnlSpan(realized, { money: true }),
        `${num(metrics.closedTrades) || 0} 笔平仓`,
      ),
      metricCard(
        "未实现盈亏",
        unrealized === null ? "—" : ui.pnlSpan(unrealized, { money: true }),
        `${positions.length} 个持仓`,
      ),
      metricCard(
        "手续费合计",
        `<span class="amber">${ui.escapeHtml(ui.fmtMoney(fees))}</span>`,
        `${feeDrag === null ? "费用拖累 —" : `费用拖累 ${ui.fmtPctPlain(feeDrag, 4)}`} · 换手 ${ui.escapeHtml(ui.fmtMoney(num(metrics.turnoverUsd), 0))}`,
        { subCls: "amber" },
      ),
      metricCard(
        "胜率",
        wins === null ? "—" : ui.fmtPctPlain(wins),
        profitFactor === null ? "盈亏比 —" : `盈亏比 ${ui.fmtNum(profitFactor, 2)}`,
      ),
      metricCard(
        "最大回撤",
        maxDd === null ? "—" : `<span class="down">${ui.escapeHtml(`-${maxDd.toFixed(2)}%`)}</span>`,
        currentDd === null ? "当前回撤 —" : `当前回撤 -${currentDd.toFixed(2)}%`,
        { subCls: "muted" },
      ),
      metricCard(
        "成交笔数",
        `${trades === null ? "—" : Math.round(trades)}`,
        `信号 ${signalsCount} 条`,
        { valueCls: "is-flat" },
      ),
      metricCard(
        "单笔期望",
        expectancy === null ? "—" : ui.pnlSpan(expectancy, { money: true, digits: 4 }),
        sharpe === null ? "Sharpe —" : `Sharpe ${ui.fmtNum(sharpe, 2)}`,
      ),
    ];
    el.metricGrid.innerHTML = cards.join("");
  }

  /* -------------------- 行情网格 -------------------- */

  /** 本运行实际订阅的 marke id 集合（旧运行记录可能为空）。 */
  function runMarketIds() {
    const ids = state.run && Array.isArray(state.run.marketIds) ? state.run.marketIds : [];
    return new Set(ids);
  }

  /** 行情网格只展示本运行订阅的市场；旧运行无 marketIds 时回退到全部。 */
  function visibleMarkets() {
    const all = [...state.markets.values()];
    const ids = runMarketIds();
    if (!ids.size) return { markets: all, filtered: false };
    const tracked = all.filter((market) => ids.has(market.id));
    return tracked.length ? { markets: tracked, filtered: true } : { markets: all, filtered: false };
  }

  function renderMarkets() {
    if (!el.marketGrid) return;
    const { markets, filtered } = visibleMarkets();
    if (!markets.length) {
      el.marketGrid.innerHTML = ui.emptyState({ icon: "◌", title: "暂无行情", message: "行情通道尚未推送温度市场；请检查服务端 feed 状态。" });
      if (el.marketFoot) el.marketFoot.innerHTML = '<span class="muted">暂无市场数据</span>';
      return;
    }
    const groups = groupMarkets(markets);
    el.marketGrid.innerHTML = groups.map((group) => {
      const sumPct = group.sum * 100;
      const sumCls = group.sumOk ? "muted" : "down";
      return `<div class="market-group" role="group" aria-label="${ui.escapeHtml(group.city)} 温度市场">
        <div class="market-group-head">
          <span class="market-group-city">${ui.escapeHtml(group.city)}${group.date ? ` · ${ui.escapeHtml(group.date)}` : ""}</span>
          <span class="market-group-sum">${group.markets.length} 个括号 · 概率和 <b class="${sumCls}" title="${group.sumOk ? "概率和接近 100%" : "概率和偏离 100%（可能含价差/未定价括号）"}">${sumPct.toFixed(1)}%</b></span>
        </div>
        <div class="market-group-grid">${group.markets.map(renderMarketCard).join("")}</div>
      </div>`;
    }).join("");
    if (el.marketFoot) {
      el.marketFoot.innerHTML = filtered
        ? `<span class="muted">仅显示本运行订阅的 ${markets.length} 个市场（其余市场未订阅实时行情）· 点击卡片选择走势图</span>`
        : `<span class="muted">共 ${markets.length} 个市场 · 点击卡片选择走势图</span>`;
    }
    const countBadge = root.querySelector("#marketCountBadge");
    if (countBadge) countBadge.textContent = `${markets.length} 个${filtered ? " · 本运行" : ""}`;
    drawMarketSparklines();
  }

  function renderMarketCard(market) {
    const display = yesDisplay(market);
    const prob = num(market.impliedProbability) !== null ? market.impliedProbability : midOf(market, "YES");
    const spread = num(market.spread);
    const liquidity = num(market.liquidityUsd);
    const series = state.series.get(market.id) || [];
    const change = series.length > 1 ? ((series[series.length - 1] / series[0]) - 1) * 100 : null;
    const deltaCls = ui.dirClass(change);
    const tint = change === null || change === 0
      ? "transparent"
      : change > 0 ? "rgba(34, 199, 124, 0.10)" : "rgba(240, 80, 106, 0.10)";
    const selected = state.selectedMarketId === market.id;
    const stale = Boolean(market.stale) || (num(market.updatedAt) !== null && Date.now() - market.updatedAt > 20000);
    const closed = Boolean(market.closed);
    const notAccepting = market.acceptingOrders === false;
    const marketDate = shortDate(market.endDate);

    const badges = [];
    if (stale) badges.push('<span class="mkt-stale">行情过期</span>');
    if (closed) badges.push('<span class="mkt-stale mkt-closed">已关闭</span>');
    else if (notAccepting) badges.push('<span class="mkt-stale">暂停接单</span>');

    return `<button type="button" class="mkt ${selected ? "is-selected" : ""}" data-market-id="${ui.escapeHtml(market.id)}" style="--mkt-tint:${tint}" title="${ui.escapeHtml(`${market.question || marketName(market)}${marketDate ? `（交易日 ${marketDate}，交易截止 ${tradingEndHint(market)}，预计结算 ${settlementHint(market)}）` : ""}`)}" aria-pressed="${selected ? "true" : "false"}" aria-label="${ui.escapeHtml(marketName(market))}，YES ${priceText(display.value)}，隐含概率 ${prob === null ? "未知" : ui.fmtProb(prob)}">
      <div class="mkt-top">
        <span class="mkt-city"><i aria-hidden="true"></i>${ui.escapeHtml(cityLabel(market))}${marketDate ? `<span class="mkt-date">${ui.escapeHtml(marketDate)}</span>` : ""}</span>
        <canvas class="mkt-spark" data-spark-id="${ui.escapeHtml(market.id)}" width="62" height="20" aria-hidden="true"></canvas>
      </div>
      <div class="mkt-bracket">${ui.escapeHtml(bracketLabel(market))}</div>
      <div class="mkt-price-row">
        <span class="mkt-price">${ui.escapeHtml(priceText(display.value))}</span>
        ${change === null ? '<span class="mkt-delta muted">—</span>' : `<span class="mkt-delta ${deltaCls}"><span aria-hidden="true">${ui.arrowOf(change)}</span> ${ui.escapeHtml(ui.fmtPct(change, 1))}</span>`}
      </div>
      <div class="mkt-sub"><span>概率 ${prob === null ? "—" : ui.escapeHtml(ui.fmtProb(prob))}</span><span>点差 ${spread === null ? "—" : ui.escapeHtml(ui.fmtCents(spread, 1))}</span></div>
      <div class="mkt-sub"><span>流动性 ${ui.escapeHtml(ui.fmtMoney(liquidity))}</span>${display.isLast ? '<span class="mkt-stale">最后成交价</span>' : ""}</div>
      <div class="prob-bar"><i style="width:${prob === null ? 0 : Math.max(0, Math.min(100, prob * 100))}%"></i></div>
      <div class="mkt-foot"><span>YES 买 ${ui.escapeHtml(priceText(quoteOf(market, "YES").bid))} / 卖 ${ui.escapeHtml(priceText(quoteOf(market, "YES").ask))}</span><span>${badges.join(" ")}</span></div>
    </button>`;
  }

  function drawMarketSparklines() {
    if (!el.marketGrid) return;
    const canvases = el.marketGrid.querySelectorAll("canvas[data-spark-id]");
    for (const canvas of canvases) {
      const id = canvas.dataset.sparkId;
      const series = state.series.get(id) || [];
      if (series.length < 2) {
        const market = state.markets.get(id);
        const display = market ? yesDisplay(market) : { value: null };
        if (display.value !== null) drawSparkline(canvas, [display.value, display.value], { fill: false });
        continue;
      }
      drawSparkline(canvas, series, { fill: true });
    }
  }

  function scheduleMarketsRender() {
    if (marketsTimer) return;
    marketsTimer = window.setTimeout(() => {
      marketsTimer = 0;
      renderMarkets();
    }, 300);
  }

  /* -------------------- 选中市场 -------------------- */

  function selectInitialMarket() {
    const { markets } = visibleMarkets();
    const open = markets
      .filter((market) => !market.closed)
      .sort((a, b) => bracketSortKey(a) - bracketSortKey(b));
    const pool = open.length ? open : markets;
    if (!state.selectedMarketId || !pool.some((market) => market.id === state.selectedMarketId)) {
      state.selectedMarketId = pool.length ? pool[0].id : null;
    }
  }

  function renderSelectedMarket() {
    const market = state.selectedMarketId ? state.markets.get(state.selectedMarketId) : null;
    if (!el.selectedMeta || !el.selectedTitle) return;
    const probBadge = root.querySelector("#selectedProbBadge");
    if (!market) {
      el.selectedTitle.textContent = "尚未选择市场";
      el.selectedMeta.innerHTML = "";
      if (probBadge) probBadge.textContent = "—";
      marketChart?.setData([]);
      return;
    }
    const yes = quoteOf(market, "YES");
    const no = quoteOf(market, "NO");
    const prob = num(market.impliedProbability) !== null ? market.impliedProbability : midOf(market, "YES");
    el.selectedTitle.textContent = `${marketName(market)}${shortDate(market.endDate) ? ` · ${shortDate(market.endDate)}` : ""}`;
    if (probBadge) probBadge.textContent = `概率 ${prob === null ? "—" : ui.fmtProb(prob)}`;
    el.selectedMeta.innerHTML = [
      `<span class="feed-chip">YES 买 ${ui.escapeHtml(priceText(yes.bid))} / 卖 ${ui.escapeHtml(priceText(yes.ask))} / 中 ${ui.escapeHtml(priceText(yes.mid))}</span>`,
      `<span class="feed-chip">NO 买 ${ui.escapeHtml(priceText(no.bid))} / 卖 ${ui.escapeHtml(priceText(no.ask))} / 中 ${ui.escapeHtml(priceText(no.mid))}</span>`,
      `<span class="feed-chip">点差 ${ui.escapeHtml(ui.fmtCents(num(market.spread) || 0, 1))}</span>`,
      `<span class="feed-chip">流动性 ${ui.escapeHtml(ui.fmtMoney(num(market.liquidityUsd)))}</span>`,
      `<span class="feed-chip" title="观察日 24:00 UTC 停止交易（Gamma endDate 12:00Z 不是真实截止）">交易截止 ${ui.escapeHtml(tradingEndHint(market))}</span>`,
      `<span class="feed-chip" title="官方裁决：观察日次日 00:00 UTC 后首份 METAR；最迟次日 23:59 ET，以先到为准">预计结算 ${ui.escapeHtml(settlementHint(market))}</span>`,
    ].join("");
  }

  async function loadMarketHistory(marketId) {
    if (!marketId || state.destroyed) return;
    const seq = ++historySeq;
    if (historyController) historyController.abort();
    historyController = new AbortController();
    try {
      const data = await api.getJSON(
        `/api/markets/${encodeURIComponent(marketId)}/history?seconds=300`,
        { signal: historyController.signal },
      );
      if (state.destroyed || seq !== historySeq) return;
      const points = Array.isArray(data && data.points) ? data.points : [];
      state.marketHistory = points
        .map((point) => ({
          ts: num(point.ts),
          value: num(point.mid) !== null ? point.mid : (num(point.last) !== null ? point.last : null),
        }))
        .filter((point) => point.ts !== null && point.value !== null);
      renderMarketChart();
    } catch (error) {
      if (error && error.code === "TIMEOUT" && historyController && historyController.signal.aborted) return;
      if (state.destroyed || seq !== historySeq) return;
      state.marketHistory = [];
      renderMarketChart();
    }
  }

  function renderMarketChart() {
    if (!marketChart) return;
    const market = state.selectedMarketId ? state.markets.get(state.selectedMarketId) : null;
    const points = state.marketHistory.slice();
    if (market) {
      const display = yesDisplay(market);
      if (display.value !== null) {
        const last = points[points.length - 1];
        if (!last || display.value !== last.value) {
          points.push({ ts: last ? Math.max(Date.now(), last.ts + 1) : Date.now(), value: display.value });
        }
      }
    }
    const color = points.length > 1 && points[points.length - 1].value < points[0].value ? "#FB7185" : "#4ADE9B";
    marketChart.setData(points, { color });
  }

  function selectMarket(marketId) {
    if (!marketId || state.selectedMarketId === marketId) return;
    state.selectedMarketId = marketId;
    state.marketHistory = [];
    renderMarkets();
    renderSelectedMarket();
    renderMarketChart();
    loadMarketHistory(marketId);
  }

  /* -------------------- 信号流 -------------------- */

  function renderSignals() {
    if (!el.signalFeed) return;
    const signals = state.signals.slice(0, 60);
    if (el.signalBadge) el.signalBadge.textContent = `${state.signals.length} 条`;
    if (!signals.length) {
      el.signalFeed.innerHTML = '<div class="sig-empty">暂无信号 · 等待价格动量触发</div>';
      return;
    }
    el.signalFeed.innerHTML = signals.map((signal) => {
      const executed = signal.executed === true || signal.status === "executed";
      const blocked = signal.status === "blocked" || signal.blocked === true;
      const cls = executed ? "executed" : blocked ? "blocked" : "";
      const direction = signal.direction === "down" ? -1 : 1;
      return `<div class="sig ${cls}">
        <div class="sig-head">
          <span class="sig-title">${ui.directionBadge(signal.direction)} ${ui.escapeHtml(signal.city || "")} · ${ui.escapeHtml(signal.bracket || "")}</span>
          <span class="sig-time">${ui.escapeHtml(ui.fmtTime(signal.ts))}</span>
        </div>
        <div class="sig-detail">
          <span>${ui.escapeHtml(priceText(signal.fromPrice))}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span>${ui.escapeHtml(priceText(signal.toPrice))}</span>
          <span class="${ui.dirClass(direction)}">${ui.escapeHtml(ui.fmtPct(num(signal.changePct) !== null ? signal.changePct : direction * 0))}</span>
          <span>窗口 ${ui.escapeHtml(String(signal.windowSec || "—"))}s</span>
        </div>
        <div class="sig-foot">
          <span class="sig-reason">${ui.escapeHtml(ui.reasonLabel(signal.reason || "signal"))} · ${ui.escapeHtml(signal.priceField || "mid")}</span>
          <span>${ui.outcomeBadge(signal.outcome || (signal.direction === "down" ? "NO" : "YES"))}</span>
        </div>
      </div>`;
    }).join("");
  }

  /* -------------------- 成交明细 -------------------- */

  function renderTrades() {
    if (!el.tradesBody) return;
    const groupBy = TRADE_GROUP_OPTIONS.some((option) => option.value === state.tradeGroupBy)
      ? state.tradeGroupBy
      : "none";
    const decorated = state.trades.map((trade) => {
      const market = trade.marketId ? state.markets.get(trade.marketId) : null;
      const city = market ? cityLabel(market) : (trade.city || trade.marketId || "—");
      const bracket = market ? bracketLabel(market) : (trade.bracket || "");
      const reason = ui.reasonLabel(trade.reason) || trade.reason || "—";
      return { trade, market, city, bracket, marketLabel: bracket ? `${city} · ${bracket}` : city, reason };
    });
    const groupValue = (row) => {
      switch (groupBy) {
        case "city": return row.city;
        case "market": return row.marketLabel;
        case "side": return row.trade.side === "SELL" ? "SELL（卖出）" : "BUY（买入）";
        case "outcome": return row.trade.outcome || "—";
        case "reason": return row.reason;
        default: return "";
      }
    };
    const values = [...new Set(decorated.map(groupValue).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    if (groupBy === "none") state.tradeFilter = "all";
    else if (state.tradeFilter !== "all" && !values.includes(state.tradeFilter)) state.tradeFilter = "all";
    if (el.tradeFilter) {
      el.tradeFilter.innerHTML = [
        '<option value="all">全部</option>',
        ...values.map((value) => `<option value="${ui.escapeHtml(value)}">${ui.escapeHtml(value)}</option>`),
      ].join("");
      el.tradeFilter.value = state.tradeFilter;
      el.tradeFilter.disabled = groupBy === "none";
    }
    const visible = decorated.filter((row) => state.tradeFilter === "all" || groupValue(row) === state.tradeFilter);
    const limited = groupBy === "none" ? visible.slice(0, MAX_TRADES) : visible;
    if (el.tradeBadge) {
      el.tradeBadge.textContent = state.tradeFilter === "all"
        ? `${state.trades.length} 笔`
        : `${visible.length}/${state.trades.length} 笔`;
    }
    if (el.tradesEmpty) el.tradesEmpty.hidden = limited.length > 0;
    if (!limited.length) {
      el.tradesBody.innerHTML = "";
      return;
    }
    const renderRow = ({ trade, market, city, bracket, reason }) => {
      const rejected = trade.status === "rejected";
      const pnl = num(trade.realizedPnl);
      return `<tr class="${rejected ? "row-rejected" : ""}">
        <td class="num-col cell-dim">${ui.escapeHtml(ui.fmtTime(trade.ts))}</td>
        <td>${marketLinkHtml(market, city, bracket)}</td>
        <td><span class="side-badge ${trade.side === "SELL" ? "sell" : "buy"}">${ui.escapeHtml(trade.side || "—")}</span> ${ui.outcomeBadge(trade.outcome)}</td>
        <td class="num-col">${ui.escapeHtml(ui.fmtShares(trade.shares, 2))}</td>
        <td class="num-col">${ui.escapeHtml(priceText(trade.price))}</td>
        <td class="num-col">${ui.escapeHtml(ui.fmtMoney(num(trade.notional), 2))}</td>
        <td class="num-col cell-amber">${ui.escapeHtml(feeText(trade.fee))}</td>
        <td class="num-col cell-dim">${ui.escapeHtml(ui.fmtMoney(num(trade.slippageCost) || 0, 2))}</td>
        <td class="num-col">${trade.side === "SELL" && pnl !== null ? ui.pnlSpan(pnl, { money: true, digits: 4 }) : '<span class="muted">—</span>'}</td>
        <td class="trade-reason"><b>${ui.escapeHtml(reason)}</b>${rejected && trade.rejectReason ? `<br><span class="down">${ui.escapeHtml(ui.rejectReasonLabel(trade.rejectReason))}</span>` : ""}</td>
        <td>${ui.tradeStatusBadge(trade.status)}</td>
      </tr>`;
    };
    if (groupBy === "none") {
      el.tradesBody.innerHTML = limited.map(renderRow).join("");
      return;
    }
    const groups = new Map();
    for (const row of limited) {
      const key = groupValue(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    el.tradesBody.innerHTML = [...groups.entries()]
      .map(([key, items]) => `<tr class="trade-group-row"><td colspan="11"><span class="trade-group-label">${ui.escapeHtml(key)}</span><span class="trade-group-count">${items.length} 笔</span></td></tr>${items.map(renderRow).join("")}`)
      .join("");
  }

  /* -------------------- 持仓 -------------------- */

  function renderPositions() {
    if (!el.positionsBody) return;
    const positions = state.positions || [];
    if (el.positionBadge) el.positionBadge.textContent = `${positions.length} 个`;
    if (el.positionsEmpty) el.positionsEmpty.hidden = positions.length > 0;
    if (!positions.length) {
      el.positionsBody.innerHTML = "";
      return;
    }
    el.positionsBody.innerHTML = positions.map((position) => {
      const market = position.marketId ? state.markets.get(position.marketId) : null;
      const city = market ? cityLabel(market) : (position.city || "—");
      const bracket = market ? bracketLabel(market) : (position.bracket || "");
      const mid = num(position.midPrice) !== null ? position.midPrice : (market ? midOf(market, position.outcome || "YES") : null);
      const implied = num(position.impliedProbability) !== null
        ? position.impliedProbability
        : (market ? midOf(market, position.outcome || "YES") : null);
      return `<tr>
        <td>${marketLinkHtml(market, city, bracket)}</td>
        <td>${ui.outcomeBadge(position.outcome)}</td>
        <td class="num-col">${ui.escapeHtml(ui.fmtShares(position.shares, 2))}</td>
        <td class="num-col">${ui.escapeHtml(priceText(position.avgPrice))}</td>
        <td class="num-col">${ui.escapeHtml(priceText(mid))}</td>
        <td class="num-col">${ui.escapeHtml(ui.fmtMoney(num(position.marketValue), 2))}</td>
        <td class="num-col">${num(position.unrealizedPnl) !== null ? ui.pnlSpan(position.unrealizedPnl, { money: true, digits: 4 }) : '<span class="muted">—</span>'}</td>
        <td class="num-col">${implied === null ? "—" : ui.escapeHtml(ui.fmtProb(implied))}</td>
        <td class="num-col cell-amber">${ui.escapeHtml(ui.fmtMoney(num(position.estExitFee) || 0, 5))}</td>
      </tr>`;
    }).join("");
  }

  /* -------------------- 成本拆解 -------------------- */

  function renderCosts() {
    if (!el.costList) return;
    const metrics = state.metrics || {};
    const breakdown = state.costBreakdown || {};
    const sumTrades = (key) => state.trades.reduce((acc, trade) => acc + (num(trade[key]) || 0), 0);
    const fees = num(breakdown.feesPaid) !== null ? breakdown.feesPaid : (num(metrics.feesPaid) !== null ? metrics.feesPaid : sumTrades("fee"));
    const spread = num(breakdown.spreadCost) !== null ? breakdown.spreadCost : sumTrades("spreadCost");
    const slippage = num(breakdown.depthSlippageCost) !== null ? breakdown.depthSlippageCost : sumTrades("slippageCost");
    const totalFriction = num(breakdown.totalFriction) !== null ? breakdown.totalFriction : fees + spread + slippage;
    const turnover = num(metrics.turnoverUsd) !== null
      ? metrics.turnoverUsd
      : state.trades.reduce((acc, trade) => acc + Math.abs(num(trade.notional) || 0), 0);
    const feeDrag = num(metrics.feeDragPct);
    const costRate = turnover > 0 ? (totalFriction / turnover) * 100 : null;
    const max = Math.max(fees, spread, slippage, 0.0001);
    const bar = (value) => Math.max(2, Math.min(100, (value / max) * 100)).toFixed(1);

    if (el.costBadge) {
      el.costBadge.textContent = costRate === null ? "—" : `成本率 ${ui.fmtPctPlain(costRate, 2)}`;
      el.costBadge.title = "成本率 = totalFriction / turnoverUsd（含手续费 + 点差 + 深度滑点）";
    }
    el.costList.innerHTML = `
      <div class="cost-line" data-cost="fee">
        <div class="cost-line-head"><span>手续费 · taker（累计）</span><strong class="num amber">${ui.escapeHtml(ui.fmtMoney(fees, 5))}</strong></div>
        <div class="cost-bar"><i class="bar-amber" style="width:${bar(fees)}%"></i></div>
      </div>
      <div class="cost-line" data-cost="spread">
        <div class="cost-line-head"><span>点差成本（归因）</span><strong class="num">${ui.escapeHtml(ui.fmtMoney(spread, 5))}</strong></div>
        <div class="cost-bar"><i class="bar-cyan" style="width:${bar(spread)}%"></i></div>
      </div>
      <div class="cost-line" data-cost="slippage">
        <div class="cost-line-head"><span>深度滑点（归因）</span><strong class="num">${ui.escapeHtml(ui.fmtMoney(slippage, 5))}</strong></div>
        <div class="cost-bar"><i class="bar-violet" style="width:${bar(slippage)}%"></i></div>
      </div>
      <div class="cost-line" data-cost="drag">
        <div class="cost-line-head"><span>费用拖累 feeDragPct <span class="tag-amber">占本金</span></span><strong class="num amber">${feeDrag === null ? "—" : ui.escapeHtml(ui.fmtPctPlain(feeDrag, 4))}</strong></div>
        <div class="cost-bar"><i class="bar-amber" style="width:${feeDrag === null ? 0 : Math.min(100, feeDrag * 20).toFixed(1)}%"></i></div>
      </div>
      <div class="cost-line" data-cost="turnover">
        <div class="cost-line-head"><span>双边成交额 turnover</span><strong class="num">${ui.escapeHtml(ui.fmtMoney(turnover, 2))}</strong></div>
        <div class="cost-bar"><i class="bar-muted" style="width:${costRate === null ? 0 : Math.min(100, costRate * 8).toFixed(1)}%"></i></div>
      </div>
      <div class="cost-total"><span>总摩擦成本（手续费 + 点差 + 滑点）</span><strong class="num amber">${ui.escapeHtml(ui.fmtMoney(totalFriction, 5))}</strong></div>
      <p class="footnote">手续费按 <code>fee = shares × ${(state.config && state.config.fees ? state.config.fees.takerFeeRate : 0.05)} × p × (1−p)</code> 逐笔计提，成交行展示 5 位小数。点差与滑点为<b>归因项</b>，已包含在成交价中，禁止在含费 P&L 上二次扣减；权益与收益率均为<b>含费</b>口径。</p>`;
  }

  /* -------------------- 权益曲线 -------------------- */

  function renderEquityChart() {
    if (!equityChart) return;
    const initialCapital = num(state.run && state.run.initialCapital) !== null
      ? state.run.initialCapital
      : (state.config && state.config.risk ? state.config.risk.bankrollUsd : null);
    const range = state.equityRange;
    let points = state.equity.map((point) => ({ ts: point.ts, value: point.equity }));
    if (range > 0 && points.length) {
      const cutoff = points[points.length - 1].ts - range * 1000;
      points = points.filter((point) => point.ts >= cutoff);
    }
    equityChart.setData(points, { baseline: initialCapital, baselineLabel: "初始资金" });
    if (el.baselineLabel) el.baselineLabel.textContent = ui.fmtMoney(initialCapital);
    const badge = root.querySelector("#equityPointBadge");
    if (badge) badge.textContent = `${state.equity.length} 点`;
    if (el.chartLatest) {
      const latest = state.equity.length ? state.equity[state.equity.length - 1] : null;
      if (latest && num(latest.equity) !== null) {
        const netPnl = initialCapital !== null ? latest.equity - initialCapital : null;
        el.chartLatest.innerHTML = `最新 <b class="mono">${ui.escapeHtml(ui.fmtMoney(latest.equity))}</b>${netPnl === null ? "" : ` · ${ui.pnlSpan(netPnl, { money: true })}`}`;
      } else {
        el.chartLatest.textContent = "最新 —";
      }
    }
    if (el.chartRangeLabel) {
      const rangeDef = EQUITY_RANGES.find((item) => item.seconds === range);
      const span = points.length > 1 ? ui.fmtDuration(points[points.length - 1].ts - points[0].ts) : "—";
      el.chartRangeLabel.textContent = `${rangeDef ? rangeDef.label : "全部"} · ${span}`;
    }
    if (el.equityTableWrap && !el.equityTableWrap.hidden) renderEquityTable();
    root.querySelectorAll("[data-range]").forEach((btn) => {
      const active = Number(btn.dataset.range) === range;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  /** 图表的无障碍替代数据表（docs/05 §8 要求）。 */
  function renderEquityTable() {
    if (!el.equityTableBody) return;
    const rows = state.equity.slice(-200);
    el.equityTableBody.innerHTML = rows.map((point) => `<tr>
      <td class="num-col cell-dim">${ui.escapeHtml(ui.fmtTime(point.ts))}</td>
      <td class="num-col">${ui.escapeHtml(ui.fmtMoney(num(point.equity)))}</td>
      <td class="num-col">${num(point.realizedPnl) === null ? "—" : ui.pnlSpan(point.realizedPnl, { money: true })}</td>
      <td class="num-col">${num(point.unrealizedPnl) === null ? "—" : ui.pnlSpan(point.unrealizedPnl, { money: true })}</td>
      <td class="num-col">${num(point.drawdownPct) === null ? "—" : `-${point.drawdownPct.toFixed(2)}%`}</td>
    </tr>`).join("");
  }

  /* -------------------- 日志 / 行情健康 -------------------- */

  function renderFeedChips() {
    if (!el.feedChips) return;
    const feed = state.feed;
    const statusLabel = ui.feedStatusLabel(feed.status);
    const statusCls = feed.status === "live" ? "badge-cyan" : feed.status === "degraded" ? "badge-amber" : feed.status === "offline" ? "badge-down" : "badge-ghost";
    if (el.feedBadge) {
      el.feedBadge.className = `badge ${statusCls}`;
      el.feedBadge.textContent = statusLabel;
    }
    el.feedChips.innerHTML = [
      `<span class="feed-chip">行情 <b>${ui.escapeHtml(statusLabel)}</b></span>`,
      `<span class="feed-chip">市场 ${feed.marketsTracked || state.markets.size}</span>`,
      `<span class="feed-chip">延迟 ${feed.latencyMs === null || feed.latencyMs === undefined ? "—" : ui.fmtLatency(feed.latencyMs)}</span>`,
      `<span class="feed-chip">SSE ${state.streamStatus === "open" ? "已连接" : state.streamStatus === "reconnecting" ? `重连中（第 ${state.streamAttempt} 次）` : "连接中"}</span>`,
      `<span class="feed-chip">更新 ${feed.lastUpdate ? ui.fmtTime(feed.lastUpdate) : "—"}</span>`,
    ].join("");
  }

  function appendLog(level, message, ts = Date.now()) {
    if (!message) return;
    state.logs.unshift({ level: level || "info", message: String(message), ts: ts || Date.now() });
    while (state.logs.length > MAX_LOGS) state.logs.pop();
    renderLog();
  }

  function renderLog() {
    if (!el.logList) return;
    if (!state.logs.length) {
      el.logList.innerHTML = '<div class="log-line"><span class="log-msg muted">暂无日志</span></div>';
      return;
    }
    el.logList.innerHTML = state.logs.slice(0, 80).map((entry) => `<div class="log-line">
      <span class="log-time">${ui.escapeHtml(ui.fmtTime(entry.ts))}</span>
      <span class="log-lvl ${ui.escapeHtml(entry.level)}">${ui.escapeHtml(String(entry.level || "info").toUpperCase())}</span>
      <span class="log-msg">${ui.escapeHtml(entry.message)}</span>
    </div>`).join("");
  }

  /* -------------------- SSE -------------------- */

  function matchesRun(payload) {
    if (!payload || !payload.runId) return true;
    return payload.runId === state.runId;
  }

  function handleStreamEvent(name, data) {
    if (state.destroyed || !data) return;
    switch (name) {
      case "hello":
        if (data.contractVersion) {
          appendLog("info", `SSE 已连接 · 服务端契约 v${data.contractVersion}`);
        }
        return;
      case "markets": {
        const ids = runMarketIds();
        const list = (data.markets || []).filter(
          (market) => market && market.id && (!ids.size || ids.has(market.id)),
        );
        applyMarkets(list);
        scheduleMarketsRender();
        return;
      }
      case "market": {
        const market = data.market;
        if (!market || !market.id) return;
        const ids = runMarketIds();
        if (ids.size && !ids.has(market.id)) return;
        state.markets.set(market.id, market);
        const display = yesDisplay(market);
        if (display.value !== null) {
          const series = state.series.get(market.id) || [];
          series.push(display.value);
          while (series.length > 60) series.shift();
          state.series.set(market.id, series);
        }
        scheduleMarketsRender();
        if (market.id === state.selectedMarketId) {
          renderSelectedMarket();
          renderMarketChart();
        }
        return;
      }
      case "signal": {
        const signal = data.signal;
        if (!signal || !matchesRun(signal)) return;
        state.signals.unshift(signal);
        while (state.signals.length > MAX_SIGNALS) state.signals.pop();
        renderSignals();
        return;
      }
      case "trade": {
        const trade = data.trade;
        if (!trade || !matchesRun(trade)) return;
        state.trades.unshift(trade);
        while (state.trades.length > MAX_TRADES) state.trades.pop();
        renderTrades();
        renderCosts();
        if (data.position) {
          const index = state.positions.findIndex((item) => item.marketId === data.position.marketId && item.tokenId === data.position.tokenId);
          if (index >= 0) state.positions[index] = data.position;
          else if ((num(data.position.shares) || 0) > 0) state.positions.push(data.position);
          renderPositions();
        }
        return;
      }
      case "positions":
        state.positions = Array.isArray(data.positions) ? data.positions : [];
        renderPositions();
        return;
      case "equity": {
        if (data.point && num(data.point.equity) !== null) {
          const point = data.point;
          const last = state.equity[state.equity.length - 1];
          if (!last || point.ts >= last.ts) state.equity.push(point);
          while (state.equity.length > MAX_EQUITY) state.equity.shift();
        }
        if (data.metrics) state.metrics = data.metrics;
        renderMetrics();
        renderEquityChart();
        renderCosts();
        return;
      }
      case "metrics":
        if (data.metrics) {
          state.metrics = data.metrics;
          renderMetrics();
          renderCosts();
        }
        return;
      case "run":
        if (data.run && data.run.id === state.runId) {
          state.run = { ...(state.run || {}), ...data.run };
          ctx.store.currentRun = state.run;
          ctx.store.runStatuses.set(state.runId, state.run.status);
          renderHeader();
          if (!ACTIVE_STATUSES.has(state.run.status)) {
            appendLog("warn", `运行状态：${ui.runStatusMeta(state.run.status).label}`);
          }
        }
        return;
      case "feed":
        updateFeed(data);
        return;
      case "log":
        appendLog(data.level || "info", data.message, data.ts);
        return;
      case "heartbeat":
        state.lastHeartbeat = data.ts;
        return;
      case "reconnected":
        appendLog("warn", "实时通道已重连，正在通过 REST 补齐快照…");
        resync();
        return;
      case "resync":
        resync();
        return;
      default:
        return;
    }
  }

  function updateFeed(data) {
    const previous = state.feed.status;
    state.feed = {
      status: data.status || state.feed.status,
      marketsTracked: num(data.marketsTracked) !== null ? data.marketsTracked : state.feed.marketsTracked,
      latencyMs: num(data.latencyMs) !== null ? data.latencyMs : state.feed.latencyMs,
      lastUpdate: num(data.lastUpdate) !== null ? data.lastUpdate : state.feed.lastUpdate,
    };
    if (previous !== state.feed.status) {
      appendLog(state.feed.status === "live" ? "info" : "warn", `行情通道状态：${ui.feedStatusLabel(previous)} → ${ui.feedStatusLabel(state.feed.status)}`);
    }
    renderFeedChips();
    updateSubtitle();
  }

  function handleStreamStatus(status, info = {}) {
    state.streamStatus = status;
    state.streamAttempt = info.attempt || 0;
    renderFeedChips();
    if (!el.connBanner) return;
    if (status === "reconnecting" || status === "connecting" || status === "closed") {
      el.connBanner.hidden = false;
      if (el.connBannerText) {
        el.connBannerText.textContent = status === "reconnecting"
          ? `实时通道断开，重连中…（第 ${state.streamAttempt} 次，退避 ${Math.round((info.delay || 1000) / 1000)}s）`
          : "实时通道连接中…";
      }
    } else {
      el.connBanner.hidden = true;
    }
  }

  let resyncTimer = 0;
  async function resync() {
    if (resyncTimer) return;
    resyncTimer = window.setTimeout(() => {
      resyncTimer = 0;
    }, 2000);
    const result = await fetchSnapshot({ silent: true });
    if (state.destroyed) return;
    if (result.ok) {
      renderAll();
      if (state.selectedMarketId) loadMarketHistory(state.selectedMarketId);
      appendLog("info", "快照已通过 REST 补齐");
    } else {
      appendLog("error", "快照补齐失败，等待下一次重连");
    }
  }

  /* -------------------- 定时器 -------------------- */

  function onTick() {
    if (state.destroyed) return;
    const now = Date.now();
    state.lastTickAt = now;
    updateSubtitle();
    // 过期行情高亮（20s 无更新）
    const market = state.selectedMarketId ? state.markets.get(state.selectedMarketId) : null;
    if (market && num(market.updatedAt) !== null && now - market.updatedAt > 20000) {
      renderFeedChips();
    }
  }

  /* -------------------- 事件 -------------------- */

  /* -------------------- 运行切换 -------------------- */

  function statusLabel(status) {
    return (
      {
        running: "运行中",
        starting: "启动中",
        paused: "已暂停",
        stopping: "停止中",
        stopped: "已停止",
        ended: "已结束",
        error: "错误",
      }[status] || status || "—"
    );
  }

  async function loadRunOptions() {
    if (!el.runSwitcher) return;
    try {
      const data = await api.getJSON("/api/runs");
      const runs = Array.isArray(data && data.runs) ? data.runs : [];
      if (!runs.length) {
        el.runSwitcher.innerHTML = '<option value="">暂无运行</option>';
        el.runSwitcher.disabled = true;
        return;
      }
      const current = runs.find((run) => run.id === state.runId);
      const options = runs.map((run) => {
        const liveMark = ["running", "starting", "paused"].includes(run.status) ? "● " : "";
        const label = `${liveMark}${run.strategyName || "未命名策略"} · ${run.id} · ${statusLabel(run.status)}`;
        return `<option value="${ui.escapeHtml(run.id)}" ${run.id === state.runId ? "selected" : ""}>${ui.escapeHtml(label)}</option>`;
      });
      if (!current) {
        options.unshift(
          `<option value="${ui.escapeHtml(state.runId)}" selected>${ui.escapeHtml(`${state.runId}（当前）`)}</option>`,
        );
      }
      el.runSwitcher.innerHTML = options.join("");
      el.runSwitcher.disabled = false;
    } catch {
      el.runSwitcher.disabled = true;
    }
  }

  function onRootChange(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.id !== "runSwitcher") return;
    const next = target.value;
    if (!next || next === state.runId) return;
    ctx.rememberRun(next);
    ctx.navigate(`/dashboard?run=${encodeURIComponent(next)}`);
  }

  function onRootClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const nav = target.closest("[data-nav]");
    if (nav) {
      ctx.navigate(nav.dataset.nav);
      return;
    }
    if (target.closest("#btnStop")) {
      triggerStop();
      return;
    }
    if (target.closest("#btnRefresh")) {
      instance.refresh();
      return;
    }
    const rangeBtn = target.closest("[data-range]");
    if (rangeBtn) {
      state.equityRange = Number(rangeBtn.dataset.range) || 0;
      renderEquityChart();
      return;
    }
    if (target.closest("#btnEquityTable")) {
      const btn = root.querySelector("#btnEquityTable");
      if (!el.equityTableWrap) return;
      const open = el.equityTableWrap.hidden;
      el.equityTableWrap.hidden = !open;
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderEquityTable();
      return;
    }
    const card = target.closest("[data-market-id]");
    if (card) {
      selectMarket(card.dataset.marketId);
    }
  }

  async function triggerStop() {
    if (stopBusy) return;
    if (!state.run || !ACTIVE_STATUSES.has(state.run.status)) {
      ui.toast("当前运行已经停止或结束", { type: "info", timeout: 2200 });
      return;
    }
    const confirmed = await ui.confirmDialog({
      title: "停止本次模拟运行？",
      message: `将停止运行 ${state.runId}（${state.run.strategyName || "未命名策略"}）。停止后保留未平仓持仓，等待官方裁决自动结算（不会按当前市值强平；服务重启后仍会继续结算）。`,
      confirmText: "停止并结算",
      danger: true,
    });
    if (!confirmed || state.destroyed) return;
    stopBusy = true;
    if (el.stopBtn) {
      el.stopBtn.disabled = true;
      el.stopBtn.textContent = "停止中…";
    }
    try {
      const res = await api.postJSON(`/api/runs/${encodeURIComponent(state.runId)}/stop`, {});
      if (res && res.run) {
        state.run = { ...state.run, ...res.run };
        ctx.store.currentRun = state.run;
        ctx.store.runStatuses.set(state.runId, state.run.status);
      }
      appendLog("warn", "已请求停止运行，等待引擎结算…");
      ui.toast("已发送停止请求", { type: "info", detail: "停止完成后状态会自动更新", timeout: 2600 });
      renderHeader();
    } catch (error) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    } finally {
      stopBusy = false;
      if (el.stopBtn) el.stopBtn.innerHTML = '<span aria-hidden="true">■</span> 停止';
      renderHeader();
    }
  }

  function destroy() {
    state.destroyed = true;
    root.removeEventListener("click", onRootClick);
    root.removeEventListener("change", onRootChange);
    if (stream) {
      stream.close();
      stream = null;
    }
    if (tickTimer) window.clearInterval(tickTimer);
    if (marketsTimer) window.clearTimeout(marketsTimer);
    if (historyController) {
      try {
        historyController.abort();
      } catch {
        /* ignore */
      }
      historyController = null;
    }
    if (equityChart) {
      equityChart.destroy();
      equityChart = null;
    }
    if (marketChart) {
      marketChart.destroy();
      marketChart = null;
    }
  }

  /* -------------------- 错误 / 空状态 -------------------- */

  function renderError(error) {
    if (el.connBanner) el.connBanner.hidden = true;
    setErrorBox(error || { title: "运行不存在", detail: "该模拟运行可能已被删除。" });
    if (el.content) el.content.hidden = true;
    if (el.runTag) el.runTag.textContent = runId;
    if (el.sub) el.sub.textContent = "无法加载运行数据";
    if (el.statusPill) el.statusPill.innerHTML = ui.runStatusPill("error");
  }
}

/* ------------------------------------------------------------------ */
/* 无 runId 空状态                                                      */
/* ------------------------------------------------------------------ */

function renderNoRun(root, ctx) {
  root.innerHTML = `<section class="view is-active" id="view-dashboard" aria-labelledby="dashEmptyTitle">
    <div class="view-head">
      <div>
        <h1 id="dashEmptyTitle">实时看板</h1>
        <p class="sub">尚未选择模拟运行。</p>
      </div>
    </div>
    <section class="panel">
      <div class="panel-body">
        ${ui.emptyState({
          icon: "◷",
          title: "还没有正在查看的运行",
          message: "先在「策略构建」中保存并启动一次实时模拟或回放，或前往「运行历史」打开已有运行。",
          actionHtml: `<div class="view-actions" style="justify-content:center">
            <button type="button" class="btn btn-primary" data-nav="/builder">前往策略构建</button>
            <button type="button" class="btn btn-ghost" data-nav="/history">查看运行历史</button>
          </div>`,
        })}
      </div>
    </section>
  </section>`;
  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-nav]") : null;
    if (target) ctx.navigate(target.dataset.nav);
  });
}
