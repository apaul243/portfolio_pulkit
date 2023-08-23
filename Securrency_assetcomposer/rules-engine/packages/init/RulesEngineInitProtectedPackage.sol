// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "../../interfaces/IRulesEngine.sol";
import "../../RulesEngineStorage.sol";
import "../../../../../registry-layer/compliance-oracle/const/ComplianceOracleDefaults.sol";
import "../../../../../common/libraries/CommonComplianceOracle.sol";
import "../../../../../common/libraries/CommonBasePermissionAction.sol";
import "../../../../../common/permissions/PermissionsLib.sol";

/**
 * @title Extension for the Rules Engine methods which allows verifying permissions
 */
contract RulesEngineInitProtectedPackage is RulesEngineStorage, ComplianceOracleDefaults {
    // Define libraries
    using CommonBasePermissionAction for *;
    using CommonComplianceOracle for *;
    using PermissionsLib for *;

    /**
     * @notice Verify permission for rules engine
     * @param method Requested method
     * @param sender Transaction sender address
     */
    function _verifyPermission(bytes4 method, address sender) internal {
        bytes32 sig = method.permissionId();
        address handler = _actionsHandlers[address(this)][sig][bytes32(0x00)];

        handler = handler == address(0x00) ? _basePermissionActionAddress : handler;

        handler._tryVerify(sender, address(0x00), address(this), address(0x00), sig, bytes32(0x00), new bytes(0));
    }

    /**
     * @notice Verify permission
     * @param sig Requested method protected signature
     * @param sender Transaction sender address
     * @param smartContract Smart contract address
     * @param additionalId Additional identifier
     */
    function _verifyPermission(
        bytes32 sig,
        address sender,
        address smartContract,
        bytes32 additionalId
    ) internal {
        address handler = _actionsHandlers[smartContract][sig][additionalId];

        handler = handler == address(0x00)
            ? (additionalId != bytes32(0x00) ? _safeBasePermissionActionAddress : _basePermissionActionAddress)
            : handler;

        handler._tryVerify(sender, address(0x00), address(this), smartContract, sig, additionalId, new bytes(0));
    }

    /**
     * @notice Verify permission
     * @param sig Requested method protected signature
     * @param sender Transaction sender address
     * @param smartContract Smart contract address
     * @param propertyId Property identifier
     * @param subId Additional identifier
     */
    function _verifyPropertyPermission(
        bytes32 sig,
        address sender,
        address smartContract,
        bytes32 propertyId,
        bytes32 subId,
        bool subIdNotNull
    ) internal {
        bytes32 additionalId;
        address actionHandler;

        if (propertyId != DEFAULT_COMPONENT_MANAGER_ROLE_ID) {
            bool handlerExists = false;
            bool permissionExists = false;

            if (subIdNotNull) {
                additionalId = PermissionsLib.propertyAdditionalId(propertyId, subId);

                // First try get action handler with sub id
                actionHandler = _actionsHandlers[smartContract][sig][additionalId];
                handlerExists = actionHandler != address(0x00);

                // Try get permission with sub id
                Permission memory permission = _actionsPermissions[smartContract][sig][additionalId];
                permissionExists = _permissionCollisionCheck(permission);

                // If permission doesn't exist for sub id and it's not a default - use property id
                (PropertyMetadata memory metadata, , ) = _complianceOracleAddress._tryGetPropertyById(propertyId);
                if (!permissionExists && !metadata.isDefault) {
                    additionalId = propertyId;
                }
            } else {
                additionalId = propertyId;
            }
            // If handler doesn't exist for sub id - try get it with property id
            if (!handlerExists) {
                actionHandler = _actionsHandlers[smartContract][sig][propertyId];
            }
        } else {
            require(subIdNotNull, "_verifyPropertyPermission: Null sub id for DMR");
            // For default component manager use sub id without property id
            additionalId = subId;
            actionHandler = _actionsHandlers[smartContract][sig][additionalId];
        }

        actionHandler = actionHandler == address(0x00) ? _safeBasePermissionActionAddress : actionHandler;

        actionHandler._tryVerify(sender, address(0x00), address(this), smartContract, sig, additionalId, new bytes(0));
    }

    /**
     * @notice Collision in stored permission property and expected value check
     * @param permission Permission to be verified
     * @return bool flag - true if permission exists
     */
    function _permissionCollisionCheck(Permission memory permission) internal pure returns (bool) {
        bool exists = permission.propertyId != bytes32(0x00) && permission.expectedValue.length > 0;
        bool notExists = permission.propertyId == bytes32(0x00) && permission.expectedValue.length == 0;

        require(notExists || exists, "_permissionCollisionCheck: Collision in stored permission");
        return exists;
    }
}
