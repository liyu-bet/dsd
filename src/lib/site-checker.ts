import { checkSiteCore as rawCheckSiteCore } from '@/lib/monitor/site-checker-core';

type SiteCheckResult = {
  isUp: boolean;
  pingMs: number;
  statusCode: number;
  isDnsValid: boolean;
  techStack: {
    php: boolean;
    wordpress: boolean;
    db: boolean;
    html: boolean;
    cloudflare: boolean;
    proxied: boolean;
    ssl: {
      daysLeft: number;
      issuer: string;
      validToDate: string;
    } | null;
    resolvedIp: string | null;
    redirectUrl: string | null;
  };
};

export async function checkSiteCore(
  siteUrl: string,
  serverIp?: string
): Promise<SiteCheckResult> {
  return rawCheckSiteCore(siteUrl, serverIp);
}