import { prisma } from '@/lib/prisma';
import {
  normalizeInfernoList,
  extractServiceId,
  extractPrimaryIp,
  extractHostname,
  extractRenewalDate,
  collectUnpaidServiceIds,
  infernoPostJson,
  collectPendingOrderMeta,
  collectPendingAmounts,
  parseGetinfoResponse,
  billingUnpaidFromInfernoOrders,
} from '@/lib/inferno-api';

function normIp(s: string): string {
  return s.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export type InfernoServerRow = { id: string; ip: string; name: string };

/**
 * Сопоставление услуг Inferno с серверами и обновление полей биллинга.
 * Док.: services + getService; заказы — collectUnpaidServiceIds.
 * @param fetchGetService — дозапрос getService по serviceid.
 */
export async function syncInfernoFromPayloads(
  hostingId: string,
  servers: InfernoServerRow[],
  servicesPayload: unknown,
  ordersPayload: unknown,
  fetchGetService?: (serviceId: string) => Promise<unknown>,
  invoicesPayload?: unknown | null,
): Promise<{ matched: number; checked: number }> {
  const serviceRows = normalizeInfernoList(servicesPayload);
  const orderLikeRows = [
    ...normalizeInfernoList(ordersPayload),
    ...normalizeInfernoList(invoicesPayload ?? null),
  ];
  const unpaidServiceIds = collectUnpaidServiceIds(orderLikeRows);
  const pendingMeta = collectPendingOrderMeta(ordersPayload, invoicesPayload);
  const pendingAmounts = collectPendingAmounts(ordersPayload, invoicesPayload);

  let matched = 0;
  let checked = 0;

  for (const row of serviceRows) {
    checked += 1;
    const sid = extractServiceId(row);
    if (!sid) continue;

    let ip = extractPrimaryIp(row);
    let renewal = extractRenewalDate(row);
    const hostHint = extractHostname(row);

    if ((!ip || !renewal) && sid && fetchGetService) {
      try {
        const detail = await fetchGetService(sid);
        const detailObj =
          detail && typeof detail === 'object' && !Array.isArray(detail)
            ? (detail as Record<string, unknown>)
            : null;
        const inner = detailObj?.service ?? detailObj?.data ?? detail;
        ip = ip || extractPrimaryIp(inner);
        renewal = renewal || extractRenewalDate(inner);
      } catch {
        /* optional */
      }
    }

    if (!ip) continue;

    const nip = normIp(ip);
    const hostLower = (hostHint || '').toLowerCase();
    const server = servers.find((s) => {
      if (normIp(s.ip) === nip) return true;
      if (hostLower && String(s.name || '').trim().toLowerCase() === hostLower) return true;
      return false;
    });

    if (!server) continue;

    const unpaid =
      unpaidServiceIds.has(sid) ||
      billingUnpaidFromInfernoOrders(pendingMeta, {
        serviceId: sid,
        serviceIds: [sid],
        serverIp: server.ip,
      });

    // Compute approximate unpaid amount for this service/ip
    let amt = 0;
    const byService = pendingAmounts.byServiceId || {};
    const byIp = pendingAmounts.byIp || {};
    if (byService[sid]) amt += Number(byService[sid]) || 0;
    const nip = normIp(ip);
    if (byIp[nip]) amt += Number(byIp[nip]) || 0;

    await prisma.server.update({
      where: { id: server.id },
      data: {
        hostingAccountId: hostingId,
        billingServiceId: sid,
        billingRenewalAt: renewal,
        billingHasUnpaidOrder: unpaid,
        billingUnpaidCount: unpaid ? 1 : 0,
        billingUnpaidAmount: Math.round((amt + Number.EPSILON) * 100) / 100,
      },
    });
    matched += 1;
  }

  return { matched, checked };
}

/**
 * Синхронизация по официальному сценарию: POST getinfo с orderid=0 и ip (док. v1.4).
 * Для серверов без ответа — fallback: разбор списка services + getService.
 */
export async function syncInfernoHostingRemote(params: {
  hostingId: string;
  servers: InfernoServerRow[];
  apiUrl: string;
  apiKey: string;
  servicesPayload: unknown;
  ordersPayload: unknown;
  invoicesPayload?: unknown | null;
}): Promise<{ matched: number; checked: number }> {
  const meta = collectPendingOrderMeta(params.ordersPayload, params.invoicesPayload);
  const matchedIds = new Set<string>();
  let matched = 0;
  let checked = 0;

  for (const server of params.servers) {
    checked += 1;
    try {
      const info = await infernoPostJson(params.apiUrl, params.apiKey, 'getinfo', {
        orderid: 0,
        ip: server.ip.trim(),
      });
      const parsed = parseGetinfoResponse(info);
      if (!parsed) continue;
      if (parsed.dedicatedIp && normIp(parsed.dedicatedIp) !== normIp(server.ip)) {
        continue;
      }
      const extId =
        parsed.orderId && parsed.orderId !== '0'
          ? parsed.orderId
          : parsed.serviceId && parsed.serviceId !== '0'
            ? parsed.serviceId
            : parsed.billingServiceIds[0] || null;
      const unpaid = billingUnpaidFromInfernoOrders(meta, {
        orderId: parsed.orderId,
        serviceId: parsed.serviceId,
        serviceIds: parsed.billingServiceIds.length > 0 ? parsed.billingServiceIds : null,
        serverIp: server.ip,
      });

      // compute unpaid amount for any of parsed.billingServiceIds or ip/order
      const pendingAmounts = collectPendingAmounts(params.ordersPayload, params.invoicesPayload);
      let amt = 0;
      const byService = pendingAmounts.byServiceId || {};
      const byIp = pendingAmounts.byIp || {};
      const byOrder = pendingAmounts.byOrderId || {};
      for (const id of parsed.billingServiceIds || []) {
        if (id && byService[id]) amt += Number(byService[id]) || 0;
      }
      const nip = parsed.dedicatedIp ? normIp(parsed.dedicatedIp) : normIp(server.ip);
      if (byIp[nip]) amt += Number(byIp[nip]) || 0;
      if (parsed.orderId && byOrder[parsed.orderId]) amt += Number(byOrder[parsed.orderId]) || 0;

      await prisma.server.update({
        where: { id: server.id },
        data: {
          hostingAccountId: params.hostingId,
          billingServiceId: extId,
          billingRenewalAt: parsed.renewal,
          billingHasUnpaidOrder: unpaid,
          billingUnpaidCount: unpaid ? 1 : 0,
          billingUnpaidAmount: Math.round((amt + Number.EPSILON) * 100) / 100,
        },
      });
      matched += 1;
      matchedIds.add(server.id);
    } catch {
      /* VPS не у этого аккаунта / сеть */
    }
  }

  const remaining = params.servers.filter((s) => !matchedIds.has(s.id));
  if (remaining.length === 0) {
    return { matched, checked };
  }

  const fetchGetService = (sid: string) =>
    infernoPostJson(params.apiUrl, params.apiKey, 'getService', {
      serviceid: /^\d+$/.test(sid) ? Number(sid) : sid,
    });

  const fb = await syncInfernoFromPayloads(
    params.hostingId,
    remaining,
    params.servicesPayload,
    params.ordersPayload,
    fetchGetService,
    params.invoicesPayload,
  );

  return { matched: matched + fb.matched, checked: checked + fb.checked };
}
