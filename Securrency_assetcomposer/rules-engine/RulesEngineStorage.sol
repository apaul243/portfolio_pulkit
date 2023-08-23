// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./RulesEngineStructs.sol";

/**
 * @title Rules Engine storage
 */
contract RulesEngineStorage {
    // Component id
    bytes32 internal constant COMPONENT_ID = keccak256("RulesEngine");

    // initialization owner address
    address internal _initializationOwnerAddress;
    // updates repository address
    address internal _updatesRepositoryAddress;
    // compliance oracle address
    address internal _complianceOracleAddress;
    // base permission action address
    address internal _basePermissionActionAddress;
    // safe base permission action address
    address internal _safeBasePermissionActionAddress;

    // Declare storage for the actions handlers
    // Smart contract request came from -> action -> additional id -> action handler address
    mapping(address => mapping(bytes32 => mapping(bytes32 => address))) internal _actionsHandlers;
    // Smart contract to verify -> action -> additional id -> permission structure
    mapping(address => mapping(bytes32 => mapping(bytes32 => Permission))) internal _actionsPermissions;

    // addresses of the methods implementations
    mapping(bytes4 => address) internal _methodsImplementations;
}
