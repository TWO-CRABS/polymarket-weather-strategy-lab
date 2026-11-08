/**
 * web/views/history.js — 运行历史：列表 / 详情 / 双运行对比
 *
 * 数据来源：GET /api/runs、GET /api/runs/:id、GET /api/runs/:id/equity
 * 对比口径：docs/04 §6 契约指标（含费 P&L、费用拖累、最大回撤、盈亏比等）
 */

import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";
import { createLineChart, drawSparkline } from "/web/components/charts.js";

const MAX_COMPARE = 2;

const DETAIL_METRICS = [
  { key: "equity", label: "总权益（含费）", type: "money", get: (run, metrics) => (num(run && run.equity) !== null ? run.equity : metrics.equity) },
  { key: "totalReturnPct", label: "总收益率", type: "pct", get: (run, metrics) => metrics.totalReturnPct },
  { key: "realizedPnl", label: "已实现盈亏", type: "moneyPnl", get: (run, metrics) => metrics.realizedPnl },
  { key: "unrealizedPnl", label: "未实现盈亏", type: "moneyPnl", get: (run, metrics) => metrics.unrealizedPnl },
  { key: "feesPaid", label: "手续费合计", type: "moneyFee", get: (run, metrics) => metrics.feesPaid },
  { key: "feeDragPct", label: "费用拖累（占本金）", type: "pctPlain", get: (run, metrics) => metrics.feeDragPct },
  { key: "winRate", label: "胜率", type: "winRate", get: (run, metrics) => metrics.winRate },
  { key: "profitFactor", label: "盈亏比", type: "ratio", get: (run, metrics) => metrics.profitFactor },
  { key: "maxDrawdownPct", label: "最大回撤", type: "pctDown", get: (run, metrics) => metrics.maxDrawdownPct },
  { key: "trades", label: "成交 / 平仓", type: "counts", get: (run, metrics) => [metrics.trades, metrics.closedTrades] },
  { key: "turnoverUsd", label: "双边成交额", type: "money", get: (run, metrics) => metrics.turnoverUsd },
  { key: "expectancy", label: "单笔期望", type: "moneyPnl4", get: (run, metrics) => metrics.expectancy },
  { key: "sharpe", label: "Sharpe", type: "ratio", get: (run, metrics) => metrics.sharpe },
];

const COMPARE_METRICS = [
  { key: "totalReturnPct", label: "总收益率", type: "pct", get: (data) => data.metrics.totalReturnPct, better: "high" },
  { key: "equity", label: "总权益", type: "money", get: (data) => (num(data.run.equity) !== null ? data.run.equity : data.metrics.equity), better: "high" },
  { key: "realizedPnl", label: "已实现盈亏", type: "moneyPnl", get: (data) => data.metrics.realizedPnl, better: "high" },
  { key: "unrealizedPnl", label: "未实现盈亏", type: "moneyPnl", get: (data) => data.metrics.unrealizedPnl, better: "high" },
  { key: "feesPaid", label: "手续费合计", type: "moneyFee", get: (data) => data.metrics.feesPaid, better: "low" },
  { key: "feeDragPct", label: "费用拖累 %", type: "pctPlain", get: (data) => data.metrics.feeDragPct, better: "low" },
  { key: "winRate", label: "胜率", type: "winRate", get: (data) => data.metrics.winRate, better: "high" },
  { key: "profitFactor", label: "盈亏比", type: "ratio", get: (data) => data.metrics.profitFactor, better: "high" },
  { key: "maxDrawdownPct", label: "最大回撤", type: "pctDown", get: (data) => data.metrics.maxDrawdownPct, better: "low" },
  { key: "trades", label: "成交笔数", type: "count", get: (data) => data.metrics.trades, better: "none" },
  { key: "closedTrades", label: "平仓回合", type: "count", get: (data) => data.metrics.closedTrades, better: "none" },
  { key: "turnoverUsd", label: "双边成交额", type: "money", get: (data) => data.metrics.turnoverUsd, better: "none" },
  { key: "expectancy", label: "单笔期望", type: "moneyPnl4", get: (data) => data.metrics.expectancy, better: "high" },
  { key: "sharpe", label: "Sharpe", type: "ratio", get: (data) => data.metrics.sharpe, better: "high" },
];

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function winRatePct(value) {
  const n = num(value);
  if (n === null) return null;
  return n <= 1 ? n * 100 : n;
}

function modeLabel(mode) {
  return mode === "replay" ? "回放" : mode === "live" ? "实时" : "—";
}

function formatMetric(type, value) {
  switch (type) {
    case "money": return ui.fmtMoney(num(value));
    case "moneyPnl": return num(value) === null ? "—" : ui.fmtSignedMoney(value);
    case "moneyPnl4": return num(value) === null ? "—" : ui.fmtSignedMoney(value, 4);
    case "moneyFee": return ui.fmtMoney(num(value), 5);
    case "pct": return num(value) === null ? "—" : ui.fmtPct(value, 2);
    case "pctPlain": return num(value) === null ? "—" : ui.fmtPctPlain(value, 4);
    case "pctDown": return num(value) === null ? "—" : `-${value.toFixed(2)}%`;
    case "winRate": {
      const pct = winRatePct(value);
      return pct === null ? "—" : ui.fmtPctPlain(pct, 2);
    }
    case "ratio": return num(value) === null ? "—" : ui.fmtNum(value, 2);
    case "count": return num(value) === null ? "—" : String(Math.round(value));
    case "counts": {
      const list = Array.isArray(value) ? value : [value, null];
      return `${list[0] === null || list[0] === undefined ? "—" : Math.round(list[0])} / ${list[1] === null || list[1] === undefined ? "—" : Math.round(list[1])}`;
    }
    default: return value === null || value === undefined ? "—" : String(value);
  }
}

function formatDiff(type, diff) {
  if (diff === null || diff === undefined || !Number.isFinite(diff)) return "—";
  const sign = diff > 0 ? "+" : "";
  switch (type) {
    case "money":
    case "moneyPnl":
    case "moneyPnl4":
      return `${sign}${ui.fmtMoney(diff)}`;
    case "moneyFee":
      return `${sign}${ui.fmtMoney(diff, 5)}`;
    case "pct":
      return `${sign}${diff.toFixed(2)}%`;
    case "pctPlain":
      return `${sign}${diff.toFixed(4)}%`;
    case "pctDown":
      return `${sign}${diff.toFixed(2)}%`;
    case "count":
    case "counts":
      return `${sign}${Math.round(diff)}`;
    default:
      return `${sign}${ui.fmtNum(diff, 2)}`;
  }
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export async function mount(root, ctx) {
  const state = {
    runs: [],
    loading: true,
    error: null,
    selected: new Set(),
    detailId: (ctx.params && ctx.params.id) || null,
    detailData: null,
    detailLoading: false,
    compareData: null,
    compareLoading: false,
    destroyed: false,
  };
  let detailChart = null;

  root.innerHTML = renderShell();
  const el = {
    runsBody: root.querySelector("#runsBody"),
    runsEmpty: root.querySelector("#runsEmpty"),
    runCount: root.querySelector("#runCountBadge"),
    tableWrap: root.querySelector("#runsTableWrap"),
    compareBar: root.querySelector("#compareBar"),
    compareCount: root.querySelector("#compareCount"),
    btnCompare: root.querySelector("#btnDoCompare"),
    detailPanel: root.querySelector("#detailPanel"),
    comparePanel: root.querySelector("#comparePanel"),
    errorBox: root.querySelector("#historyError"),
  };

  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  root.addEventListener("keydown", onKeydown);

  await loadRuns();
  if (state.detailId) await openDetail(state.detailId);

  const instance = {
    async refresh() {
      await loadRuns();
      if (state.detailId) await openDetail(state.detailId);
      if (state.selected.size === 2) await generateCompare();
    },
    destroy() {
      state.destroyed = true;
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("keydown", onKeydown);
      if (detailChart) {
        detailChart.destroy();
        detailChart = null;
      }
    },
  };
  return instance;

  /* -------------------- 外壳 -------------------- */

  function renderShell() {
    return `<section class="view is-active" id="view-history" aria-labelledby="historyTitle">
      <div class="view-head">
        <div>
          <h1 id="historyTitle">运行历史</h1>
          <p class="sub">回看每次模拟运行结果；勾选 2 条运行可并排对比关键指标（含费口径）。</p>
        </div>
        <div class="view-actions">
          <span class="chip chip-ghost" id="historyMeta">—</span>
          <button type="button" class="btn btn-ghost" id="btnRefreshHistory">刷新</button>
          <button type="button" class="btn btn-primary" data-nav="/builder">＋ 新建模拟运行</button>
        </div>
      </div>
      <div id="historyError"></div>

      <div class="compare-bar" id="compareBar" hidden>
        <span>已选择 <strong id="compareCount">0</strong> 条运行（最多 ${MAX_COMPARE} 条）</span>
        <button type="button" class="btn btn-primary btn-sm" id="btnDoCompare" disabled>生成对比</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnClearCompare">清空选择</button>
      </div>

      <section class="panel" aria-labelledby="h-runs">
        <header class="panel-head">
          <div class="panel-title">
            <h2 id="h-runs">模拟运行</h2>
            <p>按开始时间倒序 · 点击行查看详情</p>
          </div>
          <span class="badge badge-ghost" id="runCountBadge">—</span>
        </header>
        <div class="table-wrap" id="runsTableWrap">
          <table class="data-table table-runs">
            <caption class="sr-only">历史模拟运行列表：可勾选两条进行对比</caption>
            <thead>
              <tr>
                <th scope="col" class="check-col"><span class="sr-only">选择对比</span></th>
                <th scope="col">Run ID / 策略</th>
                <th scope="col">模式</th>
                <th scope="col">状态</th>
                <th scope="col">开始时间</th>
                <th scope="col" class="num-col">总权益</th>
                <th scope="col" class="num-col">收益率</th>
                <th scope="col" class="num-col">成交</th>
                <th scope="col" class="num-col">手续费</th>
                <th scope="col" class="num-col">最大回撤</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody id="runsBody"></tbody>
          </table>
          <div class="empty-hint" id="runsEmpty" hidden></div>
        </div>
      </section>

      <section class="panel compare-panel" id="detailPanel" hidden aria-labelledby="h-detail">
        <header class="panel-head">
          <div class="panel-title">
            <h2 id="h-detail">运行详情</h2>
            <p id="detailSub">—</p>
          </div>
          <div class="view-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="btnOpenDashboard">打开实时看板</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btnCloseDetail">收起</button>
          </div>
        </header>
        <div id="detailBody"></div>
      </section>

      <section class="panel compare-panel" id="comparePanel" hidden aria-labelledby="h-compare">
        <header class="panel-head">
          <div class="panel-title">
            <h2 id="h-compare">运行对比</h2>
            <p>同一指标口径下横向比较；含费 P&L 为主口径</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btnCloseCompare">收起</button>
        </header>
        <div id="compareBody"></div>
      </section>
    </section>`;
  }

  /* -------------------- 列表 -------------------- */

  async function loadRuns() {
    if (state.loading) renderLoading();
    try {
      const data = await api.getJSON("/api/runs");
      state.runs = Array.isArray(data && data.runs) ? data.runs : [];
      state.error = null;
      ctx.store.runs = state.runs;
      state.loading = false;
      renderTable();
    } catch (error) {
      state.loading = false;
      state.error = api.describeError(error);
      renderError();
    }
  }

  function renderLoading() {
    if (el.runsBody) el.runsBody.innerHTML = `<tr><td colspan="11">${ui.skeletonLines(4)}</td></tr>`;
  }

  function renderError() {
    if (el.errorBox) {
      el.errorBox.innerHTML = ui.errorState({
        title: state.error ? state.error.title : "加载失败",
        message: state.error ? state.error.detail : "",
        actionHtml: '<button type="button" class="btn btn-ghost" id="btnRetryHistory">重试</button>',
      });
    }
    document.getElementById("btnRetryHistory")?.addEventListener("click", () => loadRuns());
    if (el.runsEmpty) el.runsEmpty.hidden = true;
  }

  function renderTable() {
    if (el.errorBox) el.errorBox.innerHTML = "";
    if (el.runCount) el.runCount.textContent = `${state.runs.length} 条`;
    const meta = root.querySelector("#historyMeta");
    if (meta) meta.textContent = `共 ${state.runs.length} 条运行`;
    if (!el.runsBody) return;
    if (!state.runs.length) {
      el.runsBody.innerHTML = "";
      if (el.runsEmpty) {
        el.runsEmpty.hidden = false;
        el.runsEmpty.innerHTML = ui.emptyState({
          icon: "≡",
          title: "暂无运行记录",
          message: "去「策略构建」组合参数并启动一次实时模拟或回放；运行结束后会记录在这里。",
          actionHtml: '<button type="button" class="btn btn-primary" data-nav="/builder">前往策略构建</button>',
        });
      }
      updateCompareBar();
      return;
    }
    if (el.runsEmpty) el.runsEmpty.hidden = true;
    el.runsBody.innerHTML = state.runs.map((run) => {
      const metrics = run.metrics || {};
      const selected = state.selected.has(run.id);
      const active = ["running", "starting", "paused", "stopping"].includes(run.status);
      const started = num(run.startedAt);
      return `<tr data-run-id="${ui.escapeHtml(run.id)}" class="${selected ? "is-selected" : ""}" tabindex="0" aria-label="运行 ${ui.escapeHtml(run.id)}，${ui.escapeHtml(run.strategyName || "")}">
        <td class="check-col"><input type="checkbox" class="compare-toggle" data-compare-id="${ui.escapeHtml(run.id)}" ${selected ? "checked" : ""} aria-label="选择运行 ${ui.escapeHtml(run.id)} 参与对比"></td>
        <td><span class="mkt-name"><b>${ui.escapeHtml(run.strategyName || "未命名策略")}</b><span>${ui.escapeHtml(run.id)}</span></span></td>
        <td>${ui.modeBadge(run.mode)}</td>
        <td>${ui.runStatusBadge(run.status)}</td>
        <td class="num-col cell-dim">${ui.escapeHtml(ui.fmtDateTime(started))}</td>
        <td class="num-col">${ui.escapeHtml(ui.fmtMoney(num(run.equity)))}</td>
        <td class="num-col">${num(metrics.totalReturnPct) === null ? "—" : ui.pnlSpan(metrics.totalReturnPct, { digits: 2 })}</td>
        <td class="num-col">${num(metrics.trades) === null ? "—" : Math.round(metrics.trades)}</td>
        <td class="num-col cell-amber">${ui.escapeHtml(ui.fmtMoney(num(metrics.feesPaid), 5))}</td>
        <td class="num-col cell-dim">${num(metrics.maxDrawdownPct) === null ? "—" : `-${metrics.maxDrawdownPct.toFixed(2)}%`}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="link-btn" data-detail-id="${ui.escapeHtml(run.id)}">详情</button>
            <button type="button" class="link-btn" data-dashboard-id="${ui.escapeHtml(run.id)}">${active ? "看板" : "复盘"}</button>
          </div>
        </td>
      </tr>`;
    }).join("");
    updateCompareBar();
  }

  /* -------------------- 选择 / 对比栏 -------------------- */

  function updateCompareBar() {
    if (!el.compareBar) return;
    const count = state.selected.size;
    el.compareBar.hidden = count === 0;
    if (el.compareCount) el.compareCount.textContent = String(count);
    if (el.btnCompare) el.btnCompare.disabled = count !== MAX_COMPARE;
    if (el.btnCompare) el.btnCompare.textContent = count === MAX_COMPARE ? "生成对比" : `生成对比（还差 ${MAX_COMPARE - count} 条）`;
  }

  function toggleCompare(id, checked) {
    if (checked) {
      if (state.selected.size >= MAX_COMPARE) {
        ui.toast(`最多只能选择 ${MAX_COMPARE} 条运行进行对比`, { type: "warn", timeout: 2400 });
        return false;
      }
      state.selected.add(id);
    } else {
      state.selected.delete(id);
    }
    updateCompareBar();
    renderTable();
    // docs/05 §4.3：选中 2 条即自动展开对比面板
    if (state.selected.size === MAX_COMPARE) {
      generateCompare();
    }
    return true;
  }

  /* -------------------- 详情 -------------------- */

  async function openDetail(runId) {
    if (!runId || state.destroyed) return;
    state.detailId = runId;
    state.detailLoading = true;
    if (el.detailPanel) el.detailPanel.hidden = false;
    const body = root.querySelector("#detailBody");
    const sub = root.querySelector("#detailSub");
    if (sub) sub.textContent = runId;
    if (body) body.innerHTML = `<div class="panel-body">${ui.skeletonLines(5)}</div>`;
    try {
      const [detailRes, equityRes] = await Promise.allSettled([
        api.getJSON(`/api/runs/${encodeURIComponent(runId)}`),
        api.getJSON(`/api/runs/${encodeURIComponent(runId)}/equity?limit=2000`),
      ]);
      if (state.destroyed) return;
      if (detailRes.status !== "fulfilled" || !detailRes.value || !detailRes.value.run) {
        throw detailRes.status === "fulfilled" ? new api.ApiError("运行不存在", { code: "RUN_NOT_FOUND", status: 404 }) : detailRes.reason;
      }
      const run = detailRes.value.run;
      const config = detailRes.value.config || null;
      const metrics = detailRes.value.metrics || run.metrics || {};
      const points = equityRes.status === "fulfilled" && equityRes.value && Array.isArray(equityRes.value.points)
        ? equityRes.value.points.filter((point) => num(point && point.equity) !== null)
        : [];
      state.detailData = { run, config, metrics, points, positions: detailRes.value.positions || [] };
      state.detailLoading = false;
      renderDetail();
    } catch (error) {
      if (state.destroyed) return;
      state.detailLoading = false;
      const {
        title, detail,
      } = api.describeError(error);
      if (body) {
        body.innerHTML = `<div class="panel-body">${ui.errorState({ title, message: detail })}</div>`;
      }
    }
  }

  function renderDetail() {
    const data = state.detailData;
    const body = root.querySelector("#detailBody");
    const sub = root.querySelector("#detailSub");
    if (!data || !body) return;
    const { run, metrics, config, points, positions } = data;
    if (sub) sub.textContent = `${run.strategyName || "未命名策略"} · ${run.id}`;

    const cards = DETAIL_METRICS.map((metric) => {
      const value = metric.get(run, metrics);
      const formatted = formatMetric(metric.type, value);
      const cls = metric.type === "pct" || metric.type === "moneyPnl" || metric.type === "moneyPnl4"
        ? ui.dirClass(num(value))
        : metric.type === "pctDown" ? "down" : "";
      return `<div class="detail-kv"><span>${ui.escapeHtml(metric.label)}</span><strong class="${cls}">${ui.escapeHtml(formatted)}</strong></div>`;
    }).join("");

    const started = num(run.startedAt);
    const ended = num(run.endedAt);
    const duration = started !== null && ended !== null ? ui.fmtDuration(ended - started) : "—";
    const cfgChips = config ? [
      `窗口 ${config.signal ? config.signal.windowSec : "—"}s`,
      `阈值 ±${config.signal ? config.signal.moveThresholdPct : "—"}%`,
      `最小变动 ${config.signal ? ui.fmtCents(config.signal.minAbsMove, 2) : "—"}`,
      `方向 ${config.signal ? config.signal.direction : "—"}`,
      `仓位 ${config.execution ? config.execution.sizingMode : "—"} ${config.execution ? config.execution.sizingValue : "—"}`,
      `最大持仓 ${config.execution ? config.execution.maxPositions : "—"}`,
      `初始资金 ${config.risk ? ui.fmtMoney(config.risk.bankrollUsd) : "—"}`,
      `taker 费率 ${config.fees ? config.fees.takerFeeRate : "—"}`,
    ].map((chip) => `<span class="feed-chip">${ui.escapeHtml(chip)}</span>`).join("") : "";

    body.innerHTML = `
      <div class="feed-chip-row">
        ${ui.modeBadge(run.mode)}
        ${ui.runStatusBadge(run.status)}
        <span class="feed-chip">开始 ${ui.escapeHtml(ui.fmtDateTime(started))}</span>
        <span class="feed-chip">时长 ${ui.escapeHtml(duration)}</span>
        <span class="feed-chip">持仓 ${positions.length} 个</span>
        ${cfgChips}
      </div>
      <div class="detail-grid">${cards}</div>
      <div class="chart-wrap"><canvas id="detailChart" class="chart-canvas chart-canvas-sm" aria-label="运行权益曲线" role="img"></canvas></div>
      <div class="detail-meta">
        <span>策略参数：${config ? ui.escapeHtml(JSON.stringify({
          windowSec: config.signal && config.signal.windowSec,
          moveThresholdPct: config.signal && config.signal.moveThresholdPct,
          minAbsMove: config.signal && config.signal.minAbsMove,
          confirmationTicks: config.signal && config.signal.confirmationTicks,
          cooldownSec: config.signal && config.signal.cooldownSec,
          maxPositions: config.execution && config.execution.maxPositions,
        })) : "—"}</span>
      </div>
      <div class="drawer-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-dashboard-id="${ui.escapeHtml(run.id)}">打开实时看板</button>
        <button type="button" class="btn btn-ghost btn-sm" data-compare-id="${ui.escapeHtml(run.id)}">加入对比</button>
      </div>`;

    if (detailChart) {
      detailChart.destroy();
      detailChart = null;
    }
    const canvas = body.querySelector("#detailChart");
    if (canvas) {
      detailChart = createLineChart(canvas, {
        color: "#22D3EE",
        seriesName: "总权益（含费）",
        yFormat: (value) => ui.fmtMoney(value),
        xFormat: (ts) => ui.fmtTime(ts),
        ariaLabel: "运行权益曲线",
        baseline: num(run.initialCapital),
        baselineLabel: "初始资金",
      });
      detailChart.setData(points.map((point) => ({ ts: point.ts, value: point.equity })));
    }
  }

  /* -------------------- 对比 -------------------- */

  async function generateCompare() {
    const ids = [...state.selected];
    if (ids.length !== MAX_COMPARE) {
      ui.toast(`请选择 ${MAX_COMPARE} 条运行再进行对比`, { type: "warn", timeout: 2400 });
      return;
    }
    state.compareLoading = true;
    if (el.comparePanel) el.comparePanel.hidden = false;
    const body = root.querySelector("#compareBody");
    if (body) body.innerHTML = `<div class="panel-body">${ui.skeletonLines(6)}</div>`;
    try {
      const results = await Promise.all(ids.map(async (id) => {
        const [detailRes, equityRes] = await Promise.allSettled([
          api.getJSON(`/api/runs/${encodeURIComponent(id)}`),
          api.getJSON(`/api/runs/${encodeURIComponent(id)}/equity?limit=2000`),
        ]);
        if (detailRes.status !== "fulfilled" || !detailRes.value || !detailRes.value.run) {
          throw new Error(`运行 ${id} 加载失败`);
        }
        const run = detailRes.value.run;
        const metrics = detailRes.value.metrics || run.metrics || {};
        const points = equityRes.status === "fulfilled" && equityRes.value && Array.isArray(equityRes.value.points)
          ? equityRes.value.points.filter((point) => num(point && point.equity) !== null)
          : [];
        return { run, metrics, points };
      }));
      if (state.destroyed) return;
      state.compareData = results;
      state.compareLoading = false;
      renderCompare();
    } catch (error) {
      if (state.destroyed) return;
      state.compareLoading = false;
      if (body) body.innerHTML = `<div class="panel-body">${ui.errorState({ title: "对比加载失败", message: error && error.message ? error.message : "" })}</div>`;
    }
  }

  function renderCompare() {
    const body = root.querySelector("#compareBody");
    const data = state.compareData;
    if (!body || !Array.isArray(data) || data.length !== 2) return;
    const [a, b] = data;

    const column = (item, tag) => {
      const run = item.run;
      const equityValues = item.points.map((point) => point.equity);
      return `<div class="compare-col">
        <h3>${ui.escapeHtml(run.strategyName || "未命名策略")} <span class="badge ${tag === "A" ? "badge-cyan" : "badge-ghost"}">${tag}</span></h3>
        <div class="compare-id">${ui.escapeHtml(run.id)} · ${ui.escapeHtml(modeLabel(run.mode))} · ${ui.escapeHtml(ui.runStatusMeta(run.status).label)}</div>
        <canvas class="mini-chart" data-mini-id="${ui.escapeHtml(run.id)}" width="300" height="46" aria-hidden="true"></canvas>
        <div class="compare-kv"><span>开始</span><strong>${ui.escapeHtml(ui.fmtDateTime(num(run.startedAt)))}</strong></div>
        <div class="compare-kv"><span>总收益率</span><strong class="${ui.dirClass(num(item.metrics.totalReturnPct))}">${ui.escapeHtml(formatMetric("pct", item.metrics.totalReturnPct))}</strong></div>
        <div class="compare-kv"><span>总权益</span><strong>${ui.escapeHtml(ui.fmtMoney(num(run.equity)))}</strong></div>
        <div class="compare-kv"><span>手续费</span><strong class="amber">${ui.escapeHtml(ui.fmtMoney(num(item.metrics.feesPaid), 5))}</strong></div>
      </div>`;
    };

    const rows = COMPARE_METRICS.map((metric) => {
      const va = metric.get(a);
      const vb = metric.get(b);
      const na = num(va);
      const nb = num(vb);
      const diff = na !== null && nb !== null ? nb - na : null;
      let best = "";
      if (metric.better !== "none" && na !== null && nb !== null && na !== nb) {
        const bIsBetter = metric.better === "high" ? nb > na : nb < na;
        best = bIsBetter ? "B" : "A";
      }
      return `<tr>
        <td>${ui.escapeHtml(metric.label)}</td>
        <td class="num-col ${best === "A" ? "cell-up" : ""}">${ui.escapeHtml(formatMetric(metric.type, va))}${best === "A" ? ' <span class="sr-only">更优</span>' : ""}</td>
        <td class="num-col ${best === "B" ? "cell-up" : ""}">${ui.escapeHtml(formatMetric(metric.type, vb))}${best === "B" ? ' <span class="sr-only">更优</span>' : ""}</td>
        <td class="num-col ${diff !== null && diff > 0 ? "cell-up" : diff !== null && diff < 0 ? "cell-down" : "cell-dim"}">${ui.escapeHtml(formatDiff(metric.type, diff))}</td>
      </tr>`;
    }).join("");

    body.innerHTML = `<div class="compare-grid">
        ${column(a, "A")}
        ${column(b, "B")}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <caption class="sr-only">两个运行的指标对比与差异（差异 = B − A）</caption>
          <thead><tr><th scope="col">指标</th><th scope="col" class="num-col">运行 A</th><th scope="col" class="num-col">运行 B</th><th scope="col" class="num-col">差异（B − A）</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="chart-foot"><span class="muted">对比口径：含费 P&amp;L；手续费 5 位小数；绿色标记为更优值（回撤/费用越低越优）。</span></div>`;

    // 用 sparkline 画两列迷你权益曲线（避免两个图表实例开销）
    for (const item of data) {
      const canvas = body.querySelector(`canvas[data-mini-id="${cssEscape(item.run.id)}"]`);
      if (canvas) drawSparkline(canvas, item.points.map((point) => point.equity), { fill: true });
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* -------------------- 事件 -------------------- */

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#btnRefreshHistory")) {
      loadRuns();
      ui.toast("已刷新运行历史", { type: "info", timeout: 1500 });
      return;
    }
    const nav = target.closest("[data-nav]");
    if (nav) {
      ctx.navigate(nav.dataset.nav);
      return;
    }
    const dashboardBtn = target.closest("[data-dashboard-id]");
    if (dashboardBtn) {
      ctx.rememberRun(dashboardBtn.dataset.dashboardId);
      ctx.navigate(`/dashboard?run=${encodeURIComponent(dashboardBtn.dataset.dashboardId)}`);
      return;
    }
    const detailBtn = target.closest("[data-detail-id]");
    if (detailBtn) {
      openDetail(detailBtn.dataset.detailId);
      return;
    }
    const compareAdd = target.closest("[data-compare-id]");
    if (compareAdd && !target.closest("input[type=checkbox]")) {
      const id = compareAdd.dataset.compareId;
      toggleCompare(id, !state.selected.has(id));
      return;
    }
    if (target.closest("#btnCloseDetail")) {
      if (el.detailPanel) el.detailPanel.hidden = true;
      state.detailId = null;
      if (detailChart) {
        detailChart.destroy();
        detailChart = null;
      }
      return;
    }
    if (target.closest("#btnOpenDashboard")) {
      if (state.detailId) {
        ctx.rememberRun(state.detailId);
        ctx.navigate(`/dashboard?run=${encodeURIComponent(state.detailId)}`);
      }
      return;
    }
    if (target.closest("#btnDoCompare")) {
      generateCompare();
      return;
    }
    if (target.closest("#btnClearCompare")) {
      state.selected.clear();
      state.compareData = null;
      if (el.comparePanel) el.comparePanel.hidden = true;
      renderTable();
      return;
    }
    if (target.closest("#btnCloseCompare")) {
      if (el.comparePanel) el.comparePanel.hidden = true;
      return;
    }
    // 行点击：打开详情（复选框与按钮除外）
    if (!target.closest("input") && !target.closest("button")) {
      const row = target.closest("tr[data-run-id]");
      if (row) openDetail(row.dataset.runId);
    }
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const checkbox = target.closest("input.compare-toggle");
    if (!checkbox) return;
    const id = checkbox.dataset.compareId;
    const ok = toggleCompare(id, checkbox.checked);
    if (!ok) checkbox.checked = false;
  }

  function onKeydown(event) {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr[data-run-id]");
    if (row) openDetail(row.dataset.runId);
  }
}
