/**
 * server/engine/metarReleaseWindow.js
 *
 * Pure METAR release-window helpers. The scheduled data store refreshes each
 * city at its local 00:10; runtime only reads minute-of-hour constants.
 */
import { metarReleaseTimes } from "../data/metarReleaseTimesStore.js";

function entryForCity(city, store) {
  if (!city || !store) return null;
  const direct = store.getCity?.(city);
  if (direct) return direct;
  const all = store.getAll?.() || {};
  const wanted = String(city).trim().toLowerCase();
  for (const [name, entry] of Object.entries(all)) {
    if (String(name).trim().toLowerCase() === wanted) return entry;
  }
  return null;
}

/**
 * Nearest release node for a city around `now`.
 * @param {string} city
 * @param {number} now epoch ms
 * @param {number} windowSec ± window
 * @param {object} [store]
 * @returns {{nodeTs:number,nodeKey:string,minuteOffset:number,station:string,city:string}|null}
 */
export function releaseNodeForCity(city, now, windowSec, store = metarReleaseTimes) {
  if (String(city || "").trim().toLowerCase() === "hong kong") return null;
  const entry = entryForCity(city, store);
  const offsets = Array.isArray(entry?.minuteOffsetsUtc) ? entry.minuteOffsetsUtc : [];
  if (!offsets.length) return null;
  const windowMs = Math.max(0, Number(windowSec) || 0) * 1000;
  const hourStart = Math.floor(Number(now) / 3_600_000) * 3_600_000;
  let best = null;
  for (const hourDelta of [-1, 0, 1]) {
    const base = hourStart + hourDelta * 3_600_000;
    for (const raw of offsets) {
      const minute = Number(raw);
      if (!Number.isFinite(minute) || minute < 0 || minute > 59) continue;
      const nodeTs = base + minute * 60_000;
      const distance = Math.abs(Number(now) - nodeTs);
      if (distance > windowMs) continue;
      if (!best || distance < best.distance) {
        best = {
          distance,
          nodeTs,
          nodeKey: `${city}|${nodeTs}`,
          minuteOffset: minute,
          station: entry.station || "",
          city,
        };
      }
    }
  }
  return best ? { ...best } : null;
}

/** True when now is within ±windowSec of any known release node for city. */
export function isFallbackBlockedAtMetarRelease(city, now, windowSec = 300, store = metarReleaseTimes) {
  return Boolean(releaseNodeForCity(city, now, windowSec, store));
}
