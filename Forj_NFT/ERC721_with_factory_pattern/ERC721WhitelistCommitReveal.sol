// SPDX-License-Identifier: UNLICENSE
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract ERC721WhitelistCommitReveal is ERC721, ReentrancyGuard, Ownable {
    using Strings for uint256;
    bool isInitialized = false;
    
    string public baseURI;
    string public metaDataExt = "";

    string public provenanceHash;
    string public HIDDEN_URI; 
    bool public revealed = false;

    uint256 public endTime;
    uint256 public tierEndTime;
    uint256 public maxMintAmount;
    uint256 public maxSupply;
    uint256 public mintFee;
    uint256 public totalTiers;
    uint256 public currentId = 1;

    address public multisig;
    address public token;
    address public treasuryWallet;
    mapping(uint256 => Tier) public tiers;

    mapping(address => uint256) public mintedPerAddress;
    mapping(address => bool) public isAdmin;
    uint256 public mintedAmount;


    modifier onlyAdminOrOwner(address _address) {
        require(
            isAdmin[_address] || _address == owner(),
            "This address is not allowed"
        );
        _;
    }

    modifier onlyMultiSig(address _address) {
        require(_address == multisig, "Not Multisig wallet");
        _;
    }

    struct Tier {
        uint256 num;
        uint256 start;
        uint256 end;
        bytes32 merkleRoot;
    }

    constructor() ERC721("",""){}


     function initialise(
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
    ) public {
        require(!isInitialized, 'Contract is already initialized!');
        isInitialized = true;        
        require(
            starts.length == ends.length,
            "start and end times array length mismatch"
        );
        require(
            starts.length == merkleRoots.length,
            "limits and merkleRoots array length mismatch"
        );
        multisig = _multisig;
        token = _token;
        HIDDEN_URI = URI;
        mintFee = _fees;
        maxSupply = _maxSupply;
        maxMintAmount = _limitPerAddress;
        totalTiers = starts.length;
        // _setData(_name, _symbol);
        for (uint256 i = 0; i < starts.length; i++) {
            if (i > 0) {
                require(starts[i] > ends[i - 1], "tier times cannot overlap");
            }
            tiers[i + 1] = Tier(i + 1, starts[i], ends[i], merkleRoots[i]);
        }
        tierEndTime = ends[ends.length - 1];
    }


    function setContractOwnership(address newOwner) public onlyOwner {
        transferOwnership(newOwner);
    }

    function setContractAdmin(address _address) public onlyOwner {
        isAdmin[_address] = true;
    }

    function changeMultiSig(address _addr) public onlyMultiSig(msg.sender) {
        multisig = _addr;
    }

    function changeTreasury(address _addr) public onlyOwner {
        treasuryWallet = _addr;
    }

    function changeTierTimes(
        uint256 _endTime,
        uint256 _startTime,
        uint256 tierNo
    ) public onlyOwner {
        require(_endTime > _startTime + 30, "Tier has to be atleast 30 seconds");
        Tier memory tier = tiers[tierNo];
        require(tier.start > block.timestamp + 60, "Tier has already started");
        tier.start = _startTime;
        tier.end = _endTime;
        tiers[tierNo] = tier;
    }

    function deleteContractAdmin(address _address) public onlyOwner {
        isAdmin[_address] = false;
    }


    function changeCollectionToken(address _addr)
        external
        onlyMultiSig(msg.sender)
    {
        require(_addr != address(0), "New address cannot be zero");
        token = _addr;
    }

    function setMintAllowance(uint256 _newmaxMintAmount)
        public
        onlyAdminOrOwner(msg.sender)
    {
        maxMintAmount = _newmaxMintAmount;
    }

    function setNftMetadata(string memory _newBaseURI, string memory _newExt)
        public
        onlyAdminOrOwner(msg.sender)
    {
        baseURI = _newBaseURI;
        metaDataExt = _newExt;
    }

    function tierMint(
        address mintAddress,
        uint256 tierNo,
        bytes32[] calldata _merkleProof
    ) external payable {
        Tier memory tier = tiers[tierNo];
        bytes32 leaf = keccak256(abi.encodePacked(mintAddress));
        bytes32 root = tier.merkleRoot;
        require(
            MerkleProof.verify(_merkleProof, root, leaf),
            "Incorrect proof"
        );
        require(
            tier.start < block.timestamp && tier.end > block.timestamp,
            "not within the tier time"
        );

        require(
            mintedPerAddress[mintAddress] <= maxMintAmount,
            "Exception: Reached the limit for each user. You can't mint no more"
        );
        require(
            mintedAmount <= maxSupply,
            "Exception: Reached the minting limit for the contract. Can't mint no more"
        );
        if (address(token) == address(0)) {
            require(
                msg.value >= mintFee,
                "doesn't have enough tokens to mint the NFT"
            );
        } else {
            require(
                ERC20(token).balanceOf(msg.sender) >= mintFee,
                "doesn't have enough tokens to mint the NFT"
            );
            ERC20(token).transferFrom(msg.sender, address(this), mintFee);
        }
        _mint(mintAddress, currentId);
        currentId++;
        mintedPerAddress[mintAddress] = mintedPerAddress[mintAddress] + 1;
        mintedAmount = mintedAmount + 1;
    }

    function _mint(address to, uint256 id) internal override {
        super._mint(to, id);
    }

    function collectTreasury() external onlyMultiSig(msg.sender) {
        if (address(token) == address(0)) {
            payable(treasuryWallet).transfer(address(this).balance);
        } else {
            uint256 amt = ERC20(token).balanceOf(address(this));
            ERC20(token).transfer(treasuryWallet, amt);
        }
    }

    function commit(string memory _provanceHash) external payable onlyOwner {
        require(
            block.timestamp < tiers[1].start,
            "Can be only committed before minting start time"
        );
        provenanceHash = _provanceHash;
    }    

    function reveal(string memory _newBaseURI, string memory _newExt)
        external
        payable
        onlyAdminOrOwner(msg.sender)
    {
        require(
            block.timestamp > endTime,
            "Can be only revealed after block end"
        );
        require(!revealed, "Already revealed");
        baseURI = _newBaseURI;
        metaDataExt = _newExt;
        revealed = true;
    }

    function burn(uint256 id) public {
        require(msg.sender == ownerOf(id),"only token owner can burn the nft");
        _burn(id);
    }

    function uri(uint256 tokenId) public view returns (string memory) {
        if (revealed) {
            return
                string(
                    abi.encodePacked(baseURI, metaDataExt, tokenId.toString())
                );
        } else {
            return HIDDEN_URI;
        }
    }
}
