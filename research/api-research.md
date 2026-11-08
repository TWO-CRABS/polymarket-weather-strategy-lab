# Polymarket Weather-Market API Integration Research

**Verified live on 2026-11-08 (06:50–07:15 UTC) from this machine.** Every endpoint and every market-data field below was exercised with real HTTP/WebSocket calls using `curl.exe 8.13` and Node `v22.22.1`; where a behaviour comes only from the official docs (rate-limit numbers, PolyBolt connection limits, WS option defaults) it is explicitly labelled as such. Raw bodies are in `research/samples/`, and the probe scripts that produced them are in `research/scripts/`. Where the docs and the live API disagree, the live behaviour is stated and the doc claim is flagged.

Scope: city "Highest temperature in &lt;City&gt; on &lt;Date&gt;?" events — discovery, market fields, CLOB public books/prices, the market WebSocket, history, trade tape, rate limits, and the METAR/Open-Meteo reference sources. Paper-trading only; no authenticated trading calls were made or are required.

---

## 0. TL;DR (中文摘要)

1. **发现市场**：用 Gamma `tag_id=104596`（"Highest temperature"）+ 按 `endDate` 的日窗口，一次拿到当天全部 49 个城市事件（每个 11 个温度档，共 539 个市场）。`/public-search` 与 `tag_id=84`（Weather）都不可靠。
2. **不要用 Gamma 的 `bestBid/bestAsk/outcomePrices` 当作可成交价**：10/11 个档位与 CLOB 实时盘口不一致（最多差 3 个 tick）。Gamma 只用于发现与元数据，报价一律读 CLOB。
3. **`GET /price` 的 `side` 语义与官方文档相反**：`side=BUY` 返回 **best bid**，`side=SELL` 返回 **best ask**（实测 NO/YES 两侧均如此）。市价买入要用 `/book` 的 `asks` 末项或 `side=SELL`。
4. **盘口是稀疏的**：当天 539 个档位中 267 个没有任何买单；`midpoint` 会给出 0.0005 这种不可成交的"价格"，空盘口还有 `price=0/1`、`mid=0.5`、`spread=1` 等哨兵值。
5. **WS 是公开的，但字段名必须是 `assets_ids`（有 s）**；写错不报错、只是永远收不到数据。首帧是 JSON **数组**。必须每 10 秒发文本 `PING`：不发时服务器在 **60.6 秒** 以 1006 断开（实测）。`custom_feature_enabled:true` 会把**全平台**的 `new_market` 事件推给你（45 秒 135 条），不要为天气盘口打开。
6. **60 秒历史可行**：`/v2/prices-history?interval=1d&bucket_seconds=60` 返回 1,436 个点（1440 分钟窗口），最后一点 `resolution_seconds=0`；但它是 **midpoint**（与 `/midpoint` 完全一致），不是成交价，且包含 0.0005 这类不可成交点。
7. **20% 阈值在低价档位是噪声**：实测 NYC 62–63°F 一分钟最大波动 16.4%（0 次 ≥20%）；Qingdao 13°C 有 29 次 ≥20%，其中 21 次是 0.0005→0.0045 这类不足 1 美分的尾部跳动，但也有 8 次 ≥1 美分（含 0.375→0.455，+21.3%）。策略应同时用**绝对 tick 数**和最低价格门槛，否则会被尾部噪声刷屏。
8. **手续费 5% 的 `p(1-p)` 曲线**（Weather 类）：taker 费率 0.05，`fee = C × 0.05 × p × (1-p)`，等于成交名义的 **2.5%–5%**；一次 0.01→0.012 的 20% 短线，手续费会吃掉毛利的一半以上。最小下单 5 **股**（不是 5 USDC）。
9. **Data API v1 已下线**：`data-api.polymarket.com/trades` 返回 **410**；必须用 `/v2/trades?condition=...`。CLOB `/trades` 需要鉴权（401）。
10. **RTDS→PolyBolt 迁移与天气盘口无关**：PolyBolt 只有 `price.crypto` / `price.crypto.twap` / `price.equity`；天气 CLOB 盘口仍走 `wss://ws-subscriptions-clob.polymarket.com/ws/market`，RTDS 仅保留 `activity`。

---

## 1. Discovery — listing active city temperature events and brackets

### 1.1 Data model (verified)

- One **event** = "Highest temperature in Qingdao on November 8?" (`eventDate: "2026-11-08"`), containing **11 markets** (bracket outcomes).
- One **market** = one bracket, e.g. `"13°C"`, with binary outcomes `["Yes","No"]` and two CLOB token ids.
- All 11 markets belong to one **negative-risk group**: `negRisk: true` on the event and on every market, one shared `negRiskMarketID`, and `groupItemThreshold` `"0"…"10"` (string) giving the bracket index. Negative risk is a conversion/capital-efficiency mechanism, **not** a merged book: each bracket still has its own YES and NO order book (verified by reading several brackets). Exactly one bracket resolves YES.
- Event-level volume/liquidity are numbers; market-level `volume`/`liquidity` are **strings** (plus numeric `volumeNum`/`liquidityNum`).

### 1.2 Tag ids (verified) — use `104596`

| Tag | id | Verdict |
|---|---|---|
| `weather` | **84** | Too broad: includes earthquakes, rain, etc. `events/keyset?tag_id=84` mixed "What will the biggest earthquake…" with temperature events. Do not use for enumeration. |
| `daily-temperature` | **103040** | Mixes **highest and lowest** temperature events (verified: returned `lowest-temperature-in-…`). Usable only with a title filter. |
| `highest-temperature` | **104596** | **Correct tag.** 100 % of returned events matched `^Highest temperature in `. Use this. |

```bash
curl.exe -s "https://gamma-api.polymarket.com/tags/slug/highest-temperature"
# {"$schema":".../Tag.json","id":"104596","label":"Highest temperature","slug":"highest-temperature",...}
```
Saved: `samples/tags-highest-temperature.json`, `tags-daily-temperature.json`, `tags-weather.json`.

### 1.3 THE working command for today (verified, 49 events)

```bash
curl.exe -s "https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&end_date_min=2026-11-08T00:00:00Z&end_date_max=2026-11-08T23:59:59Z&order=endDate&ascending=false&limit=100"
```

Result on 2026-11-08: **49 events**, `next_cursor` absent, every event has 11 markets → **539 markets**, 38 cities in °C and 11 in °F, ticks `{0.001, 0.01}`, 267/539 markets with no bid. Saved: `samples/events-today-summary.json` (derived, all 49×11) and `samples/events-keyset-today-limit2.json` (raw, 2 events).

Dynamic PowerShell version (note `curl.exe`, not the `curl` alias):

```powershell
$d = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
curl.exe -s "https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&end_date_min=${d}T00:00:00Z&end_date_max=${d}T23:59:59Z&order=endDate&ascending=false&limit=100"
```

> **Date caveat:** `<date>` is the **observation date** (`eventDate`), i.e. the city's *local* calendar date, not necessarily the UTC date. Between ~16:00–24:00 UTC, Asian cities are already on the next local day; between ~00:00–05:00 UTC, US cities are still on the previous local day. A UTC "today" therefore misses cities at the edges. Safest: request the three windows `today-1`, `today`, `today+1` (three cheap calls, each ≤100 events) and select by `eventDate` per city; or compute the local date per city with its IANA zone.

Upcoming days: loop the same query per date (`endDate` of every weather event is `<date>T12:00:00Z`). A single multi-day window **cannot** be trusted: `limit` is capped at **100** (tested `limit=500` → 100 rows) and the default id-order is not date-ordered, so a 3-day window truncates today's rows. Verified: `end_date_min=2026-11-08` without `end_date_max` returned 100 rows covering Nov 10 (33), Nov 9 (49), and only 18 of Nov 8 — the remaining 31 Nov 8 events were behind `next_cursor`.

```bash
# pagination: next_cursor -> after_cursor (verified: 10 + 10 rows, zero overlap)
curl.exe -s "https://gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false&end_date_min=2026-11-08T00:00:00Z&end_date_max=2026-11-09T23:59:59Z&order=endDate&ascending=false&limit=10"
curl.exe -s "https://gamma-api.polymarket.com/events/keyset?...&after_cursor=<next_cursor>"
```

Keyset pagination contract (verified): response `{ "$schema", "events": [...], "next_cursor": string|null }`; pass `next_cursor` back as **`after_cursor`**; page size max 100; `order=endDate&ascending=false` works on both `/events/keyset` and `/markets/keyset` (tested; without it rows come back in id order, oldest first).

### 1.4 Node discovery snippet (copy-paste)

```js
const GAMMA = "https://gamma-api.polymarket.com";
const TAG_HIGHEST_TEMP = "104596"; // verified

async function listHighestTempEvents(date /* "YYYY-MM-DD" */) {
  const events = [];
  let cursor = null;
  do {
    const u = new URL(`${GAMMA}/events/keyset`);
    u.searchParams.set("tag_id", TAG_HIGHEST_TEMP);
    u.searchParams.set("closed", "false");
    u.searchParams.set("end_date_min", `${date}T00:00:00Z`);
    u.searchParams.set("end_date_max", `${date}T23:59:59Z`);
    u.searchParams.set("order", "endDate");
    u.searchParams.set("ascending", "false");
    u.searchParams.set("limit", "100");
    if (cursor) u.searchParams.set("after_cursor", cursor);

    const res = await fetch(u, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`gamma ${res.status}`);
    const page = await res.json();
    events.push(...page.events);
    cursor = page.next_cursor ?? null;
  } while (cursor);

  // hard filters: live weather events only
  return events.filter(
    (e) =>
      /^Highest temperature in /.test(e.title) &&        // excludes lowest / polyv2 variants
      !e.slug.startsWith("polyv2-") &&
      e.eventDate === date &&
      Array.isArray(e.markets) &&
      e.markets.length > 0 &&
      e.markets.every((m) => m.acceptingOrders !== false) &&
      e.markets.some((m) => m.clobTokenIds)              // stale/unfunded events have none
  );
}

function normalizeMarket(m) {
  const tokens = JSON.parse(m.clobTokenIds);      // JSON-encoded string!
  const prices = JSON.parse(m.outcomePrices);     // JSON-encoded string!
  const labels = JSON.parse(m.outcomes);          // ["Yes","No"]
  return {
    marketId: m.id,
    conditionId: m.conditionId,
    question: m.question,
    bracket: m.groupItemTitle,                    // "13°C", "62-63°F", "19°C or higher"
    bracketIndex: Number(m.groupItemThreshold),   // "0".."10"
    yesTokenId: tokens[0],                        // index-aligned with labels[0] === "Yes"
    noTokenId: tokens[1],
    yesMid: Number(prices[0]),
    noMid: Number(prices[1]),
    tick: m.orderPriceMinTickSize,                // 0.001 | 0.01
    minShares: m.orderMinSize,                    // 5
    negRisk: m.negRisk,
    feesEnabled: m.feesEnabled,
    feeRate: m.feeSchedule?.rate,                 // 0.05 for weather
    endDate: m.endDate,
    eventStartTime: m.eventStartTime,
    resolutionSource: m.resolutionSource,
    acceptingOrders: m.acceptingOrders,
  };
}
```

### 1.5 `public-search` — works, but not for enumeration

```bash
curl.exe -s "https://gamma-api.polymarket.com/public-search?q=highest%20temperature&limit_per_type=3&events_status=active"
```
Verified shape: `{ events: [...], pagination: { hasMore: true, totalResults: 194 } }`. (The docs also describe `tags` and `profiles` arrays, but every live call — filtered and unfiltered — returned only `events` + `pagination`; empty arrays were omitted rather than sent.) It is relevance-ranked, **not date-sorted**, silently caps events per request, and returned 194 results for a query that has thousands of matching events. Good for a search box; unusable as the source of truth. Sample: `samples/public-search-params.json` (88 KB because each hit embeds a full event).

### 1.6 Series — exists, but noisy

Every city has a daily series, e.g. `qingdao-daily-weather` → id **11590**; `nyc-daily-weather` → id **10005**.

```bash
curl.exe -s "https://gamma-api.polymarket.com/series?slug=qingdao-daily-weather"
curl.exe -s "https://gamma-api.polymarket.com/events/keyset?series_id=11590&closed=false&limit=100"
```
Verified `series[0]` shape includes `id`, `ticker`, `slug`, `title`, `seriesType: "single"`, `recurrence: "daily"`, `active`, `closed`, `volume24hr`, `volume`, `liquidity`, and an **`events` array** — 11 events for Qingdao (Oct 31–Nov 10), 20 for NYC (inflated by four `polyv2-*` variants and old 2025 entries). `events/keyset?series_id=` returned only 3 rows (Nov 8/9/10) with no cursor. For NYC the series `events` array mixed the live legacy event with the polyv2 variants, so series is **not** a clean discovery path. It is still useful as a city→series mapping and for a per-city "next N days" view after filtering by `eventDate`/`slug`.

### 1.7 Direct event slug (deterministic, fragile)

```bash
curl.exe -s "https://gamma-api.polymarket.com/events/slug/highest-temperature-in-qingdao-on-november-9-2026"
```
Verified 200 with 11 markets. Slug pattern: `highest-temperature-in-<city>-on-<month>-<day>-<year>` where `<city>` is the Polymarket slug fragment (`nyc`, `qingdao`, `seoul-incheon`, `panama-city`, `mexico-city`, `sao-paulo`, `cape-town`, `kuala-lumpur`, `tel-aviv`, `hong-kong`, …). Some city names are not mechanical ("Seoul (Incheon)"), so treat the slug as a convenience/fallback, never as the primary key. Errors verified: unknown slug → **404** `{"type":"not found error","error":"slug not found"}`; invalid id → **422**.

### 1.8 Event object shape (verified, trimmed)

```json
{
  "$schema": "https://gamma-api.polymarket.com/schemas/Event.json",
  "id": "1323624",
  "ticker": "highest-temperature-in-qingdao-on-november-8-2026",
  "slug": "highest-temperature-in-qingdao-on-november-8-2026",
  "title": "Highest temperature in Qingdao on November 8?",
  "resolutionSource": "https://aviationweather.gov/api/data/metar?ids=ZSQD&format=raw&date=2026-11-08T19:00:00Z&hours=30",
  "startDate": "2026-11-06T05:58:56Z",
  "endDate": "2026-11-08T12:00:00Z",
  "active": true, "closed": false, "archived": false,
  "liquidity": 50053.13929, "volume": 38798.338840000004,
  "negRisk": true,
  "negRiskMarketID": "0x0c79f2293d65fd644bef530c57a4b8d5995162c629f6c4a5f2ffa81cf668ee00",
  "series": [{ "id": "11590", "slug": "qingdao-daily-weather", "recurrence": "daily", "seriesType": "single" }],
  "tags": [{ "id": "84", "slug": "weather" }, { "id": "103040", "slug": "daily-temperature" },
           { "id": "104596", "slug": "highest-temperature" }, { "id": "104768", "slug": "qingdao" }],
  "enableNegRisk": true,
  "eventDate": "2026-11-08",
  "startTime": "2026-11-06T05:58:34.54Z",
  "seriesSlug": "qingdao-daily-weather",
  "negRiskAugmented": false,
  "version": "v1",
  "markets": [ /* 11 market objects, see §2 */ ]
}
```
Full sample: `samples/event-level-fields.json` (event without `markets`), `samples/event-slug.json` (raw, with 11 markets).

### 1.9 Duplicate / stale events — the two traps

**(a) `polyv2-*` duplicates.** NYC on Nov 8 has **five** event variants in the same series:
`highest-temperature-in-nyc-on-november-8-2026` (legacy, live) plus `polyv2-highest-temperature-in-…`, `…-thresholds-…`, `…-atomic-…`, `…-buckets-…`. The polyv2 variants are **not trading**: all 11 markets in the inspected variant had `bestAsk: 1`, no `volume`, `outcomePrices ["0.5","0.5"]`, tick `0.01`, and the first market had `funded: false`; CLOB returned an **empty book** (`bids:[], asks:[], last_trade_price:""`). Their `clobTokenIds` equal their `positionIds` (both populated), so presence of `positionIds` is not a v2 filter — filter on `version === "v1"`, `slug` not starting with `polyv2-`, or `volume > 0`.

**(b) `closed=false` does not mean tradable.** `events/keyset?tag_id=103040&closed=false&limit=5` returned May-2026 events (`highest-temperature-in-jinan-on-may-20-2026`, `endDate 2026-05-20`, `closed:false`) whose markets have **empty `conditionId` and no `clobTokenIds`** — never deployed. Filtering by the date window (`end_date_min`/`end_date_max`) plus `clobTokenIds` non-null plus `acceptingOrders !== false` removes them.

---

## 2. Market fields for weather brackets

One real market, verbatim: `samples/market-weather-full.json`. Key fields and **actual JSON types**:

| Field | Type (JSON) | Example | Notes |
|---|---|---|---|
| `id` | string | `"6741012"` | Gamma market id |
| `conditionId` | string `0x…64` | `"0xdb632c06…"` | used by `/v2/trades`, `/v2/tokens` |
| `question` | string | `"Will the highest temperature in Qingdao be 13°C on November 8?"` | human text |
| `slug` | string | `"highest-temperature-in-qingdao-on-november-8-2026-13c"` | market slug |
| `groupItemTitle` | string | `"13°C"` / `"62-63°F"` / `"19°C or higher"` | **the bracket label**; not numeric |
| `groupItemThreshold` | string | `"4"` | bracket index `"0"…"10"` |
| `outcomes` | **JSON-encoded string** | `"[\"Yes\", \"No\"]"` | note the space after the comma; `JSON.parse` |
| `outcomePrices` | **JSON-encoded string** | `"[\"0.0005\", \"0.9995\"]"` | decimal **strings**; midpoint-ish display price, **not executable** |
| `clobTokenIds` | **JSON-encoded string** | `"[\"321286…79797\", \"474656…35934\"]"` | `[Yes, No]` order (verified against `/v2/tokens` `outcome_index` 0/1) |
| `bestBid` | number, **often absent** | `0.26` | omitted entirely when there is no bid; do not assume `null` |
| `bestAsk` | number, often present | `0.001` | |
| `spread` | number | `0.001` | ask − bid, using 0 for missing bid |
| `lastTradePrice` | number, often absent | `0.009` | can be stale; survives after close in Gamma |
| `orderPriceMinTickSize` | number | `0.001` or `0.01` | **per market**, both values occur inside one event; can change at runtime |
| `orderMinSize` | number | `5` | minimum **shares**, not USDC (see §9) |
| `negRisk` | boolean | `true` | every bracket here |
| `negRiskMarketID` | string | `"0x0c79…ee00"` | same for all 11 brackets |
| `endDate` | ISO string | `"2026-11-08T12:00:00Z"` | nominal day end, **not** a trading cutoff |
| `eventStartTime` | ISO string | `"2026-11-07T16:00:00Z"` | local observation-day midnight in UTC (Qingdao = 00:00 CST; NYC = 00:00 EST) |
| `acceptingOrders` | boolean | `true` | gate for the simulator |
| `volume` / `liquidity` | **string** | `"7971.144076000001"` / `"9785.96867"` | plus numeric `volumeNum` / `liquidityNum` |
| `feeType` | string | `"weather_fees"` | |
| `feesEnabled` | boolean | `true` | |
| `feeSchedule` | object | `{"exponent":1,"rate":0.05,"takerOnly":true,"rebateRate":0.25}` | **authoritative fee params** |
| `makerBaseFee` / `takerBaseFee` | number | `1000` / `1000` | legacy bps-style fields; **ignore**, they contradict `feeSchedule.rate=0.05` |
| `resolutionSource` | string (URL) | `https://aviationweather.gov/api/data/metar?ids=ZSQD&format=raw&date=2026-11-08T19:00:00Z&hours=30` | can be **empty** (Hong Kong in today's set) |
| `version` | string | `"v1"` | `v2` = polyv2, not live here |
| `closed` / `active` / `archived` | boolean | `false` / `true` / `false` | |

Event-level vs market-level (verified with `events/keyset` vs `/events/slug/<slug>`):

- Event: `id`, `slug`, `title`, `eventDate`, `endDate`, `startTime`, `negRisk`, `negRiskMarketID`, `series`, `tags`, `volume`/`liquidity` **numbers**.
- Market: `conditionId`, `clobTokenIds`, `outcomes`, `outcomePrices`, `bestBid`/`bestAsk`/`spread`/`lastTradePrice`, tick/min-size, `feeSchedule`, `eventStartTime`.
- `events/keyset` nested markets contain `clobTokenIds` for **live** events (verified) but omit them for stale/unfunded events. `/markets/keyset` returns markets directly (with `clobTokenIds`, `negRiskMarketID`, `feesEnabled`, fees, BBO, and an `events` back-reference) and also supports `tag_id`, date window, `order`, and `after_cursor`:
  ```bash
  curl.exe -s "https://gamma-api.polymarket.com/markets/keyset?tag_id=104596&closed=false&end_date_min=2026-11-08T00:00:00Z&end_date_max=2026-11-08T23:59:59Z&order=endDate&ascending=false&limit=100"
  ```
  Sample: `samples/markets-highest-window.json`.

Bracket structure today: **11 markets per event**, 1 °C steps for metric cities (`"9°C or below"`, `"10°C"`, … `"19°C or higher"`), 2 °F steps for US cities (`"51°F or below"`, `"52-53°F"`, … `"70°F or higher"`). 38 °C events and 11 °F events on 2026-11-08. Bracket labels are localized units — never parse them as Celsius.

---

## 3. CLOB public reads (no auth)

### 3.0 Environment caveat — `curl.exe` cannot reach the CLOB from this host

On this Windows box `curl.exe` 8.13 (Schannel) fails the TLS handshake **only for `clob.polymarket.com`**:

```
curl: (35) schannel: failed to receive handshake, SSL/TLS connection failed
```
Reproduced with `--tlsv1.2`, `--tlsv1.3`, `--tls-max 1.2`, `--ssl-no-revoke`, `-4`; `gamma-api.polymarket.com`, `data-api.polymarket.com` and `aviationweather.gov` all work via the same `curl.exe`. Node 22 `fetch` (OpenSSL/undici) works for the CLOB, so **every CLOB result below was produced with Node `fetch`**, and the `curl.exe` snippets are provided for normal environments. Use the Node snippets if you are on this machine (or a Git-for-Windows/OpenSSL `curl`).

```bash
# works from this host (Gamma / data-api / METAR)
curl.exe -s "https://gamma-api.polymarket.com/tags/slug/weather"
curl.exe -s "https://data-api.polymarket.com/v2/status"
```

All CLOB calls below returned **200 without any API-key headers** (fresh Node fetch, no cookies). CLOB requires no auth for market data. Base: `https://clob.polymarket.com`.

### 3.1 `GET /book?token_id=<token>`

```bash
curl.exe -s "https://clob.polymarket.com/book?token_id=39041798960195011479451440838091616993544734051864111077768085622126502863894"
```

```js
// Node equivalent (required on this host, see §3.0); reusable for every CLOB GET below
const clob = (path) => fetch(`https://clob.polymarket.com${path}`, { headers: { accept: "application/json" } }).then((r) => r.json());
const book = await clob(`/book?token_id=${tokenId}`);
```

```json
{
  "market": "0x8a477ebea46bb4caa782295e0014a6ce6074dc64465d6f4a554a9851f21b7d67",
  "asset_id": "39041798960195011479451440838091616993544734051864111077768085622126502863894",
  "timestamp": "1794120829913",
  "hash": "5d867bb709df3dd2579b314ce6f67a69f1047814",
  "bids": [{ "price": "0.01", "size": "84.3" }, { "price": "0.24", "size": "61611.66" }, { "price": "0.26", "size": "80.4" }],
  "asks": [{ "price": "0.99", "size": "673.29" }, { "price": "0.47", "size": "24.8" }, { "price": "0.30", "size": "46.7" }],
  "min_order_size": "5",
  "tick_size": "0.01",
  "neg_risk": true,
  "last_trade_price": "0.250"
}
```

- `bids` ascending by price → **best bid = `bids.at(-1)`**; `asks` descending → **best ask = `asks.at(-1)`**. Verified on both YES and NO tokens.
- `price`/`size` are **strings**; `timestamp` is a **string of epoch milliseconds**; prices use the market tick precision (`0.001` or `0.01`).
- `hash` changes with book state (use it to skip recomputation in a poller).
- `last_trade_price` can be `""` (never traded) and can survive as `"0.090"` while the book is empty/one-sided.
- v2 books add `"version": "v2"`.
- Errors: `token_id` missing → **400** `{"error":"Invalid token id"}`; unknown token → **404** `{"error":"No orderbook exists for the requested token id"}` (also the response after a market resolves).

### 3.2 `POST /books` (batch, public, max 500)

```bash
curl.exe -s -X POST "https://clob.polymarket.com/books" -H "Content-Type: application/json" --data '[{"token_id":"<T1>"},{"token_id":"<T2>"}]'
```
```js
const books = await fetch("https://clob.polymarket.com/books", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(tokenIds.map((token_id) => ({ token_id }))),
}).then((r) => r.json());
const byAsset = new Map(books.map((b) => [b.asset_id, b])); // response order is NOT the request order
```
- **Public** — verified 200 with no auth. Docs' 500-item cap is not contradicted by anything observed.
- Response is a JSON **array of book objects** in an **unspecified order** (verified `orderMatches=false` for 11 tokens) → map by `asset_id`.
- Unknown token ids are **silently dropped** (`[{"token_id":"1"}]` → `[]`); items missing `token_id` are ignored.
- `GET /books` → **400** `{"error":"Invalid payload"}`.
- Latency measured from this host: **257–698 ms** for 11 tokens, response ~22 KB.

### 3.3 `GET /price?token_id=<token>&side=BUY|SELL`

```json
{ "price": "0.26" }   // side=BUY
{ "price": "0.30" }   // side=SELL
```
**Verified semantics (contradicts docs):** `side=BUY` returns the **best bid**, `side=SELL` returns the **best ask**. Cross-checked against `/book` on a two-sided book (`bids` best `0.26`, `asks` best `0.30`) and on the NO token (`0.71` / `0.73`). Side is case-insensitive (`buy`, `Buy`, `BUY` all 200). Missing/invalid side → **400** `{"error":"Invalid side"}`. If there is no bid, `side=BUY` returns **`{"price":"0"}`**; if there is no ask, `side=SELL` returns **`{"price":"1"}`** — sentinels, not prices.

> Practical rule for the simulator: a **market buy** costs the lowest ask (`book.asks.at(-1)`, or `/price?side=SELL`); a **market sell** receives the highest bid (`book.bids.at(-1)`, or `/price?side=BUY`). Never use `side=BUY` as "price to buy".

### 3.4 `POST /prices` (batch)

```bash
curl.exe -s -X POST "https://clob.polymarket.com/prices" -H "Content-Type: application/json" --data '[{"token_id":"<T>","side":"BUY"},{"token_id":"<T>","side":"SELL"}]'
```
```json
{ "39041798960195011479451440838091616993544734051864111077768085622126502863894": { "BUY": "0.26", "SELL": "0.30" } }
```
Values are **strings** (the docs example shows numbers — live returns strings). Max 500 items.

### 3.5 `GET /midpoint`, `POST /midpoints`

```json
{ "mid": "0.28" }
{ "3904…894": "0.28", "1063…056": "0.5" }
```
`mid = (bestBid + bestAsk) / 2`, using **0** for a missing bid. Empty book → **`"0.5"`**; one-sided (no bid, ask `0.001`) → **`"0.0005"`**. This is why many no-bid brackets show `outcomePrices: ["0.0005","0.9995"]` (all of those with `bestAsk 0.001`); a no-bid bracket with a higher ask shows a correspondingly higher midpoint.

### 3.6 `GET /spread`, `POST /spreads`

```json
{ "spread": "0.04" }
{ "3904…894": "0.04" }
```
Empty book → **`"1"`** (ask 1 − bid 0); one-sided → ask − 0.

### 3.7 `GET /last-trade-price`, `POST /last-trades-prices`

```json
{ "price": "0.27", "side": "BUY" }
```
`side` is the taker side of the last fill. Never-traded token → **`{"price":"0.5","side":""}`** (a placeholder, not a trade). Batch returns only tokens that have traded, as an array with `token_id`:
```json
[{ "price":"0.009", "side":"BUY", "token_id":"32128651339227986179394223933165322263117899155965245915826868410059996579797" }]
```

### 3.8 Other verified public endpoints

| Endpoint | Result |
|---|---|
| `GET /tick-size?token_id=` | `{"minimum_tick_size":0.01}` (number) |
| `GET /neg-risk?token_id=` | `{"neg_risk":true}` |
| `GET /time` | server epoch ms (string) |
| `GET /markets`, `GET /sampling-markets` | public market metadata pages |
| `GET /trades`, `GET /data/trades` | **401** `{"error":"Unauthorized/Invalid api key"}` — not public |

Empty/one-sided summary (verified):

| Situation | `/book` | `/price BUY` | `/price SELL` | `/midpoint` | `/spread` | `/last-trade-price` |
|---|---|---|---|---|---|---|
| empty book | `bids:[],asks:[],last_trade_price:""` (200) | `0` | `1` | `0.5` | `1` | `0.5` + `side:""` |
| bids empty, ask 0.001 | `bids:[]` | `0` | `0.001` | `0.0005` | `0.001` | last real trade or placeholder |
| resolved market | **404** | **404** | **404** | 404 | 404 | `0.5` + `""` |

---

## 4. Realtime — CLOB market WebSocket

URL: **`wss://ws-subscriptions-clob.polymarket.com/ws/market`** — public, no auth headers, no `Origin` requirement (verified with Node 22's built-in `WebSocket`).

### 4.1 Subscription frame (exact, verified)

```json
{ "assets_ids": ["<token-id>", "<token-id>"], "type": "market" }
```

- The key is **`assets_ids`** (with `s`). Sending `{"asset_ids":[…]}` (no `s`) is accepted silently and **delivers nothing** — verified 6 s with zero frames. This is the single easiest way to break the integration.
- Optional (defaults from the AsyncAPI spec, not exercised): `"initial_dump": true`, `"level": 1|2|3` (default 2), `"custom_feature_enabled": false`.
- Dynamic updates: `{"operation":"subscribe","assets_ids":[…]}` / `{"operation":"unsubscribe","assets_ids":[…]}` (verified: subscribing 19 additional tokens produced the extra book snapshots).
- Invalid JSON → close **1008** `"invalid subscription payload"`. Unknown token id → **`[]`** (empty array message), connection stays open.

### 4.2 Message framing (important)

The **first** message after connecting and subscribing is a JSON **array** of book snapshots: `[{ "event_type":"book", … }]` (verified with a one-token initial subscribe; treat every frame as possibly-array). Later messages are single JSON objects. A client that only does `JSON.parse(data).event_type` will drop or crash on the first frame. Handle both:

```js
ws.onmessage = (ev) => {
  if (ev.data === "PONG") return;             // heartbeat reply
  const msg = JSON.parse(ev.data);
  const frames = Array.isArray(msg) ? msg : [msg];
  for (const f of frames) route(f);
};
```

Verified message types and fields:

```json
// book (also arrives as an array on subscribe)
{ "event_type":"book", "market":"0x…", "asset_id":"…", "timestamp":"1794120829913",
  "hash":"5d86…", "bids":[{"price":"0.08","size":"33343.4"}], "asks":[{"price":"0.09","size":"163939.58"}] }

// price_change: delta per level; size "0" means the level was removed
{ "event_type":"price_change", "market":"0x…", "timestamp":"1794120833071",
  "price_changes":[
    {"asset_id":"…","price":"0.25","size":"283.09","side":"BUY","hash":"cfc7…","best_bid":"0.26","best_ask":"0.3"},
    {"asset_id":"…","price":"0.75","size":"283.09","side":"SELL","hash":"4520…","best_bid":"0.7","best_ask":"0.74"}
  ] }

// last_trade_price
{ "event_type":"last_trade_price", "market":"0x…", "asset_id":"…", "price":"0.08",
  "size":"219.217767", "fee_rate_bps":"0", "side":"SELL", "timestamp":"…", "transaction_hash":"0x…" }

// tick_size_change (rare; subscribe to keep your tick in sync)
{ "event_type":"tick_size_change", "market":"0x…", "asset_id":"…",
  "old_tick_size":"0.01", "new_tick_size":"0.001", "timestamp":"…" }

// best_bid_ask (only with custom_feature_enabled: true)
{ "event_type":"best_bid_ask", "market":"0x…", "asset_id":"…",
  "best_bid":"0.08", "best_ask":"0.09", "spread":"0.01", "timestamp":"…" }
```

Notes verified on live weather books:
- A trade/mint event emits `price_changes` for **both** the YES and the NO token in one frame (we subscribed only the YES token and still received NO-token deltas). Filter by `asset_id`, don't assume one leg.
- `price_change` already carries `best_bid`/`best_ask`, so BBO can be maintained without re-reading the book.
- Prices/sizes are strings; `timestamp` is a string of epoch ms.

### 4.3 Keepalive — mandatory (measured)

- Send the **text frame `PING` every 10 s**; the server replies **`PONG`** (text). Measured round-trip: **1.7–1.9 s**.
- Without any PING, the server closed the socket at **60.6 s** with code **1006** (no close frame, no reason). So a 1-s simulator cannot rely on silence: heartbeat + watchdog reconnect are required.
- No server-initiated pings were observed.

### 4.4 `custom_feature_enabled` is a global firehose

Setting `"custom_feature_enabled": true` on the market subscription delivered **135 `new_market` frames in 45 s** — global market creations (NBA player props, etc.), **not** filtered to the subscribed assets. Per the docs it also enables `market_resolved` and `best_bid_ask` (not separately captured). Recommended: leave it `false` and poll Gamma/data-api for lifecycle, or filter aggressively.

### 4.5 Activity level for weather markets (measured)

- Quiet bracket (Qingdao 13°C, near-certain loser, no bids): in **41 s** we got **1 book snapshot + 3 `price_change`** frames (~1 update / 10 s). This is a low-activity market; a 1-s poller will see mostly unchanged books.
- A whole 11-bracket event (22 tokens, both legs) after adding all NYC Nov 8 tokens: **2,838 `price_change` frames in 45 s** (~63/s average, bursty), 20 book snapshots, 2 PONG. Many are size-only refreshes from market makers. Budget for a burst, dedupe by `hash`, and throttle UI updates.
- With 49 cities × 11 markets live, subscribing to everything is unnecessary; subscribe only the brackets your strategy is watching.

### 4.6 Reconnect behaviour

There is **no replay/resume**: `seq` does not exist on this channel and the server does not resend missed deltas. On reconnect:
1. Re-send the subscription frame (`assets_ids` + `type:"market"`) — the server sends a fresh `book` snapshot per asset (array frame).
2. Replace local books with the snapshot (don't merge an old book with new deltas).
3. Use jittered exponential backoff (e.g. 0.5 s → 30 s cap), reset the PING timer, and treat 1006 as a normal disconnect.
4. Cross-check once with REST `POST /books` after reconnect if the strategy's PnL depends on the book.

### 4.7 Is there a data-api WebSocket alternative?

**No.** The Data API is REST-only (`/v2/*`). The only WS feeds are:
- `wss://ws-subscriptions-clob.polymarket.com/ws/market` (this one — books/prices/trades for CLOB assets),
- `wss://ws-subscriptions-clob.polymarket.com/ws/user` (authenticated user channel),
- `wss://ws-live-data.polymarket.com` (RTDS: reference prices, comments, **activity**),
- `wss://ws-live-v2.polymarket.com/ws` (PolyBolt: `price.crypto`, `price.crypto.twap`, `price.equity`),
- sports WS.

So for weather book data there is exactly one streaming option, the CLOB market channel.

### 4.8 RTDS → PolyBolt migration scope

Per the docs (`migrate/rtds-to-polybolt.md`) plus the endpoint inventory: PolyBolt replaces **reference-price** subscriptions only — crypto spot (`price.crypto`), 60-second crypto TWAP (`price.crypto.twap`), and equities/ETFs/forex/metals (`price.equity`). It requires CLOB API credentials (`{"op":"auth",...}`), has per-connection limits (64 subscriptions, 20 subscribe frames/s, 64 KB frames, close codes 4001/4002/4003/4008). RTDS keeps the `activity` topic (no PolyBolt equivalent); live comments are being retired. **Nothing in that migration touches CLOB order books or the `/ws/market` channel**, and weather markets have no crypto/equity reference price. Weather integration is unaffected.

### 4.9 Minimal resilient client

```js
const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

function connectMarketWs(assetIds, onFrame) {
  let ws, pingTimer, retry = 0, closedByUs = false;

  const open = () => {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));
      pingTimer = setInterval(() => {
        if (ws.readyState === 1) ws.send("PING");
      }, 10_000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "PONG") return;
      const m = JSON.parse(ev.data);
      for (const f of Array.isArray(m) ? m : [m]) onFrame(f);
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      if (closedByUs) return;
      retry = Math.min(retry + 1, 8);
      setTimeout(open, Math.min(30_000, 500 * 2 ** retry) * (0.5 + Math.random()));
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  };

  open();
  return () => { closedByUs = true; clearInterval(pingTimer); ws?.close(); };
}
```

---

## 5. Historical prices — `/v2/prices-history`

Base: `https://data-api.polymarket.com` (v2, no auth).

```bash
curl.exe -s "https://data-api.polymarket.com/v2/prices-history?token_id=39041798960195011479451440838091616993544734051864111077768085622126502863894&interval=1d&bucket_seconds=60"
```

### 5.1 Params (verified + OpenAPI)

| Param | Values | Notes |
|---|---|---|
| `token_id` | decimal token id | required; `tokenId` alias accepted by data-api (not by CLOB) |
| `interval` | `max`, `all`, `1m`, `1w`, `1d`, `6h`, `1h` | **case-sensitive**; **`1m` = one MONTH**, not one minute |
| `bucket_seconds` | 60…86400 | 60 works for `1h`/`1d`; floors: **300 for `1w`**, **600 for `1m`/`max`/`all`** |
| `start` / `end` | epoch seconds | start inclusive, end exclusive; **max span 15 days** (16 days → 400) |
| `as_of` | epoch seconds | point-in-time read; cannot combine with window/bucket |
| `limit` / `cursor` | int / opaque | first-page size default/cap **10,000**; then `?cursor=` |

Exactly one of `interval`, `start`, `as_of` is required (omitting all → 400 `"provide a time component: …"`).

Verified interval → default resolution with no `bucket_seconds`: `1h`→60 s (58 pts), `6h`→60 s (358), `1d`→60 s (1,437), `1w`→300 s (563), `1m`→1800 s (94), `max`/`all`→43200 s (4). Invalid (`30m`, `2h`) → 400 listing the allowed set.

Errors verified: `bucket_seconds=1`/`30` → 400 `"bucket_seconds must be between 60 and 86400"`; `1w`+60 → 400 `"at least 300 for this interval"`; `1m`+60 → 400 `"at least 600"`; 16-day `start/end` → 400 `"'start' to 'end' must span at most 15 days"`. Unknown token → **200** with `data: []`.

### 5.2 Response shape (real, 1d @ 60 s)

Sample token: **NYC "62-63°F" YES** (`39041798960195011479451440838091616993544734051864111077768085622126502863894`, condition `0x8a477e…7d67`, question "Will the highest temperature in New York City be between 62-63°F on November 8?").

```json
{
  "data": [
    { "timestamp": 1794034380, "price": 0.35, "resolution_seconds": 60 },
    { "timestamp": 1794034440, "price": 0.35, "resolution_seconds": 60 },
    { "timestamp": 1794120725, "price": 0.28, "resolution_seconds": 0 }
  ],
  "pagination": { "limit": 10000, "offset": 0, "has_more": false, "next_cursor": null }
}
```
- `timestamp` = **epoch seconds** (not ms); `price` = **JSON number**; `resolution_seconds` = bucket width, **0 for the terminal exact tick**.
- Points are oldest-first. The last point is a terminal observation that can fall between bucket edges.
- **It is the midpoint, not a trade.** Verified: at the same moment `/midpoint` = `"0.28"` and `as_of` history = `0.28` (4 consecutive checks); `/last-trade-price` was `0.27` at the same time. `0.0005` points in history are no-bid midpoints, not tradable prices.
- 1 day @ 60 s returned **1,436 points** (1,439-minute span, 1,433 adjacent 60-s pairs, 2 non-uniform gaps: 120 s and 245 s). 15 days @ 60 s returned **2,750 points** with 65 non-uniform gaps (raw coverage only ~2 days for a 2-day-old market) — sparse, not an error.
- Availability: 60 s data ≥ 7 days, 300 s ≥ 60 days, 1800 s ≥ 90 days; 10800/43200 permanent. A 60 s request over an expired window returns an empty page (or a 400 for >15-day `start/end`), never a silent coarsening.

### 5.3 Replay/backtest verdict

**Yes, usable for replay and 60-s returns**, with three caveats:

1. Use `interval=1d&bucket_seconds=60` (or 1h) for dense data; forward-fill missing minutes (1,433 adjacent 60-s pairs over a 1,439-minute span). Don't assume uniform 60-s spacing — check `timestamp` deltas.
2. It is midpoint history, so it cannot tell you whether a fill was possible. For a fill-aware backtest, replay the **book** snapshots (which we do not have historically) or conservatively require `bestAsk/bestBid` from a live capture. History alone overestimates executability at the extremes.
3. Price moves are tick-quantized. Measured 60-s returns on 2026-11-08:
   - NYC 62–63°F: 1,436 points, 1,433 adjacent pairs, **0 moves ≥20%**, max +16.4% (0.275→0.32), range 0.21–0.36, 31 distinct prices.
   - Qingdao 13°C: 1,370 points, 29 moves ≥20% — 21 are sub-cent tail noise (e.g. `0.0005→0.0045` = +800%), but 8 are ≥1 cent, including `0.375→0.455` (+21.3%) and `0.225→0.175` (−22.2%) in the live bracket. A 20% rule without a price floor is dominated by tail noise, but real moves do occur; see §9.

Sample: `samples/data-prices-1d-60.json`, `samples/data-prices-1h-60.json`, `samples/data-prices-15d-60.json`, `samples/data-prices-pagination.json`, `samples/data-returns-60s-NYC-62-63F.json`.

---

## 6. Trades / tape

### 6.1 Data API v1 is gone (410)

```bash
curl.exe -s "https://data-api.polymarket.com/trades?market=0x8a47…&limit=5"
# HTTP 410 {"error":"Data API v1 has been retired","migration":"https://data-api.polymarket.com/v2/", …}
```
Verified for `/trades` with and without filters. Use v2.

### 6.2 `GET /v2/trades` (public)

```bash
curl.exe -s "https://data-api.polymarket.com/v2/trades?condition=0x8a477ebea46bb4caa782295e0014a6ce6074dc64465d6f4a554a9851f21b7d67&limit=100&taker_only=true"
```

Params (from the live OpenAPI at `https://data-api.polymarket.com/v2/openapi.json`, copied to `samples/data-openapi.json`):

| Param | Notes |
|---|---|
| `user` | proxy wallet address; omit for market/event/global feed |
| `condition` | condition id(s), comma-separated, max 20; aliases `condition_id`/`conditionId` |
| `event_id` | Gamma event id(s), comma-separated, max 20 |
| `side` | `BUY` or `SELL` |
| `taker_only` | default **true** (each fill once, taker side); `false` includes maker rows |
| `filter_type` / `filter_amount` | `CASH` or `TOKENS`; minimum size (default 0.01) |
| `limit` / `cursor` | keyset pagination, `next_cursor` |
| `start` / `end` | epoch seconds, **honored only on the `user` shape**; condition/event shapes serve a fixed 3-year window |

**There is no `token_id` filter** — a condition returns fills for both YES and NO tokens; filter rows client-side by `token_id` / `outcome_index`. Worse, an unsupported `token_id=` / `tokenId=` query param is **silently ignored** and returns the **global** feed with HTTP 200 (verified: first row belonged to an unrelated token), not a 400. Never assume the filter was applied.

Response (real):

```json
{
  "data": [{
    "proxy_wallet": "0xce0b1054a2adb61a3efe8bcd42acc8d40154b974",
    "side": "BUY", "token_id": "39041798960195011479451440838091616993544734051864111077768085622126502863894",
    "condition_id": "0x8a477ebea46bb4caa782295e0014a6ce6074dc64465d6f4a554a9851f21b7d67",
    "size": 5.0, "price": 0.27, "timestamp": 1794117520,
    "title": "Will the highest temperature in New York City be between 62-63°F on November 8?",
    "slug": "highest-temperature-in-nyc-on-november-8-2026-62-63f",
    "event_slug": "highest-temperature-in-nyc-on-november-8-2026",
    "outcome": "Yes", "outcome_index": 0,
    "name": "241532532432", "pseudonym": "Bubbly-Cope", "bio": "", "profile_image": "",
    "transaction_hash": "0x751b5101…"
  }],
  "pagination": { "limit": 100, "offset": 0, "has_more": true, "next_cursor": "eyJkYXRhIjp7…" }
}
```
`size` is **shares**, `price` is a number, `timestamp` is epoch **seconds**, `side` is from the wallet's perspective. A malformed condition → 400 `"invalid condition id: 0x1234"`.

### 6.3 CLOB `/trades` requires auth

`GET https://clob.polymarket.com/trades?token_id=…` → **401** `{"error":"Unauthorized/Invalid api key"}`. The public tape is Data API v2 (above) or the WS `last_trade_price` event. Blocks/rate limits: `/v2/trades` **300 req/10 s**; CLOB `/trades` (auth) 900/10 s.

Samples: `samples/data-trades-by-condition.json`, `data-trades-by-event.json`, `data-trades-by-user.json`, `data-trades-global.json`, `data-trades-side.json`.

---

## 7. Rate limits (documented; no rate-limit headers were returned)

Source: `docs.polymarket.com/api-reference/rate-limits.md` (Cloudflare IP-based, sliding windows; exceeding is throttled/queued, then 429 with `Retry-After`). No `ratelimit-*` headers appeared on any response.

| API | Limit |
|---|---|
| Gamma general | 4,000 req/10 s |
| Gamma `/events` | 500 req/10 s |
| Gamma `/markets` | 300 req/10 s |
| Gamma `/events`+`/markets` listing | 900 req/10 s |
| Gamma `/tags` | 200 req/10 s |
| Gamma `/public-search` | 350 req/10 s |
| CLOB general | 9,000 req/10 s |
| CLOB `/book` | 1,500 req/10 s |
| CLOB `/books` | **500 req/10 s** |
| CLOB `/price` | 1,500 req/10 s |
| CLOB `/prices` | 500 req/10 s |
| CLOB `/midpoint` | 1,500 req/10 s |
| CLOB `/midpoints` | 500 req/10 s |
| CLOB `/spread` | (market data bucket; docs list `/midpoint`, `/book`, `/price`; assume 1,500) |
| CLOB `/prices-history` | 1,000 req/10 s |
| CLOB market tick size | 200 req/10 s |
| Data API v2 general | 800 req/10 s |
| Data API `/v2/trades` | 300 req/10 s |
| Data API `/v2/prices-history` | 200 req/10 s |
| Data API `/v2/positions` | 200 req/10 s |
| Data API `/v2/status` | 100 req/10 s |

Recommended polling policy for the simulator:

| Data | Cadence | Why |
|---|---|---|
| Discovery (events/markets) | 60 s, cached | 49 events/day, static once listed |
| Top-of-book | **WS**; fallback `POST /books` 1 Hz | 1 req/s for 11 tokens is 10 req/10 s ≪ 500; measured batch latency 0.26–0.7 s |
| Per-token `/book` | only on demand | 267/539 brackets have no bid; don't poll dead books |
| Trade tape | WS `last_trade_price`, else `/v2/trades` every 5–10 s | 300/10 s |
| History backfill | 1/min live chart; 1/day full replay | 200/10 s |
| METAR | 1/5 min (hourly obs) | external API, be polite |
| Open-Meteo forecast | 1/h | external |

A 1-second loop over one event (11 tokens) is comfortably within limits; a 1-second loop over all 49 cities (539 tokens) is 49 batch requests/s = 490 req/10 s, right at the `/books` limit — split across the second or restrict to subscribed cities.

---

## 8. Weather actuals (resolution source) and forecast

### 8.1 Aviation Weather Center METAR (used by the resolution source)

The market's `resolutionSource` is e.g.
`https://aviationweather.gov/api/data/metar?ids=ZSQD&format=raw&date=2026-11-08T19:00:00Z&hours=30`.

JSON variant (verified, HTTP 200 in ~0.5 s):

```bash
curl.exe -s "https://aviationweather.gov/api/data/metar?ids=ZSQD&format=json&hours=24"
```

```json
[{
  "icaoId": "ZSQD", "receiptTime": "2026-11-08T06:00:21.000Z",
  "obsTime": "2026-11-08T06:00:00.000Z", "reportTime": "2026-11-08T06:00:00.000Z",
  "temp": 12, "dewp": 12, "wdir": 10, "wspd": 2, "visib": "4.8",
  "altim": 1030, "metarType": "METAR",
  "rawOb": "METAR ZSQD 080600Z 01002MPS 4800 -RA BR FEW027 OVC050 12/12 Q1030 NOSIG",
  "lat": 36.266, "lon": 120.374, "elev": 10, "name": "Qingdao Jiaodong Intl",
  "cover": "OVC", "clouds": [ … ], "fltCat": "MVFR"
}]
```
- `temp` is **°C as a number** (can be decimal, e.g. KLGA `10.6`).
- `reportTime`/`obsTime` are UTC ISO strings.
- The resolution rules use the **hourly temperature remark `T` group** when present (tenths of °C): regex `\bT([01])(\d{3})(\d{4})\b` → sign, temp×0.1. Example `T01060039` = +10.6 °C. `SPECI` reports are excluded.
- If there is no `T` group, use the body `temp/dewp` group, whole °C, `M` = minus: `18/12` = 18 °C, `M11/M17` = −11 °C.
- The day is defined in the **station's local time**, not UTC. Convert `reportTime` with the station's IANA zone (Asia/Shanghai for ZSQD, America/New_York for KLGA) before comparing to `eventDate`.
- `format=raw` returns the same reports as plain text (one METAR line each), which is what the resolution URL uses: `samples/metar-zsqd-raw.txt`.
- **`date` + `hours` semantics (verified):** `date` is the window **end** and `hours` is the lookback. The Qingdao resolution URL (`date=2026-11-08T19:00:00Z&hours=30`) returned 19 reports spanning `2026-11-07T13:00Z … 2026-11-08T07:00Z` at capture time (the upper bound was "now"; it grows to the anchor as observations arrive). The anchor 19:00Z = 03:00 CST next day plus a 30 h lookback covers the whole local Nov-8 day. **For settlement, call the market's `resolutionSource` URL verbatim** (only switch `format=raw` to `format=json`), then filter to the station-local `eventDate`. Sample: `samples/metar-zsqd-resolution-window.json`.
- `ids=` accepts a comma list: `?ids=ZSQD,KLGA,RJTT&format=json&hours=3` (verified, returns a combined array; no per-station grouping).
- Today's ZSQD sample: 24 reports, `temp` 12–15 °C; KLGA: 26 reports, 10.6–16.7 °C.

Samples: `metar-zsqd-json.json`, `metar-zsqd-raw.txt`, `metar-klga-json.json`, `metar-multi-json.json`.

### 8.2 Open-Meteo (optional forecast source, not a resolution source)

```bash
curl.exe -s "https://api.open-meteo.com/v1/forecast?latitude=36.27&longitude=120.37&hourly=temperature_2m&forecast_days=3&timezone=auto"
```
Verified shape: `hourly.time` (ISO local strings, 72 values for 3 days), `hourly.temperature_2m` (°C numbers), `hourly_units.temperature_2m = "°C"`, `timezone: "Asia/Shanghai"`, `utc_offset_seconds`. Qingdao sample: 13.9 / 14.1 / 13.6 … max 14.1 °C. Sample: `open-meteo-qingdao.json`. Free, no key; use it for a forecast-vs-market edge signal, not for settlement.

---

## 9. Gotchas that will break a 1-second paper-trading simulator

1. **Gamma quotes are stale.** Sampled 11 Qingdao brackets at 07:06 UTC: Gamma `bestBid/bestAsk` differed from the live CLOB book on **10/11** brackets, by up to **3 ticks** (0.003), and Gamma's `updatedAt` on those markets was 06:37–06:47 UTC (20–29 min old). Use Gamma for discovery/metadata only; price and fills from CLOB (`/books` or WS).
2. **`/price` side is inverted vs the docs.** `side=BUY` = best bid, `side=SELL` = best ask (verified). Using `BUY` to price a market buy understates cost by the spread and can flip the PnL sign on a 20% scalp.
3. **`outcomePrices` / `midpoint` / history are midpoints, not fills.** 267/539 brackets have **no bid**; those quoted at `bestAsk 0.001` therefore show `0.0005` = `(0 + 0.001)/2`. It cannot be sold at 0.0005. For a simulator: buy at `asks.at(-1)`, sell at `bids.at(-1)`; if the relevant side is empty, **no fill** (do not fill at the midpoint).
4. **Sentinel values.** `/price` returns `"0"`/`"1"` for missing sides, `/midpoint` `"0.5"`, `/spread` `"1"`, `/last-trade-price` `"0.5"` + `side ""`. Treat `price ∈ {0,1}` on `/price`, `mid == 0.5` with an empty book, and `side == ""` as "no data", not as prices.
5. **Empty books are normal, and 404 after close.** 267/539 brackets had no bid in Gamma today; the sampled CLOB books also showed empty bid sides for most of those brackets (and disagreed with Gamma on a few). After resolution `/book` → **404** and `/last-trade-price` still returns the `0.5` placeholder; `closed=true`, Gamma `outcomePrices ["0","1"]`, and data-api `/v2/tokens` `final_price` 0/1 are the settlement truth.
6. **Minimum order is 5 SHARES, not 5 USDC.** `orderMinSize: 5`; `min_order_size: "5"`; docs' market-details table says "USDC" but the order-placement docs say "minimum number of shares". At `p=0.001`, the minimum notional is **$0.005**; at `p=0.5`, **$2.50**. Do not model a $5 minimum ticket.
7. **Fee is 2.5%–5% of notional, taker-only.** `feeSchedule.rate = 0.05`, `fee = C × 0.05 × p × (1-p)`, 5-dp rounding, min 0.00001 USDC, maker rebate 0.25 of taker fee. Examples per 100 shares: at 0.50 → 1.25 USDC (2.5% of $50); at 0.01 → 0.0495 (4.95% of $1). A 0.01→0.012 scalp (+$0.20 per 100 shares) pays ≈0.0495 + 0.0593 = **0.1088 USDC**, i.e. 54% of the gross move. `makerBaseFee`/`takerBaseFee` (1000) are legacy — ignore them.
8. **Tick quantization makes "20% in 1 minute" meaningless in the tails.** At `p=0.001`, one tick is +100%; at `p=0.5` with the 0.01 tick used there, 20% is 10 ticks. Measured: NYC 62–63 had 0 ≥20% minutes; Qingdao 13°C had 29 ≥20% minutes, of which 21 were sub-cent 0.0005→0.0045 noise but 8 were ≥1 cent (incl. +21.3% at 0.375→0.455). Use absolute tick thresholds (`≥ N ticks`) **and** a minimum price (e.g. `p ≥ 0.02`) for the strategy trigger, otherwise the tails generate constant false signals.
9. **WS field name `assets_ids`** (not `asset_ids`), otherwise silent no-data. First frame is an **array**. `custom_feature_enabled:true` floods global `new_market`. `PING` every 10 s or the socket dies at ~60 s with 1006. No replay on reconnect — resubscribe and take a fresh snapshot.
10. **`closed=false` is not "tradable".** Stale May-2026 events still report `closed:false`; their markets have no `conditionId`/`clobTokenIds`. Filter by `endDate` window, `clobTokenIds` present, `acceptingOrders !== false`, and (`volume > 0` or `bestAsk < 1`) to exclude `polyv2-*` shells.
11. **Two units, two bracket widths.** 38 °C events (1 °C steps, `13°C`) and 11 °F events (2 °F steps, `62-63°F`) today. Never hardcode Celsius or a single bracket width; parse `groupItemTitle`/`question`, and prefer `groupItemThreshold` for ordering.
12. **`endDate` is not the trading cutoff.** All today's events have `endDate 2026-11-08T12:00:00Z` while books were still live at 07:00Z and, for US cities, the local day had barely started. `eventStartTime` is local midnight in UTC (Qingdao `2026-11-07T16:00Z`, NYC `2026-11-08T05:00Z`). Use `acceptingOrders`/`closed`/`resolutionStatus`, never `endDate`, to stop a strategy.
13. **`1m` means one month** in `/v2/prices-history`; bucket floors are 300 (`1w`) and 600 (`1m`/`max`), and `start/end` cannot exceed **15 days**. A 60-s request over an old window is empty by design. Also `interval` is case-sensitive.
14. **History is sparse and includes the terminal tick.** 1d@60 = 1,436 points with 2 gaps; 15d@60 = 2,750 points with 65 gaps; the last point has `resolution_seconds: 0`. Forward-fill and de-duplicate before computing returns; don't assume 1,440 points/day.
15. **Batch calls reorder.** `POST /books` does **not** preserve request order (verified), and drops unknown tokens silently. Always join by `asset_id`. Same for `/prices`, `/midpoints`, `/spreads`.
16. **Latency.** `/book` median **267 ms** (range 252–522 ms); 11-token `POST /books` **257–698 ms**; WS PONG 1.7–1.9 s. A 1-s polling loop is feasible but a tick can arrive 0.3–0.7 s late; timestamp your samples and don't compare prices from different instants. Prefer WS for trigger detection and use REST only as a reconciliation snapshot.
17. **negRisk baskets don't sum to 1.** Today's YES midpoints summed to 0.894–1.101 across cities (bid sums 0.73–1.02, ask sums 1.01–1.27). Don't infer one bracket's price from the others; each has its own book. Exactly one bracket resolves YES, so a multi-bracket position is a basket, not a hedge at mid.
18. **Tick size can change at runtime.** Both 0.001 and 0.01 occurred within the same 11-bracket event, and the CLOB emits `tick_size_change` (e.g. `0.01 → 0.001`) when price approaches the extremes. Read `orderPriceMinTickSize` per market and update on the WS event; a stored tick will eventually be rejected by the real CLOB.
19. **`resolutionSource` may be empty** (Hong Kong's Nov-8 market had `""`). Parse the description as a fallback; don't assume every weather market uses the same METAR URL.
20. **No rate-limit headers.** Limits are enforced by Cloudflare; a burst that "works" today can be queued tomorrow. Build a token bucket client-side (e.g. ≤50 `/books` req/s, ≤1 discovery req/s) and honor 429 `Retry-After`.
21. **A wrong query param can be silently ignored.** `/v2/trades?token_id=<id>` returns **HTTP 200 with the global tape** (the param is not supported and not rejected), so a filter bug looks like working data. Only `condition`, `event_id`, and `user` scope that feed; verify by checking that returned `condition_id`/`token_id` values match, and fail closed if they don't.

---

## 10. Recommended integration shape (paper trading)

```
[Gamma discovery, 60 s]
  events/keyset?tag_id=104596&closed=false&end_date_min=<date>T00:00:00Z&end_date_max=<date>T23:59:59Z&order=endDate&ascending=false&limit=100
    -> filter title/eventDate/clobTokenIds/acceptingOrders, drop polyv2
    -> event.slug + markets[].clobTokenIds (Yes/No), groupItemTitle, tick, feeSchedule

[Price/fill engine, 1 Hz or WS]
  WS subscription {assets_ids:[...], type:"market"}  (+ PING every 10 s)
    book (array first), price_change (best_bid/best_ask), last_trade_price, tick_size_change
  REST reconciliation: POST /books every 10–60 s, or on reconnect
    -> maintain per-token {bids[], asks[], hash, tick, ts}

[Strategy] 1-s candles from BBO/last trade; trigger on absolute tick move or
  mid/ask return with p floor; walk the book for VWAP fill; reject if side empty.

[Fees] fee = shares × 0.05 × p × (1-p), taker only, 5 dp, min 0.00001; min 5 shares.

[History/backtest] /v2/prices-history?token_id&interval=1d&bucket_seconds=60
  (midpoint series; forward-fill; treat as signal, not fill)

[Settlement] Gamma closed + outcomePrices 1/0, or /v2/tokens final_price;
  independent check: aviationweather METAR T-group for the station/local date.
```

---

## 11. Confirmed endpoints (all live-verified, unauth unless noted)

| # | Method + URL | Status | Notes |
|---|---|---|---|
| 1 | `GET https://gamma-api.polymarket.com/events/keyset` | 200 | `tag_id`, `closed`, `end_date_min/max`, `order`, `ascending`, `limit≤100`, `after_cursor` |
| 2 | `GET https://gamma-api.polymarket.com/events/slug/<slug>` | 200 / 404 | full event incl. `series`, `negRiskMarketID`, markets |
| 3 | `GET https://gamma-api.polymarket.com/events/<id>` | 200 / 422 | |
| 4 | `GET https://gamma-api.polymarket.com/markets/keyset` | 200 | `tag_id`, date window, order, cursor |
| 5 | `GET https://gamma-api.polymarket.com/markets/<id>` | 200 | full market |
| 6 | `GET https://gamma-api.polymarket.com/tags/slug/<slug>` | 200 / 404 | 84 / 103040 / 104596 |
| 7 | `GET https://gamma-api.polymarket.com/public-search?q=` | 200 | relevance only |
| 8 | `GET https://gamma-api.polymarket.com/series?slug=` | 200 | includes `events[]` |
| 9 | `GET https://clob.polymarket.com/book?token_id=` | 200 / 400 / 404 | |
| 10 | `POST https://clob.polymarket.com/books` | 200 (public) | ≤500, order not preserved |
| 11 | `GET https://clob.polymarket.com/price?token_id=&side=` | 200 / 400 / 404 | BUY=bid, SELL=ask |
| 12 | `POST https://clob.polymarket.com/prices` | 200 | map token→side→string |
| 13 | `GET https://clob.polymarket.com/midpoint?token_id=` | 200 | 0.5 sentinel |
| 14 | `POST https://clob.polymarket.com/midpoints` | 200 | |
| 15 | `GET https://clob.polymarket.com/spread?token_id=` | 200 | 1 sentinel |
| 16 | `POST https://clob.polymarket.com/spreads` | 200 | |
| 17 | `GET https://clob.polymarket.com/last-trade-price?token_id=` | 200 | 0.5/"" placeholder |
| 18 | `POST https://clob.polymarket.com/last-trades-prices` | 200 | omits never-traded |
| 19 | `GET https://clob.polymarket.com/tick-size?token_id=` | 200 | |
| 20 | `GET https://clob.polymarket.com/neg-risk?token_id=` | 200 | |
| 21 | `GET https://clob.polymarket.com/trades` | 401 | auth required |
| 22 | `WSS wss://ws-subscriptions-clob.polymarket.com/ws/market` | open | `assets_ids`, PING/PONG, public |
| 23 | `GET https://data-api.polymarket.com/v2/prices-history` | 200 / 400 | 60-s buckets, 15-day cap |
| 24 | `GET https://data-api.polymarket.com/v2/trades` | 200 / 400 | condition/event/user, cursor |
| 25 | `GET https://data-api.polymarket.com/v2/tokens` | 200 | token→market/outcome/final_price |
| 26 | `GET https://data-api.polymarket.com/v2/status` | 200 | data freshness |
| 27 | `GET https://data-api.polymarket.com/trades` (v1) | 410 | retired |
| 28 | `GET https://aviationweather.gov/api/data/metar?ids=&format=json (or raw)&hours=` | 200 | resolution source |
| 29 | `GET https://api.open-meteo.com/v1/forecast?...` | 200 | optional forecast |

---

## 12. Open questions / not verifiable without auth or time

1. **Max assets per WS connection / WS rate limits** are not documented; we verified 22 tokens on one connection and 19 added dynamically. Test a larger basket before relying on one socket for all 539 tokens.
2. **`custom_feature_enabled` scope** was observed to be global (`new_market` for unrelated NBA markets); whether `market_resolved` is also global (likely) needs a longer capture.
3. **Exact fee charging path** (deducted in USDC vs pUSD, and whether the simulator should add fee on BUY notional and subtract on SELL proceeds) is documented only as a formula; no authenticated order was placed. Confirm with a tiny real order if precise PnL accounting matters.
4. **negRisk conversion mechanics** (buying NO vs selling YES, capital efficiency, auto-conversion) are not modelled here; for paper trading we treat each bracket's book independently. If the simulator needs to replicate negative-risk conversions, it must be specified from the negative-risk docs and tested with a funded account.
5. **Gamma cache TTL** is not published. Measured discrepancies up to 3 ticks within seconds; the exact refresh interval (looks like tens of seconds to minutes) was not pinned down.
6. **`/book` depth cap** — the largest book observed had 72 ask levels; whether the API truncates at 100 levels is undocumented.
7. **Tag 104596 stability** for future city additions is assumed from today's 49/49 match; keep a title-regex fallback and monitor new tags.
8. **Whether `endDate`/`eventStartTime` are always local-midnight-derived** for DST transition days (e.g. US spring-forward) was not tested; `eventStartTime` matched local midnight for Qingdao and NYC today.
9. **Data API `/v2/trades` does not expose fee fields**; fee must be recomputed from the market's `feeSchedule`.
10. **No historical book snapshots** are available publicly; a fill-accurate backtest needs live capture from now on (WS or 1 Hz `/books`).

---

## 13. Sample index (`research/samples/`)

| File | What it is |
|---|---|
| `tags-weather.json`, `tags-daily-temperature.json`, `tags-highest-temperature.json` | tag id evidence (84 / 103040 / 104596) |
| `discovery-today-command.json` | the exact today query + normalized 2 events / 22 markets |
| `events-keyset-today-limit2.json` | raw `events/keyset` page for 2026-11-08 |
| `events-today-summary.json` | all 49 events × 11 markets with mids/BBO/tick/volume/unit |
| `event-slug.json`, `event-level-fields.json` | full Qingdao Nov-8 event; event-level object |
| `market-weather-full.json` | one complete bracket market (13°C) |
| `event-nyc-highest-temperature-in-nyc-on-november-8-2026.json` | 11-bracket °F event (two-sided book examples) |
| `event-nyc-polyv2-highest-temperature-in-nyc-on-november-8-2026.json` | polyv2 dead-book variant |
| `event-slug-tomorrow.json` | deterministic slug fetch (Nov 9) |
| `markets-highest-window.json` | `/markets/keyset` shape (has `clobTokenIds`, fees) |
| `series-qingdao.json` | series object with 11-event `events[]` (Oct 31–Nov 10) |
| `public-search-params.json` | search shape, `totalResults: 194` (single hit, 88 KB) |
| `gamma-keyset-pagination.json` | page-1/page-2 id overlap check |
| `gamma-vs-clob-topofbook.json` | 10/11 Gamma-vs-live mismatch table |
| `clob-book-twosided.json`, `clob-book-one-sided.json`, `clob-book-empty.json` | book shapes |
| `clob-books.json` | batch `/books` (11 tokens) |
| `clob-price-buy-twosided.json`, `clob-price-sell-twosided.json` | BUY=0.26 / SELL=0.30 proof |
| `clob-prices-twosided.json`, `clob-midpoints.json`, `clob-midpoint-twosided.json` | batch/map formats |
| `clob-spreads.json`, `clob-spread-twosided.json` | spread shapes |
| `clob-last-trade-price-twosided.json`, `clob-last-trades-prices.json` | trade price shapes |
| `clob-tick-size-twosided.json` | `{"minimum_tick_size":0.01}` |
| `clob-price-empty-buy.json`, `clob-price-empty-sell.json` | `0` / `1` sentinels |
| `clob-book-resolved-404.json` | post-resolution 404 body |
| `data-prices-1d-60.json`, `data-prices-1w-60.json`, `data-prices-1m-60.json` | history + floor errors |
| `data-prices-15d-60.json`, `data-prices-1d-300.json`, `data-prices-max-default.json` | density/range evidence |
| `data-prices-asof.json`, `data-prices-pagination.json` | point-in-time + cursor |
| `data-returns-60s-NYC-62-63F.json`, `data-returns-60s-Qingdao-13C.json` | 60-s return statistics |
| `data-trades-by-condition.json`, `data-trades-by-event.json`, `data-trades-side.json`, `data-trades-by-user.json`, `data-trades-global.json` | v2 tape |
| `data-trades-market.json` | v1 410 retirement body |
| `data-trades-token-param-ignored.json` | `?token_id=` ignored → global feed (200) |
| `data-tokens.json`, `data-tokens-condition.json` | token→market/outcome/final_price |
| `data-status.json` | `/v2/status` freshness |
| `data-openapi.json` | live Data API v2 OpenAPI (params + schemas) |
| `ws-market-probe.json` | 45-s WS summary (types/counts/assets) |
| `ws-market-frames-sample.jsonl` | first 25 raw WS frames |
| `ws-market-edge-cases.json` | no-PING, wrong key, invalid token, bad JSON |
| `metar-zsqd-json.json`, `metar-zsqd-raw.txt`, `metar-zsqd-resolution-window.json`, `metar-klga-json.json`, `metar-multi-json.json` | METAR sources + exact resolution-window call |
| `open-meteo-qingdao.json` | forecast sample |

Reproduction scripts (`research/scripts/`): `probe-discovery*.mjs`, `probe-clob*.mjs`, `probe-ws*.mjs`, `probe-dataapi*.mjs`, `probe-history.mjs`, `probe-returns.mjs`, `probe-staleness.mjs`, `probe-batch.mjs`, `probe-weather.mjs`, `probe-closed.mjs`, `probe-day.mjs`, `summarize-day.mjs`, `curate-samples.mjs`, `openapi-*.mjs`. They only read public APIs and write into `research/samples/`.

---

*End of report. All HTTP calls were made unauthenticated; nothing outside `research/` was modified.*
