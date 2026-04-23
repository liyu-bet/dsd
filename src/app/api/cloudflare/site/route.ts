import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  findBestZoneForHost,
  getDeveloperMode,
  setDeveloperMode,
  type CloudflareAccountWithSecrets,
} from '@/lib/cloudflare';

async function getSiteWithAccount(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      cfAccount: {
        select: {
          id: true,
          name: true,
          login: true,
          password: true,
          apiToken: true,
          apiKey: true,
        },
      },
    },
  });

  if (!site) {
    throw new Error('Сайт не найден');
  }

  if (!site.cfAccount) {
    throw new Error('Для сайта не привязан Cloudflare-аккаунт');
  }

  return site;
}

export async function GET(req: Request) {
  try {
    const siteId = new URL(req.url).searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const site = await getSiteWithAccount(siteId);
    const zone = await findBestZoneForHost(site.cfAccount as CloudflareAccountWithSecrets, site.url);

    if (!zone) {
      return NextResponse.json({ error: 'Зона для сайта не найдена в Cloudflare-аккаунте' }, { status: 404 });
    }

    const devMode = await getDeveloperMode(site.cfAccount as CloudflareAccountWithSecrets, zone.id);

    return NextResponse.json({
      zone,
      devMode,
    });
  } catch (error) {
    console.error('Cloudflare site fetch failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloudflare fetch failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const siteId = body?.siteId;
    const enabled = body?.enabled === true;

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const site = await getSiteWithAccount(siteId);
    const zone = await findBestZoneForHost(site.cfAccount as CloudflareAccountWithSecrets, site.url);

    if (!zone) {
      return NextResponse.json({ error: 'Зона для сайта не найдена в Cloudflare-аккаунте' }, { status: 404 });
    }

    const devMode = await setDeveloperMode(site.cfAccount as CloudflareAccountWithSecrets, zone.id, enabled);
    return NextResponse.json({ success: true, zone, devMode });
  } catch (error) {
    console.error('Cloudflare site update failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloudflare update failed' }, { status: 500 });
  }
}
