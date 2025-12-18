/**
 * Payment Methods Routes
 * CRUD operations for payment methods (cards & crypto wallets)
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { authMiddleware, requireAuthUser } from '../../middleware/auth';
import { dbService } from '../../services/db.service';
import { getProvider, getDefaultProvider, getCryptoProvider, isProviderAvailable } from '../../services/payments';

const app = new Hono();

app.use('*', authMiddleware);

const addCardSchema = z.object({
  paymentMethodId: z.string().min(1),
  provider: z.enum(['stripe', 'stax']).optional().default('stripe'),
  setDefault: z.boolean().optional().default(false),
});

const addCryptoWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  blockchain: z.string().min(1),
  setDefault: z.boolean().optional().default(false),
});

/**
 * GET /billing/payment-methods
 * List all payment methods for authenticated user
 */
app.get('/', async (c) => {
  try {
    const user = requireAuthUser(c);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ paymentMethods: [] });
    }

    const methods = await dbService.listPaymentMethodsByCustomerId(customer.id);

    return c.json({
      paymentMethods: methods.map((m) => ({
        id: m.id,
        type: m.type,
        provider: m.provider,
        cardBrand: m.card_brand,
        cardLast4: m.card_last4,
        cardExpMonth: m.card_exp_month,
        cardExpYear: m.card_exp_year,
        walletAddress: m.wallet_address,
        blockchain: m.blockchain,
        isDefault: m.is_default === 1,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error('List payment methods error:', error);
    return c.json({ error: 'Failed to list payment methods' }, 500);
  }
});

/**
 * POST /billing/payment-methods/card
 * Add a new card payment method
 */
app.post('/card', async (c) => {
  try {
    const user = requireAuthUser(c);
    const body = await c.req.json();
    const data = addCardSchema.parse(body);

    // Get or create customer
    let customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found. Create customer first.' }, 404);
    }

    // Get the appropriate provider
    const provider = getProvider(data.provider);
    const customerId = data.provider === 'stripe' ? customer.stripe_customer_id : customer.stax_customer_id;

    if (!customerId) {
      // Create customer in this provider
      const userData = await dbService.getUserById(user.userId);
      const externalCustomer = await provider.createCustomer({
        email: customer.email || userData?.email || '',
        name: customer.name || userData?.display_name,
        metadata: { userId: user.userId },
      });

      // Update customer with provider ID
      await dbService.updateBillingCustomer(customer.id, {
        [data.provider === 'stripe' ? 'stripe_customer_id' : 'stax_customer_id']: externalCustomer.id,
      });

      customer = await dbService.getBillingCustomerById(customer.id);
    }

    const providerCustomerId = data.provider === 'stripe' ? customer!.stripe_customer_id! : customer!.stax_customer_id!;

    // Attach payment method to customer in provider
    const externalMethod = await provider.attachPaymentMethod(providerCustomerId, {
      paymentMethodId: data.paymentMethodId,
    });

    // If setting as default, update in provider
    if (data.setDefault) {
      await provider.setDefaultPaymentMethod(providerCustomerId, externalMethod.id);
      // Unset other defaults in DB
      const existingMethods = await dbService.listPaymentMethodsByCustomerId(customer!.id);
      for (const method of existingMethods) {
        if (method.is_default === 1) {
          await dbService.updatePaymentMethod(method.id, { is_default: 0 });
        }
      }
    }

    // Save to database
    const paymentMethod = await dbService.createPaymentMethod({
      id: nanoid(),
      customer_id: customer!.id,
      type: 'CARD',
      provider: data.provider,
      card_brand: externalMethod.cardBrand,
      card_last4: externalMethod.cardLast4,
      card_exp_month: externalMethod.cardExpMonth,
      card_exp_year: externalMethod.cardExpYear,
      stripe_payment_method_id: data.provider === 'stripe' ? externalMethod.id : undefined,
      stax_payment_method_id: data.provider === 'stax' ? externalMethod.id : undefined,
      is_default: data.setDefault ? 1 : 0,
      is_active: 1,
    });

    return c.json({
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        provider: paymentMethod.provider,
        cardBrand: paymentMethod.card_brand,
        cardLast4: paymentMethod.card_last4,
        cardExpMonth: paymentMethod.card_exp_month,
        cardExpYear: paymentMethod.card_exp_year,
        isDefault: paymentMethod.is_default === 1,
        createdAt: paymentMethod.created_at,
      },
    });
  } catch (error) {
    console.error('Add card error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to add card' }, 500);
  }
});

/**
 * POST /billing/payment-methods/crypto
 * Add a crypto wallet as payment method
 */
app.post('/crypto', async (c) => {
  try {
    const user = requireAuthUser(c);
    const body = await c.req.json();
    const data = addCryptoWalletSchema.parse(body);

    if (!isProviderAvailable('relay')) {
      return c.json({ error: 'Crypto payments not configured' }, 400);
    }

    let customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found. Create customer first.' }, 404);
    }

    // Verify wallet with Relay
    const cryptoProvider = getCryptoProvider();
    const externalMethod = await cryptoProvider.attachPaymentMethod(customer.id, {
      walletAddress: data.walletAddress,
      blockchain: data.blockchain,
    });

    // If setting as default, unset other defaults
    if (data.setDefault) {
      const existingMethods = await dbService.listPaymentMethodsByCustomerId(customer.id);
      for (const method of existingMethods) {
        if (method.is_default === 1) {
          await dbService.updatePaymentMethod(method.id, { is_default: 0 });
        }
      }
    }

    // Save to database
    const paymentMethod = await dbService.createPaymentMethod({
      id: nanoid(),
      customer_id: customer.id,
      type: 'CRYPTO',
      provider: 'relay',
      wallet_address: data.walletAddress,
      blockchain: data.blockchain,
      is_default: data.setDefault ? 1 : 0,
      is_active: 1,
    });

    return c.json({
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        provider: paymentMethod.provider,
        walletAddress: paymentMethod.wallet_address,
        blockchain: paymentMethod.blockchain,
        isDefault: paymentMethod.is_default === 1,
        createdAt: paymentMethod.created_at,
      },
    });
  } catch (error) {
    console.error('Add crypto wallet error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to add crypto wallet' }, 500);
  }
});

/**
 * PUT /billing/payment-methods/:id/default
 * Set a payment method as default
 */
app.put('/:id/default', async (c) => {
  try {
    const user = requireAuthUser(c);
    const paymentMethodId = c.req.param('id');

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const paymentMethod = await dbService.getPaymentMethodById(paymentMethodId);
    if (!paymentMethod || paymentMethod.customer_id !== customer.id) {
      return c.json({ error: 'Payment method not found' }, 404);
    }

    // Update in provider (if card)
    if (paymentMethod.type === 'CARD') {
      const provider = getProvider(paymentMethod.provider);
      const customerId = paymentMethod.provider === 'stripe' ? customer.stripe_customer_id : customer.stax_customer_id;
      const providerMethodId = paymentMethod.stripe_payment_method_id || paymentMethod.stax_payment_method_id;

      if (customerId && providerMethodId) {
        await provider.setDefaultPaymentMethod(customerId, providerMethodId);
      }
    }

    // Unset other defaults
    const methods = await dbService.listPaymentMethodsByCustomerId(customer.id);
    for (const method of methods) {
      if (method.is_default === 1 && method.id !== paymentMethodId) {
        await dbService.updatePaymentMethod(method.id, { is_default: 0 });
      }
    }

    // Set this as default
    await dbService.updatePaymentMethod(paymentMethodId, { is_default: 1 });

    return c.json({ success: true });
  } catch (error) {
    console.error('Set default payment method error:', error);
    return c.json({ error: 'Failed to set default payment method' }, 500);
  }
});

/**
 * DELETE /billing/payment-methods/:id
 * Remove a payment method
 */
app.delete('/:id', async (c) => {
  try {
    const user = requireAuthUser(c);
    const paymentMethodId = c.req.param('id');

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const paymentMethod = await dbService.getPaymentMethodById(paymentMethodId);
    if (!paymentMethod || paymentMethod.customer_id !== customer.id) {
      return c.json({ error: 'Payment method not found' }, 404);
    }

    // Remove from provider (if card)
    if (paymentMethod.type === 'CARD') {
      const provider = getProvider(paymentMethod.provider);
      const providerMethodId = paymentMethod.stripe_payment_method_id || paymentMethod.stax_payment_method_id;

      if (providerMethodId) {
        await provider.detachPaymentMethod(providerMethodId);
      }
    }

    // Delete from database
    await dbService.deletePaymentMethod(paymentMethodId);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete payment method error:', error);
    return c.json({ error: 'Failed to delete payment method' }, 500);
  }
});

export default app;
