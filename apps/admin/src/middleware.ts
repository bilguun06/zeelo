import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'orgil_admin_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith('/login')) {
    return authed ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (!authed) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
