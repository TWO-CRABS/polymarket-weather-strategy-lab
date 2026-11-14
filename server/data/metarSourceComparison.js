/**
 * Live METAR signal-source comparison for the node-temperature strategy.
 *
 * It never polls aviationweather.gov: the central node poller owns the AWC
 * budget. This module only polls the alternative source categories from the
 * 49-city research reports and compares their first-seen time with the AWC
 * observation already captured by the node poller.
 *
 * Output: data/metar-source-comparison.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import metarReleaseTimes from "./metarReleaseTimesStore.js";
import { getLatestNodeTemperature } from "./metarNodeTemperaturePoller.js";
import { METAR_SOURCE_CITIES } from "../../shared/metarSourceCatalog.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data", "metar-source-comparison.jsonl");
const NODE_WINDOW_MS = 7 * 60_000;
const ALT_POLL_MS = 2_000;
const SWOB_POLL_MS = 10_000;
const USER_AGENT = "PolyTemp/1.0 (source comparison; local research)";

const states = new Map();
let timer = null;
let running = false;
let logFn = () => {};

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

function obsTimeMsFromParts(day, hour, minute, now = Date.now()) {
  const current = new Date(now);
  let ms = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), Number(day), Number(hour), Number(minute));
  if (ms < now - 3 * 86_400_000) {
    ms = Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, Number(day), Number(hour), Number(minute));
  }
  return ms;
}

function parseMetarText(text, now = Date.now()) {
  const raw = String(text || "");
  const match = /\b([A-Z][A-Z0-9]{3})\s+(\d{2})(\d{2})(\d{2})Z\b/.exec(raw);
  if (!match) return null;
  const tempMatch = /\s(M?\d{2})\/(M?\d{2})\s/.exec(raw);
  const tempC = tempMatch ? Number(tempMatch[1].replace("M", "-")) : null;
  return {
    obsKey: `${match[2]}${match[3]}${match[4]}`,
    obsTimeMs: obsTimeMsFromParts(match[2], match[3], match[4], now),
    tempC,
    raw: raw.slice(0, 180),
  };
}

async function get(url, options = {}) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...(options.headers || {}) },
    signal: AbortSignal.timeout(options.timeoutMs || 15_000),
    redirect: "follow",
  });
}

const adapters = {
  async mgm(entry, now) {
    const url = `https://servis.mgm.gov.tr/web/sondurumlar/ilTumSondurum?ilPlaka=${entry.params.ilPlaka}`;
    const response = await get(url, {
      headers: {
        Origin: "https://www.mgm.gov.tr",
        Referer: "https://www.mgm.gov.tr/",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`MGM HTTP ${response.status}`);
    const rows = await response.json();
    const station = rows.find((row) => Number(row.istNo) === entry.params.istNo);
    if (!station?.rasatMetar || station.rasatMetar === "-9999") return null;
    return parseMetarText(station.rasatMetar, now);
  },

  async saws(entry, now) {
    const url = `https://aviation.weathersa.co.za/pages/popup/view_station.php?icao=${entry.station}`;
    const response = await get(url);
    if (!response.ok) throw new Error(`SAWS HTTP ${response.status}`);
    const text = await response.text();
    const raw = new RegExp(`(${entry.station}\\s+\\d{6}Z[^<]*)`, "i").exec(text)?.[1] || "";
    return parseMetarText(raw, now);
  },

  async tgftp(entry, now) {
    const url = `https://tgftp.nws.noaa.gov/data/observations/metar/stations/${entry.station}.TXT`;
    const response = await get(url);
    if (!response.ok) throw new Error(`tgftp HTTP ${response.status}`);
    return parseMetarText(await response.text(), now);
  },

  async swob(entry, now) {
    const day = new Date(now).toISOString().slice(0, 10).replaceAll("-", "");
    const dir = `https://dd.weather.gc.ca/today/observations/swob-ml/${day}/${entry.station}/`;
    const listing = await get(dir);
    if (!listing.ok) throw new Error(`SWOB dir HTTP ${listing.status}`);
    const html = await listing.text();
    const files = [...html.matchAll(/href="([^"]+\.xml)"/g)].map((match) => match[1]).sort();
    if (!files.length) return null;
    const file = files[files.length - 1];
    const response = await get(new URL(file, dir).toString());
    if (!response.ok) throw new Error(`SWOB HTTP ${response.status}`);
    const xml = await response.text();
    const sampling = /<gml:timePosition>([^<]+)<\/gml:timePosition>/.exec(xml)?.[1];
    const temp = /<element name="air_temp"[^>]*value="([^"]+)"/.exec(xml)?.[1];
    const obsTimeMs = sampling ? Date.parse(sampling) : 0;
    if (!obsTimeMs || !Number.isFinite(Number(temp))) return null;
    return {
      obsKey: sampling,
      obsTimeMs,
      tempC: Number(temp),
      raw: `${entry.station} SWOB ${sampling} air_temp=${temp}`,
    };
  },
};

function noteSource(state, source, observation) {
  if (!observation || state.sources[source]) return;
  const baseline = state.baselines.get(source) ?? null;
  const isNodeObservation = baseline === null
    ? observation.obsTimeMs >= state.nodeTs - 60_000
    : observation.obsTimeMs > baseline;
  if (!isNodeObservation) {
    if (baseline === null || observation.obsTimeMs > baseline) state.baselines.set(source, observation.obsTimeMs);
    return;
  }
  state.sources[source] = {
    firstSeenAt: Date.now(),
    obsTime: Math.floor(observation.obsTimeMs / 1000),
    obsKey: observation.obsKey,
    tempC: observation.tempC,
    raw: observation.raw,
  };
  logFn("info", `SOURCE ${state.city} ${source}: ${observation.tempC}°C @ ${new Date(observation.obsTimeMs).toISOString()}`);
}

async function pollAlternative(state) {
  if (state.altInFlight || Date.now() < state.nextAltAt || state.category === "none") return;
  state.altInFlight = true;
  state.nextAltAt = Date.now() + (state.adapter === "swob" ? SWOB_POLL_MS : ALT_POLL_MS);
  try {
    const observation = await adapters[state.adapter](state.entry, Date.now());
    noteSource(state, state.adapter, observation);
  } catch (error) {
    state.lastError = error?.message || String(error);
  } finally {
    state.altInFlight = false;
  }
}

function finalize(state) {
  const awc = getLatestNodeTemperature(state.city);
  if (awc && Number(awc.nodeTs) === state.nodeTs) {
    state.sources.awc = {
      firstSeenAt: awc.receivedAt,
      obsTime: awc.obsTime,
      tempC: awc.tempC,
      station: awc.station,
    };
  }
  const awcAt = state.sources.awc?.firstSeenAt ?? null;
  const sources = {};
  for (const [source, value] of Object.entries(state.sources)) {
    sources[source] = {
      ...value,
      deltaVsAwcMs: awcAt ? awcAt - value.firstSeenAt : null,
    };
  }
  const alternative = Object.entries(sources)
    .filter(([source]) => source !== "awc")
    .sort((a, b) => a[1].firstSeenAt - b[1].firstSeenAt)[0] || null;
  const record = {
    ts: new Date().toISOString(),
    city: state.city,
    station: state.station,
    category: state.category,
    nodeTs: state.nodeTs,
    windowEnd: state.windowEnd,
    awc: sources.awc || null,
    sources,
    earliestAlternative: alternative ? alternative[0] : null,
    alternativeLeadMs: alternative && awcAt ? awcAt - alternative[1].firstSeenAt : null,
    lastError: state.lastError || null,
  };
  try {
    fs.appendFileSync(OUTPUT_FILE, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    /* ignore disk errors */
  }
  logFn("info", `COMPARE ${state.city}: awc=${awcAt ? new Date(awcAt).toISOString() : "none"} alt=${alternative ? `${alternative[0]} ${record.alternativeLeadMs}ms` : "none"}`);
}

function refreshStates(now) {
  for (const entry of METAR_SOURCE_CITIES) {
    const release = metarReleaseTimes.getCity(entry.city);
    if (!release) continue;
    const active = activeNode(entry.city, release, now);
    if (!active) continue;
    const key = `${entry.city}|${active.nodeTs}`;
    if (states.has(key)) continue;
    states.set(key, {
      key,
      city: entry.city,
      station: entry.station,
      category: entry.category,
      adapter: entry.adapter,
      entry,
      nodeTs: active.nodeTs,
      windowEnd: active.nodeTs + NODE_WINDOW_MS,
      nextAltAt: 0,
      altInFlight: false,
      baselines: new Map(),
      sources: {},
      lastError: null,
    });
  }
  for (const [key, state] of states) {
    if (now < state.windowEnd) continue;
    finalize(state);
    states.delete(key);
  }
}

export function startMetarSourceComparison({ log } = {}) {
  if (running) return;
  logFn = typeof log === "function" ? log : () => {};
  running = true;
  timer = setInterval(() => {
    const now = Date.now();
    refreshStates(now);
    for (const state of states.values()) void pollAlternative(state);
  }, 1000);
  if (typeof timer.unref === "function") timer.unref();
  logFn("info", "METAR source comparison active (national/other/tgftp vs AWC)");
}

export function stopMetarSourceComparison() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  states.clear();
}
