# 05 · UI/UX 设计规范：PolyTemp Terminal

> 版本 v1.0（可实施）｜ Owner：UI 人员（ui-designer）
> 字段唯一来源：`shared/contract.js` v1.0.0；参数定义 `docs/02`；信号/执行/退出语义 `docs/03`；费用与 P&L 口径 `docs/04`；API/SSE `docs/07`。本文只负责 **呈现与交互**，不重新定义业务语义。
> 交付物：本文 + `design/prototype/`（`index.html` / `styles.css` / `mock.js`）。原型为纯静态、零依赖、零网络请求，双击 `file://` 即可运行。

## 1. 设计概念：深色「天气交易终端」

### 1.1 定位与气质
- **一句话**：像专业交易终端一样密集、冷静、实时；像天气仪表盘一样把“城市 · 温度括号 · 概率”一眼排开。
- 关键词：深色、低饱和底、高亮数据、等宽数字、细边框、无装饰渐变。
- 布局节奏：顶部运行状态 → 中部主数据 → 下部分析明细；用户 3 秒内回答“赚了还是亏了、为什么、成本多少”。
- 密度原则：一屏同时可见 行情 / 信号 / 权益 / 成本 / 持仓 / 成交；信息次级化用字号与明度，不靠弹窗堆叠。

### 1.2 语义色（全站唯一含义）
| 语义 | 颜色 | 含义与用法 |
|---|---|---|
| UP / YES / 盈利 | 绿 `#22C77C`（文本 `#4ADE9B`） | 上涨、买入 YES、正收益、止盈 |
| DOWN / NO / 亏损 | 红 `#F0506A`（文本 `#FB7185`） | 下跌、买入 NO、负收益、止损 |
| 费用 / 成本 | 琥珀 `#F5B73D` | 手续费、点差、滑点、成本瀑布、费用拖累 |
| 实时 / 主操作 | 青 `#22D3EE` | LIVE 呼吸点、主按钮、权益曲线、选中态 |
| 概率 / 辅助 | 紫 `#A78BFA` | 滑点归因、隐含概率辅助标记 |
| 中性 | 灰系 | 时间、标签、说明；**不得**用灰色表达盈亏 |

**UP = 买入 YES；DOWN = 买入 NO（等价做空 YES）**。只做买入开仓、卖出平仓，无杠杆。所有地方不得混用“UP=红色”等反向约定。

### 1.3 永不单靠颜色（WCAG 1.4.1）
- 方向：`▲ UP / YES`、`▼ DOWN / NO`，箭头 + 文本 + 颜色三重冗余。
- 盈亏：同时给符号（`+` / `−`）与颜色；零值显示 `$0.00`（中性色）。
- 手续费：固定琥珀色 + `$` 金额 + 列名“手续费”；成本条同时有文字标签与百分比。
- 行情涨跌：`▲ +23.4%` / `▼ −18.2%`，色弱用户可仅凭箭头与符号判读。
- 状态：运行中 = 呼吸点 + “实时运行中”；暂停 = 静态琥珀点 + “已暂停”；结束 = 灰点 + “已结束”；错误 = 红点 + “异常中止”。

### 1.4 数字与单位纪律
- 所有价格、概率、金额使用 `tabular-nums` 等宽数字，右对齐，禁止跳动。
- 价格单位 **¢（分）**、概率 **%**、金额 **$**；同一屏内不混用 0–1 小数与百分数。
- 时间统一 `HH:MM:SS`（模拟时钟 24h），日期 `YYYY-MM-DD`。

## 2. 设计令牌（Design Tokens）

### 2.1 色板
| Token | Hex | 用途 |
|---|---|---|
| `--bg-0` | `#070A0F` | 页面底色（含顶栏径向青光） |
| `--bg-1` | `#0B1017` | 工作区 / 输入框底 |
| `--bg-2` | `#101821` | 次级底、分段控件槽 |
| `--panel` | `#111A24` | 卡片 / 面板 |
| `--panel-2` | `#16212D` | 面板头、悬浮层 |
| `--panel-3` | `#1B2937` | hover、进度槽 |
| `--line` | `#1E2C3A` | 常规边框 |
| `--line-strong` | `#2C3F52` | 强调边框、虚线框 |
| `--text-1` | `#E9F0F6` | 主文本 / 数值 |
| `--text-2` | `#A3B2C2` | 次级文本、表头 |
| `--text-3` | `#748698` | 辅助说明（仅 ≥11px） |
| `--up` / `--up-text` | `#22C77C` / `#4ADE9B` | 涨 / 正收益 |
| `--down` / `--down-text` | `#F0506A` / `#FB7185` | 跌 / 负收益 |
| `--amber` | `#F5B73D` | 费用 / 成本 |
| `--cyan` | `#22D3EE` | LIVE / 主操作 / 权益线 |
| `--violet` | `#A78BFA` | 概率辅助 / 滑点 |
| `--blue` | `#60A5FA` | 已实现盈亏强调 |

### 2.2 字体与字号
- 无外部字体（file:// 可用）：`-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`。
- 数字/代码：`"SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", Menlo, monospace`。
- 字号：`32` 大屏数字（预留）、`26` 首屏核心权益、`20` 页面标题 / 指标值、`16` 面板标题 / 大数值、`14` 正文强调、`13` 正文、`12` 控件 / 表格、`11` 标签 / 表格辅助、`10` 微标签（仅等宽场景）、`9` LIVE 小标签。

### 2.3 间距 / 圆角 / 阴影 / 网格 / 动效
- 间距 4px 基准：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40`。
- 圆角：`4` 徽标/标签、`6` 按钮/输入、`8` 次级卡片、`12` 面板、`16` 弹窗/策略卡。
- 阴影：`--shadow-1` 面板微浮；`--shadow-2` 悬浮/侧栏；`--shadow-3` 模态。
- 栅格：12 列，间距 16，页面最大宽 1600；指标卡 6 列、主区 8+4 / 5+7。
- 动效：`120ms` 控件反馈、`220ms` 数据条/图表过渡、`380–480ms` 新条目淡入；LIVE 呼吸 1.8s。尊重 `prefers-reduced-motion`。

## 3. 信息架构

### 3.1 全局框架
```
┌ Topbar 56px ─────────────────────────────────────────────────────────────┐
│ 品牌°C PolyTemp TERMINAL │ ● 实时运行中 RUN-… │ 模拟时钟 │ 总权益 │ 运行盈亏 │ PAPER 模拟盘 │
├ Nav 44px ────────────────────────────────────────────────────────────────┤
│ 策略构建 │ 实时面板(LIVE●) │ 运行历史 │ 策略库 │        NYC 01:32 · LDN 06:32 · SEL 15:32 │
├ Workspace（12 列栅格，padding 20）───────────────────────────────────────┤
```
- Topbar 永久显示：运行状态、run id、模拟时钟、总权益、运行盈亏、PAPER 徽标（禁止隐藏风险提示）。
- 导航固定 4 项；实时面板 tab 带 LIVE 圆点（暂停/结束即隐藏）。
- 页面切换保持运行不中断；`aria-selected` 与 `hidden` 同步。

### 3.2 四屏职责
| 页面 | 目的 | 主要动作 | 关键数据源（SSE） |
|---|---|---|---|
| 策略构建 Strategy Builder | 组合参数、实时校验、估算成本 | 保存草稿 / 启动模拟 | `meta`（cities/presets/feeModel） |
| 实时面板 Live Dashboard | 盯盘：行情、信号、成交、权益、成本 | 暂停 / 继续 / 停止 / 调倍速 | `market(s)` `signal` `trade` `positions` `equity` `metrics` `run` `feed` |
| 运行历史 Run History | 回看与并排对比多次运行 | 搜索 / 筛选 / 勾选 2–3 条对比 | REST 运行列表（`RunSummary`） |
| 策略库 Strategy Library | 复用预设与自定义策略 | 载入构建 / 直接运行 | `meta.presets` |

### 3.3 运行状态机 → UI
`created → starting → running ⇄ paused → stopping → stopped`；自然结束 `ended`；异常 `error`。
- 状态胶囊：running 青色呼吸点 +「实时运行中」；paused 琥珀 +「已暂停」；stopped/ended 灰 +「已结束」；error 红 +「异常中止」。
- 仅 running 显示 LIVE 呼吸点；仅 running/paused 允许停止；ended/error 禁用暂停与停止，保留“再次运行”。
- 页面刷新后按 `RunSummary.status` 恢复，不得自造状态（前端本地仅展示，不可覆盖契约）。

### 3.4 实时刷新约定
- SSE 到达即局部更新：`market/markets` → 行情卡；`signal` → 信号流顶部；`trade` → 成交明细顶部；`positions` → 持仓表；`equity` → 曲线 + 指标；`run` → 状态胶囊；`feed` → 数据源徽标（`live/degraded/offline`）。
- 断线：顶栏状态转 `degraded/offline` 琥珀/红提示，行情卡显示「行情过期」徽标；恢复后补拉快照并 toast。
- 列表更新策略：新条目淡入、最多保留 30 条信号 / 40 条成交；表格滚动位置不因更新重置。

### 3.5 主流程（用户视角）
```
策略库/预设 ──载入──▶ 策略构建 ──校验通过──▶ 启动模拟 ──▶ 实时面板（盯盘/暂停/停止）
                        │  errors 阻断            │                 │
                        └─ 修正参数 ◀────────────┘                 ├─ 停止并结算 ─▶ 运行历史 ─▶ 勾选对比
                                                                  └─ 保存草稿 ───▶ 策略库
```
- 启动门禁：`validateStrategy().errors` 非空时“启动”按钮禁用并聚焦首个错误；warnings 允许启动但需在确认弹层再次提示（“该参数组合的预期摩擦较高，仍要启动？”）。
- 运行中导航到构建器/历史不中断运行；回到实时面板自动恢复曲线重绘。
- 停止 → 按当前 mid 结算 → 写入 `RunSummary` → 历史首行状态更新；随后可直接勾选本次与历史运行对比。

## 4. 页面布局规范

### 4.1 策略构建 Strategy Builder
左列参数面板（6 组）+ 右侧 340px 吸顶校验栏；≤1080px 单列，校验栏移到底部。
```
┌ 策略构建 ────────────────────────────────────────────── 预设 · 均衡  保存草稿  ▶ 启动模拟 ┐
│ ┌ 01 市场范围 ──────────────────────────────── 5 城 · 11 市场 ┐ ┌ 校验摘要 ──────────────┐ │
│ │ [城市按时区升序: UTC-08 / UTC-07 / ... / UTC+13]             │ │ ✓ 市场范围有效           │ │
│ │  每组显示 时区(UTC±HH:MM) + 当地日期时间；组头 checkbox 全选  │ │ ! 阈值不足以覆盖摩擦     │ │
│ │ 最小流动性  最大价差  价格带 min/max            │ │ ! 阈值不足以覆盖摩擦     │ │
│ │ 到期 min/max h   [仅可交易市场 ●]                           │ │ ✓ 方向映射已校验         │ │
│ ├ 02 信号规则 ────────── ▲ 动量入场 ──────────────────────────┤ │ ── 单笔成本估算 ──      │ │
│ │ priceField  windowSec  minAbsMove  confirmationTicks        │ │ 名义 $25.00             │ │
│ │ ◉──── 触发阈值 +20.0% ────○                                  │ │ 手续费 $0.31            │ │
│ │ direction  cooldownSec  maxSignalsPerMarket  [价差超限不触发]│ │ 点差+滑点 $1.00         │ │
│ ├ 03 执行与仓位 ──────────────────────────────────────────────┤ │ 最低涨幅门槛 +9.0%      │ │
│ │ orderType market  sizingMode fixed_stake  maxPositionUsd     │ │ ──────────────────      │ │
│ │ ◉── 单笔 sizingValue $25 ──○   maxPositions …                │ │ [▶ 启动模拟运行]        │ │
│ ├ 04 退出规则 ─┬ 05 风控 ─┬ 06 费率与模拟 ────────────────────┤ │ [查看策略 JSON]         │ │
│ │ TP / SL / maxHold / holdToResolution / opposite             │ │ 免责声明…               │ │
│ └──────────────────────────────────────────────────────────────┘ └─────────────────────────┘ │
└ 面板顺序即策略心智顺序：选市场 → 定信号 → 定执行 → 定退出 → 定风控 → 定费用/仿真 ─────────────┘
```
| 面板 | 必填控件（identifier 对齐 contract） |
|---|---|
| 01 universe | cities、minLiquidityUsd、maxSpread、minPrice、maxPrice（仅下单时校验）、minTimeToResolutionSec / maxTimeToResolutionSec（UI 用小时）、onlyAcceptingOrders |
| 02 signal | priceField、windowSec、moveThresholdPct（滑块 5–50%）、minAbsMove（¢）、direction、confirmationTicks、cooldownSec、maxSignalsPerMarket、requireSpreadOk |
| 03 execution | orderType=market（只读）、sizingMode、sizingValue（滑块 / 百分比模式切换）、maxPositionUsd、maxPositions、maxPositionsPerMarket、fillModel=book_walk（只读）、slippageBufferBps |
| 04 exit | takeProfitPct、stopLossPct、maxHoldSec、holdToResolution、exitOnOppositeSignal |
| 05 risk | bankrollUsd、maxDrawdownPct、dailyLossLimitUsd、killSwitch |
| 06 fees/sim | fees.model / takerFeeRate / makerRebateRate（只读）；sim.mode、tickIntervalMs、replayLookbackMin、speed |
- 校验栏：错误（红）阻断启动、警告（琥珀）不阻断、通过（绿）；单笔成本估算 + **最低盈利涨幅门槛 minProfitableMovePct**（公式见 `docs/04` §5.10）必须同屏；底部固定免责声明。
- “查看策略 JSON”展开与构建器同构的 `StrategyConfig`（version/name/universe/signal/execution/exit/risk/fees/sim），供开发联调与用户导出。

### 4.2 实时面板 Live Dashboard
```
┌ 实时面板 RUN-… ─ 策略名 · 5 城 · 11 市场 · ●CLOB WS live · 已运行 32:07   1× 5× 20×  ❚❚暂停  ■停止 ┐
│ ┌总权益────┐ ┌收益率───┐ ┌已实现盈亏─┐ ┌胜率────┐ ┌手续费合计──┐ ┌最大回撤──┐ │
│ │$10,435.36│ │+4.35%   │ │+$312.58   │ │61.5%   │ │$37.42      │ │−2.31%    │ │
│ └──────────┘ └─────────┘ └───────────┘ └────────┘ └────────────┘ └──────────┘ │
│ ┌ 温度市场行情 (span 8) ────────────────────────────────┐ ┌ 信号流 (span 4) ────┐ │
│ │ [纽约 14°C  41.2¢ ▲+23% 概率41.2% ▓▓▓░] …11 张热力卡   │ │ 14:31:52 纽约14°C   │ │
│ │ 城市+括号+价格(¢)+1m动量+隐含概率+sparkline+价差/深度  │ │ 1m ▲+23.4% 33.4→41.2│ │
│ └───────────────────────────────────────────────────────┘ │ BUY YES · 已执行    │ │
│ ┌ 权益曲线 (span 8) ────────────────────────────────────┐ │ 14:30:41 香港27°C … │ │
│ │  $曲线（青）+ 初始资金虚线 + 1m/5m/全部 + 悬停十字线   │ │ 冷却中·跳过         │ │
│ │  ── 图例：总权益 / 初始资金 $10,000 ──                │ └─────────────────────┘ │
│ ┌ 成本拆解 (span 4) ────────────────────────────────────┐ ┌ 当前持仓 (span 5) ───┐ │
│ │ 手续费 ▓▓▓▓▓▓  / 点差 ▓▓ / 滑点 ▓  → 成本率 2.14%     │ │ 市场 方向 数量/均价 …│ │
│ └───────────────────────────────────────────────────────┘ └──────────────────────┘ │
│ ┌ 成交明细 (span 7) ── 时间 市场 BUY/SELL·YES/NO 数量 成交价 名义 手续费(5dp) 滑点 盈亏 状态/原因 ┐
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```
- 行情卡：热力底色 = 60s 动量方向（绿/红，10% 透明度）；卡片内必须同时有城市、括号、价格（¢）、隐含概率（%）、动量箭头、sparkline、价差/深度；`spread > 0.10` 时概率改用 last 并加「最后成交价」徽标（`docs/04` §6.4）。
- 指标卡固定 6 张：总权益 / totalReturnPct / realizedPnl / winRate / feesPaid（副行 feeDragPct 与 turnoverUsd）/ maxDrawdownPct；副行不可省略。
- 权益曲线：青色实线 = 含费权益；灰色虚线 = initialCapital 基准；支持 1m/5m/全部与 hover tooltip（时间、权益、净盈亏、收益率）；曲线旁给最新值；提供隐藏数据表作为无障碍替代。
- 成本拆解：手续费 / 点差 / 滑点 三段横向条 + 累计成本 + **成本率 = totalFriction / turnoverUsd**；文案注明点差/滑点为归因项、不二次扣减。
- 信号流：每条显示时间、城市·括号、窗口变动%、from→to、`BUY YES/NO`、状态（已执行 / 跳过·reason / 拦截·reason）。
- 持仓表：城市·括号、方向（UP/YES、DOWN/NO 徽标）、数量 + 含费均价、现价 + 隐含概率（NO 侧为 NO token mid，缺失时标「估算」）、unrealizedPnl。
- 成交明细：时间、市场、`BUY/SELL` + `YES/NO`、shares、price(¢)、notional($)、**fee 5 位小数**、slippageCost($)、realizedPnl、状态/原因（reason 中文标签）。
- 运行控制：速度 1×/5×/20×、暂停/继续、停止（二次确认弹窗，提示将按当前 mid 结算并写入运行历史）。
- 括号阶梯（P1）：选中城市可展开同事件全部括号的 `impliedProbability` 与 `Σ 概率`；`|Σ−1|>0.05` 时显示“概率和偏离 100%”警告（数据来自 `MarketSnapshot` 全量，非静态原型内置）。

### 4.3 运行历史 Run History
```
┌ 运行历史 ─────────────────────────── [搜索 RUN/策略] [状态▾] [对比模式] ┐
│ 已选 2 条运行（最多 3 条）                              [生成对比] [清空] │
│ ┌□ Run ID / 策略  开始时间  时长  成交  收益率  胜率  手续费  最大回撤  状态  操作┐
│ │□ 均衡·±20%/1min  11-08 14:00 32分 27 +4.35% 61.5% $37.42 −2.31% ●运行中 查看 复制│
│ │□ 保守·高概率区间 11-07 22:01 1h02 18 +1.84% 55.6% $12.40 −1.42% 已结束          │
│ └──────────────────────────────────────────────────────────────────────────┘
│ ┌ 运行对比（选中 ≥2 条展开）─────────────────────────────────────────────┐
│ │ [策略 A 卡片: 收益率/胜率/成交/手续费/回撤 + 迷你权益线]  [策略 B …]     │
│ └────────────────────────────────────────────────────────────────────────┘
```
- 表格为斑马纹/悬停行高亮，数字列等宽右对齐；收益率正绿负红；回撤固定红色并带 `−`；状态用胶囊。
- 对比面板：2–3 列，最高 `totalReturnPct` 列加「最佳」徽标；只对比同口径含费指标；无数据时展示空态与引导。
- 空态：无匹配记录 → 文案 + 「启动一次模拟」按钮；加载态 → 6 行骨架屏，不显示假数据。

### 4.4 策略库 Strategy Library
```
┌ 策略库 ─────────────────────────────  [全部|动量|回归|自定义]  ＋新建策略 ┐
│ ┌ 均衡 · ±20%/1min 动量 [动量] ─┐  ┌ 保守 · 高概率区间 [动量] ────┐  ┌ 空白策略 [自定义] ┐
│ │ 描述 …                        │  │ 描述 …                       │  │ 从零配置全部参数  │
│ │ [60s] [±20%] [1¢] [5仓]        │  │ [5–95¢] [120s] [25%]        │  │                   │
│ │ ~~迷你权益 sparkline~~          │  │ ~~迷你权益 sparkline~~        │  │                   │
│ │ 运行 6  最佳 +6.3%  胜率 63.4% │  │ …                            │  │                   │
│ │ [载入构建]        [▶ 运行]      │  │ [载入构建]       [▶ 运行]     │  │ [载入构建] [▶运行] │
│ └───────────────────────────────┘  └──────────────────────────────┘  └───────────────────┘
```
- 卡片固定结构：标题 + 分类徽标、描述（≤2 行）、参数 chips、迷你曲线、三项统计（历史运行/最佳收益/平均胜率）、主/次按钮。
- 载入 → 回填构建器并 toast；运行 → 直接启动模拟并跳转实时面板；空白策略卡可创建。
- 分类分段控件（全部/动量/回归/自定义）即时过滤，过滤为空时显示空态。

## 5. 组件规范

| 组件 | 规格 | 状态 / 交互 |
|---|---|---|
| Button | 32px 高，圆角 6，主按钮青渐变、次按钮描边、危险按钮红；小号 28px | default / hover / active（下移 1px）/ focus-visible / disabled（42% 不透明）/ loading（禁用 + 文案“启动中…”） |
| Input / Select | 32px 高，深底细边框，数字等宽；focus 青色 3px 光晕 | default / hover / focus / invalid（红边 + 错误文案）/ readonly（虚线边） |
| Slider | 6px 轨道，16px 圆钮，青色已选段；左侧标签、右侧数值胶囊 | 值随拖动实时回写（阈值 +20.0%、仓位 $25 / 25%）；键盘 ←→ ±step |
| Toggle | 34×19，开青关灰；“开”必须配状态文字（如“仅可交易市场”） | 键盘 Space 切换；`aria-checked` 由原生 checkbox 提供 |
| Tabs | 44px 导航条，选中项青色上边线 + 高亮文字；下划线动效 120ms | 键盘 ←→ 切换 tab，`aria-selected`、`role=tabpanel` |
| Segmented | 3px 内衬，选中项面板色 + 青字；用于时间范围/速度/分类 | `aria-pressed` 或 `role=group` + `aria-label` |
| Table | 表头吸顶，10px 辅助表头，行高约 34px，数字右对齐，斑马 hover；容器横向滚动 | 空态行、加载骨架、新行淡入；`<caption class=sr-only>` 与 `scope=col` |
| Badge | 4px 圆角 18–20px 高；UP 绿 / DOWN 红 / 费用琥珀 / LIVE 青 / 中性灰 | 必须带箭头或文字；色弱可辨 |
| 指标卡 | 面板底 + 左侧 2px 语义色条（权益青/收益绿/已实现蓝/胜率绿/费用琥珀/回撤红） | 数值 20px 等宽；副行小字；数据更新时数字不重排 |
| Sparkline | 62×20（卡片）/ 220×46（对比）/ 260×44（策略库），折线 1.6–2px，绿/红随趋势 | 无坐标轴；仅供趋势参考，必须有文字数值并存 |
| 权益曲线 Canvas | 高 260，响应式宽度；线宽 2 + 辉光，面积渐变；最新点圆点；虚线基准；hover 十字线 + tooltip | 空态（运行刚开始）显示“等待首个 tick”；暂停时冻结；切换范围重绘 |
| 成本条形 | 5px 高，手续费琥珀 / 点差青 / 滑点紫；按占总成本比例 | 显示数值 + 占成本率 |
| Toast | 右下角堆叠，最大宽 340，左侧 2px 状态色；3.2s 自动消失 | success/warn/info/error；不阻塞操作；同一消息去重 |
| Modal | 460px，圆角 16，遮罩 `rgba(3,6,10,.7)` + 模糊；用于停止确认 | 打开聚焦主按钮、Esc 关闭、点击遮罩关闭；`aria-modal`；破坏性操作按钮红色 |
| Empty state | 居中图标 + 一句话 + 可选操作 | “暂无持仓 · 等待信号触发”“没有匹配的运行记录…” |
| Loading | 面板内骨架条 6 行 / 指标卡骨架；不显示 0 或假数 | 首次加载与回放数据拉取时 |
| Error banner | 面板顶部红边横幅 + 重试按钮 | 行情断开、SSE error、运行启动失败 |

### 5.1 状态矩阵
| 区域 \ 状态 | empty | loading | live | paused | ended | error |
|---|---|---|---|---|---|---|
| 行情卡 | “等待行情快照” | 骨架 11 格 | 呼吸小青点 + 实时价 | 价格静止 + 琥珀“已暂停” | 最后快照 + 灰化 | “行情过期”红徽标 |
| 信号流 | “等待首个动量信号触发…” | 3 条骨架 | 新条目淡入 | 不再新增 | 只读历史 | 顶部错误横幅 |
| 权益曲线 | “等待首个 tick” | 虚线骨架 | 逐点追加 | 冻结 | 冻结 + 结束标记 | 断点标记 |
| 成交/持仓 | “暂无成交/持仓” | 骨架 5 行 | 新行淡入 | 冻结 | 结算后清空持仓 | 保留最后状态 |
| 运行状态胶囊 | — | starting | running（青） | paused（琥珀） | stopped/ended（灰） | error（红） |

## 6. 数据展示规则

| 数据 | 格式 | 示例 | 颜色 / 规则 |
|---|---|---|---|
| 价格 | 1 位小数 + `¢` | `41.2¢` | 中性白；行情变动时用箭头表方向 |
| 隐含概率 | 1 位小数 + `%` | `41.2%` | 中性；概率=YES mid；NO 侧用 NO token mid（缺失标“估算”） |
| 概率和 Σ | 1 位小数 + `%` | `Σ 98.7%` | `|Σ−1|>0.05` 时琥珀警告 |
| 金额 | `$` + 千分位 + 2 位小数 | `$10,435.36` | 正负均用绝对值格式 + 前置符号 |
| 手续费（逐笔） | `$` + **5 位小数** | `$1.25000` | 固定琥珀；聚合指标卡可用 2 位 |
| 成本/费用拖累 | 2 位小数 + `%` | `2.14%` | 琥珀；`feeDragPct = feesPaid / initialCapital` |
| 盈亏 | 符号 + `$` 金额（可附 %） | `+$812.40` / `−$37.42` | 正绿负红 + 箭头；零中性 |
| 变动百分比 | 符号 + 1 位小数 + `%` | `▲ +23.4%` | 正绿、负红、必须带箭头 |
| 收益率 | 符号 + 2 位小数 + `%` | `+4.35%` | 使用含费口径；禁止 mid→mid 参考盈亏冒充 |
| 时间 | `HH:MM:SS` | `14:32:07` | 等宽、`--text-3` 或次级白 |
| 运行 id | `RUN-YYYYMMDD-NNNN` | `RUN-20261108-0412` | 等宽青字标签 |
| 数据源状态 | 文字 + 圆点 | `● CLOB WS · live` | live 青 / degraded 琥珀 / offline 红 |
| 状态/原因 | 胶囊 | `已执行`、`跳过 · 冷却中`、`拒单 · 点差过宽` | exit/reject reason 用 `docs/04`/contract 中文标签 |

- 全局口径：主指标永远含费（`equity = cash + positionsValue`）；不含费对照曲线必须虚线并明确标注。
- 禁止在 P&L 上二次扣减点差/滑点（已在成交价内）；禁止把 `estExitFee` 计入权益。
- 聚合展示 2 位小数，单笔 fee 展示 5 位小数；内部精度不在 UI 复算。

## 7. 响应式与栅格

| 断点 | 布局行为 |
|---|---|
| ≥1360px（设计基准 1440） | 指标 6 列；面板 8+4 / 5+7；构建器双栏（主区 + 340 侧栏）；行情卡 4 列 |
| 1024–1359px | 指标 3 列×2；面板 12 / 6+6 重排；构建器仍双栏（侧栏 320）；行情卡 4 列；隐藏卡片 sparkline |
| 768–1079px | 构建器单列（校验栏置底）；指标 2 列；字段 2 列；导航横向滚动 |
| <768px | 单列流；字段 1 列；表格横向滚动；Toast 满宽；顶栏换行 |

- 1440 与 1024 为验收宽度：两档下不得出现横向页面滚动（表格内部滚动除外）、不得重叠或截断关键数字。
- 触摸目标 ≥ 32×32（移动端 ≥ 40）；滑块与开关支持键盘。

## 8. 无障碍（Accessibility）

- **对比度**：正文/数值 ≥ 7:1（`#E9F0F6` on `#0B1017`），次级文本 ≥ 4.5:1，`--text-3` 只用于辅助说明且 ≥ 11px；状态色均配图标/文字，满足 1.4.1。
- **键盘**：Tab 顺序 = 顶栏 → 导航 → 页面主区；导航用 ←→；图表 hover 数据可由“查看数据表”按钮打开 `<table>` 替代；Modal 内焦点陷阱，Esc 关闭；`focus-visible` 统一 2px 青色描边 + 2px offset。
- **语义**：`role=tablist/tab/tabpanel` 与 `aria-selected`；运行状态 `role=status aria-live=polite`；toast 容器 `aria-live=polite`；表格 `<caption class="sr-only">` + `scope="col"`；Canvas `role="img"` + `aria-label` + 隐藏数据表；开关使用原生 checkbox 维持 `aria-checked`。
- **动效**：`prefers-reduced-motion: reduce` 时禁用呼吸/淡入/位移，仅保留即时状态变化。
- **可读性**：全站允许 200% 缩放；数值不因刷新跳动（等宽数字）；不使用仅靠 hover 才出现的信息（tooltip 同时可由键盘 focus 触发）。

### 8.1 键盘快捷键（桌面端）
| 按键 | 行为 |
|---|---|
| `Tab` / `Shift+Tab` | 焦点前移/后移（构建器字段、表格操作、运行控制） |
| `←` `→` | 导航 tab / 分段控件 / 滑块步进 |
| `Space` `Enter` | 按钮、开关、tab 激活 |
| `Esc` | 关闭弹窗 / 关闭 JSON 预览 / 取消图表 tooltip |
| `P` / `S`（非输入态） | 暂停/继续 / 打开停止确认（需在面板聚焦时） |

- 所有图表提供等价数据表入口（“查看数据表”），保证屏幕阅读器可获取序列。

## 9. 中文文案示例

- 启动：`模拟运行已启动 · RUN-20261108-0412 · 均衡 · ±20%/1min 动量`
- 暂停：`已暂停模拟：行情与权益曲线冻结，可随时继续。`
- 继续：`已继续运行 · 5× 速度`
- 停止确认：标题「停止本次模拟运行？」正文「停止后将按当前市值结算所有未平仓持仓，本次运行会写入运行历史，之后仍可查看与对比。」按钮「继续运行 / 停止并结算」
- 校验错误：`单笔超过本金：fixed_stake 单笔 $250.00 大于初始资金 $1,000.00。`
- 校验警告：`阈值不足以覆盖摩擦：该价位最低盈利涨幅门槛约 9.0%，高于 moveThresholdPct 5%，含费期望可能为负。`
- 空态：`暂无持仓 · 等待信号触发` / `没有匹配的运行记录 · 调整筛选条件或启动一次新模拟。`
- 错误：`行情连接已断开，正在重连…（已保留最后快照）`
- 免责声明：`模拟盘仅用于策略验证：不提交链上订单、不接触私钥，所有成交为本地撮合结果。`

## 10. 契约映射与原型说明

### 10.1 UI ↔ `shared/contract.js` 字段映射
| UI 区域 | contract 字段/实体 |
|---|---|
| 构建器 01 | `universe.cities / minPrice / maxPrice / minLiquidityUsd / maxSpread / minTimeToResolutionSec / maxTimeToResolutionSec / onlyAcceptingOrders`（只做当天，UTC 00:00 自动滚动） |
| 构建器 02 | `signal.priceField / windowSec / moveThresholdPct / minAbsMove / direction / confirmationTicks / cooldownSec / maxSignalsPerMarket / requireSpreadOk` |
| 构建器 03 | `execution.orderType / sizingMode / sizingValue / maxPositionUsd / maxPositions / maxPositionsPerMarket / fillModel / slippageBufferBps`；`MarketSnapshot.tickSize / minOrderShares`（只读展示） |
| 构建器 04 | `exit.takeProfitPct / stopLossPct / maxHoldSec / holdToResolution / exitOnOppositeSignal` |
| 构建器 05 | `risk.bankrollUsd / maxDrawdownPct / dailyLossLimitUsd / killSwitch` |
| 构建器 06 | `fees.model / takerFeeRate`；`FEES.makerRebateRate`；`sim.mode / tickIntervalMs / replayLookbackMin / speed` |
| 行情卡 | `MarketSnapshot.city / bracket / impliedProbability / spread / liquidityUsd / quotes / stale` |
| 信号流 | `Signal.direction / outcome / fromPrice / toPrice / changePct / absChange / windowSec / priceField / reason` |
| 成交明细 | `Trade.side / outcome / shares / price / notional / fee / slippageCost / realizedPnl / reason / status / rejectReason` |
| 持仓表 | `Position.outcome / shares / avgPrice / midPrice / impliedProbability / unrealizedPnl / estExitFee` |
| 指标卡 | `Metrics.totalReturnPct / realizedPnl / unrealizedPnl / feesPaid / winRate / maxDrawdownPct / feeDragPct / turnoverUsd` |
| 运行历史 | `RunSummary.id / strategyName / mode / status / startedAt / endedAt / initialCapital / equity / metrics / marketsTracked / feedStatus` |
- `exit/reject reason` 文案使用 `EXIT_REASON_LABELS` / `REJECT_REASON_LABELS`，不得自造近义词。

### 10.2 原型文件与假设
- `design/prototype/index.html`：四屏静态结构 + 构建器 6 组参数 + 校验栏 + 弹窗/toast。
- `styles.css`：本文第 2 节令牌的落地（`:root` 变量）；1440 / 1024 均验证过布局规则。
- `mock.js`：本地假数据 + 900ms tick 引擎（行情随机游走、信号生成、成交/平仓、权益曲线 Canvas、Sparkline、运行历史对比、策略库过滤）；`file://` 直接可用，无 CDN / 无字体请求 / 无 fetch。
- 演示假设：城市为纽约/伦敦/首尔/重庆/香港的 11 个温度括号；`NO 侧概率` 原型用 `100 − YES.mid` 近似并在 UI 标注「估」，正式实现必须取 NO token 盘口 mid；行情为模拟数据，不是真实 API；手续费公式与 `calcTakerFee()` 一致（5 位小数）。
- 前端实现优先级：① 四屏骨架与设计令牌 → ② 构建器控件 + `validateStrategy()` 校验摘要 → ③ 实时面板（SSE 接线 + 指标/权益曲线）→ ④ 成交/持仓/成本表 → ⑤ 历史对比与策略库 → ⑥ 空态/加载/错误与无障碍收尾。

### 10.3 前端验收清单（QA）
1. 1440 / 1024 两宽度无页面级横向滚动、无重叠，指标与表格数字完整可读；768 下布局单列可用。
2. 构建器所有控件 change 后 100ms 内刷新校验摘要；errors 存在时“启动模拟运行”禁用并给出原因。
3. 单笔成本区固定展示 fees 与 `minProfitableMovePct`，数值与 `docs/04` §5.10 工例一致（p=0.5、半价差 1¢ → 9.0%）。
4. 成交行手续费 5 位小数、聚合 2 位；P&L 一律含费口径；UP/YES 与 DOWN/NO 映射与 `docs/03` §2.4 一致。
5. 运行状态胶囊严格映射 `RunSummary.status`；暂停时行情/曲线冻结但可操作“停止”。
6. 停止确认弹窗可用 Esc/遮罩关闭；确认后持仓清空、生成 `SELL` 结算成交、历史首行状态更新。
7. 空态/加载/错误三态齐全；断开行情时出现 `stale` 提示；无假数据冒充实时。
8. 键盘可完成“构建 → 启动 → 暂停 → 停止”全流程；焦点样式可见；图表有数据表替代。
9. 全站无外部网络请求（字体、图标、图表库均为本地/系统资源）；file:// 直接打开可用。
10. 文案与本文 §9 一致；不出现“真实下单/保证收益”等误导性表述，PAPER 模拟盘徽标常驻。
