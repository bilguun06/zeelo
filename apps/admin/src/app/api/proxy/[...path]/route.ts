import { NextRequest, NextResponse } from 'next/server';
import { API_URL, SESSION_COOKIE, sameOrigin } from '@/lib/server';

/**
 * Same-origin proxy to the API. The browser never sees the admin JWT: it lives in an httpOnly
 * cookie and is attached here. Only /admin/* API routes are reachable through this proxy.
 */
async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Bad origin' }, { status: 403 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Not authenticated', code: 'AUTH_REQUIRED' }, { status: 401 });
  const path = params.path.map(encodeURIComponent).join('/');
  if (params.path[0] !== 'admin') return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const url = `${API_URL}/api/v1/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const ct = req.headers.get('content-type');
  if (ct) headers['Content-Type'] = ct;
  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    cache: 'no-store',
  });

  const out = new NextResponse(upstream.body, { status: upstream.status });
  for (const h of ['content-type', 'content-disposition', 'x-request-id', 'cache-control']) {
    const v = upstream.headers.get(h);
    if (v) out.headers.set(h, v);
  }
  if (upstream.status === 401) out.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return out;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
