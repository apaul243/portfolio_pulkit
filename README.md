## Smart Contract Portfolio

This repository contains some of my more advanced solidity work. Tests have also been attached to gain more understanding about the logic and use cases. Some noteworthy contracts:

1. Crypto options: CWJ_Options/contracts/OFPrediction.sol
2. Dynamic staking : Securrency_defi_dynamic_staking/contracts/Staking.sol
3. Compliance aware framework: Securrency_assetcomposer/rules-engine
4. ERC1155 self-minter with tiering and whitelisting: Forj_NFT/contracts/ERC1155SelfMinter.sol
5. Trustless NFT Swapping: Forj_NFT/contracts/NFTSwap.sol


### CWJ Capital

OF PREDICTIONS CONTRACT
https://polygonscan.com/address/0x88cBB7fae3d8a5A472591dDfb0370C7De81EE52D#code
OF COIN TOSS CONTRACT
https://polygonscan.com/address/0x56155A6B998085eB08921A03E28b55e9dadc985D
ROUTER CONTRACT
https://polygonscan.com/address/0xb5b5d8d49f53d9aa50f8c880e138bcfd797ce245#code


### Securrency

Compliance aware tokenization framework consisting of 150+ SC's. Just to give a high-level overview of the framework, it consists of three layers:

Asset Composer: Issues assets such as stocks or stablecoins
Rules Engine: Create rules that are applied to assets. For ex: rule can be "US CITZEN", "ACCREDITED INVESTOR"
Compliance Oracle: Each rule is connected to an compliance oracle, which verifies if for a given user, the rule is fullfiled or not.

I have attached rules-engine, one of the modules that I worked upon as part of this project


### Forj

Developed different ERC1155s and 721s, that were used across different forj nft collections. Also developed a trustless nft swapping sc,that allow users to swap across forj collections / same collection, diff token id


