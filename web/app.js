/**
 * web/app.js — 应用入口：hash 路由、页面装配、共享状态、顶栏状态与快捷键
 *
 * 路由：
 *   #/builder                     策略构建
 *   #/dashboard?run=<runId>       实时看板
 *   #/history                     运行历史（可 ?id=<runId> 打开详情）
 *   #/library                     策略库
 *
 * 初始化：GET /api/meta（契约版本/城市/预设/费率/limits）、GET /api/strategies、
 * GET /api/runs；随后打开全局 SSE 维护行情状态与运行指示灯。
 * 页面内所有请求均为同源 /api，不访问任何外部网络。
 */

import { CONTRACT_VERSION } from "/shared/contract.js";
import * as api from "/web/api.js";
import * as ui from "/web/components/ui.js";
import * as builderView from "/web/views/builder.js";
import * as dashboardView from "/web/views/dashboard.js";
import * as historyView from "/web/views/history.js";
import * as libraryView from "/web/views/library.js";

const LAST_RUN_KEY = "polytemp.lastRunId";

/* ------------------------------------------------------------------ */
/* 共享状态                                                            */
/* ------------------------------------------------------------------ */

export const store = {
  meta: null,
  strategies: [],
  runs: [],
  currentRunId: null,
  currentRun: null,
  lastRunId: null,
  contractVersion: CONTRACT_VERSION,
  feedStatus: "connecting",
  feed: { status: "connecting", marketsTracked: 0, lastUpdate: 0, latencyMs: null },
  streamStatus: "connecting",
  runStatuses: new Map(),
  serverTimeOffset: 0,
  apiOnline: false,
};

try {
  store.lastRunId = localStorage.getItem(LAST_RUN_KEY) || null;
} catch {
  store.lastRunId = null;
}

/** 记住最近一次打开/创建的运行，方便“实时看板”标签直接进入。 */
export function rememberRun(runId) {
  store.lastRunId = runId || null;
  store.currentRunId = runId || null;
  try {
    if (runId) localStorage.setItem(LAST_RUN_KEY, runId);
    else localStorage.removeItem(LAST_RUN_KEY);
  } catch {
    /* ignore */
  }
}

function anyRunActive() {
  for (const status of store.runStatuses.values()) {
    if (["running", "starting", "paused", "stopping"].includes(status)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* DOM 引用                                                            */
/* ------------------------------------------------------------------ */

const dom = {
  mount: document.getElementById("view-mount"),
  feedStatus: document.getElementById("feedStatus"),
  feedStatusLabel: document.getElementById("feedStatusLabel"),
  feedLatency: document.getElementById("feedLatency"),
  serverClock: document.getElementById("serverClock"),
  contractVersion: document.getElementById("contractVersion"),
  navLivePip: document.getElementById("navLivePip"),
  navMeta: document.getElementById("navMeta"),
  toastStack: document.getElementById("toastStack"),
};

const VIEWS = {
  builder: builderView,
  dashboard: dashboardView,
  history: historyView,
  library: libraryView,
};

const VIEW_TITLES = {
  builder: "策略构建",
  dashboard: "实时看板",
  history: "运行历史",
  library: "策略库",
};

const VALID_ROUTES = Object.keys(VIEWS);

/* ------------------------------------------------------------------ */
/* 顶栏状态                                                            */
/* ------------------------------------------------------------------ */

function setContractVersion(version) {
  if (!version) return;
  store.contractVersion = version;
  if (dom.contractVersion) dom.contractVersion.textContent = `v${version}`;
}

function syncServerTime(serverTime) {
  if (!Number.isFinite(serverTime)) return;
  store.serverTimeOffset = serverTime - Date.now();
  tickClock();
}

function tickClock() {
  if (!dom.serverClock) return;
  dom.serverClock.textContent = ui.fmtClock(Date.now() + store.serverTimeOffset);
}

/** 顶栏胶囊：SSE 通道断开时优先提示“实时通道断开，重连中…”。 */
function renderFeedPill() {
  if (!dom.feedStatus || !dom.feedStatusLabel) return;
  const streamBroken = store.streamStatus === "reconnecting" || store.streamStatus === "closed";
  if (streamBroken) {
    dom.feedStatus.dataset.state = "offline";
    dom.feedStatusLabel.textContent = "实时通道断开，重连中…";
    dom.feedStatus.title = "SSE 连接中断，正在以指数退避重连（1s→30s）";
    return;
  }
  const status = store.feedStatus || "connecting";
  dom.feedStatus.dataset.state = ["live", "degraded", "offline", "connecting"].includes(status)
    ? status
    : "connecting";
  dom.feedStatusLabel.textContent = ui.feedStatusLabel(status);
  const tracked = store.feed.marketsTracked ? ` · ${store.feed.marketsTracked} 个市场` : "";
  dom.feedStatus.title = `行情通道：${ui.feedStatusLabel(status)}${tracked}`;
}

/** 从 /api/health 拉取行情健康度（SSE 未推送 feed 事件时也能保持顶栏准确）。 */
async function refreshHealth() {
  try {
    const health = await api.getJSON("/api/health", { timeoutMs: 6000 });
    if (!health || !health.feed) return;
    setFeedStatus(health.feed.status, {
      marketsTracked: health.feed.marketsTracked,
      lastUpdate: health.feed.lastUpdate,
      latencyMs: health.feed.latencyMs,
    });
    if (Number.isFinite(health.now)) syncServerTime(health.now);
    store.apiOnline = true;
  } catch {
    /* health 失败不打断页面 */
  }
}

function setFeedStatus(status, info = {}) {
  store.feedStatus = status || "connecting";
  store.feed = {
    status: store.feedStatus,
    marketsTracked: Number.isFinite(info.marketsTracked) ? info.marketsTracked : store.feed.marketsTracked,
    lastUpdate: Number.isFinite(info.lastUpdate) ? info.lastUpdate : store.feed.lastUpdate,
    latencyMs: Number.isFinite(info.latencyMs) ? info.latencyMs : store.feed.latencyMs,
  };
  if (dom.feedLatency) {
    dom.feedLatency.textContent = Number.isFinite(store.feed.latencyMs)
      ? ui.fmtLatency(store.feed.latencyMs)
      : "—";
  }
  renderFeedPill();
}

function setStreamStatus(status) {
  store.streamStatus = status;
  renderFeedPill();
}

function setNavActive(route) {
  document.querySelectorAll(".nav-tabs .tab").forEach((tab) => {
    const isActive = tab.dataset.route === route;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  const pip = dom.navLivePip;
  if (pip) pip.hidden = !anyRunActive();
}

function updateRunPip() {
  if (dom.navLivePip) dom.navLivePip.hidden = !anyRunActive();
}

/* ------------------------------------------------------------------ */
/* 路由                                                                */
/* ------------------------------------------------------------------ */

let currentInstance = null;
let currentRoute = "";
let currentParams = {};
let mounting = false;
let pendingRoute = false;
let routeSeq = 0;

function parseHash() {
  const raw = String(location.hash || "").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const name = (pathPart || "").replace(/^\/+/, "").replace(/\/+$/, "") || "builder";
  let params = {};
  if (queryPart) {
    try {
      params = Object.fromEntries(new URLSearchParams(queryPart));
    } catch {
      params = {};
    }
  }
  return { name, params };
}

function navigate(hash) {
  const target = hash.startsWith("#") ? hash : `#/${hash.replace(/^\/+/, "")}`;
  if (location.hash === target) {
    handleRoute();
    return;
  }
  location.hash = target;
}

function buildContext(route, params) {
  return {
    store,
    params,
    route,
    api,
    ui,
    navigate,
    rememberRun,
    refreshMeta,
    refreshStrategies,
    refreshRuns,
    setFeedStatus,
    setStreamStatus,
  };
}

async function handleRoute() {
  const seq = ++routeSeq;
  const parsed = parseHash();
  let { name, params } = parsed;
  if (!VALID_ROUTES.includes(name)) {
    name = "builder";
    params = {};
    history.replaceState(null, "", "#/builder");
  }

  // 看板未指定 run 时，自动回到最近一次运行；没有则交给看板显示空状态。
  if (name === "dashboard" && !params.run && store.lastRunId) {
    params = { ...params, run: store.lastRunId };
    history.replaceState(null, "", `#/dashboard?run=${encodeURIComponent(store.lastRunId)}`);
  }

  if (mounting) {
    pendingRoute = true;
    return;
  }
  mounting = true;
  try {
    if (currentInstance && typeof currentInstance.destroy === "function") {
      try {
        currentInstance.destroy();
      } catch (error) {
        console.error("[app] 视图卸载失败", error);
      }
    }
    currentInstance = null;
    currentRoute = name;
    currentParams = params;
    setNavActive(name);
    document.title = `${VIEW_TITLES[name]} · PolyTemp Terminal`;
    if (dom.mount) {
      dom.mount.innerHTML = "";
      dom.mount.scrollTop = 0;
    }
    try {
      const instance = await VIEWS[name].mount(dom.mount, buildContext(name, params));
      // mount 期间若路由又变化（seq 变化），丢弃本次实例，交给后续路由。
      if (seq !== routeSeq) {
        if (instance && typeof instance.destroy === "function") instance.destroy();
      } else {
        currentInstance = instance || null;
      }
    } catch (error) {
      console.error(`[app] 视图 ${name} 挂载失败`, error);
      if (dom.mount) {
        dom.mount.innerHTML = ui.errorState({
          title: "页面渲染失败",
          message: error && error.message ? error.message : String(error),
          actionHtml: '<button class="btn btn-ghost" type="button" id="btnReloadView">重新加载</button>',
        });
        document.getElementById("btnReloadView")?.addEventListener("click", () => handleRoute());
      }
    }
  } finally {
    mounting = false;
    if (pendingRoute) {
      pendingRoute = false;
      handleRoute();
    }
  }
}

/* ------------------------------------------------------------------ */
/* 数据刷新                                                            */
/* ------------------------------------------------------------------ */

let metaLoadedOnce = false;

async function refreshMeta(showErrorToast = false) {
  try {
    const meta = await api.getJSON("/api/meta");
    store.meta = meta;
    store.apiOnline = true;
    setContractVersion(meta.contractVersion);
    syncServerTime(meta.serverTime);
    if (meta.feeModel && Number.isFinite(meta.feeModel.takerFeeRate)) {
      store.meta.feeModel = meta.feeModel;
    }
    metaLoadedOnce = true;
    return meta;
  } catch (error) {
    store.apiOnline = false;
    if (showErrorToast) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    }
    return null;
  }
}

async function refreshStrategies(showErrorToast = false) {
  try {
    const data = await api.getJSON("/api/strategies");
    store.strategies = Array.isArray(data && data.strategies) ? data.strategies : [];
    return store.strategies;
  } catch (error) {
    if (showErrorToast) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    }
    return store.strategies;
  }
}

async function refreshRuns(showErrorToast = false) {
  try {
    const data = await api.getJSON("/api/runs");
    store.runs = Array.isArray(data && data.runs) ? data.runs : [];
    store.runStatuses = new Map(store.runs.map((run) => [run.id, run.status]));
    updateRunPip();
    return store.runs;
  } catch (error) {
    if (showErrorToast) {
      const { title, detail } = api.describeError(error);
      ui.toast(title, { type: "error", detail });
    }
    return store.runs;
  }
}

/* ------------------------------------------------------------------ */
/* 全局 SSE（顶栏状态 + 运行指示灯）                                    */
/* ------------------------------------------------------------------ */

let headerStream = null;

function openHeaderStream() {
  if (headerStream) return;
  headerStream = api.connectStream({
    onEvent(name, data) {
      if (name === "hello") {
        if (data && data.contractVersion) setContractVersion(data.contractVersion);
        if (data && Number.isFinite(data.serverTime)) syncServerTime(data.serverTime);
        return;
      }
      if (name === "meta") {
        if (data) {
          if (data.contractVersion) setContractVersion(data.contractVersion);
          if (Array.isArray(data.cities) && store.meta) store.meta.cities = data.cities;
          if (Array.isArray(data.presets) && store.meta) store.meta.presets = data.presets;
          if (Number.isFinite(data.marketCount)) {
            store.feed.marketsTracked = data.marketCount;
            renderFeedPill();
          }
        }
        return;
      }
      if (name === "feed") {
        setFeedStatus(data && data.status, data || {});
        return;
      }
      if (name === "run") {
        const run = data && data.run;
        if (run && run.id) {
          store.runStatuses.set(run.id, run.status);
          updateRunPip();
        }
        return;
      }
      if (name === "heartbeat") {
        if (data && Number.isFinite(data.ts)) store.feed.lastUpdate = data.ts;
        return;
      }
      if (name === "reconnected" || name === "resync") {
        // 重连后补拉元数据与行情健康度，避免服务端重启导致的版本/城市漂移。
        refreshMeta(false);
        refreshHealth();
      }
    },
    onStatus(status) {
      setStreamStatus(status);
      if (status === "open") {
        refreshHealth();
        if (!metaLoadedOnce) refreshMeta(false);
      }
    },
  });
}

/* ------------------------------------------------------------------ */
/* 全局快捷键                                                          */
/* ------------------------------------------------------------------ */

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return true;
  return target.isContentEditable;
}

function onGlobalKeydown(event) {
  if (event.defaultPrevented) return;

  // 导航 tab 键盘左右切换（docs/05 §8.1）
  const navTab = event.target instanceof Element ? event.target.closest(".nav-tabs .tab") : null;
  if (navTab && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const tabs = [...document.querySelectorAll(".nav-tabs .tab")];
    const index = tabs.indexOf(navTab);
    if (index >= 0) {
      event.preventDefault();
      const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    }
    return;
  }

  if (isTypingTarget(event.target)) return;

  const isStopShortcut = (event.altKey || (!event.ctrlKey && !event.metaKey))
    && (event.key === "s" || event.key === "S")
    && !event.ctrlKey && !event.metaKey;

  // S / Alt+S：停止当前实时模拟（看板之外不生效）
  if (isStopShortcut) {
    if (currentRoute === "dashboard" && currentInstance && typeof currentInstance.onGlobalKey === "function") {
      event.preventDefault();
      currentInstance.onGlobalKey("stop");
    }
    return;
  }
  // Alt+R：刷新当前页数据
  if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === "r" || event.key === "R")) {
    if (currentInstance && typeof currentInstance.refresh === "function") {
      event.preventDefault();
      currentInstance.refresh();
      ui.toast("已刷新当前页面数据", { type: "info", timeout: 1600 });
    }
  }
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  setContractVersion(store.contractVersion);
  renderFeedPill();
  tickClock();
  setInterval(tickClock, 1000);

  window.addEventListener("hashchange", handleRoute);
  document.addEventListener("keydown", onGlobalKeydown);

  await Promise.all([
    refreshMeta(true),
    refreshStrategies(false),
    refreshRuns(false),
  ]);
  await refreshHealth();

  if (store.meta && dom.navMeta) {
    dom.navMeta.textContent = `TZ ASIA/SHANGHAI · v${store.contractVersion}`;
  }

  openHeaderStream();
  await handleRoute();

  // 调试入口（只读引用，便于 QA 在控制台检查状态）
  window.__POLYTEMP__ = { store, navigate, api, ui };
  if (dom.toastStack) dom.toastStack.dataset.ready = "true";
}

// 就绪后启动；DOM 由 module 脚本 defer 语义保证已解析。
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

export { navigate };
