/**
 * web/components/charts.js — 零依赖 Canvas 图表
 *
 *  - 折线/面积图：DPI 自适应、ResizeObserver 自动重绘、坐标轴 + 网格 + 悬停提示
 *  - 迷你 sparkline：市场卡片 / 列表使用的轻量走势
 *
 * 设计约束：不引入任何第三方库；所有文本走 ui.js 的格式化函数
 * （金额 $、价格 ¢、时间 Asia/Shanghai）。
 */

import {
  escapeHtml,
  fmtMoney,
  fmtTime,
  fmtDateTime,
  fmtPct,
  isNum,
} from "/web/components/ui.js";

const COLORS = {
  grid: "#1E2C3A",
  gridStrong: "rgba(44, 63, 82, 0.55)",
  axisText: "#748698",
  text: "#A3B2C2",
  line: "#22D3EE",
  baseline: "#748698",
};

const AXIS_FONT = '10px "SFMono-Regular", "Cascadia Mono", Consolas, monospace';

function dpiScale() {
  return Math.max(1, Math.min(3, window.devicePixelRatio || 1));
}

/**
 * 创建折线/面积图实例。
 * @param {HTMLCanvasElement} canvas 画布（CSS 尺寸由样式控制）
 * @param {{
 *   color?:string,
 *   seriesName?:string,
 *   yFormat?:(v:number)=>string,
 *   xFormat?:(ts:number)=>string,
 *   ariaLabel?:string,
 *   fill?:boolean,
 *   baseline?:number|null,
 *   baselineLabel?:string,
 *   tooltipHtml?:(point:{ts:number,value:number}, index:number)=>string,
 * }} options
 * @returns {{setData:Function, setBaseline:Function, setOptions:Function, resize:Function, destroy:Function, canvas:HTMLCanvasElement}}
 */
export function createLineChart(canvas, options = {}) {
  if (!canvas) throw new Error("createLineChart: canvas 不能为空");
  const parent = canvas.parentElement || canvas;
  if (window.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  let tooltip = parent.querySelector(":scope > .chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.hidden = true;
    parent.appendChild(tooltip);
  }

  const opts = {
    color: options.color || COLORS.line,
    seriesName: options.seriesName || "数值",
    yFormat: options.yFormat || ((v) => fmtMoney(v)),
    xFormat: options.xFormat || fmtTime,
    ariaLabel: options.ariaLabel || "折线图",
    fill: options.fill !== false,
    baseline: isNum(options.baseline) ? options.baseline : null,
    baselineLabel: options.baselineLabel || "基准",
    tooltipHtml: options.tooltipHtml || null,
  };
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", opts.ariaLabel);

  let points = [];
  let hoverIndex = -1;
  let geom = null;
  let rafId = 0;
  let destroyed = false;

  function scheduleDraw() {
    if (destroyed || rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      draw();
    });
  }

  function draw() {
    if (destroyed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(40, Math.round(rect.width));
    const h = Math.max(30, Math.round(rect.height));
    const dpr = dpiScale();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = AXIS_FONT;

    const pad = { l: 60, r: 14, t: 12, b: 24 };
    const plot = {
      x: pad.l,
      y: pad.t,
      w: w - pad.l - pad.r,
      h: h - pad.t - pad.b,
    };
    if (plot.w < 20 || plot.h < 20) {
      geom = null;
      return;
    }

    if (!points.length) {
      geom = null;
      ctx.fillStyle = COLORS.axisText;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("暂无数据", plot.x + plot.w / 2, plot.y + plot.h / 2);
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      if (!isNum(p.value)) continue;
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (opts.baseline !== null) {
      min = Math.min(min, opts.baseline);
      max = Math.max(max, opts.baseline);
    }
    if (max - min < 1e-9) {
      const bump = Math.max(Math.abs(max) * 0.01, 0.001);
      min -= bump;
      max += bump;
    }
    const span = max - min;
    min -= span * 0.1;
    max += span * 0.1;

    const n = points.length;
    const firstTs = points[0].ts;
    const lastTs = points[n - 1].ts;
    const tsSpan = lastTs - firstTs;
    const xOfIndex = (i) => {
      if (n === 1) return plot.x + plot.w / 2;
      if (tsSpan > 0 && isNum(points[i].ts)) {
        return plot.x + ((points[i].ts - firstTs) / tsSpan) * plot.w;
      }
      return plot.x + (i / (n - 1)) * plot.w;
    };
    const yOf = (value) => plot.y + plot.h - ((value - min) / (max - min)) * plot.h;

    // 1) 网格 + Y 轴标签
    const gridLines = 4;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= gridLines; i += 1) {
      const t = i / gridLines;
      const y = plot.y + t * plot.h;
      const value = max - t * (max - min);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plot.x, Math.round(y) + 0.5);
      ctx.lineTo(plot.x + plot.w, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = COLORS.axisText;
      ctx.fillText(opts.yFormat(value), plot.x - 8, y);
    }

    // 2) 面积填充
    const coords = points.map((p, i) => ({
      x: xOfIndex(i),
      y: yOf(isNum(p.value) ? p.value : min),
    }));

    if (opts.fill && coords.length > 1) {
      const gradient = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
      gradient.addColorStop(0, hexToRgba(opts.color, 0.26));
      gradient.addColorStop(1, hexToRgba(opts.color, 0.01));
      ctx.beginPath();
      ctx.moveTo(coords[0].x, plot.y + plot.h);
      coords.forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.lineTo(coords[coords.length - 1].x, plot.y + plot.h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 3) 基准线（例：初始资金）
    if (opts.baseline !== null) {
      const by = yOf(opts.baseline);
      if (by >= plot.y - 1 && by <= plot.y + plot.h + 1) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = COLORS.baseline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plot.x, by);
        ctx.lineTo(plot.x + plot.w, by);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = COLORS.axisText;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(opts.baselineLabel, plot.x + 4, by - 3);
      }
    }

    // 4) 折线
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    coords.forEach((c, i) => {
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();

    // 5) X 轴标签（首 / 中 / 尾）
    ctx.fillStyle = COLORS.axisText;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const yTick = plot.y + plot.h + 7;
    const xLabels = [];
    if (n === 1) {
      xLabels.push({ index: 0, align: "center" });
    } else {
      xLabels.push({ index: 0, align: "left" });
      xLabels.push({ index: Math.floor((n - 1) / 2), align: "center" });
      xLabels.push({ index: n - 1, align: "right" });
    }
    let lastRight = -Infinity;
    for (const item of xLabels) {
      const p = points[item.index];
      if (!p) continue;
      const text = opts.xFormat(p.ts);
      const tw = ctx.measureText(text).width;
      const x = xOfIndex(item.index);
      const left = item.align === "right" ? x - tw : item.align === "center" ? x - tw / 2 : x;
      if (left < lastRight + 8 && item.index !== n - 1) continue;
      ctx.textAlign = item.align === "right" ? "right" : item.align === "center" ? "center" : "left";
      ctx.fillText(text, x, yTick);
      lastRight = left + tw;
    }

    // 6) 悬停十字线（鼠标位置由 pointermove 更新 hoverIndex）
    if (hoverIndex >= 0 && hoverIndex < coords.length) {
      const c = coords[hoverIndex];
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(163, 178, 194, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x, plot.y);
      ctx.lineTo(c.x, plot.y + plot.h);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = opts.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(7, 10, 15, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    geom = { coords, plot, points, w, h };
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || "").replace("#", "");
    if (value.length === 6) {
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(34, 211, 238, ${alpha})`;
  }

  function defaultTooltip(point) {
    const parts = [
      `<div class="tt-row"><span>${escapeHtml(fmtDateTime(point.ts))}</span></div>`,
      `<div class="tt-row"><span>${escapeHtml(opts.seriesName)}</span><strong>${escapeHtml(opts.yFormat(point.value))}</strong></div>`,
    ];
    if (opts.baseline !== null && isNum(opts.baseline) && opts.baseline !== 0) {
      const diff = point.value - opts.baseline;
      const pct = (diff / Math.abs(opts.baseline)) * 100;
      parts.push(
        `<div class="tt-row"><span>${escapeHtml(opts.baselineLabel)}</span><span>${escapeHtml(fmtMoney(opts.baseline))}</span></div>`,
      );
      parts.push(
        `<div class="tt-row"><span>相对基准</span><span class="${diff >= 0 ? "up" : "down"}">${escapeHtml(fmtPct(pct))}</span></div>`,
      );
    }
    return parts.join("");
  }

  function updateTooltip() {
    if (!geom || hoverIndex < 0 || !geom.points[hoverIndex]) {
      tooltip.hidden = true;
      return;
    }
    const point = geom.points[hoverIndex];
    tooltip.innerHTML = opts.tooltipHtml ? opts.tooltipHtml(point, hoverIndex) : defaultTooltip(point);
    tooltip.hidden = false;
    const c = geom.coords[hoverIndex];
    const parentRect = parent.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - parentRect.left;
    const offsetY = canvasRect.top - parentRect.top;
    const ttW = tooltip.offsetWidth || 140;
    const ttH = tooltip.offsetHeight || 60;
    let left = offsetX + c.x + 12;
    if (left + ttW > parentRect.width - 4) left = offsetX + c.x - ttW - 12;
    if (left < 4) left = 4;
    let top = offsetY + c.y - ttH - 10;
    if (top < 4) top = offsetY + c.y + 14;
    if (top + ttH > parentRect.height - 4) top = Math.max(4, parentRect.height - ttH - 4);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function onPointerMove(event) {
    if (!geom) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < geom.coords.length; i += 1) {
      const d = Math.abs(geom.coords[i].x - mx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best !== hoverIndex) {
      hoverIndex = best;
      scheduleDraw();
    }
    updateTooltip();
  }

  function onPointerLeave() {
    if (hoverIndex !== -1) {
      hoverIndex = -1;
      scheduleDraw();
    }
    tooltip.hidden = true;
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => scheduleDraw());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", scheduleDraw);
  }

  const instance = {
    canvas,
    setData(nextPoints, nextOptions = {}) {
      if (!Array.isArray(nextPoints)) nextPoints = [];
      points = nextPoints
        .filter((p) => p && isNum(p.ts) && isNum(p.value))
        .map((p) => ({ ts: p.ts, value: p.value }));
      if (Object.prototype.hasOwnProperty.call(nextOptions, "baseline")) {
        opts.baseline = isNum(nextOptions.baseline) ? nextOptions.baseline : null;
      }
      if (nextOptions.baselineLabel) opts.baselineLabel = nextOptions.baselineLabel;
      if (nextOptions.seriesName) opts.seriesName = nextOptions.seriesName;
      if (nextOptions.color) opts.color = nextOptions.color;
      hoverIndex = -1;
      tooltip.hidden = true;
      scheduleDraw();
      return instance;
    },
    setBaseline(value, label) {
      opts.baseline = isNum(value) ? value : null;
      if (label) opts.baselineLabel = label;
      scheduleDraw();
      return instance;
    },
    setOptions(next = {}) {
      Object.assign(opts, next);
      scheduleDraw();
      return instance;
    },
    resize: scheduleDraw,
    destroy() {
      destroyed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", scheduleDraw);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      tooltip.hidden = true;
      tooltip.remove();
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };

  scheduleDraw();
  return instance;
}

/**
 * 绘制迷你走势线（无坐标轴）。用于市场卡片 / 对比列。
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} values 数值序列（价格 0–1 或任意）
 * @param {{color?:string, fill?:boolean, baseline?:number|null, light?:boolean}} [opts]
 */
export function drawSparkline(canvas, values, opts = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(20, Math.round(rect.width));
  const h = Math.max(10, Math.round(rect.height));
  const dpr = dpiScale();
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const series = (Array.isArray(values) ? values : []).filter((v) => isNum(v));
  if (series.length < 2) {
    ctx.strokeStyle = "rgba(116, 134, 152, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();
    return;
  }

  let min = Math.min(...series);
  let max = Math.max(...series);
  if (max - min < 1e-9) {
    min -= 0.001;
    max += 0.001;
  }
  const padY = (max - min) * 0.14;
  min -= padY;
  max += padY;
  const color = opts.color
    || (series[series.length - 1] >= series[0] ? "#4ADE9B" : "#FB7185");
  const xOf = (i) => (i / (series.length - 1)) * (w - 2) + 1;
  const yOf = (v) => h - 2 - ((v - min) / (max - min)) * (h - 4);

  if (opts.fill !== false) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, hexToColor(color, 0.3));
    gradient.addColorStop(1, hexToColor(color, 0.02));
    ctx.beginPath();
    ctx.moveTo(xOf(0), h);
    series.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(series.length - 1), h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = opts.light ? 1.4 : 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  series.forEach((v, i) => {
    if (i === 0) ctx.moveTo(xOf(i), yOf(v));
    else ctx.lineTo(xOf(i), yOf(v));
  });
  ctx.stroke();
}

function hexToColor(hex, alpha) {
  const value = String(hex || "").replace("#", "");
  if (value.length === 6) {
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(34, 211, 238, ${alpha})`;
}
