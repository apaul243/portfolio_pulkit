const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, Contract } =require("ethers");

const DAY=60*60*24;
const MONTH=60*60*24*30;
const YEAR=60*60*24*365;

const MAX_INT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// STAKING PARAMS
const RATE=2000;
const MIN_STAKE=1000000000000000;


describe("STAKING contract tests", function () {
    let Owner, Other, Third;
    let OwnerAddress, OtherAddress, ThirdAddress;

    beforeEach(async ()=>{
      [Owner, Other, Third, TX, Treasury] = await ethers.getSigners();
      [OwnerAddress, OtherAddress, ThirdAddress]=await Promise.all([
         Owner.getAddress(),
         Other.getAddress(),
         Third.getAddress()
      ]);

      const [BoldFactory,TokenFactory,StakingFactory,MockAgregatorFactory] = await Promise.all([
         ethers.getContractFactory("BoldToken"),
         ethers.getContractFactory("SpoxToken"),
         ethers.getContractFactory("OFStaking"),
         ethers.getContractFactory("MockAgregatorV3")
      ]);
      //Deployment
      mockAgregator=await MockAgregatorFactory.deploy();
      boldContract=await BoldFactory.deploy();
      tokenContract=await TokenFactory.deploy();
      await boldContract.deployed();
      await tokenContract.deployed();
      stakingContract=await StakingFactory.deploy(
         tokenContract.address,
         boldContract.address,
         RATE,
         MIN_STAKE
      );
      await stakingContract.deployed();

      await boldContract.connect(Owner).allowContract(stakingContract.address);
      await tokenContract.connect(Owner).transfer(OtherAddress,"10000000000000000000");
      await tokenContract.connect(Other).approve(stakingContract.address,"10000000000000000000");

    });

    calculateInterest=function(amount,rate,days){
      return (BigNumber.from(amount).mul(rate).mul(days)).div(3650000);
    }
    
    it("Test initial PARAMS", async ()=> {
      [
         currentBold,
         currentToken,
         currentRate,
         currentMinStake,
         currentOwner,
         currentDayInSecs
     ]=await Promise.all([
        stakingContract.bold(),
        stakingContract.token(),
        stakingContract.rate(),
        stakingContract.minStakeAmount(),
        stakingContract.owner(),
        stakingContract.SECSINDAY()
     ])

     expect(currentBold).to.equal(boldContract.address);
     expect(currentToken).to.equal(tokenContract.address);
     expect(currentRate).to.equal(RATE);
     expect(currentMinStake).to.equal(MIN_STAKE);
     expect(currentOwner).to.equal(OwnerAddress);
     expect(currentDayInSecs).to.equal(DAY);
    });

    it("Test change OWNER by not OWNER", async ()=> {
      await expect(stakingContract.connect(Other).changeOwner(ThirdAddress))
      .to.be.revertedWith("STAKING - NOT OWNER");
    });

    it("Test change OWNER by OWNER", async ()=> {
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(stakingContract.connect(Owner).changeOwner(ThirdAddress))
      .to.emit(stakingContract, "changeOwnership")
      .withArgs(OwnerAddress,ThirdAddress,timestamp);

      let currentOwner=await stakingContract.owner();
      expect(currentOwner).to.equal(ThirdAddress);

    });

    it("Test change RATE by not OWNER", async ()=> {
      let newRate=3000;
      await expect(stakingContract.connect(Other).changeRate(newRate))
      .to.be.revertedWith("STAKING - NOT OWNER");
    });
    
    it("Test change RATE by OWNER", async ()=> {
      let newRate=3000;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(stakingContract.connect(Owner).changeRate(newRate))
      .to.emit(stakingContract, "newRate")
      .withArgs(RATE,newRate,timestamp);

      let currentRate=await stakingContract.rate();
      expect(currentRate).to.equal(currentRate);

    });

    it("Test enter amount below minimum", async ()=> {
      let amount=MIN_STAKE-1;
      await expect(stakingContract.connect(Other).enter(amount))
      .to.be.revertedWith("Stake amount should be greater than minimum stake amount");
    });

    it("Test ENTER amount", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      let currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).enter(amount))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(0,amount,0,timestamp);
      let newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      expect(newTokenBalance).to.equal(currentTokenBalance.sub(amount));

      let userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(0);
    });

    it("Test ENTER amount no funds", async ()=> {
      let amount=MIN_STAKE;
      await expect(stakingContract.connect(Third).enter(amount))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Test RE-ENTER amount", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();
      let currentTokenBalance,newTokenBalance;
      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).enter(amount))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(0,amount,0,timestamp);
      newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      expect(newTokenBalance).to.equal(currentTokenBalance.sub(amount));

      let userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(0);

      //RE ENTER
      timestamp+=DAY;
      let interest=calculateInterest(amount,RATE,1);
      //console.log("INterest: "+interest);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).enter(amount))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(amount,amount*2,interest,timestamp);
      newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      //console.log("newTokenBalance: "+newTokenBalance);
      //console.log("currentTokenBalance: "+currentTokenBalance);
      expect(newTokenBalance).to.equal(currentTokenBalance.sub(amount));

      userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount*2);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(interest);
    });

    it("Test GET CASHOUT", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();
          //TEST getCurrentCashout
      let currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(0);
      expect(currentCashout._CurrentInterest).to.equal(0);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await stakingContract.connect(Other).enter(amount*2);

      timestamp+=DAY;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let interest=calculateInterest(amount*2,RATE,1);
      await expect(stakingContract.connect(Other).enter(amount))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(amount*2,amount*3,interest,timestamp)

      timestamp+=DAY*30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine");
      interest=BigNumber.from(interest).add(calculateInterest(amount*3,RATE,30));
      currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(amount*3);
      expect(currentCashout._CurrentInterest).to.equal(interest);

      timestamp+=DAY*60;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      interest=BigNumber.from(interest).add(calculateInterest(amount*3,RATE,60));

      await stakingContract.connect(Other).leave(amount*2);
      currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(amount);
      expect(currentCashout._CurrentInterest).to.equal(0);

      timestamp+=DAY*60;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine");
      interest=calculateInterest(amount,RATE,60);
      currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(amount);
      expect(currentCashout._CurrentInterest).to.equal(interest);

      timestamp+=DAY*30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      interest=BigNumber.from(interest).add(calculateInterest(amount,RATE,30));

      await stakingContract.connect(Other).leave(amount);
      currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(0);
      expect(currentCashout._CurrentInterest).to.equal(0);  
    });

    
    it("Test CASHOUT", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      // User has not staked
      await expect(stakingContract.connect(Other).cashoutAllRewards())
      .to.be.revertedWith("User has no deposits");

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      // Enter an amount
      let currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).enter(amount))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(0,amount,0,timestamp);
      let newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      expect(newTokenBalance).to.equal(currentTokenBalance.sub(amount));

      //Wait 10 days and get rewards keeping amount staked
      timestamp+=DAY*10;
      let interest=calculateInterest(amount,RATE,10);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let currentBoldBalance=await boldContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).cashoutAllRewards())
      .to.emit(stakingContract, "retireAmount")
      .withArgs(amount,amount,interest,timestamp);
      let newBoldBalance=await boldContract.balanceOf(OtherAddress);
      expect(newBoldBalance).to.equal(currentBoldBalance.add(interest));

      let userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(0);

      //Cashout another time, but now no reward
      timestamp+=1; //A block has been created
      currentBoldBalance=await boldContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).cashoutAllRewards())
      .to.emit(stakingContract, "retireAmount")
      .withArgs(amount,amount,0,timestamp);
      newBoldBalance=await boldContract.balanceOf(OtherAddress);
      expect(newBoldBalance).to.equal(currentBoldBalance);
    });

    it("Test LEAVE  no funds", async ()=> {
      let amount=MIN_STAKE-1;

      await expect(stakingContract.connect(Other).leave(amount))
      .to.be.revertedWith("Share cannot be more than current deposits");
    });

    it("Test LEAVE  below  min amount", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await stakingContract.connect(Other).enter(amount);

      await expect(stakingContract.connect(Other).leave(amount-1))
      .to.be.revertedWith("Withdraw amount should be more than the minimum req amount");
    });

    it("Test LEAVE ", async ()=> {
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      //Enter amount 
      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await stakingContract.connect(Other).enter(amount*2);

      //Wait a Year
      timestamp+=YEAR;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let interest=calculateInterest(amount*2,RATE,365);

      // take out 50% of current staked funds
      let currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      let currentBoldBalance=await boldContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).leave(amount))
      .to.emit(stakingContract, "retireAmount")
      .withArgs(amount*2,amount,interest,timestamp);
      let newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      let newBoldBalance=await boldContract.balanceOf(OtherAddress);
      expect(newTokenBalance).to.equal(currentTokenBalance.add(amount));
      expect(newBoldBalance).to.equal(currentBoldBalance.add(interest));

      let userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(0);

      // Add amount * 2. As you add more funds interest is calculared for 1 day
      timestamp+=DAY;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      interest=calculateInterest(amount,RATE,1);
      await expect(stakingContract.connect(Other).enter(amount*2))
      .to.emit(stakingContract, "enterAmount")
      .withArgs(amount,amount*3,interest,timestamp);

      userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(amount*3);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(interest);  

      timestamp+=YEAR;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      interest = BigNumber.from(interest).add(calculateInterest(amount*3,RATE,365)); // Ad 1 year of interest to current interests
      //console.log("Interest "+interest);

      currentTokenBalance=await tokenContract.balanceOf(OtherAddress);
      currentBoldBalance=await boldContract.balanceOf(OtherAddress);
      await expect(stakingContract.connect(Other).leave(amount*3))
      .to.emit(stakingContract, "retireAmount")
      .withArgs(amount*3,0,interest,timestamp);
      newTokenBalance=await tokenContract.balanceOf(OtherAddress);
      newBoldBalance=await boldContract.balanceOf(OtherAddress);
      expect(newTokenBalance).to.equal(currentTokenBalance.add(amount*3));
      expect(newBoldBalance).to.equal(currentBoldBalance.add(interest));

      userInfo=await stakingContract.users(OtherAddress);
      expect(userInfo.balance).to.equal(0);
      expect(userInfo.timestamp).to.equal(timestamp);
      expect(userInfo.interestAccumulated).to.equal(0);

      await expect(stakingContract.connect(Other).leave(amount))
      .to.be.revertedWith("Share cannot be more than current deposits");
    });

    it("Test change rate ", async ()=> {
      let newRate=RATE*2;
      let amount=MIN_STAKE;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber();

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await stakingContract.connect(Other).enter(amount);

      timestamp+=DAY*30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine");
      let interest=calculateInterest(amount,RATE,30);
      let currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(amount);
      expect(currentCashout._CurrentInterest).to.equal(interest);

      //Rate changed
      timestamp+=DAY*30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine");
      await stakingContract.connect(Owner).changeRate(newRate);
      interest=calculateInterest(amount,newRate,60); //Calculate with new rate
      currentCashout=await stakingContract.getCurrentCashout(OtherAddress);
      expect(currentCashout._deposit).to.equal(amount);
      expect(currentCashout._CurrentInterest).to.equal(interest);

    });
});