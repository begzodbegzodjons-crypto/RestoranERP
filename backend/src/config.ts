/**
 * Centralized config — reads from env, validates required vars.
 * No secret is ever shipped to the frontend.
 */
import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: required('DB_HOST'),
    port: parseInt(required('DB_PORT', '4000'), 10),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT ?? '10', 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT ?? '20', 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'restoran-pos-v2',
  },

  bcrypt: { cost: parseInt(process.env.BCRYPT_COST ?? '10', 10) },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '200', 10),
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',
};

export type Config = typeof config;
