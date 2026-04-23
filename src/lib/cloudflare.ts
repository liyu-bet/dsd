import { decryptSecret as decryptSecretV2 } from './crypto-secrets';
import { decryptSecret as decryptSecretLegacy } from './crypto';

export type CloudflareAccountWithSecrets = {
  id: string;
  name: string;
  login: string;
  password?: string | null;
  apiToken?: string | null;
  apiKey?: string | null;
};

export type CloudflareZone = {
  id: string;
  name: string;
  status?: string;
};

export type CloudflareDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
};

async function decryptAnySecret(value?: string | null): Promise<string | null> {
  if (!value) return null;

  try {
    const v2 = await decryptSecretV2(value);
    if (typeof v2 === 'string' && v2.length > 0) return v2;
  } catch {
    // noop
  }

  try {
    const legacy = await decryptSecretLegacy(value);
    if (typeof legacy === 'string' && legacy.length > 0) return legacy;
  } catch {
    // noop
  }

  return null;
}

async function getCfHeaders(account: CloudflareAccountWithSecrets) {
  const apiToken = await decryptAnySecret(account.apiToken);
  if (apiToken) {
    return {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  const apiKey = await decryptAnySecret(account.apiKey);
  if (apiKey && account.login) {
    return {
      'X-Auth-Email': account.login,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  return null;
}

async function cfRequest<T>(account: CloudflareAccountWithSecrets, path: string, init?: RequestInit): Promise<T> {
  const headers = await getCfHeaders(account);
  if (!headers) {
    throw new Error('Для Cloudflare-аккаунта не указан API Token или Global API Key');
  }

  const requestHeaders = new Headers(init?.headers);
  for (const [key, value] of Object.entries(headers)) {
    requestHeaders.set(key, value);
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const err = data?.errors?.[0];
    const code = err?.code != null ? ` [CF code ${err.code}]` : '';
    const msg = (err?.message || res.statusText || 'Cloudflare API error') + code;
    throw new Error(msg);
  }

  return data.result as T;
}

export function normalizeHost(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');
}

export async function listZones(account: CloudflareAccountWithSecrets): Promise<CloudflareZone[]> {
  const headers = await getCfHeaders(account);
  if (!headers) {
    throw new Error('Для Cloudflare-аккаунта не указан API Token или Global API Key');
  }

  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    requestHeaders.set(key, value);
  }

  const allZones: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=100&page=${page}`, {
      headers: requestHeaders,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      const err = data?.errors?.[0];
      const code = err?.code != null ? ` [CF code ${err.code}]` : '';
      throw new Error((err?.message || res.statusText || 'Cloudflare API error') + code);
    }

    const result = Array.isArray(data.result) ? data.result : [];
    allZones.push(...result);

    totalPages = Number(data?.result_info?.total_pages || 1);
    page += 1;
  } while (page <= totalPages);

  return allZones.map((zone) => ({ id: zone.id, name: zone.name, status: zone.status }));
}

export async function findBestZoneForHost(account: CloudflareAccountWithSecrets, host: string) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;

  const zones = await listZones(account);
  const exact = zones.find((zone) => normalizedHost === zone.name || normalizedHost === `www.${zone.name}`);
  if (exact) return exact;

  const suffixMatches = zones
    .filter((zone) => normalizedHost.endsWith(`.${zone.name}`))
    .sort((a, b) => b.name.length - a.name.length);

  return suffixMatches[0] || null;
}

export async function listARecords(account: CloudflareAccountWithSecrets, zoneId: string, host?: string) {
  const params = new URLSearchParams({ type: 'A', per_page: '100' });
  if (host) params.set('name', normalizeHost(host));
  return cfRequest<CloudflareDnsRecord[]>(account, `/zones/${zoneId}/dns_records?${params.toString()}`);
}

export async function getDeveloperMode(account: CloudflareAccountWithSecrets, zoneId: string) {
  const result = await cfRequest<any>(account, `/zones/${zoneId}/settings/development_mode`);
  return {
    id: result.id,
    value: result.value,
    editable: result.editable,
    modified_on: result.modified_on,
  };
}

export async function setDeveloperMode(account: CloudflareAccountWithSecrets, zoneId: string, enabled: boolean) {
  const result = await cfRequest<any>(account, `/zones/${zoneId}/settings/development_mode`, {
    method: 'PATCH',
    body: JSON.stringify({ value: enabled ? 'on' : 'off' }),
  });

  return {
    id: result.id,
    value: result.value,
    editable: result.editable,
    modified_on: result.modified_on,
  };
}
