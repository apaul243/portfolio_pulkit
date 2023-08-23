pragma solidity ^0.8.4;



/** @title Equivalence Interface */
interface IEquivalence {
    function calculateToBold(address _token, address _to,uint _amount) external view returns(uint) ;
    function calculateFromBold(address _token, address _to,uint _amount) external view returns(uint) ;
}
