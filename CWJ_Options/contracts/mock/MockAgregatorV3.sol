pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface AggregatorV3Interface {

    function decimals()
    external
    view
    returns (
      uint8
    );

  function description()
    external
    view
    returns (
      string memory
    );

  function version()
    external
    view
    returns (
      uint256
    );

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(
    uint80 _roundId
  )
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

}


contract MockAgregatorV3 is AggregatorV3Interface{
    
    uint public initialPrice=400; 
    
    function decimals()
    external override
    view
    returns (
      uint8
    ){
        return 18;
    }

  function description()
    external override
    view
    returns (
      string memory
    ){
        return "Mock Agregator for testing";
    }


    uint80 public roundId;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80  public answeredInRound;

  function version()
    external 
    override
    view
    returns (
      uint256
    ){
        return 1;
    }

    function getRoundData(uint80 _roundId)
    external override
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ){
        return latestRoundData();
    }

  function latestRoundData()
    public override
    view
    returns (
     uint80 _roundId,
      int256 _answer,
      uint256 _startedAt,
      uint256 _updatedAt,
      uint80 _answeredInRound
    ){
       //console.log("V3 roundId %i",roundId);
        return (roundId,answer,startedAt,updatedAt,answeredInRound);
    }

    function setOracleParameters(
      uint80 _roundId,
      int256 _answer,
      uint256 _updatedAt
      ) public {
        require(_roundId>roundId,"MOCK - New round must be greater than previous");
        roundId=_roundId;
        answer=_answer;
        startedAt=1000;
        updatedAt=_updatedAt;
        answeredInRound=10000;
        //console.log("V2 roundId %i",roundId);
      }

      //HELPER FUNCTION

    function getBlockInfo() public view returns(
       bytes32 blockHash,
        uint chainID,
        address coinbase,
        uint gaslimit,
        uint blockNumber,
        uint blockTimestamp
    ){
        return(
            blockhash(block.number),
                block.chainid,
                block.coinbase,
                block.gaslimit,
                block.number,
                block.timestamp
        );
    }

}