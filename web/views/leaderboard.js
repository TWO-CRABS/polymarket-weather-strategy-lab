/**
 * web/views/leaderboard.js — per-city trader reaction leaderboards.
 *
 * Data comes from the compact, generated /shared/traderReactionLeaderboards.json.
 * Each ahead event links to the corresponding Polymarket city/date event so the
 * user can verify the exact bracket and METAR release node manually.
 */
import * as ui from "/web/components/ui.js";

const DATA_URL = "/shared/traderReactionLeaderboards.json";

function fmtNodeTime(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value * 1000));
  } catch {
    return new Date(value * 1000).toISOString();
  }
}

function pct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";
}

function eventUrl(event) {
  const slug = String(event?.eventSlug || "").trim();
  return slug ? `https://polymarket.com/zh/event/${encodeURIComponent(slug)}` : "";
}

function userLabel(user) {
  return user.pseudonym || user.wallet || "—";
}

function profileUrl(wallet) {
  const value = String(wallet || "").trim();
  return value ? `https://polymarket.com/profile/${encodeURIComponent(value)}` : "";
}

function marketQuestion(event, fallbackCity = "") {
  if (!event) return "";
  const bracket = String(event.bracket || "").trim();
  const city = String(event.city || fallbackCity || "").trim();
  const date = new Date(`${event.eventDate || ""}T00:00:00Z`);
  if (!bracket || !city || !Number.isFinite(date.getTime())) return "";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const month = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  return `Will the highest temperature in ${city} be ${bracket} on ${month} ${day}?`;
}

function eventRows(user) {
  const events = Array.isArray(user.events) ? user.events : [];
  if (!events.length) {
    return '<tr class="lb-detail-row"><td colspan="8" class="muted lb-detail-empty">暂无 ahead 事件明细（该用户仅作为 involved 出现）</td></tr>';
  }
  const body = events.map((event) => {
    const url = eventUrl(event);
    const link = url
      ? `<a class="mkt-link" href="${ui.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">打开事件 ↗</a>`
      : "—";
    const profile = profileUrl(user.wallet);
    const question = marketQuestion(event);
    const profileLink = profile
      ? `<a class="mkt-link" href="${ui.escapeHtml(profile)}" target="_blank" rel="noopener noreferrer" data-profile-link data-market-text="${ui.escapeHtml(question)}" title="打开该用户主页并复制此市场">打开用户主页 ↗</a>`
      : "—";
    return `<tr>
      <td>${ui.escapeHtml(event.eventDate || "—")}</td>
      <td><b>${ui.escapeHtml(event.bracket || "—")}</b></td>
      <td class="mono">${ui.escapeHtml(fmtNodeTime(event.nodeTs))}</td>
      <td class="num-col">${ui.escapeHtml(String(event.baselinePrice ?? "—"))}</td>
      <td class="num-col">${ui.escapeHtml(String(event.repricePrice ?? "—"))}</td>
      <td>${event.prePositioned ? "节点前已持仓" : "窗口内成交"}</td>
      <td>${link}</td>
      <td>${profileLink}</td>
    </tr>`;
  }).join("");
  return `<tr class="lb-detail-row"><td colspan="8">
    <div class="lb-detail">
      <div class="lb-detail-title">${ui.escapeHtml(userLabel(user))} · 节点明细（北京时间）</div>
      <table class="lb-detail-table">
        <thead><tr>
          <th>日期</th><th>温度括号</th><th>发布节点时间</th><th class="num-col">Baseline</th>
          <th class="num-col">重定价</th><th>类型</th><th>市场核验</th><th>用户主页</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </td></tr>`;
}

export async function mount(root, ctx = {}) {
  const state = {
    data: null,
    cityData: null,
    city: String((ctx.params && ctx.params.city) || localStorage.getItem("polytemp.leaderboardCity") || ""),
    fromDate: "",
    toDate: "",
    search: "",
    eligibleOnly: false,
    eventType: "all",
    expanded: new Set(),
    loading: true,
    error: null,
    destroyed: false,
  };

  root.innerHTML = `
    <section class="view is-active">
      <div class="view-head">
        <div>
          <div class="eyebrow">TRADER REACTION / CITY INDEPENDENT</div>
          <h1>温度发布反应榜</h1>
          <p class="view-sub">每个城市独立统计：节点前买入 YES / 卖出 NO，且早于市场重定价。点开用户可查看具体节点并跳转 Polymarket 事件核验。</p>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost" id="lbRefresh" type="button">刷新</button>
        </div>
      </div>
      <div id="lbBody"><div class="empty-state">加载榜单…</div></div>
    </section>`;

  const body = root.querySelector("#lbBody");
  const refreshBtn = root.querySelector("#lbRefresh");

  function render() {
    if (state.destroyed) return;
    if (state.loading) {
      body.innerHTML = '<div class="empty-state">加载榜单…</div>';
      return;
    }
    if (state.error) {
      body.innerHTML = `<div class="empty-state">${ui.escapeHtml(state.error)}</div>`;
      return;
    }
    const data = state.data;
    if (!data || !data.cities) {
      body.innerHTML = '<div class="empty-state">暂无榜单数据，请等待后台统计完成。</div>';
      return;
    }
    const cities = Object.keys(data.cities).sort((a, b) => {
      const qa = data.cities[a].qualifiedWarmingNodes || 0;
      const qb = data.cities[b].qualifiedWarmingNodes || 0;
      return qb - qa || a.localeCompare(b);
    });
    if (!state.city || (state.city !== "__all__" && !data.cities[state.city])) state.city = cities[0] || "";
    const city = state.cityData && state.cityData.city === state.city
      ? state.cityData
      : state.city === "__all__"
        ? null
        : data.cities[state.city];
    if (!city) {
      body.innerHTML = '<div class="empty-state">暂无城市数据。</div>';
      return;
    }
    const query = state.search.trim().toLowerCase();
    const users = (city.users || []).filter((user) => {
      if (state.eligibleOnly && !user.eligible) return false;
      if (!query) return true;
      return `${user.pseudonym || ""} ${user.wallet || ""}`.toLowerCase().includes(query);
    });
    const maxShow = 100;
    body.innerHTML = `
      <div class="panel lb-summary">
        <div class="panel-body lb-summary-row">
          <div class="lb-stat"><span>范围</span><b>${ui.escapeHtml(city.cityLabel || state.city)}</b></div>
          <div class="lb-stat"><span>统计区间</span><b>${ui.escapeHtml(state.fromDate || data.fromDate)} → ${ui.escapeHtml(state.toDate || data.toDate)}</b></div>
          <div class="lb-stat"><span>合格节点</span><b>${city.qualifiedWarmingNodes}</b></div>
          <div class="lb-stat"><span>事件数</span><b>${city.eventCount ?? "—"}</b></div>
          <div class="lb-stat"><span>用户数</span><b>${city.userCount ?? users.length}</b></div>
          <div class="lb-stat"><span>替补门槛</span><b>${city.eligibleMin} 节点 · 反应率 &gt; 90%</b></div>
          <div class="lb-stat"><span>当前可用替补</span><b>${city.users.filter((u) => u.eligible).length}</b></div>
        </div>
      </div>
      <div class="lb-toolbar">
        <label class="field-label" for="lbCity">城市</label>
        <select class="input" id="lbCity">
          <option value="__all__" ${state.city === "__all__" ? "selected" : ""}>所有城市 · ${data.qualifiedWarmingNodes} 节点</option>
          ${cities.map((name) => `<option value="${ui.escapeHtml(name)}" ${name === state.city ? "selected" : ""}>${ui.escapeHtml(name)} · ${data.cities[name].qualifiedWarmingNodes} 节点</option>`).join("")}
        </select>
        <label class="field-label" for="lbFrom">从</label>
        <input class="input" id="lbFrom" type="date" min="${ui.escapeHtml(data.fromDate || "")}" max="${ui.escapeHtml(data.toDate || "")}" value="${ui.escapeHtml(state.fromDate || data.fromDate || "")}">
        <label class="field-label" for="lbTo">到</label>
        <input class="input" id="lbTo" type="date" min="${ui.escapeHtml(data.fromDate || "")}" max="${ui.escapeHtml(data.toDate || "")}" value="${ui.escapeHtml(state.toDate || data.toDate || "")}">
        <div class="segmented segmented-sm" role="group" aria-label="Ahead 类型">
          <button class="seg ${state.eventType === "all" ? "is-active" : ""}" type="button" data-lb-type="all">全部类型</button>
          <button class="seg ${state.eventType === "trade" ? "is-active" : ""}" type="button" data-lb-type="trade">窗口内成交</button>
          <button class="seg ${state.eventType === "pre" ? "is-active" : ""}" type="button" data-lb-type="pre">节点前已持仓</button>
        </div>
        <input class="input" id="lbSearch" type="search" placeholder="搜索伪名 / 钱包" value="${ui.escapeHtml(state.search)}">
        <div class="segmented segmented-sm" role="group" aria-label="榜单筛选">
          <button class="seg ${state.eligibleOnly ? "" : "is-active"}" type="button" data-lb-filter="all">全部</button>
          <button class="seg ${state.eligibleOnly ? "is-active" : ""}" type="button" data-lb-filter="eligible">仅达标</button>
        </div>
        <span class="muted">显示前 ${Math.min(users.length, maxShow)} / ${city.userCount ?? city.users.length} 名（默认包含未达标用户）</span>
      </div>
      <div class="panel">
        <div class="table-wrap lb-table-wrap">
          <table class="table lb-table">
            <thead><tr>
              <th>#</th><th>用户</th><th>钱包</th><th>状态</th><th class="num-col">Ahead / 节点</th>
              <th class="num-col">反应率</th><th class="num-col">Wilson 下界</th><th>Ahead 事件</th>
            </tr></thead>
            <tbody>
              ${users.slice(0, maxShow).map((user, index) => {
                const expanded = state.expanded.has(user.wallet);
                return `<tr class="lb-user-row" data-wallet="${ui.escapeHtml(user.wallet)}" tabindex="0">
                  <td class="num-col">${index + 1}</td>
                  <td><b>${ui.escapeHtml(userLabel(user))}</b></td>
                  <td class="mono muted">${ui.escapeHtml(user.wallet || "—")} <button class="btn-link" data-copy-wallet="${ui.escapeHtml(user.wallet || "")}" type="button">复制</button></td>
                  <td>${user.eligible ? '<span class="badge badge-up">达标</span>' : '<span class="badge badge-ghost">未达标</span>'}</td>
                  <td class="num-col">${user.ahead}/${user.qualified}</td>
                  <td class="num-col">${pct(user.reactionRate)}</td>
                  <td class="num-col">${pct(user.wilsonLower, 3)}</td>
                  <td>${(user.events || []).length} 个 <button class="btn-link" data-expand="${ui.escapeHtml(user.wallet)}" type="button">${expanded ? "收起" : "查看"}</button></td>
                </tr>${expanded ? eventRows(user) : ""}`;
              }).join("") || `<tr><td colspan="8" class="muted">${state.eligibleOnly ? "当前没有达标用户；切换「全部」可查看相对更高的未达标用户。" : "没有匹配用户"}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    body.querySelector("#lbCity")?.addEventListener("change", async (event) => {
      state.city = event.target.value;
      state.expanded.clear();
      try { localStorage.setItem("polytemp.leaderboardCity", state.city); } catch { /* ignore */ }
      await loadCity();
    });
    body.querySelector("#lbSearch")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      state.expanded.clear();
      render();
    });
    body.querySelector("#lbFrom")?.addEventListener("change", async (event) => {
      state.fromDate = event.target.value;
      state.expanded.clear();
      await loadCity();
    });
    body.querySelector("#lbTo")?.addEventListener("change", async (event) => {
      state.toDate = event.target.value;
      state.expanded.clear();
      await loadCity();
    });
    body.querySelectorAll("[data-profile-link]").forEach((link) => {
      link.addEventListener("click", () => {
        const text = link.dataset.marketText || "";
        if (!text) return;
        try {
          navigator.clipboard.writeText(text).then(
            () => ui.toast(`已复制市场：${text}`, { type: "info", timeout: 2400 }),
            () => ui.toast(`市场：${text}`, { type: "info", timeout: 3200 }),
          );
        } catch {
          ui.toast(`市场：${text}`, { type: "info", timeout: 3200 });
        }
      });
    });
    body.querySelectorAll("[data-expand]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const wallet = button.dataset.expand;
        if (state.expanded.has(wallet)) state.expanded.delete(wallet);
        else state.expanded.add(wallet);
        render();
      });
    });
    body.querySelectorAll("[data-copy-wallet]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const wallet = button.dataset.copyWallet || "";
        try {
          await navigator.clipboard.writeText(wallet);
          ui.toast("钱包地址已复制，可粘贴到策略构建器的跟单钱包", { type: "info", timeout: 1800 });
        } catch {
          ui.toast(`钱包地址：${wallet}`, { type: "info", timeout: 3000 });
        }
      });
    });
    body.querySelectorAll("[data-lb-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.eligibleOnly = button.dataset.lbFilter === "eligible";
        state.expanded.clear();
        render();
      });
    });
    body.querySelectorAll("[data-lb-type]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.eventType = button.dataset.lbType || "all";
        state.expanded.clear();
        await loadCity();
      });
    });
  }

  async function loadCity() {
    if (!state.city) return;
    state.loading = true;
    state.error = null;
    render();
    try {
      const params = new URLSearchParams({ city: state.city, from: state.fromDate, to: state.toDate, limit: "100", type: state.eventType });
      const res = await fetch(`/api/trader-leaderboards?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.cityData = await res.json();
      if (!state.fromDate) state.fromDate = state.cityData.fromDate || state.fromDate;
      if (!state.toDate) state.toDate = state.cityData.toDate || state.toDate;
    } catch (error) {
      state.cityData = null;
      state.error = `榜单区间查询失败：${error.message}`;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      if (!state.city) {
        const names = Object.keys(state.data.cities || {});
        names.sort((a, b) => (state.data.cities[b].qualifiedWarmingNodes || 0) - (state.data.cities[a].qualifiedWarmingNodes || 0));
        state.city = names[0] || "";
      }
      if (!state.fromDate) state.fromDate = state.data.fromDate || "";
      if (!state.toDate) state.toDate = state.data.toDate || "";
    } catch (error) {
      state.error = `榜单加载失败：${error.message}`;
    } finally {
      state.loading = false;
      render();
    }
    await loadCity();
  }

  refreshBtn?.addEventListener("click", load);
  await load();
  return {
    destroy() {
      state.destroyed = true;
      root.innerHTML = "";
    },
  };
}

export function destroy() {
  /* mount returns a scoped instance; kept for router API compatibility. */
}
