/**
 * tests/helpers/server.mjs — integration-test harness for the real HTTP server.
 *
 * Responsibilities:
 *  1. `startServer()`  spawn `node server/index.js` on a free port in the 88xx
 *     range with a throw-away temp DATA_DIR, wait for `/api/health`, capture
 *     stdout/stderr and clean up the child + temp dir even when startup fails.
 *  2. tiny JSON HTTP client (`server.get/post/put/delete`, raw `server.request`).
 *  3. `SSEReader` that parses `event:` / `data:` frames from a fetch text
 *     stream, with timeouts and clean cancellation.
 *
 * Nothing in this file talks to the real Polymarket network; the harness only
 * drives the local server process.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute project root (…/PolyMarket Wealther Strategy Verification System). */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SERVER_ENTRY = path.join(PROJECT_ROOT, "server", "index.js");
export const WEB_INDEX = path.join(PROJECT_ROOT, "web", "index.html");

/** Ports used by tests; never 8787 (docs/06 §10 default dev port). */
export const TEST_PORT_MIN = 8800;
export const TEST_PORT_MAX = 8899;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolve true when `port` on loopback is bindable right now. */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Find a free loopback port in [min, max]; falls back to an OS-assigned port.
 * @param {{min?: number, max?: number, attempts?: number}} [opts]
 * @returns {Promise<number>}
 */
export async function getFreePort(opts = {}) {
  const min = opts.min ?? TEST_PORT_MIN;
  const max = opts.max ?? TEST_PORT_MAX;
  const attempts = opts.attempts ?? 40;
  for (let i = 0; i < attempts; i += 1) {
    const candidate = min + Math.floor(Math.random() * (max - min + 1));
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) return candidate;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Create a unique throw-away DATA_DIR under the OS temp dir. */
export async function makeTempDataDir(prefix = "pmw-qa-") {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Best-effort recursive temp-dir removal (Windows can briefly hold locks). */
export async function removeDir(dir, { retries = 5 } = {}) {
  if (!dir) return;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 2 });
      return;
    } catch (err) {
      if (attempt === retries) {
        // eslint-disable-next-line no-console
        console.warn(`[helpers/server] could not remove temp dir ${dir}: ${err.message}`);
        return;
      }
      await delay(100 * attempt);
    }
  }
}

/**
 * Tiny JSON HTTP client bound to a base URL.
 * @param {string} baseUrl e.g. http://127.0.0.1:8811
 */
export function createHttpClient(baseUrl) {
  /**
   * @param {string} pathname
   * @param {{method?: string, body?: unknown, headers?: Record<string,string>, timeoutMs?: number}} [opts]
   * @returns {Promise<{status:number, ok:boolean, headers:Record<string,string>, json:any, text:string, url:string}>}
   */
  async function request(pathname, opts = {}) {
    const { method = "GET", body, headers = {}, timeoutMs = 10_000 } = opts;
    const url = `${baseUrl}${pathname}`;
    const init = {
      method,
      headers: { accept: "application/json", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const response = await fetch(url, init);
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      json,
      text,
      url,
    };
  }

  const withBody = (method) => (pathname, body, opts = {}) => request(pathname, { ...opts, method, body });
  const noBody = (method) => (pathname, opts = {}) => request(pathname, { ...opts, method });

  return {
    baseUrl,
    request,
    get: noBody("GET"),
    post: withBody("POST"),
    put: withBody("PUT"),
    delete: noBody("DELETE"),
    /** GET and require 2xx; throws with the response text on failure. */
    async getJson(pathname, opts) {
      const res = await request(pathname, opts);
      if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status}: ${res.text.slice(0, 300)}`);
      if (res.json === null) throw new Error(`GET ${pathname} -> non-JSON body: ${res.text.slice(0, 300)}`);
      return res.json;
    },
    /** POST and require 2xx. */
    async postJson(pathname, body, opts) {
      const res = await request(pathname, { ...opts, method: "POST", body });
      if (!res.ok) throw new Error(`POST ${pathname} -> ${res.status}: ${res.text.slice(0, 300)}`);
      return res.json;
    },
  };
}

/* ------------------------------------------------------------------------- */
/* SSE                                                                       */
/* ------------------------------------------------------------------------- */

/** Parse one SSE frame (`event: x\ndata: {...}`) into {event, data, raw}. */
export function parseSseFrame(raw) {
  const lines = raw.split("\n");
  let eventName = "message";
  const dataLines = [];
  let sawField = false;
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      eventName = value || "message";
      sawField = true;
    } else if (field === "data") {
      dataLines.push(value);
      sawField = true;
    }
  }
  if (!sawField) return null;
  const dataText = dataLines.join("\n");
  let data = dataText;
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      data = dataText;
    }
  } else {
    data = null;
  }
  return { event: eventName, data, raw };
}

/**
 * Reads and buffers SSE events from a fetch response body.
 * Usage:
 *   const sse = await SSEReader.connect(`${server.baseUrl}/api/stream`);
 *   const hello = await sse.next("hello", { timeoutMs: 3000 });
 *   const trades = await sse.collect(["run", "trade"], 2);
 *   await sse.close();
 */
export class SSEReader {
  /** @param {Response} response */
  constructor(response) {
    if (!response.body) throw new Error("SSE response has no body");
    this.response = response;
    this.reader = response.body.getReader();
    this.decoder = new TextDecoder();
    this.buffer = "";
    this.queue = [];
    /** @type {Array<{predicate:(ev:any)=>boolean, resolve:(ev:any)=>void, timer:any}>} */
    this.waiters = [];
    this.closed = false;
    this.readError = null;
    this.stopped = false;
    this._pumpPromise = this._pump();
  }

  /** @param {string} url @returns {Promise<SSEReader>} */
  static async connect(url, opts = {}) {
    const { headers = {}, timeoutMs = 10_000, signal } = opts;
    const response = await fetch(url, {
      headers: { accept: "text/event-stream", "cache-control": "no-cache", ...headers },
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`SSE connect ${url} -> ${response.status}: ${text.slice(0, 300)}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`SSE connect ${url} -> wrong content-type: ${contentType}`);
    }
    return new SSEReader(response);
  }

  async _pump() {
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.buffer += this.decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        this._drainFrames();
      }
    } catch (err) {
      this.readError = err;
    } finally {
      this.closed = true;
      this.buffer += this.decoder.decode();
      this._drainFrames();
      const reason = this.readError ? `SSE stream errored: ${this.readError.message}` : "SSE stream closed";
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(reason));
      }
    }
  }

  _drainFrames() {
    let index = this.buffer.indexOf("\n\n");
    while (index !== -1) {
      const raw = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const frame = parseSseFrame(raw);
      if (frame) this._push(frame);
      index = this.buffer.indexOf("\n\n");
    }
  }

  _push(frame) {
    const waiterIndex = this.waiters.findIndex((waiter) => waiter.predicate(frame));
    if (waiterIndex >= 0) {
      const [waiter] = this.waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(frame);
      return;
    }
    // keep a bounded backlog so a chatty stream cannot grow unbounded
    this.queue.push(frame);
    if (this.queue.length > 500) this.queue.shift();
  }

  /**
   * Wait for the next matching event.
   * @param {string|((ev:any)=>boolean)|null} [match] event name or predicate
   * @param {{timeoutMs?: number, label?: string}} [opts]
   * @returns {Promise<{event:string, data:any, raw:string}>}
   */
  next(match = null, opts = {}) {
    const { timeoutMs = 5_000 } = opts;
    const predicate = typeof match === "string"
      ? (ev) => ev.event === match
      : typeof match === "function"
        ? match
        : () => true;
    const label = opts.label ?? (typeof match === "string" ? `event "${match}"` : "any event");

    if (this.stopped) {
      return Promise.reject(new Error(`SSE reader already closed; cannot wait for ${label}`));
    }
    const existing = this.queue.findIndex(predicate);
    if (existing >= 0) {
      const [frame] = this.queue.splice(existing, 1);
      return Promise.resolve(frame);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: null,
      };
      waiter.timer = setTimeout(() => {
        const at = this.waiters.indexOf(waiter);
        if (at >= 0) this.waiters.splice(at, 1);
        const queued = this.queue.map((frame) => frame.event).join(",") || "none";
        reject(
          new Error(
            `timed out after ${timeoutMs}ms waiting for SSE ${label}; buffered events: [${queued}]`,
          ),
        );
      }, timeoutMs);
      waiter.timer.unref?.();
      this.waiters.push(waiter);
    });
  }

  /**
   * Wait for a sequence of events in order (each one after the previous).
   * @param {Array<string|((ev:any)=>boolean)>} matches
   * @param {{timeoutMs?: number}} [opts] per-event timeout
   */
  async collect(matches, opts = {}) {
    const found = [];
    for (const match of matches) {
      // eslint-disable-next-line no-await-in-loop
      found.push(await this.next(match, opts));
    }
    return found;
  }

  /** Wait for the first buffered/future event with this name. */
  waitFor(eventName, opts = {}) {
    return this.next(eventName, opts);
  }

  /** Close the stream and unblock every waiter. */
  async close() {
    if (this.stopped) return;
    this.stopped = true;
    try {
      await this.reader.cancel();
    } catch {
      /* already closed */
    }
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("SSE reader closed by caller"));
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Server lifecycle harness                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Spawn `node server/index.js` and wait for its health endpoint.
 *
 * @param {{
 *   port?: number,
 *   env?: Record<string,string|undefined>,
 *   dataDir?: string,
 *   keepData?: boolean,
 *   readyPath?: string,
 *   readyTimeoutMs?: number,
 *   entry?: string,
 *   quiet?: boolean,
 * }} [options]
 * @returns {Promise<{
 *   process: import("node:child_process").ChildProcess,
 *   port: number,
 *   baseUrl: string,
 *   dataDir: string,
 *   http: ReturnType<typeof createHttpClient>,
 *   logs: () => string,
 *   stop: () => Promise<void>,
 *   sse: (path?: string) => Promise<SSEReader>,
 * }>}
 */
export async function startServer(options = {}) {
  const {
    port: requestedPort,
    env: extraEnv = {},
    dataDir: requestedDataDir,
    keepData = false,
    readyPath = "/api/health",
    readyTimeoutMs = 20_000,
    entry = SERVER_ENTRY,
    quiet = true,
  } = options;

  const tempDataDir = requestedDataDir ? null : await makeTempDataDir();
  const dataDir = requestedDataDir ?? tempDataDir;
  const port = requestedPort ?? (await getFreePort());
  const baseUrl = `http://127.0.0.1:${port}`;

  const chunks = [];
  const stdoutLines = [];
  const stderrLines = [];
  let child = null;
  let exited = false;
  let exitInfo = null;
  /** @type {Promise<any>} */
  let exitPromise = null;

  const onStdout = (chunk) => {
    const text = chunk.toString();
    chunks.push(text);
    for (const line of text.split(/\r?\n/)) if (line) stdoutLines.push(line);
    if (!quiet) process.stdout.write(`[server] ${text}`);
  };
  const onStderr = (chunk) => {
    const text = chunk.toString();
    chunks.push(text);
    for (const line of text.split(/\r?\n/)) if (line) stderrLines.push(line);
    if (!quiet) process.stderr.write(`[server:err] ${text}`);
  };

  const spawnServer = () => {
    child = spawn(process.execPath, [entry], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        DATA_DIR: dataDir,
        NODE_ENV: "test",
        FEED_MODE: "poll",
        // Keep upstream chatter minimal; tests never assert live data.
        DISCOVERY_MS: "3600000",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    exitPromise = new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        exited = true;
        exitInfo = { code, signal };
        resolve(exitInfo);
      });
    });
    child.once("error", (err) => {
      chunks.push(`spawn error: ${err.message}`);
    });
  };

  const cleanup = async ({ killProcess = true } = {}) => {
    if (killProcess && child && !exited) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      const terminated = await Promise.race([exitPromise.then(() => true), delay(3_000).then(() => false)]);
      if (!terminated && !exited) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        await Promise.race([exitPromise, delay(2_000)]);
      }
    }
    if (tempDataDir && !keepData) await removeDir(tempDataDir);
  };

  const logs = () => chunks.join("");

  try {
    spawnServer();

    const deadline = Date.now() + readyTimeoutMs;
    let ready = false;
    let lastError = null;
    while (Date.now() < deadline) {
      if (exited) {
        throw new Error(
          `server exited before becoming ready (code=${exitInfo?.code}, signal=${exitInfo?.signal}).\n` +
            `--- server logs ---\n${logs()}`,
        );
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`${baseUrl}${readyPath}`, {
          signal: AbortSignal.timeout(1_500),
        });
        // eslint-disable-next-line no-await-in-loop
        await res.text();
        if (res.ok) {
          ready = true;
          break;
        }
        lastError = new Error(`${readyPath} -> ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      // eslint-disable-next-line no-await-in-loop
      await delay(100);
    }
    if (!ready) {
      throw new Error(
        `server did not become ready within ${readyTimeoutMs}ms on ${baseUrl} ` +
          `(last error: ${lastError?.message ?? "none"}).\n--- server logs ---\n${logs()}`,
      );
    }

    const http = createHttpClient(baseUrl);

    const stop = async () => {
      await cleanup({ killProcess: true });
    };

    const sse = async (ssePath = "/api/stream", sseOpts = {}) =>
      SSEReader.connect(`${baseUrl}${ssePath}`, sseOpts);

    return {
      process: child,
      port,
      baseUrl,
      dataDir,
      tempDataDir,
      http,
      logs,
      stdout: () => stdoutLines.join("\n"),
      stderr: () => stderrLines.join("\n"),
      stop,
      sse,
      /** Wait until the child process exits (with a timeout). */
      async waitForExit(timeoutMs = 5_000) {
        return Promise.race([
          exitPromise,
          delay(timeoutMs).then(() => {
            throw new Error(`server did not exit within ${timeoutMs}ms`);
          }),
        ]);
      },
    };
  } catch (err) {
    await cleanup({ killProcess: true });
    throw err;
  }
}

/**
 * Start a server, run `fn(server)`, and always stop the server + remove temp data.
 * @template T
 * @param {Parameters<typeof startServer>[0]} options
 * @param {(server: Awaited<ReturnType<typeof startServer>>) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withServer(options, fn) {
  const server = await startServer(options);
  try {
    return await fn(server);
  } finally {
    await server.stop();
  }
}

/**
 * Poll an async predicate until it returns truthy or the deadline passes.
 * @template T
 * @param {() => Promise<T>|T} fn
 * @param {{timeoutMs?: number, intervalMs?: number, label?: string}} [opts]
 * @returns {Promise<T>}
 */
export async function waitFor(fn, opts = {}) {
  const { timeoutMs = 10_000, intervalMs = 100 } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    // eslint-disable-next-line no-await-in-loop
    await delay(intervalMs);
  }
  const suffix = lastError ? ` (last error: ${lastError.message})` : "";
  throw new Error(`waitFor timed out after ${timeoutMs}ms: ${opts.label ?? "condition"}${suffix}`);
}

export default {
  PROJECT_ROOT,
  SERVER_ENTRY,
  WEB_INDEX,
  TEST_PORT_MIN,
  TEST_PORT_MAX,
  isPortFree,
  getFreePort,
  makeTempDataDir,
  removeDir,
  createHttpClient,
  parseSseFrame,
  SSEReader,
  startServer,
  withServer,
  waitFor,
};
