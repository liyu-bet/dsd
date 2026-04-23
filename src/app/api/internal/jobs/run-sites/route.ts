import { NextResponse } from 'next/server';
import { runSiteChecks } from '@/lib/monitor/jobsCore';

function isAuthorized(req: Request) {
  const secret = process.env.MONITOR_INTERNAL_SECRET;
  if (!secret) return false;
  return req.headers.get('x-monitor-secret') === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSiteChecks({ trigger: 'internal-api' });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Internal site job failed:', error);
    return NextResponse.json({ error: 'Failed to run job' }, { status: 500 });
  }
}
