import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import sessionRoutes from '../../src/routes/auth/session';
import { dbService } from '../../src/services/db.service';
import { jwtService } from '../../src/services/jwt.service';
import { authMiddleware } from '../../src/middleware/auth';
import { nanoid } from 'nanoid';

describe('Session Management Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/', sessionRoutes);
  });

  describe('POST /refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Create user and session
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'refresh@example.com',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const { refreshToken, sessionId } = jwtService.generateTokenPair(
        user.id,
        user.email!
      );

      await dbService.createSession({
        id: sessionId,
        user_id: user.id,
        refresh_token: refreshToken,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
        created_at: Date.now(),
        last_used_at: Date.now(),
        revoked: 0,
      });

      // Refresh token
      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.accessToken).toBeTruthy();
      expect(data.user.id).toBe(user.id);
    });

    it('should reject invalid refresh token', async () => {
      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'invalid-token' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should reject expired refresh token', async () => {
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'expired@example.com',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // Create expired session
      const expiredRefreshToken = jwtService.generateRefreshToken(user.id, 'expired-session');
      await dbService.createSession({
        id: 'expired-session',
        user_id: user.id,
        refresh_token: expiredRefreshToken,
        expires_at: Date.now() - 1000, // Expired
        created_at: Date.now(),
        last_used_at: Date.now(),
        revoked: 0,
      });

      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: expiredRefreshToken }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });

    it('should reject revoked refresh token', async () => {
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'revoked@example.com',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const { refreshToken, sessionId } = jwtService.generateTokenPair(
        user.id,
        user.email!
      );

      // Create revoked session
      await dbService.createSession({
        id: sessionId,
        user_id: user.id,
        refresh_token: refreshToken,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
        created_at: Date.now(),
        last_used_at: Date.now(),
        revoked: 1, // Revoked
      });

      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('revoked');
    });
  });

  describe('GET /me', () => {
    it('should return authenticated user details', async () => {
      // Create user
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'me@example.com',
        display_name: 'Test User',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const { accessToken } = jwtService.generateTokenPair(user.id, user.email!);

      const response = await app.request('/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.id).toBe(user.id);
      expect(data.user.email).toBe('me@example.com');
      expect(data.user.displayName).toBe('Test User');
      expect(data.user.emailVerified).toBe(true);
    });

    it('should reject request without authorization header', async () => {
      const response = await app.request('/me', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid access token', async () => {
      const response = await app.request('/me', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('should logout user and revoke session', async () => {
      // Create user and session
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'logout@example.com',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const { accessToken, refreshToken, sessionId } = jwtService.generateTokenPair(
        user.id,
        user.email!
      );

      await dbService.createSession({
        id: sessionId,
        user_id: user.id,
        refresh_token: refreshToken,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
        created_at: Date.now(),
        last_used_at: Date.now(),
        revoked: 0,
      });

      // Logout
      const response = await app.request('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Logged out');

      // Verify session is revoked (use getSessionById since revoked sessions are filtered out by getSessionByRefreshToken)
      const session = await dbService.getSessionById(sessionId);
      expect(session?.revoked).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await app.request('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'some-token' }),
      });

      expect(response.status).toBe(401);
    });

    it('should handle logout without refresh token', async () => {
      const user = await dbService.createUser({
        id: nanoid(),
        email: 'logout2@example.com',
        email_verified: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const { accessToken } = jwtService.generateTokenPair(user.id, user.email!);

      const response = await app.request('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
