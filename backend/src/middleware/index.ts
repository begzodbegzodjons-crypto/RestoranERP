/**
 * Express middlewares — auth extraction, error handling, request logging, validation.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, AccessPayload, fingerprint } from '../auth/jwt';
import { loadUserContext, AuthContext, requirePermission } from '../auth/rbac';
import { AuthError, ForbiddenError, AppError, IdempotencyConflictError } from '../errors';
import { logger } from '../logger';
import { ZodSchema } from 'zod';
import { writeAudit } from '../audit';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: AuthContext;
      idempotencyKey?: string;
    }
  }
}

/** Extract user from Authorization: Bearer <token> */
export const authRequired: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new AuthError('Missing Bearer token');

    const token = match[1];
    let payload: AccessPayload;
    try {
      payload = verifyToken<AccessPayload>(token);
    } catch {
      throw new AuthError('Invalid or expired token', 'TOKEN_EXPIRED');
    }

    if (payload.type !== 'access') throw new AuthError('Wrong token type');

    // Fingerprint binding check — only enforce if BOTH client IP and UA are present
    // (test environments sometimes strip these).
    const clientIp = req.ip ?? '';
    const clientUa = req.headers['user-agent'] ?? '';
    if (clientIp && clientUa && payload.fp) {
      const expectedFp = fingerprint(clientIp, clientUa);
      if (payload.fp !== expectedFp) {
        throw new AuthError('Token fingerprint mismatch', 'FP_MISMATCH');
      }
    }

    const ctx = await loadUserContext(payload.sub, payload.restaurantId);
    if (!ctx) throw new AuthError('User not found or inactive');

    req.ctx = ctx;
    next();
  } catch (err) {
    next(err);
  }
};

/** Optional auth — does not fail if no token, but populates ctx if present. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return next();
    const token = match[1];
    const payload = verifyToken<AccessPayload>(token);
    if (payload.type === 'access') {
      const ctx = await loadUserContext(payload.sub, payload.restaurantId);
      if (ctx) req.ctx = ctx;
    }
  } catch { /* ignore */ }
  next();
};

/** Require a specific permission. Use AFTER authRequired. */
export function requirePerm(perm: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.ctx) return next(new AuthError('No auth context'));
    try {
      requirePermission(req.ctx, perm);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Capture Idempotency-Key header for POST/PUT requests. */
export const captureIdempotencyKey: RequestHandler = (req, _res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const key = req.headers['idempotency-key'] as string | undefined;
    if (key) req.idempotencyKey = key;
  }
  next();
};

/** Zod validation middleware factory. */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR',
        'Request body validation failed',
        result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR',
        'Query string validation failed',
        result.error.flatten()));
    }
    req.query = result.data as any;
    next();
  };
}

/** Request logger — logs method, path, status, latency. */
export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error'
                  : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
        { ip: req.ip, ua: req.headers['user-agent'] }
      );
    });
    next();
  };
}

/** Centralized error handler — must be LAST middleware. */
export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof IdempotencyConflictError) {
      return res.status(200).json({
        ok: true,
        code: err.code,
        data: err.existingResult,
        idempotent: true,
      });
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details,
      });
    }
    // MySQL errors
    if (isMysqlError(err)) {
      const e = err as { errno: number; code: string; sqlMessage: string };
      // 1062 — duplicate key (UNIQUE constraint)
      if (e.errno === 1062) {
        return res.status(409).json({
          ok: false, code: 'DUPLICATE',
          message: 'A record with this key already exists',
        });
      }
      // 1205 — lock wait timeout
      if (e.errno === 1205) {
        return res.status(503).json({
          ok: false, code: 'LOCK_TIMEOUT',
          message: 'Resource is locked, please retry',
        });
      }
      logger.error('MySQL error', { errno: e.errno, code: e.code, message: e.sqlMessage });
      return res.status(500).json({
        ok: false, code: 'DB_ERROR',
        message: 'Database operation failed',
      });
    }
    // Generic
    logger.error('Unhandled error', { err: (err as Error).message, stack: (err as Error).stack });
    return res.status(500).json({
      ok: false, code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  };
}

function isMysqlError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'errno' in err && 'sqlMessage' in err;
}

/** 404 fallback. */
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

/** Helper for audit log writes from route handlers. */
export async function auditReq(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  before?: unknown,
  after?: unknown
): Promise<void> {
  if (!req.ctx) return;
  await writeAudit({
    restaurantId: req.ctx.restaurantId,
    userId: req.ctx.userId,
    action, entity, entityId,
    before, after,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
}
