import { NextResponse } from 'next/server';
import { runSiteChecks } from '@/lib/monitor/jobsCore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') === 'all' ? 'all' : 'batch';
    const limitParam = searchParams.get('limit');
    const batchSize = limitParam ? Math.max(1, Number(limitParam)) : undefined;

    const result = await runSiteChecks({
      trigger: 'manual',
      mode,
      ...(batchSize ? { batchSize } : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to run site checks:', error);
    return NextResponse.json({ error: 'Failed to check sites' }, { status: 500 });
  }
}
