/**
 * web/views/traderAnalysis.js — local behavior analysis for one trader.
 */
import * as ui from "/web/components/ui.js";

const DATA_URL = "/shared/traderAnalysis.json";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function pct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";
}

function ts(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(n * 1000));
}

function metricRows(before, after) {
  const rows = [
    ["成交笔数", before.tradeCount, after.tradeCount],
    ["成交名义额", money(before.notional), money(after.notional)],
    ["平均每笔名义额", money(before.avgNotional), money(after.avgNotional)],
    ["买入占比", pct(before.buyRatio), pct(after.buyRatio)],
    ["天气市场占比", pct(before.weatherRatio), pct(after.weatherRatio)],
    ["市场数", before.marketCount, after.marketCount],
    ["活跃天数", before.activeDays, after.activeDays],
    ["日均成交笔数", before.tradesPerActiveDay, after.tradesPerActiveDay],
    ["平均成交价", before.avgPrice, after.avgPrice],
    ["平均每笔 shares", before.avgSize, after.avgSize],
  ];
  return rows.map(([label, b, a]) => `<tr><td>${ui.escapeHtml(label)}</td><td class="num-col">${ui.escapeHtml(String(b))}</td><td class="num-col">${ui.escapeHtml(String(a))}</td></tr>`).join("");
}

function marketTable(rows) {
  return `<table class="table lb-trade-table">
    <thead><tr><th>市场</th><th class="num-col">笔数</th><th class="num-col">名义额</th></tr></thead>
    <tbody>${rows.map((market) => `<tr>
      <td><a class="mkt-link" href="https://polymarket.com/zh/event/${encodeURIComponent(market.eventSlug || "")}" target="_blank" rel="noopener noreferrer">${ui.escapeHtml(market.title || market.slug || "—")}</a></td>
      <td class="num-col">${market.count}</td>
      <td class="num-col">${money(market.notional)}</td>
    </tr>`).join("") || '<tr><td colspan="3" class="muted">暂无数据</td></tr>'}</tbody>
  </table>`;
}

function settlementPanel(data) {
  if (!data) return "";
  const before = data.byPeriod?.before || { total: 0, below: 0, belowRatio: 0 };
  const after = data.byPeriod?.after || { total: 0, below: 0, belowRatio: 0 };
  return `<div class="panel"><div class="panel-head"><div class="panel-title"><h2>天气 NO 买入 vs 结算温度</h2><p>只统计天气市场 BUY NO，并与该事件最终获胜温度比较</p></div></div><div class="panel-body">
    <div class="lb-summary-row">
      <div class="lb-stat"><span>NO 买入笔数</span><b>${data.totalWeatherNoBuyTrades}</b></div>
      <div class="lb-stat"><span>可比较（已结算）</span><b>${data.resolvedComparable}</b></div>
      <div class="lb-stat"><span>买在市场温度 &lt; 结算温度</span><b>${data.below} / ${data.resolvedComparable}（${pct(data.belowRatio)}）</b></div>
      <div class="lb-stat"><span>等于结算温度</span><b>${data.equal}</b></div>
      <div class="lb-stat"><span>高于结算温度</span><b>${data.above}</b></div>
    </div>
    <table class="table lb-trade-table" style="margin-top:12px"><thead><tr><th>时间段</th><th class="num-col">可比较</th><th class="num-col">温度低于结算</th><th class="num-col">比例</th></tr></thead><tbody>
      <tr><td>5月22日之前</td><td class="num-col">${before.total}</td><td class="num-col">${before.below}</td><td class="num-col">${pct(before.belowRatio)}</td></tr>
      <tr><td>5月22日至今</td><td class="num-col">${after.total}</td><td class="num-col">${after.below}</td><td class="num-col">${pct(after.belowRatio)}</td></tr>
    </tbody></table>
    <p class="muted">温度区间市场用区间中点近似；未结算事件和无法解析的温度括号被排除。跳过未结算 ${data.skippedUnresolvedEvents} 笔，解析失败 ${data.skippedParse} 笔。</p>
  </div></div>`;
}

export async function mount(root) {
  const state = { data: null, settlement: null, error: "", destroyed: false };
  root.innerHTML = `
    <section class="view is-active">
      <div class="view-head">
        <div>
          <div class="eyebrow">TRADER BEHAVIOR / LOCAL ANALYSIS</div>
          <h1>交易员分析</h1>
          <p class="view-sub">本地保存该钱包的全部公开成交，对比 2026-05-22 之前与 2026-05-22 至今的交易行为。</p>
        </div>
        <div class="row-actions"><button class="btn btn-ghost" id="taReload" type="button">刷新</button></div>
      </div>
      <div id="taBody"><div class="empty-state">加载本地分析数据…</div></div>
    </section>`;
  const body = root.querySelector("#taBody");

  function render() {
    if (state.destroyed) return;
    if (state.error) {
      body.innerHTML = `<div class="empty-state">${ui.escapeHtml(state.error)}</div>`;
      return;
    }
    const d = state.data;
    if (!d) {
      body.innerHTML = '<div class="empty-state">本地还没有该用户的分析数据。请先运行 scripts/fetch-trader-analysis.mjs。</div>';
      return;
    }
    const before = d.before;
    const after = d.after;
    const noShareBefore = before.tradeCount ? before.noCount / before.tradeCount : 0;
    const noShareAfter = after.tradeCount ? after.noCount / after.tradeCount : 0;
    const sizeMultiple = before.avgNotional > 0 ? after.avgNotional / before.avgNotional : null;
    body.innerHTML = `
      <div class="panel"><div class="panel-head"><div class="panel-title"><h2>行为结论</h2><p>基于本地保存的 ${d.totalTrades.toLocaleString("en-US")} 笔公开成交</p></div></div><div class="panel-body">
        <ul class="ta-insights">
          <li>分界点从低频小额转为高频大额：日均成交从 ${before.tradesPerActiveDay} 笔升至 ${after.tradesPerActiveDay} 笔，平均单笔名义额从 ${money(before.avgNotional)} 升至 ${money(after.avgNotional)}${sizeMultiple ? `（约 ${sizeMultiple.toFixed(1)}×）` : ""}。</li>
          <li>交易方向明显偏 NO：5月22日前 NO 占比 ${pct(noShareBefore)}，之后升至 ${pct(noShareAfter)}；之后 YES 成交仅 ${after.yesCount.toLocaleString("en-US")} 笔。</li>
          <li>覆盖面从 ${before.marketCount} 个市场扩展到 ${after.marketCount} 个市场，活跃天数从 ${before.activeDays} 天升至 ${after.activeDays} 天。</li>
          <li>天气市场占比从 ${pct(before.weatherRatio)} 变为 ${pct(after.weatherRatio)}；之后平均成交价从 ${before.avgPrice} 上升到 ${after.avgPrice}。</li>
        </ul>
      </div></div>
      ${settlementPanel(state.settlement)}
      <div class="panel lb-summary">
        <div class="panel-body lb-summary-row">
          <div class="lb-stat"><span>钱包</span><b class="mono">${ui.escapeHtml(d.wallet)}</b></div>
          <div class="lb-stat"><span>全部成交</span><b>${d.totalTrades.toLocaleString("en-US")} 笔</b></div>
          <div class="lb-stat"><span>数据范围</span><b>${ui.escapeHtml(ts(d.firstTradeTs))} → ${ui.escapeHtml(ts(d.lastTradeTs))}</b></div>
          <div class="lb-stat"><span>分界点</span><b>${ui.escapeHtml(d.boundaryLabel)}</b></div>
          <div class="lb-stat"><span>生成时间</span><b>${ui.escapeHtml(new Date(d.generatedAt).toLocaleString("zh-CN"))}</b></div>
          <div class="row-actions"><a class="btn btn-ghost" href="https://polymarket.com/profile/${encodeURIComponent(d.wallet)}" target="_blank" rel="noopener noreferrer">打开主页 ↗</a></div>
        </div>
      </div>
      <div class="trader-period-grid">
        <div class="panel"><div class="panel-head"><div class="panel-title"><h2>5月22日之前</h2><p>${ui.escapeHtml(ts(before.firstTs))} → ${ui.escapeHtml(ts(before.lastTs))}</p></div></div><div class="panel-body">
          <div class="ta-big">${before.tradeCount.toLocaleString("en-US")} <span>笔</span></div>
          <p class="muted">名义额 ${money(before.notional)} · 买入 ${pct(before.buyRatio)} · 天气 ${pct(before.weatherRatio)}</p>
        </div></div>
        <div class="panel"><div class="panel-head"><div class="panel-title"><h2>5月22日至今</h2><p>${ui.escapeHtml(ts(after.firstTs))} → ${ui.escapeHtml(ts(after.lastTs))}</p></div></div><div class="panel-body">
          <div class="ta-big">${after.tradeCount.toLocaleString("en-US")} <span>笔</span></div>
          <p class="muted">名义额 ${money(after.notional)} · 买入 ${pct(after.buyRatio)} · 天气 ${pct(after.weatherRatio)}</p>
        </div></div>
      </div>
      <div class="panel"><div class="panel-head"><div class="panel-title"><h2>行为对比</h2><p>同一钱包两个时间段的成交特征</p></div></div><div class="panel-body">
        <table class="table lb-trade-table"><thead><tr><th>指标</th><th class="num-col">5月22日之前</th><th class="num-col">5月22日至今</th></tr></thead><tbody>${metricRows(before, after)}</tbody></table>
      </div></div>
      <div class="trader-market-grid">
        <div class="panel"><div class="panel-head"><div class="panel-title"><h2>之前 · 高频市场</h2></div></div><div class="panel-body">${marketTable(before.topMarkets)}</div></div>
        <div class="panel"><div class="panel-head"><div class="panel-title"><h2>之后 · 高频市场</h2></div></div><div class="panel-body">${marketTable(after.topMarkets)}</div></div>
      </div>`;
  }

  async function load() {
    try {
      const [res, settlementRes] = await Promise.all([
        fetch(DATA_URL, { cache: "no-store" }),
        fetch("/shared/traderNoSettlement.json", { cache: "no-store" }).catch(() => null),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.settlement = settlementRes && settlementRes.ok ? await settlementRes.json() : null;
      state.error = "";
    } catch (error) {
      state.error = `分析数据加载失败：${error.message}`;
    }
    render();
  }

  root.querySelector("#taReload")?.addEventListener("click", load);
  await load();
  return {
    destroy() {
      state.destroyed = true;
      root.innerHTML = "";
    },
  };
}

export function destroy() {}
