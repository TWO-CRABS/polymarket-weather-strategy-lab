> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Place Your First Order

> Learn how to authenticate with the CLOB and submit your first market order.

This guide shows you how to place your first order using an existing Polymarket account. For this guide, we recommend having at least 10 pUSD available. Create or fund an account at [polymarket.com](https://polymarket.com/) before you start.

Find your Polymarket wallet address in your profile menu:

![Polymarket profile menu showing the account wallet address on desktop](https://mintcdn.com/polymarket-292d1b1b/1lJ_npwaE_MShiVL/images/deposit-wallet-desktop.png?fit=max\&auto=format\&n=1lJ_npwaE_MShiVL\&q=85\&s=6be3b87c53d6718f973db37e134ee944)

![Polymarket profile menu showing the account wallet address on mobile](https://mintcdn.com/polymarket-292d1b1b/1lJ_npwaE_MShiVL/images/deposit-wallet-mobile.png?fit=max\&auto=format\&n=1lJ_npwaE_MShiVL\&q=85\&s=4d6f87ed5440c5297e60d6331c47dc73)

**1. Authenticate**

First, authenticate with the CLOB.

> [tab] TypeScript
>
> Pass the signer and wallet address to `createSecureClient`.
>
> ```ts theme={null}
> import { createSecureClient, OrderSide } from "@polymarket/client";
> import { privateKey } from "@polymarket/client/viem";
>
> const client = await createSecureClient({
>   wallet: process.env.POLYMARKET_WALLET_ADDRESS,
>   signer: privateKey(process.env.POLYMARKET_PRIVATE_KEY),
> });
> ```
>
> > [!NOTE]
> >
> > This example uses Viem. See [Wallet
> > Integrations](https://docs.polymarket.com/getting-started/typescript.md#wallet-integrations) to connect a
> > signer from another supported wallet library.

> [tab] Python
>
> Pass the private key and wallet address to `AsyncSecureClient.create`.
>
> ```python theme={null}
> import os
>
> from polymarket import AsyncSecureClient
>
> client = await AsyncSecureClient.create(
>     private_key=os.environ["POLYMARKET_PRIVATE_KEY"],
>     wallet=os.environ["POLYMARKET_WALLET_ADDRESS"],
> )
> ```

**2. Choose an Outcome**

Then, fetch the market and select the outcome you want to buy. See
[Market Data](https://docs.polymarket.com/market-data/overview.md) to find a different market.

> [tab] TypeScript
>
> ```ts theme={null}
> const market = await client.fetchMarket({
>   slug: "will-the-us-confirm-that-aliens-exist-before-2027-789-924-249",
> });
> ```
>
> Choose an outcome (YES in this example) and select its trading identifier based on the market version.
>
> ```ts theme={null}
> const { yes, no } = market.outcomes;
> const assetId = market.version === "v2" ? yes.positionId : yes.tokenId;
> ```
>
> The unified SDK uses `assetId` for an outcome's trading identifier: a token
> ID for a CTF market or a position ID for a Polymarket Protocol V2 market.
> Use the identifier exposed for that outcome.

> [tab] Python
>
> ```python theme={null}
> market = await client.get_market(
>     slug="will-the-us-confirm-that-aliens-exist-before-2027-789-924-249",
> )
> ```
>
> Choose an outcome (YES in this example) and select its trading identifier based on the market version.
>
> ```python theme={null}
> yes = market.outcomes.yes
> asset_id = yes.position_id if market.version == "v2" else yes.token_id
> ```
>
> The unified SDK uses `asset_id` for an outcome's trading identifier: a token
> ID for a CTF market or a position ID for a Polymarket Protocol V2 market.
> Use the identifier exposed for that outcome.

**3. Place a Market Order**

Then, submit a small market buy. The order fills against available liquidity, and any unfilled amount is canceled instead of remaining open.

> [tab] TypeScript
>
> Use `placeMarketOrder` to place the market order.
>
> ```ts theme={null}
> const response = await client.placeMarketOrder({
>   assetId,
>   side: OrderSide.BUY,
>   amount: "10", // Spend up to 10 pUSD
> });
>
> if (!response.ok) {
>   throw new Error(response.message);
> }
>
> // response.orderId: string
> ```

> [tab] Python
>
> Use `place_market_order` to place the market order.
>
> ```python theme={null}
> response = await client.place_market_order(
>     asset_id=asset_id,
>     side="BUY",
>     amount="10",  # Spend up to 10 pUSD
> )
>
> if not response.ok:
>     raise RuntimeError(response.message)
>
> # response.order_id: str
> ```

**4. Wait for Settlement**

Your order matched, but its trade settles on-chain asynchronously. Wait for settlement before checking your position.

> [tab] TypeScript
>
> Use `waitForOrderFillSettlement` to wait for the trade to settle.
>
> ```ts theme={null}
> const hashes = await client.waitForOrderFillSettlement(response);
>
> // hashes: TxHash[]
> ```

> [tab] Python
>
> Use `wait_for_order_fill_settlement` to wait for the trade to settle.
>
> ```python theme={null}
> hashes = await client.wait_for_order_fill_settlement(response)
>
> # hashes: tuple[TransactionHash, ...]
> ```

**5. Check Your Position**

Finally, list your positions for the selected market and find the outcome you bought.

> [tab] TypeScript
>
> ```ts theme={null}
> const page = await client
>   .listPositions({
>     market: [market.conditionId!],
>   })
>   .firstPage();
>
> const position = page.items.find((item) => item.assetId === assetId);
> if (!position) {
>   throw new Error("Position not found.");
> }
>
> const positionSize = position.size; // Outcome shares held
> ```

> [tab] Python
>
> ```python theme={null}
> condition_id = market.condition_id
> assert condition_id is not None
>
> page = await client.list_positions(market=[condition_id]).first_page()
>
> position = next(
>     (item for item in page.items if item.asset_id == asset_id),
>     None,
> )
> if position is None:
>     raise RuntimeError("Position not found.")
>
> position_size = position.size  # Outcome shares held
> ```

You placed your first market order on Polymarket.

To let a separate signer place and cancel orders without using the owner key,
continue to [Session Keys](https://docs.polymarket.com/trading/session-keys.md).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.