/**
 * server/config.js — runtime configuration.
 *
 * Everything is configured through environment variables; defaults are chosen
 * for a local, single-user paper-trading box that binds loopback only.
 * No external dependencies.
 */
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

/** Parse a positive number env var with a fallback. */
function numEnv(name, fallback) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const POLL_MS = numEnv("POLL_MS", 1000);

/** Allowed feed modes; anything else falls back to `auto`. `off` disables all
 *  upstream network calls (deterministic API-conformance tests). */
const FEED_MODES = ["auto", "ws", "poll", "off"];
const feedMode = FEED_MODES.includes(process.env.FEED_MODE) ? process.env.FEED_MODE : "auto";

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(PROJECT_ROOT, "data");

export const config = Object.freeze({
  /** absolute project root (contains server/, web/, shared/, design/, data/) */
  projectRoot: PROJECT_ROOT,
  version: "0.1.0",

  /* ---- HTTP server ---- */
  host: process.env.HOST || "127.0.0.1",
  port: numEnv("PORT", 8787),
  /** JSON request bodies larger than this are rejected with 413-like 400 */
  maxBodyBytes: numEnv("MAX_BODY_BYTES", 1024 * 1024),

  /* ---- persistence ---- */
  dataDir,
  storeFile: path.join(dataDir, "store.json"),
  runsDir: path.join(dataDir, "runs"),

  /* ---- market discovery (Gamma) ---- */
  discoveryMs: numEnv("DISCOVERY_MS", 60_000),
  /** markets tracked by the live feed while no run is active (for /api/markets) */
  idleFeedMarkets: numEnv("IDLE_FEED_MARKETS", 36),

  /* ---- live feed (CLOB) ---- */
  feedMode,
  pollMs: POLL_MS,
  /** when set, replay runs load this local JSON instead of Data API history */
  replayFixture: process.env.REPLAY_FIXTURE ? path.resolve(process.env.REPLAY_FIXTURE) : null,
  /** a market snapshot older than this is flagged `stale` */
  staleMs: numEnv("STALE_MS", Math.max(3 * POLL_MS, 5000)),
  /** watchdog: force-reset a stuck REST poll after this many ms */
  pollTimeoutMs: numEnv("POLL_TIMEOUT_MS", 30_000),
  /** per-token ring buffer length in minutes (rolling signals + sparkline) */
  ringBufferMinutes: numEnv("RING_MINUTES", 15),
  /** upstream request budget (requests per second, aggregate) */
  maxRps: numEnv("MAX_RPS", 2),
  httpTimeoutMs: numEnv("HTTP_TIMEOUT_MS", 12_000),
  /** WS reconcile safety poll while the market websocket is healthy
   *  (kept below staleMs so quiet books are not flagged stale) */
  wsReconcileMs: numEnv("WS_RECONCILE_MS", 2500),
  /** 每个 WebSocket 连接大约覆盖多少个城市（多连接分批订阅） */
  wsCitiesPerConnection: numEnv("WS_CITIES_PER_CONNECTION", 20),
  wsUrl: "wss://ws-subscriptions-clob.polymarket.com/ws/market",
  wsPingMs: 10_000,
  wsReconnectSchedule: [1000, 2000, 5000, 15_000, 30_000],

  /* ---- SSE ---- */
  sseHeartbeatMs: numEnv("SSE_HEARTBEAT_MS", 15_000),

  /* ---- upstream endpoints (read-only, no auth) ---- */
  urls: Object.freeze({
    gamma: "https://gamma-api.polymarket.com",
    clob: "https://clob.polymarket.com",
    data: "https://data-api.polymarket.com",
  }),

  /* ---- static hosting ---- */
  staticDirs: Object.freeze({
    "/web": path.join(PROJECT_ROOT, "web"),
    "/shared": path.join(PROJECT_ROOT, "shared"),
    "/design": path.join(PROJECT_ROOT, "design"),
  }),
  indexHtml: path.join(PROJECT_ROOT, "web", "index.html"),
});

export default config;
