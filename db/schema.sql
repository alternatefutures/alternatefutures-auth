-- Alternate Futures Authentication Service - Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  email_verified INTEGER DEFAULT 0,

  phone TEXT UNIQUE,
  phone_verified INTEGER DEFAULT 0,

  -- Profile
  display_name TEXT,
  avatar_url TEXT,

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);

-- Auth methods (email, SMS, wallet, OAuth)
CREATE TABLE IF NOT EXISTS auth_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Method type: 'email', 'sms', 'wallet', 'oauth'
  method_type TEXT NOT NULL,

  -- Provider for OAuth (google, github, twitter, etc.)
  provider TEXT,

  -- Identifier (email, phone, wallet address, or OAuth user ID)
  identifier TEXT NOT NULL,

  -- OAuth specific data
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_token_expires_at INTEGER,

  -- Verification status
  verified INTEGER DEFAULT 0,

  -- Primary method flag
  is_primary INTEGER DEFAULT 0,

  -- Metadata
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_methods_user_id ON auth_methods(user_id);
CREATE INDEX idx_auth_methods_identifier ON auth_methods(identifier);
CREATE UNIQUE INDEX idx_auth_methods_unique ON auth_methods(method_type, provider, identifier);

-- Sessions (JWT refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Refresh token
  refresh_token TEXT NOT NULL UNIQUE,

  -- Device/client info
  user_agent TEXT,
  ip_address TEXT,
  device_id TEXT,

  -- Expiration
  expires_at INTEGER NOT NULL,

  -- Revocation
  revoked INTEGER DEFAULT 0,
  revoked_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Verification codes (for email/SMS)
CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,

  -- Code type: 'email', 'sms', 'mfa'
  code_type TEXT NOT NULL,

  -- Contact method
  identifier TEXT NOT NULL,

  -- The actual code
  code TEXT NOT NULL,

  -- Expiration and attempts
  expires_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Verification status
  verified INTEGER DEFAULT 0,
  verified_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL,
  ip_address TEXT
);

CREATE INDEX idx_verification_codes_identifier ON verification_codes(identifier);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);

-- SIWE challenges (Sign-In with Ethereum)
CREATE TABLE IF NOT EXISTS siwe_challenges (
  id TEXT PRIMARY KEY,

  -- Wallet address
  address TEXT NOT NULL,

  -- Challenge message
  message TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,

  -- Expiration
  expires_at INTEGER NOT NULL,

  -- Verification
  verified INTEGER DEFAULT 0,
  verified_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL,
  ip_address TEXT
);

CREATE INDEX idx_siwe_challenges_address ON siwe_challenges(address);
CREATE INDEX idx_siwe_challenges_nonce ON siwe_challenges(nonce);
CREATE INDEX idx_siwe_challenges_expires_at ON siwe_challenges(expires_at);

-- MFA (Multi-Factor Authentication) settings
CREATE TABLE IF NOT EXISTS mfa_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- MFA enabled
  enabled INTEGER DEFAULT 0,

  -- TOTP secret (for authenticator apps)
  totp_secret TEXT,

  -- Backup codes
  backup_codes TEXT, -- JSON array

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mfa_settings_user_id ON mfa_settings(user_id);

-- Rate limiting (track requests by IP/user)
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,

  -- Identifier (IP address or user ID)
  identifier TEXT NOT NULL,

  -- Endpoint or action being rate limited
  action TEXT NOT NULL,

  -- Request count and window
  request_count INTEGER DEFAULT 0,
  window_start INTEGER NOT NULL,

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Personal Access Tokens (API keys for machine-to-machine authentication)
CREATE TABLE IF NOT EXISTS personal_access_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Token details
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,

  -- Expiration
  expires_at INTEGER,

  -- Usage tracking
  last_used_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_personal_access_tokens_user_id ON personal_access_tokens(user_id);
CREATE INDEX idx_personal_access_tokens_token ON personal_access_tokens(token);
CREATE INDEX idx_personal_access_tokens_expires_at ON personal_access_tokens(expires_at);
CREATE INDEX idx_personal_access_tokens_user_created ON personal_access_tokens(user_id, created_at DESC);
