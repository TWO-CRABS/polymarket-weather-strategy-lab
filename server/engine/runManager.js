/**
 * server/engine/runManager.js — orchestration for all runs.
 *
 * Responsibilities:
 *   - resolve/validate a run's StrategyConfig (single source of truth:
 *     shared/contract.js validateStrategy)
 *   - select the market universe for a run (city / price band / liquidity /
 *     spread / time-to-resolution, top N by liquidity)
 *   - wire the data source (live feed vs replay), feed tracking and run lifecycle
 *   - expose run views / journal slices to the REST layer
 *   - idempotent stop, delete, boot recovery (store keeps terminal records)
 */
import { RUN_MODES, STRATEGY_VERSION, deepMerge, clone, roundTo, validateStrategy, normalizeStrategy } from "../../shared/contract.js";
import { AppError, nowMs, newId } from "../util.js";
import { Run } from "./run.js";
import { ReplaySource, loadFixtureMarkets } from "../data/replay.js";
import { compareMarketsForSelection } from "../data/gamma.js";
import { createSettler, marketsFromTrades, rehydratePortfolio, settlePendingPositions } from "./settlementRecovery.js";

const RUNS_LIST_LIMIT = 50;

export class RunManager {
  /**
   * @param {{store:any, sse:any, discovery:any, feed:any, clob:any, config:any,
   *   log?: (level:string,msg:string)=>void}} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.sse = deps.sse;
    this.discovery = deps.discovery;
    this.feed = deps.feed;
    this.clob = deps.clob;
    this.config = deps.config;
    this.log = deps.log ?? (() => {});
    /** @type {Map<string, Run>} */
    this.active = new Map();
    /** @type {Map<string, any>} 已停止/重启后仍需等待官方裁决的 run settler */
    this._settlers = new Map();
    this._settlementTimer = null;
    this.discovery.onRefresh((payload) => this._onDiscoveryRefresh(payload));
  }

  get activeCount() {
    return this.active.size;
  }

  /* ------------------------------ strategies ----------------------------- */

  listStrategies() {
    return this.store.listStrategies();
  }

  getStrategy(id) {
    return this.store.getStrategy(id);
  }

  createStrategy(configInput, meta = {}) {
    const check = validateStrategy(configInput ?? {});
    if (!check.valid) {
      throw new AppError(400, "INVALID_STRATEGY", `策略校验失败：${check.errors.join("；")}`, {
        details: check.errors,
      });
    }
    const now = nowMs();
    const entry = {
      id: newId("strat"),
      name: meta.name ?? check.normalized.name,
      description: meta.description ?? check.normalized.description,
      updatedAt: now,
      createdAt: now,
      config: check.normalized,
    };
    this.store.upsertStrategy(entry).catch((err) => this.log("warn", `save strategy failed: ${err.message}`));
    return entry;
  }

  updateStrategy(id, configInput) {
    const existing = this.store.getStrategy(id);
    if (!existing) throw new AppError(404, "STRATEGY_NOT_FOUND", `策略不存在: ${id}`);
    const check = validateStrategy(configInput ?? {});
    if (!check.valid) {
      throw new AppError(400, "INVALID_STRATEGY", `策略校验失败：${check.errors.join("；")}`, {
        details: check.errors,
      });
    }
    const entry = {
      ...existing,
      name: check.normalized.name || existing.name,
      description: check.normalized.description ?? existing.description,
      updatedAt: nowMs(),
      config: check.normalized,
    };
    this.store.upsertStrategy(entry).catch((err) => this.log("warn", `save strategy failed: ${err.message}`));
    return entry;
  }

  async deleteStrategy(id) {
    const existing = this.store.getStrategy(id);
    if (!existing) throw new AppError(404, "STRATEGY_NOT_FOUND", `策略不存在: ${id}`);
    await this.store.deleteStrategy(id);
    return true;
  }

  /* -------------------------------- universe ----------------------------- */

  _cityMatches(market, cities) {
    if (!cities.length) return true;
    const city = String(market.city || "").toLowerCase();
    const title = String(market.eventTitle || "").toLowerCase();
    return cities.some((needle) => {
      const c = String(needle).toLowerCase();
      return city === c || city.includes(c) || c.includes(city) || title.includes(c);
    });
  }

  /**
   * Select markets for a run (docs/03 §1.2).
   * @param {any} config validated StrategyConfig
   * @param {"live"|"replay"} mode
   * @returns {any[]}
   */
  selectMarkets(config, mode) {
    const u = config.universe;
    // Deterministic fixture replay: the fixture file IS the universe.
    if (mode === "replay" && this.config.replayFixture) {
      try {
        const fixtureMarkets = loadFixtureMarkets(this.config.replayFixture);
        if (fixtureMarkets.length > 0) {
          return fixtureMarkets.slice(0, Math.max(1, u.maxMarkets)).map((market) => clone(market));
        }
      } catch (err) {
        throw new AppError(400, "INVALID_BODY", `REPLAY_FIXTURE 读取失败: ${err.message}`);
      }
    }
    const now = nowMs();
    const cities = (u.cities || []).map((c) => String(c));
    const base = this.discovery.getCandidateMarkets().filter((market) => {
      if (!market || market.closed) return false;
      if (!market.tokens?.yesTokenId || !market.tokens?.noTokenId) return false;
      if (u.onlyAcceptingOrders && !market.acceptingOrders) return false;
      if (!this._cityMatches(market, cities)) return false;
      const mid = market.impliedProbability;
      if (!(mid >= u.minPrice && mid <= u.maxPrice)) return false;
      if (market.liquidityUsd < u.minLiquidityUsd) return false;
      if (market.spread > u.maxSpread) return false;
      return true;
    });
    const timeFiltered = base.filter((market) => {
      const endMs = Date.parse(market.endDate);
      if (!Number.isFinite(endMs)) return false;
      const ttrSec = (endMs - now) / 1000;
      return ttrSec >= u.minTimeToResolutionSec && ttrSec <= u.maxTimeToResolutionSec;
    });
    let candidates = timeFiltered;
    if (candidates.length === 0 && mode === "replay") {
      // Replay can use markets that recently closed/expired: historical prices
      // still exist, so the demo/repro path stays available overnight.
      candidates = base.filter((market) => {
        const endMs = Date.parse(market.endDate);
        return Number.isFinite(endMs) ? endMs > now - 3 * 86400_000 : false;
      });
    }
    candidates.sort(compareMarketsForSelection);
    return candidates.slice(0, Math.max(1, u.maxMarkets)).map((market) => clone(market));
  }

  /* -------------------------------- create ------------------------------- */

  /**
   * Create + start a run.
   * @param {{strategy?:any, strategyId?:string, mode?:string, replay?:{lookbackMin?:number,speed?:number}}} body
   * @returns {Promise<any>} RunSummary view
   */
  async createRun(body = {}) {
    // resolve strategy config
    let baseConfig = {};
    let strategyId = null;
    let strategyName = null;
    if (body.strategy && typeof body.strategy === "object") {
      baseConfig = clone(body.strategy);
      strategyName = baseConfig.name ?? null;
      if (body.strategyId) strategyId = String(body.strategyId);
    } else if (body.strategyId) {
      const saved = this.store.getStrategy(String(body.strategyId));
      if (!saved) throw new AppError(404, "STRATEGY_NOT_FOUND", `策略不存在: ${body.strategyId}`);
      baseConfig = clone(saved.config);
      strategyId = saved.id;
      strategyName = saved.name;
    }
    if (!baseConfig.version) baseConfig.version = STRATEGY_VERSION;
    baseConfig = normalizeStrategy(baseConfig);

    const requestedMode = body.mode ?? baseConfig.sim?.mode ?? "live";
    if (!RUN_MODES.includes(requestedMode)) {
      throw new AppError(400, "INVALID_MODE", `mode 必须是 live 或 replay，收到: ${requestedMode}`);
    }
    baseConfig.sim = { ...baseConfig.sim, mode: requestedMode };
    const replay = body.replay && typeof body.replay === "object" ? body.replay : {};
    if (requestedMode === "replay") {
      if (Number.isFinite(Number(replay.lookbackMin)) && Number(replay.lookbackMin) > 0) {
        baseConfig.sim.replayLookbackMin = Number(replay.lookbackMin);
      }
      if (Number.isFinite(Number(replay.speed)) && Number(replay.speed) > 0) {
        baseConfig.sim.speed = Number(replay.speed);
      }
    }

    const check = validateStrategy(baseConfig);
    if (!check.valid) {
      throw new AppError(400, "INVALID_STRATEGY", `策略校验失败：${check.errors.join("；")}`, {
        details: check.errors,
      });
    }
    const config = check.normalized;
    config.sim.mode = requestedMode;
    strategyName = strategyName ?? config.name;

    const markets = this.selectMarkets(config, requestedMode);
    if (markets.length === 0) {
      throw new AppError(
        409,
        "NO_MARKETS",
        "当前没有满足条件的温度市场（可能已临近结算或已收盘）；请放宽筛选条件或改用 replay 回放模式",
      );
    }

    const id = newId("run");
    const record = {
      id,
      strategyId,
      strategyName,
      mode: requestedMode,
      status: "created",
      createdAt: nowMs(),
      startedAt: null,
      endedAt: null,
      initialCapital: config.risk.bankrollUsd,
      equity: config.risk.bankrollUsd,
      cash: config.risk.bankrollUsd,
      positionsValue: 0,
      metrics: null,
      signalsCount: 0,
      marketsTracked: markets.length,
      feedStatus: requestedMode === "live" ? "connecting" : "live",
      stopReason: null,
      note: "",
      config,
    };

    const run = new Run({
      id,
      record,
      config,
      sse: this.sse,
      store: this.store,
      log: this.log,
    });

    if (requestedMode === "live") {
      const source = this._createLiveSource(run);
      run.setSource(source);
      run.setMarkets(markets);
      run.resolutionProvider = (marketId) => this.discovery.getResolution(marketId);
    } else {
      const source = new ReplaySource({
        clob: this.clob,
        markets,
        lookbackMin: config.sim.replayLookbackMin,
        speed: config.sim.speed,
        tickIntervalMs: config.sim.tickIntervalMs,
        fixturePath: this.config.replayFixture || null,
        log: this.log,
      });
      run.setSource(source);
      run.setMarkets(markets);
    }

    this.active.set(id, run);
    await this.store.upsertRunRecord(record);
    this.applyFeedTracking();

    if (requestedMode === "live") {
      await run.start().catch((err) => run.fail(err));
    } else {
      run.startReplay().catch((err) => run.fail(err));
    }
    return run.view();
  }

  _createLiveSource(run) {
    const feed = this.feed;
    const discovery = this.discovery;
    return {
      mode: "live",
      status: () => feed.status(),
      getMarkets: () =>
        run.marketIds
          .map((id) => feed.getSnapshot(id) || discovery.getMarket(id) || run.markets.get(id))
          .filter(Boolean),
      getBook: (tokenId) => feed.getBook(tokenId),
      getHistory: (tokenId, seconds) => feed.getHistory(tokenId, seconds),
      getLatest: (tokenId) => feed.getLatest(tokenId),
    };
  }

  /* -------------------------------- queries ------------------------------ */

  listRuns() {
    const byId = new Map();
    for (const record of this.store.listRunRecords()) byId.set(record.id, record);
    for (const [id, run] of this.active) byId.set(id, run.record());
    return [...byId.values()]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, RUNS_LIST_LIMIT)
      .map((record) => this._viewFromRecord(record));
  }

  _viewFromRecord(record) {
    if (!record) return null;
    return {
      id: record.id,
      strategyId: record.strategyId ?? null,
      strategyName: record.strategyName ?? "",
      mode: record.mode,
      status: record.status,
      startedAt: record.startedAt ?? null,
      endedAt: record.endedAt ?? null,
      initialCapital: record.initialCapital,
      equity: record.equity,
      cash: record.cash,
      positionsValue: record.positionsValue ?? 0,
      metrics: record.metrics ?? null,
      signalsCount: record.signalsCount ?? 0,
      marketsTracked: record.marketsTracked ?? 0,
      marketIds: Array.isArray(record.marketIds) ? record.marketIds : [],
      pendingSettlements: Number(record.pendingSettlements) || 0,
      settledPositions: Number(record.settledPositions) || 0,
      settlementRecovered: Boolean(record.settlementRecovered),
      feedStatus: record.feedStatus ?? "offline",
      createdAt: record.createdAt,
      stopReason: record.stopReason ?? null,
      note: record.note ?? "",
    };
  }

  getActiveRun(id) {
    return this.active.get(id) || null;
  }

  async getRunDetail(id) {
    const run = this.active.get(id);
    if (run) {
      return {
        run: run.view(),
        config: run.config,
        metrics: run.currentMetrics(),
        positions: run.positions(),
        costBreakdown: run.costBreakdown(),
      };
    }
    const record = this.store.getRunRecord(id);
    if (!record) throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    const metrics = record.metrics ?? (await this._metricsFromJournal(id, record));
    const positions = await this._positionsFromJournal(id, record);
    return {
      run: this._viewFromRecord(record),
      config: record.config ?? {},
      metrics,
      positions,
      costBreakdown: { feesPaid: metrics.feesPaid ?? 0, spreadCost: 0, depthSlippageCost: 0, totalFriction: metrics.feesPaid ?? 0 },
    };
  }

  /** 停止/重启后的运行：从 journal 重建未平仓持仓（供详情页与待结算展示）。 */
  async _positionsFromJournal(id, record) {
    const trades = await this.store.readRecords(id, { type: "trade", limit: Number.MAX_SAFE_INTEGER });
    if (trades.items.length === 0) return [];
    const portfolio = rehydratePortfolio(record.initialCapital ?? 0, trades.items);
    return portfolio.snapshots();
  }

  async _metricsFromJournal(id, record) {
    const journal = await this.store.readRecords(id, { type: "equity", limit: Number.MAX_SAFE_INTEGER });
    const trades = await this.store.readRecords(id, { type: "trade", limit: Number.MAX_SAFE_INTEGER });
    const { computeMetrics } = await import("./metrics.js");
    const closedRoundPnls = [];
    let realizedPnl = 0;
    let feesPaid = 0;
    let turnoverUsd = 0;
    let tradeCount = 0;
    for (const trade of trades.items) {
      if (trade.status === "rejected") continue;
      feesPaid += trade.fee || 0;
      if (trade.reason === "resolution") {
        realizedPnl += trade.realizedPnl || 0;
        if (trade.realizedPnl) closedRoundPnls.push(trade.realizedPnl);
      } else {
        tradeCount += 1;
        turnoverUsd += Math.abs(trade.notional || 0);
        if (trade.side === "SELL") {
          realizedPnl += trade.realizedPnl || 0;
          // no reliable round grouping after a restart; count sells as rounds
          if (trade.realizedPnl) closedRoundPnls.push(trade.realizedPnl);
        }
      }
    }
    const equityPoints = journal.items.map((p) => ({ ts: p.ts, equity: p.equity }));
    return computeMetrics({
      initialCapital: record.initialCapital ?? 1000,
      equityPoints,
      closedRoundPnls,
      realizedPnl,
      unrealizedPnl: 0,
      feesPaid,
      trades: tradeCount,
      turnoverUsd,
      exposureUsd: 0,
      tickIntervalMs: record.config?.sim?.tickIntervalMs ?? 1000,
    });
  }

  async getTrades(id, opts = {}) {
    const run = this.active.get(id);
    if (run) return run.getTrades(opts);
    if (!this.store.getRunRecord(id)) throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    const result = await this.store.readRecords(id, { type: "trade", limit: opts.limit ?? 500, offset: opts.offset ?? 0 });
    return { items: result.items, total: result.total };
  }

  async getSignals(id, opts = {}) {
    const run = this.active.get(id);
    if (run) return run.getSignals(opts);
    if (!this.store.getRunRecord(id)) throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    const result = await this.store.readRecords(id, { type: "signal", limit: opts.limit ?? 500, offset: opts.offset ?? 0 });
    return { items: result.items, total: result.total };
  }

  async getEquity(id, opts = {}) {
    const run = this.active.get(id);
    if (run) return run.getEquity(opts);
    if (!this.store.getRunRecord(id)) throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    const result = await this.store.readRecords(id, { type: "equity", limit: opts.limit ?? 500, offset: opts.offset ?? 0 });
    return { items: result.items, total: result.total };
  }

  /* -------------------------------- control ------------------------------ */

  /* ----------------------- settlement recovery (post-stop) ---------------- */

  /**
   * 启动时调用：为所有 stopped/ended 但仍有未结算持仓的 live 运行恢复结算轮询。
   * @returns {Promise<number>} 恢复的 run 数量
   */
  async recoverSettlements() {
    let recovered = 0;
    for (const record of this.store.listRunRecords()) {
      if (this.active.has(record.id) || this._settlers.has(record.id)) continue;
      if (record.mode !== "live") continue;
      try {
        const journal = await this.store.readRecords(record.id, { type: "trade", limit: Number.MAX_SAFE_INTEGER });
        const trades = journal.items || [];
        if (trades.length === 0) continue;
        const portfolio = rehydratePortfolio(record.initialCapital ?? 0, trades);
        if (portfolio.positions.size === 0) continue;
        const markets = marketsFromTrades(trades);
        const settledMarketIds = trades
          .filter((trade) => trade.reason === "resolution" && trade.status !== "rejected")
          .map((trade) => trade.marketId);
        this._settlers.set(
          record.id,
          createSettler({
            id: record.id,
            status: record.status,
            markets,
            portfolio,
            store: this.store,
            sse: this.sse,
            log: (level, message) => this.log(level, `[settlement ${record.id}] ${message}`),
            resolutionProvider: (marketId) => this.discovery.getResolution(marketId),
            settledMarketIds,
          }),
        );
        await this._persistSettler(record.id);
        recovered += 1;
        this.log(
          "info",
          `结算恢复：${record.id}（${record.strategyName || "未命名策略"}）仍有 ${portfolio.positions.size} 个持仓等待官方裁决，继续轮询`,
        );
      } catch (err) {
        this.log("warn", `结算恢复失败 ${record.id}: ${err.message}`);
      }
    }
    if (recovered > 0) this._ensureSettlementTimer();
    return recovered;
  }

  /** 手动停止的 live 运行若仍有持仓，继续在后台等待官方结算。 */
  _trackRunSettlement(run) {
    if (!run || run.mode !== "live" || run.portfolio.positions.size === 0) return false;
    if (this._settlers.has(run.id)) return true;
    this._settlers.set(
      run.id,
      createSettler({
        id: run.id,
        status: run.status,
        markets: new Map(run.markets),
        portfolio: run.portfolio,
        store: this.store,
        sse: this.sse,
        log: (level, message) => this.log(level, `[settlement ${run.id}] ${message}`),
        resolutionProvider: (marketId) => this.discovery.getResolution(marketId),
        settledMarketIds: run.trades
          .filter((trade) => trade.reason === "resolution" && trade.status !== "rejected")
          .map((trade) => trade.marketId),
      }),
    );
    this._ensureSettlementTimer();
    this.log("info", `运行 ${run.id} 已停止，但仍有 ${run.portfolio.positions.size} 个持仓；继续等待官方裁决结算`);
    return true;
  }

  _ensureSettlementTimer() {
    if (this._settlementTimer || this._settlers.size === 0) return;
    this._settlementTimer = setInterval(() => {
      this._settlementTick().catch((err) => this.log("warn", `settlement tick failed: ${err.message}`));
    }, 20_000);
    if (typeof this._settlementTimer.unref === "function") this._settlementTimer.unref();
  }

  async _settlementTick() {
    if (this._settlers.size === 0) return;
    const now = nowMs();
    for (const [runId, settler] of [...this._settlers]) {
      try {
        const before = settler.portfolio.positions.size;
        await settlePendingPositions(settler, now);
        const after = settler.portfolio.positions.size;
        if (after < before) {
          await this.store.appendRecord(runId, "equity", {
            ts: now,
            equity: roundTo(settler.portfolio.equity(), 5),
            cash: roundTo(settler.portfolio.cash, 5),
            positionsValue: roundTo(settler.portfolio.positionsValue(), 5),
          });
        }
        await this._persistSettler(runId);
        if (after === 0) {
          this._settlers.delete(runId);
          this.log("info", `结算完成：${runId} 的全部持仓已按官方裁决兑付`);
          this.sse.log("info", `运行 ${runId} 的待结算持仓已全部按官方裁决兑付`, runId);
        }
      } catch (err) {
        this.log("warn", `结算轮询失败 ${runId}: ${err.message}`);
      }
    }
    if (this._settlers.size === 0 && this._settlementTimer) {
      clearInterval(this._settlementTimer);
      this._settlementTimer = null;
    }
  }

  /** 把 settler 的现金/持仓/指标写回 run record（终态运行也会持续更新到结算完毕）。 */
  async _persistSettler(runId) {
    const settler = this._settlers.get(runId);
    const record = this.store.getRunRecord(runId);
    if (!settler || !record) return;
    const journal = await this.store.readRecords(runId, { type: "trade", limit: Number.MAX_SAFE_INTEGER });
    const resolutionTrades = (journal.items || []).filter(
      (trade) => trade.reason === "resolution" && trade.status !== "rejected",
    );
    const metrics = await this._metricsFromJournal(runId, record);
    record.cash = roundTo(settler.portfolio.cash, 5);
    record.positionsValue = roundTo(settler.portfolio.positionsValue(), 5);
    record.equity = roundTo(settler.portfolio.equity(), 5);
    record.metrics = metrics;
    record.pendingSettlements = settler.portfolio.positions.size;
    record.settledPositions = resolutionTrades.length;
    record.settlementRecovered = true;
    if (resolutionTrades.length > 0) {
      record.note = `官方裁决已补记 ${resolutionTrades.length} 笔兑付${
        record.pendingSettlements > 0 ? `，仍有 ${record.pendingSettlements} 个持仓待结算` : ""
      }`;
    }
    await this.store.upsertRunRecord(record);
    await this.store.saveNow();
  }

  async stopRun(id) {
    const run = this.active.get(id);
    if (run) {
      if (run.status === "stopped" || run.status === "ended" || run.status === "error") {
        return run.view();
      }
      const view = await run.stop("manual");
      this.active.delete(id);
      this.applyFeedTracking();
      this._trackRunSettlement(run);
      return view;
    }
    const record = this.store.getRunRecord(id);
    if (!record) throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    return this._viewFromRecord(record); // idempotent
  }

  async deleteRun(id) {
    const run = this.active.get(id);
    if (run) {
      await run.stop("manual");
      this.active.delete(id);
      this._settlers.delete(id);
    } else if (!this.store.getRunRecord(id)) {
      throw new AppError(404, "RUN_NOT_FOUND", `运行不存在: ${id}`);
    }
    await this.store.deleteRunRecord(id);
    this.applyFeedTracking();
    return true;
  }

  /**
   * Batch-delete runs (docs/07 §4.4). Active runs are stopped first, then removed.
   * Unknown ids are reported in `failed` instead of aborting the whole batch.
   * @param {string[]} ids
   * @returns {Promise<{deleted:string[], failed:Array<{id:string, reason:string}>}>}
   */
  async deleteMany(ids = []) {
    const deleted = [];
    const failed = [];
    const seen = new Set();
    for (const rawId of Array.isArray(ids) ? ids : []) {
      const id = String(rawId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      try {
        await this.deleteRun(id);
        deleted.push(id);
      } catch (err) {
        failed.push({ id, reason: err?.code || "UNKNOWN" });
      }
    }
    return { deleted, failed };
  }

  /* --------------------------- feed orchestration ------------------------ */

  _onDiscoveryRefresh(payload) {
    const updated = new Map((payload?.markets ?? []).map((market) => [market.id, market]));
    for (const run of this.active.values()) {
      if (run.mode !== "live") continue;
      for (const marketId of run.marketIds) {
        const fresh = updated.get(marketId);
        if (fresh) run.markets.set(marketId, fresh);
        else {
          const existing = run.markets.get(marketId);
          if (existing) {
            const endMs = Date.parse(existing.endDate);
            if (Number.isFinite(endMs) && endMs <= nowMs()) existing.closed = true;
          }
        }
      }
    }
    this.applyFeedTracking();
  }

  /** Track the union of active live-run markets, else an idle showcase set. */
  applyFeedTracking() {
    const tracked = new Map();
    for (const run of this.active.values()) {
      if (run.mode !== "live") continue;
      for (const marketId of run.marketIds) {
        const market = this.discovery.getMarket(marketId) || run.markets.get(marketId);
        if (market && !market.closed) tracked.set(market.id, market);
      }
    }
    let markets = [...tracked.values()];
    if (markets.length === 0) {
      markets = this.discovery.getMarkets({ limit: this.config.idleFeedMarkets });
    }
    try {
      this.feed.setTracked(markets);
    } catch (err) {
      this.log("warn", `feed tracking failed: ${err.message}`);
    }
  }

  /* ------------------------------- shutdown ------------------------------ */

  async shutdown() {
    const runs = [...this.active.values()];
    this.active.clear();
    await Promise.allSettled(runs.map((run) => run.stop("server_shutdown")));
  }
}

export default RunManager;
