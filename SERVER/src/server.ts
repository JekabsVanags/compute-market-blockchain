/** ./SERVER/src/server.ts
 * REST API SERVER
 *
 * HTTP server that provides REST endpoints for blockchain interactions.
 * The frontend calls these endpoints instead of interacting with the blockchain directly.
 *
 * Endpoints:
 *   GET  /health - Check server and blockchain connection status.
 *   GET  /accounts - Get all Hardhat test accounts.
 *   POST /tasks - Create new compute task (deploy Request contract).
 *   GET  /tasks - List all tasks.
 *   GET  /tasks/:address - Get specific task details.
 *   POST /tasks/:address/complete - Seller completes task with result.
 *   POST /tasks/:address/finalize - Buyer finalizes task and pays seller.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import {
  deployRequestContract,
  checkConnection,
  getHardhatAccounts,
  sendPayment,
  BlockchainConfig
} from './blockchain-service';

// Load environment variables from .env file:
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (runs before each request):
app.use(cors());             // Allow frontend to call API from different origin.
app.use(express.json());     // Parse JSON request bodies.

// In-memory task storage:
// Task lifecycle: waiting → completed → finalized
interface Task {
  address: string;                  // Contract address on blockchain.
  transactionHash: string;          // Deployment transaction hash.
  owner: string;                    // Buyer's wallet address.
  ownerAccountIndex: number;        // Buyer's account index (0-19).
  code: string;                     // Python code to execute.
  commandHash: string;              // Hash of the code (stored on-chain).
  price: string;                    // Payment amount in ETH.
  status: 'waiting' | 'completed' | 'finalized';
  executor?: string;                // Seller's wallet address (set when completed).
  executorAccountIndex?: number;    // Seller's account index (set when completed).
  result?: string;                  // Computation result (set when completed).
  paymentTransactionHash?: string;  // Payment transaction hash (set when finalized).
  blockNumber: number;              // Block where contract was deployed.
  createdAt: string;                // ISO timestamp when task was created.
  completedAt?: string;             // ISO timestamp when seller completed task.
  finalizedAt?: string;             // ISO timestamp when buyer finalized task.
}

const tasks = new Map<string, Task>();  // Key: contract address, Value: Task

// Hardhat private keys array (for account index lookup):
const HARDHAT_PRIVATE_KEYS = [
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

// Loads blockchain configuration from environment variables:
// Uses Hardhat defaults if not specified (for local development).
const getBlockchainConfig = (accountIndex: number = 0): BlockchainConfig => {
  const rpcUrl = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';

  // Validate account index:
  if (accountIndex < 0 || accountIndex >= HARDHAT_PRIVATE_KEYS.length) {
    throw new Error(`Invalid account index: ${accountIndex} (must be 0-19)!`);
  }

  const privateKey = HARDHAT_PRIVATE_KEYS[accountIndex];
  const rolesAddress = process.env.ROLES_CONTRACT_ADDRESS;
  const reputationAddress = process.env.REPUTATION_CONTRACT_ADDRESS;
  const auditTaxRepositoryAddress = process.env.AUDIT_TAX_REPOSITORY_ADDRESS;

  if (!rolesAddress || !reputationAddress || !auditTaxRepositoryAddress) {
    throw new Error('Missing contract addresses in environment variables!');
  }

  return { rpcUrl, privateKey, rolesAddress, reputationAddress, auditTaxRepositoryAddress };
};

// Helper function to hash Python code into commandHash (bytes32):
function hashCode(code: string): string {
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return '0x' + hash;
}

// GET /health - Health check endpoint:
// Returns server status and blockchain connection information.
// Frontend can call this to verify everything is working before creating tasks.
app.get('/health', async (req: Request, res: Response) => {
  try {
    const config = getBlockchainConfig();
    // Try to connect to blockchain:
    const status = await checkConnection(config.rpcUrl);

    if (status.connected) {
      // Success - blockchain is reachable:
      res.json({
        status: 'ok',
        blockchain: {
          connected: true,
          chainId: status.chainId?.toString(),  // 31337 for the Hardhat local network.
          blockNumber: status.blockNumber       // Number of blocks mined.
        }
      });
    } else {
      // Blockchain node not responding (e.g., blockchain might not be running):
      res.status(503).json({
        status: 'error',
        message: 'Cannot connect to blockchain',
        blockchain: { connected: false }
      });
    }
  } catch (error: any) {
    // Unexpected error:
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// GET /accounts - Get all Hardhat test accounts:
// Returns the 20 pre-funded Hardhat accounts with balances.
// Frontend can display these for demo account selection.
app.get('/accounts', async (req: Request, res: Response) => {
  try {
    const config = getBlockchainConfig();
    const accounts = await getHardhatAccounts(config.rpcUrl);

    res.json({ accounts });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);

    res.status(500).json({
      error: 'Failed to fetch accounts',
      details: error.message
    });
  }
});

// POST /tasks - Create new compute task endpoint:
// Deploys a new Request contract to represent a compute task.
// Request body: { "code": "import numpy...", "price": "0.1", "accountIndex": 0 }
// Response: { "success": true, "task": { ... } }
app.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { code, price, accountIndex } = req.body;

    // Validate required fields:
    if (!code || !price) {
      return res.status(400).json({
        error: 'Missing required fields: code, price'
      });
    }

    // Validate account index (default to 0 if not provided):
    const buyerAccountIndex = accountIndex !== undefined ? accountIndex : 0;
    if (buyerAccountIndex < 0 || buyerAccountIndex >= 20) {
      return res.status(400).json({
        error: 'Invalid accountIndex (must be 0-19)!'
      });
    }

    // Hash the code to generate commandHash:
    const commandHash = hashCode(code);

    // Get blockchain configuration for specified account:
    const config = getBlockchainConfig(buyerAccountIndex);
    const result = await deployRequestContract(config, commandHash, price);

    // Store task in memory:
    const task: Task = {
      address: result.address,
      transactionHash: result.transactionHash,
      owner: result.owner,
      ownerAccountIndex: buyerAccountIndex,
      code,
      commandHash,
      price,
      status: 'waiting',
      blockNumber: result.blockNumber,
      createdAt: new Date().toISOString()
    };

    tasks.set(result.address, task);

    // Return the created task:
    res.status(201).json({
      success: true,
      task: {
        address: task.address,
        transactionHash: task.transactionHash,
        owner: task.owner,
        ownerAccountIndex: task.ownerAccountIndex,
        commandHash: task.commandHash,
        price: task.price,
        status: task.status,
        blockNumber: task.blockNumber,
        createdAt: task.createdAt
      }
    });
  } catch (error: any) {
    console.error('Error creating task:', error);

    res.status(500).json({
      error: 'Failed to create task!',
      details: error.message
    });
  }
});

// GET /tasks - List all tasks:
// Returns all tasks with their current status.
app.get('/tasks', async (req: Request, res: Response) => {
  try {
    const allTasks = Array.from(tasks.values()).map(task => ({
      address: task.address,
      owner: task.owner,
      ownerAccountIndex: task.ownerAccountIndex,
      price: task.price,
      status: task.status,
      executor: task.executor,
      executorAccountIndex: task.executorAccountIndex,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      finalizedAt: task.finalizedAt
    }));

    res.json({ tasks: allTasks, count: allTasks.length });
  } catch (error: any) {
    console.error('Error listing tasks:', error);

    res.status(500).json({
      error: 'Failed to list tasks!',
      details: error.message
    });
  }
});

// GET /tasks/:address - Get specific task details:
// Returns full details of a single task including code and result.
app.get('/tasks/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const task = tasks.get(address);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found!'
      });
    }

    res.json({ task });
  } catch (error: any) {
    console.error('Error fetching task:', error);

    res.status(500).json({
      error: 'Failed to fetch task!',
      details: error.message
    });
  }
});

// POST /tasks/:address/complete - Seller completes task:
// Seller submits the computation result.
// Request body: { "result": "...", "accountIndex": 1 }
// Response: { "success": true, "task": { ... } }
app.post('/tasks/:address/complete', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { result, accountIndex } = req.body;

    // Validate required fields:
    if (!result) {
      return res.status(400).json({
        error: 'Missing required field: result'
      });
    }

    // Validate account index:
    const sellerAccountIndex = accountIndex !== undefined ? accountIndex : 1;
    if (sellerAccountIndex < 0 || sellerAccountIndex >= 20) {
      return res.status(400).json({
        error: 'Invalid accountIndex (must be 0-19)!'
      });
    }

    // Find task:
    const task = tasks.get(address);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found!'
      });
    }

    // Validate status:
    if (task.status !== 'waiting') {
      return res.status(400).json({
        error: `Task cannot be completed (current status: ${task.status})`
      });
    }

    // Get seller's wallet address from account index:
    const config = getBlockchainConfig(sellerAccountIndex);
    const sellerAddress = (await getHardhatAccounts(config.rpcUrl))[sellerAccountIndex].address;

    // Update task:
    task.status = 'completed';
    task.executor = sellerAddress;
    task.executorAccountIndex = sellerAccountIndex;
    task.result = result;
    task.completedAt = new Date().toISOString();

    res.json({
      success: true,
      task: {
        address: task.address,
        status: task.status,
        executor: task.executor,
        executorAccountIndex: task.executorAccountIndex,
        result: task.result,
        completedAt: task.completedAt
      }
    });
  } catch (error: any) {
    console.error('Error completing task:', error);

    res.status(500).json({
      error: 'Failed to complete task!',
      details: error.message
    });
  }
});

// POST /tasks/:address/finalize - Buyer finalizes task and pays seller:
// Buyer accepts the result and triggers ETH payment to seller.
// Request body: {} (uses task owner's account)
// Response: { "success": true, "paymentTransactionHash": "0x...", "task": { ... } }
app.post('/tasks/:address/finalize', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Find task:
    const task = tasks.get(address);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found!'
      });
    }

    // Validate status:
    if (task.status !== 'completed') {
      return res.status(400).json({
        error: `Task cannot be finalized (current status: ${task.status})`
      });
    }

    if (!task.executor) {
      return res.status(400).json({
        error: 'Task has no executor assigned!'
      });
    }

    // Send payment from buyer to seller:
    const config = getBlockchainConfig(task.ownerAccountIndex);
    const payment = await sendPayment(
      config.rpcUrl,
      task.ownerAccountIndex,
      task.executor,
      task.price
    );

    // Update task:
    task.status = 'finalized';
    task.paymentTransactionHash = payment.transactionHash;
    task.finalizedAt = new Date().toISOString();

    res.json({
      success: true,
      paymentTransactionHash: payment.transactionHash,
      paymentBlockNumber: payment.blockNumber,
      task: {
        address: task.address,
        status: task.status,
        paymentTransactionHash: task.paymentTransactionHash,
        finalizedAt: task.finalizedAt
      }
    });
  } catch (error: any) {
    console.error('Error finalizing task:', error);

    res.status(500).json({
      error: 'Failed to finalize task!',
      details: error.message
    });
  }
});

// Start the Express server:
// Once running, the frontend can call the API endpoints.
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health - Check server and blockchain status.`);
  console.log(`  GET  /accounts - Get all Hardhat test accounts.`);
  console.log(`  POST /tasks - Create new task (deploy Request contract).`);
  console.log(`  GET  /tasks - List all tasks.`);
  console.log(`  GET  /tasks/:address - Get specific task details.`);
  console.log(`  POST /tasks/:address/complete - Seller completes task.`);
  console.log(`  POST /tasks/:address/finalize - Buyer finalizes and pays.`);
});
