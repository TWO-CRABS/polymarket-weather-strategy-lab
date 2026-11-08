/**
 * server/index.js — HTTP bootstrap.
 *
 * - serves the zero-build web app plus /web/*, /shared/*, /design/* statically
 *   (with MIME types and path-traversal protection)
 * - mounts the REST API + SSE stream under /api
 * - wires discovery (Gamma), live feed (CLOB poll/WS) and the run manager
 * - graceful SIGINT/SIGTERM shutdown (runs stopped, store flushed, streams closed)
 *
 * Safety: paper trading only. Binds loopback by default, no keys, no orders.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { Store } from "./store.js";
import { SseHub } from "./sse.js";
import { ClobClient } from "./data/clob.js";
import { Feed } from "./data/feed.js";
import { TemperatureDiscovery } from "./data/gamma.js";
import { RunManager } from "./engine/runManager.js";
import { createApiHandler } from "./api.js";
import { FEES, STRATEGY_PRESETS } from "../shared/contract.js";
import { utcDateKey } from "./util.js";

const startedAt = Date.now();
let sse = null;

/** Structured log: console + SSE `log` event (so the UI can show warnings). */
function log(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (sse) {
    try {
      sse.log(level, message);
    } catch {
      /* logging must never throw */
    }
  }
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** Resolve a URL path under a static root, rejecting traversal. */
function safeJoin(baseDir, relative) {
  const normalized = relative.replace(/\\/g, "/");
  if (normalized.includes("\0")) return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) return null;
  const resolved = path.resolve(baseDir, normalized);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

function sendJsonError(res, status, code, message) {
  const body = JSON.stringify({ error: { code, message } });
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/** Serve one static file (`/` → web/index.html). */
async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJsonError(res, 405, "METHOD_NOT_ALLOWED", `静态资源不支持 ${req.method}`);
    return;
  }
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/web/index.html";
  let target = null;
  for (const [prefix, baseDir] of Object.entries(config.staticDirs)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const relative = pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
      target = safeJoin(baseDir, relative);
      break;
    }
  }
  if (!target) {
    sendJsonError(res, 404, "NOT_FOUND", `资源不存在: ${url.pathname}`);
    return;
  }
  try {
    let stat = await fs.stat(target);
    if (stat.isDirectory()) {
      target = safeJoin(target, "index.html");
      if (!target) throw Object.assign(new Error("bad path"), { code: "ENOENT" });
      stat = await fs.stat(target);
    }
    const data = await fs.readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Length": data.length,
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EISDIR" || err.code === "ENOTDIR") {
      sendJsonError(res, 404, "NOT_FOUND", `资源不存在: ${url.pathname}`);
    } else {
      log("warn", `static read failed for ${url.pathname}: ${err.message}`);
      sendJsonError(res, 403, "FORBIDDEN", "资源不可访问");
    }
  }
}

async function main() {
  /* ------------------------------ services ------------------------------- */
  const store = await new Store({
    dataDir: config.dataDir,
    storeFile: config.storeFile,
    runsDir: config.runsDir,
    log,
  }).init();

  const clob = new ClobClient({ maxRps: config.maxRps, timeoutMs: config.httpTimeoutMs, log });
  const discovery = new TemperatureDiscovery({ intervalMs: config.discoveryMs, clob, log });
  const feed = new Feed({
    clob,
    pollMs: config.pollMs,
    staleMs: config.staleMs,
    mode: config.feedMode,
    ringMinutes: config.ringBufferMinutes,
    wsUrl: config.wsUrl,
    wsReconnectSchedule: config.wsReconnectSchedule,
    wsReconcileMs: config.wsReconcileMs,
    wsPingMs: config.wsPingMs,
    log,
  });
  sse = new SseHub({
    heartbeatMs: config.sseHeartbeatMs,
    metaProvider: () => ({
      cities: discovery.getCities(utcDateKey()),
      universeDate: utcDateKey(),
      presets: STRATEGY_PRESETS,
      feeModel: FEES,
      marketCount: discovery.getMarkets().length,
    }),
  });
  feed.onMarketUpdate((market) => sse.broadcast("market", { market }));
  feed.onStatus((status) => sse.broadcast("feed", status));

  const runs = new RunManager({
    store,
    sse,
    discovery,
    feed,
    clob,
    config,
    log,
  });

  /* --------------------------- initial data load -------------------------- */
  const networkEnabled = config.feedMode !== "off";
  if (networkEnabled) {
    const refresh = await discovery.refresh().catch((err) => {
      log("warn", `initial discovery failed: ${err.message}`);
      return { ok: false };
    });
    log(
      "info",
      refresh?.ok
        ? `discovery: ${refresh.marketCount} markets / ${refresh.eventCount} events`
        : "discovery: using cached/empty universe (upstream unavailable)",
    );
    if (config.replayFixture) log("info", `REPLAY_FIXTURE active: ${config.replayFixture}`);
    discovery.start();
    runs.applyFeedTracking();
    feed.start();
    // 重启恢复：已停止/已结束但仍有持仓的 live 运行继续等待官方裁决并补记兑付
    runs
      .recoverSettlements()
      .then((count) => {
        if (count > 0) log("info", `结算恢复：${count} 个运行仍在等待官方裁决`);
      })
      .catch((err) => log("warn", `结算恢复失败: ${err.message}`));
  } else {
    log("info", "FEED_MODE=off: upstream network disabled (deterministic offline mode)");
  }

  /* ------------------------------- server -------------------------------- */
  const api = createApiHandler({ store, sse, discovery, feed, runs, clob, config, startedAt, log });

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log("error", `request failed ${req.method} ${req.url}: ${err?.stack || err?.message || err}`);
      if (!res.headersSent) sendJsonError(res, 500, "INTERNAL", "服务器内部错误");
      else res.end();
    });
  });

  async function handle(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${config.host}:${config.port}`}`);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      await api.handle(req, res);
      return;
    }
    await serveStatic(req, res, url);
  }

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  log("info", `Polymarket Weather Strategy Lab listening on http://${config.host}:${port}`);
  log(
    "info",
    `feed mode=${config.feedMode} pollMs=${config.pollMs} discoveryMs=${config.discoveryMs} dataDir=${config.dataDir}`,
  );

  /* ------------------------------ shutdown ------------------------------- */
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", `${signal} received: shutting down gracefully`);
    discovery.stop();
    feed.stop();
    try {
      await runs.shutdown();
    } catch (err) {
      log("warn", `run shutdown failed: ${err.message}`);
    }
    try {
      await store.flush();
    } catch (err) {
      log("warn", `store flush failed: ${err.message}`);
    }
    sse.closeAll();
    await new Promise((resolve) => {
      server.close(() => resolve());
      setTimeout(resolve, 2500).unref();
    });
    log("info", "shutdown complete");
    process.exit(0);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGBREAK", () => shutdown("SIGBREAK"));

  return { server, services: { store, sse, discovery, feed, runs, clob } };
}

/* Global safety nets: keep the paper-trading server alive and logged. */
process.on("unhandledRejection", (reason) => {
  log("error", `unhandled rejection: ${reason?.stack || reason?.message || reason}`);
});
process.on("uncaughtException", (err) => {
  log("error", `uncaught exception: ${err?.stack || err?.message || err}`);
});

main().catch((err) => {
  log("error", `failed to start server: ${err?.stack || err?.message || err}`);
  process.exit(1);
});

export { main, log };
