import { Hono } from 'hono';
import { z } from 'zod';
import { dbService } from '../../services/db.service';
import { authMiddleware, requireAuthUser } from '../../middleware/auth';
import { standardRateLimit } from '../../middleware/ratelimit';

const app = new Hono();

// All routes require authentication
app.use('*', authMiddleware);

// Profile update schema
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * GET /account/profile
 * Get user profile
 */
app.get('/', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // Get full user details
    const user = await dbService.getUserById(authUser.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get auth methods
    const methods = await dbService.getUserAuthMethods(user.id);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified === 1,
        phoneVerified: user.phone_verified === 1,
        createdAt: new Date(user.created_at).toISOString(),
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toISOString() : null,
        authMethods: methods.length,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

/**
 * PATCH /account/profile
 * Update user profile
 */
app.patch('/', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // Validate request body
    const body = await c.req.json();
    const updates = updateProfileSchema.parse(body);

    // Update user
    const updateFields: any = {};

    if (updates.displayName !== undefined) {
      updateFields.display_name = updates.displayName;
    }

    if (updates.avatarUrl !== undefined) {
      updateFields.avatar_url = updates.avatarUrl;
    }

    if (Object.keys(updateFields).length > 0) {
      await dbService.updateUser(authUser.userId, updateFields);
    }

    // Get updated user
    const user = await dbService.getUserById(authUser.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified === 1,
        phoneVerified: user.phone_verified === 1,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Validation error',
        details: error.errors,
      }, 400);
    }

    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

/**
 * DELETE /account/profile
 * Delete user account
 */
app.delete('/', standardRateLimit, async (c) => {
  try {
    const authUser = requireAuthUser(c);

    // Delete user (cascade will delete auth methods and sessions)
    await dbService.db.prepare(`
      DELETE FROM users WHERE id = ?
    `).run(authUser.userId);

    return c.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

export default app;
