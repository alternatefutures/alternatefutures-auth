import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateEthereumAddress,
  validateSolanaAddress,
  emailSchema,
  phoneSchema,
  ethereumAddressSchema,
  solanaAddressSchema,
  otpSchema,
} from '../../src/utils/validators';

describe('Validators', () => {
  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@example.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('Phone Validation', () => {
    it('should validate E.164 format phone numbers', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('+447700900123')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(false); // Missing +
      expect(validatePhone('+0234567890')).toBe(false); // Starts with 0
      expect(validatePhone('invalid')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });
  });

  describe('Ethereum Address Validation', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(validateEthereumAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(validateEthereumAddress('0xAbCdEf1234567890123456789012345678901234')).toBe(true);
    });

    it('should reject invalid Ethereum addresses', () => {
      expect(validateEthereumAddress('1234567890123456789012345678901234567890')).toBe(false); // Missing 0x
      expect(validateEthereumAddress('0x123')).toBe(false); // Too short
      expect(validateEthereumAddress('0xGHIJ567890123456789012345678901234567890')).toBe(false); // Invalid chars
      expect(validateEthereumAddress('')).toBe(false);
    });
  });

  describe('Solana Address Validation', () => {
    it('should validate correct Solana addresses', () => {
      expect(validateSolanaAddress('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK')).toBe(true);
    });

    it('should reject invalid Solana addresses', () => {
      expect(validateSolanaAddress('invalid')).toBe(false);
      expect(validateSolanaAddress('123')).toBe(false);
      expect(validateSolanaAddress('')).toBe(false);
    });
  });

  describe('OTP Validation', () => {
    it('should validate 6-digit OTP', () => {
      const result = otpSchema.safeParse('123456');
      expect(result.success).toBe(true);
    });

    it('should reject invalid OTP', () => {
      expect(otpSchema.safeParse('12345').success).toBe(false); // Too short
      expect(otpSchema.safeParse('1234567').success).toBe(false); // Too long
      expect(otpSchema.safeParse('abcdef').success).toBe(false); // Not digits
      expect(otpSchema.safeParse('').success).toBe(false); // Empty
    });
  });

  describe('Schema Parsing', () => {
    it('should parse valid email schema', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should provide error message for invalid email', () => {
      const result = emailSchema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('email');
      }
    });
  });
});
