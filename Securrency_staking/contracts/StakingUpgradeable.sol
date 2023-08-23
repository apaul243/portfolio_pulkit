// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;
    
/** 
 * @title Staking
 * @dev Allow users to stake the staking token and get reward tokens in return.
 **/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Vault.sol";

contract StakingUpgradeable is Initializable,OwnableUpgradeable,PausableUpgradeable {

    IERC20 public stakingToken;
    IERC20 public rewardToken;    
    Vault public vault;
    bool ifInitialized;
    /* cumulativeRewardRate: This variable contains the core logic of the contract.
     * It is updated whenever a user: Stakes,Unstakes,Claims,Compound or Exit Pool
     * RewardRate = (totalRewardTokensInVault*multiplier)/(1 year*totalDeposits)
     * cumulativeRewardRate (at t) = SUM(RewardRate) from 0 to t secionds
     * Calculation can vary a bit for fixed APR.
     */
    uint public cumulativeRewardRate;
    uint public lastUpdateTime; // last update time for cumulativeRewardRate
    uint public totalDeposits; // total staked amount in the contract
    bool public autocompounding;// autocompounding on/off
    bool public dynamicRate;// APY Calculation : dynamic or fixed
    uint public fixedRate; // For fixed APY, amount of reward tokens in one year per staking token
    uint private constant MULTIPLIER = 1e18;
    uint private timePeriod;  // seconds in an year, for APY calculations 

    mapping(address => uint256) public deposits; 
    /* We calculate user rewards by keeping track of the cumulativeRewardRate() when
     * (1) they entered the pool or (2) when their rewards were last updated.
     * Rewards earned = (cumulativeRewardRate - userCumulativeRewardRate[user])*deposits[user]/multiplier
     */
    mapping(address => uint256) public userCumulativeRewardRate;
    mapping(address => uint256) public rewardsEarned;

    /* Events can be optional since they consume gas.*/
    event stakes(address staker,uint stakeAdded, uint rewards);    
    event unstaked(address staker,uint stakeRemoved, uint rewards); 
    event claimed(address staker, uint rewardsClaimed);   
    event exitedPool(address staker); 
    event rateModeChanged(string mode);
    event autocompoundingMode(bool mode);

    function initialize (address _stakingToken, address _rewardToken, address _vault,bool ifDynamicRate, bool ifCompounding) public initializer{
        require(!ifInitialized,"already initialized");
        require(_stakingToken!=address(0),"Staking token cannot be address zero");        
        require(_rewardToken!=address(0),"reward token cannot be address zero");        
        require(_vault!=address(0),"vault cannot be address zero");                
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        vault = Vault(_vault);        
        dynamicRate = ifDynamicRate ;
        autocompounding = ifCompounding; 
        ifInitialized = true;       
        timePeriod = 31536000;       
    }

    /* @dev a) Allow users to stake in the contract b) If they already have a stake, it calculates the 
     *         rewards earned till now and adds it to rewardsEarned c) If autocompounding is on,
     *         rewards earned are added to the principal.
     */
    function stake(uint amount) external {
        require(amount >0,"Deposit amount has to be > 0");  
        uint rewards = _updateUserRewards(msg.sender);
        if(autocompounding) {
            deposits[msg.sender] = deposits[msg.sender] + amount + rewards ;
            rewardsEarned[msg.sender] = 0;
            totalDeposits = totalDeposits + amount + rewards;
        }
        else {
            deposits[msg.sender] += amount;
            totalDeposits += amount;            
        }
        stakingToken.transferFrom(msg.sender, address(this), amount);
        emit stakes(msg.sender,amount,rewards);
    }

    /* @dev a) Allow users to unstake from the contract b) If autocompounding is on,
     *         it adds the rewards earned to the principal.
     */
    function unstake(uint amount) public {
        require(amount >0,"Unstaking amount has to be > 0"); 
        uint userDeposit = deposits[msg.sender];
        require(userDeposit >0,"User has no deposits in this contracts"); 
        uint rewards = _updateUserRewards(msg.sender);
        if(autocompounding) {
            userDeposit = userDeposit - amount + rewards ;
            rewardsEarned[msg.sender] = 0;
            totalDeposits = totalDeposits - amount + rewards;
        }
        else {
            userDeposit -= amount;
            totalDeposits -= amount;            
        }
        deposits[msg.sender] = userDeposit;
        stakingToken.transfer(msg.sender, amount);
        emit unstaked(msg.sender,amount,rewards);
    }


    /* @dev a) Allow users to claim all accumulated rewards b) Calls the vault contract 
     *      to transfer the tokens to the user ( since rewards tokens are in vault).
     *      c) Also, sets the rewardsEarned[user] = 0    
     */
    function claim() public returns (uint) {
        uint rewards = _updateUserRewards(msg.sender); 
        if (rewards > 0) {
            rewardsEarned[msg.sender] = 0;
            vault.transferStakingTokens(msg.sender, rewards);
        }
        emit claimed(msg.sender,rewards);
        return rewards;        
    }

    /* @dev Allows users to completely exit the pool: claim deposit and rewards */
    function exitPool() external {
        claim();
        unstake(deposits[msg.sender]);
        emit exitedPool(msg.sender); 
    }

    /* @dev If autocompounding is on, allows users to manually calculate rewards and add it to principal */
    function compound() external {
        require(autocompounding, "compounding is turned off");
        uint rewards = _updateUserRewards(msg.sender);
        deposits[msg.sender] = deposits[msg.sender] + rewards ;
        rewardsEarned[msg.sender] = 0;
        totalDeposits = totalDeposits + rewards;
    }

    /* @dev Updates the cumulativeRewardRate based on the last updated timestamp,total deposits and  
     *      total reward tokens. Has custom logic for both fixed and variable rate.  
     */
    function newCumulativeRewardRate() public view returns (uint) {
        if(dynamicRate){
            uint totalRewardTokens = vault.getSupply();
            if (totalDeposits == 0 || totalRewardTokens ==0) {
                return cumulativeRewardRate;
            }
            uint rewardRate = totalRewardTokens/timePeriod;
            return cumulativeRewardRate + (
                rewardRate*(block.timestamp - lastUpdateTime)*1e18/totalDeposits
            );  
        }
        else {
            uint rewardRate = fixedRate/timePeriod; 
            return cumulativeRewardRate + (
                rewardRate*(block.timestamp - lastUpdateTime)
            );            
        }
    }

    /* @dev Calculates the rewards for a given user since the last update time.
     *      Updates rewardsEarned[user] and  userCumulativeRewardRate[user] and
     *      returns the total rewards gained in the time.
     */
    function _updateUserRewards(address _user) internal returns(uint) {
        cumulativeRewardRate = newCumulativeRewardRate();
        lastUpdateTime = block.timestamp;
        uint currentRewards = rewardsEarned[msg.sender];
        currentRewards = currentRewards + (deposits[_user]*(cumulativeRewardRate - userCumulativeRewardRate[_user]))/MULTIPLIER;        
        rewardsEarned[msg.sender] = currentRewards;
        userCumulativeRewardRate[_user] = cumulativeRewardRate;  
        return currentRewards;                      
    }

    /* @dev This method will change the rate type from dynamic to fixed.
     *      It will update the cumulativeRewardRate first, using the dynamic rate
     *      calculation till this point.
     * @param fixedRateAPY : For fixed rate, we need to provide a fixed rate APY,
     *      that is the amount of reward tokens(in wei) a user is entitled to in one
     *      year per staking token.
     */

    function changeToFixedRate(uint fixedRateAPY) external onlyOwner {
        require(dynamicRate,"Fixed Rate is already selected");  
        cumulativeRewardRate = newCumulativeRewardRate();
        lastUpdateTime = block.timestamp;
        fixedRate = fixedRateAPY; 
        dynamicRate = false;
        emit rateModeChanged("fixed");
    }

    /* @dev Switch from fixed to dynamic rate */
    function changeToDynamicRate() external onlyOwner {
        require(!dynamicRate,"Dynamic Rate is already selected");  
        cumulativeRewardRate = newCumulativeRewardRate();
        lastUpdateTime = block.timestamp;
        dynamicRate = false;
        emit rateModeChanged("dynamic");
    }

    /* @dev Turn compounding on or off  */
    function changeCompoundingMode() external onlyOwner {
        if(autocompounding == false){
            autocompounding = true;
        }
        else {
            autocompounding = false;
        }
        emit autocompoundingMode(autocompounding);
    }

    /* @dev  View method to find the current deposit and accumulated  rewards of a user */
    function getUserStakeAndRewards(address _user) public view returns(uint deposit,uint reward){
        uint staked = deposits[_user];
        uint currentUpdatedRewardRate = newCumulativeRewardRate();  
        uint rewards = rewardsEarned[msg.sender] + (staked*(currentUpdatedRewardRate - userCumulativeRewardRate[_user]))/MULTIPLIER;        
        return (staked,rewards);
    }

}
