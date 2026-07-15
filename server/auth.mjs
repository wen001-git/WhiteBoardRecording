import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const SHARED_PASSWORD_SALT = 'wb-static-pro-salt-v1';

export function safeEqual(a, b) {
  const aa = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

export async function makePassword(password) {
  const salt = SHARED_PASSWORD_SALT;
  const derived = await scrypt(String(password), salt, 64);
  return { salt, hash: Buffer.from(derived).toString('base64url') };
}

export async function verifyPassword(password, salt, expectedHash) {
  const derived = await scrypt(String(password), String(salt), 64);
  return safeEqual(Buffer.from(derived).toString('base64url'), expectedHash);
}

export function signSession(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySession(token, secret, now = Date.now()) {
  const [encoded, signature, extra] = String(token ?? '').split('.');
  if (!encoded || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const key = part.slice(0, at).trim();
    try { cookies[key] = decodeURIComponent(part.slice(at + 1).trim()); }
    catch { cookies[key] = part.slice(at + 1).trim(); }
  }
  return cookies;
}

export function sessionCookie(name, token, options = {}) {
  const parts = [`${name}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.secure !== false) parts.push('Secure');
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join('; ');
}
