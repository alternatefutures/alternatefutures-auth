import { Hono } from 'hono';
import { z } from 'zod';
import { dbService } from '../../services/db.service.js';
import { TokenService } from '../../services/token.service.js';
import { authMiddleware, requireAuthUser } from '../../middleware/auth.js';
import { standardRateLimit } from '../../middleware/ratelimit.js';

const app = new Hono();
const tokenService = new TokenService(dbService);

// Most routes require authentication (except validate which is internal)
app.use('/limits', authMiddleware);
app.use('/', authMiddleware);

// Schema for creating a token
const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.number().optional(),
});

/**
 * POST /tokens
 * Create a new personal access token
 */
app.post('/', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // Validate request body
    const body = await c.req.json();
    const { name, expiresAt } = createTokenSchema.parse(body);

    // Create token
    const token = await tokenService.createToken(authUser.userId, name, expiresAt);

    return c.json({
      success: true,
      token: {
        id: token.id,
        name: token.name,
        token: token.token, // Only returned on creation
        expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
        createdAt: new Date(token.createdAt).toISOString(),
      },
    }, 201);
  } catch (error: any) {
    console.error('Create token error:', error);

    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Validation error',
        details: error.errors,
      }, 400);
    }

    // Handle rate limit errors
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return c.json({
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
        resetAt: error.resetAt,
      }, 429);
    }

    // Handle token limit errors
    if (error.code === 'MAX_TOKENS_EXCEEDED') {
      return c.json({
        error: error.message,
        code: 'MAX_TOKENS_EXCEEDED',
      }, 400);
    }

    // Handle invalid token name errors
    if (error.code === 'INVALID_TOKEN_NAME') {
      return c.json({
        error: error.message,
        code: 'INVALID_TOKEN_NAME',
      }, 400);
    }

    return c.json({ error: 'Failed to create token' }, 500);
  }
});

/**
 * GET /tokens
 * List user's personal access tokens
 */
app.get('/', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // List tokens (without token values)
    const tokens = await tokenService.listTokens(authUser.userId);

    return c.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        expiresAt: t.expiresAt ? new Date(t.expiresAt).toISOString() : null,
        lastUsedAt: t.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : null,
        createdAt: new Date(t.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('List tokens error:', error);
    return c.json({ error: 'Failed to list tokens' }, 500);
  }
});

/**
 * DELETE /tokens/:id
 * Delete a personal access token
 */
app.delete('/:id', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);
    const tokenId = c.req.param('id');

    // Delete token
    await tokenService.deleteToken(tokenId, authUser.userId);

    return c.json({
      success: true,
      message: 'Token deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete token error:', error);

    if (error.message === 'Token not found') {
      return c.json({ error: 'Token not found' }, 404);
    }

    if (error.message.includes('Unauthorized')) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ error: 'Failed to delete token' }, 500);
  }
});

/**
 * POST /tokens/validate
 * Validate a personal access token (internal use)
 * This endpoint does NOT require authentication as it's used to authenticate requests
 */
const validateTokenSchema = z.object({
  token: z.string().min(1),
});

app.post('/validate', standardRateLimit, async (c) => {
  try {
    // Validate request body
    const body = await c.req.json();
    const { token } = validateTokenSchema.parse(body);

    // Validate token
    const result = await tokenService.validateToken(token);

    if (!result) {
      return c.json({
        valid: false,
        error: 'Invalid or expired token',
      }, 401);
    }

    return c.json({
      valid: true,
      userId: result.userId,
      tokenId: result.tokenId,
    });
  } catch (error) {
    console.error('Validate token error:', error);

    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Validation error',
        details: error.errors,
      }, 400);
    }

    return c.json({ error: 'Failed to validate token' }, 500);
  }
});

/**
 * GET /tokens/limits
 * Get rate limits for token creation
 */
app.get('/limits', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // Get rate limit info
    const limits = await tokenService.getRemainingLimit(authUser.userId);

    return c.json({
      rateLimit: {
        remaining: limits.remaining,
        limit: limits.limit,
        resetAt: limits.resetAt.toISOString(),
      },
      tokenLimit: {
        active: limits.activeTokens,
        max: limits.maxActiveTokens,
      },
    });
  } catch (error) {
    console.error('Get limits error:', error);
    return c.json({ error: 'Failed to get limits' }, 500);
  }
});

export default app;
