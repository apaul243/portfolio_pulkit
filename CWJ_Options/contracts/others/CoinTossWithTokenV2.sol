// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./shared/VRFConsumerBase.sol";
import "./IRouter.sol";
import "hardhat/console.sol";


contract CoinTossWithTokenV2  is 
Ownable, 
Pausable, 
ReentrancyGuard,
VRFConsumerBase //#VBVB extend from VRFConsumer
{
    using SafeERC20 for IERC20;

    uint constant public EV_CLAIM=1;  
    uint constant public EV_TAILS=2;
    uint constant public EV_HEADS=3;
    uint constant public EV_CLAIM_BONUS=10;
    uint constant public EV_RESULT=11; 
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

    /* This smart contract uses two main data structures : a) round struct b) betInfo struct
       Coin Toss will be conducted round by round with information for each round being stored in the 'Round'
       struct and info for all the rounds being stored in the 'rounds' mapping i.e rounds[1], rounds[2] etc.

       The 'Round' struct will have the following info: {round number, starting time, closing time, round result
       (heads,tails), total amount wagered, amount wagered on heads and tails etc.}

       The 'BetInfo' struct will be created everytime a user places a bet and will have {position, amount,claimed}.
       The ledger will container information by the round i.e the list of bets placed in 
       each round {Round Number -----> BetInfo[] }

    */

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
        bool bonusClaimed;
    }

    event BetTails(address indexed sender, uint256 indexed epoch, uint256 amount);
    event BetHeads(address indexed sender, uint256 indexed epoch, uint256 amount);
    event Claim(address indexed sender, uint256 indexed epoch, uint256 amount);
    event ClaimBonus(address indexed sender, uint256 indexed epoch, uint256 amount);
    event EndRound(uint256 indexed epoch, uint256 indexed roundId);
    event LockRound(uint256 indexed epoch, uint256 indexed roundId);
    
    event NewIntervalPeriod(uint256 secs);
    event NewAdminAddress(address admin);
    event NewMinBetAmount(uint256 indexed epoch, uint256 minBetAmount);
    event NewTreasuryFee(uint256 indexed epoch, uint256 treasuryFee);
    event NewOperatorAddress(address operator);
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
    event receivedRandom(bytes32 requestId,uint256 randomness,address sender);

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

    // #VBVB Set parameters for VRF
    //  VRF Coordinator 0x8C7382F9D8f56b33781fE506E897a4F1e2d17255, 
    //  LINK Token 0x326C977E6efc84E512bB9C30f76E30c160eD06FB, 
    //  keyHash = 0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;
    //  fee = 0.0001 * 10**18; // 0.0001 LINK

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
        address _adminAddress,
        address _operatorAddress,
        uint256 _intervalSeconds,
        uint256 _minBetAmount,
        uint256 _oracleUpdateAllowance,
        uint256 _treasuryFee,
        address _tokenAddress,
        address _routerContract,
        address _coordinatorContract,
        address _linkContract,
        bytes32 _keyHash,
        uint linkFee

    )  VRFConsumerBase(
        // #VBVB Set parameters for VRF
        _coordinatorContract, // VRF Coordinator
        _linkContract // LINK Token
    ){
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");

        adminAddress = _adminAddress;
        operatorAddress = _operatorAddress;
        intervalSeconds = _intervalSeconds;
        minBetAmount = _minBetAmount;
        oracleUpdateAllowance = _oracleUpdateAllowance;
        treasuryFee = _treasuryFee;
        tokenAddress = _tokenAddress;
        //#VBVB VRFAggregator parameters
        keyHash = _keyHash;
        fee = linkFee;
        routerContract = _routerContract; 
    }


    /* betTails() is called by the user who wants to place a bet for 'tails' outcome of the coin toss. It takes   
       two parameters, round number and the bet amount. Basic validation is performed first, whether the round 
       is ongoing and not expired, the user has enough balance to place the bet etc. then the router contract is 
       called to transfer the amount from the user to the router. Lastly, state variable are updated that 
       includes: Round struct (total money bet on the round, total money on heads and tails), BetInfo 
       struct (user's position and amount for that specific round) */

    function betTails(uint256 epoch) external payable whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(_bettable(epoch), "Round not bettable");
        require(msg.value>=minBetAmount,"User has not enought funds");
        uint256 amount = msg.value;

        if(ledger[epoch][msg.sender].amount >0){
             require(ledger[epoch][msg.sender].position == Position.Tails, "Can only bet on the same side");         
        }

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
        IRouter(routerContract).emitEvent(EV_TAILS,address(this),msg.sender,epoch, amount);
    }

    /* betHeads() is very similar to betTails() above */

    function betHeads(uint256 epoch) external payable whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(_bettable(epoch), "Round not bettable");
        require(msg.value>=minBetAmount,"User has not enought funds");

        uint256 amount = msg.value;
        if(ledger[epoch][msg.sender].amount >0){
             require(ledger[epoch][msg.sender].position == Position.Heads, "Can only bet on the same side");         
        }  
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
        IRouter(routerContract).emitEvent(EV_HEADS,address(this),msg.sender,epoch, amount);
    }

    /* Claim method is used by a user to claim his winnings. It will take an array of round numbers for which
       the user wants to claim his winnings. The method runs through the array one by one, performing validation 
       for each round: 1) whether round is over or not, 2) whether user won/lost for that specific round, 
       3) whether user has already claimed his reward for that round and 4) calculate his winnings after deducting
       the treasury fees */
       
    function claim(uint256[] calldata epochs) external nonReentrant notContract {
        uint256 reward; // Initializes reward

        for (uint256 i = 0; i < epochs.length; i++) {
            require(rounds[epochs[i]].startTimestamp != 0, "Round has not started");
            require(block.timestamp > rounds[epochs[i]].closeTimestamp || rounds[epochs[i]].ifRefundable, "Round has not ended");

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
                uint _treasuryAmount = (ledger[epochs[i]][msg.sender].amount*treasuryFee)/10000;
                addedReward = ledger[epochs[i]][msg.sender].amount - _treasuryAmount;
                treasuryAmount += _treasuryAmount;
            }

            ledger[epochs[i]][msg.sender].claimed = true;
            reward += addedReward;

            emit Claim(msg.sender, epochs[i], addedReward);
            IRouter(routerContract).emitEvent(EV_CLAIM,address(this),msg.sender,epochs[i], addedReward);
        }

        if (reward > 0) {
            _safeTransferMatic(address(msg.sender), reward);
        }
    }

    /* Our P2P contracts rewards user with bonus BOLD token for placing bets, irregardless of bets win or lose.
       This method will take an array of round numbers and use the router to transfer the bonus BOLD tokens to  
       the user */
    function claimBonusRewards(uint256[] calldata epochs) external nonReentrant notContract {
        uint256 reward; // Initializes reward

        for (uint256 i = 0; i < epochs.length; i++) {
            require(rounds[epochs[i]].startTimestamp != 0, "Round has not started");
            require(block.timestamp > rounds[epochs[i]].closeTimestamp, "Round has not ended");

            uint256 addedReward = 0;

            // Round valid, claim rewards
            if (rounds[epochs[i]].oracleCalled) {
                require(bonusClaimable(epochs[i], msg.sender), "Not eligible for bonus claim");
                addedReward = ledger[epochs[i]][msg.sender].amount;
            }
            ledger[epochs[i]][msg.sender].bonusClaimed = true;
            reward += addedReward;
            emit ClaimBonus(msg.sender, epochs[i], addedReward);
            IRouter(routerContract).emitEvent(EV_CLAIM_BONUS,address(this),msg.sender,epochs[i], addedReward);
        }

        if (reward > 0) {
            IRouter(routerContract).bonusPayment(tokenAddress, msg.sender, reward);
        }
    }

    /* This method is called by the operator to get a random number, whose first bit ( 0 or 1) will determine
       whether the toss outcome is heads or tails.  */

    function executeRound() external whenNotPaused onlyAdminOrOperator {
        //#VBVB Execute round will request a random number
        require(
            genesisStartOnce,
            "Can only run after genesisStartRound is triggered"
        );

         require(
            LINK.balanceOf(address(this)) >= fee,
            "Not enough LINK - fill contract with faucet"
        );
        // If these requirements are not fullfilled, there is no need to request random and waste LINKK funds
        require(rounds[currentEpoch].startTimestamp != 0, "Can only end round after round has started");
        require(block.timestamp >= rounds[currentEpoch].closeTimestamp, "Can only end round after closeTimestamp");
        bytes32 requestId=requestRandomness(keyHash, fee);
        emit requestRandom(requestId);
    }

    
    /** Start the next round n, lock price for round n-1, end round n-2
     * @notice This function is called by coordinator with the random number. 
     * @dev Callable by operator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        virtual
        override 
        whenNotPaused
    {
        randomResult = randomness;
        count++;
        emit receivedRandom(requestId,randomness,msg.sender);
        oracleLatestRoundId=count;
        uint80 currentRoundId=uint80(count);

        // #VBVB
        // CurrentEpoch refers to previous round (n-1)
        //_safeEndRound(currentEpoch, currentRoundId, currentPrice);

         // #VBVB we need only first bit
         int256 result=int256(randomness & uint256(0x01));
         uint emitResult=EV_TAILS;
         if(result>0){
             emitResult=EV_HEADS;
         }
         IRouter(routerContract).emitEvent(EV_RESULT,address(this),msg.sender,currentEpoch, emitResult);
        _safeEndRound(currentEpoch, currentRoundId, result);
        _calculateRewards(currentEpoch);

        // Increment currentEpoch to current round (n)
        currentEpoch = currentEpoch + 1;
        _safeStartRound(currentEpoch);
    }




    /* This method needs to be called when the first round needs to be started. This initiates the first round,
        and subsequent rounds ( round2, round3 etc.) are started by the executeRound() method. */

    function genesisStartRound() external whenNotPaused onlyAdminOrOperator {
        require(!genesisStartOnce, "Can only run genesisStartRound once");

        currentEpoch = currentEpoch + 1;
        _startRound(currentEpoch);
        genesisStartOnce = true;
    }
    
        
    /* Certain rounds can be nulled and marked refundable by the admin. This can happen due to technical flaws
       or malpractice */

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
        _safeTransferMatic(adminAddress, currentTreasuryAmount);
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
     * @notice Set LINK token fee
     * @dev Callable by admin
     */
    function setLinkFee(uint256 _linkFee) external whenPaused onlyAdmin {
        fee = _linkFee;
    }
    function getLinkFee() public view returns(uint256) {
        return fee;
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
        IERC20(_token).transfer( msg.sender, _amount);
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
     * @notice Set interval seconds
     * @dev Callable by admin
     */
    function setIntervalSeconds(uint256 _intervalSeconds) external whenPaused onlyAdmin {
        require(_intervalSeconds > 0, "Must be greater than 0");
        intervalSeconds = _intervalSeconds;
        emit NewIntervalPeriod(_intervalSeconds);
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
        // ## VBVB Uncontrolled error condition
        require(cursor<=userRounds[user].length, "Cursor out of bounds");

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

    /* This method determines if the user is eligible to claim any winnings for a specific round by 
       checking the following conditions: 1) If the round is over and result has been called 2) If user 
       made any bet for that round 3) If user has already claimed his winnings 4) If the outcome (head/tails)
       was as predicted by the user  */

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

    /* This method determines id the user is eligible to claim bonus BOLD for any round */

    function bonusClaimable(uint256 epoch, address user) public view returns (bool) {
        BetInfo memory betInfo = ledger[epoch][user];
        Round memory round = rounds[epoch];
        return
            round.oracleCalled &&
            betInfo.amount != 0 &&
            !betInfo.bonusClaimed;
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
            !betInfo.claimed &&
            block.timestamp > round.closeTimestamp &&
            betInfo.amount != 0;
    }

    /* This method is called by the executeRound() method. It is our basic algorithm which settles all user bets
       by a simple formula. For ex: If Adam placed a wager of 10 WETH on tails and tails wins, his winnings would be 
       as follows : (Adam's Bet/ Total bets on tails)* (Total amount of wagers placed). This method will also deduct
       the treasury fees from the total amount of bets. If there is 0 WETH worth of bets from one side, all bets
       will be voided and the result would be deemed unconsquential  */

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
    /**
     * @notice Transfer matic in a safe way
     * @param to: address to transfer matic to
     * @param value: matic amount to transfer (in wei)
     */
    function _safeTransferMatic(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}("");
        require(success, "TransferHelper: MATIC_TRANSFER_FAILED");
    }

}

