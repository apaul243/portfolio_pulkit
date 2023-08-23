const { expect } = require("chai");
const { ethers} = require("hardhat");
const { BigNumber, Contract } =require("ethers");



const EV_CLAIM=1;  
const EV_BEAR=4;  
const EV_BULL=5;  
const EV_CLAIM_BONUS=1;
const EV_RESULT=11;
POSITION={
   BULL:0,
   BEAR:1
}
let epoch=0;

// Equivalence Formula
const priceRatio=3221780; //3221.78
const ratio = 1000000;
const decimals = 3;
const kink1 = "20000000000000000"; //0,02 in wei
const A1 =500;
const C1 =7760;
const kink2 = "30000000000000000"; //0,03 in wei
const A2 =100;
const C2 =20180;
const maxError=500; //0.005% max error

describe("PREDICTIONS HOUSE contract tests", function () {
    let Owner, Other, Third, Admin, Operator, Coordinator, UserBet1, UserBet2;
    let OwnerAddress, OtherAddress, ThirdAddress;

    const intervalSeconds = 300,
    minBetAmount = 1000000000000000,
    oracleUpdateAllowance = 300,
    treasuryFee = 100;
    bufferSeconds=100;
    feeAmount= "0750000000000000000" //0.75 usdc


    beforeEach(async ()=>{
        [Owner, Other, Third, Admin, Operator,Coordinator,UserBet1, UserBet2,TX, Treasury] = await ethers.getSigners();
        [
           OwnerAddress, 
           OtherAddress, 
           ThirdAddress,
           AdminAddress, 
           OperatorAddress,
           CoordinatorAddress, 
           UserBet1Address, 
           UserBet2Address,
           TXAddress,
           TreasuryAddress
         ]=await Promise.all([
            Owner.getAddress(),
            Other.getAddress(),
            Third.getAddress(),
            Admin.getAddress(),
            Operator.getAddress(),
            Coordinator.getAddress(),
            UserBet1.getAddress(),
            UserBet2.getAddress(),
            TX.getAddress(),
            Treasury.getAddress()
        ]);

        const [FactoryEquivalence,FactoryRouter, FactoryToken,FactoryBold,FactoryPredictions,FactoryMockAgregatorV3] = await Promise.all([
           ethers.getContractFactory("EquivalenceFormula"),
           ethers.getContractFactory("Router"),
           ethers.getContractFactory("SpoxToken"),
           ethers.getContractFactory("BoldToken"),
           ethers.getContractFactory("PredictionsHouse"),
           ethers.getContractFactory("MockAgregatorV3")
        ]);
        //Deployment
        mockAgregator=await FactoryMockAgregatorV3.deploy();
        equivalenceContract = await FactoryEquivalence.deploy(
         priceRatio,
            ratio,
            decimals,
            kink1,
            A1,
            C1,
            kink2,
            A2,
            C2
         );
        tokenContract=await FactoryToken.deploy();
        await equivalenceContract.deployed();
        routerContract=await FactoryRouter.deploy(equivalenceContract.address);
        await routerContract.deployed();
        boldContract=await FactoryBold.connect(Admin).deploy();
        await boldContract.deployed();
        await tokenContract.deployed();

        predictionContract=await FactoryPredictions.deploy(
            mockAgregator.address,
            AdminAddress,
            OperatorAddress,
            intervalSeconds,
            bufferSeconds,
            minBetAmount,
            oracleUpdateAllowance,
            treasuryFee,
            boldContract.address,
            routerContract.address,
            tokenContract.address,
            feeAmount
        );
        await tokenContract.deployed();

        //Allowances
        await Promise.all([
         tokenContract.connect(Owner).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(Other).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(Third).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(UserBet1).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(UserBet2).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Owner).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Other).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Third).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(UserBet1).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(UserBet2).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        ]);

         //Initial funds
         await Promise.all([
            boldContract.connect(Admin).transfer(UserBet1Address,"10000000000000000000"),
            boldContract.connect(Admin).transfer(UserBet2Address,"10000000000000000000"),
         ]);

        //Allow Cointoss to use Router contract
        await routerContract.allowContract(predictionContract.address);

        // Initialize router
        await routerContract.setTreasuryWallet(TreasuryAddress);
        await routerContract.setTxFeeWallet(TXAddress);
        await routerContract.setTreasuryToken(boldContract.address);
        await routerContract.setTreasuryFee(75);
        await routerContract.setPredictionToken(boldContract.address);
        //Allow ROuter to mint/burn
        await boldContract.connect(Admin).allowContract(routerContract.address);

    });
    
    it("Test initial params", async ()=> {
       [
          currentOracle,
          currentAdminAddress,
          currentOperatorAddress,
          currentintervalSeconds,
          currentbufferSeconds,
          currentminBetAmount,
          currentoracleUpdateAllowance,
          currenttreasuryFee,
          currenttokenAddress,
          currentrouterAddress,
          currentFeeToken,
          currentFeeAmount,
      ]=await Promise.all([
         predictionContract.oracle(),
         predictionContract.adminAddress(),
         predictionContract.operatorAddress(),
         predictionContract.intervalSeconds(),
         predictionContract.bufferSeconds(),
         predictionContract.minBetAmount(),
         predictionContract.oracleUpdateAllowance(),
         predictionContract.treasuryFee(),
         predictionContract.tokenAddress(),
         predictionContract.routerContract(),
         predictionContract.feeToken(),
         predictionContract.feeAmount()
      ])

      expect(currentOracle).to.equal( mockAgregator.address);
      expect(currentAdminAddress).to.equal(AdminAddress);
      expect(currentOperatorAddress).to.equal(OperatorAddress);
      expect(currentintervalSeconds).to.equal(intervalSeconds);
      expect(currentbufferSeconds).to.equal(bufferSeconds);
      expect(currentminBetAmount).to.equal(minBetAmount);
      expect(currentoracleUpdateAllowance).to.equal(oracleUpdateAllowance);
      expect(currenttreasuryFee).to.equal(treasuryFee);
      expect(currenttokenAddress).to.equal(boldContract.address);
      expect(currentrouterAddress).to.equal(routerContract.address);
      expect(currentFeeToken).to.equal(tokenContract.address);
      expect(currentFeeAmount).to.equal(feeAmount);
      
   });

   it("Test Mock Agregator", async ()=> {
      let roundId=10,
      answer=1000,
      updatedAt=120000;
      await mockAgregator.setOracleParameters(roundId, answer,updatedAt);

      let currentroundId=await mockAgregator.roundId();
      let currentanswer=await mockAgregator.answer();   
      let currentupdatedAt=await mockAgregator.updatedAt();

      expect(currentroundId).to.eq(roundId);
      expect(currentanswer).to.eq(answer);
      expect(currentupdatedAt).to.eq(updatedAt);

      let lastRound=await mockAgregator.latestRoundData();
      expect(lastRound[0]).to.eq(roundId);
      expect(lastRound[1]).to.eq(answer);
      expect(lastRound[3]).to.eq(updatedAt);
   
   });

   // ***************************************************************
   //                   PAUSING
   // ***************************************************************

   it("Test PAUSE when PAUSED", async ()=> {
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(1);

      await expect(predictionContract.connect(Admin).pause())
         .to.be.revertedWith('Pausable: paused');
   });

   it("Test PAUSE ADMIN", async ()=> {
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(1);
   });

   it("Test PAUSE not ADMIN", async ()=> {
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.pause())
         .to.be.revertedWith('Not operator/admin');
   });

   it("Test UNPAUSE not paused", async ()=> {
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.unpause())
         .to.be.revertedWith('Pausable: not paused');
   });

   it("Test UNPAUSE not ADMIN", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      timestamp+=intervalSeconds+8;
      roundId=(await predictionContract.oracleLatestRoundId()).add(10);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await predictionContract.connect(Operator).genesisLockRound();

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(2);

      await expect(predictionContract.unpause())
         .to.be.revertedWith('Not admin');
   });

   it("Test UNPAUSE ADMIN", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      await expect(predictionContract.connect(Operator).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      timestamp+=intervalSeconds+8;
      roundId=(await predictionContract.oracleLatestRoundId()).add(10);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await predictionContract.connect(Operator).genesisLockRound();

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(2);

      await expect(predictionContract.connect(Admin).unpause())
      .to.emit(predictionContract, "Unpause")
      .withArgs(2);

      await expect(predictionContract.connect(Operator).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound and genesisLockRound is triggered');
   });

      // ***************************************************************
      //                   ROUND GENERATION PROCESS
      // ***************************************************************

      it("Test EXECUTEROUND no operator/admin", async ()=> {
         await expect(predictionContract.executeRound())
        .to.be.revertedWith('Not operator/admin');
      });

      it("Test EXECUTEROUND no genesis start round", async ()=> {
         await expect(predictionContract.connect(Admin).executeRound())
         .to.be.revertedWith('Can only run after genesisStartRound and genesisLockRound is triggered');

        await expect(predictionContract.connect(Operator).executeRound())
        .to.be.revertedWith('Can only run after genesisStartRound and genesisLockRound is triggered');
      });

      it("Test EXECUTEROUND GenesisRound ADMIN", async ()=> {
         let blockInfo=await mockAgregator.getBlockInfo();

         let timestamp=blockInfo.blockTimestamp.toNumber()+2;

          //Set next block timestamp
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
         await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);

         let currentEpoch=await predictionContract.currentEpoch();
         expect(currentEpoch).to.eq(1);


         let round=await predictionContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds*2);
         expect(round.lockTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(1);
         expect(round.totalAmount).to.eq(0);

         let genesisStartOnce=await predictionContract.genesisStartOnce();
         expect(genesisStartOnce).to.be.true;

         let genesisLockOnce=await predictionContract.genesisLockOnce();
         expect(genesisLockOnce).to.be.false;
      });

      it("Test EXECUTEROUND GenesisRound OPERATOR", async ()=> {
         let blockInfo=await mockAgregator.getBlockInfo();

         let timestamp=blockInfo.blockTimestamp.toNumber()+2;

          //Set next block timestamp
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);

         let currentEpoch=await predictionContract.currentEpoch();
         expect(currentEpoch).to.eq(1);


         let round=await predictionContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds*2);
         expect(round.lockTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(1);
         expect(round.totalAmount).to.eq(0);

         let genesisStartOnce=await predictionContract.genesisStartOnce();
         expect(genesisStartOnce).to.be.true;

         let genesisLockOnce=await predictionContract.genesisLockOnce();
         expect(genesisLockOnce).to.be.false;
      });

      it("Test EXECUTEROUND LockRound ADMIN", async ()=> {
         let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         roundId=(await predictionContract.oracleLatestRoundId()).add(10);
         await predictionContract.connect(Admin).genesisLockRound();

         let currentEpoch=await predictionContract.currentEpoch();
         expect(currentEpoch).to.eq(2);

         round=await predictionContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds*2);
         expect(round.lockTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(2);
         expect(round.totalAmount).to.eq(0);

         round=await predictionContract.rounds(currentEpoch-1);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.lockPrice).to.eq(answer);

         let genesisStartOnce=await predictionContract.genesisLockOnce();
         expect(genesisStartOnce).to.be.true;

      });

      it("Test EXECUTEROUND LockRound OPERATOR", async ()=> {
         let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         roundId=(await predictionContract.oracleLatestRoundId()).add(10);
         await predictionContract.connect(Operator).genesisLockRound();

         let currentEpoch=await predictionContract.currentEpoch();
         expect(currentEpoch).to.eq(2);

         round=await predictionContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds*2);
         expect(round.lockTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(2);
         expect(round.totalAmount).to.eq(0);

         round=await predictionContract.rounds(currentEpoch-1);
         expect(round.closeTimestamp.toNumber()).to.eq(timestamp+intervalSeconds);
         expect(round.lockPrice).to.eq(answer);

         let genesisStartOnce=await predictionContract.genesisLockOnce();
         expect(genesisStartOnce).to.be.true;

      });

      it("Test EXECUTEROUND GenesisRound previously called ADMIN", async ()=> {
         
         await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);

         await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.be.revertedWith('Can only run genesisStartRound once');
      });

      it("Test EXECUTEROUND GenesisRound previously called OPERATOR", async ()=> {
         
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);

         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.be.revertedWith('Can only run genesisStartRound once');
      });

      it("Test EXECUTEROUND LockRound previously called ADMIN", async ()=> {
         let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         await predictionContract.connect(Operator).genesisLockRound();

            
         await mockAgregator.setOracleParameters(roundId+1,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

         await expect(predictionContract.connect(Admin).genesisLockRound())
         .to.be.revertedWith('Can only run genesisLockRound once');
      
      });

      it("Test EXECUTEROUND LockRound previously called OPERATOR", async ()=> {
         let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         await predictionContract.connect(Operator).genesisLockRound();

            
         await mockAgregator.setOracleParameters(roundId+1,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

         await expect(predictionContract.connect(Operator).genesisLockRound())
         .to.be.revertedWith('Can only run genesisLockRound once');
      
      });

      it("Test EXECUTEROUND before round ends ADMIN", async ()=> {
         let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         await predictionContract.connect(Admin).genesisLockRound();

         roundId++;
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);

         timestamp+=10;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

         await expect(predictionContract.connect(Admin).executeRound())
         .to.be.revertedWith('Can only lock round after lockTimestamp');

     });

     it("Test EXECUTEROUND before round ends OPERATOR", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
         let blockInfo=await mockAgregator.getBlockInfo();
         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
         let round;
         
         await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
           
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);
         timestamp+=intervalSeconds+8;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         await predictionContract.connect(Operator).genesisLockRound();

         roundId++;
         await mockAgregator.setOracleParameters(roundId,answer,timestamp);

         timestamp+=10;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

         await expect(predictionContract.connect(Operator).executeRound())
         .to.be.revertedWith('Can only lock round after lockTimestamp');
   });

   it("Test EXECUTEROUND after round ends ADMIN", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();

      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);;

      roundId++;
      timestamp+=8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);

      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer);
      // EndRound(epoch, roundId, round.closePrice);

  });

  it("Test EXECUTEROUND after round ends OPERATOR", async ()=> {
   let roundId=1,answer="100000000000000000000",updatedAt=2;
   let blockInfo=await mockAgregator.getBlockInfo();
   let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   let round;
   
   // Genesis round - 1
   await expect(predictionContract.connect(Operator).genesisStartRound())
   .to.emit(predictionContract, "StartRound")
   .withArgs(1);
   
   // Genesis Lockround - 2
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await predictionContract.connect(Operator).genesisLockRound();

   roundId++;
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);;

   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);

   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Operator).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer);
   // EndRound(epoch, roundId, round.closePrice);
   });

   it("Test EXECUTEROUND after bufferSeconds ADMIN", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
        
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();

      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);

      timestamp+=intervalSeconds+bufferSeconds+1000;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(predictionContract.connect(Admin).executeRound())
      .to.be.revertedWith('Can only lock round within bufferSeconds');
  });

  it("Test EXECUTEROUND after bufferSeconds OPERATOR", async ()=> {
   let roundId=1,answer="100000000000000000000",updatedAt=2;
   let blockInfo=await mockAgregator.getBlockInfo();
   let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   let round;
   
   await expect(predictionContract.connect(Operator).genesisStartRound())
   .to.emit(predictionContract, "StartRound")
   .withArgs(1);
     
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);
   timestamp+=intervalSeconds+8;
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await predictionContract.connect(Admin).genesisLockRound();

   roundId++;
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);
   timestamp+=intervalSeconds+8;
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

   roundId++;
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);

   timestamp+=intervalSeconds+bufferSeconds+1000;
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

   await expect(predictionContract.connect(Operator).executeRound())
   .to.be.revertedWith('Can only lock round within bufferSeconds');
});

   it("Test EXECUTEROUND round paused ADMIN", async ()=> {
      let blockInfo=await mockAgregator.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
      //console.log("Current timestamp: "+timestamp);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Admin).executeRound())
        .to.be.revertedWith('Pausable: paused');
   });

   it("Test EXECUTEROUND round paused OPERATOR", async ()=> {
      let blockInfo=await mockAgregator.getBlockInfo();
      
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
      //console.log("Current timestamp: "+timestamp);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Operator).executeRound())
        .to.be.revertedWith('Pausable: paused');
   });

   it("Test EXECUTEROUND round unpause ADMIN", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Admin).executeRound())
        .to.be.revertedWith('Pausable: paused');

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).unpause();

      await expect(predictionContract.connect(Admin).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound and genesisLockRound is triggered');

      await expect(predictionContract.connect(Admin).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(2);

      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
      round=await predictionContract.currentEpoch();

      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer);

   });

   it("Test EXECUTEROUND round unpause OPERATOR", async ()=> {
      let roundId=1,answer="100000000000000000000",updatedAt=2;
      let blockInfo=await mockAgregator.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(1);
      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Operator).executeRound())
        .to.be.revertedWith('Pausable: paused');

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).unpause();

      await expect(predictionContract.connect(Operator).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound and genesisLockRound is triggered');

      await expect(predictionContract.connect(Operator).genesisStartRound())
         .to.emit(predictionContract, "StartRound")
         .withArgs(2);

      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Operator).genesisLockRound();
      round=await predictionContract.currentEpoch();
      
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Operator).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer);

   });


   it("Test EXECUTE BEAR", async ()=> {
      let roundId=1,answer=1000000,updatedAt=2;
   let blockInfo=await mockAgregator.getBlockInfo();
   let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   let round;
   
   // Genesis round - 1
   await expect(predictionContract.connect(Admin).genesisStartRound())
   .to.emit(predictionContract, "StartRound")
   .withArgs(1);
   
   // Genesis Lockround - 2
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await predictionContract.connect(Admin).genesisLockRound();

   roundId++;
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);;

   // Round 3
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer+3000);
   round=await predictionContract.currentEpoch();

   // Round 4
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer-1000,timestamp);
   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer-1000);
   round=await predictionContract.currentEpoch();

   // Round 5
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer-2000,timestamp);

   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer-2000);
   round=await predictionContract.currentEpoch();
   expect(round).to.eq(5)

   let closedRound=await predictionContract.rounds(round-2); // closed
   let lockedRound=await predictionContract.rounds(round-1); // Locked for bettning
   let nextRound=await predictionContract.rounds(round); // Open for betting
   expect(closedRound.closePrice).to.eq(answer-2000);
   expect(closedRound.oracleCalled).to.be.true;
   
   expect(lockedRound.closeTimestamp).to.eq(timestamp+intervalSeconds);
   expect(lockedRound.lockPrice).to.eq(answer-2000);

   expect(nextRound.startTimestamp).to.eq(timestamp);
   expect(nextRound.lockTimestamp).to.eq(timestamp+intervalSeconds);
   expect(nextRound.closeTimestamp).to.eq(timestamp+2*intervalSeconds);
   expect(nextRound.totalAmount).to.eq(0);
   });

   it("Test EXECUTE BULL", async ()=> {
      let roundId=1,answer=1000000,updatedAt=2;
   let blockInfo=await mockAgregator.getBlockInfo();
   let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   let round;
   
   // Genesis round - 1
   await expect(predictionContract.connect(Admin).genesisStartRound())
   .to.emit(predictionContract, "StartRound")
   .withArgs(1);
   
   // Genesis Lockround - 2
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await predictionContract.connect(Admin).genesisLockRound();

   roundId++;
   await mockAgregator.setOracleParameters(roundId,answer,timestamp);;

   // Round 3
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer-1000,timestamp);
   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer-1000);
   round=await predictionContract.currentEpoch();

   // Round 4
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer+2000,timestamp);
   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer+2000);
   round=await predictionContract.currentEpoch();

   // Round 5
   roundId++;
   timestamp+=8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await mockAgregator.setOracleParameters(roundId,answer+5000,timestamp);

   round=await predictionContract.currentEpoch();
   timestamp+=intervalSeconds+8;
   //console.log("Timestamp: "+timestamp)
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
   await expect(predictionContract.connect(Admin).executeRound())
   .to.emit(predictionContract, "EndRound")
   .withArgs(round-1,roundId,answer+5000);
   round=await predictionContract.currentEpoch();
   expect(round).to.eq(5)

   let closedRound=await predictionContract.rounds(round-2); // closed
   let lockedRound=await predictionContract.rounds(round-1); // Locked for bettning
   let nextRound=await predictionContract.rounds(round); // Open for betting
   expect(closedRound.closePrice).to.eq(answer+5000);
   expect(closedRound.oracleCalled).to.be.true;
   
   expect(lockedRound.closeTimestamp).to.eq(timestamp+intervalSeconds);
   expect(lockedRound.lockPrice).to.eq(answer+5000);

   expect(nextRound.startTimestamp).to.eq(timestamp);
   expect(nextRound.lockTimestamp).to.eq(timestamp+intervalSeconds);
   expect(nextRound.closeTimestamp).to.eq(timestamp+2*intervalSeconds);
   expect(nextRound.totalAmount).to.eq(0);
   });

   // ***************************************************************
   //                   CLAIM TREASURY
   // ***************************************************************

   // Fully tested on BETTING - CLAIM
   it("Test CLAIMTREASURY not ADMIN", async ()=> {
      await expect(predictionContract.claimTreasury())
      .to.be.revertedWith('Not admin');
   });

   it("Test CLAIMTREASURY ADMIN", async ()=> {;
      // full tested in CLAIM section
      await expect(predictionContract.connect(Admin).claimTreasury())
      .to.emit(predictionContract, "TreasuryClaim")
      .withArgs(0);
   });

    // ***************************************************************
   //                   CHANGE BUFFER AND INTERVAL SECONDS
   // ***************************************************************


   it("Test BUFFER AND INTERVAL not PAUSED", async ()=> {;
      let buffer=100;
      let interval=600;
      let currentBuffer= await predictionContract.bufferSeconds();
      let currentInterval= await predictionContract.intervalSeconds();
      expect(currentBuffer).to.eq(bufferSeconds);
      expect(currentInterval).to.eq(intervalSeconds);

      await expect(predictionContract.connect(Admin).setBufferAndIntervalSeconds(buffer,interval))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test BUFFER AND INTERVAL not ADMIN", async ()=> {;
      let buffer=100;
      let interval=600;
      let currentBuffer= await predictionContract.bufferSeconds();
      let currentInterval= await predictionContract.intervalSeconds();
      expect(currentBuffer).to.eq(bufferSeconds);
      expect(currentInterval).to.eq(intervalSeconds);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.connect(Other).setBufferAndIntervalSeconds(buffer,interval))
      .to.be.revertedWith('Not admin');
   });

   it("Test BUFFER AND INTERVAL ADMIN", async ()=> {;
      let buffer=200;
      let interval=600;
      let currentBuffer= await predictionContract.bufferSeconds();
      let currentInterval= await predictionContract.intervalSeconds();
      expect(currentBuffer).to.eq(bufferSeconds);
      expect(currentInterval).to.eq(intervalSeconds);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await predictionContract.connect(Admin).setBufferAndIntervalSeconds(buffer,interval);
      let newBuffer= await predictionContract.bufferSeconds();
      let newInterval= await predictionContract.intervalSeconds();
      expect(newBuffer).to.eq(buffer);
      expect(newInterval).to.eq(interval);

   });


   // ***************************************************************
   //                   MIN BET AMOUNT
   // ***************************************************************


   it("Test MINBETAMOUNT not PAUSED", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await predictionContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(predictionContract.connect(Admin).setMinBetAmount(newMInBetAmount))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test MINBETAMOUNT not ADMIN", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await predictionContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.setMinBetAmount(newMInBetAmount))
      .to.be.revertedWith('Not admin');
   });

   it("Test MINBETAMOUNT ADMIN", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await predictionContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.connect(Admin).setMinBetAmount(newMInBetAmount))
      .to.emit(predictionContract, "NewMinBetAmount")
      .withArgs(0,newMInBetAmount);
   });

   // ***************************************************************
   //                   OPERATOR MANAGEMENT
   // ***************************************************************


   it("Test OPERATOR not ADMIN", async ()=> {;
      let currentOperator=await predictionContract.operatorAddress();
      expect(currentOperator).to.eq(OperatorAddress);

      await expect(predictionContract.setOperator(OtherAddress))
      .to.be.revertedWith('Not admin');
   });

   it("Test OPERATOR ADMIN", async ()=> {;
      let currentOperator=await predictionContract.operatorAddress();
      expect(currentOperator).to.eq(OperatorAddress);

      await expect(predictionContract.connect(Admin).setOperator(OtherAddress))
      .to.emit(predictionContract, "NewOperatorAddress")
      .withArgs(OtherAddress);
   });

   // ***************************************************************
   //                   ORACLE ALLOWANCE
   // ***************************************************************


   it("Test ORACLEUPDATEALLOWANCE not PAUSED", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await predictionContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(predictionContract.connect(Admin).setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test ORACLEUPDATEALLOWANCE not ADMIN", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await predictionContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.be.revertedWith('Not admin');
   });

   it("Test ORACLEUPDATEALLOWANCE ADMIN", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await predictionContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.connect(Admin).setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.emit(predictionContract, "NewOracleUpdateAllowance")
      .withArgs(newOracleUpdateAllowance);

      let updatedOracleUpdateAllowance= await predictionContract.oracleUpdateAllowance();
      expect(updatedOracleUpdateAllowance).to.eq(newOracleUpdateAllowance);
   });

   // ***************************************************************
   //                   TREASURY FEE
   // ***************************************************************


   it("Test SETTREASURYFEE not PAUSED", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await predictionContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(predictionContract.connect(Admin).setTreasuryFee(newTreasuryFee))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test SETTREASURYFEE not ADMIN", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await predictionContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.setTreasuryFee(newTreasuryFee))
      .to.be.revertedWith('Not admin');
   });

   it("Test SETTREASURYFEE ADMIN", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await predictionContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.connect(Admin).setTreasuryFee(newTreasuryFee))
      .to.emit(predictionContract, "NewTreasuryFee")
      .withArgs(0,newTreasuryFee);

      let updatedTreasuryFee= await predictionContract.treasuryFee();
      expect(updatedTreasuryFee).to.eq(newTreasuryFee);
   });


   // ***************************************************************
   //                   MAKE ROUND REFUNDABLE
   // ***************************************************************

   // Fully tested on Betting Claim
   it("Test MAKEREFUNDABLE not PAUSED", async ()=> {;

      await expect(predictionContract.connect(Admin).makeRefundable(0))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test MAKEREFUNDABLE not ADMIN", async ()=> {
      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await expect(predictionContract.makeRefundable(0))
      .to.be.revertedWith('Not admin');
   });

   it("Test MAKEREFUNDABLE ADMIN", async ()=> {;
      await expect(predictionContract.connect(Admin).pause())
      .to.emit(predictionContract, "Pause")
      .withArgs(0);

      await predictionContract.connect(Admin).makeRefundable(0);
      let round=await predictionContract.rounds(0);
      
      expect(round.ifRefundable).to.be.true;
   });

   // ***************************************************************
   //                   RECOVER 
   // ***************************************************************


   it("Test RECOVERTOKEN not OWNER", async ()=> {
      await expect(predictionContract.connect(Other).recoverToken(tokenContract.address,1))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test RECOVERTOKEN ADMIN", async ()=> {
      let amount=1000000;
      await tokenContract.connect(Owner).transfer(predictionContract.address,amount);

      let initialOwnerBalance=await tokenContract.balanceOf(OwnerAddress);
      await expect(predictionContract.connect(Owner).recoverToken(tokenContract.address,amount))
      .to.emit(predictionContract, "TokenRecovery")
      .withArgs(tokenContract.address,amount);

      
      let cointossBalance=await tokenContract.balanceOf(predictionContract.address);
      let ownerBalance=await tokenContract.balanceOf(OwnerAddress);
      expect(cointossBalance).to.eq(0);
      expect(ownerBalance).to.eq(initialOwnerBalance.add(amount));


   });

   // ***************************************************************
   //                   MANAGE ADMIN ADDRESS
   // ***************************************************************


   it("Test SETADMIN not OWNER", async ()=> {
      await expect(predictionContract.connect(Admin).setAdmin(ThirdAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test SETADMIN ZERO ADDRESS", async ()=> {
      let zeroAddress="0x0000000000000000000000000000000000000000";
      await expect(predictionContract.connect(Owner).setAdmin(zeroAddress))
      .to.be.revertedWith('Cannot be zero address');
   });

   it("Test SETADMIN OWNER", async ()=> {
      await expect(predictionContract.connect(Owner).setAdmin(ThirdAddress))
      .to.emit(predictionContract, "NewAdminAddress")
      .withArgs(ThirdAddress);
   });

   // ***************************************************************
   //                   BETTING
   // ***************************************************************

   it("Test BET BULL wrong epoch", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      await expect(predictionContract.connect(UserBet1).betBull(0,betAmount))
      .to.be.revertedWith('Round not bettable');
      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');

      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(UserBet1).betBull(0,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet1Address,1,betAmount);
      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBull(2,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet1Address,2,betAmount);

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet2).betBull(2,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet2).betBull(3,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet2Address,3,betAmount);
   });

   it("Test BET BULL not betteable", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      await expect(predictionContract.connect(UserBet1).betBull(0,betAmount))
      .to.be.revertedWith('Round not bettable');

      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(UserBet1).betBull(0,betAmount))
      .to.be.revertedWith('Bet is too early/late');
       await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet1Address,1,betAmount);
      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBull(2,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet1Address,2,betAmount);

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet2).betBull(2,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet2).betBull(3,betAmount))
      .to.emit(predictionContract, "BetBull")
      .withArgs(UserBet2Address,3,betAmount);


      timestamp+=intervalSeconds+50;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(UserBet1).betBull(3,betAmount))
      .to.be.revertedWith('Round not bettable');
   });


   it("Test BET BULL single bet router event", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      
      // Genesis round - 1
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      timestamp+=30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let initialBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
       await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_BULL,
         predictionContract.address,
         UserBet1Address,
         1,
         betAmount,
         timestamp);
      let balanceTreasury=await tokenContract.balanceOf(routerContract.address);
      expect(balanceTreasury).to.eq(BigNumber.from(initialBalanceTreasury).add(feeAmount));
      let currentEpoch=await predictionContract.currentEpoch();
      let round=await predictionContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.bullAmount).to.eq(betAmount);
      expect(round.bearAmount).to.eq(0);
      
      let betInfo=await predictionContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BULL);
      expect(betInfo.amount).to.eq(betAmount);

   });

   it("Test BET BULL double bet", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      let initialBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
      await predictionContract.connect(UserBet1).betBull(1,betAmount);
      await predictionContract.connect(UserBet1).betBull(1,betAmount);
      let balanceTreasury=await tokenContract.balanceOf(routerContract.address);
      let fees=BigNumber.from(feeAmount).mul(2);
      expect(balanceTreasury).to.eq(BigNumber.from(initialBalanceTreasury).add(fees));

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BULL);
      expect(betInfo.amount).to.eq(betAmount*2);
   });

   it("Test BET BULL double bet different bets", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()


      await predictionContract.connect(UserBet1).betBull(1,betAmount);
      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.be.revertedWith('Can only bet on the same side');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BULL);
      expect(betInfo.amount).to.eq(betAmount*1);
      
   });


   it("Test BET BULL amount lower than min bet amount", async ()=> {
      let betAmount=minBetAmount-1;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.be.revertedWith('Bet amount must be greater than minBetAmount');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   it("Test BET BULL not enought funds", async ()=> {
      tokenContract.transfer(Other.address,"1000000000000000000000000");
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await expect(predictionContract.connect(Other).betBull(1,betAmount))
      .to.be.revertedWith('User has not enought funds');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   it("Test BET BULL paused", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Other).betBull(1,betAmount))
      .to.be.revertedWith('Pausable: paused');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   it("Test BET BEAR wrong epoch", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      await expect(predictionContract.connect(UserBet1).betBear(0,betAmount))
      .to.be.revertedWith('Round not bettable');
      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');

      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(UserBet1).betBear(0,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet1Address,1,betAmount);
      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBear(2,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet1Address,2,betAmount);

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet2).betBear(2,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet2).betBear(3,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet2Address,3,betAmount);
   });

   it("Test BET BEAR not betteable", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      await expect(predictionContract.connect(UserBet1).betBear(0,betAmount))
      .to.be.revertedWith('Round not bettable');
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await expect(predictionContract.connect(UserBet1).betBear(0,betAmount))
      .to.be.revertedWith('Bet is too early/late');
       await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet1Address,1,betAmount);
      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet1).betBear(2,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet1Address,2,betAmount);

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet2).betBear(2,betAmount))
      .to.be.revertedWith('Bet is too early/late');
      await expect(predictionContract.connect(UserBet2).betBear(3,betAmount))
      .to.emit(predictionContract, "BetBear")
      .withArgs(UserBet2Address,3,betAmount);


      timestamp+=intervalSeconds+50;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(UserBet1).betBear(3,betAmount))
      .to.be.revertedWith('Round not bettable');
   });


   it("Test BET BEAR single bet router event", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      
      // Genesis round - 1
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      timestamp+=30;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let initialBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
       await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_BEAR,
         predictionContract.address,
         UserBet1Address,
         1,
         betAmount,
         timestamp);
      let balanceTreasury=await tokenContract.balanceOf(routerContract.address);
      expect(balanceTreasury).to.eq(BigNumber.from(initialBalanceTreasury).add(feeAmount));
      let currentEpoch=await predictionContract.currentEpoch();
      let round=await predictionContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.bullAmount).to.eq(0);
      expect(round.bearAmount).to.eq(betAmount);
      
      let betInfo=await predictionContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BEAR);
      expect(betInfo.amount).to.eq(betAmount);

   });

   it("Test BET BEAR double bet", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      let initialBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
      await predictionContract.connect(UserBet1).betBear(1,betAmount);
      await predictionContract.connect(UserBet1).betBear(1,betAmount);
      let balanceTreasury=await tokenContract.balanceOf(routerContract.address);
      let fees=BigNumber.from(feeAmount).mul(2);
      expect(balanceTreasury).to.eq(BigNumber.from(initialBalanceTreasury).add(fees));

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BEAR);
      expect(betInfo.amount).to.eq(betAmount*2);
   });

   it("Test BET BEAR double bet different bets", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()


      await predictionContract.connect(UserBet1).betBear(1,betAmount);
      await expect(predictionContract.connect(UserBet1).betBull(1,betAmount))
      .to.be.revertedWith('Can only bet on the same side');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.BEAR);
      expect(betInfo.amount).to.eq(betAmount*1);
      
   });


   it("Test BET BEAR amount lower than min bet amount", async ()=> {
      let betAmount=minBetAmount-1;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await expect(predictionContract.connect(UserBet1).betBear(1,betAmount))
      .to.be.revertedWith('Bet amount must be greater than minBetAmount');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   it("Test BET BEAR not enought funds", async ()=> {
      tokenContract.transfer(Other.address,"1000000000000000000000000");

      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await expect(predictionContract.connect(Other).betBear(1,betAmount))
      .to.be.revertedWith('User has not enought funds');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   it("Test BET BEAR paused", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let round;
      
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);
      round=await predictionContract.currentEpoch()

      await predictionContract.connect(Admin).pause();

      await expect(predictionContract.connect(Other).betBear(1,betAmount))
      .to.be.revertedWith('Pausable: paused');

      let betInfo=await predictionContract.ledger(round,UserBet1Address);
      expect(betInfo.amount).to.eq(0);
      
   });

   // // ***************************************************************
   // //                   BETTING - GET USER BETS FROM CONTRACT
   // // ***************************************************************

   it("Test BET BULL user rounds length", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)

      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBull(2,betAmount)
      await predictionContract.connect(UserBet2).betBull(2,betAmount)

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBull(3,betAmount)
      await predictionContract.connect(UserBet1).betBull(3,betAmount)

      let userRounds1=await predictionContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await predictionContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(3);
      expect(userRounds2).to.equal(1);
   });

   it("Test BET BULL user rounds", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)

      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBull(2,betAmount)
      await predictionContract.connect(UserBet1).betBull(2,betAmount)
      await predictionContract.connect(UserBet2).betBull(2,betAmount)

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBull(3,betAmount)
      await predictionContract.connect(UserBet1).betBull(3,betAmount)

      let userRounds1=await predictionContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await predictionContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(3);
      expect(userRounds2).to.equal(1);


      let rounds2;
      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(1);
      expect(rounds2[0][0]).to.equal(2);
      expect(rounds2[1].length).to.equal(1);
      expect(rounds2[1][0].length).to.equal(3);
      expect(rounds2[1][0][0]).to.equal(POSITION.BULL); 
      expect(rounds2[1][0][1]).to.equal(betAmount);
      expect(rounds2[1][0][2]).to.be.false;

      expect(rounds2[2]).to.equal(1);

      //Second bet user
      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,2);
      expect(rounds2[2]).to.equal(1);

      rounds2=await predictionContract.getUserRounds(UserBet2Address,1,1);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));

      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,0);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(0);
      
      await expect(predictionContract.getUserRounds(UserBet2Address,2,1))
      .to.be.revertedWith('Cursor out of bounds');

      //First bet user
      let rounds1;
      rounds1=await predictionContract.getUserRounds(UserBet1Address,0,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(1);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(2);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,0,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(3);
      expect(rounds1[0][0]).to.equal(1);
      expect(rounds1[0][1]).to.equal(2);
      expect(rounds1[1].length).to.equal(3);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[1][2][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,2,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,2,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,1,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[0][1]).to.equal(3);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);
   });


   it("Test BET BEAR user rounds length", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBear(1,betAmount)

      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet2).betBear(2,betAmount)

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBear(3,betAmount)
      await predictionContract.connect(UserBet1).betBear(3,betAmount)

      let userRounds1=await predictionContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await predictionContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(3);
      expect(userRounds2).to.equal(1);
   });

   it("Test BET BEAR user rounds", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBear(1,betAmount)

      
      // Genesis Lockround - 2
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet2).betBear(2,betAmount)

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(predictionContract, "EndRound")
      .withArgs(round-1,roundId,answer+3000);
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBear(3,betAmount)
      await predictionContract.connect(UserBet1).betBear(3,betAmount)

      let userRounds1=await predictionContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await predictionContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(3);
      expect(userRounds2).to.equal(1);


      let rounds2;
      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(1);
      expect(rounds2[0][0]).to.equal(2);
      expect(rounds2[1].length).to.equal(1);
      expect(rounds2[1][0].length).to.equal(3);
      expect(rounds2[1][0][0]).to.equal(POSITION.BEAR); 
      expect(rounds2[1][0][1]).to.equal(betAmount);
      expect(rounds2[1][0][2]).to.be.false;

      expect(rounds2[2]).to.equal(1);

      //Second bet user
      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,2);
      expect(rounds2[2]).to.equal(1);

      rounds2=await predictionContract.getUserRounds(UserBet2Address,1,1);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));

      rounds2=await predictionContract.getUserRounds(UserBet2Address,0,0);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(0);
      
      await expect(predictionContract.getUserRounds(UserBet2Address,2,1))
      .to.be.revertedWith('Cursor out of bounds');

      //First bet user
      let rounds1;
      rounds1=await predictionContract.getUserRounds(UserBet1Address,0,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(1);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(2);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,0,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(3);
      expect(rounds1[0][0]).to.equal(1);
      expect(rounds1[0][1]).to.equal(2);
      expect(rounds1[1].length).to.equal(3);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[1][2][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,2,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,2,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);

      rounds1=await predictionContract.getUserRounds(UserBet1Address,1,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[0][1]).to.equal(3);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount*2);
      expect(rounds1[1][1][1]).to.equal(minBetAmount*2);
      expect(rounds1[2]).to.equal(3);
   });

   it("Test REFUNDABLE ROUND", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");
      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=minBetAmount;
      let refundable;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)
      await predictionContract.connect(UserBet2).betBear(1,betAmount)
      refundable=await predictionContract.refundable(1,UserBet1Address);
      expect(refundable).to.be.false;
      refundable=await predictionContract.refundable(1,UserBet2Address);
      expect(refundable).to.be.false;

      // Genesis Lockround - 2
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer+1000,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet1).betBear(2,betAmount)

      refundable=await predictionContract.refundable(1,UserBet1Address);
      expect(refundable).to.be.false;
      refundable=await predictionContract.refundable(1,UserBet2Address);
      expect(refundable).to.be.false;
      refundable=await predictionContract.refundable(2,UserBet1Address);
      expect(refundable).to.be.false;
      refundable=await predictionContract.refundable(2,UserBet2Address);
      expect(refundable).to.be.false;

      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      // Round 4
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+5000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(Admin).pause();
      await predictionContract.connect(Admin).makeRefundable(1);
      await predictionContract.connect(Admin).makeRefundable(3);


      // let roundAux=await predictionContract.rounds(1);
      // console.log("ORACLE CALLED: "+roundAux.oracleCalled);
      // console.log("ifRefundable: "+roundAux.ifRefundable);
      // console.log("closeTimestamp: "+roundAux.closeTimestamp);
      // console.log("closePrice: "+roundAux.closePrice);
      // console.log("lockPrice: "+roundAux.lockPrice);

      // let betInfo=await predictionContract.ledger(1,UserBet1Address);
      // console.log("BETINFO amount: "+betInfo.amount);
      // console.log("BETINFO position: "+betInfo.position);
      // console.log("BETINFO claimed: "+betInfo.claimed);
      
      // blockInfo=await mockAgregator.getBlockInfo();
      // console.log("BLOCK timestamp: "+blockInfo.blockTimestamp);

      refundable=await predictionContract.refundable(1,UserBet1Address);
      expect(refundable).to.be.true;
      refundable=await predictionContract.refundable(1,UserBet2Address);
      expect(refundable).to.be.true;
      refundable=await predictionContract.refundable(2,UserBet1Address);
      expect(refundable).to.be.false; 
      refundable=await predictionContract.refundable(2,UserBet2Address);
      expect(refundable).to.be.false;
      // As NOT block.timestamp > round.closeTimestamp + bufferSeconds even round is marked as refundable,
      // are not refundable
      refundable=await predictionContract.refundable(3,UserBet1Address);
      expect(refundable).to.be.false;
      refundable=await predictionContract.refundable(3,UserBet2Address);
      expect(refundable).to.be.false;
   });

   // ***************************************************************
   //                   BETTING - CLAIM
   //  ***************************************************************

   it("Test CLAIM ROUND", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=     "1000000000000000000";
      let amountInRouter="0000000000000000000";
      let betAmountExFees="990000000000000000";
      let betFeeAmount=betAmount-betAmountExFees;
      let claimable;
      let userBalance,routerBalance;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;

      let initialBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
     
      // Genesis round - 1
      //console.log("GENESIS");
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)

      routerBalance=await boldContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(amountInRouter); //User 1 has bet
      userBalance=await boldContract.balanceOf(UserBet2.address);
      await predictionContract.connect(UserBet2).betBear(1,betAmount)
      let newUserBalance=await boldContract.balanceOf(UserBet2Address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());
      let newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(BigNumber.from(amountInRouter).mul(2));
      
      await expect(predictionContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not started');
     

      // Genesis Lockround - 2
      //console.log("LOCK");
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer+1000,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet2).betBull(2,betAmount)
      
      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not started');

      // Round 3
      //console.log("Round 3");
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_RESULT, 
         predictionContract.address, 
         AdminAddress,
         2,
         EV_BEAR,
         timestamp
      );
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBear(3,betAmount)
      await predictionContract.connect(UserBet1).betBear(3,betAmount)
      await predictionContract.connect(UserBet2).betBull(3,betAmount)
      //console.log("treasuryAmount2: "+(await predictionContract.treasuryAmount()));
      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not ended');
      
      // User 2 can claim
      routerBalance=await boldContract.balanceOf(routerContract.address);
      userBalance=await boldContract.balanceOf(UserBet2.address);
      claimable=await predictionContract.claimable(1,UserBet2Address);
      expect(claimable).to.be.true;
      await expect(predictionContract.connect(UserBet2).claim([1]))
      .to.emit(predictionContract, "Claim")
      .withArgs(UserBet2Address,1,BigNumber.from(betAmountExFees).mul(2));
      claimable=await predictionContract.claimable(1,UserBet2Address);
      expect(claimable).to.be.false;
      newUserBalance=await boldContract.balanceOf(UserBet2Address);
      expect(newUserBalance).to.eq(userBalance.add(BigNumber.from(betAmountExFees).mul(2)));
      newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(routerBalance);

      // Round 4
      //console.log("Round 4");
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-5000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();
      //console.log("treasuryAmount2: "+(await predictionContract.treasuryAmount()));

      // Round 5
      //console.log("Round 5");
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-7000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet2).claim([2,3]))
      .to.be.revertedWith('Not eligible for claim');

      userBalance=await boldContract.balanceOf(UserBet1Address);
      await expect(predictionContract.connect(UserBet1).claim([2,3]))
      .to.emit(predictionContract, "Claim");
      newuserBalance=await boldContract.balanceOf(UserBet1Address);
      expect(newuserBalance).to.eq(userBalance.add(BigNumber.from(betAmountExFees).mul(6)));

      let balanceTreasury=await tokenContract.balanceOf(routerContract.address);
      let currentFees=BigNumber.from(feeAmount).mul(7) // 7 bets
      expect(balanceTreasury).to.eq(BigNumber.from(initialBalanceTreasury).add(currentFees));
      let currentTresury=await predictionContract.totalFeeAmount();
      expect(currentTresury).to.be.equal(currentFees);

      await expect( predictionContract.connect(Admin).claimTreasury())
      .to.emit(predictionContract, "TreasuryClaim")
      .withArgs(currentFees);
      let currentRouterBalanceTreasury=await tokenContract.balanceOf(routerContract.address);
      expect(currentRouterBalanceTreasury).to.be.equal(0);

      let treasuryWalletBalance=await tokenContract.balanceOf(TreasuryAddress);
      let tXBalance=await tokenContract.balanceOf(TXAddress);
      // console.log("newtreasuryWalletBalance "+treasuryWalletBalance);
      // console.log("newtXBalance "+tXBalance);

      expect(treasuryWalletBalance).to.eq("3937500000000000000");
      expect(tXBalance).to.eq("1312500000000000000");
      expect(currentFees).to.be.equal(BigNumber.from(treasuryWalletBalance).add(BigNumber.from(tXBalance)));
   }); 

   // ***************************************************************
   //                   BETTING - REFUND (BETS IN ONE SIDE)
   //  ***************************************************************
   it("Test REFUND (BETS IN ONE SIDE)", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=     "1000000000000000000";
      let amountInRouter="0000000000000000000";
      let betAmountExFees="990000000000000000";
      let betFeeAmount=betAmount-betAmountExFees;
      let claimable;
      let userBalance,routerBalance;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)

      routerBalance=await boldContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(amountInRouter); //User 1 has bet
      userBalance=await boldContract.balanceOf(UserBet2.address);
      await predictionContract.connect(UserBet2).betBear(1,betAmount)
      let newUserBalance=await boldContract.balanceOf(UserBet2Address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());
      let newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(BigNumber.from(amountInRouter).mul(2));
      
      await expect(predictionContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not started');
      
      //console.log("Round 2");
      // Genesis Lockround - 2
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer+1000,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet1).betBear(2,betAmount)

      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not started');
      
      //console.log("Round 3");
      // Round 3
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not ended');
      
      // User 2 can claim
      routerBalance=await boldContract.balanceOf(routerContract.address);
      userBalance=await boldContract.balanceOf(UserBet2.address);
      claimable=await predictionContract.claimable(1,UserBet2Address);
      expect(claimable).to.be.true;
      await expect(predictionContract.connect(UserBet2).claim([1]))
      .to.emit(predictionContract, "Claim")
      .withArgs(UserBet2Address,1,BigNumber.from(betAmountExFees).mul(2));
      
      claimable=await predictionContract.claimable(1,UserBet2Address);
      expect(claimable).to.be.false;
      newUserBalance=await boldContract.balanceOf(UserBet2Address);
      expect(newUserBalance.toString()).to.eq(BigNumber.from(userBalance).add(BigNumber.from(betAmountExFees).mul(2)).toString());
      newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(routerBalance);
      
      //console.log("Round 4");
      // Round 4
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer+5000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(predictionContract.connect(Admin).executeRound())
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_RESULT, 
         predictionContract.address, 
         AdminAddress,
         3,
         EV_BULL,
         timestamp
      );
      round=await predictionContract.currentEpoch();
      
      await expect(predictionContract.connect(UserBet2).claim([2]))
      .to.be.revertedWith('Not eligible for claim');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Not eligible for claim');

   });

   // ***************************************************************
   //                   BETTING - REFUND (MAKE REFUNDABLE)
   //  ***************************************************************

   it("Test REFUND (MAKE REFUNDABLE)", async ()=> {
      tokenContract.transfer(UserBet1.address,"1000000000000000000000000");
      tokenContract.transfer(UserBet2.address,"1000000000000000000000000");

      let roundId=1,answer=1000000,updatedAt=2;
      let betAmount=     "1000000000000000000";
      let amountInRouter="0000000000000000000";
      let betAmountExFees="990000000000000000";
      let betFeeAmount=betAmount-betAmountExFees;
      let claimable;
      let userBalance,routerBalance;
      let blockInfo=await mockAgregator.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round;
      
      // Genesis round - 1
      //console.log("GEGESIS");
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer,timestamp);
      await expect(predictionContract.connect(Admin).genesisStartRound())
      .to.emit(predictionContract, "StartRound")
      .withArgs(1);

      await predictionContract.connect(UserBet1).betBull(1,betAmount)

      routerBalance=await boldContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(amountInRouter); //User 1 has bet
      userBalance=await boldContract.balanceOf(UserBet2.address);
      await predictionContract.connect(UserBet2).betBear(1,betAmount)
      let newUserBalance=await boldContract.balanceOf(UserBet2Address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());
      let newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(BigNumber.from(amountInRouter).mul(2));
      
      await expect(predictionContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not started');
      
      
      // Genesis Lockround - 2
      //console.log("LOCK");
      roundId++;
      await mockAgregator.setOracleParameters(roundId,answer+1000,timestamp);
      timestamp+=intervalSeconds+8;
      //console.log("Timestamp: "+timestamp)
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).genesisLockRound();
   
      await predictionContract.connect(UserBet1).betBear(2,betAmount)
      await predictionContract.connect(UserBet2).betBull(2,betAmount)

      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not started');
    
      // Round 3
      //console.log("Round 3");
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-3000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      await predictionContract.connect(UserBet1).betBear(3,betAmount)
      await predictionContract.connect(UserBet2).betBull(3,betAmount)

      await expect(predictionContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');
      await expect(predictionContract.connect(UserBet1).claim([2]))
      .to.be.revertedWith('Round has not ended');
      await expect(predictionContract.connect(UserBet1).claim([3]))
      .to.be.revertedWith('Round has not ended');

    
      // Round 4
      //console.log("Round 4");
      roundId++;
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await mockAgregator.setOracleParameters(roundId,answer-5000,timestamp);
      round=await predictionContract.currentEpoch();
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await predictionContract.connect(Admin).executeRound();
      round=await predictionContract.currentEpoch();

      //MAKE ROUND REFUNDABLE
      let refundableRound=3;
      await predictionContract.connect(Admin).pause();
      await predictionContract.connect(Admin).makeRefundable(refundableRound);
      refundable=await predictionContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;
      await predictionContract.connect(Admin).unpause();

      //console.log("betAmountExFees "+betAmountExFees);
      await expect(predictionContract.connect(UserBet1).claim([refundableRound]))
      .to.emit(predictionContract, "Claim")
      .withArgs(UserBet1Address,refundableRound,betAmountExFees);

      await expect(predictionContract.connect(UserBet1).claim([refundableRound]))
      .to.be.revertedWith('Not eligible for refund');

   });

});