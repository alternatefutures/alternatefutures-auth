/**
 * Secrets service for fetching secrets from Infisical
 * Provides secure runtime access to sensitive configuration
 */

import { InfisicalClient } from '@infisical/sdk';

export interface Secrets {
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  HTTPSMS_API_KEY?: string;
  HTTPSMS_PHONE_NUMBER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
}

class SecretsService {
  private client: InfisicalClient | null = null;
  private secrets: Partial<Secrets> = {};
  private initialized = false;

  /**
   * Initialize the Infisical client and fetch secrets
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const clientId = process.env.INFISICAL_CLIENT_ID;
    const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
    const projectId = process.env.INFISICAL_PROJECT_ID;
    const environment = process.env.INFISICAL_ENVIRONMENT || 'prod';

    // If Infisical credentials are not set, fall back to environment variables
    if (!clientId || !clientSecret || !projectId) {
      console.log('🔐 Infisical not configured, using environment variables');
      this.secrets = {
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        JWT_SECRET: process.env.JWT_SECRET || 'development-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'development-refresh-secret',
        HTTPSMS_API_KEY: process.env.HTTPSMS_API_KEY,
        HTTPSMS_PHONE_NUMBER: process.env.HTTPSMS_PHONE_NUMBER,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
        TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
      };
      this.initialized = true;
      return;
    }

    try {
      console.log('🔐 Connecting to Infisical...');

      this.client = new InfisicalClient({
        auth: {
          universalAuth: {
            clientId,
            clientSecret,
          },
        },
      });

      // Fetch all secrets from the project
      const secretsList = await this.client.listSecrets({
        projectId,
        environment,
        path: '/',
      });

      // Map secrets to our secrets object
      for (const secret of secretsList) {
        const key = secret.secretKey as keyof Secrets;
        if (key in this.secrets || this.isValidSecretKey(key)) {
          this.secrets[key] = secret.secretValue;
        }
      }

      console.log('✅ Secrets loaded from Infisical');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to connect to Infisical:', error);
      console.log('⚠️ Falling back to environment variables');

      // Fall back to environment variables
      this.secrets = {
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        JWT_SECRET: process.env.JWT_SECRET || 'development-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'development-refresh-secret',
        HTTPSMS_API_KEY: process.env.HTTPSMS_API_KEY,
        HTTPSMS_PHONE_NUMBER: process.env.HTTPSMS_PHONE_NUMBER,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
        TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
      };
      this.initialized = true;
    }
  }

  private isValidSecretKey(key: string): key is keyof Secrets {
    const validKeys: Array<keyof Secrets> = [
      'RESEND_API_KEY',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'HTTPSMS_API_KEY',
      'HTTPSMS_PHONE_NUMBER',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'TWITTER_CLIENT_ID',
      'TWITTER_CLIENT_SECRET',
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
    ];
    return validKeys.includes(key as keyof Secrets);
  }

  /**
   * Get a secret value
   */
  get<K extends keyof Secrets>(key: K): Secrets[K] | undefined {
    if (!this.initialized) {
      throw new Error('SecretsService not initialized. Call initialize() first.');
    }
    return this.secrets[key] as Secrets[K] | undefined;
  }

  /**
   * Get a required secret value (throws if not found)
   */
  getRequired<K extends keyof Secrets>(key: K): Secrets[K] {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required secret ${key} not found`);
    }
    return value;
  }

  /**
   * Check if a secret exists and has a value
   */
  has(key: keyof Secrets): boolean {
    return !!this.secrets[key];
  }
}

// Export singleton instance
export const secretsService = new SecretsService();
