import { Hono } from 'hono';
import profileRoutes from './profile';
import methodsRoutes from './methods';

const app = new Hono();

// Mount sub-routes
app.route('/', profileRoutes);
app.route('/methods', methodsRoutes);

export default app;
