> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Positions & Tokens

> Understanding outcome tokens and how positions work on Polymarket

Every prediction on Polymarket is represented by **outcome tokens**. When you trade, you buy and sell these tokens. Your **position** is your balance for an outcome in a market.

![](https://mintcdn.com/polymarket-292d1b1b/FOMte3ewbG-LVy3k/images/core-concepts/token-lifecycle.png?fit=max\&auto=format\&n=FOMte3ewbG-LVy3k\&q=85\&s=cad279109c43c68c541123c2d348c4c5)

## Outcome Tokens

Each binary market has two outcome positions:

| Position | Full payout if… |
| - | - |
| **Yes** | The condition occurs |
| **No** | The condition does not occur |

> [!NOTE]
>
> A complete Yes/No set is backed by `1 pUSD` of value. How that backing is held
> and released depends on the system that owns the position.

## Positions Ledgers

Polymarket markets use one of two onchain ledgers for outcome balances:
**PositionManager** for Polymarket Protocol V2 markets and **Conditional Tokens**
for CTF markets. Both represent Yes and No outcomes as ERC-1155 balances, and those
balances have the same economic meaning to traders.

The ledger determines which position identifiers and integration path apply.
See the [Migrate to Polymarket Protocol V2 technical guide](https://docs.polymarket.com/migrate/polymarket-v2/overview.md)
for more technical details.

## Position Management

### Split

Convert pUSD into outcome tokens. Splitting `1 pUSD` creates 1 Yes position and 1 No position.

```
100 pUSD → 100 Yes positions + 100 No positions
```

Use this when you want to:

* Create inventory for market making
* Obtain both sides of a market

### Trade

Buy or sell outcome tokens on the order book. This is how most users acquire positions.

* **Buy Yes** at `$0.60` → Pay `$0.60`, receive 1 Yes position
* **Sell Yes** at `$0.60` → Give up 1 Yes position, receive `$0.60`

You can sell your position at any time before resolution.

### Merge

Convert a complete set back into pUSD. Merging requires equal amounts of Yes and No positions.

```
100 Yes positions + 100 No positions → 100 pUSD
```

Use this when you want to:

* Exit a position without trading
* Convert accumulated positions back to collateral

### Redeem

After a market resolves, exchange positions for pUSD according to the recorded payout.

| Outcome | Yes positions | No positions |
| - | - | - |
| Event occurs | Worth \$1 each | Worth \$0 |
| Event doesn't occur | Worth \$0 | Worth \$1 each |

```
100 winning positions → 100 pUSD
```

A binary market can resolve to a split payout instead of a full `$1` or `$0`, in which case each side redeems for its share. Negative-risk markets never split: exactly one outcome takes the full payout and every other outcome pays nothing.

See [Manage Positions](https://docs.polymarket.com/migrate/polymarket-v2/overview.md#manage-positions) for operations on both position systems.

### Position Value

The value of your position depends on the current market price:

```
Position value = Position balance × Current price
```

If you hold 100 Yes positions and Yes is trading at \$0.75:

```
Position value = 100 × $0.75 = $75
```

## Profit and Loss

Your profit depends on how the market resolves compared to your entry price.

### Example - Buying Yes at 0.40

| Scenario | Outcome | Return | Profit |
| - | - | - | - |
| Event occurs | Yes wins | \$1.00 | +\$0.60 per position (150%) |
| Event doesn't occur | No wins | \$0.00 | -\$0.40 per position (-100%) |

### Holding Rewards

Polymarket pays a **4.00% annualized** Holding Reward based on your total position value in eligible markets. Your total position value is randomly sampled once each hour, and the reward is distributed daily. The rate is variable and subject to change at Polymarket's discretion.

### Example - Selling Before Resolution

You can lock in profits or cut losses by selling before the market resolves:

* Bought Yes at `$0.40`
* Price rises to `$0.70`
* Sell at `$0.70` → Profit of `$0.30` per position (75%)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.