# Deploy to Railway in 5 Minutes

Quick guide to deploy the auth service to Railway for testing.

## Step 1: Push to GitHub (if not already)

```bash
cd /Users/wonderwomancode/Projects/fleek/alternatefutures-auth

# Initialize git if needed
git init
git add .
git commit -m "feat: Ready for Railway deployment"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/alternatefutures-auth.git
git push -u origin main
```

## Step 2: Deploy to Railway

### Option A: Railway CLI (Fastest)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Option B: Railway Dashboard (Recommended for OAuth URLs)

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `alternatefutures-auth`
5. Railway will auto-detect Dockerfile and deploy

## Step 3: Add Environment Variables

In Railway Dashboard → Variables, add:

```bash
# Database
DATABASE_URL=auth.db

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=<your-generated-secret>
JWT_REFRESH_SECRET=<your-generated-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (Resend)
RESEND_API_KEY=<your-resend-key>

# SMS (httpSMS)
HTTPSMS_API_KEY=<your-httpsms-key>
HTTPSMS_PHONE_NUMBER=<your-phone-number>

# OAuth - Google
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-secret>
GOOGLE_REDIRECT_URI=https://your-app.up.railway.app/auth/oauth/callback/google

# OAuth - GitHub
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-secret>
GITHUB_REDIRECT_URI=https://your-app.up.railway.app/auth/oauth/callback/github

# OAuth - Twitter
TWITTER_CLIENT_ID=<your-twitter-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-secret>
TWITTER_REDIRECT_URI=https://your-app.up.railway.app/auth/oauth/callback/twitter

# OAuth - Discord
DISCORD_CLIENT_ID=<your-discord-client-id>
DISCORD_CLIENT_SECRET=<your-discord-secret>
DISCORD_REDIRECT_URI=https://your-app.up.railway.app/auth/oauth/callback/discord

# Server Config
PORT=3000
NODE_ENV=production
APP_URL=https://your-app.up.railway.app
FRONTEND_URL=https://alternatefutures.ai
CORS_ORIGIN=https://alternatefutures.ai
```

## Step 4: Get Your Production URL

Railway will assign you a URL like: `https://alternatefutures-auth-production.up.railway.app`

Find it in: **Settings → Domains → Generate Domain**

## Step 5: Update OAuth Redirect URIs

Now go back to each OAuth provider and add the production URLs:

### Google Cloud Console
- Add redirect URI: `https://your-app.up.railway.app/auth/oauth/callback/google`

### GitHub Developer Settings
- Add callback URL: `https://your-app.up.railway.app/auth/oauth/callback/github`

### Twitter Developer Portal
- Add redirect URI: `https://your-app.up.railway.app/auth/oauth/callback/twitter`

### Discord Developer Portal
- Add redirect: `https://your-app.up.railway.app/auth/oauth/callback/discord`

## Step 6: Test Your Auth Service

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test email authentication
curl -X POST https://your-app.up.railway.app/auth/email/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# Test OAuth (visit in browser)
https://your-app.up.railway.app/auth/oauth/google
```

## Step 7: Add Custom Domain (Optional)

1. In Railway: **Settings → Domains → Custom Domain**
2. Add: `auth.alternatefutures.ai`
3. Update DNS in Namecheap:
   ```
   Type: CNAME
   Host: auth
   Value: your-app.up.railway.app
   ```

## Troubleshooting

### View Logs
Railway Dashboard → Deployments → Click deployment → View Logs

### Database Issues
Railway uses ephemeral filesystem. For production, add a persistent volume:
- Railway Dashboard → Settings → Volumes → Add Volume
- Mount path: `/app/data`
- Update DATABASE_URL: `/app/data/auth.db`

### Port Issues
Make sure `PORT` environment variable is set (Railway automatically sets this)

## Cost

- **Free Tier**: $5 credit/month
- **Pro**: $20/month for team features
- This service will likely stay within free tier for testing

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test all OAuth flows
3. ✅ Verify email/SMS work
4. 🔄 Once stable, migrate to Akash for decentralization

---

**Deployment Status**: Ready to deploy! 🚀
