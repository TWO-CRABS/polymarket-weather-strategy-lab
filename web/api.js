/**
 * web/api.js — 同源 REST 客户端 + SSE 客户端（零依赖）
 *
 * REST 前缀 /api（docs/07-api-contract.md）。错误统一为 ApiError：
 *   { error: { code, message, details? } }
 *
 * SSE：GET /api/stream（可选 ?runId= 过滤）。
 *  - EventSource 原生断线后默认会自己重连，这里接管为显式指数退避：
 *    1s → 2s → 4s → 8s → 16s → 30s（上限 30s）
 *  - 15s 心跳（服务端 `: ping` / heartbeat 事件）之外再做 45s 无事件看门狗
 *  - 重连成功后触发 onEvent("reconnected")，并暴露 resync() 供视图在
 *    重连后通过 REST 补齐快照（docs/07 §5 要求）
 */

import { SSE_EVENTS } from "/shared/contract.js";

/* ------------------------------------------------------------------ */
/* 错误                                                                */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = "ApiError";
    this.code = info.code || "UNKNOWN";
    this.status = info.status || 0;
    this.details = info.details || null;
  }
}

const ERROR_HINTS = {
  INVALID_STRATEGY: "策略参数未通过校验，请检查标记为错误的字段。",
  INVALID_MODE: "运行模式非法：仅支持 live（实时）或 replay（回放）。",
  NO_MARKETS: "当前没有可用的温度市场：请改用“回放”模式，或稍后再试。",
  RUN_NOT_FOUND: "该模拟运行不存在或已被删除。",
  STRATEGY_NOT_FOUND: "该策略不存在或已被删除。",
  MARKET_NOT_FOUND: "该市场不存在或已下架。",
  RUN_NOT_ACTIVE: "该运行当前不处于可停止状态。",
  UPSTREAM_ERROR: "上游 Polymarket API 暂时不可用，请稍后重试。",
  RATE_LIMITED: "上游接口限流，请稍后重试。",
  TIMEOUT: "请求超时，请检查服务端状态后重试。",
  NETWORK: "无法连接服务端：请确认 `node server/index.js` 已启动（127.0.0.1:8787）。",
  INTERNAL: "服务端内部错误，请查看服务端日志。",
};

/**
 * 把任意异常归一化为 { title, detail, code }，便于 UI 展示。
 */
export function describeError(error) {
  if (!error) return { title: "未知错误", detail: "", code: "UNKNOWN" };
  const code = error.code || "UNKNOWN";
  const title = code === "NETWORK" ? "服务端不可达" : code === "TIMEOUT" ? "请求超时" : "请求失败";
  const hint = ERROR_HINTS[code] || "";
  const detail = [hint, error.message && error.message !== hint ? error.message : ""]
    .filter(Boolean)
    .join(" · ");
  return { title, detail, code, status: error.status || 0 };
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT = 15000;

async function request(path, options = {}) {
  const {
    method = "GET",
    body = undefined,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT,
    signal: externalSignal = null,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const requestHeaders = { Accept: "application/json" };
  let payload;
  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  Object.assign(requestHeaders, headers);

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: payload,
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new ApiError(ERROR_HINTS.TIMEOUT, { code: "TIMEOUT" });
    }
    throw new ApiError(ERROR_HINTS.NETWORK, { code: "NETWORK" });
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payloadError = (data && data.error) || {};
    const message = payloadError.message || `HTTP ${response.status} ${response.statusText || ""}`.trim();
    throw new ApiError(message, {
      code: payloadError.code || "INTERNAL",
      status: response.status,
      details: payloadError.details || null,
    });
  }

  if (text && data === null) {
    throw new ApiError("服务端返回了非 JSON 响应", { code: "INTERNAL", status: response.status });
  }
  return data;
}

/** GET JSON。 */
export function getJSON(path, opts = {}) {
  return request(path, { ...opts, method: "GET" });
}

/** POST JSON。 */
export function postJSON(path, body, opts = {}) {
  return request(path, { ...opts, method: "POST", body });
}

/** PUT JSON。 */
export function putJSON(path, body, opts = {}) {
  return request(path, { ...opts, method: "PUT", body });
}

/** DELETE（204 返回 null）。 */
export function del(path, opts = {}) {
  return request(path, { ...opts, method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* SSE                                                                 */
/* ------------------------------------------------------------------ */

const backoffDelay = (attempt) => Math.min(30000, 1000 * 2 ** Math.min(attempt - 1, 5));
const KNOWN_EVENTS = new Set([...SSE_EVENTS, "reconnected", "resync"]);
const HEARTBEAT_WATCHDOG_MS = 45000;

/**
 * 建立 /api/stream SSE 连接，自动重连（指数退避 1s→30s），心跳看门狗，
 * 重连成功后回调 onEvent("reconnected")。
 *
 * @param {{
 *   runId?: string|null,
 *   onEvent?: (name:string, data:any, raw?:MessageEvent)=>void,
 *   onStatus?: (status:'connecting'|'open'|'reconnecting'|'closed', info?:object)=>void,
 * }} options
 * @returns {{close:Function, resync:Function, reconnect:Function, status:string, attempt:number}}
 */
export function connectStream(options = {}) {
  const { runId = null, onEvent = () => {}, onStatus = () => {} } = options;

  let source = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let lastActivity = 0;
  let everConnected = false;
  let status = "connecting";

  const streamUrl = () => `/api/stream${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`;

  function emitEvent(name, data) {
    try {
      onEvent(name, data);
    } catch (error) {
      console.error(`[stream] 处理事件 "${name}" 失败`, error);
    }
  }

  function setStatus(next, info = {}) {
    status = next;
    try {
      onStatus(next, info);
    } catch (error) {
      console.error("[stream] onStatus 回调失败", error);
    }
  }

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeatWatch() {
    clearHeartbeat();
    lastActivity = Date.now();
    heartbeatTimer = setInterval(() => {
      if (closed || !source) return;
      if (Date.now() - lastActivity > HEARTBEAT_WATCHDOG_MS) {
        forceReconnect("心跳超时");
      }
    }, 10000);
  }

  function closeSource() {
    clearHeartbeat();
    if (source) {
      try {
        source.close();
      } catch {
        /* ignore */
      }
      source = null;
    }
  }

  function scheduleReconnect(reason) {
    if (closed || reconnectTimer) return;
    attempt += 1;
    const delay = backoffDelay(attempt);
    setStatus("reconnecting", { attempt, delay, reason });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  }

  function forceReconnect(reason) {
    if (closed) return;
    closeSource();
    scheduleReconnect(reason);
  }

  function handleEvent(name, event) {
    lastActivity = Date.now();
    let data = null;
    try {
      data = event && event.data ? JSON.parse(event.data) : null;
    } catch {
      data = null;
    }
    emitEvent(name, data);
  }

  function open() {
    if (closed) return;
    closeSource();
    setStatus(everConnected || attempt > 0 ? "reconnecting" : "connecting", { attempt });
    let es;
    try {
      es = new EventSource(streamUrl());
    } catch (error) {
      scheduleReconnect("EventSource 创建失败");
      return;
    }
    source = es;

    es.onopen = () => {
      if (closed || source !== es) return;
      // 首次连接成功也要区分“首连”与“重连”：若之前尝试失败过（attempt>0），
      // 说明中间有空档，需要通知视图通过 REST 补齐快照。
      const wasReconnect = everConnected || attempt > 0;
      everConnected = true;
      attempt = 0;
      lastActivity = Date.now();
      startHeartbeatWatch();
      setStatus("open", {});
      if (wasReconnect) emitEvent("reconnected", { at: Date.now() });
    };

    es.onerror = () => {
      if (closed || source !== es) return;
      // 关闭原生自动重连，改用我们自己的退避策略。
      closeSource();
      scheduleReconnect("连接中断");
    };

    // 命名事件（hello/market/trade/... 以及 heartbeat）
    for (const name of SSE_EVENTS) {
      es.addEventListener(name, (event) => handleEvent(name, event));
    }
    // 兜底：未命名 message（部分服务端实现会省略 event:）
    es.onmessage = (event) => {
      if (closed) return;
      lastActivity = Date.now();
      handleEvent("message", event);
    };
  }

  function onVisibilityChange() {
    if (closed) return;
    if (document.visibilityState === "visible" && !source && !reconnectTimer) {
      open();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  open();

  return {
    /** 主动关闭连接（视图卸载时调用）。 */
    close() {
      if (closed) return;
      closed = true;
      clearHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      closeSource();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setStatus("closed", {});
    },
    /** 让视图通过 REST 重新拉取快照（可手动触发；重连时也会收到 reconnected）。 */
    resync(reason = "manual") {
      if (closed) return;
      emitEvent("resync", { at: Date.now(), reason });
    },
    /** 手动强制重连。 */
    reconnect(reason = "manual") {
      if (closed) return;
      forceReconnect(reason);
    },
    get status() {
      return status;
    },
    get attempt() {
      return attempt;
    },
  };
}

/** 供调试：判断事件名是否在契约内。 */
export function isKnownEvent(name) {
  return KNOWN_EVENTS.has(name);
}
