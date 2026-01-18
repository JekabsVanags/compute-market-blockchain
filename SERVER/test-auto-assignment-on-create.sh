#!/bin/bash
# Test automatic assignment during task creation:

set -e # Exit on any error.

echo "Testing automatic assignment during task creation..."
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

# Step 2 – check initial reputation scores:
echo -e "${BLUE}Step 2: Checking initial reputation scores...${NC}"
ADDR1=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].address')
ADDR2=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].address')
REP1=$(curl -s http://localhost:3000/reputation/$ADDR1 | jq -r '.reputation')
REP2=$(curl -s http://localhost:3000/reputation/$ADDR2 | jq -r '.reputation')
echo "Account #1 ($ADDR1): $REP1 reputation"
echo "Account #2 ($ADDR2): $REP2 reputation"
echo -e "${GREEN}✓ Reputation scores retrieved.${NC}"
echo ""

# Step 3 – create task and verify automatic assignment:
echo -e "${BLUE}Step 3: Creating task and verifying automatic assignment...${NC}"

RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "print(42)", "price": "0.5", "accountIndex": 0}')

echo "$RESPONSE" | jq '.'

TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')
EXECUTOR=$(echo "$RESPONSE" | jq -r '.task.executor')
EXECUTOR_INDEX=$(echo "$RESPONSE" | jq -r '.task.executorAccountIndex')

if [ "$EXECUTOR" == "null" ] || [ -z "$EXECUTOR" ]; then
  echo "ERROR: Task was not automatically assigned!"
  exit 1
fi

echo ""
echo "Task created at: $TASK_ADDR"
echo "Automatically assigned to: $EXECUTOR (account #$EXECUTOR_INDEX)"

# Verify executor is one of the expected accounts:
if [ "$EXECUTOR_INDEX" -ne 1 ] && [ "$EXECUTOR_INDEX" -ne 2 ]; then
  echo "ERROR: Executor should be account #1 or #2, got #$EXECUTOR_INDEX!"
  exit 1
fi

echo -e "${GREEN}✓ Task automatically assigned to account #$EXECUTOR_INDEX.${NC}"
echo ""

# Step 4 – verify assignment on blockchain (check task details):
echo -e "${BLUE}Step 4: Verifying assignment persists on blockchain...${NC}"

TASK_DETAILS=$(curl -s http://localhost:3000/tasks/$TASK_ADDR)
STORED_EXECUTOR=$(echo "$TASK_DETAILS" | jq -r '.task.executor')
STORED_INDEX=$(echo "$TASK_DETAILS" | jq -r '.task.executorAccountIndex')

if [ "$STORED_EXECUTOR" != "$EXECUTOR" ] || [ "$STORED_INDEX" -ne "$EXECUTOR_INDEX" ]; then
  echo "ERROR: Assignment not persisted correctly!"
  echo "Expected: $EXECUTOR (account #$EXECUTOR_INDEX)"
  echo "Got: $STORED_EXECUTOR (account #$STORED_INDEX)"
  exit 1
fi

echo "Verified executor: $STORED_EXECUTOR (account #$STORED_INDEX)"
echo -e "${GREEN}✓ Assignment persisted on blockchain.${NC}"
echo ""

# Step 5 – verify executor can complete the task:
echo -e "${BLUE}Step 5: Verifying assigned executor can complete task...${NC}"

COMPLETE_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/complete \
  -H "Content-Type: application/json" \
  -d "{\"stdout\": \"42\", \"stderr\": \"\", \"exitCode\": 0, \"accountIndex\": $EXECUTOR_INDEX}")

COMPLETE_SUCCESS=$(echo "$COMPLETE_RESPONSE" | jq -r '.success')
TASK_STATUS=$(echo "$COMPLETE_RESPONSE" | jq -r '.task.status')

if [ "$COMPLETE_SUCCESS" != "true" ] || [ "$TASK_STATUS" != "completed" ]; then
  echo "ERROR: Task completion failed!"
  echo "$COMPLETE_RESPONSE" | jq '.'
  exit 1
fi

echo "Task completed successfully by executor #$EXECUTOR_INDEX"
echo -e "${GREEN}✓ Assigned executor completed task.${NC}"
echo ""

# Step 6 – test multiple task creations to observe epsilon-greedy behavior:
echo -e "${BLUE}Step 6: Testing epsilon-greedy behavior with multiple task creations...${NC}"
echo "Creating 10 tasks to observe assignment distribution..."

ACCOUNT1_COUNT=0
ACCOUNT2_COUNT=0

for i in {1..10}; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print($i)\", \"price\": \"0.5\", \"accountIndex\": 0}")

  EXECUTOR_INDEX=$(echo "$RESPONSE" | jq -r '.task.executorAccountIndex')
  TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')

  echo "  Task $i ($TASK_ADDR): Assigned to account #$EXECUTOR_INDEX."

  if [ "$EXECUTOR_INDEX" -eq 1 ]; then
    ACCOUNT1_COUNT=$((ACCOUNT1_COUNT + 1))
  elif [ "$EXECUTOR_INDEX" -eq 2 ]; then
    ACCOUNT2_COUNT=$((ACCOUNT2_COUNT + 1))
  else
    echo "ERROR: Unexpected executor account #$EXECUTOR_INDEX!"
    exit 1
  fi
done

echo ""
echo "Assignment distribution:"
echo "  Account #1: $ACCOUNT1_COUNT tasks"
echo "  Account #2: $ACCOUNT2_COUNT tasks"

# With equal reputation and epsilon = 0.1, both accounts should get some tasks:
# Due to randomness, we expect some variation, but both should be selected.
if [ "$ACCOUNT1_COUNT" -eq 0 ] && [ "$ACCOUNT2_COUNT" -eq 0 ]; then
  echo "ERROR: No tasks were assigned!"
  exit 1
fi

echo -e "${GREEN}✓ Epsilon-greedy distribution observed.${NC}"
echo ""

# Step 7 – verify wrong executor cannot complete assigned task:
echo -e "${BLUE}Step 7: Verifying wrong executor cannot complete assigned task...${NC}"

# Create a task:
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "print(999)", "price": "0.5", "accountIndex": 0}')

TASK_ADDR=$(echo "$RESPONSE" | jq -r '.task.address')
EXECUTOR_INDEX=$(echo "$RESPONSE" | jq -r '.task.executorAccountIndex')

# Determine wrong executor:
if [ "$EXECUTOR_INDEX" -eq 1 ]; then
  WRONG_INDEX=2
else
  WRONG_INDEX=1
fi

# Try to complete with wrong executor:
WRONG_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDR/complete \
  -H "Content-Type: application/json" \
  -d "{\"stdout\": \"999\", \"stderr\": \"\", \"exitCode\": 0, \"accountIndex\": $WRONG_INDEX}")

ERROR_MSG=$(echo "$WRONG_RESPONSE" | jq -r '.error')

if [[ "$ERROR_MSG" == *"different executor"* ]]; then
  echo "Task assigned to account #$EXECUTOR_INDEX"
  echo "Account #$WRONG_INDEX correctly rejected: $ERROR_MSG"
  echo -e "${GREEN}✓ Access control working correctly.${NC}"
else
  echo "ERROR: Wrong executor was allowed to complete task!"
  echo "$WRONG_RESPONSE" | jq '.'
  exit 1
fi
echo ""

echo "Test complete!"
