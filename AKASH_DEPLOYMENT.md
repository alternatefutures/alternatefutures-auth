# Deploy Auth Backend to Akash Network

Complete guide to deploying the auth backend on Akash (decentralized cloud compute).

## Prerequisites

1. **Akash CLI installed**:
   ```bash
   brew install akash
   # or
   curl -sSfL https://raw.githubusercontent.com/akash-network/node/master/install.sh | sh
   ```

2. **Akash wallet with AKT tokens**:
   - Create wallet: `akash keys add my-wallet`
   - Fund with AKT (minimum ~5 AKT for deployment)
   - Get tokens from exchanges or faucet

3. **Docker installed** (for building image):
   ```bash
   brew install docker
   ```

## Step 1: Build Docker Image

```bash
cd ~/Projects/fleek/alternatefutures-auth

# Build image
docker build -t alternatefutures-auth:latest .

# Test locally
docker run -p 3001:3001 \
  -e JWT_SECRET=test-secret \
  -e JWT_REFRESH_SECRET=test-refresh \
  alternatefutures-auth:latest

# Test endpoint
curl http://localhost:3001/health
```

## Step 2: Push to Public Registry

Akash needs to pull images from a public registry:

```bash
# Tag for Docker Hub
docker tag alternatefutures-auth:latest your-dockerhub-username/alternatefutures-auth:latest

# Login to Docker Hub
docker login

# Push
docker push your-dockerhub-username/alternatefutures-auth:latest
```

Or use GitHub Container Registry:

```bash
# Tag for GHCR
docker tag alternatefutures-auth:latest ghcr.io/your-username/alternatefutures-auth:latest

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin

# Push
docker push ghcr.io/your-username/alternatefutures-auth:latest
```

## Step 3: Update Akash Deployment Manifest

Edit `deploy-akash.yaml` and replace the image:

```yaml
services:
  auth-api:
    image: your-dockerhub-username/alternatefutures-auth:latest
    # or
    image: ghcr.io/your-username/alternatefutures-auth:latest
```

## Step 4: Deploy to Akash

```bash
# Set your wallet
export AKASH_KEY_NAME=my-wallet
export AKASH_KEYRING_BACKEND=os
export AKASH_NODE=https://rpc.akash.network:443
export AKASH_CHAIN_ID=akashnet-2

# Create deployment
akash tx deployment create deploy-akash.yaml \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --chain-id $AKASH_CHAIN_ID \
  --gas=auto \
  --gas-adjustment=1.3

# Wait for bids (30-60 seconds)
# List bids
akash query market bid list --owner $(akash keys show $AKASH_KEY_NAME -a) --node $AKASH_NODE

# Accept a bid (choose lowest price or best provider)
akash tx market lease create \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --gseq 1 \
  --oseq 1 \
  --provider <provider-address> \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --chain-id $AKASH_CHAIN_ID

# Send manifest to provider
akash provider send-manifest deploy-akash.yaml \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --provider <provider-address> \
  --node $AKASH_NODE

# Check status
akash provider lease-status \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --gseq 1 \
  --oseq 1 \
  --provider <provider-address> \
  --node $AKASH_NODE

# Get service URI
akash provider lease-status \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --gseq 1 \
  --oseq 1 \
  --provider <provider-address> \
  --node $AKASH_NODE | grep "uri"
```

## Step 5: Configure DNS

Once deployed, you'll get a URI like: `http://provider.akash.network:30080`

### Option A: CNAME to Akash Provider (Centralized DNS)
In Namecheap:
```
Type: CNAME
Host: auth
Value: provider-hostname.akash.network.
```

### Option B: Handshake Domain (Fully Decentralized)
1. Register a Handshake domain (e.g., `alternatefutures/`)
2. Set up HNS resolver
3. Point to Akash provider IP

### Option C: ENS + IPFS Link (Hybrid)
1. Register ENS domain
2. Set content hash to Arweave TX
3. Use Akash for API

## Step 6: Update Environment Variables

After deployment, update secrets:

```bash
# Get deployment info
akash provider lease-logs \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --gseq 1 \
  --oseq 1 \
  --provider <provider-address> \
  --node $AKASH_NODE
```

To update environment variables, you need to close and redeploy with updated manifest.

## Step 7: Monitor Deployment

```bash
# View logs
akash provider lease-logs \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --provider <provider-address> \
  --follow \
  --node $AKASH_NODE

# Shell into container
akash provider lease-shell \
  --owner $(akash keys show $AKASH_KEY_NAME -a) \
  --dseq <deployment-sequence> \
  --provider <provider-address> \
  --node $AKASH_NODE
```

## Step 8: Test Auth Backend

```bash
# Health check
curl https://auth.alternatefutures.ai/health

# Test email request
curl -X POST https://auth.alternatefutures.ai/auth/email/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'
```

## Cost Estimate

Typical Akash costs for this deployment:
- **CPU**: 0.5 units
- **Memory**: 512Mi
- **Storage**: 1Gi

**Estimated cost**: ~$3-5/month (80% cheaper than AWS/Railway)

## Advantages of Akash

1. ✅ **Truly Decentralized**: No single point of failure
2. ✅ **Censorship Resistant**: Cannot be shut down
3. ✅ **Cost Effective**: Much cheaper than centralized clouds
4. ✅ **DePIN Native**: Fits your philosophy
5. ✅ **Open Source**: Full control

## Disadvantages vs Railway

1. ❌ **More Complex**: Requires AKT tokens, wallet management
2. ❌ **No Auto SSL**: Need to handle certificates manually
3. ❌ **Less Tooling**: No fancy dashboard like Railway
4. ❌ **Provider Availability**: Depends on provider uptime

## Hybrid Approach (Recommended for MVP)

**Phase 1**: Deploy on Railway (fast, test auth flows)
**Phase 2**: Migrate to Akash (true decentralization)

This way you can test the auth system quickly, then migrate to Akash once validated.

## Fully Decentralized Stack Summary

```
Frontend:       Arweave ✅
Auth Backend:   Akash Network ✅
Database:       GunDB/OrbitDB ✅ (to be implemented)
Email:          Resend ⚠️ (only centralized piece)
DNS:            Handshake ✅ (optional upgrade)
```

**99% Decentralized** - only email remains centralized (inherent to SMTP).

---

Next steps:
1. Test on Railway first
2. Once working, migrate to Akash
3. Replace email with XMTP for 100% decentralization
