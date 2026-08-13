import { NextRequest, NextResponse } from 'next/server';
import { query, execute, entityId, uuid } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });

    // Get pending items grouped by station
    const { rows: items } = await query(
      `SELECT id, name, quantity, notes, station FROM order_items WHERE order_id = ? AND status = 'pending'`,
      [params.id]
    );
    if (items.length === 0) return NextResponse.json({ ok: false, message: 'No pending items' }, { status: 400 });

    const byStation = new Map<string, any[]>();
    for (const it of items) {
      if (!byStation.has(it.station)) byStation.set(it.station, []);
      byStation.get(it.station)!.push(it);
    }

    // Create print jobs per station
    const stationJobs: any[] = [];
    for (const [station, stationItems] of byStation) {
      const { rows: printerRows } = await query(
        `SELECT p.id FROM printers p JOIN printer_routes pr ON pr.printer_id = p.id
         WHERE p.restaurant_id = ? AND p.station = ? AND p.enabled = 1 AND p.is_active = 1
           AND pr.source_type = 'station' AND pr.station = ? AND pr.event = 'order' AND pr.is_active = 1
         ORDER BY pr.priority ASC LIMIT 1`,
        [payload.restaurantId, station, station]
      );
      if (printerRows.length === 0) continue;
      
      const jobId = entityId('pj');
      await execute(
        `INSERT INTO print_jobs (id, restaurant_id, printer_id, order_id, payment_id, type, payload, status, idempotency_key, queued_at)
         VALUES (?, ?, ?, ?, NULL, 'order', X'1B40', 'pending', ?, NOW(3))`,
        [jobId, payload.restaurantId, printerRows[0].id, params.id, uuid()]
      );
      stationJobs.push({ station, jobId });
    }

    // Mark items as cooking
    await execute(
      `UPDATE order_items SET status = 'cooking', started_at = NOW(3), updated_at = NOW(3) WHERE order_id = ? AND status = 'pending'`,
      [params.id]
    );
    await execute(`UPDATE orders SET status = 'cooking', version = version + 1, updated_at = NOW(3) WHERE id = ?`, [params.id]);

    return NextResponse.json({ ok: true, data: { stations: stationJobs, itemCount: items.length } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
