// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BoldToken.sol";
import "hardhat/console.sol";
import "./interface/IUniswapV2Pair.sol";

/* 
OF Staking contract allows users to stake one token and receive the same or another token as reward.
It stores user info in an address to struct mapping, where each address is mapped to a struct object that 
has the following details: Amount and time of user deposit, interest gathered on deposits. 
*/

contract LPStaking {

    address public pair;
    BoldToken public bold; // reward token address
    IERC20 public token;   // staking token address
    uint256 public rate;          // amount of reward token per 10000 of staking token 
    uint256 public minStakeAmount;// minimum amount that can be staked in wei 
    address public owner;
    uint constant public SECSINDAY=60*60*24;

    event changeOwnership(address indexed previousOwner, address indexed newOwner,uint timestamp);
    event newRate(uint  proviousRate, uint  newRate,uint timestamp);
    event enterAmount(uint256  previousBalance, uint256  newBalance,uint256 interestAccumulated, uint timestamp);
    event retireAmount(uint256  previousBalance, uint256  newBalance,uint256 interestAccumulated, uint timestamp);

    struct UserInfo {
        uint256 balance;        
        uint256 timestamp;
        uint256 interestAccumulated;
    }

    mapping(address => UserInfo) public users;

    constructor(address _token, address _bold, uint256 _rate, uint256 _minAmount,address _pair) public {
        owner = msg.sender;
        bold = BoldToken(_bold);
        token = IERC20(_token);
        rate = _rate;
        minStakeAmount= _minAmount;
        pair = _pair;
    }

    modifier onlyOwner(){
        require(msg.sender==owner,"STAKING - NOT OWNER");
        _;
    } 

    
    /*  This function allows the user to stake certain amount of staking token in the contract. User first 
    needs to give allowance to the contract to transfer the tokens and then call enter(). It will check whether
    if user already has some stake in the contract, it will calculate the interest accumulated till now 
    and store it in "interestAccumulated" of struct, and update the timestamp to latest. Finally, contract will update 
    the user balance to reflect the recent  */
    function enter(uint256 _amount) public {
        uint256 previousBalance=0;
        require(_amount >= minStakeAmount,"Stake amount should be greater than minimum stake amount");
        UserInfo storage user = users[msg.sender];
        if(user.balance >0){
            previousBalance=user.balance;
            uint256 interestAccumulated = _calculateInterest(msg.sender, user.balance);
            user.interestAccumulated = user.interestAccumulated + interestAccumulated ;
        }
        user.balance = user.balance + _amount;
        user.timestamp = block.timestamp;
        token.transferFrom(msg.sender, address(this), _amount);
        emit enterAmount(previousBalance, user.balance, user.interestAccumulated,user.timestamp);
    }

    /* Allows user to withdraw part or the complete stake. In either case, he will be transferred the desired
       amount of staking token and minted ALL of the interest gathered till now in form of reward token */

    function leave(uint256 share) public returns(uint) {
        UserInfo storage user = users[msg.sender];
        require(user.balance >= share,"Share cannot be more than current deposits");
        require(share >= minStakeAmount,"Withdraw amount should be more than the minimum req amount");
        uint256 amt1 = IUniswapV2Pair(pair).totalSupply();
        (uint256 amt2,uint256 amt5,) = IUniswapV2Pair(pair).getReserves();
        uint256 amt3 = (share*amt5)/amt1;        
        uint256 interestCalculated = _calculateInterest(msg.sender,amt3);
        user.interestAccumulated = 0;
        uint previousBalance=user.balance;
        user.balance= user.balance - share;
        user.timestamp = block.timestamp;
        token.transfer(msg.sender,share);

        bold.mint(msg.sender,interestCalculated);
        emit retireAmount(previousBalance, user.balance, interestCalculated,user.timestamp);
        return interestCalculated;
    }

    /* User can cashout all his rewards till this point as the contract will mint reward token*/
    function cashoutAllRewards() public returns (uint) {
        UserInfo storage user = users[msg.sender];
        require(user.balance > 0,"User has no deposits");
        uint256 amt1 = IUniswapV2Pair(pair).totalSupply();
        (uint256 amt2,uint256 amt5,) = IUniswapV2Pair(pair).getReserves();
        uint256 amt3 = (user.balance*amt5)/amt1;          
        uint256 interestCalculated = _calculateInterest(msg.sender,amt3);
        user.interestAccumulated = 0;
        user.timestamp = block.timestamp;
        bold.mint(msg.sender,interestCalculated);
        emit retireAmount(user.balance, user.balance, interestCalculated,user.timestamp);

        return interestCalculated;
    }

    /* Internal method used to calculate rewards gained for a particual user and given amount. It first 
       checks how many days have elapsed since the stake was deposited, then uses the simple interest formula
       and returns the result */
    function _calculateInterest(address _addr, uint256 share) internal view returns(uint) {
        UserInfo storage user = users[_addr];
        uint256 daysElapsed = (block.timestamp - user.timestamp)/SECSINDAY;
        // prinicpal * (no of days / 365) * (rate/10000) , 20% return ==> rate = 2000
        uint256 interestCalculated = (share*daysElapsed*rate)/(3650000); 
        uint256 totalInterest = user.interestAccumulated + interestCalculated;
        return totalInterest;
    }

    /* Returns the current stake amount and the reward amount gathered till now */
    function getCurrentCashout(address sender) public view returns (uint _deposit,uint _CurrentInterest) {
        uint256 deposit = users[sender].balance;
        uint256 currentInterest = _calculateInterest(sender,deposit);
        return (deposit,currentInterest);
    }

    function changeOwner(address _owner) external onlyOwner{
        address previous=owner;
        owner = _owner;
        emit changeOwnership(previous, _owner, block.timestamp);
    } 

    function changeRate(uint256 _rate) external onlyOwner{
        uint256 previous=rate;
        rate = _rate;
        emit newRate(previous, _rate, block.timestamp);
    } 

}
