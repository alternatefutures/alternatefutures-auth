import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import smsRoutes from '../../src/routes/auth/sms';
import { dbService } from '../../src/services/db.service';
import { smsService } from '../../src/services/sms.service';

// Mock SMS service
vi.mock('../../src/services/sms.service', () => ({
  smsService: {
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('SMS Authentication Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/auth/sms', smsRoutes);
  });

  describe('POST /auth/sms/request', () => {
    it('should request verification code for valid phone number', async () => {
      const response = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155551234' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Verification code sent');
      expect(data.expiresIn).toBe(600);
    });

    it('should reject invalid phone number format', async () => {
      const response = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '1234567890' }), // Missing + prefix
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should reject phone number with letters', async () => {
      const response = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+1415ABC1234' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should call SMS service to send code', async () => {
      await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155551234' }),
      });

      expect(smsService.sendVerificationCode).toHaveBeenCalled();
    });
  });

  describe('POST /auth/sms/verify', () => {
    it('should verify valid code and create new user', async () => {
      // First request a code
      await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155559876' }),
      });

      // Get the code from database
      const verificationCode = await dbService.getVerificationCode('+14155559876', 'sms');
      expect(verificationCode).toBeTruthy();

      // Verify the code
      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155559876',
          code: verificationCode!.code,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      expect(data.user.phone).toBe('+14155559876');
    });

    it('should verify code for existing user and update last login', async () => {
      // Create user first
      const existingUser = await dbService.createUser({
        id: 'existing-user',
        phone: '+14155558888',
        phone_verified: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // Request code
      const requestResponse = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155558888' }),
      });

      expect(requestResponse.status).toBe(200);

      // Get and verify code
      const verificationCode = await dbService.getVerificationCode('+14155558888', 'sms');
      expect(verificationCode).toBeTruthy();

      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155558888',
          code: verificationCode!.code,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.id).toBe(existingUser.id);
      expect(data.user.phone).toBe('+14155558888');
    });

    it('should reject invalid verification code', async () => {
      const requestResponse = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155557777' }),
      });

      expect(requestResponse.status).toBe(200);

      // Verify code was created
      const verificationCode = await dbService.getVerificationCode('+14155557777', 'sms');
      expect(verificationCode).toBeTruthy();

      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155557777',
          code: '000000', // Wrong code
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid verification code');
    });

    it('should handle expired verification code', async () => {
      // Create an expired code manually
      await dbService.createVerificationCode({
        id: 'expired-sms-code',
        code_type: 'sms',
        identifier: '+14155556666',
        code: '123456',
        expires_at: Date.now() - 1000, // Expired 1 second ago
        attempts: 0,
        max_attempts: 3,
        verified: 0,
      });

      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155556666',
          code: '123456',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });

    it('should handle max attempts exceeded', async () => {
      // Create a code that has reached max attempts
      await dbService.createVerificationCode({
        id: 'max-attempts-code',
        code_type: 'sms',
        identifier: '+14155555555',
        code: '123456',
        expires_at: Date.now() + 10 * 60 * 1000,
        attempts: 3, // Already at max
        max_attempts: 3,
        verified: 0,
      });

      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155555555',
          code: '123456',
        }),
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Maximum verification attempts');
    });

    it('should not allow reusing already verified code', async () => {
      // Request and verify code first time
      const requestResponse = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155554444' }),
      });

      expect(requestResponse.status).toBe(200);

      const verificationCode = await dbService.getVerificationCode('+14155554444', 'sms');
      expect(verificationCode).toBeTruthy();

      // First verification - should succeed
      const firstVerifyResponse = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155554444',
          code: verificationCode!.code,
        }),
      });

      expect(firstVerifyResponse.status).toBe(200);

      // Second verification with same code - should fail
      const response = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155554444',
          code: verificationCode!.code,
        }),
      });

      // Should fail with 404 (code not found because verified codes are filtered out)
      // This is better security - don't leak info about whether a code was used
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('No verification code found');
    });

    it('should increment attempts on wrong code', async () => {
      const requestResponse = await app.request('/auth/sms/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+14155553333' }),
      });

      expect(requestResponse.status).toBe(200);

      // Verify code was created
      const verificationCodeBefore = await dbService.getVerificationCode('+14155553333', 'sms');
      expect(verificationCodeBefore).toBeTruthy();
      expect(verificationCodeBefore!.attempts).toBe(0);

      // Try wrong code
      const verifyResponse = await app.request('/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+14155553333',
          code: '000000',
        }),
      });

      expect(verifyResponse.status).toBe(400);

      // Check attempts incremented
      const verificationCodeAfter = await dbService.getVerificationCode('+14155553333', 'sms');
      expect(verificationCodeAfter).toBeTruthy();
      expect(verificationCodeAfter!.attempts).toBeGreaterThan(0);
    });
  });
});
