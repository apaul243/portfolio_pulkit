// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./mockERC1155.sol";

contract NFTSwap is ReentrancyGuard, Ownable, ERC1155Holder {

    mapping(address => bool) whitelistedContracts;
    mapping(address => bool) public isAdmin;
    mapping(uint256 => swapPair) public pairs;
    mapping(address => uint256) public addrToPairID;
    address minterContract;
    mockERC1155 mock1155;
    uint256 public count;
    bool isPaused; 

    struct swapPair {
        address source;
        uint256 count;
        uint256 targetTokenID;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }

    modifier onlyAdminOrOwner(address _address) {
        require(
            isAdmin[_address] || _address == owner(),
            "This address is not allowed"
        );
        _;
    }

    event contractWhitelisted(address _addr);
    event contractRemovedFromWhitelist(address _addr);
    event swapPairCreated(address source,uint256 cnt, uint256 tknid,uint256 pairno);
    event swapPerformed(uint256 pairID, address user);

    function setContractAdmin(address _address) public onlyOwner {
        isAdmin[_address] = true;
    }

    function deleteContractAdmin(address _address) public onlyOwner {
        isAdmin[_address] = false;
    }

    function addToWhitelist(address _contract) public onlyAdminOrOwner(msg.sender) {
        whitelistedContracts[_contract] = true;
        emit contractWhitelisted(_contract);
    }  

    function removeFromWhitelist(address _contract) public onlyAdminOrOwner(msg.sender) {
        whitelistedContracts[_contract] = false;
        emit contractRemovedFromWhitelist(_contract);
    } 

    function setMinterContract(address _contract) public onlyAdminOrOwner(msg.sender) {
        minterContract = _contract;
    }

    function createSwapPair(address source,uint256 _count,uint _tokenId) public onlyAdminOrOwner(msg.sender) {
        require(whitelistedContracts[source] == true,"contract is not whitelisted");
        swapPair memory pair = swapPair(source,_count,_tokenId,0,0,true);
        pairs[count] = pair;
        addrToPairID[source] = count;
        count++;
        emit swapPairCreated(source, _count, _tokenId, count-1);
    } 
    
    function setPairDuration(uint256 id,uint256 start, uint256 end) public onlyAdminOrOwner(msg.sender) {
        require(id < count,"pair doesn't exist");
        swapPair memory pair = pairs[id];
        pair.startTime = start;
        pair.endTime = end;
        pairs[id] = pair;
    }

    function activatePair(uint256 id) public onlyAdminOrOwner(msg.sender) {       
        require(id < count,"pair doesn't exist");        
        swapPair memory pair = pairs[id];
        require(!pair.isActive,"pair is already inactive");        
        pair.isActive = true;
        pairs[id] = pair;
    }


    function deactivatePair(uint256 id) public onlyAdminOrOwner(msg.sender) {       
        require(id < count,"pair doesn't exist");        
        swapPair memory pair = pairs[id];
        require(pair.isActive,"pair is already inactive");        
        pair.isActive = false;
        pairs[id] = pair;
    }

    function swap(uint256 pairId, uint256 tokenId,uint256 _count,address recipient) public {
        require(!isPaused,"Swap cannot be performed when contract is paused");
        swapPair memory pair = pairs[pairId];
        require(pair.count <= _count,"not enough nfts");        
        require(pair.isActive,"Cannot perform swap when pair is inactive");        
        require(pair.startTime < block.timestamp && pair.endTime > block.timestamp,"Not within pair swap times");
        mock1155 = mockERC1155(pair.source);
        uint256[] memory ids = _asSingletonArray(tokenId);
        uint256[] memory amounts = _asSingletonArray(_count);           
        mock1155.burn(address(this), ids, amounts);
        mock1155 = mockERC1155(minterContract);
        mock1155.mint(recipient,pair.targetTokenID,1);      
        emit swapPerformed(pairId,recipient);  
    }

	function onERC1155Received(
		address,
		address _from,
		uint256 _id,
		uint256 _amount,
		bytes memory _data
	) public virtual override returns (bytes4) {
        uint256 pairno = addrToPairID[msg.sender];
     //   mock1155 = mockERC1155(minterContract);
     //   mock1155.burn(address(this), _id, _amount);
        swap(pairno,_id,_amount,_from);
		return this.onERC1155Received.selector;
	}

	function onERC1155BatchReceived(
		address,
		address _from,
		uint256[] memory _ids,
		uint256[] memory _amounts,
		bytes memory _data
	) public virtual override returns (bytes4) {
		return this.onERC1155BatchReceived.selector;
	}


    function pause() public onlyAdminOrOwner(msg.sender) {
        isPaused = true;
    }

    function unpause() public onlyAdminOrOwner(msg.sender) {
        isPaused = false;
    }

    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }
}