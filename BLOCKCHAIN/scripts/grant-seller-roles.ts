/** ./BLOCKCHAIN/scripts/grant-seller-roles.ts
 * Grant SELLER_ROLE to accounts that will act as executors and auditors
 */

import { network } from "hardhat";

// Connect to the network and get ethers instance:
const { ethers } = await network.connect();

async function main() {
  const rolesAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const roles = await ethers.getContractAt("Roles", rolesAddress);
  const SELLER_ROLE = await roles.SELLER_ROLE();

  const accounts = await ethers.getSigners();

  // Grant SELLER_ROLE to accounts 1 and 2:
  await roles.grantRole(SELLER_ROLE, accounts[1].address);
  console.log("Granted SELLER_ROLE to account #1:", accounts[1].address);

  await roles.grantRole(SELLER_ROLE, accounts[2].address);
  console.log("Granted SELLER_ROLE to account #2:", accounts[2].address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
