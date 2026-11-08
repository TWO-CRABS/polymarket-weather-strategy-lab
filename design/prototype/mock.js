/* ============================================================
   PolyTemp Terminal — 静态交互原型数据与模拟引擎
   纯前端、零依赖、零网络请求；所有数据均为本地假数据。
   打开方式：直接双击 index.html（file:// 可用）。
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     0. 工具函数
     ---------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round2 = (v) => Math.round(v * 100) / 100;

  function money(v) {
    const sign = v < 0 ? '−' : '';
    const abs = Math.abs(v);
    const [int, dec] = abs.toFixed(2).split('.');
    return sign + '$' + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
  }
  function signedMoney(v) {
    return (v >= 0 ? '+' : '−') + money(Math.abs(v)).replace(/^−/, '');
  }
  function pct(v, digits) {
    const d = digits === undefined ? 2 : digits;
    return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '%';
  }
  function signedPct(v, digits) {
    const d = digits === undefined ? 2 : digits;
    return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '%';
  }
  function c(v, digits) {
    return v.toFixed(digits === undefined ? 1 : digits) + '¢';
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  /** 模拟时钟：以 14:00:00 为运行起点，elapsed 为已运行秒数 */
  const SIM_BASE_SECONDS = 14 * 3600;
  function clockFromElapsed(elapsed) {
    const t = Math.floor(SIM_BASE_SECONDS + elapsed) % 86400;
    return pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor((t % 3600) / 60)) + ':' + pad2(t % 60);
  }
  function clockNoSeconds(elapsed) {
    const t = Math.floor(SIM_BASE_SECONDS + elapsed) % 86400;
    return pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor((t % 3600) / 60));
  }
  function durationLabel(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ' 分 ' + pad2(s) + ' 秒';
  }
  function shortDuration(minutes) {
    if (minutes < 60) return Math.round(minutes) + ' 分';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h + ' 小时' + (m ? ' ' + pad2(m) + ' 分' : '');
  }
  function hhmmssFromMinutesAgo(minutesAgo, nowElapsed) {
    return clockFromElapsed(Math.max(0, nowElapsed - minutesAgo * 60));
  }

  /** 确定性伪随机（用于初始骨架数据） */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** SVG 迷你折线图 */
  function sparkSVG(values, opts) {
    opts = opts || {};
    const w = opts.w || 62;
    const h = opts.h || 20;
    const color = opts.color || '#22D3EE';
    const n = values.length;
    if (!n) return '';
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min || 1;
    const stepX = n > 1 ? w / (n - 1) : w;
    const pts = values.map(function (v, i) {
      const x = (i * stepX).toFixed(1);
      const y = (h - 2 - ((v - min) / span) * (h - 4)).toFixed(1);
      return x + ',' + y;
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts + '" stroke="' + color + '" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* ----------------------------------------------------------
     1. 静态市场与城市
     ---------------------------------------------------------- */
  const CITIES = [
    { id: 'nyc', name: '纽约', code: 'KJFK' },
    { id: 'lon', name: '伦敦', code: 'EGLC' },
    { id: 'sel', name: '首尔', code: 'RKSI' },
    { id: 'ckg', name: '重庆', code: 'ZUCK' },
    { id: 'hkg', name: '香港', code: 'VHHH' }
  ];

  const BASE_MARKETS = [
    { id: 'nyc-le', cityId: 'nyc', city: '纽约', station: 'KJFK', bracket: '≤ 12°C', price: 8.4, liq: 620 },
    { id: 'nyc-13', cityId: 'nyc', city: '纽约', station: 'KJFK', bracket: '13°C', price: 22.6, liq: 1450 },
    { id: 'nyc-14', cityId: 'nyc', city: '纽约', station: 'KJFK', bracket: '14°C', price: 41.2, liq: 2380 },
    { id: 'lon-12', cityId: 'lon', city: '伦敦', station: 'EGLC', bracket: '12°C', price: 26.8, liq: 980 },
    { id: 'lon-13', cityId: 'lon', city: '伦敦', station: 'EGLC', bracket: '13°C', price: 43.0, liq: 1760 },
    { id: 'sel-15', cityId: 'sel', city: '首尔', station: 'RKSI', bracket: '15°C', price: 19.4, liq: 820 },
    { id: 'sel-16', cityId: 'sel', city: '首尔', station: 'RKSI', bracket: '16°C', price: 36.8, liq: 1340 },
    { id: 'ckg-20', cityId: 'ckg', city: '重庆', station: 'ZUCK', bracket: '20°C', price: 31.4, liq: 760 },
    { id: 'ckg-21', cityId: 'ckg', city: '重庆', station: 'ZUCK', bracket: '21°C', price: 44.6, liq: 1180 },
    { id: 'hkg-26', cityId: 'hkg', city: '香港', station: 'VHHH', bracket: '26°C', price: 22.8, liq: 1590 },
    { id: 'hkg-27', cityId: 'hkg', city: '香港', station: 'VHHH', bracket: '27°C', price: 29.8, liq: 2100 }
  ];

  /* ----------------------------------------------------------
     2. 运行状态
     ---------------------------------------------------------- */
  const state = {
    runId: 'RUN-20261108-0412',
    strategy: '均衡 · ±20%/1min 动量',
    running: true,
    paused: false,
    ended: false,
    speed: 5,
    elapsed: 32 * 60 + 7,
    initial: 10000,
    equity: 10435.36,
    peakEquity: 0,
    realized: 312.58,
    feesPaid: 37.42,
    spreadCost: 9.18,
    slipCost: 7.44,
    turnoverUsd: 0,
    wins: 8,
    losses: 5,
    tradeCount: 27,
    chartRange: 0,
    hoverIndex: -1,
    markets: [],
    signals: [],
    trades: [],
    positions: [],
    equityHistory: [],
    compareSel: new Set(),
    libraryFilter: 'all',
    historyQuery: '',
    historyStatus: 'all'
  };

  const MAX_POSITIONS = 6;
  const MAX_TRADES_KEPT = 40;
  const MAX_SIGNALS_KEPT = 30;

  /* ----------------------------------------------------------
     3. 初始化数据
     ---------------------------------------------------------- */
  const rngInit = mulberry32(20261108);

  function initMarkets() {
    state.markets = BASE_MARKETS.map(function (base) {
      const hist = [base.price];
      let v = base.price;
      for (let i = 0; i < 43; i++) {
        const drift = (rngInit() - 0.5) * 0.028;
        v = clamp(v / (1 + drift), 2, 96);
        hist.unshift(round2(v));
      }
      // 保证最后一点等于基准价格
      hist[hist.length - 1] = base.price;
      return {
        id: base.id, cityId: base.cityId, city: base.city, station: base.station,
        bracket: base.bracket, price: base.price, liq: base.liq, history: hist,
        spread: round2(0.8 + rngInit() * 1.2),
        lastTickMove: 0
      };
    });
  }

  function delta60(market) {
    const hist = market.history;
    const back = hist[Math.max(0, hist.length - 13)];
    if (!back) return 0;
    return ((market.price - back) / back) * 100;
  }

  function initPositions() {
    state.positions = [
      { id: 'p1', marketId: 'nyc-14', side: 'up', shares: 800, avg: 30.0, openedElapsed: state.elapsed - 340 },
      { id: 'p2', marketId: 'lon-13', side: 'down', shares: 500, avg: 64.0, openedElapsed: state.elapsed - 260 },
      { id: 'p3', marketId: 'sel-16', side: 'up', shares: 600, avg: 30.0, openedElapsed: state.elapsed - 190 },
      { id: 'p4', marketId: 'hkg-27', side: 'down', shares: 900, avg: 66.0, openedElapsed: state.elapsed - 120 },
      { id: 'p5', marketId: 'ckg-20', side: 'up', shares: 500, avg: 26.0, openedElapsed: state.elapsed - 55 }
    ].map(function (p) {
      const m = state.markets.find(function (x) { return x.id === p.marketId; });
      return Object.assign(p, { mark: marketSidePrice(m, p.side) });
    });
  }

  function marketById(id) {
    return state.markets.find(function (m) { return m.id === id; });
  }

  function marketSidePrice(market, side) {
    return side === 'up' ? market.price : round2(100 - market.price);
  }

  function feeFor(shares, priceCents) {
    const p = priceCents / 100;
    const fee = round5(shares * 0.05 * p * (1 - p));
    return fee < 0.00001 ? 0 : fee;
  }
  function round5(v) { return Math.round(v * 100000) / 100000; }

  /** 契约 reason / rejectReason → 中文标签（与 shared/contract.js 对齐） */
  const REASON_LABELS = {
    signal: '信号入场',
    take_profit: '止盈',
    stop_loss: '止损',
    max_hold: '超时',
    opposite_signal: '反向信号',
    hold_to_resolution: '持有到结算',
    resolution: '市场结算',
    manual: '手动平仓',
    risk_kill_switch: '风控熔断',
    cooldown: '冷却中',
    below_threshold: '未达阈值',
    spread_too_wide: '点差过宽',
    no_liquidity: '盘口无流动性',
    below_min_order: '低于最小下单量',
    insufficient_cash: '现金不足',
    max_positions: '达到最大持仓数',
    max_positions_per_market: '达到单市场持仓上限',
    market_not_accepting_orders: '市场暂停接单',
    stale_market: '行情过期',
    risk_blocked: '风控拦截'
  };
  function reasonLabel(reason) {
    return REASON_LABELS[reason] || reason || '—';
  }

  function marketLabel(market) {
    return market.city + ' · ' + market.bracket;
  }

  function makeTrade(offsetSeconds, market, side, outcome, shares, priceCents, realizedPnl, reason, status) {
    const notional = round2((shares * priceCents) / 100);
    return {
      t: state.elapsed - offsetSeconds,
      city: market.city,
      bracket: market.bracket,
      side: side,                 // BUY | SELL
      outcome: outcome,           // YES | NO
      shares: shares,
      price: priceCents,
      notional: notional,
      fee: feeFor(shares, priceCents),
      slippageCost: round2(shares * (0.3 + rngInit() * 0.9) / 100),
      realizedPnl: realizedPnl,
      reason: reason,
      status: status || 'filled'
    };
  }

  function initTrades() {
    const rows = [
      [12, 'nyc-14', 'BUY', 'YES', 800, 38.4, null, 'signal'],
      [28, 'lon-13', 'BUY', 'NO', 500, 57.2, null, 'signal'],
      [47, 'sel-16', 'BUY', 'YES', 600, 35.1, null, 'signal'],
      [66, 'hkg-27', 'BUY', 'NO', 900, 69.8, null, 'signal'],
      [92, 'ckg-20', 'BUY', 'YES', 500, 31.4, null, 'signal'],
      [120, 'hkg-26', 'SELL', 'NO', 300, 74.5, 8.16, 'take_profit'],
      [180, 'nyc-13', 'SELL', 'YES', 420, 21.8, -4.32, 'stop_loss'],
      [245, 'sel-15', 'SELL', 'NO', 610, 80.2, 12.48, 'take_profit'],
      [320, 'lon-12', 'SELL', 'YES', 380, 25.4, 3.9, 'max_hold'],
      [410, 'nyc-14', 'SELL', 'YES', 260, 62.0, -2.6, 'opposite_signal'],
      [520, 'hkg-27', 'SELL', 'YES', 350, 27.8, 6.3, 'take_profit'],
      [640, 'ckg-21', 'SELL', 'NO', 280, 56.4, 2.24, 'max_hold']
    ];
    state.trades = rows.map(function (r) {
      const m = marketById(r[1]);
      return makeTrade(r[0], m, r[2], r[3], r[4], r[5], r[6], r[7]);
    });
    state.turnoverUsd = round2(state.trades.reduce(function (s, t) { return s + t.notional; }, 0));
  }

  function initSignals() {
    const sig = [
      { offset: 18, city: '纽约', bracket: '14°C', move: 23.4, from: 33.4, to: 41.2, side: 'up', status: 'executed', reason: 'signal', note: '已以 41.2¢ 买入 800 股 YES' },
      { offset: 54, city: '香港', bracket: '27°C', move: -27.8, from: 41.2, to: 29.8, side: 'down', status: 'executed', reason: 'signal', note: '已以 70.2¢ 买入 900 股 NO' },
      { offset: 96, city: '首尔', bracket: '16°C', move: 21.2, from: 30.4, to: 36.8, side: 'up', status: 'executed', reason: 'signal', note: '已以 36.8¢ 买入 600 股 YES' },
      { offset: 143, city: '重庆', bracket: '20°C', move: -19.6, from: 39.0, to: 31.4, side: 'down', status: 'skipped', reason: 'cooldown', note: '冷却中 · 距上次同类信号 43s' },
      { offset: 188, city: '伦敦', bracket: '12°C', move: 24.1, from: 21.6, to: 26.8, side: 'up', status: 'blocked', reason: 'max_positions', note: '并发持仓已达 6 笔上限' }
    ];
    state.signals = sig.map(function (s) {
      return {
        t: state.elapsed - s.offset, city: s.city, bracket: s.bracket, move: s.move,
        from: s.from, to: s.to, side: s.side, status: s.status, reason: s.reason, note: s.note
      };
    });
  }

  function initEquityHistory() {
    let unrealized = 0;
    state.positions.forEach(function (p) { unrealized += unrealizedPnl(p); });
    state.equity = round2(state.initial + state.realized + unrealized - state.feesPaid);

    const n = 64;
    const total = state.elapsed;
    const rng = mulberry32(771014);
    const raw = [state.initial];
    for (let i = 1; i <= n; i++) {
      let v = raw[i - 1] + (rng() - 0.44) * 20;
      if (i === 46) v += 132;   // 制造一次冲高，形成最大回撤叙事
      if (i === 52) v -= 74;
      raw.push(v);
    }
    const corr = (state.equity - raw[n]) / n;
    state.equityHistory = raw.map(function (v, i) {
      if (i === 0) return { t: 0, v: state.initial };
      return { t: Math.round((i / n) * total), v: round2(v + corr * i) };
    });
    state.equityHistory[n].v = state.equity;
    state.peakEquity = Math.max.apply(null, state.equityHistory.map(function (p) { return p.v; }));
  }

  function unrealizedPnl(position) {
    const market = marketById(position.marketId);
    const mark = marketSidePrice(market, position.side);
    return ((mark - position.avg) / 100) * position.shares;
  }

  /* ----------------------------------------------------------
     4. 指标计算
     ---------------------------------------------------------- */
  function metrics() {
    const returnPct = ((state.equity - state.initial) / state.initial) * 100;
    const total = state.wins + state.losses;
    const winRate = total ? (state.wins / total) * 100 : 0;
    const unrealized = state.positions.reduce(function (s, p) { return s + unrealizedPnl(p); }, 0);
    const costTotal = state.feesPaid + state.spreadCost + state.slipCost;
    const peak = state.peakEquity;
    const dd = peak > 0 ? ((peak - state.equity) / peak) * 100 : 0;
    return {
      returnPct: returnPct,
      winRate: winRate,
      unrealized: unrealized,
      costTotal: costTotal,
      drawdown: Math.max(0, dd),
      totalClosed: total
    };
  }

  /* ----------------------------------------------------------
     5. 渲染 · 行情
     ---------------------------------------------------------- */
  function renderMarkets() {
    const grid = $('#marketGrid');
    if (!grid) return;
    grid.innerHTML = state.markets.map(function (m) {
      const d = delta60(m);
      const color = d >= 0 ? '#4ADE9B' : '#FB7185';
      const tint = d >= 0 ? 'rgba(34,199,124,.10)' : 'rgba(240,80,106,.10)';
      return '<article class="mkt" data-mkt="' + m.id + '" style="--mkt-tint:' + tint + '">' +
        '<div class="mkt-top"><span class="mkt-city"><i></i>' + m.city + '</span>' +
        '<span class="mkt-spark" data-spark="' + m.id + '">' + sparkSVG(sliceHistory(m), { color: color }) + '</span></div>' +
        '<div class="mkt-bracket">' + m.bracket + '</div>' +
        '<div class="mkt-price-row"><span class="mkt-price" data-price="' + m.id + '">' + c(m.price) + '</span>' +
        '<span class="mkt-delta ' + (d >= 0 ? 'up' : 'down') + '" data-delta="' + m.id + '">' +
        (d >= 0 ? '▲' : '▼') + ' ' + signedPct(d, 1) + '</span></div>' +
        '<div class="mkt-sub"><span>隐含概率 ' + m.price.toFixed(1) + '%</span><span>价差 ' + m.spread.toFixed(1) + '¢ · ' + money(m.liq).replace('.00', '') + '</span></div>' +
        '<div class="prob-bar"><i data-prob="' + m.id + '" style="width:' + m.price.toFixed(1) + '%"></i></div>' +
        '</article>';
    }).join('');
  }

  function sliceHistory(market) {
    return market.history.slice(-30);
  }

  function updateMarkets() {
    state.markets.forEach(function (m) {
      const d = delta60(m);
      const priceEl = $('[data-price="' + m.id + '"]');
      const deltaEl = $('[data-delta="' + m.id + '"]');
      const sparkEl = $('[data-spark="' + m.id + '"]');
      const probEl = $('[data-prob="' + m.id + '"]');
      const card = $('[data-mkt="' + m.id + '"]');
      if (priceEl) priceEl.textContent = c(m.price);
      if (deltaEl) {
        deltaEl.className = 'mkt-delta ' + (d >= 0 ? 'up' : 'down');
        deltaEl.textContent = (d >= 0 ? '▲' : '▼') + ' ' + signedPct(d, 1);
      }
      if (sparkEl) {
        sparkEl.innerHTML = sparkSVG(sliceHistory(m), { color: d >= 0 ? '#4ADE9B' : '#FB7185' });
      }
      if (probEl) probEl.style.width = m.price.toFixed(1) + '%';
      if (card) {
        card.style.setProperty('--mkt-tint', d >= 0 ? 'rgba(34,199,124,.10)' : 'rgba(240,80,106,.10)');
      }
    });
  }

  /* ----------------------------------------------------------
     6. 渲染 · 信号流 / 成交 / 持仓
     ---------------------------------------------------------- */
  function signalBadge(sig) {
    if (sig.status === 'executed') return '<span class="badge badge-up"><span aria-hidden="true">✓</span> 已执行</span>';
    if (sig.status === 'skipped') return '<span class="badge badge-amber">跳过 · ' + reasonLabel(sig.reason) + '</span>';
    return '<span class="badge badge-down">拦截 · ' + reasonLabel(sig.reason) + '</span>';
  }

  function renderSignals() {
    const feed = $('#signalFeed');
    if (!feed) return;
    const badge = $('#signalCountBadge');
    if (badge) badge.textContent = state.signals.length + ' 条';
    if (!state.signals.length) {
      feed.innerHTML = '<div class="sig-empty">等待首个动量信号触发…</div>';
      return;
    }
    feed.innerHTML = state.signals.map(function (s) {
      const action = s.side === 'up' ? 'BUY YES' : 'BUY NO';
      return '<article class="sig ' + s.status + '">' +
        '<div class="sig-head"><span class="sig-title">' + s.city + ' · ' + s.bracket + '</span>' +
        '<span class="sig-time">' + clockFromElapsed(s.t) + '</span></div>' +
        '<div class="sig-detail"><span class="' + (s.move >= 0 ? 'up' : 'down') + '">1m ' + (s.move >= 0 ? '▲' : '▼') + ' ' + Math.abs(s.move).toFixed(1) + '%</span>' +
        '<span class="arrow">' + s.from.toFixed(1) + '¢ → ' + s.to.toFixed(1) + '¢</span>' +
        '<span>' + action + '</span></div>' +
        '<div class="sig-foot">' + signalBadge(s) + '<span class="sig-reason">' + s.note + '</span></div>' +
        '</article>';
    }).join('');
  }

  function statusBadge(status) {
    if (status === 'rejected') return '<span class="badge badge-down">拒单</span>';
    if (status === 'partial') return '<span class="badge badge-amber">部分成交</span>';
    return '<span class="badge badge-cyan">成交</span>';
  }

  function renderTrades() {
    const body = $('#tradesBody');
    if (!body) return;
    body.innerHTML = state.trades.slice(0, 16).map(function (t) {
      const pnlCell = t.realizedPnl === null || t.realizedPnl === undefined
        ? '<span class="cell-dim">—</span>'
        : '<span class="' + (t.realizedPnl >= 0 ? 'up' : 'down') + '">' + signedMoney(t.realizedPnl) + '</span>';
      return '<tr>' +
        '<td class="mono cell-dim">' + clockFromElapsed(t.t) + '</td>' +
        '<td><div class="mkt-name"><b>' + t.city + '</b><span>' + t.bracket + '</span></div></td>' +
        '<td><div class="trade-dir"><span class="mono cell-dim">' + t.side + '</span>' +
        (t.outcome === 'YES' ? '<span class="badge badge-up"><span aria-hidden="true">▲</span> YES</span>' : '<span class="badge badge-down"><span aria-hidden="true">▼</span> NO</span>') +
        '</div></td>' +
        '<td class="num-col">' + t.shares + '</td>' +
        '<td class="num-col">' + c(t.price) + '</td>' +
        '<td class="num-col">' + money(t.notional) + '</td>' +
        '<td class="num-col amber" title="官方 weather taker 费，5 位小数">' + '$' + t.fee.toFixed(5) + '</td>' +
        '<td class="num-col cell-dim">' + money(t.slippageCost) + '</td>' +
        '<td class="num-col">' + pnlCell + '</td>' +
        '<td><div class="trade-dir">' + statusBadge(t.status) + '<span class="badge badge-ghost">' + reasonLabel(t.reason) + '</span></div></td>' +
        '</tr>';
    }).join('');
  }

  function renderPositions() {
    const body = $('#positionsBody');
    if (!body) return;
    const badge = $('#positionBadge');
    if (badge) badge.textContent = state.positions.length + ' / ' + MAX_POSITIONS;
    const empty = $('#positionsEmpty');
    if (!state.positions.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    body.innerHTML = state.positions.map(function (p) {
      const market = marketById(p.marketId);
      const mark = marketSidePrice(market, p.side);
      const pnl = unrealizedPnl(p);
      const implied = p.side === 'up' ? market.price : round2(100 - market.price);
      const holdMin = Math.max(0, Math.round((state.elapsed - p.openedElapsed) / 60));
      return '<tr>' +
        '<td><div class="mkt-name"><b>' + market.city + '</b><span>' + market.bracket + ' · 持仓 ' + holdMin + 'm</span></div></td>' +
        '<td>' + (p.side === 'up'
          ? '<span class="badge badge-up"><span aria-hidden="true">▲</span> YES</span>'
          : '<span class="badge badge-down"><span aria-hidden="true">▼</span> NO</span>') + '</td>' +
        '<td class="num-col">' + p.shares + '<span class="cell-sub">均价 ' + c(p.avg) + '</span></td>' +
        '<td class="num-col">' + c(mark) + '<span class="cell-sub">概率 ' + implied.toFixed(1) + '%' + (p.side === 'down' ? ' 估' : '') + '</span></td>' +
        '<td class="num-col ' + (pnl >= 0 ? 'up' : 'down') + '">' + signedMoney(pnl) + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ----------------------------------------------------------
     7. 渲染 · 指标 / 顶栏 / 成本
     ---------------------------------------------------------- */
  function updateMetrics() {
    const m = metrics();
    const setText = function (sel, text) { const el = $(sel); if (el) el.textContent = text; };

    setText('#mEquity', money(state.equity));
    const eqSub = $('#mEquitySub');
    if (eqSub) {
      eqSub.className = 'metric-sub ' + (m.returnPct >= 0 ? 'up' : 'down');
      eqSub.innerHTML = '<span aria-hidden="true">' + (m.returnPct >= 0 ? '▲' : '▼') + '</span> ' + signedMoney(state.equity - state.initial) + ' · ' + signedPct(m.returnPct);
    }
    const retEl = $('#mReturn');
    if (retEl) {
      retEl.textContent = signedPct(m.returnPct);
      retEl.className = 'metric-value num ' + (m.returnPct >= 0 ? 'up' : 'down');
    }
    const realEl = $('#mRealized');
    if (realEl) {
      realEl.textContent = signedMoney(state.realized);
      realEl.className = 'metric-value num ' + (state.realized >= 0 ? 'up' : 'down');
    }
    setText('#mTradeCount', m.totalClosed + ' 笔平仓 · 未实现 ' + signedMoney(m.unrealized));
    setText('#mWinRate', m.winRate.toFixed(1) + '%');
    setText('#mWinLoss', state.wins + ' 胜 / ' + state.losses + ' 负');
    setText('#mFees', money(state.feesPaid));
    const feeDragPct = state.initial ? (state.feesPaid / state.initial) * 100 : 0;
    setText('#mFeeSub', '费用拖累 ' + feeDragPct.toFixed(2) + '% · 换手 ' + money(state.turnoverUsd));
    const ddEl = $('#mDrawdown');
    if (ddEl) {
      ddEl.textContent = '−' + m.drawdown.toFixed(2) + '%';
      ddEl.className = 'metric-value num down';
    }
    const ddSub = ddEl && ddEl.parentElement ? ddEl.parentElement.querySelector('.metric-sub') : null;
    if (ddSub) ddSub.textContent = '峰值 ' + money(state.peakEquity);

    // 顶栏
    setText('#topEquity', money(state.equity));
    const pnlEl = $('#topPnl');
    if (pnlEl) {
      const gain = state.equity - state.initial;
      pnlEl.className = 'num ' + (gain >= 0 ? 'up' : 'down');
      pnlEl.innerHTML = '<span aria-hidden="true">' + (gain >= 0 ? '▲' : '▼') + '</span> ' + signedMoney(gain);
    }
    setText('#simClock', clockFromElapsed(state.elapsed));
    setText('#dashElapsed', durationLabel(state.elapsed));
    setText('#navMeta', navMetaText());

    // 成本拆解
    const costTotal = m.costTotal;
    setText('#costFee', money(state.feesPaid));
    setText('#costSpread', money(state.spreadCost));
    setText('#costSlip', money(state.slipCost));
    setText('#costOther', money(0));
    setText('#costTotal', money(costTotal));
    const widths = {
      fee: costTotal ? (state.feesPaid / costTotal) * 100 : 0,
      spread: costTotal ? (state.spreadCost / costTotal) * 100 : 0,
      slip: costTotal ? (state.slipCost / costTotal) * 100 : 0,
      other: 0
    };
    setCostBar('#costFeeBar', widths.fee);
    setCostBar('#costSpreadBar', widths.spread);
    setCostBar('#costSlipBar', widths.slip);
    setCostBar('#costOtherBar', widths.other);
    const costRate = state.turnoverUsd > 0 ? (costTotal / state.turnoverUsd) * 100 : 0;
    setText('#costRateBadge', '成本率 ' + costRate.toFixed(2) + '%');
    setText('#costFoot', '成本率 = 总摩擦 / 换手成交额（当前 ' + money(state.turnoverUsd) + '）。手续费逐笔按 fee = shares × 0.05 × p × (1−p) 计提；点差与滑点为归因项，已含在成交价内，不二次扣减。');

    // 弹窗数据
    setText('#modalEquity', money(state.equity));
    setText('#modalOpenPos', String(state.positions.length));
  }

  function setCostBar(sel, width) {
    const el = $(sel);
    if (el) el.style.width = clamp(width, 0, 100).toFixed(1) + '%';
  }

  function navMetaText() {
    const now = SIM_BASE_SECONDS + state.elapsed;
    const nyc = clockNoSecondsFrom(now - 13 * 3600);
    const lon = clockNoSecondsFrom(now - 8 * 3600);
    const sel = clockNoSecondsFrom(now + 1 * 3600);
    return 'NYC ' + nyc + ' · LDN ' + lon + ' · SEL ' + sel;
  }
  function clockNoSecondsFrom(totalSeconds) {
    const t = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
    return pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor((t % 3600) / 60));
  }

  /* ----------------------------------------------------------
     8. 权益曲线（Canvas）
     ---------------------------------------------------------- */
  const chart = { canvas: null, ctx: null, rectW: 0, rectH: 0 };

  function initChart() {
    chart.canvas = $('#equityChart');
    if (!chart.canvas) return;
    chart.ctx = chart.canvas.getContext('2d');
    resizeChart();
    drawChart();
  }

  function resizeChart() {
    if (!chart.canvas) return;
    const rect = chart.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    chart.rectW = Math.max(320, rect.width);
    chart.rectH = rect.height || 260;
    chart.canvas.width = Math.round(chart.rectW * dpr);
    chart.canvas.height = Math.round(chart.rectH * dpr);
    chart.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function visibleEquity() {
    if (!state.equityHistory.length) return [];
    const last = state.equityHistory[state.equityHistory.length - 1].t;
    if (!state.chartRange) return state.equityHistory.slice();
    const start = Math.max(0, last - state.chartRange);
    return state.equityHistory.filter(function (p) { return p.t >= start; });
  }

  function drawChart() {
    if (!chart.ctx || !state.equityHistory.length) return;
    const ctx = chart.ctx;
    const W = chart.rectW;
    const H = chart.rectH;
    const padL = 46, padR = 14, padT = 14, padB = 24;

    const points = visibleEquity();
    if (!points.length) return;

    const vals = points.map(function (p) { return p.v; });
    const minVal = Math.min.apply(null, vals.concat([state.initial]));
    const maxVal = Math.max.apply(null, vals.concat([state.initial]));
    const span = maxVal - minVal || 1;
    const padSpan = span * 0.16;
    const yMin = minVal - padSpan;
    const yMax = maxVal + padSpan;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const tStart = points[0].t;
    const tEnd = points[points.length - 1].t;
    const tSpan = tEnd - tStart || 1;

    const xOf = function (t) { return padL + ((t - tStart) / tSpan) * plotW; };
    const yOf = function (v) { return padT + (1 - (v - yMin) / (yMax - yMin)) * plotH; };

    ctx.clearRect(0, 0, W, H);

    // 网格 + Y 轴标签
    ctx.font = '10px "Cascadia Mono", Consolas, monospace';
    ctx.textBaseline = 'middle';
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const v = yMin + ((yMax - yMin) * i) / gridLines;
      const y = yOf(v);
      ctx.strokeStyle = i === 0 || i === gridLines ? 'rgba(44,63,82,0.75)' : 'rgba(30,44,58,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y + 0.5);
      ctx.lineTo(W - padR, y + 0.5);
      ctx.stroke();
      ctx.fillStyle = '#748698';
      ctx.textAlign = 'right';
      ctx.fillText('$' + (v / 1000).toFixed(1) + 'k', padL - 8, y);
    }

    // X 轴时间标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xLabels = 4;
    for (let i = 0; i <= xLabels; i++) {
      const t = tStart + (tSpan * i) / xLabels;
      const x = xOf(t);
      ctx.fillStyle = '#748698';
      ctx.fillText(clockNoSeconds(t), x, H - padB + 7);
    }

    // 初始资金基准线
    const yBase = yOf(state.initial);
    if (yBase >= padT && yBase <= padT + plotH) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(116,134,152,0.5)';
      ctx.beginPath();
      ctx.moveTo(padL, yBase);
      ctx.lineTo(W - padR, yBase);
      ctx.stroke();
      ctx.restore();
    }

    // 面积渐变
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(34,211,238,0.24)');
    grad.addColorStop(0.65, 'rgba(34,211,238,0.06)');
    grad.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.beginPath();
    ctx.moveTo(xOf(points[0].t), yOf(points[0].v));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(points[i].t), yOf(points[i].v));
    ctx.lineTo(xOf(points[points.length - 1].t), padT + plotH);
    ctx.lineTo(xOf(points[0].t), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 曲线
    ctx.beginPath();
    ctx.moveTo(xOf(points[0].t), yOf(points[0].v));
    for (let i = 1; i < points.length; i++) ctx.lineTo(xOf(points[i].t), yOf(points[i].v));
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(34,211,238,0.45)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 最新点
    const lastPoint = points[points.length - 1];
    const lx = xOf(lastPoint.t);
    const ly = yOf(lastPoint.v);
    ctx.beginPath();
    ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#22D3EE';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34,211,238,0.18)';
    ctx.fill();
    ctx.font = '600 10px "Cascadia Mono", Consolas, monospace';
    ctx.fillStyle = '#67E8F9';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(money(lastPoint.v), Math.min(lx + 42, W - padR), Math.max(ly - 6, padT + 10));

    // 悬停十字线
    if (state.hoverIndex >= 0 && state.hoverIndex < points.length) {
      const hp = points[state.hoverIndex];
      const hx = xOf(hp.t);
      const hy = yOf(hp.v);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(163,178,194,0.55)';
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#E9F0F6';
      ctx.fill();
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ----------------------------------------------------------
     9. 实时模拟引擎
     ---------------------------------------------------------- */
  let tickTimer = null;

  function tick() {
    if (!state.running || state.paused) {
      setStatusUI();
      return;
    }
    const step = state.speed; // 每次 tick 前进的模拟秒数
    state.elapsed += step;

    // 行情随机游走
    state.markets.forEach(function (m) {
      const shock = (Math.random() - 0.5) * (0.014 + step * 0.0009);
      const momentum = delta60(m) * 0.00035;
      const next = clamp(m.price * (1 + shock + momentum), 2, 96);
      m.lastTickMove = next - m.price;
      m.price = round2(next);
      m.history.push(m.price);
      if (m.history.length > 60) m.history.shift();
    });

    // 权益随机游走 + 持仓浮动
    const drift = (Math.random() - 0.47) * step * 1.1;
    const unrealizedBefore = state.positions.reduce(function (s, p) { return s + unrealizedPnl(p); }, 0);
    state.equity = round2(state.equity + drift);
    state.peakEquity = Math.max(state.peakEquity, state.equity);
    state.equityHistory.push({ t: state.elapsed, v: state.equity });
    if (state.equityHistory.length > 2400) state.equityHistory.shift();

    // 偶发信号 / 成交
    if (Math.random() < 0.30) {
      generateSignal();
    }

    // 偶发平仓
    if (state.positions.length && Math.random() < 0.10) {
      closeRandomPosition();
    }

    // 更新持仓标记价
    state.positions.forEach(function (p) {
      const market = marketById(p.marketId);
      p.mark = marketSidePrice(market, p.side);
    });

    // 渲染
    updateMarkets();
    updateMetrics();
    drawChart();
    if (state.dirtySignals) { renderSignals(); state.dirtySignals = false; }
    if (state.dirtyTrades) { renderTrades(); state.dirtyTrades = false; }
    if (state.dirtyPositions) { renderPositions(); state.dirtyPositions = false; }
  }

  function generateSignal() {
    const market = state.markets[Math.floor(Math.random() * state.markets.length)];
    const movePct = (Math.random() - 0.5) * 56;
    if (Math.abs(movePct) < 12) return;
    const side = movePct >= 0 ? 'up' : 'down';
    const price = marketSidePrice(market, side);
    const from = round2(clamp(price / (1 + movePct / 100), 2, 95));
    const to = price;
    const roll = Math.random();
    let status = 'executed';
    let reason = 'signal';
    let note = '';

    if (state.positions.length >= MAX_POSITIONS) {
      status = 'blocked';
      reason = 'max_positions';
      note = '并发持仓已达 ' + MAX_POSITIONS + ' 笔上限（maxPositions）';
    } else if (roll < 0.18) {
      status = 'skipped';
      reason = 'cooldown';
      note = '冷却中 · 距上次同类信号不足 300s';
    } else if (market.spread > 3) {
      status = 'skipped';
      reason = 'spread_too_wide';
      note = '价差 ' + market.spread.toFixed(1) + '¢ 超过 maxSpread 3¢';
    } else if (Math.abs(movePct) < 20) {
      status = 'skipped';
      reason = 'below_threshold';
      note = '未达触发阈值 · 需要 ≥ 20.0% 且 ≥ 1¢';
    }

    state.signals.unshift({
      t: state.elapsed, city: market.city, bracket: market.bracket,
      move: movePct, from: from, to: to, side: side, status: status,
      reason: reason, note: note
    });
    if (state.signals.length > MAX_SIGNALS_KEPT) state.signals.pop();
    state.dirtySignals = true;

    if (status === 'executed') {
      executeEntry(market, side, to);
    }
  }

  function executeEntry(market, side, price) {
    const notional = 100;
    const shares = Math.max(5, Math.round((notional / price) * 100));
    const actualNotional = round2((shares * price) / 100);
    const fee = feeFor(shares, price);
    const slippageCost = round2(shares * (0.003 + Math.random() * 0.009));
    state.trades.unshift({
      t: state.elapsed, city: market.city, bracket: market.bracket,
      side: 'BUY', outcome: side === 'up' ? 'YES' : 'NO',
      shares: shares, price: price, notional: actualNotional, fee: fee,
      slippageCost: slippageCost, realizedPnl: null,
      reason: 'signal', status: 'filled'
    });
    state.tradeCount += 1;
    state.turnoverUsd = round2(state.turnoverUsd + actualNotional);
    state.feesPaid = round2(state.feesPaid + fee);
    state.spreadCost = round2(state.spreadCost + shares * 0.012);
    state.slipCost = round2(state.slipCost + slippageCost);
    state.dirtyTrades = true;

    if (state.positions.length < MAX_POSITIONS) {
      state.positions.push({
        id: 'p' + Date.now() + Math.random().toString(16).slice(2, 6),
        marketId: market.id, side: side, shares: shares, avg: price,
        openedElapsed: state.elapsed, mark: marketSidePrice(market, side)
      });
      state.dirtyPositions = true;
    }
    if (state.trades.length > MAX_TRADES_KEPT) state.trades.pop();
  }

  function closeRandomPosition() {
    const idx = Math.floor(Math.random() * state.positions.length);
    const p = state.positions[idx];
    const market = marketById(p.marketId);
    const mark = marketSidePrice(market, p.side);
    const pnl = ((mark - p.avg) / 100) * p.shares;
    const fee = feeFor(p.shares, mark);
    const reason = pnl > 0 ? 'take_profit' : 'stop_loss';
    state.realized = round2(state.realized + pnl - fee);
    state.feesPaid = round2(state.feesPaid + fee);
    state.turnoverUsd = round2(state.turnoverUsd + (p.shares * mark) / 100);
    if (pnl >= 0) state.wins += 1; else state.losses += 1;
    state.tradeCount += 1;
    state.trades.unshift({
      t: state.elapsed, city: market.city, bracket: market.bracket,
      side: 'SELL', outcome: p.side === 'up' ? 'YES' : 'NO',
      shares: p.shares, price: mark, notional: round2((p.shares * mark) / 100),
      fee: fee, slippageCost: 0, realizedPnl: round2(pnl - fee),
      reason: reason, status: 'filled'
    });
    if (state.trades.length > MAX_TRADES_KEPT) state.trades.pop();
    state.positions.splice(idx, 1);
    state.dirtyPositions = true;
    state.dirtyTrades = true;
  }

  function setStatusUI() {
    const status = $('#runStatus');
    const label = $('#runStatusLabel');
    const pauseBtn = $('#btnPause');
    const pip = $('#tabPip');
    let stateName = 'live';
    let labelText = '实时运行中';
    if (state.ended) { stateName = 'ended'; labelText = '运行已结束'; }
    else if (state.paused) { stateName = 'paused'; labelText = '已暂停'; }
    if (status) status.setAttribute('data-state', stateName);
    if (label) label.textContent = labelText;
    if (pauseBtn) {
      pauseBtn.innerHTML = state.paused
        ? '<span aria-hidden="true">▶</span> 继续'
        : '<span aria-hidden="true">❚❚</span> 暂停';
      pauseBtn.disabled = state.ended;
    }
    const stopBtn = $('#btnStop');
    if (stopBtn) stopBtn.disabled = state.ended;
    if (pip) pip.hidden = stateName !== 'live';
  }

  /* ----------------------------------------------------------
     10. 运行历史 / 对比
     ---------------------------------------------------------- */
  const PAST_RUNS = [
    {
      id: 'RUN-20261108-0338', strategy: '均衡 · ±20%/1min 动量', start: '2026-11-08 13:26',
      duration: '26 分', trades: 24, ret: 3.12, winRate: 58.3, fees: 31.10, dd: 2.05,
      status: 'ended', seed: 7
    },
    {
      id: 'RUN-20261107-2201', strategy: '保守 · 高概率区间', start: '2026-11-07 22:01',
      duration: '1 小时 02 分', trades: 18, ret: 1.84, winRate: 55.6, fees: 12.40, dd: 1.42,
      status: 'ended', seed: 18
    },
    {
      id: 'RUN-20261107-1842', strategy: '均值回归 · 30–70¢ 区间', start: '2026-11-07 18:42',
      duration: '48 分', trades: 9, ret: -0.92, winRate: 44.4, fees: 6.88, dd: 3.10,
      status: 'ended', seed: 23
    },
    {
      id: 'RUN-20261107-1207', strategy: '均衡 · ±20%/1min 动量', start: '2026-11-07 12:07',
      duration: '2 小时 14 分', trades: 41, ret: 6.30, winRate: 63.4, fees: 58.20, dd: 2.86,
      status: 'ended', seed: 41
    },
    {
      id: 'RUN-20261106-2330', strategy: '激进 · 30s 高频动量', start: '2026-11-06 23:30',
      duration: '19 分', trades: 15, ret: -2.40, winRate: 40.0, fees: 22.05, dd: 4.12,
      status: 'error', seed: 56
    }
  ];

  function runSeries(run) {
    const n = 36;
    const rng = mulberry32(run.seed || 11);
    const series = [10000];
    const target = 10000 * (1 + run.ret / 100);
    for (let i = 1; i <= n; i++) {
      series.push(series[i - 1] + (rng() - 0.5) * 26);
    }
    const corr = (target - series[n]) / n;
    return series.map(function (v, i) { return round2(v + corr * i); });
  }

  function currentRun() {
    const m = metrics();
    return {
      id: state.runId,
      strategy: state.strategy,
      start: '2026-11-08 14:00',
      duration: shortDuration(state.elapsed / 60),
      trades: state.tradeCount,
      ret: round2(m.returnPct),
      winRate: round2(m.winRate),
      fees: round2(state.feesPaid),
      dd: round2(m.drawdown),
      status: state.ended ? 'ended' : (state.paused ? 'paused' : 'running'),
      seed: 5,
      isCurrent: true
    };
  }

  function allRuns() {
    return [currentRun()].concat(PAST_RUNS);
  }

  function runStatusLabel(status) {
    if (status === 'running') return '运行中';
    if (status === 'paused') return '已暂停';
    if (status === 'error') return '异常中止';
    return '已结束';
  }

  function statusPill(status) {
    if (status === 'running') return '<span class="badge badge-cyan"><span class="live-dot live-dot-sm" aria-hidden="true"></span> 运行中</span>';
    if (status === 'paused') return '<span class="badge badge-amber">已暂停</span>';
    if (status === 'error') return '<span class="badge badge-down">异常中止</span>';
    return '<span class="badge badge-ghost">已结束</span>';
  }

  function renderRuns() {
    const body = $('#runsBody');
    if (!body) return;
    const q = state.historyQuery.trim().toLowerCase();
    const runs = allRuns().filter(function (r) {
      const matchQ = !q || r.id.toLowerCase().indexOf(q) >= 0 || r.strategy.toLowerCase().indexOf(q) >= 0;
      const matchS = state.historyStatus === 'all' || r.status === state.historyStatus;
      return matchQ && matchS;
    });
    const badge = $('#runCountBadge');
    if (badge) badge.textContent = runs.length + ' 条';
    const empty = $('#runsEmpty');
    if (empty) empty.hidden = runs.length > 0;
    body.innerHTML = runs.map(function (r) {
      const checked = state.compareSel.has(r.id) ? ' checked' : '';
      const retCls = r.ret >= 0 ? 'up' : 'down';
      return '<tr data-run="' + r.id + '">' +
        '<td class="check-col"><input type="checkbox" data-compare="' + r.id + '" aria-label="选择 ' + r.id + ' 进行对比"' + checked + '></td>' +
        '<td><div class="mkt-name"><b>' + r.strategy + '</b><span>' + r.id + '</span></div></td>' +
        '<td class="cell-dim mono">' + r.start + '</td>' +
        '<td class="num-col">' + r.duration + '</td>' +
        '<td class="num-col">' + r.trades + '</td>' +
        '<td class="num-col ' + retCls + '">' + signedPct(r.ret) + '</td>' +
        '<td class="num-col">' + r.winRate.toFixed(1) + '%</td>' +
        '<td class="num-col amber">' + money(r.fees) + '</td>' +
        '<td class="num-col down">−' + r.dd.toFixed(2) + '%</td>' +
        '<td>' + statusPill(r.status) + '</td>' +
        '<td><div class="row-actions"><button type="button" class="link-btn" data-view-run="' + r.id + '">查看</button>' +
        '<button type="button" class="link-btn" data-copy-run="' + r.id + '">复制</button></div></td>' +
        '</tr>';
    }).join('');
    updateCompareBar();
  }

  function updateCompareBar() {
    const bar = $('#compareBar');
    const count = $('#compareCount');
    const btn = $('#btnDoCompare');
    if (count) count.textContent = String(state.compareSel.size);
    if (btn) btn.disabled = state.compareSel.size < 2;
    if (bar) bar.hidden = !state.compareSel.size;
  }

  function renderCompare() {
    const grid = $('#compareGrid');
    const panel = $('#comparePanel');
    if (!grid || !panel) return;
    const runs = allRuns().filter(function (r) { return state.compareSel.has(r.id); });
    if (runs.length < 2) { panel.hidden = true; return; }
    const best = runs.reduce(function (a, b) { return b.ret > a.ret ? b : a; }, runs[0]);
    grid.innerHTML = runs.map(function (r) {
      const series = runSeries(r);
      const color = r.ret >= 0 ? '#4ADE9B' : '#FB7185';
      return '<div class="compare-col' + (r.id === best.id ? ' compare-best' : '') + '">' +
        '<h3>' + r.strategy + (r.id === best.id ? ' <span class="badge badge-up">最佳</span>' : '') + '</h3>' +
        '<div class="compare-id">' + r.id + '</div>' +
        '<div class="mini-chart">' + sparkSVG(series, { w: 220, h: 46, color: color }) + '</div>' +
        '<div class="compare-kv"><span>收益率</span><strong class="' + (r.ret >= 0 ? 'up' : 'down') + '">' + signedPct(r.ret) + '</strong></div>' +
        '<div class="compare-kv"><span>胜率</span><strong>' + r.winRate.toFixed(1) + '%</strong></div>' +
        '<div class="compare-kv"><span>成交笔数</span><strong>' + r.trades + '</strong></div>' +
        '<div class="compare-kv"><span>手续费</span><strong class="amber">' + money(r.fees) + '</strong></div>' +
        '<div class="compare-kv"><span>最大回撤</span><strong class="down">−' + r.dd.toFixed(2) + '%</strong></div>' +
        '<div class="compare-kv"><span>状态</span><strong>' + runStatusLabel(r.status) + '</strong></div>' +
        '</div>';
    }).join('');
    panel.hidden = false;
    if (typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ----------------------------------------------------------
     11. 策略库
     ---------------------------------------------------------- */
  const LIBRARY = [
    {
      id: 'balanced', cat: 'momentum', title: '均衡 · ±20%/1min 动量',
      desc: '需求原文策略的稳健实现：60 秒 ±20% 且最小绝对变动 1¢，单笔 $25、最多 5 个仓位。',
      tags: ['60s 窗口', '±20%', 'minAbsMove 1¢', '5 仓上限'], runs: 6, best: 6.3, win: 63.4, seed: 5
    },
    {
      id: 'conservative', cat: 'momentum', title: '保守 · 高概率区间',
      desc: '只看 5¢–95¢ 的高流动性区间，2 次确认 + 600s 长冷却，弱化噪声信号。',
      tags: ['5–95¢', '120s 窗口', '25% 阈值', '2 次确认'], runs: 4, best: 1.84, win: 55.6, seed: 18
    },
    {
      id: 'aggressive', cat: 'momentum', title: '激进 · 30s 高频动量',
      desc: '30 秒窗口、12% 阈值、120s 冷却，追求交易频次；费用拖累与回撤显著放大。',
      tags: ['30s 窗口', '12% 阈值', '8 仓上限', '500ms tick'], runs: 3, best: 6.3, win: 47.4, seed: 23
    },
    {
      id: 'reversion-band', cat: 'reversion', title: '均值回归 · 30–70¢ 区间',
      desc: '价格触及 30–70¢ 区间边缘时反向入场，止盈 12%，仅在中高流动性括号使用。',
      tags: ['30–70¢', '均值回归', '止盈 12%', '单市场 $80'], runs: 2, best: 0.92, win: 44.4, seed: 33
    },
    {
      id: 'hkg-heat', cat: 'custom', title: '香港高温动量（自定义）',
      desc: '从均衡预设克隆，只保留香港 26–28°C 区间，单笔 $150、最大 2 仓。',
      tags: ['香港', '26–28°C', '$150 单笔', '自定义'], runs: 1, best: 2.14, win: 60.0, seed: 44
    },
    {
      id: 'blank', cat: 'custom', title: '空白策略',
      desc: '从零开始配置全部参数：universe / signal / execution / exit / risk / fees / sim。',
      tags: ['从零配置'], runs: 0, best: null, win: null, seed: 0, blank: true
    }
  ];

  function renderLibrary() {
    const grid = $('#libraryGrid');
    if (!grid) return;
    const list = LIBRARY.filter(function (s) {
      return state.libraryFilter === 'all' || s.cat === state.libraryFilter;
    });
    const empty = $('#libraryEmpty');
    if (empty) empty.hidden = list.length > 0;
    grid.innerHTML = list.map(function (s) {
      const series = s.blank ? [] : runSeries({ seed: s.seed, ret: s.best || 0 });
      const color = (s.best || 0) >= 0 ? '#4ADE9E' : '#FB7185';
      return '<article class="strategy-card" data-strategy="' + s.id + '">' +
        '<div class="strategy-top"><div><div class="strategy-title">' + s.title + '</div></div>' +
        '<span class="badge ' + (s.cat === 'momentum' ? 'badge-cyan' : s.cat === 'reversion' ? 'badge-amber' : 'badge-ghost') + '">' +
        (s.cat === 'momentum' ? '动量' : s.cat === 'reversion' ? '回归' : '自定义') + '</span></div>' +
        '<p class="strategy-desc">' + s.desc + '</p>' +
        '<div class="strategy-tags">' + s.tags.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' +
        (series.length ? '<div class="strategy-chart">' + sparkSVG(series, { w: 260, h: 44, color: color }) + '</div>' : '') +
        '<div class="strategy-stats">' +
        '<div class="strategy-stat"><span>历史运行</span><strong>' + (s.runs || '—') + '</strong></div>' +
        '<div class="strategy-stat"><span>最佳收益</span><strong class="' + ((s.best || 0) >= 0 ? 'up' : 'down') + '">' + (s.best === null ? '—' : signedPct(s.best)) + '</strong></div>' +
        '<div class="strategy-stat"><span>平均胜率</span><strong>' + (s.win === null ? '—' : s.win.toFixed(1) + '%') + '</strong></div>' +
        '</div>' +
        '<div class="strategy-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-load="' + s.id + '">载入构建</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-run="' + s.id + '">运行</button>' +
        '</div></article>';
    }).join('');
  }

  /* ----------------------------------------------------------
     12. 策略构建 · 校验与成本
     ---------------------------------------------------------- */
  function readNumber(sel, fallback) {
    const el = $(sel);
    if (!el) return fallback;
    const v = parseFloat(el.value);
    return isNaN(v) ? fallback : v;
  }

  function val(sel, fallback) {
    const el = $(sel);
    return el ? el.value : fallback;
  }
  function checked(sel) {
    const el = $(sel);
    return !!(el && el.checked);
  }

  function updateBuilder() {
    const threshold = readNumber('#moveThresholdPct', 20);
    const windowSec = readNumber('#windowSec', 60);
    const minMoveCents = readNumber('#minAbsMove', 1);
    const maxSpreadCents = readNumber('#maxSpread', 3);
    const minPriceCents = readNumber('#minPrice', 2);
    const maxPriceCents = readNumber('#maxPrice', 98);
    const maxMarkets = readNumber('#maxMarkets', 12);
    const minLiq = readNumber('#minLiquidityUsd', 500);
    const cooldown = readNumber('#cooldownSec', 300);
    const maxHold = readNumber('#maxHoldSec', 3600);
    const takeProfit = readNumber('#takeProfitPct', 50);
    const stopLoss = readNumber('#stopLossPct', 30);
    const bankroll = readNumber('#bankrollUsd', 1000);
    const maxPositions = readNumber('#maxPositions', 5);
    const maxPositionUsd = readNumber('#maxPositionUsd', 50);
    const sizingMode = val('#sizingMode', 'fixed_stake');
    const sizingValue = readNumber('#sizingValue', 25);
    const holdToResolution = checked('#holdToResolution');
    const priceField = val('#priceField', 'mid');
    const direction = val('#direction', 'both');
    const citiesSelected = $$('#cityPicker input[type="checkbox"]:checked').length;

    // 仓位滑块的单位随 sizingMode 切换
    const slider = $('#sizingValue');
    if (slider) {
      if (sizingMode === 'pct_equity') {
        slider.min = '1'; slider.max = '100'; slider.step = '1';
      } else {
        slider.min = '10'; slider.max = '500'; slider.step = '5';
      }
    }
    const notional = sizingMode === 'pct_equity' ? round2((bankroll * sizingValue) / 100) : sizingValue;

    setText('#thresholdOut', '+' + threshold.toFixed(1) + '%');
    setText('#notionalOut', sizingMode === 'pct_equity' ? sizingValue + '%' : '$' + sizingValue);
    setRangeFill('#moveThresholdPct', threshold, 5, 50);
    setRangeFill('#sizingValue', sizingValue, parseInt(slider ? slider.min : 10, 10), parseInt(slider ? slider.max : 500, 10));

    // 行情数量估算（受 maxMarkets 截断）
    const marketCount = citiesSelected ? Math.min(maxMarkets, citiesSelected * 2 + 1) : 0;
    setText('#universeBadge', citiesSelected + ' 城 · ' + marketCount + ' 市场');

    // 成本估算：p=50¢、半价差 = maxSpread/2
    const p = 0.5;
    const shares = notional / p;
    const halfSpread = Math.max(0.005, maxSpreadCents / 2 / 100);
    const fee = round2(notional * 0.05 * p * (1 - p));
    const spreadCost = round2(shares * halfSpread);
    const totalCost = round2(fee + spreadCost);
    const minProfitableMovePct = (2 * (halfSpread + 0.05 * p * (1 - p))) / p * 100;
    setText('#sideNotional', money(notional));
    setText('#sideFee', money(fee));
    setText('#sideSlip', money(spreadCost));
    setText('#sideTotal', money(totalCost));
    setText('#sideMinMove', '+' + minProfitableMovePct.toFixed(1) + '%');

    // 校验项（对齐 shared/contract.js validateStrategy 的 errors / warnings 口径）
    const errs = [];
    const warns = [];
    const oks = [];

    if (citiesSelected === 0) errs.push({ title: '未选择城市', desc: 'universe.cities 为空；至少选择 1 个城市。' });
    else oks.push({ title: '市场范围有效', desc: citiesSelected + ' 个城市，约 ' + marketCount + ' 个温度区间市场。' });

    if (minPriceCents >= maxPriceCents) errs.push({ title: '价格带非法', desc: 'minPrice 必须小于 maxPrice，当前 ' + minPriceCents + '¢ / ' + maxPriceCents + '¢。' });
    if (maxMarkets < 1) errs.push({ title: 'maxMarkets 非法', desc: '最大市场数必须 ≥ 1。' });
    if (sizingMode === 'pct_equity' && sizingValue > 100) errs.push({ title: '仓位比例越界', desc: 'pct_equity 的 sizingValue 必须在 1–100 之间。' });
    if (sizingMode === 'fixed_stake' && sizingValue > bankroll) errs.push({ title: '单笔超过本金', desc: 'fixed_stake 单笔 ' + money(sizingValue) + ' 大于初始资金 ' + money(bankroll) + '。' });

    if (threshold <= 20 && minMoveCents < 1) warns.push({ title: '低价噪声护栏不足', desc: '百分比阈值较低且 minAbsMove < 1¢；在 2–10¢ 区间 ±20% 仅 0.4–2¢，易被点差吞噬。' });
    if (threshold < 10) warns.push({ title: '触发阈值偏低', desc: '±' + threshold + '% 会被盘口噪音频繁触发，手续费将快速累积。' });
    if (minProfitableMovePct > threshold) warns.push({ title: '阈值不足以覆盖摩擦', desc: '该价位最低盈利涨幅门槛约 ' + minProfitableMovePct.toFixed(1) + '%，高于 moveThresholdPct ' + threshold + '%，含费期望可能为负。' });
    if (priceField === 'last') warns.push({ title: 'last 可能长时间不更新', desc: '建议使用 mid 或 best_bid / best_ask；last 无新成交时不产生样本。' });
    if (maxSpreadCents > 5) warns.push({ title: '允许点差过宽', desc: 'maxSpread ' + maxSpreadCents + '¢ > 5¢，市价单滑点与成本会非常高。' });
    if (stopLoss > 70) warns.push({ title: '止损幅度过大', desc: '止损 ' + stopLoss + '% > 70%，单笔风险可能超过仓位。' });
    if (sizingMode === 'pct_equity' && sizingValue > 50) warns.push({ title: '单笔权益占比过高', desc: '单笔使用 ' + sizingValue + '% 权益，回撤风险极高。' });
    if (maxPositionUsd < notional) warns.push({ title: '单市场上限偏小', desc: '单笔名义 ' + money(notional) + ' 超过 maxPositionUsd ' + money(maxPositionUsd) + '，订单会被截断。' });
    if (maxPositions * notional > bankroll * 0.5) warns.push({ title: '总敞口偏高', desc: '最大并发 ' + maxPositions + ' 仓 × ' + money(notional) + ' 超过初始资金 50%。' });
    if (cooldown < windowSec) warns.push({ title: '冷却时间偏短', desc: 'cooldownSec ' + cooldown + 's 短于 windowSec ' + windowSec + 's，可能对同一段行情重复开仓。' });
    if (holdToResolution) warns.push({ title: '持有至结算已开启', desc: 'holdToResolution=true 时止盈 / 止损 / 超时 / 反向退出均不生效，只有结算可平仓。' });
    if (checked('#killSwitch') && readNumber('#maxDrawdownPct', 20) < 5) warns.push({ title: '回撤熔断阈值过低', desc: 'maxDrawdownPct < 5%，策略可能刚开始就被停机。' });

    if (!errs.length && !warns.length) oks.push({ title: '参数组合就绪', desc: '市场、信号、执行、退出与风控均通过校验，可启动模拟。' });
    oks.push({ title: '费用模型已加载', desc: 'weather_taker 5% · fee = shares × 0.05 × p × (1−p) · 最低盈利门槛 ' + minProfitableMovePct.toFixed(1) + '%。' });
    if (direction === 'both') oks.push({ title: '方向映射已校验', desc: 'UP → 买入 YES；DOWN → 买入 NO（仅做多 token，无杠杆）。' });

    const items = errs.concat(warns, oks).slice(0, 6);
    const list = $('#validationList');
    if (list) {
      list.innerHTML = items.map(function (it) {
        const cls = errs.indexOf(it) >= 0 ? 'err' : warns.indexOf(it) >= 0 ? 'warn' : 'ok';
        const ico = cls === 'ok' ? '✓' : cls === 'warn' ? '!' : '✕';
        return '<div class="validation-item ' + cls + '"><span class="v-ico" aria-hidden="true">' + ico + '</span>' +
          '<div><strong>' + it.title + '</strong> <span>' + it.desc + '</span></div></div>';
      }).join('');
    }

    // JSON 预览
    const pre = $('#jsonPreview');
    if (pre && !pre.hidden) pre.textContent = buildConfigJSON();

    // 风控徽标
    const riskBadge = $('#riskBadge');
    if (riskBadge) riskBadge.textContent = errs.length ? '有待修复' : warns.length ? '有告警' : '未触发';

    // 启动门禁：errors 阻断启动（与 validateStrategy.valid 一致）
    ['#btnLaunch', '#btnSideLaunch'].forEach(function (sel) {
      const btn = $(sel);
      if (!btn) return;
      btn.disabled = errs.length > 0;
      btn.title = errs.length ? '请先修复校验错误：' + errs[0].title : '';
    });
  }

  function setRangeFill(sel, val, min, max) {
    const el = $(sel);
    if (!el) return;
    const p = clamp(((val - min) / (max - min)) * 100, 0, 100);
    el.style.background = 'linear-gradient(90deg, var(--cyan) 0%, var(--cyan) ' + p + '%, var(--panel-3) ' + p + '%, var(--panel-3) 100%)';
  }

  function buildConfigJSON() {
    const cities = $$('#cityPicker input[type="checkbox"]:checked').map(function (el) {
      return el.getAttribute('data-city');
    });
    const threshold = readNumber('#moveThresholdPct', 20);
    const sizingMode = val('#sizingMode', 'fixed_stake');
    const sizingValue = readNumber('#sizingValue', 25);
    return JSON.stringify({
      version: 1,
      name: '均衡 · ±20%/1min 动量',
      description: '由策略构建器导出的 StrategyConfig（原型演示，不可直接下单）',
      universe: {
        cities: cities,
        maxMarkets: Math.round(readNumber('#maxMarkets', 12)),
        minPrice: round2(readNumber('#minPrice', 2) / 100),
        maxPrice: round2(readNumber('#maxPrice', 98) / 100),
        minLiquidityUsd: readNumber('#minLiquidityUsd', 500),
        maxSpread: round2(readNumber('#maxSpread', 3) / 100),
        minTimeToResolutionSec: Math.round(readNumber('#ttrMinH', 0.25) * 3600),
        maxTimeToResolutionSec: Math.round(readNumber('#ttrMaxH', 36) * 3600),
        onlyAcceptingOrders: checked('#onlyAcceptingOrders')
      },
      signal: {
        priceField: val('#priceField', 'mid'),
        windowSec: Math.round(readNumber('#windowSec', 60)),
        moveThresholdPct: threshold,
        minAbsMove: round2(readNumber('#minAbsMove', 1) / 100),
        direction: val('#direction', 'both'),
        confirmationTicks: Math.round(readNumber('#confirmationTicks', 1)),
        cooldownSec: Math.round(readNumber('#cooldownSec', 300)),
        maxSignalsPerMarket: Math.round(readNumber('#maxSignalsPerMarket', 5)),
        requireSpreadOk: checked('#requireSpreadOk')
      },
      execution: {
        orderType: 'market',
        sizingMode: sizingMode,
        sizingValue: sizingValue,
        maxPositionUsd: readNumber('#maxPositionUsd', 50),
        maxPositions: Math.round(readNumber('#maxPositions', 5)),
        maxPositionsPerMarket: Math.round(readNumber('#maxPositionsPerMarket', 1)),
        fillModel: 'book_walk',
        slippageBufferBps: round(readNumber('#slippageBufferBps', 0))
      },
      exit: {
        takeProfitPct: readNumber('#takeProfitPct', 50),
        stopLossPct: readNumber('#stopLossPct', 30),
        maxHoldSec: Math.round(readNumber('#maxHoldSec', 3600)),
        holdToResolution: checked('#holdToResolution'),
        exitOnOppositeSignal: checked('#exitOnOppositeSignal')
      },
      risk: {
        bankrollUsd: readNumber('#bankrollUsd', 1000),
        maxDrawdownPct: readNumber('#maxDrawdownPct', 20),
        dailyLossLimitUsd: readNumber('#dailyLossLimitUsd', 100),
        killSwitch: checked('#killSwitch')
      },
      fees: {
        model: 'weather_taker',
        takerFeeRate: 0.05
      },
      sim: {
        mode: val('#simMode', 'live'),
        tickIntervalMs: Math.round(readNumber('#tickIntervalMs', 1000)),
        replayLookbackMin: Math.round(readNumber('#replayLookbackMin', 60)),
        speed: state.speed
      }
    }, null, 2);
  }

  function round(v) { return Math.round(v); }

  /* ----------------------------------------------------------
     13. Toast / 弹窗
     ---------------------------------------------------------- */
  function toast(message, kind) {
    const stack = $('#toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    const icons = { success: '✓', warn: '!', info: 'i', error: '✕' };
    el.innerHTML = '<span class="t-ico" aria-hidden="true">' + (icons[kind] || 'i') + '</span><div>' + message + '</div>';
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(12px)';
      el.style.transition = 'opacity 180ms, transform 180ms';
      setTimeout(function () { el.remove(); }, 200);
    }, 3200);
  }

  function openStopModal() {
    if (state.ended) return;
    updateMetrics();
    const modal = $('#stopModal');
    if (!modal) return;
    modal.hidden = false;
    const confirmBtn = $('#btnConfirmStop');
    if (confirmBtn) confirmBtn.focus();
  }

  function closeStopModal() {
    const modal = $('#stopModal');
    if (modal) modal.hidden = true;
  }

  function stopRun() {
    // 按当前标记价结算全部持仓（manual = 手动平仓；真实回放中结算为 resolution）
    state.positions.forEach(function (p) {
      const market = marketById(p.marketId);
      const mark = marketSidePrice(market, p.side);
      const pnl = ((mark - p.avg) / 100) * p.shares;
      const fee = feeFor(p.shares, mark);
      state.realized = round2(state.realized + pnl - fee);
      state.feesPaid = round2(state.feesPaid + fee);
      state.turnoverUsd = round2(state.turnoverUsd + (p.shares * mark) / 100);
      state.equity = round2(state.equity - fee);
      if (pnl >= 0) state.wins += 1; else state.losses += 1;
      state.trades.unshift({
        t: state.elapsed, city: market.city, bracket: market.bracket,
        side: 'SELL', outcome: p.side === 'up' ? 'YES' : 'NO',
        shares: p.shares, price: mark, notional: round2((p.shares * mark) / 100),
        fee: fee, slippageCost: 0, realizedPnl: round2(pnl - fee),
        reason: 'manual', status: 'filled'
      });
    });
    state.positions = [];
    state.running = false;
    state.paused = false;
    state.ended = true;

    closeStopModal();
    setStatusUI();
    updateMetrics();
    renderPositions();
    renderTrades();
    renderRuns();
    drawChart();
    toast('模拟运行已停止并完成结算 · ' + state.runId, 'info');
  }

  function resetRun() {
    state.running = true;
    state.paused = false;
    state.ended = false;
    state.elapsed = 0;
    state.initial = 10000;
    state.realized = 0;
    state.feesPaid = 0;
    state.spreadCost = 0;
    state.slipCost = 0;
    state.turnoverUsd = 0;
    state.wins = 0;
    state.losses = 0;
    state.tradeCount = 0;
    state.trades = [];
    state.positions = [];
    state.compareSel.clear();
    state.signals = [
      { t: 0, city: '纽约', bracket: '14°C', move: 22.1, from: 32.6, to: 41.2, side: 'up', status: 'executed', reason: 'signal', note: '已以 41.2¢ 买入 240 股 YES' }
    ];
    state.runId = 'RUN-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(1000 + Math.floor(Math.random() * 9000));
    state.equity = state.initial;
    state.equityHistory = [{ t: 0, v: state.initial }];
    state.peakEquity = state.initial;
    state.chartRange = 0;
    const idEl = $('#dashRunId');
    if (idEl) idEl.textContent = state.runId;
    const topId = $('#topRunId');
    if (topId) topId.textContent = state.runId;
    const rangeLabel = $('#chartRangeLabel');
    if (rangeLabel) rangeLabel.textContent = '全部区间 · 0 分钟';
    $$('.segmented [data-range]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-range') === '0');
    });
    setStatusUI();
    updateMetrics();
    renderSignals();
    renderTrades();
    renderPositions();
    renderRuns();
    drawChart();
  }

  function launchRun() {
    resetRun();
    switchView('dashboard');
    toast('模拟运行已启动 · ' + state.runId + ' · ' + state.strategy, 'success');
  }

  /* ----------------------------------------------------------
     14. 视图切换
     ---------------------------------------------------------- */
  function switchView(name) {
    $$('.tab').forEach(function (tab) {
      const on = tab.getAttribute('data-view') === name;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.view').forEach(function (view) {
      const on = view.id === 'view-' + name;
      view.classList.toggle('is-active', on);
      view.hidden = !on;
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (name === 'dashboard') {
      requestAnimationFrame(function () { resizeChart(); drawChart(); });
    }
  }

  /* ----------------------------------------------------------
     15. 事件绑定
     ---------------------------------------------------------- */
  function bindEvents() {
    // 主导航
    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchView(tab.getAttribute('data-view')); });
    });

    // 顶部启动 / 侧栏启动
    const launch = function () { launchRun(); };
    const btnLaunch = $('#btnLaunch');
    if (btnLaunch) btnLaunch.addEventListener('click', launch);
    const btnSideLaunch = $('#btnSideLaunch');
    if (btnSideLaunch) btnSideLaunch.addEventListener('click', launch);

    // 城市多选
    $$('#cityPicker input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.closest('.city-option').classList.toggle('is-on', cb.checked);
        updateBuilder();
      });
      cb.closest('.city-option').classList.toggle('is-on', cb.checked);
    });

    // 表单联动（字段名对齐 shared/contract.js）
    const formIds = [
      'maxMarkets', 'minLiquidityUsd', 'maxSpread', 'minPrice', 'maxPrice',
      'ttrMinH', 'ttrMaxH', 'onlyAcceptingOrders',
      'priceField', 'windowSec', 'minAbsMove', 'confirmationTicks',
      'moveThresholdPct', 'direction', 'cooldownSec', 'maxSignalsPerMarket', 'requireSpreadOk',
      'orderType', 'sizingMode', 'maxPositionUsd', 'maxPositions', 'sizingValue',
      'maxPositionsPerMarket', 'slippageBufferBps', 'tickIntervalMs',
      'takeProfitPct', 'stopLossPct', 'maxHoldSec', 'holdToResolution', 'exitOnOppositeSignal',
      'bankrollUsd', 'maxDrawdownPct', 'dailyLossLimitUsd', 'killSwitch',
      'simMode', 'replayLookbackMin'
    ];
    formIds.forEach(function (id) {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('input', updateBuilder);
      el.addEventListener('change', updateBuilder);
    });

    const speedSelect = $('#speed');
    if (speedSelect) {
      speedSelect.addEventListener('change', function () {
        state.speed = parseInt(speedSelect.value, 10) || 5;
        syncSpeedUI();
      });
    }

    // JSON 预览
    const btnJson = $('#btnPreviewJson');
    if (btnJson) {
      btnJson.addEventListener('click', function () {
        const pre = $('#jsonPreview');
        if (!pre) return;
        const show = pre.hidden;
        pre.hidden = !show;
        btnJson.setAttribute('aria-expanded', show ? 'true' : 'false');
        btnJson.textContent = show ? '收起策略 JSON' : '查看策略 JSON';
        if (show) pre.textContent = buildConfigJSON();
      });
    }

    const btnSave = $('#btnSaveDraft');
    if (btnSave) btnSave.addEventListener('click', function () {
      toast('草稿已保存（本地浏览器）· 参数未提交到服务端', 'success');
    });

    // Dashboard 速度
    $$('.segmented [data-speed]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.speed = parseInt(btn.getAttribute('data-speed'), 10);
        syncSpeedUI();
        toast('模拟速度已切换为 ' + state.speed + '×', 'info');
      });
    });

    // 暂停 / 停止
    const pauseBtn = $('#btnPause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        if (state.ended) return;
        state.paused = !state.paused;
        setStatusUI();
        if (state.paused) toast('已暂停模拟：行情与权益曲线冻结，可随时继续。', 'warn');
        else toast('已继续运行 · ' + state.speed + '× 速度', 'info');
      });
    }
    const stopBtn = $('#btnStop');
    if (stopBtn) stopBtn.addEventListener('click', openStopModal);
    const cancelStop = $('#btnCancelStop');
    if (cancelStop) cancelStop.addEventListener('click', closeStopModal);
    const closeModal = $('#btnModalClose');
    if (closeModal) closeModal.addEventListener('click', closeStopModal);
    const confirmStop = $('#btnConfirmStop');
    if (confirmStop) confirmStop.addEventListener('click', stopRun);
    const overlay = $('#stopModal');
    if (overlay) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeStopModal(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !overlay.hidden) closeStopModal();
      });
    }

    // 图表范围
    $$('.segmented [data-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.segmented [data-range]').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        state.chartRange = parseInt(btn.getAttribute('data-range'), 10);
        const label = $('#chartRangeLabel');
        if (label) {
          if (!state.chartRange) label.textContent = '全部区间 · ' + Math.round(state.elapsed / 60) + ' 分钟';
          else label.textContent = '近 ' + (state.chartRange >= 60 ? state.chartRange / 60 + ' 分钟' : state.chartRange + ' 秒');
        }
        state.hoverIndex = -1;
        drawChart();
      });
    });

    // 图表 hover
    const canvas = $('#equityChart');
    if (canvas) {
      const tooltip = $('#chartTooltip');
      canvas.addEventListener('mousemove', function (e) {
        const points = visibleEquity();
        if (!points.length) return;
        const rect = canvas.getBoundingClientRect();
        const padL = 46, padR = 14;
        const x = e.clientX - rect.left;
        const plotW = rect.width - padL - padR;
        if (x < padL || x > padL + plotW) { hideTooltip(); return; }
        const tStart = points[0].t;
        const tEnd = points[points.length - 1].t;
        const t = tStart + ((x - padL) / plotW) * (tEnd - tStart);
        let nearest = 0;
        let bestDist = Infinity;
        points.forEach(function (p, i) {
          const d = Math.abs(p.t - t);
          if (d < bestDist) { bestDist = d; nearest = i; }
        });
        state.hoverIndex = nearest;
        const p = points[nearest];
        if (tooltip) {
          const pnl = p.v - state.initial;
          tooltip.hidden = false;
          tooltip.innerHTML = '<div>' + clockFromElapsed(p.t) + ' · 已运行 ' + durationLabel(p.t) + '</div>' +
            '<strong>' + money(p.v) + '</strong>' +
            '<div class="' + (pnl >= 0 ? 'up' : 'down') + '">' + signedMoney(pnl) + ' / ' + signedPct((pnl / state.initial) * 100) + '</div>';
          const tw = 168;
          let left = x + 14;
          if (left + tw > rect.width) left = x - tw - 14;
          tooltip.style.left = left + 'px';
          tooltip.style.top = '18px';
        }
        drawChart();
      });
      canvas.addEventListener('mouseleave', hideTooltip);
      function hideTooltip() {
        state.hoverIndex = -1;
        if (tooltip) tooltip.hidden = true;
        drawChart();
      }
    }

    // 历史筛选 / 搜索
    const historySearch = $('#historySearch');
    if (historySearch) {
      historySearch.addEventListener('input', function () {
        state.historyQuery = historySearch.value;
        renderRuns();
      });
    }
    const historyFilter = $('#historyFilter');
    if (historyFilter) {
      historyFilter.addEventListener('change', function () {
        state.historyStatus = historyFilter.value;
        renderRuns();
      });
    }

    // 对比选择（事件委托）
    const runsBody = $('#runsBody');
    if (runsBody) {
      runsBody.addEventListener('change', function (e) {
        const cb = e.target.closest('input[data-compare]');
        if (!cb) return;
        const id = cb.getAttribute('data-compare');
        if (cb.checked) {
          if (state.compareSel.size >= 3) {
            cb.checked = false;
            toast('最多同时对比 3 条运行记录', 'warn');
            return;
          }
          state.compareSel.add(id);
        } else {
          state.compareSel.delete(id);
        }
        updateCompareBar();
      });
      runsBody.addEventListener('click', function (e) {
        const viewBtn = e.target.closest('[data-view-run]');
        if (viewBtn) {
          toast('原型中「查看」将打开该次运行详情；当前仅展示对比视图。', 'info');
          return;
        }
        const copyBtn = e.target.closest('[data-copy-run]');
        if (copyBtn) toast('已复制参数为新草稿（原型演示）', 'success');
      });
    }

    const btnCompareMode = $('#btnCompareMode');
    if (btnCompareMode) {
      btnCompareMode.addEventListener('click', function () {
        const on = btnCompareMode.getAttribute('aria-pressed') === 'true';
        btnCompareMode.setAttribute('aria-pressed', on ? 'false' : 'true');
        btnCompareMode.classList.toggle('btn-primary', !on);
        btnCompareMode.classList.toggle('btn-ghost', on);
        toast(on ? '已退出对比模式' : '对比模式：勾选 2–3 条运行记录', 'info');
      });
    }
    const btnDoCompare = $('#btnDoCompare');
    if (btnDoCompare) btnDoCompare.addEventListener('click', renderCompare);
    const btnClear = $('#btnClearCompare');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        state.compareSel.clear();
        renderRuns();
        const panel = $('#comparePanel');
        if (panel) panel.hidden = true;
      });
    }
    const btnCloseCompare = $('#btnCloseCompare');
    if (btnCloseCompare) {
      btnCloseCompare.addEventListener('click', function () {
        const panel = $('#comparePanel');
        if (panel) panel.hidden = true;
      });
    }

    // 策略库过滤 / 操作
    $$('.segmented [data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.segmented [data-filter]').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        state.libraryFilter = btn.getAttribute('data-filter');
        renderLibrary();
      });
    });
    const libGrid = $('#libraryGrid');
    if (libGrid) {
      libGrid.addEventListener('click', function (e) {
        const loadBtn = e.target.closest('[data-load]');
        const runBtn = e.target.closest('[data-run]');
        const card = e.target.closest('[data-strategy]');
        if (loadBtn) {
          switchView('builder');
          toast('策略「' + libraryTitle(loadBtn.getAttribute('data-load')) + '」参数已载入构建器', 'success');
        } else if (runBtn) {
          launchRun();
          toast('已使用「' + libraryTitle(runBtn.getAttribute('data-run')) + '」参数启动模拟运行', 'success');
        } else if (card && card.getAttribute('data-strategy') === 'blank') {
          switchView('builder');
          toast('已新建空白策略，请配置参数', 'info');
        }
      });
    }
    const btnNew = $('#btnNewStrategy');
    if (btnNew) {
      btnNew.addEventListener('click', function () {
        switchView('builder');
        toast('已打开构建器 · 从市场范围开始配置', 'info');
      });
    }

    // resize
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resizeChart(); drawChart(); }, 120);
    });
  }

  function libraryTitle(id) {
    const s = LIBRARY.find(function (x) { return x.id === id; });
    return s ? s.title : id;
  }

  function syncSpeedUI() {
    $$('.segmented [data-speed]').forEach(function (b) {
      b.classList.toggle('is-active', parseInt(b.getAttribute('data-speed'), 10) === state.speed);
    });
    const sel = $('#speed');
    if (sel) sel.value = String(state.speed);
  }

  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text;
  }

  /* ----------------------------------------------------------
     16. 启动
     ---------------------------------------------------------- */
  function boot() {
    initMarkets();
    initPositions();
    initTrades();
    initSignals();
    initEquityHistory();
    updateBuilder();
    renderMarkets();
    renderSignals();
    renderTrades();
    renderPositions();
    renderRuns();
    renderLibrary();
    updateMetrics();
    setStatusUI();
    syncSpeedUI();
    initChart();
    bindEvents();

    tickTimer = setInterval(tick, 900);
    const label = $('#chartRangeLabel');
    if (label) label.textContent = '全部区间 · ' + Math.round(state.elapsed / 60) + ' 分钟';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
