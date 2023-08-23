## Securrency Staking Contract

### Brief Overview

This is a staking smart contract with features such as fixed apr, dynamic apr, autocompounding etc. It allows
users to stake a certain ERC-20 token and earn rewards in the same or different ERC-20 token, on an APR basis.Staking contract uses a Vault contract to store the tokens. It uses two rate calculations, one is a fixed rate and the other is a dynamic rate.

Dynamic APR : Dynamic APR, at any point is calculated using two things, total deposits in the staking contract and total rewards in the vault. The formula used for this calculation is roughly :

            Dynamic APR =   totalRewardsInVault*multiplier/totalDeposits

Note : When deposits > rewards, the equation can return 0 and that is why we use a multiplier.  

Fixed APR: Fixed APR assures a fixed return irrespective of the total deposits or total rewards, so the formula for this kind of calculation is roughly : 
             
             Fixed APR :  UserDeposit*FixedRate

The smart contract is very well-documented and contains explanation of all methods, calculations, business logic etc.

### Autocompounding feature

There is multiple ways to implement this feature. In this implementation, compounding can be done when user
a) calls Stake b) calls Unstake c) calls compound(). There is another way to perform autocompounding, but it is a little more complicated and that is by using the formula: 

```shell
S= P(1 + R)^n , where p = priniciple, n = no of compunding periods, R = Rate of interest 
```
Here, we have to specify the autcompounding period after which the rewards will be compounded i.e 1 week, 1 month etc. In solidity, we could do something like: 

```shell
uint stake = deposits[user];
int total;
 for (i=0;i<compoundingPeriods;i++) {
		  int rewards = calculateRewards(stake);
          total = stake + rewards;
		  stake = total;
 }
```



### Scripts

Deploy.js : Deploy the token, vault and staking contracts \
UpgradeStaking.js : Upgrades to a new staking contract using the proxy

### Tests

Tests have been written for all three contracts using Foundry. Overall the tests are very 
comprehensive and they cover a lot of different scenarios for staking like:

1. Staking with fixed rate and variable rate
2. Staking with autocompounding
3. Switching between fixed and variable rate 
4. exit pool and compound methods
5. Multiple claims, multiple deposits, claim rewards etc.

The tests are very well documented and will give a good understanding of the staking contract.
