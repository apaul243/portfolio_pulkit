pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/*
BOLD Token : Is our company's token, that will be used to place bets against the house. 
The rights to burn and mint this token is provided to only "Allowed contracts". Such contracts
are allowed or disallowed by the contract admin ( default to the one who initially deploys the 
contract). Router contract will be one such 'Allowed Contract', that will be permitted to mint 
or burn these tokens.
*/

contract BoldToken is ERC20 {
  
  address public admin;
  mapping(address =>bool) allowedcontracts;


  event AdminUpdated(address _admin);

  modifier onlyAdmin() {
    require(msg.sender == admin, 'BoldToken - only admin');
      _;
  }

  modifier onlyAllowedContracts(){
    require(isAllowedContract(msg.sender),"BoldToken - This address is not allowed");
     _;
  }


  constructor() ERC20("BOLD TOKEN", "BOLD") {
    admin = msg.sender;
    _mint(msg.sender, 3400000000000000000000000);
  }

  function mint(address to, uint amount) external onlyAllowedContracts {
    _mint(to, amount);
  }


  function burn(address owner, uint amount) external onlyAllowedContracts {
    _burn(owner, amount);
  }

  function allowContract(address _contract)  external  onlyAdmin{
      allowedcontracts[_contract]=true;
    }

  function disAllowContract(address _contract)  external onlyAdmin{
    allowedcontracts[_contract]=false;
  }

  function isAllowedContract(address _contract) public view returns(bool){
    if(allowedcontracts[_contract]==true){
        return true;
    }
    return false;
    }

  function updateAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin!=address(0),"New admin cannot be zero");
    admin = newAdmin;
    emit AdminUpdated(newAdmin);
  }

}
