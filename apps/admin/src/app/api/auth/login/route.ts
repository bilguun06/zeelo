import { NextRequest, NextResponse } from 'next/server';
import { forwardJson, sameOrigin, setSession } from '@/lib/server';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Bad origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const upstream = await forwardJson('admin/auth/login', { email: body.email, password: body.password });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
  if (data.mfaRequired) return NextResponse.json({ mfaRequired: true, mfaToken: data.mfaToken });
  const res = NextResponse.json({ mfaRequired: false, admin: data.admin });
  setSession(res, data.accessToken, data.expiresIn);
  return res;
}
