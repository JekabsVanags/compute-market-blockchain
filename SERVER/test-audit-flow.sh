#!/bin/bash
# Test script for audit and reputation endpoints:
# - Tests automatic task assignment (no manual assignment needed).
# - Tests complete audit flow (request → auditor verification → reputation updates).
# - Verifies reputation changes (+10 executor, +2 auditor).
# - Works correctly with accumulated reputation from previous test runs.
# - Verifies /accounts endpoint includes reputation and matches /reputation/:address endpoints.

set -e # Exit on any error.

echo "Testing audit and reputation endpoints..."
echo ""

# Step 0 – grant SELLER roles:
echo "0. Granting SELLER_ROLE to accounts 1 and 2..."
cd ../BLOCKCHAIN
npx hardhat run scripts/grant-seller-roles.ts --network localhost > /dev/null
cd ../SERVER
echo "✓ Roles granted."
echo ""

echo "1. Creating task..."
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "result = 5 + 5\nprint(result)", "price": "0.5", "accountIndex": 0}')

ADDRESS=$(echo $RESPONSE | grep -o '"address":"0x[^"]*"' | cut -d'"' -f4)
echo "Task created at: $ADDRESS"

# Authorize the request contract for audit functionality:
echo "1b. Authorizing request contract..."
cd ../BLOCKCHAIN
REQUEST_ADDRESS="$ADDRESS" npx hardhat run scripts/authorize-request.ts --network localhost 2>/dev/null
cd ../SERVER
echo "✓ Authorized."
echo ""

echo "2. Verifying task was automatically assigned..."
TASK_STATUS=$(curl -s http://localhost:3000/tasks/$ADDRESS)
EXECUTOR=$(echo $TASK_STATUS | jq -r '.task.executor')
EXECUTOR_INDEX=$(echo $TASK_STATUS | jq -r '.task.executorAccountIndex')

# Record initial reputations before audit:
INITIAL_EXEC_REP=$(curl -s http://localhost:3000/reputation/$EXECUTOR | jq -r '.reputation')
INITIAL_AUDIT_REP=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].reputation')

echo "✓ Task automatically assigned to account #$EXECUTOR_INDEX ($EXECUTOR)."
echo "  Initial executor reputation: $INITIAL_EXEC_REP"
echo "  Initial auditor reputation: $INITIAL_AUDIT_REP"
echo ""

echo "3. Completing task (executor account #$EXECUTOR_INDEX submits result '10')..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/complete \
  -H "Content-Type: application/json" \
  -d "{\"stdout\": \"10\", \"stderr\": \"\", \"exitCode\": 0, \"accountIndex\": $EXECUTOR_INDEX}" | jq '.'
echo ""

echo "4. Requesting audit (buyer doesn't trust result)..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/request-audit \
  -H "Content-Type: application/json" \
  -d '{"reason": "Want to verify calculation"}' | jq '.'
echo ""

echo "5. Submitting audit result (auditor account #2 confirms '10')..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/submit-audit-result \
  -H "Content-Type: application/json" \
  -d '{"stdout": "10", "stderr": "", "exitCode": 0, "accountIndex": 2}' | jq '.'
echo ""

echo "6. Checking executor (account #$EXECUTOR_INDEX) reputation (should be +10)..."
FINAL_EXEC_REP=$(curl -s http://localhost:3000/reputation/$EXECUTOR | jq -r '.reputation')
EXEC_CHANGE=$((FINAL_EXEC_REP - INITIAL_EXEC_REP))
echo "  Initial: $INITIAL_EXEC_REP → Final: $FINAL_EXEC_REP (change: +$EXEC_CHANGE)"
echo ""

echo "7. Checking auditor reputation (should be +2)..."
AUDITOR_ADDR=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].address')
FINAL_AUDIT_REP=$(curl -s http://localhost:3000/reputation/$AUDITOR_ADDR | jq -r '.reputation')
AUDIT_CHANGE=$((FINAL_AUDIT_REP - INITIAL_AUDIT_REP))
echo "  Initial: $INITIAL_AUDIT_REP → Final: $FINAL_AUDIT_REP (change: +$AUDIT_CHANGE)"
echo ""

echo "8. Verifying /accounts endpoint also shows updated reputations..."
ACCOUNTS_EXEC_REP=$(curl -s http://localhost:3000/accounts | jq -r ".accounts[$EXECUTOR_INDEX].reputation")
ACCOUNTS_AUDIT_REP=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].reputation')
echo "  Executor (account #$EXECUTOR_INDEX) from /accounts: $ACCOUNTS_EXEC_REP"
echo "  Auditor (account #2) from /accounts: $ACCOUNTS_AUDIT_REP"

# Verify reputation changes are correct:
if [ "$EXEC_CHANGE" -eq 10 ] && [ "$AUDIT_CHANGE" -eq 2 ]; then
  echo "✓ Reputation changes correct – executor +10, auditor +2."
else
  echo "✗ Reputation change mismatch! Expected executor +10, auditor +2, got +$EXEC_CHANGE and +$AUDIT_CHANGE."
  exit 1
fi

# Verify /accounts matches /reputation endpoints:
if [ "$ACCOUNTS_EXEC_REP" -eq "$FINAL_EXEC_REP" ] && [ "$ACCOUNTS_AUDIT_REP" -eq "$FINAL_AUDIT_REP" ]; then
  echo "✓ /accounts endpoint correctly matches /reputation endpoints."
else
  echo "✗ /accounts endpoint mismatch with /reputation endpoints!"
  exit 1
fi
echo ""

echo "Test complete!"
