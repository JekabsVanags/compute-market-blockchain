/** ./SERVER/src/server.ts
 * REST API SERVER
 *
 * HTTP server that provides REST endpoints for blockchain interactions.
 * The frontend calls these endpoints instead of interacting with the blockchain directly.
 *
 * Endpoints:
 *   GET  /health - Check server and blockchain connection status.
 *   POST /tasks  - Create new compute task (deploy Request contract).
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { deployRequestContract, checkConnection, BlockchainConfig } from './blockchain-service';

// Load environment variables from .env file:
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (runs before each request):
app.use(cors());             // Allow frontend to call API from different origin.
app.use(express.json());     // Parse JSON request bodies.

// Loads blockchain configuration from environment variables:
// Uses Hardhat defaults if not specified (for local development).
const getBlockchainConfig = (): BlockchainConfig => {
  const rpcUrl = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';
  // Hard-coded default Hardhat Account #0 private key (10,000 fake ETH):
  const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const rolesAddress = process.env.ROLES_CONTRACT_ADDRESS;
  const reputationAddress = process.env.REPUTATION_CONTRACT_ADDRESS;

  if (!rolesAddress || !reputationAddress) {
    throw new Error('Missing contract addresses in environment variables!');
  }

  return { rpcUrl, privateKey, rolesAddress, reputationAddress };
};

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
          blockNumber: status.blockNumber       // Number of blocks mined
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

// POST /tasks - Create new compute task endpoint:
// Deploys a new Request contract to represent a compute task.
// Request body: { "commandHash": "0x1234..." }
// Response: { "success": true, "task": { "address": "0x...", ... } }
app.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { commandHash } = req.body;

    // Validate required field:
    if (!commandHash) {
      return res.status(400).json({
        error: 'Missing required field: commandHash'
      });
    }

    // Validate commandHash format (must be bytes32, thus 0x + 64 hex characters):
    // Example valid hash: 0x1234567890123456789012345678901234567890123456789012345678901234
    if (!/^0x[0-9a-fA-F]{64}$/.test(commandHash)) {
      return res.status(400).json({
        error: 'Invalid commandHash format (must be bytes32 – 0x followed by 64 hex characters)!'
      });
    }

    // Get blockchain configuration and deploy the contract:
    const config = getBlockchainConfig();
    const result = await deployRequestContract(config, commandHash);

    // Return the deployed contract information:
    res.status(201).json({
      success: true,
      task: {
        address: result.address,                    // Where the contract lives on the blockchain.
        transactionHash: result.transactionHash,    // The transaction that created it.
        owner: result.owner,                        // Who deployed it (buyer).
        commandHash: result.commandHash,            // The compute task identifier.
        blockNumber: result.blockNumber             // Block where it was deployed.
      }
    });
  } catch (error: any) {
    console.error('Error deploying contract:', error);

    // Deployment failed (e.g., blockchain might not be running, or missing BUYER_ROLE):
    res.status(500).json({
      error: 'Failed to deploy contract!',
      details: error.message
    });
  }
});

// Start the Express server:
// Once running, thefrontend can call the API endpoints.
app.listen(PORT, () => {
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health - Check server and blockchain status.`);
  console.log(`  POST /tasks  - Create new task (deploy Request contract).`);
});
