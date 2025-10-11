/**
 * Database service for interacting with SQLite
 * Compatible with Turso and local SQLite for AF Functions
 */

import { Database } from 'bun:sqlite'; // Works with Bun, can swap for better-sqlite3 for Node

export interface User {
  id: string;
  email?: string;
  email_verified: number;
  phone?: string;
  phone_verified: number;
  display_name?: string;
  avatar_url?: string;
  created_at: number;
  updated_at: number;
  last_login_at?: number;
}

export interface AuthMethod {
  id: string;
  user_id: string;
  method_type: 'email' | 'sms' | 'wallet' | 'oauth';
  provider?: string;
  identifier: string;
  oauth_access_token?: string;
  oauth_refresh_token?: string;
  oauth_token_expires_at?: number;
  verified: number;
  is_primary: number;
  created_at: number;
  last_used_at?: number;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  user_agent?: string;
  ip_address?: string;
  device_id?: string;
  expires_at: number;
  revoked: number;
  revoked_at?: number;
  created_at: number;
  last_activity_at: number;
}

export interface VerificationCode {
  id: string;
  code_type: 'email' | 'sms' | 'mfa';
  identifier: string;
  code: string;
  expires_at: number;
  attempts: number;
  max_attempts: number;
  verified: number;
  verified_at?: number;
  created_at: number;
  ip_address?: string;
}

export interface SIWEChallenge {
  id: string;
  address: string;
  message: string;
  nonce: string;
  expires_at: number;
  verified: number;
  verified_at?: number;
  created_at: number;
  ip_address?: string;
}

export class DatabaseService {
  private db: Database;

  constructor(databasePath: string = ':memory:') {
    this.db = new Database(databasePath);
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Read schema from file in production
    // For now, we'll use inline schema
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        email_verified INTEGER DEFAULT 0,
        phone TEXT UNIQUE,
        phone_verified INTEGER DEFAULT 0,
        display_name TEXT,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_login_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS auth_methods (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        method_type TEXT NOT NULL,
        provider TEXT,
        identifier TEXT NOT NULL,
        oauth_access_token TEXT,
        oauth_refresh_token TEXT,
        oauth_token_expires_at INTEGER,
        verified INTEGER DEFAULT 0,
        is_primary INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        refresh_token TEXT NOT NULL UNIQUE,
        user_agent TEXT,
        ip_address TEXT,
        device_id TEXT,
        expires_at INTEGER NOT NULL,
        revoked INTEGER DEFAULT 0,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        code_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        verified INTEGER DEFAULT 0,
        verified_at INTEGER,
        created_at INTEGER NOT NULL,
        ip_address TEXT
      );

      CREATE TABLE IF NOT EXISTS siwe_challenges (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        message TEXT NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        verified INTEGER DEFAULT 0,
        verified_at INTEGER,
        created_at INTEGER NOT NULL,
        ip_address TEXT
      );
    `;

    this.db.exec(schema);
  }

  // User methods
  async createUser(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    const now = Date.now();
    const newUser: User = {
      ...user,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, email_verified, phone, phone_verified, display_name, avatar_url, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newUser.id,
      newUser.email,
      newUser.email_verified,
      newUser.phone,
      newUser.phone_verified,
      newUser.display_name,
      newUser.avatar_url,
      newUser.created_at,
      newUser.updated_at,
      newUser.last_login_at
    );

    return newUser;
  }

  async getUserById(id: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE phone = ?');
    return stmt.get(phone) as User | null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), id];

    const stmt = this.db.prepare(`UPDATE users SET ${fields}, updated_at = ? WHERE id = ?`);
    stmt.run(...values, Date.now(), id);
  }

  // Verification code methods
  async createVerificationCode(code: Omit<VerificationCode, 'created_at'>): Promise<VerificationCode> {
    const now = Date.now();
    const newCode: VerificationCode = {
      ...code,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO verification_codes (id, code_type, identifier, code, expires_at, attempts, max_attempts, verified, verified_at, created_at, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newCode.id,
      newCode.code_type,
      newCode.identifier,
      newCode.code,
      newCode.expires_at,
      newCode.attempts,
      newCode.max_attempts,
      newCode.verified,
      newCode.verified_at,
      newCode.created_at,
      newCode.ip_address
    );

    return newCode;
  }

  async getVerificationCode(identifier: string, codeType: string): Promise<VerificationCode | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM verification_codes
      WHERE identifier = ? AND code_type = ? AND verified = 0
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(identifier, codeType) as VerificationCode | null;
  }

  async markVerificationCodeAsUsed(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE verification_codes
      SET verified = 1, verified_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  async incrementVerificationAttempts(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE verification_codes
      SET attempts = attempts + 1
      WHERE id = ?
    `);
    stmt.run(id);
  }

  // Session methods
  async createSession(session: Omit<Session, 'created_at' | 'last_activity_at'>): Promise<Session> {
    const now = Date.now();
    const newSession: Session = {
      ...session,
      created_at: now,
      last_activity_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, device_id, expires_at, revoked, revoked_at, created_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newSession.id,
      newSession.user_id,
      newSession.refresh_token,
      newSession.user_agent,
      newSession.ip_address,
      newSession.device_id,
      newSession.expires_at,
      newSession.revoked,
      newSession.revoked_at,
      newSession.created_at,
      newSession.last_activity_at
    );

    return newSession;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE refresh_token = ? AND revoked = 0');
    return stmt.get(refreshToken) as Session | null;
  }

  async revokeSession(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET revoked = 1, revoked_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  // Auth method methods
  async createAuthMethod(method: Omit<AuthMethod, 'created_at'>): Promise<AuthMethod> {
    const now = Date.now();
    const newMethod: AuthMethod = {
      ...method,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO auth_methods (id, user_id, method_type, provider, identifier, oauth_access_token, oauth_refresh_token, oauth_token_expires_at, verified, is_primary, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newMethod.id,
      newMethod.user_id,
      newMethod.method_type,
      newMethod.provider,
      newMethod.identifier,
      newMethod.oauth_access_token,
      newMethod.oauth_refresh_token,
      newMethod.oauth_token_expires_at,
      newMethod.verified,
      newMethod.is_primary,
      newMethod.created_at,
      newMethod.last_used_at
    );

    return newMethod;
  }

  async getAuthMethodByIdentifier(identifier: string, methodType: string): Promise<AuthMethod | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM auth_methods
      WHERE identifier = ? AND method_type = ?
    `);
    return stmt.get(identifier, methodType) as AuthMethod | null;
  }

  async getUserAuthMethods(userId: string): Promise<AuthMethod[]> {
    const stmt = this.db.prepare('SELECT * FROM auth_methods WHERE user_id = ?');
    return stmt.all(userId) as AuthMethod[];
  }
}

// Create singleton instance
export const dbService = new DatabaseService(
  process.env.DATABASE_URL || './auth.db'
);
