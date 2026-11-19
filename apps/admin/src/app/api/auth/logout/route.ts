import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sameOrigin } from '@/lib/server';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Bad origin' }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
