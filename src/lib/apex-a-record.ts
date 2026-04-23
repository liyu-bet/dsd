import { resolve4 } from 'dns/promises';
import type { Prisma, PrismaClient, Site, CloudflareAccount } from '@prisma/client';
import { findBestZoneForHost, listARecords } from './cloudflare';

const APEX_A_MIN_INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.APEX_A_MIN_INTERVAL_MS || 24 * 60 * 60 * 1000)
);

const hostFromUrl = (value: string) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
};

/** Root-like / регистрация apex для A: как getRootLikeDomain в UI */
export const getApexHostForSite = (siteUrl: string) => {
  const h = hostFromUrl(siteUrl);
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
};

type SiteWithCf = Site & { cfAccount: CloudflareAccount | null };

export function shouldSyncApexA(
  previousUpdatedAt: Date | null,
  options?: { force?: boolean }
) {
  if (options?.force) return true;
  if (!previousUpdatedAt) return true;
  return Date.now() - previousUpdatedAt.getTime() >= APEX_A_MIN_INTERVAL_MS;
}

async function resolveAFromPublicDns(apexHost: string): Promise<string | null> {
  try {
    const ips = await resolve4(apexHost);
    return ips[0] || null;
  } catch {
    return null;
  }
}

async function resolveAFromCloudflare(
  account: CloudflareAccount,
  siteUrl: string
): Promise<string | null> {
  const zone = await findBestZoneForHost(account, siteUrl);
  if (!zone) return null;
  const records = await listARecords(account, zone.id, zone.name);
  if (!Array.isArray(records) || records.length === 0) return null;
  return records[0]?.content?.trim() || null;
}

export async function maybeSyncApexARecord(
  client: PrismaClient,
  site: SiteWithCf,
  options?: { force?: boolean }
) {
  if (!shouldSyncApexA(site.apexARecordUpdatedAt, options)) {
    return;
  }

  const apexHost = getApexHostForSite(site.url);
  if (!apexHost) {
    return;
  }

  let value: string | null = null;
  let source: 'cf' | 'dns' | null = null;

  if (site.cfAccount) {
    try {
      const ip = await resolveAFromCloudflare(site.cfAccount, site.url);
      if (ip) {
        value = ip;
        source = 'cf';
      }
    } catch (err) {
      console.error(`[APEX A] Cloudflare failed for site ${site.url}:`, err);
    }

    if (!value) {
      if (site.apexARecordSource === 'dns') {
        await client.site.update({
          where: { id: site.id },
          data: {
            apexARecord: null,
            apexARecordSource: null,
            apexARecordUpdatedAt: new Date(),
          },
        });
      }
      return;
    }
  } else {
    const ip = await resolveAFromPublicDns(apexHost);
    if (ip) {
      value = ip;
      source = 'dns';
    }
  }

  if (!value || !source) {
    return;
  }

  const data: Prisma.SiteUpdateInput = {
    apexARecord: value,
    apexARecordSource: source,
    apexARecordUpdatedAt: new Date(),
  };

  await client.site.update({
    where: { id: site.id },
    data,
  });
}
