// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Request} from "../contracts/Request.sol";
import {Roles} from "../contracts/Roles.sol";
import {Reputation} from "../contracts/Reputation.sol";
import {Test} from "forge-std/Test.sol";

contract RequestTest is Test {
    Roles public rolesContract;
    Reputation public reputationContract;
    Request public requestContract;

    // Test addresses
    address public OWNER = makeAddr("owner");
    address public BUYER_1 = makeAddr("buyer1");
    address public SELLER_1 = makeAddr("seller1");
    address public SELLER_2 = makeAddr("seller2");
    address public RANDOM_USER = makeAddr("randomUser");

    // Test data
    string[] public commands;
    bytes32 public commandHash;

    function setUp() public {
        vm.startPrank(OWNER);

        // Deploy Roles as OWNER (becomes roles admin)
        rolesContract = new Roles();

        // Deploy Reputation with Roles address (kept for compatibility but not used by Request tests)
        reputationContract = new Reputation(address(rolesContract));

        // Grant roles
        rolesContract.grantRole(rolesContract.BUYER_ROLE(), BUYER_1);
        rolesContract.grantRole(rolesContract.SELLER_ROLE(), SELLER_1);
        rolesContract.grantRole(rolesContract.SELLER_ROLE(), SELLER_2);

        vm.stopPrank();

        // Prepare test commands
        commands.push("command1");
        commands.push("command2");
        commands.push("command3");
        commandHash = keccak256("test_result");
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_Constructor_BuyerCanCreateRequest() public {
        vm.prank(BUYER_1);
        Request newRequest = new Request(commandHash, address(rolesContract), address(reputationContract));

        assertEq(newRequest.owner(), BUYER_1, "Owner should be BUYER_1");
        assertEq(uint(newRequest.currentState()), uint(Request.State.Created), "Initial state should be Created");
    }

    function test_Constructor_NonBuyerCannotCreateRequest() public {
        vm.startPrank(RANDOM_USER);
        vm.expectRevert("buyer only");
        new Request(commandHash, address(rolesContract), address(reputationContract));
        vm.stopPrank();
    }

    // ============ EXECUTOR APPOINTMENT TESTS ============

    function test_Admin_CanAppointExecutor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        vm.expectEmit(true, false, false, false);
        emit Request.ExecutorAssigned(SELLER_1);
        requestContract.appointExecutor(SELLER_1);
        vm.stopPrank();

        assertEq(requestContract.executor(), SELLER_1, "Executor should be SELLER_1");
        assertEq(uint(requestContract.currentState()), uint(Request.State.ExecutorAssigned), "State should be ExecutorAssigned");
    }

    function test_Admin_CannotAppointNonSeller() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        vm.expectRevert("candidate not a seller");
        requestContract.appointExecutor(RANDOM_USER);
        vm.stopPrank();
    }

    function test_NonAdmin_CannotAppointExecutor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("admin only");
        requestContract.appointExecutor(SELLER_1);
        vm.stopPrank();
    }

    function test_Admin_CannotAppointExecutorInWrongState() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        
        // Try to appoint executor again (already in ExecutorAssigned state)
        vm.expectRevert("Invalid state for this operation");
        requestContract.appointExecutor(SELLER_2);
        vm.stopPrank();
    }

    // ============ AUDITOR APPOINTMENT TESTS ============

    function test_Admin_CanAppointAuditor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);

        vm.expectEmit(true, false, false, false);
        emit Request.AuditorAssigned(SELLER_2);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        assertEq(requestContract.auditor(), SELLER_2, "Auditor should be SELLER_2");
        assertEq(uint(requestContract.currentState()), uint(Request.State.ExecutorAssigned), "State should remain ExecutorAssigned");
    }

    function test_Admin_CannotAppointExecutorAsAuditor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);

        vm.expectRevert("auditor cannot be executor");
        requestContract.appointAuditor(SELLER_1);
        vm.stopPrank();
    }

    function test_Admin_CannotAppointAuditorBeforeExecutor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        vm.expectRevert("Invalid state for this operation");
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();
    }

    function test_Admin_CannotAppointNonSellerAsAuditor() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);

        vm.expectRevert("candidate not a seller");
        requestContract.appointAuditor(RANDOM_USER);
        vm.stopPrank();
    }

    // ============ RESULT ASSIGNMENT TESTS ============

    function test_Executor_CanAssignResult() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.prank(OWNER);
        requestContract.appointExecutor(SELLER_1);

        bytes32 testHash = keccak256("test_result");

        vm.startPrank(SELLER_1);
        vm.expectEmit(true, true, false, true);
        emit Request.ResultAssigned(testHash, SELLER_1);
        requestContract.assignResult(testHash);
        vm.stopPrank();

        assertEq(requestContract.resultHash(), testHash, "Result hash should be stored");
        assertEq(uint(requestContract.currentState()), uint(Request.State.ResultSubmitted), "State should be ResultSubmitted");
    }

    function test_NonExecutor_CannotAssignResult() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.prank(OWNER);
        requestContract.appointExecutor(SELLER_1);

        bytes32 testHash = keccak256("test_result");

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("executor only");
        requestContract.assignResult(testHash);
        vm.stopPrank();
    }

    // ============ AUDIT RESULT TESTS ============

    function test_Auditor_CanApproveCorrectResult() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);

        // Auditor posts same hash -> should be accepted and mark Completed, no on-chain reputation changes are asserted
        vm.startPrank(SELLER_2);
        vm.expectEmit(true, true, false, true);
        emit Request.AuditorResultAssigned(testHash, SELLER_2);
        requestContract.assignAuditResult(testHash);
        vm.stopPrank();

        assertEq(requestContract.auditorResultHash(), testHash, "Auditor hash should be stored");
        assertEq(uint(requestContract.currentState()), uint(Request.State.Completed), "State should be Completed");
        assertFalse(requestContract.faultyResult(), "Should not be marked as faulty");
    }

    function test_Auditor_CanDetectFaultyResult() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 executorHash = keccak256("executor_result");
        bytes32 auditorHash = keccak256("auditor_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(executorHash);

        vm.startPrank(SELLER_2);
        vm.expectEmit(true, false, false, false);
        emit Request.FaultyCalculationDetected(SELLER_2, SELLER_1, executorHash, auditorHash);
        requestContract.assignAuditResult(auditorHash);
        vm.stopPrank();

        assertTrue(requestContract.faultyResult(), "Should be marked as faulty");
        assertEq(requestContract.executor(), address(0), "Executor should be cleared");
        assertEq(uint(requestContract.currentState()), uint(Request.State.Created), "State should reset to Created");
    }

    function test_NonAuditor_CannotAssignAuditResult() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("auditor only");
        requestContract.assignAuditResult(testHash);
        vm.stopPrank();
    }

    function test_Auditor_CannotAuditInWrongState() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.startPrank(SELLER_2);
        vm.expectRevert("Invalid state for this operation");
        requestContract.assignAuditResult(testHash);
        vm.stopPrank();
    }

    // ============ RETRY AFTER FAULT TESTS ============

    function test_Admin_CanReassignExecutorAfterFault() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 executorHash = keccak256("executor_result");
        bytes32 auditorHash = keccak256("auditor_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(executorHash);

        vm.prank(SELLER_2);
        requestContract.assignAuditResult(auditorHash);

        // Now state is back to Created, admin can reassign
        vm.prank(OWNER);
        requestContract.appointExecutor(SELLER_2);

        assertEq(requestContract.executor(), SELLER_2, "New executor should be assigned");
    }

    // ============ READ FUNCTION TESTS ============

    function test_GetInformation_ReturnsCorrectData() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);

        (
            Request.State state,
            address owner_,
            address executor_,
            address auditor_,
            bytes32 commandHash_,
            bytes32 resultHash_,
            bytes32 auditorResultHash_,
            bool faultyResult_
        ) = requestContract.getInformation();

        assertEq(uint(state), uint(Request.State.ResultSubmitted), "State should be ResultSubmitted");
        assertEq(owner_, BUYER_1, "Owner should be BUYER_1");
        assertEq(executor_, SELLER_1, "Executor should be SELLER_1");
        assertEq(auditor_, SELLER_2, "Auditor should be SELLER_2");
        assertEq(resultHash_, testHash, "Result hash should match");
        assertEq(auditorResultHash_, bytes32(0), "Auditor hash should be empty");
        assertFalse(faultyResult_, "Should not be faulty yet");
    }

    // ============ WORKFLOW INTEGRATION TESTS ============

    function test_CompleteWorkflow_HappyPath() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        // 1. Appoint executor
        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        assertEq(uint(requestContract.currentState()), uint(Request.State.ExecutorAssigned));

        // 2. Appoint auditor
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        // 3. Executor submits result
        bytes32 correctHash = keccak256("correct_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(correctHash);
        assertEq(uint(requestContract.currentState()), uint(Request.State.ResultSubmitted));

        // 4. Auditor approves (no on-chain reputation assertions)
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(correctHash);

        assertEq(uint(requestContract.currentState()), uint(Request.State.Completed));
    }

    function test_CompleteWorkflow_WithFaultAndRetry() public {
        vm.prank(BUYER_1);
        requestContract = new Request(commandHash, address(rolesContract), address(reputationContract));

        vm.startPrank(OWNER);
        requestContract.appointExecutor(SELLER_1);
        requestContract.appointAuditor(SELLER_2);
        vm.stopPrank();

        // Executor submits wrong result
        bytes32 wrongHash = keccak256("wrong_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(wrongHash);

        // Auditor detects fault
        bytes32 correctHash = keccak256("correct_result");
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(correctHash);

        assertEq(uint(requestContract.currentState()), uint(Request.State.Created));
        assertTrue(requestContract.faultyResult());

        // Reassign to new executor
        vm.prank(OWNER);
        requestContract.appointExecutor(SELLER_2);

        // New executor submits correct result
        vm.prank(SELLER_2);
        requestContract.assignResult(correctHash);

        assertEq(uint(requestContract.currentState()), uint(Request.State.ResultSubmitted));
    }
}