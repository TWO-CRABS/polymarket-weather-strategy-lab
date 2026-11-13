/**
 * web/views/mirror.js — simple continuous mirror-copy mode.
 *
 * This intentionally implements the simplified scope: mirror BUY/SELL of one
 * public trader in the selected weather markets. It does not model add/reduce,
 * partial fills, selling with no local position, or cross-market portfolio
 * reconciliation.
 */
import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";
import { DEFAULT_STRATEGY } from "/shared/contract.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isWallet(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

export async function mount(root, ctx = {}) {
  const state = {
    meta: ctx.store?.meta || null,
    loading: true,
    starting: false,
    error: "",
    wallet: "",
    amount: 25,
    takerOnly: true,
    destroyed: false,
  };

  root.innerHTML = `
    <section class="view is-active">
      <div class="view-head">
        <div>
          <div class="eyebrow">MIRROR COPY / SIMPLE MODE</div>
          <h1>镜像跟单</h1>
          <p class="view-sub">持续跟随一个公开钱包在当前天气市场的买卖成交。简化模式：不处理对方加减仓、部分成交、无仓位卖出、滑点和风控拒单。</p>
        </div>
      </div>
      <div class="panel mirror-panel">
        <div class="panel-body">
          <div id="mirrorBody"><div class="empty-state">加载配置…</div></div>
        </div>
      </div>
    </section>`;

  const body = root.querySelector("#mirrorBody");

  function render() {
    if (state.destroyed) return;
    if (state.loading) {
      body.innerHTML = '<div class="empty-state">加载配置…</div>';
      return;
    }
    body.innerHTML = `
      <div class="mirror-form">
        <div class="mirror-field mirror-field-wide">
          <label class="field-label" for="mirrorWallet">镜像钱包地址</label>
          <input class="input" id="mirrorWallet" placeholder="0x...（Polymarket proxy wallet）" value="${ui.escapeHtml(state.wallet)}" spellcheck="false">
          <p class="muted">只读该钱包的公开成交；当前支持天气市场，Taker 主动成交默认开启。</p>
        </div>
        <div class="mirror-field">
          <label class="field-label" for="mirrorAmount">每笔金额 USD</label>
          <input class="input" id="mirrorAmount" type="number" min="1" max="10000" step="1" value="${ui.escapeHtml(String(state.amount))}">
          <p class="muted">每笔跟单使用固定名义金额，不复制对方仓位大小。</p>
        </div>
        <div class="mirror-field">
          <label class="field-label" for="mirrorTaker">成交类型</label>
          <label class="mirror-check"><input id="mirrorTaker" type="checkbox" ${state.takerOnly ? "checked" : ""}> 只跟主动成交（Taker）</label>
          <p class="muted">关闭后会同时跟 Maker 被动成交，但可能跟到挂单成交。</p>
        </div>
        <div class="mirror-field mirror-field-wide">
          <div class="mirror-actions">
            <button class="btn btn-primary" id="mirrorStart" type="button" ${state.starting ? "disabled" : ""}>${state.starting ? "启动中…" : "开始镜像跟单"}</button>
            <span class="muted">启动后会创建一个实时模拟运行，交易仍走当前风控与仓位限制。</span>
          </div>
        </div>
        ${state.error ? `<div class="mirror-error">${ui.escapeHtml(state.error)}</div>` : ""}
      </div>`;

    body.querySelector("#mirrorWallet")?.addEventListener("input", (event) => {
      state.wallet = event.target.value.trim();
    });
    body.querySelector("#mirrorAmount")?.addEventListener("input", (event) => {
      state.amount = Math.max(1, Number(event.target.value) || 1);
    });
    body.querySelector("#mirrorTaker")?.addEventListener("change", (event) => {
      state.takerOnly = event.target.checked;
    });
    body.querySelector("#mirrorStart")?.addEventListener("click", () => { void startMirror(); });
  }

  async function startMirror() {
    state.error = "";
    const wallet = state.wallet.trim().toLowerCase();
    if (!isWallet(wallet)) {
      state.error = "请输入 0x 开头的 40 字节钱包地址。";
      render();
      return;
    }
    state.starting = true;
    render();
    try {
      const meta = state.meta || await api.getJSON("/api/meta", { timeoutMs: 8000 });
      state.meta = meta;
      const config = clone(DEFAULT_STRATEGY);
      config.name = `镜像跟单 · ${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
      config.description = "简化镜像模式：持续跟随目标钱包的天气市场买卖。";
      config.universe.cities = Array.isArray(meta.cities) ? meta.cities.slice() : [];
      config.universe.minPrice = 0.01;
      config.universe.maxPrice = 0.99;
      config.universe.minLiquidityUsd = 0;
      config.universe.maxSpread = 0.2;
      config.signal.copyTraderEnabled = true;
      config.signal.copyTraderMode = "mirror";
      config.signal.copyTraderUser = wallet;
      config.signal.mirrorTakerOnly = state.takerOnly;
      config.signal.copyTraderSubstituteCount = 1;
      config.execution.sizingMode = "fixed_stake";
      config.execution.sizingValue = state.amount;
      config.execution.maxPositionUsd = state.amount;
      config.execution.maxPositions = 10;
      config.execution.maxPositionsPerMarket = 1;
      config.exit.holdToResolution = true;
      config.risk.bankrollUsd = Math.max(1000, state.amount * 20);
      config.risk.maxDrawdownPct = 100;
      config.risk.dailyLossLimitUsd = 0;
      config.risk.killSwitch = false;
      config.sim.mode = "live";
      config.sim.tickIntervalMs = 1000;
      const run = await api.postJSON("/api/runs", { strategy: config, mode: "live" }, { timeoutMs: 25_000 });
      if (!run?.id) throw new Error("服务端未返回运行 ID");
      location.hash = `#/dashboard?run=${encodeURIComponent(run.id)}`;
    } catch (error) {
      state.error = error?.message || String(error);
      state.starting = false;
      render();
    }
  }

  render();
  if (!state.meta) {
    try {
      state.meta = await api.getJSON("/api/meta", { timeoutMs: 8000 });
    } catch {
      state.error = "无法加载城市配置，请确认服务已启动。";
    }
  }
  state.loading = false;
  render();
  return {
    destroy() {
      state.destroyed = true;
      root.innerHTML = "";
    },
  };
}

export function destroy() {}
