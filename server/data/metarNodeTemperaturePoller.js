/**
 * Central METAR node-temperature poller.
 *
 * One request per second (at most), only for cities whose release-node window
 * is active and whose node observation has not been received yet. This is a
 * single global poller shared by every run; it never sends one request per run
 * or per city.
 *
 * Node policy: every active city release node (minuteOffsetsUtc, recurring
 * hourly) opens a 7-minute window. A city is removed from the ids parameter
 * once a newer observation (obsTime) arrives.
 */
import metarReleaseTimes from "./metarReleaseTimesStore.js";

const API = "https://aviationweather.gov/api/data/metar";
const NODE_WINDOW_MS = 7 * 60_000;
const POLL_MS = 1000;
const USER_AGENT = "PolyTemp/1.0 (strategy research; contact: local)";
const MAX_BACKOFF_MS = 60_000;

const latestByCity = new Map();
const latestObsByStation = new Map();
const states = new Map();
let timer = null;
let inFlight = false;
let backoffUntil = 0;
let logFn = () => {};
let running = false;

function utcHourStart(ms) {
  return Math.floor(ms / 3_600_000) * 3_600_000;
}

function activeNode(city, entry, now) {
  const offsets = Array.isArray(entry?.minuteOffsetsUtc) ? entry.minuteOffsetsUtc : [];
  if (!offsets.length) return null;
  const hour = utcHourStart(now);
  let chosen = null;
  for (const hourStart of [hour - 3_600_000, hour]) {
    for (const minute of offsets) {
      const nodeTs = hourStart + Number(minute) * 60_000;
      if (now >= nodeTs && now < nodeTs + NODE_WINDOW_MS) {
        if (!chosen || nodeTs > chosen.nodeTs) chosen = { nodeTs, station: entry.station };
      }
    }
  }
  return chosen;
}

function refreshStates(now) {
  for (const [city, entry] of Object.entries(metarReleaseTimes.data.cities || {})) {
    const active = activeNode(city, entry, now);
    if (!active?.station) continue;
    const key = `${city}|${active.nodeTs}`;
    if (!states.has(key)) {
      states.set(key, {
        key,
        city,
        station: active.station,
        nodeTs: active.nodeTs,
        windowEnd: active.nodeTs + NODE_WINDOW_MS,
        baselineObsTime: latestObsByStation.get(active.station) ?? null,
        done: false,
        lastError: null,
      });
    }
  }
  for (const [key, state] of states) {
    if (now > state.windowEnd + 60_000) states.delete(key);
  }
}

async function pollOnce() {
  if (inFlight || !running || Date.now() < backoffUntil) return;
  const now = Date.now();
  refreshStates(now);
  const pending = [...states.values()].filter((state) => !state.done && now < state.windowEnd);
  const stations = [...new Set(pending.map((state) => state.station).filter(Boolean))];
  if (stations.length === 0) return;
  inFlight = true;
  try {
    const url = `${API}?ids=${stations.join(",")}&format=json&hours=0`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429) {
      backoffUntil = Date.now() + 30_000;
      logFn("warn", "METAR node poller: 429, backing off 30s");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const observations = Array.isArray(body) ? body : [];
    const byStation = new Map();
    for (const observation of observations) {
      const station = String(observation?.icaoId || "").toUpperCase();
      if (station) byStation.set(station, observation);
    }
    const receivedAt = Date.now();
    for (const state of pending) {
      const observation = byStation.get(String(state.station).toUpperCase());
      if (!observation) continue;
      const obsTimeSec = Number(observation.obsTime ?? Date.parse(observation.reportTime || ""));
      const obsTimeMs = Number.isFinite(obsTimeSec) ? (obsTimeSec < 1e12 ? obsTimeSec * 1000 : obsTimeSec) : 0;
      const tempC = Number(observation.temp);
      if (!(obsTimeMs > 0) || !Number.isFinite(tempC)) continue;
      const baseline = state.baselineObsTime;
      const isNodeObservation = baseline === null
        ? obsTimeMs >= state.nodeTs - 60_000
        : obsTimeMs > Number(baseline);
      latestObsByStation.set(state.station, obsTimeMs);
      if (!isNodeObservation) continue;
      state.done = true;
      latestByCity.set(state.city, {
        city: state.city,
        station: state.station,
        tempC,
        obsTime: Math.floor(obsTimeMs / 1000),
        nodeTs: state.nodeTs,
        windowEnd: state.windowEnd,
        receivedAt,
      });
      logFn("info", `METAR node ${state.city} ${state.station}: ${tempC}°C (obs ${new Date(obsTimeMs).toISOString()})`);
    }
  } catch (error) {
    for (const state of states.values()) state.lastError = error?.message || String(error);
    backoffUntil = Date.now() + 2_000;
    logFn("warn", `METAR node poller: ${error?.message || error}`);
  } finally {
    inFlight = false;
  }
}

export function getLatestNodeTemperature(city) {
  return latestByCity.get(city) || null;
}

export function getLatestNodeTemperatures() {
  return Object.fromEntries(latestByCity);
}

export function startMetarNodeTemperaturePoller({ log } = {}) {
  if (running) return;
  logFn = typeof log === "function" ? log : () => {};
  running = true;
  timer = setInterval(() => { void pollOnce(); }, POLL_MS);
  if (typeof timer.unref === "function") timer.unref();
  logFn("info", "METAR node temperature poller active (1s windows, batched ids)");
}

export function stopMetarNodeTemperaturePoller() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  states.clear();
}
