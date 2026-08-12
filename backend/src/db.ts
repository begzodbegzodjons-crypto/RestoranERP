/**
 * MySQL (TiDB) connection pool — used by all repositories.
 * Provides:
 *   - pool.query(sql, params) — for simple SELECTs (auto-prepared, SQL-injection-safe)
 *   - pool.getConnection() — for explicit transactions
 *   - withTransaction(fn) — high-level helper for atomic multi-statement work
 *
 * All user input goes through mysql2's parameter binding (?), never string-concat.
 */
import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from './config';

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: config.db.queueLimit,
  charset: 'utf8mb4',
  timezone: '+00:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: { rejectUnauthorized: false } as any,
});

export type { RowDataPacket, ResultSetHeader };

/**
 * Execute a function inside a single transaction.
 * Commits if fn returns, rolls back if fn throws.
 *
 *   await withTransaction(async (conn) => {
 *     await conn.execute('INSERT ...', [params]);
 *     await conn.execute('UPDATE ...', [params]);
 *   });
 *
 * Lock timeout: 5s. If a row is FOR UPDATE-locked elsewhere, we abort fast.
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET innodb_lock_wait_timeout = 5');
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Helper — run a SELECT and return typed rows.
 */
export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

/**
 * Helper — run an INSERT/UPDATE/DELETE and return the ResultSetHeader.
 */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params as any[]);
  return result;
}
