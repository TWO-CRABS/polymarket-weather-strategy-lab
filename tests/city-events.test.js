import test from "node:test";
import assert from "node:assert/strict";

import { cityEventSlug, cityEventUrl, citySlug } from "../shared/cityEvents.js";

test("city event slugs follow the Polymarket highest-temperature pattern", () => {
  assert.equal(cityEventSlug("London", "2026-11-10"), "highest-temperature-in-london-on-november-10-2026");
  assert.equal(cityEventSlug("New York City", "2026-11-10"), "highest-temperature-in-nyc-on-november-10-2026");
  assert.equal(cityEventSlug("São Paulo", "2026-11-10"), "highest-temperature-in-sao-paulo-on-november-10-2026");
  assert.equal(cityEventSlug("Cape Town", "2026-11-10"), "highest-temperature-in-cape-town-on-november-10-2026");
  assert.equal(cityEventSlug("Seoul (Incheon)", "2026-11-10"), "highest-temperature-in-seoul-on-november-10-2026");
  assert.equal(citySlug("Kuala Lumpur"), "kuala-lumpur");
  assert.equal(cityEventSlug("", "2026-11-10"), null);
  assert.equal(cityEventSlug("London", "bad-date"), null);
});

test("city event URL points at the official Polymarket event", () => {
  assert.equal(
    cityEventUrl("New York City", "2026-11-10"),
    "https://polymarket.com/zh/event/highest-temperature-in-nyc-on-november-10-2026",
  );
  assert.equal(cityEventUrl("Unknown City", "2026-11-10"), "https://polymarket.com/zh/event/highest-temperature-in-unknown-city-on-november-10-2026");
  assert.equal(cityEventUrl("London", null), null);
});
