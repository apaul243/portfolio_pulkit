const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS="0x0000000000000000000000000000000000000000";

describe("BOLD contract tests", function () {
    let Admin, Other, Third, TX, Treasury;
    let OwnerAddress, OtherAddress, ThirdAddress;
    let equivalenceContract;

    beforeEach(async ()=>{
      [Admin, Other, Third, TX, Treasury] = await ethers.getSigners();
      [AdminAddress, OtherAddress, ThirdAddress]=await Promise.all([
         Admin.getAddress(),
         Other.getAddress(),
         Third.getAddress()
      ]);
      //console.log("ADDRESSES");
      //console.log(JSON.stringify([OwnerAddress, OtherAddress, ThirdAddress]));
      const [BoldFactory] = await Promise.all([ethers.getContractFactory("BoldToken")]);
      //Deployment
      boldContract=await BoldFactory.deploy();
      await boldContract.deployed();
   
      ZeroAddress="0x0000000000000000000000000000000000000000";
    });
    
    it("Test initial ADMIN", async ()=> {
         let adminAddress=await boldContract.admin();
         expect(adminAddress).to.eq(AdminAddress);
    });

    it("Test initial balance", async ()=> {
       let initialBalance=await boldContract.balanceOf(AdminAddress);
      expect(initialBalance.toString()).to.eq("100000000000000000000000000000000");
   });

   it("Test transfer", async ()=> {
      let amount="100000000000000000";
      let initialBalance=await boldContract.balanceOf(OtherAddress);
      expect(initialBalance.toString()).to.eq("0");
      await boldContract.connect(Admin).transfer(OtherAddress,amount);
      let currentBalance=await boldContract.balanceOf(OtherAddress);
     expect(currentBalance.toString()).to.eq(amount.toString());
  });

    it("Test update ADMIN not ADMIN USER", async ()=> {

      await expect( boldContract.connect(Other).updateAdmin(OtherAddress))
      .to.be.revertedWith('BoldToken - only admin');
   });

   it("Test update ADMIN ZERO ADDRESS", async ()=> {

      await expect(boldContract.updateAdmin(ZERO_ADDRESS))
      .to.be.revertedWith('New admin cannot be zero');
   });

    it("Test update ADMIN", async ()=> {

      await expect(boldContract.updateAdmin(OtherAddress))
      .to.emit(boldContract, "AdminUpdated")
      .withArgs(OtherAddress);

      let adminAddress=await boldContract.admin();
      expect(adminAddress).to.eq(OtherAddress);
   });

   it("Test check allow contract not ADMIN", async ()=> {

      await expect( boldContract.connect(Other).allowContract(OtherAddress))
      .to.be.revertedWith('BoldToken - only admin');
   });

   it("Test check allow contract", async ()=> {
      let isAllowed
      isAllowed=await boldContract.isAllowedContract(OtherAddress);
      expect(isAllowed).to.be.false;

      await boldContract.connect(Admin).allowContract(OtherAddress);

      isAllowed=await boldContract.isAllowedContract(OtherAddress);
      expect(isAllowed).to.be.true;
   });

   it("Test check disallow contract not ADMIN", async ()=> {
      await expect( boldContract.connect(Other).disAllowContract(OtherAddress))
      .to.be.revertedWith('BoldToken - only admin');
   });

   it("Test check disallow contract", async ()=> {
      let isAllowed
      isAllowed=await boldContract.isAllowedContract(OtherAddress);
      expect(isAllowed).to.be.false;

      await boldContract.connect(Admin).allowContract(OtherAddress);

      isAllowed=await boldContract.isAllowedContract(OtherAddress);
      expect(isAllowed).to.be.true;

      await boldContract.connect(Admin).disAllowContract(OtherAddress);

      isAllowed=await boldContract.connect(Admin).isAllowedContract(OtherAddress);
      expect(isAllowed).to.be.false;
   });

   it("Test mint not allowed", async ()=> {
      let amount=10000000;
      await expect( boldContract.connect(Other).mint(ThirdAddress,amount))
      .to.be.revertedWith('BoldToken - This address is not allowed');
   });

   it("Test mint ", async ()=> {
      let amount=10000000;
      await boldContract.connect(Admin).allowContract(OtherAddress);

      await expect(boldContract.connect(Other).mint(ThirdAddress,amount))
      .to.emit(boldContract, "Transfer")
      .withArgs(ZeroAddress, ThirdAddress,amount);

      let currentBalance=await boldContract.balanceOf(ThirdAddress);
      expect(currentBalance).to.eq(amount);
   });

   it("Test burn not allowed", async ()=> {
      let amount=10000000;
      await expect( boldContract.connect(Other).burn(ThirdAddress,amount))
      .to.be.revertedWith('BoldToken - This address is not allowed');
   });

   it("Test burn ", async ()=> {
      let amount=10000000,currentBalance;
      await boldContract.connect(Admin).allowContract(OtherAddress);

      await expect(boldContract.connect(Other).mint(ThirdAddress,amount))
      .to.emit(boldContract, "Transfer")
      .withArgs(ZeroAddress, ThirdAddress,amount);

      currentBalance=await boldContract.balanceOf(ThirdAddress);
      expect(currentBalance).to.eq(amount);

      await expect(boldContract.connect(Other).burn(ThirdAddress,amount))
      .to.emit(boldContract, "Transfer")
      .withArgs(ThirdAddress,ZeroAddress,amount);

      currentBalance=await boldContract.balanceOf(ThirdAddress);
      expect(currentBalance).to.eq(0);

   });



});