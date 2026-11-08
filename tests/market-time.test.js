/**
 * tests/market-time.test.js
 *
 * 温度市场实际交易截止 = 观察日 24:00 UTC（次日 00:00Z），
 * Gamma endDate（观察日 12:00Z）不是真实截止；结算轮询/TTR 必须用实际截止。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { effectiveTradingEndMs } from "../server/data/gamma.js";

test("negRisk weather market cutoff = observation-day 24:00 UTC (next 00:00Z)", () => {
  const market = { endDate: "2026-11-09T12:00:00.000Z", negRisk: true };
  assert.equal(new Date(effectiveTradingEndMs(market)).toISOString(), "2026-11-10T00:00:00.000Z");

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

test("non-weather / non-noon endDate are not shifted", () => {
  assert.equal(
    new Date(effectiveTradingEndMs({ endDate: "2026-11-09T12:00:00.000Z", negRisk: false })).toISOString(),
    "2026-11-09T12:00:00.000Z",
  );
  assert.equal(
    new Date(effectiveTradingEndMs({ endDate: "2026-11-09T00:00:00.000Z", negRisk: true })).toISOString(),
    "2026-11-09T00:00:00.000Z",
  );
  assert.ok(Number.isNaN(effectiveTradingEndMs({ endDate: "", negRisk: true })));
});
