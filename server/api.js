/**
 * server/api.js — REST API (docs/07-api-contract.md).
 *
 * JSON-only handler for `/api/*`; the static file server lives in index.js.
 * Errors use the `{ error: { code, message, details? } }` envelope and the
 * documented status codes. Bodies are size-limited and parsed defensively.
 */
import {
  CONTRACT_VERSION,
  DIRECTIONS,
  FEES,
  LIMITS,
  PRICE_FIELDS,
  STRATEGY_PRESETS,
  validateStrategy,
} from "../shared/contract.js";
import { AppError, UpstreamError, nowMs, roundTo, utcDateKey } from "./util.js";

const MAX_LIMIT = 500;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, status, code, message, details) {
  const payload = { error: { code, message } };
  if (details !== undefined) payload.error.details = details;
  sendJson(res, status, payload);
}

function parseLimit(url, fallback, max = MAX_LIMIT) {
  const raw = Number(url.searchParams.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.floor(raw));
}

function parseOffset(url) {
  const raw = Number(url.searchParams.get("offset"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** Read a JSON body with a hard size limit. */
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new AppError(400, "INVALID_BODY", "请求体超过大小限制"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new AppError(400, "INVALID_BODY", "请求体不是合法 JSON"));
      }
    });
    req.on("error", (err) => reject(new AppError(400, "INVALID_BODY", `读取请求体失败: ${err.message}`)));
  });
}

/**
 * @param {{store:any, sse:any, discovery:any, feed:any, runs:any, config:any,
 *   startedAt:number, log?:Function}} deps
 */
export function createApiHandler(deps) {
  const { store, sse, discovery, feed, runs, config, startedAt, log = () => {} } = deps;

  const metaPayload = () => ({
    contractVersion: CONTRACT_VERSION,
    serverTime: nowMs(),
    cities: discovery.getCities(utcDateKey()),
    universeDate: utcDateKey(),
    presets: STRATEGY_PRESETS,
    feeModel: FEES,
    limits: LIMITS,
    priceFields: PRICE_FIELDS,
    directions: DIRECTIONS,
  });

  /* --------------------------------- routes -------------------------------- */

  async function route(req, res, url) {
    const pathname = decodeURIComponent(url.pathname);
    const method = req.method || "GET";

    /* ---- meta / health ---- */
    if (method === "GET" && pathname === "/api/health") {
      const feedStatus = feed.status();
      sendJson(res, 200, {
        status: "ok",
        now: nowMs(),
        uptimeSec: roundTo((nowMs() - startedAt) / 1000, 1),
        feed: {
          status: feedStatus.status,
          marketsTracked: feedStatus.marketsTracked,
          lastUpdate: feedStatus.lastUpdate,
          latencyMs: feedStatus.latencyMs,
          mode: feedStatus.mode,
          wsBatches: feedStatus.wsBatches,
          wsConnectedBatches: feedStatus.wsConnectedBatches,
        },
        runs: { active: runs.activeCount, total: store.listRunRecords().length },
      });
      return true;
    }

    if (method === "GET" && pathname === "/api/meta") {
      sendJson(res, 200, metaPayload());
      return true;
    }

    /* ---- SSE ---- */
    if (method === "GET" && pathname === "/api/stream") {
      sse.attach(res, { runId: url.searchParams.get("runId") });
      return true;
    }

    /* ---- markets ---- */
    if (method === "GET" && pathname === "/api/markets") {
      const city = url.searchParams.get("city") || "";
      // lead/UI need the full tradeable grid: allow up to 500 rows
      const limit = parseLimit(url, 100, 500);
      const includeClosed = url.searchParams.get("includeClosed") === "true";
      const markets = discovery.getMarkets({ city, limit, includeClosed });
      sendJson(res, 200, {
        markets,
        count: markets.length,
        updatedAt: Math.max(discovery.updatedAt || 0, feed.status().lastUpdate || 0),
      });
      return true;
    }

    const historyMatch = /^\/api\/markets\/([^/]+)\/history$/.exec(pathname);
    if (method === "GET" && historyMatch) {
      sendJson(res, 200, await marketHistory(historyMatch[1], url));
      return true;
    }

    const marketMatch = /^\/api\/markets\/([^/]+)$/.exec(pathname);
    if (method === "GET" && marketMatch) {
      const market = discovery.getMarket(marketMatch[1]) || feed.getSnapshot(marketMatch[1]);
      if (!market) throw new AppError(404, "MARKET_NOT_FOUND", `市场不存在: ${marketMatch[1]}`);
      sendJson(res, 200, { market });
      return true;
    }

    if (method === "GET" && pathname === "/api/events") {
      sendJson(res, 200, { events: discovery.getEvents() });
      return true;
    }

    /* ---- strategies ---- */
    if (pathname === "/api/strategies" && method === "GET") {
      sendJson(res, 200, { strategies: runs.listStrategies() });
      return true;
    }
    if (pathname === "/api/strategies" && method === "POST") {
      const body = await readJsonBody(req, config.maxBodyBytes);
      const strategy = await runs.createStrategy(body, {
        name: body?.name,
        description: body?.description,
      });
      sendJson(res, 201, { strategy });
      return true;
    }
    if (pathname === "/api/strategies/validate" && method === "POST") {
      const body = await readJsonBody(req, config.maxBodyBytes);
      sendJson(res, 200, validateStrategy(body ?? {}));
      return true;
    }
    const strategyMatch = /^\/api\/strategies\/([^/]+)$/.exec(pathname);
    if (strategyMatch && method === "GET") {
      const strategy = runs.getStrategy(strategyMatch[1]);
      if (!strategy) throw new AppError(404, "STRATEGY_NOT_FOUND", `策略不存在: ${strategyMatch[1]}`);
      sendJson(res, 200, { strategy });
      return true;
    }
    if (strategyMatch && method === "PUT") {
      const body = await readJsonBody(req, config.maxBodyBytes);
      const strategy = await runs.updateStrategy(strategyMatch[1], body);
      sendJson(res, 200, { strategy });
      return true;
    }
    if (strategyMatch && method === "DELETE") {
      await runs.deleteStrategy(strategyMatch[1]);
      res.writeHead(204);
      res.end();
      return true;
    }

    /* ---- runs ---- */
    if (pathname === "/api/runs" && method === "POST") {
      const body = await readJsonBody(req, config.maxBodyBytes);
      const run = await runs.createRun(body ?? {});
      sendJson(res, 201, { run });
      return true;
    }
    if (pathname === "/api/runs" && method === "GET") {
      sendJson(res, 200, { runs: runs.listRuns() });
      return true;
    }
    if (pathname === "/api/runs/batch-delete" && method === "POST") {
      const body = await readJsonBody(req, config.maxBodyBytes);
      const ids = Array.isArray(body?.ids) ? body.ids : [];
      if (!ids.length) throw new AppError(400, "INVALID_BODY", "ids 不能为空");
      if (ids.length > 200) throw new AppError(400, "INVALID_BODY", "单次最多删除 200 条运行");
      sendJson(res, 200, await runs.deleteMany(ids));
      return true;
    }

    const runSubMatch = /^\/api\/runs\/([^/]+)\/(trades|equity|signals|positions|markets|stop)$/.exec(pathname);
    if (runSubMatch) {
      const runId = runSubMatch[1];
      const sub = runSubMatch[2];
      if (sub === "stop" && method === "POST") {
        sendJson(res, 200, { run: await runs.stopRun(runId) });
        return true;
      }
      if (sub === "trades" && method === "GET") {
        const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";
        const includePositionEntries = url.searchParams.get("includePositionEntries") === "true";
        const { items, total } = await runs.getTrades(runId, {
          limit: parseLimit(url, 500),
          offset: parseOffset(url),
          order,
          includePositionEntries,
        });
        sendJson(res, 200, { trades: items, total });
        return true;
      }
      if (sub === "signals" && method === "GET") {
        const { items, total } = await runs.getSignals(runId, { limit: parseLimit(url, 500), offset: parseOffset(url) });
        sendJson(res, 200, { signals: items, total });
        return true;
      }
      if (sub === "equity" && method === "GET") {
        const { items, total } = await runs.getEquity(runId, { limit: parseLimit(url, 500), offset: parseOffset(url) });
        sendJson(res, 200, { points: items, total });
        return true;
      }
      if (sub === "markets" && method === "GET") {
        const markets = await runs.getRunMarkets(runId);
        sendJson(res, 200, { markets });
        return true;
      }
      if (sub === "positions" && method === "GET") {
        const detail = await runs.getRunDetail(runId);
        sendJson(res, 200, {
          positions: detail.positions,
          positionsValue: detail.run.positionsValue,
          cash: detail.run.cash,
          equity: detail.run.equity,
        });
        return true;
      }
    }

    const runMatch = /^\/api\/runs\/([^/]+)$/.exec(pathname);
    if (runMatch && method === "GET") {
      sendJson(res, 200, await runs.getRunDetail(runMatch[1]));
      return true;
    }
    if (runMatch && method === "DELETE") {
      await runs.deleteRun(runMatch[1]);
      res.writeHead(204);
      res.end();
      return true;
    }

    sendError(res, 404, "NOT_FOUND", `未知接口: ${method} ${pathname}`);
    return true;
  }

  async function marketHistory(marketId, url) {
    const rawSeconds = Number(url.searchParams.get("seconds"));
    const seconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? Math.min(3600, Math.floor(rawSeconds)) : 300;
    const market = discovery.getMarket(marketId) || feed.getSnapshot(marketId);
    if (!market) throw new AppError(404, "MARKET_NOT_FOUND", `市场不存在: ${marketId}`);
    const tokenId = market.tokens?.yesTokenId;
    // Ring buffer only: never block the endpoint on an upstream call. Untracked
    // markets simply return an empty series until a run starts tracking them.
    const points = tokenId ? feed.getHistory(tokenId, seconds) : [];
    return {
      marketId,
      points: points.map((point) => ({
        ts: point.ts,
        mid: roundTo(point.mid ?? 0, 6),
        last: point.last === null || point.last === undefined ? null : roundTo(point.last, 6),
        bid: roundTo(point.bid ?? 0, 6),
        ask: roundTo(point.ask ?? 0, 6),
      })),
      windowSec: seconds,
    };
  }

  /* ------------------------------- dispatcher ------------------------------ */

  /**
   * Handle one HTTP request if it targets `/api/*`.
   * @returns {Promise<boolean>} true when the request was handled
   */
  async function handle(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${config.host}:${config.port}`}`);
    if (!url.pathname.startsWith("/api/")) return false;
    try {
      return await route(req, res, url);
    } catch (err) {
      if (res.writableEnded) return true;
      if (err instanceof AppError) {
        sendError(res, err.status, err.code, err.message, err.details);
      } else if (err instanceof UpstreamError) {
        const status = err.code === "RATE_LIMITED" ? 429 : 502;
        sendError(res, status, err.code, `上游行情接口异常: ${err.message}`);
      } else {
        log("error", `API ${req.method} ${url.pathname} failed: ${err?.stack || err?.message || err}`);
        sendError(res, 500, "INTERNAL", "服务器内部错误");
      }
      return true;
    }
  }

  return { handle, metaPayload };
}

export { sendJson, sendError };
export default createApiHandler;
