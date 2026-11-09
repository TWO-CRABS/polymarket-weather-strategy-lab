# 06 · 系统架构设计

> 项目：Polymarket 城市最高温度市场 · 策略验证系统（实时模拟交易 / Paper Trading）
> 角色：开发人员（Lead 主导，backend-dev / frontend-dev 实现）
> 版本：v1.0 · 2026-11-08

---

## 1. 目标与非目标

### 目标
1. 使用 **Polymarket 官方 API**（Gamma + CLOB + Data API）获取城市最高温度市场的实时行情。
2. 用户可以组合市场参数形成策略，启动 **实时模拟（paper trading）**，系统按真实盘口模拟市价单成交并计入官方 taker 手续费。
3. 前端实时展示：行情、信号、成交明细、持仓、盈亏、概率、费用、指标曲线。
4. 用同一套引擎支持 **回放（replay）** 模式，便于复现验证与自动化测试。
5. 全链路可测试、可本地一键启动、可开源发布。

### 非目标（明确不做）
- 不接真实资金、不签名、不托管私钥、不向 CLOB 提交真实订单。
- 不做天气预测模型（只把 METAR/预报作为可选上下文展示）。
- 不做用户账户体系（单机单用户）。
- 不保证盈利；系统输出的所有指标仅供策略研究。

---

## 2. 总体架构

```
┌───────────────────────────── 浏览器 UI (web/, 零构建 ES Modules) ─────────────────────────────┐
│  Strategy Builder   Live Dashboard   Run History/Compare   Strategy Library                  │
│  参数编辑/校验       行情网格·信号·成交·持仓·权益曲线·指标      历史运行对比      预设策略      │
│        └──────────────────────────────┬───────────────────────────────────────────────┘     │
│                         REST fetch / SSE EventSource (/api/*)                                │
└────────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                              Node 22 HTTP Server (server/, 零运行时依赖)                       │
│                                                                                              │
│  api.js ── SSE Hub (sse.js) ── RunManager (engine/run.js) ── Store (store.js, JSON 持久化)      │
│     │                              │                                                         │
│     │                    ┌─────────┴──────────┐                                              │
│     │                    ▼                    ▼                                              │
│     │              Signal Evaluator     Portfolio Ledger                                       │
│     │              (engine/signal.js)   (engine/portfolio.js)                                 │
│     │                    │                    │                                              │
│     │                    ▼                    ▼                                              │
│     │              Risk / Execution    Metrics Aggregator                                    │
│     │              (engine/execution.js) (engine/metrics.js)                                  │
│     │                    │                    │                                              │
│     ▼                    ▼                    ▼                                              │
│  data/feed.js ── live: CLOB WebSocket + REST poll │  replay: prices-history                   │
│        │                │                          │                                          │
│        ▼                ▼                          ▼                                          │
│  data/gamma.js      data/clob.js               data/replay.js      data/weather.js（可选）     │
│  事件/市场发现       盘口/中间价/成交            历史分钟价           METAR/预报上下文            │
└────────┬──────────────────────┬────────────────────────┬────────────────────────────────────┘
         │                      │                        │
   gamma-api.polymarket.com  clob.polymarket.com   data-api.polymarket.com
         │                      │                        │
         └────────────── 官方公开 API（无需鉴权，只读） ─────┘
```

**一句话数据流**：Gamma 发现温度事件/括号市场 → CLOB（WS 优先，REST 轮询兜底）维护每 token 的盘口/价格序列 → 信号评估器按滚动窗口算涨跌幅 → 风控与市价单模拟器按真实盘口逐档成交并扣官方手续费 → 组合账本更新现金/持仓/已实现与浮动盈亏 → 指标聚合 → SSE 推送 → 前端实时渲染。

**WS 分批订阅**：`data/feedWs.js` 按城市把当前跟踪市场拆成多个 CLOB market WebSocket 连接（默认 `WS_CITIES_PER_CONNECTION=20`，约 20 个城市/连接）；每个连接发送该批城市全部 YES/NO token 的 `assets_ids`，城市集合变化时只对受影响连接重发订阅，连接失败单独重连并由 REST `/books`（500 token/批）兜底。

---

## 3. 目录结构

```
PolyMarket Wealther Strategy Verification System/
├── 需求.txt
├── README.md                      # 启动方式、功能说明、架构速览
├── docs/                          # 需求、研究、策略、产品、UI、架构、契约
│   ├── 02-strategy-parameters.md  # 策略专家 A：可量化参数分类学
│   ├── 03-strategy-spec.md        # 策略专家 B：DSL / 信号 / 退出 / 风控语义
│   ├── 04-product-spec.md         # 产品：费用模型、成本核算、P&L 定义、验收标准
│   ├── 05-ui-spec.md              # UI：设计规范
│   ├── 06-architecture.md         # 本文件
│   └── 07-api-contract.md         # 前后端接口契约（单一事实来源）
├── shared/
│   └── contract.js                # 契约常量、默认策略、校验、费率函数、预设策略（无依赖）
├── server/
│   ├── index.js                   # HTTP 启动、静态文件、路由挂载、优雅退出
│   ├── config.js                  # 端口/轮询/数据源等环境配置
│   ├── api.js                     # REST 路由实现
│   ├── sse.js                     # SSE Hub（心跳、广播、按 run 订阅）
│   ├── store.js                   # strategies / runs 元数据 + 运行明细 JSONL
│   ├── data/
│   │   ├── gamma.js               # 事件与市场发现、字段归一化
│   │   ├── clob.js                # /book /books /midpoint /price /spread 适配
│   │   ├── feed.js                # 实时行情编排：WS + 轮询兜底、健康度
│   │   ├── replay.js              # prices-history 回放数据源
│   │   └── weather.js             # 可选：METAR / Open-Meteo 上下文
│   └── engine/
│       ├── fee.js                 # 官方手续费模型 + 舍入（调用 shared/contract.js）
│       ├── signal.js              # 滚动窗口涨跌幅信号 + 去重/冷却/确认
│       ├── execution.js           # 市价单逐档成交（VWAP）、部分成交、拒单
│       ├── portfolio.js           # 现金/持仓/已实现/浮动盈亏/结算
│       ├── metrics.js             # 收益、胜率、盈亏比、Sharpe、最大回撤等
│       ├── strategy.js            # 策略校验/归一化/预设（复用 shared/contract.js）
│       └── run.js                 # 运行生命周期（live/replay）、tick 调度、事件发布
├── web/                           # 零构建前端（原生 ES Modules + Canvas 图表）
│   ├── index.html
│   ├── styles.css
│   ├── app.js                     # 路由与页面装配
│   ├── api.js                     # REST + SSE 客户端
│   └── views/                     # builder.js / dashboard.js / history.js / library.js
├── design/prototype/              # UI 静态原型（设计参考，可独立打开）
├── tests/                         # node:test 单元 + 集成测试 + fixtures
├── scripts/                       # dev 启动、verify 冒烟脚本
└── data/                          # 运行期数据（git 忽略）
```

**写作用域约定**：`shared/` 与 `docs/06,07` 归 Lead；`server/` 归 backend-dev；`web/` 归 frontend-dev；`tests/`、`scripts/verify*` 归 QA；`docs/02-05`、`design/` 归各领域成员。跨域改动通过 Lead 协调。

---

## 4. 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 运行时 | Node.js 22（内置 fetch / WebSocket / node:test） | 无运行时依赖，部署简单，测试内置 |
| 后端依赖 | **0 外部依赖** | 避免供应链与安装失败；HTTP/SSE/JSON 全用标准库 |
| 前端 | **零构建** 原生 ES Modules + 手写 CSS + Canvas/SVG | `node server/index.js` 即可用；无 Vite/React 构建链；更易验收 |
| 实时通道 | 浏览器侧用 **SSE**；服务端侧用 CLOB **WS market channel**，失败自动降级到 REST 轮询 | SSE 原生 EventSource、自动重连；WS 提供真实盘口增量 |
| 行情来源 | Gamma（发现/元数据）+ CLOB（盘口/价格）+ Data API（历史） | 全部为官方公开只读接口 |
| 成交模拟 | 逐档吃单 VWAP + 官方 taker 费 + 点差/滑点成本 | 市价单语义与真实成交一致 |
| 手续费 | `fee = shares × 0.05 × p × (1-p)`，5 位小数，taker only | 官方文档 + 市场 `feeSchedule` 双重确认 |
| 持久化 | `data/store.json`（策略/运行元数据，原子写）+ `data/runs/<id>.jsonl`（逐笔追加） | 零依赖、可审计、崩溃后可恢复 |
| 模式 | live（实时）为主，replay（历史回放）为辅 | 需求要实时验证；回放用于复现、回归测试、无行情时演示 |
| 安全边界 | 只读公开 API、仅监听 127.0.0.1、无密钥、无下单 | 模拟系统，杜绝真实资金风险 |
| 时间 | 全部内部时间戳为 epoch ms；显示时区 Asia/Shanghai | 统一、可测 |

---

## 5. 实时数据链路

### 5.1 市场发现（低频，默认 60s 刷新）
1. `GET /events/keyset?closed=false&...` 或 `public-search?q=highest temperature` 拉取温度事件。
2. 过滤标题匹配 `highest temperature in <City> on <Date>` 的事件；展开其 `markets[]`（每个 °C 括号一个市场）。
3. 归一化为 `MarketSnapshot`：解析 `clobTokenIds`（JSON 字符串，[0]=YES，[1]=NO）、`outcomePrices`、`bestBid/bestAsk`、`spread`、`orderPriceMinTickSize`、`orderMinSize`、`feeSchedule`、`endDate`、`acceptingOrders` 等。
4. live 选市场：只取当天（UTC 观察日）市场，按城市事件纳入全部可交易括号，不设数量上限；价格/流动性/点差仅在下单时校验。

### 5.2 实时盘口
- **主通道**：`wss://ws-subscriptions-clob.polymarket.com/ws/market`，发送 `{type:"market", assets_ids:[token...]}`；处理 `book` / `price_change` / `last_trade_price` / `tick_size_change`。
- **兜底**：每秒 `POST /books`（批量）或 `GET /book?token_id=` + `GET /midpoint`；失败退避 1s→2s→5s→15s。
- **健康度**：`feedStatus = connecting | live | degraded | offline`；单市场 `stale` 阈值 = `max(3 × tickInterval, 5s)`。
- 每个 token 维护定长价格序列（默认保留 15 分钟），供滚动收益计算与前端 sparkline。

### 5.3 回放
- `GET https://data-api.polymarket.com/v2/prices-history?token_id=...&interval=1m&bucket_seconds=60`（以 api-research 结论为准）。
- 将历史点按时间轴压缩（`sim.speed` 倍速）逐点喂给同一引擎，信号与成交逻辑完全复用。
- 回放结束自动 `status=ended`；`replayLookbackMin` 限制窗口。

---

## 6. 模拟引擎

### 6.1 Tick 循环（live: 默认 1s；replay: 由数据点驱动）
```
onTick(now):
  1. 刷新行情快照（feed）
  2. 对每个可交易市场：
     a. 更新价格序列 -> 评估信号（滚动窗口收益、确认、冷却、上限）
     b. 评估已有持仓退出（止盈/止损/超时/反向/结算）
     c. 信号触发时 -> 风控前置检查 -> 模拟市价单 -> 账本更新 -> 记录成交
  3. 市值重估 + 权益采样（每 5 tick 或每次成交）
  4. 指标计算 -> SSE 广播（trade / positions / equity / metrics / signal）
```

### 6.2 市价单模拟（execution.js）
- BUY YES/NO：从对手方卖盘（asks）由低到高逐档吃量，`VWAP = Σ(price×size)/Σsize`；不足则部分成交；成交 shares < `orderMinSize` 则拒单。
- 价格保护：`limit = bestAsk × (1 + slippageBufferBps/10000)`，超出保护价的档位不吃。
- 费用：`fee = round5(shares × 0.05 × vwap × (1-vwap))`；BUY 现金支出 = notional + fee；SELL 现金收入 = notional − fee。
- 滑点成本 = `shares × (vwap − referencePrice)`（BUY 参考 bestAsk）。

### 6.3 账本与盈亏（portfolio.js）
- 持仓成本 `costBasis = Σ notional + Σ entryFees`；`avgPrice = costBasis / shares`。
- 浮动盈亏 = `shares × mid − costBasis`（mid 为当前中间价；前端另显示按可成交价估算的退出后盈亏）。
- 卖出：`realizedPnl = proceeds − costBasisPortion`（proceeds 已扣卖出费）。
- 结算：市场 `closed/resolved` 后按 `outcomePrices` 判定，赢家按 1 USDC/股兑付，输家 0，并自动平仓计入已实现盈亏。
- 权益 = 现金 + Σ(shares × mid)；回撤基于权益曲线峰值。

### 6.4 风控（前置检查，全部记录拒单原因）
现金充足、最大持仓数、单市场持仓上限、点差阈值、价格带、市场可接单、行情非过期、回撤/单日亏损熔断（触发则自动停机并标记 `risk_kill_switch`）。

---

## 7. API 与实时推送
- REST：见 `docs/07-api-contract.md`。
- SSE：`GET /api/stream`（`text/event-stream`），事件类型见契约；15s 心跳注释行保活；前端断线指数退避重连并补拉快照。
- 错误统一 `{ "error": { "code": "...", "message": "..." } }`，HTTP 4xx/5xx。

---

## 8. 失败、降级与边界
| 场景 | 处理 |
|---|---|
| Gamma/CLOB 超时、限流 | 指数退避重试；feedStatus=degraded；前端显示“行情降级” |
| WS 断开 | 自动重连（1s→30s 上限）；期间 REST 轮询兜底 |
| 市场行情长时间不更新 | 标记 `stale`，禁止新开仓，持仓继续按最后价估值 |
| 盘口为空 / 单边 | 拒单并记录原因，不产生幽灵成交 |
| 市场结算 | 自动兑付并平仓，事件 `trade`(reason=resolution) + `metrics` |
| 进程重启 | 读取 `data/` 恢复策略与历史运行；进行中的 run 标记 `stopped` 并提示 |
| 所有市场结束 | 运行自动结束（ended），保留报告 |
| 时钟/延迟 | 服务端注入 clock，测试可注入假时钟；成交以服务端接收时间为准 |

---

## 9. 可观测性与测试
- `GET /api/health`：进程、feed 状态、行情数量、上次更新时间、运行数。
- 单元测试（node:test）：费率、信号窗口、逐档成交、账本、指标、策略校验。
- 集成测试：用 fixtures 行情回放驱动完整 run，断言成交/费用/权益；API 冒烟（health→meta→markets→策略→run→trades→stop）。
- `scripts/verify.js`：一条命令跑通真实 API + 回放全链路。
- 性能预算：≤ 40 个市场、1s tick、内存 < 150MB、SSE 广播 < 20ms。

---

## 10. 启动与部署
```bash
node server/index.js          # 默认 http://127.0.0.1:8787
npm test                      # 单元 + 集成测试
node scripts/verify.js        # 真实 API 冒烟验证
```
环境变量：`PORT`（默认 8787）、`HOST`（127.0.0.1）、`FEED_MODE`（auto|ws|poll）、`POLL_MS`、`DATA_DIR`。

> 免责声明：本系统仅用于策略研究与模拟验证，不构成投资建议，不接入真实资金。
