import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

export interface TokenPayload {
  userId: string;
  email?: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

export class JWTService {
  private config: JWTConfig;

  constructor(config: JWTConfig) {
    this.config = config;
  }

  /**
   * Generate an access token (short-lived)
   */
  generateAccessToken(userId: string, email?: string): string {
    const sessionId = nanoid();

    const payload: TokenPayload = {
      userId,
      email,
      sessionId,
      type: 'access',
    };

    return jwt.sign(payload, this.config.accessTokenSecret, {
      expiresIn: this.config.accessTokenExpiry,
      issuer: 'alternatefutures-auth',
      audience: 'alternatefutures-app',
    });
  }

  /**
   * Generate a refresh token (long-lived)
   */
  generateRefreshToken(userId: string, sessionId: string): string {
    const payload: TokenPayload = {
      userId,
      sessionId,
      type: 'refresh',
    };

    return jwt.sign(payload, this.config.refreshTokenSecret, {
      expiresIn: this.config.refreshTokenExpiry,
      issuer: 'alternatefutures-auth',
      audience: 'alternatefutures-app',
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, email?: string): {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  } {
    const sessionId = nanoid();

    const accessToken = jwt.sign(
      {
        userId,
        email,
        sessionId,
        type: 'access',
      } as TokenPayload,
      this.config.accessTokenSecret,
      {
        expiresIn: this.config.accessTokenExpiry,
        issuer: 'alternatefutures-auth',
        audience: 'alternatefutures-app',
      }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        sessionId,
        type: 'refresh',
      } as TokenPayload,
      this.config.refreshTokenSecret,
      {
        expiresIn: this.config.refreshTokenExpiry,
        issuer: 'alternatefutures-auth',
        audience: 'alternatefutures-app',
      }
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      // First decode without verification to check token type
      const unverified = jwt.decode(token) as TokenPayload | null;

      if (!unverified) {
        throw new Error('Invalid access token');
      }

      if (unverified.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Now verify with correct secret
      const decoded = jwt.verify(token, this.config.accessTokenSecret, {
        issuer: 'alternatefutures-auth',
        audience: 'alternatefutures-app',
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify a refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      // First decode without verification to check token type
      const unverified = jwt.decode(token) as TokenPayload | null;

      if (!unverified) {
        throw new Error('Invalid refresh token');
      }

      if (unverified.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Now verify with correct secret
      const decoded = jwt.verify(token, this.config.refreshTokenSecret, {
        issuer: 'alternatefutures-auth',
        audience: 'alternatefutures-app',
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode a token without verification (useful for debugging)
   */
  decode(token: string): TokenPayload | null {
    const decoded = jwt.decode(token);
    return decoded as TokenPayload | null;
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decode(token);
    if (!decoded || !('exp' in decoded)) {
      return null;
    }
    return new Date((decoded as any).exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return expiration < new Date();
  }
}

// Create singleton instance
export const jwtService = new JWTService({
  accessTokenSecret: process.env.JWT_SECRET || 'your-secret-key',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  accessTokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
});
