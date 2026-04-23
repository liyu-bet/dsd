import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAppUrl } from '@/lib/app-url';
import { buildInstallScript } from '@/lib/agent-script';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const server = await prisma.server.findUnique({ where: { id } });
    if (!server?.monitorToken) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const installScript = buildInstallScript({
      appUrl: resolveAppUrl(req),
      token: server.monitorToken,
      serverId: server.id,
    });

    return NextResponse.json({ installScript });
  } catch (error) {
    console.error('Failed to build agent install script:', error);
    return NextResponse.json({ error: 'Failed to build script' }, { status: 500 });
  }
}
