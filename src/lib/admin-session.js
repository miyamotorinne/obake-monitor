import crypto from 'crypto';

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function passwordsMatch(candidate, expected) {
  const candidateHash = crypto.createHash('sha256').update(String(candidate)).digest();
  const expectedHash = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

export function createAdminSession() {
  const secret = getSessionSecret();
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured');

  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  })).toString('base64url');

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSession(value) {
  const secret = getSessionSecret();
  if (!secret || !value) return false;

  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return false;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.role === 'admin' && Number.isFinite(session.exp) && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
