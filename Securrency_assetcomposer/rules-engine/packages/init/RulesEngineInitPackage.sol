// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./RulesEngineInitActionsPermissions.sol";
import "./RulesEngineInitActionsHandlers.sol";

/**
 * @title Init Rules Engine package
 */
contract RulesEngineInitPackage is
    RulesEngineInitActionsPermissions,
    RulesEngineInitActionsHandlers
{

}
