// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Interface of the Rules Engine events
 */
interface IRulesEngineEvents {
    /**
     * @notice Write info to the log when action handler was changed
     */
    event ActionHandlerChanged(
        address indexed smartContract,
        bytes32 indexed action,
        bytes32 indexed additionalId,
        address handler
    );

    /**
     * @notice Write info to the log when action permission properrty was changed
     */
    event ActionPermissionPropertyChanged(
        address indexed smartContract,
        bytes32 indexed action,
        bytes32 indexed additionalId,
        bytes32 propertyId
    );
}
