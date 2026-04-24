import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSiteCore } from '@/lib/site-checker';
import { maybeSyncApexARecord } from '@/lib/apex-a-record';
import { processNotificationCycle } from '@/lib/telegram-notifications';

export const dynamic = 'force-dynamic'; // УБИВАЕМ КЭШ

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const site = await prisma.site.findUnique({ where: { id }, include: { server: true, cfAccount: true } });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const serverIp = site.server?.ip ?? undefined;
    const result = await checkSiteCore(site.url, serverIp);

    const updatedSite = await prisma.site.update({
      where: { id: site.id },
      data: {
        status: result.isUp ? 'online' : 'offline',
        lastPingMs: result.pingMs,
        isDnsValid: result.isDnsValid,
        techStack: JSON.stringify(result.techStack),
      },
    });

    try {
      await maybeSyncApexARecord(
        prisma,
        { ...site, ...updatedSite, cfAccount: site.cfAccount },
        { force: true }
      );
    } catch (apexError) {
      console.error('Apex A sync failed:', apexError);
    }

    await prisma.siteCheck.create({
      data: {
        siteId: site.id,
        status: result.isUp ? 'online' : 'offline',
        pingMs: result.pingMs,
        statusCode: result.statusCode,
        trigger: 'manual',
      },
    });

    const overflowChecks = await prisma.siteCheck.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' },
      skip: 6,
      select: { id: true },
    });

    if (overflowChecks.length) {
      await prisma.siteCheck.deleteMany({
        where: { id: { in: overflowChecks.map((x: { id: string }) => x.id) } },
      });
    }

    const siteOut = await prisma.site.findUnique({
      where: { id: site.id },
      include: { server: true, cfAccount: true, checks: { orderBy: { createdAt: 'desc' }, take: 6 } },
    });
    await processNotificationCycle().catch(() => null);

    return NextResponse.json({ success: true, site: siteOut });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check single site' }, { status: 500 });
  }
}
