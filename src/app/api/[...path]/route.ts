/**
 * Catch-all API proxy — forwards all /api/* requests to the backend Express server.
 *
 * Why: Next.js App Router intercepts /api/* as its own API routes. To forward
 * to the external Express backend (port 4000), we use a catch-all route that
 * streams the request through.
 *
 * Query param XTransformPort is consumed by Caddy, but we also use it here
 * as fallback (default 4000).
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:4000';

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function PUT(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }

async function proxy(req: NextRequest): Promise<NextResponse> {
  // The path after /api/ — e.g. "auth/login"
  const path = req.nextUrl.pathname.replace(/^\/api\//, '');
  // Build URL — strip XTransformPort from query
  const url = new URL(`${BACKEND_URL}/api/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k !== 'XTransformPort') url.searchParams.append(k, v);
  });

  // Read body
  let body: BodyInit | undefined;
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.text();
  }

  // Forward headers (except host)
  const headers = new Headers();
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === 'host' || lk === 'connection' || lk === 'content-length') return;
    headers.set(k, v);
  });

  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body,
    });
    // Stream response back
    const respBody = await upstream.text();
    const respHeaders = new Headers();
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'content-encoding' || k.toLowerCase() === 'transfer-encoding') return;
      respHeaders.set(k, v);
    });
    return new NextResponse(respBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, code: 'BACKEND_UNREACHABLE', message: 'Backend server is not reachable' },
      { status: 502 }
    );
  }
}
