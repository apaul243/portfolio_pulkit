// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./BoldToken.sol";



contract OFPreSales is Ownable,ReentrancyGuard,Pausable {

    using SafeERC20 for IERC20;
    address public treasury;
    address public token;
    address public bold;

    struct User{
      uint256 limit;
      uint256 releaseTime;
      uint256 deposit;
      uint256 payout;
      uint256 locktime;
    }

    mapping(address => User) users;

    event saleIssued(address indexed _buyer, uint256 _amount, uint256 _payout, uint256 _time);
    event depositMade(address indexed _user,  uint256 _amount,uint256 indexed _time);
    event Withdrawn(address indexed _user,  uint256 _amount);


    constructor(
        address _treasury,
        address _token,
        address _bold     
    ){
        treasury = _treasury;
        token = _token;
        bold = _bold;
    }

    function issueSale(address buyer, uint256 amount, uint256 payout, uint256 time) external onlyOwner {
        User storage user = users[buyer];
        user.limit = amount;
        user.payout = payout;
        user.locktime = time;

        emit saleIssued(buyer,amount,payout,time);
    }    
 
    function deposit() external nonReentrant{
        User storage user = users[msg.sender];
        uint256 amount = user.limit;
        require(amount > 0, "User is not allowed");
        require(IERC20(token).balanceOf(msg.sender)>=amount,"User has not enought funds");
        IERC20(token).transferFrom(msg.sender, treasury, amount);
        user.deposit = amount;
        user.limit =  0;
        user.releaseTime = block.timestamp + user.locktime;

        emit depositMade(msg.sender,amount,block.timestamp);
    }

    function withdraw() external nonReentrant whenNotPaused{
         User storage user = users[msg.sender]; 
         require(user.deposit >0, "User does not have any deposits");
         require(block.timestamp > user.releaseTime , "Time lock period has not expired");
         user.deposit = 0; 
         user.releaseTime = 0;
         user.locktime = 0;
         uint256 amt =  user.payout;
         user.payout = 0;
         BoldToken(bold).mint(msg.sender,amt);
         emit Withdrawn(msg.sender,amt);
    }   

    function getUserData(address _user) public view returns (uint256 _deposit, uint256 _payout , uint256 _time ){
        User storage user = users[_user];
        return (user.deposit, user.payout,user.releaseTime);
    } 

    function setTreasury(address _treasury) external onlyOwner{
        require(_treasury!=address(0),"New address cannot be zero");
        treasury = _treasury;
    }

    function setToken(address _token) external onlyOwner{
        require(_token!=address(0),"New address cannot be zero");
        token = _token;
    }

    function setBold(address _bold) external onlyOwner{
        require(_bold!=address(0),"New address cannot be zero");
        bold = _bold;
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

}
