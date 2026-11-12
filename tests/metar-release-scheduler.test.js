/**
 * tests/metar-release-scheduler.test.js — 按城市 METAR 发布时刻调度器测试。
 *
 * 全部注入 now()/refresh()/store，不触网。覆盖：本地 00:10 触发、00:10 前不触发、
 * 同日幂等、启动补跑、失败退避、stop()、香港排除、时区独立性。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  METAR_RELEASE_CHECK_INTERVAL_MS,
  METAR_RELEASE_RETRY_DELAY_MS,
  createMetarReleaseScheduler,
  isMetarReleaseDue,
  metarReleaseCityLocalState,
  metarReleaseDueCities,
  startMetarReleaseScheduler,
} from "../server/data/metarReleaseScheduler.js";
import { metarReleaseCities } from "../server/data/metarReleaseRefresh.js";

/** 深圳本地 2026-11-13 00:10（UTC 2026-11-12 16:10）。 */
const SZ_0010 = Date.parse("2026-11-12T16:10:00Z");
const MINUTE = 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeFakeStore(initial = {}) {
  /** @type {Record<string, any>} */
  const entries = { ...initial };
  return {
    entries,
    getCity(city) {
      return entries[city] ? { ...entries[city], minuteOffsetsUtc: [...(entries[city].minuteOffsetsUtc || [])] } : null;
    },
    async replaceCity(city, entry) {
      entries[city] = entry;
      return { ...entry };
    },
  };
}

/** 刷新时把城市标记为“今日已刷新”，用于幂等场景。 */
function markingRefresh(calls) {
  return async (city, store, opts) => {
    calls.push({ city, now: opts.now });
    const state = metarReleaseCityLocalState(city, opts.now);
    store.entries[city] = {
      station: "ZGSZ",
      observationDate: "2026-11-12",
      refreshedAtLocalDate: state ? state.localDate : "",
      minuteOffsetsUtc: [0],
      samples: 24,
      updatedAt: new Date(opts.now).toISOString(),
    };
    return { ok: true, skipped: false, city, station: "ZGSZ", observationDate: "2026-11-12" };
  };
}

test("scheduler: computes per-city local date/time with Intl", () => {
  const shenzhen = metarReleaseCityLocalState("Shenzhen", SZ_0010);
  assert.equal(shenzhen.timeZone, "Asia/Shanghai");
  assert.equal(shenzhen.localDate, "2026-11-13");
  assert.equal(shenzhen.localTime, "00:10");
  assert.equal(shenzhen.minutesOfDay, 10);

  const nyc = metarReleaseCityLocalState("New York City", SZ_0010);
  assert.equal(nyc.localDate, "2026-11-12");
  assert.equal(nyc.localTime, "11:10");
  assert.equal(nyc.minutesOfDay, 11 * 60 + 10);

  assert.equal(metarReleaseCityLocalState("Atlantis", SZ_0010), null);
});

test("scheduler: due only after local 00:10 and when today is not refreshed", () => {
  const before = Date.parse("2026-11-12T16:09:00Z"); // 深圳本地 00:09
  assert.equal(isMetarReleaseDue("Shenzhen", null, before), false);
  assert.equal(isMetarReleaseDue("Shenzhen", null, SZ_0010), true);

  const today = metarReleaseCityLocalState("Shenzhen", SZ_0010).localDate;
  assert.equal(isMetarReleaseDue("Shenzhen", { refreshedAtLocalDate: today }, SZ_0010), false);

  // 启动补跑：本地 04:00，entry 仍是昨天 → due。
  const later = Date.parse("2026-11-12T20:00:00Z"); // 深圳本地 2026-11-13 04:00
  assert.equal(isMetarReleaseDue("Shenzhen", { refreshedAtLocalDate: "2026-11-12" }, later), true);
});

test("scheduler: runOnce refreshes only the city that is due (timezone independent)", async () => {
  const calls = [];
  const nycToday = metarReleaseCityLocalState("New York City", SZ_0010).localDate;
  const londonToday = metarReleaseCityLocalState("London", SZ_0010).localDate;
  const store = makeFakeStore({
    "New York City": { station: "KLGA", refreshedAtLocalDate: nycToday },
    London: { station: "EGLC", refreshedAtLocalDate: londonToday },
  });
  const scheduler = createMetarReleaseScheduler({
    store,
    now: () => SZ_0010,
    refresh: markingRefresh(calls),
    immediate: false,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen", "New York City", "London"],
  });
  const result = await scheduler.runOnce();
  scheduler.stop();

  assert.deepEqual(calls.map((call) => call.city), ["Shenzhen"]);
  assert.equal(calls[0].now, SZ_0010);
  assert.equal(result.results.length, 1);
});

test("scheduler: before local 00:10 nothing is refreshed", async () => {
  let calls = 0;
  const now = Date.parse("2026-11-12T16:05:00Z"); // 深圳本地 00:05
  const scheduler = createMetarReleaseScheduler({
    store: makeFakeStore(),
    now: () => now,
    refresh: async () => {
      calls += 1;
      return { ok: true };
    },
    immediate: false,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen", "Beijing", "Shanghai"],
  });
  await scheduler.runOnce();
  scheduler.stop();
  assert.equal(calls, 0);
});

test("scheduler: same-day idempotence — one refresh per local date", async () => {
  const calls = [];
  const scheduler = createMetarReleaseScheduler({
    store: makeFakeStore(),
    now: () => SZ_0010,
    refresh: markingRefresh(calls),
    immediate: false,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen"],
  });
  await scheduler.runOnce();
  await scheduler.runOnce();
  await scheduler.runOnce();
  scheduler.stop();
  assert.equal(calls.length, 1);
});

test("scheduler: startup catch-up runs when process starts past local 00:10", async () => {
  const calls = [];
  const store = makeFakeStore({
    Shenzhen: { station: "ZGSZ", refreshedAtLocalDate: "2026-11-12" },
  });
  const now = Date.parse("2026-11-12T20:00:00Z"); // 深圳本地 04:00
  const handle = startMetarReleaseScheduler({
    store,
    now: () => now,
    refresh: markingRefresh(calls),
    immediate: true,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen"],
  });
  assert.ok(typeof handle.stop === "function");
  await sleep(25);
  handle.stop();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].city, "Shenzhen");
});

test("scheduler: failed refresh retries only after retryDelayMs", async () => {
  let calls = 0;
  let current = SZ_0010;
  const scheduler = createMetarReleaseScheduler({
    store: makeFakeStore(),
    now: () => current,
    refresh: async () => {
      calls += 1;
      throw new Error("aviationweather down");
    },
    immediate: false,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen"],
  });
  await scheduler.runOnce();
  assert.equal(calls, 1);

  current += 5 * MINUTE;
  await scheduler.runOnce();
  assert.equal(calls, 1, "retry blocked inside retryDelayMs");

  current += METAR_RELEASE_RETRY_DELAY_MS - 5 * MINUTE;
  await scheduler.runOnce();
  assert.equal(calls, 2, "retry allowed after retryDelayMs");
  scheduler.stop();
});

test("scheduler: stops retrying after maxAttemptsPerDay for one local date", async () => {
  let calls = 0;
  let current = SZ_0010;
  const scheduler = createMetarReleaseScheduler({
    store: makeFakeStore(),
    now: () => current,
    refresh: async () => {
      calls += 1;
      throw new Error("aviationweather down");
    },
    immediate: false,
    checkIntervalMs: 100_000,
    cities: ["Shenzhen"],
    maxAttemptsPerDay: 2,
    retryDelayMs: 0,
  });
  await scheduler.runOnce();
  assert.equal(calls, 1);
  current += 1000;
  await scheduler.runOnce();
  assert.equal(calls, 2);
  current += 1000;
  await scheduler.runOnce();
  await scheduler.runOnce();
  assert.equal(calls, 2, "attempt cap reached for this local date");
  scheduler.stop();
});

test("scheduler: timer ticks and stop() halts it", async () => {
  let calls = 0;
  const scheduler = startMetarReleaseScheduler({
    store: makeFakeStore(),
    now: () => SZ_0010,
    refresh: async () => {
      calls += 1;
      return { ok: true, skipped: false };
    },
    immediate: false,
    checkIntervalMs: 25,
    cities: ["Shenzhen"],
  });
  assert.equal(scheduler.isRunning(), true);
  await sleep(120);
  scheduler.stop();
  assert.equal(scheduler.isRunning(), false);
  const callsAfterStop = calls;
  assert.ok(calls >= 1, "timer tick refreshed at least once");
  await sleep(80);
  assert.equal(calls, callsAfterStop, "no ticks after stop()");
});

test("scheduler: default city list meets the contract (48 cities, Hong Kong excluded)", () => {
  const scheduler = createMetarReleaseScheduler({ immediate: false, checkIntervalMs: 100_000 });
  const cities = scheduler.cities();
  scheduler.stop();
  assert.equal(cities.length, 48);
  assert.equal(cities.length, metarReleaseCities().length);
  assert.ok(!cities.includes("Hong Kong"));
  assert.equal(METAR_RELEASE_CHECK_INTERVAL_MS, 30_000);
});

test("scheduler: metarReleaseDueCities reports catch-up cities", () => {
  const store = makeFakeStore({
    Shenzhen: { station: "ZGSZ", refreshedAtLocalDate: "2026-11-12" },
    "New York City": { station: "KLGA", refreshedAtLocalDate: "2026-11-12" },
  });
  const due = metarReleaseDueCities({ store, now: SZ_0010, cities: ["Shenzhen", "New York City", "London"] });
  // 深圳本地 00:10：昨天刷新 → due；NYC 本地 11:10 且今天已刷新 → 不 due；
  // London 本地 16:10 且无 entry → due（启动补跑）。
  assert.deepEqual(due.sort(), ["London", "Shenzhen"]);
});
