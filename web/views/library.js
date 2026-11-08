/**
 * web/views/library.js — 策略库：内置预设 + 已保存策略
 *
 * 数据来源：
 *  - GET /api/strategies → 已保存策略（name/description/updatedAt/config）
 *  - /api/meta.presets 或 shared/contract.js STRATEGY_PRESETS → 预设策略
 * 操作：编辑（载入构建器）/ 复制 / 删除（DELETE /api/strategies/:id）/ 载入预设
 */

import { STRATEGY_PRESETS, clone, normalizeStrategy, DEFAULT_STRATEGY } from "/shared/contract.js";
import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";

const SIZING_LABELS = { fixed_stake: "固定金额", pct_equity: "权益比例" };

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function presetsOf(store) {
  const fromMeta = store && store.meta && Array.isArray(store.meta.presets) ? store.meta.presets : null;
  return fromMeta && fromMeta.length ? fromMeta : STRATEGY_PRESETS;
}

function keyParams(config) {
  const cfg = normalizeStrategy(config || DEFAULT_STRATEGY);
  return [
    { label: "窗口", value: `${cfg.signal.windowSec}s` },
    { label: "触发阈值", value: `±${cfg.signal.moveThresholdPct}%` },
    { label: "最小变动", value: ui.fmtCents(cfg.signal.minAbsMove, 2) },
    { label: "确认 Tick", value: `${cfg.signal.confirmationTicks}` },
    { label: "单笔仓位", value: cfg.execution.sizingMode === "pct_equity" ? `${cfg.execution.sizingValue}%` : ui.fmtMoney(cfg.execution.sizingValue) },
    { label: "最大持仓", value: `${cfg.execution.maxPositions}` },
    { label: "初始资金", value: ui.fmtMoney(cfg.risk.bankrollUsd) },
    { label: "止盈/止损", value: `${cfg.exit.takeProfitPct}% / ${cfg.exit.stopLossPct}%` },
  ];
}

function configChips(config) {
  return keyParams(config).map((item) => `<span>${ui.escapeHtml(item.label)} ${ui.escapeHtml(item.value)}</span>`).join("");
}

function statCells(config) {
  const cfg = normalizeStrategy(config || DEFAULT_STRATEGY);
  return [
    { label: "触发阈值", value: `±${cfg.signal.moveThresholdPct}%` },
    { label: "单笔仓位", value: cfg.execution.sizingMode === "pct_equity" ? `${cfg.execution.sizingValue}%` : ui.fmtMoney(cfg.execution.sizingValue) },
    { label: "最大持仓", value: `${cfg.execution.maxPositions}` },
  ].map((item) => `<div class="strategy-stat"><span>${ui.escapeHtml(item.label)}</span><strong>${ui.escapeHtml(item.value)}</strong></div>`).join("");
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export async function mount(root, ctx) {
  const state = {
    strategies: [],
    presets: presetsOf(ctx.store),
    loading: true,
    error: null,
    busyId: null,
    destroyed: false,
  };

  root.innerHTML = renderShell();
  root.addEventListener("click", onClick);

  await loadStrategies();

  const instance = {
    async refresh() {
      await loadStrategies();
      state.presets = presetsOf(ctx.store);
      renderPresets();
    },
    destroy() {
      state.destroyed = true;
      root.removeEventListener("click", onClick);
    },
  };
  return instance;

  /* -------------------- 外壳 -------------------- */

  function renderShell() {
    return `<section class="view is-active" id="view-library" aria-labelledby="libraryTitle">
      <div class="view-head">
        <div>
          <h1 id="libraryTitle">策略库</h1>
          <p class="sub">内置预设与自定义策略；载入构建器后可直接启动实时模拟或回放。</p>
        </div>
        <div class="view-actions">
          <span class="chip chip-ghost" id="libraryMeta">—</span>
          <button type="button" class="btn btn-ghost" id="btnRefreshLibrary">刷新</button>
          <button type="button" class="btn btn-primary" data-nav="/builder">＋ 新建策略</button>
        </div>
      </div>
      <div id="libraryError"></div>

      <section class="library-section" aria-labelledby="h-presets">
        <div class="view-head">
          <div>
            <h2 class="view-sub" id="h-presets">内置预设</h2>
            <p class="muted-note">来自服务端 /api/meta 的 presets（与 shared/contract.js 一致），不可删除。</p>
          </div>
        </div>
        <div class="library-grid" id="presetGrid"></div>
      </section>

      <section class="library-section" aria-labelledby="h-saved">
        <div class="view-head">
          <div>
            <h2 class="view-sub" id="h-saved">我的策略</h2>
            <p class="muted-note">保存于服务端 data/store.json；编辑后可直接启动模拟。</p>
          </div>
          <span class="badge badge-ghost" id="savedCount">—</span>
        </div>
        <div class="library-grid" id="savedGrid"></div>
        <div id="savedEmpty" hidden></div>
      </section>
    </section>`;
  }

  function renderPresets() {
    const grid = root.querySelector("#presetGrid");
    if (!grid) return;
    if (!state.presets.length) {
      grid.innerHTML = ui.emptyState({ icon: "◈", title: "暂无预设", message: "服务端 /api/meta 未返回预设策略。" });
      return;
    }
    grid.innerHTML = state.presets.map((preset) => {
      const config = preset.config || {};
      return `<article class="strategy-card">
        <div class="strategy-top">
          <div>
            <div class="strategy-title">${ui.escapeHtml(preset.label || preset.id || "预设策略")}</div>
            <div class="strategy-updated">预设 ID · ${ui.escapeHtml(preset.id || "—")}</div>
          </div>
          <span class="badge badge-cyan strategy-badge">内置预设</span>
        </div>
        <p class="strategy-desc">${ui.escapeHtml(preset.description || "—")}</p>
        <div class="strategy-tags">${configChips(config)}</div>
        <div class="strategy-stats">${statCells(config)}</div>
        <div class="strategy-actions">
          <button type="button" class="btn btn-primary btn-sm" data-preset-id="${ui.escapeHtml(preset.id || "")}">载入构建器</button>
        </div>
      </article>`;
    }).join("");
  }

  function renderSaved() {
    const grid = root.querySelector("#savedGrid");
    const empty = root.querySelector("#savedEmpty");
    const countBadge = root.querySelector("#savedCount");
    if (countBadge) countBadge.textContent = `${state.strategies.length} 个`;
    if (!grid) return;
    if (!state.strategies.length) {
      grid.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.innerHTML = `<section class="panel"><div class="panel-body">${ui.emptyState({
          icon: "◈",
          title: "还没有保存的策略",
          message: "在「策略构建」中调整参数后点击「保存策略」，即可在策略库中管理、复制与删除。",
          actionHtml: '<button type="button" class="btn btn-primary" data-nav="/builder">前往策略构建</button>',
        })}</div></section>`;
      }
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = state.strategies.map((strategy) => {
      const config = strategy.config || {};
      const busy = state.busyId === strategy.id;
      return `<article class="strategy-card" data-strategy-id="${ui.escapeHtml(strategy.id)}">
        <div class="strategy-top">
          <div>
            <div class="strategy-title">${ui.escapeHtml(strategy.name || "未命名策略")}</div>
            <div class="strategy-updated">更新于 ${ui.escapeHtml(ui.fmtRelative(num(strategy.updatedAt)))} · ${ui.escapeHtml(strategy.id)}</div>
          </div>
          <span class="badge badge-ghost strategy-badge">自定义</span>
        </div>
        <p class="strategy-desc">${ui.escapeHtml(strategy.description || "无描述")}</p>
        <div class="strategy-tags">${configChips(config)}</div>
        <div class="strategy-stats">${statCells(config)}</div>
        <div class="strategy-actions">
          <button type="button" class="btn btn-primary btn-sm" data-edit-id="${ui.escapeHtml(strategy.id)}" ${busy ? "disabled" : ""}>编辑</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-id="${ui.escapeHtml(strategy.id)}" ${busy ? "disabled" : ""}>复制</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-delete-id="${ui.escapeHtml(strategy.id)}" ${busy ? "disabled" : ""}>删除</button>
        </div>
      </article>`;
    }).join("");
  }

  function renderLoading() {
    const preset = root.querySelector("#presetGrid");
    const saved = root.querySelector("#savedGrid");
    if (preset) {
      preset.innerHTML = Array.from({ length: 3 }, () => `<article class="strategy-card">${ui.skeletonLines(4)}</article>`).join("");
    }
    if (saved) saved.innerHTML = Array.from({ length: 3 }, () => `<article class="strategy-card">${ui.skeletonLines(4)}</article>`).join("");
  }

  function renderMeta() {
    const meta = root.querySelector("#libraryMeta");
    if (meta) meta.textContent = `${state.presets.length} 个预设 · ${state.strategies.length} 个自定义策略`;
  }

  /* -------------------- 数据 -------------------- */

  async function loadStrategies() {
    if (state.loading) {
      renderPresets();
      renderLoading();
    }
    try {
      const data = await api.getJSON("/api/strategies");
      state.strategies = Array.isArray(data && data.strategies) ? data.strategies : [];
      state.loading = false;
      state.error = null;
      ctx.store.strategies = state.strategies;
      const errorBox = root.querySelector("#libraryError");
      if (errorBox) errorBox.innerHTML = "";
      renderPresets();
      renderSaved();
      renderMeta();
    } catch (error) {
      state.loading = false;
      state.error = api.describeError(error);
      const errorBox = root.querySelector("#libraryError");
      if (errorBox) {
        errorBox.innerHTML = ui.errorState({
          title: state.error.title,
          message: state.error.detail,
          actionHtml: '<button type="button" class="btn btn-ghost" id="btnRetryLibrary">重试</button>',
        });
        errorBox.querySelector("#btnRetryLibrary")?.addEventListener("click", loadStrategies);
      }
      renderPresets();
      const saved = root.querySelector("#savedGrid");
      if (saved) saved.innerHTML = "";
      const empty = root.querySelector("#savedEmpty");
      if (empty) empty.hidden = true;
    }
  }

  /* -------------------- 操作 -------------------- */

  async function copyStrategy(strategy) {
    if (state.busyId) return;
    state.busyId = strategy.id;
    renderSaved();
    try {
      const config = clone(strategy.config || DEFAULT_STRATEGY);
      config.name = `${strategy.name || "未命名策略"} 副本`;
      const res = await api.postJSON("/api/strategies", config);
      const created = res && res.strategy;
      ui.toast("策略已复制", { type: "success", detail: created ? created.name : config.name, timeout: 2600 });
      await ctx.refreshStrategies(false);
      await loadStrategies();
      renderMeta();
    } catch (error) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    } finally {
      state.busyId = null;
      renderSaved();
    }
  }

  async function deleteStrategy(strategy) {
    if (state.busyId) return;
    const confirmed = await ui.confirmDialog({
      title: "删除策略？",
      message: `将永久删除策略「${strategy.name || "未命名策略"}」（${strategy.id}）。历史运行记录不会受影响。`,
      confirmText: "删除",
      danger: true,
    });
    if (!confirmed || state.destroyed) return;
    state.busyId = strategy.id;
    renderSaved();
    try {
      await api.del(`/api/strategies/${encodeURIComponent(strategy.id)}`);
      ui.toast("策略已删除", { type: "success", detail: strategy.name || strategy.id, timeout: 2400 });
      await ctx.refreshStrategies(false);
      await loadStrategies();
      renderMeta();
    } catch (error) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    } finally {
      state.busyId = null;
      renderSaved();
    }
  }

  /* -------------------- 事件 -------------------- */

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest("#btnRefreshLibrary")) {
      state.loading = true;
      loadStrategies().then(() => {
        renderMeta();
        ui.toast("策略库已刷新", { type: "info", timeout: 1500 });
      });
      return;
    }

    const nav = target.closest("[data-nav]");
    if (nav) {
      ctx.navigate(nav.dataset.nav);
      return;
    }

    const presetBtn = target.closest("[data-preset-id]");
    if (presetBtn) {
      const presetId = presetBtn.dataset.presetId;
      if (presetId) ctx.navigate(`/builder?preset=${encodeURIComponent(presetId)}`);
      return;
    }

    const editBtn = target.closest("[data-edit-id]");
    if (editBtn) {
      ctx.navigate(`/builder?strategy=${encodeURIComponent(editBtn.dataset.editId)}`);
      return;
    }

    const copyBtn = target.closest("[data-copy-id]");
    if (copyBtn) {
      const strategy = state.strategies.find((item) => item.id === copyBtn.dataset.copyId);
      if (strategy) copyStrategy(strategy);
      return;
    }

    const deleteBtn = target.closest("[data-delete-id]");
    if (deleteBtn) {
      const strategy = state.strategies.find((item) => item.id === deleteBtn.dataset.deleteId);
      if (strategy) deleteStrategy(strategy);
    }
  }
}
