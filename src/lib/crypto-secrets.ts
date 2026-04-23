const ENCRYPTION_PREFIX = 'enc:v1:';

function normalizeSecret(input: string): string {
  return input.trim();
}

export function getEncryptionSecret(): string {
  const secret =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.AUTH_COOKIE_SECRET ||
    process.env.MONITOR_INTERNAL_SECRET ||
    '';

  const normalized = normalizeSecret(secret);
  if (normalized.length < 16) {
    throw new Error('DATA_ENCRYPTION_KEY (or MONITOR_INTERNAL_SECRET) must be at least 16 characters long');
  }

  return normalized;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

async function importEncryptionKey(secret: string) {
  const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plainText?: string | null): Promise<string | null> {
  if (!plainText) return null;
  if (plainText.startsWith(ENCRYPTION_PREFIX)) return plainText;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey(getEncryptionSecret());
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plainText)
  );

  return `${ENCRYPTION_PREFIX}${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(cipherText?: string | null): Promise<string | null> {
  if (!cipherText) return null;
  if (!cipherText.startsWith(ENCRYPTION_PREFIX)) return cipherText;

  const raw = cipherText.slice(ENCRYPTION_PREFIX.length);
  const [ivPart, encryptedPart] = raw.split('.');
  if (!ivPart || !encryptedPart) {
    throw new Error('Invalid encrypted secret format');
  }

  const key = await importEncryptionKey(getEncryptionSecret());
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(encryptedPart)
  );

  return new TextDecoder().decode(decrypted);
}

export function hasStoredSecret(cipherText?: string | null): boolean {
  return Boolean(cipherText && String(cipherText).trim().length > 0);
}
