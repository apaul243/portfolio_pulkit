// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/StdCheats.sol";

import "../contracts/Vault.sol";
import "../contracts/TestToken.sol";
import "./TokenTest.sol";

contract VaultTest is Test {
    TestToken public token;
    Vault public vault;
    TokenTest public tokentest;
    address owner = makeAddr("owner");
    address john = makeAddr("john");
    address staking = makeAddr("staking");
    address treasury = makeAddr("treasury");

    function setUp() public {
        vm.startPrank(owner);
        token = new TestToken(); // Deploy token and vault contracts
        vault = new Vault(address(token));
        token.mint(address(vault), 10000*10**18);
        vm.stopPrank();
    }

    /* This function will be called by staking contract and returns the supply of reward tokens */
    function test_checkGetSupply() public {
        assertEq(vault.getSupply(), 10000*10**18);
    }

    /* Checking if only owner can set/change the staking contract */
    function test_setStakingContract() public {
        vm.prank(john);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));        
        vault.setStakingContract(staking);
        vm.prank(owner);
        vault.setStakingContract(staking);
        address stakingAddress = vault.stakingContract(); 
        assertEq(stakingAddress, staking);
    }

    /* Checking  a) if only owner can set/change the treasury address
     *           b) if reward tokens are transferred to the treasury
     */
    function test_treasuryFunctionality() public {
        vm.prank(john);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));        
        vault.setTreasury(treasury);
        vm.startPrank(owner);
        vault.setTreasury(treasury);
        vault.transferToTreasury(100*10**18);
        assertEq(token.balanceOf(treasury), 100*10**18);
        vm.stopPrank();
    }

}
