const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, Contract } = require("ethers");

const priceRatio=1000; //3221.78
const ratio = 1000;
const decimals = 3;
const kink1 = "50000000000000000000"; //50 in wei
const A1 =500; //0.5
const C1 =25000; //25
const kink2 = "100000000000000000000"; //0,03 in wei
const A2 =100;
const C2 =65000;
const maxError=500; //0.005% max error

function calculateError(amount1,amount2){
   big1=BigNumber.from(amount1);
   big2=BigNumber.from(amount2);
   error=big1.sub(big2).abs().mul(1000000);
   // console.log("Amount1"+amount1);
   // console.log("Amount2"+amount2);
   // console.log("Error A"+error);
   //console.log("Error "+error.div(big1));
   return error.div(big1);
}

describe("Equivalence Formula contract tests", function () {
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
        const FactoryEquivalence = await ethers.getContractFactory("EquivalenceFormula");
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
        await equivalenceContract.deployed();
    });

    it("Test initial params", async ()=> {
      [
         currentPriceRatio,
         currentRatio,
         currentDecimals,
         currentKink1,
         currentA1,
         currentC1,
         currentKink2,
         currentA2,
         currentC2
     ]=await Promise.all([
         equivalenceContract.priceRatio(),
         equivalenceContract.ratio(),
         equivalenceContract.decimals(),
         equivalenceContract.kink1(),
         equivalenceContract.A1(),
         equivalenceContract.C1(),
         equivalenceContract.kink2(),
         equivalenceContract.A2(),
         equivalenceContract.C2(),
     ])
      expect(currentPriceRatio).to.equal(priceRatio);
      expect(currentRatio).to.equal(ratio);
      expect(currentDecimals).to.equal(decimals);
      expect(currentKink1).to.equal(kink1);
      expect(currentA1).to.equal(A1);
      expect(currentC1).to.equal(C1);
      expect(currentKink2).to.equal(kink2);
      expect(currentA2).to.equal(A2);
      expect(currentC2).to.equal(C2);

  });

    it("Test calculation from BOLD", async ()=> {
      let amount=1000;
      // expect(equivalenceContract.calculateFromBold(OtherAddress,OtherAddress,amount)).
      // to.be.revertedWith("EquivalenceFormula - calculateFromBold cannot be used. It is deprecated")
      let currentAmount=await equivalenceContract.calculateFromBold(OtherAddress,OtherAddress,amount);
      expect(currentAmount).to.be.equal(amount);
   });

   it("Test change price ratio from owner", async ()=> {
      let newRatio=2000000; //2000
      await equivalenceContract.setPriceRatio(newRatio);
      let currentRatio=await equivalenceContract.priceRatio();
      expect(currentRatio).to.equal(newRatio);
   });


   it("Test change price ratio from not owner", async ()=> {
      let newRatio=2000000; //2000
      await expect(equivalenceContract.connect(Other).setPriceRatio(newRatio))
      .to.be.revertedWith('Ownable: caller is not the owner');

   });


    it("Test change ratio from owner", async ()=> {
        let newRatio=2000000; //2000
        await equivalenceContract.setRatio(newRatio);
        let currentRatio=await equivalenceContract.ratio();
        expect(currentRatio).to.equal(newRatio);
     });


     it("Test change ratio from not owner", async ()=> {
        let newRatio=2000000; //2000
        await expect(equivalenceContract.connect(Other).setRatio(newRatio))
        .to.be.revertedWith('Ownable: caller is not the owner');

     });

   it("Test change decimals from owner", async ()=> {
      let newDecimals=4;
      await equivalenceContract.setDecimals(newDecimals);
      let currentDecimals=await equivalenceContract.decimals();
      expect(currentDecimals).to.equal(newDecimals);
   });

   it("Test change decimals from not owner", async ()=> {
      let newDecimals=4;
      await expect(equivalenceContract.connect(Other).setDecimals(newDecimals))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change kink1 from owner", async ()=> {
      let newKink1=4000000000000000;
      await equivalenceContract.setKink1(newKink1);
      let currentKink1=await equivalenceContract.kink1();
      expect(currentKink1).to.equal(newKink1);
   });

   it("Test change kink1 from not owner", async ()=> {
      let newKink1=4000000000000000;
      await expect(equivalenceContract.connect(Other).setKink1(newKink1))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change kink2 from owner", async ()=> {
      let newKink2=6000000000000000;
      await equivalenceContract.setKink2(newKink2);
      let currentKink2=await equivalenceContract.kink2();
      expect(currentKink2).to.equal(newKink2);
   });

   it("Test change kink2 from not owner", async ()=> {
      let newKink2=4000000000000000;
      await expect(equivalenceContract.connect(Other).setKink1(newKink2))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change A1 from owner", async ()=> {
      let newA1=600;
      await equivalenceContract.setA1(newA1);
      let currentA1=await equivalenceContract.A1();
      expect(currentA1).to.equal(newA1);
   });

   it("Test change A1 from not owner", async ()=> {
      let newA1=600;
      await expect(equivalenceContract.connect(Other).setA1(newA1))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change A2 from owner", async ()=> {
      let newA2=200;
      await equivalenceContract.setA2(newA2);
      let currentA2=await equivalenceContract.A2();
      expect(currentA2).to.equal(newA2);
   });

   it("Test change A2 from not owner", async ()=> {
      let newA2=200;
      await expect(equivalenceContract.connect(Other).setA2(newA2))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change C1 from owner", async ()=> {
      let newC1=10000;
      await equivalenceContract.setC1(newC1);
      let currentC1=await equivalenceContract.C1();
      expect(currentC1).to.equal(newC1);
   });

   it("Test change A1 from not owner", async ()=> {
      let newC1=10000;
      await expect(equivalenceContract.connect(Other).setC1(newC1))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test change A2 from owner", async ()=> {
      let newC2=30000;
      await equivalenceContract.setC2(newC2);
      let currentC2=await equivalenceContract.C2();
      expect(currentC2).to.equal(newC2);
   });

   it("Test change A2 from not owner", async ()=> {
      let newC2=30000;
      await expect(equivalenceContract.connect(Other).setC2(newC2))
      .to.be.revertedWith('Ownable: caller is not the owner');
   });

   it("Test calculations", async ()=> {
      let amount,expected,result

      // Row 33
      amount="10000000000000000000";
      expected="10000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 34
      amount="20000000000000000000";
      expected="20000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 35
      amount="30000000000000000000";
      expected="30000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 36
      amount="40000000000000000000";
      expected="40000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 37
      amount="50000000000000000000";
      expected="50000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 39
      amount="70000000000000000000";
      expected="60000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

       // Row 40
       amount="80000000000000000000";
       expected="65000000000000000000"
       result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
       expect(calculateError(result,expected)).to.be.lt(maxError);

       // Row 41
       amount="90000000000000000000";
       expected="70000000000000000000"
       result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
       expect(calculateError(result,expected)).to.be.lt(maxError);


      // // Row 42
      amount="100000000000000000000";
      expected="75000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

      // Row 45
      amount="130000000000000000000";
      expected="78000000000000000000"
      result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
      expect(calculateError(result,expected)).to.be.lt(maxError);

       // Row 49
       amount="170000000000000000000";
       expected="82000000000000000000"
       result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
       expect(calculateError(result,expected)).to.be.lt(maxError);

        // Row 52
        amount="200000000000000000000";
        expected="85000000000000000000"
        result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
        expect(calculateError(result,expected)).to.be.lt(maxError);

         // Row 55
         amount="230000000000000000000";
         expected="88000000000000000000"
         result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
         expect(calculateError(result,expected)).to.be.lt(maxError);

         // Row 58
         amount="260000000000000000000";
         expected="91000000000000000000"
         result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
         expect(calculateError(result,expected)).to.be.lt(maxError);

         // Row 61
         amount="290000000000000000000";
         expected="94000000000000000000"
         result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
         expect(calculateError(result,expected)).to.be.lt(maxError);

          // Row 65
          amount="330000000000000000000";
          expected="98000000000000000000"
          result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
          expect(calculateError(result,expected)).to.be.lt(maxError);

           // Row 71
           amount="390000000000000000000";
           expected="104000000000000000000"
           result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
           expect(calculateError(result,expected)).to.be.lt(maxError);

            // Row 78
          amount="460000000000000000000";
          expected="111000000000000000000"
          result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
          expect(calculateError(result,expected)).to.be.lt(maxError);

            // Row 82
            amount="500000000000000000000";
            expected="115000000000000000000"
            result=await equivalenceContract.calculateToBold(OtherAddress,OtherAddress,amount);
            expect(calculateError(result,expected)).to.be.lt(maxError);
   });






});