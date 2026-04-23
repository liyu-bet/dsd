const AUTH_COOKIE_NAME = 'monitor_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function getAuthSecret(): string {
  const secret = process.env.AUTH_COOKIE_SECRET || process.env.MONITOR_INTERNAL_SECRET || '';
  if (secret.trim().length < 16) {
    throw new Error('AUTH_COOKIE_SECRET (or MONITOR_INTERNAL_SECRET) must be at least 16 characters long');
  }
  return secret.trim();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input));
}

function fromBase64Url(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({ scope: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const encodedPayload = toBase64Url(payload);
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expected = await sign(encodedPayload);
  if (!safeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as { exp?: number; scope?: string };
    return payload.scope === 'admin' && Boolean(payload.exp && payload.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export function getSessionCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getSessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}
