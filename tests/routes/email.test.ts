import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import emailRoutes from '../../src/routes/auth/email';
import { dbService } from '../../src/services/db.service';
import { emailService } from '../../src/services/email.service';

// Mock email service
vi.mock('../../src/services/email.service', () => ({
  emailService: {
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Email Authentication Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/auth/email', emailRoutes);
  });

  describe('POST /auth/email/request', () => {
    it('should request verification code for valid email', async () => {
      const response = await app.request('/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Verification code sent');
      expect(data.expiresIn).toBe(600);
    });

    it('should reject invalid email', async () => {
      const response = await app.request('/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should call email service to send code', async () => {
      await app.request('/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(emailService.sendVerificationCode).toHaveBeenCalled();
    });
  });

  describe('POST /auth/email/verify', () => {
    it('should verify valid code and create user', async () => {
      // First request a code
      await app.request('/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@example.com' }),
      });

      // Get the code from database
      const verificationCode = await dbService.getVerificationCode('newuser@example.com', 'email');
      expect(verificationCode).toBeTruthy();

      // Verify the code
      const response = await app.request('/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          code: verificationCode!.code,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      expect(data.user.email).toBe('newuser@example.com');
    });

    it('should reject invalid code', async () => {
      await app.request('/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await app.request('/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          code: '000000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid verification code');
    });

    it('should handle expired code', async () => {
      // Create an expired code manually
      await dbService.createVerificationCode({
        id: 'test-code',
        code_type: 'email',
        identifier: 'expired@example.com',
        code: '123456',
        expires_at: Date.now() - 1000, // Expired 1 second ago
        attempts: 0,
        max_attempts: 3,
        verified: 0,
      });

      const response = await app.request('/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'expired@example.com',
          code: '123456',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });
  });
});
