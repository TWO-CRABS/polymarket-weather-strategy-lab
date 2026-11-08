> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Manage Orders

> Learn how to track and manage orders after submitting them.

After submitting an order, use authenticated account reads to check its current
state, reconcile open orders and resulting trades, and cancel liquidity you no
longer want resting on the book.

> [!NOTE]
>
> Clients authenticated with [Session
> Keys](https://docs.polymarket.com/trading/session-keys.md#session-key-considerations) can only fetch orders
> and trades associated with those Session Keys. **Deposit Wallet Owners**
> cannot fetch orders from authorized Session Keys.

## Fetch an Order

Look up a single order by its ID. Use this to check the current status of an
order you already know about, rather than scanning the full list of open
orders.

> [tab] TypeScript
>
> Call `fetchOrder()` on a `SecureClient` to fetch an order by ID:
>
> ```ts theme={null}
> const order = await client.fetchOrder({ orderId: "ORDER_ID" });
>
> // order: OpenOrder
> ```
>
> The method returns an `OpenOrder` with normalized asset, decimal, and date
> values:
>
> ```ts OpenOrder Type theme={null}
> type OpenOrder = {
>   id: string;
>   conditionId: ConditionId;
>   assetId: ClobAssetId;
>   owner: string;
>   makerAddress: string;
>   side: string;
>   price: DecimalString;
>   originalSize: DecimalString;
>   sizeMatched: DecimalString;
>   outcome: string;
>   orderType: string;
>   status: string;
>   associateTrades: string[];
>   createdAt: IsoDateTimeString;
>   expiresAt?: IsoDateTimeString;
> };
> ```
>
> ```json OpenOrder Example theme={null}
> {
>   "id": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>   "conditionId": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>   "assetId": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>   "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>   "makerAddress": "0x1234567890123456789012345678901234567890",
>   "side": "BUY",
>   "price": "0.52",
>   "originalSize": "10",
>   "sizeMatched": "0",
>   "outcome": "Yes",
>   "orderType": "GTD",
>   "status": "LIVE",
>   "associateTrades": [],
>   "createdAt": "2026-06-01T12:00:00.000Z",
>   "expiresAt": "2026-06-01T13:00:00.000Z"
> }
> ```
>
> The unified SDK uses `assetId` for an outcome's trading identifier: a token
> ID for a CTF market or a position ID for a Polymarket Protocol V2 market.
> Use the identifier exposed for that outcome.
>
> `expiresAt` is present when the response includes an expiration. Otherwise,
> the field is omitted.

> [tab] Python
>
> Call `get_order()` on an `AsyncSecureClient` to fetch an order by ID. The
> synchronous `SecureClient` provides the same method.
>
> ```python theme={null}
> order = await client.get_order(order_id="ORDER_ID")
>
> # order: OpenOrder
> ```
>
> The method returns an `OpenOrder` with normalized asset, decimal, and date
> values:
>
> ```python OpenOrder Type theme={null}
> class OpenOrder:
>     id: str
>     condition_id: ConditionId
>     asset_id: ClobAssetId
>     owner: str
>     maker_address: str
>     side: Literal["BUY", "SELL"]
>     price: Decimal
>     original_size: Decimal
>     size_matched: Decimal
>     outcome: str
>     order_type: str
>     status: str
>     associate_trades: tuple[str, ...]
>     created_at: datetime
>     expires_at: datetime | None
> ```
>
> ```json OpenOrder Example theme={null}
> {
>   "id": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>   "condition_id": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>   "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>   "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>   "maker_address": "0x1234567890123456789012345678901234567890",
>   "side": "BUY",
>   "price": "0.52",
>   "original_size": "10",
>   "size_matched": "0",
>   "outcome": "Yes",
>   "order_type": "GTD",
>   "status": "LIVE",
>   "associate_trades": [],
>   "created_at": "2026-06-01T12:00:00Z",
>   "expires_at": "2026-06-01T13:00:00Z"
> }
> ```
>
> The unified SDK uses `asset_id` for an outcome's trading identifier: a token
> ID for a CTF market or a position ID for a Polymarket Protocol V2 market.
> Use the identifier exposed for that outcome.
>
> `expires_at` contains the normalized expiration when one is returned and
> can otherwise be `None`.

> [tab] API
>
> Fetch the order with an authenticated CLOB request. See [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for the complete
> signing flow.
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/data/order/$ORDER_ID" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated as follows:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "GET" + "/data/order/$ORDER_ID"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> The CLOB returns the order in its wire response shape:
>
> ```ts Order Type theme={null}
> type Order = {
>   id: string;
>   market: string;
>   asset_id: string;
>   owner: string;
>   maker_address: string;
>   side: string;
>   price: string;
>   original_size: string;
>   size_matched: string;
>   outcome: string;
>   order_type: string;
>   status: string;
>   associate_trades?: string[];
>   created_at: number;
>   expiration: string;
> };
> ```
>
> ```json Order Example theme={null}
> {
>   "id": "ORDER_ID",
>   "market": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>   "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>   "owner": "0x1234...",
>   "maker_address": "0x1234...",
>   "side": "BUY",
>   "price": "0.52",
>   "original_size": "10",
>   "size_matched": "0",
>   "outcome": "Yes",
>   "order_type": "GTC",
>   "status": "LIVE",
>   "associate_trades": [],
>   "created_at": 1748779200,
>   "expiration": "0"
> }
> ```
>
> An `expiration` of `"0"` means the order is GTC and never expires on a
> timer.

See the [order response reference](https://docs.polymarket.com/api-reference/trade/get-single-order-by-id.md)
for quantity units and statuses.

## List Open Orders

Retrieve every resting order on the account, optionally narrowed to one outcome
or market. Filtering by a specific order ID can also return a canceled or fully
matched order.

> [tab] TypeScript
>
> Call `listOpenOrders()` on a `SecureClient` to iterate over the account's
> open orders:
>
> ```ts theme={null}
> const pages = client.listOpenOrders();
>
> for await (const page of pages) {
>   // page.items: OpenOrder[]
> }
> ```
>
> Pass a filter to narrow the results. Despite its name, `market` takes the
> market's condition ID:
>
> ```ts theme={null}
> const yesAssetId =
>   market.version === "v2"
>     ? market.outcomes.yes.positionId
>     : market.outcomes.yes.tokenId;
> if (yesAssetId === null) {
>   throw new Error("Market outcome ID not found.");
> }
> ```
>
> ```ts Asset theme={null}
> const pages = client.listOpenOrders({
>   assetId: yesAssetId,
> });
> ```
>
> ```ts Condition theme={null}
> const pages = client.listOpenOrders({
>   market: market.conditionId!,
> });
> ```
>
> ```ts Order ID theme={null}
> const pages = client.listOpenOrders({
>   id: order.id,
> });
> ```
>
> Each page contains `OpenOrder` items:
>
> ```ts OpenOrder Type theme={null}
> type OpenOrder = {
>   id: string;
>   conditionId: ConditionId;
>   assetId: ClobAssetId;
>   owner: string;
>   makerAddress: string;
>   side: string;
>   price: DecimalString;
>   originalSize: DecimalString;
>   sizeMatched: DecimalString;
>   outcome: string;
>   orderType: string;
>   status: string;
>   associateTrades: string[];
>   createdAt: IsoDateTimeString;
>   expiresAt?: IsoDateTimeString;
> };
> ```
>
> ```json OpenOrder Example theme={null}
> {
>   "items": [
>     {
>       "id": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "conditionId": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "assetId": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "makerAddress": "0x1234567890123456789012345678901234567890",
>       "side": "BUY",
>       "price": "0.52",
>       "originalSize": "10",
>       "sizeMatched": "0",
>       "outcome": "Yes",
>       "orderType": "GTD",
>       "status": "LIVE",
>       "associateTrades": [],
>       "createdAt": "2026-06-01T12:00:00.000Z",
>       "expiresAt": "2026-06-01T13:00:00.000Z"
>     }
>   ],
>   "hasMore": false,
>   "totalCount": 1
> }
> ```

> [tab] Python
>
> Call `list_open_orders()` on an `AsyncSecureClient` to iterate over the
> account's open orders. The synchronous `SecureClient` provides the same method.
>
> ```python theme={null}
> pages = client.list_open_orders()
>
> async for page in pages:
>     # page.items: tuple[OpenOrder, ...]
> ```
>
> Pass a filter to narrow the results. Despite its name, `market` takes the
> market's condition ID:
>
> ```python theme={null}
> yes_asset_id = (
>     market.outcomes.yes.position_id
>     if market.version == "v2"
>     else market.outcomes.yes.token_id
> )
> if yes_asset_id is None:
>     raise ValueError("Market outcome ID not found.")
> ```
>
> ```python Asset theme={null}
> pages = client.list_open_orders(
>     asset_id=yes_asset_id,
> )
> ```
>
> ```python Condition theme={null}
> pages = client.list_open_orders(
>     market=market.condition_id,
> )
> ```
>
> ```python Order ID theme={null}
> pages = client.list_open_orders(
>     id=order.id,
> )
> ```
>
> Each page contains `OpenOrder` items:
>
> ```python OpenOrder Type theme={null}
> class OpenOrder:
>     id: str
>     condition_id: ConditionId
>     asset_id: ClobAssetId
>     owner: str
>     maker_address: str
>     side: Literal["BUY", "SELL"]
>     price: Decimal
>     original_size: Decimal
>     size_matched: Decimal
>     outcome: str
>     order_type: str
>     status: str
>     associate_trades: tuple[str, ...]
>     created_at: datetime
>     expires_at: datetime | None
> ```
>
> ```json OpenOrder Example theme={null}
> {
>   "items": [
>     {
>       "id": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "condition_id": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "maker_address": "0x1234567890123456789012345678901234567890",
>       "side": "BUY",
>       "price": "0.52",
>       "original_size": "10",
>       "size_matched": "0",
>       "outcome": "Yes",
>       "order_type": "GTD",
>       "status": "LIVE",
>       "associate_trades": [],
>       "created_at": "2026-06-01T12:00:00Z",
>       "expires_at": "2026-06-01T13:00:00Z"
>     }
>   ],
>   "has_more": false,
>   "next_cursor": null,
>   "total_count": 1
> }
> ```

> [tab] API
>
> List open orders with an authenticated CLOB request, optionally filtering
> by `id`, `market`, or `asset_id`. See [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for the complete
> signing flow.
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/data/orders?asset_id=$ASSET_ID" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated as follows:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "GET" + "/data/orders"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> The CLOB returns the matching orders in its wire response shape:
>
> ```ts Order Type theme={null}
> type Order = {
>   id: string;
>   market: string;
>   asset_id: string;
>   owner: string;
>   maker_address: string;
>   side: string;
>   price: string;
>   original_size: string;
>   size_matched: string;
>   outcome: string;
>   order_type: string;
>   status: string;
>   associate_trades?: string[];
>   created_at: number;
>   expiration: string;
> };
> ```
>
> ```json Order Example theme={null}
> [
>   {
>     "id": "ORDER_ID",
>     "market": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>     "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>     "owner": "0x1234...",
>     "maker_address": "0x1234...",
>     "side": "BUY",
>     "price": "0.52",
>     "original_size": "10",
>     "size_matched": "0",
>     "outcome": "Yes",
>     "order_type": "GTC",
>     "status": "LIVE",
>     "associate_trades": [],
>     "created_at": 1748779200,
>     "expiration": "0"
>   }
> ]
> ```

See the [order response reference](https://docs.polymarket.com/api-reference/trade/get-single-order-by-id.md)
for quantity units and statuses.

## List Account Trades

Retrieve executed fills for the account, as opposed to orders that are still
resting on the book. Use this to reconstruct fill history, compute realized
position size, or audit what actually matched.

> [tab] TypeScript
>
> Call `listAccountTrades()` on a `SecureClient` to iterate over the
> account's trades:
>
> ```ts theme={null}
> const pages = client.listAccountTrades();
>
> for await (const page of pages) {
>   // page.items: ClobTrade[]
> }
> ```
>
> Pass a filter to narrow the results. Despite its name, `market` takes the
> market's condition ID:
>
> ```ts Asset theme={null}
> const pages = client.listAccountTrades({
>   assetId: yesAssetId,
> });
> ```
>
> ```ts Condition theme={null}
> const pages = client.listAccountTrades({
>   market: market.conditionId!,
> });
> ```
>
> ```ts Maker theme={null}
> const pages = client.listAccountTrades({
>   makerAddress: process.env.POLYMARKET_MAKER_ADDRESS!,
> });
> ```
>
> ```ts Time Range theme={null}
> const now = Math.floor(Date.now() / 1000);
>
> const pages = client.listAccountTrades({
>   after: String(now - 24 * 60 * 60),
>   before: String(now),
> });
> ```
>
> Each page contains `ClobTrade` items:
>
> ```ts ClobTrade Type theme={null}
> type MakerOrder = {
>   orderId: string;
>   assetId: ClobAssetId;
>   makerAddress: string;
>   owner: string;
>   side: string;
>   price: DecimalString;
>   matchedAmount: DecimalString;
>   outcome: string;
>   feeRateBps: DecimalString | null;
> };
>
> type ClobTrade = {
>   id: string;
>   conditionId: ConditionId;
>   assetId: ClobAssetId;
>   owner: string;
>   makerAddress: string;
>   takerOrderId: string;
>   side: string;
>   traderSide: "TAKER" | "MAKER";
>   price: DecimalString;
>   size: DecimalString;
>   outcome: string;
>   status: string;
>   feeRateBps: DecimalString;
>   bucketIndex: number;
>   transactionHash: string;
>   makerOrders: MakerOrder[];
>   matchedAt: IsoDateTimeString;
>   updatedAt: IsoDateTimeString;
> };
> ```
>
> ```json ClobTrade Example theme={null}
> {
>   "items": [
>     {
>       "id": "TRADE_ID",
>       "conditionId": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "assetId": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "makerAddress": "0x1234567890123456789012345678901234567890",
>       "takerOrderId": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "side": "BUY",
>       "traderSide": "TAKER",
>       "price": "0.52",
>       "size": "10",
>       "outcome": "Yes",
>       "status": "TRADE_STATUS_MATCHED",
>       "feeRateBps": "0",
>       "bucketIndex": 0,
>       "transactionHash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
>       "makerOrders": [],
>       "matchedAt": "2026-06-01T12:00:05.000Z",
>       "updatedAt": "2026-06-01T12:00:05.000Z"
>     }
>   ],
>   "hasMore": false,
>   "totalCount": 1
> }
> ```

> [tab] Python
>
> Call `list_account_trades()` on an `AsyncSecureClient` to iterate over the
> account's trades. The synchronous `SecureClient` provides the same method.
>
> ```python theme={null}
> pages = client.list_account_trades()
>
> async for page in pages:
>     # page.items: tuple[ClobTrade, ...]
> ```
>
> Pass a filter to narrow the results. Despite its name, `market` takes the
> market's condition ID:
>
> ```python Asset theme={null}
> pages = client.list_account_trades(
>     asset_id=yes_asset_id,
> )
> ```
>
> ```python Condition theme={null}
> pages = client.list_account_trades(
>     market=market.condition_id,
> )
> ```
>
> ```python Maker theme={null}
> pages = client.list_account_trades(
>     maker_address=os.environ["POLYMARKET_MAKER_ADDRESS"],
> )
> ```
>
> ```python Time Range theme={null}
> import time
>
> now = int(time.time())
>
> pages = client.list_account_trades(
>     after=str(now - 24 * 60 * 60),
>     before=str(now),
> )
> ```
>
> Each page contains `ClobTrade` items:
>
> ```python ClobTrade Type theme={null}
> class MakerOrder:
>     order_id: str
>     asset_id: ClobAssetId
>     maker_address: str
>     owner: str
>     side: Literal["BUY", "SELL"]
>     price: Decimal
>     matched_amount: Decimal
>     outcome: str
>     fee_rate_bps: Decimal | None
>
> class ClobTrade:
>     id: str
>     condition_id: ConditionId
>     asset_id: ClobAssetId
>     owner: str
>     maker_address: str
>     taker_order_id: str
>     side: Literal["BUY", "SELL"]
>     trader_side: Literal["TAKER", "MAKER"]
>     price: Decimal
>     size: Decimal
>     outcome: str
>     status: str
>     fee_rate_bps: Decimal
>     bucket_index: int
>     transaction_hash: str
>     maker_orders: tuple[MakerOrder, ...]
>     matched_at: datetime
>     updated_at: datetime
> ```
>
> ```json ClobTrade Example theme={null}
> {
>   "items": [
>     {
>       "id": "TRADE_ID",
>       "condition_id": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "maker_address": "0x1234567890123456789012345678901234567890",
>       "taker_order_id": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "side": "BUY",
>       "trader_side": "TAKER",
>       "price": "0.52",
>       "size": "10",
>       "outcome": "Yes",
>       "status": "TRADE_STATUS_MATCHED",
>       "fee_rate_bps": "0",
>       "bucket_index": 0,
>       "transaction_hash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
>       "maker_orders": [],
>       "matched_at": "2026-06-01T12:00:05Z",
>       "updated_at": "2026-06-01T12:00:05Z"
>     }
>   ],
>   "has_more": false,
>   "next_cursor": null,
>   "total_count": 1
> }
> ```

> [tab] API
>
> List account trades with an authenticated CLOB request, optionally
> filtering by `id`, `market`, `asset_id`, `maker_address`, `after`, or
> `before`. See [API Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for
> the complete signing flow.
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/data/trades?market=$CONDITION_ID" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated as follows:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "GET" + "/data/trades"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> The CLOB returns the matching trades in its wire response shape:
>
> ```ts Trade Type theme={null}
> type MakerOrder = {
>   order_id: string;
>   asset_id: string;
>   maker_address: string;
>   owner: string;
>   side: string;
>   price: string;
>   matched_amount: string;
>   outcome: string;
>   fee_rate_bps: string;
> };
>
> type Trade = {
>   id: string;
>   market: string;
>   asset_id: string;
>   owner: string;
>   maker_address: string;
>   taker_order_id: string;
>   side: string;
>   trader_side: string;
>   price: string;
>   size: string;
>   outcome: string;
>   status: string;
>   fee_rate_bps?: string;
>   bucket_index: number;
>   transaction_hash?: string;
>   maker_orders?: MakerOrder[];
>   match_time: string;
>   last_update: string;
> };
> ```
>
> ```json Trade Example theme={null}
> [
>   {
>     "id": "TRADE_ID",
>     "market": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>     "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>     "owner": "0x1234...",
>     "maker_address": "0x1234...",
>     "taker_order_id": "ORDER_ID",
>     "side": "BUY",
>     "trader_side": "TAKER",
>     "price": "0.52",
>     "size": "10",
>     "outcome": "Yes",
>     "status": "MATCHED",
>     "fee_rate_bps": "0",
>     "bucket_index": 0,
>     "transaction_hash": "0xabc...",
>     "maker_orders": [],
>     "match_time": "1748779205",
>     "last_update": "1748779205"
>   }
> ]
> ```

See [Trade Statuses](https://docs.polymarket.com/concepts/order-lifecycle.md#trade-statuses) to follow each
trade's `status` through settlement.

## List Builder Trades

Retrieve matched trades attributed to a builder code across the accounts your
application serves. Use this instead of an account trade read when you need to
reconcile fills or measure activity for the builder integration as a whole.
Orders do not appear here until they match.

> [tab] TypeScript
>
> Call `listBuilderTrades()` on a `PublicClient` or `SecureClient` to iterate over
> trades attributed to your builder code:
>
> ```ts theme={null}
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE!,
> });
>
> for await (const page of pages) {
>   // page.items: BuilderTrade[]
> }
> ```
>
> Pass a filter to narrow the results:
>
> ```ts Asset theme={null}
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE!,
>   assetId: yesAssetId,
> });
> ```
>
> ```ts Condition theme={null}
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE!,
>   market: market.conditionId!,
> });
> ```
>
> ```ts Trade ID theme={null}
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE!,
>   id: trade.id,
> });
> ```
>
> ```ts Time Range theme={null}
> const now = Math.floor(Date.now() / 1000);
>
> const pages = client.listBuilderTrades({
>   builderCode: process.env.POLYMARKET_BUILDER_CODE!,
>   after: String(now - 24 * 60 * 60),
>   before: String(now),
> });
> ```
>
> Each page contains `BuilderTrade` items:
>
> ```ts BuilderTrade Type theme={null}
> type BuilderTrade = {
>   id: string;
>   tradeType: string;
>   takerOrderHash: string;
>   builder: string;
>   conditionId: ConditionId;
>   assetId: ClobAssetId;
>   side: "BUY" | "SELL";
>   size: DecimalString;
>   sizeUsdc: DecimalString;
>   price: DecimalString;
>   status: string;
>   outcome: string;
>   outcomeIndex: number;
>   owner: string;
>   maker: string;
>   transactionHash: string;
>   matchedAt: IsoDateTimeString;
>   bucketIndex: number;
>   fee: DecimalString;
>   feeUsdc: DecimalString;
>   errMsg?: string | null;
>   createdAt?: IsoDateTimeString;
>   updatedAt?: IsoDateTimeString;
> };
> ```
>
> ```json BuilderTrade Example theme={null}
> {
>   "items": [
>     {
>       "id": "TRADE_ID",
>       "tradeType": "TAKER",
>       "takerOrderHash": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "builder": "0x1111111111111111111111111111111111111111111111111111111111111111",
>       "conditionId": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "assetId": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "side": "BUY",
>       "size": "10",
>       "sizeUsdc": "5.2",
>       "price": "0.52",
>       "status": "TRADE_STATUS_MATCHED",
>       "outcome": "Yes",
>       "outcomeIndex": 0,
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "maker": "0x1234567890123456789012345678901234567890",
>       "transactionHash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
>       "matchedAt": "2026-06-01T12:00:05.000Z",
>       "bucketIndex": 0,
>       "fee": "0",
>       "feeUsdc": "0",
>       "errMsg": null,
>       "createdAt": "2026-06-01T12:00:05.000Z",
>       "updatedAt": "2026-06-01T12:00:05.000Z"
>     }
>   ],
>   "hasMore": false,
>   "totalCount": 1
> }
> ```

> [tab] Python
>
> Call `list_builder_trades()` on an `AsyncPublicClient` or
> `AsyncSecureClient` to iterate over trades attributed to your builder code.
> The synchronous `PublicClient` and `SecureClient` provide the same method.
>
> ```python theme={null}
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
> )
>
> async for page in pages:
>     # page.items: tuple[BuilderTrade, ...]
> ```
>
> Pass a filter to narrow the results:
>
> ```python Asset theme={null}
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
>     asset_id=yes_asset_id,
> )
> ```
>
> ```python Condition theme={null}
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
>     market=market.condition_id,
> )
> ```
>
> ```python Trade ID theme={null}
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
>     id=trade.id,
> )
> ```
>
> ```python Time Range theme={null}
> import time
>
> now = int(time.time())
>
> pages = client.list_builder_trades(
>     builder_code=os.environ["POLYMARKET_BUILDER_CODE"],
>     after=str(now - 24 * 60 * 60),
>     before=str(now),
> )
> ```
>
> Each page contains `BuilderTrade` items:
>
> ```python BuilderTrade Type theme={null}
> class BuilderTrade:
>     id: str
>     trade_type: str
>     taker_order_hash: str
>     builder: str
>     condition_id: ConditionId
>     asset_id: ClobAssetId
>     side: Literal["BUY", "SELL"]
>     size: Decimal
>     size_usdc: Decimal
>     price: Decimal
>     status: str
>     outcome: str
>     outcome_index: int
>     owner: str
>     maker: str
>     transaction_hash: str
>     matched_at: datetime
>     bucket_index: int
>     fee: Decimal
>     fee_usdc: Decimal
>     error_msg: str | None
>     created_at: datetime | None
>     updated_at: datetime | None
> ```
>
> ```json BuilderTrade Example theme={null}
> {
>   "items": [
>     {
>       "id": "TRADE_ID",
>       "trade_type": "TAKER",
>       "taker_order_hash": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "builder": "0x1111111111111111111111111111111111111111111111111111111111111111",
>       "condition_id": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "asset_id": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "side": "BUY",
>       "size": "10",
>       "size_usdc": "5.2",
>       "price": "0.52",
>       "status": "TRADE_STATUS_MATCHED",
>       "outcome": "Yes",
>       "outcome_index": 0,
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "maker": "0x1234567890123456789012345678901234567890",
>       "transaction_hash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
>       "matched_at": "2026-06-01T12:00:05Z",
>       "bucket_index": 0,
>       "fee": "0",
>       "fee_usdc": "0",
>       "error_msg": null,
>       "created_at": "2026-06-01T12:00:05Z",
>       "updated_at": "2026-06-01T12:00:05Z"
>     }
>   ],
>   "has_more": false,
>   "next_cursor": null,
>   "total_count": 1
> }
> ```

> [tab] API
>
> List trades attributed to a builder code with a public CLOB request. Filter
> the results with `id`, `market`, `asset_id`, `after`, or `before` when
> needed:
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/builder/trades?builder_code=$POLYMARKET_BUILDER_CODE"
> ```
>
> The response contains the matching trades and a cursor for the next page:
>
> ```json theme={null}
> {
>   "limit": 300,
>   "next_cursor": "LTE=",
>   "count": 1,
>   "data": [
>     {
>       "id": "TRADE_ID",
>       "tradeType": "TAKER",
>       "takerOrderHash": "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
>       "builder": "0x1111111111111111111111111111111111111111111111111111111111111111",
>       "market": "0x747dc809fb79e1b05be09c42d6179459a58de2ef3e40f02484a4e1260f741f75",
>       "assetId": "107505882767731489358349912513945399560393482969656700824895970500493757150417",
>       "side": "BUY",
>       "size": "10",
>       "sizeUsdc": "5.2",
>       "price": "0.52",
>       "status": "TRADE_STATUS_MATCHED",
>       "outcome": "Yes",
>       "outcomeIndex": 0,
>       "owner": "9180014b-33c8-9240-a14b-bdca11c0a465",
>       "maker": "0x1234567890123456789012345678901234567890",
>       "transactionHash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
>       "matchTime": "1748779205",
>       "bucketIndex": 0,
>       "fee": "0",
>       "feeUsdc": "0",
>       "err_msg": null,
>       "createdAt": "2026-06-01T12:00:05Z",
>       "updatedAt": "2026-06-01T12:00:05Z"
>     }
>   ]
> }
> ```
>
> Pass `next_cursor` back as the `next_cursor` query parameter to request the
> next page. The terminal cursor is `LTE=`.

See [Builder Programs](https://docs.polymarket.com/programs/builders/overview.md) to learn how attribution
works.

## Cancel Orders

Cancel only as broadly as needed. Start with known order IDs, use a market or
asset filter when withdrawing a set of quotes, and reserve account-wide
cancellation for exceptional situations. Cancellation remains available while
the exchange is in cancel-only mode, when new orders are rejected. For a
partially filled order, cancellation removes only its unfilled remainder,
including when the market resolves. It preserves the original and matched
sizes and does not undo settled fills.

### Cancel Orders by ID

Cancel one order when you know its ID. To cancel a known set of orders in one
request, submit a batch of up to 3,000 IDs. Duplicate IDs in the batch are
ignored.

> [tab] TypeScript
>
> Call `cancelOrder()` on a `SecureClient` to cancel one order:
>
> ```ts theme={null}
> const result = await client.cancelOrder({ orderId: order.id });
>
> // result: CancelOrdersResponse
> ```
>
> Call `cancelOrders()` to cancel several known orders in one request:
>
> ```ts theme={null}
> const result = await client.cancelOrders({
>   orderIds: orders.map((order) => order.id),
> });
>
> // result: CancelOrdersResponse
> ```

> [tab] Python
>
> Call `cancel_order()` on an `AsyncSecureClient` to cancel one order. The
> synchronous `SecureClient` provides the same method without `await`.
>
> ```python theme={null}
> result = await client.cancel_order(order_id=order.id)
>
> # result: CancelOrdersResponse
> ```
>
> Call `cancel_orders()` to cancel several known orders in one request:
>
> ```python theme={null}
> result = await client.cancel_orders(
>     order_ids=[order.id for order in orders],
> )
>
> # result: CancelOrdersResponse
> ```

> [tab] API
>
> Cancel one order with an authenticated CLOB request. See [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for the complete
> signing flow.
>
> ```bash theme={null}
> curl -X DELETE "https://clob.polymarket.com/order" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{"orderID":"'"$ORDER_ID"'"}'
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated from the exact serialized body:
>
> ```text theme={null}
> body = '{"orderID":"' + order_id + '"}'
> message = <clob_request_timestamp> + "DELETE" + "/order" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> To cancel multiple orders, send an array containing 1 to 3,000 order IDs:
>
> ```bash theme={null}
> curl -X DELETE "https://clob.polymarket.com/orders" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '["'"$ORDER_ID_1"'","'"$ORDER_ID_2"'"]'
> ```
>
> Sign the batch request using its path and exact serialized array:
>
> ```text theme={null}
> body = '["' + order_id_1 + '","' + order_id_2 + '"]'
> message = <clob_request_timestamp> + "DELETE" + "/orders" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> Both requests return `200 OK` with a [cancellation
> result](#cancellation-results) containing `canceled` and
> `not_canceled`.

### Cancel Market Orders

Cancel by outcome to withdraw orders for one outcome, or by market to withdraw
orders for every outcome in the condition. At least one filter is required.

> [tab] TypeScript
>
> Call `cancelMarketOrders()` on a `SecureClient` with an asset ID or condition
> ID:
>
> ```ts Asset theme={null}
> const result = await client.cancelMarketOrders({
>   assetId: yesAssetId,
> });
> ```
>
> ```ts Condition theme={null}
> const result = await client.cancelMarketOrders({
>   market: market.conditionId!,
> });
> ```
>
> The `market` field takes the market's condition ID.

> [tab] Python
>
> Call `cancel_market_orders()` on an `AsyncSecureClient` with an asset ID or
> condition ID. The synchronous `SecureClient` provides the same method without
> `await`.
>
> ```python Asset theme={null}
> result = await client.cancel_market_orders(
>     asset_id=yes_asset_id,
> )
> ```
>
> ```python Condition theme={null}
> result = await client.cancel_market_orders(
>     market=market.condition_id,
> )
> ```
>
> The `market` argument takes the market's condition ID.

> [tab] API
>
> Cancel every open order for one outcome with an authenticated CLOB request.
> See [API Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for the
> complete signing flow.
>
> ```bash theme={null}
> curl -X DELETE "https://clob.polymarket.com/cancel-market-orders" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{"asset_id":"'"$ASSET_ID"'"}'
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated from the exact serialized body:
>
> ```text theme={null}
> body = '{"asset_id":"' + asset_id + '"}'
> message = <clob_request_timestamp> + "DELETE" + "/cancel-market-orders" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> To cancel every open order for a condition, send its condition ID as
> `market` and sign that exact body instead:
>
> ```bash theme={null}
> curl -X DELETE "https://clob.polymarket.com/cancel-market-orders" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{"market":"'"$CONDITION_ID"'"}'
> ```
>
> Sign the condition-scoped request using the same path and its exact
> serialized body:
>
> ```text theme={null}
> body = '{"market":"' + condition_id + '"}'
> message = <clob_request_timestamp> + "DELETE" + "/cancel-market-orders" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> Both requests return `200 OK` with a [cancellation
> result](#cancellation-results) containing `canceled` and
> `not_canceled`.

### Cancel All Orders

Use account-wide cancellation when you need to remove every resting order,
such as during an emergency shutdown.

> [!WARNING]
>
> This action cancels every open order associated with the authenticated CLOB
> API credentials.

> [tab] TypeScript
>
> Call `cancelAll()` on a `SecureClient`:
>
> ```ts theme={null}
> const result = await client.cancelAll();
>
> // result: CancelOrdersResponse
> ```

> [tab] Python
>
> Call `cancel_all()` on an `AsyncSecureClient`. The synchronous `SecureClient`
> provides the same method without `await`.
>
> ```python theme={null}
> result = await client.cancel_all()
>
> # result: CancelOrdersResponse
> ```

> [tab] API
>
> Cancel every open order with an authenticated CLOB request. See [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication) for the complete
> signing flow.
>
> ```bash theme={null}
> curl -X DELETE "https://clob.polymarket.com/cancel-all" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> where `<clob_request_timestamp>` is a Unix timestamp and
> `<clob_l2_signature>` is generated without a request body:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "DELETE" + "/cancel-all"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> The request returns `200 OK` with a [cancellation
> result](#cancellation-results) containing `canceled` and
> `not_canceled`.

### Cancellation Results

A cancellation can succeed for only some of the requested orders. Reconcile the
result before retrying: it identifies the orders that were canceled and gives a
reason for each order that could not be canceled.

> [tab] TypeScript
>
> The TypeScript SDK returns a `CancelOrdersResponse`:
>
> ```ts Type theme={null}
> type CancelOrdersResponse = {
>   canceled: OrderId[];
>   notCanceled: Record<OrderId, string>;
> };
> ```
>
> In this example, one order was canceled and another could not be canceled
> because it had already matched:
>
> ```json Example theme={null}
> {
>   "canceled": ["ORDER_ID_1"],
>   "notCanceled": {
>     "ORDER_ID_2": "order already matched"
>   }
> }
> ```

> [tab] Python
>
> The Python SDK returns a `CancelOrdersResponse`:
>
> ```python Type theme={null}
> class CancelOrdersResponse:
>     canceled: tuple[OrderId, ...]
>     not_canceled: dict[OrderId, str]
> ```
>
> In this example, one order was canceled and another could not be canceled
> because it had already matched:
>
> ```json Example theme={null}
> {
>   "canceled": ["ORDER_ID_1"],
>   "not_canceled": {
>     "ORDER_ID_2": "order already matched"
>   }
> }
> ```

> [tab] API
>
> The API returns the cancellation result as JSON. This response shows one
> canceled order and one order that had already matched:
>
> ```json Response theme={null}
> {
>   "canceled": ["ORDER_ID_1"],
>   "not_canceled": {
>     "ORDER_ID_2": "order already matched"
>   }
> }
> ```

## Order Heartbeats

Use order heartbeats to request cancellation of your API key's open orders if
its trading process stops responding. Each SDK call sends one request. Your
application owns the ongoing heartbeat loop and failure handling.

> [!WARNING]
>
> The **first accepted heartbeat enables timeout cancellation for all open
> orders owned by the same API key**, across markets and processes. Start only
> when you can keep sending accepted heartbeats every **5 seconds**. There is
> **no disarm endpoint**: stopping the loop or closing the SDK client leaves the
> deadline active. A single test call with production credentials can put
> existing orders at risk of cancellation.

After **10 seconds** without an accepted heartbeat, the server detects expiry on
its five-second scan and queues a cancel-all attempt. Cancellation is best effort:
queue delays, service failures, or orders that cannot be canceled can prevent or
delay completion. Ten seconds is the expiry threshold, not a guaranteed
cancellation time. WebSocket keepalive does not refresh this deadline.

> [tab] TypeScript
>
> Call `sendOrderHeartbeat()` on a `SecureClient` with the same API key that owns
> your orders. The first call uses an empty ID by default.
>
> ```ts theme={null}
> import { OrderHeartbeatMismatchError } from "@polymarket/client";
>
> let heartbeatId = "";
> let keepQuoting = true; // Your quoting process sets this to false when stopping.
>
> while (keepQuoting) {
>   try {
>     const heartbeat = await client.sendOrderHeartbeat({ heartbeatId });
>     heartbeatId = heartbeat.heartbeatId;
>   } catch (error) {
>     if (!(error instanceof OrderHeartbeatMismatchError)) throw error;
>     const heartbeat = await client.sendOrderHeartbeat({
>       heartbeatId: error.heartbeatId,
>     });
>     heartbeatId = heartbeat.heartbeatId;
>   }
>   await new Promise((resolve) => setTimeout(resolve, 5000));
> }
> ```
>
> Await every send before the next one and retain the latest returned
> `heartbeatId`. A mismatch error contains the expected ID. The explicit retry
> above uses it to recover. A rejected send does not refresh the deadline. The
> SDK provides a single request per call. The loop owns scheduling and recovery.

> [tab] Python
>
> Call `send_order_heartbeat()` on an `AsyncSecureClient` with the same API key
> that owns your orders. The synchronous `SecureClient` provides the same method.
> The first call uses an empty ID by default.
>
> ```python theme={null}
> import asyncio
> from polymarket import OrderHeartbeatMismatchError
>
> heartbeat_id = ""
> keep_quoting = True  # Your quoting process sets this to False when stopping.
>
> while keep_quoting:
>     try:
>         heartbeat = await client.send_order_heartbeat(heartbeat_id=heartbeat_id)
>     except OrderHeartbeatMismatchError as error:
>         heartbeat = await client.send_order_heartbeat(
>             heartbeat_id=error.heartbeat_id,
>         )
>     heartbeat_id = heartbeat.heartbeat_id
>     await asyncio.sleep(5)
> ```
>
> Await every send before the next one and retain the latest returned
> `heartbeat_id`. A mismatch error contains the expected ID. The explicit retry
> above uses it to recover. A rejected send does not refresh the deadline. The
> SDK provides a single request per call. The loop owns scheduling and recovery.

> [tab] API
>
> Send a heartbeat every **5 seconds**.
>
> **1. Start the Heartbeat**
>
> Send an empty `heartbeat_id` to `POST /v1/heartbeats`. Authenticate the
> request with the same CLOB API credentials that own the orders you want to
> protect:
>
> ```bash theme={null}
> curl -X POST "https://clob.polymarket.com/v1/heartbeats" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{"heartbeat_id":""}'
> ```
>
> Using the signer address and CLOB API credentials from [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication), create a fresh
> `<clob_request_timestamp>` and generate `<clob_l2_signature>` from the exact
> serialized body sent over the wire:
>
> ```text theme={null}
> body = '{"heartbeat_id":""}'
> message = <clob_request_timestamp> + "POST" + "/v1/heartbeats" + body
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> Save the ID returned in the response:
>
> ```json theme={null}
> {
>   "heartbeat_id": "<heartbeat_id>"
> }
> ```
>
> **2. Continue the Heartbeat**
>
> After five seconds, send the latest `heartbeat_id` back to the same route.
> Each successful response returns a new ID to use for the following
> heartbeat:
>
> ```bash theme={null}
> curl -X POST "https://clob.polymarket.com/v1/heartbeats" \
>   -H "Content-Type: application/json" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>" \
>   --data '{"heartbeat_id":"<heartbeat_id>"}'
> ```
>
> Create a fresh `<clob_request_timestamp>` and `<clob_l2_signature>` for this
> request, replacing `body` in the signing calculation above with the exact
> serialized body containing the latest ID.
>
> If the ID differs from the currently registered ID, the CLOB responds with `400 Bad Request`
> and supplies the expected ID. Sign a new request with that ID and retry:
>
> ```json theme={null}
> {
>   "error_msg": "Invalid Heartbeat ID",
>   "heartbeat_id": "<expected_heartbeat_id>"
> }
> ```

### Heartbeat FAQ

> [accordion] Can multiple processes send heartbeats with the same API key?
>
> Use one coordinated sender per API key and wait for each send to finish
> before sending the next. Concurrent sends can race over the rotating
> heartbeat ID. Every accepted heartbeat covers all open orders owned by that
> key, across markets and processes.

> [accordion] How do I recover from a heartbeat ID mismatch?
>
> A rejected request does not refresh the deadline. Retry with the expected
> ID from the mismatch response, then save the ID returned by the successful
> retry. The expected ID can be empty if another integration sent a legacy
> heartbeat request.
>
> The SDK examples above retry the first mismatch once. A second mismatch
> raises an error for your application to handle.

> [accordion] What should I do if a heartbeat request fails?
>
> Stop placing new orders and check your outstanding orders. The examples
> above propagate authentication, payload, rate-limit, transport, and response
> errors to your application.
>
> A request can succeed even if its response is lost. An SDK exception does
> not tell you whether the heartbeat registration is active or whether the
> server has rotated the ID.

> [accordion] How do I stop sending heartbeats?
>
> Stop placing orders, cancel the orders you want to remove, and verify the
> cancellations before stopping the heartbeat loop.
>
> Stopping the loop or closing the client leaves the server's deadline
> active. There is no disarm operation that lets you immediately disable the
> timeout while keeping existing orders live.

> [accordion] What happens after the heartbeat times out?
>
> The server removes the heartbeat registration, then attempts to cancel the
> orders. Cancellation is best effort. Check the cancellation results and
> outstanding orders rather than assuming every order is gone. The server
> does not keep canceling later orders indefinitely.
>
> A later accepted heartbeat registers the API key again. Before resuming
> quoting, reconcile open orders. A successful heartbeat does not tell you
> whether orders placed before the outage survived or were canceled.

## Check Closed-Only Mode

Closed-only mode is an account-level circuit breaker for a market. When it's
on, the account can only place orders that reduce an existing position, not
new opening orders. Check this before placing an order if you want to fail
fast instead of waiting for a rejection.

> [tab] TypeScript
>
> Call `fetchClosedOnlyMode()` on a `SecureClient`:
>
> ```ts theme={null}
> const closedOnly = await client.fetchClosedOnlyMode();
>
> // closedOnly: boolean
> ```
>
> The method returns the account's closed-only state as a boolean:
>
> ```json ClosedOnlyMode Example theme={null}
> false
> ```

> [tab] Python
>
> Call `get_closed_only_mode()` on an `AsyncSecureClient`. The synchronous
> `SecureClient` provides the same method.
>
> ```python theme={null}
> closed_only = await client.get_closed_only_mode()
>
> # closed_only: bool
> ```
>
> The method returns the account's closed-only state as a `bool`:
>
> ```json ClosedOnlyMode Example theme={null}
> false
> ```

> [tab] API
>
> Read the account's closed-only state:
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/auth/ban-status/closed-only" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> Using the signer address and CLOB API credentials from [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication), create a fresh
> `<clob_request_timestamp>` and generate `<clob_l2_signature>` without a
> request body:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "GET" + "/auth/ban-status/closed-only"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> ```ts ClosedOnlyMode Type theme={null}
> type ClosedOnlyMode = {
>   closed_only: boolean;
> };
> ```
>
> ```json ClosedOnlyMode Example theme={null}
> {
>   "closed_only": false
> }
> ```
>
> `closed_only: true` means the account can only reduce or close existing
> positions. New position-opening orders are rejected.

## Check Order Scoring

An order scores when it is live on a market with [liquidity
rewards](https://docs.polymarket.com/programs/liquidity-rewards.md) and meets the market's minimum qualifying
size, maximum qualifying spread, and required live duration. Because
eligibility changes as the order book moves, treat the result as a point-in-time
check.

> [tab] TypeScript
>
> Call `fetchOrderScoring()` on a `SecureClient` with the order ID:
>
> ```ts theme={null}
> const scoring = await client.fetchOrderScoring({ orderId: order.id });
>
> // scoring: boolean
> ```
>
> To check the scoring status of several orders in one request, call
> `fetchOrdersScoring()` with their IDs:
>
> ```ts theme={null}
> const scoringByOrder = await client.fetchOrdersScoring({
>   orderIds: ["ORDER_ID_1", "ORDER_ID_2"],
> });
>
> // scoringByOrder: OrdersScoringResponse
> ```
>
> The response maps each order ID to its scoring status:
>
> ```ts OrdersScoringResponse Type theme={null}
> type OrdersScoringResponse = Record<string, boolean>;
> ```
>
> ```json OrdersScoringResponse Example theme={null}
> {
>   "ORDER_ID_1": true,
>   "ORDER_ID_2": false
> }
> ```

> [tab] Python
>
> Call `get_order_scoring()` on an `AsyncSecureClient` with the order ID. The
> synchronous `SecureClient` provides the same method.
>
> ```python theme={null}
> scoring = await client.get_order_scoring(order_id=order.id)
>
> # scoring: bool
> ```
>
> To check the scoring status of several orders in one request, call
> `get_orders_scoring()` with their IDs:
>
> ```python theme={null}
> scoring_by_order = await client.get_orders_scoring(
>     order_ids=["ORDER_ID_1", "ORDER_ID_2"],
> )
>
> # scoring_by_order: dict[str, bool]
> ```
>
> The response maps each order ID to its scoring status:
>
> ```python OrdersScoringResponse Type theme={null}
> dict[str, bool]
> ```
>
> ```json OrdersScoringResponse Example theme={null}
> {
>   "ORDER_ID_1": true,
>   "ORDER_ID_2": false
> }
> ```

> [tab] API
>
> Check whether an order currently qualifies for rewards:
>
> ```bash theme={null}
> curl "https://clob.polymarket.com/order-scoring?order_id=<order_id>" \
>   -H "POLY_ADDRESS: <signer_address>" \
>   -H "POLY_API_KEY: <clob_api_key>" \
>   -H "POLY_PASSPHRASE: <clob_api_passphrase>" \
>   -H "POLY_SIGNATURE: <clob_l2_signature>" \
>   -H "POLY_TIMESTAMP: <clob_request_timestamp>"
> ```
>
> Using the signer address and CLOB API credentials from [API
> Authentication](https://docs.polymarket.com/getting-started/api.md#authentication), create a fresh
> `<clob_request_timestamp>` and generate `<clob_l2_signature>` without a
> request body. The `order_id` query parameter is not part of the signed path:
>
> ```text theme={null}
> message = <clob_request_timestamp> + "GET" + "/order-scoring"
>
> clob_l2_signature = urlsafeBase64WithPadding(
>   HMAC-SHA256(base64Decode(<clob_api_secret>), message)
> )
> ```
>
> The response contains the order's current scoring status:
>
> ```json Example theme={null}
> {
>   "scoring": true
> }
> ```
>
> See [Get Order Scoring
> Status](https://docs.polymarket.com/api-reference/trade/get-order-scoring-status.md) for the complete
> request and response schema.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.