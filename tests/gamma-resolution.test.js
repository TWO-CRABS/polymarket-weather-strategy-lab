/**
 * tests/gamma-resolution.test.js
 *
 * 回归：Gamma 单市场裁决接口必须使用 /markets/{id} 路径参数。
 * 之前用 /markets?id=... 会返回 200 + []，导致 settlement 永远 pending。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { fetchMarketById } from "../server/data/gamma.js";

test("fetchMarketById uses Gamma /markets/{id} path and parses an object response", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return new Response(
      JSON.stringify({ id: "6740642", closed: true, outcomePrices: '["1", "0"]' }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const raw = await fetchMarketById("6740642");
    assert.match(calledUrl, /\/markets\/6740642$/);
    assert.equal(raw.id, "6740642");
    assert.equal(raw.closed, true);
    assert.equal(raw.outcomePrices, '["1", "0"]');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
