# Linear Tickets for Privacy & Censorship Roadmap

This document contains all tickets from the PRIVACY_AND_CENSORSHIP_ROADMAP.md ready to be imported into Linear.

---

## Phase 1: Quick Wins (1-2 weeks)

### TICKET-001: Make IP Address Collection Optional
**Priority**: High
**Team**: Backend
**Labels**: privacy, security, quick-win
**Estimate**: 3 points

**Description**:
Add environment variable configuration to make IP address collection optional. Currently, IP addresses are stored in plaintext in `sessions`, `verification_codes`, and `siwe_challenges` tables.

**Acceptance Criteria**:
- [ ] Add `STORE_IP_ADDRESSES` environment variable (options: `true`, `hashed`, `false`)
- [ ] Add `STORE_USER_AGENTS` environment variable (options: `true`, `false`)
- [ ] Create `getIPAddress()` utility function in `src/utils/privacy.ts`
- [ ] Update all routes to use utility function instead of direct access
- [ ] Default to `false` for maximum privacy
- [ ] Update `.env.example` with documentation
- [ ] Update PRIVACY_POLICY.md to reflect configurability

**Files to Modify**:
- `src/utils/privacy.ts` (new file)
- `src/routes/auth/email.ts`
- `src/routes/auth/sms.ts`
- `src/routes/auth/wallet.ts`
- `src/routes/auth/session.ts`
- `.env.example`

**Related Roadmap**: Section 1.1

---

### TICKET-002: Implement IP Address Hashing
**Priority**: High
**Team**: Backend
**Labels**: privacy, security, cryptography
**Estimate**: 5 points

**Description**:
Instead of storing raw IP addresses, implement hashing with daily salt rotation. This allows fraud detection and rate limiting without long-term user identification.

**Acceptance Criteria**:
- [ ] Create `hashIP()` function using SHA-256 with daily salt
- [ ] Salt format: `YYYY-MM-DD` (rotates daily)
- [ ] Store only 16-character hash (not reversible)
- [ ] Update database to accept null IP addresses
- [ ] Add migration script for existing data
- [ ] Document hashing mechanism in SECURITY.md

**Implementation**:
```typescript
// src/utils/privacy.ts
import { sha256 } from '@noble/hashes/sha256';

export function hashIP(ip: string | undefined): string | undefined {
  if (!ip || process.env.STORE_IP_ADDRESSES === 'false') {
    return undefined;
  }

  const salt = new Date().toISOString().split('T')[0]; // Daily salt
  return Buffer.from(sha256(ip + salt)).toString('hex').substring(0, 16);
}
```

**Related Roadmap**: Section 1.1
**Depends On**: TICKET-001

---

### TICKET-003: Encrypt OAuth Tokens at Rest
**Priority**: High
**Team**: Backend
**Labels**: security, encryption, oauth
**Estimate**: 8 points

**Description**:
OAuth access and refresh tokens are currently stored in plaintext in the `auth_methods` table. Encrypt them using AES-256-GCM before storage.

**Acceptance Criteria**:
- [ ] Create encryption utility in `src/utils/encryption.ts`
- [ ] Use AES-256-GCM algorithm
- [ ] Store encryption key in `OAUTH_ENCRYPTION_KEY` env var
- [ ] Encrypt `oauth_access_token` before INSERT/UPDATE
- [ ] Decrypt on SELECT
- [ ] Add key rotation mechanism
- [ ] Write migration script for existing tokens
- [ ] Update tests to verify encryption
- [ ] Document in SECURITY.md

**Files to Create/Modify**:
- `src/utils/encryption.ts` (new)
- `src/services/db.service.ts`
- `src/services/oauth.service.ts`
- `migrations/004_encrypt_oauth_tokens.sql` (new)

**Security Notes**:
- Use `crypto.randomBytes(32)` for key generation
- Never log decrypted tokens
- Consider HSM for production key storage

**Related Roadmap**: Section 1.5

---

### TICKET-004: Auto-Delete Expired Verification Codes
**Priority**: Medium
**Team**: Backend
**Labels**: privacy, data-minimization, database
**Estimate**: 3 points

**Description**:
Verification codes are currently stored indefinitely. Implement automatic cleanup to delete codes 24 hours after expiration.

**Acceptance Criteria**:
- [ ] Create database trigger or cron job for cleanup
- [ ] Delete codes where `expires_at < NOW() - 24 hours`
- [ ] Log deletion counts (no PII)
- [ ] Add cleanup job to deployment docs
- [ ] Test cleanup doesn't affect active codes
- [ ] Update PRIVACY_POLICY.md with retention policy

**Implementation Options**:
1. **Database Trigger** (SQLite/Postgres):
   ```sql
   CREATE TRIGGER cleanup_old_verification_codes
   AFTER INSERT ON verification_codes
   BEGIN
     DELETE FROM verification_codes
     WHERE expires_at < (strftime('%s', 'now') * 1000) - 86400000;
   END;
   ```

2. **Cron Job**:
   ```typescript
   // Run every hour
   setInterval(async () => {
     const deleted = await db.prepare(`
       DELETE FROM verification_codes
       WHERE expires_at < ?
     `).run(Date.now() - 86400000);

     logger.info('Cleaned expired codes', { count: deleted.changes });
   }, 3600000);
   ```

**Related Roadmap**: Section 1.1

---

### TICKET-005: Add Data Export API Endpoint
**Priority**: High
**Team**: Backend
**Labels**: privacy, gdpr, api
**Estimate**: 5 points

**Description**:
GDPR requires users to export their data. Create a `GET /account/export` endpoint that returns all user data in JSON format.

**Acceptance Criteria**:
- [ ] Create `GET /account/export` endpoint
- [ ] Require authentication (JWT)
- [ ] Include all user data (profile, auth methods, sessions)
- [ ] Exclude sensitive data (hashed tokens, internal IDs)
- [ ] Return JSON format (human-readable)
- [ ] Add rate limiting (1 request/hour per user)
- [ ] Log export requests (audit trail)
- [ ] Add tests for endpoint
- [ ] Document in API.md

**Response Format**:
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z",
    "profile": { ... }
  },
  "auth_methods": [...],
  "active_sessions": [...],
  "exported_at": "2024-11-12T00:00:00Z"
}
```

**Related Roadmap**: Section 1.3
**GDPR Article**: Article 20 (Data Portability)

---

### TICKET-006: Create Tor Hidden Service Deployment Guide
**Priority**: High
**Team**: DevOps, Documentation
**Labels**: censorship-resistance, documentation, quick-win
**Estimate**: 3 points

**Description**:
Create comprehensive guide for deploying the auth service as a Tor hidden service (.onion address).

**Acceptance Criteria**:
- [ ] Create `TOR_DEPLOYMENT.md` document
- [ ] Include installation steps (Tor setup)
- [ ] Configure hidden service in `/etc/tor/torrc`
- [ ] CORS configuration for .onion domains
- [ ] Security hardening checklist
- [ ] Testing procedures
- [ ] Troubleshooting section
- [ ] Update README.md with .onion address (when deployed)

**Document Sections**:
1. Prerequisites (Tor installation)
2. Configuration (torrc setup)
3. Service deployment
4. DNS/discovery setup
5. Security considerations
6. Monitoring & maintenance

**Related Roadmap**: Section 2.1

---

### TICKET-007: Create CONTRIBUTING.md
**Priority**: High
**Team**: Documentation
**Labels**: open-source, community, documentation
**Estimate**: 2 points

**Status**: ✅ **COMPLETED**

**Description**:
Create comprehensive contributing guidelines for open-source contributors.

**Files Created**:
- ✅ `CONTRIBUTING.md`

---

### TICKET-008: Create CODE_OF_CONDUCT.md
**Priority**: High
**Team**: Documentation
**Labels**: open-source, community, governance
**Estimate**: 2 points

**Status**: ✅ **COMPLETED**

**Description**:
Establish code of conduct for community members and contributors.

**Files Created**:
- ✅ `CODE_OF_CONDUCT.md`

---

### TICKET-009: Create PRIVACY_POLICY.md
**Priority**: High
**Team**: Legal, Documentation
**Labels**: privacy, compliance, documentation
**Estimate**: 2 points

**Status**: ✅ **COMPLETED**

**Description**:
Create transparent privacy policy documenting data collection, user rights, and GDPR/CCPA compliance.

**Files Created**:
- ✅ `PRIVACY_POLICY.md`

---

### TICKET-010: Create Privacy FAQ
**Priority**: Medium
**Team**: Documentation
**Labels**: privacy, documentation, quick-win
**Estimate**: 3 points

**Description**:
Create a user-friendly FAQ addressing common privacy questions.

**Acceptance Criteria**:
- [ ] Create `PRIVACY_FAQ.md`
- [ ] Cover data collection questions
- [ ] Explain anonymous authentication options
- [ ] Document self-hosting for privacy
- [ ] Include GDPR rights explanation
- [ ] Link from main README
- [ ] Keep under 2000 words (concise)

**Topics to Cover**:
- What data is collected?
- Can I use this anonymously?
- How long is data stored?
- Can I self-host?
- What are my rights (GDPR)?
- How to delete my account?
- Comparison with competitors
- Tor support

**Related Roadmap**: Section 5.2

---

## Phase 2: Core Privacy (1 month)

### TICKET-011: Implement Client-Side Profile Encryption
**Priority**: Medium
**Team**: Frontend, Backend
**Labels**: privacy, encryption, zero-knowledge
**Estimate**: 13 points

**Description**:
Encrypt user profile data (display name, avatar URL) client-side before sending to server. Server stores encrypted data without knowing plaintext.

**Acceptance Criteria**:
- [ ] Add encryption to client SDK
- [ ] Use AES-256-GCM with user-derived key
- [ ] Key derivation from password/passphrase (Argon2)
- [ ] Update database schema for encrypted fields
- [ ] Server never sees plaintext profile data
- [ ] Client decrypts on retrieval
- [ ] Document key management
- [ ] Update API docs

**Implementation Notes**:
- User provides password/passphrase for encryption
- Keys never sent to server
- Lost passphrase = lost profile data (trade-off for privacy)
- Optional feature (users can choose plaintext if preferred)

**Related Roadmap**: Section 1.3

---

### TICKET-012: Add Session TTL and Cleanup
**Priority**: Medium
**Team**: Backend
**Labels**: privacy, data-minimization, security
**Estimate**: 5 points

**Description**:
Implement automatic cleanup of expired sessions and revoked tokens.

**Acceptance Criteria**:
- [ ] Create cleanup cron job
- [ ] Delete sessions where `expires_at < NOW()`
- [ ] Delete revoked sessions older than 90 days
- [ ] Log cleanup metrics (counts, not PII)
- [ ] Add to deployment documentation
- [ ] Test doesn't affect active sessions

**Related Roadmap**: Section 1.1

---

### TICKET-013: Create Self-Hosting Guide
**Priority**: High
**Team**: DevOps, Documentation
**Labels**: documentation, self-hosting, deployment
**Estimate**: 8 points

**Description**:
Create comprehensive self-hosting guide with one-click deployment options.

**Acceptance Criteria**:
- [ ] Create `SELF_HOSTING.md`
- [ ] Docker Compose setup
- [ ] Kubernetes Helm chart
- [ ] Environment variables documentation
- [ ] Database setup guide
- [ ] Reverse proxy configuration (Caddy/Nginx)
- [ ] Backup procedures
- [ ] Monitoring setup
- [ ] Update procedures
- [ ] Troubleshooting section
- [ ] Security hardening checklist

**Deployment Options**:
1. Docker Compose (quickest)
2. Kubernetes/Helm
3. Manual installation
4. Akash Network

**Related Roadmap**: Section 5.1

---

### TICKET-014: Implement Account Deletion with Cascade
**Priority**: High
**Team**: Backend
**Labels**: privacy, gdpr, data-deletion
**Estimate**: 5 points

**Description**:
Ensure `DELETE /account/profile` properly deletes all user data with cascade and soft-delete grace period.

**Acceptance Criteria**:
- [ ] Mark account as deleted (soft delete)
- [ ] Revoke all active sessions immediately
- [ ] Delete verification codes
- [ ] Schedule hard delete after 90 days
- [ ] Remove from backups after 90 days
- [ ] Allow recovery within 90 days
- [ ] Log deletion requests (audit trail)
- [ ] Update PRIVACY_POLICY.md

**Database Changes**:
```sql
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE users ADD COLUMN hard_delete_at INTEGER;
```

**Related Roadmap**: PRIVACY_POLICY.md
**GDPR Article**: Article 17 (Right to Erasure)

---

## Phase 3: Advanced Features (2-3 months)

### TICKET-015: Add Nostr Authentication Support
**Priority**: Medium
**Team**: Backend
**Labels**: privacy, anonymous-auth, web3, nostr
**Estimate**: 13 points

**Description**:
Implement Nostr-based authentication using NIP-98 HTTP Auth. Enables truly anonymous authentication with just a public key.

**Acceptance Criteria**:
- [ ] Create `/auth/nostr/challenge` endpoint
- [ ] Create `/auth/nostr/verify` endpoint
- [ ] Verify Nostr signatures (NIP-98)
- [ ] Store only public key (npub)
- [ ] No email/phone required
- [ ] Compatible with Nostr clients (Damus, Amethyst, etc.)
- [ ] Add tests for Nostr auth flow
- [ ] Document in API.md

**Technical Specs**:
- NIP-98: HTTP Auth (event kind 27235)
- Signature verification using `@noble/secp256k1`
- Challenge must include timestamp and nonce

**Related Roadmap**: Section 1.2

---

### TICKET-016: Add IPFS Avatar Support
**Priority**: Low
**Team**: Backend, Frontend
**Labels**: decentralization, ipfs, censorship-resistance
**Estimate**: 5 points

**Description**:
Support IPFS and Arweave URLs for user avatars instead of centralized HTTP URLs.

**Acceptance Criteria**:
- [ ] Accept `ipfs://` and `ar://` URLs
- [ ] Convert to gateway URLs for display
- [ ] Validate IPFS CIDs
- [ ] Update avatar URL validation
- [ ] Document in API.md
- [ ] Add examples to docs

**URL Formats**:
- `ipfs://Qm...` → `https://ipfs.io/ipfs/Qm...`
- `ar://xxx...` → `https://arweave.net/xxx...`
- `https://...` (still supported)

**Related Roadmap**: Section 2.2

---

### TICKET-017: Implement Decentralized Identity (DIDs)
**Priority**: Low
**Team**: Backend
**Labels**: web3, did, standards, w3c
**Estimate**: 21 points

**Description**:
Support W3C Decentralized Identifiers (DIDs) for authentication. Compatible with did:web, did:key, did:ethr, etc.

**Acceptance Criteria**:
- [ ] Create `/auth/did/challenge` endpoint
- [ ] Create `/auth/did/verify` endpoint
- [ ] Support did:web resolution
- [ ] Support did:key (self-sovereign)
- [ ] Support did:ethr (Ethereum)
- [ ] Verify DID signatures
- [ ] Store DID as identifier
- [ ] Add DID Auth documentation

**Standards**:
- W3C DID Core Specification
- W3C Verifiable Credentials

**Related Roadmap**: Section 4.1

---

### TICKET-018: Security Audit by Third Party
**Priority**: High
**Team**: Security, Management
**Labels**: security, audit, compliance
**Estimate**: N/A (external)

**Description**:
Contract third-party security firm to audit codebase for vulnerabilities.

**Acceptance Criteria**:
- [ ] Select auditor (Trail of Bits, Cure53, or OSSF)
- [ ] Provide codebase access
- [ ] Address critical findings
- [ ] Publish audit report
- [ ] Add badge to README

**Recommended Auditors**:
1. **Trail of Bits** ($50-100k) - Top tier
2. **Cure53** ($30-60k) - Privacy specialists
3. **OSSF** (Free) - Open source projects

**Related Roadmap**: Section 3.3

---

## Phase 4: Future (6+ months)

### TICKET-019: Federation Support (ActivityPub)
**Priority**: Low
**Team**: Backend
**Labels**: decentralization, federation, activitypub
**Estimate**: 34 points

**Description**:
Allow multiple instances to federate, enabling users to authenticate across trusted instances.

**Acceptance Criteria**:
- [ ] Implement ActivityPub protocol
- [ ] Instance discovery mechanism
- [ ] Trust/federation management
- [ ] Cross-instance token verification
- [ ] Add federation admin panel
- [ ] Document federation setup

**Related Roadmap**: Section 2.4

---

### TICKET-020: Post-Quantum Cryptography Support
**Priority**: Low
**Team**: Cryptography, Backend
**Labels**: cryptography, future-proof, research
**Estimate**: 34 points

**Description**:
Add post-quantum cryptography algorithms to protect against future quantum computers.

**Acceptance Criteria**:
- [ ] Research PQC algorithms (Kyber, Dilithium)
- [ ] Implement hybrid signatures (classical + PQC)
- [ ] Add PQC option for JWT signing
- [ ] Backward compatibility with existing tokens
- [ ] Performance benchmarks
- [ ] Documentation

**Algorithms**:
- **Kyber** (key exchange)
- **Dilithium** (signatures)

**Related Roadmap**: Section 4.2

---

### TICKET-021: Privacy-Preserving Rate Limiting
**Priority**: Low
**Team**: Backend, Cryptography
**Labels**: privacy, rate-limiting, cryptography
**Estimate**: 21 points

**Description**:
Implement PrivacyPass-style anonymous credentials for rate limiting without IP addresses.

**Acceptance Criteria**:
- [ ] Issue anonymous tokens for rate limiting
- [ ] Blind signature protocol
- [ ] Token redemption without identification
- [ ] Replace IP-based rate limiting
- [ ] Performance optimization
- [ ] Documentation

**Similar To**: Cloudflare PrivacyPass

**Related Roadmap**: Section 4.3

---

### TICKET-022: Offline Authentication Codes
**Priority**: Low
**Team**: Backend, Mobile
**Labels**: censorship-resistance, offline
**Estimate**: 13 points

**Description**:
Support offline authentication with pre-generated codes that work without server connection.

**Acceptance Criteria**:
- [ ] Generate offline codes (when online)
- [ ] Store encrypted on client
- [ ] Validate codes locally
- [ ] Limited uses per code
- [ ] Expiration handling
- [ ] Sync when back online

**Use Cases**:
- Network outages
- Censorship/blocking
- Air-gapped environments

**Related Roadmap**: Section 2.5

---

## Documentation & Community

### TICKET-023: Create Transparency Report Template
**Priority**: Medium
**Team**: Legal, Documentation
**Labels**: transparency, governance, trust
**Estimate**: 3 points

**Description**:
Create quarterly transparency report template documenting data requests, security incidents, and infrastructure.

**Acceptance Criteria**:
- [ ] Create `TRANSPARENCY_REPORT.md` template
- [ ] Include sections: data requests, security incidents, uptime
- [ ] Publish Q1 2025 report
- [ ] Automate metrics collection
- [ ] Schedule quarterly publication

**Sections**:
- Data/subpoena requests received
- Security incidents
- Vulnerabilities reported/fixed
- Infrastructure statistics
- Instance deployments

**Related Roadmap**: Section 3.2

---

### TICKET-024: Set Up Bug Bounty Program
**Priority**: Medium
**Team**: Security, Management
**Labels**: security, community, bug-bounty
**Estimate**: 5 points

**Description**:
Establish bug bounty program to incentivize security researchers.

**Acceptance Criteria**:
- [ ] Define scope (in-scope/out-of-scope)
- [ ] Set bounty amounts by severity
- [ ] Create submission process
- [ ] Set up HackerOne or self-hosted
- [ ] Announce on social media
- [ ] Add to SECURITY.md

**Suggested Bounties**:
- Authentication bypass: $500-5000
- Data leakage: $200-2000
- XSS/Injection: $100-1000

**Related Roadmap**: Section 3.3

---

### TICKET-025: Reproducible Builds
**Priority**: Medium
**Team**: DevOps
**Labels**: security, supply-chain, builds
**Estimate**: 8 points

**Description**:
Enable reproducible builds so anyone can verify build artifacts.

**Acceptance Criteria**:
- [ ] Pin all dependencies with exact versions
- [ ] Pin base Docker images with SHA256
- [ ] Deterministic build process
- [ ] Document build reproduction steps
- [ ] Publish checksums for releases
- [ ] Automate verification

**Related Roadmap**: Section 3.4

---

## Import Instructions

### For Linear:

1. **Via CSV Import**:
   - Export this to CSV format
   - Import via Linear Settings → Import → CSV

2. **Via Linear API**:
   ```bash
   # Use Linear GraphQL API to create issues programmatically
   ```

3. **Manual Creation**:
   - Copy each ticket
   - Create as Linear issue
   - Set team, priority, labels, estimate

### For GitHub Issues:

If you prefer GitHub Issues with Linear sync:

```bash
# Create issues via gh CLI
gh issue create --title "TICKET-001: Make IP Collection Optional" \
  --body "$(cat ticket-001-body.md)" \
  --label "privacy,security,quick-win"
```

---

## Summary Stats

**Total Tickets**: 25
**Phase 1 (Quick Wins)**: 10 tickets (33 points estimated)
**Phase 2 (Core Privacy)**: 4 tickets (33 points estimated)
**Phase 3 (Advanced)**: 4 tickets (60 points estimated)
**Phase 4 (Future)**: 4 tickets (102 points estimated)
**Documentation**: 3 tickets (13 points estimated)

**Completed**: 3 tickets ✅
**Remaining**: 22 tickets

**Priority Breakdown**:
- High: 12 tickets
- Medium: 7 tickets
- Low: 6 tickets

---

**Questions?** Contact: team@alternatefutures.ai
