/** ./BLOCKCHAIN/scripts/authorize-request.ts
 * Authorize a Request contract in the AuditTaxRepository
 * Usage: npx hardhat run scripts/authorize-request.ts --network localhost
 */

import { network } from "hardhat";

// Connect to the network and get ethers instance:
const { ethers } = await network.connect();

async function main() {
  const requestAddress = process.env.REQUEST_ADDRESS;

  if (!requestAddress) {
    console.error('Usage: REQUEST_ADDRESS=0x... npx hardhat run scripts/authorize-request.ts --network localhost');
    process.exit(1);
  }

  const auditTaxRepoAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const [deployer] = await ethers.getSigners();
  const auditTaxRepo = await ethers.getContractAt("AuditTaxRepository", auditTaxRepoAddress);

  console.log(`Authorizing Request contract ${requestAddress}...`);
  const tx = await auditTaxRepo.connect(deployer).authorizeRequest(requestAddress, true);
  await tx.wait();
  console.log(`✓ Authorized`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
