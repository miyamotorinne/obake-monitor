import { NextResponse } from 'next/server';
import { OBSERVER_COOKIE_NAME, observerCookieOptions } from '@/lib/cookie-options';

export function proxy(request) {
  const response = NextResponse.next();
  const observerToken = request.cookies.get(OBSERVER_COOKIE_NAME)?.value;

  if (observerToken) {
    response.cookies.set(
      OBSERVER_COOKIE_NAME,
      observerToken,
      observerCookieOptions(request.nextUrl.protocol === 'https:'),
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
