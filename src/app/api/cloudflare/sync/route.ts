import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listZones, normalizeHost, type CloudflareAccountWithSecrets } from '@/lib/cloudflare';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const overrideExisting = body?.overrideExisting === true;
    const requestedAccountId = typeof body?.accountId === 'string' && body.accountId.trim() ? body.accountId.trim() : null;

    const accounts = await prisma.cloudflareAccount.findMany({
      where: requestedAccountId ? { id: requestedAccountId } : undefined,
      select: {
        id: true,
        name: true,
        login: true,
        password: true,
        apiToken: true,
        apiKey: true,
      },
      orderBy: { name: 'asc' },
    });

    if (!accounts.length) {
      return NextResponse.json({ error: 'Cloudflare-аккаунт не найден' }, { status: 404 });
    }

    const sites = await prisma.site.findMany({
      where: requestedAccountId
        ? {
            OR: [
              { cfAccountId: requestedAccountId },
              ...(overrideExisting ? [] : [{ cfAccountId: null }]),
            ],
          }
        : undefined,
      select: {
        id: true,
        url: true,
        cfAccountId: true,
      },
      orderBy: { url: 'asc' },
    });

    const accountZones = await Promise.all(
      accounts.map(async (account) => {
        try {
          const zones = await listZones(account as CloudflareAccountWithSecrets);
          return { account, zones, error: null as string | null };
        } catch (error) {
          return {
            account,
            zones: [],
            error: error instanceof Error ? error.message : 'Unknown Cloudflare error',
          };
        }
      })
    );

    let matched = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const site of sites) {
      if (!overrideExisting && site.cfAccountId && !requestedAccountId) {
        skipped += 1;
        continue;
      }

      if (!overrideExisting && requestedAccountId && site.cfAccountId && site.cfAccountId !== requestedAccountId) {
        skipped += 1;
        continue;
      }

      const host = normalizeHost(site.url);
      let assignedAccountId: string | null = null;

      for (const item of accountZones) {
        if (item.error) {
          errors.push(`${item.account.name}: ${item.error}`);
          continue;
        }

        const zone = item.zones
          .filter((candidate) => host === candidate.name || host.endsWith(`.${candidate.name}`))
          .sort((a, b) => b.name.length - a.name.length)[0];

        if (zone) {
          assignedAccountId = item.account.id;
          break;
        }
      }

      if (!assignedAccountId) continue;
      if (site.cfAccountId === assignedAccountId) {
        skipped += 1;
        continue;
      }

      await prisma.site.update({
        where: { id: site.id },
        data: { cfAccountId: assignedAccountId },
      });
      matched += 1;
    }

    return NextResponse.json({
      success: true,
      matched,
      skipped,
      checked: sites.length,
      requestedAccountId,
      accountsChecked: accountZones.map((item) => ({
        id: item.account.id,
        name: item.account.name,
        zonesCount: item.zones.length,
        error: item.error,
      })),
      accountErrors: Array.from(new Set(errors)).slice(0, 20),
    });
  } catch (error) {
    console.error('Cloudflare sync failed', error);
    return NextResponse.json({ error: 'Не удалось выполнить синхронизацию Cloudflare' }, { status: 500 });
  }
}
