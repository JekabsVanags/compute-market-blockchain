/** ./SERVER/src/create-task.ts
 * TASK CREATOR SCRIPT
 *
 * Demonstrates how to deploy a new Request contract to the local blockchain (fake ETH, free, unlimited, offline, instant).
 * Each Request contract is new computing task in the marketplace.
 *
 * 1. Connects to the local Hardhat blockchain (when it is running).
 * 2. Creates a wallet using a Hardhat default test account (pre-funded with 10,000 fake ETH).
 * 3. Deploys a new instance of the Request.sol smart contract.
 * 4. Prints the address of the newly deployed contract.
 */

import * as dotenv from 'dotenv';
// Main library for interacting with Ethereum (connect to the blockchain, create wallets, deploy contracts):
import { ethers } from 'ethers';
// The compiled contract:
import RequestArtifact from '../../BLOCKCHAIN/artifacts/contracts/Request.sol/Request.json';
dotenv.config();

// Main function that orchestrates the contract deployment (blockchain operations are asynchronous):
async function createTask() {
  console.log('Starting task creation...\n');

  // The local Hardhat node runs at this address by default:
  const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';

  // Hardhat provides 20 test accounts, each with 10,000 ETH.
  // The first account's private key is the same on every Hardhat node:
  // Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
  const DEFAULT_HARDHAT_PRIVATE_KEY = process.env.PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  const ROLES_CONTRACT_ADDRESS = process.env.ROLES_CONTRACT_ADDRESS;
  const REPUTATION_CONTRACT_ADDRESS = process.env.REPUTATION_CONTRACT_ADDRESS;
  const COMMAND_HASH = process.env.COMMAND_HASH ||
    '0x1234567890123456789012345678901234567890123456789012345678901234';

  // Validate that contract addresses are set:
  if (!ROLES_CONTRACT_ADDRESS || !REPUTATION_CONTRACT_ADDRESS) {
    console.error('ERROR: Missing contract addresses in .env file!');

    console.error('Have you deployed the core contracts yet?');
    console.error('   Run this first in the BLOCKCHAIN folder:');
    console.error('   npx hardhat run scripts/deploy-core-contracts.ts --network localhost');
    console.error('\n   Then copy the addresses to the `./SERVER/.env` file.\n');
    process.exit(1);
  }

  console.log('Configuration loaded:');
  console.log(`   - Connecting to: ${LOCAL_RPC_URL}`);
  console.log(`   - Roles contract: ${ROLES_CONTRACT_ADDRESS}`);
  console.log(`   - Reputation contract: ${REPUTATION_CONTRACT_ADDRESS}`);
  console.log(`   - Command hash: ${COMMAND_HASH}\n`);

  /**
   * Create a provider – connects to a node on the blockchain via HTTP (allows reading data and broadcasting transactions):
   *
   * For local development, the provider connects to the Hardhat node running on `localhost:8545`.
   */
  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);

  console.log('Connecting to the local Hardhat network...');

  // Verify the connection works:
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`   - Connected to network – chain ID: ${network.chainId}`);
    console.log(`   - Current block number: ${blockNumber}\n`);
  } catch (error) {
    console.error('ERROR: Failed to connect to local Hardhat node!');
    console.error('📌 Make sure the Hardhat node is running:');
    console.error('   1. Open a new terminal.');
    console.error('   2. Navigate to the BLOCKCHAIN folder: cd BLOCKCHAIN');
    console.error('   3. Start the node: npx hardhat node');
    console.error('   4. Leave it running and come back to this terminal.\n');
    console.error('Error details:', error);
    process.exit(1);
  }

  /**
   * Create a wallet (signer) – an object that can sign transactions using a private key:
   * Connect the wallet to the provider to allow the wallet to create and broadcast signed transactions.
   * 
   * For local development, use Hardhat's default test accounts.
   */
  const wallet = new ethers.Wallet(DEFAULT_HARDHAT_PRIVATE_KEY, provider);

  console.log('Wallet created from Hardhat test account:');
  console.log(`   - Wallet address: ${wallet.address}`);

  // Check the wallet's balance:
  const balance = await provider.getBalance(wallet.address);
  const balanceInEth = ethers.formatEther(balance);
  console.log(`   - Wallet balance: ${balanceInEth} ETH (fake testnet ETH)`);
  console.log('');

  // Create a contract factory – a template for deploying new instances of a smart contract:
  const contractFactory = new ethers.ContractFactory(
    RequestArtifact.abi,      // Application Binary Interface defines how to interact with the smart contract.
    RequestArtifact.bytecode, // The actual compiled code that runs on the Ethereum Virtual Machine (EVM).
    wallet                    // Signs and pays for the contract deployment transaction (costs gas fees, even local fake ones).
  );

  console.log('Contract factory created');
  console.log(`   - Contract name: Request`);
  console.log(`   - ABI loaded: ${RequestArtifact.abi.length} methods/events`);
  console.log(`   - Bytecode size: ${RequestArtifact.bytecode.length / 2 - 1} bytes\n`);

  /**
   * Deploy the contract with constructor parameters:
   *
   * 1. Creates a transaction that includes the contract's bytecode.
   * 2. Adds the constructor parameters to the transaction.
   * 3. Signs the transaction with the wallet's private key.
   * 4. Broadcasts the transaction to the blockchain (the local Hardhat node).
   * 5. Returns a Contract instance that represents the deployment.
   *
   * Three constructor parameters for the Request contract:
   * 1. calculatedCommandHash (bytes32) - a hash representing the computation to be performed.
   * 2. rolesAddress (address) - address of the Roles contract for access control.
   * 3. reputationAddress (address) - address of the Reputation contract for scoring.
   *
   * (On the local blockchain, deployment is almost instant (milliseconds) because Hardhat auto-mines blocks immediately.)
   */

  console.log('Deploying Request contract to local blockchain...');
  console.log('   (This should be instant on the local Hardhat.)\n');

  try {
    // Deploy the contract with constructor parameters:
    const contract = await contractFactory.deploy(
      COMMAND_HASH,                  // bytes32 calculatedCommandHash
      ROLES_CONTRACT_ADDRESS,        // address rolesAddress
      REPUTATION_CONTRACT_ADDRESS    // address reputationAddress
    );

    console.log('Deployment transaction sent!');
    console.log(`   - Transaction hash: ${contract.deploymentTransaction()?.hash}`);
    console.log('   - Waiting for mining...\n');

    /**
     * waitForDeployment() waits until the transaction is mined (since after deploy(), the transaction is broadcast to the network but not yet mined):
     * 1. A miner includes our transaction in a block.
     * 2. That block is added to the blockchain.
     * 3. The contract is officially deployed and has an address.
     *
     * (Until the transaction is mined, the contract doesn't have an address yet and we can't interact with it.)
     * (On the local Hardhat, this happens almost instantly because Hardhat auto-mines blocks by default.)
     */
    await contract.waitForDeployment();

    // Get the deployed contract's address:
    const contractAddress = await contract.getAddress();

    console.log('Contract deployed successfully!');
    console.log(`Contract address: ${contractAddress}`);
    console.log(`Deployed on the local Hardhat network.`);

    // Verify the deployment by reading some data from the newly deployed contract (view functions don't cost gas):
    console.log('Verifying contract deployment...');

    // Read the owner of the contract (should be the wallet address that deployed it):
    const owner = await (contract as any).owner();
    console.log(`   - Contract owner: ${owner}`);
    console.log(`   - Expected owner: ${wallet.address}`);
    console.log(`   - Owner match: ${owner.toLowerCase() === wallet.address.toLowerCase() ? '✅' : '❌'}`);

    // Read the commandHash that was set in the constructor:
    const storedCommandHash = await (contract as any).commandHash();
    console.log(`   - Stored command hash: ${storedCommandHash}`);
    console.log(`   - Expected command hash: ${COMMAND_HASH}`);
    console.log(`   - Hash match: ${storedCommandHash === COMMAND_HASH ? '✅' : '❌'}`);

    // Read the current state (should be "Waiting" which is state 0):
    const currentState = await (contract as any).currentState();
    console.log(`   - Current state: ${currentState} (0 = Waiting for executor)\n`);

    console.log('Task creation complete! The Request contract is ready to use.');
    console.log('\n(You can create as many tasks as you want - they\'re free on the local blockchain!)');

  } catch (error: any) {
    console.error('ERROR during deployment:');
    console.error(error.message);

    // Provide helpful error messages for common issues:
    if (error.message.includes('invalid address')) {
      console.error('\nCheck that your contract addresses in `.env` are valid.');
      console.error('   They should start with 0x and be 42 characters long.');
    } else if (error.message.includes('reverted')) {
      console.error('\nThe contract constructor reverted. This usually means:');
      console.error('   - The Roles/Reputation addresses are incorrect?');
      console.error('   - The deployer doesn\'t have the BUYER role?');
      console.error('   Try redeploying the core contracts first.');
    }

    process.exit(1);
  }
}

// Run the main function (createTask) to create a new task (Request contract):
createTask()
  .then(() => {
    console.log('\nScript completed successfully!');
    console.log('Run this script again to create another task (Request contract).\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
