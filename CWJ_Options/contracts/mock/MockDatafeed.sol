pragma solidity ^0.8.0;


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


contract MockDatafeed is AggregatorV3Interface{
    
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
        return "Mock oracle";
    }


  function version()
    external override
    view
    returns (
      uint256
    ){
        return 1;
    }

    function getRoundData(
    uint80 _roundId
  )
    external override
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ){
        return _getRound(_roundId);
    }

  function latestRoundData()
    public override
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ){
        return _getRound(uint80(block.number));
    }

  function _random() public view returns(int256){
        // DO NOT USE THIS IN PRODUCTION!!!!!!!!
        uint256 random=uint(blockhash(block.number-1)) & uint(0xFF); // 0-256
         require(random>=0,"Random must be greater than 0");
         require(random<=256,"Random must be lower than 256");
        //return int(random);
        int256 result= int256(initialPrice+random);
        require(result>=0,"Result must be greater than 0");
        return (result*1000000000000000000);
    }

    function _getRound(uint80 id) public view  
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
    {
      roundId=id;
      answer=_random();
      startedAt=block.timestamp;
      updatedAt=block.timestamp;
      answeredInRound=id;
    }

    event roundData(uint80 roundId,int256 answer, uint256 startedAt, uint256 updatedAt,uint80 answeredInRound);
    function exec() public {
      (
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
      )=latestRoundData();
      emit roundData(_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);

    }

}