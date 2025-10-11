/**
 * Test setup and utilities
 */

import { beforeEach, afterEach } from 'vitest';
import { dbService } from '../src/services/db.service';

// Setup before each test
beforeEach(() => {
  // Use in-memory database for tests
  process.env.DATABASE_URL = ':memory:';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
});

// Cleanup after each test
afterEach(() => {
  // Clear database
  if (dbService.db) {
    dbService.db.exec('DELETE FROM users');
    dbService.db.exec('DELETE FROM auth_methods');
    dbService.db.exec('DELETE FROM sessions');
    dbService.db.exec('DELETE FROM verification_codes');
    dbService.db.exec('DELETE FROM siwe_challenges');
  }
});

// Mock fetch for external API calls
global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
} as any;
