import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptSecret as decryptSecretV2 } from '@/lib/crypto-secrets';
import { decryptSecret as decryptSecretLegacy } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

async function decryptAnySecret(value?: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    const v2 = await decryptSecretV2(value);
    if (typeof v2 === 'string' && v2.length > 0) return v2;
  } catch {}
  try {
    const legacy = await decryptSecretLegacy(value);
    if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  } catch {}
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const secretType = searchParams.get('secretType');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (secretType !== 'password' && secretType !== 'apiKey') return NextResponse.json({ error: 'Unsupported secretType' }, { status: 400 });
    const account = await prisma.registrarAccount.findUnique({ where: { id: accountId }, select: { password: true, apiKey: true } });
    if (!account) return NextResponse.json({ error: 'Registrar account not found' }, { status: 404 });
    const encryptedValue = account[secretType];
    if (!encryptedValue) return NextResponse.json({ error: 'Секрет не найден' }, { status: 404 });
    const secret = await decryptAnySecret(encryptedValue);
    if (!secret) return NextResponse.json({ error: 'Не удалось расшифровать секрет' }, { status: 500 });
    return NextResponse.json({ secret });
  } catch (error) {
    console.error('Failed to read registrar secret:', error);
    return NextResponse.json({ error: 'Failed to read registrar secret' }, { status: 500 });
  }
}
