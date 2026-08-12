/**
 * AUTH routes — login, refresh, logout, me.
 *
 * POST /api/auth/login        — phone + pin/password → access + refresh tokens
 * POST /api/auth/refresh      — refresh token → new access + refresh (rotation)
 * POST /api/auth/logout       — invalidate refresh token
 * GET  /api/auth/me           — current user + permissions
 */
import { Router } from 'express';
import { pool, RowDataPacket } from '../db';
import { verifyPassword, hashToken, signAccessToken, signRefreshToken, verifyToken, AccessPayload, fingerprint } from '../auth/jwt';
import { validateBody, authRequired, optionalAuth } from '../middleware';
import { loginSchema, refreshSchema, logoutSchema } from '../validation/auth';
import { AuthError } from '../errors';
import { ok } from '../utils/response';
import { logger } from '../logger';
import { writeAudit } from '../audit';
import rateLimit from 'express-rate-limit';

export const authRouter = Router();

// Strict rate limit for login — 10 attempts / minute per IP
// In test environment, allow more attempts so tests don't interfere
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMIT', message: 'Too many login attempts, try again in a minute' },
});

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { phone, pin, password, deviceId } = req.body;

    // Lookup user by phone (across all restaurants — phone is unique per restaurant)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.restaurant_id, u.role_id, u.pin_hash, u.password_hash,
              u.is_active, u.failed_attempts, u.locked_until, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.phone = ? AND u.is_active = 1 AND u.deleted_at IS NULL
        LIMIT 5`,
      [phone]
    );
    if (rows.length === 0) throw new AuthError('Invalid credentials');

    // For multi-tenant where phone is unique per restaurant, we get exactly 1 row
    const user = rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthError('Account locked, try again later', 'ACCOUNT_LOCKED');
    }

    const hashToCheck = pin ? user.pin_hash : user.password_hash;
    if (!hashToCheck) throw new AuthError('Invalid credentials');

    const valid = await verifyPassword(pin ?? password, hashToCheck);
    if (!valid) {
      // Increment failed attempts
      const newFails = (user.failed_attempts ?? 0) + 1;
      const lockUntil = newFails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.execute(
        `UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`,
        [newFails, lockUntil, user.id]
      );
      throw new AuthError('Invalid credentials');
    }

    // Reset failed attempts
    await pool.execute(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(3) WHERE id = ?`,
      [user.id]
    );

    const fp = fingerprint(req.ip ?? '', req.headers['user-agent'] ?? '');
    const access = signAccessToken({
      sub: user.id, restaurantId: user.restaurant_id,
      role: user.role_id, roleName: user.role_name, fp,
    });
    const refresh = signRefreshToken({ sub: user.id, restaurantId: user.restaurant_id });

    // Persist session
    const refreshHash = hashToken(refresh);
    await pool.execute(
      `INSERT INTO sessions (id, user_id, token_hash, refresh_hash, ip, user_agent, fingerprint, expires_at, refresh_expires_at, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL 15 MINUTE), DATE_ADD(NOW(3), INTERVAL 7 DAY), NOW(3))`,
      [
        user.id,
        hashToken(access),
        refreshHash,
        req.ip ?? null,
        (req.headers['user-agent'] as string) ?? null,
        fp || null,
      ]
    );

    if (deviceId) {
      await pool.execute(
        `INSERT INTO devices (id, restaurant_id, user_id, name, type, last_seen_at, is_active, created_at)
         VALUES (?, ?, ?, NULL, 'pos', NOW(3), 1, NOW(3))
         ON DUPLICATE KEY UPDATE last_seen_at = NOW(3), user_id = ?`,
        [deviceId, user.restaurant_id, user.id, user.id]
      );
    }

    await writeAudit({
      restaurantId: user.restaurant_id, userId: user.id,
      action: 'login', entity: 'user', entityId: user.id,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    logger.info(`User ${user.id} logged in`, { ip: req.ip });

    return ok(res, {
      accessToken: access,
      refreshToken: refresh,
      user: { id: user.id, restaurantId: user.restaurant_id, roleId: user.role_id, roleName: user.role_name },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    let payload: { sub: string; restaurantId: string; type: string; jti: string };
    try {
      payload = verifyToken(refreshToken);
    } catch {
      throw new AuthError('Invalid refresh token', 'TOKEN_EXPIRED');
    }
    if (payload.type !== 'refresh') throw new AuthError('Wrong token type');

    const refreshHash = hashToken(refreshToken);
    const [sessionRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id, refresh_expires_at, revoked_at FROM sessions WHERE refresh_hash = ? LIMIT 1`,
      [refreshHash]
    );
    if (sessionRows.length === 0) throw new AuthError('Session not found');
    const sess = sessionRows[0];
    if (sess.revoked_at) throw new AuthError('Session revoked');
    if (new Date(sess.refresh_expires_at) < new Date()) throw new AuthError('Refresh token expired');

    // Rotate: invalidate old refresh, issue new pair
    await pool.execute(`UPDATE sessions SET revoked_at = NOW(3) WHERE id = ?`, [sess.id]);

    const fp = fingerprint(req.ip ?? '', req.headers['user-agent'] ?? '');
    const access = signAccessToken({ sub: sess.user_id, restaurantId: payload.restaurantId, fp });
    const newRefresh = signRefreshToken({ sub: sess.user_id, restaurantId: payload.restaurantId });

    await pool.execute(
      `INSERT INTO sessions (id, user_id, token_hash, refresh_hash, ip, user_agent, fingerprint, expires_at, refresh_expires_at, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL 15 MINUTE), DATE_ADD(NOW(3), INTERVAL 7 DAY), NOW(3))`,
      [sess.user_id, hashToken(access), hashToken(newRefresh),
       req.ip ?? null,
       (req.headers['user-agent'] as string) ?? null,
       fp || null]
    );

    return ok(res, { accessToken: access, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', optionalAuth, validateBody(logoutSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const refreshHash = hashToken(refreshToken);
      await pool.execute(`UPDATE sessions SET revoked_at = NOW(3) WHERE refresh_hash = ?`, [refreshHash]);
    }
    // If we have an authenticated user (from access token), log the audit entry
    if (req.ctx) {
      await writeAudit({
        restaurantId: req.ctx.restaurantId, userId: req.ctx.userId,
        action: 'logout', entity: 'user', entityId: req.ctx.userId,
        ip: req.ip, userAgent: req.headers['user-agent'] as string,
      });
    }
    return ok(res, { loggedOut: true });
  } catch (err) { next(err); }
});

authRouter.get('/me', authRequired, async (req, res, next) => {
  try {
    if (!req.ctx) throw new AuthError('Not authenticated');
    const [userRow] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.phone, u.restaurant_id, u.role_id, r.name AS role_name,
              r.display_name AS role_display_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? LIMIT 1`,
      [req.ctx.userId]
    );
    if (userRow.length === 0) throw new AuthError('User not found');
    const u = userRow[0];
    return ok(res, {
      id: u.id, name: u.name, phone: u.phone,
      restaurantId: u.restaurant_id,
      roleId: u.role_id,
      roleName: u.role_name,
      roleDisplayName: u.role_display_name,
      permissions: Array.from(req.ctx.permissions),
    });
  } catch (err) { next(err); }
});

// (AccessPayload type import kept for type-checking only)
import type { AccessPayload as _AccessPayload } from '../auth/jwt';
void (null as unknown as _AccessPayload);
