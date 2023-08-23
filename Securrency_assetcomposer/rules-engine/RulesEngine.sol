// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "./RulesEngineStorage.sol";
import "./interfaces/IRulesEngineInit.sol";

/**
 * @title Rules Engine
 * @notice Verify any operation depending on the token policy
 */
contract RulesEngine is RulesEngineStorage {
    /**
     * @notice Initialize default parameters
     * @param setup Setup contract address
     */
    constructor(address setup) {
        require(setup != address(0x00), "Rules Engine: Empty setup address");
        _initializationOwnerAddress = msg.sender;

        _methodsImplementations[IRulesEngineInit(address(0x00)).initialize.selector] = setup;
    }

    /**
     * @notice Receive function just to receive ether.
     */
    // solhint-disable-next-line comprehensive-interface
    receive() external payable {}

}
