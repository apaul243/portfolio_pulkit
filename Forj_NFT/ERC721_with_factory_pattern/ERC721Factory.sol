// SPDX-License-Identifier: UNLICENSE
pragma solidity >=0.8.0;

import './ERC721WhitelistCommitReveal.sol';

contract ERC721Factory{
    ERC721WhitelistCommitReveal private template;

    event Created(address addr);

    constructor(){
        template = new ERC721WhitelistCommitReveal();
    }

    function cloneNewNFT(
        address _multisig,
        address _token,
        string memory URI,
        string memory _name,
        string memory _symbol,
        uint256 _fees,
        uint256 _maxSupply,
        uint256 _limitPerAddress,
        uint256[] memory starts,
        uint256[] memory ends,
        bytes32[] memory merkleRoots
        ) external {
        address payable clone = createClone(address(template));
        ERC721WhitelistCommitReveal(clone).initialise(_multisig,_token, URI, _name, _symbol,_fees,_maxSupply,
        _limitPerAddress,starts,ends,merkleRoots);
        emit Created(clone);
    }

    function createClone(address target) internal returns (address payable result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x37)
        }
    }
}