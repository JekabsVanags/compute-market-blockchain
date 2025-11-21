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

describe("Requests", function () {
  beforeEach(async function () {
    [owner, buyer, seller, auditor, randomUser] = await ethers.getSigners();

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
    const commandHash = ethers.keccak256(
      ethers.toUtf8Bytes(commands.join(","))
    );

    request = await RequestFactory.connect(buyer).deploy(
      commandHash,
      roles.target,
      reputation.target
    );
    await request.waitForDeployment();
  });

  it("should emit events for faulty result penalization", async function () {
    // Admin assigns executor
    await expect(request.connect(owner).appointExecutor(seller.address))
      .to.emit(request, "ExecutorAssigned")
      .withArgs(seller.address);

    await expect(request.connect(owner).appointAuditor(auditor.address))
      .to.emit(request, "AuditorAssigned")
      .withArgs(auditor.address);

    // Executor submits wrong result
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong_result"));
    await expect(request.connect(seller).assignResult(wrongHash))
      .to.emit(request, "ResultAssigned")
      .withArgs(wrongHash, seller.address);

    // Auditor submits correct result
    const correctHash = ethers.keccak256(ethers.toUtf8Bytes("correct_result"));
    await expect(request.connect(auditor).assignAuditResult(correctHash))
      .to.emit(request, "FaultyCalculationDetected")
      .withArgs(auditor.address, seller.address, wrongHash, correctHash);

    // Penalize executor via admin (emit event from Reputation)
    await expect(
      reputation.connect(owner).penalize(seller.address, request.getAddress())
    )
      .to.emit(reputation, "ReputationChanged")
      .withArgs(seller.address, owner.address, request.getAddress(), -1, -1);
  });

  it("should emit events for successful workflow and awarding executor", async function () {
    await expect(request.connect(owner).appointExecutor(seller.address))
      .to.emit(request, "ExecutorAssigned")
      .withArgs(seller.address);

    await expect(request.connect(owner).appointAuditor(auditor.address))
      .to.emit(request, "AuditorAssigned")
      .withArgs(auditor.address);

    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("correct_result"));
    await expect(request.connect(seller).assignResult(resultHash))
      .to.emit(request, "ResultAssigned")
      .withArgs(resultHash, seller.address);

    await expect(request.connect(auditor).assignAuditResult(resultHash))
      .to.emit(request, "AuditorResultAssigned")
      .withArgs(resultHash, auditor.address)
      .and.to.emit(request, "RequestFinished")
      .withArgs(seller.address, auditor.address, resultHash);

    // Admin awards executor
    await expect(
      reputation.connect(owner).award(seller.address, request.getAddress())
    )
      .to.emit(reputation, "ReputationChanged")
      .withArgs(seller.address, owner.address, request.getAddress(), 1, 1);
  });
});
