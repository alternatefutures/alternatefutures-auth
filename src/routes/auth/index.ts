import { Hono } from 'hono';
import emailRoutes from './email';
import smsRoutes from './sms';
import walletRoutes from './wallet';
import oauthRoutes from './oauth';
import sessionRoutes from './session';

const app = new Hono();

// Mount sub-routes
app.route('/email', emailRoutes);
app.route('/sms', smsRoutes);
app.route('/wallet', walletRoutes);
app.route('/oauth', oauthRoutes);
app.route('/', sessionRoutes);

export default app;
