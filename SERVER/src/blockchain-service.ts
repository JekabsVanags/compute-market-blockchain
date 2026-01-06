/** ./SERVER/src/blockchain-service.ts
 * BLOCKCHAIN SERVICE
 *
 * Reusable functions for blockchain interactions (deploy Request contracts, check connections, etc.).
 * These functions are called by both the REST API (server.ts) and CLI script (create-task.ts).
 */

// Main library for interacting with Ethereum:
import { ethers } from 'ethers';
// The compiled Request contract (ABI + bytecode):
import RequestArtifact from '../../BLOCKCHAIN/artifacts/contracts/Request.sol/Request.json';

// Configuration needed to connect to blockchain and deploy contracts:
export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  rolesAddress: string;
  reputationAddress: string;
}

// Information about a successfully deployed Request contract:
export interface DeployedContract {
  address: string;             // Contract address on blockchain.
  transactionHash: string;     // Transaction that deployed the contract.
  owner: string;               // Address that deployed it (buyer).
  commandHash: string;         // The compute task identifier.
  blockNumber: number;         // Block number where contract was deployed.
}

// Creates a connection to the blockchain node:
export function createProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Creates a wallet that can sign transactions (needed to deploy contracts):
export function createWallet(privateKey: string, provider: ethers.JsonRpcProvider) {
  return new ethers.Wallet(privateKey, provider);
}

// Deploys a new Request contract to the blockchain:
// Each Request contract represents a compute task in the marketplace.
export async function deployRequestContract(
  config: BlockchainConfig,
  commandHash: string
): Promise<DeployedContract> {
  // Connect to blockchain and create wallet:
  const provider = createProvider(config.rpcUrl);
  const wallet = createWallet(config.privateKey, provider);

  // Create a contract factory (combines ABI, bytecode, and wallet):
  // This factory can deploy new instances of the Request contract.
  const contractFactory = new ethers.ContractFactory(
    RequestArtifact.abi,
    RequestArtifact.bytecode,
    wallet
  );

  // Deploy the contract to the blockchain:
  // Constructor parameters: commandHash, rolesAddress, reputationAddress
  const contract = await contractFactory.deploy(
    commandHash,
    config.rolesAddress,
    config.reputationAddress
  );

  // Wait for the deployment transaction to be mined:
  await contract.waitForDeployment();

  // Get the deployed contract's address:
  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error('Deployment transaction not found');
  }

  // Get the block number where contract was deployed:
  const receipt = await provider.getTransactionReceipt(deploymentTx.hash);
  const blockNumber = receipt?.blockNumber || 0;

  // Read data from the deployed contract:
  // (Using 'as any' because TypeScript can't infer contract methods from ABI at compile time.)
  const owner = await (contract as any).owner();
  const storedCommandHash = await (contract as any).commandHash();

  return {
    address,
    transactionHash: deploymentTx.hash,
    owner,
    commandHash: storedCommandHash,
    blockNumber
  };
}

// Checks if we can connect to the blockchain node:
// Used by the /health endpoint to verify the server can reach the blockchain.
export async function checkConnection(rpcUrl: string): Promise<{ connected: boolean; chainId?: bigint; blockNumber?: number }> {
  try {
    const provider = createProvider(rpcUrl);
    // Get network information (chainId identifies which blockchain, e.g., 31337 for the Hardhat local network):
    const network = await provider.getNetwork();
    // Get current block number (increases with each transaction):
    const blockNumber = await provider.getBlockNumber();

    return {
      connected: true,
      chainId: network.chainId,
      blockNumber
    };
  } catch (error) {
    // If connection fails, return false (e.g., blockchain might not be running):
    return { connected: false };
  }
}
