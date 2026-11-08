# 02 · 温度市场策略参数分类学（可量化参数菜单）

> 版本：v1.0 ｜ Owner：策略专家 A（strategist-market）
> 定位：本文是**可测量参数的全集菜单**（策略构建器 UI 暴露什么、特征管线算什么、回放里能取到什么）。
> 本文不定义信号判定与撮合细节，那些以 `docs/03-strategy-spec.md` 为准；成本口径以 `docs/04-product-spec.md` §5 为准；实体/API 字段以 `docs/07-api-contract.md` §3 为准。三者冲突时以 `03`/`04`/`07` 为契约方，本文只提供"参数有哪些、怎么算、从哪取、合理值"。
> 命名：本文所有**新参数**一律 `snake_case`（即 `docs/03` §1.3 所说的"任务书描述性命名"层）；`docs/03` 的 camelCase 配置字段是它的契约映射（见 §9）。
> 全部字段路径已于 2026-11-08 对 Gamma / CLOB / Data API / aviationweather 实测校验，未实测的字段不写入。

---

## 0. 数据源白名单与七个字段陷阱

### 0.1 已验证的数据源与字段路径

| # | 数据源 | 端点（实测） | 可取字段 | 限制 |
|---|---|---|---|---|
| S1 | Gamma 事件枚举 | `GET gamma-api.polymarket.com/events/keyset?tag_id=104596&closed=false` | `events[].{id,slug,title,negRisk,negRiskMarketID,eventDate,startDate,endDate,volume24hr,openInterest,markets[]}`；tag `104596`="Highest temperature"（实测 146 个未关闭事件，每个 11 个括号市场）；`103040`="Daily Temperature"；`84`="Weather" | 内嵌 `markets[]` 是**精简版**，缺价格摘要字段（见 §0.2-①） |
| S2 | Gamma 单事件 | `GET /events?slug=<event_slug>` | 事件结构 + `markets[]` 的 `groupItemTitle`、`clobTokenIds`、`outcomePrices`、`orderPriceMinTickSize`、`orderMinSize`、`feesEnabled`、`feeType`、`feeSchedule`、`acceptingOrders`、`negRisk`、`eventStartTime`、`endDate`、`resolutionSource` | 同上，价格摘要不全 |
| S3 | Gamma 市场（全字段） | `GET /markets/keyset?tag_id=104596&closed=false` 或 `GET /markets?clob_token_ids=<yes_token>`（实测返回 90 个键） | `bestBid / bestAsk / lastTradePrice / spread / oneDayPriceChange / oneHourPriceChange / volume24hr / volume / liquidity / liquidityNum`、`feeSchedule{rate,exponent,takerOnly,rebateRate}` | 必须走这条才拿到 `bestBid/lastTradePrice/volume24hr` |
| S4 | CLOB 盘口 | `GET clob.polymarket.com/book?token_id=<token>` | `bids[] / asks[]`（`{price,size}`）、`min_order_size`（实测 `"5"`）、`tick_size`（`0.001`）、`neg_risk`、`last_trade_price`、`hash` | `bids` 升序、`asks` 降序，**末位=最优**；单边时该侧为 `[]` |
| S5 | CLOB 摘要 | `/midpoint`、`/spread`、`/price?side=BUY|SELL`、`/tick-size`、`/last-trade-price` | `{mid}`、`{spread}`、`{price}`、`{minimum_tick_size}`、`{price,side}` | `/price` 语义反直觉（§0.2-②）；`/last-trade-price` 有 0.5 哨兵（§0.2-④） |
| S6 | Data API 价格史 | `GET data-api.polymarket.com/v2/prices-history?token_id=<token>&interval=1d&bucket_seconds=60` | `data[].{timestamp(epoch s), price, resolution_seconds}`、`pagination.next_cursor` | **price 是 midpoint**（§0.2-⑤）；60s 桶稀疏（实测 1421/1440 点） |
| S7 | Data API 成交 | `GET data-api.polymarket.com/v2/trades?condition=<conditionId>&limit=n` | `data[].{proxy_wallet, side(BUY/SELL), size, price, timestamp, outcome, outcome_index, transaction_hash}` | 分页用 `cursor`；`price` 可能是多档 VWAP（实测 0.0137931034，非 tick 整倍数） |
| S8 | Data API 规模 | `GET /v2/oi?condition=<id>`、`GET /v2/live-volume?event_id=<id>` | `data[].value`（未平仓 USDC）；`data.conditions[].taker_volume`（taker 成交额） | `/v2/live-volume` 需要 `event_id`（整数） |
| S9 | 官方裁决源 | 直接拉 `market.resolutionSource`（形如 `aviationweather.gov/api/data/metar?ids=ZUCK&format=raw&date=...&hours=30`） | 原始 METAR 报文（每小时/SPECI），含 `Txxxxxxxx` 小时温度备注或 `TT/TdTd` 组 | 必须按**站点本地日期**过滤；`SPECI` 行不计入；这是与结算完全同源的读数 |

> 已验证事实：温度市场 `feeType="weather_fees"`、`feeSchedule={"exponent":1,"rate":0.05,"takerOnly":true,"rebateRate":0.25}`、`orderPriceMinTickSize=0.001`、`orderMinSize=5`、`negRisk=true`、`clobTokenIds[0]=Yes / [1]=No`、`outcomes=["Yes","No"]`、每事件 11 个括号（`12°C or below` + `13°C…21°C` + `22°C or higher` 形态）。

### 0.2 七个必须知道的字段陷阱（全部实测复现）

1. **`/events?slug=` 内嵌 `markets[]` 不是全字段**：实测只含 `bestAsk`、`spread`，**不含 `bestBid`、`lastTradePrice`、`volume24hr`、`oneDayPriceChange`**。做快照必须再用 S3 补一次；否则会把"没有 bid"误判成"字段缺失"。
2. **CLOB `/price?side=BUY` 返回的是该侧最优挂单价，不是买入成交价**：实测 YES token 盘口 `bid=0.98 / ask=0.994` 时，`side=BUY→0.98`（=best bid），`side=SELL→0.994`（=best ask），与文档文字相反。**不要用它推对手价**，一律读 `/book`：买入价 = `asks` 末位，卖出价 = `bids` 末位。
3. **`/book` 数组顺序**：`bids` 价格升序、`asks` 价格降序，**数组末位才是最优价**；不要写 `[0]`。单侧无人挂单时该数组为 `[]`（实测低价括号 `bids=[]`，`bestBid` 为 `null`）。
4. **`/last-trade-price` 无成交时返回哨兵 `{"price":"0.5","side":""}`**（实测 Chongqing `12°C or below`）。把 0.5 当成"最后成交价"会制造灾难性假信号；必须与 `lastTradePrice=null` 一样判定为无效。
5. **`/v2/prices-history` 的 `price` 是 midpoint，不是 last**：实测 Paris `9°C` 该点 `0.375` 恰等于 CLOB `/midpoint`；Chongqing `12°C or below` 全天恒为 `0.0005 = mid(0, 0.001)`（亚 tick 值）。且是稀疏 60s 桶（有 120s/332s 缺口），算滚动收益必须"取 `ts ≤ targetTs` 的最近样本"而不是"数组倒数第 N 个"。
6. **Gamma `liquidity` ≠ 可成交深度**：实测同一时刻 Chongqing `16°C` `liquidityNum=8679`，但盘口前 10 档双边名义额仅 **13.2 USDC**（因为大量挂单是 0.001 的 ask）；`18°C` 也相差 16 倍。**过滤器要用自己算的 `book_liquidity_usd`，不能用 Gamma `liquidity`。**
7. **低价括号常常只有单边盘口**：实测 Chongqing 11 个括号中 7 个 `bestBid` 缺失、只有 `0.001` 的 ask（且有数万股挂量）。这种市场**只能买入、无法卖出**，任何"1 分钟往返"策略在物理上不可能平仓。

---

## 1. 市场全集与选择参数（universe）

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 建议默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `event_slug` | 事件唯一标识，形如 `highest-temperature-in-<city>-on-<date>-2026` | `S2 events[].slug` | — | 城市+日期是分组键；同事件内括号互斥（negRisk） |
| `city` | 城市名，从 `title` 或 slug 解析 | `S2 title` / slug | 实测 146 个未关闭事件去重后 **51 城**（Amsterdam…Zhengzhou） | 城市=气象站，不同站报告频率/时区不同 |
| `station_icao` | 裁决站 ICAO（4 位），从 `resolutionSource` 的 `ids=` 参数提取：`ids=([A-Z]{4})` | `S2 resolutionSource` 正则 | `ZUCK`(重)、`EGLL`(伦敦)、`RJTT`(东京)… | 结算与"实况最大值"必须以同站同源为准；换站会导致 edge 全错 |
| `bracket_label` | 括号文案：`"14°C"` / `"12°C or below"` / `"22°C or higher"` | `S2 markets[].groupItemTitle` | 每事件 11 个 | 仅显示用；判定请用 `bracket_index` |
| `bracket_index` | 括号在 negRisk 组内的序号（升序），从 `groupItemThreshold` 或对 `groupItemTitle` 解析数值后 `rank()` | `groupItemThreshold` + `groupItemTitle` | `0..10`，默认给 UI 展示与"邻接"计算 | 决定 `neighbor_prob_*`、`dist_to_edge_cc`；不要假设 11 恒定，必须实测 `bracket_count` |
| `bracket_count` | 同一事件内带 `negRisk=true` 且 `negRiskMarketID` 相同的市场数 | `S2 markets[].negRiskMarketID` 计数 | 实测 11（跨 4 城 × 4 日一致） | 用于"概率和"归一；事件中途补括号会改变它 |
| `neg_risk_group_id` | 否定风险组 id | `negRiskMarketID`（`0x…`） | — | 同组仓位互斥、风险相关；仓位上限应**按组**而非按括号计 |
| `price_band_low` / `price_band_high` | 允许交易的 YES 中间价上下界 | 由 `implied_probability` 过滤 | `0.02 / 0.98`（保守 `0.05/0.95`，激进 `0.01/0.99`）；硬护栏 `p_ref ≥ 0.01` | **非退化第一道闸**：低于 0.02 的括号 tick 相对幅度过大（见 §7） |
| `implied_probability` | 隐含概率 = YES 中间价 `(bestBid + bestAsk)/2`；缺失侧用 Gamma `outcomePrices[0]` 兜底并标记 `estimated=true` | `S4 /midpoint` 或 `(bids[-1].price + asks[-1].price)/2`；兜底 `S2 outcomePrices[0]` | `0.0005..0.9995` 实测 | 不是胜率估计，是**市场报价**；宽点差时 mid 会漂 |
| `sum_bracket_prob` | `Σ_i implied_probability_i`（只统计有效 mid 的括号；有效率 < 80% 时置 `stale_chain=true`） | 聚合 S4/`outcomePrices` | 实测 4 城：`0.977 / 1.005 / 1.055 / 1.066`（含缺失侧偏差） | 偏离 1 是 negRisk 组内的**赔率键/定价不一致**；不能直接当套利（见 §8-③） |
| `overround_pct` | `(sum_bracket_prob − 1) × 100` | 派生 | 实测 `−2.4% ~ +6.6%`；`\|overround\| > 5%` 标记"组内高摩擦" | 高 overround = 组内整体贵/便宜，做多全组无利可图（实测 `Σ bestAsk = 1.04~1.22 > 1`） |
| `neighbor_prob_low` / `neighbor_prob_high` | 相邻括号（index−1 / index+1）的 `implied_probability`；边界括号取单侧 | 派生 | `0..1` | 用于"括号轮动/邻接"策略：单括号偏离邻接插值 = 相对价值信号 |
| `dist_to_edge_cc` | 到最近括号边界的距离（摄氏度）：中值 `m` 到区间 `[a,b]` 的 `min(\|m−a\|, \|m−b\|)`；`m` 取 `metar_max_so_far_cc`（有实况）否则 `forecast_high_cc` | 派生（气象 + `bracket_index`） | `0..∞ °C`；`< 0.5°C` 为"临界括号"（易翻档） | 结算按**整数半度进位**（16.5→17、−8.5→−8），边界 0.5°C 处概率跳变；临界括号报价最不稳定 |
| `ttr_sec` | 距**交易截止**的秒数：`(endDate − now)/1000`；注意 `endDate` 是停止接单时间，不是出裁决时间 | `S2 market.endDate`（ISO） | `900..129600`（`15min..36h`） | `ttr` 太短：已可判定但无流动性；太长：资金占用高、赔率未收敛 |
| `resolution_eta_sec` | 预计裁决时间：`endDate + 观察日次日 00:00 UTC（24:00 UTC）后首份 METAR`（规则原文：次日首份 METAR 或次日 23:59 ET，取先到）；实测 Nov 7 伦敦于 Nov 8 00:41Z 裁决 | 规则文本 + `eventStartTime` | `0..36h` | 回放里"到点即结算"必须与真实节奏一致，否则收益率被高估 |
| `book_liquidity_usd` | 可成交深度：`Σ_{top10 asks}(price×size) + Σ_{top10 bids}(price×size)` | `S4` | `0..1e6`；默认门槛 `≥ 500`（保守 1000） | **不要用 Gamma `liquidity`**（§0.2-⑥ 差 16–650 倍） |
| `volume_24h_usd` | 市场 24h 成交额 | `S3 volume24hr`（市场级）或 `S1 volume24hr`（事件级） | 实测单括号 `160 ~ 15 419`，事件 `3.5k ~ 51k` | 冷括号（`< 1k`）的 `prices-history` 几乎不动，任何"1 分钟 20%"都是噪声 |
| `spread_abs` | `bestAsk − bestBid`（YES 侧） | `S4` 末位差 / `S5 /spread` | `0.001..0.05`；默认 `≤ 0.03`，推荐 `≤ 0.02` | 温度盘口实测常见 `0.014 ~ 0.036`，相当于 3.5%–35% 的报价宽度 |
| `spread_ratio` | `spread_abs / implied_probability` | 派生 | 实测 `1.4% ~ 35%`；门槛 `≤ 5%` | 相对点差才是真成本；低价括号点差很小但费用占比极高（§5） |
| `tick_size` | 最小价格变动 | `S4 tick_size` / `S2 orderPriceMinTickSize` / `S5 /tick-size` | `0.001`（温度市场恒定，实测） | `+20%` 在 `p=0.001` 处只有 `0.0002 < 1 tick`，**不可表达**（§7） |
| `min_order_shares` | 最小下单股数 | `S4 min_order_size` = `"5"`；`S2 orderMinSize` = `5` | `5` 股（限价/卖出） | **市价买入（BUY）无股数下限，只需名义额 ≥ $1**（Polymarket UI 提示「盘口买入需高于 1 美元」）；5 股是**限价单**规则，同时也是**市价卖出**下限（<5 股仓位无法卖出）。`shared/contract.js` 的 `ORDER_RULES`：`marketBuyMinUsd=1`、`marketSellMinShares=5`、`limitMinShares=5` |
| `price_tick_ratio` | `implied_probability / tick_size`（该价位有多少个 tick 的"分辨率"） | 派生 | `1..999`；筛选 `≥ 20`（即 `p ≥ 0.02`） | 低价处 1 tick = 巨大百分比；这个比值是判断"百分比信号是否可交易"的最快指标 |
| `accepting_orders` | `active && !closed && acceptingOrders && enableOrderBook` | `S2`/`S3` 同名字段 | `true` | 盘口可能在 `endDate` 前挂起；不接单时中途无法平仓 |

---

## 2. 价格与盘口流特征（price / flow）

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 建议默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `mid_yes` | `(bestBid + bestAsk)/2`；要求 `0 < bestBid < bestAsk < 1`，否则无效 | `S4` 末位；或 `S5 /midpoint` | `0.0005..0.9995` | locked/crossed 盘口必须判无效（`03` §7） |
| `last_yes` | 最新成交价；无成交时 `null` | `S5 /last-trade-price`（识别 `0.5` 哨兵）或 `S7 data[].price` | `0..1` | 哨兵 0.5（§0.2-④）；又因 `prices-history` 是 mid，`last` 必须另取 |
| `best_bid_yes` / `best_ask_yes` | 最优买卖价 | `S4 bids[-1].price` / `asks[-1].price` | `0..1`；单边时为 `null` | 执行价的唯一来源（买入=ask、卖出=bid） |
| `spread_ticks` | `spread_abs / tick_size` | 派生 | 实测 `1..36`；门槛 `≤ 10` | 点差以 tick 计，便于与"信号变动 tick 数"比较 |
| `ret_30s` / `ret_60s` / `ret_300s` | `ret(w) = (p_now / p_ref(w) − 1) × 100`，其中 `p_ref(w)` = `argmax{ s.ts : s.ts ≤ now − w×1000 }`，容差 `max(2000, tickIntervalMs)` ms | 本地样本序列（`03` §2.1）+ `S6` 回放 | 实测 1 分钟 `\|ret\|` 中位 `0%`、p95 `4%~12%`、p99 `16%~41%`（按括号）；阈值 `20%` 对应 ~p99.5 | 分母必须是 `p_ref`；`prices-history` 稀疏（1421/1440），按数组下标取"1 分钟前"会错位 |
| `last_ret_30s/60s/300s` | 同名，但 `p_ref` 用 `last_yes` | 派生 | 同上 | `last` 序列稀疏（只在成交时更新），只在有成交的活跃括号可用 |
| `abs_move_60s` | `p_now − p_ref`（USD/股，可正负） | 派生 | `\|abs\| ≥ 0.01`（推荐 `≥ max(0.01, 4×spread_abs)`） | **百分比是相对量，绝对量才是钱**；这是低价噪声的第一道护栏 |
| `move_in_ticks` | `\|abs_move_60s\| / tick_size` | 派生 | `≥ 2`（推荐 `≥ 4`） | `+20%` 在 `p=0.02` 只有 4 tick；`p=0.005` 只有 1 tick，属伪信号 |
| `sigma_abs_60s` | 滚动 60s 绝对变动标准差：`stdev(Δp_i)`，`Δp_i = mid_i − mid_{i−1}` | 派生 | 实测 `0.001~0.02`；门槛：信号幅度 `≥ 3σ` | 低价处相对波动不可用（分母趋 0），用绝对 σ 更稳 |
| `rv_60s` | 已实现波动（对数）：`sqrt(Σ_i (ln(mid_i/mid_{i−1}))²)`，`mid ≤ 0` 的样本丢弃 | 派生 | 实测 `0.001~0.15`（窗口内） | 仅当 `mid ≥ 0.02` 时可用；用于"波动是否异常放大" |
| `trade_count_60s` | 最近 60s 的成交笔数 | `S7` 按 `timestamp` 过滤计数 | 实测活跃括号 `0~40` 笔/分钟，冷括号 `0` | 0 笔 = 无信息；"1 分钟涨 20%"常发生在 0~1 笔的冷括号上 |
| `taker_volume_60s` | 最近 60s taker 名义额：`Σ size × price` | `S7`；或用 `S8 /v2/live-volume` 的 `taker_volume` 做差分 | `0..数千 USD` | 成交量级小于订单额时，自己的单就是"全部流动性" |
| `volume_delta_60s` | `(volume_24h_usd(t) − volume_24h_usd(t−60s))` | `S3 volume24hr` 差分 | `0..数千` | 比累计量更能反映"刚刚有资金进场"；依赖 1 分钟粒度 |
| `book_imbalance_top5` | `(Σ_{top5} bid_size − Σ_{top5} ask_size) / (Σ bid_size + Σ ask_size)` ∈ `[−1,1]` | `S4` | 实测常 `±0.9`（单边）；门槛 `\|imb\| ≥ 0.6` 才视为"有方向" | 温度盘口经常单边（只有 ask），imb=±1 是**结构**而非信号，必须先要求双边有效 |
| `depth_bid_top5_usd` / `depth_ask_top5_usd` | 前 5 档名义额 | `S4` | 实测 `2 ~ 756` USDC 在 p≈0.4 档；`0` 常见 | 单笔预算应 `≤ 10% × depth_ask_top5_usd`，否则滑点吃掉全部 edge |
| `price_extreme_prox` | `min(implied_probability, 1 − implied_probability)`，越接近 0 越极端 | 派生 | `0..0.5`；门槛 `≥ 0.02` | 与 `price_band_low/high` 互补；极端价的 1 tick 跳变 = 巨大百分比 |
| `quote_age_ms` | `now − max(bids/asks 快照 ts)` | `S4 timestamp` / WS `book.timestamp` | `0..60000`；门槛 `≤ max(3×tickIntervalMs, 5000)` | 过期盘口成交是回测最常见的假收益来源（`03` §2.3 stale） |
| `book_hash` | CLOB 盘口哈希 | `S4 hash` | — | 同 hash 视为同一 tick，用于去重、避免每 tick 重复触发 |
| `price_change_1h` | Gamma 报告的 1 小时价格变化 | `S3 oneHourPriceChange` | `−0.5..0.5` | 现成的"中周期动量/回归"特征，但**口径是 Gamma 自己的报价**，与自算 `ret_3600s` 可能不一致，不能混用 |

---

## 3. 天气 / 实况上下文（weather）

裁决源与市场同一份 METAR：`market.resolutionSource` 直接给出 `ids=<ICAO>&date=<ISO>&hours=30`，**照抄这个 URL 就能拿到结算所用的同一批报文**（实测 Chongqing 返回 18 条 `METAR ZUCK …`，其中 `071300Z` 是**站点本地 11-07 21:00，不属于 11-08**——时区换算错了就会把前一天算进当日最高温）。这是温度市场相对其他预测市场最大的信息优势来源。

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 建议默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `metar_obs_list` | 当日（站点**本地**日期）所有 `METAR` 行，剔除 `SPECI` 行；时间戳 `DDHHMMZ` 转站点本地时区 | `S9` 原始文本 `^\w+ ([A-Z]{4}) (\d{6})Z` | — | 规则原文：`SPECI` 是特殊观测、**不计入**；跨时区/夏令时会算错日期 |
| `metar_temp_cc` | 单条观测的温度：优先小时备注 `T` + 8 位（前 1 位符号，3 位十分位）→ `T01390133` = 13.9°C；无备注时用正文 `TT/TdTd`（`M` 表示负）→ `18/12` = 18°C | `S9` + `03`/市场 `description` 规则 | `−40..50 °C` | 两种格式必须都解析；`T` 组后 4 位是露点，**不能用** |
| `metar_max_so_far_cc` | 当日已观测最大温度（十分位精度）：`max(metar_temp_cc)` | `S9` 派生 | `−40..50 °C` | 这是"当天最高温"的单调不减实测下界；午后达到峰值后基本锁定 |
| `metar_max_rounded_cc` | 结算用的整数：`round_half_up(metar_max_so_far_cc)`（规则：13.9→14、17.4→17、16.5→17、−1.7→−2、−8.5→−8） | 派生 | 整数 | 半度**向上**进位，不能用银行家舍入；−8.5→−8 是"向 0 方向"的特例 |
| `metar_last_obs_cc` | 最近一条观测温度 | `S9` | 同上 | 结合 `metar_max_so_far_cc` 可判断"是否已过日峰值" |
| `metar_obs_count` | 当日（站点本地日期）已收到的观测条数 | `S9` | 实测：Chongqing 11-08 本地 00:00→14:00 共 **15 条**（每小时 1 条，全天上限 24） | 报告间隔约 1h，期间市场无新信息；**这是"事件驱动"策略的时钟** |
| `metar_age_sec` | `now − 最近一条观测的发布时间` | `S9` | `0..3600`；`< 300` = 刚出新信息 | `metar_age_sec < 300` 时做均值回归 = 逆着信息交易，必输 |
| `station_local_hour` | 站点本地小时（0–23） | 时区换算 | `0..23` | 日峰值通常出现在 13–16 时；18 时后"最高温已定"概率高 |
| `heating_phase` | 阶段：`rising`(≤14 时) / `plateau`(14–17) / `falling`(≥18)；由 `station_local_hour` 映射 | 派生 | 三值枚举 | 同一 `ret_60s` 在 `rising` 与 `falling` 相位含义相反（前者信息、后者噪声） |
| `forecast_high_cc` | 当日预报最高温（°C），推荐 Open-Meteo：`GET api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&daily=temperature_2m_max&timezone=<IANA>` | `forecast.daily.temperature_2m_max[0]`（实测 Chongqing 返回 `16.9`） | 与 `metar_max_so_far_cc` 同量纲 | 外部源，**不能当裁决**；仅作先验。站坐标需 ICAO→lat/lon 静态表 |
| `forecast_sigma_cc` | 预报误差标准差（**当日**）：先验 `1.0 °C`；随 `metar_obs_count` 增大而收缩，可用 `sigma = max(0.4, 1.2 − 0.06×obs_count)` | 常量/标定 | `0.4..1.5 °C` | 决定概率曲线的陡峭度；σ 过大会让所有括号"差不多贵" |
| `fair_prob_cc` | 括号的理论概率：`Φ((b + 0.5 − μ)/σ) − Φ((a − 0.5 − μ)/σ)`，`[a,b]` 为括号区间（`12°C or below` 取 `b=12`，`a=−∞`；`22+` 取 `a=22`，`b=+∞`），`μ = metar_max_so_far_cc`（若仍可能升温则 `μ = max(metar_max_so_far_cc, forecast_high_cc)`），`Φ` 为标准正态 CDF | 派生 | `0..1` | **最有价值的特征**：市场 vs 模型的差就是 edge；`0.5` 边界偏移来自"半度向上进位"规则 |
| `edge_vs_market_pp` | `(fair_prob_cc − implied_probability) × 100`（百分点） | 派生 | `−100..100`；门槛 `\|edge\| ≥ 10pp` | 需扣成本后的净 edge，毛 edge 10pp 在 p=0.1 处扣完点差+费用可能只剩 1–2pp |
| `bracket_state` | 三态：`dead`（`metar_max_so_far_cc > b` 或预报上界 < a）、`certain`（`metar_max_so_far_cc` 已落在 `[a,b]` 且 `heating_phase=falling`）、`live` | 派生 | 枚举 | `dead` 括号的 YES 仍可能挂在 0.01–0.05（流动性残留）；这是"买 NO/卖 YES"的经典机会，也是"1 分钟 20%"假信号的温床 |
| `market_meaningful` | `bracket_state == "live"` 且 `ttr_sec ≥ minTTR` 且 `book` 双边有效 | 派生 | `bool` | 已确定结果的括号不应再产生短线信号（赔率不再随机） |
| `resolution_source_url` | 裁决 URL 原文，用于审计与回放复现 | `S2 resolutionSource` | — | 提交给 QA 的复现凭据；URL 里 `date` 是 UTC，不是站点本地日期 |

---

## 4. 执行参数（execution）

市场订单在 Polymarket 本质是"可立即成交的限价单（FAK）"；**无 gas 成本**（链下撮合、链上结算由协议承担），因此总成本 = 点差 + 手续费 + 滑点 + 机会成本。逐档撮合公式与 `03` §3.3 完全一致：

```
remaining = budgetUsd; filled = 0; notional = 0
for level of asks (price 升序, price ≤ buyLimit):
    unitCost = level.price × (1 + takerFeeRate × (1 − level.price))   # 含费的每股现金支出
    qty      = min(level.size, floor(remaining / unitCost, 2))
    notional += qty × level.price; filled += qty; remaining -= qty × level.price
VWAP = notional / filled
fee  = round5(filled × 0.05 × VWAP × (1 − VWAP))     # <0.00001 记 0
```

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 建议默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `order_type` | `market`（FAK marketable limit） | 契约 `execution.orderType`（仅 `market`） | `market` | 市价单 = 主动吃对手盘 = 付 taker 费；maker 返佣 25% 拿不到（taker 不享受） |
| `slippage_buffer_bps` | 价格保护缓冲：`buyLimit = ceilToTick(bestAsk × (1 + bps/1e4))` | 契约 `execution.slippageBufferBps` | `0`（默认）～`50` | 温度市场 `tick=0.001`，缓冲区设太大等于接受任意价 |
| `vwap_fill` | 成交均价 = `notional / filled` | 撮合输出（`07` `Trade.price`） | `0..1` | 必须用 VWAP 计费（`04` §5.4），不能用最优价近似 |
| `slippage_vs_mid_usd` | `(vwap_fill − mid_before) × filled`（买入） | 派生 | 实测示例：$25 买单 `+1.53 USD` | 这是"看起来涨 20%"却亏损的直接来源；必须进归因 |
| `slippage_vs_best_usd` | `(vwap_fill − best_ask_before) × filled` | 派生 | 实测示例：`+0.59 USD` | 纯深度滑点（剔除点差） |
| `depth_at_k_ticks` | 距最优价 `k` 个 tick 内的可成交量 | `S4` | `k=5` 统计 | 订单额超过该深度 → 实际成交价劣于预期 |
| `fill_prob` | 快照下 `= 1`（深度与接单状态满足）；跨 tick 的"报价存活率"另计为 `quote_survival_prob` | `03` §3.3 | 模拟器用确定性 `0/1` | 现实中的失败来自"价格在 1 个 tick 内被撤走"（延迟竞赛），不是深度不足 |
| `quote_survival_prob` | `P(best_ask 在 Δt 内不变)`，建议由 WS `book`/`best_bid_ask` 序列估计（Δt=1s/5s） | WS `market` 频道 | 温度市场实测偏态：活跃括号 `0.5~0.9`，冷括号 `≈1`（无人动） | 存活率低的括号 = 你会追到"幻影报价"；存活率≈1 的冷括号 = 没有对手 |
| `partial_fill_ratio` | `filled / requested` | 撮合输出 | `0..1`；`status=partial` | 部分成交后剩余撤销（FAK）；`filled < 5 股` 整单拒绝（`below_min_order`） |
| `min_fill_shares` | 最小成交换手 | `S4 min_order_size` | `5` 股 | 注意 5 股在 `p=0.001` 时名义额仅 `$0.005`，此时"最小单"几乎免费——但 fee=`5×0.05×0.001×0.999=0.00025` 仍大于 5dp 门槛 `0.00001`，照收 |
| `order_budget_usd` | 单笔预算（含费）：`min(sizingValue, cash, maxPositionUsd − marketCost)` | 契约 `execution.*` | `20~50 USD` | 预算必须 ≥ `5 × price × (1+fee)` 才可能成交 |
| `gas_cost_usd` | 恒为 `0`（温度市场链下撮合） | — | `0` | **不要在成本模型里加 gas**；加了会系统性低估收益率 |
| `latency_ms` | 从看到快照到订单到达撮合的延迟 | 实测/标定 | `100~2000 ms`（回放可配） | 1 分钟窗口策略里，2s 延迟就可能错过整段脉冲；回放须支持该参数 |

**实测执行示例（Paris `9°C`，2026-11-08 快照）**——`mid=0.375, bestBid=0.36, bestAsk=0.39`，asks 前几档 `0.39×5 / 0.40×171.2 / 0.41×27.09`，bids 前几档 `0.36×5 / 0.35×40 / 0.29×8.51 / 0.28×9.74`：

| 步骤 | 结果 |
|---|---|
| BUY $25 逐档 | 62.58 股，notional `24.9989`，VWAP `0.399471`，fee `0.75063`，**costBasis `25.74953`** |
| 立刻 SELL 62.58 股逐档 | 成交 `0.36×5 + 0.35×40 + 0.29×8.51 + 0.28×9.07`，毛收入 `20.8075`，VWAP `0.332494`，fee `0.69446`，净 `20.113` |
| 无价格变动往返 | **PnL `−5.6365`（−21.89%）**；其中点差 `−2.02`、深度滑点 `−1.53`、双程费用 `−1.45` |

> 结论：在温度市场典型的"卖盘厚、买盘薄"结构下，**taker 往返的固定成本可达名义额的 15%–22%**。任何"1 分钟 ±20%"信号必须先跨过这个门槛才算 alpha。

---

## 5. 费用与成本参数（fees）

官方公式（`04` §5.2、`07` §6）：`fee = C × feeRate × p × (1 − p)`，`C`=股数、`p`=成交价、`feeRate = feeSchedule.rate = 0.05`，`takerOnly = true`（maker 不付、taker 付，maker 返佣 `rebateRate=0.25` 与 taker 无关），**四舍五入到 5 位小数，`< 0.00001` 记 0**。买卖双向都收（`03` §4.1：卖出同样 `calcTakerFee`）。结算兑付不收费。

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `taker_fee_rate` | `feeSchedule.rate` | `S2/S3 feeSchedule.rate` | `0.05`（weather；须与市场一致，否则 WARN） | 不同 category 费率不同（crypto 0.07）；硬编码 0.05 前要读市场字段 |
| `fee_schedule_exponent` | `feeSchedule.exponent` | 同名字段 | `1`（实测） | 官方文档只给 `p×(1−p)`；若未来 `exponent≠1` 需按 `p×(1−p)^exponent` 复核 |
| `fee_usd` | `round5(C × 0.05 × p × (1 − p))` | 派生 | `0 .. C×0.0125` | 唯一取整点；内部累计不得逐步取整（`04` §5.4） |
| `fee_pct_of_notional` | `fee / (C×p) × 100% = 5% × (1 − p)` | 派生 | `0.05% ~ 5.0%` | **p 越低费用占比越高**：`p=0.1` 时 4.5%，`p=0.9` 时 0.5% |
| `fee_per_share` | `0.05 × p × (1 − p)` USDC/股 | 派生 | `p=0.5` 时 `0.0125` | 用于逐股成本核算 |
| `round_trip_cost_pct` | `[(p_ask − p_bid) + fee(p_ask) + fee(p_bid)] / p_ask × 100`（精确版，含真实双边费用） | 派生 | 实测 `3.2% ~ 59%`（见 §10） | 与 `04` §5.10 的 `minProfitableMovePct` 同源（后者是验证期近似） |
| `minProfitableMovePct` | 验证器口径：`2 × (halfSpread + 0.05 × p × (1−p)) / p × 100`（`04` §5.10） | 派生 | `p=0.05`→`29.5%`；`0.10`→`19.0%`；`0.20`→`18.0%`；`0.30`→`13.7%`；`0.50`→`9.0%` | `moveThresholdPct < minProfitableMovePct` 必须给 WARN（现成校验器规则） |
| `fee_drag_pct` | `feesPaid / initialCapital × 100` | 契约 `Metrics.feeDragPct` | 高频下 `> 5%/日` 即预警 | 1 分钟级策略换手可达 10–30 次/日，费用拖累是本类策略的**第一杀手** |
| `fee_drag_bps` | `feesPaid / turnoverUsd × 10000` | 派生 | 参考 `04` §6.2 工例（210 bps） | 回答"每 1 USDC 成交额被抽走多少"，适合比较不同换手策略 |
| `fee_free_min_shares` | `fee` 被 5dp 取整为 0 的条件：`C × 0.05 × p × (1−p) < 0.000005` | 派生 | 最小单 5 股在 `p=0.5` 时 `fee=0.0625`，**永不为 0** | 不要设计"薅零费"策略：门槛比最小单小 4 个数量级 |

### 5.1 100 股工例（可直接做单测断言）

| p | notional | `fee_usd` | 占名义额 | 往返费用占比（2×） | `minProfitableMovePct`（点差 0.02） |
|---|---|---|---|---|---|
| 0.10 | 10.00 | **0.45000** | 4.50% | ~9.0% | 19.0% |
| 0.30 | 30.00 | **1.05000** | 3.50% | ~7.0% | 13.7% |
| 0.50 | 50.00 | **1.25000** | 2.50% | ~5.0% | 9.0% |
| 0.70 | 70.00 | **1.05000** | 1.50% | ~3.0% | 5.9% |
| 0.90 | 90.00 | **0.45000** | 0.50% | ~1.0% | 3.2% |

（与官方 "Weather" 费用表逐项一致：0.45 / 1.05 / 1.25 / 1.05 / 0.45。）

### 5.2 低价区间：费用占比反噬

| p | `fee_pct_of_notional` | 100 股 fee | 2×（往返） | 1 tick 的相对幅度 | 可否表达 +20%？ |
|---|---|---|---|---|---|
| 0.001 | 4.995% | 0.00500 | ~10.0% | **+100%** | **不可**（0.0002 < 1 tick） |
| 0.005 | 4.975% | 0.02488 | ~9.95% | +20% | 恰好 1 tick（边缘） |
| 0.010 | 4.950% | 0.04950 | ~9.9% | +10% | 2 tick |
| 0.020 | 4.900% | 0.09800 | ~9.8% | +5% | 4 tick |
| 0.050 | 4.750% | 0.23750 | ~9.5% | +2% | 10 tick |
| 0.100 | 4.500% | 0.45000 | ~9.0% | +1% | 20 tick |

**为什么费用会主导 1 分钟级交易**：单次往返的固定成本 ≈ `2 × 5% × (1−p)` 名义额 + 点差。在 `p=0.2` 处 ≈ `8% + 点差 10% = 18%`（见实盘 9°C 示例 21.9%）。若策略日均交易 `N=20` 次、每次名义 `$25`，则日费用 ≈ `20 × 25 × (0.08+0.10) ≈ $90`，对 `$1000` 本金即 **9%/日**；而 1 分钟窗口的实测收益中位数是 **0%**（§10）。因此**任何未把费用与点差前置进信号门槛的策略，回放必然亏损**——这不是策略问题，是算术问题。

---

## 6. 风险参数（risk）

| 参数（canonical） | 定义 / 公式 | 数据字段路径 | 合理范围 & 建议默认 | 为什么重要 / 陷阱 |
|---|---|---|---|---|
| `bankroll_usd` | 初始资金 | 契约 `risk.bankrollUsd` | `1000`（`10~1e7`） | 小资金时最小单 5 股与 $20–50 预算的比例决定可交易性 |
| `sizing_mode` / `sizing_value` | `fixed_stake`（USD/笔）或 `pct_equity`（%权益） | 契约 `execution.sizingMode/sizingValue` | `fixed_stake 25` | 温度市场单笔容量受深度限制，`pct_equity` 在权益波动时会放大仓位 |
| `max_position_usd` | 单市场未平仓成本上限（含费） | 契约 `execution.maxPositionUsd` | `50`（建议 ≤ `10% × depth_ask_top5_usd`） | 超过深度上限 = 自我滑点 |
| `max_positions` | 全局未平仓持仓数 | 契约 `execution.maxPositions` | `5` | 持仓数比仓位额更限制风险集中度 |
| `max_positions_per_market` | 同括号并发上限 | 契约 | `1` | 1 分钟策略不宜加仓摊平 |
| `event_exposure_cap_usd` | **同一 negRisk 组**（同城同日）的总敞口上限 | 派生（按 `neg_risk_group_id` 汇总） | `≤ 2 × max_position_usd` | 同组括号互斥但风险同源；把 5 个括号各买 $50 = 对同一天气变量下注 $250 |
| `max_drawdown_pct` | `(peakEquity − equity)/peakEquity × 100` 熔断线 | 契约 `risk.maxDrawdownPct` | `20`（保守 15，激进 35） | MVP 熔断只停机不强平（`03` §6） |
| `daily_loss_limit_usd` | UTC 自然日亏损上限 | 契约 `risk.dailyLossLimitUsd` | `100` | 与回撤线互补；高频策略先触发日亏 |
| `kill_switch` | 熔断后是否停机 | 契约 `risk.killSwitch` | `true` | `false` 只告警；验证系统建议 `true` |
| `cooldown_sec` | 同市场同方向冷却 | 契约 `signal.cooldownSec` | `300`（激进 120，保守 600） | 1 分钟级信号若无冷却会连环追单，费用爆炸 |
| `max_signals_per_market` | 每市场每轮最大入场信号数 | 契约 `signal.maxSignalsPerMarket` | `5` | 防"一整天只做同一括号"导致样本偏差 |
| `max_trades_per_day` | 每日成交笔数上限（风控层，新增） | 派生 | `30`（激进 80） | 直接控制费用拖累上限：`30 × $25 × 15% ≈ $112` |
| `fee_budget_pct` | `feesPaid / initialCapital` 熔断/告警线 | 派生 | 告警 `5%`/日，熔断 `10%`/日 | 让"费用吃掉本金"可被用户看见（前端必备） |
| `slippage_budget_bps` | 单笔滑点占名义额上限 | 派生（`slippage_vs_mid_usd / notional`） | `≤ 200 bps`（2%） | 超限拒单，避免吃穿薄盘 |
| `stale_feed_action` | 行情断线/过期时动作 | 契约 `feedStatus` + `03` §7 | `pause_entries`（禁止开仓，保留盯市） | 断线时成交是回测最隐蔽的假收益 |
| `resolution_risk_flag` | 标注"裁决源异常/待定"（`resolution_pending`） | `03` §4.3 | `true` 时不计收益率结论 | negRisk 组应恰有一个 YES；异常时结论不可信 |

---

## 7. 需求原例的解剖：为什么"0.001 涨 20% 就买"是非退化问题

需求原文是"1 分钟内价格上升 20%，马上买入 UP"。把它放到温度市场的真实微观结构里，会连续撞上四堵墙：

**墙 1：tick 量化。** `tick=0.001`，`p=0.001` 时 `+20% = 0.0002`，**小于 1 个 tick，价格上根本不可表达**；能表达的最小跳变是 `0.001→0.002 = +100%`。实测 Chongqing `12°C or below` 全天 1366 个 1 分钟点**恒为 0.0005**（= `mid(0, 0.001)`，即"0 买价 / 0.001 卖价"的中点），连 0.002 都没出现过。

**墙 2：单边盘口。** 该括号 `bids=[]`、`bestBid=null`，只有 `0.001` 的巨额卖单。**能买、不能卖**。任何"1 分钟往返"在物理上无法平仓，回测里若允许按 mid 卖出，收益全部是伪造的。

**墙 3：费用与点差的反向缩放。** 费用占名义额 `5%×(1−p)`，点差占比 `spread/p`。`p` 越小这两个比例越大：`p=0.02` 时即使点差只有 0.001，往返成本也 ≈ `12%`；`p=0.05` 且点差 0.003 时 ≈ `15%`（§5）。而 `+20%` 的全部毛收益也只有名义额的 20%。

**墙 4：实测收益分布。** 2026-11-08 对 4 城（Paris/London/HongKong/Seoul）× 11 括号的 1 分钟 mid 序列取样：`|ret| ≥ 20%` 且 `|Δp| ≥ 0.01` 的信号共 **239 个**；信号后 1 分钟**同向**平均变动 **−0.0037 USD/股**（命中率 **27.6%**），5 分钟 **−0.0079**（30.7%）。也就是说，字面意义的"±20%/1 分钟追单"在样本内是**反向**的，主要原因是 `bid-ask` 跳动与冷括号的报价噪声。

### 7.1 让策略非退化的过滤器（建议作为 UI 的"健康检查"开关组）

| 过滤器（canonical） | 公式 / 条件 | 建议阈值 | 作用 |
|---|---|---|---|
| `min_price` | `implied_probability ≥ min_price` | `0.02`（推荐 `0.05`） | 保证 `+20% ≥ 4~10 tick`，消除 tick 量化噪声 |
| `min_abs_move` | `\|abs_move_60s\| ≥ min_abs_move` | `max(0.01, 4 × spread_abs)` | 百分比之外再加绝对护栏 |
| `move_in_ticks_min` | `\|abs_move_60s\| / tick_size ≥ 4` | `4` | 同上，按 tick 表述更稳 |
| `move_over_cost` | `\|ret_pct\| ≥ 1.5 × round_trip_cost_pct` | `1.5` | **最关键**：信号幅度必须显著大于往返成本 |
| `max_spread` | `spread_abs ≤ max_spread` | `0.02`（宽容 0.03） | 点差是最大单项成本 |
| `max_spread_ratio` | `spread_abs / mid ≤ 5%` | `5%` | 相对点差控制（低价括号自动被排除） |
| `min_book_liq` | `book_liquidity_usd ≥ 500` | `500` | 排除"名义深度 13 美元"的假流动性 |
| `min_bid_depth` | `depth_bid_top5_usd ≥ 2 × order_budget_usd` | `≥ 2×` | 保证能卖出（这是 0.001 括号最常缺的条件） |
| `require_two_sided` | `bestBid > 0 && bestAsk < 1 && bestBid < bestAsk` | 强制 | mid 才有效；否则信号层不评估（`03` §2.1） |
| `max_quote_age_ms` | `now − quote_ts ≤ max(3×tickIntervalMs, 5000)` | `5000` | 排除过期盘口 |
| `min_volume_24h` | `volume_24h_usd ≥ 1000` | `1000` | 冷括号剔除 |
| `regime_guard` | `metar_age_sec > 300`（均值回归类）或 `bracket_state == "live"`（动量类） | 见 §8 | 避免逆着新信息交易 |
| `cooldown_sec` | 同市场同方向冷却 | `≥ 300` | 防连环追单 |
| `fee_budget_pct` | 日费/本金 ≤ 5% | `5%` | 费用拖累熔断 |

> 判据：当 `moveThresholdPct < minProfitableMovePct`（`04` §5.10）或 `move_over_cost < 1.5` 时，UI 必须显示"该价位 ±X% 不足以覆盖点差 + 双边手续费"，且不允许把它当作"已通过验证"的策略。

---

## 8. 候选策略原型（"短线频繁市价 ±20%/1 分钟"家族）

以下 5 个原型都只用 §1–§6 的可测量参数，**每个都标注了实测支持度**（样本：2026-11-08，4 城 × 11 括号，1 分钟 mid 序列；样本小，仅作方向性证据，须回放扩样）。

### ① `momentum_burst` · 动量爆发（需求直译）
- **核心假设/edge**：价格脉冲后存在短期延续（信息扩散滞后 + 追单流）。edge 来源必须是"新信息"，不是价位本身。
- **入场 sketch**：`ret_60s ≥ move_threshold_pct` 且 `abs_move_60s ≥ max(0.01, 4×spread_abs)` 且 `move_over_cost ≥ 1.5` 且 `require_two_sided` 且 `metar_age_sec < 600`（刚出新 METAR）→ BUY YES（下跌对称买 NO）。
- **出场 sketch**：费用后 TP `take_profit_pct`、SL `stop_loss_pct`、`max_hold_sec ≤ 300`；或持有到下次 METAR 重定价。
- **关键参数**：`move_threshold_pct=20`、`window_sec=60`、`min_price=0.05`、`max_spread=0.02`、`confirmation_ticks=1`。
- **预期频率 / 实测**：0.5–3 单/市场/日。实测无条件版本 1 分钟同向命中率 **27.6%**（负 edge），**仅在"新 METAR 后 10 分钟内"的子样本才可能为正**——因此本原型的 alpha 完全依赖 `metar_age_sec` 条件。
- **失败模式**：追在脉冲末端；冷括号 `+20%` 是单笔成交造成的假象；无 bid 无法止盈。

### ② `mean_reversion_fade` · 脉冲回归
- **核心假设/edge**：`bid-ask` 跳动与恐慌抛售造成超调，随后回归。edge 来源是**流动性提供者的时间补偿**，不是信息。
- **入场 sketch**：`ret_60s ≤ −20%`（YES 急跌）且 `metar_age_sec > 600`（**近期无新信息**）且 `abs_move_60s ≥ 4 tick` 且 `spread_ratio ≤ 5%` 且 `depth_bid_top5_usd ≥ 2×budget` → BUY YES（博反弹）；急涨则反向买 NO。
- **出场 sketch**：费用后 TP `15%~30%`、`max_hold_sec 120~600`、无 bid 则本 tick 不退出等下一快照。
- **关键参数**：`confirmation_ticks=1`、`max_spread=0.02`、`min_price=0.05`、`cooldown_sec=300`。
- **预期频率 / 实测**：1–5 单/日/城市。实测回调幅度均值仅 `0.0037`（≈ 信号幅度的 2%），**远小于 §10 实测的 3%–59% 往返门槛**，因此必须限定在 `p ≥ 0.3`（`round_trip_cost_pct ≤ 10%`）且点差 ≤ 0.02 的括号上，才有理论空间。
- **失败模式**：真实信息驱动（METAR 修正、预报突变）时"接飞刀"→ 直接 0/1 结算。

### ③ `bracket_rotation_negrisk` · 括号轮动 / 邻接一致性
- **核心假设/edge**：同组 11 个括号的报价应满足 `Σp ≈ 1` 且相邻括号概率单调、平滑；偏离时可做多便宜的、做空贵的。edge 来源是**组内定价不一致**与 negRisk 结构。
- **入场 sketch**：`overround_pct ≥ +5%` → 买最贵括号的 NO（等价做空）；`overround_pct ≤ −5%` → 买被低估的 YES；或单括号 `implied − 0.5×(neighbor_low+neighbor_high)` 偏离 `> 5pp` 时做收敛。
- **出场 sketch**：`overround` 回到 `±2%` 内，或持有到结算（此类不是 1 分钟策略，需单独计时）。
- **关键参数**：`sum_bracket_prob`、`neighbor_prob_*`、`min_book_liq`、`require_two_sided`。
- **预期频率 / 实测**：0–2 单/日。实测 `Σ bestAsk = 1.04~1.22 > 1`、`Σ bestBid = 0.73~0.98 < 1`，**直接"买全组/卖全组"套利不存在**（被点差吃掉）；只有相对价值。
- **失败模式**：把"缺失 bid 记 0"当真实报价（会算出假 overround，实测 Seoul 出现 `−2.4%` 的伪负溢价）；结算边界（半度进位）导致邻接概率不连续。

### ④ `metar_event_drive` · 实况事件驱动（本家族最有真实 edge 的一类）
- **核心假设/edge**：每小时 METAR 发布后，"当日最高温"信息增量立刻确定部分括号的 0/1 命运，市场重定价有分钟级滞后。edge 来源是**信息处理速度**（与裁决同源的数据，别人还没读完）。
- **入场 sketch**：轮询 `resolution_source_url`（建议 2–5 min，按报文时间戳去重）→ 更新 `metar_max_so_far_cc`、`fair_prob_cc`；当 `|fair_prob_cc − implied_probability| ≥ 10pp` 且 `bracket_state == "live"` 且 `spread_ratio ≤ 8%` 且 `depth ≥ 3×budget` → 交易（`fair > implied` 买 YES，反之买 NO）。
- **出场 sketch**：`metar_max_rounded_cc` 落入该括号且 `heating_phase == falling` ⇒ 持有到结算（`payout=1`）；否则在后续 METAR 使 `edge` 消失时平仓；`ttr_sec < 900` 停止开仓。
- **关键参数**：`metar_obs_count`、`metar_age_sec`、`fair_prob_cc`、`edge_vs_market_pp`、`forecast_sigma_cc`、`bracket_state`。
- **预期频率 / 实测**：1–4 单/城市/日（每小时报告 1 次 → 事件稀疏但每次信息量大）。工程上必须与结算同源（`resolutionSource`），这是**可审计**的 edge。
- **失败模式**：METAR `COR` 修正；`SPECI` 误计入；站点本地时区/夏令时算错日期；`T` 组与正文组解析不一致；裁决用次日首份报文（即 `endDate` 后仍可能改判）。

### ⑤ `mm_avoidance_overlay` · 做市商规避 / 流动性守卫（叠加层，不是独立策略）
- **核心假设/edge**：温度市场由少数做市商报出不对称盘口，撤单/补单节奏制造"幻影报价"；**不交易**比交易更有价值。edge 来源是**成本规避**。
- **入场 sketch**：作为其他 4 个原型的 AND 前置条件——`quote_survival_prob ≥ 0.5`、`depth_bid_top5_usd ≥ 2×budget`、`spread_ticks ≤ 10`、`book_hash` 变化率 `< 1 次/秒`（说明不是被高频刷的盘口）、`gamma liquidity` **不作为**过滤依据。
- **出场 sketch**：不适用；平仓时同样检查 `depth_bid_top5_usd`，不足则分笔/延迟。
- **关键参数**：`quote_survival_prob`、`book_imbalance_top5`、`depth_*_top5_usd`、`spread_ticks`。
- **预期频率 / 实测**：把可交易括号从 11 个压缩到 **1–3 个**（实测 Chongqing 仅 3 个括号双边有效）。代价是样本量下降、验证周期变长。
- **失败模式**：过度过滤导致"永不成交"，验证失去意义；需在报告中显示"过滤前后市场数/信号数"。

---

## 9. 参数 → 契约字段映射（供 `docs/03` / `docs/07` 对齐）

| 本文 canonical（snake_case） | `docs/03` 配置字段 / `docs/07` 快照字段 | 备注 |
|---|---|---|
| `city` / `station_icao` | `universe.cities` / `MarketSnapshot.station` | 城市选择在 UI 层 |
| `bracket_index` / `bracket_label` | `MarketSnapshot.bracket` | UI 展示 + 邻接计算 |
| `implied_probability` | `MarketSnapshot.impliedProbability` | 即 YES mid |
| `price_band_low` / `price_band_high` | `universe.minPrice` / `universe.maxPrice` | 默认 `0.02 / 0.98` |
| `book_liquidity_usd` | `universe.minLiquidityUsd` | **必须用自算深度**，不用 Gamma `liquidity` |
| `spread_abs` / `spread_ratio` | `universe.maxSpread` | 默认 `0.03` |
| `ttr_sec` | `universe.minTimeToResolutionSec` / `maxTimeToResolutionSec` | 默认 `900 / 129600` |
| `volume_24h_usd` | `MarketSnapshot.volume24hUsd` | 过滤器 |
| `tick_size` / `min_order_shares` | `MarketSnapshot.tickSize` / `minOrderShares` | `0.001` / `5` |
| `ret_60s` / `abs_move_60s` / `move_in_ticks` | `signal.windowSec` + `signal.moveThresholdPct` + `signal.minAbsMove` | 公式见 `03` §2.2 |
| `confirmation_ticks` / `cooldown_sec` / `max_signals_per_market` | `signal.confirmationTicks` / `cooldownSec` / `maxSignalsPerMarket` | |
| `require_two_sided` / `max_quote_age_ms` | `signal.requireSpreadOk` + `03` §7 规则 | 单边盘口 → mid 无效 |
| `order_type` / `slippage_buffer_bps` | `execution.orderType` / `slippageBufferBps` | 仅 `market`/`book_walk` |
| `order_budget_usd` / `max_position_usd` | `execution.sizingValue` / `maxPositionUsd` | 预算含费 |
| `min_fill_shares` / `partial_fill_ratio` | `03` §3.3 撮合输出 | `below_min_order` |
| `taker_fee_rate` / `fee_usd` | `fees.takerFeeRate` / `04` `calcTakerFee` | 唯一 5dp 取整点 |
| `minProfitableMovePct` / `round_trip_cost_pct` | `04` §5.10 校验器 | 用于 WARN |
| `bankroll_usd` / `max_drawdown_pct` / `daily_loss_limit_usd` / `kill_switch` | `risk.*` | |
| `max_positions` / `max_positions_per_market` | `execution.*` | 建议新增 `event_exposure_cap_usd`（按 `neg_risk_group_id`） |
| `metar_*` / `fair_prob_cc` / `bracket_state` | 暂无契约字段（**建议 `docs/07` §3.1 扩展 `MarketSnapshot`**） | 天气上下文目前不在 API 契约内，需新增 |

---

## 10. 实测样本与口径（附录）

**采样方法**：2026-11-08 14:50 (+08:00) 前后；事件 = `highest-temperature-in-{paris,london,hong-kong,seoul,chongqing}-on-november-8-2026`；每事件 11 个括号；价格序列 = `GET /v2/prices-history?token_id=<yes>&interval=1d&bucket_seconds=60`（**midpoint**）；盘口 = CLOB `/book` 实时快照；信号定义 = `|ret_1m| ≥ 20%` 且 `|Δp| ≥ 0.01`，`ret` 用相邻有效样本。

| 指标 | 实测值 |
|---|---|
| 每个括号 1 分钟点数 | `1360 ~ 1423`（应对 1440，稀疏 1%–6%） |
| `\|ret_1m\|` 中位数 | 约 `0%`（多数分钟不动） |
| `\|ret_1m\|` p95 / p99（活跃括号） | Paris `8°C`：`12.2% / 29.8%`；HK `27°C`：`5.8% / 16.5%` |
| `±20%/1min` 信号数（4 城合计） | `239` 次，占约 62 000 个 1 分钟窗口的 `0.38%`（尾部事件） |
| 信号后 1 分钟同向变动 | 均值 `−0.0037 USD/股`，命中率 `27.6%` |
| 信号后 5 分钟同向变动 | 均值 `−0.0079 USD/股`，命中率 `30.7%` |
| 分价位带（1 分钟同向/相对） | `p<0.02`: `−240%`（n=21，纯噪声）；`0.02–0.10`: `−4.3%`（n=128）；`0.10–0.30`: `−1.9%`（n=73）；`0.30–0.70`: `−6.1%`（n=17） |
| 组内概率和 `sum_bracket_prob` | `0.977 / 1.005 / 1.055 / 1.066`（4 城）；`Σ bestAsk = 1.037~1.222`，`Σ bestBid = 0.731~0.978` |
| 往返成本 `round_trip_cost_pct`（真实盘口） | `3.2%`（p≈0.97 且点差 0.029）~ `47.8%`（p≈0.024 且点差 0.012）~ `59%`（p≈0.02，点差 0.015） |
| 单边盘口占比（Chongqing） | 11 个括号中 **7 个 `bestBid=null`** |

**口径警告**：① 单日、单时点、4–5 个城市，样本量小，结论只用于"参数合理性"而非"策略收益"；② `prices-history` 是 midpoint（不是可成交价），用它算的收益会系统性**高估**（不需要跨点差）；③ 本文所有实测数字均应被回放引擎独立复现，`docs/03` §10 的验收清单优先级高于本文附录。

---

**附：建议 UI 暴露的三档默认（与 `docs/03` §9 预设一致）**

| 档位 | `min_price` | `max_spread` | `min_book_liq` | `move_threshold_pct` | `window_sec` | `min_abs_move` | `minProfitableMovePct` 警告线 |
|---|---|---|---|---|---|---|---|
| 保守 | 0.05 | 0.02 | 1000 | 25 | 120 | 0.02 | `>threshold` 时 WARN |
| 均衡（需求基线） | 0.02 | 0.03 | 500 | 20 | 60 | 0.01 | 同上 |
| 激进 | 0.01 | 0.05 | 200 | 12 | 30 | 0.005 | 同上（WARN 密度更高） |
