# Backup & Recovery

## Automated Backups

Daily backups run via GitHub Actions at 5 AM UTC:
- Export SQLite database using `.backup` command
- Encrypt with `age` (public key encryption)
- Upload to Storacha (IPFS + Filecoin storage)
- Also stored as GitHub artifact (30-day retention)

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AGE_PUBLIC_KEY` | Public key for encrypting backups |
| `W3_PRINCIPAL` | Storacha agent private key (base64) |
| `W3_PROOF` | Storacha delegation proof (base64) |

### Storacha Configuration

- **Account:** angela@alternatefutures.ai
- **Space:** `alternatefutures-backups`
- **Space DID:** `did:key:z6Mkoe31W9Z8WBznHQ6GPrfPaBdjnFC1fMt6P8QbZ9kKoQU6`
- **CI Agent DID:** `did:key:z6MksU8hnbAmL2xaY7nrRZ6az1qENLMcYdRgJvdPEzFgJzXs`
- **Gateway:** https://w3s.link/ipfs/

### Manual Backup Trigger

```bash
gh workflow run backup-database.yml \
  --repo alternatefutures/service-auth
```

## Database Configuration

**Production (Akash):**
- SQLite database file: `auth.db`
- Located at: `/app/auth.db` in container
- Backup runs via sidecar container inside Akash deployment

**Local Development:**
- Default location: `./auth.db`
- Or configured via `DATABASE_URL` environment variable

## Finding Backups

### Storacha (IPFS + Filecoin)

Backups are stored on IPFS with Filecoin storage deals. Access via:
```
https://w3s.link/ipfs/<CID>
```

List uploads in the space:
```bash
w3 ls
```

### GitHub Artifacts

1. Go to Actions → Backup SQLite Database
2. Select a workflow run
3. Download the artifact (30-day retention)

## Restore Procedure

### 1. Download and Decrypt

```bash
# Get your age private key
export AGE_KEY_FILE=~/.age-key.txt

# Download from Storacha (using CID from workflow logs)
curl -o backup.db.age "https://w3s.link/ipfs/<CID>"

# Decrypt
age -d -i $AGE_KEY_FILE -o auth.db backup.db.age
```

### 2. Verify Database

```bash
# Check tables
sqlite3 auth.db ".tables"

# Verify record counts
sqlite3 auth.db "SELECT COUNT(*) FROM users;"
sqlite3 auth.db "SELECT COUNT(*) FROM sessions;"
```

### 3. Deploy to Production

For Akash deployments, you'll need to:
1. Copy restored `auth.db` into the container
2. Or mount it as a volume during deployment

## Disaster Recovery

### Scenario: Akash deployment lost

1. **Redeploy service-auth** using Akash SDL
   - SQLite will be empty on fresh deployment

2. **Restore from backup**
   - Download latest backup from Storacha or GitHub Artifacts
   - Decrypt with age private key
   - Replace `auth.db` in the container

3. **Update DNS** if ingress URL changed
   - Update CNAME for auth.alternatefutures.ai

4. **Invalidate sessions** (optional)
   - Users may need to re-authenticate if JWT secrets changed

## SQLite-Specific Notes

- SQLite is a single-file database, making backups simple
- The `.backup` command creates a consistent snapshot
- File size is typically small (few MB) for user data
- No need to stop the service for backup (SQLite handles locking)

## Retention Policy

| Storage | Retention |
|---------|-----------|
| Storacha (IPFS + Filecoin) | Filecoin storage deals (~months-years) |
| GitHub Artifacts | 30 days |

## Related Documentation

- Organization backup overview: https://github.com/alternatefutures/.github/blob/main/BACKUP.md
- Infisical secrets backup: See `service-secrets/BACKUP.md`
