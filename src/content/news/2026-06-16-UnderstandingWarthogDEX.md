---
category: "Blog Post"
title: "Understanding the Warthog DEX"
date: "2026-06-16"
author: "Warthog Team"
---

Warthog takes an innovative approach to DeFi in the sense that a hybrid setting of two liquidity sources (pool and order book) is considered and addressed mathematically optimally. Our [scientific research](https://github.com/CoinFuMasterShifu/FairBatchMatching/blob/main/FairBatchMatching.pdf) first describes this setup and proves existence and uniqueness of an optimal and fair order matching which operates batch-wise jointly on all orders such that the same price is realized for all buy swaps and all sell swaps. In particular no sandwich attacks are possible by design.

This post is a high-level guide to how the Warthog DEX works in practice. It complements the [Fair Batch Matching paper](https://warthog.network/FairBatchMatching.pdf) and the [in-depth documentation](https://github.com/warthog-network/docs/blob/main/unique-features/hard-coded-defi/fair-batch-matching.md) by giving you the practical mental model and answering the questions that come up most often. Try it yourself at [warthog.network/defi-demo](https://warthog.network/defi-demo).

## The two kinds of liquidity in the Warthog DEX

Every asset on Warthog automatically comes with two kinds of liquidity:

- A **liquidity pool** that holds reserves of the asset and WART, following the standard constant-product market maker formula (the same math Uniswap uses). The pool is *continuous* liquidity: it can absorb any amount up to the point where its marginal price shifts past a competing source.
- An **order book** of limit orders that traders place manually. The order book is *discrete* liquidity: each order has a fixed limit price and quantity, and can only match takers at those discrete prices.

Traditional exchanges only support discrete liquidity while today's DeFi's automated market makers such as Uniswap V1-V4 only support continuous liquidity. Warthog is the world's first and only place to unify both liquidity concepts and offer a theoretically sound matching algorithm in order to approach this hybrid setting with mathematical rigour, game-theoretic fairness and algorithmic robustness.

Warthog uses an algorithm called **Fair Batch Matching (FBM)** to match the two kinds of liquidity jointly within a block. FBM is the only fair way to do this: the same conversion price is shared for all buy swaps and all sell swaps, every participant is satisfied with the result, and there is no remaining pair of unfilled buy and sell liquidity that could be matched against each other. The existence and uniqueness of this equilibrium is a theorem (proved in the [FBM paper](https://warthog.network/FairBatchMatching.pdf)).

## A mental model: selfish actors wanting the best conversion rate

The strict mathematical definition of Fair Batch Matching can be hard to internalize. The way to think about it, and the way the theory was actually developed, is to imagine that each side of the market is driven by individual *selfish actors* that want to achieve the best conversion rate. Liquidity from the order book can be

1. *unmatched*,
2. matched with the *other side of the order book*, or
3. matched with the *liquidity pool*.

If the liquidity pool is non-empty, i.e. has reserves of base and quote assets, it can be used by these actors as long as it offers a better conversion rate than matching with the other side of the order book.

## An iterative way to think about it

While we have implemented Fair Batch Matching as a bisection algorithm, for better understanding we can imagine it as an iterative process: for each matching constellation we can ask what selfish actors would do differently to achieve better conversion rate.

If the pool is currently offering a better price than the standing limit orders on the other side, liquidity will be partially offloaded to the pool. Conversely, if pool price is worse than the other side of the order book, actors will reduce the pool-converted amount of funds and choose the liquidity from the order book. It can even be beneficial to partially match a single order and split the matched amount between the other side of the order book and the pool.

This leads to an iterative thought process where either buyers or sellers want to optimize their conversion rate until there is nothing that can be optimized. In that case we have found the *Nash equilibrium*, which is unique and is the Fair Batch Matching.

The concrete consequence: when there is both a pool and an order book, almost always one side will go to the pool first, because the pool usually offers the better price to that side. Only if the pool price happens to be *exactly* the two orders' price does matching start right away with the other side of the book.

## When does the pool win, and when does the order book win?

In the iterative mental model each side picks the better deal for itself. In practice:

- If the pool price is better for buyers than the standing sell orders, buyers go to the pool until pool price reaches the best sell order.
- If the pool price is better for sellers than the standing buy orders, sellers go to the pool until pool price reaches the best buy order.
- Once the pool price matches a limit order, that order takes over for additional liquidity on that side.
- If a trade is larger than the pool can provide before its price would cross a limit order, the part that fits in the pool is filled there, the rest matches against the order book.
- Low-reserve pools move price quickly with each trade, so partial pool + partial order book fills are common in those markets.
- In a market with no limit orders on one side, all of that side's flow goes through the pool.
- In a market with no pool yet, all trading is direct order book matching.

The single fair price found by FBM is the price at which all of these flows balance.

## "I placed both a buy and a sell order at the same price — why did only one side fill?" (the counter-order paradox)

A frequent surprise: a buy order and a sell order are placed at the same price but the sell is unfilled, while the buy order is reported as fully filled. What happened?

The order on the other side of the order book was not filled in the way one would intuitively expect because of the presence of the liquidity pool. If the pool price is not picked to be exactly equal to the order price, it is beneficial for one side to swap liquidity at the pool rather than match with the other side of the order book such that the order's counter is not addressed. This explains the observed behavior.

If you want to force a match against the order book rather than the pool, set a limit price that crosses the pool price enough to make matching against your order the better choice for the other side.

## How is the pool fee handled?

Each swap through a pool pays a fee. The current default in the testnet is **0.10% (10 basis points)**. The fee is retained in the pool rather than sent to a separate recipient. After each swap, the product of the two reserve amounts (base * quote) does not stay constant but instead *increases* slightly, by the fee. Over time, as more trades occur, the pool's reserves grow beyond what would be expected from a pure constant-product model. This benefits the liquidity providers, who own shares of the pool proportional to their contribution. When they withdraw, they receive their share of the (now larger) pool.

In other words: the fee is paid by traders and accumulated by the pool. It is not extracted to any external address. The economics are: traders pay a small fee, liquidity providers earn that fee proportional to their share, and the pool itself grows over time.

The pool's current price is simply the quotient of its reserves: if the pool holds `B` units of base and `Q` units of WART, the current price is `Q / B` (WART per unit of base). There are no upper or lower price boundaries set on the pool. A pool with very low reserves (relative to typical trade sizes) will move price dramatically on each trade; a deep pool will be relatively stable.

## Why is this sandwich-proof?

Traditional DeFi processes swaps one at a time against a pool. Each trade changes the pool state, and an attacker watching the mempool can sandwich a victim's order: buy just before to push the price up, then sell just after at the higher price. Warthog's FBM processes all orders within a block *jointly*. There is no "before" and "after" — every order in the block executes at the same single equilibrium price. The attacker's sandwich orders receive the same price as the victim, so no profit can be extracted by reordering.

This is the unique property of Warthog's DEX: the matching algorithm is sandwich-proof by construction, without any need for encrypted mempools, MEV auctions, or other workarounds. See the [Fair Batch Matching paper](https://warthog.network/FairBatchMatching.pdf) for the mathematical proof.

## Order priority within the same price level

In the FBM setting we do not allow duplicate price levels within base or quote swap orders (there can be a pair of base and quote orders at the same price, but not two base orders or two quote orders at the same price). This restriction is for simplicity in the matching setting, since otherwise matching priority at the same price level would have to be defined. The Warthog node bypasses this restriction by aggregating orders by price level before computing the FBM, then post-processing to distribute the filled amount back to the individual orders.

### Price level aggregation

In order to support same price orders, the node proceeds by, before matching, grouping orders that share a price level, summing their amounts into a single effective entry per price, running the FBM algorithm on the aggregated levels, and then post-processing to figure out which individual orders were actually filled.

### Fill priority

When multiple orders share the same price level and the matched liquidity is less than the total amount of all orders at this price level, the node has to decide which of these orders are filled. The *fill priority* used here is decreasing in the internal *order id*, which is itself increasing in block height. This means that orders mined in earlier blocks have higher priority. Within a single block, the miner can arrange the order in which transactions are included, which means the miner has control over the fill priority of same-price orders in that block.

However, since all buyers and all sellers receive the same price, this priority only determines whether an order is matched at all but not the matching price.

## Try it yourself

The best way to understand FBM is to see it in action. Head over to [warthog.network/defi-demo](https://warthog.network/defi-demo) and try placing a few orders, withdrawing liquidity, and watching the equilibrium emerge. The mathematical theory is in the [FBM paper](https://warthog.network/FairBatchMatching.pdf); the in-depth documentation with byte-level details is in the [docs repo](https://github.com/warthog-network/docs/blob/main/unique-features/hard-coded-defi/fair-batch-matching.md).

Welcome to DeFi that finally does what it should.
