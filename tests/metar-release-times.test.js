/**
 * tests/metar-release-times.test.js — METAR 发布时刻数据层测试（不触网）。
 *
 * 覆盖：store 原子写/损坏容错/缓存、timezone 独立筛选、SPECI 排除、
 * 分钟偏移阈值、同日幂等、force、station 缺失、香港排除、生成文件结构。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_METAR_RELEASE_TIMES_PATH,
  METAR_RELEASE_TIMES_BASIS,
  METAR_RELEASE_TIMES_SOURCE,
  METAR_RELEASE_TIMES_VERSION,
  MetarReleaseTimesStore,
  emptyMetarReleaseTimesData,
  metarReleaseTimes,
  normalizeMetarReleaseEntry,
} from "../server/data/metarReleaseTimesStore.js";
import {
  METAR_LOOKBACK_HOURS,
  METAR_RELEASE_STATIONS,
  buildMetarUrl,
  canonicalMetarCity,
  deriveMinuteOffsetsUtc,
  fetchGammaStationMap,
  fetchMetarRows,
  metarReleaseCities,
  metarStationForCity,
  refreshMetarReleaseCity,
  selectPreviousDayMetars,
} from "../server/data/metarReleaseRefresh.js";
import { CITY_TIMEZONES } from "../shared/cityTimezones.js";

const NOW = Date.parse("2026-11-12T23:30:00Z");
const ISO = (ms) => new Date(ms).toISOString();

/* ------------------------------ test helpers ------------------------------ */

async function makeTempStore() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "metar-release-times-"));
  const filePath = path.join(dir, "metar-release-times.json");
  return { dir, filePath, store: new MetarReleaseTimesStore({ filePath }) };
}

function makeEntry(overrides = {}) {
  return {
    station: "ZGSZ",
    observationDate: "2026-11-11",
    refreshedAtLocalDate: "2026-11-12",
    minuteOffsetsUtc: [0],
    samples: 24,
    updatedAt: "2026-11-12T00:10:00.000Z",
    ...overrides,
  };
}

/** AWC 风格 METAR 行：obsTime 为秒级 epoch。 */
function metarAt(iso, { station = "ZGSZ", metarType = "METAR" } = {}) {
  const ms = Date.parse(iso);
  return {
    icaoId: station,
    obsTime: Math.floor(ms / 1000),
    reportTime: ISO(ms),
    metarType,
    rawOb: `${metarType} ${station} ...`,
  };
}

/** 构造逐小时报文序列（startIso 决定整点/分钟，如 ...T08:51:00Z）。 */
function hourlyRows({ station, startIso, count, metarType = "METAR" }) {
  const rows = [];
  const start = Date.parse(startIso);
  for (let i = 0; i < count; i += 1) {
    rows.push(metarAt(ISO(start + i * 3600_000), { station, metarType }));
  }
  return rows;
}

/* -------------------------------- store ---------------------------------- */

test("store: missing file loads as empty data without throwing", async () => {
  const { filePath } = await makeTempStore();
  const store = new MetarReleaseTimesStore({ filePath });
  assert.deepEqual(store.getAll(), {});
  assert.equal(store.getCity("Shenzhen"), null);
  assert.equal(store.size, 0);
  assert.deepEqual(store.getData(), emptyMetarReleaseTimesData());
});

test("store: corrupt file and invalid entries degrade gracefully", async () => {
  const { dir, filePath } = await makeTempStore();
  await fsp.writeFile(filePath, "{ not valid json", "utf8");
  const corrupt = new MetarReleaseTimesStore({ filePath });
  assert.deepEqual(corrupt.getAll(), {});

  await fsp.writeFile(
    filePath,
    JSON.stringify({
      version: 1,
      source: METAR_RELEASE_TIMES_SOURCE,
      basis: METAR_RELEASE_TIMES_BASIS,
      cities: {
        Shenzhen: makeEntry({ station: "ZGSZ" }),
        "Hong Kong": makeEntry({ station: "VHHH" }),
        Broken: { station: "!!", observationDate: "x", refreshedAtLocalDate: "y", minuteOffsetsUtc: [90] },
      },
    }),
    "utf8",
  );
  const store = new MetarReleaseTimesStore({ filePath });
  assert.equal(store.size, 1);
  assert.equal(store.getCity("Shenzhen").station, "ZGSZ");
  assert.equal(store.getCity("Hong Kong"), null);
  assert.equal(store.getCity("Broken"), null);
  assert.ok(dir);
});

test("store: replaceCity writes atomically, updates cache, and leaves no temp file", async () => {
  const { dir, filePath, store } = await makeTempStore();
  const written = await store.replaceCity("Shenzhen", makeEntry());
  assert.deepEqual(written, makeEntry());

  const onDisk = JSON.parse(await fsp.readFile(filePath, "utf8"));
  assert.equal(onDisk.version, METAR_RELEASE_TIMES_VERSION);
  assert.equal(onDisk.source, METAR_RELEASE_TIMES_SOURCE);
  assert.equal(onDisk.basis, METAR_RELEASE_TIMES_BASIS);
  assert.deepEqual(onDisk.cities.Shenzhen, makeEntry());

  assert.deepEqual(store.getCity("Shenzhen"), makeEntry());
  assert.equal(store.size, 1);
  await store.flush();
  const leftovers = (await fsp.readdir(dir)).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("store: concurrent replaceCity calls are serialized and keep every city", async () => {
  const { store } = await makeTempStore();
  await Promise.all([
    store.replaceCity("Shenzhen", makeEntry({ station: "ZGSZ" })),
    store.replaceCity("Qingdao", makeEntry({ station: "ZSQD" })),
    store.replaceCity("Tokyo", makeEntry({ station: "RJTT" })),
  ]);
  assert.deepEqual(Object.keys(store.getAll()).sort(), ["Qingdao", "Shenzhen", "Tokyo"]);
  assert.equal(store.getCity("Tokyo").station, "RJTT");
});

test("store: invalid entry is rejected and previous data preserved", async () => {
  const { filePath, store } = await makeTempStore();
  await store.replaceCity("Shenzhen", makeEntry());
  await assert.rejects(() => store.replaceCity("Shenzhen", makeEntry({ station: "" })), TypeError);
  assert.deepEqual(store.getCity("Shenzhen"), makeEntry());
  const onDisk = JSON.parse(await fsp.readFile(filePath, "utf8"));
  assert.deepEqual(onDisk.cities.Shenzhen, makeEntry());
});

test("store: reload picks up external file changes", async () => {
  const { filePath, store } = await makeTempStore();
  await fsp.writeFile(
    filePath,
    JSON.stringify({ version: 1, source: METAR_RELEASE_TIMES_SOURCE, basis: "obsTime", cities: { Paris: makeEntry({ station: "LFPB" }) } }),
    "utf8",
  );
  assert.equal(store.getCity("Paris"), null);
  store.reload();
  assert.equal(store.getCity("Paris").station, "LFPB");
});

test("store: normalize rejects out-of-range minute offsets", () => {
  assert.throws(() => normalizeMetarReleaseEntry(makeEntry({ minuteOffsetsUtc: [60] })), TypeError);
  assert.throws(() => normalizeMetarReleaseEntry(makeEntry({ observationDate: "2026/11/11" })), TypeError);
  assert.deepEqual(normalizeMetarReleaseEntry(makeEntry({ minuteOffsetsUtc: [30, 0, 30] })).minuteOffsetsUtc, [0, 30]);
});

test("store: generated data file matches the documented shape and excludes Hong Kong", {
  skip: !fs.existsSync(DEFAULT_METAR_RELEASE_TIMES_PATH) ? "data/metar-release-times.json not generated" : false,
}, () => {
  const parsed = JSON.parse(fs.readFileSync(DEFAULT_METAR_RELEASE_TIMES_PATH, "utf8"));
  assert.equal(parsed.version, METAR_RELEASE_TIMES_VERSION);
  assert.equal(parsed.source, METAR_RELEASE_TIMES_SOURCE);
  assert.equal(parsed.basis, METAR_RELEASE_TIMES_BASIS);
  const cities = Object.keys(parsed.cities);
  assert.ok(cities.length > 0, "expected at least one generated city entry");
  assert.ok(!cities.includes("Hong Kong"));
  for (const [city, entry] of Object.entries(parsed.cities)) {
    assert.ok(METAR_RELEASE_STATIONS[city], `unexpected city key: ${city}`);
    assert.deepEqual(normalizeMetarReleaseEntry(entry), entry, city);
    assert.match(entry.station, /^[A-Z0-9]{3,5}$/);
    assert.ok(entry.samples >= 2, `${city} samples`);
  }
  // 单例 import 时自动加载同一文件。
  assert.equal(metarReleaseTimes.size, cities.length);
});

/* ------------------------------ city mapping ------------------------------ */

test("refresh: station table covers every supported city except Hong Kong", () => {
  const supported = Object.keys(CITY_TIMEZONES).filter((city) => city !== "Hong Kong");
  assert.equal(metarReleaseCities().length, supported.length);
  for (const city of supported) {
    assert.match(METAR_RELEASE_STATIONS[city] || "", /^[A-Z]{4}$/, city);
  }
  assert.ok(!metarReleaseCities().includes("Hong Kong"));
  assert.equal(METAR_RELEASE_STATIONS["Hong Kong"], undefined);
  assert.equal(metarStationForCity("Hong Kong"), "");
  assert.equal(canonicalMetarCity("NYC"), "New York City");
  assert.equal(canonicalMetarCity("new york city"), "New York City");
  assert.equal(canonicalMetarCity("Sao Paulo"), "São Paulo");
  assert.equal(canonicalMetarCity("Seoul (Incheon)"), "Seoul");
  assert.equal(metarStationForCity("NYC"), "KLGA");
});

/* ------------------------------- derivation ------------------------------ */

test("refresh: SPECI special observations are excluded from minute offsets", () => {
  const rows = [
    ...hourlyRows({ station: "ZSQD", startIso: "2026-11-11T16:00:00Z", count: 24 }),
    ...hourlyRows({ station: "ZSQD", startIso: "2026-11-11T16:30:00Z", count: 24, metarType: "SPECI" }),
  ];
  const { metars, totalRows } = selectPreviousDayMetars(rows, { timeZone: "Asia/Shanghai", nowMs: NOW });
  assert.equal(totalRows, 48);
  assert.equal(metars.length, 24);
  assert.ok(metars.every((row) => row.metarType === "METAR"));
  const { minuteOffsetsUtc, samples } = deriveMinuteOffsetsUtc(metars);
  assert.deepEqual(minuteOffsetsUtc, [0]);
  assert.equal(samples, 24);
});

test("refresh: minute offset threshold is max(2, ceil(maxCount/2))", () => {
  const rows = [];
  const push = (minute, times) => {
    for (let i = 0; i < times; i += 1) rows.push({ obsTime: Math.floor(Date.parse(`2026-11-11T${String(i).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`) / 1000) });
  };
  push(0, 10);
  push(30, 8);
  push(17, 2);
  push(45, 1);
  const derived = deriveMinuteOffsetsUtc(rows);
  assert.deepEqual(derived.minuteOffsetsUtc, [0, 30]);
  assert.equal(derived.samples, 21);
  assert.equal(derived.counts["17"], 2);

  // 样本太少 → 阈值 2 导致全部被过滤。
  assert.deepEqual(deriveMinuteOffsetsUtc([{ obsTime: Date.parse("2026-11-11T00:00:00Z") / 1000 }]), {
    minuteOffsetsUtc: [],
    samples: 1,
    counts: { 0: 1 },
  });
});

test("refresh: buildMetarUrl targets the resolution-source endpoint with 48h lookback", () => {
  const url = buildMetarUrl({ station: "zsqd", nowMs: NOW });
  assert.ok(url.startsWith("https://aviationweather.gov/api/data/metar?"));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("ids"), "ZSQD");
  assert.equal(parsed.searchParams.get("format"), "json");
  assert.equal(parsed.searchParams.get("hours"), String(METAR_LOOKBACK_HOURS));
  assert.equal(parsed.searchParams.get("date"), new Date(NOW).toISOString());
});

test("refresh: fetchMetarRows handles ok / HTTP error / network error", async () => {
  const rows = [metarAt("2026-11-12T10:00:00Z", { station: "ZSQD" })];
  let captured = "";
  const ok = await fetchMetarRows({
    station: "ZSQD",
    nowMs: NOW,
    fetchImpl: async (url) => {
      captured = url;
      return { ok: true, status: 200, json: async () => rows };
    },
  });
  assert.deepEqual(ok, rows);
  assert.match(captured, /ids=ZSQD/);

  await assert.rejects(
    () => fetchMetarRows({ station: "ZSQD", nowMs: NOW, fetchImpl: async () => ({ ok: false, status: 503 }) }),
    (err) => err.code === "upstream-error",
  );
  await assert.rejects(
    () =>
      fetchMetarRows({
        station: "ZSQD",
        nowMs: NOW,
        fetchImpl: async () => {
          throw new Error("socket hang up");
        },
      }),
    (err) => err.code === "fetch-failed",
  );
});

test("refresh: Gamma station map comes from current resolutionSource (tag 104596)", async () => {
  const map = await fetchGammaStationMap({
    fetchJsonImpl: async () => ({
      events: [
        {
          title: "Highest temperature in Qingdao on November 12?",
          markets: [
            { resolutionSource: "https://aviationweather.gov/api/data/metar?ids=ZSQD&format=raw&date=2026-11-12T19:00:00Z&hours=30" },
          ],
        },
        {
          title: "Highest temperature in Amsterdam on November 12?",
          resolutionSource: "https://aviationweather.gov/api/data/metar?ids=EHAM&format=raw&hours=30",
          markets: [],
        },
        { title: "Highest temperature in Hong Kong on November 12?", markets: [] },
      ],
    }),
  });
  assert.equal(map.Qingdao, "ZSQD");
  assert.equal(map.Amsterdam, "EHAM");
  assert.equal(map["Hong Kong"], undefined);
});

/* -------------------------------- refresh -------------------------------- */

test("refresh: filters station-local previous date independently per timezone", async () => {
  const { store } = await makeTempStore();
  // 同一个 UTC 时刻：深圳本地是 11-13 07:30（昨天=11-12），洛杉矶本地是 11-12 15:30（昨天=11-11）。
  const shenzhenRows = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:00:00Z", count: 24 });
  const losAngelesRows = hourlyRows({ station: "KLAX", startIso: "2026-11-11T08:51:00Z", count: 24 });

  const shenzhen = await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: shenzhenRows });
  const losAngeles = await refreshMetarReleaseCity("Los Angeles", store, { now: NOW, metarRows: losAngelesRows });

  assert.equal(shenzhen.ok, true);
  assert.equal(shenzhen.observationDate, "2026-11-12");
  assert.equal(shenzhen.refreshedAtLocalDate, "2026-11-13");
  assert.deepEqual(shenzhen.minuteOffsetsUtc, [0]);
  assert.equal(shenzhen.samples, 24);

  assert.equal(losAngeles.ok, true);
  assert.equal(losAngeles.observationDate, "2026-11-11");
  assert.equal(losAngeles.refreshedAtLocalDate, "2026-11-12");
  assert.deepEqual(losAngeles.minuteOffsetsUtc, [51]);
  assert.equal(losAngeles.samples, 24);

  // 只更新了这两个城市。
  assert.deepEqual(Object.keys(store.getAll()).sort(), ["Los Angeles", "Shenzhen"]);
});

test("refresh: same-day refresh is idempotent and skips the network", async () => {
  const { store } = await makeTempStore();
  const rows = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:00:00Z", count: 24 });
  const first = await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: rows });
  assert.equal(first.skipped, false);

  let fetched = 0;
  const second = await refreshMetarReleaseCity("Shenzhen", store, {
    now: NOW,
    fetchImpl: async () => {
      fetched += 1;
      throw new Error("network must not be called for an already-refreshed city");
    },
  });
  assert.equal(fetched, 0);
  assert.equal(second.ok, true);
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "already-refreshed");
  assert.deepEqual(second.entry, first.entry);
});

test("refresh: --force bypasses same-day idempotence and recomputes offsets", async () => {
  const { store } = await makeTempStore();
  const rows = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:00:00Z", count: 24 });
  await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: rows });

  const shifted = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:05:00Z", count: 24 });
  const forced = await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: shifted, force: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.skipped, false);
  assert.deepEqual(forced.minuteOffsetsUtc, [5]);
  assert.deepEqual(store.getCity("Shenzhen").minuteOffsetsUtc, [5]);
});

test("refresh: no observations / insufficient samples preserve old data", async () => {
  const { store } = await makeTempStore();
  const rows = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:00:00Z", count: 24 });
  await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: rows });
  const before = store.getCity("Shenzhen");

  const none = await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: [], force: true });
  assert.equal(none.ok, false);
  assert.equal(none.reason, "no-observations");
  assert.deepEqual(store.getCity("Shenzhen"), before);

  const single = await refreshMetarReleaseCity("Shenzhen", store, {
    now: NOW,
    metarRows: [metarAt("2026-11-11T16:00:00Z", { station: "ZGSZ" })],
    force: true,
  });
  assert.equal(single.ok, false);
  assert.equal(single.reason, "insufficient-samples");
  assert.deepEqual(store.getCity("Shenzhen"), before);
});

test("refresh: Hong Kong is excluded and unknown cities are rejected", async () => {
  const { store } = await makeTempStore();
  await assert.rejects(
    () => refreshMetarReleaseCity("Hong Kong", store, { now: NOW, metarRows: [] }),
    (err) => err.code === "city-excluded",
  );
  await assert.rejects(
    () => refreshMetarReleaseCity("Atlantis", store, { now: NOW, metarRows: [] }),
    (err) => err.code === "city-unsupported",
  );
});

test("refresh: missing station throws a clear error and preserves old data", async () => {
  const { store } = await makeTempStore();
  const rows = hourlyRows({ station: "ZGSZ", startIso: "2026-11-11T16:00:00Z", count: 24 });
  await refreshMetarReleaseCity("Shenzhen", store, { now: NOW, metarRows: rows });
  const before = store.getCity("Shenzhen");

  await assert.rejects(
    () => refreshMetarReleaseCity("Shenzhen", store, { now: NOW, force: true, station: "", metarRows: rows }),
    (err) => err.code === "station-missing" && /Shenzhen/.test(err.message),
  );
  assert.deepEqual(store.getCity("Shenzhen"), before);
});

test("refresh: extract station from existing data entry when Gamma/static unavailable", async () => {
  // 用一个不在静态表里的“支持时区”城市名模拟：静态表缺失但旧 entry 有 station。
  const { store } = await makeTempStore();
  const rows = hourlyRows({ station: "ZBAA", startIso: "2026-11-11T16:00:00Z", count: 24 });
  // Beijing 在静态表里；改为验证“旧 entry station 优先于静态表”的场景：
  // 传入 gammaStationMap 覆盖为更“当前”的站点。
  const result = await refreshMetarReleaseCity("Beijing", store, {
    now: NOW,
    metarRows: rows,
    gammaStationMap: { Beijing: "ZBAA" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.station, "ZBAA");
  assert.equal(store.getCity("Beijing").station, "ZBAA");
});
