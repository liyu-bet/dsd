import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAppUrl } from '@/lib/app-url';
import { generateMonitorToken } from '@/lib/server-token';
import { buildInstallScript } from '@/lib/agent-script';
import { hasStoredSecret } from '@/lib/crypto-secrets';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lite = searchParams.get('lite') === '1';
    const servers = await prisma.server.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        checks: lite ? false : {
          orderBy: { createdAt: 'desc' },
          take: 168,
        },
        hostingAccount: {
          select: { id: true, name: true, url: true, login: true, password: true },
        },
      },
    });
    const safeServers = servers.map(({ monitorToken, hostingAccount, ...server }: { monitorToken?: string | null; hostingAccount?: any; [key: string]: unknown }) => ({
      ...server,
      hostingAccount: hostingAccount ? {
        id: hostingAccount.id,
        name: hostingAccount.name,
        url: hostingAccount.url,
        login: hostingAccount.login,
        hasPassword: hasStoredSecret(hostingAccount.password),
      } : null,
    }));
    return NextResponse.json(safeServers);
  } catch (error) {
    console.error('Failed to fetch servers:', error);
    return NextResponse.json({ error: 'Failed to fetch servers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.ip) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const exists = await prisma.server.findFirst({ where: { ip: body.ip } });
    if (exists) {
      return NextResponse.json({ error: 'Сервер уже есть' }, { status: 400 });
    }

    const monitorToken = generateMonitorToken();
    const server = await prisma.server.create({
      data: {
        name: body.name,
        ip: body.ip,
        user: body.user || 'root',
        password: body.password || null,
        panelType: body.panelType || 'none',
        panelUrl: body.panelUrl || null,
        panelLogin: body.panelLogin || null,
        panelPassword: body.panelPassword || null,
        hostingAccountId: body.hostingAccountId || null,
        monitorToken,
        status: 'offline',
      },
    });

    const installScript = buildInstallScript({
      appUrl: resolveAppUrl(req),
      token: monitorToken,
      serverId: server.id,
    });

    const { monitorToken: _monitorToken, ...safeServer } = server;
    return NextResponse.json({ ...safeServer, installScript });
  } catch (error) {
    console.error('Failed to add server:', error);
    return NextResponse.json({ error: 'Failed to add server' }, { status: 500 });
  }
}


export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const updated = await prisma.server.update({
      where: { id: body.id },
      data: {
        name: body.name,
        ip: body.ip,
        user: body.user || 'root',
        password: body.password || null,
        panelType: body.panelType || 'none',
        panelUrl: body.panelUrl || null,
        panelLogin: body.panelLogin || null,
        panelPassword: body.panelPassword || null,
        hostingAccountId: body.hostingAccountId || null,
      },
    });

    const { monitorToken: _monitorToken, ...safeServer } = updated;
    return NextResponse.json(safeServer);
  } catch (error) {
    console.error('Failed to update server:', error);
    return NextResponse.json({ error: 'Failed to update server' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.server.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete server:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
