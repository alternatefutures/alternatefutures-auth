#!/bin/bash

# Akash Sandbox Environment Setup
export AKASH_CHAIN_ID="sandbox-01"
export AKASH_NODE="https://rpc.sandbox-01.aksh.pw:443"
export AKASH_GAS=auto
export AKASH_GAS_ADJUSTMENT=1.25
export AKASH_GAS_PRICES=0.025uakt
export AKASH_SIGN_MODE=amino-json
export AKASH_KEY_NAME="${AKASH_KEY_NAME:-sandbox-wallet}"
export AKASH_KEYRING_BACKEND=os

echo "✅ Akash Sandbox Environment"
echo "   Chain ID: $AKASH_CHAIN_ID"
echo "   Node: $AKASH_NODE"
echo "   Wallet: $AKASH_KEY_NAME"
echo ""
echo "To use these variables, run:"
echo "  source sandbox-setup.sh"
