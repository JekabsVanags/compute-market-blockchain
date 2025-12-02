// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Roles} from "../contracts/Roles.sol";
import {Test} from "forge-std/Test.sol";

contract RolesTest is Test {
    Roles public rolesContract;

    // Test addresses
    address public OWNER = makeAddr("owner");
    address public BUYER_1 = makeAddr("buyer1");
    address public BUYER_2 = makeAddr("buyer2");
    address public RANDOM_USER = makeAddr("randomUser");

    // Deploy Roles and Reputation. Grant buyer roles via Roles contract (roles are managed by Roles.sol).
    function setUp() public {
        vm.startPrank(OWNER);
        // Deploy Roles as OWNER so OWNER becomes the roles admin
        rolesContract = new Roles();

        // OWNER (roles admin) grants BUYER_ROLE to two buyer accounts
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), BUYER_1);
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), BUYER_2);

        vm.stopPrank();
    }


    // Owner (roles admin) can transfer Roles ownership
    function test_RolesAdmin_CanTransferOwnership() public {
        address newAdmin = makeAddr("newAdmin");

        vm.prank(OWNER);
        rolesContract.transferOwnership(newAdmin);

        assertEq(rolesContract.owner(), newAdmin, "Roles owner should be updated to newAdmin");
        // newAdmin should also have ADMIN_ROLE after transferOwnership (per contract logic)
        assertTrue(rolesContract.hasRole(rolesContract.ADMIN_ROLE(), newAdmin), "newAdmin must have ADMIN_ROLE");
    }

    // Non-admin cannot transfer Roles ownership
    function test_NonAdmin_CannotTransferOwnership() public {
        vm.startPrank(RANDOM_USER);
        vm.expectRevert("owner only");
        rolesContract.transferOwnership(makeAddr("someone"));
        vm.stopPrank();
    }

    // Buyer role management via Roles contract

    function test_Admin_CanGrantAndRevokeBuyer() public {
        // BUYER_1 was granted in setUp
        assertTrue(rolesContract.hasRole(rolesContract.BUYER_ROLE(), BUYER_1), "BUYER_1 must be granted BUYER_ROLE");

        // OWNER (roles admin) revokes BUYER_1
        vm.startPrank(OWNER);
        rolesContract.revokeRole(rolesContract.BUYER_ROLE(), BUYER_1);
        assertFalse(rolesContract.hasRole(rolesContract.BUYER_ROLE(), BUYER_1), "BUYER_1 should be revoked");
        vm.stopPrank();
    }

    function test_RandomUser_CannotGrantBuyer() public {
        vm.startPrank(RANDOM_USER);
        address fakeBuyer = makeAddr("fakeBuyer");
        bytes32 role = rolesContract.BUYER_ROLE();

        // Correct revert payload type
        vm.expectRevert("admin only");
        rolesContract.grantRole(role, fakeBuyer);

        vm.stopPrank();
    }
}