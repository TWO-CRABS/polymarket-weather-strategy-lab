# 07 · 前后端接口契约（Single Source of Truth）

> 本文件与 `shared/contract.js` 必须保持一致。`shared/contract.js` 是运行时事实来源（默认值、校验、费率、预设、SSE 事件名）。
> 任何字段/语义变更：先改本文件与 `shared/contract.js`，由 Lead 确认后前后端同步。

---

## 1. 通用约定

| 项目 | 约定 |
|---|---|
| Base URL | `http://127.0.0.1:8787`（同源托管前端，REST 前缀 `/api`） |
| 编码 | UTF-8，`Content-Type: application/json` |
| 时间 | 服务端内部与 API 时间戳均为 **epoch 毫秒**（number）；显示时区 `Asia/Shanghai` |
| 价格 | USDC / 股，0–1 小数（前端显示为 ¢） |
| 概率 | 0–1 小数，默认取 YES 的中间价；前端显示 `xx.x%` |
| 金额 | USDC number，4–5 位小数；金额展示保留 2 位 |
| 份额 | shares（number，可为小数） |
| ID | `strat_<base36>` / `run_<base36>` / `trd_<base36>` / `sig_<base36>` |
| 错误 | `{ "error": { "code": "INVALID_STRATEGY", "message": "…" } }` + HTTP 状态码 |
| 幂等 | `POST /api/runs` 每次创建新 run；停止接口幂等 |
| 版本 | `CONTRACT_VERSION` 见 `shared/contract.js`，`GET /api/meta` 返回 |

---

## 2. StrategyConfig（用户可组合的策略参数）

字段全量、默认值、取值范围以 `shared/contract.js` 的 `DEFAULT_STRATEGY` / `LIMITS` / `validateStrategy()` 为准。结构如下：

```jsonc
{
  "version": 1,
  "name": "均衡 · ±20%/1min 动量",
  "description": "",
  "universe": {
    "cities": [],                    // [] = 全部城市；否则城市名数组，如 ["New York","London"]
    "maxMarkets": 12,                // 1..200，容量/关注市场数上限
    "selectionMode": "per_market",   // per_market（按流动性取前 N 个）| per_event（按完整城市/日期事件整组选入）
    "minPrice": 0.02,                // YES 中间价下限
    "maxPrice": 0.98,                // YES 中间价上限
    "minLiquidityUsd": 500,
    "maxSpread": 0.03,               // 允许的最大点差（USDC）
    "minTimeToResolutionSec": 900,   // 距实际交易截止（tradingCutoff，24:00 UTC）最短时间
    "maxTimeToResolutionSec": 129600,
    "onlyAcceptingOrders": true
  },
  "signal": {
    "priceField": "mid",             // mid | last | best_bid | best_ask
    "windowSec": 60,                 // 滚动窗口
    "moveThresholdPct": 20,          // 百分比阈值
    "minAbsMove": 0.01,              // 最小绝对变动（USDC），过滤低价噪声
    "direction": "both",             // up | down | both
    "confirmationTicks": 1,          // 连续满足次数
    "cooldownSec": 300,              // 同市场冷却
    "maxSignalsPerMarket": 5,
    "requireSpreadOk": true
  },
  "execution": {
    "orderType": "market",
    "sizingMode": "fixed_stake",     // fixed_stake(USD) | pct_equity(%)
    "sizingValue": 25,
    "maxPositionUsd": 50,
    "maxPositions": 5,
    "maxPositionsPerMarket": 1,
    "fillModel": "book_walk",
    "slippageBufferBps": 0,
    "fallbackBuyEachWindow": false   // 每个观测窗口周期空仓时：买概率第 1 高 YES + 第 3 高 NO
  },
  "exit": {
    "takeProfitPct": 50,             // 相对入场价的涨幅（按费用后净收益评估）
    "stopLossPct": 30,
    "maxHoldSec": 3600,
    "holdToResolution": false,       // true = 忽略 TP/SL/超时，持有到结算
    "exitOnOppositeSignal": false
  },
  "risk": {
    "bankrollUsd": 1000,
    "maxDrawdownPct": 20,
    "dailyLossLimitUsd": 100,
    "killSwitch": true
  },
  "fees": { "model": "weather_taker", "takerFeeRate": 0.05 },
  "sim": {
    "mode": "live",                  // live | replay
    "tickIntervalMs": 1000,
    "replayLookbackMin": 60,
    "speed": 10
  }
}
```

**语义要点**
- `UP` 信号 = 买入 **YES** token；`DOWN` 信号 = 买入 **NO** token（Polymarket 二元市场等价的“做空”方式）。
- 滚动收益：`ret = (p_now / p_ref - 1) × 100`，`p_ref` = `now - windowSec` 时刻（容差内）的 `priceField` 价格；需有足够样本，否则不产生信号。
- 触发条件：`ret >= moveThresholdPct`（up）或 `ret <= -moveThresholdPct`（down），且 `|p_now - p_ref| >= minAbsMove`，且连续 `confirmationTicks` 个 tick 满足。
- 去重：同市场同方向 `cooldownSec` 内不重复触发；每市场最多 `maxSignalsPerMarket` 次。
- 下单约束（市价单）：**BUY 名义额 ≥ $1，无股数下限**；**SELL（退出）≥ 5 股**（交易所对 <5 股仓位不可卖出）。5 股是限价单规则，本系统不模拟限价单。`sizingValue`/`maxPositionUsd` 按**订单名义额**计，官方 taker 手续费从账户现金单独扣除（现金须 ≥ 名义额 + 手续费）。低于门槛记 `below_min_order` 拒单。
- 周期兜底（`execution.fallbackBuyEachWindow`，默认 false）：每满一个 `signal.windowSec` 检查一次；若当时**没有任何持仓**（买过又卖掉也算空仓），买入**概率第 1 高**选项的 YES + **概率第 3 高**选项的 NO（候选不足 3 个只做第 1 笔），按正常名义额/价格带/点差/仓位/现金/风控执行；每个周期独立触发，已有持仓的周期跳过。Trade.reason = `fallback_entry`，不产生 Signal。时间基准为行情时间（live=时钟，replay=历史时间）。
- 校验接口返回 `{valid, errors[], warnings[], normalized}`；`warnings` 用于提示“低价区间 ±20% 被费用吞噬”等退化配置，不阻止运行。

---

## 3. 实体

### 3.1 MarketSnapshot
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | Gamma market id |
| `conditionId` | string | 链上 condition id |
| `eventId` | string | Gamma event id |
| `slug` | string | 市场 slug |
| `question` | string | 例如 “Will the highest temperature in Chongqing be 14°C on November 8?” |
| `city` | string | 城市名 |
| `station` | string | 气象站 ICAO（如 ZUCK），未知为 "" |
| `bracket` | string | 括号，如 “14°C” / “12°C or below” |
| `tokens` | `{yesTokenId, noTokenId}` | CLOB token id |
| `quotes` | `{YES: Quote, NO: Quote}` | 两侧盘口 |
| `spread` | number | YES 的 `bestAsk - bestBid` |
| `impliedProbability` | number | YES mid（0–1） |
| `liquidityUsd` | number | 市场流动性 |
| `volume24hUsd` | number | 24h 成交额 |
| `tickSize` | number | 最小价格变动（0.001） |
| `minOrderShares` | number | 卖出最小份额（5；市价 BUY 无股数下限，仅 $1 名义额门槛） |
| `endDate` | string | ISO 时间（Gamma endDate；温度市场为观察日 12:00Z，**不是真实交易截止**） |
| `tradingCutoff` | string | ISO 时间；温度 negRisk 市场实际交易截止 = 观察日 24:00 UTC（次日 00:00Z），用于 ttr/结算轮询 |
| `eventStartTime` | string | ISO 时间 |
| `acceptingOrders` | boolean | 是否可接单 |
| `closed` | boolean | 是否已关闭/结算 |
| `negRisk` | boolean | 是否 negRisk 组 |
| `feeSchedule` | `{rate, exponent, takerOnly}` \| null | 官方费率参数 |
| `updatedAt` | number | 快照时间（ms） |
| `stale` | boolean | 是否超过新鲜度阈值 |

`Quote = { bid, ask, mid, last }`，均为 number（可能为 0 或 null 表示缺失）。价格上下限按市场 tick 对齐。

### 3.2 Signal
`{ id, ts, runId, marketId, city, bracket, direction: "up"|"down", outcome: "YES"|"NO", tokenId, fromPrice, toPrice, changePct, absChange, windowSec, priceField, reason }`

### 3.3 Trade
| 字段 | 说明 |
|---|---|
| `id, ts, runId, marketId, tokenId, outcome(YES/NO), side(BUY/SELL)` | 基础 |
| `shares` | 成交份额 |
| `price` | VWAP 成交价 |
| `notional` | `shares × price` |
| `fee` | 官方 taker 费（USDC） |
| `slippageCost` | `shares × |price − reference|` |
| `totalCost` | BUY: notional + fee；SELL: notional − fee |
| `cashDelta` | BUY 为负，SELL 为正 |
| `realizedPnl` | SELL 时已实现盈亏（已扣费），BUY 为 0 |
| `referenceMid?` | 可选：成交时中间价，用于点差成本归因（向后兼容，可缺省） |
| `spreadCost?` | 可选：`shares × \|参考对手价 − referenceMid\|`，点差成本（USDC，向后兼容） |
| `signalId` | 关联信号，可为 null |
| `reason` | `signal` / `take_profit` / `stop_loss` / `max_hold` / `opposite_signal` / `hold_to_resolution` / `resolution` / `manual` / `risk_kill_switch` |
| `status` | `filled` / `partial` / `rejected` |
| `rejectReason` | 见 `REJECT_REASONS`，仅 rejected |
| `bookLevels` | 消耗的档位 `[{price,size}]` |

### 3.4 Position
`{ marketId, tokenId, outcome, city, bracket, shares, avgPrice, costBasis, midPrice, marketValue, unrealizedPnl, entryTs, entryFee, estExitFee, impliedProbability }`

### 3.5 EquityPoint
`{ ts, equity, cash, positionsValue, realizedPnl, unrealizedPnl, drawdownPct }`

### 3.6 Metrics
`{ totalReturnPct, realizedPnl, unrealizedPnl, feesPaid, trades, closedTrades, winRate, avgWin, avgLoss, profitFactor, expectancy, sharpe, maxDrawdownPct, exposureUsd, turnoverUsd, feeDragPct }`

定义（详见 `docs/04-product-spec.md`）：
- `totalReturnPct = (equity − initialCapital) / initialCapital × 100`
- `winRate = 盈利平仓次数 / 平仓次数`
- `profitFactor = 总盈利 / 总亏损（绝对值）`，无亏损时为 `null`/∞ 展示为 `—`
- `feeDragPct = feesPaid / initialCapital × 100`
- `sharpe = mean(r)/std(r) × sqrt(年化周期数)`，`r` 为权益采样收益率，risk-free=0；样本不足返回 `null`
- `maxDrawdownPct = max((peak − equity)/peak) × 100`

### 3.7 RunSummary
`{ id, strategyId, strategyName, mode, status, startedAt, endedAt, initialCapital, equity, cash, positionsValue, metrics, signalsCount, marketsTracked, marketIds, pendingSettlements, settledPositions, feedStatus }`
`strategyId` 为已保存策略 id，使用内联 strategy 启动时为 `null`。
`marketIds` 为本运行实际订阅的 Gamma market id 数组（用于看板只展示该运行跟踪的市场；历史旧运行可能为 `[]`）。
`pendingSettlements` 为“市场已停止交易/已关闭、但官方裁决尚未出的持仓数”；`settledPositions` 为官方裁决已兑付的笔数。两者用于看板/历史的「待结算 / 已结算」标识；停止或服务重启后，live 运行若仍有持仓会继续轮询官方裁决并自动补记（replay 不结算）。
`status ∈ created | starting | running | paused | stopping | stopped | ended | error`
`feedStatus ∈ connecting | live | degraded | offline`

---

## 4. REST API

### 4.1 元信息 / 健康
| Method | Path | 说明 | 响应 |
|---|---|---|---|
| GET | `/api/health` | 健康检查 | `{status:"ok", now, uptimeSec, feed:{status,marketsTracked,lastUpdate,latencyMs}, runs:{active,total}}` |
| GET | `/api/meta` | 前端初始化元数据 | `{contractVersion, serverTime, cities:[...], presets:[{id,label,description,config}], feeModel:{...FEES}, limits:{...LIMITS}, priceFields, directions}` |

### 4.2 市场
| Method | Path | 参数 | 响应 |
|---|---|---|---|
| GET | `/api/markets` | `city?`, `limit?`(默认100, ≤500), `includeClosed?` | `{markets:[MarketSnapshot], count, updatedAt}` |
| GET | `/api/markets/:marketId` | — | `{market: MarketSnapshot}` |
| GET | `/api/markets/:marketId/history` | `seconds?`(默认300, ≤3600) | `{marketId, points:[{ts, mid, last, bid, ask}], windowSec}` |
| GET | `/api/events` | — | `{events:[{id,title,slug,city,date,marketCount,endDate}]}` |

### 4.3 策略
| Method | Path | 说明 | 响应 |
|---|---|---|---|
| GET | `/api/strategies` | 列表 | `{strategies:[{id,name,description,updatedAt,config}]}` |
| POST | `/api/strategies` | 新建，body=`StrategyConfig` | `201 {strategy}` |
| GET | `/api/strategies/:id` | 详情 | `{strategy}` |
| PUT | `/api/strategies/:id` | 覆盖更新 | `{strategy}` |
| DELETE | `/api/strategies/:id` | 删除 | `204` |
| POST | `/api/strategies/validate` | body=`StrategyConfig`（可部分） | `{valid, errors, warnings, normalized}` |

### 4.4 运行（核心）
| Method | Path | 说明 | 响应 |
|---|---|---|---|
| POST | `/api/runs` | 启动模拟。body: `{strategy?: StrategyConfig, strategyId?: string, mode?: "live"\|"replay", replay?: {lookbackMin?, speed?}}`；`strategy` 优先于 `strategyId` | `201 {run: RunSummary}` |
| GET | `/api/runs` | 运行列表（新→旧，最多 50） | `{runs:[RunSummary]}` |
| POST | `/api/runs/batch-delete` | 批量删除。body: `{ids:string[]}`（1–200 条）；**运行中的会先停止再删除**；未知 id 记入 `failed` 不中断整批 | `{deleted:string[], failed:[{id,reason}]}` |
| GET | `/api/runs/:id` | 运行详情（`costBreakdown` 为可选附加字段，向后兼容） | `{run: RunSummary, config: StrategyConfig, metrics: Metrics, positions:[Position], costBreakdown?: {feesPaid, spreadCost, depthSlippageCost, totalFriction}}` |
| POST | `/api/runs/:id/stop` | 停止（幂等） | `{run: RunSummary}` |
| DELETE | `/api/runs/:id` | 删除运行记录 | `204` |
| GET | `/api/runs/:id/trades` | `limit?`(默认500) `offset?` | `{trades:[Trade], total}` |
| GET | `/api/runs/:id/equity` | `limit?` | `{points:[EquityPoint], total}` |
| GET | `/api/runs/:id/signals` | `limit?` | `{signals:[Signal], total}` |
| GET | `/api/runs/:id/positions` | 当前持仓 | `{positions:[Position], positionsValue, cash, equity}` |

### 4.5 静态资源
`GET /` → `web/index.html`；`/web/*`、`/shared/*`、`/design/*` 静态文件；未知路径 404 JSON。

---

## 5. SSE：`GET /api/stream`

- `Content-Type: text/event-stream`；`Cache-Control: no-cache`；`Connection: keep-alive`；支持 `?runId=` 过滤（缺省推送全部）。
- 事件格式：`event: <name>\ndata: <json>\n\n`；15s 心跳 `: ping`。
- 事件集（与 `shared/contract.js` 的 `SSE_EVENTS` 一致）：

| 事件 | 载荷 | 说明 |
|---|---|---|
| `hello` | `{serverTime, contractVersion}` | 建连后立即发送 |
| `meta` | `{cities, presets, feeModel, marketCount}` | 可选，连上后发送 |
| `markets` | `{markets:[MarketSnapshot]}` | 启动/刷新时批量快照 |
| `market` | `{market: MarketSnapshot}` | 单市场盘口更新 |
| `signal` | `{signal: Signal}` | 信号触发 |
| `trade` | `{trade: Trade, position?: Position}` | 成交（含拒单记录） |
| `positions` | `{positions:[Position], positionsValue}` | 持仓刷新 |
| `equity` | `{point: EquityPoint, metrics: Metrics}` | 权益与指标采样 |
| `metrics` | `{metrics: Metrics}` | 指标更新 |
| `run` | `{run: RunSummary}` | 运行状态变化 |
| `feed` | `{status, lastUpdate, marketsTracked, latencyMs}` | 行情健康度 |
| `log` | `{level, message, ts}` | 服务端日志（warn/error） |
| `heartbeat` | `{ts}` | 保活 |

前端断线后指数退避（1s→2s→4s→…→30s）重连，并在重连后通过 REST 补齐当前 run 的快照。

---

## 6. 费用模型（必须计入成本）

```
fee = shares × takerFeeRate × p × (1 − p)     // p = 成交价
     round to 5 decimals (half-up)
weather: takerFeeRate = 0.05, taker-only, maker rebate 25%
```
示例（100 股）：p=0.05 → 0.2375；p=0.30 → 1.05；p=0.50 → 1.25；p=0.70 → 1.05；p=0.95 → 0.2375。
最小非零费用 0.00001 USDC；买入额外支出 fee、卖出从收入扣除 fee；结算兑付不再收费。
`docs/04-product-spec.md` 的公式与本期实现必须一致，`tests/` 覆盖精度与舍入。

---

## 7. 错误码

| code | HTTP | 说明 |
|---|---|---|
| `INVALID_STRATEGY` | 400 | 策略校验失败（附 `details: errors[]`） |
| `INVALID_BODY` | 400 | 请求体非法（空 ids、超过 200 条、非法 JSON） |
| `INVALID_MODE` | 400 | mode 非 live/replay |
| `NO_MARKETS` | 409 | 当前无可用温度市场（建议回放模式） |
| `RUN_NOT_FOUND` | 404 | run 不存在 |
| `STRATEGY_NOT_FOUND` | 404 | 策略不存在 |
| `MARKET_NOT_FOUND` | 404 | 市场不存在 |
| `UPSTREAM_ERROR` | 502 | 官方 API 连续失败且无缓存可用 |
| `RATE_LIMITED` | 429 | 上游限流（前端提示稍后重试） |
| `INTERNAL` | 500 | 未分类错误 |

---

## 8. 验收最小链路（QA 用）
1. `GET /api/health` → 200 ok。
2. `GET /api/meta` → presets 长度 3、feeModel.takerFeeRate=0.05。
3. `GET /api/markets` → 至少 1 个温度市场，含 quotes/tokens。
4. `POST /api/strategies/validate`（±20%/60s 配置）→ `valid:true` 且含退化 warning。
5. `POST /api/runs`（replay 模式，固定 fixture）→ 产生 signal/trade 或明确“无信号”，`GET /api/runs/:id` 的 metrics 与费用一致。
6. `GET /api/runs/:id/trades` 中每笔 `fee == round5(shares*0.05*price*(1-price))`。
7. `POST /api/runs/:id/stop` → status=stopped；SSE 收到 `run` 事件。
8. 前端在浏览器打开 `http://127.0.0.1:8787` 可完成：选预设 → 启动 → 实时看到成交/盈亏/概率。
