const { expect } = require("chai");
const { ethers} = require("hardhat");
const { BigNumber, Contract } =require("ethers");

const HEADS="0x21"; // HEADS
const TAILS="0x22"; // TAILS

let requestId="0x0000000000000000000000000000000000000000000000000000000000000000"; //Dummy value, not used

const EV_CLAIM=1;  
const EV_TAILS=2;
const EV_HEADS=3;
const EV_RESULT=11; 
const POSITION={
   TAILS:0,
   HEADS:1
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


describe("Cointoss P2P contract tests", function () {
    let Owner, Other, Third, Admin, Operator, Coordinator, UserBet1, UserBet2;
    let OwnerAddress, OtherAddress, ThirdAddress;

    const intervalSeconds = 180,
    minBetAmount = 1000000000000000,
    oracleUpdateAllowance = 300,
    treasuryFee = 300,
    keyHash = "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4",
    linkFee = 0.0001 * 10**18; // 0.0001 LINK

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

        const [FactoryEquivalence,FactoryRouter, FactoryToken,FactoryBold,FactoryCointos,FactoryLinkMock] = await Promise.all([
           ethers.getContractFactory("EquivalenceFormula"),
           ethers.getContractFactory("Router"),
           ethers.getContractFactory("SpoxToken"),
           ethers.getContractFactory("BoldToken"),
           ethers.getContractFactory("CoinTossWithTokenV2"),
           ethers.getContractFactory("MockLinkToken")
        ]);
        //Deployment
        linkMockContract = await FactoryLinkMock.deploy();
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
        await linkMockContract.deployed();

        cointossContract=await FactoryCointos.deploy(
            AdminAddress,
            OperatorAddress,
            intervalSeconds,
            minBetAmount,
            oracleUpdateAllowance,
            treasuryFee,
            tokenContract.address,
            routerContract.address,
            CoordinatorAddress,
            linkMockContract.address,
            keyHash,
            linkFee
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
         tokenContract.connect(Owner).transfer(UserBet1Address,"100000000000000000000000"),
         tokenContract.connect(Owner).transfer(UserBet2Address,"100000000000000000000000"),
        ]);

        //Allow Cointoss to use Router contract
        await routerContract.allowContract(cointossContract.address);

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
          currentAdminAddress,
          currentOperatorAddress,
          currentintervalSeconds,
          currentminBetAmount,
          currentoracleUpdateAllowance,
          currenttreasuryFee,
          currenttokenAddress,
          currentrouterAddress,
          currentkeyHash,
          currentfee
      ]=await Promise.all([
         cointossContract.adminAddress(),
         cointossContract.operatorAddress(),
         cointossContract.intervalSeconds(),
         cointossContract.minBetAmount(),
         cointossContract.oracleUpdateAllowance(),
         cointossContract.treasuryFee(),
         cointossContract.tokenAddress(),
         cointossContract.routerContract(),
      ])

       expect(currentAdminAddress).to.equal(AdminAddress);
       expect(currentOperatorAddress).to.equal(OperatorAddress);
       expect(currentintervalSeconds).to.equal(intervalSeconds);
       expect(currentminBetAmount).to.equal(minBetAmount);
       expect(currentoracleUpdateAllowance).to.equal(oracleUpdateAllowance);
       expect(currenttreasuryFee).to.equal(treasuryFee);
       expect(currenttokenAddress).to.equal(tokenContract.address);
       expect(currentrouterAddress).to.equal(routerContract.address);
      
   });

   // ***************************************************************
   //                   PAUSING
   // ***************************************************************

   it("Test PAUSE when PAUSED", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).pause())
         .to.be.revertedWith('Pausable: paused');
   });

   it("Test PAUSE ADMIN", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(1);
   });

   it("Test PAUSE not ADMIN", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.pause())
         .to.be.revertedWith('Not operator/admin');
   });

   it("Test UNPAUSE not paused", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.unpause())
         .to.be.revertedWith('Pausable: not paused');
   });

   it("Test UNPAUSE not ADMIN", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(1);

      await expect(cointossContract.unpause())
         .to.be.revertedWith('Not admin');
   });

   it("Test UNPAUSE ADMIN", async ()=> {
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(1);

      await expect(cointossContract.connect(Admin).unpause())
      .to.emit(cointossContract, "Unpause")
      .withArgs(1);

      await expect(cointossContract.connect(Operator).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound is triggered');
   });

      // ***************************************************************
      //                   ROUND GENERATION PROCESS
      // ***************************************************************

      it("Test EXECUTEROUND no operator/admin", async ()=> {
         await expect(cointossContract.executeRound())
        .to.be.revertedWith('Not operator/admin');
      });

      it("Test EXECUTEROUND no genesis start round", async ()=> {
         await expect(cointossContract.connect(Admin).executeRound())
        .to.be.revertedWith('Can only run after genesisStartRound is triggered');

        await expect(cointossContract.connect(Operator).executeRound())
        .to.be.revertedWith('Can only run after genesisStartRound is triggered');
      });

      it("Test EXECUTEROUND GenesisRound ADMIN", async ()=> {
         let blockInfo=await linkMockContract.getBlockInfo();

         let timestamp=blockInfo.blockTimestamp.toNumber()+2;

          //Set next block timestamp
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp])

         await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

         let currentEpoch=await cointossContract.currentEpoch();
         expect(currentEpoch).to.eq(1);


         let round=await cointossContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(1);
         expect(round.totalAmount).to.eq(0);

         let genesisStartOnce=await cointossContract.genesisStartOnce();
         expect(genesisStartOnce).to.be.true;
      });

      it("Test EXECUTEROUND GenesisRound OPERATOR", async ()=> {
         let blockInfo=await linkMockContract.getBlockInfo();

         let timestamp=blockInfo.blockTimestamp.toNumber()+2;

          //Set next block timestamp
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp])

         await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

         let currentEpoch=await cointossContract.currentEpoch();
         expect(currentEpoch).to.eq(1);


         let round=await cointossContract.rounds(currentEpoch);
         expect(round.startTimestamp).to.eq(timestamp);
         expect(round.closeTimestamp).to.eq(timestamp+intervalSeconds);
         expect(round.epoch).to.eq(1);
         expect(round.totalAmount).to.eq(0);

         let genesisStartOnce=await cointossContract.genesisStartOnce();
         expect(genesisStartOnce).to.be.true;
      });

      it("Test EXECUTEROUND GenesisRound previously called ADMIN", async ()=> {
         
         await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

         await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.be.revertedWith('Can only run genesisStartRound once');
      });

      it("Test EXECUTEROUND GenesisRound previously called OPERATOR", async ()=> {
         
         await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

         await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.be.revertedWith('Can only run genesisStartRound once');
      });

      it("Test EXECUTEROUND no LINK balance ADMIN", async ()=> {
          await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

         await expect(cointossContract.connect(Admin).executeRound())
         .to.be.revertedWith('Not enough LINK - fill contract with faucet');
      });

      it("Test EXECUTEROUND no LINK balance OPERATOR", async ()=> {
         await expect(cointossContract.connect(Operator).genesisStartRound())
        .to.emit(cointossContract, "StartRound")
        .withArgs(1);

        await expect(cointossContract.connect(Operator).executeRound())
        .to.be.revertedWith('Not enough LINK - fill contract with faucet');
     });

      it("Test EXECUTEROUND before round ends ADMIN", async ()=> {
         let blockInfo=await linkMockContract.getBlockInfo();

         let timestamp=blockInfo.blockTimestamp.toNumber()+2;
        
         let incTimestamp=100;
         await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
         
         await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
         
         await expect(cointossContract.connect(Admin).genesisStartRound())
        .to.emit(cointossContract, "StartRound")
        .withArgs(1);
        //console.log("Current timestamp: "+timestamp);
        await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

        await expect(cointossContract.connect(Admin).executeRound())
        .to.be.revertedWith('Can only end round after closeTimestamp');
     });

     it("Test EXECUTEROUND before round ends ADMIN", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=100;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Operator).genesisStartRound())
     .to.emit(cointossContract, "StartRound")
     .withArgs(1);
     //console.log("Current timestamp: "+timestamp);
     await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

     await expect(cointossContract.connect(Operator).executeRound())
     .to.be.revertedWith('Can only end round after closeTimestamp');
   });

   it("Test EXECUTEROUND after round ends ADMIN", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
     .to.emit(cointossContract, "StartRound")
     .withArgs(1);
     //console.log("Current timestamp: "+timestamp);
     await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

     await expect(cointossContract.connect(Admin).executeRound())
         .to.emit(cointossContract, "requestRandom");


      //Check if cointoss contract has sent correctly data to cordinator
      let [rto,rvalue,rdata]=await Promise.all([
         linkMockContract.rto(),
         linkMockContract.rvalue(),
         linkMockContract.rdata()
      ]);
      expect(rto).to.eq(CoordinatorAddress);
      expect(rvalue).to.eq(linkFee);
      //expect(rdata).to.eq("0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a40000000000000000000000000000000000000000000000000000000000000000");
  });

  it("Test EXECUTEROUND after round ends OPERATOR", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Operator).genesisStartRound())
   .to.emit(cointossContract, "StartRound")
   .withArgs(1);
   //console.log("Current timestamp: "+timestamp);
   await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

   await expect(cointossContract.connect(Operator).executeRound())
         .to.emit(cointossContract, "requestRandom");


      //Check if cointoss contract has sent correctly data to cordinator
      let [rto,rvalue,rdata]=await Promise.all([
         linkMockContract.rto(),
         linkMockContract.rvalue(),
         linkMockContract.rdata()
      ]);
      expect(rto).to.eq(CoordinatorAddress);
      expect(rvalue).to.eq(linkFee);
      //console.log("DATA "+rdata);
   });
   
   it("Test EXECUTEROUND round paused ADMIN", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      //console.log("Current timestamp: "+timestamp);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Admin).executeRound())
        .to.be.revertedWith('Pausable: paused');
   });

   it("Test EXECUTEROUND round paused OPERATOR", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      //console.log("Current timestamp: "+timestamp);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Operator).executeRound())
        .to.be.revertedWith('Pausable: paused');
   });

   it("Test EXECUTEROUND round unpause ADMIN", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Admin).executeRound())
        .to.be.revertedWith('Pausable: paused');

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Admin).unpause();

      await expect(cointossContract.connect(Admin).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound is triggered');

      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(2);

      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Operator).executeRound())
               .to.emit(cointossContract, "requestRandom");

   });

   it("Test EXECUTEROUND round unpause OPERATOR", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Operator).executeRound())
        .to.be.revertedWith('Pausable: paused');

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Admin).unpause();

      await expect(cointossContract.connect(Admin).executeRound())
      .to.be.revertedWith('Can only run after genesisStartRound is triggered');

      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(2);

      timestamp+=incTimestamp;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Operator).executeRound())
               .to.emit(cointossContract, "requestRandom");

   });


   it("Test FULLFILLRADOMNESS before previous round is open", async ()=> {
      
      let randomValue="0x21"; // HEADS
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   
      let incTimestamp=100; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
     await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);
   
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

   // Emulate random number from VRFCoordinator
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,randomValue))
         .to.be.revertedWith('Can only end round after closeTimestamp');
   });

   it("Test FULLFILLRADOMNESS not started round", async ()=> {
     
      let randomValue="0x21"; // HEADS
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      //await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
  
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      // Emulate random number from VRFCoordinator
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,randomValue))
         .to.be.revertedWith('Can only end round after round has started');
   });

   it("Test FULLFILLRANDOMNESS round paused", async ()=> {
      let randomValue="0x21"; // HEADS
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
     
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await linkMockContract.transfer(cointossContract.address,"10000000000000000000");
      
      await expect(cointossContract.connect(Admin).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      //console.log("Current timestamp: "+timestamp);
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,randomValue))
        .to.be.revertedWith('Pausable: paused');
   });

   it("Test FULLFILLRADOMNESS HEADS", async ()=> {
      
      let randomValue="0x21"; // HEADS
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);
  
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      // Emulate random number from VRFCoordinator
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,randomValue))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      let currentEpoch=await cointossContract.currentEpoch();
      expect(currentEpoch).to.eq(2);

      let round=await cointossContract.rounds(currentEpoch-1);
      let nextRound=await cointossContract.rounds(currentEpoch);
      expect(round.tossResult).to.eq(1);
      expect(round.closeOracleId).to.eq(1);
      expect(round.oracleCalled).to.be.true;
      expect(nextRound.startTimestamp).to.eq(timestamp+incTimestamp);
      expect(nextRound.closeTimestamp).to.eq(timestamp+incTimestamp+intervalSeconds);
      expect(nextRound.epoch).to.eq(2);
      expect(nextRound.totalAmount).to.eq(0);
   });

   it("Test FULLFILLRADOMNESS TAILS", async ()=> {
      
      let randomValue="0x22"; // TAILS
      let blockInfo=await linkMockContract.getBlockInfo();

      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
   
      let incTimestamp=intervalSeconds+8; // i.e. more than 3 minutes
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      
      await expect(cointossContract.connect(Operator).genesisStartRound())
      .to.emit(cointossContract, "StartRound")
      .withArgs(1);
  
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp+incTimestamp]);

      // Emulate random number from VRFCoordinator
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,randomValue))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      let currentEpoch=await cointossContract.currentEpoch();
      expect(currentEpoch).to.eq(2);

      let round=await cointossContract.rounds(currentEpoch-1);
      let nextRound=await cointossContract.rounds(currentEpoch);
      expect(round.tossResult).to.eq(0);
      expect(round.closeOracleId).to.eq(1);
      expect(round.oracleCalled).to.be.true;
      expect(nextRound.startTimestamp).to.eq(timestamp+incTimestamp);
      expect(nextRound.closeTimestamp).to.eq(timestamp+incTimestamp+intervalSeconds);
      expect(nextRound.epoch).to.eq(2);
      expect(nextRound.totalAmount).to.eq(0);
   });

   // ***************************************************************
   //                   CLAIM TREASURY
   // ***************************************************************

   // Fully tested on BETTING - CLAIM
   it("Test CLAIMTREASURY not ADMIN", async ()=> {
      await expect(cointossContract.claimTreasury())
      .to.be.revertedWith('Not admin');
   });

   it("Test CLAIMTREASURY ADMIN", async ()=> {;
      // full tested in CLAIM section
      await expect(cointossContract.connect(Admin).claimTreasury())
      .to.emit(cointossContract, "TreasuryClaim")
      .withArgs(0);
   });

     // ***************************************************************
   //                   CHANGE INTERVAL IN SECONDS
   // ***************************************************************


   it("Test INTERVAL not PAUSED", async ()=> {;
      let newnterval=500;
      let currentInterval= await cointossContract.intervalSeconds();
      expect(currentInterval).to.eq(intervalSeconds);

      await expect(cointossContract.connect(Admin).setIntervalSeconds(newnterval))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test INTERVAL not ADMIN", async ()=> {;
      let newnterval=500;
      let currentInterval= await cointossContract.intervalSeconds();
      expect(currentInterval).to.eq(intervalSeconds);


      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.setIntervalSeconds(newnterval))
      .to.be.revertedWith('Not admin');
   });

   it("Test INTERVAL ADMIN", async ()=> {;
      let newnterval=500;
      let currentInterval= await cointossContract.intervalSeconds();
      expect(currentInterval).to.eq(intervalSeconds);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.connect(Admin).setIntervalSeconds(newnterval))
      .to.emit(cointossContract, "NewIntervalPeriod")
      .withArgs(newnterval);
   });

   // ***************************************************************
   //                   MIN BET AMOUNT
   // ***************************************************************


   it("Test MINBETAMOUNT not PAUSED", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await cointossContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(cointossContract.connect(Admin).setMinBetAmount(newMInBetAmount))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test MINBETAMOUNT not ADMIN", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await cointossContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.setMinBetAmount(newMInBetAmount))
      .to.be.revertedWith('Not admin');
   });

   it("Test MINBETAMOUNT ADMIN", async ()=> {;
      let newMInBetAmount=2000000000000000;
      let currentMinBetAmount= await cointossContract.minBetAmount();
      expect(currentMinBetAmount).to.eq(minBetAmount);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.connect(Admin).setMinBetAmount(newMInBetAmount))
      .to.emit(cointossContract, "NewMinBetAmount")
      .withArgs(0,newMInBetAmount);
   });

    // ***************************************************************
   //                   LINK FEE 
   // ***************************************************************


   it("Test LINKFEE not PAUSED", async ()=> {;
      const fee =  0.0001 * 10**18;
      let currentLinkFee= await cointossContract.getLinkFee();
      expect(currentLinkFee).to.eq(fee);

      await expect(cointossContract.connect(Admin).setMinBetAmount(fee))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test LINKFEE not ADMIN", async ()=> {;
      const fee =  0.0001 * 10**18;
      let currentLinkFee= await cointossContract.getLinkFee();
      expect(currentLinkFee).to.eq(fee);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      const newFee=fee*2;
      await expect(cointossContract.setMinBetAmount(newFee))
      .to.be.revertedWith('Not admin');
   });

   it("Test LINKFEE  ADMIN", async ()=> {;
      const fee =  0.0001 * 10**18;
      let currentLinkFee= await cointossContract.getLinkFee();
      expect(currentLinkFee).to.eq(fee);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      const newFee=fee*2;
      await cointossContract.connect(Admin).setLinkFee(newFee);
      currentLinkFee= await cointossContract.getLinkFee();
      expect(currentLinkFee).to.eq(newFee);
   });

   // ***************************************************************
   //                   OPERATOR MANAGEMENT
   // ***************************************************************


   it("Test OPERATOR not ADMIN", async ()=> {;
      let currentOperator=await cointossContract.operatorAddress();
      expect(currentOperator).to.eq(OperatorAddress);

      await expect(cointossContract.setOperator(OtherAddress))
      .to.be.revertedWith('Not admin');
   });

   it("Test OPERATOR ADMIN", async ()=> {;
      let currentOperator=await cointossContract.operatorAddress();
      expect(currentOperator).to.eq(OperatorAddress);

      await expect(cointossContract.connect(Admin).setOperator(OtherAddress))
      .to.emit(cointossContract, "NewOperatorAddress")
      .withArgs(OtherAddress);
   });

   // ***************************************************************
   //                   ORACLE ALLOWANCE
   // ***************************************************************


   it("Test ORACLEUPDATEALLOWANCE not PAUSED", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await cointossContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(cointossContract.connect(Admin).setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test ORACLEUPDATEALLOWANCE not ADMIN", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await cointossContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.be.revertedWith('Not admin');
   });

   it("Test ORACLEUPDATEALLOWANCE ADMIN", async ()=> {;
      let newOracleUpdateAllowance=600;
      let currentOracleUpdateAllowance= await cointossContract.oracleUpdateAllowance();
      expect(currentOracleUpdateAllowance).to.eq(oracleUpdateAllowance);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.connect(Admin).setOracleUpdateAllowance(newOracleUpdateAllowance))
      .to.emit(cointossContract, "NewOracleUpdateAllowance")
      .withArgs(newOracleUpdateAllowance);

      let updatedOracleUpdateAllowance= await cointossContract.oracleUpdateAllowance();
      expect(updatedOracleUpdateAllowance).to.eq(newOracleUpdateAllowance);
   });

   // ***************************************************************
   //                   TREASURY FEE
   // ***************************************************************


   it("Test SETTREASURYFEE not PAUSED", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await cointossContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(cointossContract.connect(Admin).setTreasuryFee(newTreasuryFee))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test SETTREASURYFEE not ADMIN", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await cointossContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.setTreasuryFee(newTreasuryFee))
      .to.be.revertedWith('Not admin');
   });

   it("Test SETTREASURYFEE ADMIN", async ()=> {;
      let newTreasuryFee=400;
      let currentTreasuryFee= await cointossContract.treasuryFee();
      expect(currentTreasuryFee).to.eq(treasuryFee);

      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.connect(Admin).setTreasuryFee(newTreasuryFee))
      .to.emit(cointossContract, "NewTreasuryFee")
      .withArgs(0,newTreasuryFee);

      let updatedTreasuryFee= await cointossContract.treasuryFee();
      expect(updatedTreasuryFee).to.eq(newTreasuryFee);
   });


   // ***************************************************************
   //                   MAKE ROUND REFUNDABLE
   // ***************************************************************

   // Fully tested on Betting Claim
   it("Test MAKEREFUNDABLE not PAUSED", async ()=> {;

      await expect(cointossContract.connect(Admin).makeRefundable(0))
      .to.be.revertedWith('Pausable: not paused');
   });


   it("Test MAKEREFUNDABLE not ADMIN", async ()=> {
      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await expect(cointossContract.makeRefundable(0))
      .to.be.revertedWith('Not admin');
   });

   it("Test MAKEREFUNDABLE ADMIN", async ()=> {;
      await expect(cointossContract.connect(Admin).pause())
      .to.emit(cointossContract, "Pause")
      .withArgs(0);

      await cointossContract.connect(Admin).makeRefundable(0);
      let round=await cointossContract.rounds(0);
      
      expect(round.ifRefundable).to.be.true;
   });

   // ***************************************************************
   //                   RECOVER 
   // ***************************************************************


   it("Test RECOVERTOKEN not OWNER", async ()=> {
      await expect(cointossContract.connect(Other).recoverToken(tokenContract.address,1))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test RECOVERTOKEN ADMIN", async ()=> {
      let amount=1000000;
      await tokenContract.connect(Owner).transfer(cointossContract.address,amount);

      let initialOwnerBalance=await tokenContract.balanceOf(OwnerAddress);
      await expect(cointossContract.connect(Owner).recoverToken(tokenContract.address,amount))
      .to.emit(cointossContract, "TokenRecovery")
      .withArgs(tokenContract.address,amount);

      
      let cointossBalance=await tokenContract.balanceOf(cointossContract.address);
      let ownerBalance=await tokenContract.balanceOf(OwnerAddress);
      expect(cointossBalance).to.eq(0);
      expect(ownerBalance).to.eq(initialOwnerBalance.add(amount));


   });

   // ***************************************************************
   //                   MANAGE ADMIN ADDRESS
   // ***************************************************************


   it("Test SETADMIN not OWNER", async ()=> {
      await expect(cointossContract.connect(Admin).setAdmin(ThirdAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test SETADMIN ZERO ADDRESS", async ()=> {
      let zeroAddress="0x0000000000000000000000000000000000000000";
      await expect(cointossContract.connect(Owner).setAdmin(zeroAddress))
      .to.be.revertedWith('Cannot be zero address');
   });

   it("Test SETADMIN OWNER", async ()=> {
      await expect(cointossContract.connect(Owner).setAdmin(ThirdAddress))
      .to.emit(cointossContract, "NewAdminAddress")
      .withArgs(ThirdAddress);
   });

   // ***************************************************************
   //                   BETTING
   // ***************************************************************

   it("Test BET TAILS wrong epoch", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);
      
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      await expect(cointossContract.connect(UserBet1).betTails(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
   });

   it("Test BET TAILS not  betteable", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await expect(cointossContract.connect(UserBet1).betTails(0,betAmount))
      .to.be.revertedWith('Round not bettable');

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).betTails(1,betAmount))
      .to.be.revertedWith('Round not bettable');
   });

   it("Test BET TAILS single bet", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      let initialBalance=await tokenContract.balanceOf(routerContract.address);
      expect(initialBalance).to.eq(0);
      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.emit(cointossContract, "BetTails")
      .withArgs(UserBet1Address,2,betAmount);
      let balance=await tokenContract.balanceOf(routerContract.address);
      expect(balance).to.eq(betAmount);

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.tailsAmount).to.eq(betAmount);
      expect(round.headsAmount).to.eq(0);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.TAILS);
      expect(betInfo.amount).to.eq(betAmount);

   });

   it("Test BET TAILS single bet router event", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_TAILS,
         cointossContract.address,
         UserBet1Address,
         2,
         betAmount,
         timestamp
      );

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.tailsAmount).to.eq(betAmount);
      expect(round.headsAmount).to.eq(0);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.TAILS);
      expect(betInfo.amount).to.eq(betAmount);

   });

   it("Test BET TAILS double bet", async ()=> {
      let betAmount="1000000000000000000";
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.emit(cointossContract, "BetTails")
      .withArgs(UserBet1Address,2,betAmount);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.emit(cointossContract, "BetTails")
      .withArgs(UserBet1Address,2,betAmount);

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(doubleBet);
      expect(round.tailsAmount).to.eq(doubleBet);
      expect(round.headsAmount).to.eq(0);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.TAILS);
      expect(betInfo.amount).to.eq(doubleBet);
   });

   it("Test BET TAILS double bet different bets", async ()=> {
      let betAmount="1000000000000000000";
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.emit(cointossContract, "BetTails")
      .withArgs(UserBet1Address,2,betAmount);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.be.revertedWith('Can only bet on the same side');
      
   });


   it("Test BET TAILS amount lower than min bet amount", async ()=> {
      let betAmount=minBetAmount-1;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.be.revertedWith('Bet amount must be greater than minBetAmount');
      
   });

   it("Test BET TAILS not enought funds", async ()=> {
      let betAmount=minBetAmount;
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Third).betTails(2,betAmount))
      .to.be.revertedWith('User has not enought funds');
      
   });

   it("Test BET TAILS paused", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Third).betTails(2,betAmount))
      .to.be.revertedWith('Pausable: paused');
   });
 
   it("Test BET HEADS wrong epoch", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      await expect(cointossContract.connect(UserBet1).betHeads(1,betAmount))
      .to.be.revertedWith('Bet is too early/late');
   });

   it("Test BET HEADS not betteable", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await expect(cointossContract.connect(UserBet1).betHeads(0,betAmount))
      .to.be.revertedWith('Round not bettable');

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).betHeads(1,betAmount))
      .to.be.revertedWith('Round not bettable');
   });

   it("Test BET HEADS single bet", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.emit(cointossContract, "BetHeads")
      .withArgs(UserBet1Address,2,betAmount);

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.tailsAmount).to.eq(0);
      expect(round.headsAmount).to.eq(betAmount);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.HEADS);
      expect(betInfo.amount).to.eq(betAmount);
   });

   it("Test BET HEADS single bet router event", async ()=> {
      let betAmount="1000000000000000000";
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_HEADS,
         cointossContract.address,
         UserBet1Address,
         2,
         betAmount,
         timestamp
      );

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(betAmount);
      expect(round.tailsAmount).to.eq(0);
      expect(round.headsAmount).to.eq(betAmount);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.HEADS);
      expect(betInfo.amount).to.eq(betAmount);
   });

   it("Test BET HEADS double bet", async ()=> {
      let betAmount="1000000000000000000";
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.emit(cointossContract, "BetHeads")
      .withArgs(UserBet1Address,2,betAmount);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.emit(cointossContract, "BetHeads")
      .withArgs(UserBet1Address,2,betAmount);

      let currentEpoch=await cointossContract.currentEpoch();
      let round=await cointossContract.rounds(currentEpoch);
      expect(round.totalAmount).to.eq(doubleBet);
      expect(round.tailsAmount).to.eq(0);
      expect(round.headsAmount).to.eq(doubleBet);
      
      let betInfo=await cointossContract.ledger(currentEpoch,UserBet1Address);
      expect(betInfo.position).to.eq(POSITION.HEADS);
      expect(betInfo.amount).to.eq(doubleBet);
   });

   it("Test BET HEADS double bet different bets", async ()=> {
      let betAmount="1000000000000000000";
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.emit(cointossContract, "BetHeads")
      .withArgs(UserBet1Address,2,betAmount);

      await expect(cointossContract.connect(UserBet1).betTails(2,betAmount))
      .to.be.revertedWith('Can only bet on the same side');
      
   });


   it("Test BET HEADS amount lower than min bet amount", async ()=> {
      let betAmount=minBetAmount-1;
      let doubleBet=(BigNumber.from(betAmount)).mul(2);
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(UserBet1).betHeads(2,betAmount))
      .to.be.revertedWith('Bet amount must be greater than minBetAmount');
      
   });

   it("Test BET HEADS not enought funds", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Third).betHeads(2,betAmount))
      .to.be.revertedWith('User has not enought funds');
   });

   it("Test BET HEADS paused", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);

      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=10;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Admin).pause();

      await expect(cointossContract.connect(Third).betHeads(2,betAmount))
      .to.be.revertedWith('Pausable: paused');
   });

   
   // ***************************************************************
   //                   BETTING - GET USER BETS FROM CONTRACT
   // ***************************************************************

   it("Test BET TAILS user rounds length", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round=1;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);
      await  cointossContract.connect(UserBet2).betTails(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(2,2);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(3,3);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(4,4);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);

      let userRounds1=await cointossContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await cointossContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(4);
      expect(userRounds2).to.equal(1);
   });

   it("Test BET TAILS user rounds", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round=1;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);
      await  cointossContract.connect(UserBet2).betTails(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      betAmount+=1000;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(2,2);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);

      // ROUND
      round++;
      betAmount+=1000
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(3,3);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);

      // ROUND
      round++;
      betAmount+=1000
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(4,4);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(round,betAmount);

      let userRounds1=await cointossContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await cointossContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(4);
      expect(userRounds2).to.equal(1);

      let rounds2;
      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(1);
      expect(rounds2[0][0]).to.equal(2);
      expect(rounds2[1].length).to.equal(1);
      expect(rounds2[1][0].length).to.equal(4);
      expect(rounds2[1][0][0]).to.equal(POSITION.TAILS); 
      expect(rounds2[1][0][1]).to.equal(minBetAmount);
      expect(rounds2[1][0][2]).to.be.false;
      expect(rounds2[1][0][3]).to.be.false;
      expect(rounds2[2]).to.equal(1);

      //Second bet user
      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,2);
      expect(rounds2[2]).to.equal(1);

      rounds2=await cointossContract.getUserRounds(UserBet2Address,1,1);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));

      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,0);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(0);
      
      await expect(cointossContract.getUserRounds(UserBet2Address,2,1))
      .to.be.revertedWith('Cursor out of bounds');

      //First bet user
      let rounds1;
      rounds1=await cointossContract.getUserRounds(UserBet1Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[2]).to.equal(1);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,0,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[0][1]).to.equal(3);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000);
      expect(rounds1[2]).to.equal(2);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,2,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(4);
      expect(rounds1[0][1]).to.equal(5);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,2,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(4);
      expect(rounds1[0][1]).to.equal(5);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,1,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(3);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[0][1]).to.equal(4);
      expect(rounds1[0][2]).to.equal(5);
      expect(rounds1[1].length).to.equal(3);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][2][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);
   });

   it("Test BET HEADS user rounds length", async ()=> {
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round=1;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);
      await  cointossContract.connect(UserBet2).betHeads(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(2,2);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(3,3);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(4,4);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      let userRounds1=await cointossContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await cointossContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(4);
      expect(userRounds2).to.equal(1);
   });

   it("Test BET HEADS user rounds", async ()=> {
      
      let betAmount=minBetAmount;
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let round=1;

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])
      await expect(cointossContract.connect(Operator).genesisStartRound())
         .to.emit(cointossContract, "StartRound")
         .withArgs(1);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(1,1);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);
      await  cointossContract.connect(UserBet2).betHeads(round,betAmount);

      // ROUND
      round++;
      timestamp+=intervalSeconds+8;
      betAmount+=1000;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(2,2);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      // ROUND
      round++;
      betAmount+=1000
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(3,3);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      // ROUND
      round++;
      betAmount+=1000
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(cointossContract, "EndRound")
      .withArgs(4,4);

      timestamp+=2;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(round,betAmount);

      let userRounds1=await cointossContract.getUserRoundsLength(UserBet1Address);
      let userRounds2=await cointossContract.getUserRoundsLength(UserBet2Address);
      expect(userRounds1).to.equal(4);
      expect(userRounds2).to.equal(1);

      let rounds2;
      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(1);
      expect(rounds2[0][0]).to.equal(2);
      expect(rounds2[1].length).to.equal(1);
      expect(rounds2[1][0].length).to.equal(4);
      expect(rounds2[1][0][0]).to.equal(POSITION.HEADS); 
      expect(rounds2[1][0][1]).to.equal(minBetAmount);
      expect(rounds2[1][0][2]).to.be.false;
      expect(rounds2[1][0][3]).to.be.false;
      expect(rounds2[2]).to.equal(1);

      //Second bet user
      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,2);
      expect(rounds2[2]).to.equal(1);

      rounds2=await cointossContract.getUserRounds(UserBet2Address,1,1);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds2));

      rounds2=await cointossContract.getUserRounds(UserBet2Address,0,0);
      expect(rounds2.length).to.equal(3);
      expect(rounds2[0].length).to.equal(0);
      expect(rounds2[1].length).to.equal(0);
      expect(rounds2[2]).to.equal(0);
      
      await expect(cointossContract.getUserRounds(UserBet2Address,2,1))
      .to.be.revertedWith('Cursor out of bounds');

      //First bet user
      let rounds1;
      rounds1=await cointossContract.getUserRounds(UserBet1Address,0,1);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(1);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[1].length).to.equal(1);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[2]).to.equal(1);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,0,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(2);
      expect(rounds1[0][1]).to.equal(3);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000);
      expect(rounds1[2]).to.equal(2);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,2,2);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(4);
      expect(rounds1[0][1]).to.equal(5);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,2,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(2);
      expect(rounds1[0][0]).to.equal(4);
      expect(rounds1[0][1]).to.equal(5);
      expect(rounds1[1].length).to.equal(2);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);

      rounds1=await cointossContract.getUserRounds(UserBet1Address,1,3);
      //console.log("ROUNDS1+: "+JSON.stringify(rounds1));
      expect(rounds1.length).to.equal(3);
      expect(rounds1[0].length).to.equal(3);
      expect(rounds1[0][0]).to.equal(3);
      expect(rounds1[0][1]).to.equal(4);
      expect(rounds1[0][2]).to.equal(5);
      expect(rounds1[1].length).to.equal(3);
      expect(rounds1[1][0][1]).to.equal(minBetAmount+1000);
      expect(rounds1[1][1][1]).to.equal(minBetAmount+1000+1000);
      expect(rounds1[1][2][1]).to.equal(minBetAmount+1000+1000+1000);
      expect(rounds1[2]).to.equal(4);
   });

   // ***************************************************************
   //                   BETTING - GET USER BETS FROM CONTRACT
   // ***************************************************************


   it("Test CLAIMABLE ROUND", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let currentRound=1;
      let betAmount=minBetAmount;

      let claimable
      claimable=await cointossContract.claimable(0,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(1,UserBet1Address);
      expect(claimable).to.be.false;

      // Genesis Round -1 
      timestamp+=2;
      await cointossContract.connect(Operator).genesisStartRound();
      claimable=await cointossContract.claimable(0,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(1,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(2,UserBet1Address);
      expect(claimable).to.be.false;

      //Round - 2 
      currentRound++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
      claimable=await cointossContract.claimable(1,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(2,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(3,UserBet1Address);
      expect(claimable).to.be.false;

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      // Bet in both directions
      await  cointossContract.connect(UserBet1).betHeads(currentRound,betAmount);
      await  cointossContract.connect(UserBet2).betTails(currentRound,betAmount);

      //Round - 3
      currentRound++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();
      claimable=await cointossContract.claimable(epoch-1,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.claimable(epoch-1,UserBet2Address);
      expect(claimable).to.be.true;

      await  cointossContract.connect(UserBet1).betTails(currentRound,betAmount);
      //Round
       currentRound++;
       timestamp+=intervalSeconds+8;
       await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
       await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
       epoch=await cointossContract.currentEpoch();
       claimable=await cointossContract.claimable(epoch-1,UserBet1Address);
       expect(claimable).to.be.true;

       await  cointossContract.connect(UserBet2).betHeads(currentRound,betAmount);
       await  cointossContract.connect(UserBet2).betHeads(currentRound,betAmount+1);
       //Round
        currentRound++;
        timestamp+=intervalSeconds+8;
        await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
        epoch=await cointossContract.currentEpoch();
        claimable=await cointossContract.claimable(epoch-1,UserBet2Address);
        expect(claimable).to.be.true;
   });

   it("Test REFUNDABLE ROUND", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let currentRound=1;
      let betAmount=minBetAmount;
      let refundable,epoch;

      refundable=await cointossContract.refundable(0,UserBet1Address);
      expect(refundable).to.be.false;

      // Genesis Round
      timestamp+=2;
      await cointossContract.connect(Operator).genesisStartRound();
      epoch=await cointossContract.currentEpoch();
      refundable=await cointossContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;

      // Round 2
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();
      //console.log("ROUND 2:"+epoch);
      refundable=await cointossContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betHeads(epoch,betAmount);
      await  cointossContract.connect(UserBet2).betTails(epoch,betAmount);

      // Round 3
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();
      //console.log("ROUND 3:"+epoch);
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.false;
      
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      await cointossContract.connect(Admin).pause();
      await cointossContract.connect(Admin).makeRefundable(epoch);
      refundable=await cointossContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;
      await cointossContract.connect(Admin).unpause();
      
      // Round New GENESIS ROUND
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Operator).genesisStartRound();
      epoch=await cointossContract.currentEpoch();
      //console.log("ROUND genesis:"+epoch);
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.false;

      timestamp+=300;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine", []); // Force block creation as round.closetimestamp must be lower than block.timestamp
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.true;

      // Round 5
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();
      //console.log("ROUND 3:"+epoch);
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.false;
      
      // NO bet
      //await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      await cointossContract.connect(Admin).pause();
      await cointossContract.connect(Admin).makeRefundable(epoch);
      refundable=await cointossContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;
      await cointossContract.connect(Admin).unpause();
      
      // Round New GENESIS ROUND
      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Operator).genesisStartRound();
      epoch=await cointossContract.currentEpoch();
      //console.log("ROUND genesis:"+epoch);
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.false;

      timestamp+=300;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine", []); // Force block creation as round.closetimestamp must be lower than block.timestamp
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
      expect(refundable).to.be.false;
   });

   it("Test BONUS CLAIMABLE", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let currentRound=1;
      let betAmount=minBetAmount;

      let claimable
      claimable=await cointossContract.bonusClaimable(0,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.bonusClaimable(1,UserBet1Address);
      expect(claimable).to.be.false;

      // Genesis Round -1 
      timestamp+=2;
      await cointossContract.connect(Operator).genesisStartRound();
      claimable=await cointossContract.bonusClaimable(0,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.bonusClaimable(1,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.bonusClaimable(2,UserBet1Address);
      expect(claimable).to.be.false;

      //Round - 2 
      currentRound++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
      claimable=await cointossContract.bonusClaimable(1,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.bonusClaimable(2,UserBet1Address);
      expect(claimable).to.be.false;
      claimable=await cointossContract.bonusClaimable(3,UserBet1Address);
      expect(claimable).to.be.false;

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      // Bet in both directions
      await  cointossContract.connect(UserBet1).betHeads(currentRound,betAmount);
      await  cointossContract.connect(UserBet2).betTails(currentRound,betAmount);

      //Round - 3
      currentRound++;
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      claimable=await cointossContract.bonusClaimable(epoch-1,UserBet1Address);
      expect(claimable).to.be.true;
      claimable=await cointossContract.bonusClaimable(epoch-1,UserBet2Address);
      expect(claimable).to.be.true;

      await  cointossContract.connect(UserBet1).betTails(currentRound,betAmount);
      //Round
       currentRound++;
       timestamp+=intervalSeconds+8;
       await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
       await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
       epoch=await cointossContract.currentEpoch();
       claimable=await cointossContract.bonusClaimable(epoch-1,UserBet1Address);
       expect(claimable).to.be.true;

       await  cointossContract.connect(UserBet2).betHeads(currentRound,betAmount);
       await  cointossContract.connect(UserBet2).betHeads(currentRound,betAmount+1);
       //Round
        currentRound++;
        timestamp+=intervalSeconds+8;
        await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
        epoch=await cointossContract.currentEpoch();
        claimable=await cointossContract.bonusClaimable(epoch-1,UserBet2Address);
        expect(claimable).to.be.true;
   });

 
   // ***************************************************************
   //                   BETTING - CLAIM
   //  ***************************************************************
   it("Test CLAIM", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let betAmount=minBetAmount;
      let betAmountExFees=minBetAmount-minBetAmount*treasuryFee/10000;//    (1-treasuryFee/100);
      let betFeeAmount=betAmount-betAmountExFees;
      //console.log(`AMount: ${betAmount} without fee: ${betAmountExFees}`);
      let epoch=0;

      //genesis round
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await cointossContract.connect(Operator).genesisStartRound();

      await expect(cointossContract.claim([1]))
      .to.be.revertedWith('Round has not ended');

      //Round 
      timestamp+=intervalSeconds+8;
      // console.log("EV_RESULT: "+EV_RESULT);
      // console.log("cointossContract: "+cointossContract.address);
      // console.log("CoordinatorAddress: "+CoordinatorAddress);
      // console.log("epoch-1: "+epoch-1);
      // console.log("EV_TAILS: "+EV_TAILS);
      // console.log("timestamp: "+timestamp);

      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_RESULT, 
         cointossContract.address, 
         CoordinatorAddress,
         1,
         EV_TAILS,
         timestamp
      );
      
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      let userBalance=await tokenContract.balanceOf(UserBet2.address);
      //console.log("User balance: "+userBalance);
      await  cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      let newUserBalance=await tokenContract.balanceOf(UserBet2.address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());

      //Round 
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS))
      .to.emit(routerContract, "betEvent")
      .withArgs(
         EV_RESULT, 
         cointossContract.address, 
         CoordinatorAddress,
         epoch,
         EV_HEADS,
         timestamp
      );
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claim([epoch-1]))
      .to.be.revertedWith('Not eligible for claim');

      let routerBalance=await tokenContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(betAmount*2);
      await expect(cointossContract.connect(UserBet2).claim([epoch-1]))
      .to.emit(cointossContract, "Claim")
      .withArgs(UserBet2Address,epoch-1,betAmountExFees*2);
      routerBalance=await tokenContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(betFeeAmount*2);
      currentUserBalance=await tokenContract.balanceOf(UserBet2.address);
      expect(currentUserBalance.toString()).to.eq(newUserBalance.add(betAmountExFees*2).toString());

      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      await  cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      await cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      await cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      currentRouterBalance=await tokenContract.balanceOf(routerContract.address);
      currentUserBalance=await tokenContract.balanceOf(UserBet1Address);
      await cointossContract.connect(UserBet1).claim([epoch-2,epoch-1]);
      newUserBalance=await tokenContract.balanceOf(UserBet1Address);
      expect(newUserBalance.toString()).to.eq(currentUserBalance.add(betAmountExFees*6).toString());
      newRouterBalance=await tokenContract.balanceOf(routerContract.address);
      expect(newRouterBalance.toString()).to.eq(currentRouterBalance.sub(betAmountExFees*6).toString());

      await expect(cointossContract.connect(UserBet1).claim([epoch-2,epoch-1]))
      .to.be.revertedWith('Not eligible for claim');

      await expect(cointossContract.connect(Admin).claimTreasury())
      .to.emit(cointossContract, "TreasuryClaim")
      .withArgs(8*betFeeAmount);
      newRouterBalance=await tokenContract.balanceOf(routerContract.address);
      expect(newRouterBalance.toString()).to.eq("0");
   });

   // ***************************************************************
   //                   BETTING - CLAIM BONUS REWARDS
   //  ***************************************************************
   it("Test CLAIM BONUS rewards", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let betAmount=minBetAmount;
      let betAmountExFees=minBetAmount-minBetAmount*treasuryFee/10000;//    (1-treasuryFee/100);
      let betFeeAmount=betAmount-betAmountExFees;
      //console.log(`AMount: ${betAmount} without fee: ${betAmountExFees}`);
      let epoch;

      //genesis round
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).claimBonusRewards([0]))
      .to.be.revertedWith('Round has not started');
      await cointossContract.connect(Operator).genesisStartRound();

      await expect(cointossContract.claimBonusRewards([1]))
      .to.be.revertedWith('Round has not ended');

      //Round 
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claimBonusRewards([1]))
      .to.be.revertedWith('Not eligible for bonus claim');

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      let userBalance=await tokenContract.balanceOf(UserBet2.address);
      //console.log("User balance: "+userBalance);
      await  cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      let newUserBalance=await tokenContract.balanceOf(UserBet2.address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());

      //Round 
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claimBonusRewards([epoch-1]))
      .to.emit(cointossContract, "ClaimBonus")
      .withArgs(UserBet1Address,epoch-1,betAmount);

      let currentUserBalance=await boldContract.balanceOf(UserBet2.address);
      expect(currentUserBalance).to.eq(0);
      await expect(cointossContract.connect(UserBet2).claimBonusRewards([epoch-1]))
      .to.emit(cointossContract, "ClaimBonus")
      .withArgs(UserBet2Address,epoch-1,betAmount);
      await expect(cointossContract.connect(UserBet2).claimBonusRewards([epoch-1]))
      .to.be.revertedWith('Not eligible for bonus claim');
      currentUserBalance=await boldContract.balanceOf(UserBet2.address);
      expect(currentUserBalance.div(1000)).to.eq("310387425584");

      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      await  cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      await cointossContract.connect(UserBet2).betHeads(epoch,betAmount);
      await cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      currentRouterBalance=await boldContract.balanceOf(routerContract.address);
      currentUserBalance=await boldContract.balanceOf(UserBet1Address);
      await cointossContract.connect(UserBet1).claimBonusRewards([epoch-2,epoch-1]);
      newUserBalance=await boldContract.balanceOf(UserBet1Address);
      expect(newUserBalance.div(1000)).to.eq("1551937127922");
      newRouterBalance=await boldContract.balanceOf(routerContract.address);
      expect(newRouterBalance).to.eq(currentRouterBalance);

      await expect(cointossContract.connect(UserBet1).claimBonusRewards([epoch-2,epoch-1]))
      .to.be.revertedWith('Not eligible for bonus claim');

      await expect(cointossContract.connect(UserBet2).claimBonusRewards([epoch-2,epoch-1]))
      .to.emit(cointossContract, "ClaimBonus")
      .withArgs(UserBet2Address,epoch-1,betAmount);

      await expect(cointossContract.connect(UserBet1).claimBonusRewards([epoch-2,epoch-1]))
      .to.be.revertedWith('Not eligible for bonus claim');

      await expect(cointossContract.connect(Admin).claimTreasury())
      .to.emit(cointossContract, "TreasuryClaim")
      .withArgs(8*betFeeAmount);
   });


   // ***************************************************************
   //                   BETTING - REFUND (BETS IN ONE SIDE)
   //  ***************************************************************
   it("Test REFUND (BETS IN ONE SIDE)", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let betAmount=minBetAmount;
      let betAmountExFees=minBetAmount-minBetAmount*treasuryFee/10000;//    (1-treasuryFee/100);
      let betFeeAmount=betAmount-betAmountExFees;
      //console.log(`AMount: ${betAmount} without fee: ${betAmountExFees}`);
      let epoch;

      //Genesis round
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await cointossContract.connect(Operator).genesisStartRound();

      await expect(cointossContract.claim([1]))
      .to.be.revertedWith('Round has not ended');

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      let userBalance=await tokenContract.balanceOf(UserBet1.address);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      let newUserBalance=await tokenContract.balanceOf(UserBet1.address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
      epoch=await cointossContract.currentEpoch();

      let routerBalance=await tokenContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(betAmount);
      await expect(cointossContract.connect(UserBet1).claim([epoch-1]))
      .to.emit(cointossContract, "Claim")
      .withArgs(UserBet1Address,epoch-1,betAmountExFees);
      routerBalance=await tokenContract.balanceOf(routerContract.address);
      expect(routerBalance).to.eq(betFeeAmount);
      currentUserBalance=await tokenContract.balanceOf(UserBet1Address);
      expect(currentUserBalance.toString()).to.eq(newUserBalance.add(betAmountExFees).toString());

      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,HEADS);
      epoch=await cointossContract.currentEpoch();

      await cointossContract.connect(UserBet1).betHeads(epoch,betAmount);
      await cointossContract.connect(UserBet1).betHeads(epoch,betAmount);

      //Round
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      currentRouterBalance=await tokenContract.balanceOf(routerContract.address);
      currentUserBalance=await tokenContract.balanceOf(UserBet1Address);
      await cointossContract.connect(UserBet1).claim([epoch-2,epoch-1]);
      newUserBalance=await tokenContract.balanceOf(UserBet1Address);
      expect(newUserBalance.toString()).to.eq(currentUserBalance.add(betAmountExFees*4).toString());
      newRouterBalance=await tokenContract.balanceOf(routerContract.address);
      expect(newRouterBalance.toString()).to.eq(currentRouterBalance.sub(betAmountExFees*4).toString());

      await expect(cointossContract.connect(UserBet1).claim([epoch-2,epoch-1]))
      .to.be.revertedWith('Not eligible for claim');

      await expect(cointossContract.connect(Admin).claimTreasury())
      .to.emit(cointossContract, "TreasuryClaim")
      .withArgs(5*betFeeAmount);
      newRouterBalance=await tokenContract.balanceOf(routerContract.address);
      expect(newRouterBalance.toString()).to.eq("0");

      let treasuryWallet=await routerContract.treasuryWallet();
      let txFeeWallet=await routerContract.txFeeWallet();
      let treasuryAmount=await tokenContract.balanceOf(treasuryWallet);
      let txAmount=await tokenContract.balanceOf(txFeeWallet);
      let RoutertreasuryFee=await routerContract.treasuryFee();
      let expectedTreasuryAmount=(betFeeAmount*5)*RoutertreasuryFee/100;
      let expectedFxAmount=(betFeeAmount*5-expectedTreasuryAmount);
      //console.log(JSON.stringify([treasuryWallet,txFeeWallet, treasuryAmount, txAmount, RoutertreasuryFee,expectedTreasuryAmount,expectedFxAmount]));
      expect(treasuryAmount).to.eq(expectedTreasuryAmount);
      expect(txAmount).to.eq(expectedFxAmount);
   });

   // ***************************************************************
   //                   BETTING - REFUND (MAKE REFUNDABLE)
   //  ***************************************************************
   it("Test REFUND (MAKE REFUNDABLE)", async ()=> {
      let blockInfo=await linkMockContract.getBlockInfo();
      let timestamp=blockInfo.blockTimestamp.toNumber()+2;
      let betAmount=minBetAmount;
      let betAmountExFees=minBetAmount-minBetAmount*treasuryFee/10000;//    (1-treasuryFee/100);
      let betFeeAmount=betAmount-betAmountExFees;
      //console.log(`AMount: ${betAmount} without fee: ${betAmountExFees}`);
      let epoch;

      //genesis round
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await expect(cointossContract.connect(UserBet1).claim([0]))
      .to.be.revertedWith('Round has not started');
      await cointossContract.connect(Operator).genesisStartRound();

      await expect(cointossContract.claim([1]))
      .to.be.revertedWith('Round has not ended');

      //Round 
      timestamp+=intervalSeconds+8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await cointossContract.connect(Coordinator).rawFulfillRandomness(requestId,TAILS);
      epoch=await cointossContract.currentEpoch();

      await expect(cointossContract.connect(UserBet1).claim([1]))
      .to.be.revertedWith('Not eligible for claim');

      timestamp+=8;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await  cointossContract.connect(UserBet1).betTails(epoch,betAmount); // *****   BET
      let userBalance=await tokenContract.balanceOf(UserBet2.address);
      //console.log("User balance: "+userBalance);
      await  cointossContract.connect(UserBet2).betHeads(epoch,betAmount); // *****   BET
      let newUserBalance=await tokenContract.balanceOf(UserBet2.address);
      expect(newUserBalance.toString()).to.eq(userBalance.sub(betAmount).toString());

      //MAKE ROUND REFUNDABLE
      await cointossContract.connect(Admin).pause();
      await cointossContract.connect(Admin).makeRefundable(epoch);
      refundable=await cointossContract.refundable(epoch,UserBet1Address);
      expect(refundable).to.be.false;
      await cointossContract.connect(Admin).unpause();

       // Round New GENESIS ROUND
       timestamp+=8;
       await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
       await cointossContract.connect(Operator).genesisStartRound();
       epoch=await cointossContract.currentEpoch();
       //console.log("ROUND genesis:"+epoch);
       refundable=await cointossContract.refundable(epoch-1,UserBet1Address);
       expect(refundable).to.be.false;

      //create new blocks in chain
      timestamp+=300;
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
      await network.provider.send("evm_mine", []); // Force block creation as round.closetimestamp must be lower than block.timestamp
      refundable=await cointossContract.refundable(epoch-1,UserBet1Address);      
      expect(refundable).to.be.true;
      refundable=await cointossContract.refundable(epoch-1,UserBet2Address);      
      expect(refundable).to.be.true;

      //console.log("Amount Ex fees: "+betAmountExFees);
      await expect(cointossContract.connect(UserBet1).claim([epoch-1]))
      .to.emit(cointossContract, "Claim")
      .withArgs(UserBet1Address,epoch-1,betAmountExFees);

      await expect(cointossContract.connect(UserBet2).claim([epoch-1]))
      .to.emit(cointossContract, "Claim")
      .withArgs(UserBet2Address,epoch-1,betAmountExFees);

      await expect(cointossContract.connect(UserBet1).claim([epoch-1]))
      .to.be.revertedWith('Not eligible for refund');

      let treasueyAmount=await cointossContract.treasuryAmount();
      expect(treasueyAmount).to.eq(betFeeAmount*2);

      await expect(cointossContract.connect(Admin).claimTreasury())
      .to.emit(cointossContract, "TreasuryClaim")
      .withArgs(betFeeAmount*2);

      let treasuryWallet=await routerContract.treasuryWallet();
      let txFeeWallet=await routerContract.txFeeWallet();
      let treasuryAmount=await tokenContract.balanceOf(treasuryWallet);
      let txAmount=await tokenContract.balanceOf(txFeeWallet);
      let RoutertreasuryFee=await routerContract.treasuryFee();
      let expectedTreasuryAmount=(betFeeAmount*2)*RoutertreasuryFee/100;
      let expectedFxAmount=(betFeeAmount*2-expectedTreasuryAmount);
      //console.log(JSON.stringify([treasuryWallet,txFeeWallet, treasuryAmount, txAmount, RoutertreasuryFee,expectedTreasuryAmount,expectedFxAmount]));
      expect(treasuryAmount).to.eq(expectedTreasuryAmount);
      expect(txAmount).to.eq(expectedFxAmount);
   
   });
});