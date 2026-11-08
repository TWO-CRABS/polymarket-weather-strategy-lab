/**
 * tests/fixtures/index.js — single import point for deterministic fixtures.
 *
 * Usage:
 *   import { MARKET_TWO_SIDED, MOMENTUM_SERIES } from "./fixtures/index.js";
 *
 * The `builders` namespace exposes the helper functions (makeQuote,
 * makeOrderBook, makeMarketSnapshot, makeTick, makeSeries, ...).
 */
export * as builders from "./builders.js";
export * as markets from "./markets.js";
export * as series from "./series.js";

export * from "./builders.js";
export * from "./markets.js";
export * from "./series.js";

export const FIXTURE_CITIES = Object.freeze(["New York", "London", "Chongqing", "Seoul"]);
