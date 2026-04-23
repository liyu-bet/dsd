import { PrismaClient } from '@prisma/client';
import { maybeSyncApexARecord } from '../apex-a-record';
import { maybeSyncDnsAndWhois } from '../dns-whois-info';
// CJS module without types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkSiteCore } = require('./site-checker-core') as {
  checkSiteCore: (url: string, serverIp?: string) => Promise<{
    isUp: boolean;
    pingMs: number;
    isDnsValid: boolean;
    techStack: Record<string, unknown>;
    statusCode: number;
  }>;
};

const prisma = (global as unknown as { __monitorPrisma?: PrismaClient }).__monitorPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') (global as unknown as { __monitorPrisma: PrismaClient }).__monitorPrisma = prisma;

const SERVER_JOB_NAME = 'server_checks';
const SITE_JOB_NAME = 'site_checks';
const SERVER_INTERVAL_MS = 5 * 60 * 1000;
const SITE_INTERVAL_MS = intEnv('SITE_CHECK_INTERVAL_MS', 10 * 60 * 1000);
const BELGRADE_TZ = 'Europe/Belgrade';

function intEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBelgradeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BELGRADE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

function getBelgradeDayKey(date: Date) {
  const parts = getBelgradeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getBelgradeHourKey(date: Date) {
  const parts = getBelgradeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
}

function getIntervalBucketKey(date: Date) {
  return String(Math.floor(date.getTime() / SERVER_INTERVAL_MS));
}

function getSiteIntervalBucketKey(date: Date) {
  return String(Math.floor(date.getTime() / SITE_INTERVAL_MS));
}

async function hasWorkerSiteCheckInBucket(siteId: string, now: Date) {
  const recentChecks = await prisma.siteCheck.findMany({
    where: { siteId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { createdAt: true, trigger: true },
  });

  const currentBucket = getSiteIntervalBucketKey(now);
  return recentChecks.some(
    (check) =>
      (check.trigger === 'worker' || check.trigger === 'internal-api') &&
      getSiteIntervalBucketKey(new Date(check.createdAt)) === currentBucket
  );
}

function getBucketType(check: { bucketType?: string | null }) {
  return check.bucketType || 'interval';
}

async function createJobRun(jobName: string, trigger: string, metadata: unknown = null) {
  return prisma.jobRun.create({
    data: {
      jobName,
      trigger,
      status: 'running',
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function finishJobRun(
  id: string,
  data: {
    status: string;
    processed?: number;
    successCount?: number;
    failureCount?: number;
    errorText?: string | null;
  }
) {
  return prisma.jobRun.update({
    where: { id },
    data: {
      status: data.status,
      finishedAt: new Date(),
      processed: data.processed ?? 0,
      successCount: data.successCount ?? 0,
      failureCount: data.failureCount ?? 0,
      errorText: data.errorText || null,
    },
  });
}

async function withJobLock<T>(
  jobName: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | { skipped: true; reason: string; lockedUntil: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const existing = await prisma.jobLock.findUnique({ where: { jobName } });
  if (existing && existing.lockedUntil > now) {
    return {
      skipped: true,
      reason: 'locked',
      lockedUntil: existing.lockedUntil,
    };
  }

  await prisma.jobLock.upsert({
    where: { jobName },
    create: {
      jobName,
      isRunning: true,
      lockedAt: now,
      lockedUntil: expiresAt,
    },
    update: {
      isRunning: true,
      lockedAt: now,
      lockedUntil: expiresAt,
    },
  });

  try {
    return await fn();
  } finally {
    await prisma.jobLock
      .update({
        where: { jobName },
        data: {
          isRunning: false,
          lockedUntil: new Date(0),
        },
      })
      .catch(() => null);
  }
}

async function cleanupServerChecks(serverId: string, now: Date) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await Promise.all([
    prisma.serverCheck.deleteMany({
      where: {
        serverId,
        bucketType: 'interval',
        createdAt: { lt: oneHourAgo },
      },
    }),
    prisma.serverCheck.deleteMany({
      where: {
        serverId,
        bucketType: 'hourly',
        createdAt: { lt: oneDayAgo },
      },
    }),
    prisma.serverCheck.deleteMany({
      where: {
        serverId,
        bucketType: 'daily',
        createdAt: { lt: sevenDaysAgo },
      },
    }),
    prisma.serverCheck.deleteMany({
      where: {
        serverId,
        bucketType: 'manual',
        createdAt: { lt: sevenDaysAgo },
      },
    }),
  ]);
}

async function pruneSiteChecks(siteId: string) {
  const overflowChecks = await prisma.siteCheck.findMany({
    where: { siteId },
    orderBy: { createdAt: 'desc' },
    skip: 6,
    select: { id: true },
  });

  if (overflowChecks.length) {
    await prisma.siteCheck.deleteMany({
      where: {
        id: { in: overflowChecks.map((x) => x.id) },
      },
    });
  }
}

type JobOptions = {
  trigger?: string;
  serverId?: string;
  siteId?: string;
  batchSize?: number;
  mode?: string;
};

export async function runServerChecks(options: JobOptions = {}) {
  const trigger = options.trigger || 'worker';
  const jobRun = await createJobRun(SERVER_JOB_NAME, trigger, options);

  try {
    const result = await withJobLock(SERVER_JOB_NAME, intEnv('SERVER_JOB_LOCK_TTL_SEC', 120), async () => {
      const serverWhere = options.serverId ? { id: options.serverId } : {};
      const servers = await prisma.server.findMany({
        where: serverWhere,
        include: {
          checks: { orderBy: { createdAt: 'desc' }, take: 260 },
        },
        orderBy: { createdAt: 'asc' },
      });

      const now = new Date();
      const heartbeatTtlSec = intEnv('SERVER_HEARTBEAT_TTL_SEC', 180);
      let successCount = 0;
      let failureCount = 0;

      for (const server of servers) {
        try {
          const lastHeartbeatAt = server.lastHeartbeatAt ? new Date(server.lastHeartbeatAt) : null;
          const isOnline = !!lastHeartbeatAt && now.getTime() - lastHeartbeatAt.getTime() <= heartbeatTtlSec * 1000;

          const nextStatus = isOnline ? 'online' : 'offline';
          const lastCheck = server.checks[0];
          const isIncident = !!lastCheck && lastCheck.status !== nextStatus;

          const updateData = isOnline
            ? { status: 'online' as const }
            : {
                status: 'offline' as const,
                cpuUsage: 0,
                ramUsage: 0,
                diskUsage: 0,
                loadAvg: '0.00, 0.00, 0.00',
              };

          await prisma.server.update({
            where: { id: server.id },
            data: updateData,
          });

          const existingChecks = server.checks || [];
          const creates: {
            serverId: string;
            status: string;
            cpuUsage: number;
            ramUsage: number;
            isIncident: boolean;
            trigger: string;
            bucketType: string;
          }[] = [];

          if (trigger === 'manual') {
            creates.push({
              serverId: server.id,
              status: nextStatus,
              cpuUsage: isOnline ? server.cpuUsage : 0,
              ramUsage: isOnline ? server.ramUsage : 0,
              isIncident,
              trigger: 'manual',
              bucketType: 'manual',
            });
          } else {
            const intervalKey = getIntervalBucketKey(now);
            const hasInterval = existingChecks.some(
              (check) =>
                getBucketType(check) === 'interval' && getIntervalBucketKey(new Date(check.createdAt)) === intervalKey
            );

            if (!hasInterval) {
              creates.push({
                serverId: server.id,
                status: nextStatus,
                cpuUsage: isOnline ? server.cpuUsage : 0,
                ramUsage: isOnline ? server.ramUsage : 0,
                isIncident,
                trigger: 'worker',
                bucketType: 'interval',
              });
            }

            const currentHourKey = getBelgradeHourKey(now);
            const hasHourSnapshot = existingChecks.some(
              (check) =>
                getBucketType(check) === 'hourly' && getBelgradeHourKey(new Date(check.createdAt)) === currentHourKey
            );

            if (!hasHourSnapshot) {
              creates.push({
                serverId: server.id,
                status: nextStatus,
                cpuUsage: isOnline ? server.cpuUsage : 0,
                ramUsage: isOnline ? server.ramUsage : 0,
                isIncident,
                trigger: 'worker',
                bucketType: 'hourly',
              });
            }

            const currentDayKey = getBelgradeDayKey(now);
            const hasDaySnapshot = existingChecks.some(
              (check) => getBucketType(check) === 'daily' && getBelgradeDayKey(new Date(check.createdAt)) === currentDayKey
            );

            if (!hasDaySnapshot) {
              creates.push({
                serverId: server.id,
                status: nextStatus,
                cpuUsage: isOnline ? server.cpuUsage : 0,
                ramUsage: isOnline ? server.ramUsage : 0,
                isIncident,
                trigger: 'worker',
                bucketType: 'daily',
              });
            }
          }

          if (creates.length > 0) {
            for (const record of creates) {
              await prisma.serverCheck.create({ data: record });
            }
          }

          await cleanupServerChecks(server.id, now);
          successCount += 1;
        } catch (error) {
          console.error(`[JOB] Server check failed for ${server.ip}:`, error);
          failureCount += 1;
        }
      }

      return {
        skipped: false,
        processed: servers.length,
        successCount,
        failureCount,
      };
    });

    if (result && 'skipped' in result && result.skipped && 'lockedUntil' in result) {
      await finishJobRun(jobRun.id, {
        status: 'skipped',
        processed: 0,
        successCount: 0,
        failureCount: 0,
        errorText: `Job already running until ${result.lockedUntil?.toISOString?.() || result.lockedUntil}`,
      });
      return { success: true, skipped: true, jobName: SERVER_JOB_NAME };
    }

    const r = result as { processed: number; successCount: number; failureCount: number };
    await finishJobRun(jobRun.id, {
      status: 'success',
      processed: r.processed,
      successCount: r.successCount,
      failureCount: r.failureCount,
    });

    return { success: true, jobName: SERVER_JOB_NAME, ...r };
  } catch (error) {
    await finishJobRun(jobRun.id, {
      status: 'failed',
      errorText: error instanceof Error ? error.stack || error.message : String(error),
    });
    throw error;
  }
}

export async function runSiteChecks(options: JobOptions = {}) {
  const trigger = options.trigger || 'worker';
  const batchSize = options.batchSize || intEnv('SITE_CHECK_BATCH_SIZE', 10);
  const mode = options.mode || (trigger === 'manual' ? 'batch' : 'all');
  const jobRun = await createJobRun(SITE_JOB_NAME, trigger, {
    batchSize,
    mode,
    siteId: options.siteId || null,
    siteIntervalMs: SITE_INTERVAL_MS,
  });

  try {
    const result = await withJobLock(SITE_JOB_NAME, intEnv('SITE_JOB_LOCK_TTL_SEC', 1800), async () => {
      const shouldProcessAll =
        !!options.siteId || mode === 'all' || trigger === 'worker' || trigger === 'internal-api';
      const siteWhere = options.siteId ? { id: options.siteId } : {};

      const sites = await prisma.site.findMany({
        where: siteWhere,
        include: {
          server: true,
          cfAccount: true,
        },
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
        ...(shouldProcessAll ? {} : { take: batchSize }),
      });

      let successCount = 0;
      let failureCount = 0;
      let skippedInBucket = 0;

      for (const site of sites) {
        const now = new Date();
        const shouldWriteWorkerLog = trigger === 'manual' || options.siteId
          ? true
          : !(await hasWorkerSiteCheckInBucket(site.id, now));

        try {
          const serverIp = site.server?.ip ?? undefined;
          const checkResult = await checkSiteCore(site.url, serverIp);

          await prisma.site.update({
            where: { id: site.id },
            data: {
              status: checkResult.isUp ? 'online' : 'offline',
              lastPingMs: checkResult.pingMs,
              isDnsValid: checkResult.isDnsValid,
              techStack: JSON.stringify(checkResult.techStack),
            },
          });

          try {
            await maybeSyncApexARecord(prisma, site);
            await maybeSyncDnsAndWhois(prisma, site);
          } catch (apexErr) {
            console.error(`[SITE NETWORK INFO] Skipped for ${site.url}:`, apexErr);
          }

          if (shouldWriteWorkerLog) {
            await prisma.siteCheck.create({
              data: {
                siteId: site.id,
                status: checkResult.isUp ? 'online' : 'offline',
                pingMs: checkResult.pingMs,
                statusCode: checkResult.statusCode,
                trigger: trigger === 'manual' ? 'manual' : 'worker',
              },
            });

            await pruneSiteChecks(site.id);
          } else {
            skippedInBucket += 1;
          }

          successCount += 1;
        } catch (error) {
          console.error(`[JOB] Site check failed for ${site.url}:`, error);

          await prisma.site
            .update({
              where: { id: site.id },
              data: {
                status: 'offline',
                lastPingMs: 0,
              },
            })
            .catch(() => null);

          if (shouldWriteWorkerLog) {
            await prisma.siteCheck
              .create({
                data: {
                  siteId: site.id,
                  status: 'offline',
                  pingMs: 0,
                  statusCode: 0,
                  trigger: trigger === 'manual' ? 'manual' : 'worker',
                },
              })
              .catch(() => null);

            await pruneSiteChecks(site.id).catch(() => null);
          } else {
            skippedInBucket += 1;
          }

          failureCount += 1;
        }
      }

      return {
        skipped: false,
        processed: sites.length,
        successCount,
        failureCount,
        skippedInBucket,
      };
    });

    if (result && 'skipped' in result && result.skipped && 'lockedUntil' in result) {
      await finishJobRun(jobRun.id, {
        status: 'skipped',
        processed: 0,
        successCount: 0,
        failureCount: 0,
        errorText: `Job already running until ${result.lockedUntil?.toISOString?.() || result.lockedUntil}`,
      });
      return { success: true, skipped: true, jobName: SITE_JOB_NAME };
    }

    const r = result as {
      processed: number;
      successCount: number;
      failureCount: number;
      skippedInBucket: number;
    };
    await finishJobRun(jobRun.id, {
      status: 'success',
      processed: r.processed,
      successCount: r.successCount,
      failureCount: r.failureCount,
    });

    return { success: true, jobName: SITE_JOB_NAME, ...r };
  } catch (error) {
    await finishJobRun(jobRun.id, {
      status: 'failed',
      errorText: error instanceof Error ? error.stack || error.message : String(error),
    });
    throw error;
  }
}

export async function shutdownMonitorPrisma() {
  await prisma.$disconnect();
}
