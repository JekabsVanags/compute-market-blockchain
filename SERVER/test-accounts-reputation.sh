#!/bin/bash
# Test that /accounts endpoint includes reputation field:

set -e

echo "Testing /accounts endpoint includes reputation..."
echo ""

# Step 1 – check structure:
echo "Step 1: Checking account structure includes reputation field..."
ACCOUNT=$(curl -s http://localhost:3000/accounts | jq '.accounts[1]')
echo "$ACCOUNT" | jq '.'
echo ""

HAS_REPUTATION=$(echo "$ACCOUNT" | jq 'has("reputation")')
if [ "$HAS_REPUTATION" == "true" ]; then
  echo "✓ Account has reputation field."
else
  echo "✗ Account missing reputation field!"
  exit 1
fi
echo ""

# Step 2 – verify all accounts have reputation:
echo "Step 2: Verifying ALL 20 accounts have reputation field..."
ALL_HAVE_REP=$(curl -s http://localhost:3000/accounts | jq '[.accounts[] | has("reputation")] | all')
if [ "$ALL_HAVE_REP" == "true" ]; then
  echo "✓ All 20 accounts have reputation field."
else
  echo "✗ Some accounts missing reputation field!"
  exit 1
fi
echo ""

# Step 3 – compare /accounts with /reputation/:address endpoints:
echo "Step 3: Comparing /accounts reputation with /reputation/:address endpoint..."
ADDR=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].address')
REP_FROM_ACCOUNTS=$(curl -s http://localhost:3000/accounts | jq -r '.accounts[1].reputation')
REP_FROM_ENDPOINT=$(curl -s http://localhost:3000/reputation/$ADDR | jq -r '.reputation')

echo "Account #1: $ADDR"
echo "  Reputation from /accounts: $REP_FROM_ACCOUNTS"
echo "  Reputation from /reputation/:address: $REP_FROM_ENDPOINT"
echo ""

if [ "$REP_FROM_ACCOUNTS" == "$REP_FROM_ENDPOINT" ]; then
  echo "✓ Reputations match between endpoints."
else
  echo "✗ Reputation mismatch!"
  exit 1
fi
echo ""

# Step 4 – test with account that has non-zero reputation (if any):
echo "Step 4: Finding accounts with non-zero reputation (if any)..."
NON_ZERO=$(curl -s http://localhost:3000/accounts | jq '[.accounts[] | select(.reputation != 0)] | length')
echo "Found $NON_ZERO accounts with non-zero reputation."

if [ "$NON_ZERO" -gt 0 ]; then
  echo "Testing consistency for account with non-zero reputation..."
  ADDR_NONZERO=$(curl -s http://localhost:3000/accounts | jq -r '[.accounts[] | select(.reputation != 0)][0].address')
  REP_ACCOUNTS_NONZERO=$(curl -s http://localhost:3000/accounts | jq -r "[.accounts[] | select(.address == \"$ADDR_NONZERO\")][0].reputation")
  REP_ENDPOINT_NONZERO=$(curl -s http://localhost:3000/reputation/$ADDR_NONZERO | jq -r '.reputation')

  echo "  Address: $ADDR_NONZERO"
  echo "  Reputation from /accounts: $REP_ACCOUNTS_NONZERO"
  echo "  Reputation from /reputation/:address: $REP_ENDPOINT_NONZERO"

  if [ "$REP_ACCOUNTS_NONZERO" == "$REP_ENDPOINT_NONZERO" ]; then
    echo "  ✓ Non-zero reputations match."
  else
    echo "  ✗ Non-zero reputation mismatch!"
    exit 1
  fi
else
  echo "  (No accounts with non-zero reputation - skipping.)"
fi
echo ""

echo "Test complete!"
