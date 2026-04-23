import { decryptSecret as decryptSecretV2 } from '@/lib/crypto-secrets';
import { decryptSecret as decryptSecretLegacy } from '@/lib/crypto';

export async function decryptHostingSecret(value?: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    const v2 = await decryptSecretV2(value);
    if (typeof v2 === 'string' && v2.length > 0) return v2;
  } catch {
    /* try legacy */
  }
  try {
    const legacy = await decryptSecretLegacy(value);
    if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  } catch {
    /* ignore */
  }
  return null;
}
