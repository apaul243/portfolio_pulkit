// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/** 
 * @title Vault
 * @dev Acts as a token reserve for another staking contract.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Vault is Ownable {

    IERC20 public immutable rewardToken;    
    address public stakingContract;
    address treasury;

    event stakingContractChanged(address newContract);    
    event treasuryChanged(address newTreasury);    
    event treasuryTransfer(uint amount);    


    /* Reward Token has to be passed during deployement. 
     * Business_decision: Should reward token be immutable ?
     */
    constructor(address _rewardToken) {
        rewardToken = IERC20(_rewardToken);
    }

    /* Function will be called by the staking contract to get supply of reward tokens in the vault.*/
    function getSupply() public view returns (uint) {
        return rewardToken.balanceOf(address(this));
    }

    /* Only owner can change/set the staking contract address. */
    function setStakingContract(address _addr) public onlyOwner {
        stakingContract = _addr;
        emit stakingContractChanged(_addr);
    }

    /* Function will be called by the staking contract to transfer reward tokens to stakers.*/
    function transferStakingTokens(address to, uint _amount) public {
        require(msg.sender != address(0),"staking contract hasn't been set yet");
        require(msg.sender == stakingContract, "only staking contract can call");
        rewardToken.transfer(to, _amount);
    }

    /* Transfer tokens to the treasury*/
    function transferToTreasury(uint _amount) public onlyOwner {
        require(treasury != address(0),"treasury hasn't been set yet");
        rewardToken.transfer(treasury, _amount);
        emit treasuryTransfer(_amount);
    }

    /* Only owner can change/set the treasury address. */
    function setTreasury(address _addr) public onlyOwner {
        require(_addr != address(0),"treasury cannot be address 0");
        treasury = _addr;
        emit treasuryChanged(_addr);
    }

}