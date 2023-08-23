// SPDX-License-Identifier: MIT
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

  function latestRoundData()
    external
    payable
    returns (
      uint80 roundId,
      int answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

}
