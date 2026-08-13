import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/serverless-db';
import jwt from 'jsonwebtoken';
const JWT_SECRET = 'Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw';

export async function GET(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    const payload: any = jwt.verify(match[1], JWT_SECRET, { issuer: 'restoran-pos-v2' });
    const { rows } = await query(
      `SELECT pj.id, pj.restaurant_id, pj.printer_id, pr.name AS printer_name, pr.station,
              pr.connection_type, pr.ip_address, pr.port, pr.usb_name, pr.paper_width, pr.charset,
              pj.order_id, pj.payment_id, pj.type AS job_type, pj.payload, pj.status, pj.attempts, pj.queued_at
       FROM print_jobs pj JOIN printers pr ON pr.id = pj.printer_id
       WHERE pj.restaurant_id = ? AND pj.status = 'pending' ORDER BY pj.queued_at ASC LIMIT 50`,
      [payload.restaurantId]
    );
    return NextResponse.json({ ok: true, data: rows.map((r: any) => ({ ...r, payload: r.payload ? Buffer.from(r.payload).toString('base64') : null })) });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
