// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./RulesEngineInitProtectedPackage.sol";
import "../../interfaces/IRulesEngineEvents.sol";
import "../../interfaces/IRulesEngineActionsPermissions.sol";
import "../../../../../common/libraries/AddressUtils.sol";
import "../../../../../common/libraries/CommonComplianceOracle.sol";
import "../../../../../common/libraries/CommonPolicyParser.sol";

/**
 * @title Init Rules Engine permissions
 */
contract RulesEngineInitActionsPermissions is
    IRulesEngineEvents,
    IRulesEngineActionsPermissions,
    RulesEngineInitProtectedPackage
{
    // Define libraries
    using AddressUtils for *;
    using CommonComplianceOracle for *;
    using CommonPolicyParser for *;
    using PermissionsLib for *;

    /**
     * @notice Verifies set action permission input
     */
    modifier verifySetActionPermissionInput(
        address smartContract,
        bytes32 propertyId,
        uint expectedValueLength
    ) {
        require(smartContract.isContract(), "verifySetActionPermissionInput: Smart contract address belongs to EOA");

        require(
            _complianceOracleAddress._tryIsExistingProperty(propertyId),
            "verifySetActionPermissionInput: Unexisting property"
        );
        require(expectedValueLength > 0, "verifySetActionPermissionInput: No expected value");
        _;
    }

    /**
     * @notice Verifies set property action permission input
     */
    modifier verifyPropertyActionPermissionInput(
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) {
        if (!subIdNotNull) {
            require(subId == bytes32(0x00), "verifyPropertyActionPermissionInput: sub id not null");
        }
        require(
            _complianceOracleAddress._tryIsExistingProperty(propertyId),
            "verifyPropertyActionPermissionInput: Unexisting property"
        );
        _;
    }

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
    ) external override {
        _verifyPermission(
            PermissionsLib.rulesEnginePermissionId(msg.sig, action),
            msg.sender,
            smartContract,
            additionalId
        );

        _setActionPermission(smartContract, action, additionalId, permission);
    }

    /**
     * @notice Set address of the action handler
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
    ) external override verifyPropertyActionPermissionInput(propertyId, subId, subIdNotNull) {
        _verifyPropertyPermission(
            PermissionsLib.rulesEnginePermissionId(msg.sig, action),
            msg.sender,
            smartContract,
            propertyId,
            subId,
            subIdNotNull
        );

        _setActionPermission(
            smartContract,
            action,
            PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull),
            permission
        );
    }

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
    )
        external
        view
        override
        verifyPropertyActionPermissionInput(propertyId, subId, subIdNotNull)
        returns (Permission memory permission, bool exists)
    {
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);
        return safeGetActionPermission(smartContract, action, additionalId);
    }

    /**
     * @notice Calculates permission verification price
     * @dev Contains some 'magic' numbers for oraclize execution
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
    ) external view override returns (uint) {
        require(smartContract.isContract(), "getPermissionVerificationPrice: Smart contract address belongs to EOA");

        uint numberOfTheExternalCalls = getPermissionExternalCallsTotal(smartContract, action, additionalId);

        if (numberOfTheExternalCalls == 0) {
            return 0;
        }

        require(gasPrice >= 3000000000, "getPermissionVerificationPrice: Min gas price is 3 Gwei");

        uint fee = 0;
        if (_getCodeSize(0xB7A07BcF2Ba2f2703b24C0691b5278999C59AC7e) > 0) {
            // kovan testnet
            fee = numberOfTheExternalCalls * 41619844341780;
        } else {
            // mainnet, ropsten testnet or other network
            fee = numberOfTheExternalCalls * 47200000000000;
        }

        return (numberOfTheExternalCalls * 200000 * gasPrice + fee);
    }

    /**
     * @notice Set permission for multiple actions for the sender
     * @param actionsList List of the actions
     * @param additionalId Sub identifier
     * @param permission Permission
     */
    function selfSetMultipleActionsPermission(
        bytes32[] memory actionsList,
        bytes32 additionalId,
        Permission memory permission,
        bool isPropertyTarget
    )
        public
        override
        verifySetActionPermissionInput(msg.sender, permission.propertyId, permission.expectedValue.length)
    {
        uint actionsLength = actionsList.length;

        for (uint i = 0; i < actionsLength; i++) {
            bytes32 action = actionsList[i];
            Permission storage currentPermission = _actionsPermissions[msg.sender][action][additionalId];

            if (keccak256(abi.encode(currentPermission)) != keccak256(abi.encode(permission))) {
                _storeActionPermissionAndPossibilityToUpdate(msg.sender, action, additionalId, permission);

                if (isPropertyTarget) {
                    _storePropertyActionPossibilityToUpdate(msg.sender, action, additionalId, permission);
                }
            }
        }
    }

    /**
     * @notice Set permission for multiple property actions for the sender
     * @param actionsList List of the actions
     * @param subId Sub identifier
     * @param permission Permission
     */
    function selfSetMultiplePropertyActionsPermission(
        bytes32[] memory actionsList,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull,
        Permission memory permission
    )
        public
        override
        verifySetActionPermissionInput(msg.sender, permission.propertyId, permission.expectedValue.length)
        verifyPropertyActionPermissionInput(propertyId, subId, subIdNotNull)
    {
        require(
            msg.sender == _complianceOracleAddress,
            "selfSetMultiplePropertyActionsPermission: Not from compliance oracle"
        );
        uint actionsLength = actionsList.length;
        bytes32 additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId, subIdNotNull);

        for (uint i = 0; i < actionsLength; i++) {
            bytes32 action = actionsList[i];
            Permission storage currentPermission = _actionsPermissions[msg.sender][action][additionalId];

            if (keccak256(abi.encode(currentPermission)) != keccak256(abi.encode(permission))) {
                _storeActionPermissionAndPossibilityToUpdate(msg.sender, action, additionalId, permission);

                _storePropertyActionPossibilityToUpdate(msg.sender, action, additionalId, permission);
            }
        }
    }

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
    ) public view override returns (Permission memory permission, bool exists) {
        permission = getActionPermission(smartContract, action, additionalId);

        exists = _permissionCollisionCheck(permission);

        return (permission, exists);
    }

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
    ) public view override returns (uint) {
        Permission memory permission = getActionPermission(smartContract, action, additionalId);
        bool exists = _permissionCollisionCheck(permission);
        if (!exists) {
            return 0;
        }

        return _complianceOracleAddress._tryGetPropertyExternalCallsTotal(permission.propertyId);
    }

    /**
     * @return action permission
     * @param smartContract Smart contract address
     * @param action Action to be handled
     */
    function getActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId
    ) public view override returns (Permission memory) {
        require(smartContract.isContract(), "getActionPermission: Smart contract address belongs to EOA");

        return _actionsPermissions[smartContract][action][additionalId];
    }

    /**
     * @notice Set address of the action handler
     * @param smartContract Smart contract address
     * @param action Action
     * @param additionalId Addition identifier (may be empty)
     * @param permission Permission to set
     */
    function _setActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        Permission memory permission
    ) internal verifySetActionPermissionInput(smartContract, permission.propertyId, permission.expectedValue.length) {
        Permission storage currentPermission = _actionsPermissions[smartContract][action][additionalId];
        require(
            keccak256(abi.encode(currentPermission)) != keccak256(abi.encode(permission)),
            "_setActionPermission: The same permission already set for this operation"
        );

        _storeActionPermission(smartContract, action, additionalId, permission);
    }

    /**
     * @notice Stores permissions in storage and emits event
     */
    function _storeActionPermissionAndPossibilityToUpdate(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        Permission memory permission
    ) internal {
        _storeActionPermission(smartContract, action, additionalId, permission);

        // Make it possible to update permission and handler
        bytes32 action_ = PermissionsLib.rulesEnginePermissionId(
            IRulesEngine(address(0x00)).setActionPermission.selector,
            action
        );
        _storeActionPermission(smartContract, action_, additionalId, permission);

        action_ = PermissionsLib.rulesEnginePermissionId(IRulesEngine(address(0x00)).setActionHandler.selector, action);
        _storeActionPermission(smartContract, action_, additionalId, permission);
    }

    /**
     * @notice Stores property possibility update permission in storage and emits event
     */
    function _storePropertyActionPossibilityToUpdate(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        Permission memory permission
    ) internal {
        bytes32 action_ = PermissionsLib.rulesEnginePermissionId(
            IRulesEngine(address(0x00)).setPropertyActionPermission.selector,
            action
        );
        _storeActionPermission(smartContract, action_, additionalId, permission);

        action_ = PermissionsLib.rulesEnginePermissionId(
            IRulesEngine(address(0x00)).setPropertyActionHandler.selector,
            action
        );
        _storeActionPermission(smartContract, action_, additionalId, permission);
    }

    /**
     * @notice Stores permission in storage and emits event
     */
    function _storeActionPermission(
        address smartContract,
        bytes32 action,
        bytes32 additionalId,
        Permission memory permission
    ) internal {
        _actionsPermissions[smartContract][action][additionalId] = permission;

        emit ActionPermissionPropertyChanged(smartContract, action, additionalId, permission.propertyId);
    }

    /**
     * @notice Get code size by specified address
     * @param addr Address to be checked code size
     */
    function _getCodeSize(address addr) internal view returns (uint size) {
        assembly {
            size := extcodesize(addr)
        }
    }
}
