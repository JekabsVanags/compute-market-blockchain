// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Reputation} from "../contracts/Reputation.sol";
import {Roles} from "../contracts/Roles.sol";
import {Test} from "forge-std/Test.sol";

//Fake contract to test that contracts can be set as authorized
contract Awarder {
    function doAward(address reputationAddr, address seller, address requestAddr) external {
        Reputation(reputationAddr).award(seller, requestAddr, 1);
    }
}

contract ReputationTest is Test {
    Reputation public reputationContract;
    Roles public rolesContract;

    // Test addresses
    address public OWNER = makeAddr("owner");
    address public BUYER_1 = makeAddr("buyer1");
    address public BUYER_2 = makeAddr("buyer2");
    address public SELLER = makeAddr("seller");
    address public RANDOM_USER = makeAddr("randomUser");
    address public JUSTIFICATION_CONTRACT = makeAddr("contract");

    // Deploy Roles and Reputation. Grant buyer roles via Roles contract (roles are managed by Roles.sol).
    function setUp() public {
        vm.startPrank(OWNER);
        // Deploy Roles as OWNER so OWNER becomes the roles admin
        rolesContract = new Roles();

        // Deploy Reputation and point it at the Roles contract
        reputationContract = new Reputation(address(rolesContract));

        // OWNER (roles admin) grants BUYER_ROLE to two buyer accounts
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), BUYER_1);
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), BUYER_2);

        vm.stopPrank();
    }

    function test_InitialValue() public view {
        // Reputation contract owner was set to the deployer (OWNER)
        assertEq(reputationContract.owner(), OWNER, "Initial owner must be OWNER");

        // Newly referenced account should have zero reputation
        assertEq(reputationContract.reputationOf(SELLER), 0, "Initial reputation must be 0");
    }

    function test_Buyer_CanAward() public {
        vm.prank(OWNER);
        reputationContract.authorizeBuyerOrContract(BUYER_1, true);

        // BUYER_1 awards SELLER
        vm.prank(BUYER_1);
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1);

        assertEq(reputationContract.reputationOf(SELLER), 1, "Reputation should be +1 after award");
    }

    function test_Buyer_CanPenalize() public {
        vm.prank(OWNER);
        reputationContract.authorizeBuyerOrContract(BUYER_2, true);

        // BUYER_2 penalizes SELLER
        vm.prank(BUYER_2);
        reputationContract.penalize(SELLER, JUSTIFICATION_CONTRACT, 1);

        assertEq(reputationContract.reputationOf(SELLER), -1, "Reputation should be -1 after penalize");
    }

    // If OWNER also needs to call award, OWNER must be granted BUYER_ROLE first.
    function test_OwnerMustBeGrantedBuyerToAward() public {
        // By default OWNER is not a buyer
        vm.startPrank(OWNER);
        assertFalse(rolesContract.hasRole(rolesContract.BUYER_ROLE(), OWNER), "OWNER should not be a buyer by default");

        // Grant BUYER_ROLE to OWNER and then award
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), OWNER);
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1);

        assertEq(reputationContract.reputationOf(SELLER), 1, "OWNER granted buyer role should be able to award");
        vm.stopPrank();
    }

    // Random user without buyer role cannot change reputation
    function test_RandomUser_CannotChangeReputation() public {
        vm.prank(RANDOM_USER);
        vm.expectRevert("authorized buyers only");
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1);

        // Reputation remains unchanged
        assertEq(reputationContract.reputationOf(SELLER), 0, "Reputation must remain 0 after failed action");
    }

    function test_Admin_CanSetScore() public {
        // OWNER is admin on Roles by default, so OWNER can call Reputation.setScore
        vm.prank(OWNER);
        reputationContract.setScore(SELLER, 50);

        assertEq(reputationContract.reputationOf(SELLER), 50, "Admin should be able to set score directly");
    }

    function test_Admin_SetScoreReplacesCurrentScore() public {
        vm.prank(OWNER);
        reputationContract.authorizeBuyerOrContract(BUYER_1, true);
        // Increase by buyer first
        vm.prank(BUYER_1);
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1); // reputation = 1

        // OWNER (Roles admin) sets score to -10
        vm.prank(OWNER);
        reputationContract.setScore(SELLER, -10);

        assertEq(reputationContract.reputationOf(SELLER), -10, "setScore must overwrite current score");
    }

    function test_NonAdmin_CannotSetScore() public {
        // BUYER_1 is not an admin; call should revert with the current revert message from onlyAdmin
        vm.prank(BUYER_1);
        vm.expectRevert("admin only");
        reputationContract.setScore(SELLER, 100);
    }

    function test_ContractCanBeAuthorizedAndCallAward() public {
        // deploy helper contract that will call Reputation.award
        Awarder awarder = new Awarder();

        // OWNER authorizes the helper contract as allowed to award
        vm.prank(OWNER);
        reputationContract.authorizeBuyerOrContract(address(awarder), true);

        // call through the helper contract (msg.sender inside award will be the helper contract)
        awarder.doAward(address(reputationContract), SELLER, JUSTIFICATION_CONTRACT);

        // reputation should be incremented
        assertEq(reputationContract.reputationOf(SELLER), 1, "Authorized contract should be able to award");
    }

     function test_AfterOneUseAuthorizationNeedsToBeReissued() public {
        vm.prank(OWNER);
        reputationContract.authorizeBuyerOrContract(BUYER_1, true);

        // BUYER_1 awards SELLER
        vm.prank(BUYER_1);
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1);

        assertEq(reputationContract.reputationOf(SELLER), 1, "Reputation should be +1 after award");

        vm.prank(BUYER_1);
        vm.expectRevert("authorized buyers only");
        reputationContract.award(SELLER, JUSTIFICATION_CONTRACT, 1);
    }
}