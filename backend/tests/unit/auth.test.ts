/**
 * Unit tests — pure logic (no DB).
 */
import { signAccessToken, signRefreshToken, verifyToken, hashPassword, verifyPassword, hashToken, fingerprint } from '../../src/auth/jwt';
import { hasPermission } from '../../src/auth/rbac';
import { IdempotencyConflictError, ValidationError, NotFoundError, ForbiddenError } from '../../src/errors';
import { entityId, generateRawId } from '../../src/utils/id';

describe('Auth — JWT', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({ sub: 'user_1', restaurantId: 'rest_1', roleName: 'admin' });
    expect(token).toBeTruthy();
    const payload = verifyToken<{ sub: string; restaurantId: string }>(token);
    expect(payload.sub).toBe('user_1');
    expect(payload.restaurantId).toBe('rest_1');
    expect(payload.type).toBe('access');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken({ sub: 'user_1', restaurantId: 'rest_1' });
    const payload = verifyToken<{ type: string }>(token);
    expect(payload.type).toBe('refresh');
  });

  it('rejects invalid token', () => {
    expect(() => verifyToken('not.a.valid.jwt')).toThrow();
  });
});

describe('Auth — bcrypt', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrongpass', hash)).toBe(false);
  });
});

describe('Auth — fingerprint + token hash', () => {
  it('creates deterministic fingerprint for same input', () => {
    const fp1 = fingerprint('127.0.0.1', 'Chrome');
    const fp2 = fingerprint('127.0.0.1', 'Chrome');
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it('creates different fingerprint for different input', () => {
    const fp1 = fingerprint('127.0.0.1', 'Chrome');
    const fp2 = fingerprint('127.0.0.1', 'Firefox');
    expect(fp1).not.toBe(fp2);
  });

  it('hashes a token deterministically', () => {
    const h1 = hashToken('my-jwt-token');
    const h2 = hashToken('my-jwt-token');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});

describe('RBAC — hasPermission', () => {
  const adminCtx = {
    userId: 'u1', restaurantId: 'r1', permissions: new Set(['*']),
  } as any;

  const waiterCtx = {
    userId: 'u2', restaurantId: 'r1',
    permissions: new Set(['order.create', 'order.update', 'menu.read']),
  } as any;

  it('admin with "*" bypasses all checks', () => {
    expect(hasPermission(adminCtx, 'anything.really')).toBe(true);
    expect(hasPermission(adminCtx, 'order.create')).toBe(true);
  });

  it('waiter has explicit permissions', () => {
    expect(hasPermission(waiterCtx, 'order.create')).toBe(true);
    expect(hasPermission(waiterCtx, 'menu.read')).toBe(true);
  });

  it('waiter does NOT have admin permissions', () => {
    expect(hasPermission(waiterCtx, 'staff.manage')).toBe(false);
    expect(hasPermission(waiterCtx, 'report.zreport')).toBe(false);
  });
});

describe('Errors', () => {
  it('ValidationError has 400 status', () => {
    const e = new ValidationError('bad input');
    expect(e.status).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.message).toBe('bad input');
  });

  it('NotFoundError has 404 status', () => {
    const e = new NotFoundError('Order', '123');
    expect(e.status).toBe(404);
    expect(e.message).toContain('Order not found: 123');
  });

  it('ForbiddenError has 403 status', () => {
    const e = new ForbiddenError();
    expect(e.status).toBe(403);
  });

  it('IdempotencyConflictError has 200 status (replay)', () => {
    const e = new IdempotencyConflictError({ id: 'prev_result' });
    expect(e.status).toBe(200);
    expect(e.code).toBe('IDEMPOTENT_REPLAY');
    expect(e.existingResult).toEqual({ id: 'prev_result' });
  });
});

describe('ID generators', () => {
  it('generates cuid-style ID <= 28 chars', () => {
    const id = entityId('ord');
    expect(id.length).toBeLessThanOrEqual(28);
    expect(id.startsWith('ord_')).toBe(true);
  });

  it('generates raw ID of 28 chars', () => {
    const id = generateRawId();
    expect(id).toHaveLength(28);
  });

  it('truncates long prefixes', () => {
    const id = entityId('verylongprefix');
    expect(id.length).toBeLessThanOrEqual(28);
    expect(id.startsWith('veryl_')).toBe(true);
  });
});
