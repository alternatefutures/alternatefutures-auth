# Deploy to Akash Sandbox - Testing Guide

Test your auth service deployment on Akash Sandbox before going to production!

## ✅ Prerequisites (Already Set Up!)

- ✅ provider-services v0.8.2 installed
- ✅ Sandbox environment configured (sandbox-setup.sh)

## Step 1: Load Sandbox Environment

```bash
cd /Users/wonderwomancode/Projects/fleek/alternatefutures-auth
source sandbox-setup.sh
```

## Step 2: Create Sandbox Wallet

```bash
# Create a new wallet for the sandbox
provider-services keys add sandbox-wallet

# IMPORTANT: Save the mnemonic phrase shown!
# You'll need it to recover your wallet
```

## Step 3: Fund Your Wallet with Test Tokens

1. **Get your wallet address:**
```bash
export AKASH_ACCOUNT_ADDRESS=$(provider-services keys show sandbox-wallet -a)
echo "Your wallet address: $AKASH_ACCOUNT_ADDRESS"
```

2. **Fund it using the sandbox faucet:**
   - Visit: https://faucet.sandbox-01.aksh.pw/
   - Enter your wallet address
   - Click "Request Tokens"
   - Wait ~30 seconds for tokens to arrive

3. **Verify balance:**
```bash
provider-services query bank balances $AKASH_ACCOUNT_ADDRESS --node $AKASH_NODE
```

You should see something like:
```yaml
balances:
- amount: "50000000"
  denom: uakt
```

## Step 4: Create and Publish Certificate

```bash
# Generate client certificate
provider-services tx cert generate client \
  --from sandbox-wallet \
  --chain-id $AKASH_CHAIN_ID \
  --node $AKASH_NODE \
  --gas-prices $AKASH_GAS_PRICES \
  --gas $AKASH_GAS \
  --gas-adjustment $AKASH_GAS_ADJUSTMENT \
  -y

# Publish certificate (wait a few seconds after generate)
provider-services tx cert publish client \
  --from sandbox-wallet \
  --chain-id $AKASH_CHAIN_ID \
  --node $AKASH_NODE \
  --gas-prices $AKASH_GAS_PRICES \
  --gas $AKASH_GAS \
  --gas-adjustment $AKASH_GAS_ADJUSTMENT \
  -y
```

## Step 5: Create Deployment

```bash
# Deploy to sandbox
provider-services tx deployment create deploy-sandbox.yaml \
  --from sandbox-wallet \
  --chain-id $AKASH_CHAIN_ID \
  --node $AKASH_NODE \
  --gas-prices $AKASH_GAS_PRICES \
  --gas $AKASH_GAS \
  --gas-adjustment $AKASH_GAS_ADJUSTMENT \
  -y

# Note the DSEQ (deployment sequence) from the output
# It will look like: "key: dseq value: \"123456\""
export DSEQ=<your-dseq-number>
```

## Step 6: Wait for Bids (~30-60 seconds)

```bash
# Check for bids
provider-services query market bid list \
  --owner $AKASH_ACCOUNT_ADDRESS \
  --node $AKASH_NODE \
  --state open
```

## Step 7: Accept a Bid

```bash
# Choose a provider from the bid list
export PROVIDER=<provider-address>

# Create lease
provider-services tx market lease create \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from sandbox-wallet \
  --chain-id $AKASH_CHAIN_ID \
  --node $AKASH_NODE \
  --gas-prices $AKASH_GAS_PRICES \
  --gas $AKASH_GAS \
  --gas-adjustment $AKASH_GAS_ADJUSTMENT \
  -y
```

## Step 8: Send Manifest to Provider

```bash
provider-services send-manifest deploy-sandbox.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from sandbox-wallet \
  --node $AKASH_NODE
```

## Step 9: Get Service URL & Test

```bash
# Get deployment status and URL
provider-services lease-status \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from sandbox-wallet \
  --node $AKASH_NODE

# Test the health endpoint
# Look for "forwarded_ports" in the output above
# Then test with:
curl http://<provider-url>:<port>/health
```

## Step 10: View Logs

```bash
# Stream logs to see what's happening
provider-services lease-logs \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from sandbox-wallet \
  --node $AKASH_NODE \
  --follow
```

## Useful Commands

### Check Deployment Status
```bash
provider-services query deployment get \
  --owner $AKASH_ACCOUNT_ADDRESS \
  --dseq $DSEQ \
  --node $AKASH_NODE
```

### Check Lease Status
```bash
provider-services query market lease get \
  --owner $AKASH_ACCOUNT_ADDRESS \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --node $AKASH_NODE
```

### Close Deployment (Stop & Clean Up)
```bash
provider-services tx deployment close \
  --dseq $DSEQ \
  --from sandbox-wallet \
  --chain-id $AKASH_CHAIN_ID \
  --node $AKASH_NODE \
  --gas-prices $AKASH_GAS_PRICES \
  --gas $AKASH_GAS \
  --gas-adjustment $AKASH_GAS_ADJUSTMENT \
  -y
```

## Troubleshooting

### "No bids found"
- Wait longer (up to 2 minutes)
- Check if sandbox providers are online
- Try redeploying with adjusted resources

### "Insufficient funds"
- Get more tokens from faucet: https://faucet.sandbox-01.aksh.pw/
- Each deployment costs ~0.5 AKT in the sandbox

### "Certificate not found"
- Make sure you published the certificate (Step 4)
- Wait a few blocks (~30 seconds) after publishing

### Build fails in container
- Check logs with `lease-logs` command
- Verify the manifest has correct image and environment variables
- The sandbox builds from the GitHub repo, so make sure it's pushed

## Expected Costs

Sandbox is **FREE** - you just need test tokens from the faucet!

- Deployment cost: ~0.5 AKT (sandbox tokens)
- Monthly cost: ~3-5 AKT (sandbox tokens)
- Real value: $0 (test network)

## Next Steps

Once everything works in sandbox:
1. ✅ Test all endpoints
2. ✅ Verify OAuth flows work
3. ✅ Check database persistence
4. 🚀 Deploy to mainnet (akashnet-2)

---

**Ready to test?** Start with Step 1!
