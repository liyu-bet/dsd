/**
 * Inferno VPS API (api_client.php, X-Key). Официально: KB «API документация — VPS» v1.4 (22.04.2026).
 * Аутентификация: только заголовок X-Key (Client ID в ключе). Рекомендуется IP whitelist для ключа.
 *
 * Счета: в KB v1.4 нет отдельного раздела про action=invoices; у WHMCS/Inferno часто есть список счетов
 * с позициями (items[].relid → услуга). Синхронизация запрашивает invoices при наличии метода и
 * сопоставляет неоплаченные строки с VPS по orderid, IP, serviceid и вложенным relid.
 */

export function resolveInfernoApiUrl(panelUrl: string | null | undefined): string | null {
  const raw = String(panelUrl || '').trim();
  if (!raw) return null;
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(href);
    if (u.pathname.includes('api_client.php')) {
      return `${u.origin}${u.pathname.split('?')[0]}`;
    }
    return `${u.origin}/api_client.php`;
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function normalizeInfernoList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const r = asRecord(payload);
  if (!r) return [];
  const candidates = [
    'services',
    'data',
    'items',
    'list',
    'orders',
    'invoices',
    'result',
  ];
  for (const k of candidates) {
    const v = r[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const asMap = v as Record<string, unknown>;
      const values = Object.values(asMap);
      if (values.length && values.every((x) => x && typeof x === 'object')) {
        return values;
      }
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = asRecord(v);
      if (inner) {
        for (const kk of ['service', 'item', 'order']) {
          const arr = inner[kk];
          if (Array.isArray(arr)) return arr;
          if (arr && typeof arr === 'object') return [arr];
        }
      }
    }
  }
  return [];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function extractServiceId(item: unknown): string | null {
  const r = asRecord(item);
  if (!r) return null;
  return pickString(r, ['serviceid', 'service_id', 'id', 'sid', 'vpsid', 'vps_id']);
}

export function extractPrimaryIp(item: unknown): string | null {
  const r = asRecord(item);
  if (!r) return null;
  const direct = pickString(r, [
    'ip',
    'main_ip',
    'mainip',
    'address',
    'serverip',
    'server_ip',
    'vpsip',
    'vps_ip',
    'dedicatedip',
    'dedicated_ip',
    'primaryip',
    'primary_ip',
  ]);
  if (direct) return normalizeIpToken(direct);

  const nestedKeys = ['server', 'vps', 'details', 'params', 'data', 'service'];
  for (const nk of nestedKeys) {
    const nested = asRecord(r[nk]);
    if (nested) {
      const ip = pickString(nested, ['ip', 'main_ip', 'address', 'hostname']);
      if (ip && looksLikeIp(ip)) return normalizeIpToken(ip);
    }
  }
  return null;
}

function looksLikeIp(s: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return true;
  if (s.includes(':')) return true;
  return false;
}

function normalizeIpToken(s: string): string {
  return s.trim().replace(/^\[|\]$/g, '');
}

export function extractHostname(item: unknown): string | null {
  const r = asRecord(item);
  if (!r) return null;
  const h = pickString(r, ['hostname', 'host', 'label', 'name', 'domain']);
  if (!h) return null;
  const host = h.split(/\s+/)[0]?.split(':')[0]?.toLowerCase() || null;
  return host || null;
}

export function extractRenewalDate(item: unknown): Date | null {
  const r = asRecord(item);
  if (!r) return null;
  const raw = pickString(r, [
    'nextduedate',
    'next_due_date',
    'nextinvoice',
    'paiduntil',
    'paid_until',
    'expire',
    'expires',
    'expirydate',
    'expiry_date',
    'regdate',
    'billingnextduedate',
  ]);
  if (!raw || !DATE_RE.test(raw)) return null;
  const d = new Date(raw.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Дней до даты (UTC 00:00), отриц. — просрочка. */
export function daysUntilFromDate(value: Date | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function daysUntilFromIsoString(raw: string | null | undefined): number | null {
  if (!raw || !DATE_RE.test(raw)) return null;
  const d = new Date(raw.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  return daysUntilFromDate(d);
}

/** Список заказов из action=orders (корень или поле `orders` как object map, см. Inferno). */
export function listInfernoOrderRows(payload: unknown): Record<string, unknown>[] {
  const r = asRecord(payload);
  if (r && r.orders && typeof r.orders === 'object' && !Array.isArray(r.orders)) {
    return Object.values(r.orders)
      .map((x) => asRecord(x))
      .filter((x): x is Record<string, unknown> => x !== null);
  }
  const list = normalizeInfernoList(payload);
  const out: Record<string, unknown>[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Неоплаченные в окне nextduedate ≤ 14 дней: уник. счета (invoiceid) и order id для сопоставления с getinfo.
 */
export function aggregateInferno14dUnpaidFromOrders(ordersPayload: unknown): {
  uniqueInvoiceCount: number;
  totalAmount: string;
  unpaid14dOrderIds: Set<string>;
  nearestDueAt: Date | null;
} {
  const rows = listInfernoOrderRows(ordersPayload);
  const byInvoice = new Map<string, number>();
  const unpaid14dOrderIds = new Set<string>();
  let nearestDueAt: Date | null = null;

  for (const r of rows) {
    if (!isInfernoUnpaidOrderRow(r)) continue;
    const next = pickString(r, ['nextduedate', 'next_due_date']);
    const days = daysUntilFromIsoString(next);
    if (days === null || days > 14) continue;
    if (next) {
      const dueDate = new Date(next);
      if (!Number.isNaN(dueDate.getTime()) && (!nearestDueAt || dueDate.getTime() < nearestDueAt.getTime())) {
        nearestDueAt = dueDate;
      }
    }

    const orderId = pickString(r, ['id', 'orderid', 'order_id']);
    if (orderId) unpaid14dOrderIds.add(String(orderId).trim());

    const invId = pickString(r, ['invoiceid', 'invoice_id']);
    const amountRaw = pickString(r, ['amount', 'total', 'subtotal']);
    const parsed = amountRaw ? parseFloat(String(amountRaw).replace(/\s/g, '').replace(',', '.')) : 0;
    const amount = Number.isFinite(parsed) ? parsed : 0;
    const key = invId || (orderId ? `order:${orderId}` : '');
    if (!key) continue;
    if (!byInvoice.has(key)) {
      byInvoice.set(key, amount);
    }
  }

  const total = [...byInvoice.values()].reduce((a, b) => a + b, 0);
  return {
    uniqueInvoiceCount: byInvoice.size,
    totalAmount: total.toFixed(2),
    unpaid14dOrderIds,
    nearestDueAt,
  };
}

/**
 * Красный индикатор у сервера: заказ в сводке 14д + дата продления (getinfo) в окне 14 дн.
 */
export function infernoServerHasUnpaidBillIn14d(
  parsed: NonNullable<ReturnType<typeof parseGetinfoResponse>>,
  agg: ReturnType<typeof aggregateInferno14dUnpaidFromOrders>
): boolean {
  const d = daysUntilFromDate(parsed.renewal);
  if (d === null || d > 14) return false;
  const oid = String(parsed.orderId || '').trim();
  if (oid && agg.unpaid14dOrderIds.has(oid)) return true;
  return false;
}

/** Считает неоплачено / ожидает оплаты: заказ Pending, счёт Unpaid, paid=0, и т.п. (поля панели различаются). */
function isInfernoUnpaidOrderRow(r: Record<string, unknown>): boolean {
  if (r.unpaid === true || r.isUnpaid === true || r.isunpaid === true) return true;
  const u = r.unpaid;
  if (typeof u === 'number' && u === 1) return true;

  const paySt = String(pickString(r, ['payStatus', 'paystatus']) || '').toLowerCase();
  if (Array.isArray(r.unpaidInvoices)) {
    for (const x of r.unpaidInvoices) {
      const o = asRecord(x);
      if (o && String(pickString(o, ['status']) || '').toLowerCase() === 'unpaid') return true;
    }
  }
  if (paySt === 'unpaid' || paySt === 'partial' || paySt === 'overdue' || paySt === 'due') return true;
  if (paySt === 'paid' || paySt === 'complete' || paySt === 'completed' || paySt === 'fulfilled' || paySt === 'cancelled') {
    return false;
  }

  const paidField = r.paid;
  const explicitlyUnpaid =
    paidField === false ||
    paidField === 0 ||
    paidField === '0' ||
    paidField === 'no' ||
    String(paidField).toLowerCase() === 'n';

  const status = String(pickString(r, ['status', 'orderstatus', 'orderStatus', 'paymentstatus', 'state', 'stat']) || '').toLowerCase();
  const invStatus = String(
    pickString(r, [
      'invoicestatus',
      'invoice_status',
      'invstatus',
      'paymentstate',
      'payStatus',
      'paystatus',
    ]) || ''
  ).toLowerCase();

  const statusUnpaid =
    !!status &&
    (status.includes('pending') ||
      status.includes('unpaid') ||
      status.includes('wait') ||
      status.includes('await') ||
      status.includes('overdue') ||
      status.includes('ожид') ||
      status.includes('не опла') ||
      status.includes('сч') ||
      status === '0' ||
      status === 'n');

  const invUnpaid =
    !!invStatus &&
    (invStatus.includes('unpaid') ||
      invStatus.includes('pending') ||
      invStatus.includes('due') ||
      invStatus.includes('open') ||
      invStatus.includes('overdue') ||
      invStatus.includes('partial') ||
      invStatus.includes('не опла') ||
      invStatus.includes('ожид') ||
      invStatus === '0');

  // Счета (invoices) — invoiceid / invoicenum, статус в другом наборе полей
  const hasInvoiceRef =
    (r.invoicenum != null && String(r.invoicenum).trim() !== '') ||
    (r.invoiceid != null && String(r.invoiceid).trim() !== '');
  if (hasInvoiceRef) {
    const st = (pickString(r, ['status', 'invoicestatus', 'statustext', 'invoicestatustext']) || '').toLowerCase();
    if (st) {
      const isPaid = st.includes('paid') || st.includes('оплач') || st.includes('cancelled') || st.includes('отмен');
      if (!isPaid && (st.includes('unpaid') || st.includes('due') || st.includes('open') || st.includes('overdue') || st.includes('не опла') || st.includes('outstanding') || st.includes('ожид'))) {
        return true;
      }
    }
  }

  return explicitlyUnpaid || statusUnpaid || invUnpaid;
}

/** ID услуг из заказа/счёта и вложенных позиций (WHMCS: invoices[].items[].relid). */
function extractRelatedIdsFromOrderLikeRow(r: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const visit = (obj: unknown, depth: number) => {
    if (depth > 10) return;
    const rec = asRecord(obj);
    if (!rec) return;
    const sid = pickString(rec, [
      'serviceid',
      'service_id',
      'vpsid',
      'vps_id',
      'relid',
      'related_id',
      'hostingid',
      'hosting_id',
    ]);
    if (sid) out.add(sid);
    const products = pickString(rec, ['productids', 'product_ids', 'productIds']);
    if (products) {
      for (const p of products.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)) {
        out.add(p);
      }
    }
    const nestKeys = ['items', 'invoiceitems', 'lineitems', 'lines', 'item', 'products', 'services', 'result', 'data', 'invoice', 'hosting'];
    for (const nk of nestKeys) {
      const v = rec[nk];
      if (Array.isArray(v)) {
        for (const el of v) visit(el, depth + 1);
      } else if (v && typeof v === 'object') {
        visit(v, depth + 1);
      }
    }
  };
  visit(r, 0);
  return [...out];
}

export function collectUnpaidServiceIds(orders: unknown): Set<string> {
  const list = Array.isArray(orders) ? orders : normalizeInfernoList(orders);
  const pending = new Set<string>();
  for (const ord of list) {
    const r = asRecord(ord);
    if (!r) continue;
    if (!isInfernoUnpaidOrderRow(r)) continue;

    const sid = pickString(r, ['serviceid', 'service_id', 'vpsid', 'vps_id', 'relid', 'related_id']);
    if (sid) pending.add(sid);
    const products = pickString(r, ['productids', 'product_ids', 'productIds']);
    if (products) {
      for (const p of products.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)) {
        pending.add(p);
      }
    }
    for (const id of extractRelatedIdsFromOrderLikeRow(r)) {
      pending.add(id);
    }
  }
  return pending;
}

/** Ответ Inferno с полем result: success */
export function infernoPayloadSuccess(payload: unknown): boolean {
  const r = asRecord(payload);
  if (!r) return false;
  return String(r.result || '').toLowerCase() === 'success';
}

/** Неоплаченные заказы/счета: orderid, IP, productids, relid (счёт→услуга). */
export function collectPendingOrderMeta(ordersPayload: unknown, invoicesPayload?: unknown | null): {
  pendingOrderIds: Set<string>;
  pendingIps: Set<string>;
  pendingServiceIds: Set<string>;
} {
  const pendingOrderIds = new Set<string>();
  const pendingIps = new Set<string>();
  const pendingServiceIds = new Set<string>();
  const rows = [
    ...normalizeInfernoList(ordersPayload),
    ...normalizeInfernoList(invoicesPayload ?? null),
  ];
  for (const ord of rows) {
    const r = asRecord(ord);
    if (!r) continue;
    if (!isInfernoUnpaidOrderRow(r)) continue;

    const oid = pickString(r, ['orderid', 'order_id']);
    if (oid) pendingOrderIds.add(oid);
    const ip = pickString(r, ['dedicatedip', 'ip', 'address']);
    if (ip) pendingIps.add(normalizeIpToken(ip).toLowerCase());
    const products = pickString(r, ['productids', 'product_ids', 'productIds']);
    if (products) {
      for (const p of products.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)) {
        pendingServiceIds.add(p);
      }
    }
    const sid = pickString(r, ['serviceid', 'service_id', 'vpsid', 'vps_id', 'relid', 'related_id']);
    if (sid) pendingServiceIds.add(sid);
    for (const id of extractRelatedIdsFromOrderLikeRow(r)) {
      pendingServiceIds.add(id);
    }
  }
  return { pendingOrderIds, pendingIps, pendingServiceIds };
}

export function billingUnpaidFromInfernoOrders(
  meta: ReturnType<typeof collectPendingOrderMeta>,
  ctx: { orderId?: string | null; serviceId?: string | null; serviceIds?: string[] | null; serverIp: string }
): boolean {
  const nip = normalizeIpToken(ctx.serverIp).toLowerCase();
  const oid = ctx.orderId ? String(ctx.orderId).trim() : '';
  if (oid && oid !== '0' && meta.pendingOrderIds.has(oid)) return true;
  if (nip && meta.pendingIps.has(nip)) return true;
  const fromList =
    ctx.serviceIds && ctx.serviceIds.length > 0
      ? ctx.serviceIds
      : ctx.serviceId
        ? [ctx.serviceId]
        : [];
  for (const raw of fromList) {
    const sid = String(raw || '').trim();
    if (sid && sid !== '0' && meta.pendingServiceIds.has(sid)) return true;
  }
  return false;
}

/** Док.: POST getinfo с orderid=0 и ip — dedicatedip, nextduedate, orderid, orderStatus. */
export function parseGetinfoResponse(info: unknown): {
  orderId: string | null;
  serviceId: string | null;
  /** Все ID услуги/продукта из ответа — для сопоставления со счетами (productids и т.п.). */
  billingServiceIds: string[];
  renewal: Date | null;
  dedicatedIp: string | null;
} | null {
  if (!infernoPayloadSuccess(info)) return null;
  const r = asRecord(info);
  if (!r) return null;
  const serviceId = pickString(r, ['serviceid', 'service_id', 'productid', 'product_id']);
  const billingServiceIds = new Set<string>();
  const addId = (v: string | null | undefined) => {
    const t = v?.trim();
    if (t && t !== '0') billingServiceIds.add(t);
  };
  addId(serviceId);
  const productBlob = pickString(r, ['productids', 'product_ids', 'productIds']);
  if (productBlob) {
    for (const p of productBlob.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)) {
      addId(p);
    }
  }
  return {
    orderId: pickString(r, ['orderid', 'order_id']),
    serviceId,
    billingServiceIds: [...billingServiceIds],
    renewal: extractRenewalDate(r),
    dedicatedIp: pickString(r, ['dedicatedip', 'dedicated_ip', 'ip']),
  };
}

/** Заголовки ближе к браузеру — иногда снижают ложные блокировки (не гарантирует обход Cloudflare). */
const INFERNO_BROWSER_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

export function infernoBodyLooksLikeCloudflareBlock(text: string): boolean {
  const t = text.slice(0, 8000).toLowerCase();
  return (
    t.includes('just a moment') ||
    t.includes('cf-chl') ||
    t.includes('cf_browser') ||
    (t.includes('cloudflare') && t.includes('challenge'))
  );
}

function infernoHttpError(action: string, status: number, text: string): Error {
  if (infernoBodyLooksLikeCloudflareBlock(text)) {
    return new Error(
      `Inferno (${action}): Cloudflare отдаёт страницу проверки вместо API (HTTP ${status}). ` +
        `Часто так бывает с IP датацентра (Railway). В кабинете Inferno: Security → API Keys → IP Whitelist — добавьте исходящие IP приложения. ` +
        `Либо правило WAF/Bot для api_client.php; либо блок «Импорт JSON» в биллингах (curl с ПК → вставить services и orders).`
    );
  }
  if (status === 401 || status === 403) {
    return new Error(
      `Inferno (${action}): доступ отклонён (HTTP ${status}). ` +
        `Проверьте X-Key и IP Whitelist в Inferno Security → API Keys.`
    );
  }
  return new Error(`Inferno API ${action}: HTTP ${status} ${text.slice(0, 200)}`);
}

function infernoParseJson(action: string, text: string): unknown {
  if (infernoBodyLooksLikeCloudflareBlock(text)) {
    throw infernoHttpError(action, 200, text);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (infernoBodyLooksLikeCloudflareBlock(text)) {
      throw infernoHttpError(action, 200, text);
    }
    throw new Error(`Inferno API ${action}: ответ не JSON (${text.slice(0, 120)}…)`);
  }
}

export async function infernoGetJson(apiUrl: string, apiKey: string, action: string): Promise<unknown> {
  const url = `${apiUrl}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...INFERNO_BROWSER_HEADERS,
      'X-Key': apiKey,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw infernoHttpError(action, res.status, text);
  }
  return infernoParseJson(action, text);
}

export async function infernoPostJson(apiUrl: string, apiKey: string, action: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${apiUrl}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...INFERNO_BROWSER_HEADERS,
      'Content-Type': 'application/json',
      'X-Key': apiKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw infernoHttpError(action, res.status, text);
  }
  return infernoParseJson(action, text);
}
