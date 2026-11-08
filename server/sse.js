/**
 * server/sse.js — Server-Sent Events hub.
 *
 * - one SSE stream per browser (`GET /api/stream`), optional `?runId=` filter
 * - 15s heartbeat (comment line + `heartbeat` event) to defeat idle proxies
 * - event framing: `event: <name>\ndata: <json>\n\n`
 * - run-scoped events are filtered by runId; global events always pass.
 */
import { CONTRACT_VERSION } from "../shared/contract.js";
import { nowMs } from "./util.js";

export class SseHub {
  /** @param {{heartbeatMs?: number, metaProvider?: () => object|null}} [opts] */
  constructor(opts = {}) {
    this.heartbeatMs = opts.heartbeatMs ?? 15_000;
    /** @type {() => object|null} */
    this.metaProvider = opts.metaProvider ?? (() => null);
    /** @type {Set<{id:number,res:import("node:http").ServerResponse,runId:string|null,closed:boolean}>} */
    this.clients = new Set();
    this._seq = 0;
    this._heartbeatTimer = setInterval(() => this._heartbeat(), this.heartbeatMs);
    if (typeof this._heartbeatTimer.unref === "function") this._heartbeatTimer.unref();
  }

  /**
   * Attach a client to an existing HTTP response.
   * @param {import("node:http").ServerResponse} res
   * @param {{runId?: string|null}} [opts]
   */
  attach(res, opts = {}) {
    const client = { id: ++this._seq, res, runId: opts.runId || null, closed: false };
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });
    // flush headers immediately
    res.write(": connected\n\n");
    this.clients.add(client);

    this._write(client, "hello", {
      serverTime: nowMs(),
      contractVersion: CONTRACT_VERSION,
    });
    try {
      const meta = this.metaProvider ? this.metaProvider() : null;
      if (meta) this._write(client, "meta", meta);
    } catch {
      /* meta must never break a stream */
    }

    const cleanup = () => {
      client.closed = true;
      this.clients.delete(client);
    };
    res.on("close", cleanup);
    res.on("error", cleanup);
    return client;
  }

  /** @returns {number} number of connected clients */
  get size() {
    return this.clients.size;
  }

  /**
   * Broadcast one event.
   * @param {string} event SSE event name (see SSE_EVENTS)
   * @param {any} payload JSON payload
   * @param {string|null} [runId] when set, only clients without a filter or
   *   with the same runId receive the event
   */
  broadcast(event, payload, runId = null) {
    if (this.clients.size === 0) return 0;
    let sent = 0;
    for (const client of this.clients) {
      if (runId && client.runId && client.runId !== runId) continue;
      if (this._write(client, event, payload)) sent += 1;
    }
    return sent;
  }

  /** Broadcast a server log line (used by `log` SSE event). */
  log(level, message, runId = null) {
    this.broadcast("log", { level, message, ts: nowMs() }, runId);
  }

  /** Close all streams (graceful shutdown). */
  closeAll() {
    clearInterval(this._heartbeatTimer);
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
  }

  /* ------------------------------ internals ------------------------------ */

  _write(client, event, payload) {
    if (client.closed) return false;
    let json;
    try {
      json = JSON.stringify(payload);
    } catch {
      json = "null";
    }
    try {
      client.res.write(`event: ${event}\ndata: ${json}\n\n`);
      return true;
    } catch {
      client.closed = true;
      this.clients.delete(client);
      return false;
    }
  }

  _heartbeat() {
    if (this.clients.size === 0) return;
    const ts = nowMs();
    for (const client of this.clients) {
      if (client.closed) continue;
      try {
        client.res.write(`: ping ${ts}\n\n`);
      } catch {
        client.closed = true;
        this.clients.delete(client);
      }
    }
    this.broadcast("heartbeat", { ts });
  }
}

export default SseHub;
