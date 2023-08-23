// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./IRulesEngineActionsHandlers.sol";
import "./IRulesEngineActionsPermissions.sol";
import "./IRulesEngineEvents.sol";

/**
 * @title Interface of the Rules Engine
 */
interface IRulesEngine is IRulesEngineActionsHandlers, IRulesEngineActionsPermissions, IRulesEngineEvents {

}
