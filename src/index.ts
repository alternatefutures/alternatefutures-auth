import 'dotenv/config';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { corsMiddleware, devCorsMiddleware } from './middleware/cors';
import authRoutes from './routes/auth';
import accountRoutes from './routes/account';

const app = new Hono();

// Middleware
app.use('*', logger());

// Use appropriate CORS middleware based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
app.use('*', isDevelopment ? devCorsMiddleware : corsMiddleware);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'alternatefutures-auth',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'Alternate Futures Authentication Service',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: {
        email: {
          request: 'POST /auth/email/request',
          verify: 'POST /auth/email/verify',
        },
        sms: {
          request: 'POST /auth/sms/request',
          verify: 'POST /auth/sms/verify',
        },
        wallet: {
          challenge: 'POST /auth/wallet/challenge',
          verify: 'POST /auth/wallet/verify',
        },
        oauth: {
          initiate: 'GET /auth/oauth/:provider',
          callback: 'GET /auth/oauth/callback',
        },
        session: {
          refresh: 'POST /auth/refresh',
          logout: 'POST /auth/logout',
        },
      },
      account: {
        profile: 'GET /account/profile',
        methods: 'GET /account/methods',
      },
    },
  });
});

// Mount auth routes
app.route('/auth', authRoutes);

// Mount account routes
app.route('/account', accountRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 Alternate Futures Auth Service starting on port ${port}`);

// For edge runtimes (Cloudflare Workers, Bun, Deno)
export default {
  port,
  fetch: app.fetch,
};

// For Node.js development
if (process.env.NODE_ENV !== 'production' || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  const { serve } = await import('@hono/node-server');

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`✅ Server listening on http://localhost:${port}`);
}
