import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookieName, verifySessionToken } from '@/lib/auth-session';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  if (
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/internal/jobs') ||
    url.pathname.startsWith('/api/agent/heartbeat')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(getSessionCookieName())?.value;
  const isAuthorized = await verifySessionToken(sessionCookie);

  if (!isAuthorized) {
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
