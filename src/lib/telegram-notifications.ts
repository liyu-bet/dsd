import { prisma } from './prisma';
import { decryptSecret, encryptSecret, hasStoredSecret } from './crypto-secrets';
import { decryptHostingSecret } from './hosting-decrypt';
import { infernoGetJson, resolveInfernoApiUrl } from './inferno-api';
import { syncInfernoHostingRemote } from './inferno-sync';

type Settings = {
  enabled: boolean;
  botToken: string | null;
  timezone: string;
  morningSummaryHour: number;
  serverFailThreshold: number;
  siteFailThreshold: number;
  recoverySuccessCount: number;
  domainRenewalDays: number;
  lastMorningSummaryDate: string | null;
};

function normalizedHost(value?: string | null) {
  if (!value) return '';
  return String(value).replace(/^https?:\/\//, '').split('/')[0].trim().toLowerCase();
}

function getRootLikeDomain(host: string) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}

function formatDateRu(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlLink(label: string, url?: string | null) {
  if (!url) return escapeHtml(label);
  return `<a href="${escapeHtml(String(url))}">${escapeHtml(label)}</a>`;
}

function getTodayKey(tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function getHour(tz: string) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Europe/Belgrade',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  );
}

async function refreshBillingBeforeSummary(todayKey: string) {
  const eventKey = `billing-sync:${todayKey}`;
  if (await alreadySent(eventKey)) return;

  const [hostings, servers] = await Promise.all([
    prisma.hostingAccount.findMany({
      select: { id: true, name: true, url: true, apiKey: true },
      orderBy: { name: 'asc' },
    }),
    prisma.server.findMany({
      select: { id: true, ip: true, name: true },
    }),
  ]);

  let synced = 0;
  const errors: Array<{ hosting: string; error: string }> = [];
  for (const h of hostings) {
    if (!hasStoredSecret(h.apiKey)) continue;
    const apiUrl = resolveInfernoApiUrl(h.url);
    if (!apiUrl) continue;
    const apiKey = await decryptHostingSecret(h.apiKey);
    if (!apiKey?.trim()) continue;

    try {
      const [servicesPayload, ordersPayload] = await Promise.all([
        infernoGetJson(apiUrl, apiKey.trim(), 'services'),
        infernoGetJson(apiUrl, apiKey.trim(), 'orders'),
      ]);
      let invoicesPayload: unknown | null = null;
      try {
        invoicesPayload = await infernoGetJson(apiUrl, apiKey.trim(), 'invoices');
      } catch {
        invoicesPayload = null;
      }

      await syncInfernoHostingRemote({
        hostingId: h.id,
        servers,
        apiUrl,
        apiKey: apiKey.trim(),
        servicesPayload,
        ordersPayload,
        invoicesPayload,
      });
      synced += 1;
    } catch (error) {
      errors.push({
        hosting: h.name,
        error: error instanceof Error ? error.message : 'sync_failed',
      });
    }
  }

  await markEvent('billing', eventKey, 'synced', { synced, errors });
}

async function getSettings(): Promise<Settings> {
  const row = await prisma.telegramNotificationSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  return {
    enabled: row.enabled,
    botToken: row.botToken ? await decryptSecret(row.botToken) : null,
    timezone: row.timezone || 'Europe/Belgrade',
    morningSummaryHour: row.morningSummaryHour,
    serverFailThreshold: row.serverFailThreshold,
    siteFailThreshold: Math.max(2, row.siteFailThreshold),
    recoverySuccessCount: row.recoverySuccessCount,
    domainRenewalDays: row.domainRenewalDays,
    lastMorningSummaryDate: row.lastMorningSummaryDate,
  };
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
  const data = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!data?.ok) throw new Error(data?.description || 'Telegram API error');
}

async function alreadySent(eventKey: string) {
  const exists = await prisma.telegramNotificationEvent.findUnique({ where: { eventKey } });
  return !!exists;
}

async function markEvent(eventType: string, eventKey: string, status: string, payload?: unknown) {
  await prisma.telegramNotificationEvent.create({
    data: {
      eventType,
      eventKey,
      payloadJson: payload ? JSON.stringify(payload) : null,
      status,
    },
  }).catch(() => null);
}

export async function saveTelegramSettings(payload: {
  enabled?: boolean;
  botToken?: string;
  timezone?: string;
  morningSummaryHour?: number;
  serverFailThreshold?: number;
  siteFailThreshold?: number;
  recoverySuccessCount?: number;
  domainRenewalDays?: number;
}) {
  const current = await prisma.telegramNotificationSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
  const nextToken =
    typeof payload.botToken === 'string'
      ? await encryptSecret(payload.botToken.trim())
      : current.botToken;
  return prisma.telegramNotificationSetting.update({
    where: { id: 'default' },
    data: {
      enabled: payload.enabled ?? current.enabled,
      botToken: nextToken,
      timezone: payload.timezone || current.timezone,
      morningSummaryHour:
        Number.isFinite(payload.morningSummaryHour) ? Math.max(0, Math.min(23, Number(payload.morningSummaryHour))) : current.morningSummaryHour,
      serverFailThreshold:
        Number.isFinite(payload.serverFailThreshold) ? Math.max(1, Number(payload.serverFailThreshold)) : current.serverFailThreshold,
      siteFailThreshold:
        Number.isFinite(payload.siteFailThreshold) ? Math.max(2, Number(payload.siteFailThreshold)) : current.siteFailThreshold,
      recoverySuccessCount:
        Number.isFinite(payload.recoverySuccessCount) ? Math.max(1, Number(payload.recoverySuccessCount)) : current.recoverySuccessCount,
      domainRenewalDays:
        Number.isFinite(payload.domainRenewalDays) ? Math.max(1, Number(payload.domainRenewalDays)) : current.domainRenewalDays,
    },
  });
}

export async function getTelegramSettingsForUi() {
  const row = await prisma.telegramNotificationSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
  return {
    enabled: row.enabled,
    timezone: row.timezone,
    morningSummaryHour: row.morningSummaryHour,
    serverFailThreshold: row.serverFailThreshold,
    siteFailThreshold: Math.max(2, row.siteFailThreshold),
    recoverySuccessCount: row.recoverySuccessCount,
    domainRenewalDays: row.domainRenewalDays,
    hasBotToken: hasStoredSecret(row.botToken),
  };
}

export async function sendTelegramEvent(params: {
  eventType: 'down' | 'up' | 'domain' | 'billing' | 'summary';
  eventKey: string;
  text: string;
}) {
  const settings = await getSettings();
  if (!settings.enabled || !settings.botToken) {
    await markEvent(params.eventType, params.eventKey, 'skipped', { reason: 'disabled_or_no_token' });
    return { sent: 0, skipped: true };
  }
  if (await alreadySent(params.eventKey)) return { sent: 0, skipped: true };

  const recipients = await prisma.telegramNotificationRecipient.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const filtered = recipients.filter((r) => {
    if (params.eventType === 'down') return r.notifyDown;
    if (params.eventType === 'up') return r.notifyUp;
    if (params.eventType === 'domain') return r.notifyDomain;
    if (params.eventType === 'billing') return r.notifyBilling;
    return r.notifySummary;
  });
  if (filtered.length === 0) {
    await markEvent(params.eventType, params.eventKey, 'skipped', { reason: 'no_recipients_for_event_type' });
    return { sent: 0, skipped: true };
  }
  let sent = 0;
  const errors: string[] = [];
  for (const recipient of filtered) {
    try {
      await sendTelegramMessage(settings.botToken, recipient.chatId, params.text);
      sent += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'send_failed');
    }
  }
  const status = sent > 0 ? 'sent' : 'failed';
  await markEvent(params.eventType, params.eventKey, status, { recipients: sent, errors });
  return { sent, skipped: false };
}

function humanDurationFromChecks(checks: { status: string; createdAt: Date }[], targetStatus: 'offline' | 'online') {
  const last = checks.find((c) => c.status === targetStatus);
  if (!last) return '';
  const diff = Math.max(0, Date.now() - new Date(last.createdAt).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return '< 1 мин';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} ч ${m} мин`;
}

function countConsecutive<T>(items: T[], predicate: (x: T) => boolean) {
  let count = 0;
  for (const item of items) {
    if (!predicate(item)) break;
    count += 1;
  }
  return count;
}

function getDaysUntil(value?: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}

export async function processNotificationCycle() {
  const settings = await getSettings();
  if (!settings.enabled || !settings.botToken) return { ok: true, skipped: true };

  const todayKey = getTodayKey(settings.timezone);
  const hour = getHour(settings.timezone);
  if (hour === settings.morningSummaryHour) {
    await refreshBillingBeforeSummary(todayKey).catch(() => null);
  }

  const [servers, sites, hostings] = await Promise.all([
    prisma.server.findMany({
      include: { checks: { orderBy: { createdAt: 'desc' }, take: 8 } },
    }),
    prisma.site.findMany({
      include: {
        checks: { orderBy: { createdAt: 'desc' }, take: 8 },
        registrarAccount: true,
      },
    }),
    prisma.hostingAccount.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const allHosts = new Set(sites.map((s) => normalizedHost(s.url)).filter(Boolean));
  const shouldSkipRenewalAsManagedSubdomain = (site: { url: string }) => {
    const host = normalizedHost(site.url);
    if (!host) return false;
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return false;
    const root = getRootLikeDomain(host);
    if (!root || root === host) return false;
    return allHosts.has(root) || allHosts.has(`www.${root}`);
  };

  const activeSites = sites.filter((s) => !s.telegramMuted);
  const renewalSites = activeSites.filter((s) => !shouldSkipRenewalAsManagedSubdomain({ url: s.url }));

  for (const s of servers) {
    const off = countConsecutive(s.checks, (c) => c.status === 'offline');
    const on = countConsecutive(s.checks, (c) => c.status === 'online');
    if (off === settings.serverFailThreshold) {
      await sendTelegramEvent({
        eventType: 'down',
        eventKey: `server-down:${s.id}:${s.checks[0]?.id || 'n/a'}`,
        text:
          `🔴 Проблема с сервером\n` +
          `• Сервер: ${s.name} (${s.ip})\n` +
          `• Статус: недоступен (${off} проверок подряд)\n` +
          `• Зафиксировано: ${formatDateRu(new Date())}\n` +
          `• Проверь: сеть/хостинг, агент, firewall`,
      });
    }
    const serverRecoveredAfterOffline =
      on === settings.recoverySuccessCount &&
      on > 0 &&
      s.checks.length > on &&
      s.checks[on]?.status === 'offline';
    if (serverRecoveredAfterOffline) {
      await sendTelegramEvent({
        eventType: 'up',
        eventKey: `server-up:${s.id}:${s.checks[0]?.id || 'n/a'}`,
        text:
          `🟢 Сервер восстановился\n` +
          `• Сервер: ${s.name} (${s.ip})\n` +
          `• Online подряд: ${on}\n` +
          `• Простой (оценка): ${humanDurationFromChecks(s.checks, 'offline')}\n` +
          `• Время: ${formatDateRu(new Date())}`,
      });
    }
  }

  for (const site of activeSites) {
    const off = countConsecutive(site.checks, (c) => c.status === 'offline');
    const on = countConsecutive(site.checks, (c) => c.status === 'online');
    if (off === settings.siteFailThreshold) {
      await sendTelegramEvent({
        eventType: 'down',
        eventKey: `site-down:${site.id}:${site.checks[0]?.id || 'n/a'}`,
        text:
          `🔴 Сайт недоступен\n` +
          `• Сайт: ${site.url}\n` +
          `• Offline подряд: ${off}\n` +
          `• Последняя проверка: ${formatDateRu(site.checks[0]?.createdAt || new Date())}\n` +
          `• Время уведомления: ${formatDateRu(new Date())}`,
      });
    }
    const siteRecoveredAfterOffline =
      on === settings.recoverySuccessCount &&
      on > 0 &&
      site.checks.length > on &&
      site.checks[on]?.status === 'offline';
    if (siteRecoveredAfterOffline) {
      await sendTelegramEvent({
        eventType: 'up',
        eventKey: `site-up:${site.id}:${site.checks[0]?.id || 'n/a'}`,
        text:
          `🟢 Сайт снова доступен\n` +
          `• Сайт: ${site.url}\n` +
          `• Online подряд: ${on}\n` +
          `• Время: ${formatDateRu(new Date())}`,
      });
    }

    if (shouldSkipRenewalAsManagedSubdomain({ url: site.url })) continue;
    const days = getDaysUntil(site.domainExpiresAt);
    if (days !== null && days >= 0 && days <= settings.domainRenewalDays) {
      await sendTelegramEvent({
        eventType: 'domain',
        eventKey: `domain:${site.id}:d${days}`,
        text:
          `🟠 Продление домена\n` +
          `Домен: ${escapeHtml(site.url)}\n` +
          `• Осталось: ${days} дн.\n` +
          `• Дата: ${formatDateRu(site.domainExpiresAt)}\n` +
          `• Регистратор: ${htmlLink(site.registrarAccount?.name || 'не указан', site.registrarAccount?.url)}`,
      });
    }
  }

  for (const h of hostings) {
    const cnt = Number(h.billingUnpaid14dCount || 0);
    if (cnt > 0) {
      await sendTelegramEvent({
        eventType: 'billing',
        eventKey: `billing:${h.id}:${cnt}:${h.billingUnpaid14dTotal || '0'}`,
        text: (() => {
          const dueDate = h.billingUnpaid14dNearestDueAt ? new Date(h.billingUnpaid14dNearestDueAt) : null;
          const dueDays = dueDate ? getDaysUntil(dueDate) : null;
          return (
            `🔴 Неоплаченные счета\n` +
            `• Биллинг: ${htmlLink(h.name, h.url)}\n` +
            `• Счетов: ${cnt}\n` +
            `• Сумма: ${escapeHtml(String(h.billingUnpaid14dTotal || '0.00'))}\n` +
            `• Дедлайн оплаты: ${formatDateRu(dueDate)}${dueDays !== null ? ` (${dueDays} дн.)` : ''}`
          );
        })(),
      });
    }
  }

  if (hour === settings.morningSummaryHour && settings.lastMorningSummaryDate !== todayKey) {
    const onlineServers = servers.filter((x) => x.status === 'online').length;
    const offlineServers = servers.filter((x) => x.status === 'offline').length;
    const onlineSites = activeSites.filter((x) => x.status === 'online').length;
    const offlineSites = activeSites.filter((x) => x.status === 'offline').length;
    const exp14 = renewalSites.filter((x) => {
      const d = getDaysUntil(x.domainExpiresAt);
      return d !== null && d >= 0 && d <= settings.domainRenewalDays;
    }).length;
    const unpaidCount = hostings.reduce((acc, h) => acc + Number(h.billingUnpaid14dCount || 0), 0);
    const unpaidTotal = hostings
      .reduce((acc, h) => acc + (parseFloat(String(h.billingUnpaid14dTotal || '0').replace(',', '.')) || 0), 0)
      .toFixed(2);
    const billingLinks = hostings
      .filter((h) => Number(h.billingUnpaid14dCount || 0) > 0)
      .map((h) => htmlLink(h.name, h.url))
      .join(', ');

    await sendTelegramEvent({
      eventType: 'summary',
      eventKey: `summary:${todayKey}`,
      text:
        `☀️ Утренний саммари\n` +
        `• Серверы: online ${onlineServers}, offline ${offlineServers}\n` +
        `• Сайты: online ${onlineSites}, offline ${offlineSites}\n` +
        `• Домены для оплаты: ${exp14}\n` +
        `• Неоплаченные сервера: ${unpaidCount} на сумму ${unpaidTotal}\n` +
        `• Биллинги: ${billingLinks || 'нет'}`,
    });

    await prisma.telegramNotificationSetting.update({
      where: { id: 'default' },
      data: { lastMorningSummaryDate: todayKey },
    });
  }

  return { ok: true, skipped: false };
}
