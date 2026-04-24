import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const JOB_NAMES = ['server_checks', 'site_checks'] as const;
const INTERVAL_BY_JOB_MS: Record<string, number> = {
  server_checks: Number(process.env.SERVER_CHECK_INTERVAL_MS || 5 * 60 * 1000),
  site_checks: Number(process.env.SITE_CHECK_INTERVAL_MS || 10 * 60 * 1000),
};
const ALIVE_MULTIPLIER = Math.max(2, Number(process.env.MONITOR_WORKER_ALIVE_MULTIPLIER || 4));

export async function GET() {
  try {
    const [locks, latestRuns] = await Promise.all([
      prisma.jobLock.findMany({
        where: { jobName: { in: [...JOB_NAMES] } },
      }),
      Promise.all(
        JOB_NAMES.map((jobName) =>
          prisma.jobRun.findFirst({
            where: { jobName },
            orderBy: { startedAt: 'desc' },
          })
        )
      ),
    ]);

    const lockByName = new Map(locks.map((lock) => [lock.jobName, lock]));
    const now = new Date();
    const rows = JOB_NAMES.map((jobName, idx) => {
      const lock = lockByName.get(jobName);
      const run = latestRuns[idx];
      const lockActive = !!lock && lock.lockedUntil > now;
      const runStartedAt = run ? new Date(run.startedAt).getTime() : 0;
      const runFinishedAt = run?.finishedAt ? new Date(run.finishedAt).getTime() : 0;
      const aliveAnchorTs = Math.max(runStartedAt, runFinishedAt);
      const aliveWindowMs = ALIVE_MULTIPLIER * (INTERVAL_BY_JOB_MS[jobName] || 10 * 60 * 1000);

      return {
        jobName,
        lockActive,
        lockUntil: lock?.lockedUntil ?? null,
        lockUpdatedAt: lock?.updatedAt ?? null,
        workerAlive:
          !!run &&
          Date.now() - aliveAnchorTs <= aliveWindowMs,
        lastRun: run
          ? {
              id: run.id,
              trigger: run.trigger,
              status: run.status,
              processed: run.processed,
              successCount: run.successCount,
              failureCount: run.failureCount,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt,
              errorText: run.errorText,
            }
          : null,
      };
    });

    return NextResponse.json({ rows, now });
  } catch (error) {
    console.error('GET /api/monitor/job-status failed', error);
    return NextResponse.json({ error: 'Failed to load job status' }, { status: 500 });
  }
}
