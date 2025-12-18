/**
 * Payment Providers Module
 * Unified payment processing for Stripe, StaxPayments, and Relay.link
 */

// Export the factory and initialization
export {
  initializePaymentProviders,
  getProvider,
  getDefaultProvider,
  getCryptoProvider,
  setDefaultProvider,
  isProviderAvailable,
  getAvailableProviders,
  getProviderStatus,
  getProviderForPaymentMethod,
  getProviderForWebhook,
} from './provider.factory';

// Export all types
export type {
  ProviderName,
  PaymentProvider,
  PaymentProviderConfig,
  StripeConfig,
  StaxConfig,
  RelayConfig,
  ExternalCustomer,
  ExternalPaymentMethod,
  ExternalPaymentIntent,
  ExternalSubscription,
  ExternalInvoice,
  ExternalRefund,
  CreateCustomerInput,
  AttachPaymentMethodInput,
  CreatePaymentIntentInput,
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  CreateRefundInput,
  WebhookEvent,
  // Connect / Marketplace types
  ConnectedAccount,
  CreateConnectedAccountInput,
  ConnectedAccountOnboardingLink,
  Transfer,
  CreateTransferInput,
} from './types';

// Export provider classes (for direct instantiation if needed)
export { StripeProvider } from './stripe.provider';
export { StaxProvider } from './stax.provider';
export { RelayProvider } from './relay.provider';
