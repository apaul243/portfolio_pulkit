pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SimpleToken
 * @dev Very simple ERC20 Token mock, where all tokens are pre-assigned to the deployer.
 * Note they can later distribute these tokens as they wish using `transfer` and other standatd fuctions
 */
contract SpoxToken is ERC20 {
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() ERC20("SPOX TOKEN", "SPX") {
        _mint(msg.sender, 100000000000000000000000000);
    }
}