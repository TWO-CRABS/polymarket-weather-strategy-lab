# 04 · 产品规范：策略验证、费用核算与 P&L 口径

> 项目：Polymarket 城市最高温度市场 · 策略验证系统（Paper Trading）
> 角色：产品人员（product-manager）｜版本 v1.0｜状态：可评审｜日期：2026-11-08
> 依赖：`docs/02-strategy-parameters.md`、`docs/03-strategy-spec.md`、`docs/06-architecture.md`、`docs/07-api-contract.md`、`shared/contract.js`
> 效力：字段名、默认值、枚举以 `07-api-contract.md` + `shared/contract.js` 为唯一事实来源；本文件定义**产品口径与算法**（费用、成本、P&L、指标、验收）。若与契约冲突，以契约为准并同步修订本文；本文新增而未进契约的指标一律标注「派生（不影响契约）」。

## 1. 产品概述

### 1.1 一句话
把 Polymarket 每个城市最高温度括号市场变成**可组合参数的策略试验台**：用户拼出一条短线动量规则（如“60 秒内价格上涨 20% 立即买入 UP”），系统用官方只读行情、按真实订单簿逐档撮合并**逐笔扣除官方 taker 手续费**，实时回答一个问题——**扣掉点差和手续费后，这条策略到底还有没有正期望**。

### 1.2 目标用户与价值
| 用户 | 他们想知道的 | 我们给出 |
|---|---|---|
| 有交易经验、想验证短线规则的人 | 我脑筋里的信号扣费后还赚不赚 | 含费 P&L、费用拖累、胜率/盈亏比/期望值 |
| 天气市场玩家 | 同一事件多个温度括号怎么组合更稳 | 括号阶梯、概率和校验、结算兑付口径 |
| 策略评审/内容作者 | 不同参数版本哪个更好、能不能复现 | 运行快照、多运行对比、可复现报告 |

### 1.3 “验证”的准确含义
- **对象**：用户组合出来的规则型策略（`StrategyConfig`），不是人的盘感，也不是对天气的预测能力。
- **数据**：Polymarket 官方公开只读接口（Gamma 元数据、CLOB 盘口/中间价、Data API 历史分钟价用于 replay），不造行情、不补假成交。
- **撮合**：市价单按**真实订单簿逐档吃单**（`fillModel: "book_walk"`），tick 0.001；市价 BUY 最低 **$1 名义额（无股数下限）**；市价 SELL **无最小股数**（官方 UI 可卖出 1.1 份）；允许部分成交、点差与深度滑点真实发生。
- **成本**：官方 taker 费（Weather `feeSchedule.rate = 0.05`，`takerOnly: true`）逐笔计入现金；maker 返佣不适用于我们的 taker 单。
- **产出**：一次可复现的运行 = 策略快照 + 数据窗口 + 逐笔成交（含费用/滑点）+ 持仓快照 + 权益曲线 + 指标 + 成本归因。
- **判定**：只回答“在含费口径下是否有统计意义上的正期望”，**不承诺未来盈利，也不构成投资建议**。

### 1.4 非目标（MVP 明确不做）
| 非目标 | 说明 |
|---|---|
| 真实下单/资金托管 | 不签名、不接钱包、不存私钥、不向 CLOB 提交订单（安全边界见 `docs/06` §4） |
| 天气预测模型 | 只把 METAR/预报作为可选上下文展示，不用于下单信号（MVP 不接入） |
| 多用户 SaaS | 单机单用户，无账户体系、无云端部署 |
| 链上成本模拟 | 不模拟 gas、出入金、UMA 争议期的资金占用 |
| 高频做市/撤单博弈 | 只做 taker 市价单；maker 挂单与返佣在 roadmap |
| 盈利承诺 | 任何界面/报告不得出现“稳赚”“保证收益”等表述 |

## 2. 用户画像与核心场景

| 画像 | 背景与目标 | 核心场景 | 成功标准 |
|---|---|---|---|
| **P1 独立量化研究者「阿哲」** | 写过回测，第一次接触预测市场；想验证“1 分钟 ±20% 动量”这类社媒热门规则 | 用默认预设起跑 → 看逐笔成交与费用 → 把阈值/窗口/冷却改几版 → 对比含费收益与费用拖累 | 10 分钟内跑出 3 个版本的对比，能明确说出“是点差还是手续费吃掉了利润” |
| **P2 天气市场玩家「文姐」** | 熟悉温度括号与结算规则，关心事件整体概率结构 | 盯同一城市的括号阶梯，看概率和是否偏离 100%；观察临近结算时段的报价跳变与结算兑付 | 能判断某括号的价格是否被低估、持仓到结算的兑付是否算对 |
| **P3 策略评审/内容作者「小柯」** | 要给读者展示“这条策略行不行”，需要可复现证据 | 保存策略 → 固定 replay 窗口跑一遍 → 导出报告（指标、权益曲线、费用瀑布）→ 对比不同时段 | 报告能被第三方按同一配置复现，结论只依赖含费指标 |

**核心场景清单**：S1 快速否定一个费后不赚钱的直觉规则；S2 参数扫描与同口径对比；S3 盯盘观察实时成交、持仓与隐含概率；S4 复盘费用拖累、回撤与结算；S5 用 replay 复现某段行情下的表现。

## 3. 用户故事与验收标准

| ID | 用户故事 | 验收标准（可测） |
|---|---|---|
| US-01 | 作为研究者，我要用分组参数组合出一条策略，这样不用写代码也能表达规则 | 打开构建器可修改 `universe/signal/execution/exit/risk/fees/sim` 全部字段；改动即时反映在 JSON 预览；字段名与 `07` 契约一致；非法值被限制在 `LIMITS` 区间内 |
| US-02 | 我要在启动前知道策略配置是否合法、有没有费后必亏的退化设置 | `POST /api/strategies/validate` 返回 `{valid, errors[], warnings[], normalized}`；`errors` 阻止启动并逐条定位字段；`warnings` 允许继续但必须展示（含“低价区间 ±20% 被点差+手续费吞噬”的提示，判据见 §5.10） |
| US-03 | 我要保存、加载、复制策略，还能从预设一键开始 | 策略 CRUD 走 `/api/strategies`；保存后 `GET` 可原样取回（`deepMerge` 归一化后语义等价）；3 个预设（保守/均衡/激进）可一键载入并可在其基础上另存为新策略 |
| US-04 | 我要启动一次实时模拟（或历史回放），看到系统开始工作 | `POST /api/runs` 201 返回 `RunSummary.status ∈ starting→running`；启动前置检查失败时返回明确错误码（如 `NO_MARKETS`）；replay 模式在固定窗口可重复得到同一结果 |
| US-05 | 我要随时停止运行，且停止后不再产生新订单 | `POST /api/runs/:id/stop` 幂等，状态 `running→stopping→stopped`；停止后 2s 内不再新增成交；已开仓不强制平仓，报告中分列已实现/浮动 |
| US-06 | 我要实时看到成交明细与信号触发 | SSE 事件 `signal`、`trade`、`positions`、`equity`、`metrics`、`run` 持续推送；成交列表按时间倒序，含方向/份额/成交价/费用/状态；断线重连后通过 REST 补齐（`07` §5） |
| US-07 | 我要看清每一笔交易被收了多少手续费、点差和滑点各占多少 | 每笔成交展示 `price`、`shares`、`notional`、`fee`（5 位小数）、`slippageCost`、含费现金变动；运行报告展示“参考盈亏 − 点差 − 深度滑点 − 手续费 = 含费净盈亏”的瀑布；四项之和与净盈亏误差 < 0.01 USDC |
| US-08 | 我要看持仓、市值、浮动盈亏与当前隐含概率 | 持仓表含 `shares/avgPrice/costBasis/midPrice/marketValue/unrealizedPnl/estExitFee/impliedProbability`；`avgPrice` 为**含费均价**（= 盈亏平衡概率）；概率按 §6.4 规则显示 |
| US-09 | 我要在结束后拿到一份可复现的运行报告 | 报告含：策略快照、`mode`/时间窗口/`initialCapital`、指标全量、权益曲线、成交全表、成本归因、拒单统计、免责声明；`GET /api/runs/:id` 可复核全部数字 |
| US-10 | 我要并排比较多次运行，判断哪组参数更好 | 支持选 2–4 个 run 对比；统一口径（同 `initialCapital`、按权益曲线叠图、指标同表）；对比页必须展示费用拖累与最大回撤，避免只看收益率 |
| US-11 | 作为天气市场玩家，我要确认持仓到结算时兑付算得对 | 市场 `closed` 后按官方结果兑付：赢家 1.00 USDC/股、输家 0（极罕见 50/50 按 0.50），**结算不收费**；生成 `reason=resolution` 的平仓记录，`realizedPnl = payout − costBasis` |

## 4. 端到端流程

### 4.1 主流程与门禁
| # | 阶段 | 用户动作 | 系统行为 | 通过条件/门禁 |
|---|---|---|---|---|
| 1 | **策略构建 Builder** | 选城市/价格带/点差上限、设信号（`priceField`/`windowSec`/`moveThresholdPct`…）、仓位、退出、风控 | 参数面板 + JSON 预览 + 预设载入 | 所有字段在 `LIMITS` 内 |
| 2 | **校验 Validation** | 点“校验/启动” | `validateStrategy()` → `errors/warnings/normalized`；计算“最低盈利涨幅门槛”（§5.10） | `errors` 为空；`warnings` 已展示并确认 |
| 3 | **启动运行 Run** | 选 `mode=live` 或 `replay`，设 `initialCapital=risk.bankrollUsd` | 前置检查：行情可用、市场 `acceptingOrders`、非 stale、`NO_MARKETS` 判定；创建 run 并开始 tick | `starting→running`；`feedStatus ∈ live/degraded` |
| 4 | **实时看板 Dashboard** | 看行情网格、信号流、成交、持仓、权益曲线、指标卡 | 每 tick 评估信号/退出 → 撮合 → 记账 → 采样 → SSE 推送 | 成交/持仓/权益/指标四类事件在 1s 内更新 |
| 5 | **成交详情 Detail** | 点开某笔成交 | 展示成交价 vs 决策时报价、消耗档位 `bookLevels`、`fee`、`slippageCost`、`realizedPnl`、拒单原因 | 每笔可追溯到触发信号 `signalId` 或退出原因 `reason` |
| 6 | **报告与对比 Report/Compare** | 停止或自然结束后查看报告、勾选多个 run 对比 | 固化 run 快照，生成指标/曲线/成本归因/拒单统计 | 报告数字与运行期 SSE 末值一致（误差 < 0.01 USDC） |

### 4.2 运行状态机
`created → starting → running → (paused) → stopping → stopped`；自然结束（全部市场结算/回放结束）为 `ended`；异常为 `error`。契约枚举见 `07` §3.7，前端不得自造状态。

### 4.3 实时刷新与仿真撮合约定
- **tick**：live 默认 1s（`sim.tickIntervalMs`），replay 由历史数据点驱动，同一引擎逻辑（`docs/06` §6.1）。
- **撮合**：每个 tick 用**当时最新快照**撮合，不做人为延迟；BUY 吃 asks 由低到高、SELL 吃 bids 由高到低，VWAP 成交价，`slippageBufferBps` 为价格保护（超出即不吃）。真实网络延迟/排队风险列为 roadmap 的“悲观模式”。
- **新鲜度**：单市场超过 `max(3×tickInterval, 5s)` 无更新即 `stale`，禁止新开仓，持仓按最后中间价估值并标记。
- **实时通道**：服务端 CLOB WS 为主、REST 轮询兜底；浏览器用 SSE（`07` §5），断线指数退避并补拉快照。
- **replay**：用 Data API 历史分钟价回放，`replayLookbackMin` 必须大于 `windowSec/60`，保证滚动收益有样本。

### 4.4 报告内容清单（MVP 必须全有）
策略快照与参数摘要｜运行元信息（mode、起止、initialCapital、marketsTracked、feedStatus）｜指标全量（§6.2）｜权益曲线与回撤曲线｜成交全表（含 fee/slippage）｜成本瀑布与费用拖累｜持仓与结算兑付记录｜拒单统计（按 `rejectReason` 分组）｜免责声明。

## 5. 费用与成本核算规范

### 5.1 官方费用模型（Weather）
| 项 | 值 | 来源 |
|---|---|---|
| `feeType` | `weather_fees` | Gamma 市场字段 |
| `takerFeeRate` | **0.05** | 官方费率表（Weather 5%） |
| `makerFeeRate` | 0 | makers 永不收费 |
| `makerRebateRate` | 0.25 | 25% 的 taker 费返还给挂单方 |
| `exponent` | 1 | `fee ∝ p × (1−p)` |
| `takerOnly` | true | 仅吃单方付费 |
| 取整 | 5 位小数，half-up | 官方“Fee Precision” |
| 最小非零费 | 0.00001 USDC | 官方“anything smaller rounds to zero” |

系统默认用户**永远是 taker**（全部市价单），所以：`makerFeeRate=0` 对用户无意义，`makerRebateRate` **不能**从用户费用中扣减。费用参数优先读市场 `feeSchedule`，缺失时回退到 `shared/contract.js` 的 `FEES`。

### 5.2 公式
```
fee_raw = shares × 0.05 × p × (1 − p)          # p = 实际成交价 VWAP
fee     = round_half_up(fee_raw, 5)
if fee < 0.00001: fee = 0                      # 极小单在极端价位可免收
```
两个可直接用于校验的恒等式：
- **对称性**：`fee(p) == fee(1−p)`（30¢ 与 70¢ 同价）。
- **费率占成交额比例**：BUY 时 `fee / notional = 0.05 × (1−p)`；因此越便宜的份额费率越高（p=0.05 时达成交额的 4.75%）。

### 5.3 100 shares 工例（可直接做单测断言）
| p | notional | fee_raw = 5·p·(1−p) | fee（5dp） | fee/notional |
|---|---|---|---|---|
| 0.05 | 5.00 | 0.23750 | **0.23750** | 4.75% |
| 0.30 | 30.00 | 1.05000 | **1.05000** | 3.50% |
| 0.50 | 50.00 | 1.25000 | **1.25000** | 2.50% |
| 0.70 | 70.00 | 1.05000 | **1.05000** | 1.50% |
| 0.95 | 95.00 | 0.23750 | **0.23750** | 0.25% |

### 5.4 取整、精度与存储
| 场景 | 输入 | 规则 | 结果 |
|---|---|---|---|
| 常规 | 100 shares @0.30 | 5dp half-up | 1.05000 |
| 小单 | 1 share @0.50 | 0.0125 → 0.01250 | 0.01250 |
| 半位进位 | 1 share @0.99 | 0.000495 → 0.00050 | 0.00050 |
| 极端价位 | 1 share @0.9999 | 0.0000049995 → 0.00000 | **0（免收）** |
| 浮点陷阱 | 100×0.05×0.3×0.7 | JS 得 1.0500000000000003 | 必须用 `roundTo()` → 1.05000 |

**硬性要求**：费用计算必须调用 `shared/contract.js` 的 `calcTakerFee()` / `roundTo()`，禁止各模块自行实现；内部累计金额不做逐步取整（避免漂移），仅展示层取整；单笔费用展示 5 位小数，聚合展示 2 位（`07` §1）。现金/权益内部精度 ≥ 6 位小数。

### 5.5 Maker 返佣说明
Maker 返佣 = 25% × 该笔 taker 费，由挂单方获得，资金来自多收的 taker 费。我们的模拟单永远是 taker：**返佣收入 = 0，且不得从 `feesPaid` 中扣减 25%**。若 roadmap 引入限价 maker 单，必须显式切换 `liquidityRole: maker` 并单独计量返佣收入，不得混入现有含费 P&L。

**Taker Rebate Program（2026-05-28 上线）**：官方按 30 天加权成交量分 7 档（Bronze 3% / Silver 8% / Gold 18% / Platinum 32% / Diamond 44% / Obsidian 50%），返佣按日以 pUSD 发放；Weather 类别权重 1.7，只有实际支付 taker 费的成交才计入加权量。当前模拟器**默认按“无返佣账户”（0%）**计费，未扣除返佣；如需模拟高等级账户，应新增独立的 `fees.takerRebateRate`（0–50%）并单独展示“预估返佣”，避免把它与 maker 返佣混为一谈。

### 5.6 点差成本（spreadCost，归因项）
以决策时盘口为基准，衡量“立即成交”相对于公平价的损失：
```
spreadCost = shares × | bestQuote − mid |
  BUY : bestQuote = bestAsk, mid = (bestBid+bestAsk)/2
  SELL: bestQuote = bestBid
```
例：mid=0.20、bid=0.19、ask=0.21，买 100 股 → spreadCost = 100×0.01 = 1.00 USDC（占成交额 4.76%）。点差成本天然 ≥ 0；盘口交叉等异常快照按 0 处理并打日志。

### 5.7 订单簿滑点（slippageCost，契约字段）
`Trade.slippageCost` 按 `docs/06` §6.2 的参考价定义，衡量**深度冲击**：
```
slippageCost = shares × | price − referencePrice |
  BUY : referencePrice = bestAsk（决策时）；SELL: referencePrice = bestBid
```
例：买 200 股，asks = 0.21×100、0.22×100 → VWAP 0.215，bestAsk 0.21 → slippageCost = 200×0.005 = 1.00。此时相对 mid（0.20）的总执行损耗 = 点差 2.00 + 深度滑点 1.00 = 3.00。**点差与滑点是两段互不重叠的损耗，合计 = 成交价相对 mid 的全部不利偏移。**

### 5.8 结算兑付（resolution payout）
- 持仓到结算：赢家 **1.00 USDC/股**、输家 **0**（极罕见 50/50 按 0.50）兑付。
- 兑付**不收任何手续费**，不产生点差/滑点；`realizedPnl = payout − costBasis`，`cash += payout`，`reason=resolution`。
- 结算前最后一刻的 `midPrice` 只用于展示浮动盈亏，**不得**用 mid 代替官方结果；结算结果以市场 `closed` + 官方 outcome 为准。
- 结算回合也计入 `closedTrades` 与胜率统计。

### 5.9 总成本分解与“什么算成本”
```
参考盈亏 refMidPnl   = Σ shares × (exitReferencePrice − entryMid)   # exitReferencePrice 为平仓 mid 或结算兑付 0/1
− 点差成本 spreadCost  = Σ shares × |bestQuote − mid|
− 深度滑点 slippageCost= Σ shares × |price − bestQuote|
− 手续费 feesPaid      = Σ fee
= 含费净盈亏 netPnl    = equity − initialCapital
```
四项互斥、可加；**点差与滑点已包含在成交价里，禁止在 P&L 中二次扣减**——账本只需按 VWAP 记成交额 + 单独扣 fee，归因表只是解释项。

| 计入交易成本 | 不计入（MVP） |
|---|---|
| taker 手续费（逐笔，含卖出） | maker 费（taker 永不收；返佣是收入不是折扣） |
| 点差成本（归因） | 链上 gas、出入金费用（模拟不涉及） |
| 深度滑点（归因） | 资金时间价值/托管费 |
| — | 数据订阅、API 费用（公开只读免费） |

**总交易成本** `totalFriction = feesPaid + spreadCost + slippageCost`；`成本率 = totalFriction / turnoverUsd`（派生展示）。

### 5.10 回合工例与“最低盈利涨幅门槛”
以 100 股为例，mid 由 0.20 涨到 0.24（+20%），入场 ask 0.21、出场 bid 0.23：
- 参考盈亏 refMidPnl = 100×(0.24−0.20) = **4.00**
- 点差成本 = 1.00（入）+ 1.00（出）= **2.00**
- 手续费 = 0.82950（买 @0.21）+ 0.88550（卖 @0.23）= **1.71500**
- 含费净盈亏 = 4.00 − 2.00 − 1.71500 = **0.28500**（对应含费成本 21.8295 的 +1.31%）
→ **一个 +20% 的价格波动，92.9% 被点差和手续费吃掉。** 这正是本产品要替用户提前算清的事。

因此校验器必须计算“最低盈利涨幅门槛”，并在 `moveThresholdPct` 不足时给 warning：
```
minProfitableMovePct ≈ 2 × (halfSpread + 0.05 × p × (1−p)) / p × 100%
```
| p | 点差 | 门槛涨幅 | 结论（对比常见 ±20%） |
|---|---|---|---|
| 0.05 | 0.01 | 29.5% | ±20% **必然亏** |
| 0.10 | 0.01 | 19.0% | 临界，几无利润 |
| 0.20 | 0.02 | 18.0% | 勉强 |
| 0.30 | 0.02 | 13.7% | 可行但依赖胜率 |
| 0.50 | 0.02 | 9.0% | 相对健康 |

判据：`minProfitableMovePct > moveThresholdPct` → warning「该价位 ±X% 不足以覆盖点差+双边手续费」；`minAbsMove` 未设或过小（< 0.01）在低价区也触发警告（与 `contract.js` 现有 warning 一致，本文件给出量化判据）。

### 5.11 含费 P&L 的展示规范
1. **主口径永远是含费**：现金在成交瞬间已扣 fee，`equity = cash + Σ(shares×mid)`，`totalReturnPct = (equity − initialCapital)/initialCapital×100`。任何默认指标卡、排行榜、结论分级均使用含费口径。
2. **同时提供对照**：交易明细/报告中显示“不含费（毛）盈亏”时，必须与含费值并排且加标签；不含费曲线（派生：`equity + feesPaid`）用虚线，图例明确。
3. **费用可见性**：指标卡固定展示 `feesPaid` 与 `feeDragPct`；成交行展示 5 位小数的 `fee`；成本瀑布展示点差/滑点/手续费三段。
4. **禁止口径混用**：不得用 mid→mid 的参考盈亏当作策略收益；不得在含费 P&L 上再叠加“预计手续费”。

## 6. P&L 与指标定义

### 6.1 账本状态与恒等式
| 量 | 定义 |
|---|---|
| `initialCapital` | 运行初始资金 = `risk.bankrollUsd`（默认 1000），运行期间不变 |
| `cash` | `initialCapital − Σ(notional+fee)_BUY + Σ(notional−fee)_SELL + Σ payout`；BUY 成交即扣费 |
| `positionsValue` | `Σ shares_i × mid_i`（`midPrice`，无持仓为 0） |
| `equity` | `cash + positionsValue`；**唯一的净值口径，天然含费** |
| `costBasis` | `Σ notional + Σ entryFee`（**含费成本**）；`avgPrice = costBasis / shares`（含费均价 = 盈亏平衡概率） |
| `realizedPnl` | 每笔平仓：`(notional − fee)_SELL − costBasis_portion`；`costBasis_portion = costBasis × 平仓份额/持仓份额`（按比例，无重估） |
| `unrealizedPnl` | `Σ(shares × mid − costBasis)`；结算兑付后为 0 |
| `estExitFee` | `shares × 0.05 × mid × (1−mid)`，仅展示“若此刻市价平仓的预估费”，**不计入权益** |

**恒等式（QA 每 tick 断言，误差 < 1e-6）**：
```
equity == cash + positionsValue
equity − initialCapital == realizedPnl + unrealizedPnl
feesPaid == Σ trade.fee                     # 含全部已成交买/卖/无结算费
```
首笔买入瞬间必然出现“浮亏 ≈ fee + 点差”，这是正确现象，不是 bug；产品文案需解释“开仓即亏”的来源。

### 6.2 指标定义（契约字段 + 派生）
| 指标 | 类型 | 公式/口径 | 工例（§6.5） |
|---|---|---|---|
| `totalReturnPct` | 契约 | `(equity − initialCapital)/initialCapital × 100` | 1.2518% |
| `netPnl` | 派生 | `equity − initialCapital` | 12.5180 |
| `realizedPnl` / `unrealizedPnl` | 契约 | 见 §6.1 | 12.5180 / 0 |
| `feesPaid` | 契约 | 全部 `trade.fee` 之和 | 4.4820 |
| `trades` | 契约 | **成交笔数**（`filled`/`partial`，一笔部分成交计 1 笔）；`rejected` 不计 | 5 |
| `closedTrades` | 契约 | 平仓回合数：持仓份额归零计 1 次（含结算） | 3 |
| `winRate` | 契约 | `盈利回合数 / closedTrades`；`realizedPnl > 0` 为盈，`=0` 计平局但仍进分母 | 66.67% |
| `avgWin` / `avgLoss` | 契约 | 盈利回合 `realizedPnl` 均值 / 亏损回合绝对值均值 | 9.83475 / 7.15150 |
| `profitFactor` | 契约 | `Σ盈利 / abs(Σ亏损)`；无亏损 → `null`，展示“—” | 2.7504 |
| `expectancy` | 契约 | `Σ realizedPnl / closedTrades`（等价于 `winRate×avgWin − lossRate×avgLoss`） | 4.17267 |
| `sharpe` | 契约 | 将权益曲线按 Δ **等间隔重采样**，`r_i = equity_i/equity_{i-1} − 1`；`rf = 0`；`μ/σ`（`σ` 用样本标准差 ddof=1）；年化 `×√(365×86400/Δ)`；`Δ = 5 × tickIntervalMs`（默认 5s，因子 ≈2511.4）；**样本 < 30 → `null` 展示“—”** | 6 个样本 → null |
| `maxDrawdownPct` | 契约 | `max_t (peak_t − equity_t)/peak_t × 100`，`peak_t` 为历史最高 equity | 0.7014% |
| `exposureUsd` | 契约 | 当前 `positionsValue`（持仓市值敞口） | 0 |
| `turnoverUsd` | 契约 | 双边成交额 `Σ abs(notional)`（买+卖都计） | 213.00 |
| `feeDragPct` | 契约 | `feesPaid / initialCapital × 100`（**注意分母是本金**，见 `07` §3.6） | 0.4482% |
| `roiOnCapital` | 派生 | `netPnl / avgCapitalDeployed`；`avgCapitalDeployed` = 权益采样点上 `Σ costBasis` 的时间加权均值 | 29.98% |
| `capitalUtilizationPct` | 派生 | `avgCapitalDeployed / initialCapital × 100` | 4.17% |
| `turnoverMultiple` | 派生 | `turnoverUsd / initialCapital` | 0.213× |
| `feeDragBps` | 派生 | `feesPaid / turnoverUsd × 10000`（每单位成交额被抽走多少） | 210.42 bps |
| `tradeSharpe` | 派生 | 逐回合收益率 `realizedPnl/costBasis` 的 `μ/σ`（不年化，仅参考） | 0.505 |
| `impliedProbability` | 契约 | 见 §6.4 | 见 §6.4 |
| `avgBreakevenProb` / `edgePp` | 派生 | 见 §6.4 | 52.35% / +14.32pp |
| `minProfitableMovePct` | 派生 | 见 §5.10，校验器与报告展示 | 视 p 而定 |
| `suggestedVerdict` | 派生 | 见 §7.3，**仅参考** | 观察 |

> 派生指标不进入 `Metrics` 契约，由服务端/前端从权益曲线与成交明细计算，报告页与对比页展示；如需进契约须先改 `07` 与 `contract.js`。

### 6.3 费用拖累的正确读法
- `feeDragPct` 回答“**本金被费用侵蚀了百分之几**”，适合看绝对成本；`feeDragBps` 回答“**每 1 USDC 成交额被抽走多少**”，适合比较不同换手策略；`feesPaid / grossExecPnl` 回答“**费用吃掉了多少毛利润**”（工例 4.482/17.00 = 26.36%）。
- 三者必须同时出现，否则“低费率高频”策略容易被误判（换手越高，`feeDragPct` 越接近本金量级）。
- 只有 taker 费计入；不得用 25% maker 返佣或任何 taker rebate 计划去美化结果。

### 6.4 概率与 edge 的展示
- **隐含概率**：`impliedProbability = mid`（YES 中间价）；展示为 `xx.x%`。遵循 Polymarket 展示规则：点差 > 0.10 时改用 `last` 最后成交价并加“最后成交价”徽标；两者都缺失显示“—”。
- **NO 侧概率**：必须用 NO token 自己的盘口 `mid`，**不得**用 `1 − YES.mid` 代替（买卖价差与手续费使两者不等）；同屏展示 YES/NO 双边 `bid/ask/mid`。仅当该侧盘口缺失、无法估值时，允许按 `docs/03` §5.2 用 `1 − 对侧mid` 兜底并标注「估算」，且该值不得用于成交与信号。
- **括号阶梯**：同一事件互斥括号（`negRisk`）按温度升序排列，展示各自 `impliedProbability` 与“概率和 Σ”；`|Σ−1| > 0.05` 时提示“概率和偏离 100%（可能含价差/未定价括号）”。
- **盈亏平衡概率**：`breakevenProb = avgPrice = costBasis/shares`——因为赢家每股兑付 1.00，含费成本价在数值上就是胜率盈亏平衡点。
- **edge**：`edgePp = hitRate − avgBreakevenProb`（单位为百分点）；`EV/share = edgePp`（兑付 1.00 时同值）。工例：3 回合命中率 66.67%，平均盈亏平衡概率 52.35% → 正 edge +14.32pp。
- 报告需给出“**入场概率分桶 vs 实际命中率**”表（如 0–10%、10–20%…），让用户看到“高价买入但胜率不足”的典型亏损来源。

### 6.5 口径工例（Golden fixture，供 QA 构造断言）
`initialCapital = 1000`；mid/point 取决策时快照。
| # | 动作 | 份额 | 成交价 | 参考 mid | 成交额 | fee | 现金变动 | 持仓市值 | equity |
|---|---|---|---|---|---|---|---|---|---|
| T1 | BUY YES | 100 | 0.21 | 0.20 | 21.00 | 0.82950 | −21.82950 | 20.00 | 998.1705 |
| T2 | SELL YES | 100 | 0.24 | 0.25 | 24.00 | 0.91200 | +23.08800 | 0 | 1001.2585 |
| T3 | BUY NO | 50 | 0.62 | 0.61 | 31.00 | 0.58900 | −31.58900 | 30.50 | 1000.1695 |
| T4 | 结算（NO 赢） | 50 | 1.00 | — | 50.00 | 0 | +50.00000 | 0 | 1019.6695 |
| T5 | BUY YES | 100 | 0.71 | 0.70 | 71.00 | 1.02950 | −72.02950 | 70.00 | 1017.6400 |
| T6 | SELL YES | 100 | 0.66 | 0.67 | 66.00 | 1.12200 | +64.87800 | 0 | 1012.5180 |
| — | 合计 | — | — | — | 213.00 | **4.48200** | — | — | **1012.5180** |

结果：`realizedPnl = 1.2585 + 18.4110 − 7.1515 = 12.5180`；`unrealizedPnl = 0`；`netPnl = 12.5180`；`totalReturnPct = 1.2518%`；`trades=5`、`closedTrades=3`、`winRate=66.67%`、`profitFactor=2.7504`、`expectancy=4.172667`、`maxDrawdownPct=0.7014%`、`turnoverUsd=213.00`、`feeDragPct=0.4482%`。成本瀑布：`refMidPnl 21.50 − spreadCost 4.50 − slippage 0 − fee 4.482 = 12.518`。若假设持仓时长 T1/T3/T5 分别为 1/4/2 分钟，则 `avgCapitalDeployed = 41.7492`、`roiOnCapital = 29.98%`、`capitalUtilizationPct = 4.17%`。

### 6.6 边界与异常口径
| 场景 | 口径 |
|---|---|
| 现金不足 / 市价买入名义额 < $1 / 市价卖出股数 ≤0 | 拒单（`insufficient_cash`/`below_min_order`），不产生成交、不扣费，仅计入拒单统计与 SSE `trade.status=rejected` |
| 部分成交 | 以实际 `shares` 记账与收费；剩余量作废并记录；不足 5 shares 的残余拒单 |
| 盘口空/单边/交叉 | 拒单 `no_liquidity`/`spread_too_wide`；持仓按最后 mid 估值，不产生“幽灵成交” |
| 市场 `stale`/停牌/`closed` | 禁止新开仓；已开仓按最后 mid 估值，等待结算兑付 |
| 回撤/单日亏损熔断 | `status=stopped` + `reason=risk_kill_switch`；MVP **不强制平仓**，报告分列已实现/浮动；恢复需人工重启新 run |
| 运行中断（进程重启） | run 标记 `stopped` 并提示；已落盘 JSONL 可复核到最后一笔 |
| 结算时仍有未成交委托 | MVP 无挂单，不存在 |
| 四舍五入 | 仅 `fee` 按 5dp 取整；金额累计不取整；展示层取整导致 ±0.01 属允许误差 |

## 7. 验收标准与范围

### 7.1 验收标准（QA 可执行）
| ID | 断言 |
|---|---|
| AC-01 | `100 × 0.05 × 0.05 × 0.95 = 0.23750`，且 `100@0.30=1.05000`、`100@0.50=1.25000`、`100@0.70=1.05000`、`100@0.95=0.23750`（精确相等，非近似） |
| AC-02 | 取整 half-up 5dp：`1@0.99 → 0.00050`；`1@0.9999 → 0`（< 最小费）；JS 浮点 `100*0.05*0.3*0.7 → 1.05000` |
| AC-03 | 任何 `trade.fee == calcTakerFee(trade.shares, trade.price)`；`fee` 用成交价而非 mid；卖出同样收费 |
| AC-04 | 若由真值表构造 maker 成交，则 `fee=0` 且不出现负费用；`feesPaid` 不含任何返佣抵扣 |
| AC-05 | 每 tick：`abs(equity − (cash + positionsValue)) < 1e-6` 且 `abs(equity − initialCapital − realizedPnl − unrealizedPnl) < 1e-6` |
| AC-06 | Golden fixture（§6.5）重放：`equity=1012.518`、`feesPaid=4.482`、`realizedPnl=12.518`、`winRate=66.67%`、`profitFactor=2.7504`、`maxDrawdownPct=0.7014%`，误差 < 0.01 USDC |
| AC-07 | 每笔成交可展开：`price`/`bookLevels`/`fee`/`slippageCost`/`cashDelta`/`signalId`/`reason`；成本瀑布四项之和等于 `netPnl`（< 0.01 USDC） |
| AC-08 | `POST /api/runs` → `starting→running`；`stop` 幂等且 2s 内不再有新成交；停止/结束生成报告，字段齐全（§4.4） |
| AC-09 | 对比 2–4 个 run：同表展示 `totalReturnPct/feesPaid/maxDrawdownPct/winRate/profitFactor/turnoverUsd`，权益曲线可叠加，口径标注含费 |
| AC-10 | 概率展示：`spread ≤ 0.10` 用 mid、`> 0.10` 用 last；NO 用 NO 盘口 mid；括号概率和校验显示 Σ 与偏离提示 |
| AC-11 | 校验器：当 `minProfitableMovePct > moveThresholdPct` 返回对应 warning；合法配置返回 `valid=true` 且 `normalized` 回填默认值 |
| AC-12 | `tickSize=0.001` 强制执行；市价 BUY 名义额 ≥ `$1`（**无股数下限**）、市价 SELL **无最小股数**；低于买入门槛或空盘口的成交只可出现为 `rejected` |
| AC-13 | 静态检查：无钱包/私钥/签名/下单代码路径；所有上游请求为公开只读（GET/WS 订阅），无鉴权头 |
| AC-14 | 报告与 UI 页脚均含免责声明（§8）；界面无“保证盈利/稳赚”类文案 |
| AC-15 | 指标边界：无亏损时 `profitFactor=null`（显示“—”）、样本 < 30 时 `sharpe=null`、无持仓时 `unrealizedPnl=0`，不得输出 `Infinity`/`NaN` |
| AC-16 | 同一 replay 配置连续跑两次（固定 fixture 与时钟）得到相同成交序列与指标（除时间戳） |
| AC-17 | live 运行中，市场 `endDate` 已过且官方裁决返回 resolved 时，**仍持有的仓位自动按 1/0（罕见 0.5）兑付**：`cash += payout`、持仓删除、Trade `reason=resolution` 且 `fee=0`，`realizedPnl/closedTrades/winRate/totalReturnPct` 等指标同步正确；全部平仓且市场 closed 后运行自动 `ended`（`tests/settlement.test.js`） |
| AC-18 | 市场 closed 但裁决未出时持仓保留并标记 `resolution_pending=true`，继续每 20s 轮询、不虚构成交；回放模式不做结算（结束时持仓按最后 mid 估值并标注 `openPositionsAtEnd`） |
| AC-19 | **停止/重启后恢复结算**：live 运行被手动停止或服务重启后，只要 journal 中仍有未平仓持仓，系统从 journal 回放重建持仓并继续轮询官方裁决；兑付后补记 `reason=resolution` Trade 并更新现金/权益/指标，`pendingSettlements → 0`、`settledPositions` 递增（`tests/settlementRecovery.test.js`） |
| AC-20 | 看板/历史对存在待结算或已结算的运行显示「待结算 N / 已结算 N」标识；停止后详情页仍能看到未结算持仓（从 journal 重建） |
| AC-21 | 每周期兜底按**城市/日期事件组独立**：每个空仓城市组各自买「组内概率第 1 高 YES + 第 3 高 NO」，某城市已有持仓只跳过该城市、不阻止其他城市建仓；城市组按组内最高概率降序消费资金/仓位（`tests/engine.test.js`） |
| AC-22 | live 只选当天（UTC 观察日）市场；按城市事件纳入全部可交易括号，不设 `maxMarkets`，选市场阶段不按价格/流动性/点差过滤（`tests/selection.test.js`） |
| AC-23 | 实时看板的「成交明细」「当前持仓」市场列链接到官方事件页 `https://polymarket.com/zh/event/<eventSlug>`（`eventSlug` 来自市场快照）；无 slug 时退化为纯文本 |
| AC-24 | 成交明细支持「分组」（不分组/城市/市场/方向/YES-NO/原因）与「筛选」（按分组值过滤）；分组行显示每组笔数，badge 显示 `过滤后/总数` |
| AC-25 | 温度市场实际**交易截止 = 城市本地观察日 24:00（次日当地 00:00，DST 感知）**（快照 `tradingCutoff`）；看板显示「交易截止 当地 24:00」「预计结算 当地 24:00 后（首份 METAR）」；TTR/入场风控/结算轮询均使用该截止（`tests/market-time.test.js`） |
| AC-26 | 成交明细、当前持仓的市场列与信号流卡片均显示**交易日 MM/DD**（区分同一城市不同日期）；选中市场标题、成交/持仓市场链接、信号城市名称均跳转官方事件页 |
| AC-27 | 点击成交行 / 持仓行 / 信号卡会切换「选中市场」，同步更新走势图与市场详情，并在三处高亮同一市场（行/卡片 `is-selected`，支持 Enter/Space 键盘） |
| AC-28 | 每周期兜底的排名**只按城市组内 YES 隐含概率**（不因点差过滤改变名次，兜底执行不受 maxSpread 拦截；正常信号入场仍保留点差过滤）；实测深圳 26°C 57% 点差 6¢ 时仍应为第 1 高、25°C 为第 3 高 |
| AC-29 | 最低/最高 YES、最小流动性、最大点差仅在下单时校验（新增 `liquidity_too_low` 拒绝原因）；被拒绝不改变市场发现与排名（`tests/engine.test.js`） |
| AC-30 | 按城市本地观察日滚动：活跃 marketIds 只替换已跨本地日的城市、旧市场关闭、旧仓位保留并继续结算、权益/成交连续，同一 run 不重启（`tests/rolling.test.js`、`tests/selection.test.js`） |
| AC-31 | 动量成立但价格带/点差禁止入场时，默认记录 `kind="observation"` 的不可交易观察信号；不产生订单/手续费/成交，信号流可按入场/观察筛选（`tests/engine.test.js`） |
| AC-32 | 策略构建器“市场范围”按当前 UTC 偏移（DST 感知）**升序**分组城市；每组显示 `时区(UTC±HH:MM)` 与当地日期时间，并支持一键全选/取消该组（`tests/city-timezones.test.js`） |
| AC-33 | 策略构建器每个城市 chip 提供 Polymarket 官方事件外链，按**城市本地观察日**生成（如 UTC 已到 11/10 但洛杉矶仍是 11/9）；点击外链不改变城市勾选状态（`tests/city-events.test.js`） |
| AC-34 | rejected entry 保存拒单瞬间 `marketSnapshot`（bid/ask/spread/流动性），成交详情优先显示该快照而不是当前行情（`tests/engine.test.js`） |
| AC-35 | 成交明细支持按状态筛选：全部 / 已成交 / 部分成交 / 已拒绝；状态筛选与分组筛选可叠加，分组为「不分组」时仍可用（看板 `tradeStatusFilter`） |
| AC-36 | 兜底失败 leg 保留 pending 并在每个观察窗口按原目标重试，直到成交/截止；同组其他 leg 已成交不阻止失败 leg 重试（`tests/engine.test.js`） |
| AC-37 | 成交明细 rejected 记录显示详细拒绝原因（实际点差/流动性 vs 配置阈值、价格带、TTR 等），并优先使用拒单瞬间快照；旧记录无快照时回退当前行情（`tests/engine.test.js`） |

### 7.2 MVP 与 roadmap
| 范围 | 内容 |
|---|---|
| **MVP（本期）** | 策略构建器（universe/signal/execution/exit/risk/fees/sim 全参数）；校验（errors+warnings+门槛提示）；策略库 CRUD + 3 预设；live/replay 运行；实时看板（行情/信号/成交/持仓/权益/指标）；逐笔费用与成本归因；运行报告；2–4 run 对比；结算兑付；安全边界（只读、无密钥） |
| **Roadmap V1.1** | 悲观模式（注入 300–800ms 延迟、部分成交/拒单概率）、maker 限价单 + 返佣计量、参数扫描（网格自动跑多组）、CSV/JSON 导出、括号组合策略（概率和套利模板） |
| **Roadmap V1.2** | 天气上下文信号（METAR 实测 vs 括号边界距离、预报偏差）、波动率/成交量特征、事件级组合风控、策略分享链接与只读报告页 |
| **明确不做** | 真实下单与资金托管、天气预测模型、多用户/云服务、法币出入金、保证收益类产品 |

### 7.3 验证结论分级（派生建议，仅参考）
| 结论 | 参考阈值（均可配置） |
|---|---|
| **有效（有正期望证据）** | `closedTrades ≥ 30` 且运行 ≥ 60min 且 `netPnl > 0` 且 `tradeSharpe > 0` 且 `feesPaid/grossExecPnl < 50%` 且 `maxDrawdownPct < 15%` |
| **观察（证据不足）** | `10 ≤ closedTrades < 30`，或指标互相矛盾（如收益正但 PF < 1.2） |
| **无效** | `netPnl ≤ 0`，或 `feesPaid ≥ grossExecPnl`（费用吃掉全部毛利润），或 `maxDrawdownPct ≥ 熔断阈值` |
| 展示要求 | 结论旁必须附样本量与运行时长；样本不足时只显示“样本不足”，不得给出“有效” |

### 7.4 可复现性要求
每次运行必须固化：`StrategyConfig` 快照（含 `version`）、`CONTRACT_VERSION`、`mode` 与数据窗口、`initialCapital`、`tickIntervalMs`、数据源与 `feedStatus` 时间线、`feesPaid` 口径版本。报告顶部展示这些元信息，保证第三方可按同配置复现。

## 8. 风险与合规提示

1. **纯模拟，不涉真实资金**：系统不接钱包、不存私钥、不签名、不向 Polymarket 提交任何订单；所有“成交”均为本地按公开盘口模拟。UI 与报告中固定展示：「模拟交易（Paper Trading），不涉及真实资金」。
2. **不构成投资建议**：指标、结论分级、对比结果仅供策略研究；预测市场交易存在本金全损风险；历史/模拟表现不代表未来收益。禁止将报告包装为收益承诺或代客理财宣传。
3. **数据风险**：行情来自官方公开接口，可能延迟、限流、断线或字段缺失；`stale` 行情下成交与估值可能与真实市场不符；点差与深度基于快照，真实成交可能更差（滑点被低估）。
4. **模型风险**：MVP 未模拟网络延迟、订单排队、撤单竞争、maker 返佣与 taker rebate；高频策略的模拟结果通常**优于**真实表现，必须向用户明示。
5. **结算风险**：温度市场依赖官方气象站数据与 UMA 裁决，可能出现延迟结算、规则澄清、极罕见 50/50；结算前估值仅为中间价。
6. **合规与条款**：遵守 Polymarket 服务条款与当地法规；系统仅使用公开只读数据，不绕过地区限制、不抓取非公开接口。单机单用户，不收集个人数据。
7. **文案红线**：不得出现“稳赚”“保证收益”“无风险套利”等表述；所有收益数字必须与费用口径同时出现（“含手续费后”）。
