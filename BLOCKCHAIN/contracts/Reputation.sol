// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./Roles.sol";

contract Reputation {
    Roles public roles;

    address public owner;
    mapping(address => int256) private reputation;

    //Only allowed contracts can change reputation
    mapping(address => bool) public authorizedRequest;
    

    event ReputationChanged(address indexed who, address indexed by, address justification, int256 delta, int256 newScore);
    event ReputationSet(address indexed who, address indexed by, int256 oldScore, int256 newScore);

    constructor(address rolesAddress) {
        owner = msg.sender;
        roles = Roles(rolesAddress);
    }

    //Role checks
    modifier onlyAuthOrAdmin() {
        require(authorizedRequest[msg.sender] || roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "authorized buyers only");
        _;
    }

    modifier onlyAdmin() {
        require(roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "admin only");
        _;
    }


    function authorizeBuyerOrContract(address req, bool allowed) external onlyAdmin {
      authorizedRequest[req] = allowed;
    }

    // Buyer can increase reputation
    function award(address who, address justification, int256 delta) external onlyAuthOrAdmin() {
        reputation[who] += delta;
        authorizedRequest[msg.sender] = false;
        emit ReputationChanged(who, msg.sender, justification, delta, reputation[who]);
    }

    // Buyer can reduce reputation
    function penalize(address who, address justification, int256 delta) external onlyAuthOrAdmin {
        reputation[who] -= delta;
        authorizedRequest[msg.sender] = false;
        emit ReputationChanged(who, msg.sender, justification, -delta, reputation[who]);
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