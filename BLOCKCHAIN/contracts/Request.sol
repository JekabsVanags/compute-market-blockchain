// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Reputation} from "./Reputation.sol";
import {Roles} from "./Roles.sol";

/// @notice Request for computational job.
/// Role management is delegated to a Roles contract; reputation updates to Reputation contract.
contract Request {
    // External contracts
    Roles public roles;
    Reputation public reputation;

    // Involved parties
    address public owner;
    address public executor;
    address public auditor;

    // State machine
    enum State { Created, ExecutorAssigned, ResultSubmitted, Audited, Completed }
    State public currentState;

    // Data fields
    bytes32 public commandHash;
    bytes32 public resultHash;
    bytes32 public auditorResultHash;
    bool public faultyResult;

    // Events
    event ExecutorAssigned(address indexed account);
    event AuditorAssigned(address indexed account);
    event ResultAssigned(bytes32 hash, address indexed by);
    event AuditorResultAssigned(bytes32 hash, address indexed by);
    event FaultyCalculationDetected(address indexed auditedBy, address calculatedBy, bytes32 executionHash, bytes32 auditHash);
    event FaultyCalculationFixed(address indexed auditedBy, address calculatedBy);
    event RequestFinished(address indexed calculatedBy,address auditedBy, bytes32 resultHash);

    constructor(bytes32 calculatedCommandHash, address rolesAddress, address reputationAddress) {
        owner = msg.sender;
        roles = Roles(rolesAddress);
        reputation = Reputation(reputationAddress);

        require(roles.hasRole(roles.BUYER_ROLE(), msg.sender), "buyer only");

        commandHash = calculatedCommandHash;
        currentState = State.Created;
    }

//ACCESS

    modifier onlyOwner() {
        require(owner == msg.sender, "owner only");
        _;
    }

    modifier onlyAdmin() {
        require(roles.hasRole(roles.ADMIN_ROLE(), msg.sender), "admin only");
        _;
    }

    modifier onlyExecutor() {
        require(executor == msg.sender, "executor only");
        _;
    }

    modifier onlyAuditor() {
        require(auditor == msg.sender, "auditor only");
        _;
    }

//STATE

    modifier inState(State _state) {
        require(currentState == _state, "Invalid state for this operation");
        _;
    }

    modifier transitionTo(State _nextState) {
        _;
        currentState = _nextState;
    }


//FUNCTIONS

    /// @notice Admin appoints an executor. Only allowed when request is Created.
    function appointExecutor(address potentialExecutor)
        public
        onlyAdmin
        inState(State.Created)
        transitionTo(State.ExecutorAssigned)
    {
        require(roles.hasRole(roles.SELLER_ROLE(), potentialExecutor), "candidate not a seller");
        executor = potentialExecutor;
        emit ExecutorAssigned(potentialExecutor);
    }

    /// @notice Admin appoints an auditor. Allowed when executor is assigned.
    function appointAuditor(address potentialAuditor)
        public
        onlyAdmin
        inState(State.ExecutorAssigned)
    {
        require(potentialAuditor != executor, "auditor cannot be executor");
        require(roles.hasRole(roles.SELLER_ROLE(), potentialAuditor), "candidate not a seller");

        auditor = potentialAuditor;
        emit AuditorAssigned(potentialAuditor);
        // remain in ExecutorAssigned state until executor posts result
    }

    /// @notice Executor posts the computation result. Moves state to ResultSubmitted.
    function assignResult(bytes32 calculatedResultHash)
        public
        onlyExecutor
        inState(State.ExecutorAssigned)
        transitionTo(State.ResultSubmitted)
    {
        resultHash = calculatedResultHash;
        emit ResultAssigned(calculatedResultHash, msg.sender);

        // If auditor already posted result, evaluate immediately
        if (auditorResultHash != bytes32(0)) {
            if (auditorResultHash == resultHash) {
                faultyResult = false;
                emit FaultyCalculationFixed(auditor, executor);
                currentState = State.Completed; // overwrite transition
                emit RequestFinished(executor, auditor, resultHash);
            } else {
                faultyResult = true;
                emit FaultyCalculationDetected(auditor, executor, resultHash, auditorResultHash);
                executor = address(0);
                currentState = State.Created; // allow retry
            }
        }
    }

    /// @notice Auditor posts audit result. Evaluates and finalizes the request.
    function assignAuditResult(bytes32 calculatedResultHash)
        public
        onlyAuditor
        inState(State.ResultSubmitted)
    {
        auditorResultHash = calculatedResultHash;
        emit AuditorResultAssigned(calculatedResultHash, msg.sender);

        if (resultHash != calculatedResultHash) {
            // mismatch: mark faulty, penalize executor and reset executor
            faultyResult = true;
            emit FaultyCalculationDetected(auditor, executor, resultHash, auditorResultHash);
            executor = address(0);
            // allow re-assignment to try again
            currentState = State.Created;
        } else {
            currentState = State.Completed;
            emit RequestFinished(executor, auditor, resultHash);
        }
    }

//READ
    /// @notice Get the information of the request 
    function getInformation() external view returns (
        State state,
        address owner_,
        address executor_,
        address auditor_,
        bytes32 commandHash_,
        bytes32 resultHash_,
        bytes32 auditorResultHash_,
        bool faultyResult_
    ) {
        return (
            currentState,
            owner,
            executor,
            auditor,
            commandHash,
            resultHash,
            auditorResultHash,
            faultyResult
        );
    }
}