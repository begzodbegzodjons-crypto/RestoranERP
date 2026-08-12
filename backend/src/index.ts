/**
 * Server entrypoint — creates Express app, starts listening on PORT.
 */
import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { logger } from './logger';

async function main(): Promise<void> {
  // Verify DB connection on startup
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('Database connection OK');
  } catch (err) {
    logger.error('Database connection failed', { err: (err as Error).message });
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} [${config.nodeEnv}]`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      try { await pool.end(); } catch {}
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void main();
