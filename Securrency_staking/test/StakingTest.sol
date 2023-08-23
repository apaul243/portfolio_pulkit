// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";

import "../contracts/Staking.sol";
import "../contracts/Vault.sol";
import "../contracts/TestToken.sol";

contract StakingTest is Test {
    TestToken public token;
    Vault public vault;
    Staking public staking;
    address owner = makeAddr("owner");
    address john = makeAddr("john");
    address kelly = makeAddr("kelly");


    function setUp() public {
        vm.startPrank(owner);
        /* Deploy Token, Vault and staking contracts */
        token = new TestToken();
        vault = new Vault(address(token));
        staking = new Staking(address(token), address(token),address(vault),true,false);
        /* Set staking contract in the vault contract */
        vault.setStakingContract(address(staking));
        /* Mint 100 tokens to john and kelly.
         * Mint 31536000 token to the vault, resulting in 1 token per sec reward.
         */
        token.mint(john, 100*10**18);
        token.mint(kelly, 100*10**18);
        token.mint(address(vault), 31536000*10**18);
        vm.stopPrank();
        /*Giving necesarry allowanes */
        vm.prank(john);
        token.approve(address(staking),100*10**18);
        vm.prank(kelly);
        token.approve(address(staking),100*10**18); 
    }

    /* Testing   a) If a single user can stake into the contract.
     *           b) totalDeposits and deposits[user] are updated correctly.
     */
    function test_stakeByJohn() public {
        vm.prank(john);
        staking.stake(25*10**18); // stake 25 test tokens
        uint totaldeposts = staking.totalDeposits();
        assertEq(totaldeposts, 25*10**18); // total deposits in contract should be 25 tokens
        uint deposit = staking.deposits(john);
        assertEq(deposit, 25*10**18);
        uint johnBalance = token.balanceOf(john);// John's balance should be 75 tokens ( 100-25)
        assertEq(johnBalance, 75*10**18);        
    }

    /* Testing   a) If multiple users can stake into the contract.
     *           b) totalDeposits, deposits[john],deposits[kelly] are updated correctly.
     */
    function test_stakeByJohnAndKelly() public {
        test_stakeByJohn();
        vm.prank(kelly);
        staking.stake(75*10**18); // stake 75 test tokens
        uint totaldeposts = staking.totalDeposits();
        assertEq(totaldeposts, 100*10**18); // total deposits in contract should be 100 tokens
        uint deposit = staking.deposits(kelly);
        assertEq(deposit, 75*10**18);
    }

    /* Testing   a) Only single user staked in the contract with 100% pool share
     *           b) Calls claim() and should get 100% of the rewards (rewardRate*deposits[user]*TimeElapsed)
     */
    function test_onlyJohnInPool_johnClaims() public {
        test_stakeByJohn();
        vm.warp(block.timestamp + 10); // advancing by 10 secs, t = 10 sec
        vm.prank(john);
        uint rewards = staking.claim(); // john staked 25 tokens for 10 secs, 100% of the pool
        assertEq(rewards, 10*10**18); // at 1 token per sec, he should get 10 token rewards
        uint johnBalance = token.balanceOf(john);// John's balance should be 85 tokens now ( 75 + 10)
        assertEq(johnBalance, 85*10**18);
    }

    /* Testing   a) Multiple users staked in the contract. John has 25% share of the pool
     *           b) John Calls claim() and should get 25% of the rewards 
     *              (rewardRate*deposits[user]*TimeElapsed/totalDeposits)
     *           c) Test is to make sure that rewards are distributed proportionally 
     */
    function test_johnAndKellyInPool_johnClaims() public {
        test_stakeByJohnAndKelly();
        vm.warp(block.timestamp + 10); 
        vm.prank(john);
        uint rewards = staking.claim(); // john staked 25 tokens for 10 secs, 25% of the pool ( 75 staked by kelly)
        assertEq(rewards, 25*10**17); // at 1 token per sec, he should get 2.5 token rewards
        uint johnBalance = token.balanceOf(john);// John's balance should be 77.5 tokens now ( 75 + 2.5)
        assertEq(johnBalance, 775*10**17);
    }

    /* Testing   a) John adds 25 tks more to his stake at t= 10
     *           b) Dynamic APR should be adjusted accordingly 
     *           c) Rewards Accumulated for John should be calculated and added to rewardsEarned[John]
     *           d) userCumulativeRewardRate[John] should be updated as well
     */
    function test_johnAndKellyInPool_johnStakesMore() public {
        test_stakeByJohnAndKelly();
        vm.warp(block.timestamp + 10); 
        vm.prank(john);
        uint amount = 25*10**18;
        staking.stake(amount); // john staked 25 more tokens, total stake 50 tokens , 40% of the pool
        uint rewardsEarned = staking.rewardsEarned(john); // accumulated rewards will be added to rewardsEarned for John
        assertEq(rewardsEarned, 25*10**17); 
        uint johnBalance = staking.deposits(john);// John's total deposits should be 50 tokens now
        assertEq(johnBalance, 50*10**18);
        vm.warp(block.timestamp + 10);        
    }

    /* Testing   a) Same as last scenario, but with autocompounding on.
     *           b) Rewards will be added back to prinicpal. deposits[John] = deposits[John] + rewardsEarned
     *           c) rewardsEarned[John] = 0
     *           d) unlike last scenario, totalDeposits should also be incremented.  
     */
    function test_johnAndKellyInPool_johnStakesMore_withAutocompounding() public {
        test_stakeByJohnAndKelly();
        vm.prank(owner);  
        staking.changeCompoundingMode();      
        vm.warp(block.timestamp + 10); 
        vm.prank(john);
        uint amount = 25*10**18;
        staking.stake(amount); // john staked 25 more tokens, total stake 50 tokens , 40% of the pool
        uint rewardsEarned = staking.rewardsEarned(john); 
        assertEq(rewardsEarned, 0); // rewardsEarned will be 0 now and will be added to principal
        uint johnBalance = staking.deposits(john);
        assertEq(johnBalance, 525*10**17);// 25 ( initial deposit) + 25 (new stake) + 2.5 (rewards) = 52.5
    }

    /* Testing   a) At t= 20, John unstakes part of his stake.
     *           b) Making sure if rewards are calculated correctly, since APR has been different
     *              for different time periods.
     *           c) John's ERC20 balance to make sure he received the rewards.
     */
    function test_johnAndKellyInPool_johnUnstakes() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL : John(50),Kelly(75), t= 20 sec
        vm.prank(john);
        staking.unstake(25*10**18); // john unstakes 25 tks, 
        uint rewardsEarned = staking.rewardsEarned(john); // accumulated rewards will be added to rewardsEarned for John
        assertEq(rewardsEarned, 65*10**17); // Rewards earned : 4 tks + 2.5 tks (from earlier)
        uint johnBalance = staking.deposits(john);// CURRENT POOL : John (25 tks), Kelly (75 tks )
        assertEq(johnBalance, 25*10**18);
    }


    /* This and next test is very important, since they will test the core logic of 
     * the algorithim. In this test, Kelly claims his rewards. Kelly's stake has remained same,
     * but his share of the pool has changed.
     * 0 - 10 seconds ---> Kelly has 75% of the pool ---> Rewards = 7.5 tokens
     * 10 - 20 seconds ---> Kelly has 60% of the pool ---> Rewards = 6 tokens
     * Total expected Rewards : 13.5 tks
     */
    function test_KellyClaims() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL : John(50),Kelly(75), t= 20 sec
        vm.prank(kelly);// kelly claims
        uint rewards = staking.claim(); 
        assertEq(rewards, 135*10**17); 
        uint kellyBalance = token.balanceOf(kelly);
        assertEq(kellyBalance, 385*10**17);// Kelly's ERC20 Balance: 25 + 13.5 tks
    }


    /* TRICKY PART : Changing rate midway from Dynamic to fixed APR and see if the algorithim holds. 
     * Let's take fixed APR = 31536000*5*10**16, roughly around 0.05 tks reward per sec per staking token
     * Kelly's rewards (t =30 secs) => 13.5 tks ( 0 -20 secs) + 0.05*10*75 (20-30 secs) = 51 tks  
     */
    function test_changeFromDynamicToStatic_thenKellyClaims() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL : John(50),Kelly(75), t= 20 sec
        vm.prank(owner);
    // will update cumulativeRewardRate up till this point using the dynamic APY calcuation      
        staking.changeToFixedRate(31536000*5*10**16); 
        vm.warp(block.timestamp + 10); // advance by 10 secs more, t= 30
        vm.prank(kelly);
        uint rewards = staking.claim(); 
        assertEq(rewards, 51*10**18); 
    }

    /* Kelly claim rewards at t = 20 secs and John claims at t = 30 secs. This should affect
     * the supply in the vault. This time cumulativeRewardRate will change not only because of 
     * totalDeposits, but also because of the vaultSupply.
     */
    function test_bothJohnAndKellyClaim() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL: John(50),Kelly(75), t= 20 sec
        uint vaultSupplyBefore = vault.getSupply(); // Vault supply before Kelly claims 
        vm.prank(kelly);// kelly claims
        uint kellyRewards = staking.claim(); 
        assertEq(kellyRewards, 135*10**17);
        uint vaultSupply = vaultSupplyBefore - kellyRewards;// Vault supply after Kelly claims
        uint vaultSupplyAfter = vault.getSupply(); // vault balance = 31535986.5 tks
        assertEq(vaultSupply, vaultSupplyAfter);
        vm.warp(block.timestamp + 10); // advance by 10 secs, t= 20
        vm.prank(john);// john claims
        uint johnRewards = staking.claim();
        //rewards are little less than 10.5 tks since vaultTokens decreased
        assertEq(johnRewards, 10499998287671232850);   
 }

    /* Testing compound feature */
    function test_compoundMethod() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL : John(50),Kelly(75), t= 20 sec
        vm.prank(owner);  
        staking.changeCompoundingMode();        
        vm.prank(kelly);// kelly claims
        staking.compound(); 
        assertEq(staking.rewardsEarned(kelly), 0); // rewardsEarned set to 0
        assertEq(staking.deposits(kelly), 885*10**17);// rewards added to Kelly's principal (75 + 13.5 tks)
    }

    /* Testing exit pool feature i.e withdraw all stake and all rewards */
    function test_exitPool() public {
        test_johnAndKellyInPool_johnStakesMore();//CURRENT_POOL : John(50),Kelly(75), t= 20 sec       
        vm.prank(kelly);// kelly claims
        staking.exitPool(); 
        assertEq(staking.rewardsEarned(kelly), 0); // rewards are set to 0
        assertEq(staking.deposits(kelly), 0);// deposits are set to 0
        assertEq(token.balanceOf(kelly), 1135*10**17);// kelly's balance should be 100 tks + 13.5 reward tokens
    }

}
