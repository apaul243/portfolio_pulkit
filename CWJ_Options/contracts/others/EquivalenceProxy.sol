pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IEquivalence.sol";


/** @title Equvalence contract: Calculates equivalence between a token and BOLD */
contract Equivalence is Ownable, IEquivalence{

    // RATIO with 3 decimals. 1000000 equals to multiply by 1000
    uint public ratio=1000000;
    // Decimals used 
    uint public decimals=3;

    /**
     * @notice Constructor
     * @param _ratio Ratio used to transform a Token to BOLD
     */
    constructor(uint _ratio){
        ratio=_ratio;
    }

    
    /**
     * @notice Carries out the calculations
     * @param _token address of the toke. Currently not used but allows to have different formulas for each token type
     * @param _to User that executes the transaction. Currently not used but allow to have different formulas for each used
     * @param _amount Amount to be transformed in the amount equivalent in BOLD
     * @return amount in bold
     */
    function calculateToBold(address _token, address _to,uint _amount) external override view  returns(uint){
        //Safemath is included on solidity 0.8 by default
        uint denominator=10**decimals;
        uint _equivalence=(_amount*ratio)/denominator;
        return _equivalence;
    }

     /**
     * @notice Carries out the calculations
     * @param _token address of the token. Currently not used but allows to have different formulas for each token type
     * @param _to User that executes the transaction. Currently not used but allow to have different formulas for each used
     * @param _amount Amount to be transformed in the amount equivalent in _token
     * @return amount in bold
     */
    function calculateFromBold(address _token, address _to,uint _amount) external override view  returns(uint){
        //Safemath is included on solidity 0.8 by default
        uint denominator=10**decimals;
        uint _equivalence=_amount*denominator/(ratio);
        return _equivalence;
    }

    /**
     * @notice Set conversion ratio
     * @param newRatio Ratio used to transform a Token to BOLD
     */
    function setRatio(uint newRatio) public onlyOwner{
        ratio=newRatio;
    }

}