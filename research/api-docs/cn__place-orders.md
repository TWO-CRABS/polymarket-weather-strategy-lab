> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# 下单

> 了解如何下单并控制订单的执行方式

通过市价单立即与可用流动性成交，或使用限价单指定价格并等待撮合。

下单前，请选择一个结果，并确认市场[正在接受订单](https://docs.polymarket.com/cn/market-data/market-details.md#市场状态)。以下示例假设你已有市场对象。如需查找或获取市场，请参阅[发现市场](https://docs.polymarket.com/cn/market-data/discover-markets.md)。

> [tab] TypeScript
>
> 根据市场版本选择每个结果 ID：
>
> ```ts theme={null}
> const yesAssetId =
>   market.version === "v2"
>     ? market.outcomes.yes.positionId
>     : market.outcomes.yes.tokenId;
> const noAssetId =
>   market.version === "v2"
>     ? market.outcomes.no.positionId
>     : market.outcomes.no.tokenId;
> ```
>
> 将 `assetId` 传给订单方法。客户端会选择匹配的 Exchange、签名域和授权路径。

> [tab] Python
>
> 根据市场版本选择每个结果 ID：
>
> ```python theme={null}
> yes_asset_id = (
>     market.outcomes.yes.position_id
>     if market.version == "v2"
>     else market.outcomes.yes.token_id
> )
> no_asset_id = (
>     market.outcomes.no.position_id
>     if market.version == "v2"
>     else market.outcomes.no.token_id
> )
> ```
>
> 将 `asset_id` 传给订单方法。客户端会选择匹配的 Exchange、签名域和授权路径。

> [tab] API
>
> Gamma 将结果 ID 存储在 JSON 编码的数组中。给定 `MARKET_JSON` 中的原始市场响应，
> 请同时选择标识符系列和一个结果。只有 `"v2"` 使用 `positionIds`；其他值都使用
> `clobTokenIds`：
>
> ```js theme={null}
> const market = JSON.parse(process.env.MARKET_JSON);
> const marketVersion = market.version === "v2" ? "v2" : "v1";
> const assetIds = JSON.parse(
>   marketVersion === "v2" ? market.positionIds : market.clobTokenIds,
> );
> const assetId = assetIds[0];
> ```
>
> 此示例选择第一个结果。选择其他结果时，请将数组索引与 `outcomes`
> 中对应的条目匹配。

## 限价单

限价单指定你愿意成交的价格，并可挂在订单簿上，直至成交、到期或被你取消。
当控制价格比立即执行更重要时，请使用限价单。

限价单还会定义未成交数量保持有效的时长：

| 有效期 | 行为 | 适用场景 |
| - | - | - |
| 取消前有效 (GTC) | 保持有效，直至成交或被你取消。 | 订单没有截止时间。 |
| 指定日期前有效 (GTD) | 保持有效，直至你指定的到期时间。 | 订单应在某个已知事件前到期。 |

> [!NOTE]
>
> 出于安全阈值考虑，GTD 订单会在标明的到期时间前一分钟失效。若要设置 N 秒的
> 实际有效期，请使用 `now + 60 + N`。此外，到期时间必须至少在未来 **3
> 分钟**；更早到期的订单会被拒绝，因此最短实际有效期约为两分钟。

### 下限价单

> [tab] TypeScript
>
> 给定一个 `SecureClient`，下限价单并检查响应：
>
> **1. 下单**
>
> 首先，使用价格和份额数调用 `placeLimitOrder()`。价格必须符合市场的最小价格增量，
> 数量必须达到最小订单数量。GTC 订单省略 `expiration`；GTD 订单则提供以秒为单位的
> Unix 时间戳。
>
> ```ts GTC theme={null}
> import { OrderSide } from "@polymarket/client";
>
> const response = await client.placeLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
> });
>
> // response: OrderResponse
> ```
>
> ```ts GTD theme={null}
> import { OrderSide } from "@polymarket/client";
>
> const expiration = Math.floor(Date.now() / 1000) + 60 + 60 * 60;
> const response = await client.placeLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
>   expiration,
> });
>
> // response: OrderResponse
> ```
>
> 两个示例都以每份 `0.52` USD 的价格买入 `10` 份。GTD 订单的实际有效期为一小时。
>
> **2. 检查响应**
>
> 然后，检查 `response.ok` 以确定 CLOB 是否接受了订单：
>
> ```ts theme={null}
> if (response.ok) {
>   console.log(response.orderId, response.status);
>   console.log(response.tradeIds, response.transactionsHashes);
> } else {
>   console.error(response.code, response.message);
> }
> ```
>
> 接受订单的响应包含订单 ID 和以下状态之一。如果订单全部或部分成交，
> `tradeIds` 集合会标识由此产生的交易；如有可用信息，`transactionsHashes`
> 会包含这些交易的交易哈希：
>
> | 状态 | 说明 |
> | - | - |
> | `live` | 订单正在订单簿上挂单。 |
> | `matched` | 订单立即与订单簿上的流动性撮合。 |
> | `delayed` | 订单可成交，但受到撮合延迟。 |
>
> 被拒绝的订单返回 `ok: false`，并附带代码和消息。

> [tab] Python
>
> 给定一个 `AsyncSecureClient`，下限价单并检查响应。同步 `SecureClient`
> 提供相同的方法。
>
> **1. 下单**
>
> 首先，使用价格和份额数调用 `place_limit_order()`。价格必须符合市场的最小价格增量，
> 数量必须达到最小订单数量。GTC 订单省略 `expiration`；GTD 订单则提供以秒为单位的
> Unix 时间戳。
>
> ```python GTC theme={null}
> response = await client.place_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
> )
>
> # response: OrderResponse
> ```
>
> ```python GTD theme={null}
> import time
>
> expiration = int(time.time()) + 60 + 60 * 60
> response = await client.place_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
>     expiration=expiration,
> )
>
> # response: OrderResponse
> ```
>
> 两个示例都以每份 `0.52` USD 的价格买入 `10` 份。GTD 订单的实际有效期为一小时。
>
> **2. 检查响应**
>
> 然后，检查 `response.ok` 以确定 CLOB 是否接受了订单：
>
> ```python theme={null}
> if response.ok:
>     print(response.order_id, response.status)
>     print(response.trade_ids, response.transactions_hashes)
> else:
>     print(response.code, response.message)
> ```
>
> 接受订单的响应包含订单 ID 和以下状态之一。如果订单全部或部分成交，
> `trade_ids` 集合会标识由此产生的交易；如有可用信息，`transactions_hashes`
> 会包含这些交易的交易哈希：
>
> | 状态 | 说明 |
> | - | - |
> | `live` | 订单正在订单簿上挂单。 |
> | `matched` | 订单立即与订单簿上的流动性撮合。 |
> | `delayed` | 订单可成交，但受到撮合延迟。 |
>
> 被拒绝的订单返回 `ok=False`，并附带代码和消息。

> [tab] API
>
> 根据价格和数量构建限价单，然后签名并提交：
>
> **1. 读取市场上下文**
>
> 首先，获取当前订单簿，以读取市场的交易约束和交易所类型：
>
> ```js theme={null}
> const response = await fetch(
>   `https://clob.polymarket.com/book?token_id=${assetId}`,
> );
> if (!response.ok) throw new Error(`CLOB request failed: ${response.status}`);
> const book = await response.json();
> ```
>
> ```json theme={null}
> {
>   "asset_id": "<yes_asset_id>",
>   "bids": [{ "price": "0.50", "size": "40" }],
>   "asks": [{ "price": "0.54", "size": "30" }],
>   "min_order_size": "5",
>   "tick_size": "0.01",
>   "neg_risk": false
> }
> ```
>
> 其中：
>
> * `min_order_size` 是 CLOB 接受的单笔订单最小份额数。
> * 对于 `"v1"` 市场，`neg_risk` 标识要使用的 CTF Exchange 路径。
>   `"v2"` 市场的二元和负风险结果都使用 Polymarket Protocol V2 Exchange。
>
> **2. 计算订单金额**
>
> 然后，选择符合 `tick_size` 的价格和达到 `min_order_size` 的份额数量。
> 使用最小变动价位确定所需精度：
>
> | 最小变动价位 | 价格小数位数 | 数量小数位数 | 金额小数位数 |
> | - | -: | -: | -: |
> | `0.1` | 1 | 2 | 3 |
> | `0.01` | 2 | 2 | 4 |
> | `0.005` | 3 | 2 | 5 |
> | `0.0025` | 4 | 2 | 6 |
> | `0.001` | 3 | 2 | 5 |
> | `0.0001` | 4 | 2 | 6 |
>
> > [!NOTE]
> >
> > 如果你的集成会存储 `tick_size` 供后续订单使用，请监听[市场
> > 数据流](https://docs.polymarket.com/cn/market-data/realtime-data.md#市场数据流)上的 `tick_size_change`
> > 事件，并在其变化时替换已存储的值。CLOB
> > 会拒绝价格不符合市场当前最小变动价位的订单。
>
> 两个方向对价格和数量的映射方式不同：
>
> * 对于 BUY，`makerAmount` 是 `price × size` USD，`takerAmount` 是份额数。
> * 对于 SELL，`makerAmount` 是份额数，`takerAmount` 是 `price × size` USD。
>
> 按以下顺序应用表中的精度：
>
> 1. 价格使用不超过**价格小数位数**的小数位。
> 2. 将份额数量向下舍入至**数量小数位数**。
> 3. 计算 USD 金额。如果超过**金额小数位数**，先向上舍入至
>    **金额小数位数 + 4**，再向下舍入至**金额小数位数**。
>
> **3. 验证并编码金额**
>
> 接下来，确认舍入后的份额数量仍达到 `min_order_size`，然后将两个金额转换为
> 六位小数精度的整数。
>
> 以 `0.52` 的价格 BUY `10` 份时，USD 金额为 `5.20`，份额数量高于最低值 `5`。
> 编码后的值为：
>
> ```json theme={null}
> {
>   "makerAmount": "5200000",
>   "takerAmount": "10000000"
> }
> ```
>
> **4. 选择交易所和签名路径**
>
> 将 EIP-712 域绑定到选择 `assetId` 时使用的同一市场版本和订单簿：
>
> ```js theme={null}
> const exchangeDomain =
>   marketVersion === "v2"
>     ? {
>         name: "Polymarket CTF Exchange",
>         version: "3",
>         chainId: 137,
>         verifyingContract: "0xe3333700cA9d93003F00f0F71f8515005F6c00Aa",
>       }
>     : book.neg_risk
>       ? {
>           name: "Polymarket CTF Exchange",
>           version: "2",
>           chainId: 137,
>           verifyingContract: "0xe2222d279d744050d28e00520010520000310F59",
>         }
>       : {
>           name: "Polymarket CTF Exchange",
>           version: "2",
>           chainId: 137,
>           verifyingContract: "0xE111180000d2663C0091e4f400237545B87B996B",
>         };
> ```
>
> 该分支会将每种有效组合保持在一起：CTF 代币 ID 搭配 CTF Exchange 和域版本
> `"2"`，或者 Position ID 搭配 Polymarket Protocol V2 Exchange 和域版本 `"3"`。
>
> 然后，根据账户钱包确定其余占位符：
>
> | 钱包 | `signature_type` | `maker_address` | `order_signer_address` |
> | - | -: | - | - |
> | 存款钱包 | `3` | 存款钱包地址 | 存款钱包地址 |
> | 代理钱包 | `1` | 代理钱包地址 | 账户签名者地址 |
> | Safe 钱包 | `2` | Safe 钱包地址 | 账户签名者地址 |
> | EOA | `0` | EOA 地址 | EOA 地址 |
>
> **5. 创建订单类型化数据**
>
> 接下来，为所选钱包创建 EIP-712 类型化数据。下面的示例复用上述路由步骤中的
> `assetId` 和 `exchangeDomain` 值：
>
> ```js Deposit Wallet Typed Data theme={null}
> const typedData = {
>   domain: exchangeDomain,
>   types: {
>     Order: [
>       { name: "salt", type: "uint256" },
>       { name: "maker", type: "address" },
>       { name: "signer", type: "address" },
>       { name: "tokenId", type: "uint256" },
>       { name: "makerAmount", type: "uint256" },
>       { name: "takerAmount", type: "uint256" },
>       { name: "side", type: "uint8" },
>       { name: "signatureType", type: "uint8" },
>       { name: "timestamp", type: "uint256" },
>       { name: "metadata", type: "bytes32" },
>       { name: "builder", type: "bytes32" },
>     ],
>     TypedDataSign: [
>       { name: "contents", type: "Order" },
>       { name: "name", type: "string" },
>       { name: "version", type: "string" },
>       { name: "chainId", type: "uint256" },
>       { name: "verifyingContract", type: "address" },
>       { name: "salt", type: "bytes32" },
>     ],
>   },
>   primaryType: "TypedDataSign",
>   message: {
>     contents: {
>       salt: "479249096354",
>       maker: "<maker_address>",
>       signer: "<order_signer_address>",
>       tokenId: assetId,
>       makerAmount: "5200000",
>       takerAmount: "10000000",
>       side: 0,
>       signatureType: 3,
>       timestamp: "<unix_milliseconds>",
>       metadata:
>         "0x0000000000000000000000000000000000000000000000000000000000000000",
>       builder:
>         "0x0000000000000000000000000000000000000000000000000000000000000000",
>     },
>     name: "DepositWallet",
>     version: "1",
>     chainId: 137,
>     verifyingContract: "<maker_address>",
>     salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
>   },
> };
> ```
>
> ```js Proxy, Safe, or EOA Typed Data theme={null}
> const typedData = {
>   domain: exchangeDomain,
>   types: {
>     Order: [
>       { name: "salt", type: "uint256" },
>       { name: "maker", type: "address" },
>       { name: "signer", type: "address" },
>       { name: "tokenId", type: "uint256" },
>       { name: "makerAmount", type: "uint256" },
>       { name: "takerAmount", type: "uint256" },
>       { name: "side", type: "uint8" },
>       { name: "signatureType", type: "uint8" },
>       { name: "timestamp", type: "uint256" },
>       { name: "metadata", type: "bytes32" },
>       { name: "builder", type: "bytes32" },
>     ],
>   },
>   primaryType: "Order",
>   message: {
>     salt: "479249096354",
>     maker: "<maker_address>",
>     signer: "<order_signer_address>",
>     tokenId: assetId,
>     makerAmount: "5200000",
>     takerAmount: "10000000",
>     side: 0,
>     signatureType: 1,
>     timestamp: "<unix_milliseconds>",
>     metadata:
>       "0x0000000000000000000000000000000000000000000000000000000000000000",
>     builder:
>       "0x0000000000000000000000000000000000000000000000000000000000000000",
>   },
> };
> ```
>
> 其中：
>
> * 已签名的 `tokenId` 字段承载所选资产 ID。对于 `"v2"` 市场，其值是 Position ID。
> * BUY 的 `side` 为 `0`，SELL 的 `side` 为 `1`。
> * 每个订单都应使用新的随机 `salt` 值。由于请求正文会将其序列化为 JSON 数字，
>   JavaScript 集成应确保该值不超过 `Number.MAX_SAFE_INTEGER`。
>
> 在 Polymarket Protocol V2 结算期间，operator 还会向 Exchange 调用提供 taker
> 收到的金额。合约会根据结算转账校验该值。它不属于已签名的 `Order` 或 CLOB
> 请求正文。
>
> **6. 签署订单**
>
> 然后，使用账户签名者签署类型化数据。存款钱包需要封装原始签名以进行 ERC-7739
> 验证。代理钱包、Safe 钱包和 EOA 则提交直接签署 Exchange `Order`
> 类型化数据后返回的标准签名。
>
> 请参阅以下使用 Viem 的示例：
>
> ```js Deposit Wallet theme={null}
> import { privateKeyToAccount } from "viem/accounts";
>
> const signer = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY);
> const innerSignature = await signer.signTypedData(typedData);
> const signature = wrapDepositWalletSignature(typedData, innerSignature);
> ```
>
> ```js Proxy, Safe, or EOA theme={null}
> import { privateKeyToAccount } from "viem/accounts";
>
> const signer = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY);
> const signature = await signer.signTypedData(typedData);
> ```
>
> ```js wrapDepositWalletSignature() theme={null}
> import { concatHex, encodeAbiParameters, keccak256, toHex } from "viem";
>
> const ORDER_TYPE =
>   "Order(uint256 salt,address maker,address signer,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint8 side,uint8 signatureType,uint256 timestamp,bytes32 metadata,bytes32 builder)";
> const EIP712_DOMAIN_TYPE =
>   "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
>
> function wrapDepositWalletSignature(typedData, innerSignature) {
>   const order = typedData.message.contents;
>   const exchangeDomain = typedData.domain;
>
>   const appDomainSeparator = keccak256(
>     encodeAbiParameters(
>       [
>         { type: "bytes32" },
>         { type: "bytes32" },
>         { type: "bytes32" },
>         { type: "uint256" },
>         { type: "address" },
>       ],
>       [
>         keccak256(toHex(EIP712_DOMAIN_TYPE)),
>         keccak256(toHex(exchangeDomain.name)),
>         keccak256(toHex(exchangeDomain.version)),
>         BigInt(exchangeDomain.chainId),
>         exchangeDomain.verifyingContract,
>       ],
>     ),
>   );
>   const contentsHash = keccak256(
>     encodeAbiParameters(
>       [
>         { type: "bytes32" },
>         { type: "uint256" },
>         { type: "address" },
>         { type: "address" },
>         { type: "uint256" },
>         { type: "uint256" },
>         { type: "uint256" },
>         { type: "uint8" },
>         { type: "uint8" },
>         { type: "uint256" },
>         { type: "bytes32" },
>         { type: "bytes32" },
>       ],
>       [
>         keccak256(toHex(ORDER_TYPE)),
>         BigInt(order.salt),
>         order.maker,
>         order.signer,
>         BigInt(order.tokenId),
>         BigInt(order.makerAmount),
>         BigInt(order.takerAmount),
>         order.side,
>         order.signatureType,
>         BigInt(order.timestamp),
>         order.metadata,
>         order.builder,
>       ],
>     ),
>   );
>
>   return concatHex([
>     innerSignature,
>     appDomainSeparator,
>     contentsHash,
>     toHex(ORDER_TYPE),
>     toHex(ORDER_TYPE.length, { size: 2 }),
>   ]);
> }
> ```
>
> **7. 提交订单**
>
> 在最终请求正文中选择未成交订单保持有效的时长。对于 GTC 订单，将 `orderType`
> 设为 `"GTC"`，将 `expiration` 设为 `"0"`。对于 GTD 订单，将 `orderType`
> 设为 `"GTD"`，并将 `expiration` 设为以秒为单位的 Unix 时间戳。
>
> ```bash GTC theme={null}
> curl -X POST "https://clob.polymarket.com/order" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{
>     "deferExec": false,
>     "order": {
>       "builder": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "expiration": "0",
>       "maker": "<maker_address>",
>       "makerAmount": "5200000",
>       "metadata": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "salt": 479249096354,
>       "side": "BUY",
>       "signature": "<signature>",
>       "signatureType": 3,
>       "signer": "<order_signer_address>",
>       "takerAmount": "10000000",
>       "timestamp": "<unix_milliseconds>",
>       "tokenId": "<yes_asset_id>"
>     },
>     "orderType": "GTC",
>     "owner": "<clob_api_key>"
>   }'
> ```
>
> ```bash GTD theme={null}
> curl -X POST "https://clob.polymarket.com/order" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{
>     "deferExec": false,
>     "order": {
>       "builder": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "expiration": "<unix_timestamp_seconds>",
>       "maker": "<maker_address>",
>       "makerAmount": "5200000",
>       "metadata": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "salt": 479249096354,
>       "side": "BUY",
>       "signature": "<signature>",
>       "signatureType": 3,
>       "signer": "<order_signer_address>",
>       "takerAmount": "10000000",
>       "timestamp": "<unix_milliseconds>",
>       "tokenId": "<yes_asset_id>"
>     },
>     "orderType": "GTD",
>     "owner": "<clob_api_key>"
>   }'
> ```
>
> 使用 [API 身份验证](https://docs.polymarket.com/cn/getting-started/api.md#身份验证)中的签名者地址和
> CLOB API 凭据，创建新的 `<clob_request_timestamp>`，并根据通过网络发送的
> 精确序列化正文生成 `<clob_l2_signature>`：
>
> ```text theme={null}
> body = <exact_serialized_request_body>
> message = <clob_request_timestamp> + "POST" + "/order" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> **8. 检查响应**
>
> 最后，检查 `success` 以确定 CLOB 是否接受了订单。成功响应包含订单 ID
> 及其插入状态；失败响应则在 `errorMsg` 中包含原因：
>
> ```json Success theme={null}
> {
>   "success": true,
>   "errorMsg": "",
>   "orderID": "<order_id>",
>   "status": "live",
>   "makingAmount": "<making_amount>",
>   "takingAmount": "<taking_amount>",
>   "transactionsHashes": ["<transaction_hash>"],
>   "tradeIDs": ["<trade_id>"]
> }
> ```
>
> ```json Failure theme={null}
> {
>   "success": false,
>   "errorMsg": "not enough balance / allowance",
>   "orderID": "",
>   "status": "",
>   "makingAmount": "",
>   "takingAmount": ""
> }
> ```
>
> 成功响应具有以下状态之一。订单全部或部分成交时，`tradeIDs` 集合会标识
> 由此产生的交易；如有可用信息，`transactionsHashes` 会包含这些交易的交易哈希：
>
> | 状态 | 说明 |
> | - | - |
> | `live` | 订单正在订单簿上挂单。 |
> | `matched` | 订单立即与订单簿上的流动性撮合。 |
> | `delayed` | 订单可成交，但受到撮合延迟。 |
> | `unmatched` | 订单可成交，但延迟失败；下单仍然成功。 |

### 仅挂单订单

仅挂单订单只会增加流动性：如果订单会立即与订单簿撮合，则会被拒绝，而不会吃单。
使用这种订单可确保你以做市商身份报价。

> [!TIP]
>
> 做市商使用仅挂单订单，通过在订单簿上挂单来增加流动性。

> [tab] TypeScript
>
> 给定一个 `SecureClient`，在下限价单时设置 `postOnly`：
>
> ```ts theme={null}
> const response = await client.placeLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
>   postOnly: true,
> });
>
> // response: OrderResponse
> ```

> [tab] Python
>
> 给定一个 `AsyncSecureClient`，在下限价单时设置 `post_only`。
> 同步 `SecureClient` 提供相同的方法。
>
> ```python theme={null}
> response = await client.place_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
>     post_only=True,
> )
>
> # response: OrderResponse
> ```

> [tab] API
>
> 按照[下限价单](#下限价单)中的 API 工作流操作，然后在最终请求中与 GTC 或 GTD
> `orderType` 一同添加 `postOnly: true`。例如，提交一个 GTC 仅挂单订单：
>
> ```bash theme={null}
> curl -X POST "https://clob.polymarket.com/order" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{
>     "deferExec": false,
>     "order": {
>       "builder": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "expiration": "0",
>       "maker": "<maker_address>",
>       "makerAmount": "5200000",
>       "metadata": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "salt": 479249096354,
>       "side": "BUY",
>       "signature": "<signature>",
>       "signatureType": 3,
>       "signer": "<order_signer_address>",
>       "takerAmount": "10000000",
>       "timestamp": "<unix_milliseconds>",
>       "tokenId": "<yes_asset_id>"
>     },
>     "orderType": "GTC",
>     "owner": "<clob_api_key>",
>     "postOnly": true
>   }'
> ```

## 市价单

市价单与限价单使用相同的底层订单，但会根据当前订单簿流动性得出可成交价格。
因此它可以立即执行，而不是挂在订单簿上。当执行比设定精确价格更重要时，请使用市价单。

在决定买入或卖出多少之前，请阅读市场的[交易
约束](https://docs.polymarket.com/cn/market-data/market-details.md#交易约束)。

### 下市价单

以下示例使用 Fill and Kill (FAK)，它会立即成交可用流动性并取消任何剩余数量。
有关 Fill or Kill (FOK)，请参阅[市价单类型](#市价单类型)。

> [tab] TypeScript
>
> 给定一个 `SecureClient`，估算价格并下市价单：
>
> **1. 估算价格**
>
> 首先，调用 `estimateMarketPrice()`，确定订单在当前订单簿深度下会触及的价格水平。
> 对于 BUY，`amount` 是要花费的 USD 名义金额。对于 SELL，`shares`
> 是要卖出的份额数，而不是其 USD 价值。
>
> ```ts Buy theme={null}
> import { OrderSide, OrderType } from "@polymarket/client";
>
> const estimatedBuyPrice = await client.estimateMarketPrice({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   amount: "10",
>   orderType: OrderType.FAK,
> });
>
> // estimatedBuyPrice: number
> ```
>
> ```ts Sell theme={null}
> import { OrderSide, OrderType } from "@polymarket/client";
>
> const estimatedSellPrice = await client.estimateMarketPrice({
>   assetId: yesAssetId,
>   side: OrderSide.SELL,
>   shares: "10",
>   orderType: OrderType.FAK,
> });
>
> // estimatedSellPrice: number
> ```
>
> 在这些示例中，`amount: "10"` 表示花费 10 USD，而 `shares: "10"`
> 表示卖出 10 份。
>
> 估算结果是当前订单簿的快照。提交订单前，可用价格可能发生变化。
>
> **2. 下单**
>
> 然后，如果估算价格可以接受，将其作为 BUY 的最高价格或 SELL 的最低价格，
> 并下市价单：
>
> ```ts Buy theme={null}
> const response = await client.placeMarketOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   amount: "10",
>   maxPrice: estimatedBuyPrice,
>   orderType: OrderType.FAK,
> });
>
> // response: OrderResponse
> ```
>
> ```ts Sell theme={null}
> const response = await client.placeMarketOrder({
>   assetId: yesAssetId,
>   side: OrderSide.SELL,
>   shares: "10",
>   minPrice: estimatedSellPrice,
>   orderType: OrderType.FAK,
> });
>
> // response: OrderResponse
> ```
>
> `maxPrice` 可防止 BUY 跨越更高价格，`minPrice` 可防止 SELL 跨越更低价格。
> 如果订单簿在提交前发生变化，订单可能仅部分成交或完全不成交。
>
> 指定 `maxPrice` 时，SDK 会将 BUY 份额数向下舍入至支持的精度，且不会增加
> 签名中的支出金额，使订单仍能与该价格的卖单成交。如果计入手续费后的最终金额
> 无法保持价格上限，SDK 最多刷新一次市场元数据；如果金额仍然无效，则会在
> 签名前抛出 `UserInputError`。此时请增加 `amount` 和已设置的 `maxSpend`，
> 或选择其他 `maxPrice`。
>
> **3. 检查响应**
>
> 最后，检查 `response.ok` 以确定 CLOB 是否接受了订单：
>
> ```ts theme={null}
> if (response.ok) {
>   console.log(response.orderId, response.status);
>   console.log(response.tradeIds, response.transactionsHashes);
> } else {
>   console.error(response.code, response.message);
> }
> ```
>
> 接受订单的响应包含订单 ID 和以下状态之一。如果订单全部或部分成交，
> `tradeIds` 会标识由此产生的交易；如有可用信息，`transactionsHashes`
> 会包含这些交易的交易哈希：
>
> | 状态 | 说明 |
> | - | - |
> | `matched` | 订单立即与订单簿上的流动性撮合。 |
> | `delayed` | 市场设有撮合延迟；延迟结束后才开始撮合。 |
>
> `delayed` 响应已被接受，但尚未撮合。其 `makingAmount` 和 `takingAmount`
> 为 `"0"`，`tradeIds` 和 `transactionsHashes` 为空，因为还没有成交。请将它视为
> 待处理订单，而不是成交，并使用[实时订单更新](https://docs.polymarket.com/cn/trading/realtime-order-updates.md)
> 跟踪结果。下单前可读取
> [`market.trading.secondsDelay`](https://docs.polymarket.com/cn/market-data/market-details#市场时间)
> 来识别具有此行为的市场。
>
> 市价单不会挂在订单簿上：无法成交的数量会被取消。被拒绝的订单返回
> `ok: false`，并附带代码和消息。
>
> **4. 等待成交结算（可选）**
>
> 订单撮合后会异步结算，因此已接受的响应可能尚未包含交易哈希。如需这些哈希，
> 请将已接受的响应传给 `waitForOrderFillSettlement()`：
>
> ```ts theme={null}
> if (response.ok) {
>   const hashes = await client.waitForOrderFillSettlement(response);
>   // hashes: TxHash[]
> }
> ```
>
> 该调用会等待 `tradeIds` 标识的每笔成交完成链上结算，并返回结算交易哈希。
> 如果 `tradeIds` 为空，则立即返回 `transactionsHashes`。它不会等待 `delayed`
> 订单完成撮合。默认最长等待 30 秒（可通过 `timeoutMs` 配置）；如果截止时成交仍在
> 结算，则抛出 `TimeoutError`。已执行的交易不受影响。

> [tab] Python
>
> 给定一个 `AsyncSecureClient`，估算价格并下市价单。同步 `SecureClient`
> 提供相同的方法。
>
> **1. 估算价格**
>
> 首先，调用 `estimate_market_price()`，确定订单在当前订单簿深度下会触及的价格水平。
> 对于 BUY，`amount` 是要花费的 USD 名义金额。对于 SELL，`shares`
> 是要卖出的份额数，而不是其 USD 价值。
>
> ```python Buy theme={null}
> estimated_buy_price = await client.estimate_market_price(
>     asset_id=yes_asset_id,
>     side="BUY",
>     amount="10",
>     order_type="FAK",
> )
>
> # estimated_buy_price: Decimal
> ```
>
> ```python Sell theme={null}
> estimated_sell_price = await client.estimate_market_price(
>     asset_id=yes_asset_id,
>     side="SELL",
>     shares="10",
>     order_type="FAK",
> )
>
> # estimated_sell_price: Decimal
> ```
>
> 在这些示例中，`amount="10"` 表示花费 10 USD，而 `shares="10"`
> 表示卖出 10 份。
>
> 估算结果是当前订单簿的快照。提交订单前，可用价格可能发生变化。
>
> **2. 下单**
>
> 然后，如果估算价格可以接受，将其作为 BUY 的最高价格或 SELL 的最低价格，
> 并下市价单：
>
> ```python Buy theme={null}
> response = await client.place_market_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     amount="10",
>     max_price=estimated_buy_price,
>     order_type="FAK",
> )
>
> # response: OrderResponse
> ```
>
> ```python Sell theme={null}
> response = await client.place_market_order(
>     asset_id=yes_asset_id,
>     side="SELL",
>     shares="10",
>     min_price=estimated_sell_price,
>     order_type="FAK",
> )
>
> # response: OrderResponse
> ```
>
> `max_price` 可防止 BUY 跨越更高价格，`min_price` 可防止 SELL 跨越更低价格。
> 如果金额精度无法让 BUY 保持在下一个可能价格之下，SDK 会刷新一次市场元数据，
> 然后在签名前抛出 `UserInputError`。如果订单簿在提交前发生变化，订单可能仅部分
> 成交或完全不成交。
>
> **3. 检查响应**
>
> 最后，检查 `response.ok` 以确定 CLOB 是否接受了订单：
>
> ```python theme={null}
> if response.ok:
>     print(response.order_id, response.status)
>     print(response.trade_ids, response.transactions_hashes)
> else:
>     print(response.code, response.message)
> ```
>
> 接受订单的响应包含订单 ID 和以下状态之一。如果订单全部或部分成交，
> `trade_ids` 会标识由此产生的交易；如有可用信息，`transactions_hashes`
> 会包含这些交易的交易哈希：
>
> | 状态 | 说明 |
> | - | - |
> | `matched` | 订单立即与订单簿上的流动性撮合。 |
> | `delayed` | 市场设有撮合延迟；延迟结束后才开始撮合。 |
>
> `delayed` 响应已被接受，但尚未撮合。其 `making_amount` 和 `taking_amount`
> 为 `0`，`trade_ids` 和 `transactions_hashes` 为空，因为还没有成交。请将它视为
> 待处理订单，而不是成交，并使用[实时订单更新](https://docs.polymarket.com/cn/trading/realtime-order-updates.md)
> 跟踪结果。下单前可读取
> [`market.trading.seconds_delay`](https://docs.polymarket.com/cn/market-data/market-details#市场时间)
> 来识别具有此行为的市场。
>
> 市价单不会挂在订单簿上：无法成交的数量会被取消。被拒绝的订单返回
> `ok=False`，并附带代码和消息。
>
> **4. 等待成交结算（可选）**
>
> 订单撮合后会异步结算，因此已接受的响应可能尚未包含交易哈希。如需这些哈希，
> 请将已接受的响应传给 `wait_for_order_fill_settlement()`：
>
> ```python theme={null}
> if response.ok:
>     hashes = await client.wait_for_order_fill_settlement(response)
>     # hashes: tuple[TransactionHash, ...]
> ```
>
> 该调用会等待 `trade_ids` 标识的每笔成交完成链上结算，并返回结算交易哈希。
> 如果 `trade_ids` 为空，则立即返回 `transactions_hashes`。它不会等待 `delayed`
> 订单完成撮合。默认最长等待 30 秒（可通过 `timeout_s` 配置）；如果截止时成交仍在
> 结算，则抛出 `TimeoutError`。已执行的交易不受影响。

> [tab] API
>
> 市价单复用[下限价单](#下限价单)中的构建和签名流程。从当前订单簿开始，
> 计算市价单金额，然后使用这些值构建并签署相同的 Exchange 订单。
> 以下步骤说明订单与当前流动性成交时需要做出的更改：
>
> **1. 估算价格**
>
> 首先，获取当前订单簿：
>
> ```js theme={null}
> const response = await fetch(
>   `https://clob.polymarket.com/book?token_id=${assetId}`,
> );
> if (!response.ok) throw new Error(`CLOB request failed: ${response.status}`);
> const book = await response.json();
> ```
>
> ```json theme={null}
> {
>   "asset_id": "<yes_asset_id>",
>   "bids": [{ "price": "0.50", "size": "40" }],
>   "asks": [
>     { "price": "0.54", "size": "30" },
>     { "price": "0.52", "size": "25" }
>   ],
>   "min_order_size": "5",
>   "tick_size": "0.01",
>   "neg_risk": false
> }
> ```
>
> 根据订单方向估算价格：
>
> * 对于 BUY，从最优价格开始向上遍历卖单并累加 `price × size`，直到总额达到
>   你要花费的 USD 金额。使用最后一个价格作为最高价格。
> * 对于 SELL，从最优价格开始向下遍历买单，直到累计数量达到你要卖出的份额数。
>   使用最后一个价格作为最低价格。
>
> 在此示例中，10 USD 的 BUY 可以完全以 `0.52` 成交，因此最高价格为 `0.52`。
> 如果订单簿在提交前发生变化，请重新计算估算价格。
>
> **2. 计算订单金额**
>
> 使用上述限价单工作流中的精度表，但要根据订单方向映射金额：
>
> * 对于 BUY，`makerAmount` 是要花费的 USD 金额，`takerAmount` 是
>   `makerAmount ÷ 最高价格` 份。
> * 对于 SELL，`makerAmount` 是份额数，`takerAmount` 是
>   `makerAmount × 最低价格` USD。
>
> 将价格和输入金额向下舍入至表中的**价格小数位数**和**数量小数位数**。
> 然后将 `takerAmount` 向下舍入至**金额小数位数**。对于 BUY，向下舍入份额数
> 可使订单价格 `makerAmount ÷ takerAmount` 等于或略高于最高价格，从而能够与
> 挂在该价格的卖单成交。对于 SELL，`makerAmount × 最低价格` 在
> **金额小数位数**内已是精确值，无需舍入。
>
> 最高价格为 `0.52`、最小变动价位为 `0.01` 的 10 USD BUY 会得到 `19.2307` 份，
> 高于订单簿中的最低 5 份。转换为六位小数精度的整数后，金额为：
>
> ```json theme={null}
> {
>   "makerAmount": "10000000",
>   "takerAmount": "19230700"
> }
> ```
>
> 订单价格为 `10 ÷ 19.2307 ≈ 0.5200019`。它高于最高价格的幅度小于最细的最小
> 变动价位 `0.0001`，因此订单不会跨越更高的卖价，成交按挂单卖价执行。如果
> `makerAmount ÷ takerAmount` 达到最高价格加 `0.0001`，请增加金额或选择其他
> 最高价格。在最小变动价位为 `0.1` 的市场中，小额订单可能出现这种情况。
>
> **3. 构建并签署订单**
>
> 按照限价单工作流，使用 Gamma 市场的 `version` 和订单簿中的 `neg_risk`
> 值选择 Exchange 合约。然后确定钱包的 maker、签名者和签名类型。构建相同的
> EIP-712 订单类型化数据，并用上面计算的市价单金额替换 `makerAmount` 和
> `takerAmount`。
>
> 使用账户签名者签名。存款钱包使用 `TypedDataSign` 载荷，并封装生成的签名以进行
> ERC-7739 验证；代理钱包、Safe 钱包和 EOA 直接签署 Exchange `Order`。
>
> **4. 提交市价单**
>
> 将 `orderType` 设为 `"FAK"` 并提交订单：
>
> ```bash theme={null}
> curl -X POST "https://clob.polymarket.com/order" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{
>     "deferExec": false,
>     "order": {
>       "builder": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "expiration": "0",
>       "maker": "<maker_address>",
>       "makerAmount": "10000000",
>       "metadata": "0x0000000000000000000000000000000000000000000000000000000000000000",
>       "salt": 479249096354,
>       "side": "BUY",
>       "signature": "<signature>",
>       "signatureType": 3,
>       "signer": "<order_signer_address>",
>       "takerAmount": "19230700",
>       "timestamp": "<unix_milliseconds>",
>       "tokenId": "<yes_asset_id>"
>     },
>     "orderType": "FAK",
>     "owner": "<clob_api_key>"
>   }'
> ```
>
> 使用 [API 身份验证](https://docs.polymarket.com/cn/getting-started/api.md#身份验证)中的签名者地址和
> CLOB API 凭据，创建新的 `<clob_request_timestamp>`，并根据通过网络发送的
> 精确序列化正文生成 `<clob_l2_signature>`：
>
> ```text theme={null}
> body = <exact_serialized_request_body>
> message = <clob_request_timestamp> + "POST" + "/order" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> 市价单的 `expiration` 必须为 `"0"`。
>
> **5. 检查响应**
>
> 最后，检查 `success`。FAK 订单可能全部或部分成交；任何未成交的剩余数量都会被取消。
> 成功成交由 `tradeIDs` 标识；`transactionsHashes` 包含返回响应时可用的交易哈希。
> 被拒绝的订单会在 `errorMsg` 中说明失败原因：
>
> ```json Success theme={null}
> {
>   "success": true,
>   "errorMsg": "",
>   "orderID": "<order_id>",
>   "status": "matched",
>   "makingAmount": "<making_amount>",
>   "takingAmount": "<taking_amount>",
>   "transactionsHashes": ["<transaction_hash>"],
>   "tradeIDs": ["<trade_id>"]
> }
> ```
>
> ```json Failure theme={null}
> {
>   "success": false,
>   "errorMsg": "not enough balance / allowance",
>   "orderID": "",
>   "status": "",
>   "makingAmount": "",
>   "takingAmount": ""
> }
> ```

### 限制市价买单支出

市价 BUY 的金额是扣费前的 USD 名义金额。适用的[平台
费用](https://docs.polymarket.com/cn/market-data/market-details.md#交易费用)和[构建者吃单
费用](https://docs.polymarket.com/cn/programs/builders/fees.md)会在此基础上收取。当总成本必须保持在固定预算内时，
请设置包含所有费用的支出上限。

> [tab] TypeScript
>
> 将 `maxSpend` 设为你愿意支付的最高金额（含费用）：
>
> ```ts theme={null}
> const response = await client.placeMarketOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   amount: "10",
>   maxSpend: "10",
>   maxPrice: estimatedBuyPrice,
>   orderType: OrderType.FAK,
> });
> ```
>
> 此处，`amount: "10"` 请求扣费前买入 10 USD，而 `maxSpend: "10"`
> 将总支出限制为 10 USD。SDK 会减少签名的买入金额，使订单及其费用不超过上限。
> 省略 `maxSpend` 则会在 `amount` 之上另付费用。

> [tab] Python
>
> 将 `max_spend` 设为你愿意支付的最高金额（含费用）：
>
> ```python theme={null}
> response = await client.place_market_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     amount="10",
>     max_spend="10",
>     max_price=estimated_buy_price,
>     order_type="FAK",
> )
> ```
>
> 此处，`amount="10"` 请求扣费前买入 10 USD，而 `max_spend="10"`
> 将总支出限制为 10 USD。SDK 会减少签名的买入金额，使订单及其费用不超过上限。
> 省略 `max_spend` 则会在 `amount` 之上另付费用。

> [tab] API
>
> 签名前，减少 `makerAmount`，使订单名义金额加上适用的平台和构建者吃单费用
> 不超过预期上限。然后在计算上述市价单金额时使用经费用调整后的值。

### 市价单类型

市价单根据是否接受部分成交，使用以下两种执行类型之一：

| 类型 | 行为 |
| - | - |
| Fill and Kill (FAK) | 立即与可用流动性成交，并取消任何未成交的剩余数量。 |
| Fill or Kill (FOK) | 立即成交整个订单，否则完全不成交。 |

> [tab] TypeScript
>
> 在 `SecureClient` 上调用 `placeMarketOrder()` 时设置 `orderType`。
> 默认类型为 Fill and Kill。
>
> ```ts FAK theme={null}
> import { OrderSide, OrderType } from "@polymarket/client";
>
> const response = await client.placeMarketOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   amount: "10",
>   orderType: OrderType.FAK,
> });
>
> // response: OrderResponse
> ```
>
> ```ts FOK theme={null}
> import { OrderSide, OrderType } from "@polymarket/client";
>
> const response = await client.placeMarketOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   amount: "10",
>   orderType: OrderType.FOK,
> });
>
> // response: OrderResponse
> ```

> [tab] Python
>
> 在 `AsyncSecureClient` 上调用 `place_market_order()` 时设置 `order_type`。
> 默认类型为 Fill and Kill，同步 `SecureClient` 提供相同的方法。
>
> ```python FAK theme={null}
> response = await client.place_market_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     amount="10",
>     order_type="FAK",
> )
>
> # response: OrderResponse
> ```
>
> ```python FOK theme={null}
> response = await client.place_market_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     amount="10",
>     order_type="FOK",
> )
>
> # response: OrderResponse
> ```

> [tab] API
>
> `orderType` 不属于已签名的 EIP-712 订单类型化数据。在顶层 `/order`
> 正文中，将它与已签名订单一同设为 `FAK` 或 `FOK`：
>
> ```json theme={null}
> {
>   "deferExec": false,
>   "order": { "…": "…" },
>   "orderType": "FOK",
>   "owner": "<clob_api_key>"
> }
> ```

## 分别创建和提交

当你需要检查订单、临时存储订单或将其加入后续批次时，可以创建并签署订单而不提交。

> [tab] TypeScript
>
> 给定一个 `SecureClient`，在本地创建已签名订单，准备好后再提交：
>
> ```ts theme={null}
> const signedOrder = await client.createLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
> });
>
> // signedOrder: SignedOrder
>
> const response = await client.postOrder(signedOrder);
>
> // response: OrderResponse
> ```

> [tab] Python
>
> 给定一个 `AsyncSecureClient`，在本地创建已签名订单，准备好后再提交。
> 同步 `SecureClient` 提供相同的方法。
>
> ```python theme={null}
> signed_order = await client.create_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
> )
>
> # signed_order: SignedOrder
>
> response = await client.post_order(signed_order)
>
> # response: OrderResponse
> ```

> [tab] API
>
> API 本身分为两步：签名在本地完成，提交则是独立的 HTTP 请求。按照
> [下限价单](#下限价单)中的说明构建并签署订单，然后保留已签名订单，
> 直至准备好提交。

## 批量提交订单

在一个请求中提交多个已签名订单。这适合在做市时跨多个价格水平放置阶梯报价。

> [tab] TypeScript
>
> 给定一个 `SecureClient`，创建每个已签名订单，然后将它们一并传给
> `postOrders()`：
>
> ```ts theme={null}
> const firstOrder = await client.createLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.51",
>   size: "10",
> });
>
> const secondOrder = await client.createLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
> });
>
> const responses = await client.postOrders([firstOrder, secondOrder]);
>
> // responses: OrderResponse[]
> ```
>
> ```json Example theme={null}
> [
>   {
>     "ok": true,
>     "orderId": "0x0827…",
>     "status": "live",
>     "makingAmount": "0",
>     "takingAmount": "0",
>     "transactionsHashes": [],
>     "tradeIds": []
>   },
>   {
>     "ok": true,
>     "orderId": "0x09f3…",
>     "status": "live",
>     "makingAmount": "0",
>     "takingAmount": "0",
>     "transactionsHashes": [],
>     "tradeIds": []
>   }
> ]
> ```
>
> `postOrders` 每次调用接受 1 至 15 个已签名订单。`responses` 中的每个条目
> 都可能被单独接受或拒绝，因此请检查每个条目的 `ok`，不要假定整个批次会一同成功或失败。

> [tab] Python
>
> 给定一个 `AsyncSecureClient`，创建每个已签名订单，然后将它们一并传给
> `post_orders()`。同步 `SecureClient` 提供相同的方法。
>
> ```python theme={null}
> first_order = await client.create_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.51",
>     size="10",
> )
>
> second_order = await client.create_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
> )
>
> responses = await client.post_orders([first_order, second_order])
>
> # responses: tuple[OrderResponse, ...]
> ```
>
> ```python OrderResponse Type theme={null}
> tuple[OrderResponse, ...]
> ```
>
> ```json OrderResponse Example theme={null}
> [
>   {
>     "ok": true,
>     "order_id": "0x0827…",
>     "status": "live",
>     "making_amount": "0",
>     "taking_amount": "0",
>     "trade_ids": [],
>     "transactions_hashes": []
>   },
>   {
>     "ok": true,
>     "order_id": "0x09f3…",
>     "status": "live",
>     "making_amount": "0",
>     "taking_amount": "0",
>     "trade_ids": [],
>     "transactions_hashes": []
>   }
> ]
> ```
>
> `post_orders` 每次调用接受 1 至 15 个已签名订单。`responses` 中的每个条目
> 都可能被单独接受或拒绝，因此请检查每个条目的 `ok`，不要假定整个批次会一同成功或失败。

> [tab] API
>
> 向 `/orders` 发送包含 1 至 15 个已签名订单条目的数组：
>
> ```bash theme={null}
> curl -X POST "https://clob.polymarket.com/orders" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '[
>     {
>       "deferExec": false,
>       "order": { "…": "…" },
>       "orderType": "GTC",
>       "owner": "<clob_api_key>"
>     },
>     {
>       "deferExec": false,
>       "order": { "…": "…" },
>       "orderType": "GTC",
>       "owner": "<clob_api_key>"
>     }
>   ]'
> ```
>
> 使用 [API 身份验证](https://docs.polymarket.com/cn/getting-started/api.md#身份验证)中的签名者地址和
> CLOB API 凭据，创建新的 `<clob_request_timestamp>`，并根据通过网络发送的
> 精确序列化数组生成 `<clob_l2_signature>`：
>
> ```text theme={null}
> body = <exact_serialized_order_array>
> message = <clob_request_timestamp> + "POST" + "/orders" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> 每个条目与单个 `/order` 请求使用相同的结构。响应会为每个已提交订单包含一个结果。
> 例如，一个订单可能被接受，而另一个被拒绝：
>
> ```json theme={null}
> [
>   {
>     "success": true,
>     "errorMsg": "",
>     "orderID": "<order_id>",
>     "status": "live",
>     "makingAmount": "",
>     "takingAmount": "",
>     "transactionsHashes": [],
>     "tradeIDs": []
>   },
>   {
>     "success": false,
>     "errorMsg": "not enough balance / allowance",
>     "orderID": "",
>     "status": "",
>     "makingAmount": "",
>     "takingAmount": ""
>   }
> ]
> ```
>
> 请检查每个结果，不要将整个批次视为一次成功或失败。

## 构建者归因

作为[构建者计划](https://docs.polymarket.com/cn/programs/builders/overview.md)的一部分，请将构建者代码附加到订单，
以便将已撮合交易计入你的构建者资料。该代码是标识你资料的 32 字节十六进制字符串。

### 附加构建者代码

在构建者账户中，打开 polymarket.com → 设置 → 构建者，然后从资料中复制
**构建者代码**：

![打开设置，选择构建者，然后复制构建者代码](https://mintcdn.com/polymarket-292d1b1b/1lJ_npwaE_MShiVL/images/builder-code-tutorial.png?fit=max\&auto=format\&n=1lJ_npwaE_MShiVL\&q=85\&s=6648f4bfed0dd365fc1ad40664371032)

在每个希望归因到你的集成的订单中包含构建者代码。由于它是已签名订单的一部分，
请在签名前添加。

> [tab] TypeScript
>
> 给定一个 `SecureClient`，下单时通过 `builderCode` 传入该代码：
>
> ```ts theme={null}
> const response = await client.placeLimitOrder({
>   assetId: yesAssetId,
>   side: OrderSide.BUY,
>   price: "0.52",
>   size: "10",
>   builderCode: process.env.POLYMARKET_BUILDER_CODE,
> });
>
> // response: OrderResponse
> ```

> [tab] Python
>
> 给定一个 `AsyncSecureClient`（同步代码使用 `SecureClient`），下单时通过
> `builder_code` 传入该代码：
>
> ```python theme={null}
> response = await client.place_limit_order(
>     asset_id=yes_asset_id,
>     side="BUY",
>     price="0.52",
>     size="10",
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
> )
>
> # response: OrderResponse
> ```

> [tab] API
>
> 签名前，将订单结构的 `builder` 字段设为你的构建者代码，以替代默认的 32 字节零值。
> 该代码会成为已签名订单的一部分，并将由此产生的交易归因到你的构建者资料。
>
> ```json theme={null}
> {
>   "deferExec": false,
>   "order": {
>     "builder": "<builder_code>",
>     "…": "…"
>   },
>   "orderType": "GTC",
>   "owner": "<clob_api_key>"
> }
> ```

### 验证归因

归因订单撮合后，使用构建者代码查询构建者交易，以确认该交易已计入你的资料。
尚未撮合的订单不会出现在构建者交易结果中。

> [tab] TypeScript
>
> 通过 `PublicClient` 或 `SecureClient` 使用 `listBuilderTrades`，
> 然后获取匹配交易的第一页：
>
> ```ts theme={null}
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE,
> });
>
> const page = await pages.firstPage();
>
> // page.items: BuilderTrade[]
> ```

> [tab] Python
>
> 通过 `AsyncPublicClient` 或 `AsyncSecureClient` 使用 `list_builder_trades`，
> 然后获取匹配交易的第一页。同步 `PublicClient` 和 `SecureClient` 提供相同的方法。
>
> ```python theme={null}
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
> )
>
> page = await pages.first_page()
>
> # page.items: tuple[BuilderTrade, ...]
> ```

> [tab] API
>
> 构建者交易是公开读取，无需身份验证标头：
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/builder/trades?builder_code=$POLYMARKET_BUILDER_CODE"
> ```
>
> 使用响应中的 `next_cursor` 值请求后续页面。

你还可以在[构建者排行榜](https://builders.polymarket.com)上监控已计入的交易量。
已撮合交易量最多可能需要 24 小时才会显示。


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.