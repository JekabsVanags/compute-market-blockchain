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

Deploying AuditTaxRepository contract (starts with 10 ETH for auditor payments)...
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

## Automated unit tests:

The easiest way to test the system is with the automated test scripts:

```bash
cd SERVER

# Test 1 – full workflow with escrow validation:
./test-full-workflow.sh

# Test 2 – audit and reputation flow:
./test-audit-flow.sh

# Test 3 – reputation persistence (run after test 2):
./test-reputation-persistence.sh

# Test 4 – auto-assignment with epsilon-greedy:
./test-auto-assign.sh
```

These scripts automatically:
- Grant SELLER_ROLE to accounts 1 and 2.
- Execute the complete workflow.
- Validate balances and escrow payments.
- Verify reputation changes on blockchain.
- Confirm reputation persists (not lost on server restart).
- Test auto-assignment algorithm (epsilon-greedy with various ε values).

**Note:** These scripts require the blockchain and server to be running (see steps 1-4 above).

## Using the server:

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
  POST /tasks/:address/assign - Seller claims task.
  POST /tasks/:address/complete - Seller completes task.
  POST /tasks/:address/request-audit - Buyer requests audit.
  POST /tasks/:address/submit-audit-result - Auditor submits verification.
  POST /tasks/:address/finalize - Buyer finalizes and pays.
  GET  /reputation/:address - Get seller reputation score.
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
- `code`: Python code to execute (required).
- `price`: Payment amount in ETH (e.g., "0.5") (required).
- `accountIndex`: Buyer's account index (0-19), defaults to 0 (optional).

Optional computational requirements listed by buyer (all optional):
- `floatingPointStandard`: E.g., "IEEE 754" (optional).
- `processingPowerMHz`: Minimum processing power in MHz (optional).
- `memoryGB`: Minimum memory in GB (optional).
- `softwareDependencies`: Array of dependencies, e.g., ["pytorch", "numpy"] (optional).
- `deadline`: ISO timestamp deadline for completion (optional).

Example with requirements (high-tier GPU specs):
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "import torch\nprint(torch.cuda.is_available())",
    "price": "0.5",
    "accountIndex": 0,
    "floatingPointStandard": "IEEE 754",
    "processingPowerMHz": 2520,
    "memoryGB": 24,
    "softwareDependencies": ["pytorch", "numpy"],
    "deadline": "2026-01-20T00:00:00Z"
  }'
```

Expected response example (with computational requirements):
```json
{
  "success": true,
  "task": {
    "address": "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
    "transactionHash": "0x3e3d733655160242b56f600c3c6b0e916f3648b655882ae59ff991d239ce6c00",
    "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "ownerAccountIndex": 0,
    "commandHash": "0xd6a875024d716674524018e1020251484d1f7fb10e51b754f781423f8e74559a",
    "price": "0.5",
    "status": "waiting",
    "blockNumber": 11,
    "createdAt": "2026-01-17T18:35:36.296Z",
    "floatingPointStandard": "IEEE 754",
    "processingPowerMHz": 2520,
    "memoryGB": 24,
    "softwareDependencies": [
      "pytorch",
      "numpy"
    ],
    "deadline": "2026-01-20T00:00:00Z"
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

**POST /tasks/:address/assign** - seller claims task:
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/assign \
  -H "Content-Type: application/json" \
  -d '{
    "accountIndex": 1
  }'
```

Parameters:
- `accountIndex`: Seller's account index (0-19), defaults to 1.

Expected response example:
```json
{
  "success": true,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "waiting",
    "executor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "executorAccountIndex": 1
  }
}
```

**POST /tasks/:address/auto-assign** - automatically assign task based on reputation:
Uses epsilon-greedy algorithm to select seller – with probability ε (epsilon), selects random seller; with probability (1 - ε), selects seller with highest reputation.

```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/auto-assign \
  -H "Content-Type: application/json" \
  -d '{
    "epsilon": 0.1,
    "sellerAccountIndices": [1, 2]
  }'
```

Parameters (both optional):
- `epsilon`: Probability of random selection p in [0; 1]. Default: 0.1 (10% random seller, 90% top seller by reputation).
- `sellerAccountIndices`: Array of seller account indices to consider. Default: [1, 2].

Expected response example:
```json
{
  "success": true,
  "selectedSeller": {
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "accountIndex": 1,
    "reputation": 10,
    "selectionMethod": "highest_reputation"
  },
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "waiting",
    "executor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "executorAccountIndex": 1
  }
}
```

Note: The algorithm queries on-chain reputation scores for each seller and selects based on epsilon-greedy policy. This prevents reputation monopolies while still rewarding high-reputation sellers.

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
- `result`: Computation result (legacy format - simple string).
- `accountIndex`: Seller's account index (0-19).

**Alternative structured format** (for better frontend display):
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/complete \
  -H "Content-Type: application/json" \
  -d '{
    "stdout": "10",
    "stderr": "",
    "exitCode": 0,
    "zipData": "base64encodedzip...",
    "accountIndex": 1
  }'
```

Parameters (structured format):
- `stdout`: Standard output from execution.
- `stderr`: Standard error from execution.
- `exitCode`: Exit code (0 = success).
- `zipData`: Base64-encoded ZIP file of execution artifacts (optional).
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

**POST /tasks/:address/request-audit** - buyer requests audit for completed task:
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/request-audit \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Result looks incorrect."
  }'
```

Parameters:
- `reason`: Explanation why audit is needed.

Expected response example:
```json
{
  "success": true,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "audit_requested",
    "auditReason": "Result looks incorrect.",
    "auditRequestedAt": "2026-01-07T22:07:00.000Z"
  }
}
```

**POST /tasks/:address/submit-audit-result** - auditor verifies computation:
```bash
curl -X POST http://localhost:3000/tasks/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/submit-audit-result \
  -H "Content-Type: application/json" \
  -d '{
    "result": "6",
    "accountIndex": 2
  }'
```

Parameters:
- `result`: Auditor's computed result.
- `accountIndex`: Auditor's account index (0-19).

Expected response example (results match):
```json
{
  "success": true,
  "task": {
    "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "status": "audit_passed",
    "auditor": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "auditorAccountIndex": 2,
    "auditorResult": "6",
    "auditCompletedAt": "2026-01-07T22:08:00.000Z",
    "resultsMatch": true
  },
  "reputationChange": {
    "executor": 10,
    "auditor": 2
  }
}
```

Note: If results don't match, executor loses 10 reputation and task status becomes `audit_failed`.

**GET /reputation/:address** - get seller reputation score:
```bash
curl http://localhost:3000/reputation/0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

Expected response example:
```json
{
  "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "reputation": 10
}
```

Note: Reputation is stored on-chain in the Reputation.sol contract. Scores start at 0, increase by +10 for passing audits, decrease by -10 for failing audits. Auditors earn +2 for each audit performed.

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

Note: Account #0 (buyer) spent ~0.56 ETH total (0.5 ETH task payment locked in escrow + 0.0556 ETH audit tax + gas fees). Account #1 (seller) received exactly 0.5 ETH from escrow release.

#### Task lifecycle:

**Standard flow (no audit):**
1. **waiting**: Buyer creates task with POST /tasks (deploys Request contract with ETH locked in escrow).
2. **assigned** (optional): Seller claims task with POST /tasks/:address/assign (manual) OR POST /tasks/:address/auto-assign (automatic reputation-based) - calls contract.appointExecutor.
3. **completed**: Seller completes task with POST /tasks/:address/complete (calls contract.assignResult).
4. **finalized**: Buyer finalizes task with POST /tasks/:address/finalize (calls contract.completeRequest to release escrow to seller).

**Audit flow (buyer doesn't trust result):**
1. **waiting** → **assigned** → **completed**: Same as standard flow.
2. **audit_requested**: Buyer requests audit with POST /tasks/:address/request-audit (calls contract.requestAudit).
3. **audit_passed** or **audit_failed**: Auditor verifies with POST /tasks/:address/submit-audit-result (calls contract.appointAuditor, contract.assignAuditResult, and Reputation.award/penalize).
   - If results match: Executor gains +10 reputation (on-chain), auditor gains +2 (on-chain).
   - If results don't match: Executor loses -10 reputation (on-chain), auditor gains +2 (on-chain).
4. **finalized**: Buyer finalizes task (only if audit passed, releases escrow).

#### Quick test sequence (manual):

To test the complete workflow manually, run these commands in order:

```bash
# 0. Grant SELLER_ROLE to accounts 1 and 2 (required for assign/complete):
cd BLOCKCHAIN
npx hardhat run scripts/grant-seller-roles.ts --network localhost
cd ../SERVER

# 1. Health check:
curl http://localhost:3000/health

# 2. Create task (save the returned address):
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "print(5+5)", "price": "0.5", "accountIndex": 0}')
ADDRESS=$(echo $RESPONSE | jq -r '.task.address')
echo "Task address: $ADDRESS"

# 3. Assign task to seller:
curl -X POST http://localhost:3000/tasks/$ADDRESS/assign \
  -H "Content-Type: application/json" \
  -d '{"accountIndex": 1}'

# 4. Complete task:
curl -X POST http://localhost:3000/tasks/$ADDRESS/complete \
  -H "Content-Type: application/json" \
  -d '{"stdout": "10", "stderr": "", "exitCode": 0, "accountIndex": 1}'

# 5. Finalize task (releases escrow):
curl -X POST http://localhost:3000/tasks/$ADDRESS/finalize \
  -H "Content-Type: application/json" \
  -d '{}'

# 6. Verify escrow payment:
curl http://localhost:3000/accounts | jq '.accounts[0:2]'
# Buyer should have spent ~0.56 ETH, seller should have gained ~0.5 ETH.
```

**Or use the automated test scripts** (see their section above) for easier testing.

## Project structure:

```
compute-market-blockchain/
├── BLOCKCHAIN/
│   ├── contracts/                         # Solidity smart contracts.
│   │   ├── Request.sol                    # Individual task contract with escrow.
│   │   ├── Roles.sol                      # Role-based access control.
│   │   ├── Reputation.sol                 # On-chain reputation system.
│   │   └── AuditTaxRepository.sol         # Auditor payment pool.
│   ├── scripts/
│   │   ├── deploy-core-contracts.ts       # Deploys Roles, Reputation, AuditTaxRepository.
│   │   ├── grant-seller-roles.ts          # Grants SELLER_ROLE to accounts.
│   │   └── authorize-request.ts           # Authorizes Request contracts for audits.
│   └── hardhat.config.ts
│
└── SERVER/
    ├── src/
    │   ├── blockchain-service.ts          # Blockchain interaction functions.
    │   └── server.ts                      # REST API server.
    ├── test-full-workflow.sh              # Automated escrow test.
    ├── test-audit-flow.sh                 # Automated audit & reputation test.
    ├── test-reputation-persistence.sh     # Verify reputation persists on blockchain.
    ├── test-auto-assign.sh                # Automated epsilon-greedy assignment test.
    ├── .env                               # Your configuration (git-ignored).
    └── .env.example                       # Template.
```

## Notes:

**Restarting the blockchain:** When you restart the Hardhat node (Ctrl+C and restart), you must:
1. Re-deploy core contracts (step 3 in Setup).
2. Update addresses in `.env` (step 4 in Setup).
3. Restart the server.

The local blockchain resets completely when you restart it (all accounts go back to 10,000 ETH, reputation scores reset).

**Testing:** After setup, use the automated test scripts (see "Automated unit tests" section above):
- `./test-full-workflow.sh` - Validates escrow payments.
- `./test-audit-flow.sh` - Validates audit and reputation system.
- `./test-reputation-persistence.sh` - Confirms reputation is stored on blockchain.
- `./test-auto-assign.sh` - Tests epsilon-greedy automatic assignment algorithm.