// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Reputation} from "./Reputation.sol";
import {Roles} from "./Roles.sol";
import {AuditTaxRepository} from "./AuditTaxRepository.sol";

/// @notice Request for computational job.
/// Role management is delegated to a Roles contract; reputation updates to Reputation contract.
contract Request {
    // External contracts
    Roles public roles;
    Reputation public reputation;
    AuditTaxRepository public auditTaxRepository;

    // Involved parties
    address payable public owner;
    address payable public executor;
    address payable public auditor;

    // State machine
    enum State { Created, ExecutorAssigned, ResultSubmitted, AuditRequested, Audited, Completed }
    State public currentState;

    // Data fields
    bytes32 public commandHash;
    bytes32 public resultHash;
    bytes32 public auditorResultHash;
    bool public faultyResult;
    bool public auditRequired;

    // Events
    event ExecutorAssigned(address indexed account);
    event AuditorAssigned(address indexed account);
    event ResultAssigned(bytes32 hash, address indexed by);
    event AuditorResultAssigned(bytes32 hash, address indexed by);
    event FaultyCalculationDetected(address indexed auditedBy, address calculatedBy, bytes32 executionHash, bytes32 auditHash);
    event FaultyCalculationFixed(address indexed auditedBy, address calculatedBy);
    event RequestFinished(address indexed calculatedBy,address auditedBy, bytes32 resultHash);
    event AuditRequested(address indexed requestedBy, string reason);

    // Payments
    uint256 public escrowAmount;
    uint256 public cost;


    constructor(bytes32 calculatedCommandHash, address rolesAddress, address reputationAddress, address payable auditTaxRepAddress, uint256 job_cost) payable {
        owner = payable(msg.sender);
        roles = Roles(rolesAddress);

        require(roles.hasRole(roles.BUYER_ROLE(), msg.sender), "buyer only");
     
        reputation = Reputation(reputationAddress);
        auditTaxRepository = AuditTaxRepository(auditTaxRepAddress);

        commandHash = calculatedCommandHash;
        currentState = State.Created;

        require(msg.value > 0, "Must fund");

        //Deposit funds in the contract and the audit tax repository
        escrowAmount = (msg.value * 90) / 100;
        uint256 auditTax = (msg.value * 10) / 100;
        
        cost = job_cost;

        require(cost == escrowAmount, "cost should match 90% of the payment");

        _depositAuditTax(auditTax);
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
    function appointExecutor(address payable potentialExecutor)
        public
        onlyAdmin
        inState(State.Created)
        transitionTo(State.ExecutorAssigned)
    {
        require(roles.hasRole(roles.SELLER_ROLE(), potentialExecutor), "candidate not a seller");
        executor = potentialExecutor;
        emit ExecutorAssigned(potentialExecutor);
    }

    ///@notice Can ask for audit
    function requestAudit(string memory reason)
        public
        onlyAdmin
        inState(State.ResultSubmitted)
        transitionTo(State.AuditRequested)
    {
        //Cant audit singe job more than once
        require(!auditRequired, "Audit already has been requested");
        auditRequired = true;
        emit AuditRequested(msg.sender, reason);
    }

    /// @notice Admin appoints an auditor. Allowed when executor is assigned.
    function appointAuditor(address payable potentialAuditor)
        public
        onlyAdmin
        inState(State.AuditRequested)
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
    {
        resultHash = calculatedResultHash;
        emit ResultAssigned(calculatedResultHash, msg.sender);
        currentState = State.ResultSubmitted;

        // If auditor already posted result, evaluate immediately
        if (auditorResultHash != bytes32(0)) {
            if (auditorResultHash == resultHash) {
                faultyResult = false;
                emit FaultyCalculationFixed(auditor, executor);
                currentState = State.Audited;
            } else {
                faultyResult = true;
                emit FaultyCalculationDetected(auditor, executor, resultHash, auditorResultHash);
                executor = payable(address(0));
                resultHash = bytes32(0);
                currentState = State.Created; // allow retry
            }
        }
    }

    /// @notice Auditor posts audit result. Evaluates and finalizes the request.
    function assignAuditResult(bytes32 calculatedResultHash)
        public
        onlyAuditor
        inState(State.AuditRequested)
    {
        auditorResultHash = calculatedResultHash;
        emit AuditorResultAssigned(calculatedResultHash, msg.sender);
        _payoutAuditor();

        if (resultHash != calculatedResultHash) {
            // mismatch: mark faulty, penalize executor and reset executor
            faultyResult = true;
            emit FaultyCalculationDetected(auditor, executor, resultHash, auditorResultHash);
            executor = payable(address(0));
            resultHash = bytes32(0);
            // allow re-assignment to try again
            currentState = State.Created;
        } else {
            currentState = State.Audited;
        }
    }

    function completeRequest()
        public
        onlyAdmin
        transitionTo(State.Completed)
    {
        require(
            currentState == State.ResultSubmitted || 
            currentState == State.Audited,
            "Invalid state"
        );
        
        // If audit was required, verify it passed
        if (auditRequired) {
            require(currentState == State.Audited, "Audit not submitted");
            require(auditorResultHash == resultHash, "Audit failed - results don't match");
        }
        
        require(resultHash != bytes32(0), "No result submitted");
        
        _payoutExecutor();
        emit RequestFinished(executor, auditor, resultHash);
    }

//Payouts
    function _payoutExecutor() internal {
        uint256 amount = escrowAmount;
        escrowAmount = 0;

        (bool success, ) = executor.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function _payoutAuditor() internal {
        uint256 amount = cost;
        auditTaxRepository.withdraw(auditor, amount);
    }

    function _depositAuditTax(uint256 tax) internal {
        (bool success, ) = address(auditTaxRepository).call{value: tax}("");
        require(success, "Transfer failed");
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