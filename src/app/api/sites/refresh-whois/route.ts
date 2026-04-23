import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maybeSyncWhois } from '@/lib/dns-whois-info';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const singleId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const onlyUnassigned = body?.onlyUnassigned !== false;

    if (singleId) {
      const site = await prisma.site.findUnique({
        where: { id: singleId },
        select: {
          id: true,
          url: true,
          domainExpiresAt: true,
          whoisInfoJson: true,
          whoisInfoUpdatedAt: true,
          registrarAccountId: true,
        },
      });
      if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

      await maybeSyncWhois(prisma, site, {
        force: true,
        fillDomainExpiresAtFromWhois: true,
        onlyIfDomainExpiresAtEmpty: true,
        autoAssignRegistrarFromWhois: true,
        onlyIfRegistrarAccountEmpty: true,
      });

      const updated = await prisma.site.findUnique({
        where: { id: site.id },
        select: { registrarAccountId: true, domainExpiresAt: true },
      });

      return NextResponse.json({
        success: true,
        checked: 1,
        assigned: !site.registrarAccountId && updated?.registrarAccountId ? 1 : 0,
        dateFilled: !site.domainExpiresAt && updated?.domainExpiresAt ? 1 : 0,
        failed: 0,
        mode: 'single',
      });
    }

    const sites = await prisma.site.findMany({
      where: onlyUnassigned ? { registrarAccountId: null } : {},
      orderBy: [{ whoisInfoUpdatedAt: 'asc' }, { updatedAt: 'asc' }],
      select: {
        id: true,
        url: true,
        domainExpiresAt: true,
        whoisInfoJson: true,
        whoisInfoUpdatedAt: true,
        registrarAccountId: true,
      },
    });

    let checked = 0;
    let assigned = 0;
    let dateFilled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const site of sites) {
      checked += 1;
      try {
        await maybeSyncWhois(prisma, site, {
          force: true,
          fillDomainExpiresAtFromWhois: true,
          onlyIfDomainExpiresAtEmpty: true,
          autoAssignRegistrarFromWhois: true,
          onlyIfRegistrarAccountEmpty: true,
        });

        const updated = await prisma.site.findUnique({
          where: { id: site.id },
          select: { registrarAccountId: true, domainExpiresAt: true },
        });
        if (!updated) continue;

        if (!site.registrarAccountId && updated.registrarAccountId) assigned += 1;
        if (!site.domainExpiresAt && updated.domainExpiresAt) dateFilled += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 12) {
          errors.push(`${site.url}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked,
      assigned,
      dateFilled,
      failed,
      skipped: 0,
      errors,
      mode: onlyUnassigned ? 'only-unassigned' : 'all-sites',
    });
  } catch (error) {
    console.error('refresh-whois batch failed', error);
    return NextResponse.json({ error: 'Failed to refresh WHOIS' }, { status: 500 });
  }
}
