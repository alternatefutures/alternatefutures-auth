# Alternate Futures Authentication Service

Multi-method authentication system supporting email, SMS, Web3 wallets, and social OAuth providers.

## Features

- 🔐 **Passwordless Authentication**
  - Email magic links
  - SMS OTP codes

- 🦊 **Web3 Wallet Support**
  - Sign-In with Ethereum (SIWE)
  - MetaMask, WalletConnect, Phantom
  - Support for Ethereum and Solana

- 🌐 **Social OAuth Providers**
  - Google, Apple, Twitter/X
  - Discord, GitHub, LinkedIn
  - Spotify, Instagram, Telegram
  - TikTok, Farcaster

- 🔗 **Account Linking**
  - Link multiple auth methods to one account
  - Unified user identity

- 🛡️ **Security**
  - JWT-based sessions with refresh tokens
  - Multi-factor authentication (MFA)
  - Rate limiting
  - Secure key storage

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Hono (edge-compatible)
- **Database**: D1 (Cloudflare) or Turso (SQLite)
- **Email**: Resend or SendGrid
- **SMS**: Twilio
- **Web3**: @noble/secp256k1, viem

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

```bash
# Database
DATABASE_URL=

# JWT Secrets
JWT_SECRET=
JWT_REFRESH_SECRET=

# Email (Resend)
RESEND_API_KEY=

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Add more as needed
```

## API Endpoints

### Authentication

```
POST   /auth/email/request      # Request email magic link
POST   /auth/email/verify       # Verify email code
POST   /auth/sms/request        # Request SMS OTP
POST   /auth/sms/verify         # Verify SMS OTP
POST   /auth/wallet/challenge   # Get SIWE challenge
POST   /auth/wallet/verify      # Verify wallet signature
GET    /auth/oauth/:provider    # Initiate OAuth flow
GET    /auth/oauth/callback     # OAuth callback
POST   /auth/refresh            # Refresh access token
POST   /auth/logout             # Logout (invalidate tokens)
```

### Account Management

```
GET    /account/profile         # Get user profile
PATCH  /account/profile         # Update profile
GET    /account/methods         # List linked auth methods
POST   /account/methods/link    # Link new auth method
DELETE /account/methods/:id     # Unlink auth method
```

## Project Structure

```
alternatefutures-auth/
├── src/
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── email.ts        # Email magic link
│   │   │   ├── sms.ts          # SMS OTP
│   │   │   ├── wallet.ts       # Web3 wallet (SIWE)
│   │   │   ├── oauth.ts        # Social OAuth
│   │   │   └── session.ts      # JWT sessions
│   │   └── account/
│   │       ├── profile.ts      # User profile
│   │       └── methods.ts      # Auth methods management
│   ├── services/
│   │   ├── jwt.service.ts      # JWT generation/validation
│   │   ├── email.service.ts    # Email sending (Resend)
│   │   ├── sms.service.ts      # SMS sending (Twilio)
│   │   ├── db.service.ts       # Database operations
│   │   └── crypto.service.ts   # Encryption/hashing
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification middleware
│   │   ├── ratelimit.ts        # Rate limiting
│   │   └── cors.ts             # CORS configuration
│   ├── models/
│   │   ├── user.ts             # User model
│   │   ├── session.ts          # Session model
│   │   └── auth-method.ts      # Auth method model
│   ├── utils/
│   │   ├── otp.ts              # OTP generation
│   │   └── validators.ts       # Input validation (Zod)
│   └── index.ts                # Main entry point
├── db/
│   └── schema.sql              # Database schema
├── tests/
│   └── auth.test.ts            # Authentication tests
├── .env.example                # Environment variables template
├── tsconfig.json               # TypeScript configuration
└── package.json
```

## Development

This is a work in progress. See the implementation roadmap in the project documentation.

## License

MIT

---

**Status**: In Development
**Version**: 0.1.0
