/**
 * Subscriptions Routes
 * Manage user subscriptions
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { authMiddleware, requireAuthUser } from '../../middleware/auth';
import { dbService } from '../../services/db.service';
import { getDefaultProvider } from '../../services/payments';

const app = new Hono();

app.use('*', authMiddleware);

const createSubscriptionSchema = z.object({
  planId: z.string().min(1),
  seats: z.number().int().min(1).optional().default(1),
  paymentMethodId: z.string().min(1).optional(),
});

const updateSeatsSchema = z.object({
  seats: z.number().int().min(1),
});

/**
 * GET /billing/subscriptions
 * List all subscriptions for authenticated user
 */
app.get('/', async (c) => {
  try {
    const user = requireAuthUser(c);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ subscriptions: [] });
    }

    const subscriptions = await dbService.listSubscriptionsByCustomerId(customer.id);

    // Get plan details for each subscription
    const subscriptionsWithPlans = await Promise.all(
      subscriptions.map(async (sub) => {
        const plan = await dbService.getSubscriptionPlanById(sub.plan_id);
        return {
          id: sub.id,
          plan: plan?.name || 'UNKNOWN',
          status: sub.status,
          seats: sub.seats,
          basePricePerSeat: plan?.base_price_per_seat || 0,
          usageMarkup: plan?.usage_markup || 0,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAt: sub.cancel_at,
          trialEnd: sub.trial_end,
          createdAt: sub.created_at,
        };
      })
    );

    return c.json({ subscriptions: subscriptionsWithPlans });
  } catch (error) {
    console.error('List subscriptions error:', error);
    return c.json({ error: 'Failed to list subscriptions' }, 500);
  }
});

/**
 * GET /billing/subscriptions/active
 * Get the active subscription for authenticated user
 */
app.get('/active', async (c) => {
  try {
    const user = requireAuthUser(c);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ subscription: null });
    }

    const subscription = await dbService.getActiveSubscriptionByCustomerId(customer.id);
    if (!subscription) {
      return c.json({ subscription: null });
    }

    const plan = await dbService.getSubscriptionPlanById(subscription.plan_id);

    return c.json({
      subscription: {
        id: subscription.id,
        plan: plan?.name || 'UNKNOWN',
        status: subscription.status,
        seats: subscription.seats,
        basePricePerSeat: plan?.base_price_per_seat || 0,
        usageMarkup: plan?.usage_markup || 0,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAt: subscription.cancel_at,
        trialEnd: subscription.trial_end,
        createdAt: subscription.created_at,
      },
    });
  } catch (error) {
    console.error('Get active subscription error:', error);
    return c.json({ error: 'Failed to get active subscription' }, 500);
  }
});

/**
 * POST /billing/subscriptions
 * Create a new subscription
 */
app.post('/', async (c) => {
  try {
    const user = requireAuthUser(c);
    const body = await c.req.json();
    const data = createSubscriptionSchema.parse(body);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found. Create customer first.' }, 404);
    }

    // Check for existing active subscription
    const existingSubscription = await dbService.getActiveSubscriptionByCustomerId(customer.id);
    if (existingSubscription) {
      return c.json({ error: 'Already have an active subscription. Cancel it first.' }, 400);
    }

    // Get the plan
    const plan = await dbService.getSubscriptionPlanById(data.planId);
    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    // Create subscription in provider (if not FREE plan)
    let stripeSubscriptionId: string | undefined;
    const now = Date.now();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (plan.name !== 'FREE' && plan.stripe_price_id && customer.stripe_customer_id) {
      const provider = getDefaultProvider();
      if (provider.createSubscription) {
        const externalSub = await provider.createSubscription({
          customerId: customer.stripe_customer_id,
          priceId: plan.stripe_price_id,
          quantity: data.seats,
          metadata: { userId: user.userId },
        });
        stripeSubscriptionId = externalSub.id;
      }
    }

    // Create subscription in database
    const subscription = await dbService.createSubscription({
      id: nanoid(),
      customer_id: customer.id,
      plan_id: plan.id,
      status: 'ACTIVE',
      seats: data.seats,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_start: Math.floor(now / 1000),
      current_period_end: Math.floor(periodEnd.getTime() / 1000),
    });

    return c.json({
      subscription: {
        id: subscription.id,
        plan: plan.name,
        status: subscription.status,
        seats: subscription.seats,
        basePricePerSeat: plan.base_price_per_seat,
        usageMarkup: plan.usage_markup,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        createdAt: subscription.created_at,
      },
    });
  } catch (error) {
    console.error('Create subscription error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to create subscription' }, 500);
  }
});

/**
 * POST /billing/subscriptions/:id/cancel
 * Cancel a subscription
 */
app.post('/:id/cancel', async (c) => {
  try {
    const user = requireAuthUser(c);
    const subscriptionId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const immediately = body.immediately === true;

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const subscription = await dbService.getSubscriptionById(subscriptionId);
    if (!subscription || subscription.customer_id !== customer.id) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    // Cancel in provider
    if (subscription.stripe_subscription_id) {
      const provider = getDefaultProvider();
      if (provider.cancelSubscription) {
        await provider.cancelSubscription(subscription.stripe_subscription_id, { immediately });
      }
    }

    // Update in database
    const updates: Record<string, unknown> = {
      status: immediately ? 'CANCELED' : 'ACTIVE',
      canceled_at: Date.now(),
    };

    if (!immediately) {
      updates.cancel_at = subscription.current_period_end;
    }

    await dbService.updateSubscription(subscriptionId, updates);

    const updatedSubscription = await dbService.getSubscriptionById(subscriptionId);
    const plan = await dbService.getSubscriptionPlanById(subscription.plan_id);

    return c.json({
      subscription: {
        id: updatedSubscription!.id,
        plan: plan?.name || 'UNKNOWN',
        status: updatedSubscription!.status,
        seats: updatedSubscription!.seats,
        cancelAt: updatedSubscription!.cancel_at,
        canceledAt: updatedSubscription!.canceled_at,
      },
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return c.json({ error: 'Failed to cancel subscription' }, 500);
  }
});

/**
 * PUT /billing/subscriptions/:id/seats
 * Update subscription seat count
 */
app.put('/:id/seats', async (c) => {
  try {
    const user = requireAuthUser(c);
    const subscriptionId = c.req.param('id');
    const body = await c.req.json();
    const data = updateSeatsSchema.parse(body);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const subscription = await dbService.getSubscriptionById(subscriptionId);
    if (!subscription || subscription.customer_id !== customer.id) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    // Update in provider
    if (subscription.stripe_subscription_id) {
      const provider = getDefaultProvider();
      if (provider.updateSubscription) {
        await provider.updateSubscription(subscription.stripe_subscription_id, {
          quantity: data.seats,
        });
      }
    }

    // Update in database
    await dbService.updateSubscription(subscriptionId, { seats: data.seats });

    const updatedSubscription = await dbService.getSubscriptionById(subscriptionId);
    const plan = await dbService.getSubscriptionPlanById(subscription.plan_id);

    return c.json({
      subscription: {
        id: updatedSubscription!.id,
        plan: plan?.name || 'UNKNOWN',
        status: updatedSubscription!.status,
        seats: updatedSubscription!.seats,
      },
    });
  } catch (error) {
    console.error('Update subscription seats error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request data', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to update subscription seats' }, 500);
  }
});

/**
 * GET /billing/subscriptions/plans
 * List available subscription plans
 */
app.get('/plans', async (c) => {
  try {
    const plans = await dbService.listSubscriptionPlans();

    return c.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        basePricePerSeat: p.base_price_per_seat,
        usageMarkup: p.usage_markup,
        features: p.features ? JSON.parse(p.features) : null,
      })),
    });
  } catch (error) {
    console.error('List plans error:', error);
    return c.json({ error: 'Failed to list plans' }, 500);
  }
});

export default app;
