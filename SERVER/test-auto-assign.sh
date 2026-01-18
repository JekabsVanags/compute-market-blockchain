#!/bin/bash
# Test auto-assignment with epsilon-greedy algorithm:

set -e # Exit on any error.

echo "Testing auto-assignment with epsilon-greedy algorithm..."
echo ""

# Colors for output:
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No color.

# Step 0 – grant SELLER roles to accounts 1 and 2:
echo -e "${BLUE}Step 0: Granting SELLER_ROLE to accounts 1 and 2...${NC}"
cd ../BLOCKCHAIN
npx hardhat run scripts/grant-seller-roles.ts --network localhost > /dev/null
echo -e "${GREEN}✓ Roles granted.${NC}"
echo ""

cd ../SERVER

# Step 1 – check server health:
echo -e "${BLUE}Step 1: Checking server health...${NC}"
HEALTH=$(curl -s http://localhost:3000/health)
echo "$HEALTH" | jq '.'
CONNECTED=$(echo "$HEALTH" | jq -r '.blockchain.connected')
if [ "$CONNECTED" != "true" ]; then
  echo "ERROR: Blockchain not connected!"
  exit 1
fi
echo -e "${GREEN}✓ Server healthy.${NC}"
echo ""

# Step 2 – check reputation scores:
echo -e "${BLUE}Step 2: Checking initial reputation scores...${NC}"
ADDR1=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].address')
ADDR2=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].address')
REP1=$(curl -s http://localhost:3000/reputation/$ADDR1 | jq -r '.reputation')
REP2=$(curl -s http://localhost:3000/reputation/$ADDR2 | jq -r '.reputation')
echo "Account #1 ($ADDR1): $REP1 reputation"
echo "Account #2 ($ADDR2): $REP2 reputation"
echo -e "${GREEN}✓ Reputation scores retrieved.${NC}"
echo ""

# Step 3 – test default auto-assign (epsilon = 0.1):
echo -e "${BLUE}Step 3: Testing default auto-assign (epsilon=0.1, 10% exploration)...${NC}"
echo "Running 10 assignments to observe epsilon-greedy behavior..."

HIGH_REP_COUNT=0
LOW_REP_COUNT=0

for i in {1..10}; do
  # Create task:
  RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print($i)\", \"price\": \"0.5\", \"accountIndex\": 0}")

  TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')

  # Auto-assign:
  ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/auto-assign \
    -H "Content-Type: application/json" \
    -d '{"epsilon": 0.1, "sellerAccountIndices": [1, 2]}')

  SELECTED_INDEX=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.accountIndex')
  SELECTED_REP=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.reputation')
  SELECTION_METHOD=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.selectionMethod')

  echo "  Task $i: Selected account #$SELECTED_INDEX (rep: $SELECTED_REP) - $SELECTION_METHOD"

  # Count selections (assuming account 1 has higher reputation):
  if [ "$SELECTED_INDEX" -eq 1 ]; then
    HIGH_REP_COUNT=$((HIGH_REP_COUNT + 1))
  else
    LOW_REP_COUNT=$((LOW_REP_COUNT + 1))
  fi
done

echo ""
echo "Results: Account #1 selected $HIGH_REP_COUNT times, Account #2 selected $LOW_REP_COUNT times"

# With epsilon = 0.1, we expect ~90% selections to be highest reputation (account 1):
# Allow some variance due to randomness.
if [ "$HIGH_REP_COUNT" -ge 7 ]; then
  echo -e "${GREEN}✓ Epsilon-greedy behaving as expected (high-reputation account favored).${NC}"
else
  echo -e "${YELLOW}⚠ Unexpected distribution - may be due to random variance.${NC}"
fi
echo ""

# Step 4 – test epsilon = 0.0 (always greedy - should always pick highest reputation):
echo -e "${BLUE}Step 4: Testing epsilon=0.0 (always select highest reputation)...${NC}"

GREEDY_HIGH_COUNT=0

for i in {1..5}; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print(greedy_$i)\", \"price\": \"0.5\", \"accountIndex\": 0}")

  TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')

  ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/auto-assign \
    -H "Content-Type: application/json" \
    -d '{"epsilon": 0.0, "sellerAccountIndices": [1, 2]}')

  SELECTED_INDEX=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.accountIndex')
  SELECTED_REP=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.reputation')
  SELECTION_METHOD=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.selectionMethod')

  echo "  Task $i: Selected account #$SELECTED_INDEX (rep: $SELECTED_REP) - $SELECTION_METHOD"

  if [ "$SELECTED_INDEX" -eq 1 ]; then
    GREEDY_HIGH_COUNT=$((GREEDY_HIGH_COUNT + 1))
  fi
done

echo ""
if [ "$GREEDY_HIGH_COUNT" -eq 5 ]; then
  echo -e "${GREEN}✓ Epsilon = 0.0 correctly selects highest reputation every time.${NC}"
else
  echo "ERROR: With epsilon = 0.0, expected all 5 selections to be highest reputation!"
  echo "Got $GREEDY_HIGH_COUNT out of 5."
  exit 1
fi
echo ""

# Step 5 – test epsilon = 1.0 (always random - can select any):
echo -e "${BLUE}Step 5: Testing epsilon = 1.0 (always random selection)...${NC}"

RANDOM_SELECTIONS=0

for i in {1..5}; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print(random_$i)\", \"price\": \"0.5\", \"accountIndex\": 0}")

  TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')

  ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/auto-assign \
    -H "Content-Type: application/json" \
    -d '{"epsilon": 1.0, "sellerAccountIndices": [1, 2]}')

  SELECTED_INDEX=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.accountIndex')
  SELECTED_REP=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.reputation')
  SELECTION_METHOD=$(echo "$ASSIGN_RESPONSE" | jq -r '.selectedSeller.selectionMethod')

  echo "  Task $i: Selected account #$SELECTED_INDEX (rep: $SELECTED_REP) - $SELECTION_METHOD"

  # Verify method is always "random":
  if [[ "$SELECTION_METHOD" == *"random"* ]]; then
    RANDOM_SELECTIONS=$((RANDOM_SELECTIONS + 1))
  fi
done

echo ""
if [ "$RANDOM_SELECTIONS" -eq 5 ]; then
  echo -e "${GREEN}✓ Epsilon=1.0 correctly uses random selection every time.${NC}"
else
  echo "ERROR: With epsilon=1.0, expected all selections to be random!"
  exit 1
fi
echo ""

# Step 6 – verify task assignment on blockchain:
echo -e "${BLUE}Step 6: Verifying task assigned on blockchain...${NC}"

# Create and auto-assign one more task:
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "print(verify)", "price": "0.5", "accountIndex": 0}')

TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')

ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/auto-assign \
  -H "Content-Type: application/json" \
  -d '{}')

EXECUTOR=$(echo "$ASSIGN_RESPONSE" | jq -r '.task.executor')

# Verify task details:
TASK_DETAILS=$(curl -s http://localhost:3000/tasks/$TASK_ADDR)
TASK_EXECUTOR=$(echo "$TASK_DETAILS" | jq -r '.task.executor')

if [ "$EXECUTOR" == "$TASK_EXECUTOR" ]; then
  echo "Executor assigned: $EXECUTOR"
  echo -e "${GREEN}✓ Task assignment verified on blockchain.${NC}"
else
  echo "ERROR: Executor mismatch!"
  exit 1
fi
echo ""

# Summary:
echo "Test complete!"
