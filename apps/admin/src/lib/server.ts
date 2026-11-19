import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'orgil_admin_session';
export const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export function setSession(res: NextResponse, token: string, maxAge: number) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
}

/** CSRF defence for cookie-authenticated mutations: the Origin must match our own host. */
export function sameOrigin(req: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function forwardJson(path: string, body: unknown) {
  return fetch(`${API_URL}/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}
