import { describe, it, expect, beforeEach } from 'vitest';
import { JWTService } from '../../src/services/jwt.service';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = new JWTService({
      accessTokenSecret: 'test-access-secret',
      refreshTokenSecret: 'test-refresh-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    });
  });

  describe('Token Generation', () => {
    it('should generate access token', () => {
      const token = jwtService.generateAccessToken('user-123', 'user@example.com');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123', 'session-456');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate token pair', () => {
      const { accessToken, refreshToken, sessionId } = jwtService.generateTokenPair(
        'user-123',
        'user@example.com'
      );

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(sessionId).toBeTruthy();
    });
  });

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const token = jwtService.generateAccessToken('user-123', 'user@example.com');
      const payload = jwtService.verifyAccessToken(token);

      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('user@example.com');
      expect(payload.type).toBe('access');
    });

    it('should verify valid refresh token', () => {
      const sessionId = 'session-456';
      const token = jwtService.generateRefreshToken('user-123', sessionId);
      const payload = jwtService.verifyRefreshToken(token);

      expect(payload.userId).toBe('user-123');
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.type).toBe('refresh');
    });

    it('should reject invalid access token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should reject refresh token as access token', () => {
      const refreshToken = jwtService.generateRefreshToken('user-123', 'session-456');

      expect(() => {
        jwtService.verifyAccessToken(refreshToken);
      }).toThrow('Invalid token type');
    });

    it('should reject access token as refresh token', () => {
      const accessToken = jwtService.generateAccessToken('user-123', 'user@example.com');

      expect(() => {
        jwtService.verifyRefreshToken(accessToken);
      }).toThrow('Invalid token type');
    });
  });

  describe('Token Utilities', () => {
    it('should decode token without verification', () => {
      const token = jwtService.generateAccessToken('user-123', 'user@example.com');
      const payload = jwtService.decode(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe('user-123');
    });

    it('should get token expiration', () => {
      const token = jwtService.generateAccessToken('user-123', 'user@example.com');
      const expiration = jwtService.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should check if token is expired', () => {
      const token = jwtService.generateAccessToken('user-123', 'user@example.com');
      const isExpired = jwtService.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });
  });
});
