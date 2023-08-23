pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BoldToken.sol";
import "./IRouter.sol";
import "./IEquivalence.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/** @title Router contract */
contract Router is Initializable,OwnableUpgradeable, IRouter{
    mapping(address => bool) blackList;
    mapping(address =>bool) allowedcontracts;
    uint256 public treasuryFee;
    address public treasuryToken;
    address public bold;
    address public txFeeWallet;
    address public treasuryWallet;

    address public equivalenceContract; 

   function initialize(uint256 _x, address _equivalence) public initializer {
        treasuryFee = _x;
        equivalenceContract = _equivalence;
    }


    modifier onlyAllowedContracts(){
        require(isAllowedContract(msg.sender),"onlyAllowedContracts: This address is not allowed");
        _;
    } 

    modifier  notBlackListed(address _addr){
         require(!isInBlackList(_addr),"BlackList: Address is blacklisted");
        _;
    }



    function setTreasuryFee(uint256 num) external onlyOwner{
        treasuryFee = num;
    }

    function setPredictionToken(address _addr) external onlyOwner{
        require(_addr!=address(0),"New address cannot be zero");
        bold = _addr;
    }

    function setTreasuryToken(address _addr) external onlyOwner{
        require(_addr!=address(0),"New address cannot be zero");
        treasuryToken = _addr;
    }

    function setTxFeeWallet(address _addr) external onlyOwner{
        require(_addr!=address(0),"New address cannot be zero");
        txFeeWallet = _addr;
    }

    function setTreasuryWallet(address _addr) external onlyOwner{
        require(_addr!=address(0),"New address cannot be zero");
        treasuryWallet = _addr;
    }


    function allowContract(address _contract)  external  onlyOwner{
        allowedcontracts[_contract]=true;
        emit contractAllowed(_contract,true);
    }

    function disAllowContract(address _contract)  external  onlyOwner{
        allowedcontracts[_contract]=false;
        emit contractDisallowed(_contract,false);
    }

    function isAllowedContract(address _contract) public view returns(bool){
        return allowedcontracts[_contract];
    }


    //BLACKLIST OPERATIONS

    /**
        @dev Add a new address to black list
        @notice if address was previosly banned, nothing happens
        @param _banned address to be banned
     */
    function addToBlackList(address _banned)  override external  onlyOwner{
        require(_banned!=address(this),"Router cannot be banned");
        if(!blackList[_banned]){
            blackList[_banned]=true;
            emit blackListEvent(_banned,true);
        }
    }

    /**
        @dev Add a new address to black list
        @notice if address was not previosly banned, nothing happens
        @param _unbanned address to be unbanned
     */
    function removeFromBlackList(address _unbanned)  override external onlyOwner {
        if(blackList[_unbanned]){
            blackList[_unbanned]=false;
            emit blackListEvent(_unbanned,false);
        }
    }

    /**
        @dev Check if address is blacklisted
        @param _address address to check if it is blacklisted
        @return true if address is blackListed
     */
    function isInBlackList(address _address)  override view public returns(bool){
        return blackList[_address];
    }


    // ************************************************
    // PAYMENT OPERTATIONS
    // ************************************************
    
    /*This function is called by Coin Toss P2P and Predictions P2P while placing the bets. It transfers the bet amount in WETH token from 
      User to this router */ 
    
    function payment(address _token, address _from, uint _amount) override external onlyAllowedContracts notBlackListed(_from) returns(uint result){
        IERC20(_token).transferFrom(_from, address(this), _amount);
    }

    /*This function is called by Coin Toss House and Predictions House while placing the bets. It transfers the BOLD token from User to this router 
      contract and burn the ammount*/

    function transferAndBurn(address _token, address _from, uint _amount,uint treasuryfee) override external onlyAllowedContracts notBlackListed(_from) returns(uint result){
        IERC20(_token).transferFrom(_from, address(this), _amount);
        BoldToken(_token).burn(address(this), _amount);
    }

    /*This function is called by the claim() method in Coin Toss P2P and Predictions P2P to sette the bets. It transfers the amount won by the user  
      in WETH token to the user from this router */
      
    function profit(address _token, address _to, uint _amount) override external onlyAllowedContracts notBlackListed(_to) returns(uint result){
        IERC20(_token).transfer( _to, _amount);   
    }
    
    /*This function is called by the claim() method in Coin Toss House and Predictions House to sette the bets. It mints the amount won by the user  
      in BOLD token to the user address */
      
    function mint(address _token, address _to, uint _amount) override external onlyAllowedContracts notBlackListed(_to) returns(uint result){
        BoldToken(_token).mint(_to, _amount);
    } 
    
    /*This function is called by Coin Toss P2P and Predictions P2P contracts. Both these contracts gather commission from the users 
      that are placing the bets in the form of WETH Token. This method transfers 50% each of the total fees collected to two different company 
      wallets: Treasury and TxFee wallet */
    
    function treasuryTransfer(address _token, uint _amount) override external onlyAllowedContracts returns(uint result){
        uint _amountTreasury=_amount*treasuryFee/100;
        IERC20(_token).transfer(txFeeWallet, _amount-_amountTreasury);
        IERC20(_token).transfer(treasuryWallet, _amountTreasury);    
    }
    
    function treasuryHouseTransfer(address _token,uint _amount) override external onlyAllowedContracts returns(uint result){
        uint _amountTreasury=_amount*treasuryFee/100;
        IERC20(_token).transfer(txFeeWallet, _amount-_amountTreasury);
        IERC20(_token).transfer(treasuryWallet, _amountTreasury);
    }
       
    /*This function is called by Coin Toss House and Predictions House. Both these contracts gather commission from the users 
      that are placing the bets in the form of BOLD TOKEN. By Design, this method will burn the commission fees held in BOLD by the router,
      and transfer an equivalent amount of WETH to the company treasury. The BOLD-WETH ratio is calculated by the equivalence formula, that 
      is not fixed and is routinely changed */

    function tokenToWeth(address _token, address _to, uint _amount) override external onlyAllowedContracts notBlackListed(_to)  returns(uint result){
        BoldToken(_token).burn(address(this), _amount);        
        uint _amt = calculateEquivalenceFromBold(_token,_to,_amount);
        IERC20(treasuryToken).transfer(treasuryWallet, _amt);
    }
    
     /*This function is called by Coin Toss P2P and Predictions P2P contracts. Whenever user places bet using these contracts using WETH token,
       it is minted a certain amount of BOLD token as a bonus */
    
    function bonusPayment(address _token, address _to, uint _amount) override external onlyAllowedContracts notBlackListed(_to)  returns(uint result){
        uint _amt = calculateEquivalenceToBold(_token,_to,_amount);
        BoldToken(bold).mint(_to, _amt);
    }   



    // ************************************************
    // EMIT CENTRALIZED EVENTS
    // ************************************************
    /**
        @dev emit an event on behalf of other contract
        @param _type type of event
        @param _caller contract which emits event
        @param _sender User address which has bet or claim
        @param _epoch round in which the event has been emitted
        @param _amount amount of token transfered

     */
    function emitEvent(uint _type, address _caller, address _sender, uint256 _epoch, uint _amount) override external onlyAllowedContracts {
        emit betEvent(_type,_caller,_sender,_epoch,_amount,block.timestamp);
    }

    // ************************************************
    // EQUIVALENCE FUNCTIONALITY
    // ************************************************
    /**
        @dev calculate equivalence in BOLD token
        @param _token token to convert
        @param _user  user request the equivalence
        @param _amount Amout to convert
        @return amount in Bold
     */
    function calculateEquivalenceToBold(address _token, address _user, uint _amount) public  override view returns(uint){
        return IEquivalence(equivalenceContract).calculateToBold(_token, _user, _amount);
    }

    /**
        @dev calculate equivalence of BOLD in token
        @param _token token to convert
        @param _user  user request the equivalence
        @param _amount Amout to convert
        @return amount in token
     */
    function calculateEquivalenceFromBold(address _token, address _user, uint _amount) public  override view returns(uint){
        return IEquivalence(equivalenceContract).calculateFromBold(_token, _user, _amount);
    }

    /**
        @dev Change token equivalence contract
        @param newEquivalence new Equivalence contract
     */
    function changeEquivalence(address newEquivalence) public onlyOwner{
        equivalenceContract=newEquivalence;
    }
 
}
