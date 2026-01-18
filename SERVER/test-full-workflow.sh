#!/bin/bash
# Full workflow test including role setup and escrow validation:

set -e # Exit on any error.

echo "Testing full workflow with escrow endpoints..."
echo ""

# Colors for output:
GREEN='\033[0;32m'
BLUE='\033[0;34m'
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

# Step 2 – get initial balances:
echo -e "${BLUE}Step 2: Recording initial balances...${NC}"
INITIAL_BALANCES=$(curl -s http://localhost:3000/accounts)
BUYER_INITIAL=$(echo "$INITIAL_BALANCES" | jq -r '.accounts[0].balance')
SELLER_INITIAL=$(echo "$INITIAL_BALANCES" | jq -r '.accounts[1].balance')
echo "Buyer (account #0): $BUYER_INITIAL ETH"
echo "Seller (account #1): $SELLER_INITIAL ETH"
echo -e "${GREEN}✓ Balances recorded.${NC}"
echo ""

# Step 3 – create task:
echo -e "${BLUE}Step 3: Creating task...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "print(5+5)",
    "price": "0.5",
    "accountIndex": 0
  }')

TASK_ADDRESS=$(echo "$RESPONSE" | jq -r '.task.address')
echo "Task created at: $TASK_ADDRESS"
echo -e "${GREEN}✓ Task created (escrow locked).${NC}"
echo ""

# Step 4 – assign task:
echo -e "${BLUE}Step 4: Assigning task to executor (account #1)...${NC}"
curl -s -X POST http://localhost:3000/tasks/$TASK_ADDRESS/assign \
  -H "Content-Type: application/json" \
  -d '{"accountIndex": 1}' | jq '.'
echo -e "${GREEN}✓ Task assigned.${NC}"
echo ""

# Step 5 – complete task:
echo -e "${BLUE}Step 5: Completing task (executor submits result)...${NC}"
curl -s -X POST http://localhost:3000/tasks/$TASK_ADDRESS/complete \
  -H "Content-Type: application/json" \
  -d '{
    "stdout": "10",
    "stderr": "",
    "exitCode": 0,
    "accountIndex": 1
  }' | jq '.'
echo -e "${GREEN}✓ Task completed.${NC}"
echo ""

# Step 6 – finalize task (release escrow):
echo -e "${BLUE}Step 6: Finalizing task (releasing escrow payment)...${NC}"
FINALIZE_RESPONSE=$(curl -s -X POST http://localhost:3000/tasks/$TASK_ADDRESS/finalize \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$FINALIZE_RESPONSE" | jq '.'
PAYMENT_HASH=$(echo "$FINALIZE_RESPONSE" | jq -r '.paymentTransactionHash')
echo "Payment transaction: $PAYMENT_HASH"
echo -e "${GREEN}✓ Task finalized (escrow released).${NC}"
echo ""

# Step 7 – verify balances changed correctly:
echo -e "${BLUE}Step 7: Verifying final balances...${NC}"
FINAL_BALANCES=$(curl -s http://localhost:3000/accounts)
BUYER_FINAL=$(echo "$FINAL_BALANCES" | jq -r '.accounts[0].balance')
SELLER_FINAL=$(echo "$FINAL_BALANCES" | jq -r '.accounts[1].balance')

echo "Buyer (account #0):"
echo "  Initial: $BUYER_INITIAL ETH"
echo "  Final:   $BUYER_FINAL ETH"

echo "Seller (account #1):"
echo "  Initial: $SELLER_INITIAL ETH"
echo "  Final:   $SELLER_FINAL ETH"

# Calculate changes (using bc for floating point):
BUYER_SPENT=$(echo "$BUYER_INITIAL - $BUYER_FINAL" | bc)
SELLER_GAINED=$(echo "$SELLER_FINAL - $SELLER_INITIAL" | bc)

echo ""
echo "Buyer spent: ~$BUYER_SPENT ETH (0.5 task + 0.0556 audit tax + gas)"
echo "Seller gained: ~$SELLER_GAINED ETH (0.5 task payment from escrow - gas)"

# Validate seller received approximately 0.5 ETH:
SELLER_GAIN_CHECK=$(echo "$SELLER_GAINED > 0.49 && $SELLER_GAINED < 0.51" | bc)
if [ "$SELLER_GAIN_CHECK" -eq 1 ]; then
  echo -e "${GREEN}✓ Escrow payment verified (seller received ~0.5 ETH).${NC}"
else
  echo "ERROR: Seller did not receive expected payment! Got: $SELLER_GAINED ETH"
  exit 1
fi

# Validate buyer only paid once (not double payment):
BUYER_SPENT_CHECK=$(echo "$BUYER_SPENT < 0.7" | bc)
if [ "$BUYER_SPENT_CHECK" -eq 1 ]; then
  echo -e "${GREEN}✓ No double payment (buyer spent < 0.7 ETH total).${NC}"
else
  echo "ERROR: Buyer may have paid twice! Spent: $BUYER_SPENT ETH"
  exit 1
fi

echo ""
echo -e "${GREEN}Test complete!${NC}"
