import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptHostingSecret } from '@/lib/hosting-decrypt';
import { hasStoredSecret } from '@/lib/crypto-secrets';
import { resolveInfernoApiUrl, infernoGetJson } from '@/lib/inferno-api';
import { syncInfernoFromPayloads, syncInfernoHostingRemote } from '@/lib/inferno-sync';

export const dynamic = 'force-dynamic';

async function resolvePublicEgressIp(): Promise<string | null> {
  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/all.json',
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null) as { ip?: string } | null;
      const ip = String(data?.ip || '').trim();
      if (ip) return ip;
    } catch {
      // ignore and fallback to next endpoint
    }
  }
  return null;
}

function shouldSuggestWhitelist(message: string): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('cloudflare') ||
    text.includes('whitelist') ||
    text.includes('http 403') ||
    text.includes('http 401') ||
    text.includes('forbidden') ||
    text.includes('access denied')
  );
}

function enrichWhitelistError(message: string, egressIp: string | null): string {
  if (!shouldSuggestWhitelist(message)) return message;
  const ipNote = egressIp ? ` Текущий исходящий IP приложения: ${egressIp}.` : '';
  return `${message}${ipNote} Проверьте, что этот IP добавлен в Inferno Security → API Keys → IP Whitelist.`;
}

function parseJsonBodyField(value: unknown, label: string): unknown {
  if (value === undefined || value === null) {
    throw new Error(`Поле «${label}» пустое`);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) throw new Error(`Поле «${label}» пустое`);
    try {
      return JSON.parse(t) as unknown;
    } catch {
      throw new Error(`Поле «${label}» — невалидный JSON`);
    }
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
    const mode = body.mode === 'import' || body.mode === 'probe' ? body.mode : 'server';
    let cachedEgressIp: string | null | undefined;
    const getEgressIp = async () => {
      if (cachedEgressIp !== undefined) return cachedEgressIp;
      cachedEgressIp = await resolvePublicEgressIp();
      return cachedEgressIp;
    };

    const servers = await prisma.server.findMany({
      select: { id: true, ip: true, name: true },
    });

    if (mode === 'import') {
      if (!accountId) {
        return NextResponse.json({ error: 'Для импорта укажите accountId (биллинг)' }, { status: 400 });
      }
      const hosting = await prisma.hostingAccount.findUnique({
        where: { id: accountId },
        select: { id: true, name: true },
      });
      if (!hosting) {
        return NextResponse.json({ error: 'Биллинг не найден' }, { status: 404 });
      }
      try {
        const servicesPayload = parseJsonBodyField(body.services, 'services');
        const ordersPayload = parseJsonBodyField(body.orders, 'orders');
        let invoicesPayload: unknown | null = null;
        if (body.invoices !== undefined && body.invoices !== null) {
          if (typeof body.invoices === 'string' && !body.invoices.trim()) {
            invoicesPayload = null;
          } else {
            invoicesPayload = parseJsonBodyField(body.invoices, 'invoices');
          }
        }
        const { matched, checked } = await syncInfernoFromPayloads(
          hosting.id,
          servers,
          servicesPayload,
          ordersPayload,
          undefined,
          invoicesPayload,
        );
        return NextResponse.json({
          results: [
            {
              hostingId: hosting.id,
              name: hosting.name,
              ok: true,
              matched,
              checked,
              source: 'import',
            },
          ],
        });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Ошибка импорта' },
          { status: 400 }
        );
      }
    }

    const hostings = await prisma.hostingAccount.findMany({
      where: accountId ? { id: accountId } : {},
      select: { id: true, name: true, url: true, apiKey: true },
    });

    const results: {
      hostingId: string;
      name: string;
      ok: boolean;
      error?: string;
      note?: string;
      matched?: number;
      checked?: number;
      source?: string;
      apiUrl?: string | null;
    }[] = [];

    for (const h of hostings) {
      if (!hasStoredSecret(h.apiKey)) {
        results.push({ hostingId: h.id, name: h.name, ok: false, error: 'Нет API-ключа' });
        continue;
      }
      const apiUrl = resolveInfernoApiUrl(h.url);
      if (!apiUrl) {
        results.push({ hostingId: h.id, name: h.name, ok: false, error: 'Нет URL биллинга (нужен для api_client.php)' });
        continue;
      }

      const apiKey = await decryptHostingSecret(h.apiKey);
      if (!apiKey?.trim()) {
        results.push({ hostingId: h.id, name: h.name, ok: false, error: 'Не удалось расшифровать API-ключ' });
        continue;
      }

      const key = apiKey.trim();

      try {
        if (mode === 'probe') {
          await infernoGetJson(apiUrl, key, 'services');
          const egressIp = await getEgressIp();
          results.push({
            hostingId: h.id,
            name: h.name,
            ok: true,
            source: 'probe',
            apiUrl,
            checked: 1,
            matched: 1,
            note: egressIp ? `OK. Исходящий IP: ${egressIp}` : 'OK',
          });
          continue;
        }

        const [servicesPayload, ordersPayload] = await Promise.all([
          infernoGetJson(apiUrl, key, 'services'),
          infernoGetJson(apiUrl, key, 'orders'),
        ]);

        let invoicesPayload: unknown | null = null;
        try {
          invoicesPayload = await infernoGetJson(apiUrl, key, 'invoices');
        } catch {
          /* не все биллинги WHMCS/Inferno отдают action=invoices; хватает orders */
        }

        const { matched, checked } = await syncInfernoHostingRemote({
          hostingId: h.id,
          servers,
          apiUrl,
          apiKey: key,
          servicesPayload,
          ordersPayload,
          invoicesPayload,
        });

        results.push({ hostingId: h.id, name: h.name, ok: true, matched, checked, source: 'remote' });
      } catch (e) {
        const rawError = e instanceof Error ? e.message : 'Ошибка запроса к API';
        const egressIp = shouldSuggestWhitelist(rawError) ? await getEgressIp() : null;
        const enrichedError = enrichWhitelistError(rawError, egressIp);
        results.push({
          hostingId: h.id,
          name: h.name,
          ok: false,
          error: enrichedError,
          apiUrl,
        });
      }
    }

    if (mode === 'probe') {
      return NextResponse.json({ results, egressIp: await getEgressIp() });
    }
    return NextResponse.json({ results });
  } catch (error) {
    console.error('sync-inferno failed', error);
    return NextResponse.json({ error: 'Синхронизация не удалась' }, { status: 500 });
  }
}
