import type { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { getLanguageFlagUrl, languageUiMeta, normalizeLanguageCode } from './domainLanguageMeta';

export const SITE_UI_REFRESH_MS = 30000;

const getColorToken = (value: string, saturated = false) => {
  const colors = saturated
    ? [
        'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/30 border',
        'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30 border',
        'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/30 border',
        'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400/30 border',
        'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-400/30 border',
        'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30 border',
        'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/30 border',
      ]
    : [
        'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 border',
        'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 border',
        'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 border',
        'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 border',
        'bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20 border',
        'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20 border',
        'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20 border',
      ];

  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const getTagColor = (tag: string) => getColorToken(tag, true);
export const getGroupColor = (group: string) => {
  const colors = [
    'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    'bg-blue-700 text-white dark:bg-blue-500 dark:text-white',
    'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-white',
    'bg-violet-700 text-white dark:bg-violet-500 dark:text-white',
    'bg-rose-700 text-white dark:bg-rose-500 dark:text-white',
    'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950',
    'bg-cyan-700 text-white dark:bg-cyan-500 dark:text-slate-950',
  ];

  let hash = 0;
  for (let i = 0; i < group.length; i++) hash = group.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};


export const getLanguageItems = (stack: any) => {
  const raw = Array.isArray(stack?.languages) ? stack.languages : [];
  const all = [stack?.primaryLanguage, ...raw]
    .map(normalizeLanguageCode)
    .filter(Boolean) as string[];

  const normalized: string[] = [];
  const seenBases = new Set<string>();

  for (const code of all) {
    const base = code.split('-')[0];
    if (seenBases.has(base)) continue;
    seenBases.add(base);
    normalized.push(code);
  }

  const mapped = normalized.map((code, index) => {
    const base = code.split('-')[0];
    return {
      code,
      short: languageUiMeta[base]?.short || base.toUpperCase(),
      title: languageUiMeta[base]?.title || code.toUpperCase(),
      flagUrl: getLanguageFlagUrl(languageUiMeta[base]?.countryCode),
      primary: index === 0,
    };
  });

  return {
    visible: mapped.slice(0, 4),
    hidden: mapped.slice(4),
    total: mapped.length,
  };
};

export const isSubdomainSite = (siteUrl: string) => {
  const parts = String(siteUrl || '').toLowerCase().split('.').filter(Boolean);
  return parts.length > 2;
};

export const checkboxBaseClass = 'h-5 w-5 appearance-none rounded-md border border-slate-300 bg-white shadow-sm transition-all cursor-pointer checked:bg-blue-600 checked:border-blue-600 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200';
export const checkboxCheckedStyle = (checked: boolean): CSSProperties => checked ? {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 10.5l3.1 3.1L15 6.8' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: '14px 14px',
} : {};

export const normalizedHost = (value?: string | null) => {
  if (!value) return '';
  return String(value).replace(/^https?:\/\//, '').split('/')[0].trim().toLowerCase();
};

export const isDomainLevelRedirect = (redirectUrl?: string | null, siteUrl?: string | null) => {
  if (!redirectUrl) return false;
  try {
    const prepared = /^https?:\/\//i.test(redirectUrl) ? redirectUrl : `https://${redirectUrl}`;
    const parsed = new URL(prepared);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const ownHost = String(siteUrl || '').replace(/^www\./, '').toLowerCase();
    const path = (parsed.pathname || '/').replace(/\/+$/, '') || '/';
    return !!host && host !== ownHost && path === '/';
  } catch {
    return false;
  }
};

export const getRootLikeDomain = (host: string) => {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
};

type SiteHistorySite = {
  apexARecord?: string | null;
  apexARecordSource?: string | null;
  apexARecordUpdatedAt?: string | Date | null;
  publicDnsInfoJson?: string | null;
  publicDnsInfoUpdatedAt?: string | Date | null;
  whoisInfoJson?: string | null;
  whoisInfoUpdatedAt?: string | Date | null;
};

const apexSourceLabel = (src?: string | null) => {
  if (src === 'cf') return 'Cloudflare API';
  if (src === 'dns') return 'Публичный DNS';
  return '—';
};

const fmtWhen = (d: string | Date | null | undefined) =>
  d != null
    ? new Date(d).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const SiteHistory = ({
  checks,
  site,
  siteId,
  onRefreshNetwork,
  isRefreshingNetwork,
}: {
  checks: any[];
  site: SiteHistorySite;
  siteId: string;
  onRefreshNetwork: (id: string) => void;
  isRefreshingNetwork?: boolean;
}) => {
  const logsList = (checks && checks.length > 0 ? checks : []).slice(0, 6);
  const dnsPayload = (() => {
    if (!site.publicDnsInfoJson) return null;
    try {
      return JSON.parse(site.publicDnsInfoJson) as {
        a?: string[];
        aaaa?: string[];
        ns?: string[];
        mx?: { exchange: string; priority: number }[];
        txt?: string[];
        caa?: string[];
      };
    } catch {
      return null;
    }
  })();
  const whoisPayload = (() => {
    if (!site.whoisInfoJson) return null;
    try {
      return JSON.parse(site.whoisInfoJson) as {
        domain?: string;
        registrar?: string | null;
        ownerName?: string | null;
        ownerOrganization?: string | null;
        ownerCountry?: string | null;
        ownerState?: string | null;
        ownerEmail?: string | null;
        created?: string | null;
        expires?: string | null;
        nameServers?: string[];
        status?: string[];
        error?: string;
      };
    } catch {
      return null;
    }
  })();

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 dark:border-slate-800 dark:bg-black/20 animate-in fade-in slide-in-from-top-2">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:max-w-none xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.35fr)]">
        <div className="w-full min-w-0 space-y-3">
          <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <span>Домен / сеть</span>
            <button
              type="button"
              title="Обновить DNS, WHOIS и A-запись"
              onClick={() => onRefreshNetwork(siteId)}
              disabled={isRefreshingNetwork}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw size={12} className={isRefreshingNetwork ? 'animate-spin' : ''} />
              обновить
            </button>
          </div>

          <div>
            <div className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Публичный DNS
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 text-[11px] leading-snug text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              {dnsPayload ? (
                <div className="space-y-1.5">
                  {dnsPayload.ns && dnsPayload.ns.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">NS: </span>
                      {dnsPayload.ns.join(', ')}
                    </div>
                  )}
                  {dnsPayload.mx && dnsPayload.mx.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">MX: </span>
                      {dnsPayload.mx.map((m) => `${m.priority} ${m.exchange}`).join(' · ')}
                    </div>
                  )}
                  {dnsPayload.txt && dnsPayload.txt.length > 0 && (
                    <div className="break-words">
                      <span className="font-bold text-slate-400">TXT: </span>
                      {dnsPayload.txt.map((t, i) => (
                        <span key={i} className="block pl-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {t.length > 120 ? `${t.slice(0, 120)}…` : t}
                        </span>
                      ))}
                    </div>
                  )}
                  {dnsPayload.a && dnsPayload.a.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">A: </span>
                      <span className="font-mono">{dnsPayload.a.join(', ')}</span>
                    </div>
                  )}
                  {dnsPayload.aaaa && dnsPayload.aaaa.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">AAAA: </span>
                      <span className="font-mono break-all">{dnsPayload.aaaa.join(', ')}</span>
                    </div>
                  )}
                  {dnsPayload.caa && dnsPayload.caa.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">CAA: </span>
                      {dnsPayload.caa.join(' · ')}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-slate-400">—</p>
              )}
              <p className="mt-2 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400 dark:border-slate-700">
                Кэш: {fmtWhen(site.publicDnsInfoUpdatedAt)}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              A-запись (apex)
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="text-center font-mono text-base font-black tracking-tight text-slate-900 dark:text-white">
                {site.apexARecord || '—'}
              </div>
              <div className="mt-1.5 space-y-0.5 text-center text-[10px] text-slate-500 dark:text-slate-400">
                <div>
                  <span className="font-bold text-slate-400">Источник: </span>
                  {apexSourceLabel(site.apexARecordSource)}
                </div>
                <div>
                  <span className="font-bold text-slate-400">Обновлено: </span>
                  {fmtWhen(site.apexARecordUpdatedAt || null)}
                </div>
              </div>
              {!site.apexARecord && (
                <p className="mt-2 text-center text-[9px] leading-relaxed text-slate-400">После плановой/ручной проверки или кнопки «обновить».</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 px-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">WHOIS</div>
            <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 text-[11px] leading-snug text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              {whoisPayload ? (
                <div className="space-y-1.5">
                  {whoisPayload.error && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">{whoisPayload.error}</p>
                  )}
                  {whoisPayload.registrar && (
                    <div>
                      <span className="font-bold text-slate-400">Регистратор: </span>
                      {whoisPayload.registrar}
                    </div>
                  )}
                  {(whoisPayload.ownerName || whoisPayload.ownerOrganization) && (
                    <div className="rounded-lg border border-violet-200/90 bg-gradient-to-br from-violet-50/95 to-indigo-50/70 px-2.5 py-2 shadow-sm dark:border-violet-500/30 dark:from-violet-950/50 dark:to-indigo-950/35 dark:shadow-none">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">Владелец (WHOIS)</div>
                      {whoisPayload.ownerOrganization && (
                        <div className="text-slate-800 dark:text-slate-100">
                          <span className="font-bold text-violet-600/90 dark:text-violet-400/90">Орг.: </span>
                          {whoisPayload.ownerOrganization}
                        </div>
                      )}
                      {whoisPayload.ownerName && (
                        <div className="text-slate-800 dark:text-slate-100">
                          <span className="font-bold text-violet-600/90 dark:text-violet-400/90">Имя: </span>
                          {whoisPayload.ownerName}
                        </div>
                      )}
                      {(whoisPayload.ownerState || whoisPayload.ownerCountry) && (
                        <div className="text-slate-700 dark:text-slate-200">
                          <span className="font-bold text-violet-600/90 dark:text-violet-400/90">Регион: </span>
                          {[whoisPayload.ownerState, whoisPayload.ownerCountry].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {whoisPayload.ownerEmail && (
                        <div className="break-all font-mono text-[10px] text-slate-800 dark:text-slate-100">
                          <span className="font-bold text-violet-600/90 dark:text-violet-400/90">Email: </span>
                          {whoisPayload.ownerEmail}
                        </div>
                      )}
                    </div>
                  )}
                  {whoisPayload.created && (
                    <div>
                      <span className="font-bold text-slate-400">Создан: </span>
                      {whoisPayload.created}
                    </div>
                  )}
                  {whoisPayload.expires && (
                    <div>
                      <span className="font-bold text-slate-400">Истекает: </span>
                      {whoisPayload.expires}
                    </div>
                  )}
                  {whoisPayload.nameServers && whoisPayload.nameServers.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">NS (whois): </span>
                      {whoisPayload.nameServers.join(', ')}
                    </div>
                  )}
                  {whoisPayload.status && whoisPayload.status.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-400">Статусы: </span>
                      {whoisPayload.status.slice(0, 4).join(', ')}
                    </div>
                  )}
                  {!whoisPayload.registrar &&
                    !whoisPayload.error &&
                    !whoisPayload.created &&
                    !whoisPayload.expires &&
                    !whoisPayload.ownerName &&
                    !whoisPayload.ownerOrganization && (
                    <p className="text-slate-400">Нет разобранных полей (privacy / TLD)</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-slate-400">—</p>
              )}
              <p className="mt-2 border-t border-slate-100 pt-2 text-center text-[9px] text-slate-400 dark:border-slate-700">
                Кэш: {fmtWhen(site.whoisInfoUpdatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0">
          <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            <span>Лог сайта</span>
            <span>Статус</span>
          </div>

          {logsList.length === 0 ? (
            <div className="rounded-[22px] border border-slate-200 border-dashed bg-white/50 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900/30">
              История проверок пока пуста...
            </div>
          ) : (
            <div className="space-y-3">
              {logsList.map((c) => {
                const isFail = c.status !== 'online';
                const isManual = c.trigger === 'manual';

                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-[22px] border px-4 py-4 shadow-sm transition-all ${
                      isFail
                        ? 'border-red-200 bg-red-50/90 dark:border-red-500/20 dark:bg-red-500/10'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="min-w-[122px] text-base font-black text-slate-900 dark:text-white">
                        {new Date(c.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{c.pingMs} ms</div>

                      <div
                        className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase ${
                          isManual
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                        }`}
                      >
                        {isManual ? 'ручная' : 'план'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase ${
                          isFail
                            ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                        }`}
                      >
                        HTTP {c.statusCode || 'ERR'}
                      </div>

                      <div
                        className={`text-[10px] font-black uppercase ${isFail ? 'text-red-500' : 'text-emerald-500'}`}
                      >
                        {isFail ? 'offline' : 'online'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
