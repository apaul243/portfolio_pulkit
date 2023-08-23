const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Equivalence contract tests", function () {
    let Owner, Other, Third;
    let OwnerAddress, OtherAddress, ThirdAddress;
    let equivalenceContract;

    beforeEach(async ()=>{
        [Owner, Other, Third] = await ethers.getSigners();
        [OwnerAddress, OtherAddress, ThirdAddress]=await Promise.all([
            Owner.getAddress(),
            Other.getAddress(),
            Third.getAddress(),
        ]);
        //console.log("ADDRESSES");
        //console.log(JSON.stringify([OwnerAddress, OtherAddress, ThirdAddress]));
        const FactoryEquivalence = await ethers.getContractFactory("Equivalence");
        equivalenceContract = await FactoryEquivalence.deploy(1000000);
        await equivalenceContract.deployed();
    });
    
    it("Test calculation to BOLD", async ()=> {
       let amount=1000;
       let result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
       expect(result).to.equal(amount*1000);
    });

    it("Test calculation from BOLD", async ()=> {
      let amount=1000;
      let result=await equivalenceContract.calculateFromBold(OtherAddress,OtherAddress,amount);
      expect(result).to.equal(amount/1000);
   });

    it("Test change ratio from owner", async ()=> {
        let newRatio=2000000; //2000
        await equivalenceContract.setRatio(newRatio);
        let currentRatio=await equivalenceContract.ratio();
        expect(currentRatio).to.equal(newRatio);
        let amount=10;
        let result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
        expect(result).to.equal(amount*2000);
     });

     it("Test change ratio from not owner", async ()=> {
        let newRatio=2000000; //2000
        await expect(equivalenceContract.connect(Other).setRatio(newRatio))
        .to.be.revertedWith('Ownable: caller is not the owner');
      
     });

     it("Test decimal equals 3", async ()=> {
        let result=await equivalenceContract.decimals();
        expect(result).to.equal(3);
      
     });


});