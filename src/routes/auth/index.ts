import { Hono } from 'hono';
import emailRoutes from './email';
import walletRoutes from './wallet';
import sessionRoutes from './session';

const app = new Hono();

// Mount sub-routes
app.route('/email', emailRoutes);
app.route('/wallet', walletRoutes);
app.route('/', sessionRoutes);

export default app;
