/**
 * Invoices Routes
 * View and manage invoices
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { authMiddleware, requireAuthUser } from '../../middleware/auth';
import { dbService } from '../../services/db.service';

const app = new Hono();

app.use('*', authMiddleware);

const listInvoicesSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * GET /billing/invoices
 * List invoices for authenticated user
 */
app.get('/', async (c) => {
  try {
    const user = requireAuthUser(c);
    const query = c.req.query();
    const params = listInvoicesSchema.parse(query);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ invoices: [] });
    }

    let invoices = await dbService.listInvoicesByCustomerId(customer.id);

    // Filter by status if provided
    if (params.status) {
      invoices = invoices.filter((inv) => inv.status === params.status);
    }

    // Apply limit
    invoices = invoices.slice(0, params.limit);

    return c.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        status: inv.status,
        subtotal: inv.subtotal,
        tax: inv.tax,
        total: inv.total,
        amountPaid: inv.amount_paid,
        amountDue: inv.amount_due,
        currency: inv.currency,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
        pdfUrl: inv.pdf_url,
        createdAt: inv.created_at,
      })),
    });
  } catch (error) {
    console.error('List invoices error:', error);

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.issues }, 400);
    }

    return c.json({ error: 'Failed to list invoices' }, 500);
  }
});

/**
 * GET /billing/invoices/:id
 * Get a specific invoice with line items
 */
app.get('/:id', async (c) => {
  try {
    const user = requireAuthUser(c);
    const invoiceId = c.req.param('id');

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const invoice = await dbService.getInvoiceById(invoiceId);
    if (!invoice || invoice.customer_id !== customer.id) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const lineItems = await dbService.listInvoiceLineItemsByInvoiceId(invoiceId);

    return c.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        pdfUrl: invoice.pdf_url,
        createdAt: invoice.created_at,
        lineItems: lineItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          amount: item.amount,
        })),
      },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    return c.json({ error: 'Failed to get invoice' }, 500);
  }
});

/**
 * POST /billing/invoices/generate
 * Generate an invoice for the current billing period
 */
app.post('/generate', async (c) => {
  try {
    const user = requireAuthUser(c);

    const customer = await dbService.getBillingCustomerByUserId(user.userId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const subscription = await dbService.getActiveSubscriptionByCustomerId(customer.id);
    if (!subscription) {
      return c.json({ error: 'No active subscription' }, 400);
    }

    const plan = await dbService.getSubscriptionPlanById(subscription.plan_id);
    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    // Check for existing invoice for this period
    const existingInvoices = await dbService.listInvoicesByCustomerId(customer.id);
    const existingForPeriod = existingInvoices.find(
      (inv) =>
        inv.period_start === subscription.current_period_start &&
        inv.period_end === subscription.current_period_end &&
        inv.status !== 'VOID'
    );

    if (existingForPeriod) {
      return c.json({ error: 'Invoice already exists for this period', invoiceId: existingForPeriod.id }, 400);
    }

    // Calculate subscription cost
    const subscriptionAmount = plan.base_price_per_seat * subscription.seats;

    // Get usage for this period
    const usage = await dbService.getUsageAggregatesByCustomerAndPeriod(
      customer.id,
      subscription.current_period_start,
      subscription.current_period_end
    );

    // Calculate usage costs with markup
    let usageAmount = 0;
    const lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> = [];

    // Add subscription line item
    lineItems.push({
      description: `${plan.name} Plan (${subscription.seats} seat${subscription.seats > 1 ? 's' : ''})`,
      quantity: subscription.seats,
      unitPrice: plan.base_price_per_seat,
      amount: subscriptionAmount,
    });

    // Add usage line items
    for (const u of usage) {
      const amount = Math.round(u.total_amount * (1 + plan.usage_markup));
      usageAmount += amount;

      lineItems.push({
        description: `${u.metric_type.charAt(0).toUpperCase() + u.metric_type.slice(1)} Usage`,
        quantity: u.total_quantity,
        unitPrice: Math.round(u.total_amount / u.total_quantity),
        amount,
      });
    }

    const subtotal = subscriptionAmount + usageAmount;
    const tax = 0; // No tax calculation for now
    const total = subtotal + tax;

    // Generate invoice number
    const invoiceCount = existingInvoices.length + 1;
    const invoiceNumber = `INV-${customer.id.slice(0, 8).toUpperCase()}-${String(invoiceCount).padStart(4, '0')}`;

    // Create invoice
    const invoice = await dbService.createInvoice({
      id: nanoid(),
      customer_id: customer.id,
      subscription_id: subscription.id,
      invoice_number: invoiceNumber,
      status: 'OPEN',
      subtotal,
      tax,
      total,
      amount_paid: 0,
      amount_due: total,
      currency: 'usd',
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      due_date: subscription.current_period_end,
    });

    // Create line items
    for (const item of lineItems) {
      await dbService.createInvoiceLineItem({
        id: nanoid(),
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      });
    }

    return c.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        dueDate: invoice.due_date,
        createdAt: invoice.created_at,
        lineItems,
      },
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    return c.json({ error: 'Failed to generate invoice' }, 500);
  }
});

export default app;
