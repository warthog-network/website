---
category: "News Update"
title: "DeFi Testnet Outlook"
date: "2026-05-03"
author: "CoinFuMasterShifu"
---

# Introduction: After the Silence

To our incredible community of supporters, miners, and enthusiasts who have been waiting patiently throughout this long period of development: **thank you**. Your faith in the project has never wavered, even during the extended silence as we worked tirelessly on the next generation of blockchain technology. Today, I'm excited to share what's been brewing in the labs - the culmination of over a year's intensive development that will fundamentally change what's possible in DeFi.

# The Year-Long Journey: 2024-2025

The DeFi functionality in Warthog represents the most ambitious undertaking in the project's history. With almost **400 commits** since January 2025, the [`defi` branch](https://github.com/warthog-network/core/tree/defi) represents a significant undertaking, the development has been nothing short of monumental. During this time, we completely rewrote the block parsing and serialization system, adopted modern C++20 (and later C++23), integrated the Glaze library for API serialization, created comprehensive market data services, built chart and trade history databases, and - most importantly - implemented the revolutionary Fair Batch Matching algorithm which is itself a significant scientific contribution to the field of mathematical DeFi theory.

# Warthog's DeFi branch

Most of the work has been going into DeFi the [`defi` branch](https://github.com/warthog-network/core/tree/defi) of the Warthog node. The node built on this branch shall be compatible with the current network such that at some point we may switch seamlessly to supporting the new DeFi features. The idea is to replace all running nodes first and activate the new transaction types at a specific block height while behavior before that activation height shall be identical as the current live nodes in the network.

However the internal database structure is completely different now such that a resync is necessary to add the DeFi branch nodes to the network. Also the API structure was changed and standardized such that pools and wallets will need to support the new node explicitly. The change in API structure was necessary due to the fundamental changes of the node internal architecture and to support the new features. For example, the DeFi branch does not save only one balance for each account but must save balance for each token held. Also new transaction types will be available.

## The Transaction Types

In the current live code base, there are only two transaction types: `reward` transactions for the miner of a block and `wartTransfer` transactions to transfer balance. In contrast, in the upcoming DeFi testnet will support a set of **9 distinct transaction types** which will be extended in the future: 
- `reward` for block mining rewards,
- `wartTransfer` for WART coin transfers, 
- `tokenTransfer` for asset or liquidity token transfers, 
- `assetCreation` for creating new tokens, 
- `limitSwap` for placing buy/sell limit orders, 
- `liquidityDeposit` for adding liquidity to pools, 
- `liquidityWithdrawal` for removing from pools, 
- `cancelation` for canceling pending orders, and 
- `match` for batch DEX trade execution. 

## The Three Token Types

In Warthog there will be three different token types: The native WART token, *assets* and *asset liquidity*. Assets can be created by users and currently, the creator will be credited the whole minted supply specified in the `assetCreation` transaction. Warthog supports different amount of *decimals* for assets, these are the decimal digits that represent the partitioning resolution of the asset. The decimals are also specified at during asset creation. With every asset, Warthog automatically creates a market where the asset is tradable against, and price is expressed in WART. For that market also a pool is set up and the liquidity tokens within such pool represent the third token type, the asset liquidity tokens. These tokens can be redeemed for pool liquidity. Below is a summary of the different token types:

| Token Type | Transferable | Tradable for | Redeemable |
|:-----------|:------------:|:-------------|:-----------|
| WART | yes | any asset | no |
| Assets | yes | WART | no |
| Liquidity Tokens | yes | none | yes |


# The Sandwich Problem: Why It Matters

In a blockchain, there is **no direct concept of time**. Blocks form a discrete-time sequence, but within a block, transactions can be ordered arbitrarily. This creates MEV (Miner Extractable Value) in traditional DeFi and its most common form: **sandwich attacks**.

## How Sandwich Attacks Work

Consider a victim who wants to buy 1000 units of an asset. The victim submits a buy order with a tolerated slippage but an attacker monitoring the mempool observes the transaction and sees an opportunity. The attacker then **front-runs** by buying the asset first. The victim's order then executes at a higher price because the attacker bought first. The attacker then **back-runs** by selling the asset for a profit. This profit comes from the price difference extracted from the victim - a risk-free profit made possible by controlling transaction order while the victim's order is pushed as far as possible to the limit price for maximum profit. The victim could have traded for a better price but the attack worsened the price as much as possible. 

## Why Smart Contracts Can't Solve This

Current smart contract implementations **process transactions sequentially** - they don't "look at all orders simultaneously" because the blocks provide an implicit ordering on the transactions which are executed one at a time. Any smart contract-based DEX is fundamentally tied to this behavior and therefore vulnerable to sandwich attacks because the ordering is controlled by block builders. This is why all smart contract DEXs - Uniswap, SushiSwap, Curve, and every other AMM - are vulnerable by design.

# Fair Batch Matching: The Revolutionary Solution

## Combining discrete and continuous liquidity

[CoinFuMasterShifu's paper on Fair Batch Matching (FBM)](https://github.com/CoinFuMasterShifu/FairBatchMatching/blob/main/FairBatchMatching.pdf) lays the foundation for a new branch of DeFi theory where discrete and continuous liquidity are connected resulting in a novel, unique and logical fair matching algorithm which does **not** depend on any ordering of the transactions. The main theorem states that for discrete liquidity in the form of an order book containing limit swap orders, and continuous liquidity in the form of a liquidity pool, such a matching always exists, is unique and that for all participants of the trade, their limit price is satisfied and they cannot interact differently with the pool liquidity to obtain a better conversion rate in the matched trade. In this sense the resulting match can be seen as a Nash equilibrium and, to the best of our knowledge this paper is the first on this topic.

## Making Sandwich Attacks impossible

As stated before, the root problem causing the existence of MEV and in particular the Sandwich Attacks is the sequential processing of DeFi transactions within a block and Warthog's Fair Batch Matching solves this problem at the **consensus level** by processing all orders jointly, erasing their implicit order of appearance in a block. This makes it impossible to run a sandwich attack within the same block such that no profit can be made at a victim's expense. In particular, Fair Batch Matching solves the sandwich problem and all sorts of other related attacks that rely on transaction ordering.

# Hard-Coded DeFi: Security Through Native Implementation

Unlike Ethereum and other platforms that rely on smart contracts for DeFi functionality, Warthog implements DeFi logic directly in the native node code. This approach has crucial advantages that address the security and functionality limitations of smart contract-based DeFi.

## Security

Today's DeFi platforms are constantly plagued by security vulnerabilities which are exploited by hackers. Such disastrous events regularly wipe liquidity pools and leave investors with significant losses. In consequence, DeFi could not gain as much trust as it deserves. Warthog changes this by including dedicated DeFi logic in its core. Native code is much easier to write and to check for vulnerabilities such that our approach will have few to no critical bugs impacting security.

## Novel Features

Compared to smart contract based DeFi implementations, a hard-coded approach allows the implementation of **novel features impossible in smart contracts**. Warthog's revolutionary sandwich-free order matching algorithm simply cannot be implemented without native node support because it treats all orders jointly, erasing their implicit order of appearance within a block. A smart contract based approach is not capable of joint processing of transactions but instead implicitly relies on an ordering.

## First-Class Citizen

In the future, Warthog aims to becoming a crypto platform with specific focus on DeFi. In the new [`defi` branch](https://github.com/warthog-network/core/tree/defi) the entire database architecture revolves around this purpose and therefore insights and convenience functionality are supported out of the box. This includes richlists for every token, easy-to-understand fork hierarchy, and transparent tokenomics which don't require trusting dubious meme coin website charts.


# The New Client-Side Explorer

We're also launching a new browser-based blockchain explorer implemented in React to run entirely in the browser with no server-side components. This project is also [hosted on GitHub](https://github.com/warthog-network/client-explorer) and contributions are welcome.

The explorer provides comprehensive access to the blockchain and DeFi ecosystem. 
- The **Dashboard** shows chain head info, hashrate chart, and recent blocks. 
- The **Transaction Lookup** provides detailed views for all 9 transaction types.
- The **Account View** shows all token balances and transaction history. 
- Built-in **Asset Browser** to view and find assets to look up details and richlists. 
- The **DEX View** displays order book and liquidity pool of a specific market.
- The **Mempool View** shows live pending transactions.

Note that the client explorer is an early version that is still being actively developed and improved. While it provides core functionality for exploring the Warthog blockchain and DeFi features, there may be bugs and areas that need refinement. Your feedback and contributions are welcome to help make it better over time. Report your findings in the [Warthog Discord](https://discord.com/invite/QMDV8bGTdQ) or [GitHub Issues Tracker](https://discord.com/invite/QMDV8bGTdQ).

# What Comes Next

The coming weeks will be exciting. Things will be rolled out. Bugs will be fixed. The community's help through mining, testing, and development will be deeply appreciated. To the community that has waited patiently during this long development period: **thank you** for your support, your faith in the project, and for being part of the Warthog journey. The work we're doing together represents something genuinely new in the blockchain space - a blockchain that truly decentralizes mining with PoBW, eliminates smart contract vulnerabilities, and prevents sandwich attacks with Fair Batch Matching. This isn't just another DeFi project. This is a fundamental rethinking of how blockchain technology should work. 

# How You Can Help

- **Mining**: Prepare mine on the Warthog DeFi testnet when it launches. For now, miners can already run a `defi` branch node and test mining.
- **Testing**: Once the testnet launches, try all DeFi features including asset creation, token transfers, order placement and matching, liquidity provision and withdrawal, and the matching engine's sandwich-proof guarantees. Report any bugs you find on Discord to help us improve.
- **Development**: Contributions are welcome across the Warthog ecosystem. The core node repository, client explorer, and documentation all need developers to help build the future of DeFi.

# Stay Connected

- **[Discord](https://discord.com/invite/QMDV8bGTdQ)** and **[Telegram](https://t.me/warthognetwork)**: For general discussion, community engagement, and news updates.
- **[GitHub](https://github.com/warthog-network)**: Access all Warthog repositories including the core node, client explorer, and documentation.
- **[Warthog Core's `defi` branch](https://github.com/warthog-network/core/tree/defi)**: This branch of Warthog core contains all new DeFi features.
- **[Client Explorer](https://github.com/warthog-network/client-explorer)**: The new blockchain explorer repository.
- **[Documentation](https://github.com/warthog-network/docs)**: Comprehensive documentation for developers and users.
- **[DeFi Demo](https://warthog.network/defi-demo)**: Try the sandwich-proof matching algorithm in your browser.

# Thank You

**Stay tuned. The best is yet to come.**

CoinFuMasterShifu
