/**
 * StaxPayments Provider
 * Implementation of PaymentProvider interface for StaxPayments (formerly Fattmerchant)
 */

import crypto from 'crypto';
import type {
  PaymentProvider,
  StaxConfig,
  ExternalCustomer,
  ExternalPaymentMethod,
  ExternalPaymentIntent,
  ExternalSubscription,
  ExternalRefund,
  CreateCustomerInput,
  AttachPaymentMethodInput,
  CreatePaymentIntentInput,
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  CreateRefundInput,
  WebhookEvent,
  ConnectedAccount,
  CreateConnectedAccountInput,
  ConnectedAccountOnboardingLink,
  Transfer,
  CreateTransferInput,
} from './types';

interface StaxApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface StaxCustomer {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  created_at: string;
  updated_at: string;
}

interface StaxPaymentMethod {
  id: string;
  customer_id: string;
  method: 'card' | 'bank';
  card_type?: string;
  card_last_four?: string;
  card_exp?: string;
  bank_name?: string;
  bank_last_four?: string;
  is_default: boolean;
  created_at: string;
}

interface StaxTransaction {
  id: string;
  customer_id: string;
  payment_method_id?: string;
  type: string;
  total: number;
  success: boolean;
  is_captured: boolean;
  is_voided: boolean;
  is_refundable: boolean;
  created_at: string;
  auth_id?: string;
  response?: string;
}

// Stax Connect (Sub-merchant) types
interface StaxSubMerchant {
  id: string;
  company_name: string;
  contact_name?: string;
  contact_email: string;
  contact_phone?: string;
  address_1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  status: 'pending' | 'active' | 'inactive' | 'rejected';
  processing_enabled: boolean;
  payout_enabled: boolean;
  created_at: string;
  updated_at: string;
  onboarding_url?: string;
  merchant_id?: string;
}

interface StaxSplit {
  id: string;
  transaction_id: string;
  sub_merchant_id: string;
  amount: number;
  fee_amount: number;
  status: 'pending' | 'processed' | 'failed';
  created_at: string;
}

export class StaxProvider implements PaymentProvider {
  readonly name = 'stax' as const;
  private apiKey: string;
  private merchantId: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor(config: StaxConfig) {
    this.apiKey = config.apiKey;
    this.merchantId = config.merchantId;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.sandbox
      ? 'https://apiprod.fattlabs.com'
      : 'https://apiprod.fattlabs.com';
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

    if (!response.ok) {
      const error = await response.json() as StaxApiResponse<unknown>;
      throw new Error(error.message || error.error || `Stax API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Customer management
  async createCustomer(input: CreateCustomerInput): Promise<ExternalCustomer> {
    const nameParts = input.name?.split(' ') || [];
    const customer = await this.request<StaxCustomer>('POST', '/customer', {
      email: input.email,
      firstname: nameParts[0] || input.email.split('@')[0],
      lastname: nameParts.slice(1).join(' ') || undefined,
    });

    return {
      id: customer.id,
      email: customer.email,
      name: [customer.firstname, customer.lastname].filter(Boolean).join(' ') || undefined,
    };
  }

  async getCustomer(customerId: string): Promise<ExternalCustomer | null> {
    try {
      const customer = await this.request<StaxCustomer>('GET', `/customer/${customerId}`);
      return {
        id: customer.id,
        email: customer.email,
        name: [customer.firstname, customer.lastname].filter(Boolean).join(' ') || undefined,
      };
    } catch {
      return null;
    }
  }

  async updateCustomer(customerId: string, input: Partial<CreateCustomerInput>): Promise<ExternalCustomer> {
    const nameParts = input.name?.split(' ') || [];
    const customer = await this.request<StaxCustomer>('PUT', `/customer/${customerId}`, {
      email: input.email,
      firstname: nameParts[0],
      lastname: nameParts.slice(1).join(' ') || undefined,
    });

    return {
      id: customer.id,
      email: customer.email,
      name: [customer.firstname, customer.lastname].filter(Boolean).join(' ') || undefined,
    };
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.request('DELETE', `/customer/${customerId}`);
  }

  // Payment methods
  async attachPaymentMethod(customerId: string, input: AttachPaymentMethodInput): Promise<ExternalPaymentMethod> {
    if (!input.paymentMethodId) {
      throw new Error('paymentMethodId is required for Stax');
    }

    // In Stax, payment methods are created directly with the customer
    // The paymentMethodId here would be a tokenized card from their frontend SDK
    const paymentMethod = await this.request<StaxPaymentMethod>('POST', `/customer/${customerId}/payment-method`, {
      payment_method_id: input.paymentMethodId,
    });

    return this.mapPaymentMethod(paymentMethod);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.request('DELETE', `/payment-method/${paymentMethodId}`);
  }

  async listPaymentMethods(customerId: string): Promise<ExternalPaymentMethod[]> {
    const methods = await this.request<StaxPaymentMethod[]>('GET', `/customer/${customerId}/payment-method`);
    return methods.map((pm) => this.mapPaymentMethod(pm));
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.request('PUT', `/customer/${customerId}/payment-method/${paymentMethodId}/default`);
  }

  private mapPaymentMethod(pm: StaxPaymentMethod): ExternalPaymentMethod {
    const expParts = pm.card_exp?.split('/') || [];
    return {
      id: pm.id,
      type: 'card',
      cardBrand: pm.card_type,
      cardLast4: pm.card_last_four,
      cardExpMonth: expParts[0] ? parseInt(expParts[0], 10) : undefined,
      cardExpYear: expParts[1] ? parseInt(`20${expParts[1]}`, 10) : undefined,
    };
  }

  // Payments
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ExternalPaymentIntent> {
    // Stax uses a charge/capture model
    const transaction = await this.request<StaxTransaction>('POST', '/charge', {
      customer_id: input.customerId,
      payment_method_id: input.paymentMethodId,
      total: input.amount / 100, // Stax uses dollars, not cents
      meta: input.metadata,
      pre_auth: !input.paymentMethodId, // Pre-auth if no payment method yet
    });

    return this.mapTransaction(transaction);
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent> {
    // Capture a pre-authorized transaction
    const transaction = await this.request<StaxTransaction>('POST', `/transaction/${paymentIntentId}/capture`);
    return this.mapTransaction(transaction);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent> {
    // Void a transaction
    const transaction = await this.request<StaxTransaction>('POST', `/transaction/${paymentIntentId}/void`);
    return this.mapTransaction(transaction);
  }

  async getPaymentIntent(paymentIntentId: string): Promise<ExternalPaymentIntent | null> {
    try {
      const transaction = await this.request<StaxTransaction>('GET', `/transaction/${paymentIntentId}`);
      return this.mapTransaction(transaction);
    } catch {
      return null;
    }
  }

  private mapTransaction(tx: StaxTransaction): ExternalPaymentIntent {
    let status: ExternalPaymentIntent['status'] = 'processing';

    if (tx.is_voided) {
      status = 'canceled';
    } else if (tx.success && tx.is_captured) {
      status = 'succeeded';
    } else if (tx.success && !tx.is_captured) {
      status = 'requires_confirmation';
    } else if (!tx.success) {
      status = 'failed';
    }

    return {
      id: tx.id,
      status,
      amount: Math.round(tx.total * 100), // Convert back to cents
      currency: 'usd',
    };
  }

  // Refunds
  async createRefund(input: CreateRefundInput): Promise<ExternalRefund> {
    const refund = await this.request<StaxTransaction>('POST', `/transaction/${input.paymentIntentId}/refund`, {
      total: input.amount ? input.amount / 100 : undefined,
    });

    return {
      id: refund.id,
      amount: Math.round(refund.total * 100),
      status: refund.success ? 'succeeded' : 'failed',
    };
  }

  // Subscriptions - Stax has limited subscription support via scheduled transactions
  async createSubscription(input: CreateSubscriptionInput): Promise<ExternalSubscription> {
    // Stax doesn't have native subscriptions like Stripe
    // We create a scheduled recurring charge
    const now = Date.now();
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const schedule = await this.request<{ id: string }>('POST', '/schedule', {
      customer_id: input.customerId,
      total: 0, // Will be set by price lookup
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      meta: input.metadata,
    });

    return {
      id: schedule.id,
      status: 'active',
      currentPeriodStart: Math.floor(now / 1000),
      currentPeriodEnd: Math.floor(endOfMonth.getTime() / 1000),
    };
  }

  async getSubscription(subscriptionId: string): Promise<ExternalSubscription | null> {
    try {
      const schedule = await this.request<{ id: string; is_active: boolean; next_run_at: string }>('GET', `/schedule/${subscriptionId}`);
      const now = Date.now();

      return {
        id: schedule.id,
        status: schedule.is_active ? 'active' : 'canceled',
        currentPeriodStart: Math.floor(now / 1000),
        currentPeriodEnd: schedule.next_run_at ? Math.floor(new Date(schedule.next_run_at).getTime() / 1000) : Math.floor(now / 1000),
      };
    } catch {
      return null;
    }
  }

  async updateSubscription(subscriptionId: string, input: Partial<CreateSubscriptionInput>): Promise<ExternalSubscription> {
    await this.request('PUT', `/schedule/${subscriptionId}`, {
      meta: input.metadata,
    });

    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found after update');
    }
    return subscription;
  }

  async cancelSubscription(subscriptionId: string, input?: CancelSubscriptionInput): Promise<ExternalSubscription> {
    if (input?.immediately) {
      await this.request('DELETE', `/schedule/${subscriptionId}`);
    } else {
      await this.request('PUT', `/schedule/${subscriptionId}`, {
        end_after_next: true,
      });
    }

    return {
      id: subscriptionId,
      status: 'canceled',
      currentPeriodStart: Math.floor(Date.now() / 1000),
      currentPeriodEnd: Math.floor(Date.now() / 1000),
      canceledAt: Math.floor(Date.now() / 1000),
    };
  }

  // Webhooks
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadStr)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  parseWebhookEvent(payload: string | Buffer): WebhookEvent {
    const event = JSON.parse(typeof payload === 'string' ? payload : payload.toString());

    return {
      id: event.id || crypto.randomUUID(),
      type: event.type || event.event_type,
      provider: 'stax',
      data: event.data || event,
      createdAt: event.created_at ? new Date(event.created_at).getTime() / 1000 : Math.floor(Date.now() / 1000),
    };
  }

  // ============================================
  // Stax Connect (Sub-Merchant) Methods
  // ============================================

  async createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccount> {
    const nameParts = input.businessName?.split(' ') || [];

    const subMerchant = await this.request<StaxSubMerchant>('POST', '/sub-merchant', {
      company_name: input.businessName || input.email.split('@')[0],
      contact_email: input.email,
      contact_name: nameParts.join(' ') || undefined,
      // Stax requires more fields for actual onboarding
      meta: input.metadata,
    });

    return this.mapSubMerchant(subMerchant);
  }

  async getConnectedAccount(accountId: string): Promise<ConnectedAccount | null> {
    try {
      const subMerchant = await this.request<StaxSubMerchant>('GET', `/sub-merchant/${accountId}`);
      return this.mapSubMerchant(subMerchant);
    } catch {
      return null;
    }
  }

  async updateConnectedAccount(accountId: string, input: Partial<CreateConnectedAccountInput>): Promise<ConnectedAccount> {
    const subMerchant = await this.request<StaxSubMerchant>('PUT', `/sub-merchant/${accountId}`, {
      company_name: input.businessName,
      contact_email: input.email,
      meta: input.metadata,
    });

    return this.mapSubMerchant(subMerchant);
  }

  async deleteConnectedAccount(accountId: string): Promise<void> {
    await this.request('DELETE', `/sub-merchant/${accountId}`);
  }

  async createAccountOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<ConnectedAccountOnboardingLink> {
    const response = await this.request<{ url: string; expires_at: string }>('POST', `/sub-merchant/${accountId}/onboarding-link`, {
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return {
      url: response.url,
      expiresAt: new Date(response.expires_at).getTime() / 1000,
    };
  }

  async createAccountDashboardLink(accountId: string): Promise<{ url: string }> {
    const response = await this.request<{ url: string }>('POST', `/sub-merchant/${accountId}/dashboard-link`);
    return { url: response.url };
  }

  private mapSubMerchant(subMerchant: StaxSubMerchant): ConnectedAccount {
    return {
      id: subMerchant.id,
      provider: 'stax',
      type: 'express', // Stax uses a single type
      email: subMerchant.contact_email,
      businessName: subMerchant.company_name,
      chargesEnabled: subMerchant.processing_enabled,
      payoutsEnabled: subMerchant.payout_enabled,
      detailsSubmitted: subMerchant.status === 'active',
      onboardingUrl: subMerchant.onboarding_url,
      createdAt: new Date(subMerchant.created_at).getTime() / 1000,
    };
  }

  // ============================================
  // Transfers (Split Payments for Sub-Merchants)
  // ============================================

  async createTransfer(input: CreateTransferInput): Promise<Transfer> {
    // Stax uses "splits" for transferring funds to sub-merchants
    const split = await this.request<StaxSplit>('POST', '/split', {
      sub_merchant_id: input.destinationAccountId,
      amount: input.amount / 100, // Stax uses dollars
      transaction_id: input.sourceTransaction,
      meta: input.metadata,
    });

    return this.mapSplit(split);
  }

  async getTransfer(transferId: string): Promise<Transfer | null> {
    try {
      const split = await this.request<StaxSplit>('GET', `/split/${transferId}`);
      return this.mapSplit(split);
    } catch {
      return null;
    }
  }

  async listTransfers(connectedAccountId?: string, limit = 10): Promise<Transfer[]> {
    const endpoint = connectedAccountId
      ? `/sub-merchant/${connectedAccountId}/splits?limit=${limit}`
      : `/splits?limit=${limit}`;

    const splits = await this.request<StaxSplit[]>('GET', endpoint);
    return splits.map((s) => this.mapSplit(s));
  }

  async reverseTransfer(transferId: string, amount?: number): Promise<Transfer> {
    const split = await this.request<StaxSplit>('POST', `/split/${transferId}/reverse`, {
      amount: amount ? amount / 100 : undefined,
    });

    return this.mapSplit(split);
  }

  private mapSplit(split: StaxSplit): Transfer {
    const statusMap: Record<StaxSplit['status'], Transfer['status']> = {
      pending: 'pending',
      processed: 'paid',
      failed: 'failed',
    };

    return {
      id: split.id,
      amount: Math.round(split.amount * 100),
      currency: 'usd',
      destinationAccountId: split.sub_merchant_id,
      status: statusMap[split.status] || 'pending',
      createdAt: new Date(split.created_at).getTime() / 1000,
    };
  }

  // ============================================
  // Platform Balance
  // ============================================

  async getPlatformBalance(): Promise<{ available: number; pending: number; currency: string }[]> {
    const balance = await this.request<{ available: number; pending: number }>('GET', '/merchant/balance');

    return [{
      available: Math.round(balance.available * 100),
      pending: Math.round(balance.pending * 100),
      currency: 'usd',
    }];
  }
}
