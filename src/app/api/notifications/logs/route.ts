import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.telegramNotificationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/notifications/logs failed', error);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }
}
