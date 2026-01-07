# Local blockchain setup:

Run a local Ethereum blockchain on your computer to develop and test the compute marketplace (fake ETH, free, unlimited, offline, instant, replicable).

## Prerequisites

Only **Node.js** (version 18+) is required:
- Check: `node --version`
- Download: https://nodejs.org/

## Setup (4 steps):

### 1. Install dependencies:

```bash
cd BLOCKCHAIN
npm install
```

Expected output example:
```
up to date, audited 302 packages in 1s

71 packages are looking for funding
  run `npm fund` for details

2 vulnerabilities (1 moderate, 1 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

Note: The security vulnerabilities would be development dependencies without affecting the local blockchain functionality.

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

WARNING: Funds sent on live network to accounts with publicly known private keys WILL BE LOST.

Account #0:  0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1:  0x70997970c51812dc3a010c7d01b50e0d17dc79c8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2:  0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc (10000 ETH)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

... (17 more accounts)

Account #19: 0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199 (10000 ETH)
Private Key: 0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e

WARNING: Funds sent on live network to accounts with publicly known private keys WILL BE LOST.
```

**Leave this terminal running.** The blockchain will log all transactions here.

### 3. Deploy core contracts:

Open another terminal window:

```bash
cd BLOCKCHAIN
npx hardhat run scripts/deploy-core-contracts.ts --network localhost
```

Expected output example:
```
Nothing to compile
Nothing to compile

Deploying core contracts to local Hardhat network...

Deploying with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Account balance: 10000.0 ETH

Deploying Roles contract...
Roles deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Granting BUYER_ROLE to deployer...
BUYER_ROLE granted to: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Deploying Reputation contract...
   (depends on Roles at 0x5FbDB2315678afecb367f032d93F642f64180aa3 )
Reputation deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

Deploying AuditTaxRepository contract...
AuditTaxRepository deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

Core contracts deployed!

COPY THESE ADDRESSES TO `./SERVER/.env` FILE:

ROLES_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REPUTATION_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
AUDIT_TAX_REPOSITORY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

**Copy the three addresses to the environment variables.**

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
AUDIT_TAX_REPOSITORY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
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
  GET  /accounts - Get all Hardhat test accounts.
  POST /tasks - Create new task (deploy Request contract).
  GET  /tasks - List all tasks.
  GET  /tasks/:address - Get specific task details.
  POST /tasks/:address/complete - Seller completes task.
  POST /tasks/:address/finalize - Buyer finalizes and pays.
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

**GET /accounts** - get all Hardhat test accounts with balances:
```bash
curl http://localhost:3000/accounts | jq '.accounts[0:3]'
```

Expected response example (showing first 3 accounts):
```json
[
  {
    "index": 0,
    "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "balance": "9999.997749360343944429"
  },
  {
    "index": 1,
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "balance": "10000.0"
  },
  {
    "index": 2,
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "balance": "10000.0"
  }
]
```

Note: Account #0 has slightly less than 10000 ETH because it was used to deploy the core contracts (gas fees).

**POST /tasks** - create new compute task (buyer deploys Request contract with payment):
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "import numpy as np\nresult = np.array([1,2,3]).sum()\nprint(result)",
    "price": "0.5",
    "accountIndex": 0
  }'
```

Parameters:
- `code`: Python code to execute
- `price`: Payment amount in ETH (e.g., "0.5")
- `accountIndex`: Buyer's account index (0-19), defaults to 0

Expected response example:
```json
{
  "success": true,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "transactionHash": "0x30da8bb0419379e8b1497cebf47e3f058932801d1059baad0fe2734c6a3ccc7a",
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "ownerAccountIndex": 0,
    "commandHash": "0x956719a7927115d7442f63c826b23fb3c0f9b9f7b6c25178217e0a794b5b4ba6",
    "price": "0.5",
    "status": "waiting",
    "blockNumber": 5,
    "createdAt": "2026-01-07T22:05:28.153Z"
  }
}
```

Save the task `address` - you'll need it for the next steps.

**GET /tasks** - list all tasks:
```bash
curl http://localhost:3000/tasks
```

Expected response example:
```json
{
  "tasks": [
    {
      "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "ownerAccountIndex": 0,
      "price": "0.5",
      "status": "waiting",
      "createdAt": "2026-01-07T22:05:28.153Z"
    }
  ],
  "count": 1
}
```

**GET /tasks/:address** - get specific task details:
```bash
curl http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
```

Expected response example:
```json
{
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "transactionHash": "0x30da8bb0419379e8b1497cebf47e3f058932801d1059baad0fe2734c6a3ccc7a",
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "ownerAccountIndex": 0,
    "code": "import numpy as np\nresult = np.array([1,2,3]).sum()\nprint(result)",
    "commandHash": "0x956719a7927115d7442f63c826b23fb3c0f9b9f7b6c25178217e0a794b5b4ba6",
    "price": "0.5",
    "status": "waiting",
    "blockNumber": 5,
    "createdAt": "2026-01-07T22:05:28.153Z"
  }
}
```

**POST /tasks/:address/complete** - seller completes task with result:
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": "6",
    "accountIndex": 1
  }'
```

Parameters:
- `result`: Computation result.
- `accountIndex`: Seller's account index (0-19).

Expected response example:
```json
{
  "success": true,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "completed",
    "executor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "executorAccountIndex": 1,
    "result": "6",
    "completedAt": "2026-01-07T22:06:01.639Z"
  }
}
```

**POST /tasks/:address/finalize** - buyer finalizes task and pays seller:
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/finalize \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response example:
```json
{
  "success": true,
  "paymentTransactionHash": "0xd296f8c152d262c36609ded2791b3b9a5afa99d65173f4bee55d55d393a8fb3a",
  "paymentBlockNumber": 6,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "finalized",
    "paymentTransactionHash": "0xd296f8c152d262c36609ded2791b3b9a5afa99d65173f4bee55d55d393a8fb3a",
    "finalizedAt": "2026-01-07T22:06:26.959Z"
  }
}
```

**Verify final task state** - check complete task details:
```bash
curl http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
```

Expected response example (full task with all lifecycle data):
```json
{
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "transactionHash": "0x30da8bb0419379e8b1497cebf47e3f058932801d1059baad0fe2734c6a3ccc7a",
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "ownerAccountIndex": 0,
    "code": "import numpy as np\nresult = np.array([1,2,3]).sum()\nprint(result)",
    "commandHash": "0x956719a7927115d7442f63c826b23fb3c0f9b9f7b6c25178217e0a794b5b4ba6",
    "price": "0.5",
    "status": "finalized",
    "blockNumber": 5,
    "createdAt": "2026-01-07T22:05:28.153Z",
    "executor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "executorAccountIndex": 1,
    "result": "6",
    "completedAt": "2026-01-07T22:06:01.639Z",
    "paymentTransactionHash": "0xd296f8c152d262c36609ded2791b3b9a5afa99d65173f4bee55d55d393a8fb3a",
    "finalizedAt": "2026-01-07T22:06:26.959Z"
  }
}
```

**Verify payment** - Check account balances after payment:
```bash
curl http://localhost:3000/accounts | jq '.accounts[0:2]'
```

Expected response example:
```json
[
  {
    "index": 0,
    "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "balance": "9998.939100848688237724"
  },
  {
    "index": 1,
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "balance": "10000.5"
  }
]
```

Note: Account #0 (buyer) spent ~1.06 ETH total (0.5555 ETH for task, plus gas fees). Account #1 (seller) received exactly 0.5 ETH payment.

#### Task lifecycle:

1. **waiting**: Buyer creates task with POST /tasks (deploys Request contract with ETH payment).
2. **completed**: Seller completes task with POST /tasks/:address/complete (submits result).
3. **finalized**: Buyer finalizes task with POST /tasks/:address/finalize (ETH sent to seller).

#### Quick test sequence:

To test the complete workflow, run these commands in order (replace `ADDRESS` with your task address from step 2):

```bash
# 1. Health check:
curl http://localhost:3000/health

# 2. Create task (save the returned address):
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "import numpy as np\nresult = np.array([1,2,3]).sum()\nprint(result)", "price": "0.5", "accountIndex": 0}'

# 3. Complete task (replace ADDRESS):
curl -X POST http://localhost:3000/tasks/ADDRESS/complete \
  -H "Content-Type: application/json" \
  -d '{"result": "6", "accountIndex": 1}'

# 4. Finalize task (replace ADDRESS):
curl -X POST http://localhost:3000/tasks/ADDRESS/finalize \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. Verify payment:
curl http://localhost:3000/accounts | jq '.accounts[0:2]'
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