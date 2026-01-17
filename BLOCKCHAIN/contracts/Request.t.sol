// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Request} from "../contracts/Request.sol";
import {Roles} from "../contracts/Roles.sol";
import {Reputation} from "../contracts/Reputation.sol";
import {Test} from "forge-std/Test.sol";
import {AuditTaxRepository} from "../contracts/AuditTaxRepository.sol";

contract RequestTest is Test {
    Roles public rolesContract;
    Reputation public reputationContract;
    Request public requestContract;
    AuditTaxRepository public auditTaxRepository;

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

        //Fund
        vm.deal(BUYER_1, 100 ether);
        vm.deal(OWNER, 1000 ether);
    

        auditTaxRepository = (new AuditTaxRepository) {value: 1000} ();

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
        Request newRequest = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        assertEq(newRequest.owner(), BUYER_1, "Owner should be BUYER_1");
        assertEq(uint(newRequest.currentState()), uint(Request.State.Created), "Initial state should be Created");
    }

    function test_Constructor_NonBuyerCannotCreateRequest() public {
        vm.prank(RANDOM_USER);
        vm.expectRevert("buyer only");
        new Request (commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);
    }

    // ============ EXECUTOR APPOINTMENT TESTS ============

    function test_Admin_CanAppointExecutor() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        vm.expectEmit(true, false, false, false);
        emit Request.ExecutorAssigned(SELLER_1);
        requestContract.appointExecutor(payable(SELLER_1));
        vm.stopPrank();

        assertEq(requestContract.executor(), SELLER_1, "Executor should be SELLER_1");
        assertEq(uint(requestContract.currentState()), uint(Request.State.ExecutorAssigned), "State should be ExecutorAssigned");
    }

    function test_Admin_CannotAppointNonSeller() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        vm.expectRevert("candidate not a seller");
        requestContract.appointExecutor(payable(RANDOM_USER));
        vm.stopPrank();
    }

    function test_NonAdmin_CannotAppointExecutor() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("admin only");
        requestContract.appointExecutor(payable(SELLER_1));
        vm.stopPrank();
    }

    function test_Admin_CannotAppointExecutorInWrongState() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        
        // Try to appoint executor again (already in ExecutorAssigned state)
        vm.expectRevert("Invalid state for this operation");
        requestContract.appointExecutor(payable(SELLER_2));
        vm.stopPrank();
    }

    // ============ AUDITOR APPOINTMENT TESTS ============

    function test_Admin_CanAppointAuditor() public {
        // Deploy request as BUYER_1
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(
            commandHash, 
            address(rolesContract), 
            address(reputationContract), 
            payable(auditTaxRepository), 
            9
        );
        
        // Admin appoints executor
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        
        // Executor submits result
        bytes32 testHash = keccak256("test_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);
        
        vm.prank(OWNER);
        requestContract.requestAudit("reason");
        
        // Admin appoints auditor
        vm.prank(OWNER);
        vm.expectEmit(true, false, false, false);
        emit Request.AuditorAssigned(SELLER_2);
        requestContract.appointAuditor(payable(SELLER_2));
        
        // Assertions
        assertEq(requestContract.auditor(), SELLER_2, "Auditor should be SELLER_2");
        assertEq(
            uint(requestContract.currentState()), 
            uint(Request.State.AuditRequested), 
            "State should be AuditRequested"
        );
    }

    function test_Admin_CannotAppointExecutorAsAuditor() public {
        // Deploy request as BUYER_1
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(
            commandHash, 
            address(rolesContract), 
            address(reputationContract), 
            payable(auditTaxRepository), 
            9
        );
        
        // Admin appoints executor
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        
        // Executor submits result
        bytes32 testHash = keccak256("test_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);
        
        // BUYER requests audit
        vm.prank(OWNER);
        requestContract.requestAudit("reason");
        
        // Admin tries to appoint same person as auditor - should fail
        vm.prank(OWNER);
        vm.expectRevert("auditor cannot be executor");
        requestContract.appointAuditor(payable(SELLER_1));
    }

    function test_Admin_CannotAppointAuditorBeforeExecutor() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        vm.expectRevert("Invalid state for this operation");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();
    }

    function test_Admin_CannotAppointNonSellerAsAuditor() public {
        // Deploy request as BUYER_1
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(
            commandHash, 
            address(rolesContract), 
            address(reputationContract), 
            payable(auditTaxRepository), 
            9
        );
        
        // Admin appoints executor FIRST (state must be Created)
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        
        // Executor submits result
        bytes32 testHash = keccak256("test_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);
        
        // BUYER requests audit (not SELLER)
        vm.prank(OWNER);
        requestContract.requestAudit("reason");
        
        // Admin tries to appoint non-seller as auditor - should fail
        vm.prank(OWNER);
        vm.expectRevert("candidate not a seller");
        requestContract.appointAuditor(payable(RANDOM_USER));
    }

    // ============ RESULT ASSIGNMENT TESTS ============

    function test_Executor_CanAssignResult() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));

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
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));

        bytes32 testHash = keccak256("test_result");

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("executor only");
        requestContract.assignResult(testHash);
        vm.stopPrank();
    }

    // ============ AUDIT RESULT TESTS ============

    function test_Auditor_CanApproveCorrectResult() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);

        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        // Auditor posts same hash -> should be accepted and mark Completed, no on-chain reputation changes are asserted
        vm.startPrank(SELLER_2);
        vm.expectEmit(true, true, false, true);
        emit Request.AuditorResultAssigned(testHash, SELLER_2);
        requestContract.assignAuditResult(testHash);
        vm.stopPrank();

        vm.prank(OWNER);
        requestContract.completeRequest();

        assertEq(requestContract.auditorResultHash(), testHash, "Auditor hash should be stored");
        assertEq(uint(requestContract.currentState()), uint(Request.State.Completed), "State should be Completed");
        assertFalse(requestContract.faultyResult(), "Should not be marked as faulty");
    }

    function test_Auditor_CanDetectFaultyResult() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        vm.stopPrank();

        bytes32 executorHash = keccak256("executor_result");
        bytes32 auditorHash = keccak256("auditor_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(executorHash);

        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

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
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        vm.stopPrank();

        bytes32 testHash = keccak256("test_result");

        vm.prank(SELLER_1);
        requestContract.assignResult(testHash);

        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        vm.startPrank(RANDOM_USER);
        vm.expectRevert("auditor only");
        requestContract.assignAuditResult(testHash);
        vm.stopPrank();
    }

    // ============ RETRY AFTER FAULT TESTS ============

    function test_Admin_CanReassignExecutorAfterFault() public {
        // Deploy request as BUYER_1
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(
            commandHash, 
            address(rolesContract), 
            address(reputationContract), 
            payable(auditTaxRepository), 
            9
        );
        
        // Authorize request in audit tax repository
        vm.prank(OWNER);
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        
        // Admin appoints executor
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        
        // Executor submits result
        bytes32 executorHash = keccak256("executor_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(executorHash);
        
        // BUYER requests audit
        vm.prank(OWNER);
        requestContract.requestAudit("checking result");
        
        // Admin appoints auditor
        vm.prank(OWNER);
        requestContract.appointAuditor(payable(SELLER_2));
        
        // Auditor submits different result (fault detected)
        bytes32 auditorHash = keccak256("auditor_result");
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(auditorHash);
        
        // Now state is back to Created, admin can reassign executor
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_2));
        
        assertEq(requestContract.executor(), SELLER_2, "New executor should be assigned");
    }

    // ============ READ FUNCTION TESTS ============

    function test_GetInformation_ReturnsCorrectData() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
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
        assertEq(resultHash_, testHash, "Result hash should match");
        assertEq(auditorResultHash_, bytes32(0), "Auditor hash should be empty");
        assertFalse(faultyResult_, "Should not be faulty yet");
    }

    // ============ WORKFLOW INTEGRATION TESTS ============

    function test_CompleteWorkflow_HappyPath() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        // 1. Appoint executor
        vm.startPrank(OWNER);
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        requestContract.appointExecutor(payable(SELLER_1));
        assertEq(uint(requestContract.currentState()), uint(Request.State.ExecutorAssigned));
        vm.stopPrank();

        // 2. Executor submits result
        bytes32 correctHash = keccak256("correct_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(correctHash);
        assertEq(uint(requestContract.currentState()), uint(Request.State.ResultSubmitted));

        // 3. Appoint auditor
        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        // 4. Auditor approves (no on-chain reputation assertions)
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(correctHash);
        
        vm.prank(OWNER);
        requestContract.completeRequest();

        assertEq(uint(requestContract.currentState()), uint(Request.State.Completed));
    }

    function test_CompleteWorkflow_WithFaultAndRetry() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        requestContract.appointExecutor(payable(SELLER_1));
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        vm.stopPrank();

        // Executor submits wrong result
        bytes32 wrongHash = keccak256("wrong_result");
        vm.prank(SELLER_1);
        requestContract.assignResult(wrongHash);

        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        // Auditor detects fault
        bytes32 correctHash = keccak256("correct_result");
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(correctHash);

        assertEq(uint(requestContract.currentState()), uint(Request.State.Created));
        assertTrue(requestContract.faultyResult());

        // Reassign to new executor
        vm.prank(OWNER);
        requestContract.appointExecutor(payable(SELLER_2));

        // New executor submits correct result
        vm.prank(SELLER_2);
        requestContract.assignResult(correctHash);

        assertEq(uint(requestContract.currentState()), uint(Request.State.Audited));

        vm.prank(OWNER);
        requestContract.completeRequest();
        
        assertEq(uint(requestContract.currentState()), uint(Request.State.Completed));
    }

    // ============ PAYMENT TESTS ============

    function test_Payments_AuditorAndExecutorReceiveFunds() public {
        // Deploy request funded with total=10, escrow=9, tax forwarded=1
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        // Authorize request and assign participants
        vm.startPrank(OWNER);
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        requestContract.appointExecutor(payable(SELLER_1));
        vm.stopPrank();

        // Ensure deterministic starting balances
        vm.deal(SELLER_1, 0);
        vm.deal(SELLER_2, 0);

        uint256 execBefore = address(SELLER_1).balance;
        uint256 auditorBefore = address(SELLER_2).balance;
        uint256 repoBefore = auditTaxRepository.totalCollected();

        // Executor posts result
        bytes32 resultHash = keccak256("result_ok");
        vm.prank(SELLER_1);
        requestContract.assignResult(resultHash);

        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        // Auditor posts same result -> auditor paid (from repo) and executor paid (from contract)
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(resultHash);

        vm.prank(OWNER);
        requestContract.completeRequest();

        uint256 execAfter = address(SELLER_1).balance;
        uint256 auditorAfter = address(SELLER_2).balance;
        uint256 repoAfter = auditTaxRepository.totalCollected();

        // Current contract logic pays "cost" (9) to auditor and "escrow" (9) to executor.
        assertEq(execAfter - execBefore, uint256(9), "Executor should receive escrow (9)");
        assertEq(auditorAfter - auditorBefore, uint256(9), "Auditor should receive payment (9)");
        assertEq(repoAfter, repoBefore - uint256(9), "Repository should have decreased by auditor payment (9)");
    }

    function test_Payments_AuditorPaidOnFaultExecutorNotPaid() public {
        vm.prank(BUYER_1);
        requestContract = (new Request){value: 10}(commandHash, address(rolesContract), address(reputationContract), payable(auditTaxRepository), 9);

        vm.startPrank(OWNER);
        auditTaxRepository.authorizeRequest(address(requestContract), true);
        requestContract.appointExecutor(payable(SELLER_1));
        vm.stopPrank();

        // Setup deterministic balances
        vm.deal(SELLER_1, 0);
        vm.deal(SELLER_2, 0);

        uint256 execBefore = address(SELLER_1).balance;
        uint256 auditorBefore = address(SELLER_2).balance;
        uint256 repoBefore = auditTaxRepository.totalCollected();

        // Executor posts wrong result
        bytes32 executorHash = keccak256("executor_wrong");
        vm.prank(SELLER_1);
        requestContract.assignResult(executorHash);
        
        vm.startPrank(OWNER);
        requestContract.requestAudit("requested");
        requestContract.appointAuditor(payable(SELLER_2));
        vm.stopPrank();

        // Auditor posts a different (correct) result -> mismatch: auditor still gets paid, executor not paid
        bytes32 auditorHash = keccak256("auditor_correct");
        vm.prank(SELLER_2);
        requestContract.assignAuditResult(auditorHash);

        uint256 execAfter = address(SELLER_1).balance;
        uint256 auditorAfter = address(SELLER_2).balance;
        uint256 repoAfter = auditTaxRepository.totalCollected();

        // Auditor paid (9), executor unchanged, repo decreased by 9
        assertEq(auditorAfter - auditorBefore, uint256(9), "Auditor should receive payment (9) on audit");
        assertEq(execAfter, execBefore, "Executor should NOT receive payment on faulty result");
        assertEq(repoAfter, repoBefore - uint256(9), "Repository should have decreased by auditor payment (9)");

        // escrow still held in Request (executor can be reassigned and paid later)
        assertEq(uint(requestContract.currentState()), uint(Request.State.Created), "State reset to Created after fault");
    }
}