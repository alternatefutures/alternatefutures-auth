/**
 * Customer Billing Routes
 * GET/POST /billing/customer
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { authMiddleware, requireAuthUser } from '../../middleware/auth';
import { dbService } from '../../services/db.service';
import { getDefaultProvider } from '../../services/payments';

const app = new Hono();

// Apply auth middleware to all customer routes
app.use('*', authMiddleware);

const createCustomerSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
});

/**
 * GET /billing/customer
 * Get or create billing customer for authenticated user
 */
app.get('/', async (c) => {
  try {
    const user = requireAuthUser(c);

    // Check if customer already exists
    let customer = await dbService.getBillingCustomerByUserId(user.userId);

    if (!customer) {
      // Get user details
      const userData = await dbService.getUserById(user.userId);

      if (!userData) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Create customer in payment provider
      const provider = getDefaultProvider();
      const externalCustomer = await provider.createCustomer({
        email: userData.email || user.email || '',
        name: userData.display_name || undefined,
        metadata: { userId: user.userId },
      });

      // Create customer in database
      customer = await dbService.createBillingCustomer({
        id: nanoid(),
        user_id: user.userId,
        email: userData.email || user.email,
        name: userData.display_name,
        stripe_customer_id: provider.name === 'stripe' ? externalCustomer.id : undefined,
        stax_customer_id: provider.name === 'stax' ? externalCustomer.id : undefined,
      });
    }

    return c.json({
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        createdAt: customer.created_at,
      },
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return c.json({ error: 'Failed to get customer' }, 500);
  }
});

/**
 * POST /billing/customer
 * Update billing customer details
 */
app.post('/', async (c) => {
  try {
    const user = requireAuthUser(c);
    const body = await c.req.json();
    const data = createCustomerSchema.parse(body);

    // Get existing customer
    let customer = await dbService.getBillingCustomerByUserId(user.userId);

    if (!customer) {
      return c.json({ error: 'Customer not found. Call GET first to create.' }, 404);
    }

    // Update customer in payment provider
    const provider = getDefaultProvider();
    const customerId = customer.stripe_customer_id || customer.stax_customer_id;

    if (customerId) {
      await provider.updateCustomer(customerId, {
        email: data.email,
        name: data.name,
      });
    }

    // Update customer in database
    await dbService.updateBillingCustomer(customer.id, {
      email: data.email || customer.email,
      name: data.name || customer.name,
    });

    // Get updated customer
    customer = await dbService.getBillingCustomerById(customer.id);

    if (!customer) {
      return c.json({ error: 'Failed to update customer' }, 500);
    }

    return c.json({
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        createdAt: customer.created_at,
      },
    });
  } catch (error) {
    console.error('Update customer error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to update customer' }, 500);
  }
});

export default app;
