/** ./BLOCKCHAIN/scripts/deploy-core-contracts.ts
 * CORE CONTRACTS DEPLOYMENT SCRIPT
 *
 * Deploys the Roles and Reputation contracts to the local Hardhat network (before creating any Request contracts).
 *
 * Run this ONCE when starting a local blockchain, then use the addresses in the SERVER (i.e., .env file).
 */

import { network } from "hardhat";

// Connect to the network and get ethers instance:
const { ethers } = await network.connect({
  network: "localhost",
  chainType: "l1",
});

async function main() {
  console.log("Deploying core contracts to local Hardhat network...\n");

  // Get the deployer account (first account from Hardhat's default accounts):
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // 1. Deploy Roles contract:
  console.log("Deploying Roles contract...");

  const RolesFactory = await ethers.getContractFactory("Roles");
  const roles = await RolesFactory.deploy();
  await roles.waitForDeployment();

  const rolesAddress = await roles.getAddress();
  console.log("Roles deployed to:", rolesAddress);
  console.log("");

  // Grant BUYER_ROLE to the deployer so they can create Request contracts:
  console.log("Granting BUYER_ROLE to deployer...");
  const BUYER_ROLE = await (roles as any).BUYER_ROLE();
  const tx = await (roles as any).grantRole(BUYER_ROLE, deployer.address);
  await tx.wait();
  console.log("BUYER_ROLE granted to:", deployer.address);
  console.log("");

  // 2. Deploy Reputation contract:
  console.log("Deploying Reputation contract...");
  console.log("   (depends on Roles at", rolesAddress, ")");

  const ReputationFactory = await ethers.getContractFactory("Reputation");
  const reputation = await ReputationFactory.deploy(rolesAddress);
  await reputation.waitForDeployment();

  const reputationAddress = await reputation.getAddress();
  console.log("Reputation deployed to:", reputationAddress);
  console.log("");

  // Summary:
  console.log("Core contracts deployed!");
  console.log("");
  console.log("COPY THESE ADDRESSES TO `./SERVER/.env` FILE:");
  console.log("");
  console.log(`ROLES_CONTRACT_ADDRESS=${rolesAddress}`);
  console.log(`REPUTATION_CONTRACT_ADDRESS=${reputationAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
