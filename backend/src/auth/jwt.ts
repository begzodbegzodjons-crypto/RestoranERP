/**
 * JWT helpers + bcrypt password hashing.
 * Access token (15min) + refresh token (7d) with rotation.
 */
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface AccessPayload {
  sub: string;            // user id
  restaurantId: string;
  role?: string;          // role id
  roleName?: string;      // role name for quick checks
  fp?: string;            // fingerprint hash
  type: 'access';
  jti: string;            // token id
}

export interface RefreshPayload {
  sub: string;
  restaurantId: string;
  type: 'refresh';
  jti: string;
}

export function signAccessToken(payload: Omit<AccessPayload, 'type' | 'jti'>): string {
  const opts: SignOptions = {
    expiresIn: config.jwt.accessExpires as any,
    issuer: config.jwt.issuer,
  };
  return jwt.sign(
    { ...payload, type: 'access', jti: uuidv4() } as any,
    config.jwt.secret,
    opts
  );
}

export function signRefreshToken(payload: { sub: string; restaurantId: string }): string {
  const opts: SignOptions = {
    expiresIn: config.jwt.refreshExpires as any,
    issuer: config.jwt.issuer,
  };
  return jwt.sign(
    { ...payload, type: 'refresh', jti: uuidv4() },
    config.jwt.secret,
    opts
  );
}

export function verifyToken<T = unknown>(token: string): T {
  return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer }) as T;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcrypt.cost);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function fingerprint(ip: string, userAgent: string): string {
  return crypto.createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
}
