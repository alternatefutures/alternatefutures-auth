/**
 * Payment Provider Factory
 * Creates and manages payment provider instances
 */

import type { PaymentProvider, PaymentProviderConfig, ProviderName } from './types';
import { StripeProvider } from './stripe.provider';
import { StaxProvider } from './stax.provider';
import { RelayProvider } from './relay.provider';

let providers: Map<ProviderName, PaymentProvider> | null = null;
let defaultProvider: ProviderName = 'stripe';

/**
 * Initialize payment providers with configuration
 * Call this once at application startup
 */
export function initializePaymentProviders(config: PaymentProviderConfig): void {
  providers = new Map();

  if (config.stripe) {
    providers.set('stripe', new StripeProvider(config.stripe));
  }

  if (config.stax) {
    providers.set('stax', new StaxProvider(config.stax));
  }

  if (config.relay) {
    providers.set('relay', new RelayProvider(config.relay));
  }

  // Set default provider (prefer Stripe, then Stax)
  if (providers.has('stripe')) {
    defaultProvider = 'stripe';
  } else if (providers.has('stax')) {
    defaultProvider = 'stax';
  }
}

/**
 * Get a specific payment provider by name
 */
export function getProvider(name: ProviderName): PaymentProvider {
  if (!providers) {
    throw new Error('Payment providers not initialized. Call initializePaymentProviders first.');
  }

  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Payment provider '${name}' is not configured`);
  }

  return provider;
}

/**
 * Get the default payment provider (for card payments)
 */
export function getDefaultProvider(): PaymentProvider {
  return getProvider(defaultProvider);
}

/**
 * Get the crypto payment provider (Relay)
 */
export function getCryptoProvider(): PaymentProvider {
  return getProvider('relay');
}

/**
 * Set the default provider for card payments
 */
export function setDefaultProvider(name: 'stripe' | 'stax'): void {
  if (!providers?.has(name)) {
    throw new Error(`Cannot set default provider to '${name}' - not configured`);
  }
  defaultProvider = name;
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(name: ProviderName): boolean {
  return providers?.has(name) || false;
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): ProviderName[] {
  if (!providers) {
    return [];
  }
  return Array.from(providers.keys());
}

/**
 * Get provider configuration status
 */
export function getProviderStatus(): Record<ProviderName, boolean> {
  return {
    stripe: providers?.has('stripe') || false,
    stax: providers?.has('stax') || false,
    relay: providers?.has('relay') || false,
  };
}

/**
 * Determine which provider to use based on payment method type
 */
export function getProviderForPaymentMethod(type: 'card' | 'crypto', preferredProvider?: ProviderName): PaymentProvider {
  if (type === 'crypto') {
    return getCryptoProvider();
  }

  if (preferredProvider && (preferredProvider === 'stripe' || preferredProvider === 'stax')) {
    if (isProviderAvailable(preferredProvider)) {
      return getProvider(preferredProvider);
    }
  }

  return getDefaultProvider();
}

/**
 * Route webhook to appropriate provider
 */
export function getProviderForWebhook(source: string): PaymentProvider | null {
  const sourceMap: Record<string, ProviderName> = {
    stripe: 'stripe',
    stax: 'stax',
    fattmerchant: 'stax',
    relay: 'relay',
  };

  const providerName = sourceMap[source.toLowerCase()];
  if (!providerName || !isProviderAvailable(providerName)) {
    return null;
  }

  return getProvider(providerName);
}

// Re-export types for convenience
export * from './types';
export { StripeProvider } from './stripe.provider';
export { StaxProvider } from './stax.provider';
export { RelayProvider } from './relay.provider';
