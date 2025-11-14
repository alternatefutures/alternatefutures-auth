# Alternate Futures Authentication System - Implementation Plan

**Version**: 2.0
**Date**: 2025-01-14
**Status**: Planning
**Timeline**: 3 Months
**Philosophy**: DePIN-Native, Privy-Style UX

---

## Executive Summary

Build a **world-class authentication system** that matches Privy.io's UX while running entirely on DePIN infrastructure (our own **AF Functions** platform + OrbitDB). This will be the authentication backbone for Alternate Futures and a showcase of our platform's capabilities.

**Key Goals**:
1. ✅ Beautiful Privy-style modal UI (Svelte components)
2. ✅ Multi-method auth (Email, SMS, Social, Web3 Wallets)
3. ✅ Deploy on **AF Functions** (eat our own dog food!)
4. ✅ DePIN-native data layer (OrbitDB + IPFS)
5. ✅ 70-90% cost savings vs centralized solutions

**Timeline**: 3 months (12 weeks)
**Cost**: $0-5/month vs $50+/month for centralized

---

## Table of Contents

1. [Current State](#current-state)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Implementation Phases](#implementation-phases)
5. [Deployment Strategy](#deployment-strategy)
6. [Success Metrics](#success-metrics)
7. [Timeline & Milestones](#timeline--milestones)

---

## Current State

### ✅ Backend: 95% Complete

Our `service-auth` backend is production-ready:

- ✅ **Email Magic Links** (Resend integration)
- ✅ **SMS OTP** (httpSMS - already implemented!)
- ✅ **Web3 Wallets** (SIWE - Ethereum + Solana)
- ✅ **OAuth Social** (Google, GitHub, Twitter, Discord)
- ✅ **JWT Sessions** (Access + refresh tokens)
- ✅ **Account Linking** (Multiple auth methods per user)
- ✅ **Rate Limiting** (IP-based, configurable)
- ✅ **Personal Access Tokens** (Bonus feature!)
- ✅ **Comprehensive Tests** (1,124 lines, 8 test files)
- ✅ **Documentation** (12+ markdown files)

**Database**: SQLite (220 lines schema) with tables for users, auth_methods, sessions, verification_codes, siwe_challenges, mfa_settings, rate_limits, personal_access_tokens.

### ❌ What's Missing

**Frontend (0% complete)**:
- No Svelte component library
- No AuthModal, OTP input, wallet UI
- No design system

**Structure**:
- Not monorepo (need packages/auth-service + packages/auth-ui)

**DePIN Infrastructure**:
- Not deployed to AF Functions
- Still using SQLite (need OrbitDB migration)

**Advanced Features**:
- MFA/2FA (tables exist, no logic)
- WebAuthn/Passkeys
- Account recovery flows

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend Layer                            │
│  @alternatefutures/auth-ui (Svelte 5)                       │
│  └─ AuthModal, WalletConnect, AccountSettings              │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│              Auth Service (Hono Framework)                  │
│  Deployed on: AF Functions ⭐ (Primary)                     │
│               Akash Network (Backup)                         │
│                                                              │
│  Routes: /auth/email, /auth/sms, /auth/wallet,             │
│          /auth/oauth, /account/*                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  OrbitDB + IPFS (DePIN-native)                             │
│  ├─ usersDB (docstore)                                      │
│  ├─ sessionsDB (keyvalue)                                   │
│  ├─ authMethodsDB (docstore)                                │
│  └─ auditLogDB (eventlog)                                   │
│                                                              │
│  Pinning: web3.storage (free tier)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend (`@alternatefutures/auth-ui`)
- **Framework**: Svelte 5
- **Build**: Vite + SvelteKit packaging
- **Styling**: CSS Variables (themeable)
- **Web3**: wagmi/viem (Ethereum), @solana/web3.js, WalletConnect v2
- **State**: Svelte stores

### Backend (`auth-service`)
- **Framework**: Hono (edge-compatible)
- **Runtime**: Node.js 20+ / Edge Runtime
- **JWT**: jose
- **Validation**: Zod
- **Database**: OrbitDB + IPFS (target), SQLite (current)

### Deployment
- **Primary**: **AF Functions** (our platform!)
- **Backup**: Akash Network
- **Fallback**: Railway (dev/staging)

---

## Implementation Phases

### 📅 Month 1: Foundation & UI (Weeks 1-4)

#### Week 1: Monorepo + Design System
**Tasks**:
- Set up pnpm monorepo structure
- Create `packages/auth-service` and `packages/auth-ui`
- Implement CSS design system (Privy-inspired)
- Build base components (Button, Input, Modal, OTPInput)

**Deliverables**:
- ✅ Monorepo structure
- ✅ Design system with light/dark themes
- ✅ 6 reusable base components

#### Week 2-3: AuthModal Components
**Tasks**:
- Build EmailAuth.svelte (magic links)
- Build SMSAuth.svelte (OTP)
- Build SocialAuth.svelte (OAuth providers)
- Build WalletAuth.svelte (Web3 wallets)
- Implement main AuthModal with state machine

**Deliverables**:
- ✅ Complete AuthModal component
- ✅ All 4 auth method UIs

#### Week 4: Auth Client & Stores
**Tasks**:
- Build API client (typed fetch wrapper)
- Create Svelte stores (user, session, isAuthenticated)
- Implement useAuth composable
- Web3 integration (wagmi, Solana wallet adapter)

**Deliverables**:
- ✅ Auth client library
- ✅ Svelte stores
- ✅ Web3 wallet integration

---

### 📅 Month 2: Examples, DePIN & Deployment (Weeks 5-8)

#### Week 5: Examples & Documentation
**Tasks**:
- Create SvelteKit example
- Create Next.js example
- Create vanilla JS example
- Write getting started docs
- Write API reference

**Deliverables**:
- ✅ 3 working examples
- ✅ Comprehensive documentation

#### Week 6: OrbitDB Migration
**Tasks**:
- Implement OrbitDB service layer
- Create migration script from SQLite
- Set up IPFS pinning (web3.storage)
- Dual-write implementation (SQLite + OrbitDB)

**Deliverables**:
- ✅ OrbitDB implementation
- ✅ Data migration complete
- ✅ IPFS pinning configured

#### Week 7: AF Functions Deployment
**Tasks**:
- Create af.config.ts
- Update entry point for edge runtime
- Deploy to AF Functions
- Set up environment variables
- Configure monitoring

**Deliverables**:
- ✅ Auth service deployed to AF Functions
- ✅ Production URL live
- ✅ Monitoring configured

#### Week 8: Akash Backup Deployment
**Tasks**:
- Create Dockerfile with OrbitDB
- Write Akash deployment manifest
- Set up CI/CD pipeline
- Deploy to Akash Network

**Deliverables**:
- ✅ Akash deployment live
- ✅ Multi-cloud redundancy
- ✅ Automated deployments

---

### 📅 Month 3: Advanced Features & Launch (Weeks 9-12)

#### Week 9-10: Advanced Features
**Tasks**:
- Implement MFA/2FA (TOTP, SMS, Email)
- Build WebAuthn/Passkeys support
- Create account recovery flows
- Add session management UI

**Deliverables**:
- ✅ MFA implementation
- ✅ WebAuthn support
- ✅ Account recovery

#### Week 11: Testing & Security
**Tasks**:
- Write comprehensive unit tests
- Integration tests for all flows
- E2E tests (Playwright)
- Security audit (internal)
- Performance optimization
- Dependency audit

**Deliverables**:
- ✅ 85%+ test coverage
- ✅ All security issues resolved
- ✅ Performance targets met

#### Week 12: Polish & Launch
**Tasks**:
- Final documentation pass
- Create landing page
- Write launch blog posts
- Publish npm package
- Launch marketing campaign
- Monitor feedback

**Deliverables**:
- ✅ v1.0 launched
- ✅ npm package published
- ✅ Marketing materials live

---

## Deployment Strategy

### Primary: AF Functions ⭐

**Why**: Showcase our own platform, 90% cost savings, DePIN-native

**Deployment**:
```bash
af functions create --name auth-service
af functions deploy --name auth-service --path ./dist/index.js \
  --env JWT_SECRET=xxx --env DATABASE_URL=xxx
```

**Cost**: $0-5/month

### Backup: Akash Network

**Why**: Decentralized Kubernetes, full Docker support

**Cost**: ~$15-20/month

### Development: Railway

**Why**: Easy local development, staging environment

**Cost**: $5/month (staging only)

---

## Success Metrics

### Technical
- ✅ API uptime: 99.9%+
- ✅ API response time: <100ms (p95)
- ✅ Modal load: <200ms
- ✅ Bundle size: <50KB gzipped
- ✅ Test coverage: 85%+

### Business
- ✅ 1000+ npm downloads (Month 1)
- ✅ 500+ GitHub stars (Month 3)
- ✅ 5+ production deployments
- ✅ 70-90% cost savings vs centralized

### DePIN
- ✅ Deployed on AF Functions
- ✅ OrbitDB + IPFS data layer
- ✅ <$10/month production cost
- ✅ Platform showcase for potential customers

---

## Timeline & Milestones

```
Month 1 (Weeks 1-4):  Foundation & UI
├─ Week 1: Monorepo + Design System ✓
├─ Week 2-3: AuthModal Components ✓
└─ Week 4: Auth Client & Stores ✓

Month 2 (Weeks 5-8):  DePIN & Deployment
├─ Week 5: Examples & Docs ✓
├─ Week 6: OrbitDB Migration ✓
├─ Week 7: AF Functions Deploy ✓
└─ Week 8: Akash Backup Deploy ✓

Month 3 (Weeks 9-12): Advanced Features & Launch
├─ Week 9-10: MFA, WebAuthn, Recovery ✓
├─ Week 11: Testing & Security ✓
└─ Week 12: Polish & Launch ✓
```

**Total Duration**: 12 weeks (3 months)
**Effort**: ~240-280 developer hours
**Team**: 1 full-stack developer + 0.5 DevOps (or 1 solo dev)

---

## Cost Analysis

### Before (Centralized)
- Cloudflare Workers: $5/mo
- Turso Database: $29/mo
- Resend Email: $20/mo
- SMS: Variable
- **Total: ~$54+/month**

### After (DePIN - AF Functions)
- **AF Functions: $0-5/mo** ⭐
- OrbitDB + IPFS: $0 (self-hosted)
- web3.storage: $0 (free tier)
- Resend: $0 (free tier)
- **Total: $0-5/month**

**Savings**: ~$50/month (90% cheaper!)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OrbitDB performance | Caching layer, SQLite fallback |
| AF Functions downtime | Akash backup deployment |
| IPFS pinning failure | Multiple pinning services |
| Low adoption | Marketing, examples, docs |
| Security issues | Audit, bug bounty program |

---

## Next Steps

- ⬜ Review and approve this plan (come back to later)
- 🚀 Begin Phase 1: Monorepo restructure (Week 1)
- 🚀 Deploy to AF Functions (Week 7)
- 🚀 Launch v1.0 (Week 12)

**Philosophy**: "Eat our own dog food" by deploying on **AF Functions**, the DePIN platform we're building.

---

**Status**: Ready for implementation
**Owner**: @wonderwomancode
**Target Launch**: April 2025 (3 months)
**Last Updated**: 2025-01-14
