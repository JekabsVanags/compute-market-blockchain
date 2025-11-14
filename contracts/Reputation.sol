// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./Roles.sol";

contract Reputation {
    Roles public roles;

    address public owner;
    mapping(address => int256) private reputation;

    event ReputationChanged(address indexed who, address indexed by, int256 delta, int256 newScore);
    event ReputationSet(address indexed who, address indexed by, int256 oldScore, int256 newScore);

    constructor(address rolesAddress) {
        owner = msg.sender;
        roles = Roles(rolesAddress);
    }

    //Role checks
    modifier onlyBuyer() {
        require(roles.hasRole(roles.BUYER_ROLE(), msg.sender), "buyer only");
        _;
    }

    modifier onlyAdmin() {
        require(roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "buyer only");
        _;
    }



    // Buyer can increase reputation
    function award(address who) external onlyBuyer() {
        reputation[who] += 1;
        emit ReputationChanged(who, msg.sender, 1, reputation[who]);
    }

    // Buyer can reduce reputation
    function penalize(address who) external onlyBuyer {
        reputation[who] -= 1;
        emit ReputationChanged(who, msg.sender, -1, reputation[who]);
    }

    // Admin can set reputation
    function setScore(address who, int256 newScore) external onlyAdmin {
        int256 oldScore = reputation[who];
        reputation[who] = newScore;
        emit ReputationSet(who, msg.sender, oldScore, newScore);
    }

    // Can read repitation
    function reputationOf(address who) external view returns (int256) {
        return reputation[who];
    }
}