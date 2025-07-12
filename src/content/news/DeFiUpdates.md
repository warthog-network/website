
---
category: "News Update"
title: "DeFi Updates"
date: "2025-07-11"
author: "CoinFuMasterShifu"
---



<h1>DeFi Updates<h1>


<br/><br/>
<p>I will give a more extensive update of the current state of DeFi:
As I advance I see more things coming up that also need to be adjusted, because the DeFi update I am working on is a really big update. I completely rewrote the parsing and serialization of blocks, and today I wrote the Merkle tree functions. Now they will be nice and clean using generic code that allows easy extension when I want to add some more transaction types later on. The current <strong>transaction types</strong> that will be supported in the first DeFi testnet release include:</p>
<br/><br/>
New address registration<br/>
Mining reward<br/>
Sending WART<br/>
Sending a token<br/>
Creating a token<br/>
Creating a new order<br/>
Canceling an order<br/>
Adding liquidity to a pool<br/>
Removing liquidity from a pool.<br/>
<br/><br/>
<p>
right now only the first three are supported. I have not fully  decided on the "Creating a token" method. For now it will only support creating new tokens, (no balance cloning yet), however the <strong>balance cloning tech</strong> will be built in and will be activated later in a second testnet release when I have ironed out the major bugs, after the first testnet release. 
</p>
<br/><br/>
<p>
In general I can say that <strong>I have done most architectural changes</strong>, and I am now adapting the code details to the new architecture. I heavily use C++ templates now, also modern C++20 features. Sometimes I wish I could use C++23 features, but that would break our compiler toolchain pipeline, and also most people could not compile Warthog on their machines with their own compiler anymore without installing a sufficiently modern compiler (and this is often not as simple as apt install gcc, because system package repositories of popular old Ubuntu LTS might not have such modern packages). So I opted against that to keep everything simple for the user and have it a bit more difficult on my side.</p>
</br>


<h1>CoinFuMasterShifu<h1>