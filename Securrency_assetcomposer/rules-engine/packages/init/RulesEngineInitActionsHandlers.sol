// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./RulesEngineInitProtectedPackage.sol";
import "../../interfaces/IRulesEngineEvents.sol";
import "../../interfaces/IRulesEngineActionsHandlers.sol";
import "../../../../actions/ActionsIds.sol";
import "../../../../../common/libraries/CommonComplianceOracle.sol";
import "../../../../../common/libraries/AddressUtils.sol";

/**
 * @title Init Rules Engine actions handlers
 */
contract RulesEngineInitActionsHandlers is
    IRulesEngineEvents,
    IRulesEngineActionsHandlers,
    RulesEngineInitProtectedPackage,
    ActionsIds
{
    // Define libraries
    using AddressUtils for *;
    using PermissionsLib for *;
    using CommonComplianceOracle for *;

    /**
     * @notice Verifies set property action handler input
     */
    modifier verifyPropertyActionHandlerInput(
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) {
        if (!subIdNotNull) {
            require(subId == bytes32(0x00), "verifyPropertyActionHandlerInput: sub id not null");
        }
        require(
            _complianceOracleAddress._tryIsExistingProperty(propertyId),
            "verifyPropertyActionHandlerInput: Unexisting property"
        );
        _;
    }

    /**
     * @notice Verifies set action handler input
     */
    modifier verifySetActionHandlerInput(address smartContract, address handler) {
        require(smartContract.isContract(), "verifySetActionHandlerInput: Smart contract address belongs to EOA");
        require(handler.isContract(), "verifySetActionHandlerInput: Handler address belongs to EOA");
        _;
    }

    /**
     * @notice Verifies get action handler
     */
    modifier verifyGetActionHandler(address smartContract) {
        require(smartContract.isContract(), "verifyGetActionHandler: Smart contract address belongs to EOA");
        _;
    }

    /**
     * @notice Set address of the action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param additionalId Sub identifier
     * @param handler Action handler address
     */
    function setActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        address handler
    ) external override verifySetActionHandlerInput(smartContract, handler) {
        _verifyPermission(
            PermissionsLib.rulesEnginePermissionId(msg.sig, action),
            msg.sender,
            smartContract,
            additionalId
        );
        require(
            handler != _actionsHandlers[smartContract][action][additionalId],
            "setActionHandler: Action handler is the same"
        );

        _setActionHandler(smartContract, action, additionalId, handler);
    }

    /**
     * @notice Set address of the property action handler
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
    )
        external
        override
        verifySetActionHandlerInput(smartContract, handler)
        verifyPropertyActionHandlerInput(propertyId, subId, subIdNotNull)
    {
        _verifyPropertyPermission(
            PermissionsLib.rulesEnginePermissionId(msg.sig, action),
            msg.sender,
            smartContract,
            propertyId,
            subId,
            subIdNotNull
        );
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);
        require(
            handler != _actionsHandlers[smartContract][action][additionalId],
            "setPropertyActionHandler: Action handler is the same"
        );

        _setActionHandler(smartContract, action, additionalId, handler);
    }

    /**
     * @notice Set actions handler for the sender
     * @param actionsList List of the actions
     * @param handler Actions handler
     * @param additionalId Sub identifier
     */
    function selfSetMultipleActionsHandler(
        bytes32[] calldata actionsList,
        bytes32 additionalId,
        address handler
    ) external override verifySetActionHandlerInput(msg.sender, handler) {
        uint actionsLength = actionsList.length;
        for (uint i = 0; i < actionsLength; i++) {
            bytes32 action = actionsList[i];

            if (_actionsHandlers[msg.sender][action][additionalId] != handler) {
                _storeActionHandlerAndPossibilityToUpdate(msg.sender, action, additionalId, handler);
            }
        }
    }

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
    )
        external
        override
        verifySetActionHandlerInput(msg.sender, handler)
        verifyPropertyActionHandlerInput(propertyId, subId, subIdNotNull)
    {
        require(
            msg.sender == _complianceOracleAddress,
            "selfSetMultiplePropertyActionsPermission: Not from compliance oracle"
        );
        uint actionsLength = actionsList.length;
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);

        for (uint i = 0; i < actionsLength; i++) {
            bytes32 action = actionsList[i];

            if (_actionsHandlers[msg.sender][action][additionalId] != handler) {
                _storeActionHandlerAndPossibilityToUpdate(msg.sender, action, additionalId, handler);

                _storePropertyActionHandlerPossibilityToUpdate(msg.sender, action, additionalId);
            }
        }
    }

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
    )
        external
        view
        override
        verifyGetActionHandler(smartContract)
        verifyPropertyActionHandlerInput(propertyId, subId, subIdNotNull)
        returns (address, bool)
    {
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);
        return getActionHandler(smartContract, action, additionalId);
    }

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
    )
        external
        view
        override
        verifyGetActionHandler(smartContract)
        verifyPropertyActionHandlerInput(propertyId, subId, subIdNotNull)
        returns (address, bool)
    {
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);
        return getSafeActionHandler(smartContract, action, additionalId);
    }

    /**
     * @return Action handler and existance flag
     * @param smartContract Smart contract address
     * @param action Action to be handled
     * @param additionalId Addition identifier (may be empty)
     */
    function getActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) public view override verifyGetActionHandler(smartContract) returns (address, bool) {
        address handler = _actionsHandlers[smartContract][action][additionalId];

        return handler == address(0x00) ? (_basePermissionActionAddress, false) : (handler, true);
    }

    /**
     * @return Safe action handler and existance flag
     * @dev returns base permission action handler if there is no action handler
     * @param smartContract Smart contract address
     * @param action Action to be verified
     * @param additionalId Addition identifier (may be empty)
     */
    function getSafeActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) public view override verifyGetActionHandler(smartContract) returns (address, bool) {
        address handler = _actionsHandlers[smartContract][action][additionalId];

        return handler == address(0x00) ? (_safeBasePermissionActionAddress, false) : (handler, true);
    }

    /**
     * @notice Stores handlers in storage and emits event
     */
    function _storeActionHandlerAndPossibilityToUpdate(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        address handler
    ) internal {
        _setActionHandler(smartContract, action, additionalId, handler);

        if (additionalId != bytes32(0x00)) {
            bytes32 action_ = PermissionsLib.rulesEnginePermissionId(
                IRulesEngine(address(0x00)).setActionPermission.selector,
                action
            );
            _setActionHandler(smartContract, action_, additionalId, _safeBasePermissionActionAddress);

            action_ = PermissionsLib.rulesEnginePermissionId(
                IRulesEngine(address(0x00)).setActionHandler.selector,
                action
            );
            _setActionHandler(smartContract, action_, additionalId, _safeBasePermissionActionAddress);
        }
    }

    /**
     * @notice Stores property handlers possibility to update in storage and emits event
     */
    function _storePropertyActionHandlerPossibilityToUpdate(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) internal {
        if (additionalId != bytes32(0x00)) {
            bytes32 action_ = PermissionsLib.rulesEnginePermissionId(
                IRulesEngine(address(0x00)).setPropertyActionPermission.selector,
                action
            );
            _setActionHandler(smartContract, action_, additionalId, _safeBasePermissionActionAddress);

            action_ = PermissionsLib.rulesEnginePermissionId(
                IRulesEngine(address(0x00)).setPropertyActionHandler.selector,
                action
            );
            _setActionHandler(smartContract, action_, additionalId, _safeBasePermissionActionAddress);
        }
    }

    /**
     * @notice Set address of the action handler and emit event
     */
    function _setActionHandler(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        address handler
    ) internal {
        _actionsHandlers[smartContract][action][additionalId] = handler;

        emit ActionHandlerChanged(smartContract, action, additionalId, handler);
    }
}
