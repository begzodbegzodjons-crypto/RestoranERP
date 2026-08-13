/**
 * TiDB Cloud Serverless driver — works in Cloudflare Workers (HTTP, not TCP).
 * The driver returns query results as an array-like object (not { rows: [...] }).
 */
import { connect } from '@tidbcloud/serverless';

let connection: any = null;

function getConnection() {
  if (!connection) {
    connection = connect({
      host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
      username: '3YTK6Em4WhtFiqF.root',
      password: 'ovAH3n3bu2YabeK0',
      database: 'oshxona_erp_v2',
    });
  }
  return connection;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const conn = getConnection();
  const result = await conn.execute(sql, params as any[]);
  // TiDB serverless returns array-like result: [{ col1: ..., col2: ... }, ...]
  // Convert to { rows: [...] } format for consistency
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return { rows: rows as T[] };
}

export async function execute(sql: string, params: unknown[] = []): Promise<{ rows: any[]; affectedRows: number; insertId?: string }> {
  const conn = getConnection();
  const result = await conn.execute(sql, params as any[]);
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return { rows, affectedRows: rows.length, insertId: undefined };
}

export function entityId(prefix: string = 'ent'): string {
  if (prefix.length > 5) prefix = prefix.slice(0, 5);
  // Use crypto.randomUUID for the random part
  const hex = (crypto.randomUUID?.() || Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 28 - prefix.length - 1);
  return `${prefix}_${hex}`.slice(0, 28);
}

export function uuid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
