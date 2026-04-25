import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const cleanHost = (value: string) => value.replace(/^https?:\/\//, '').split('/')[0].trim().toLowerCase();
const REMOVED_SITE_COMMENT = 'Проверить и удалить';

const normalizeDiscovered = (raw: string[]) => {
  const out = new Set<string>();
  for (const s of raw) {
    if (typeof s !== 'string' || s.length < 2) continue;
    const h = cleanHost(s);
    if (h) out.add(h);
  }
  return out;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      token,
      serverId,
      cpuPercent,
      memoryPercent,
      diskPercent,
      load1,
      load5,
      load15,
      uptimeSeconds,
      discoveredDomains,
      sysMetrics,
    } = body || {};

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const server = await prisma.server.findFirst({
      where: {
        monitorToken: token,
        ...(serverId ? { id: serverId } : {}),
      },
    });

    if (!server) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const discovered = Array.isArray(discoveredDomains)
      ? discoveredDomains.filter((domain) => typeof domain === 'string' && domain.length > 2)
      : [];

    let previousAgentHosts = new Set<string>();
    try {
      const rawPrev = server.sitesJson ? JSON.parse(server.sitesJson) : [];
      const arr = Array.isArray(rawPrev) ? rawPrev : [];
      previousAgentHosts = normalizeDiscovered(arr as string[]);
    } catch {
      previousAgentHosts = new Set();
    }
    const newHostSet = normalizeDiscovered(discovered);
    const removedFromAgentList = Array.from(previousAgentHosts).filter((h) => !newHostSet.has(h));

    const uptimeValue =
      typeof uptimeSeconds === 'number' && Number.isFinite(uptimeSeconds)
        ? `${Math.max(0, Math.floor(uptimeSeconds))}s`
        : server.uptime ?? '0m';

    const loadAvgValue = [load1, load5, load15]
      .filter((value) => value !== undefined && value !== null)
      .map((value) => Number(value).toFixed(2))
      .join(', ');

    const sysMetricsJson = JSON.stringify({
      ...(sysMetrics && typeof sysMetrics === 'object' ? sysMetrics : {}),
      discoveredDomains: discovered,
      source: 'agent-heartbeat',
    });

    await prisma.server.update({
      where: { id: server.id },
      data: {
        status: 'online',
        cpuUsage: Number(cpuPercent || 0),
        ramUsage: Number(memoryPercent || 0),
        diskUsage: Number(diskPercent || 0),
        uptime: uptimeValue,
        loadAvg: loadAvgValue || server.loadAvg || '0.00',
        sitesJson: JSON.stringify(discovered),
        sysMetrics: sysMetricsJson,
        lastHeartbeatAt: new Date(),
      },
    });

    if (discovered.length > 0) {
      await Promise.all(
        discovered.map((rawUrl) => {
          const url = cleanHost(String(rawUrl));
          if (!url) return Promise.resolve();
          return prisma.site.upsert({
            where: { url },
            update: { serverId: server.id, unlinkedFromServerAt: null, scheduledDeletionAt: null },
            create: { url, serverId: server.id },
          });
        })
      );
    }

    if (removedFromAgentList.length > 0) {
      const now = new Date();
      const removedSites = await prisma.site.findMany({
        where: {
          url: { in: removedFromAgentList },
          serverId: server.id,
        },
        select: {
          id: true,
          comment: true,
        },
      });

      await Promise.all(
        removedSites.map((site) => {
          const currentComment = String(site.comment || '').trim();
          const nextComment = currentComment.includes(REMOVED_SITE_COMMENT)
            ? currentComment
            : currentComment
              ? `${currentComment}\n${REMOVED_SITE_COMMENT}`
              : REMOVED_SITE_COMMENT;

          return prisma.site
            .update({
              where: { id: site.id },
              data: {
                serverId: null,
                unlinkedFromServerAt: now,
                scheduledDeletionAt: null,
                comment: nextComment,
              },
            })
            .catch(() => null);
        })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Agent heartbeat error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
