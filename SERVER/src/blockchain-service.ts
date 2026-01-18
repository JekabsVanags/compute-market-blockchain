/** ./SERVER/src/blockchain-service.ts
 * BLOCKCHAIN SERVICE
 *
 * Reusable functions for blockchain interactions (deploy Request contracts, check connections, etc.).
 */

// Main library for interacting with Ethereum:
import { ethers } from 'ethers';
// The compiled Request contract (ABI + bytecode):
import RequestArtifact from '../../BLOCKCHAIN/artifacts/contracts/Request.sol/Request.json';
import AuditTaxRepositoryArtifact from '../../BLOCKCHAIN/artifacts/contracts/AuditTaxRepository.sol/AuditTaxRepository.json';
import ReputationArtifact from '../../BLOCKCHAIN/artifacts/contracts/Reputation.sol/Reputation.json';

// Configuration needed to connect to blockchain and deploy contracts:
export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  rolesAddress: string;
  reputationAddress: string;
  auditTaxRepositoryAddress: string;
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

/**
 * Call a method on a deployed Request contract
 * @param contractAddress - Address of the deployed Request contract
 * @param config - Blockchain configuration
 * @param methodName - Name of the contract method to call
 * @param params - Parameters to pass to the method
 * @returns Transaction hash and block number
 */
export async function callRequestContractMethod(
  contractAddress: string,
  config: BlockchainConfig,
  methodName: string,
  params: any[] = []
): Promise<{ transactionHash: string; blockNumber: number }> {
  const provider = createProvider(config.rpcUrl);
  const wallet = createWallet(config.privateKey, provider);

  // Create contract instance at the deployed address:
  const contract = new ethers.Contract(contractAddress, RequestArtifact.abi, wallet);

  // Call the method and wait for transaction to be mined:
  const tx = await contract[methodName](...params);
  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber
  };
}

// Deploys a new Request contract to the blockchain:
// Each Request contract represents a compute task in the marketplace.
export async function deployRequestContract(
  config: BlockchainConfig,
  commandHash: string,
  priceEth: string  // Job cost in ETH (e.g., "0.5").
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

  // Calculate payment amounts:
  // - job_cost (90% of total) goes to escrow for seller payment.
  // - audit tax (10% of total) goes to AuditTaxRepository.
  const jobCostWei = ethers.parseEther(priceEth); // Convert ETH to WEI (i.e., smallest unit of ETH).
  // Round up total payment to ensure we send enough:
  const totalPaymentWei = (jobCostWei * BigInt(100) + BigInt(89)) / BigInt(90);
  // Integer division rounding errors fix:
  const actualEscrowWei = (totalPaymentWei * BigInt(90)) / BigInt(100);

  // Deploy the contract to the blockchain:
  // Constructor parameters: commandHash, rolesAddress, reputationAddress, auditTaxRepAddress, job_cost
  // Must send ETH value with deployment (payable constructor).
  const contract = await contractFactory.deploy(
    commandHash,
    config.rolesAddress,
    config.reputationAddress,
    config.auditTaxRepositoryAddress,
    actualEscrowWei,           // Pass the actual escrow amount Solidity will calculate (not the requested amount).
    { value: totalPaymentWei } // Send ETH with deployment.
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

  // Note: Request contracts need to be authorized in AuditTaxRepository before audit functionality works.
  // For MVP, this is done via the deploy script or manually.
  // In production, this could be automated by the AuditTaxRepository owner after deployment.
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

// Gets all Hardhat test accounts with their balances:
// Hardhat provides 20 pre-funded accounts (each with 10,000 fake ETH).
export async function getHardhatAccounts(rpcUrl: string) {
  const provider = createProvider(rpcUrl);

  // Hardhat's default private keys for accounts 0-19:
  const hardhatPrivateKeys = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
    '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
    '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
    '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897',
    '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82',
    '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1',
    '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd',
    '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa',
    '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61',
    '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0',
    '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd',
    '0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0',
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e'
  ];

  const accounts = await Promise.all(
    hardhatPrivateKeys.map(async (privateKey, index) => {
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);

      return {
        index,
        address: wallet.address,
        balance: ethers.formatEther(balance) // Convert from WEI to ETH.
      };
    })
  );

  return accounts;
}

// Sends ETH payment from one account to another:
// Used when buyer finalizes a task to pay the seller.
export async function sendPayment(
  rpcUrl: string,
  fromAccountIndex: number,
  toAddress: string,
  amountEth: string
): Promise<{ transactionHash: string; blockNumber: number }> {
  const provider = createProvider(rpcUrl);

  // Get all Hardhat private keys:
  const hardhatPrivateKeys = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
    '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
    '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
    '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897',
    '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82',
    '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1',
    '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd',
    '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa',
    '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61',
    '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0',
    '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd',
    '0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0',
    '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e'
  ];

  if (fromAccountIndex < 0 || fromAccountIndex >= hardhatPrivateKeys.length) {
    throw new Error(`Invalid account index: ${fromAccountIndex} (must be 0-19)!`);
  }

  const wallet = createWallet(hardhatPrivateKeys[fromAccountIndex], provider);

  // Send transaction:
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amountEth) // Convert WEI to ETH.
  });

  // Wait for transaction to be mined:
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt not found!');
  }

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber
  };
}

/**
 * Update reputation on the Reputation contract:
 * @param config - Blockchain configuration.
 * @param sellerAddress - Address of the seller whose reputation to update.
 * @param requestAddress - Address of the Request contract (used as justification).
 * @param delta - Reputation change (positive for award, negative for penalize).
 * @returns Transaction hash and block number.
 */
export async function updateReputation(
  config: BlockchainConfig,
  sellerAddress: string,
  requestAddress: string,
  delta: number
): Promise<{ transactionHash: string; blockNumber: number }> {
  const provider = createProvider(config.rpcUrl);
  const wallet = createWallet(config.privateKey, provider);

  // Create contract instance at the Reputation contract address:
  const contract = new ethers.Contract(config.reputationAddress, ReputationArtifact.abi, wallet);

  // Call award or penalize based on delta sign:
  let tx;
  if (delta >= 0) {
    // Positive delta – award reputation:
    tx = await contract.award(sellerAddress, requestAddress, Math.abs(delta));
  } else {
    // Negative delta – penalize reputation:
    tx = await contract.penalize(sellerAddress, requestAddress, Math.abs(delta));
  }

  const receipt = await tx.wait();

  return {
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber
  };
}

/**
 * Get reputation score from the Reputation contract:
 * @param config - Blockchain configuration.
 * @param address - Address to check reputation for.
 * @returns Reputation score as a number.
 */
export async function getReputation(
  config: BlockchainConfig,
  address: string
): Promise<number> {
  const provider = createProvider(config.rpcUrl);

  // Create contract instance at the Reputation contract address:
  const contract = new ethers.Contract(config.reputationAddress, ReputationArtifact.abi, provider);

  // Call reputationOf (view function, doesn't need wallet):
  const reputation = await contract.reputationOf(address);

  // Convert BigInt to number:
  return Number(reputation);
}

/**
 * Select executor using epsilon-greedy algorithm based on reputation scores:
 * @param config - Blockchain configuration.
 * @param sellerAccountIndices - Array of account indices to consider (e.g., [1, 2]).
 * @param epsilon - Probability of random selection (default 0.1 = 10% random, 90% top seller by reputation).
 * @returns Selected executor's account index and address.
 */
export async function selectExecutorEpsilonGreedy(
  config: BlockchainConfig,
  sellerAccountIndices: number[],
  epsilon: number = 0.1
): Promise<{ accountIndex: number; address: string; reputation: number }> {
  if (sellerAccountIndices.length === 0) {
    throw new Error('No sellers available for assignment!');
  }

  // Get all accounts to map indices to addresses:
  const accounts = await getHardhatAccounts(config.rpcUrl);

  // Query reputation for each seller:
  const sellersWithReputation = await Promise.all(
    sellerAccountIndices.map(async (index) => {
      const account = accounts[index];
      const reputation = await getReputation(config, account.address);
      return {
        accountIndex: index,
        address: account.address,
        reputation
      };
    })
  );

  // Epsilon-greedy selection:
  if (Math.random() < epsilon) {
    // Random selection:
    const randomIndex = Math.floor(Math.random() * sellersWithReputation.length);
    return sellersWithReputation[randomIndex];
  } else {
    // Select seller with highest reputation:
    return sellersWithReputation.reduce((best, current) =>
      current.reputation > best.reputation ? current : best
    );
  }
}
