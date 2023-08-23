// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Interface of the Rules Engine actions handlers
 */
interface IRulesEngineActionsHandlers {
    /**
     * @notice Set address of the action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param additionalId Additional identifier
     * @param handler Action handler address
     */
    function setActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        address handler
    ) external;

    /**
     * @notice Set address of the action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param propertyId Property identifier
     * @param subId Addition identifier (may be empty)
     * @param handler Action handler address
     */
    function setPropertyActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull,
        address handler
    ) external;

    /**
     * @notice Set actions handler for the sender
     * @param actionsList List of the actions
     * @param handler Actions handler
     * @param additionalId Additional identifier
     */
    function selfSetMultipleActionsHandler(
        bytes32[] calldata actionsList,
        bytes32 additionalId,
        address handler
    ) external;

    /**
     * @notice Set actions handler for the sender
     * @param actionsList List of the actions
     * @param handler Actions handler
     * @param subId Sub identifier
     */
    function selfSetMultiplePropertyActionsHandler(
        bytes32[] calldata actionsList,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull,
        address handler
    ) external;

    /**
     * @return action handler and existance flag
     * @param smartContract Smart contract address
     * @param action Action to be handled
     */
    function getActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) external view returns (address, bool);

    /**
     * @return action handler and existance flag
     * @dev returns base permission action handler if there is no action handler
     * @param smartContract Smart contract address
     * @param action Action to be verified
     * @param additionalId Addition identifier (may be empty)
     */
    function getSafeActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) external view returns (address, bool);

    /**
     * @return Action handler and existance flag
     * @param smartContract Smart contract address
     * @param action Action to be handled
     */
    function getPropertyActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) external view returns (address, bool);

    /**
     * @return Safe action handler and existance flag
     * @dev returns base permission action handler if there is no action handler
     * @param smartContract Smart contract address
     * @param action Action to be handled
     */
    function getSafePropertyActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) external view returns (address, bool);
}
