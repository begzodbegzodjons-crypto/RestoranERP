import { NextRequest, NextResponse } from 'next/server';

// Use environment variable for backend URL, fallback to localhost for dev
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function PUT(req: NextRequest) { return proxy(req); }
export async function PATCH(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }

async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace(/^\/api\//, '');
  const url = new URL(`${BACKEND_URL}/api/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k !== 'XTransformPort') url.searchParams.append(k, v);
  });

  let body: BodyInit | undefined;
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.text();
  }

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === 'host' || lk === 'connection' || lk === 'content-length') return;
    headers.set(k, v);
  });

  try {
    const upstream = await fetch(url.toString(), { method, headers, body });
    const respBody = await upstream.text();
    const respHeaders = new Headers();
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'content-encoding' || k.toLowerCase() === 'transfer-encoding') return;
      respHeaders.set(k, v);
    });
    return new NextResponse(respBody, { status: upstream.status, statusText: upstream.statusText, headers: respHeaders });
  } catch (err) {
    return NextResponse.json(
      { ok: false, code: 'BACKEND_UNREACHABLE', message: 'Backend server is not reachable. Please deploy backend.' },
      { status: 502 }
    );
  }
}
