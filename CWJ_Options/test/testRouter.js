const { expect } = require("chai");
const { ethers } = require("hardhat");

// Equivalence Formula Params
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
const ZERO_ADDRESS="0x0000000000000000000000000000000000000000";


describe("Router contract tests", function () {
    let Owner, Other, Third, TX, Treasury;
    let OwnerAddress, OtherAddress, ThirdAddress;
    let equivalenceContract;

    beforeEach(async ()=>{
        [Owner, Other, Third, TX, Treasury] = await ethers.getSigners();
        [OwnerAddress, OtherAddress, ThirdAddress, TXAddress, TreasuryAddress]=await Promise.all([
            Owner.getAddress(),
            Other.getAddress(),
            Third.getAddress(),
            TX.getAddress(),
            Treasury.getAddress(),
        ]);
        //console.log("ADDRESSES");
        //console.log(JSON.stringify([OwnerAddress, OtherAddress, ThirdAddress]));
        const [FactoryEquivalence,FactoryRouter, FactoryToken,BoldFactory] = await Promise.all([
           ethers.getContractFactory("EquivalenceFormula"),
           ethers.getContractFactory("Router"),
           ethers.getContractFactory("SpoxToken"),
           ethers.getContractFactory("BoldToken")
        ]);
        //Deployment
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
        boldContract=await BoldFactory.deploy();
        await boldContract.deployed();
        await tokenContract.deployed();
        //Allowances
        await Promise.all([
         tokenContract.connect(Owner).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(Other).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         tokenContract.connect(Third).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Owner).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Other).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
         boldContract.connect(Third).approve(routerContract.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        ]);


        await boldContract.connect(Owner).allowContract(routerContract.address);
        await routerContract.setTreasuryWallet(TreasuryAddress);
        await routerContract.setTxFeeWallet(TXAddress);
        await routerContract.setTreasuryToken(boldContract.address);
    });
    
    it("Test equivalence contract", async ()=> {
       let result=await routerContract.equivalenceContract();
       expect(result).to.equal(equivalenceContract.address);
    });

    it("Test allowed contracts", async ()=> {
      let contractAddress=tokenContract.address;
      let result=await routerContract.isAllowedContract(contractAddress);
      expect(result).to.be.false;
      await expect(routerContract.allowContract(contractAddress))
         .to.emit(routerContract, "contractAllowed")
         .withArgs(contractAddress, true);

      result=await routerContract.isAllowedContract(contractAddress);
      expect(result).to.be.true;
   });

   it("Test allowed contracts not owner", async ()=> {
      let contractAddress=tokenContract.address;
     
      await expect(routerContract.connect(Other).allowContract(contractAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test disallowed contracts", async ()=> {
      let contractAddress=tokenContract.address;
      await expect(routerContract.allowContract(contractAddress))
         .to.emit(routerContract, "contractAllowed")
         .withArgs(contractAddress, true);

      result=await routerContract.isAllowedContract(contractAddress);
      expect(result).to.be.true;

      await expect(routerContract.disAllowContract(contractAddress))
      .to.emit(routerContract, "contractDisallowed")
      .withArgs(contractAddress, false);

      result=await routerContract.isAllowedContract(contractAddress);
      expect(result).to.be.false;
   });

   it("Test disallowed contracts not owner", async ()=> {
      let contractAddress=tokenContract.address;
     
      await expect(routerContract.connect(Other).disAllowContract(contractAddress))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test Emit events", async ()=> {
      let eventType=1;
      let eventCaller=tokenContract.address;
      let eventSender=OwnerAddress;
      let eventEpoch=10;
      let eventAmount=20;
      let timestamp=22639496325;

      let callerAddress=OtherAddress;
      await routerContract.allowContract(callerAddress);

      //Set next block timestamp
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp])

      await expect(routerContract.connect(Other).emitEvent(eventType,eventCaller,eventSender,eventEpoch,eventAmount))
      .to.emit(routerContract, "betEvent")
      .withArgs(eventType, eventCaller,eventSender,eventEpoch,eventAmount,timestamp);
   });

   it("Test Emit events not allowed", async ()=> {
      let eventType=1;
      let eventCaller=tokenContract.address;
      let eventSender=OwnerAddress;
      let eventEpoch=10;
      let eventAmount=20;

      await expect(routerContract.emitEvent(eventType,eventCaller,eventSender,eventEpoch,eventAmount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test equivalence to BOLD formula", async ()=> {
      let amount="10000000000000000000";
      let boldAmount="3103874255846147000";
      let tokenAddress=Other.address;
      let userAddress=ThirdAddress;

      let calculatedAmount=await routerContract.calculateEquivalenceToBold(tokenAddress,userAddress,amount);

      expect(calculatedAmount).to.eq(boldAmount);
   });

   it("Test equivalence from BOLD formula", async ()=> {
      let amount="1000000000000000000";
      let tokenAmount=amount;
      let tokenAddress=Other.address;
      let userAddress=ThirdAddress;

      let calculatedAmount=await routerContract.calculateEquivalenceFromBold(tokenAddress,userAddress,amount);
      expect(calculatedAmount).to.eq(tokenAmount);
   });

   it("Test change equivalence address", async ()=> {
      let newEquivalence=Other.address;

      await routerContract.changeEquivalence(newEquivalence);

      let currentEquivalence=await routerContract.equivalenceContract();

      expect(currentEquivalence).to.eq(newEquivalence);
   });

   it("Test change equivalence address not allowed", async ()=> {
      let newEquivalence=Other.address;

      await expect(routerContract.connect(Other).changeEquivalence(newEquivalence))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test owner can add/remove address to blacklist", async () => {

      expect(await routerContract.isInBlackList(OtherAddress)).to.be.false;
  
      await routerContract.addToBlackList(OtherAddress);
      expect(await routerContract.isInBlackList(OtherAddress)).to.be.true;
  
      await routerContract.removeFromBlackList(OtherAddress);
      expect(await routerContract.isInBlackList(OtherAddress)).to.be.false;
    
    });

    it("Test if router cannot be added to blacklist", async () => {

      expect(await routerContract.isInBlackList(routerContract.address)).to.be.false;
  
      
      await expect( routerContract.addToBlackList(routerContract.address)).
      to.be.revertedWith('Router cannot be banned');
   });

   it("Test if events are thrown", async () => {

      await expect(routerContract.addToBlackList(OtherAddress)).
      to.emit(routerContract,"blackListEvent").withArgs(OtherAddress,true);
  
      await expect(routerContract.addToBlackList(OtherAddress)).not.
      to.emit(routerContract,"blackListEvent");
  
      await expect(routerContract.removeFromBlackList(OtherAddress)).
      to.emit(routerContract,"blackListEvent").withArgs(OtherAddress,false);
  
      await expect(routerContract.removeFromBlackList(OtherAddress)).not.
      to.emit(routerContract,"blackListEvent");
   
    });

    it("Test if other address (not owner) can add/remvove address to blacklist", async () => {

      await expect( routerContract.connect(Other).addToBlackList(OtherAddress)).
      to.be.revertedWith('Ownable: caller is not the owner');
      await expect( routerContract.connect(Other).removeFromBlackList(OtherAddress)).
      to.be.revertedWith('Ownable: caller is not the owner');
    });

   it("Test payment", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);

      await routerContract.connect(Other).payment(tokenAddress,OwnerAddress,amount);
      let currentAMount=await tokenContract.balanceOf(routerContract.address);
      expect(currentAMount).to.be.eq(amount);

   });

   it("Test payment not allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000;

    await expect(routerContract.payment(tokenAddress,OwnerAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test payment blacklisted", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);
      await routerContract.addToBlackList(OwnerAddress);

      await expect(routerContract.connect(Other).payment(tokenAddress,OwnerAddress,amount))
      .to.be.revertedWith('BlackList: Address is blacklisted');

   });

   it("Test profit", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);

      await routerContract.connect(Other).payment(tokenAddress,OwnerAddress,amount);
      await routerContract.connect(Other).profit(tokenAddress,ThirdAddress,amount);

      let currentAMount=await tokenContract.balanceOf(ThirdAddress);
      expect(currentAMount).to.be.eq(amount);
   });

   
   it("Test profit allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000;

    await expect(routerContract.profit(tokenAddress,OwnerAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test profit blacklisted", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);
      await routerContract.addToBlackList(OwnerAddress);

      await expect(routerContract.connect(Other).profit(tokenAddress,OwnerAddress,amount))
      .to.be.revertedWith('BlackList: Address is blacklisted');

   });

   it("Test treasuryTransfer", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      let txFeeWallet=await routerContract.txFeeWallet();
      let treasuryWallet=await routerContract.txFeeWallet();
      let fee=await routerContract.treasuryFee();
      await routerContract.allowContract(contractAddress);

      await routerContract.connect(Other).payment(tokenAddress,OwnerAddress,amount);
      await routerContract.connect(Other).treasuryTransfer(tokenAddress,amount);

      let currentTxAmount=await tokenContract.balanceOf(txFeeWallet);
      let currentTreasuryAmount=await tokenContract.balanceOf(treasuryWallet);
      
      expect(currentTxAmount).to.be.eq(amount-amount*fee/100);
      expect(currentTreasuryAmount).to.be.eq(amount*fee/100);

   });
   
   it("Test treasuryTransfer not allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000;

    await expect(routerContract.treasuryTransfer(tokenAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test treasuryTransferhouse", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      let txFeeWallet=await routerContract.txFeeWallet();
      let treasuryWallet=await routerContract.txFeeWallet();
      let fee=await routerContract.treasuryFee();
      await routerContract.allowContract(contractAddress);

      await routerContract.connect(Other).payment(tokenAddress,OwnerAddress,amount);
      await routerContract.connect(Other).treasuryHouseTransfer(tokenAddress,amount);

      let currentTxAmount=await tokenContract.balanceOf(txFeeWallet);
      let currentTreasuryAmount=await tokenContract.balanceOf(treasuryWallet);
      
      expect(currentTxAmount).to.be.eq(amount-amount*fee/100);
      expect(currentTreasuryAmount).to.be.eq(amount*fee/100);

   });
   
   it("Test treasuryTransferhouse not allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000;

    await expect(routerContract.treasuryHouseTransfer(tokenAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test tokenToWeth", async ()=> {
      let contractAddress=OtherAddress;
      let amount=1000;
      let treasuryWallet=await routerContract.treasuryWallet();
      let boldAmount="1000000000000000000";// Bold -> Weth await routerContract.calculateEquivalence(boldContract.address,OtherAddress,amount);
      let totalBold ="2000000000000000000";// Bold -> Weth await routerContract.calculateEquivalence(boldContract.address,OtherAddress,amount);
      await routerContract.allowContract(contractAddress);
      
      await boldContract.transfer(routerContract.address,totalBold);
      await boldContract.transfer(OtherAddress,totalBold);
      
      // console.log("amount:"+amount);
      // console.log("Bold amount: "+boldAmount);
      // console.log("Balance: "+(await boldContract.balanceOf(routerContract.address)));
      let treasuryToken=await routerContract.treasuryToken();
      expect(treasuryToken).to.be.eq(boldContract.address);
      await routerContract.connect(Other).tokenToWeth(boldContract.address,OtherAddress,boldAmount);
       let currentRouterAmount=await boldContract.balanceOf(routerContract.address);
      expect(currentRouterAmount).to.be.equal(0);
      // await expect(routerContract.connect(Other).tokenToWeth(boldContract.address,OtherAddress,amount))
      // .to.be.revertedWith('EquivalenceFormula - calculateFromBold cannot be used. It is deprecated');
   });

   it("Test tokenToWeth not allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000;

    await expect(routerContract.connect(Other).tokenToWeth(boldContract.address,OtherAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test tokenToWeth blacklisted", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      let treasuryFee=10;
      await routerContract.allowContract(contractAddress);
      await routerContract.addToBlackList(OwnerAddress);

      await expect(routerContract.connect(Other).transferAndBurn(tokenAddress,OwnerAddress,amount,treasuryFee))
      .to.be.revertedWith('BlackList: Address is blacklisted');

   });

   it("Test transferAndBurn", async ()=> {
      let contractAddress=OtherAddress;
      let amount=1000000000,treasuryFee=300;
      await routerContract.allowContract(contractAddress);

      await boldContract.transfer(OtherAddress,amount);

      await routerContract.connect(Other).transferAndBurn(boldContract.address,OtherAddress,amount,treasuryFee);
      let otherBalance=await boldContract.balanceOf(OtherAddress);
      let rounterBalance=await boldContract.balanceOf(routerContract.address);

      expect(otherBalance).to.be.eq(0);
      //let amnt=(amount*treasuryFee/10000);
      // It burns reasury amout
      let amnt=0;
      expect(rounterBalance).to.be.eq(amnt);
   });

   it("Test transferAndBurn not allowed", async ()=> {
      let tokenAddress=tokenContract.address;
      let amount=1000,treasuryFee=300;

    await expect(routerContract.transferAndBurn(boldContract.address,OtherAddress,amount,treasuryFee))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test transferAndBurn blacklisted", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000,treasuryFee=300;
      await routerContract.allowContract(contractAddress);
      await routerContract.addToBlackList(OwnerAddress);

      await expect(routerContract.connect(Other).transferAndBurn(tokenAddress,OwnerAddress,amount,treasuryFee))
      .to.be.revertedWith('BlackList: Address is blacklisted');

   });

   it("Test mint", async ()=> {
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);

      await routerContract.connect(Other).mint(boldContract.address,OtherAddress,amount);
      let otherBalance=await boldContract.balanceOf(OtherAddress);
      let rounterBalance=await boldContract.balanceOf(routerContract.address);

      expect(otherBalance).to.be.eq(amount);
      expect(rounterBalance).to.be.eq(0);
   });

   it("Test mint not allowed", async ()=> {
      let amount=1000;

    await expect(routerContract.connect(Other).mint(boldContract.address,OtherAddress,amount))
      .to.be.revertedWith('onlyAllowedContracts: This address is not allowed');
   });

   it("Test mint blacklisted", async ()=> {
      let tokenAddress=tokenContract.address;
      let contractAddress=OtherAddress;
      let amount=1000;
      await routerContract.allowContract(contractAddress);
      await routerContract.addToBlackList(OwnerAddress);

      await expect(routerContract.connect(Other).mint(tokenAddress,OwnerAddress,amount))
      .to.be.revertedWith('BlackList: Address is blacklisted');

   });

   it("Test change setTreasuryFee", async ()=> {
      let newTreasuryFee=60;
      await routerContract.setTreasuryFee(newTreasuryFee);

      let currenttreasuryFee=await routerContract.treasuryFee();

      expect(currenttreasuryFee).to.eq(newTreasuryFee);
   });

   it("Test change setTreasuryFee not allowed", async ()=> {
      let newTreasuryFee=60;

      await expect(routerContract.connect(Other).setTreasuryFee(newTreasuryFee))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change PredictionToken zero address", async ()=> {
      let newToken=Other.address;

      expect(routerContract.setPredictionToken(ZERO_ADDRESS))
      .to.be.revertedWith("New address cannot be zero");
   });

   it("Test change PredictionToken address", async ()=> {
      let newToken=Other.address;

      await routerContract.setPredictionToken(newToken);

      let currentnewToken=await routerContract.bold();

      expect(currentnewToken).to.eq(newToken);
   });

   it("Test change PredictionToken address not allowed", async ()=> {
      let newToken=Other.address;

      await expect(routerContract.connect(Other).setPredictionToken(newToken))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change treasuryToken address", async ()=> {
      let newtreasuryToken=Other.address;

      await routerContract.changeEquivalence(newtreasuryToken);

      let currenttreasuryToken=await routerContract.equivalenceContract();

      expect(currenttreasuryToken).to.eq(newtreasuryToken);
   });

   it("Test change treasuryToken address not allowed", async ()=> {
      let newtreasuryToken=Other.address;

      await expect(routerContract.connect(Other).changeEquivalence(newtreasuryToken))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change txFeeWallet address", async ()=> {
      let newTxFeeWallet=Other.address;

      await routerContract.changeEquivalence(newTxFeeWallet);

      let currentTxFeeWallet=await routerContract.equivalenceContract();

      expect(currentTxFeeWallet).to.eq(newTxFeeWallet);
   });

   it("Test change txFeeWallet address not allowed", async ()=> {
      let newTxFeeWallet=Other.address;

      await expect(routerContract.connect(Other).changeEquivalence(newTxFeeWallet))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change TreasuryWallet address", async ()=> {
      let newTreasuryWallet=Other.address;

      await routerContract.changeEquivalence(newTreasuryWallet);

      let currentTreasuryWallet=await routerContract.equivalenceContract();

      expect(currentTreasuryWallet).to.eq(newTreasuryWallet);
   });

   it("Test change TreasuryWallet address not allowed", async ()=> {
      let newTxFeeWallet=Other.address;

      await expect(routerContract.connect(Other).changeEquivalence(newTxFeeWallet))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   










   it("Test change setTreasuryToken zero address", async ()=> {
      let newToken=Other.address;

      expect(routerContract.setTreasuryToken(ZERO_ADDRESS))
      .to.be.revertedWith("New address cannot be zero");
   });

   it("Test change setTreasuryToken address", async ()=> {
      let newToken=Other.address;

      await routerContract.setTreasuryToken(newToken);

      let currentnewToken=await routerContract.treasuryToken();

      expect(currentnewToken).to.eq(newToken);
   });

   it("Test change setTreasuryToken address not allowed", async ()=> {
      let newToken=Other.address;

      await expect(routerContract.connect(Other).setTreasuryToken(newToken))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });


   it("Test change setTxFeeWallet zero address", async ()=> {
      let newToken=Other.address;

      expect(routerContract.setTxFeeWallet(ZERO_ADDRESS))
      .to.be.revertedWith("New address cannot be zero");
   });

   it("Test change setTxFeeWallet address", async ()=> {
      let newToken=Other.address;

      await routerContract.setTxFeeWallet(newToken);

      let currentnewToken=await routerContract.txFeeWallet();

      expect(currentnewToken).to.eq(newToken);
   });

   it("Test change setTxFeeWallet address not allowed", async ()=> {
      let newToken=Other.address;

      await expect(routerContract.connect(Other).setTxFeeWallet(newToken))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change setTreasuryWallet zero address", async ()=> {
      let newToken=Other.address;

      expect(routerContract.setTreasuryWallet(ZERO_ADDRESS))
      .to.be.revertedWith("New address cannot be zero");
   });

   it("Test change setTreasuryWallet address", async ()=> {
      let newToken=Other.address;

      await routerContract.setTreasuryWallet(newToken);

      let currentnewToken=await routerContract.treasuryWallet();

      expect(currentnewToken).to.eq(newToken);
   });

   it("Test change setTreasuryWallet address not allowed", async ()=> {
      let newToken=Other.address;

      await expect(routerContract.connect(Other).setTreasuryWallet(newToken))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });


});