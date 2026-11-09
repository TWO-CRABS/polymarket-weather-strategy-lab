/**
 * tests/ws-batches.test.js
 *
 * 多连接分批 WS 订阅：约 20 个城市一个订阅，城市内所有括号/YES-NO token 同批。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildWsBatches, WsAdapter } from "../server/data/feedWs.js";

function makeMarket(city, index = 0, suffix = "") {
  const id = `${city}-${index}${suffix}`;
  return {
    id,
    city,
    tokens: { yesTokenId: `${id}-yes`, noTokenId: `${id}-no` },
  };
}

test("buildWsBatches groups about 20 cities per connection and never drops tokens", () => {
  const markets = [];
  const tokens = new Set();
  for (let c = 0; c < 45; c += 1) {
    const city = `City-${String(c).padStart(2, "0")}`;
    markets.push(makeMarket(city));
    tokens.add(markets.at(-1).tokens.yesTokenId);
    tokens.add(markets.at(-1).tokens.noTokenId);
  }
  const batches = buildWsBatches(markets, tokens, 20);
  assert.equal(batches.length, 3);
  assert.deepEqual(batches.map((batch) => batch.cities.length), [20, 20, 5]);
  const allTokens = batches.flatMap((batch) => batch.tokens);
  assert.equal(new Set(allTokens).size, allTokens.length, "token must not be duplicated across channels");
  assert.equal(allTokens.length, 90);
});

test("all markets of one city stay in the same batch, including duplicate events", () => {
  const markets = [
    makeMarket("Amsterdam", 0, "a"),
    makeMarket("Amsterdam", 1, "b"),
    makeMarket("Berlin", 0),
  ];
  const tokens = new Set(markets.flatMap((market) => [market.tokens.yesTokenId, market.tokens.noTokenId]));
  const batches = buildWsBatches(markets, tokens, 20);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].cities, ["Amsterdam", "Berlin"]);
  assert.equal(batches[0].tokens.length, 6);
});

test("buildWsBatches only includes currently tracked tokens", () => {
  const markets = [makeMarket("London", 0), makeMarket("Paris", 0)];
  const tracked = new Set([markets[0].tokens.yesTokenId, markets[0].tokens.noTokenId]);
  const batches = buildWsBatches(markets, tracked, 20);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].tokens.sort(), [...tracked].sort());
});

test("WsAdapter opens one WS per ~20-city batch and subscribes the batch assets", async () => {
  const markets = new Map();
  const tokens = new Map();
  for (let c = 0; c < 45; c += 1) {
    const city = `City-${String(c).padStart(2, "0")}`;
    const market = makeMarket(city);
    markets.set(market.id, market);
    tokens.set(market.tokens.yesTokenId, { marketId: market.id, outcome: "YES" });
    tokens.set(market.tokens.noTokenId, { marketId: market.id, outcome: "NO" });
  }
  const feed = {
    _running: true,
    _allowWs: true,
    mode: "auto",
    markets,
    tokens,
    lastUpdate: 0,
    lastError: null,
    _wsConnected: false,
    _setStatus() {},
    _pollOnce: async () => {},
    _handleMessage() {},
    _refreshSnapshots() {},
  };
  const original = globalThis.WebSocket;
  const sockets = [];
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      sockets.push(this);
      queueMicrotask(() => this.onopen?.({}));
    }
    send(payload) {
      this.sent.push(payload);
    }
    close() {
      this.onclose?.({});
    }
  }
  globalThis.WebSocket = MockWebSocket;
  try {
    const adapter = new WsAdapter(feed, {
      url: "ws://mock",
      citiesPerConnection: 20,
      reconcileMs: 600_000,
      reconnectSchedule: [1000],
    });
    adapter.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(sockets.length, 3, "45 cities => 20 + 20 + 5 city batches");
    const subscriptions = sockets.map((socket) =>
      JSON.parse(socket.sent.find((frame) => frame !== "PING")),
    );
    assert.ok(subscriptions.every((message) => message.type === "market"));
    assert.deepEqual(
      subscriptions.map((message) => message.assets_ids.length).sort((a, b) => a - b),
      [10, 40, 40],
    );
    const allAssets = subscriptions.flatMap((message) => message.assets_ids);
    assert.equal(new Set(allAssets).size, allAssets.length);
    assert.equal(allAssets.length, 90);
    adapter.stop();
  } finally {
    globalThis.WebSocket = original;
  }
});
