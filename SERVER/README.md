# Local blockchain setup:

Run a local Ethereum blockchain on your computer to develop and test the compute marketplace (fake ETH, free, unlimited, offline, instant, replicable).

## Prerequisites

Only **Node.js** (version 18+) is required:
- Check: `node --version`
- Download: https://nodejs.org/

## Setup (4 steps):

### 1. Install dependencies:

```bash
cd SERVER
npm install
```

Expected output example:
```
up to date, audited 31 packages in 428ms
found 0 vulnerabilities
```

### 2. Start local blockchain:

Open a new terminal window:

```bash
cd BLOCKCHAIN
npx hardhat node
```

Expected output example:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0:  0xf3...2266 (10000 ETH)
Private Key: 0xac...ff80
...
```

**Leave this terminal running.**

### 3. Deploy core contracts:

Open another terminal window:

```bash
cd BLOCKCHAIN
npx hardhat run scripts/deploy-core-contracts.ts --network localhost
```

Expected output example:
```
Deploying core contracts to local Hardhat network...

Deploying with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Account balance: 10000.0 ETH

Deploying Roles contract...
Roles deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Granting BUYER_ROLE to deployer...
BUYER_ROLE granted to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Deploying Reputation contract...
Reputation deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

Core contracts deployed!

COPY THESE ADDRESSES TO YOUR `./SERVER/.env` FILE:

ROLES_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REPUTATION_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

```

**Copy the two addresses to the environment variables.**

### 4. Configure server:

In the SERVER folder:

```bash
cd SERVER
cp .env.example .env
```

Edit `.env` and paste the addresses:
```
ROLES_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REPUTATION_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

## Using the server:

### Option A – REST API (for frontend integration):

Start the server:
```bash
cd SERVER
npm start
```

Expected output example:
```
Server running on http://localhost:3000
Endpoints:
  GET  /health - Check server and blockchain status.
  POST /tasks  - Create new task (deploy Request contract).
```

#### API Endpoints:

**GET /health** - Check server status:
```bash
curl http://localhost:3000/health
```

Expected response example:
```json
{
  "status": "ok",
  "blockchain": {
    "connected": true,
    "chainId": "31337",
    "blockNumber": 3
  }
}
```

**POST /tasks** - Create new task (deploy Request contract):
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"commandHash": "0x1234567890123456789012345678901234567890123456789012345678901234"}'
```

Expected response example:
```json
{
  "success": true,
  "task": {
    "address": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "transactionHash": "0xa76872e305d5ca54efaa8ee33dd8a118beecc601adc4c2199a1cf0d3998c4d72",
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "commandHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "blockNumber": 4
  }
}
```

### Option B: CLI script (leaving initial approach, perhaps for testing):

```bash
cd SERVER
npx ts-node src/create-task.ts
```

Expected output example:
```
Starting task creation...

Configuration loaded:
   - Connecting to: http://127.0.0.1:8545
   - Roles contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   - Reputation contract: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
   - Command hash: 0x1234567890123456789012345678901234567890123456789012345678901234

Connecting to the local Hardhat network...
   - Connected to network – chain ID: 31337
   - Current block number: 3

Wallet created from Hardhat test account:
   - Wallet address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   - Wallet balance: 9999.998273484783778955 ETH (fake testnet ETH)

Contract factory created:
   - Contract name: Request
   - ABI loaded: 23 methods/events
   - Bytecode size: 8179 bytes

Deploying Request contract to local blockchain...

Deployment transaction sent!
   - Transaction hash: 0x2a84bc8dc35119acc99e74f15d8cc3071121dcaa042662a4dccb94d569145319
   - Waiting for mining...

Contract deployed successfully!
Contract address: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
Deployed on the local Hardhat network.

Verifying contract deployment...
   - Contract owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   - Expected owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   - Owner match: ✅
   - Stored command hash: 0x1234567890123456789012345678901234567890123456789012345678901234
   - Expected command hash: 0x1234567890123456789012345678901234567890123456789012345678901234
   - Hash match: ✅
   - Current state: 0 (0 = Waiting for executor)

Task creation complete! The Request contract is ready to use.

(You can create as many tasks as you want - they\'re free on the local blockchain!)

Script completed successfully!
Run this script again to create another task (Request contract).

```

## Project structure:

```
compute-market-blockchain/
├── BLOCKCHAIN/
│   ├── contracts/                      # Solidity smart contracts.
│   ├── scripts/
│   │   └── deploy-core-contracts.ts    # Deploys Roles & Reputation.
│   └── hardhat.config.ts
│
└── SERVER/
    ├── src/
    │   └── create-task.ts              # Deploy Request contracts.
    ├── .env                            # Your configuration (git-ignored).
    └── .env.example                    # Template.
```

## Basic commands:

Start blockchain (leave running):
```bash
cd BLOCKCHAIN
npx hardhat node
```

Deploy core contracts (after starting blockchain):
```bash
cd BLOCKCHAIN
npx hardhat run scripts/deploy-core-contracts.ts --network localhost
```

Start REST API server (for frontend):
```bash
cd SERVER
npm start
```

Or create a task via CLI (for misc testing):
```bash
cd SERVER
npm run create-task
```

# Replication:

1. Clone the repository.
2. Follow the 4 setup steps above.
3. Run your own local blockchain.

Each person has their own isolated blockchain. Contract addresses will differ between project members (this is normal).

**Note:** When restarting the Hardhat node (Ctrl+C and restart), you must:
1. Re-deploy core contracts (step 3).
2. Update addresses in `.env` (step 4).

The local blockchain resets when you restart it.

## Workflow summary:

```bash
# Terminal 1 – start blockchain (leave running):
cd BLOCKCHAIN
npx hardhat node

# Terminal 2 – deploy core contracts (once per blockchain restart):
cd BLOCKCHAIN
npx hardhat run scripts/deploy-core-contracts.ts --network localhost
# Copy the addresses for environment variables.

# Terminal 2 – configure server:
cd SERVER
cp .env.example .env
# Edit .env and paste addresses.

# Terminal 2 – option A to start REST API server (for frontend):
cd SERVER
npm start
# Server runs on: http://localhost:3000
# Test with: curl http://localhost:3000/health

# Terminal 2 – option B with CLI script (for misc testing):
cd SERVER
npm run create-task
```