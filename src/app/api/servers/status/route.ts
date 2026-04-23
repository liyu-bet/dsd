import { NextResponse } from 'next/server';
import { runServerChecks } from '@/lib/monitor/jobsCore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id || undefined;

    const result = await runServerChecks({
      trigger: 'manual',
      serverId: id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to run server checks:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}