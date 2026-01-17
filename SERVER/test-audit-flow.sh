#!/bin/bash
# Test script for audit and reputation endpoints:

echo "Testing audit and reputation endpoints..."
echo ""

echo "1. Creating task..."
RESPONSE=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code": "result = 5 + 5\nprint(result)", "price": "0.5", "accountIndex": 0}')

ADDRESS=$(echo $RESPONSE | grep -o '"address":"0x[^"]*"' | cut -d'"' -f4)
echo "Task created at: $ADDRESS"
echo ""

echo "2. Assigning task to executor (account #1)..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/assign \
  -H "Content-Type: application/json" \
  -d '{"accountIndex": 1}' | jq '.'
echo ""

echo "3. Completing task (executor submits result '10')..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/complete \
  -H "Content-Type: application/json" \
  -d '{"result": "10", "accountIndex": 1}' | jq '.'
echo ""

echo "4. Requesting audit (buyer doesn't trust result)..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/request-audit \
  -H "Content-Type: application/json" \
  -d '{"reason": "Want to verify calculation"}' | jq '.'
echo ""

echo "5. Submitting audit result (auditor account #2 confirms '10')..."
curl -s -X POST http://localhost:3000/tasks/$ADDRESS/submit-audit-result \
  -H "Content-Type: application/json" \
  -d '{"result": "10", "accountIndex": 2}' | jq '.'
echo ""

echo "6. Checking executor reputation (should be +10)..."
EXECUTOR_ADDR=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].address')
curl -s http://localhost:3000/reputation/$EXECUTOR_ADDR | jq '.'
echo ""

echo "7. Checking auditor reputation (should be +2)..."
AUDITOR_ADDR=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[2].address')
curl -s http://localhost:3000/reputation/$AUDITOR_ADDR | jq '.'
echo ""

echo "Test complete!"
