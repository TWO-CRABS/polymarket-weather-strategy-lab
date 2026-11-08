/**
 * scripts/browser-check.mjs — zero-build frontend integrity + headless render check.
 *
 * Verifies, without installing anything:
 *   1. every JS file under web/ parses (`node --check`);
 *   2. every ES-module import resolves to an existing local file and no bare /
 *      external module specifiers are used (zero-build, zero-dependency);
 *   3. web/index.html only references local assets and declares module scripts;
 *   4. the real static server serves index/app/styles/contract with correct MIME;
 *   5. if headless Microsoft Edge exists, renders `/#/builder` in a 1440x1000
 *      viewport and writes tests/screenshots/builder-1440x1000.png plus a DOM
 *      dump. Rendering uses the DevTools protocol because Edge's one-shot
 *      `--screenshot`+`--virtual-time-budget` mode does not terminate while the
 *      page holds an open SSE connection (EventSource). A CLI fallback is kept.
 *
 * Usage: node scripts/browser-check.mjs
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

import {
  PROJECT_ROOT,
  makeTempDataDir,
  removeDir,
  startServer,
  waitFor,
} from "../tests/helpers/server.mjs";
import { fixtureStrategy, writeReplayFixture } from "../tests/fixtures/replay.js";

const SHOT_DIR = path.join(PROJECT_ROOT, "tests", "screenshots");
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const VIEWPORT = { width: 1440, height: 1000 };

const checks = [];
let failed = 0;

function pass(name, detail = "") {
  checks.push({ name, status: "PASS", detail });
  console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  failed += 1;
  checks.push({ name, status: "FAIL", detail });
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  checks.push({ name, status: "WARN", detail });
  console.log(`  [WARN] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function listFiles(dir, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(full, out);
    else out.push(full);
  }
  return out;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findEdge() {
  for (const candidate of EDGE_PATHS) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* Minimal Chrome DevTools Protocol client (Node 22 global WebSocket/fetch)  */
/* ------------------------------------------------------------------------- */

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
        else resolve(message.result ?? {});
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    child.kill();
  } catch {
    /* ignore */
  }
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
}

async function waitForDevToolsPort(profileDir, timeoutMs = 25_000) {
  const portFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const text = await fs.readFile(portFile, "utf8");
      const port = Number(text.split("\n")[0]);
      if (Number.isFinite(port) && port > 0) return port;
    } catch {
      /* not ready yet */
    }
    await delay(100);
  }
  throw new Error(`Edge DevToolsActivePort not created within ${timeoutMs}ms`);
}

/**
 * Render one URL in headless Edge through CDP, capture screenshot + DOM.
 * @returns {Promise<{state:object, exceptions:any[], consoleErrors:any[], screenshot:string, dom:string}>}
 */
async function captureWithCdp({ edge, baseUrl, route, profileDir, shotPath }) {
  await fs.mkdir(profileDir, { recursive: true });
  const child = spawn(
    edge,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    const port = await waitForDevToolsPort(profileDir);
    // find the page target (ignore extension background pages)
    let target = null;
    for (let i = 0; i < 50 && !target; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = targets.find((entry) => entry.type === "page");
      if (!target) await delay(100);
    }
    if (!target) throw new Error("no page target exposed by headless Edge");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP websocket open timeout")), 10_000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error(`CDP websocket error: ${event.message ?? "unknown"}`));
      }, { once: true });
    });
    const cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const url = `${baseUrl}/${route}`;
    await cdp.send("Page.navigate", { url });
    // wait for the SPA to mount (route rendering is synchronous, feed is async)
    let state = null;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      const evaluated = await cdp.send("Runtime.evaluate", {
        expression: `JSON.stringify({
          title: document.title,
          hash: location.hash,
          readyState: document.readyState,
          nodes: document.querySelectorAll('*').length,
          textLength: (document.body && document.body.innerText || '').length,
          text: (document.body && document.body.innerText || '').slice(0, 240),
        })`,
        returnByValue: true,
      });
      try {
        state = JSON.parse(evaluated.result?.value ?? "null");
      } catch {
        state = null;
      }
      if (state && state.readyState === "complete" && state.nodes > 100) break;
      await delay(200);
    }
    await delay(600);
    // Re-sample after the settle delay: the mount poll can catch the SPA shell
    // before async REST data has rendered dashboard content, so the final text
    // snapshot must be taken after the delay (otherwise the content regex races).
    try {
      const finalEval = await cdp.send("Runtime.evaluate", {
        expression: `JSON.stringify({
          title: document.title,
          hash: location.hash,
          readyState: document.readyState,
          nodes: document.querySelectorAll('*').length,
          textLength: (document.body && document.body.innerText || '').length,
          text: (document.body && document.body.innerText || '').slice(0, 4000),
        })`,
        returnByValue: true,
      });
      const finalState = JSON.parse(finalEval.result?.value ?? "null");
      if (finalState) state = finalState;
    } catch {
      /* keep the initial poll state */
    }
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const domResult = await cdp.send("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    });
    const exceptions = cdp.events
      .filter((event) => event.method === "Runtime.exceptionThrown")
      .map((event) => event.params?.exceptionDetails?.exception?.description
        ?? event.params?.exceptionDetails?.text
        ?? "unknown exception");
    const consoleErrors = cdp.events
      .filter((event) => event.method === "Runtime.consoleAPICalled" && event.params?.type === "error")
      .map((event) => (event.params.args ?? []).map((arg) => arg.value ?? arg.description).join(" "));

    await fs.writeFile(shotPath, Buffer.from(screenshot.data, "base64"));
    return {
      state,
      exceptions,
      consoleErrors,
      screenshot: domResult.result?.value ?? "",
      stderr,
    };
  } finally {
    killTree(child);
    await delay(500);
  }
}

/**
 * Fallback: Edge's one-shot CLI screenshot. Kept because it is the documented
 * approach; it is expected to time out while the page holds an SSE connection.
 */
async function captureWithCli({ edge, url, profileDir, shotPath, timeoutMs = 30_000 }) {
  await fs.mkdir(profileDir, { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    "--virtual-time-budget=4000",
    `--screenshot=${shotPath}`,
    url,
  ];
  const child = spawn(edge, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  killTree(child);
  if (fsSync.existsSync(shotPath)) {
    const stat = await fs.stat(shotPath);
    if (stat.size > 5_000) return { ok: true, size: stat.size, stderr };
  }
  return { ok: false, size: 0, stderr, exited };
}

/* ------------------------------------------------------------------------- */

async function main() {
  const webDir = path.join(PROJECT_ROOT, "web");
  const files = await listFiles(webDir);
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  console.log(`web/ contains ${files.length} files (${jsFiles.length} JS modules)`);

  /* ----------------------------- 1. JS parses ---------------------------- */
  const parseErrors = [];
  for (const file of jsFiles) {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      parseErrors.push(`${path.relative(PROJECT_ROOT, file)}: ${String(err.stderr || err.message).slice(0, 300)}`);
    }
  }
  if (parseErrors.length) fail("node --check on web JS files", parseErrors.join(" | "));
  else pass("node --check on web JS files", `${jsFiles.length} files parse`);

  /* ------------------------- 2. ES module imports ------------------------ */
  const importRe = /\bimport\s*(?:[^'"]*?\s+from\s*)?["']([^"']+)["']/g;
  const bareImports = [];
  const missingImports = [];
  for (const file of jsFiles) {
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(importRe)) {
      const specifier = match[1];
      if (!specifier) continue;
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (!fsSync.existsSync(target)) {
          missingImports.push(`${path.relative(PROJECT_ROOT, file)} -> ${specifier}`);
        }
      } else if (specifier.startsWith("/")) {
        const target = path.join(PROJECT_ROOT, specifier.slice(1));
        if (!fsSync.existsSync(target)) {
          missingImports.push(`${path.relative(PROJECT_ROOT, file)} -> ${specifier}`);
        }
      } else if (!specifier.startsWith("data:")) {
        bareImports.push(`${path.relative(PROJECT_ROOT, file)} -> ${specifier}`);
      }
    }
  }
  if (missingImports.length) fail("module imports resolve", missingImports.join(" | "));
  else pass("module imports resolve", "all relative specifiers point at existing files");
  if (bareImports.length) fail("no external/bare imports", bareImports.join(" | "));
  else pass("no external/bare imports", "zero-build frontend has no npm/CDN imports");

  /* --------------------------- 3. index.html ----------------------------- */
  const indexPath = path.join(webDir, "index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const attrRe = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  const localRefs = new Set();
  const externalRefs = [];
  const missingRefs = [];
  for (const match of indexHtml.matchAll(attrRe)) {
    const ref = match[1];
    if (/^(data:|#|mailto:|javascript:)/i.test(ref)) continue;
    if (/^(https?:)?\/\//i.test(ref)) {
      externalRefs.push(ref);
      continue;
    }
    localRefs.add(ref);
    if (ref.startsWith("/")) {
      const target = ref.startsWith("/web/") || ref.startsWith("/shared/")
        ? path.join(PROJECT_ROOT, ref.slice(1))
        : null;
      if (!target || !fsSync.existsSync(target)) missingRefs.push(ref);
    }
  }
  if (externalRefs.length) fail("index.html has no external requests", externalRefs.join(" | "));
  else pass("index.html has no external requests", "no CDN/font/network URLs");
  if (missingRefs.length) fail("index.html asset refs exist", missingRefs.join(" | "));
  else pass("index.html asset refs exist", `${localRefs.size} local asset reference(s)`);
  if (/<script[^>]*type=["']module["']/i.test(indexHtml)) {
    pass("index.html uses ES modules", "module script tags present");
  } else {
    fail("index.html uses ES modules", "no <script type=\"module\"> found");
  }

  /* ------------------------- 4. static server MIME ----------------------- */
  const dataDir = await makeTempDataDir("pmw-browser-");
  let server = null;
  try {
    // deterministic offline server: REPLAY_FIXTURE lets us also render a
    // dashboard populated with a finished replay run.
    const fixturePath = await writeReplayFixture(dataDir);
    server = await startServer({
      dataDir,
      env: { FEED_MODE: "off", REPLAY_FIXTURE: fixturePath, DISCOVERY_MS: "3600000" },
      readyTimeoutMs: 20_000,
    });
    const assets = [
      ["/", /^text\/html/],
      ["/web/app.js", /^(text|application)\/javascript/],
      ["/web/views/builder.js", /^(text|application)\/javascript/],
      ["/web/views/dashboard.js", /^(text|application)\/javascript/],
      ["/web/styles.css", /^text\/css/],
      ["/shared/contract.js", /^(text|application)\/javascript/],
    ];
    const mimeErrors = [];
    for (const [url, expected] of assets) {
      // eslint-disable-next-line no-await-in-loop
      const res = await server.http.request(url);
      const contentType = res.headers["content-type"] ?? "";
      if (res.status !== 200 || !expected.test(contentType)) {
        mimeErrors.push(`${url} -> ${res.status} ${contentType}`);
      }
    }
    if (mimeErrors.length) fail("static server MIME types", mimeErrors.join(" | "));
    else pass("static server MIME types", `${assets.length} assets served correctly`);

    /* ------------------------ 5. headless Edge render --------------------- */
    const edge = findEdge();
    if (!edge) {
      warn("headless browser render", "skipped: Microsoft Edge not installed");
    } else {
      await fs.mkdir(SHOT_DIR, { recursive: true });
      const shotPath = path.join(SHOT_DIR, "builder-1440x1000.png");
      const domPath = path.join(SHOT_DIR, "builder-dom.html");
      const profileDir = path.join(dataDir, "edge-profile");
      try {
        if (fsSync.existsSync(shotPath)) await fs.rm(shotPath, { force: true });
        const captured = await captureWithCdp({
          edge,
          baseUrl: server.baseUrl,
          route: "#/builder",
          profileDir,
          shotPath,
        });
        const stat = fsSync.existsSync(shotPath) ? await fs.stat(shotPath) : null;
        if (!stat || stat.size < 10_000) {
          fail("headless browser render", `screenshot missing/too small (${stat?.size ?? 0} bytes)`);
        } else if (!captured.state || captured.state.nodes < 100) {
          fail("headless browser render", `page did not mount: ${JSON.stringify(captured.state)}`);
        } else if (!/策略构建/.test(captured.state.title) && !/策略构建/.test(captured.state.text)) {
          fail("headless browser render", `builder UI text missing (title=${captured.state.title})`);
        } else {
          pass(
            "headless browser render",
            `${path.relative(PROJECT_ROOT, shotPath)} (${Math.round(stat.size / 1024)} KiB, ` +
              `${VIEWPORT.width}x${VIEWPORT.height}, ${captured.state.nodes} DOM nodes, hash=${captured.state.hash})`,
          );
        }
        if (captured.screenshot && captured.screenshot.length > 1_000) {
          await fs.writeFile(domPath, captured.screenshot, "utf8");
          pass("SPA renders builder route", `DOM dumped to ${path.relative(PROJECT_ROOT, domPath)}`);
        }
        if (captured.exceptions.length) {
          fail("no uncaught JS exceptions", captured.exceptions.slice(0, 3).join(" | ").slice(0, 500));
        } else {
          pass("no uncaught JS exceptions", "runtime clean");
        }
        if (captured.consoleErrors.length) {
          warn("console.error output", captured.consoleErrors.slice(0, 3).join(" | ").slice(0, 400));
        }

        /* ------------- dashboard render with a finished replay run ---------- */
        try {
          const create = await server.http.post("/api/runs", {
            mode: "replay",
            strategy: fixtureStrategy(),
            replay: { speed: 100 },
          });
          if (create.status !== 201) throw new Error(`run create failed HTTP ${create.status}`);
          const runId = create.json.run.id;
          await waitFor(
            async () => {
              const res = await server.http.get(`/api/runs/${encodeURIComponent(runId)}`);
              return res.json?.run?.status === "ended";
            },
            { timeoutMs: 25_000, intervalMs: 250, label: "replay run ended" },
          );
          const dashShot = path.join(SHOT_DIR, "dashboard-1440x1000.png");
          const dash = await captureWithCdp({
            edge,
            baseUrl: server.baseUrl,
            route: `#/dashboard?run=${encodeURIComponent(runId)}`,
            profileDir: path.join(dataDir, "edge-profile-dashboard"),
            shotPath: dashShot,
          });
          const dashStat = fsSync.existsSync(dashShot) ? await fs.stat(dashShot) : null;
          const dashText = dash.state?.text ?? "";
          if (!dashStat || dashStat.size < 10_000) {
            fail("dashboard render", "screenshot missing/too small");
          } else if (!dash.state || dash.state.nodes < 100) {
            fail("dashboard render", `dashboard did not mount: ${JSON.stringify(dash.state)}`);
          } else if (!/已结束|结束|成交明细|权益曲线|手续费|费率/.test(dashText)) {
            fail("dashboard render", `dashboard content missing: ${dashText.slice(0, 160)}`);
          } else {
            pass(
              "dashboard render",
              `${path.relative(PROJECT_ROOT, dashShot)} (${Math.round(dashStat.size / 1024)} KiB, ${dash.state.nodes} nodes)`,
            );
          }
          if (dash.exceptions.length) {
            fail("dashboard has no uncaught JS exceptions", dash.exceptions.slice(0, 3).join(" | ").slice(0, 500));
          }
        } catch (err) {
          fail("dashboard render", err.message);
        }
      } catch (err) {
        console.log(`      CDP capture failed (${err.message}); trying Edge CLI fallback…`);
        const fallback = await captureWithCli({
          edge,
          url: `${server.baseUrl}/#/builder`,
          profileDir: path.join(dataDir, "edge-profile-cli"),
          shotPath,
        });
        if (fallback.ok) {
          pass(
            "headless browser render (CLI fallback)",
            `${path.relative(PROJECT_ROOT, shotPath)} (${Math.round(fallback.size / 1024)} KiB)`,
          );
        } else {
          fail("headless browser render", `CDP failed (${err.message}) and CLI fallback failed`);
        }
      }
    }
  } finally {
    if (server) await server.stop();
    await removeDir(dataDir);
  }

  /* ------------------------------- summary ------------------------------- */
  console.log("\n" + "=".repeat(70));
  for (const check of checks) {
    console.log(`  ${check.status.padEnd(4)} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  console.log("-".repeat(70));
  const passed = checks.filter((check) => check.status === "PASS").length;
  const warned = checks.filter((check) => check.status === "WARN").length;
  console.log(`  ${passed} passed, ${warned} warned, ${failed} failed`);
  if (failed > 0) {
    console.log("RESULT: FAIL");
    process.exitCode = 1;
  } else {
    console.log("RESULT: PASS");
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error("browser-check crashed:", err);
  process.exitCode = 1;
});
