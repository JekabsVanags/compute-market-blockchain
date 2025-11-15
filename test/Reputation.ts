import { expect } from "chai";
import { network } from "hardhat";

let { ethers } = await network.connect();

describe("Reputation", function () {
  let owner: any;
  let buyer1: any;
  let buyer2: any;
  let seller: any;
  let randomUser: any;
  let roles: any;
  let reputation: any;
  let request: any;

  beforeEach(async function () {
    [owner, buyer1, buyer2, seller, randomUser] = await ethers.getSigners();

    const RolesFactory = await ethers.getContractFactory("Roles");
    roles = await RolesFactory.connect(owner).deploy();
    await roles.waitForDeployment();

    const ReputationFactory = await ethers.getContractFactory("Reputation");
    reputation = await ReputationFactory.connect(owner).deploy(
      await roles.getAddress()
    );
    await reputation.waitForDeployment();

    const hash = ethers.keccak256(ethers.toUtf8Bytes("Test"));

    const buyerRole = await roles.BUYER_ROLE();
    await roles.connect(owner).grantRole(buyerRole, buyer1.address);
    await roles.connect(owner).grantRole(buyerRole, buyer2.address);

    const RequestFactory = await ethers.getContractFactory("Request");
    request = await RequestFactory.connect(buyer1).deploy(
      hash,
      await roles.getAddress(),
      await reputation.getAddress()
    );
    await request.waitForDeployment();
  });

  it("buyer can award and ReputationChanged is emitted", async function () {
    await expect(
      reputation
        .connect(buyer1)
        .award(seller.address, await request.getAddress())
    )
      .to.emit(reputation, "ReputationChanged")
      .withArgs(
        seller.address,
        buyer1.address,
        await request.getAddress(),
        1,
        1
      );

    expect(await reputation.reputationOf(seller.address)).to.equal(1);
  });

  it("non-buyer cannot award (reverts)", async function () {
    await expect(
      reputation
        .connect(randomUser)
        .award(seller.address, await request.getAddress())
    ).to.be.revertedWith("buyer only");
  });

  it("admin (roles owner) can set score", async function () {
    await reputation.connect(owner).setScore(seller.address, 42);
    expect(await reputation.reputationOf(seller.address)).to.equal(42);
  });
});
