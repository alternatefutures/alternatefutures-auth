/**
 * Relay.link Payment Provider
 * Implementation of PaymentProvider interface for Relay.link crypto payments
 * Supports 69+ chains including Ethereum, Polygon, Arbitrum, Optimism, Base, etc.
 */

import crypto from 'crypto';
import type {
  PaymentProvider,
  RelayConfig,
  ExternalCustomer,
  ExternalPaymentMethod,
  ExternalPaymentIntent,
  ExternalRefund,
  CreateCustomerInput,
  AttachPaymentMethodInput,
  CreatePaymentIntentInput,
  CreateRefundInput,
  WebhookEvent,
} from './types';

interface RelayApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RelayPaymentRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  amount: string;
  currency: string;
  depositAddress: string;
  chainId: number;
  tokenAddress?: string;
  tokenSymbol: string;
  expiresAt: number;
  txHash?: string;
  metadata?: Record<string, string>;
  createdAt: number;
}

interface RelayWallet {
  id: string;
  address: string;
  chainId: number;
  blockchain: string;
  verified: boolean;
  createdAt: number;
}

// Supported chains on Relay.link
const SUPPORTED_CHAINS: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  250: 'fantom',
  324: 'zksync',
  8453: 'base',
  42161: 'arbitrum',
  43114: 'avalanche',
  59144: 'linea',
  534352: 'scroll',
  7777777: 'zora',
};

// Common tokens across chains
const SUPPORTED_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  'eth': { symbol: 'ETH', decimals: 18 },
  'usdc': { symbol: 'USDC', decimals: 6 },
  'usdt': { symbol: 'USDT', decimals: 6 },
  'dai': { symbol: 'DAI', decimals: 18 },
  'weth': { symbol: 'WETH', decimals: 18 },
  'wbtc': { symbol: 'WBTC', decimals: 8 },
};

export class RelayProvider implements PaymentProvider {
  readonly name = 'relay' as const;
  private apiKey: string;
  private webhookSecret: string;
  private baseUrl = 'https://api.relay.link/v1';
  private supportedChains: number[];
  private supportedTokens: string[];

  constructor(config: RelayConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.supportedChains = config.supportedChains || Object.keys(SUPPORTED_CHAINS).map(Number);
    this.supportedTokens = config.supportedTokens || Object.keys(SUPPORTED_TOKENS);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await response.json() as RelayApiResponse<T>;

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || `Relay API error: ${response.status}`);
    }

    return result.data as T;
  }

  // Customer management - Relay doesn't have traditional customers
  // We store customer info locally and use wallet addresses as identifiers
  async createCustomer(input: CreateCustomerInput): Promise<ExternalCustomer> {
    // Generate a unique ID for the customer
    const id = `relay_${crypto.randomUUID()}`;

    return {
      id,
      email: input.email,
      name: input.name,
      metadata: input.metadata,
    };
  }

  async getCustomer(customerId: string): Promise<ExternalCustomer | null> {
    // Relay doesn't store customers - we manage this locally
    // Return a placeholder that should be hydrated from our database
    return {
      id: customerId,
    };
  }

  async updateCustomer(customerId: string, input: Partial<CreateCustomerInput>): Promise<ExternalCustomer> {
    return {
      id: customerId,
      email: input.email,
      name: input.name,
      metadata: input.metadata,
    };
  }

  async deleteCustomer(_customerId: string): Promise<void> {
    // No-op for Relay - customers are managed locally
  }

  // Payment methods - these are crypto wallets
  async attachPaymentMethod(_customerId: string, input: AttachPaymentMethodInput): Promise<ExternalPaymentMethod> {
    if (!input.walletAddress || !input.blockchain) {
      throw new Error('walletAddress and blockchain are required for Relay');
    }

    // Validate the wallet address format
    if (!this.isValidAddress(input.walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    // Get chain ID from blockchain name
    const chainId = this.getChainIdFromBlockchain(input.blockchain);
    if (!chainId) {
      throw new Error(`Unsupported blockchain: ${input.blockchain}`);
    }

    // Verify the wallet can receive payments
    const wallet = await this.request<RelayWallet>('POST', '/wallets/verify', {
      address: input.walletAddress,
      chainId,
    });

    return {
      id: wallet.id || `wallet_${crypto.randomUUID()}`,
      type: 'crypto',
      walletAddress: input.walletAddress,
      blockchain: input.blockchain,
    };
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    // No-op for Relay - wallet associations are managed locally
  }

  async listPaymentMethods(_customerId: string): Promise<ExternalPaymentMethod[]> {
    // Wallets are managed locally, not on Relay
    return [];
  }

  async setDefaultPaymentMethod(_customerId: string, _paymentMethodId: string): Promise<void> {
    // No-op - managed locally
  }

  // Payments - this is the core Relay functionality
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ExternalPaymentIntent> {
    const chainId = input.chainId || 1; // Default to Ethereum mainnet
    const tokenSymbol = input.tokenSymbol || 'usdc';

    // Create a payment request on Relay
    const payment = await this.request<RelayPaymentRequest>('POST', '/payments', {
      amount: this.formatAmount(input.amount, tokenSymbol),
      currency: 'usd',
      chainId,
      tokenSymbol: tokenSymbol.toUpperCase(),
      metadata: {
        ...input.metadata,
        customerId: input.customerId,
      },
      expiresIn: 3600, // 1 hour
    });

    return {
      id: payment.id,
      status: this.mapPaymentStatus(payment.status),
      amount: input.amount,
      currency: input.currency,
      depositAddress: payment.depositAddress,
      chainId: payment.chainId,
      tokenAddress: payment.tokenAddress,
      expiresAt: payment.expiresAt,
    };
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent> {
    // For crypto payments, confirmation happens on-chain
    // We just check the status
    const payment = await this.request<RelayPaymentRequest>('GET', `/payments/${paymentIntentId}`);

    return {
      id: payment.id,
      status: this.mapPaymentStatus(payment.status),
      amount: this.parseAmount(payment.amount, payment.tokenSymbol),
      currency: payment.currency,
      depositAddress: payment.depositAddress,
      chainId: payment.chainId,
      tokenAddress: payment.tokenAddress,
      expiresAt: payment.expiresAt,
    };
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent> {
    const payment = await this.request<RelayPaymentRequest>('POST', `/payments/${paymentIntentId}/cancel`);

    return {
      id: payment.id,
      status: 'canceled',
      amount: this.parseAmount(payment.amount, payment.tokenSymbol),
      currency: payment.currency,
    };
  }

  async getPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent | null> {
    try {
      const payment = await this.request<RelayPaymentRequest>('GET', `/payments/${paymentIntentId}`);

      return {
        id: payment.id,
        status: this.mapPaymentStatus(payment.status),
        amount: this.parseAmount(payment.amount, payment.tokenSymbol),
        currency: payment.currency,
        depositAddress: payment.depositAddress,
        chainId: payment.chainId,
        tokenAddress: payment.tokenAddress,
        expiresAt: payment.expiresAt,
      };
    } catch {
      return null;
    }
  }

  // Refunds - crypto refunds go back to the sender
  async createRefund(input: CreateRefundInput): Promise<ExternalRefund> {
    const refund = await this.request<{ id: string; status: string; amount: string }>('POST', `/payments/${input.paymentIntentId}/refund`, {
      amount: input.amount ? (input.amount / 100).toString() : undefined,
      reason: input.reason,
    });

    return {
      id: refund.id,
      amount: Math.round(parseFloat(refund.amount) * 100),
      status: refund.status === 'completed' ? 'succeeded' : 'pending',
    };
  }

  // Relay doesn't support subscriptions - crypto subscriptions need custom implementation
  // The createSubscription, getSubscription, etc. methods are not implemented

  // Webhooks
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();

    // Relay uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadStr)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature.replace('sha256=', '')),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: string | Buffer): WebhookEvent {
    const event = JSON.parse(typeof payload === 'string' ? payload : payload.toString());

    return {
      id: event.id || crypto.randomUUID(),
      type: event.type,
      provider: 'relay',
      data: event.data,
      createdAt: event.timestamp || Math.floor(Date.now() / 1000),
    };
  }

  // Helper methods
  private isValidAddress(address: string): boolean {
    // Basic Ethereum address validation (works for EVM chains)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private getChainIdFromBlockchain(blockchain: string): number | null {
    const lower = blockchain.toLowerCase();
    for (const [chainId, name] of Object.entries(SUPPORTED_CHAINS)) {
      if (name === lower) {
        return parseInt(chainId, 10);
      }
    }
    return null;
  }

  private formatAmount(cents: number, tokenSymbol: string): string {
    const token = SUPPORTED_TOKENS[tokenSymbol.toLowerCase()];
    const decimals = token?.decimals || 18;
    const dollars = cents / 100;

    // For stablecoins, use the dollar amount directly
    // For other tokens, this would need price conversion
    return dollars.toFixed(decimals > 6 ? 6 : decimals);
  }

  private parseAmount(amountStr: string, tokenSymbol: string): number {
    // Convert token amount back to cents
    const amount = parseFloat(amountStr);
    // Assuming stablecoins are 1:1 with USD
    return Math.round(amount * 100);
  }

  private mapPaymentStatus(status: RelayPaymentRequest['status']): ExternalPaymentIntent['status'] {
    const statusMap: Record<RelayPaymentRequest['status'], ExternalPaymentIntent['status']> = {
      pending: 'requires_payment_method',
      processing: 'processing',
      completed: 'succeeded',
      failed: 'failed',
      expired: 'canceled',
    };
    return statusMap[status] || 'processing';
  }

  // Public helper methods for crypto-specific functionality
  getSupportedChains(): Array<{ chainId: number; name: string }> {
    return this.supportedChains.map((chainId) => ({
      chainId,
      name: SUPPORTED_CHAINS[chainId] || 'unknown',
    }));
  }

  getSupportedTokens(): Array<{ symbol: string; decimals: number }> {
    return this.supportedTokens.map((symbol) => ({
      symbol: symbol.toUpperCase(),
      decimals: SUPPORTED_TOKENS[symbol.toLowerCase()]?.decimals || 18,
    }));
  }
}
