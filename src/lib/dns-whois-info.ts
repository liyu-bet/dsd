import { resolve4, resolve6, resolveNs, resolveMx, resolveTxt, resolveCaa } from 'dns/promises';
import { domain as whoisDomain } from 'whoiser';
import type { Prisma, PrismaClient, Site } from '@prisma/client';
import { getApexHostForSite } from './apex-a-record';

const DNS_INFO_MIN_MS = Math.max(60 * 60 * 1000, Number(process.env.PUBLIC_DNS_INFO_MIN_MS || 24 * 60 * 60 * 1000));
const WHOIS_INFO_MIN_MS = Math.max(24 * 60 * 60 * 1000, Number(process.env.WHOIS_INFO_MIN_MS || 7 * 24 * 60 * 60 * 1000));

export type PublicDnsInfoPayload = {
  a: string[];
  aaaa: string[];
  ns: string[];
  mx: { exchange: string; priority: number }[];
  txt: string[];
  caa: string[];
};

export type WhoisInfoPayload = {
  domain: string;
  registrar: string | null;
  /** Владелец / регистрант (если не скрыт privacy) */
  ownerName: string | null;
  ownerOrganization: string | null;
  ownerCountry: string | null;
  ownerState: string | null;
  ownerEmail: string | null;
  created: string | null;
  expires: string | null;
  nameServers: string[];
  status: string[];
  error?: string;
};

const MAX_TXT = 6;

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export async function collectPublicDns(apexHost: string): Promise<PublicDnsInfoPayload> {
  const a = (await safe(() => resolve4(apexHost), [] as string[])).slice(0, 5);
  const aaaa = (await safe(() => resolve6(apexHost), [] as string[])).slice(0, 5);
  const ns = (await safe(() => resolveNs(apexHost), [] as string[])).map((h) => h.toLowerCase());
  const mxRaw = await safe(() => resolveMx(apexHost), [] as { exchange: string; priority: number }[]);
  const mx = mxRaw
    .map((m) => ({ exchange: m.exchange.replace(/\.$/, '').toLowerCase(), priority: m.priority }))
    .sort((p, q) => p.priority - q.priority)
    .slice(0, 5);
  const txtArr = (await safe(() => resolveTxt(apexHost), [] as string[][]))
    .flat()
    .filter(Boolean);
  const txt = Array.from(new Set(txtArr)).slice(0, MAX_TXT);
  const caaR = await safe(() => resolveCaa(apexHost), [] as { critical: number; issue?: string; issuewild?: string }[]);
  const caa: string[] = caaR
    .map((c) => {
      if (c.issue) return `issue ${c.issue}`;
      if (c.issuewild) return `issuewild ${c.issuewild}`;
      return JSON.stringify(c);
    })
    .slice(0, 6);

  return { a, aaaa, ns, mx, txt, caa };
}

/** Normalize WHOIS / RDAP keys: case, underscores vs spaces (e.g. .pl, some ccTLDs). */
function normalizeWhoisKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[/]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  const byNorm = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    byNorm.set(normalizeWhoisKey(k), v);
  }
  for (const k of keys) {
    const nk = normalizeWhoisKey(k);
    const v = obj[k] ?? byNorm.get(nk);
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v[0].trim();
  }
  return null;
}

function whoisServerBlocks(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length > 0 && keys[0].includes('.')) {
    return Object.values(r).filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  }
  return [r as Record<string, unknown>];
}

function pickAcrossBlocks(blocks: Record<string, unknown>[], keys: string[]): string | null {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const v = pickString(blocks[i], keys);
    if (v) return v;
  }
  return null;
}

function pickStringList(obj: Record<string, unknown>, keys: string[]): string[] {
  const byNorm = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    byNorm.set(normalizeWhoisKey(k), v);
  }
  for (const k of keys) {
    const v = obj[k] ?? byNorm.get(normalizeWhoisKey(k));
    if (Array.isArray(v)) {
      return v
        .map((x) => (typeof x === 'string' ? x.replace(/\.$/, '').toLowerCase() : String(x)))
        .filter(Boolean);
    }
    if (typeof v === 'string') {
      return v
        .split(/\s+/)
        .map((s) => s.replace(/\.$/, '').toLowerCase())
        .filter(Boolean);
    }
  }
  return [];
}

function mergeWhoisBlocks(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  const looksLikeServers = keys.length > 0 && keys[0].includes('.');
  if (looksLikeServers) {
    const blocks = Object.values(r).filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
    const preferred =
      [...blocks].reverse().find(
        (b) => b && (typeof b.Registrar === 'string' || typeof b['Sponsoring Registrar'] === 'string')
      ) || blocks[blocks.length - 1];
    return preferred || {};
  }
  return r;
}

/**
 * whoiser: объект по серверам — берём блок с данными регистратора, если есть
 */
function normalizeWhoisResult(raw: unknown, registered: string): WhoisInfoPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      domain: registered,
      registrar: null,
      ownerName: null,
      ownerOrganization: null,
      ownerCountry: null,
      ownerState: null,
      ownerEmail: null,
      created: null,
      expires: null,
      nameServers: [],
      status: [],
      error: 'Empty WHOIS response',
    };
  }

  const o = mergeWhoisBlocks(raw);
  if (Object.keys(o).length === 0) {
    return {
      domain: registered,
      registrar: null,
      ownerName: null,
      ownerOrganization: null,
      ownerCountry: null,
      ownerState: null,
      ownerEmail: null,
      created: null,
      expires: null,
      nameServers: [],
      status: [],
      error: 'Empty WHOIS response',
    };
  }
  const blocks = whoisServerBlocks(raw);
  const ownerName = pickAcrossBlocks(blocks, [
    'Registrant Name',
    'Registrant-Name',
    'Registrant Contact Name',
    'Registrant',
    'Person',
    'org-name',
    /** NASK / some EU ccTLDs */
    'Holder Name',
    'Holder name',
    'Registrant contact name',
    'Contact Name',
  ]);
  const ownerOrganization = pickAcrossBlocks(blocks, [
    'Registrant Organization',
    'Registrant-Organization',
    'Registrant Company',
    'Organization',
    'org',
    'Holder Company',
    'Holder company',
    'Registrant contact organization',
    'Contact Organization',
  ]);
  const ownerCountry = pickAcrossBlocks(blocks, [
    'Registrant Country',
    'Registrant-Country',
    'Registrant Country Code',
    'Holder Country',
    'Country',
  ]);
  const ownerState = pickAcrossBlocks(blocks, [
    'Registrant State/Province',
    'Registrant-State',
    'Registrant State',
    'State',
    'Holder State',
    'Province',
  ]);
  const ownerEmail = pickAcrossBlocks(blocks, [
    'Registrant Email',
    'Registrant-Email',
    'Admin Email',
    'Admin-Email',
    'Holder Email',
    'Contact Email',
  ]);

  const nameServers = pickStringList(o, ['Name Server', 'Nserver']);
  const statusRaw = o['Domain Status'] ?? o['Status'];
  const status: string[] = Array.isArray(statusRaw)
    ? (statusRaw as string[]).map((s) => s.split(/\s+/)[0] || s)
    : typeof statusRaw === 'string'
      ? [statusRaw]
      : [];

  return {
    domain: (pickString(o, ['Domain Name', 'domain']) || registered).toLowerCase(),
    registrar: pickString(o, ['Registrar', 'Sponsoring Registrar', 'registrar']),
    ownerName,
    ownerOrganization,
    ownerCountry,
    ownerState,
    ownerEmail,
    created: pickString(o, ['Creation Date', 'Created Date', 'Registered On', 'Created']),
    expires: pickString(o, [
      'Registry Expiry Date',
      'Expiry Date',
      'Expiration Date',
      'Registrar Registration Expiration Date',
      'paid-till',
    ]),
    nameServers,
    status,
  };
}

const getRdapVcardValue = (entity: any, key: string): string | null => {
  const vcard = Array.isArray(entity?.vcardArray?.[1]) ? entity.vcardArray[1] : [];
  for (const item of vcard) {
    if (!Array.isArray(item) || item.length < 4) continue;
    if (String(item[0]).toLowerCase() !== key) continue;
    const value = item[3];
    if (typeof value === 'string' && value.trim()) {
      if (key === 'email') return value.replace(/^mailto:/i, '').trim();
      return value.trim();
    }
    if (Array.isArray(value) && key === 'adr') {
      const cleaned = value.map((part) => String(part || '').trim());
      const region = cleaned[3] || '';
      const country = cleaned[6] || '';
      const joined = [region, country].filter(Boolean).join(', ');
      if (joined) return joined;
    }
  }
  return null;
};

const flattenRdapEntities = (entities: any[]): any[] => {
  const output: any[] = [];
  const walk = (entity: any) => {
    if (!entity || typeof entity !== 'object') return;
    output.push(entity);
    if (Array.isArray(entity.entities)) {
      entity.entities.forEach(walk);
    }
  };
  entities.forEach(walk);
  return output;
};

const pickRdapEntity = (entities: any[], role: string) =>
  entities.find((entity) => Array.isArray(entity?.roles) && entity.roles.map((r: string) => String(r).toLowerCase()).includes(role));

async function collectWhoisViaRdap(registeredDomain: string): Promise<WhoisInfoPayload | null> {
  try {
    const tld = registeredDomain.split('.').pop()?.toLowerCase();
    if (!tld) return null;

    const bootstrapRes = await fetch('https://data.iana.org/rdap/dns.json');
    if (!bootstrapRes.ok) return null;
    const bootstrap = await bootstrapRes.json().catch(() => null) as any;
    const services: any[] = Array.isArray(bootstrap?.services) ? bootstrap.services : [];

    const matching = services.find((entry) =>
      Array.isArray(entry?.[0]) && entry[0].map((item: string) => String(item).toLowerCase()).includes(tld)
    );
    const baseUrl = Array.isArray(matching?.[1]) ? matching[1][0] : null;
    if (!baseUrl || typeof baseUrl !== 'string') return null;

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/domain/${registeredDomain}`;
    const rdapRes = await fetch(endpoint, {
      headers: { Accept: 'application/rdap+json, application/json' },
    });
    if (!rdapRes.ok) return null;
    const rdap = await rdapRes.json().catch(() => null) as any;
    if (!rdap || typeof rdap !== 'object') return null;

    const entities = flattenRdapEntities(Array.isArray(rdap.entities) ? rdap.entities : []);
    const registrarEntity = pickRdapEntity(entities, 'registrar');
    const registrantEntity = pickRdapEntity(entities, 'registrant');
    const ownerEntity =
      registrantEntity ||
      pickRdapEntity(entities, 'administrative') ||
      entities[0] ||
      null;

    const expirationEvent = Array.isArray(rdap.events)
      ? rdap.events.find((event: any) => String(event?.eventAction || '').toLowerCase().includes('expiration'))
      : null;
    const registrationEvent = Array.isArray(rdap.events)
      ? rdap.events.find((event: any) => String(event?.eventAction || '').toLowerCase().includes('registration'))
      : null;

    const nameservers = Array.isArray(rdap.nameservers)
      ? rdap.nameservers
          .map((ns: any) => String(ns?.ldhName || '').replace(/\.$/, '').toLowerCase())
          .filter(Boolean)
      : [];

    return {
      domain: String(rdap.ldhName || registeredDomain).toLowerCase(),
      registrar:
        getRdapVcardValue(registrarEntity, 'fn') ||
        getRdapVcardValue(registrarEntity, 'org') ||
        null,
      ownerName: getRdapVcardValue(ownerEntity, 'fn'),
      ownerOrganization: getRdapVcardValue(ownerEntity, 'org'),
      ownerCountry: getRdapVcardValue(ownerEntity, 'country-name') || getRdapVcardValue(ownerEntity, 'adr'),
      ownerState: getRdapVcardValue(ownerEntity, 'region'),
      ownerEmail: getRdapVcardValue(ownerEntity, 'email'),
      created: registrationEvent?.eventDate || null,
      expires: expirationEvent?.eventDate || null,
      nameServers: nameservers,
      status: Array.isArray(rdap.status) ? rdap.status.map((s: any) => String(s)) : [],
    };
  } catch {
    return null;
  }
}

export async function collectWhois(registeredDomain: string): Promise<WhoisInfoPayload> {
  const clean = registeredDomain.toLowerCase().replace(/^www\./, '');
  try {
    const data = (await whoisDomain(clean, {
      follow: 2,
      timeout: 15000,
      ignorePrivacy: false,
    })) as unknown;
    return normalizeWhoisResult(data, clean);
  } catch (e) {
    const rdapFallback = await collectWhoisViaRdap(clean);
    if (rdapFallback) {
      return {
        ...rdapFallback,
        error: e instanceof Error ? `WHOIS fallback to RDAP: ${e.message}` : 'WHOIS fallback to RDAP',
      };
    }
    return {
      domain: clean,
      registrar: null,
      ownerName: null,
      ownerOrganization: null,
      ownerCountry: null,
      ownerState: null,
      ownerEmail: null,
      created: null,
      expires: null,
      nameServers: [],
      status: [],
      error: e instanceof Error ? e.message : 'WHOIS failed',
    };
  }
}

function shouldRun(prev: Date | null, minMs: number, force?: boolean) {
  if (force) return true;
  if (!prev) return true;
  return Date.now() - prev.getTime() >= minMs;
}

const normalizeRegistrarText = (value?: string | null) =>
  String(value || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const compactRegistrarText = (value?: string | null) =>
  normalizeRegistrarText(value).replace(/\s+/g, '');

const registrarStopWords = new Set([
  'llc', 'ltd', 'inc', 'corp', 'gmbh', 'limited', 'company', 'co', 'the',
  'domain', 'domains', 'registrar', 'services', 'service', 'group',
]);

const tokenizeRegistrarText = (value?: string | null) =>
  normalizeRegistrarText(value)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !registrarStopWords.has(t));

const getUrlHostToken = (value?: string | null) => {
  if (!value) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();
    return host.split('.')[0] || '';
  } catch {
    const fallback = String(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    return fallback.split('.')[0] || '';
  }
};

const registrarAliases: Record<string, string[]> = {
  spaceship: ['spaceship', 'spaceshipinc'],
};

const overlapCount = (a: string[], b: string[]) => {
  const setB = new Set(b);
  return a.reduce((acc, token) => (setB.has(token) ? acc + 1 : acc), 0);
};

function pickRegistrarAccountByWhois(
  whoisRegistrar: string | null | undefined,
  accounts: Array<{ id: string; name: string; url: string | null }>
) {
  const whoisNorm = normalizeRegistrarText(whoisRegistrar);
  const whoisCompact = compactRegistrarText(whoisRegistrar);
  if (!whoisNorm || !whoisCompact) return null;

  let best: { id: string; score: number } | null = null;
  for (const account of accounts) {
    const nameCompact = compactRegistrarText(account.name);
    const nameTokens = tokenizeRegistrarText(account.name);
    const hostToken = getUrlHostToken(account.url);
    const aliasKey = nameCompact || hostToken;
    const aliases = aliasKey ? registrarAliases[aliasKey] || [] : [];
    const hostTokens = hostToken ? tokenizeRegistrarText(hostToken) : [];
    const aliasTokens = aliases.flatMap((alias) => tokenizeRegistrarText(alias));
    const accountTokens = Array.from(new Set([...nameTokens, ...hostTokens, ...aliasTokens]));
    const whoisTokens = tokenizeRegistrarText(whoisRegistrar);
    const overlap = overlapCount(accountTokens, whoisTokens);
    const overlapRatio = accountTokens.length > 0 ? overlap / accountTokens.length : 0;

    let score = 0;
    if (nameCompact && whoisCompact === nameCompact) {
      score = 1200;
    } else if (aliases.length > 0 && aliases.some((alias) => whoisCompact.includes(alias))) {
      score = 1100;
    } else if (nameCompact && (whoisCompact.includes(nameCompact) || nameCompact.includes(whoisCompact))) {
      score = 820 + Math.min(nameCompact.length, whoisCompact.length);
    } else if (hostToken && hostToken.length >= 4 && whoisCompact.includes(hostToken)) {
      score = 760 + hostToken.length;
    } else if (overlap >= 2 || (overlap >= 1 && overlapRatio >= 0.5)) {
      // Fallback: robust partial/token match for mixed naming styles.
      score = 620 + Math.round(overlapRatio * 100);
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id: account.id, score };
    }
  }

  return best && best.score >= 650 ? best.id : null;
}

function parseWhoisExpiresToDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = value.replace(/[/.]/g, '-');
  const ymd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const date = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const date = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

type WhoisSyncSite = Pick<
  Site,
  'id' | 'url' | 'whoisInfoUpdatedAt' | 'whoisInfoJson' | 'domainExpiresAt' | 'registrarAccountId'
>;

export async function maybeSyncPublicDns(
  client: PrismaClient,
  site: Site,
  options?: { force?: boolean }
) {
  if (!shouldRun(site.publicDnsInfoUpdatedAt, DNS_INFO_MIN_MS, options?.force)) {
    return;
  }
  const host = getApexHostForSite(site.url);
  if (!host) return;
  const payload = await collectPublicDns(host);
  await client.site.update({
    where: { id: site.id },
    data: {
      publicDnsInfoJson: JSON.stringify(payload),
      publicDnsInfoUpdatedAt: new Date(),
    } as Prisma.SiteUpdateInput,
  });
}

export async function maybeSyncWhois(
  client: PrismaClient,
  site: WhoisSyncSite,
  options?: {
    force?: boolean;
    fillDomainExpiresAtFromWhois?: boolean;
    onlyIfDomainExpiresAtEmpty?: boolean;
    autoAssignRegistrarFromWhois?: boolean;
    onlyIfRegistrarAccountEmpty?: boolean;
  }
) {
  const host = getApexHostForSite(site.url);
  if (!host) return;
  const shouldFetchFreshWhois = shouldRun(site.whoisInfoUpdatedAt, WHOIS_INFO_MIN_MS, options?.force);
  let payload: WhoisInfoPayload | null = null;

  if (shouldFetchFreshWhois) {
    payload = await collectWhois(host);
  } else if (site.whoisInfoJson) {
    try {
      payload = JSON.parse(site.whoisInfoJson) as WhoisInfoPayload;
    } catch {
      payload = null;
    }
  }
  if (!payload) return;

  const shouldFillDomainExpiresAt = options?.fillDomainExpiresAtFromWhois ?? true;
  const onlyIfDomainExpiresAtEmpty = options?.onlyIfDomainExpiresAtEmpty ?? true;
  const shouldAutoAssignRegistrar = options?.autoAssignRegistrarFromWhois ?? true;
  const onlyIfRegistrarAccountEmpty = options?.onlyIfRegistrarAccountEmpty ?? true;
  const parsedWhoisExpiry = shouldFillDomainExpiresAt ? parseWhoisExpiresToDate(payload.expires) : null;
  const canUpdateDomainExpiresAt = Boolean(
    parsedWhoisExpiry &&
    (!onlyIfDomainExpiresAtEmpty || !site.domainExpiresAt)
  );
  const shouldTryRegistrarAssignment = Boolean(
    shouldAutoAssignRegistrar &&
    payload.registrar &&
    (!onlyIfRegistrarAccountEmpty || !site.registrarAccountId)
  );
  let registrarAccountIdToAssign: string | null = null;
  if (shouldTryRegistrarAssignment) {
    const accounts = await client.registrarAccount.findMany({
      select: { id: true, name: true, url: true },
    });
    registrarAccountIdToAssign = pickRegistrarAccountByWhois(payload.registrar, accounts);
  }

  await client.site.update({
    where: { id: site.id },
    data: {
      ...(shouldFetchFreshWhois
        ? {
            whoisInfoJson: JSON.stringify(payload),
            whoisInfoUpdatedAt: new Date(),
          }
        : {}),
      ...(canUpdateDomainExpiresAt ? { domainExpiresAt: parsedWhoisExpiry as Date } : {}),
      ...(registrarAccountIdToAssign ? { registrarAccountId: registrarAccountIdToAssign } : {}),
    } as Prisma.SiteUpdateInput,
  });
}

export async function maybeSyncDnsAndWhois(
  client: PrismaClient,
  site: Site,
  options?: {
    force?: boolean;
    fillDomainExpiresAtFromWhois?: boolean;
    onlyIfDomainExpiresAtEmpty?: boolean;
    autoAssignRegistrarFromWhois?: boolean;
    onlyIfRegistrarAccountEmpty?: boolean;
  }
) {
  await maybeSyncPublicDns(client, site, options);
  await maybeSyncWhois(client, site, options);
}
