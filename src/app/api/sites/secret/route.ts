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
  } catch {
    // noop, try legacy format next
  }

  try {
    const legacy = await decryptSecretLegacy(value);
    if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  } catch {
    // noop
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const secretType = searchParams.get('secretType');

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    if (secretType !== 'adminPassword' && secretType !== 'cfPassword') {
      return NextResponse.json({ error: 'Unsupported secretType' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        adminPassword: true,
        cfAccount: {
          select: {
            password: true,
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Сайт не найден' }, { status: 404 });
    }

    const encryptedValue = secretType === 'adminPassword'
      ? site.adminPassword
      : site.cfAccount?.password;

    if (!encryptedValue) {
      return NextResponse.json({ error: 'Пароль не найден' }, { status: 404 });
    }

    const secret = await decryptAnySecret(encryptedValue);

    if (!secret) {
      return NextResponse.json({ error: 'Не удалось расшифровать пароль' }, { status: 500 });
    }

    return NextResponse.json({ secret });
  } catch (error) {
    console.error('Failed to read site secret:', error);
    return NextResponse.json({ error: 'Failed to read site secret' }, { status: 500 });
  }
}
