import { NextRequest, NextResponse } from 'next/server';
import { forwardJson, sameOrigin, setSession } from '@/lib/server';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Bad origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const upstream = await forwardJson('admin/auth/mfa/verify', { mfaToken: body.mfaToken, code: body.code });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
  const res = NextResponse.json({ admin: data.admin });
  setSession(res, data.accessToken, data.expiresIn);
  return res;
}
