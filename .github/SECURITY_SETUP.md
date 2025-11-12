# Security Setup & Hardening Guide

This guide covers all security measures implemented in this repository and additional recommendations for production deployment.

## Automated Security Features

### 1. CodeQL Analysis ✅ Already Configured
**File**: `.github/workflows/codeql.yml`

- Scans code for security vulnerabilities
- Runs on every push to main and every PR
- Weekly scheduled scans on Thursdays
- Analyzes JavaScript/TypeScript code

**No action needed** - Already active

### 2. Dependabot ✅ Just Added
**File**: `.github/dependabot.yml`

- Automatically checks for vulnerable dependencies
- Creates PRs to update dependencies weekly
- Groups patch and minor updates together
- Updates both npm packages and GitHub Actions

**Enable in GitHub**:
1. Go to **Settings** → **Code security and analysis**
2. Enable **Dependabot alerts**
3. Enable **Dependabot security updates**

### 3. Dependency Review ✅ Just Added
**File**: `.github/workflows/dependency-review.yml`

- Blocks PRs that introduce vulnerable dependencies
- Fails on moderate or higher severity vulnerabilities
- Checks license compatibility
- Posts results as PR comments

**No action needed** - Runs automatically on PRs

### 4. Security Audit ✅ Just Added
**File**: `.github/workflows/security-audit.yml`

- Runs `npm audit` on every push and PR
- Fails build if critical or high vulnerabilities found
- Scans for accidentally committed secrets using TruffleHog
- Weekly scheduled audits

**No action needed** - Runs automatically

### 5. Claude Code Review ✅ Already Configured
**File**: `.github/workflows/claude-code-review.yml`

- AI-powered code review on every PR
- Reviews security, bugs, quality, and best practices

**Requires**: `ANTHROPIC_API_KEY` secret (see setup in previous response)

## GitHub Security Settings to Enable

### Required Settings

1. **Enable Secret Scanning**
   - Go to **Settings** → **Code security and analysis**
   - Enable **Secret scanning**
   - Enable **Push protection** (prevents commits with secrets)

2. **Enable Private Vulnerability Reporting**
   - Go to **Settings** → **Code security and analysis**
   - Enable **Private vulnerability reporting**
   - This allows researchers to report vulnerabilities privately

3. **Set Up Branch Protection Rules**
   - Go to **Settings** → **Branches** → **Add rule**
   - Branch name pattern: `main`
   - Enable these protections:
     - ✅ **Require a pull request before merging**
       - Require approvals: 1
     - ✅ **Require status checks to pass before merging**
       - Require branches to be up to date
       - Select required checks:
         - CodeQL
         - Security Audit / npm-audit
         - Security Audit / secrets-scan
         - Dependency Review
     - ✅ **Require conversation resolution before merging**
     - ✅ **Require signed commits** (recommended)
     - ✅ **Include administrators**
     - ✅ **Restrict who can push to matching branches**
   - Click **Create** or **Save changes**

4. **Configure Notifications**
   - Go to **Settings** → **Notifications**
   - Enable email notifications for:
     - Dependabot alerts
     - Secret scanning alerts
     - Code scanning alerts

### Recommended Settings

1. **Limit Repository Permissions**
   - Go to **Settings** → **Actions** → **General**
   - Under **Workflow permissions**:
     - Select **Read repository contents and packages permissions**
     - ✅ **Allow GitHub Actions to create and approve pull requests**

2. **Set Up Required Reviews**
   - Go to **Settings** → **Code security and analysis**
   - Under **Code review limits**:
     - Consider requiring reviews from CODEOWNERS

3. **Enable Discussions** (for security questions)
   - Go to **Settings** → **Features**
   - Enable **Discussions**
   - Create category: "Security"

## Production Deployment Security

### Environment Variables Security

**Never commit these to the repository:**
```bash
# JWT secrets (generate with: openssl rand -base64 32)
JWT_SECRET=<strong-random-string-min-32-chars>
JWT_REFRESH_SECRET=<different-strong-random-string>

# Database
DATABASE_URL=<secure-connection-string>

# Third-party services
RESEND_API_KEY=<your-key>
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>

# OAuth providers
GOOGLE_CLIENT_ID=<your-id>
GOOGLE_CLIENT_SECRET=<your-secret>
# ... other OAuth providers
```

### Security Headers

Add these headers in your deployment (Railway, Akash, etc.):

```nginx
# Nginx configuration
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

Or in your application code (Hono middleware):

```typescript
app.use('*', async (c, next) => {
  await next()
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Content-Security-Policy', "default-src 'self'")
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})
```

### Database Security

1. **Use Connection Pooling**
   - Limit concurrent connections
   - Set connection timeouts

2. **Enable SSL/TLS**
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
   ```

3. **Restrict Database User Permissions**
   - Use least privilege principle
   - Auth service should NOT have DROP/ALTER permissions

4. **Regular Backups**
   - Automated daily backups
   - Test restore procedures
   - Encrypt backups

### Rate Limiting

Already implemented in code, but verify these settings:

```typescript
// src/middleware/ratelimit.ts
{
  authEndpoints: {
    requests: 5,
    window: 60000 // 1 minute
  },
  generalEndpoints: {
    requests: 100,
    window: 60000
  }
}
```

Consider using Redis for distributed rate limiting in production.

### Logging & Monitoring

**Do NOT log sensitive data:**
- ❌ Passwords (even hashed)
- ❌ JWT tokens
- ❌ OAuth tokens
- ❌ API keys
- ❌ Full credit card numbers

**DO log security events:**
- ✅ Failed login attempts
- ✅ Rate limit violations
- ✅ Invalid tokens
- ✅ Unusual access patterns
- ✅ Account changes

**Recommended Tools:**
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Datadog** - Infrastructure monitoring
- **Prometheus + Grafana** - Metrics

### HTTPS/TLS

- **Always use HTTPS** in production
- Use TLS 1.2 or higher
- Get free certificates from Let's Encrypt
- Implement HSTS (Strict-Transport-Security header)

### Container Security (Docker)

If deploying with Docker:

```dockerfile
# Use specific version, not 'latest'
FROM node:20.19.0-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Read-only filesystem where possible
VOLUME ["/data"]

# Don't include build tools in production
RUN apk del build-dependencies
```

## Security Checklist

### Before Going to Production

- [ ] All environment variables are set securely
- [ ] JWT secrets are strong and unique (min 32 chars)
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Database has SSL/TLS enabled
- [ ] Rate limiting is active
- [ ] Logging is configured (without sensitive data)
- [ ] Error messages don't leak sensitive info
- [ ] CORS is properly configured
- [ ] Backups are automated and tested
- [ ] Monitoring/alerting is set up
- [ ] Security contact email works
- [ ] Incident response plan exists

### GitHub Security Checklist

- [ ] Secret scanning enabled
- [ ] Push protection enabled
- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] Private vulnerability reporting enabled
- [ ] Branch protection rules configured
- [ ] Required status checks enabled
- [ ] Code review required
- [ ] Signed commits required
- [ ] Notifications configured

## Incident Response

### If a Vulnerability is Reported

1. **Acknowledge** - Respond within 48 hours
2. **Assess** - Determine severity and impact
3. **Develop** - Create a fix
4. **Test** - Thoroughly test the fix
5. **Deploy** - Roll out to production
6. **Disclose** - Publish security advisory
7. **Credit** - Thank the researcher

### If a Secret is Leaked

1. **Revoke** - Immediately revoke the compromised secret
2. **Rotate** - Generate new secrets
3. **Update** - Update all instances
4. **Audit** - Check for unauthorized access
5. **Document** - Record the incident
6. **Prevent** - Add checks to prevent recurrence

## Additional Security Resources

### Tools to Consider

- **Snyk** - Vulnerability scanning
- **SonarQube** - Code quality and security
- **OWASP ZAP** - Web app security testing
- **Burp Suite** - Security testing
- **Nuclei** - Vulnerability scanner

### Security Training

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Academy](https://portswigger.net/web-security)
- [Auth0 Security Best Practices](https://auth0.com/docs/secure)

### Compliance Considerations

If handling EU users:
- GDPR compliance
- Right to be forgotten
- Data portability
- Consent management

If handling payment data:
- PCI DSS compliance (not applicable here, but good to know)

## Cost Estimates

### GitHub Security Features
- Secret scanning: **Free**
- Dependabot: **Free**
- CodeQL: **Free** for public repos
- Private vulnerability reporting: **Free**

### Third-party Tools (Optional)
- Snyk: $0-99/month
- Sentry: $0-80/month
- Datadog: $15+/host/month

## Support

Questions about security setup?
- Open a discussion in the Security category
- Email: security@alternatefutures.ai

---

**Last Updated**: 2024-11-12
