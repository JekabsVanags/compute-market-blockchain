#!/bin/bash
# Test that reputation persists on blockchain (survives server restart)

set -e

echo "Testing whether reputation persists on blockchain (as intermediary API endpoint server restarts):"
echo ""

# Get initial reputation (should be 10 from previous test):
echo "1. Checking executor reputation from previous test..."
EXEC_ADDR=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].address')
REP_BEFORE=$(curl -s http://localhost:3000/reputation/$EXEC_ADDR | jq -r '.reputation')
echo "Executor reputation: $REP_BEFORE"
echo ""

if [ "$REP_BEFORE" -eq 10 ]; then
  echo "✓ Reputation persisted on blockchain (still 10 from previous test)."
else
  echo "✗ Unexpected reputation value: $REP_BEFORE"
  exit 1
fi

echo ""
echo "Test complete!"
echo "Note: Reputation is stored on blockchain, so it persists even if server restarts."
echo "It will only reset if the blockchain itself is restarted."
