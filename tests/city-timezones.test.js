import test from "node:test";
import assert from "node:assert/strict";

import {
  CITY_TIMEZONES,
  formatUtcOffset,
  groupCitiesByTimezone,
  offsetMinutesForTimeZone,
  timezoneForCity,
} from "../shared/cityTimezones.js";

const WINTER = new Date("2026-11-09T12:00:00Z");

test("city timezone mapping covers the current weather city list", () => {
  for (const city of ["Shenzhen", "London", "New York City", "Cape Town", "Wellington", "São Paulo", "Lucknow"]) {
    assert.equal(typeof CITY_TIMEZONES[city], "string", city);
    assert.ok(timezoneForCity(city), city);
  }
  assert.equal(timezoneForCity("NYC"), "America/New_York");
  assert.equal(timezoneForCity("Seoul (Incheon)"), "Asia/Seoul");
  assert.equal(timezoneForCity("Sao Paulo"), "America/Sao_Paulo");
  assert.equal(timezoneForCity("Unknown City"), null);
});

test("UTC offsets are DST-aware at a fixed date", () => {
  assert.equal(offsetMinutesForTimeZone("Asia/Shanghai", WINTER), 480);
  assert.equal(offsetMinutesForTimeZone("Europe/London", WINTER), 0);
  assert.equal(offsetMinutesForTimeZone("Europe/Paris", WINTER), 60);
  assert.equal(offsetMinutesForTimeZone("America/New_York", WINTER), -300);
  assert.equal(offsetMinutesForTimeZone("America/Los_Angeles", WINTER), -480);
  assert.equal(offsetMinutesForTimeZone("Africa/Johannesburg", WINTER), 120);
  assert.equal(offsetMinutesForTimeZone("America/Sao_Paulo", WINTER), -180);
  assert.equal(offsetMinutesForTimeZone("Pacific/Auckland", WINTER), 780);
  assert.equal(offsetMinutesForTimeZone("Asia/Kolkata", WINTER), 330);
  assert.equal(formatUtcOffset(480), "UTC+08:00");
  assert.equal(formatUtcOffset(-300), "UTC-05:00");
  assert.equal(formatUtcOffset(330), "UTC+05:30");
});

test("groupCitiesByTimezone groups descending by offset and keeps unknowns last", () => {
  const groups = groupCitiesByTimezone(
    [
      { name: "New York City" },
      { name: "Shenzhen" },
      { name: "London" },
      { name: "Unknown City" },
      { name: "Wellington" },
    ],
    WINTER,
  );
  assert.deepEqual(groups.map((group) => group.label), [
    "UTC+13:00",
    "UTC+08:00",
    "UTC+00:00",
    "UTC-05:00",
    "其他 / 未识别时区",
  ]);
  assert.deepEqual(groups[1].cities.map((city) => city.name), ["Shenzhen"]);
  assert.equal(groups.at(-1).offsetMinutes, null);
});
