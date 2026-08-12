/**
 * Simple logger — supports levels and structured fields.
 * In production this would be replaced with pino/winston.
 */
import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[(config.logLevel as Level) ?? 'info'];

function ts(): string { return new Date().toISOString(); }

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>) {
    if (threshold <= order.debug) console.debug(`[${ts()}] DEBUG  ${msg}`, meta ?? '');
  },
  info(msg: string, meta?: Record<string, unknown>) {
    if (threshold <= order.info) console.log(`[${ts()}] INFO   ${msg}`, meta ?? '');
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    if (threshold <= order.warn) console.warn(`[${ts()}] WARN   ${msg}`, meta ?? '');
  },
  error(msg: string, meta?: Record<string, unknown>) {
    if (threshold <= order.error) console.error(`[${ts()}] ERROR  ${msg}`, meta ?? '');
  },
};
