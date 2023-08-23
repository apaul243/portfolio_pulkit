// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Rules engine init package interface
 */
interface IRulesEngineInit {
    /**
     * @notice Register components owner
     */
    function registerComponentsOwner() external;

    /**
     * @notice Initialize smart contract
     * @param complianceOracle Compliance oracle address
     * @param basePermissionAction Base permission action address
     * @param safeBasePermissionAction Safe base permission action address
     * @param updatesRepository Updates repository address
     */
    function initialize(
        address complianceOracle,
        address basePermissionAction,
        address safeBasePermissionAction,
        address updatesRepository
    ) external;
}
