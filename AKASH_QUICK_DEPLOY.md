# Quick Akash Deployment Guide

## 🚀 Deploy Auth Service to Akash in 10 Minutes

### Prerequisites
- ✅ Akash CLI installed (`akash version` shows v0.38.4)
- Akash wallet with ~5 AKT tokens
- Environment variables ready

### Step 1: Set Akash Environment

```bash
export AKASH_KEY_NAME=my-wallet
export AKASH_KEYRING_BACKEND=os
export AKASH_NODE=https://rpc.akash.network:443
export AKASH_CHAIN_ID=akashnet-2
export AKASH_ACCOUNT_ADDRESS=$(akash keys show $AKASH_KEY_NAME -a)
```

### Step 2: Update deploy-akash.yaml with Your Secrets

Edit `deploy-akash.yaml` and replace:
- `JWT_SECRET` and `JWT_REFRESH_SECRET` with generated secrets
- All OAuth credentials (GOOGLE_, GITHUB_, TWITTER_, DISCORD_)
- RESEND_API_KEY and HTTPSMS credentials

**Generate JWT secrets:**
```bash
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_SECRET
```

### Step 3: Deploy to Akash

```bash
cd /Users/wonderwomancode/Projects/fleek/alternatefutures-auth

# Create deployment
akash tx deployment create deploy-akash.yaml \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --chain-id $AKASH_CHAIN_ID \
  --gas=auto \
  --gas-adjustment=1.5 \
  -y

# Note the DSEQ (deployment sequence) from output
export DSEQ=<your-deployment-sequence>
```

### Step 4: Wait for Bids (~30-60 seconds)

```bash
# List available bids
akash query market bid list \
  --owner $AKASH_ACCOUNT_ADDRESS \
  --node $AKASH_NODE \
  --state open
```

### Step 5: Accept a Bid

```bash
# Choose the provider with best price/reputation
export PROVIDER=<provider-address-from-bids>

# Create lease
akash tx market lease create \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --chain-id $AKASH_CHAIN_ID \
  --gas=auto \
  --gas-adjustment=1.5 \
  -y
```

### Step 6: Send Manifest

```bash
# Send your deployment configuration to the provider
akash provider send-manifest deploy-akash.yaml \
  --dseq $DSEQ \
  --provider $PROVIDER \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE
```

### Step 7: Get Your Service URL

```bash
# Check deployment status
akash provider lease-status \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE
```

Look for the `forwarded_ports` section to get your public URL.

### Step 8: Test Your Deployment

```bash
# Health check (replace with your actual URL)
curl http://<provider-url>:<port>/health

# Should return:
# {"status":"ok","service":"alternatefutures-auth","version":"0.1.0"}
```

### Step 9: Update OAuth Redirect URIs

Once you have your production URL, update redirect URIs in:

1. **Google Cloud Console** → `http://<your-akash-url>/auth/oauth/callback/google`
2. **GitHub Settings** → `http://<your-akash-url>/auth/oauth/callback/github`
3. **Twitter Developer** → `http://<your-akash-url>/auth/oauth/callback/twitter`
4. **Discord Developer** → `http://<your-akash-url>/auth/oauth/callback/discord`

### Step 10: Set Up Custom Domain (Optional)

Point `auth.alternatefutures.ai` to your Akash URL:

1. Get the provider hostname from lease-status
2. Add CNAME record in your DNS:
   ```
   Type: CNAME
   Host: auth
   Value: <provider-hostname>
   ```

## Useful Commands

### View Logs
```bash
akash provider lease-logs \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --follow
```

### Update Deployment
```bash
# Close current deployment
akash tx deployment close \
  --dseq $DSEQ \
  --from $AKASH_KEY_NAME \
  --node $AKASH_NODE \
  --chain-id $AKASH_CHAIN_ID \
  -y

# Then repeat steps 3-7 with updated deploy-akash.yaml
```

### Check Costs
```bash
akash query market lease get \
  --dseq $DSEQ \
  --gseq 1 \
  --oseq 1 \
  --provider $PROVIDER \
  --owner $AKASH_ACCOUNT_ADDRESS \
  --node $AKASH_NODE
```

## Troubleshooting

### Build Fails
- Check logs with `lease-logs` command
- Verify GitHub repo is public and accessible
- Ensure all environment variables are set in deploy-akash.yaml

### Service Not Responding
- Check if container is running: `lease-status`
- View logs for errors: `lease-logs`
- Verify port 3000 is exposed correctly

### Database Issues
- SQLite database is ephemeral on Akash
- For persistence, consider adding persistent storage volume
- Or migrate to Turso (SQLite over HTTP)

## Cost Estimate

With current manifest (1 CPU, 1GB RAM, 3GB storage):
- **~$5-8/month** depending on provider
- **80% cheaper** than Railway/AWS
- **100% decentralized**

---

**Ready to deploy?** Run the commands above in order!
