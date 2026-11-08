> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Error Codes

> Complete reference for CLOB API error responses

All CLOB API errors return a JSON object with a single `error` field:

```json theme={null}
{
  "error": "<message>"
}
```

***

## Global Errors

These errors can occur on **any authenticated endpoint**.

**401** `Unauthorized`

`Unauthorized/Invalid api key` — Your API key is missing, expired, or invalid.
Ensure you're sending all required [authentication
headers](https://docs.polymarket.com/getting-started/api.md#authentication).

**401** `Unauthorized`

`Invalid L1 Request headers` — Your L1 authentication headers (HMAC signature)
are malformed or the signature doesn't match. See
[Authentication](https://docs.polymarket.com/getting-started/api.md#authentication).

**503** `Service Unavailable`

`Trading is currently disabled. Check polymarket.com for updates` — The
exchange is temporarily paused. No orders (including cancels) are accepted.

**429** `Too Many Requests`

`Too Many Requests` — You've exceeded the [rate
limit](https://docs.polymarket.com/api-reference/rate-limits.md). Back off and retry with exponential
backoff.

***

## Order Book

Errors from the order book endpoints.

### GET book

**400** `Bad Request`

`Invalid token id` — The `token_id` query parameter is missing or not a valid
token ID.

**404** `Not Found`

`No orderbook exists for the requested token id`

### POST books

**400** `Bad Request`

`Invalid payload` — The request body is malformed or missing required fields.

**400** `Bad Request`

`Payload exceeds the limit` — Too many outcome IDs in a single request. Reduce
the batch size.

***

## Pricing

Errors from price, midpoint, and spread endpoints.

### GET price

**400** `Bad Request`

`Invalid token id` — The `token_id` parameter is missing or is not a valid
outcome ID.

**400** `Bad Request`

`Invalid side` — The `side` parameter must be `BUY` or `SELL`.

**404** `Not Found`

`No orderbook exists for the requested token id`

### POST prices

**400** `Bad Request`

`Invalid payload` — The request body is malformed or missing required fields.

**400** `Bad Request`

`Invalid side` — The `side` field must be `BUY` or `SELL`.

**400** `Bad Request`

`Payload exceeds the limit` — Too many outcome IDs in a single request.

### GET midpoint

**400** `Bad Request`

`Invalid token id` — The `token_id` parameter is missing or is not a valid
outcome ID.

**404** `Not Found`

`No orderbook exists for the requested token id`

### POST midpoints

**400** `Bad Request`

`Invalid payload` — The request body is malformed or missing required fields.

**400** `Bad Request`

`Payload exceeds the limit` — Too many outcome IDs in a single request.

### GET spread

**400** `Bad Request`

`Invalid token id` — The `token_id` parameter is missing or is not a valid
outcome ID.

**404** `Not Found`

`No orderbook exists for the requested token id`

### POST spreads

**400** `Bad Request`

`Invalid payload` — The request body is malformed or missing required fields.

**400** `Bad Request`

`Payload exceeds the limit` — Too many outcome IDs in a single request.

***

## Place Orders

Errors from order placement endpoints.

### POST order

**400** `Bad Request`

`Invalid order payload` — The request body is malformed, missing required
fields, or contains invalid values.

**400** `Bad Request`

`the order owner has to be the owner of the API KEY` — The `maker` address in
the order doesn't match the address associated with your API key.

**400** `Bad Request`

`the order signer address has to be the address of the API KEY`

**400** `Bad Request`

`'{address}' address banned` — This address has been banned from trading.

**400** `Bad Request`

`'{address}' address in closed only mode`

**503** `Service Unavailable`

`Trading is currently cancel-only. New orders are not accepted, but cancels
    are allowed.` — The exchange is in cancel-only mode. You can cancel existing
orders but cannot place new orders.

**503** `Service Unavailable`

`post-only mode: only post-only orders and cancels are allowed` — The exchange
is in post-only mode. You can cancel orders and place orders with `postOnly:
    true`; non-post-only orders are rejected. The response includes `code:
    "post_only_mode"` and `retry_after_seconds`, and the same retry delay is also
sent in the `Retry-After` HTTP header.

Example response:

```json theme={null}
{
  "error": "post-only mode: only post-only orders and cancels are allowed",
  "code": "post_only_mode",
  "retry_after_seconds": 79
}
```

The retry delay is also sent in the `Retry-After` HTTP header.

### POST orders

All errors from `POST /order` apply, plus:

**400** `Bad Request`

`Too many orders in payload: {N}, max allowed: {M}` — The batch contains more
orders than the maximum allowed per request.

Per-order errors are returned in the `200` response array, with individual error messages for each failed order.

In post-only mode, non-post-only orders in a batch return per-order errors:

```json theme={null}
[
  {
    "errorMsg": "post-only mode: only post-only orders and cancels are allowed",
    "orderID": "",
    "takingAmount": "",
    "makingAmount": "",
    "status": "",
    "success": true
  },
  {
    "errorMsg": "post-only mode: only post-only orders and cancels are allowed",
    "orderID": "",
    "takingAmount": "",
    "makingAmount": "",
    "status": "",
    "success": true
  }
]
```

***

## Order Processing Errors

These errors are returned when an order passes initial validation but fails during processing. They appear in the response body of `POST /order` and `POST /orders`.

**400** `Bad Request`

`invalid post-only order: order crosses book` — A post-only (maker) order
would immediately match. Adjust the price so it rests on the book.

**400** `Bad Request`

`order {id} is invalid. Price ({price}) breaks minimum tick size rule: {tick}`
— The order price doesn't align with the market's tick size. Use [`GET
    /tick-size`](https://docs.polymarket.com/api-reference/market-data/get-tick-size.md) to check the valid tick
size.

**400** `Bad Request`

`order {id} is invalid. Size ({size}) lower than the minimum: {min}` — The
order size is below the market minimum.

**400** `Bad Request`

`order {id} is invalid. Duplicated.`

**400** `Bad Request`

`order {id} crosses the book`

**400** `Bad Request`

`not enough balance / allowance` — Insufficient pUSD balance or token
allowance. Make sure the account holds enough pUSD and grant the trading
approvals with [Set Up Trading
Approvals](https://docs.polymarket.com/trading/wallets-auth.md#set-up-trading-approvals). An allowance error
names one missing spender at a time. If it names the Neg Risk Adapter
(`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`), the account wallet is missing
the adapter approvals required for CTF negative-risk markets.

**400** `Bad Request`

`invalid expiration` — The order expiration timestamp is in the past or
invalid.

**400** `Bad Request`

`order canceled in the CTF exchange contract`

**400** `Bad Request`

`order match delayed due to market conditions`

**400** `Bad Request`

`order couldn't be fully filled. FOK orders are fully filled or killed.` — A
Fill-or-Kill order could not be completely filled by available liquidity. The
entire order is rejected.

**400** `Bad Request`

`no orders found to match with FAK order. FAK orders are partially filled or
    killed if no match is found.` — A Fill-and-Kill order found no matching orders
at all. At least one match is required.

**400** `Bad Request`

`the market is not yet ready to process new orders`

**500** `Internal Server Error`

`order timed out` — The exchange could not process the order before the
request deadline. This typically happens during bursts of concurrent order
submissions from the same account. The order was rejected before reaching the
order book and can be safely resubmitted.

***

## Matching Engine Errors

Internal matching engine errors that may surface during order execution.

**425** `Too Early`

The matching engine is restarting. Retry with exponential backoff. See
[Matching Engine Restarts](https://docs.polymarket.com/trading/matching-engine.md) for restart handling.

**500** `Internal Server Error`

`there are no matching orders`

**500** `Internal Server Error`

`FOK orders are filled or killed` — A Fill-or-Kill order could not be fully
satisfied.

**500** `Internal Server Error`

`the trade contains rounding issues`

**500** `Internal Server Error`

`the price of the taker's order has a discrepancy greater than allowed with
    the worst maker order`

***

## Cancel Orders

Errors from order cancellation endpoints.

### DELETE order

**400** `Bad Request`

`Invalid order payload` — The request body is malformed.

**400** `Bad Request`

`Invalid orderID` — The provided order ID is not a valid format.

### DELETE orders

**400** `Bad Request`

`Invalid order payload` — The request body is malformed.

**400** `Bad Request`

`Too many orders in payload, max allowed: {N}` — Too many order IDs in a
single cancellation request.

**400** `Bad Request`

`Invalid orderID` — One or more order IDs are not valid.

### DELETE cancel-market-orders

**400** `Bad Request`

`Invalid order payload` — The request body is malformed or contains invalid
filter parameters.

***

## Query Orders

Errors from order query endpoints.

### GET order by ID

**400** `Bad Request`

`Invalid orderID` — The order ID in the URL path is not valid.

**500** `Internal Server Error`

`Internal server error` — An unexpected error occurred while fetching the
order.

### GET orders

**400** `Bad Request`

`invalid order params payload` — The query parameters are malformed or contain
invalid values.

**500** `Internal Server Error`

`Internal server error` — An unexpected error occurred while fetching orders.

***

## Trades

### GET trades

**400** `Bad Request`

`Invalid trade params payload` — The query parameters are malformed or contain
invalid values.

**500** `Internal Server Error`

`Internal server error` — An unexpected error occurred while fetching trades.

### GET last-trade-price

**400** `Bad Request`

`Invalid token id` — The `token_id` parameter is missing or is not a valid
outcome ID.

**500** `Internal Server Error`

`Internal server error` — An unexpected error occurred while fetching the last
trade price.

### POST last-trades-prices

**400** `Bad Request`

`Invalid payload` — The request body is malformed or missing required fields.

**400** `Bad Request`

`Payload exceeds the limit` — Too many outcome IDs in a single request.

***

## Markets

### GET market by condition ID

**400** `Bad Request`

`Invalid market` — The condition ID is not a valid format.

**404** `Not Found`

`market not found` — No market exists with this condition ID.

### GET tick-size

**400** `Bad Request`

`Invalid token id` — The outcome ID is not valid.

**404** `Not Found`

`market not found` — No market found for this outcome ID.

### GET neg-risk

**400** `Bad Request`

`Invalid token id` — The outcome ID is not valid.

**404** `Not Found`

`market not found` — No market found for this outcome ID.

***

## Price History

### GET prices-history

**400** `Bad Request`

Filter validation errors — One or more query parameters (`market`, `startTs`,
`endTs`, `fidelity`) are invalid.

### GET ohlc

**400** `Bad Request`

`startTs is required` — The `startTs` query parameter is missing.

**400** `Bad Request`

`asset_id is required` — The `asset_id` query parameter is missing.

**400** `Bad Request`

`invalid fidelity: {val}` — The `fidelity` parameter must be one of: `1m`,
`5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`.

**400** `Bad Request`

`limit cannot exceed 1000` — Reduce the `limit` parameter to 1000 or below.

***

## Authentication and API Keys

### POST auth api-key

**401** `Unauthorized`

`Invalid L1 Request headers` — L1 authentication headers are missing or
invalid.

**400** `Bad Request`

`Could not create api key`

### GET auth api-keys

**500** `Internal Server Error`

`Could not retrieve API keys` — An unexpected error occurred while fetching
your API keys.

### DELETE auth api-key

**500** `Internal Server Error`

`Could not delete API key` — An unexpected error occurred while deleting the
API key.

### GET auth derive-api-key

**401** `Unauthorized`

`Invalid L1 Request headers` — L1 authentication headers are missing or
invalid.

**400** `Bad Request`

`Could not derive api key!`

***

## Builder API Keys

### POST auth builder-api-key

**500** `Internal Server Error`

`could not create builder api key` — Builder API key creation failed.

### GET auth builder-api-key

**500** `Internal Server Error`

`could not get builder api keys` — An unexpected error occurred while fetching
builder API keys.

### DELETE auth builder-api-key

**400** `Bad Request`

`invalid revoke builder api key body` — The request body is malformed.

**400** `Bad Request`

`invalid revoke builder api key headers` — Required authentication headers are
missing.

**500** `Internal Server Error`

`could not revoke the builder api key: {key}` — An unexpected error occurred
while revoking the key.

***

## Builder Trades

### GET builder trades

**400** `Bad Request`

`invalid builder trade params` — The query parameters are malformed or contain
invalid values.

**500** `Internal Server Error`

`could not fetch builder trades` — An unexpected error occurred while fetching
builder trades.

***

## Balance and Allowance

### GET balance-allowance

**400** `Bad Request`

`Invalid asset type` — The `asset_type` parameter is not a recognized asset
type.

**400** `Bad Request`

`Invalid signature_type` — The `signature_type` parameter must be `0` (EOA),
`1` (POLY\_PROXY), `2` (POLY\_GNOSIS\_SAFE) or `3` (POLY\_1271, Deposit Wallet).

***

## Status Code Reference

| Status | Meaning | Common Causes |
| - | - | - |
| `400` | Bad Request | Invalid parameters, malformed payload, business logic violation |
| `401` | Unauthorized | Missing or invalid API key, bad HMAC signature, expired timestamp |
| `404` | Not Found | Market doesn't exist, order not found, outcome ID not recognized |
| `425` | Too Early | Matching engine is restarting — retry with backoff. See [Matching Engine Restarts](https://docs.polymarket.com/trading/matching-engine.md) |
| `429` | Too Many Requests | Rate limit exceeded — implement exponential backoff |
| `500` | Internal Server Error | Unexpected server error — retry with backoff |
| `503` | Service Unavailable | Exchange paused, or order placement blocked by cancel-only / post-only mode |

> [!NOTE]
>
> The CLOB API has an internal override: any error message containing `"not
>     found"` returns `404`, `"unauthorized"` returns `401`, and `"context
>     canceled"` returns `400`, regardless of the original status code.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.