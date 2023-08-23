/**
 *Submitted for verification at BscScan.com on 2021-08-24
*/

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
// pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// Router
import "../IRouter.sol";

/**
 * @title CoinToss
 */
contract CoinTossHouseMockV2  is 
Ownable, 
Pausable, 
ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // #VBVB We do not need oracle; this contract will act as a VRFConsumer
    //AggregatorV3Interface public oracle;

    bool public genesisStartOnce = false;

    address public adminAddress; // address of the admin
    address public operatorAddress; // address of the operator}

    uint256 public intervalSeconds; // interval in seconds between two prediction rounds

    uint256 public minBetAmount; // minimum betting amount (denominated in wei)
    uint256 public treasuryFee; // treasury rate (e.g. 200 = 2%, 150 = 1.50%)
    uint256 public treasuryAmount; // treasury amount that was not claimed

    uint256 public currentEpoch; // current epoch for prediction round

    uint256 public oracleLatestRoundId; // converted from uint80 (Chainlink)
    uint256 public oracleUpdateAllowance; // seconds

    uint256 public constant MAX_TREASURY_FEE = 1000; // 10%

    //#VBVB This block is for VRF Agregator
    bytes32 internal keyHash;
    uint256 internal fee;
    uint256 public randomResult;
    uint256 public count;


    mapping(uint256 => mapping(address => BetInfo)) public ledger;
    mapping(uint256 => Round) public rounds;
    mapping(address => uint256[]) public userRounds;

    address public tokenAddress;
    address public routerContract;

    enum Position {
        Tails,
        Heads
    }

    struct Round {
        uint256 epoch;
        uint256 startTimestamp;
        uint256 closeTimestamp;
        int256 tossResult;
        uint256 closeOracleId;
        uint256 totalAmount;
        uint256 headsAmount;
        uint256 tailsAmount;
        uint256 rewardBaseCalAmount;
        uint256 rewardAmount;
        bool oracleCalled;
        bool ifRefundable;
    }

    struct BetInfo {
        Position position;
        uint256 amount;
        bool claimed; // default false
    }

    event BetTails(address indexed sender, uint256 indexed epoch, uint256 amount);
    event BetHeads(address indexed sender, uint256 indexed epoch, uint256 amount);
    event Claim(address indexed sender, uint256 indexed epoch, uint256 amount);
    event EndRound(uint256 indexed epoch, uint256 indexed roundId);
    event LockRound(uint256 indexed epoch, uint256 indexed roundId);

    event NewAdminAddress(address admin);
    event NewMinBetAmount(uint256 indexed epoch, uint256 minBetAmount);
    event NewTreasuryFee(uint256 indexed epoch, uint256 treasuryFee);
    event NewOperatorAddress(address operator);
    //event NewOracle(address oracle);
    event NewOracleUpdateAllowance(uint256 oracleUpdateAllowance);

    event Pause(uint256 indexed epoch);
    event RewardsCalculated(
        uint256 indexed epoch,
        uint256 rewardBaseCalAmount,
        uint256 rewardAmount,
        uint256 treasuryAmount
    );

    event StartRound(uint256 indexed epoch);
    event TokenRecovery(address indexed token, uint256 amount);
    event TreasuryClaim(uint256 amount);
    event Unpause(uint256 indexed epoch);
    event requestRandom(bytes32 requestId);
    event receivedRandom(uint256 randomness,address sender);

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Not admin");
        _;
    }

    modifier onlyAdminOrOperator() {
        require(msg.sender == adminAddress || msg.sender == operatorAddress, "Not operator/admin");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Not operator");
        _;
    }

    modifier notContract() {
        require(!_isContract(msg.sender), "Contract not allowed");
        require(msg.sender == tx.origin, "Proxy contract not allowed");
        _;
    }

    /**
     * @notice Constructor
     * @param _adminAddress: admin address
     * @param _operatorAddress: operator address
     * @param _intervalSeconds: number of time within an interval
     * @param _minBetAmount: minimum bet amounts (in wei)
     * @param _oracleUpdateAllowance: oracle update allowance
     * @param _treasuryFee: treasury fee (1000 = 10%)
     */
    constructor(
        //address _oracleAddress,
        address _adminAddress,
        address _operatorAddress,
        uint256 _intervalSeconds,
        uint256 _minBetAmount,
        uint256 _oracleUpdateAllowance,
        uint256 _treasuryFee,
        address _tokenAddress,
        address _routerContract
    ){
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");

        //oracle = AggregatorV3Interface(_oracleAddress);
        adminAddress = _adminAddress;
        operatorAddress = _operatorAddress;
        intervalSeconds = _intervalSeconds;
        minBetAmount = _minBetAmount;
        oracleUpdateAllowance = _oracleUpdateAllowance;
        treasuryFee = _treasuryFee;
        tokenAddress = _tokenAddress;
        //#VBVB VRFAggregator parameters
        keyHash = 0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;
        fee = 0.0001 * 10**18; // 0.0001 LINK
        routerContract = _routerContract; 
    }

    /**
     * @notice Bet Tails position
     * @param epoch: epoch
     */
    function betTails(uint256 epoch,uint amount) external payable whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(_bettable(epoch), "Round not bettable");
    //  require(ledger[epoch][msg.sender].amount == 0, "Can only bet once per round");
        require(IERC20(tokenAddress).balanceOf(msg.sender)>=amount,"User has not enought funds");
        require(amount >= minBetAmount, "Bet amount must be greater than minBetAmount");

        if(ledger[epoch][msg.sender].amount >0){
             require(ledger[epoch][msg.sender].position == Position.Tails, "Can only bet on the same side");         
        }

        //  IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        IRouter(routerContract).payment(tokenAddress, msg.sender, amount);

        Round storage round = rounds[epoch];
        round.totalAmount = round.totalAmount + amount;
        round.tailsAmount = round.tailsAmount + amount;

        // Update user data
        BetInfo storage betInfo = ledger[epoch][msg.sender];
        if(ledger[epoch][msg.sender].amount == 0){
            userRounds[msg.sender].push(epoch);       
        }        
        betInfo.position = Position.Tails;
        betInfo.amount = betInfo.amount + amount;

        emit BetTails(msg.sender, epoch, amount);
    }

    /**
     * @notice Bet Heads position
     * @param epoch: epoch
     */
    function betHeads(uint256 epoch,uint amount) external payable whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(_bettable(epoch), "Round not bettable");
 //     require(ledger[epoch][msg.sender].amount == 0, "Can only bet once per round");
        require(IERC20(tokenAddress).balanceOf(msg.sender)>=amount,"User has not enought funds");
        require(amount >= minBetAmount, "Bet amount must be greater than minBetAmount");
        if(ledger[epoch][msg.sender].amount >0){
             require(ledger[epoch][msg.sender].position == Position.Heads, "Can only bet on the same side");         
        }  


        //   IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        IRouter(routerContract).payment(tokenAddress, msg.sender, amount);
        // Update round data
        Round storage round = rounds[epoch];
        round.totalAmount = round.totalAmount + amount;
        round.headsAmount = round.headsAmount + amount;

        // Update user data
        BetInfo storage betInfo = ledger[epoch][msg.sender];
        if(ledger[epoch][msg.sender].amount == 0){
            userRounds[msg.sender].push(epoch);       
        } 
        betInfo.position = Position.Heads;
        betInfo.amount = betInfo.amount + amount;



        emit BetHeads(msg.sender, epoch, amount);
    }

    /**
     * @notice Claim reward for an array of epochs
     * @param epochs: array of epochs
     */
    function claim(uint256[] calldata epochs) external nonReentrant notContract {
        uint256 reward; // Initializes reward

        for (uint256 i = 0; i < epochs.length; i++) {
            require(rounds[epochs[i]].startTimestamp != 0, "Round has not started");
            require(block.timestamp > rounds[epochs[i]].closeTimestamp, "Round has not ended");

            uint256 addedReward = 0;

            // Round valid, claim rewards
            if (rounds[epochs[i]].oracleCalled) {
                require(claimable(epochs[i], msg.sender), "Not eligible for claim");
                Round memory round = rounds[epochs[i]];
                addedReward = (ledger[epochs[i]][msg.sender].amount * round.rewardAmount) / round.rewardBaseCalAmount;
            }
            // Round invalid, refund bet amount
            else {
                require(refundable(epochs[i], msg.sender), "Not eligible for refund");
                addedReward = ledger[epochs[i]][msg.sender].amount;
            }

            ledger[epochs[i]][msg.sender].claimed = true;
            reward += addedReward;

            emit Claim(msg.sender, epochs[i], addedReward);
        }

        if (reward > 0) {
             //  IERC20(tokenAddress).transfer( msg.sender, reward);
            IRouter(routerContract).profit(tokenAddress, msg.sender, reward);
        }
    }

    /**
     * @notice Request randomnumber
     * @dev Callable by operator
     */
    // function executeRound() external whenNotPaused onlyAdminOrOperator {
    //     //#VBVB Execute round will request a random number
    //     require(
    //         genesisStartOnce,
    //         "Can only run after genesisStartRound is triggered"
    //     );

    //      require(
    //         LINK.balanceOf(address(this)) >= fee,
    //         "Not enough LINK - fill contract with faucet"
    //     );
    //     // If these requirements are not fullfilled, there is no need to request random and waste LINKK funds
    //     require(rounds[currentEpoch].startTimestamp != 0, "Can only end round after round has started");
    //     require(block.timestamp >= rounds[currentEpoch].closeTimestamp, "Can only end round after closeTimestamp");
    //     bytes32 requestId=requestRandomness(keyHash, fee);
    //     emit requestRandom(requestId);
    // }

    
    /** Start the next round n, lock price for round n-1, end round n-2
     * @notice This function is called by coordinator with the random number. 
     * @dev Callable by operator
     */
    function executeRound(uint256 randomness)
        public
        virtual
    {
        randomResult = randomness;
        count++;
        emit receivedRandom(randomness,msg.sender);
        //emit reciveRandomness(randomness, count);
        
        // #VBVB There is no need to get random number from anywhere as we receive this random number as a parameter
        //(uint80 currentRoundId, int256 currentPrice) = _getCoinTossResult();
        
        // #VBVB I thnk there is no need to keep using oracleLatestRoundId. We are sure that rando number has been last number
        // as it has been provider by coordinator
        //oracleLatestRoundId = uint256(currentRoundId);
        oracleLatestRoundId=count;
        uint80 currentRoundId=uint80(count);

        // #VBVB
        // CurrentEpoch refers to previous round (n-1)
        //_safeEndRound(currentEpoch, currentRoundId, currentPrice);

         // #VBVB we need only first bit
         int256 result=int256(randomness & uint256(0x01));
        _safeEndRound(currentEpoch, currentRoundId, result);
        _calculateRewards(currentEpoch);

        // Increment currentEpoch to current round (n)
        currentEpoch = currentEpoch + 1;
        _safeStartRound(currentEpoch);
    }



    /**
     * @notice Start genesis round
     * @dev Callable by admin or operator
     */
    function genesisStartRound() external whenNotPaused onlyAdminOrOperator {
        require(!genesisStartOnce, "Can only run genesisStartRound once");

        currentEpoch = currentEpoch + 1;
        _startRound(currentEpoch);
        genesisStartOnce = true;
    }
    
    function makeRefundable(uint256 epoch) external whenPaused onlyAdmin {
       Round storage round = rounds[epoch];
       round.ifRefundable = true;
    }
    

    /**
     * @notice called by the admin to pause, triggers stopped state
     * @dev Callable by admin or operator
     */
    function pause() external whenNotPaused onlyAdminOrOperator {
        _pause();

        emit Pause(currentEpoch);
    }

    /**
     * @notice Claim all rewards in treasury
     * @dev Callable by admin
     */
    function claimTreasury() external nonReentrant onlyAdmin {
        uint256 currentTreasuryAmount = treasuryAmount;
        treasuryAmount = 0;
         //     IERC20(tokenAddress).transfer( adminAddress, currentTreasuryAmount);
        IRouter(routerContract).profit(tokenAddress, adminAddress, currentTreasuryAmount);

        emit TreasuryClaim(currentTreasuryAmount);
    }

    /**
     * @notice called by the admin to unpause, returns to normal state
     * Reset genesis state. Once paused, the rounds would need to be kickstarted by genesis
     */
    function unpause() external whenPaused onlyAdmin {
        genesisStartOnce = false;
        _unpause();

        emit Unpause(currentEpoch);
    }

    /**
     * @notice Set minBetAmount
     * @dev Callable by admin
     */
    function setMinBetAmount(uint256 _minBetAmount) external whenPaused onlyAdmin {
        require(_minBetAmount != 0, "Must be superior to 0");
        minBetAmount = _minBetAmount;

        emit NewMinBetAmount(currentEpoch, minBetAmount);
    }

    /**
     * @notice Set operator address
     * @dev Callable by admin
     */
    function setOperator(address _operatorAddress) external onlyAdmin {
        require(_operatorAddress != address(0), "Cannot be zero address");
        operatorAddress = _operatorAddress;

        emit NewOperatorAddress(_operatorAddress);
    }

    /**
     * @notice #VBVB We do not need ths function
     * @dev Callable by admin
     */
    // function setOracle(address _oracle) external whenPaused onlyAdmin {
    //     require(_oracle != address(0), "Cannot be zero address");
    //     oracleLatestRoundId = 0;
    //     oracle = AggregatorV3Interface(_oracle);

    //     // Dummy check to make sure the interface implements this function properly
    //     // oracle.latestRoundData();

    //     emit NewOracle(_oracle);
    // }

    /**
     * @notice Set oracle update allowance
     * @dev Callable by admin
     */
    function setOracleUpdateAllowance(uint256 _oracleUpdateAllowance) external whenPaused onlyAdmin {
        oracleUpdateAllowance = _oracleUpdateAllowance;

        emit NewOracleUpdateAllowance(_oracleUpdateAllowance);
    }

    /**
     * @notice Set treasury fee
     * @dev Callable by admin
     */
    function setTreasuryFee(uint256 _treasuryFee) external whenPaused onlyAdmin {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");
        treasuryFee = _treasuryFee;

        emit NewTreasuryFee(currentEpoch, treasuryFee);
    }

    /**
     * @notice It allows the owner to recover tokens sent to the contract by mistake
     * @param _token: token address
     * @param _amount: token amount
     * @dev Callable by owner
     */
    function recoverToken(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(address(msg.sender), _amount);
        IRouter(routerContract).profit(_token, msg.sender, _amount);
        emit TokenRecovery(_token, _amount);
    }

    /**
     * @notice Set admin address
     * @dev Callable by owner
     */
    function setAdmin(address _adminAddress) external onlyOwner {
        require(_adminAddress != address(0), "Cannot be zero address");
        adminAddress = _adminAddress;

        emit NewAdminAddress(_adminAddress);
    }

    /**
     * @notice Returns round epochs and bet information for a user that has participated
     * @param user: user address
     * @param cursor: cursor
     * @param size: size
     */
    function getUserRounds(
        address user,
        uint256 cursor,
        uint256 size
    )
        external
        view
        returns (
            uint256[] memory,
            BetInfo[] memory,
            uint256
        )
    {
        uint256 length = size;

        if (length > userRounds[user].length - cursor) {
            length = userRounds[user].length - cursor;
        }

        uint256[] memory values = new uint256[](length);
        BetInfo[] memory betInfo = new BetInfo[](length);

        for (uint256 i = 0; i < length; i++) {
            values[i] = userRounds[user][cursor + i];
            betInfo[i] = ledger[values[i]][user];
        }

        return (values, betInfo, cursor + length);
    }

    /**
     * @notice Returns round epochs length
     * @param user: user address
     */
    function getUserRoundsLength(address user) external view returns (uint256) {
        return userRounds[user].length;
    }

    /**
     * @notice Get the claimable stats of specific epoch and user account
     * @param epoch: epoch
     * @param user: user address
     */
    function claimable(uint256 epoch, address user) public view returns (bool) {
        BetInfo memory betInfo = ledger[epoch][user];
        Round memory round = rounds[epoch];
        return
            round.oracleCalled &&
            betInfo.amount != 0 &&
            !betInfo.claimed &&
            ((round.tossResult == 1 && betInfo.position == Position.Heads) ||
             (round.tossResult == 0 && betInfo.position == Position.Tails) ||
             (round.headsAmount == 0) || (round.tailsAmount == 0)  
            );
    }

    /**
     * @notice Get the refundable stats of specific epoch and user account
     * @param epoch: epoch
     * @param user: user address
     */
    function refundable(uint256 epoch, address user) public view returns (bool) {
        BetInfo memory betInfo = ledger[epoch][user];
        Round memory round = rounds[epoch];
        return
            round.ifRefundable&& 
            !round.oracleCalled &&
            !betInfo.claimed &&
            block.timestamp > round.closeTimestamp &&
            betInfo.amount != 0;
    }

    /**
     * @notice Calculate rewards for round
     * @param epoch: epoch
     */
    function _calculateRewards(uint256 epoch) internal {
        require(rounds[epoch].rewardBaseCalAmount == 0 && rounds[epoch].rewardAmount == 0, "Rewards calculated");
        Round storage round = rounds[epoch];
        uint256 rewardBaseCalAmount;
        uint256 treasuryAmt;
        uint256 rewardAmount;

        // Heads wins
        if (round.headsAmount == 0) {
            rewardBaseCalAmount = round.tailsAmount;   
            treasuryAmt = (round.totalAmount * treasuryFee) / 10000;
            rewardAmount = round.totalAmount - treasuryAmt;
        }

        else if (round.tailsAmount == 0) {
            rewardBaseCalAmount = round.headsAmount;    
            treasuryAmt = (round.totalAmount * treasuryFee) / 10000;
            rewardAmount = round.totalAmount - treasuryAmt;
        }

        else if (round.tossResult == 1) {
            rewardBaseCalAmount = round.headsAmount;
            treasuryAmt = (round.totalAmount * treasuryFee) / 10000;
            rewardAmount = round.totalAmount - treasuryAmt;
        }
        // Tails wins
        else if (round.tossResult == 0) {
            rewardBaseCalAmount = round.tailsAmount;
            treasuryAmt = (round.totalAmount * treasuryFee) / 10000;
            rewardAmount = round.totalAmount - treasuryAmt;
        }
        // House wins
        else {
            rewardBaseCalAmount = 0;
            rewardAmount = 0;
            treasuryAmt = round.totalAmount;
        }
        round.rewardBaseCalAmount = rewardBaseCalAmount;
        round.rewardAmount = rewardAmount;

        // Add to treasury
        treasuryAmount += treasuryAmt;

        emit RewardsCalculated(epoch, rewardBaseCalAmount, rewardAmount, treasuryAmt);
    }

    /**
     * @notice End round
     * @param epoch: epoch
     * @param roundId: roundId
     * @param price: price of the round
     */
    function _safeEndRound(
        uint256 epoch,
        uint256 roundId,
        int256 price
    ) internal {
        require(rounds[epoch].startTimestamp != 0, "Can only end round after round has started");
        require(block.timestamp >= rounds[epoch].closeTimestamp, "Can only end round after closeTimestamp");
        Round storage round = rounds[epoch];
        round.tossResult = price;
        round.closeOracleId = roundId;
        round.oracleCalled = true;

        emit EndRound(epoch, roundId);
    }


    /**
     * @notice Start round
     * Previous round n-2 must end
     * @param epoch: epoch
     */
    function _safeStartRound(uint256 epoch) internal {
        require(genesisStartOnce, "Can only run after genesisStartRound is triggered");
        require(rounds[epoch - 1].closeTimestamp != 0, "Can only start round after round n-1 has ended");
        require(
            block.timestamp >= rounds[epoch - 1].closeTimestamp,
            "Can only start new round after round n-1 closeTimestamp"
        );
        _startRound(epoch);
    }

    /**
     * @notice Transfer BNB in a safe way
     * @param to: address to transfer BNB to
     * @param value: BNB amount to transfer (in wei)
     */
    function _safeTransferBNB(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}("");
        require(success, "TransferHelper: BNB_TRANSFER_FAILED");
    }

    /**
     * @notice Start round
     * Previous round n-2 must end
     * @param epoch: epoch
     */
    function _startRound(uint256 epoch) internal {
        Round storage round = rounds[epoch];
        round.startTimestamp = block.timestamp;
        round.closeTimestamp = block.timestamp + intervalSeconds;
        round.epoch = epoch;
        round.totalAmount = 0;

        emit StartRound(epoch);
    }

    /**
     * @notice Determine if a round is valid for receiving bets
     * Round must have started and locked
     * Current timestamp must be within startTimestamp and closeTimestamp
     */
    function _bettable(uint256 epoch) internal view returns (bool) {
        return
            rounds[epoch].startTimestamp != 0 &&
            rounds[epoch].closeTimestamp != 0 &&
            block.timestamp > rounds[epoch].startTimestamp &&
            block.timestamp < rounds[epoch].closeTimestamp;
    }

    /**
     * @notice #VBVB We do not need this function
     * If it falls below allowed buffer or has not updated, it would be invalid.
     */
    // function _getCoinTossResult() public payable returns (uint80, int256) {
    //     uint256 leastAllowedTimestamp = block.timestamp + oracleUpdateAllowance;
    //     (uint80 roundId, int256 price, , uint256 timestamp, ) = oracle.latestRoundData();
    //     require(timestamp <= leastAllowedTimestamp, "Oracle update exceeded max timestamp allowance");
    //     require(
    //         uint256(roundId) > oracleLatestRoundId,
    //         "Oracle update roundId must be larger than oracleLatestRoundId"
    //     );
    //     return (roundId, price);
    // }

    /**
     * @notice Returns true if `account` is a contract.
     * @param account: account address
     */
    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}

