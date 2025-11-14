// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @notice
/// - Owner (set at deployment) can grant/revoke roles.
/// - Emits events so indexers/subgraphs can track role changes.
/// - ROLES: Buyer / Seller / Admin / Banned
contract Roles {
    // Owner of the role manager
    address public owner;

    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN");
    bytes32 public constant BUYER_ROLE  = keccak256("BUYER");
    bytes32 public constant SELLER_ROLE = keccak256("SELLER");
    bytes32 public constant BANNED_ROLE = keccak256("BANNED");


    // role => account => hasRole
    mapping(bytes32 => mapping(address => bool)) private _roles;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed by);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed by);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        _roles[ADMIN_ROLE][owner] = true;
        emit RoleGranted(ADMIN_ROLE, msg.sender, msg.sender);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "owner only");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "admin only");
        _;
    }

    /// @notice Returns true if account has role.
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    /// @notice Grant role to account.
    function grantRole(bytes32 role, address account) public onlyAdmin {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /// @notice Revoke role from account.
    function revokeRole(bytes32 role, address account) public onlyAdmin {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /// @notice Transfer ownership of the Roles manager.
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnerTransferred(owner, newOwner);
        grantRole(ADMIN_ROLE, newOwner);
        revokeRole(ADMIN_ROLE, owner); 
        owner = newOwner;
    }
}