# 03 · 策略规范（StrategyConfig / 信号 / 执行 / 退出 / 风控 / 账本）

> 版本：v1.0（可实施）｜Owner：策略专家 B（strategist-signal）
> 字段名唯一来源：`shared/contract.js` v1.0.0 + `docs/07-api-contract.md` §2；成本/P&L 口径与 `docs/04-product-spec.md` 对齐；参数含义与 `docs/02-strategy-parameters.md` 互查。
> 适用市场：Polymarket「Highest temperature in <City> on <Date>?」事件下的 negRisk 括号市场，每个 °C 一个二元市场；`outcomes[0]=Yes/UP`、`outcomes[1]=No/DOWN`，tick=0.001，`min_order_size`=5 股，weather taker 费率 0.05。
> 本文是信号/成交/退出/账本/风控/边界语义的权威定义；实现必须逐条通过 §10 验收清单。

---

## 0. 全局约定

| 项 | 约定 |
|---|---|
| 时间 | 内部 epoch **ms**；`now` 由引擎时钟给出；样本时间用交易所 `timestamp`（缺失时用接收时间） |
| 百分比 | 含 `Pct` 的字段为**百分比点数**（`20` = 20%），公式中除以 100 |
| 价格/金额 | 价格 0–1（USD/股）；份额向下取 0.01 股；**仅费用**按 round-half-up 取 5 位（`<0.00001` 记 0），金额内部不逐步取整；比较用 `1e-9` 容差 |
| 方向 | `UP`=买入 YES；`DOWN`=买入 NO（等价做空）；只做买入开仓、卖出平仓，无杠杆/融券 |
| 价格带 | 以 **YES 中间价**为准：`universe.minPrice ≤ midYES ≤ universe.maxPrice`；交易 NO 时按其自身 token 盘口执行，同样受该带检查 |
| 确定性 | 同一事件序列 + 同一配置 ⇒ 完全相同成交序列；禁止 look-ahead；`sim.speed` 只影响回放墙钟耗时 |
| 非法输入 | `normalizeStrategy()` 填默认/强转；`validateStrategy()` 返回 `{valid, errors, warnings, normalized}`；`errors` 拒绝启动，`warnings` 不阻断 |
| 边界 | 纯模拟：无签名、无真实下单，只消费公开行情并在本地按 §3 撮合 |

---

## 1. StrategyConfig（JSON）

### 1.1 完整 Schema 骨架（数值为 canonical default）

```jsonc
{
  "version": 1,                          // 必填整数，仅接受 1；否则拒绝加载
  "name": "均衡 · ±20%/1min 动量",        // 1..120 字符
  "description": "",                     // 0..2000 字符
  "universe": {
    "cities": [],                        // [] = 全部城市；否则城市名/slug 精确匹配
    "maxMarkets": 12,                    // 1..200，容量上限
    "selectionMode": "per_market",       // per_market（按流动性取前 N 个）| per_event（按城市/日期事件整组选入）
    "minPrice": 0.02,                    // 0.001..0.5，YES mid 下限（兼作信号/入场价格护栏）
    "maxPrice": 0.98,                    // 0.5..0.999，YES mid 上限
    "minLiquidityUsd": 500,              // 0..1e6；双边前 10 档 Σ(price×size)
    "maxSpread": 0.03,                   // 0.001..0.2；bestAskYES - bestBidYES
    "minTimeToResolutionSec": 900,       // 300..604800；= endDate - now 的下限
    "maxTimeToResolutionSec": 129600,    // 3600..1209600；上限
    "onlyAcceptingOrders": true          // true 时要求 active && !closed && acceptingOrders
  },
  "signal": {
    "priceField": "mid",                 // mid | last | best_bid | best_ask（序列固定取 YES token）
    "windowSec": 60,                     // 10..3600，滚动窗口
    "moveThresholdPct": 20,              // 1..500，百分比阈值
    "minAbsMove": 0.01,                  // 0..0.5，最小绝对变动（USD/股），低价噪声护栏
    "direction": "both",                 // up | down | both
    "confirmationTicks": 1,              // 1..30，连续满足的 tick 数
    "cooldownSec": 300,                  // 0..86400，同市场同方向冷却
    "maxSignalsPerMarket": 5,            // 1..100，每市场整轮运行最多入场信号数
    "requireSpreadOk": true              // true 时 spread 超限不产生信号
  },
  "execution": {
    "orderType": "market",               // 仅 market（FAK：吃可吃档位，剩余撤销）
    "sizingMode": "fixed_stake",         // fixed_stake（USD） | pct_equity（%权益）
    "sizingValue": 25,                   // 1..100000；fixed_stake=USD/笔，pct_equity=权益百分比
    "maxPositionUsd": 50,                // 1..100000，单市场未平仓成本上限
    "maxPositions": 5,                   // 1..100，全局未平仓持仓数上限（按 token 计）
    "maxPositionsPerMarket": 1,          // 1..10，同一括号市场并发持仓上限
    "fillModel": "book_walk",            // 仅 book_walk：逐档吃对手盘
    "slippageBufferBps": 0,              // 0..1000，价格保护 buffer（100=1%）
    "fallbackBuyEachWindow": false       // 每个观测窗口周期空仓时：买第 1 高 YES + 第 3 高 NO
  },
  "exit": {
    "takeProfitPct": 50,                 // 1..1000，费用后净收益率阈值
    "stopLossPct": 30,                   // 1..1000，费用后净收益率阈值
    "maxHoldSec": 3600,                  // 10..604800，自成交起最大持有秒数
    "holdToResolution": true,            // true=关闭主动退出、持有到结算；false=启用 TP/SL/maxHold/反向退出
    "exitOnOppositeSignal": false        // 仅 holdToResolution=false 时生效
  },
  "risk": {
    "bankrollUsd": 1000,                 // 10..1e7，初始现金
    "maxDrawdownPct": 20,                // 1..100，权益峰值回撤熔断
    "dailyLossLimitUsd": 100,            // 0..1e7，UTC 自然日亏损熔断（0=关闭）
    "killSwitch": true                   // true=熔断后停止运行；false=只告警
  },
  "fees": {
    "model": "weather_taker",            // 仅 weather_taker
    "takerFeeRate": 0.05                 // 0..0.2；须等于 Gamma feeSchedule.rate，否则 WARN
  },
  "sim": {
    "mode": "live",                      // live | replay
    "tickIntervalMs": 1000,              // 250..60000；live tick 间隔
    "replayLookbackMin": 60,             // 5..1440；replay 数据窗口，必须 ≥ windowSec/60
    "speed": 10                          // 1..100；仅回放墙钟倍速
  }
}
```

### 1.2 关键字段语义

| 字段 | 语义 |
|---|---|
| `universe.minPrice/maxPrice` | ①市场发现时按 YES mid 过滤；②信号样本护栏（`p_ref`、`p_now` 都须在带内）；③入场执行时目标 token 的 bestAsk 也须在带内 |
| `minLiquidityUsd` | `Σ_{top10 asks}(price×size) + Σ_{top10 bids}(price×size)`；盘口缺失记 0 |
| `min/maxTimeToResolutionSec` | `resolutionTime = effectiveTradingEnd(market)`：温度 negRisk 市场为**观察日 24:00 UTC（次日 00:00Z）**；`ttr=(cutoff-now)/1000`，仅 `min≤ttr≤max` 可选（Gamma `endDate` 12:00Z 不是真实截止） |
| `signal.priceField` | 见 §2.1；信号序列固定 YES token，不用 NO 序列（避免镜像重复计数） |
| `execution.sizingValue` | 下单预算上限来源；实际预算还与现金、`maxPositionUsd`、最小下单量取 min（§3.2） |
| `exit.holdToResolution` | `true`：禁用 TP/SL/maxHold/反向退出，只有结算（`resolution`）可平仓；`false`：全部主动退出生效。需求所述短线策略应为 `false` |
| `risk.killSwitch` | 熔断动作：立即停止运行（`status=stopped`），禁止新开仓、不再产生任何订单；MVP **不强制平仓**，报告分列已实现/浮动（对齐 docs/04） |
| 兼容说明 | 任务书 snake_case 为描述性命名，映射见 §1.3；`signal.min_price/max_price` 统一为 `universe.minPrice/maxPrice` |

### 1.3 任务书字段 → 契约字段映射（实现只认右列）

| 任务书 | 契约字段 | 任务书 | 契约字段 |
|---|---|---|---|
| `universe.bracket price band` | `universe.minPrice/maxPrice` | `signal.confirmation_ticks / cooldown_sec` | `confirmationTicks / cooldownSec` |
| `universe.min/max_time-to-resolution` | `minTimeToResolutionSec / maxTimeToResolutionSec` | `signal.max_signals_per_market / require_spread_ok` | `maxSignalsPerMarket / requireSpreadOk` |
| `universe.min_liquidity / max_spread / max_markets` | `minLiquidityUsd / maxSpread / maxMarkets` | `signal.min_price / max_price` | `universe.minPrice / maxPrice` |
| `signal.price_field / window_sec / move_threshold_pct / min_abs_move` | `priceField / windowSec / moveThresholdPct / minAbsMove` | `exit.take_profit_pct / stop_loss_pct / max_hold_sec` | `takeProfitPct / stopLossPct / maxHoldSec` |
| `execution.order_type / sizing mode+value / fill_model` | `orderType / sizingMode+sizingValue / fillModel` | `exit.hold_to_resolution / exit_on_opposite_signal` | `holdToResolution / exitOnOppositeSignal` |
| `execution.max_position_usd / max_positions / max_positions_per_market / slippage buffer` | `maxPositionUsd / maxPositions / maxPositionsPerMarket / slippageBufferBps` | `risk.bankroll_usd / max_drawdown_pct / daily_loss_limit_usd / kill_switch` | `bankrollUsd / maxDrawdownPct / dailyLossLimitUsd / killSwitch` |
| `fees.model / taker_fee_rate` | `fees.model / takerFeeRate` | `sim.start_mode / speed / version / name` | `sim.mode / speed / version / name` |

---

## 2. 信号语义（±20% / 60s 为核心示例）

### 2.1 样本与价格字段

- 每个已选市场维护 **YES token** 定长样本序列（默认保留 15 分钟）：`{ts, bid, ask, mid, last}`。
- `priceField` 取值（缺失即无效，不插值、不回退）：
  - `mid=(bestBid+bestAsk)/2`，要求 `bestBid>0`、`bestAsk<1`、`bestBid<bestAsk`（locked/crossed 无效）；
  - `best_bid/best_ask`：取对应侧，该侧缺失或 `≤0`/`≥1` 无效；
  - `last`：最新成交价；Gamma/CLOB 对“从未成交”返回占位 `price=0.5, side=""`，与 `lastTradePrice=null` 一样必须识别为无效。
- 追加规则：仅当 `ts > 上一有效样本.ts` 才追加（乱序/重复丢弃）；book `hash` 与上次相同视为同一 tick，不重复评估信号。
- `p_now`=最新有效样本；`p_ref`=满足 `ts ≤ now - windowSec×1000` 的**最新**样本（窗口前最近值）。

### 2.2 滚动窗口收益（精确定义）

```
targetTs = now - windowSec*1000
p_ref    = argmax{ s.ts : s.ts ≤ targetTs }        // 不存在则本次不评估
tolMs    = max(2000, sim.tickIntervalMs)           // 参考点容差
validRef = (now - p_ref.ts) ≤ windowSec*1000 + tolMs
p_now    = 序列最新有效样本
retPct   = (p_now.price / p_ref.price - 1) * 100   // 分母必须是 p_ref
absMove  = p_now.price - p_ref.price
```

样本不足（窗口内有效样本 <2 个不同 ts）、`validRef=false`、`p_ref.price ≤ 0` ⇒ 不产生信号（`reason=window_not_ready`）。

### 2.3 触发、确认、冷却、去重

1. **方向**：`UP`：`retPct ≥ +moveThresholdPct` 且 `absMove ≥ minAbsMove` 且 `direction∈{up,both}`；`DOWN`：`retPct ≤ -moveThresholdPct` 且 `absMove ≤ -minAbsMove` 且 `direction∈{down,both}`。边界含等号（恰好 20.0% 触发）。
2. **护栏（先于方向判定）**：`p_ref.price ≥ 0.01`、`p_now.price ≤ 0.99`（硬编码退化护栏，见 §2.5）；两者都 ∈ `[universe.minPrice, universe.maxPrice]`；`requireSpreadOk=true` 时 `spreadYES ≤ universe.maxSpread`；行情新鲜度 `now - p_now.ts ≤ max(3×tickIntervalMs, 5000)` ms。
3. **确认**：每个方向维护连续命中计数，满足条件 `+1`，不满足（含无样本）清零；计数 ≥ `confirmationTicks` 才生成信号。生成后清零并要求“失效一次后重新武装”，避免持续行情每 tick 重复触发。
4. **冷却**：键为 `(marketId, direction)`；某方向**入场成交**后 `cooldownSec` 内不再生成该方向信号；另一方向独立计时（但受 §2.4 同 tick 反转限制）。
5. **上限**：按市场累计**已生成的入场信号**数，达到 `maxSignalsPerMarket` 后该市场不再产生新信号。
6. **去重**：同一 tick 每市场最多 1 个信号；book hash 未变不评估；乱序/重复样本丢弃；`last` 无新成交不追加样本，因此不会重复计数。

### 2.4 UP/DOWN → YES/NO 映射与订单方向

| 信号 | 交易 token | CLOB 方向 | 说明 |
|---|---|---|---|
| `UP`（YES 序列上涨） | `outcomes[0]` = YES | `BUY`（吃 YES asks） | 需求“涨 20% 买 UP” |
| `DOWN`（YES 序列下跌） | `outcomes[1]` = NO | `BUY`（吃 NO asks） | 等价做空 YES；NO 上涨即 YES 下跌 |

- 只允许买入开仓、SELL 平仓；不得用 `1-yesPrice` 伪造 NO 成交价，NO 必须走自身盘口。
- 反向信号（持有 YES 时出现 DOWN，或反之）：仅当 `holdToResolution=false && exitOnOppositeSignal=true` 时作为退出条件；**同一 tick 平仓后不再开反向仓**，反向开仓最早下一 tick（仍受 cooldown/maxSignals 约束），避免同价往返摩擦。

### 2.5 低价退化（0.001 附近）为什么必须加护栏

tick=0.001 时，1 个 tick 在低价处等于巨大百分比：

| p_ref | +1 tick | 百分比 | +2 ticks | 百分比 |
|---|---|---|---|---|
| 0.001 | 0.002 | **+100%** | 0.003 | **+200%** |
| 0.002 | 0.003 | +50% | 0.004 | +100% |
| 0.010 | 0.011 | +10% | 0.012 | +20% |
| 0.050 | 0.051 | +2% | 0.052 | +4% |

在 0.001–0.01 区间，价差跳动、小额成交、做市商撤挂单都能制造 ±20% 假信号，而费用/点差相对收益占比极大。强制防护：① `p_ref.price ≥ 0.01` 硬地板（与配置无关，避免除零放大）；② 推荐 `universe.minPrice ≥ 0.02`（validator 对 `<0.01` 给 WARN）；③ 推荐 `minAbsMove ≥ 0.01`（validator 对 `moveThresholdPct≤20 && minAbsMove<0.01` 给 WARN）；④ `requireSpreadOk=true` 且 `maxSpread ≤ 0.03`；⑤ 价格带 + stale + `bestBid<bestAsk` 检查；⑥ 执行时再查 bestAsk 价格带，越界拒单（`risk_blocked`）。

### 2.6 数值示例（验收基准）

**示例 A（需求原文）**：`windowSec=60, moveThresholdPct=20, minAbsMove=0.01, confirmationTicks=1, priceField=mid`。
t=0s `mid=0.200`，t=60s `mid=0.240` ⇒ `retPct=(0.240/0.200-1)×100=+20.00`、`absMove=+0.040≥0.01` ⇒ **UP → 买 YES**。
若 t=60s `mid=0.160` ⇒ `retPct=-20.00`、`absMove=-0.040` ⇒ **DOWN → 买 NO**。
若 `mid=0.239` ⇒ `19.5%<20%` ⇒ 无信号（不得四舍五入）。若 `p_ref=0.002→p_now=0.003`（+50%）⇒ 被 `p_ref≥0.01` 硬地板拒绝。

**示例 B（费用与净收益）**：信号后 YES 盘口 `ask=0.245`（单档 500 股），`sizingValue=25`（**名义额**预算）。
`shares=floor(25/0.245,2)=102.04`；`notional=round(102.04×0.245,5)=24.9998`；
`fee=calcTakerFee(102.04,0.245)=round5(0.94374)=0.94374`；**账户现金扣除** `costBasis=24.9998+0.94374=25.94354`（`cashDelta=-25.94354`，即账户需 ≥ $25.94354；手续费不占名义额预算）。
止盈：YES bestBid=0.40 时 `exitFee=round5(102.04×0.05×0.40×0.60)=1.22448`，`netProceeds=40.816-1.22448=39.59152`，费用后净收益率 `=52.6% ≥ 50%` ⇒ 触发 `take_profit`（注意不是裸价 0.245→0.40 的 63%）。

## 3. 执行模型（market order / book walk）

### 3.1 前置与价格保护

1. 市场 trade-ready：`active && !closed && acceptingOrders`（`onlyAcceptingOrders=true` 时强制），否则 `market_not_accepting_orders`。
2. 行情新鲜（§2.3 阈值），否则 `stale_market`，不得用过期盘口成交。
3. 点差：`requireSpreadOk=true && spread>maxSpread` ⇒ `spread_too_wide`。
4. 盘口：BUY 需 asks 非空、SELL 需 bids 非空；无可用档位 ⇒ `no_liquidity`。
5. 价格保护（FAK marketable limit）：`buyLimit=ceilToTick(bestAsk×(1+bps/10000))` 上限 `0.999`；`sellLimit=floorToTick(bestBid×(1-bps/10000))` 下限 `0.001`；tick 取该市场 `tick_size`（温度市场 0.001）。仅吃 `ask≤buyLimit` / `bid≥sellLimit` 的档位。

> 注（实现口径）：当 `slippageBufferBps=0`（契约默认）时 `buyLimit == bestAsk`，市价单实际只吃最优档并可能部分成交；只有 `slippageBufferBps>0` 才会逐档吃更深流动性。§10.10 的逐档成交示例默认 `bps>0`。此约定以 §3.1 为准。
6. 模拟不改变外部盘口（无 self-impact）；同一 tick 已消费档位不重复使用，下一 tick 以新快照为准。

### 3.2 预算（notional sizing）

```
equity     = cash + Σ(shares×mid)
targetUsd  = sizingMode=="fixed_stake" ? sizingValue : equity*sizingValue/100
marketCost = 该市场当前未平仓 costBasis 之和
budgetUsd  = min(targetUsd, cash, maxPositionUsd - marketCost)
```

- 无杠杆、无挂单冻结（FAK 即时成交）；`pct_equity` 以当前权益为基数，随盈亏浮动。
- 预算为**订单名义额**（`sizingValue` = fixed_stake 的 USD 名义金额 / pct_equity 的权益百分比对应的名义额），与产品面板「固定名义金额」一致；逐档按 `qty×price` 消耗名义额预算。
- **手续费从账户现金单独扣除**（Polymarket 在订单金额之外从余额扣费）：总现金支出 = `notional + fee`，必须 ≤ 可用现金；现金不足时按 0.01 股步长缩减成交，仍不足 ⇒ `insufficient_cash`。`maxPositionUsd` 约束单币种/单市场累计成本上限。

### 3.3 逐档撮合、VWAP、部分成交

```
remaining=budgetUsd; filled=0; notional=0; levels=[]
for level of asks 升序 where level.price ≤ buyLimit:
    unitCost = level.price*(1 + takerFeeRate*(1-level.price))   // 含费单位成本
    qty = min(level.size, floor(remaining/unitCost, 2))          // 份额向下取 0.01
    if qty <= 0: break
    notional += qty*level.price; filled += qty; remaining -= qty*level.price
    levels.push({price: level.price, size: qty})
VWAP = notional/filled
fee  = calcTakerFee(filled, VWAP)         // 官方公式；<0.00001 记 0；唯一 5dp 取整点；若 notional+fee>budget 则按 0.01 股回退重算
```

- `status`：吃到的深度/预算耗尽且未被保护价截断 ⇒ `filled`；因保护价或深度不足提前停止 ⇒ `partial`（允许部分成交，剩余量撤销）。
- **最小下单量（按订单类型区分）**：本系统只下**市价单**——
  ① 市价 **BUY：名义金额 ≥ $1**，**无股数下限**（Polymarket UI 提示「盘口买入需高于 1 美元」；1.4 股的 $1 单合法）；份额按 0.01 取整可能让 $1 预算落在 $1 稍下方（如 1.05×0.95=0.9975），模拟器会**补 1 个最小份额**使名义额达到 $1（预算语义不变，容差 ≤1 个 lot；现金不足时才拒绝 `below_min_order`）；
  ② 市价 **SELL（退出）：≥ `marketSellMinShares` = 5 股**（交易所对 <5 股仓位不可卖出）；
  ③ 5 股 `min_order_size` 是**限价单**规则（本系统不模拟限价单）。
  任一不满足 ⇒ `below_min_order`，不产生成交。买入另需账户现金 ≥ 名义额 + 手续费（手续费从现金单独扣）。
- 卖出平仓同规则（走 bids 降序、`sellLimit`、费用从收入扣除）；部分平仓按比例结转 costBasis（§5.1）。

### 3.4 拒绝条件（必须落 `rejected` Trade，`rejectReason` ∈ contract.REJECT_REASONS）

| 条件 | rejectReason |
|---|---|
| 市场 closed / 非 acceptingOrders / enableOrderBook=false | `market_not_accepting_orders` |
| 行情 stale | `stale_market` |
| 点差 > maxSpread（requireSpreadOk=true） | `spread_too_wide` |
| 目标侧盘口空 / 无档位在保护价内 / 可成交为 0 | `no_liquidity` |
| 市价 BUY 名义额 < $1（无股数下限）或市价 SELL <5 股 | `below_min_order` |
| 预算不足 / 现金不足 | `insufficient_cash` |
| 全局持仓数 ≥ maxPositions | `max_positions` |
| 同市场持仓数 ≥ maxPositionsPerMarket | `max_positions_per_market` |
| 熔断/回撤/日亏/价格带等风控前置失败 | `risk_blocked` |
| 解析异常等 | `unknown` |

> 被拒订单：不成交、不改账本，仅记录 Trade（`status=rejected`）与日志，供前端解释“为什么没成交”。

### 3.5 周期性兜底建仓（按城市/日期独立；开关 `execution.fallbackBuyEachWindow`）

- **分组**：温度市场按 **城市 + 日期（negRisk 事件组）** 独立处理——快照有 `eventId` 用 `eventId`，否则用 `city + endDate` 分组。
- **触发时机**：从运行第一个 tick 起，每满一个观察窗口（`signal.windowSec`）检查一次（`_fallbackNextAt` 按行情时间推进；live=时钟、replay=历史数据时间）。
- **触发条件（每组独立）**：该城市/日期组**当前没有持仓**（买过又全部卖掉也算空仓）；**其他城市有持仓不影响本城市**，已持仓的组本周期跳过。
- **动作**：对本组可交易候选（过滤：closed / 非 acceptingOrders / 无 YES 卖价 / 概率超出 `universe.minPrice..maxPrice` / 点差 > `universe.maxSpread`）按 **YES 隐含概率降序**：
  - **第 1 高** → `BUY YES`
  - **第 3 高** → `BUY NO`（组内候选不足 3 个时只做第 1 笔）
- **资金/仓位**：城市组按“组内最高概率”降序依次尝试；`maxPositions` 或现金不足时停止本次循环，剩余城市在后续周期继续（不会因为某个城市持仓而阻止其他城市建仓）。
- **执行约束**：与正常入场一致——`sizingValue` 名义额、`maxPositionUsd`、`maxPositions`/`maxPositionsPerMarket`、现金 ≥ 名义额+手续费、价格保护、逐档成交、官方 taker 费；不绕过风控。被拒会记录 `status=rejected` 的 Trade。
- **记录**：成交的 `Trade.reason = "fallback_entry"`（前端显示「兜底建仓」），不产生 Signal（`signalsCount` 不变）。
- **推荐配置**：若希望每个城市都能算真实第 3 高，使用 `universe.selectionMode="per_event"`，并放宽价格带/点差/流动性（示例：`minPrice=0.02, maxPrice=0.98, maxSpread=0.05, minLiquidityUsd=200, maxMarkets=120..200`）。否则严格过滤会把每个城市 11 个括号筛到 1–3 个，第 3 高 NO 腿基本不触发（实测：严格过滤 40 组仅 9 组≥3 个候选；放宽后 48 组中 45 组≥3 个）。
- **关闭**（默认 `false`）时行为与旧版完全一致。

## 4. 退出规则

### 4.1 触发量（每个 tick 对每个持仓独立评估）

```
bid         = 持仓 token 最新 bestBid            // 可执行卖出价，不用 mid
exitFee     = calcTakerFee(shares, bid)
netProceeds = shares*bid - exitFee
retLiqPct   = (netProceeds/costBasis - 1)*100
holdSec     = (now - entryTs)/1000
```

- `holdToResolution=true`：不做主动退出评估（TP/SL/maxHold/反向均不生效），只在结算时按 1/0 兑付（§4.3）。
- `holdToResolution=false`：按 §4.2 优先级判断，**每 tick 每个持仓最多发一笔卖单**；部分成交后剩余下一 tick 继续评估；无 bid 则本 tick 不退出（`no_liquidity` 重试）。

### 4.2 优先级（同时满足取编号小者）

1. **结算/兑付**（市场 closed/resolved）——终态，见 §4.3；
2. **止损** `retLiqPct ≤ -stopLossPct`（`stop_loss`，优先于止盈，跳空时不误执行）；
3. **止盈** `retLiqPct ≥ takeProfitPct`（`take_profit`）；
4. **超时** `holdSec ≥ maxHoldSec`（`max_hold`）；
5. **反向信号** `exitOnOppositeSignal=true` 且该市场出现与持仓方向相反且已确认的信号（`opposite_signal`）。

> TP/SL 用**费用后净收益率**（相对含入场费的 costBasis），不是裸价阈值；这样“看起来 +50%、费用后 +46%”不会误触发。前端可另示裸价阈值：`p_tp ≈ (1+tp/100)×costBasis/shares + 费用修正`。

### 4.3 结算（`resolution`）

- **结算时点**：温度市场的**实际交易截止 = 观察日 24:00 UTC（次日 00:00Z）**（Gamma `endDate` 的观察日 12:00Z 不是真实截止；CLOB 价格历史显示交易/更新持续到次日 00:00Z 之后）。官方裁决紧随其后：**观察日次日 00:00 UTC 后首份 METAR**，最迟**次日 23:59 ET**，先到为准。实测：Nov 7 伦敦市场在 `2026-11-08T00:41Z`（24:00 UTC 后 41 分钟）closed 并给出 `outcomePrices`。
- **当前实现（live）**：每 20 秒通过 Gamma `/markets/<id>` 轮询；当 `closed=true` 且 `outcomePrices` 明确为 `["1","0"]` / `["0","1"]`（或极罕见 50/50）时兑付；未裁决则标记 `resolution_pending=true` 并继续轮询。CLOB WS `market_resolved` 事件目前未接入（可作为增强）。
- 二元市场赢家 1.0 USD/股、输家 0（极罕见 50/50 按 0.50 兑付）；`cash += payout`，**结算不收费**，`realizedPnl = payout - costBasis`，Trade 记 `reason=resolution`，随后删除持仓。
- negRisk 温度组应恰有一个 YES；若出现 0/多个 winner（异常或未定），持仓按最后 mid 保留并标记 `resolution_pending=true`，继续轮询，不虚构成交。
- **运行生命周期**：只要还有未结算持仓，run 保持 running 持续轮询；全部平仓且所有市场 `closed` 或超过 `endDate + 6h` 才自动 `ended`。
- **停止/重启后的结算恢复**：live 运行被手动停止，或服务重启把运行标记为 stopped 后，只要 journal 里仍有未平仓持仓，系统会从 `data/runs/<id>.jsonl` 回放成交重建持仓，并继续每 20s 轮询官方裁决；兑付后自动补记 `reason=resolution` Trade、更新现金/权益/指标与 `pendingSettlements/settledPositions`，看板与历史会显示「待结算 N」→「已结算 N」。
- **回放**：不做结算（无 live resolutionProvider），历史数据结束即 `ended`，持仓按最后 mid 估值，报告标注 `openPositionsAtEnd`。

## 5. 仓位与组合账本（mark-to-market）

### 5.1 现金与持仓

- `cash=bankrollUsd`；BUY：`cash-=notional+fee`；SELL：`cash+=notional-fee`；结算：`cash+=payout`（无费）。
- `costBasis=Σ买入 notional+Σ买入 fee`（费用进成本），`avgPrice=costBasis/shares`（**含费均价=盈亏平衡概率**，不可当裸成交价用于价格触发）。
- 部分平仓：`costBasisPortion=costBasis×(sellShares/shares)`；`realizedPnl=(notional-exitFee)-costBasisPortion`；剩余 `costBasis-=portion`、`shares-=sellShares`；`shares=0` 删除持仓。`Trade.realizedPnl` 仅 SELL 非 0，`feesPaid=Σtrade.fee`。

### 5.2 盯市与权益

| 量 | 规则 |
|---|---|
| `midPrice` | 优先该 token 自身双边 mid；否则用 `1-对侧mid`；否则沿用上一有效 mark（`stale=true`，不归零） |
| `marketValue` | `shares×midPrice`（浮动盈亏用 mid） |
| `unrealizedPnl` | `marketValue-costBasis`（成本含买入费，不含未发生的卖出费） |
| `Position.estExitFee` | `calcTakerFee(shares, mid)`，仅展示；退出触发用 §4.1 的 bid 与费用 |
| `equity` | `cash+ΣmarketValue`；恒等式 `equity = bankroll + realizedPnl + unrealizedPnl` 必须成立 |
| 权益采样 | 每 tick 与每次成交后更新；`EquityPoint{ts,equity,cash,positionsValue,realizedPnl,unrealizedPnl,drawdownPct}` |
| `drawdownPct` | `(peakEquity-equity)/peakEquity×100`，峰值只升不降 |
| `dailyPnl` | `equity-dayStartEquity`，`dayStartEquity` 在 UTC 00:00 记一次（回放跨日同样重置） |

## 6. 风控（前置检查顺序固定）

每个入场信号按序检查，任一失败即拒单并记录对应原因；**先风控、后下单**：

1. `killSwitchTripped` 或 run 已停止 ⇒ `risk_blocked`；
2. 回撤：`drawdownPct ≥ maxDrawdownPct` ⇒ 熔断；
3. 日亏：`dailyLossLimitUsd>0 && dailyPnl ≤ -dailyLossLimitUsd` ⇒ 熔断；
4. 市场级过滤（价格带、spread、stale、acceptingOrders、TTR）；
5. 仓位上限：`openPositions ≥ maxPositions` / 该市场持仓数 ≥ `maxPositionsPerMarket`；
6. 现金/预算：`budgetUsd ≥ 最小可成交成本`（含费），否则 `insufficient_cash`；
7. 执行可行性：目标侧有量、价格在保护价与价格带内（§3）。

熔断行为（`killSwitch=true`）：置 `killSwitchTripped=true`，`run.status=stopped`，停止 tick 与新订单；MVP **不强制平仓**，最终报告分列已实现/浮动盈亏（对齐 docs/04；`risk_kill_switch` 保留为未来强制平仓模式的退出原因，本 MVP 不产生该成交）。`killSwitch=false`：仅广播告警，不阻断。恢复需人工新建 run。

---

## 7. 边界情况（必须覆盖）

| 场景 | 处理 |
|---|---|
| 盘口单边/缺失 | mid 类样本无效、不产生信号；BUY 需 asks、SELL 需 bids，否则 `no_liquidity`/`stale_market`；不得用最后价硬成交 |
| locked/crossed（bid≥ask） | 坏盘口：不产生信号、不成交，等待下一快照 |
| 点差过宽 | `requireSpreadOk=true` 时信号层抑制；执行层再查，`spread_too_wide` |
| 行情 stale / 数据缺口 | 超 `max(3×tickIntervalMs,5000)` 不产生信号、不开仓；持仓按最后有效 mid 估值；恢复后重新累积样本（缺口前样本不参与，除非满足 §2.2 容差） |
| 暂停接单 / enableOrderBook=false | 不开仓、不平仓（无法成交），持仓保留盯市；恢复后重新评估 |
| 持仓期间市场结算 | 立即按 §4.3 兑付平仓（`resolution`），无手续费；结算后不再产生信号 |
| 结算结果暂不可判 | 标记 `resolution_pending`，继续轮询，不用 0/1 猜测 |
| 重复/乱序行情 | 同 hash 去重、旧 ts 丢弃；信号去重见 §2.3 |
| 重复信号 | confirmation+re-arm+cooldown+maxSignalsPerMarket+同 tick 单信号 |
| 市场临近关闭 | `ttr<minTimeToResolutionSec` 不开新仓；剩余持仓按 §4.3 结算 |
| 回放数据结束 | run 结束，未结算持仓按最后 mid 估值并标注；禁止未来价格 |
| WS 断线/降级 | feedStatus=degraded/offline；暂停开仓，恢复后按新快照继续，不补造行情 |
| 未来时间戳/时钟偏移 | 样本 `ts>now+2000ms` 丢弃；成交以引擎 tick 时间为准 |
| 数值精度 | 价格按 tick 对齐；份额 0.01 股；仅费用 5dp；比较用 `1e-9` 容差 |

---

## 8. 伪代码（JS-like，与 docs/06 tick 循环一致）

```js
function onTick(now) {
  refreshFeed();                                  // 新快照写入 quoteStore，标记 stale
  for (const market of selectedMarkets()) {
    updateSamples(market, now);                   // §2.1 追加/去重/乱序过滤
    for (const pos of openPositionsOf(market)) planExit(pos, market, now);
    executePlannedExits(now);                     // 卖出成交 + 账本
    const sig = evaluateSignal(market, now);      // §2.2-2.4
    if (sig) executeEntry(sig, market, now);      // §3 + §6 风控前置
  }
  markToMarket(now);                              // §5.2 权益/回撤/日亏，必要时熔断停机
  emitEvents();
}

function evaluateSignal(market, now) {
  const s = series(market.yesTokenId);            // 只用 YES 序列
  const pNow = s.latest(); if (!pNow) return null;
  if (now - pNow.ts > Math.max(3*cfg.sim.tickIntervalMs, 5000)) return null;      // stale
  const pRef = s.latestAtOrBefore(now - cfg.signal.windowSec*1000);
  if (!pRef || s.countInWindow(now, cfg.signal.windowSec) < 2) return null;
  if (now - pRef.ts > cfg.signal.windowSec*1000 + Math.max(2000, cfg.sim.tickIntervalMs)) return null;
  if (pRef.price < Math.max(0.01, cfg.universe.minPrice)) return null;
  if (pNow.price > Math.min(0.99, cfg.universe.maxPrice)) return null;
  if (cfg.signal.requireSpreadOk && market.spread > cfg.universe.maxSpread) return null;
  const ret = (pNow.price/pRef.price - 1)*100, abs = pNow.price - pRef.price;
  const up   = ret >=  cfg.signal.moveThresholdPct && abs >=  cfg.signal.minAbsMove && cfg.signal.direction !== "down";
  const down = ret <= -cfg.signal.moveThresholdPct && abs <= -cfg.signal.minAbsMove && cfg.signal.direction !== "up";
  if (!up && !down) { confirmReset(market); return null; }
  const dir = up ? "up" : "down";
  if (!bumpConfirm(market, dir)) return null;     // confirmationTicks + re-arm
  if (now < lastEntryByDir.get(key(market,dir)) + cfg.signal.cooldownSec*1000) return null;
  if (entryCount(market) >= cfg.signal.maxSignalsPerMarket) return null;
  return { marketId: market.id, direction: dir, outcome: up ? "YES" : "NO",
           tokenId: up ? market.tokens.yesTokenId : market.tokens.noTokenId,
           fromPrice: pRef.price, toPrice: pNow.price, changePct: ret, absChange: abs,
           windowSec: cfg.signal.windowSec, priceField: cfg.signal.priceField };
}

function executeEntry(sig, market, now) {
  const risk = preRiskChecks(market, sig, now);    // §6 顺序检查
  if (!risk.ok) return recordRejectedTrade(sig, risk.reason, now);
  const book = market.book(sig.tokenId);
  if (!book || book.stale) return recordRejectedTrade(sig, "stale_market", now);
  if (book.asks.length === 0) return recordRejectedTrade(sig, "no_liquidity", now);
  const limit  = ceilToTick(Math.min(0.999, book.bestAsk*(1 + cfg.execution.slippageBufferBps/10000)), market.tickSize);
  const budget = computeBudget(sig, market, now);  // §3.2
  const fill   = walkBook(book.asks, "BUY", budget, limit);         // §3.3
  if (fill.shares < market.minOrderShares) return recordRejectedTrade(sig, "below_min_order", now);
  let fee = calcTakerFee(fill.shares, fill.vwap);
  while (fill.notional + fee > budget + 1e-9 && fill.shares - 0.01 >= market.minOrderShares) { trimOneLot(fill); fee = calcTakerFee(fill.shares, fill.vwap); }
  if (fill.notional + fee > budget + 1e-9) return recordRejectedTrade(sig, "insufficient_cash", now);
  cash -= fill.notional + fee;
  upsertPosition({ tokenId: sig.tokenId, shares: fill.shares, costBasis: fill.notional + fee,
                   entryTs: now, entryFee: fee, outcome: sig.outcome, marketId: market.id });
  lastEntryByDir.set(key(market, sig.direction), now); bumpEntryCount(market);
  recordTrade({ ...sig, side: "BUY", price: fill.vwap, notional: fill.notional, fee,
                status: fill.partial ? "partial" : "filled", reason: "signal" });
}

function planExit(pos, market, now) {
  if (market.closed) return planSettlement(pos, market);            // 优先级 1
  if (cfg.exit.holdToResolution) return null;                       // 持有到结算
  const bid = market.quote(pos.tokenId).bid;
  if (!bid || bid <= 0) return null;                                // no_liquidity，下 tick 重试
  const net = pos.shares*bid - calcTakerFee(pos.shares, bid);
  const ret = (net/pos.costBasis - 1)*100, hold = (now - pos.entryTs)/1000;
  if (ret <= -cfg.exit.stopLossPct) return planSell(pos, "stop_loss");      // 2
  if (ret >=  cfg.exit.takeProfitPct) return planSell(pos, "take_profit");  // 3
  if (hold >= cfg.exit.maxHoldSec) return planSell(pos, "max_hold");        // 4
  if (cfg.exit.exitOnOppositeSignal && oppositeConfirmed(market, pos, now))
    return planSell(pos, "opposite_signal");                                // 5
  return null;
}

function planSettlement(pos, market) {             // payout 1/0（或 0.5），无费
  const payout = market.winningOutcome === pos.outcome ? pos.shares : 0;
  cash += payout; realizedPnl += payout - pos.costBasis;
  recordTrade({ side: "SELL", price: payout/pos.shares, shares: pos.shares,
                notional: payout, fee: 0, reason: "resolution" });
  removePosition(pos);
}

function markToMarket(now) {
  let pv = 0, unr = 0;
  for (const p of positions) {
    p.midPrice = markPrice(p); p.marketValue = p.shares*p.midPrice;
    p.unrealizedPnl = p.marketValue - p.costBasis; pv += p.marketValue; unr += p.unrealizedPnl;
  }
  const equity = cash + pv;
  peakEquity = Math.max(peakEquity, equity);
  if (cfg.risk.killSwitch && (drawdownPct(equity) >= cfg.risk.maxDrawdownPct
      || dailyLossBreached(equity))) { killSwitchTripped = true; stopRun("risk_kill_switch"); }
  pushEquityPoint(now, equity, cash, pv, realizedPnl, unr);
}
```

---

## 9. 三档预设策略（完整 JSON + 参数表 + 预期频率）

| 参数 | 保守 conservative | 均衡 balanced | 激进 aggressive |
|---|---|---|---|
| windowSec / moveThresholdPct / minAbsMove / confirmationTicks | 120 / 25 / 0.02 / 2 | 60 / 20 / 0.01 / 1 | 30 / 12 / 0.005 / 1 |
| cooldownSec / maxSignalsPerMarket | 600 / 3 | 300 / 5 | 120 / 8 |
| universe 价格带 / maxSpread / minLiquidityUsd / maxMarkets | 0.05–0.95 / 0.02 / 1000 / 8 | 0.02–0.98 / 0.03 / 500 / 12 | 0.01–0.99 / 0.05 / 200 / 20 |
| sizing / maxPositionUsd / maxPositions / maxPositionsPerMarket | fixed 20 / 40 / 3 / 1 | fixed 25 / 50 / 5 / 1 | fixed 50 / 100 / 8 / 1 |
| TP / SL / maxHoldSec / holdToResolution / exitOnOppositeSignal | 40 / 25 / 1800 / false / false | 50 / 30 / 3600 / false / false | 80 / 50 / 900 / false / false |
| bankroll / maxDrawdown / dailyLoss / tickIntervalMs / speed | 1000 / 15 / 100 / 1000 / 10 | 1000 / 20 / 100 / 1000 / 10 | 2000 / 35 / 200 / 500 / 10 |
| **预期成交频率（4 城市×3 括号≈12 活跃市场，1–2 次/秒更新，中低流动性）** | **2–6 笔/日** | **5–12 笔/日** | **15–40 笔/日** |

> 频率为数量级估计，须用回放实测校准：`信号/日 ≈ Σ市场[P(|窗口收益|≥阈值)×有效时段/窗口]`，再被 cooldown、maxSignals、风控截断。往返 taker 费约 `2×0.05×p(1-p)`（p=0.5 时≈2.5% 名义额），外加点差，必须看回放含费净值。

**保守 · 高概率区间**

```json
{
  "id": "conservative", "label": "保守 · 高概率区间",
  "config": {
    "version": 1, "name": "保守 · 高概率区间", "description": "只看 5¢-95¢ 高流动性区间，2 次确认 + 长冷却，弱化噪声信号。",
    "universe": { "cities": [], "maxMarkets": 8, "minPrice": 0.05, "maxPrice": 0.95, "minLiquidityUsd": 1000, "maxSpread": 0.02, "minTimeToResolutionSec": 900, "maxTimeToResolutionSec": 129600, "onlyAcceptingOrders": true },
    "signal": { "priceField": "mid", "windowSec": 120, "moveThresholdPct": 25, "minAbsMove": 0.02, "direction": "both", "confirmationTicks": 2, "cooldownSec": 600, "maxSignalsPerMarket": 3, "requireSpreadOk": true },
    "execution": { "orderType": "market", "sizingMode": "fixed_stake", "sizingValue": 20, "maxPositionUsd": 40, "maxPositions": 3, "maxPositionsPerMarket": 1, "fillModel": "book_walk", "slippageBufferBps": 0 },
    "exit": { "takeProfitPct": 40, "stopLossPct": 25, "maxHoldSec": 1800, "holdToResolution": false, "exitOnOppositeSignal": false },
    "risk": { "bankrollUsd": 1000, "maxDrawdownPct": 15, "dailyLossLimitUsd": 100, "killSwitch": true },
    "fees": { "model": "weather_taker", "takerFeeRate": 0.05 },
    "sim": { "mode": "live", "tickIntervalMs": 1000, "replayLookbackMin": 60, "speed": 10 }
  }
}
```

**均衡 · ±20%/1min 动量（需求基线）**

```json
{
  "id": "balanced", "label": "均衡 · ±20%/1min 动量",
  "config": {
    "version": 1, "name": "均衡 · ±20%/1min 动量", "description": "需求原文策略的稳健实现：1 分钟 ±20% 且最小绝对变动 1¢，单笔 $25、最多 5 个仓位。",
    "universe": { "cities": [], "maxMarkets": 12, "minPrice": 0.02, "maxPrice": 0.98, "minLiquidityUsd": 500, "maxSpread": 0.03, "minTimeToResolutionSec": 900, "maxTimeToResolutionSec": 129600, "onlyAcceptingOrders": true },
    "signal": { "priceField": "mid", "windowSec": 60, "moveThresholdPct": 20, "minAbsMove": 0.01, "direction": "both", "confirmationTicks": 1, "cooldownSec": 300, "maxSignalsPerMarket": 5, "requireSpreadOk": true },
    "execution": { "orderType": "market", "sizingMode": "fixed_stake", "sizingValue": 25, "maxPositionUsd": 50, "maxPositions": 5, "maxPositionsPerMarket": 1, "fillModel": "book_walk", "slippageBufferBps": 0 },
    "exit": { "takeProfitPct": 50, "stopLossPct": 30, "maxHoldSec": 3600, "holdToResolution": false, "exitOnOppositeSignal": false },
    "risk": { "bankrollUsd": 1000, "maxDrawdownPct": 20, "dailyLossLimitUsd": 100, "killSwitch": true },
    "fees": { "model": "weather_taker", "takerFeeRate": 0.05 },
    "sim": { "mode": "live", "tickIntervalMs": 1000, "replayLookbackMin": 60, "speed": 10 }
  }
}
```

**激进 · 30s 高频动量**

```json
{
  "id": "aggressive", "label": "激进 · 30s 高频动量",
  "config": {
    "version": 1, "name": "激进 · 30s 高频动量", "description": "30 秒窗口、12% 阈值、快速冷却，追求交易频次；费用拖累和回撤显著放大。",
    "universe": { "cities": [], "maxMarkets": 20, "minPrice": 0.01, "maxPrice": 0.99, "minLiquidityUsd": 200, "maxSpread": 0.05, "minTimeToResolutionSec": 900, "maxTimeToResolutionSec": 129600, "onlyAcceptingOrders": true },
    "signal": { "priceField": "mid", "windowSec": 30, "moveThresholdPct": 12, "minAbsMove": 0.005, "direction": "both", "confirmationTicks": 1, "cooldownSec": 120, "maxSignalsPerMarket": 8, "requireSpreadOk": true },
    "execution": { "orderType": "market", "sizingMode": "fixed_stake", "sizingValue": 50, "maxPositionUsd": 100, "maxPositions": 8, "maxPositionsPerMarket": 1, "fillModel": "book_walk", "slippageBufferBps": 0 },
    "exit": { "takeProfitPct": 80, "stopLossPct": 50, "maxHoldSec": 900, "holdToResolution": false, "exitOnOppositeSignal": false },
    "risk": { "bankrollUsd": 2000, "maxDrawdownPct": 35, "dailyLossLimitUsd": 200, "killSwitch": true },
    "fees": { "model": "weather_taker", "takerFeeRate": 0.05 },
    "sim": { "mode": "live", "tickIntervalMs": 500, "replayLookbackMin": 60, "speed": 10 }
  }
}
```

> **同步要求**：本文预设 `holdToResolution=false`（使 TP/SL 生效）。`shared/contract.js` 当前保守/均衡预设继承默认 `true`，与本文不一致；建议同步改为 `false`（或明确保留“持有到结算”变体）。预设值变更须同时更新 contract.js、docs/07、本文。

---

## 10. 验收清单（实现/QA 必跑）

1. **Schema**：三档预设均 `validateStrategy.valid=true`；未知字段忽略、数字字符串强转；`version≠1` 报错；`holdToResolution=true` 的配置不产生 TP/SL 成交。
2. **+20%/60s**：构造 `mid` 0.200→0.240，`windowSec=60, moveThresholdPct=20, minAbsMove=0.01, confirmationTicks=1` ⇒ 产生且仅产生 1 条 UP 信号，`outcome=YES`。
3. **-20%/60s**：0.200→0.160 ⇒ DOWN 信号，`outcome=NO`。
4. **阈值边界**：19.9% 不触发；恰好 20.0% 触发；`absMove` 不足 `minAbsMove` 不触发。
5. **低价退化**：0.002→0.003（+50%）不触发（硬地板 0.01）；`p_ref=0.02→0.03` 若 ask 越界则 `risk_blocked`。
6. **确认/冷却/上限**：`confirmationTicks=2` 单 tick 不触发、连续 2 tick 触发；cooldown 内同向不再触发；`maxSignalsPerMarket` 到达后无新信号。
7. **最小样本/缺口**：窗口内仅 1 个样本、参考点滞后超容差、stale 行情 ⇒ 均无信号。
8. **价格字段**：`last` 在从未成交（占位 0.5/空 side）时不产生信号；单边盘口下 mid 无效。
9. **映射**：UP 单走 YES asks、DOWN 单走 NO asks；不得用 `1-yesMid` 造 NO 成交价。
10. **逐档 VWAP**：asks `[0.50×10, 0.52×20]`、预算 $20 ⇒ 依次吃档，VWAP/notional/fee 与手算一致；部分成交 `status=partial` 且剩余撤销。
11. **最小单**：市价 BUY 名义额 <$1（无股数下限）或市价 SELL <5 股 ⇒ `below_min_order`，不产生成交；限价单 5 股规则不适用。
12. **费用**：100 股 @0.50 ⇒ `calcTakerFee=1.25000`；费用一律按成交 VWAP 用 `calcTakerFee()` 计算、`<0.00001` 记 0；BUY 现金支出=notional+fee，SELL 现金收入=notional-fee。
13. **费用后盈亏**：示例 B `costBasis=24.99774`，bid=0.40 时 `retLiqPct≈52.6%`，`takeProfitPct=50` 触发 `take_profit`。
14. **退出优先级**：同时满足 SL/TP/maxHold ⇒ 先 `stop_loss`；`holdToResolution=false` 时 TP/SL/maxHold/反向均生效；`true` 时只在结算 `resolution` 兑付。
15. **结算**：赢家 `cash+=shares`、无手续费、`realizedPnl` 正确；输家 `-costBasis`；50/50 按 0.5；异常 winner ⇒ `resolution_pending` 不虚构成交。
16. **账本恒等式**：任意时刻 `equity = bankroll + realizedPnl + unrealizedPnl`（误差<1e-6）；部分平仓后 costBasis/avgPrice 正确；`feesPaid=Σtrade.fee`。
17. **风控**：回撤/日亏越线 ⇒ `status=stopped` + `risk_kill_switch`，停止开仓与订单、**不强制平仓**，报告分列已实现/浮动；日亏跨 UTC 00:00 重置；`killSwitch=false` 只告警。
18. **边界**：空盘口/单边/暂停接单/closed 市场不产生幽灵成交；stale 恢复后重新积累样本；回放无 look-ahead（篡改未来样本不影响既有信号）。
19. **确定性**：同一 fixture 回放两次，信号/成交/费用/权益逐字段一致；`speed` 只影响墙钟耗时不改变结果。
20. **频率/成本报告**：预设回放输出“信号数、成交数、换手、feesPaid、feeDragPct、含费净收益”；禁止只报毛收益。
