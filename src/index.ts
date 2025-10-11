import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

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

// TODO: Mount auth routes
// app.route('/auth', authRoutes);

// TODO: Mount account routes
// app.route('/account', accountRoutes);

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

export default {
  port,
  fetch: app.fetch,
};
