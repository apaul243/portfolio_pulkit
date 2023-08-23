// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "../RulesEngineStructs.sol";

/**
 * @title Interface of the Rules Engine actions permissions
 */
interface IRulesEngineActionsPermissions {
    /**
     * @notice Set address of the action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param additionalId Addition identifier (may be empty)
     * @param permission Permission to set
     */
    function setActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        Permission calldata permission
    ) external;

    /**
     * @notice Set address of the property action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param propertyId Property identifier
     * @param subId Addition identifier (may be empty)
     * @param permission Permission to set
     */
    function setPropertyActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull,
        Permission calldata permission
    ) external;

    /**
     * @notice Set permission for multiple actions for the sender
     * @param actionsList List of the actions
     * @param additionalId Sub identifier
     * @param permission Permission
     */
    function selfSetMultipleActionsPermission(
        bytes32[] calldata actionsList,
        bytes32 additionalId,
        Permission calldata permission,
        bool isPropertyTarget
    ) external;

    /**
     * @notice Set permission for multiple property actions for the sender
     * @param actionsList List of the actions
     * @param subId Sub identifier
     * @param permission Permission
     */
    function selfSetMultiplePropertyActionsPermission(
        bytes32[] calldata actionsList,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull,
        Permission calldata permission
    ) external;

    /**
     * @return action permission
     * @param smartContract Smart contract address
     * @param action Action to be handled
     */
    function getActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) external view returns (Permission memory);

    /**
     * @return permission - action permission
     * @return exists - flag - true if action permission exists
     * @param smartContract Smart contract address
     * @param action Action to be verified
     * @param additionalId Addition identifier (may be empty)
     */
    function safeGetActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) external view returns (Permission memory permission, bool exists);

    /**
     * @return permission - action permission
     * @return exists - flag - true if action permission exists
     * @param smartContract Smart contract address
     * @param action Action to be verified
     */
    function safeGetPropertyActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) external view returns (Permission memory permission, bool exists);

    /**
     * @notice Calculates permission verification price
     * @param smartContract Smart contract address
     * @param action Action to be verified
     * @param additionalId Addition identifier (may be empty)
     * @param gasPrice Gas price
     * @return permission verification price
     */
    function getPermissionVerificationPrice(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        uint gasPrice
    ) external view returns (uint);

    /**
     * @notice Returns external calls total number for permission
     * @param smartContract Smart contract address
     * @param action Action to be verified
     * @param additionalId Addition identifier (may be empty)
     * @return permission external calls total number
     */
    function getPermissionExternalCallsTotal(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) external view returns (uint);
}
