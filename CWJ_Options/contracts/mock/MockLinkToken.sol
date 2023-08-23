pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SimpleToken
 * @dev Very simple ERC20 Token mock, where all tokens are pre-assigned to the deployer.
 * Note they can later distribute these tokens as they wish using `transfer` and other standatd fuctions
 */
contract MockLinkToken is ERC20 {
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() ERC20("MOCK LINK TOKEN", "MOCKLINK") {
        _mint(msg.sender, 100000000000000000000000000);
    }

    address public rto;
    uint public rvalue; 
    bytes public rdata;

    function transferAndCall(address to, uint value, bytes calldata data) external returns (bool success){
        rto=to;
        rvalue=value;
        rdata=data;
    }

    //HELPER FUNCTION

    function getBlockInfo() public view returns(
       bytes32 blockHash,
        uint chainID,
        address coinbase,
        uint gaslimit,
        uint blockNumber,
        uint blockTimestamp
    ){
        return(
            blockhash(block.number),
                block.chainid,
                block.coinbase,
                block.gaslimit,
                block.number,
                block.timestamp
        );
    }
    
}