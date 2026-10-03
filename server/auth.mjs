import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const COOKIE = 'nsodod_admin';
const digest = text => createHash('sha256').update(text).digest();
export function sameSecret(left, right) { return timingSafeEqual(digest(left), digest(right)); }
export function signSession({ uid, room, now = Date.now() }, secret) {
  const payload = Buffer.from(JSON.stringify({ uid, room, exp: now + 4 * 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`nsodod-admin:${payload}`).digest('base64url')}`;
}
export function verifySession(value, secret, { uid, room, now = Date.now() }) {
  try {
    const [payload, signature, extra] = value.split('.');
    if (extra || !signature || !sameSecret(signature, createHmac('sha256', secret).update(`nsodod-admin:${payload}`).digest('base64url'))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.uid === uid && data.room === room && data.exp > now && data.exp <= now + 4 * 3600000;
  } catch { return false; }
}
