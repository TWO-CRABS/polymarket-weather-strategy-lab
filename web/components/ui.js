/**
 * web/components/ui.js — 展示层通用工具（无第三方依赖）
 *
 * 约定（见 docs/05-ui-spec.md / docs/07-api-contract.md）：
 *  - 价格：0–1 小数 → 显示为 ¢（例：0.123 → "12.3¢"）
 *  - 概率：0–1 小数 → 显示为 %（例：0.521 → "52.1%"）
 *  - 金额：USDC → 显示为 $1,234.56
 *  - 涨跌幅/收益率：百分数数值（3.4 表示 +3.4%），带符号
 *  - 时间：epoch ms → Asia/Shanghai
 *  - P&L 永不只用颜色表达：同时带 +/- 符号与 ▲/▼ 箭头、涨/跌文字
 */

import {
  EXIT_REASON_LABELS,
  REJECT_REASON_LABELS,
} from "/shared/contract.js";

export const TZ = "Asia/Shanghai";
export const PRICE_UNIT = "¢";

/* ------------------------------------------------------------------ */
/* 基础转义与数值                                                        */
/* ------------------------------------------------------------------ */

/** HTML 转义，所有动态文本插入 innerHTML 前必须经过它。 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isNum(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/** 数字格式化（千分位），非数字返回 "—"。 */
export function fmtNum(value, digits = 2) {
  if (!isNum(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 整数倍份额等：最多 digits 位小数，去掉多余零。 */
export function fmtShares(value, digits = 2) {
  if (!isNum(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/* ------------------------------------------------------------------ */
/* 金额 / 价格 / 概率 / 百分比                                          */
/* ------------------------------------------------------------------ */

/** 金额：$1,234.56；负数显示为 -$1,234.56。 */
export function fmtMoney(value, digits = 2) {
  if (!isNum(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${fmtNum(Math.abs(value), digits)}`;
}

/** 带符号金额：+$12.34 / -$12.34。 */
export function fmtSignedMoney(value, digits = 2) {
  if (!isNum(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${fmtNum(Math.abs(value), digits)}`;
}

/** 价格（0–1 小数）→ 分：0.123 → "12.3¢"。 */
export function fmtCents(price, digits = 1) {
  if (!isNum(price)) return "—";
  return `${(price * 100).toFixed(digits)}¢`;
}

/** 点差（USDC 0–1 小数）→ 分差值，例 0.012 → "1.2¢"。 */
export function fmtSpread(value) {
  return fmtCents(value, 1);
}

/** 概率（0–1）→ "52.1%"。 */
export function fmtProb(prob, digits = 1) {
  if (!isNum(prob)) return "—";
  return `${(prob * 100).toFixed(digits)}%`;
}

/** 百分数（已是 % 单位，3.4 → "+3.4%"）。 */
export function fmtPct(value, digits = 1) {
  if (!isNum(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** 百分比但不带正号（胜率、费用占比等）。 */
export function fmtPctPlain(value, digits = 1) {
  if (!isNum(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** 涨跌方向：1 / -1 / 0（用于箭头、颜色类）。 */
export function dirOf(value) {
  if (!isNum(value) || value === 0) return 0;
  return value > 0 ? 1 : -1;
}

/** 方向类：up / down / ""（颜色仍需配合符号与文字）。 */
export function dirClass(value) {
  const d = dirOf(value);
  return d > 0 ? "up" : d < 0 ? "down" : "";
}

/** 方向箭头字符。 */
export function arrowOf(value) {
  const d = dirOf(value);
  return d > 0 ? "▲" : d < 0 ? "▼" : "—";
}

/** 涨/跌文字（用于可访问性，避免只靠颜色）。 */
export function wordOf(value) {
  const d = dirOf(value);
  return d > 0 ? "涨" : d < 0 ? "跌" : "平";
}

/**
 * P&L / 收益率的统一渲染：颜色 + 符号 + 箭头。
 * @param {number} value 金额或百分数
 * @param {{money?:boolean, digits?:number, plain?:boolean}} [opts]
 * @returns {string} HTML
 */
export function pnlSpan(value, opts = {}) {
  const { money = false, digits = 2, plain = false } = opts;
  if (!isNum(value)) return '<span class="muted">—</span>';
  const cls = dirClass(value);
  const arrow = arrowOf(value);
  const text = money ? fmtSignedMoney(value, digits) : fmtPct(value, digits);
  const word = plain ? "" : `<span class="sr-only">${wordOf(value)}</span>`;
  const arrowHtml = dirOf(value) === 0 ? "" : `<span aria-hidden="true">${arrow}</span> `;
  return `<span class="${cls}">${arrowHtml}${escapeHtml(text)}${word}</span>`;
}

/* ------------------------------------------------------------------ */
/* 时间（Asia/Shanghai）                                                */
/* ------------------------------------------------------------------ */

function makeFormatter(options) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { timeZone: TZ, ...options });
  } catch {
    return new Intl.DateTimeFormat("zh-CN", options);
  }
}

const HM_FMT = makeFormatter({ hour12: false, hour: "2-digit", minute: "2-digit" });
const HMS_FMT = makeFormatter({ hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const DATE_FMT = makeFormatter({ year: "numeric", month: "2-digit", day: "2-digit" });
const DATETIME_FMT = makeFormatter({
  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

function safeFormat(fmt, ts) {
  if (!isNum(ts)) return "—";
  try {
    return fmt.format(new Date(ts));
  } catch {
    return "—";
  }
}

/** HH:mm */
export const fmtTimeShort = (ts) => safeFormat(HM_FMT, ts);
/** HH:mm:ss */
export const fmtTime = (ts) => safeFormat(HMS_FMT, ts);
/** 2026/11/08（Asia/Shanghai） */
export const fmtDate = (ts) => safeFormat(DATE_FMT, ts);
/** 11-08 14:53:23 */
export const fmtDateTime = (ts) => safeFormat(DATETIME_FMT, ts);

/** 服务端时间时钟用的纯时间字符串（可能来自 Date.now()+offset）。 */
export function fmtClock(ts = Date.now()) {
  return safeFormat(HMS_FMT, ts);
}

/** 运行时长：72s → "01:12"；超过 1h → "1:02:03"。 */
export function fmtDuration(ms) {
  if (!isNum(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 秒数 → 友好时长（600 → "10 分钟"）。 */
export function fmtSecondsLabel(sec) {
  if (!isNum(sec)) return "—";
  if (sec >= 86400) return `${(sec / 86400).toFixed(1)} 天`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)} 小时`;
  if (sec >= 60) return `${Math.round(sec / 60)} 分钟`;
  return `${Math.round(sec)} 秒`;
}

/** 延迟：ms → "120ms"。 */
export function fmtLatency(ms) {
  if (!isNum(ms)) return "—";
  return `${Math.round(ms)}ms`;
}

/** 相对时间：3 分钟前（用于策略库/历史）。 */
export function fmtRelative(ts) {
  if (!isNum(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 45 * 1000) return "刚刚";
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return fmtDate(ts);
}

/* ------------------------------------------------------------------ */
/* 徽标 / 标签                                                         */
/* ------------------------------------------------------------------ */

const BADGE_CLASSES = {
  up: "badge badge-up",
  down: "badge badge-down",
  amber: "badge badge-amber",
  cyan: "badge badge-cyan",
  ghost: "badge badge-ghost",
};

/** 通用徽标。 */
export function badge(text, variant = "ghost", opts = {}) {
  const cls = BADGE_CLASSES[variant] || BADGE_CLASSES.ghost;
  const icon = opts.icon ? `<span aria-hidden="true">${escapeHtml(opts.icon)}</span> ` : "";
  const id = opts.id ? ` id="${escapeHtml(opts.id)}"` : "";
  return `<span class="${cls}"${id}>${icon}${escapeHtml(text)}</span>`;
}

/** 方向徽标：▲ UP / ▼ DOWN（UP = 买入 YES，DOWN = 买入 NO）。 */
export function directionBadge(direction) {
  if (direction === "up") return '<span class="badge badge-up"><span aria-hidden="true">▲</span> UP</span>';
  if (direction === "down") return '<span class="badge badge-down"><span aria-hidden="true">▼</span> DOWN</span>';
  return '<span class="badge badge-ghost">—</span>';
}

/** 结果徽标：YES / NO。 */
export function outcomeBadge(outcome) {
  if (outcome === "YES") return '<span class="badge badge-up">YES</span>';
  if (outcome === "NO") return '<span class="badge badge-down">NO</span>';
  return '<span class="badge badge-ghost">—</span>';
}

/** 运行状态 → 中文标签（见 shared/contract.js RUN_STATUSES）。 */
const RUN_STATUS_META = {
  created: { label: "已创建", cls: "badge-ghost" },
  starting: { label: "启动中", cls: "badge-paused" },
  running: { label: "运行中", cls: "badge-running" },
  paused: { label: "已暂停", cls: "badge-paused" },
  stopping: { label: "停止中", cls: "badge-paused" },
  stopped: { label: "已停止", cls: "badge-ended" },
  ended: { label: "已结束", cls: "badge-ended" },
  error: { label: "异常", cls: "badge-error" },
};

export function runStatusMeta(status) {
  return RUN_STATUS_META[status] || { label: status || "未知", cls: "badge-ghost" };
}

export function runStatusBadge(status) {
  const meta = runStatusMeta(status);
  return `<span class="badge ${meta.cls}">${escapeHtml(meta.label)}</span>`;
}

/** 顶栏 / 看板运行状态胶囊（带脉冲点）。 */
export function runStatusPill(status) {
  const stateMap = {
    running: "running",
    starting: "starting",
    paused: "paused",
    stopping: "paused",
    created: "ended",
    stopped: "ended",
    ended: "ended",
    error: "error",
  };
  const state = stateMap[status] || "ended";
  const meta = runStatusMeta(status);
  return `<div class="run-status" data-state="${state}" role="status" aria-live="polite">
    <span class="live-dot" aria-hidden="true"></span>
    <span class="run-status-label">${escapeHtml(meta.label)}</span>
  </div>`;
}

/** 运行模式徽标：实时 / 回放。 */
export function modeBadge(mode) {
  return mode === "replay"
    ? '<span class="badge badge-cyan">回放</span>'
    : '<span class="badge badge-ghost">实时</span>';
}

/** 行情通道状态 → 中文标签。 */
export function feedStatusLabel(status) {
  switch (status) {
    case "live": return "行情正常";
    case "degraded": return "行情降级";
    case "offline": return "行情离线";
    default: return "连接中";
  }
}

/** 成交状态徽标。 */
export function tradeStatusBadge(status) {
  if (status === "filled") return '<span class="badge badge-filled">成交</span>';
  if (status === "partial") return '<span class="badge badge-partial">部分成交</span>';
  if (status === "rejected") return '<span class="badge badge-rejected">拒单</span>';
  return `<span class="badge badge-ghost">${escapeHtml(status || "—")}</span>`;
}

/** 平仓/入场原因中文标签。 */
export function reasonLabel(reason) {
  if (!reason) return "—";
  return EXIT_REASON_LABELS[reason] || reason;
}

/** 拒单原因中文标签。 */
export function rejectReasonLabel(reason) {
  if (!reason) return "—";
  return REJECT_REASON_LABELS[reason] || reason;
}

/* ------------------------------------------------------------------ */
/* Toast / 弹窗 / 空状态 / 骨架                                         */
/* ------------------------------------------------------------------ */

const TOAST_ICONS = { success: "✓", warn: "!", info: "i", error: "✕" };

/**
 * 顶部右侧 toast 通知。
 * @param {string} message
 * @param {{type?:'success'|'warn'|'info'|'error', detail?:string, timeout?:number}} [opts]
 */
export function toast(message, opts = {}) {
  const { type = "info", detail = "", timeout = 4200 } = opts;
  const stack = document.getElementById("toastStack");
  if (!stack) {
    if (type === "error") console.error(message, detail);
    return;
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `
    <span class="t-ico" aria-hidden="true">${escapeHtml(TOAST_ICONS[type] || "i")}</span>
    <div><div>${escapeHtml(message)}</div>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</div>`;
  stack.appendChild(el);
  const remove = () => {
    if (!el.isConnected) return;
    el.style.opacity = "0";
    el.style.transform = "translateX(12px)";
    el.style.transition = "opacity 160ms ease, transform 160ms ease";
    setTimeout(() => el.remove(), 170);
  };
  const timer = setTimeout(remove, Math.max(1200, timeout));
  el.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

/**
 * 确认弹窗（Promise<boolean>）。用于停止运行、删除策略等破坏性操作。
 */
export function confirmDialog(opts = {}) {
  const {
    title = "确认操作",
    message = "",
    confirmText = "确认",
    cancelText = "取消",
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmDesc">
        <header class="modal-head">
          <h2 id="confirmTitle">${escapeHtml(title)}</h2>
          <button class="icon-btn" type="button" data-act="cancel" aria-label="关闭弹窗">✕</button>
        </header>
        <div class="modal-body">
          <p id="confirmDesc">${escapeHtml(message)}</p>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-ghost" type="button" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-act="ok">${escapeHtml(confirmText)}</button>
        </footer>
      </div>`;
    const close = (result) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    };
    overlay.addEventListener("click", (event) => {
      const act = event.target.closest("[data-act]")?.dataset.act;
      if (act === "ok") close(true);
      else if (act === "cancel") close(false);
      else if (event.target === overlay) close(false);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="ok"]')?.focus();
  });
}

/** 空状态 HTML。 */
export function emptyState(opts = {}) {
  const {
    icon = "◌",
    title = "暂无数据",
    message = "",
    actionHtml = "",
  } = opts;
  return `<div class="empty-state">
    <span class="empty-ico" aria-hidden="true">${escapeHtml(icon)}</span>
    <span class="empty-title">${escapeHtml(title)}</span>
    ${message ? `<span>${escapeHtml(message)}</span>` : ""}
    ${actionHtml}
  </div>`;
}

/** 骨架屏：n 行文本。 */
export function skeletonLines(n = 3) {
  return `<div aria-hidden="true" aria-busy="true">${Array.from({ length: n }, () => '<div class="skel skel-line"></div>').join("")}</div>`;
}

/** 骨架屏：一排卡片。 */
export function skeletonCards(n = 4) {
  return `<div class="skel-row" aria-hidden="true" aria-busy="true">${Array.from({ length: n }, () => '<div class="skel skel-card"></div>').join("")}</div>`;
}

/** 错误状态块。 */
export function errorState(opts = {}) {
  const { title = "加载失败", message = "", actionHtml = "" } = opts;
  return `<div class="error-state" role="alert">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(message)}</span>
    ${actionHtml}
  </div>`;
}

/** 区块标题 HTML。 */
export function sectionHead(title, sub = "") {
  return `<div class="panel-title"><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ""}</div>`;
}
