import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maybeSyncApexARecord } from '@/lib/apex-a-record';
import { maybeSyncDnsAndWhois } from '@/lib/dns-whois-info';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { id }, include: { server: true, cfAccount: true } });
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    try {
      await maybeSyncApexARecord(prisma, site, { force: true });
    } catch (e) {
      console.error('[refresh-network] apex A:', e);
    }
    try {
      await maybeSyncDnsAndWhois(prisma, site, { force: true });
    } catch (e) {
      console.error('[refresh-network] dns/whois:', e);
    }

    const out = await prisma.site.findUnique({
      where: { id: site.id },
      include: { server: true, cfAccount: true, checks: { orderBy: { createdAt: 'desc' }, take: 6 } },
    });

    return NextResponse.json({ success: true, site: out });
  } catch (error) {
    console.error('refresh-network', error);
    return NextResponse.json({ error: 'Failed to refresh' }, { status: 500 });
  }
}
