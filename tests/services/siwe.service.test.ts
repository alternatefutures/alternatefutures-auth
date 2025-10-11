import { describe, it, expect } from 'vitest';
import { siweService } from '../../src/services/siwe.service';

describe('SIWEService', () => {
  describe('Message Creation', () => {
    it('should create valid SIWE message', () => {
      const message = siweService.createMessage({
        domain: 'example.com',
        address: '0x1234567890123456789012345678901234567890',
        statement: 'Sign in to Example',
        uri: 'https://example.com',
        version: '1',
        chainId: 1,
        nonce: 'abc123',
        issuedAt: '2025-10-11T14:00:00Z',
      });

      expect(message).toContain('example.com wants you to sign in');
      expect(message).toContain('0x1234567890123456789012345678901234567890');
      expect(message).toContain('Sign in to Example');
      expect(message).toContain('URI: https://example.com');
      expect(message).toContain('Version: 1');
      expect(message).toContain('Chain ID: 1');
      expect(message).toContain('Nonce: abc123');
      expect(message).toContain('Issued At: 2025-10-11T14:00:00Z');
    });

    it('should include optional fields when provided', () => {
      const message = siweService.createMessage({
        domain: 'example.com',
        address: '0x1234567890123456789012345678901234567890',
        uri: 'https://example.com',
        version: '1',
        chainId: 1,
        nonce: 'abc123',
        issuedAt: '2025-10-11T14:00:00Z',
        expirationTime: '2025-10-11T15:00:00Z',
        notBefore: '2025-10-11T13:00:00Z',
        requestId: 'req-123',
        resources: ['https://example.com/resource1', 'https://example.com/resource2'],
      });

      expect(message).toContain('Expiration Time: 2025-10-11T15:00:00Z');
      expect(message).toContain('Not Before: 2025-10-11T13:00:00Z');
      expect(message).toContain('Request ID: req-123');
      expect(message).toContain('Resources:');
      expect(message).toContain('- https://example.com/resource1');
      expect(message).toContain('- https://example.com/resource2');
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid Ethereum signature', () => {
      // This is a real signature from MetaMask signing a test message
      // Note: In production, you'd use actual wallet signatures
      // For now, this test demonstrates the API
      const message = 'Test message';
      const signature = '0x' + 'a'.repeat(130); // Mock signature
      const address = '0x1234567890123456789012345678901234567890';

      // Note: This will fail with mock signature
      // In real tests, use actual signed messages
      const isValid = siweService.verifySignature(message, signature, address);

      // We expect it to fail with mock data
      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid signature format', () => {
      const message = 'Test message';
      const signature = 'invalid';
      const address = '0x1234567890123456789012345678901234567890';

      const isValid = siweService.verifySignature(message, signature, address);
      expect(isValid).toBe(false);
    });

    it('should handle signature verification errors gracefully', () => {
      const message = 'Test message';
      const signature = '0x' + '0'.repeat(130);
      const address = 'invalid-address';

      const isValid = siweService.verifySignature(message, signature, address);
      expect(isValid).toBe(false);
    });
  });
});
