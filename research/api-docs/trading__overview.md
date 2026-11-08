> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Overview

> Understand how orders, settlement, and positions fit together on Polymarket.

Trading connects signed orders on the CLOB with settlement on Polygon. You choose an outcome, authorize an order with your signer, and submit it to the order book. When the order matches, settlement transfers pUSD and outcome tokens between trading accounts.

## Trading Workflow

Set up your account once, then repeat the remaining steps for each order.

**1. Set Up Your Account**

Connect a signer to your account wallet, fund it, and grant the required
trading approvals.

**2. Choose an Outcome**

Select the outcome you want to buy or sell and check its current market
constraints.

**3. Place an Order**

Choose a price and size, sign the order, and submit it to the CLOB.

**4. Manage the Order**

Monitor fills and cancel any remaining open amount. Matched trades settle on
Polygon and update your balances and positions.

> [!NOTE]
>
> The Exchange operator can match orders and enforce their ordering, but cannot
> set prices or execute trades that users did not authorize.

## Start Trading

> [card] [Place Your First Order](https://docs.polymarket.com/trading/quickstart.md)
>
> Complete the first authenticated trading workflow.

> [card] [Wallets and Authentication](https://docs.polymarket.com/trading/wallets-auth.md)
>
> Connect a signer to the account wallet that holds funds and positions.

> [card] [Order Lifecycle](https://docs.polymarket.com/concepts/order-lifecycle.md)
>
> Understand how orders move from submission through fills, cancellation, or
> expiration.

> [card] [Session Keys](https://docs.polymarket.com/trading/session-keys.md)
>
> Give a separate signer scoped, time-limited Deposit Wallet access.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.