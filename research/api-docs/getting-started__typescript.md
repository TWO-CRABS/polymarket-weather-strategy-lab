> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# TypeScript SDK

> Get started with the unified Polymarket TypeScript SDK.

The `@polymarket/client` NPM package is the official TypeScript SDK for building Polymarket integrations.
With this SDK client you can fetch market data, subscribe to real-time data,
submit orders, redeem positions and many other actions.

> [card] [GitHub](https://github.com/Polymarket/ts-sdk)
>
> View the TypeScript SDK source.

> [card] [NPM Package](https://www.npmjs.com/package/@polymarket/client)
>
> Install `@polymarket/client@latest`.

See the [SDK Changelog](https://docs.polymarket.com/changelog/sdks.md#typescript) for recent TypeScript
releases.

## Quickstart

**1. Install the SDK**

Install the SDK with your preferred package manager.

```bash npm theme={null}
npm install @polymarket/client@latest
```

```bash bun theme={null}
bun add @polymarket/client@latest
```

```bash pnpm theme={null}
pnpm add @polymarket/client@latest
```

```bash yarn theme={null}
yarn add @polymarket/client@latest
```

**2. Create a Public Client**

Create a `PublicClient` to access publicly available Polymarket data.

```ts theme={null}
import { createPublicClient } from "@polymarket/client";

const client = createPublicClient();
```

**3. Fetch Active Markets**

Fetch a page of active markets to discover trading opportunities.

```ts theme={null}
const pages = client.listMarkets({
  closed: false,
  pageSize: 5,
});

const firstPage = await pages.firstPage();

for (const market of firstPage.items) {
  // market: Market
}
```

## Pagination

SDK list methods use a consistent paginator interface. Iterate with `for await`
to retrieve every page, or fetch one page at a time when you need to control
pacing. Creating a paginator is synchronous. `firstPage()` returns a promise
that resolves to a page, and `for await` retrieves pages asynchronously.

```ts theme={null}
const pages = client.listMarkets({
  closed: false,
  pageSize: 10,
});

for await (const page of pages) {
  for (const market of page.items) {
    // market: Market
  }
}
```

`page.nextCursor` is an opaque SDK cursor. Store it as-is if you want to resume
a scan later, and omit it when starting from the first page.

```ts theme={null}
const pages = client.listMarkets({
  closed: false,
  pageSize: 10,
});

const page = await pages.firstPage();

if (page.nextCursor) {
  const secondPage = await pages.from(page.nextCursor).firstPage();
  // secondPage.items: Market[]
}
```

## Types

SDK methods return typed responses, and their public types are exported from
`@polymarket/client`.

```ts theme={null}
import type {
  Event,
  Market,
  OrderBook,
  PriceHistoryPoint,
} from "@polymarket/client";
```

The SDK also uses branded types for identifiers, decimal values, timestamps,
and EVM addresses so TypeScript can distinguish values that would otherwise all
be strings.

```ts theme={null}
import type {
  ConditionId,
  DecimalString,
  EvmAddress,
  IsoDateTimeString,
  MarketId,
  PositionId,
  TokenId,
} from "@polymarket/client";
```

## Error Handling

Each SDK action exposes a matching error guard. Use it to handle documented
errors for that action and rethrow anything unexpected.

```ts theme={null}
import { ListMarketsError } from "@polymarket/client";

try {
  const page = await client.listMarkets({ closed: false }).firstPage();
  // page.items: Market[]
} catch (error) {
  if (!ListMarketsError.isError(error)) {
    throw error;
  }

  switch (error.name) {
    case "RateLimitError":
      // Retry later.
      break;
    case "UserInputError":
      // Fix the request parameters.
      break;
  }
}
```

## Wallet Integrations

Create a `SecureClient` when your integration needs to trade or access account
data. Pass the signer adapter for your wallet library to
`createSecureClient()`.

> [tab] Viem
>
> Install the Viem adapter alongside the SDK.
>
> ```bash npm theme={null}
> npm install @polymarket/client@latest viem
> ```
>
> ```bash bun theme={null}
> bun add @polymarket/client@latest viem
> ```
>
> ```bash pnpm theme={null}
> pnpm add @polymarket/client@latest viem
> ```
>
> ```bash yarn theme={null}
> yarn add @polymarket/client@latest viem
> ```
>
> Create the signer directly from a private key:
>
> ```ts theme={null}
> import { createSecureClient } from "@polymarket/client";
> import { privateKey } from "@polymarket/client/viem";
>
> const client = await createSecureClient({
>   signer: privateKey(process.env.POLYMARKET_PRIVATE_KEY),
> });
> ```
>
> If your application already has a Viem `WalletClient` instance, adapt it with
> `signerFrom()`:
>
> ```ts theme={null}
> import { createSecureClient } from "@polymarket/client";
> import { signerFrom } from "@polymarket/client/viem";
>
> const client = await createSecureClient({
>   signer: signerFrom(walletClient),
> });
> ```

> [tab] Privy
>
> Install the Privy adapter and server SDK alongside the Polymarket SDK.
>
> ```bash npm theme={null}
> npm install @polymarket/client@latest @privy-io/node
> ```
>
> ```bash bun theme={null}
> bun add @polymarket/client@latest @privy-io/node
> ```
>
> ```bash pnpm theme={null}
> pnpm add @polymarket/client@latest @privy-io/node
> ```
>
> ```bash yarn theme={null}
> yarn add @polymarket/client@latest @privy-io/node
> ```
>
> Create the signer from your Privy client and wallet ID:
>
> ```ts theme={null}
> import { createSecureClient } from "@polymarket/client";
> import { signerFrom } from "@polymarket/client/privy";
> import { PrivyClient } from "@privy-io/node";
>
> const privy = new PrivyClient({
>   appId: process.env.PRIVY_APP_ID!,
>   appSecret: process.env.PRIVY_APP_SECRET!,
> });
>
> const client = await createSecureClient({
>   signer: signerFrom({
>     privy,
>     walletId: process.env.PRIVY_WALLET_ID!,
>   }),
> });
> ```

> [tab] Ethers v5
>
> Install the Ethers v5 adapter and its aliased dependency alongside the SDK.
>
> ```bash npm theme={null}
> npm install @polymarket/client@latest ethers-v5@npm:ethers@^5.8.0
> ```
>
> ```bash bun theme={null}
> bun add @polymarket/client@latest ethers-v5@npm:ethers@^5.8.0
> ```
>
> ```bash pnpm theme={null}
> pnpm add @polymarket/client@latest ethers-v5@npm:ethers@^5.8.0
> ```
>
> ```bash yarn theme={null}
> yarn add @polymarket/client@latest ethers-v5@npm:ethers@^5.8.0
> ```
>
> Create the signer from an Ethers v5 wallet:
>
> ```ts theme={null}
> import { createSecureClient } from "@polymarket/client";
> import { signerFrom } from "@polymarket/client/ethers-v5";
> import { ethers } from "ethers-v5";
>
> const provider = new ethers.providers.JsonRpcProvider(
>   process.env.POLYGON_RPC_URL,
> );
> const wallet = new ethers.Wallet(process.env.POLYMARKET_PRIVATE_KEY!, provider);
>
> const client = await createSecureClient({
>   signer: signerFrom(wallet),
> });
> ```

Continue to [Wallets and Authentication](https://docs.polymarket.com/trading/wallets-auth.md) to configure the
account wallet and gasless transactions.

## Realtime Subscriptions

The SDK can combine updates from multiple realtime feeds into a single stream
of events.

Call `subscribe()` with one or more subscription specs. Public streams are
available on both `PublicClient` and `SecureClient`. A `SecureClient` also
provides private streams for the connected account.

```ts Public Client theme={null}
const assetId = "<asset_id>";

const stream = await client.subscribe([
  { topic: "market", assetIds: [assetId] },
  { topic: "sports" },
]);

for await (const event of stream) {
  // event:
  //   | MarketBookEvent
  //   | MarketPriceChangeEvent
  //   | MarketLastTradePriceEvent
  //   | MarketTickSizeChangeEvent
  //   | SportsEvent

  if (shouldClose) {
    await stream.close();
    break;
  }
}
```

```ts Secure Client theme={null}
const assetId = "<asset_id>";

const stream = await client.subscribe([
  { topic: "market", assetIds: [assetId] },
  { topic: "user" },
]);

for await (const event of stream) {
  // event:
  //   | MarketBookEvent
  //   | MarketPriceChangeEvent
  //   | MarketLastTradePriceEvent
  //   | MarketTickSizeChangeEvent
  //   | UserEvent

  if (shouldClose) {
    await stream.close();
    break;
  }
}
```

Narrow `event.topic` before handling a specific event shape. The examples show
a few streams; see
[Real-Time Data](https://docs.polymarket.com/market-data/realtime-data.md),
[Real-Time Order Updates](https://docs.polymarket.com/trading/realtime-order-updates.md), and
[Perps Realtime Updates](https://docs.polymarket.com/perps/realtime-updates.md) for feed-specific options.

## Next Steps

> [card] [Read Market Data](https://docs.polymarket.com/market-data/overview.md)
>
> Discover markets and work with prices, order books, and historical data.

> [card] [Subscribe to Real-Time Updates](https://docs.polymarket.com/market-data/realtime-data.md)
>
> Stream market and account updates as they happen.

> [card] [Place Your First Order](https://docs.polymarket.com/trading/quickstart.md)
>
> Set up an account and complete your first authenticated trade.

> [card] [Use Session Keys](https://docs.polymarket.com/trading/session-keys.md)
>
> Grant scoped, time-limited Deposit Wallet access to a separate signer.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.