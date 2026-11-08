/**
 * server/engine/run.js — one paper-trading run (live or replay).
 *
 * Lifecycle: created → starting → running → (paused) → stopping → stopped;
 * natural completion is `ended`, unexpected failure `error`.
 *
 * Per tick (docs/03 §8):
 *   refresh snapshots → mark-to-market → risk limits → settlement →
 *   per market: (hash-deduped) signal → exits (settlement > SL > TP >
 *   maxHold > opposite) → entry (risk pre-checks → book-walk FAK fill →
 *   ledger) → equity sample → metrics → SSE + JSONL persistence.
 *
 * Every signal, trade (incl. rejected entries), equity point and status
 * change is persisted and broadcast. Kill switch stops the run WITHOUT
 * force-liquidating (MVP per docs/03 §6 / docs/04 §6.6).
 */
import { Portfolio } from "./portfolio.js";
import { computeMetrics } from "./metrics.js";
import { createSignalState } from "./signal.js";
import { nowMs, roundTo } from "../util.js";
import {
  computeBudget,
  evaluateExits,
  executeExit,
  feeRate,
  handleSettlements,
  makeTrade,
  preRiskChecks,
  processMarkets,
  recordExitRejection,
  recordRejectedEntry,
  recordTrade,
  settleMarket,
  tryEntry,
} from "./runTrading.js";

const TERMINAL_STATUSES = new Set(["stopped", "ended", "error"]);
const EQUITY_POINT_CAP = 20_000;

function utcDay(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export class Run {
  /**
   * @param {{id:string, record:any, config:any, source:any, sse:any, store:any,
   *   log?: (level:string,msg:string)=>void}} cfg
   */
  constructor(cfg) {
    this.id = cfg.id;
    this.config = cfg.config;
    this.mode = cfg.config.sim.mode;
    this.strategyId = cfg.record.strategyId ?? null;
    this.strategyName = cfg.record.strategyName ?? cfg.config.name;
    this.createdAt = cfg.record.createdAt ?? nowMs();
    this.sse = cfg.sse;
    this.store = cfg.store;
    this.log = cfg.log ?? (() => {});
    this.source = cfg.source || null;

    this.initialCapital = cfg.config.risk.bankrollUsd;
    this.portfolio = new Portfolio({ initialCapital: this.initialCapital });
    this.signalStates = new Map();
    /** @type {Map<string, any>} */
    this.markets = new Map();
    /** @type {string[]} */
    this.marketIds = [];
    /** @type {any[]} */
    this.signals = [];
    /** @type {any[]} */
    this.trades = [];
    /** @type {any[]} */
    this.equityPoints = [];
    /** @type {any|null} */
    this.metrics = null;

    this.status = "created";
    this.startedAt = null;
    this.endedAt = null;
    this.stopReason = null;
    this.note = "";
    this.ticks = 0;
    this.filledTradeCount = 0;
    this.killSwitchTripped = false;

    this.peakEquity = this.initialCapital;
    this.dayStartEquity = this.initialCapital;
    this.dayKey = utcDay(nowMs());

    this._timer = null;
    this._ticking = false;
    this._tickErrors = 0;
    this._lastBookHash = new Map();
    this._settledMarkets = new Set();
    this._resolutionChecks = new Map();
    this._rejectedExitKeys = new Set();
    this._lastPersistAt = 0;
    this._spreadCost = 0;
    this._depthSlippageCost = 0;
    /** 周期性兜底建仓（execution.fallbackBuyEachWindow）的下次检查时间 */
    this._fallbackNextAt = null;
    /** @type {((marketId:string)=>Promise<any>)|null} */
    this.resolutionProvider = cfg.resolutionProvider ?? null;
  }

  /* ------------------------------- wiring -------------------------------- */

  setSource(source) {
    this.source = source;
  }

  setMarkets(markets) {
    this.markets = new Map(markets.filter(Boolean).map((market) => [market.id, market]));
    this.marketIds = [...this.markets.keys()];
    for (const marketId of this.marketIds) {
      if (!this.signalStates.has(marketId)) this.signalStates.set(marketId, createSignalState());
    }
  }

  /* ------------------------------- lifecycle ----------------------------- */

  /** Start a live run (replay runs use startReplay). */
  async start() {
    if (this.status !== "created") return;
    this._begin();
    await this.store.upsertRunRecord(this.record());
    this.broadcastRun();
    if (this.mode === "live") {
      this._setStatus("running");
      this.broadcastRun();
      this.broadcastMarkets();
      this._scheduleLive();
    }
  }

  /** Start a replay run: load history then pump the timeline. */
  async startReplay() {
    if (this.status !== "created") return;
    this._begin();
    await this.store.upsertRunRecord(this.record());
    this.broadcastRun();
    if (!this.source || typeof this.source.start !== "function") {
      this.fail(new Error("replay source missing"));
      return;
    }
    this.source
      .start({
        onReady: () => {
          this._setStatus("running");
          this.marketIds = this.source.marketIds || this.marketIds;
          this.broadcastRun();
          this.broadcastMarkets();
          this.log("info", `replay run ${this.id} started (${this.marketIds.length} markets)`);
        },
        onPoint: async (ts) => {
          await this.tick(ts);
        },
        onDone: () => this.finish("ended", "replay_done"),
        onError: (err) => this.fail(err),
      })
      .catch((err) => this.fail(err));
  }

  _begin() {
    this.startedAt = nowMs();
    this.dayKey = utcDay(this.startedAt);
    this.dayStartEquity = this.portfolio.equity();
    this._setStatus("starting");
  }

  pause() {
    if (this.status !== "running") return false;
    this._clearTimer();
    if (this.mode === "replay" && this.source?.pause) this.source.pause();
    this._setStatus("paused");
    this.broadcastRun();
    return true;
  }

  resume() {
    if (this.status !== "paused") return false;
    this._setStatus("running");
    this.broadcastRun();
    if (this.mode === "replay") {
      if (this.source?.resume) this.source.resume();
    } else {
      this._scheduleLive();
    }
    return true;
  }

  async stop(reason = "manual") {
    if (TERMINAL_STATUSES.has(this.status)) return this.view();
    if (this.status === "created") {
      await this.store.upsertRunRecord(this.record());
      this.finish("stopped", reason);
      return this.view();
    }
    this.stopReason = reason;
    this._setStatus("stopping");
    this.broadcastRun();
    return this.finish("stopped", reason);
  }

  /** Terminal transition; persists the final snapshot. */
  async finish(status, reason = null) {
    if (TERMINAL_STATUSES.has(this.status) && status !== this.status) return this.view();
    this._clearTimer();
    this.stopReason = reason ?? this.stopReason;
    if (this.mode === "replay" && this.source?.stop) this.source.stop();
    try {
      if (this.equityPoints.length === 0 && this.startedAt) this._sampleEquity(nowMs(), { broadcast: false });
    } catch {
      /* metrics sampling must never block shutdown */
    }
    this.endedAt = nowMs();
    this.status = status;
    await this.store.upsertRunRecord(this.record());
    await this.store.saveNow();
    this.store.appendRecord(this.id, "run", this.record());
    this.broadcastRun();
    if (status === "error") this.sse.log("error", `run ${this.id} failed: ${this.note}`, this.id);
    return this.view();
  }

  fail(err) {
    this.note = err?.message || String(err);
    this.log("error", `run ${this.id} error: ${this.note}`);
    this.sse.log("error", `运行异常: ${this.note}`, this.id);
    return this.finish("error", "error");
  }

  /* -------------------------------- ticking ------------------------------ */

  _scheduleLive() {
    this._clearTimer();
    const interval = Math.min(60_000, Math.max(250, this.config.sim.tickIntervalMs || 1000));
    const loop = async () => {
      if (this.status !== "running") return;
      try {
        await this.tick(nowMs());
        this._tickErrors = 0;
      } catch (err) {
        this._tickErrors += 1;
        this.log("warn", `run ${this.id} tick error: ${err.message}`);
        this.sse.log("warn", `tick 异常: ${err.message}`, this.id);
        if (this._tickErrors >= 20) {
          this.note = `repeated tick failures: ${err.message}`;
          this.fail(err);
          return;
        }
      }
      if (this.status === "running") {
        this._timer = setTimeout(loop, interval);
        if (typeof this._timer.unref === "function") this._timer.unref();
      }
    };
    this._timer = setTimeout(loop, 10);
    if (typeof this._timer.unref === "function") this._timer.unref();
  }

  _clearTimer() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  /**
   * One engine tick.
   * @param {number} now epoch ms (wall clock in live mode, historical ts in replay)
   */
  async tick(now) {
    if (this.status !== "running" || this._ticking) return;
    this._ticking = true;
    try {
      this.ticks += 1;
      this._rollDaily(now);
      const snapshots = this.source?.getMarkets ? this.source.getMarkets() : [];
      this._syncMarkets(snapshots);
      this._refreshMarks();
      await this._handleSettlements(now);
      await this._processMarkets(now);
      this._refreshMarks();
      const equity = this.portfolio.equity();
      this.peakEquity = Math.max(this.peakEquity, equity);
      this._sampleEquity(now);
      const killed = this._checkRiskLimits(now);
      if (killed) return;
      this._maybePersist(now);
      this._checkAutoEnd(now);
    } finally {
      this._ticking = false;
    }
  }

  _syncMarkets(snapshots) {
    if (!Array.isArray(snapshots) || snapshots.length === 0) return;
    for (const snapshot of snapshots) {
      if (!snapshot?.id) continue;
      this.markets.set(snapshot.id, snapshot);
      if (!this.marketIds.includes(snapshot.id)) this.marketIds.push(snapshot.id);
      if (!this.signalStates.has(snapshot.id)) this.signalStates.set(snapshot.id, createSignalState());
    }
  }

  _refreshMarks() {
    const midByToken = new Map();
    for (const market of this.markets.values()) {
      const yes = market.quotes?.YES;
      const no = market.quotes?.NO;
      if (yes && yes.mid > 0) midByToken.set(market.tokens.yesTokenId, yes.mid);
      if (no && no.mid > 0) midByToken.set(market.tokens.noTokenId, no.mid);
      // one-sided fallback per docs/03 §5.2 (mark only)
      if (yes && !(yes.mid > 0) && no && no.mid > 0) midByToken.set(market.tokens.yesTokenId, 1 - no.mid);
      if (no && !(no.mid > 0) && yes && yes.mid > 0) midByToken.set(market.tokens.noTokenId, 1 - yes.mid);
    }
    this.portfolio.markToMarket(midByToken);
  }

  /* ------------------------------ trade engine --------------------------- */

  async _handleSettlements(now) {
    return handleSettlements(this, now);
  }

  _settleMarket(market, payoutPerShare, now) {
    return settleMarket(this, market, payoutPerShare, now);
  }

  async _processMarkets(now) {
    return processMarkets(this, now);
  }

  async _evaluateExits(market, now, signal) {
    return evaluateExits(this, market, now, signal);
  }

  async _executeExit(position, market, reason, now) {
    return executeExit(this, position, market, reason, now);
  }

  _recordExitRejection(position, market, reason, rejectReason, now) {
    return recordExitRejection(this, position, market, reason, rejectReason, now);
  }

  _feeRate(market) {
    return feeRate(this, market);
  }

  _preRiskChecks(market, signal, now) {
    return preRiskChecks(this, market, signal, now);
  }

  _computeBudget(market) {
    return computeBudget(this, market);
  }

  async _tryEntry(signal, market, now) {
    return tryEntry(this, signal, market, now);
  }

  _makeTrade(fields) {
    return makeTrade(this, fields);
  }

  _recordTrade(trade, position) {
    return recordTrade(this, trade, position);
  }

  _recordRejectedEntry(signal, market, rejectReason, now) {
    return recordRejectedEntry(this, signal, market, rejectReason, now);
  }


  /* -------------------------------- equity -------------------------------- */

  _rollDaily(now) {
    const day = utcDay(now);
    if (day !== this.dayKey) {
      this.dayKey = day;
      this.dayStartEquity = this.portfolio.equity();
    }
  }

  sampleEquity(now) {
    return this._sampleEquity(now);
  }

  _sampleEquity(now, opts = {}) {
    const equity = this.portfolio.equity();
    const positionsValue = this.portfolio.positionsValue();
    this.peakEquity = Math.max(this.peakEquity, equity);
    const drawdownPct =
      this.peakEquity > 0 ? ((this.peakEquity - equity) / this.peakEquity) * 100 : 0;
    const point = {
      ts: now,
      equity: roundTo(equity, 5),
      cash: roundTo(this.portfolio.cash, 5),
      positionsValue: roundTo(positionsValue, 5),
      realizedPnl: roundTo(this.portfolio.realizedPnl, 5),
      unrealizedPnl: roundTo(this.portfolio.unrealizedPnl(), 5),
      drawdownPct: roundTo(drawdownPct, 4),
    };
    this.equityPoints.push(point);
    if (this.equityPoints.length > EQUITY_POINT_CAP) {
      this.equityPoints.splice(0, this.equityPoints.length - EQUITY_POINT_CAP);
    }
    const metrics = this._computeMetrics();
    this.metrics = metrics;
    this.store.appendRecord(this.id, "equity", point);
    this.sse.broadcast("equity", { point, metrics }, this.id);
    this.sse.broadcast("metrics", { metrics }, this.id);
    if (opts.broadcast !== false) {
      this.sse.broadcast(
        "positions",
        { positions: this.portfolio.snapshots(), positionsValue: this.portfolio.positionsValue() },
        this.id,
      );
    }
    return point;
  }

  _computeMetrics() {
    return computeMetrics({
      initialCapital: this.initialCapital,
      equityPoints: this.equityPoints,
      closedRoundPnls: this.portfolio.closedRoundPnls,
      realizedPnl: this.portfolio.realizedPnl,
      unrealizedPnl: this.portfolio.unrealizedPnl(),
      feesPaid: this.portfolio.feesPaid,
      trades: this.filledTradeCount,
      turnoverUsd: this.portfolio.turnoverUsd,
      exposureUsd: this.portfolio.positionsValue(),
      tickIntervalMs: this.config.sim.tickIntervalMs,
    });
  }

  currentMetrics() {
    return this.metrics ?? this._computeMetrics();
  }

  costBreakdown() {
    const feesPaid = this.portfolio.feesPaid;
    const spreadCost = this._spreadCost;
    const depthSlippageCost = this._depthSlippageCost;
    return {
      feesPaid: roundTo(feesPaid, 5),
      spreadCost: roundTo(spreadCost, 5),
      depthSlippageCost: roundTo(depthSlippageCost, 5),
      totalFriction: roundTo(feesPaid + spreadCost + depthSlippageCost, 5),
    };
  }

  /* --------------------------------- risk --------------------------------- */

  _checkRiskLimits(now) {
    if (this.killSwitchTripped) return true;
    if (!this.config.risk.killSwitch) return false;
    const equity = this.portfolio.equity();
    const drawdownPct = this.peakEquity > 0 ? ((this.peakEquity - equity) / this.peakEquity) * 100 : 0;
    const drawdownBreached = drawdownPct >= this.config.risk.maxDrawdownPct;
    const dailyBreached =
      this.config.risk.dailyLossLimitUsd > 0 &&
      equity - this.dayStartEquity <= -this.config.risk.dailyLossLimitUsd;
    if (!drawdownBreached && !dailyBreached) return false;
    this.killSwitchTripped = true;
    const why = drawdownBreached
      ? `回撤熔断 ${drawdownPct.toFixed(2)}% ≥ ${this.config.risk.maxDrawdownPct}%`
      : `单日亏损熔断 ${(equity - this.dayStartEquity).toFixed(2)} USDC`;
    this.note = why;
    this.log("warn", `run ${this.id} kill switch: ${why}`);
    this.sse.log("warn", `风控熔断：${why}（不强制平仓，已停止开仓）`, this.id);
    void now;
    this.finish("stopped", "risk_kill_switch").catch(() => {});
    return true;
  }

  _checkAutoEnd(now) {
    if (this.mode !== "live") return;
    if (this.markets.size === 0) return;
    if (this.portfolio.positions.size > 0) return;
    const allOver = [...this.markets.values()].every((market) => {
      const endMs = Date.parse(market.endDate);
      return market.closed || (Number.isFinite(endMs) && endMs + 6 * 3600_000 < now);
    });
    if (allOver) {
      this.finish("ended", "all_markets_closed").catch(() => {});
    }
  }

  /* ------------------------------ persistence ---------------------------- */

  _maybePersist(now) {
    if (now - this._lastPersistAt < 3000) return;
    this._lastPersistAt = now;
    this.store.upsertRunRecord(this.record()).catch(() => {});
  }

  _setStatus(status) {
    this.status = status;
  }

  record() {
    const summary = this.view();
    return {
      id: this.id,
      strategyId: this.strategyId,
      strategyName: this.strategyName,
      mode: this.mode,
      status: summary.status,
      createdAt: this.createdAt,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      initialCapital: this.initialCapital,
      equity: summary.equity,
      cash: summary.cash,
      positionsValue: summary.positionsValue,
      metrics: summary.metrics,
      signalsCount: this.signals.length,
      marketsTracked: this.markets.size,
      marketIds: [...this.marketIds],
      feedStatus: summary.feedStatus,
      stopReason: this.stopReason,
      note: this.note,
      config: this.config,
    };
  }

  view() {
    const equity = this.portfolio.equity();
    const metrics = this.metrics ?? this._computeMetrics();
    return {
      id: this.id,
      strategyId: this.strategyId,
      strategyName: this.strategyName,
      mode: this.mode,
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      initialCapital: this.initialCapital,
      equity: roundTo(equity, 5),
      cash: roundTo(this.portfolio.cash, 5),
      positionsValue: roundTo(this.portfolio.positionsValue(), 5),
      metrics,
      signalsCount: this.signals.length,
      marketsTracked: this.markets.size,
      marketIds: [...this.marketIds],
      feedStatus: this.source?.status ? this.source.status().status : "connecting",
      createdAt: this.createdAt,
      stopReason: this.stopReason,
      note: this.note,
      ticks: this.ticks,
      costBreakdown: this.costBreakdown(),
    };
  }

  broadcastRun() {
    this.sse.broadcast("run", { run: this.view() }, this.id);
  }

  /** Emit the run's market universe as one `markets` SSE batch (dashboard grid). */
  broadcastMarkets() {
    try {
      const markets = this.source?.getMarkets ? this.source.getMarkets() : [...this.markets.values()];
      if (Array.isArray(markets) && markets.length > 0) {
        this.sse.broadcast("markets", { markets }, this.id);
      }
    } catch (err) {
      this.log("warn", `markets broadcast failed: ${err.message}`);
    }
  }

  /** Position list for the API. */
  positions() {
    return this.portfolio.snapshots();
  }

  /** Signal/trade/equity slices for the API (memory). */
  getSignals({ limit = 500, offset = 0 } = {}) {
    return { items: this.signals.slice(offset, offset + limit), total: this.signals.length };
  }

  getTrades({ limit = 500, offset = 0 } = {}) {
    return { items: this.trades.slice(offset, offset + limit), total: this.trades.length };
  }

  getEquity({ limit = 500, offset = 0 } = {}) {
    return { items: this.equityPoints.slice(offset, offset + limit), total: this.equityPoints.length };
  }
}

export default Run;
