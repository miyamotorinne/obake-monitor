export const OBSERVER_COOKIE_NAME = 'observer_token';
export const ADMIN_COOKIE_NAME = 'obake_auth';

export const OBSERVER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function baseCookieOptions(secure, maxAge) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge,
    path: '/',
    priority: 'high',
  };
}

export function observerCookieOptions(secure = process.env.NODE_ENV === 'production') {
  return baseCookieOptions(secure, OBSERVER_COOKIE_MAX_AGE);
}

export function adminCookieOptions(secure = process.env.NODE_ENV === 'production') {
  return baseCookieOptions(secure, ADMIN_COOKIE_MAX_AGE);
}
