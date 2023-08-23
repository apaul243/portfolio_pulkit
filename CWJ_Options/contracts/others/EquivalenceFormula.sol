pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IEquivalence.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/** @title Equvalence contract: Calculates equivalence between a token and BOLD */
contract EquivalenceFormula is Initializable,OwnableUpgradeable, IEquivalence{

    // RATIO with 3 decimals. 1000000 equals to multiply by 1000
    uint public priceRatio;
    // RATIO with 3 decimals. 1000000 equals to multiply by 1000
    uint public ratio;
    // Decimals used 
    uint public decimals;

    uint public kink1;
    uint public A1;
    uint public C1;
    uint public kink2;
    uint public A2;
    uint public C2;

    function initialize(uint _priceRatio,
        uint _ratio,
        uint _decimals,
        uint _kink1,
        uint _A1,
        uint _C1,
         uint _kink2,
        uint _A2,
        uint _C2) public initializer {
            priceRatio=_priceRatio;
            ratio=_ratio;
            decimals=_decimals;
            kink1=_kink1;
            A1=_A1;
            C1=_C1;
            kink2=_kink2;
            A2=_A2;
            C2=_C2;
        }



    /**
     * @notice Set Price conversion ratio from weth to USD
     * @param _value Ratio used to transform a Token to BOLD
     */
    function setPriceRatio(uint _value) public onlyOwner{
        priceRatio=_value;
    }


     /**
     * @notice Set conversion ratio
     * @param _value Ratio used to transform a Token to BOLD
     */
    function setRatio(uint _value) public onlyOwner{
        ratio=_value;
    }

     /**
     * @notice Set decimals for parameters kink1, kink2, A1, A2, C1, C2
     * @param _value Ratio used to transform a Token to BOLD
     */
    function setDecimals(uint _value) public onlyOwner{
        decimals=_value;
    }

    function setKink1(uint _value) public onlyOwner{
	    kink1=_value;
    }

    function setKink2(uint _value) public onlyOwner{
	    kink2=_value;
    }

    function setA1(uint _value) public onlyOwner{
	    A1=_value;
    }

    function setA2(uint _value) public onlyOwner{
	    A2=_value;
    }

    function setC1(uint _value) public onlyOwner{
	    C1=_value;
    }

    function setC2(uint _value) public onlyOwner{
	    C2=_value;
    }



    function F0(uint amount, uint ratio) public view returns (uint){
        // console.log("F0(%i)",(amount));
        return amount*ratio/(10**decimals);
    }

    function F1(uint amount, uint ratio, uint A, uint C) public view returns (uint){
        // console.log("F1 - amount",(amount));
        // console.log("F1 - ratio",(ratio));
        // console.log("F1 - A",(A));
        // console.log("F1 - C",(C));
        uint item1=(amount*ratio*A)/((10**decimals)**2);
        uint item2=item1+(C*10**18/10**3);
        return item2;
    }
    
    /**
     * @notice Carries out the calculations
     * @param _token address of the toke. Currently not used but allows to have different formulas for each token type
     * @param _to User that executes the transaction. Currently not used but allow to have different formulas for each used
     * @param _amount Amount to be transformed in the amount equivalent in BOLD
     * @return amount in bold
     */
    function calculateToBold(address _token, address _to,uint _amount) external override view  returns(uint){
        // console.log(">>>> Amount /t", _amount);
        // console.log(">>>> kink2: /t",kink2);
       uint convertedAmount=_amount*(10**decimals)/priceRatio;

       if(convertedAmount <= kink1){
        //console.log(">>>> 1 ");
           return F0(convertedAmount,ratio);
       }else if(convertedAmount < kink2){
           //console.log(">>>> 2 ");
           return F1(convertedAmount,ratio,A1,C1);
       }else{
           //console.log(">>>> 3 ");
           return F1(convertedAmount,ratio,A2,C2);
       }
                
    }

     /**
     * @notice Carries out the calculations
     * @param _token address of the token. Currently not used but allows to have different formulas for each token type
     * @param _to User that executes the transaction. Currently not used but allow to have different formulas for each used
     * @param _amount Amount to be transformed in the amount equivalent in _token
     * @return amount in bold
     */
    function calculateFromBold(address _token, address _to,uint _amount) external override view  returns(uint){
        return _amount;
    }

   

}