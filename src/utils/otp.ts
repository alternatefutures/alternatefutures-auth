import { randomBytes } from 'crypto';

/**
 * Generate a random OTP code
 * @param length - Length of the OTP (default: 6)
 * @returns OTP code as string
 */
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';

  const randomValues = randomBytes(length);

  for (let i = 0; i < length; i++) {
    otp += digits[randomValues[i] % digits.length];
  }

  return otp;
}

/**
 * Generate a secure random nonce for SIWE challenges
 * @returns Base64-encoded nonce
 */
export function generateNonce(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Hash an OTP for storage (simple hash for verification)
 * @param otp - The OTP to hash
 * @returns Hashed OTP
 */
export function hashOTP(otp: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify an OTP against a hash
 * @param otp - The OTP to verify
 * @param hash - The stored hash
 * @returns True if OTP matches
 */
export function verifyOTP(otp: string, hash: string): boolean {
  return hashOTP(otp) === hash;
}

/**
 * Check if an OTP has expired
 * @param createdAt - Timestamp when OTP was created (in milliseconds)
 * @param expiryMinutes - How many minutes until expiry (default: 10)
 * @returns True if expired
 */
export function isOTPExpired(createdAt: number, expiryMinutes: number = 10): boolean {
  const now = Date.now();
  const expiryTime = createdAt + (expiryMinutes * 60 * 1000);
  return now > expiryTime;
}
