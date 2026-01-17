import { expect } from "chai";
import { network } from "hardhat";

let { ethers } = await network.connect();

let roles: any;
let reputation: any;
let request: any;

let owner: any;
let buyer: any;
let seller: any;
let auditor: any;
let randomUser: any;

let commands = ["cmd1", "cmd2", "cmd3"];

// State enum values
const State = {
  Created: 0,
  ExecutorAssigned: 1,
  ResultSubmitted: 2,
  AuditRequested: 3,
  Audited: 4,
  Completed: 5,
};

describe("Requests", function () {
  beforeEach(async function () {
    [owner, buyer, seller, auditor, randomUser] = await ethers.getSigners();

    // Deploy AuditTaxRepository (owner is `owner`)
    const AuditRepoFactory = await ethers.getContractFactory("AuditTaxRepository");
    const auditRepo = await AuditRepoFactory.connect(owner).deploy({
      value: 100n,
    });
    await auditRepo.waitForDeployment();

    // Deploy Roles
    const RolesFactory = await ethers.getContractFactory("Roles");
    roles = await RolesFactory.connect(owner).deploy();
    await roles.waitForDeployment();

    // Deploy Reputation
    const ReputationFactory = await ethers.getContractFactory("Reputation");
    reputation = await ReputationFactory.connect(owner).deploy(roles.target);
    await reputation.waitForDeployment();

    // Grant roles
    const BUYER_ROLE = await roles.BUYER_ROLE();
    const SELLER_ROLE = await roles.SELLER_ROLE();
    await roles.connect(owner).grantRole(BUYER_ROLE, buyer.address);
    await roles.connect(owner).grantRole(SELLER_ROLE, seller.address);
    await roles.connect(owner).grantRole(SELLER_ROLE, auditor.address);

    // Deploy Request as buyer
    const RequestFactory = await ethers.getContractFactory("Request");
    const commandHash = ethers.keccak256(ethers.toUtf8Bytes(commands.join(",")));

    request = await RequestFactory.connect(buyer).deploy(
      commandHash,
      roles.target,
      reputation.target,
      auditRepo.target,
      9,
      { value: 10 }
    );
    await request.waitForDeployment();

    // authorize this request contract in the audit repository (owner of repo)
    await auditRepo.connect(owner).authorizeRequest(request.target, true);
  });

  it("should emit events for faulty result penalization", async function () {
    // Admin assigns executor
    await expect(request.connect(owner).appointExecutor(seller.address))
      .to.emit(request, "ExecutorAssigned")
      .withArgs(seller.address);

    // Executor submits wrong result
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong_result"));
    await expect(request.connect(seller).assignResult(wrongHash))
      .to.emit(request, "ResultAssigned")
      .withArgs(wrongHash, seller.address);

    // Buyer requests audit
    await expect(request.connect(owner).requestAudit("suspicious result"))
      .to.emit(request, "AuditRequested")
      .withArgs(owner.address, "suspicious result");

    // Admin assigns auditor
    await expect(request.connect(owner).appointAuditor(auditor.address))
      .to.emit(request, "AuditorAssigned")
      .withArgs(auditor.address);

    // Auditor submits correct result (different from executor)
    const correctHash = ethers.keccak256(ethers.toUtf8Bytes("correct_result"));
    await expect(request.connect(auditor).assignAuditResult(correctHash))
      .to.emit(request, "AuditorResultAssigned")
      .withArgs(correctHash, auditor.address)
      .and.to.emit(request, "FaultyCalculationDetected")
      .withArgs(auditor.address, seller.address, wrongHash, correctHash);

    // Verify state reset to Created
    const info = await request.getInformation();
    expect(info.state).to.equal(State.Created);

    // Penalize executor via admin (emit event from Reputation)
    await expect(reputation.connect(owner).penalize(seller.address, await request.getAddress(), 1))
      .to.emit(reputation, "ReputationChanged")
      .withArgs(seller.address, owner.address, await request.getAddress(), -1, -1);
  });

  it("should emit events for successful workflow and awarding executor", async function () {
    // Admin assigns executor
    await expect(request.connect(owner).appointExecutor(seller.address))
      .to.emit(request, "ExecutorAssigned")
      .withArgs(seller.address);

    // Executor submits result
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("correct_result"));
    await expect(request.connect(seller).assignResult(resultHash))
      .to.emit(request, "ResultAssigned")
      .withArgs(resultHash, seller.address);

    // Buyer requests audit
    await expect(request.connect(owner).requestAudit("want to verify"))
      .to.emit(request, "AuditRequested")
      .withArgs(owner.address, "want to verify");

    // Admin assigns auditor
    await expect(request.connect(owner).appointAuditor(auditor.address))
      .to.emit(request, "AuditorAssigned")
      .withArgs(auditor.address);

    // Auditor submits same result (matches executor)
    await expect(request.connect(auditor).assignAuditResult(resultHash))
      .to.emit(request, "AuditorResultAssigned")
      .withArgs(resultHash, auditor.address);

    // Verify state is now Audited
    let info = await request.getInformation();
    expect(info.state).to.equal(State.Audited);

    // Admin completes the request
    await expect(request.connect(owner).completeRequest())
      .to.emit(request, "RequestFinished")
      .withArgs(seller.address, auditor.address, resultHash);

    // Verify state is now Completed
    info = await request.getInformation();
    expect(info.state).to.equal(State.Completed);

    // Admin awards executor
    await expect(reputation.connect(owner).award(seller.address, await request.getAddress(), 1))
      .to.emit(reputation, "ReputationChanged")
      .withArgs(seller.address, owner.address, await request.getAddress(), 1, 1);
  });

  it("should complete without audit when no audit requested", async function () {
    // Admin assigns executor
    await request.connect(owner).appointExecutor(seller.address);

    // Executor submits result
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("result"));
    await request.connect(seller).assignResult(resultHash);

    // Verify state is ResultSubmitted
    let info = await request.getInformation();
    expect(info.state).to.equal(State.ResultSubmitted);

    // Admin completes without audit
    await expect(request.connect(owner).completeRequest())
      .to.emit(request, "RequestFinished")
      .withArgs(seller.address, ethers.ZeroAddress, resultHash);

    // Verify completed
    info = await request.getInformation();
    expect(info.state).to.equal(State.Completed);
  });

  it("should use ground truth on retry after faulty result", async function () {
    // First attempt - executor submits wrong result
    await request.connect(owner).appointExecutor(seller.address);
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
    await request.connect(seller).assignResult(wrongHash);

    // Admin requests audit
    await request.connect(owner).requestAudit("check this");
    await request.connect(owner).appointAuditor(auditor.address);

    // Auditor establishes ground truth
    const correctHash = ethers.keccak256(ethers.toUtf8Bytes("correct"));
    await request.connect(auditor).assignAuditResult(correctHash);

    // State should be back to Created
    let info = await request.getInformation();
    expect(info.state).to.equal(State.Created);
    expect(info.auditorResultHash_).to.equal(correctHash); // Ground truth stored

    // Second attempt - new executor
    const seller2 = randomUser;
    await roles.connect(owner).grantRole(await roles.SELLER_ROLE(), seller2.address);
    await request.connect(owner).appointExecutor(seller2.address);

    // New executor submits correct result matching ground truth
    await expect(request.connect(seller2).assignResult(correctHash))
      .to.emit(request, "ResultAssigned")
      .withArgs(correctHash, seller2.address)
      .and.to.emit(request, "FaultyCalculationFixed")
      .withArgs(auditor.address, seller2.address);

    // Should jump directly to Audited state
    info = await request.getInformation();
    expect(info.state).to.equal(State.Audited);

    // Can complete now
    await expect(request.connect(owner).completeRequest())
      .to.emit(request, "RequestFinished")
      .withArgs(seller2.address, auditor.address, correctHash);
  });
});
