---
category: "News Update"
title: "AMA SESSION WITH COINMASTERSHIFU"
date: "2025-04-08"
author: "CoinFuMasterShifu"
---

<h1>BITCOINTRY AMA SESSION WITH CoinFuMasterShifu</h1>
<br/><br/>
<h1>1. What inspired the creation of Warthog Network, and what are its primary objectives?</h1>
<br/><br/>
I was not one of the original founders but I joined the project very early. At that time, Warthog's GitHub page stated that the project was just a side project of the developers to build their own cryptocurrency for fun. So initially there was no real bigger goal behind the project. 
But that changed with time because eventually people began to take the project serious. 
When I came to the project and checked the code, I realized that I could use it as a basis to implement an idea for a new Proof of Work algorithm that I had been thinking about for quite some time: the Janushash algorithm. 
After that in addition to this algorithm we planned to add light-weight hard-coded DeFi and browser nodes. This makes Warthog a project primarily focused on innovation.


<br/><br/>
<h1>2. How does Warthog align with the original vision of cryptocurrency, particularly the concept of "one CPU, one vote"?</h1>
<br/><br/>

In my opinion this a forgotten, yet important and not-yet-achieved feature of Satoshi's original vision on cryptocurrency. It was forgotten because economic reality just lead to centralization of specialized mining farms where hashrate is concentrated but at the same "one CPU, one vote" is getting more important because with increasing amount of investment capital flowing into crypto, these investors also expect their investments to be safe from negative events caused by the very same centralization. 
So in some sense we need to fix centralization and get away from the big farms to meet the decentralization demands by investors. 
However technology did not yet come up with a new idea to solve this problem and prevent farm centralization. 
Ideally the hardware that people have at home should be most cost-efficient to mine on and no other specialized hardware should be more cost-efficient to mine on. This implies that we need to build mining algorithms around the hardware capabilities that consumer-hardware offers and is good at.
This is where Warthog comes into play because it relies on Janushash, different Proof-of-Work variant that was specifically designed to rely on hardware-resources that are present on gaming PCs: GPU + CPU power.
This brings us closer than ever before to Satoshi's original goal of "one CPU, one vote". I hope that this algorithm will find greater adoption in the future as I consider it a major break-through in PoW mining technology.

<br/><br/>
<h1>3. Can you explain the Proof of Balanced Work (PoBW) algorithm and how it differs from traditional Proof of Work mechanisms?</h1>
<br/><br/>

The mathematical details of PoBW are not easy to convey so I will stick to an easy-to-understand high-level explanation. Mining Proof of Work basically boils down to trying out a lot of hashes and hope that that hash is low enough to be smaller than some threshold. Now what we do differently is that we take two hashes and multiply them before we check whether this product is low enough to be smaller than the threshold. So there are two hashes involved that are combined using multiplication.
This approach is new and not used by any other project today and in the past. 
The involved hash functions were carefully selected such that the GPU hash function can be computed at much higher hashrate than the CPU hash function PCs used today. This implies that it makes sense to filter and only select the most promising GPU hashes before the corresponding CPU hash is computed. In other words, there is a pipeline from GPU (producer) to CPU (consumer). This is a very different design from traditional Proof of Work mechanisms where mining devices can operate independently.
Reserve:

<br/><br/>
<h1>4. How does the Janushash mining algorithm ensure a balanced utilization of CPU and GPU resources?</h1>
<br/><br/>

Proof of Balanced Work (PoBW) as a whole class of algorithms whereas Warthog's Janushash is one incarnation of PoBW where we have fixed the two involved hash functions: we take one that is targeted for CPU mining (Verushash v2.2) and another that is targeted for GPUs or ASICs (SHA256t). To bring the product down below the threshold, in theory you could just mine the CPU hash function only but that does not make sense because both, GPU and CPU hashes, are multiplied and instead of only tweaking one factor it is much more effective to tweak both. Now here comes the beauty of Warthog's Janushash algorithm: We don't have to tweak the algorithm to achieve that mining shall be balanced, the balancing is automatic and implicit because the extremes (only CPU mining or only GPU mining) are infeasible. In practice miners will need to find their optimal balance depending on hardware and electricity prices, and hardware performance. No additional tweak is required on the algorithm.

<br/><br/>
<h1>5. What motivated the decision to develop Warthog from scratch rather than forking existing projects?</h1>
<br/><br/>

I was not involved in the development from scratch, this was done by Rafiki, Pumbaa and Timon and as they stated it was just a fun project. But I can say that I joined this project because it was written from scratch because it shows that the team behind is strong on the technical side. Also this project uses much better code than some of the other projects I have looked at before. So maybe also code quality was a reason.

<br/><br/>
<h1>6. How does Warthog's approach to hard-coded DeFi solutions mitigate common vulnerabilities associated with smart contracts?</h1>
<br/><br/>

The hard-coded DeFi solution that we are implementing in Warthog has two major advantages compared to DeFi based on smart contracts:
<br/><br/>
a) Security: Today's DeFi protocols are hacked regularly. This is mainly due to the additional complexity introduced by smart contract peculiarities. Warthog will implement DeFi functionality directly into its core and does not suffer from this intermediate layer's complexities.
<br/><br/>
b) No sandwich attacks: we have researched a new kind of matching engine with a scientific paper here:
[<strong>Fair Batch Matching</strong>](https://github.com/CoinFuMasterShifu/FairBatchMatching/blob/main/FairBatchMatching.pdf) - 
This matching engine is designed to execute all orders at once by determining a fair price by matching a liquidity pool with DeFi orders. No front-running or back-running is possible and trader's won't be vulnerable to sandwich attacks.
 
<br/><br/>
<h1>7. With 100% of WART tokens being publicly mineable and no pre-mine or reserved funds, how does this model promote fairness and decentralization?</h1>
<br/><br/>

A big advantage of this model compared to most other new projects is the trust that we can get from the community: 
Firstly, there is no big fund to dump on investors which could disrupt price and secondly this again demonstrates the dedication that the team behind this project has. This means that our model proves that this project is no quick money grab but  has the fundamentals for a real movement. Obviously, if everyone has the same chance to accumulate coins and no coins were preallocated, this is as fair as a cryptocurrency project can get and also encourages wealth decentralization of WART among our community. There were no coins that are given away to some marketing agency or similar.

<br/><br/>
<h1>8. Given that Warthog is an experimental project, what measures are in place to ensure the security and reliability of the network?</h1>
<br/><br/>

In the past, the fast action and update cycle can be considered as a measure to provide security and reliability. Before Warthog had the Janushash algorithm, there was a big farm that mined Warthog with their own closed-source optimized miner and at that time we were there to keep up network stability with various fixes and tweaks to prevent that farm from getting too much total hashrate.
Nowadays, the Janushash algorithm is doing quite well in providing network security as big farms cannot easily join Warthog mining with their existing hardware specialized on GPU-only or CPU-only mining.
In the future, as we grow we are relying more and more on a testnet as a playground for new features. That will allow us to catch bugs early before they can get into the main net.
That being said, we are a experimenting with new features that don't exist today so there are indeed risks involved compared to more established projects. That's why we try to do our best to avoid any unpleasant surprises

<br/><br/>
<h1>9. How can community members contribute to Warthog's development, and what roles do they play in its evolution?</h1>
<br/><br/>

There are regularly people who are asking for paid jobs and obviously, as a project without allocated fund we cannot offer paid positions. Instead were are depending on volunteers who help with development of all kinds: web development, marketing, core development. Everything is needed and every contributor is welcome. Volunteers play a major role in the evolution of Warthog. To join, just talk to us in the official Warthog Discord.

<br/><br/>
<h1>10. What are the upcoming milestones for Warthog, particularly concerning DeFi integration and browser-based nodes?</h1>
<br/><br/>

The huge milestone that we are heading to is the DeFi support for Warthog. This won't just be a clone of today's DeFi implementations as we will support many new features that don't exist yet and are not possible or too difficult to implement in smart contract logic. For example:
<br/><br/>
a) I am working on a copy-on-write mechanism for balances. This will allow to "fork assets", i.e. everyone's existing balance of an asset will be cloned into the newly forked asset.
<br/><br/>
b) Building on top of this functionality it will be possible to give airdrops/dividends to all holders of a particular asset and compared to existing airdrops it will be based on balance held at a specific fork time (similar to how Bitcoin forks in the past worked) instead of some scripts that explicitly call smart contract logic to pay out to a specific off-chain determined list of addresses.
<br/><br/>
c) Another major feature for Warthog's DeFi is the new and custom-written matching engine which solves the Sandwich Problem. It won't be possible to front-run and back-run orders within a block anymore. I consider this a major break-through in DeFi technology and Warthog will be the first and only crypto project supporting this tech.
<br/><br/>
d) Finally the full browser nodes will be finished which are already working today. But they do need a lot of UI polishing and also peer-to-peer communication support. Then it will be possible to start a node and have full access to the network by just opening a website.

<br/><br/>
<h1>Reserve:</h1>
<br/><br/>

<h1>11. How do you envision the role of Warthog in the broader cryptocurrency ecosystem in the next few years?</h1>
<br/><br/>
It is very difficult to give any forecasts on Warthog's evolution but we hope that when price increases, the WART donated to from the community can be wisely spent to accelerate development. So it is very possible that Warthog gains a lot of more traction in the following months and years and with this I think we will see some of our ideas getting adopted and acknowledged by blockchain industry.
<br/><br/>

<h1>Q12: Are there plans to collaborate with other projects or platforms to enhance Warthog's functionalities and reach?</h1>
<br/><br/>
 At the moment we are not collaborating with platforms other than exchanges.
 But with higher WART price we might hire collaborations here and there.
 Currently we are working with someone from the community who is developing a nicer GUI wallet based on electron.