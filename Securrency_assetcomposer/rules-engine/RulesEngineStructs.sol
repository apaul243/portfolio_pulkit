// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

// Permission structure - property id and its extpected value
struct Permission {
    bytes32 propertyId;
    bytes[] expectedValue;
}
