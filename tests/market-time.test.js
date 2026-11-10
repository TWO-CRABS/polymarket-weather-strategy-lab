/**
 * tests/market-time.test.js
 *
 * 温度市场实际交易截止 = 城市本地观察日 24:00（次日当地 00:00），
 * Gamma endDate（观察日 12:00Z）不是真实截止；结算轮询/TTR 必须用实际截止。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { effectiveEventTradingEndMs, effectiveTradingEndMs } from "../server/data/gamma.js";

test("weather cutoff follows city-local observation-day end (DST-aware)", () => {
  const market = { endDate: "2026-11-09T12:00:00.000Z", negRisk: true, city: "Los Angeles" };
  assert.equal(new Date(effectiveTradingEndMs(market)).toISOString(), "2026-11-10T08:00:00.000Z");

  // Unknown city keeps the old UTC fallback.
  assert.equal(
    new Date(effectiveTradingEndMs({ endDate: "2026-11-09T12:00:00.000Z", negRisk: true })).toISOString(),
    "2026-11-10T00:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ ...market, city: "Shenzhen" })).toISOString(),
    "2026-11-09T16:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ ...market, city: "Tokyo" })).toISOString(),
    "2026-11-09T15:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ ...market, city: "London" })).toISOString(),
    "2026-11-10T00:00:00.000Z",
  );

  // explicit tradingCutoff wins (snapshot from discovery)
  assert.equal(
    new Date(effectiveTradingEndMs({ ...market, tradingCutoff: "2026-11-10T00:00:00.000Z" })).toISOString(),
    "2026-11-10T00:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ ...market, tradingCutoff: "2026-11-10T01:00:00.000Z" })).toISOString(),
    "2026-11-10T01:00:00.000Z",
  );
});

test("event summaries use city-local end and fall back to UTC midnight", () => {
  assert.equal(
    new Date(effectiveEventTradingEndMs({ endDate: "2026-11-08T12:00:00Z", city: "Los Angeles" })).toISOString(),
    "2026-11-09T08:00:00.000Z",
  );
  assert.equal(
    new Date(
      effectiveEventTradingEndMs({
        endDate: "2026-11-08T12:00:00Z",
        title: "Highest temperature in Los Angeles on November 8?",
      }),
    ).toISOString(),
    "2026-11-09T08:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveEventTradingEndMs({ endDate: "2026-11-08T12:00:00Z" })).toISOString(),
    "2026-11-09T00:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveEventTradingEndMs({ endDate: "2026-11-08T00:00:00Z" })).toISOString(),
    "2026-11-08T00:00:00.000Z",
  );
  assert.ok(Number.isNaN(effectiveEventTradingEndMs({})));
});

test("non-weather / non-noon endDate are not shifted", () => {  assert.equal(
    new Date(effectiveTradingEndMs({ endDate: "2026-11-09T12:00:00.000Z", negRisk: false })).toISOString(),
    "2026-11-09T12:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ endDate: "2026-11-09T00:00:00.000Z", negRisk: true })).toISOString(),
    "2026-11-09T00:00:00.000Z",
  );
  assert.ok(Number.isNaN(effectiveTradingEndMs({ endDate: "", negRisk: true })));
});
