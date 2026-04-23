'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { copyTextToClipboard } from '@/lib/copy-text';
import { Check, Copy, Edit3, Eye, EyeOff, Plus, RefreshCw, Trash2, X, Database } from 'lucide-react';

type BillingManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
};

type BillingAccount = {
  id: string;
  name: string;
  url?: string | null;
  login: string;
  hasPassword?: boolean;
  hasApiKey?: boolean;
};

const initialForm = { name: '', url: '', login: '', password: '', apiKey: '' };

const normalizeUrlForFavicon = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname;
  } catch {
    return raw.replace(/^https?:\/\//i, '').split('/')[0];
  }
};

const getFaviconSrc = (value?: string | null) => {
  const host = normalizeUrlForFavicon(value);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : '';
};

export default function BillingManager({ isOpen, onClose, onChanged }: BillingManagerProps) {
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [secretMasks, setSecretMasks] = useState({ password: false, apiKey: false });
  const [clearApiKey, setClearApiKey] = useState(false);
  const [isSyncingInferno, setIsSyncingInferno] = useState(false);
  const [isProbingInferno, setIsProbingInferno] = useState(false);
  const [infernoImportOpen, setInfernoImportOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState('');
  const [importServicesJson, setImportServicesJson] = useState('');
  const [importOrdersJson, setImportOrdersJson] = useState('');
  const [importInvoicesJson, setImportInvoicesJson] = useState('');
  const [isImportingInferno, setIsImportingInferno] = useState(false);

  const loadAccounts = async () => {
    const res = await fetch('/api/hostings', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setAccounts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (isOpen) loadAccounts();
  }, [isOpen]);

  useEffect(() => {
    if (!importAccountId && accounts.length > 0) {
      setImportAccountId(accounts[0].id);
    }
  }, [accounts, importAccountId]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await copyTextToClipboard(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      alert('Не удалось скопировать в буфер обмена');
    }
  };

  const fetchSecretValue = async (accountId: string, secretType: 'password' | 'apiKey') => {
    const res = await fetch(`/api/hostings/secret?accountId=${accountId}&secretType=${secretType}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Не удалось получить секрет');
    return data.secret as string;
  };

  const copySecretToClipboard = async (accountId: string, secretType: 'password' | 'apiKey', key: string) => {
    try {
      setLoadingSecretId(key);
      const secret = await fetchSecretValue(accountId, secretType);
      await copyTextToClipboard(secret);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось получить секрет');
    } finally {
      setLoadingSecretId((prev) => (prev === key ? null : prev));
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setIsEditorOpen(false);
    setShowPassword(false);
    setShowApiKey(false);
    setSecretMasks({ password: false, apiKey: false });
    setClearApiKey(false);
    setInfernoImportOpen(false);
  };

  const openEdit = (account: BillingAccount) => {
    setEditingId(account.id);
    setForm({ name: account.name || '', url: account.url || '', login: account.login || '', password: '', apiKey: '' });
    setSecretMasks({ password: !!account.hasPassword, apiKey: !!account.hasApiKey });
    setClearApiKey(false);
    setShowPassword(false);
    setShowApiKey(false);
    setIsEditorOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/hostings', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form, clearApiKey } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось сохранить биллинг');
      await loadAccounts();
      await onChanged?.();
      resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось сохранить биллинг');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить биллинг?')) return;
    const res = await fetch(`/api/hostings?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadAccounts();
      await onChanged?.();
      if (editingId === id) resetForm();
    }
  };

  const handleSyncInferno = async () => {
    setIsSyncingInferno(true);
    try {
      const res = await fetch('/api/hostings/sync-inferno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Синхронизация не удалась');
      const rows = Array.isArray(data?.results) ? data.results : [];
      const lines = rows.map(
        (r: { name?: string; ok?: boolean; matched?: number; checked?: number; error?: string }) =>
          r.ok
            ? `${r.name}: совпало серверов ${r.matched ?? 0} (услуг ${r.checked ?? 0})`
            : `${r.name}: ${r.error || 'ошибка'}`
      );
      alert(lines.length ? lines.join('\n') : 'Нет биллингов с API-ключом и URL.');
      await onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Синхронизация не удалась');
    } finally {
      setIsSyncingInferno(false);
    }
  };

  const handleProbeInferno = async () => {
    setIsProbingInferno(true);
    try {
      const res = await fetch('/api/hostings/sync-inferno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'probe' }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Проверка подключения не удалась');
      const rows = Array.isArray(data?.results) ? data.results : [];
      const lines = rows.map(
        (r: { name?: string; ok?: boolean; note?: string; error?: string }) =>
          r.ok
            ? `${r.name}: ${r.note || 'OK'}`
            : `${r.name}: ${r.error || 'ошибка подключения'}`
      );
      const egressLine = data?.egressIp ? `\nИсходящий IP приложения: ${data.egressIp}` : '';
      alert(lines.length ? `${lines.join('\n')}${egressLine}` : 'Нет биллингов с API-ключом и URL.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Проверка подключения не удалась');
    } finally {
      setIsProbingInferno(false);
    }
  };

  const handleImportInfernoJson = async () => {
    if (!importAccountId) {
      alert('Выберите биллинг');
      return;
    }
    setIsImportingInferno(true);
    try {
      let services: unknown;
      let orders: unknown;
      let invoices: unknown = null;
      try {
        services = JSON.parse(importServicesJson.trim() || 'null');
      } catch {
        throw new Error('«Услуги (services)» — невалидный JSON');
      }
      try {
        orders = JSON.parse(importOrdersJson.trim() || 'null');
      } catch {
        throw new Error('«Заказы (orders)» — невалидный JSON');
      }
      if (importInvoicesJson.trim()) {
        try {
          invoices = JSON.parse(importInvoicesJson.trim());
        } catch {
          throw new Error('«Счета (invoices)» — невалидный JSON (или оставьте поле пустым)');
        }
      }
      const res = await fetch('/api/hostings/sync-inferno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'import',
          accountId: importAccountId,
          services,
          orders,
          ...(invoices !== null ? { invoices } : {}),
        }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Импорт не удался');
      const rows = Array.isArray(data?.results) ? data.results : [];
      const r = rows[0];
      if (r?.ok) {
        alert(`Импорт выполнен: совпало серверов ${r.matched ?? 0}, услуг обработано ${r.checked ?? 0}.`);
        await onChanged?.();
      } else {
        alert(r?.error || 'Импорт не удался');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Импорт не удался');
    } finally {
      setIsImportingInferno(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80" onClick={() => { resetForm(); onClose(); }}>
      <div className="w-full max-w-2xl rounded-[40px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0F1219]" onClick={(e) => e.stopPropagation()}>
        <div className="p-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Биллинги</h2>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Inferno: URL панели, логин, пароль и API-ключ (заголовок X-Key; в кабинете нужны 2FA и Security → API Keys → IP whitelist — туда добавьте исходящие IP Railway, иначе запросы с сервера приложения отклоняются). «Синхронизировать API» тянет services и orders; при блокировке Cloudflare выполните два curl с ПК и вставьте JSON в «Импорт JSON».
              </p>
            </div>
            <button onClick={() => { resetForm(); onClose(); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20} /></button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (isEditorOpen && !editingId) {
                  resetForm();
                } else {
                  resetForm();
                  setIsEditorOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300"
            >
              <Plus size={14} /> Добавить биллинг
            </button>
            <button
              type="button"
              onClick={() => void handleSyncInferno()}
              disabled={isSyncingInferno}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
              title="Запросить услуги и заказы Inferno (api_client.php), сопоставить по IP и привязать биллинг"
            >
              <RefreshCw size={14} className={isSyncingInferno ? 'animate-spin' : ''} />
              {isSyncingInferno ? 'Синхронизация…' : 'Синхронизировать API'}
            </button>
            <button
              type="button"
              onClick={() => void handleProbeInferno()}
              disabled={isProbingInferno}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-blue-800 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
              title="Проверить доступ к Inferno API и увидеть текущий исходящий IP приложения"
            >
              <Database size={14} className={isProbingInferno ? 'animate-pulse' : ''} />
              {isProbingInferno ? 'Проверка…' : 'Проверить доступ API'}
            </button>
            {isEditorOpen ? (
              <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><X size={14} /> Закрыть форму</button>
            ) : null}
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={() => setInfernoImportOpen((v) => !v)}
              className="text-left text-xs font-black uppercase tracking-wide text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
            >
              {infernoImportOpen ? '▼' : '▶'} Импорт JSON (обход Cloudflare)
            </button>
            {infernoImportOpen ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="inferno-import-account" className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Биллинг
                  </label>
                  <select
                    id="inferno-import-account"
                    value={importAccountId}
                    onChange={(e) => setImportAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="rounded-xl border border-slate-200 bg-white/80 p-3 font-mono text-[10px] leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-400">
                  С терминала (подставьте свой URL и ключ):
                  <br />
                  {`curl -sS 'https://cp.inferno.name/api_client.php?action=services' -H 'Content-Type: application/json' -H 'X-Key: ВАШ_КЛЮЧ'`}
                  <br />
                  {`curl -sS 'https://cp.inferno.name/api_client.php?action=orders' -H 'Content-Type: application/json' -H 'X-Key: ВАШ_КЛЮЧ'`}
                  <br />
                  {`curl -sS 'https://cp.inferno.name/api_client.php?action=invoices' -H 'Content-Type: application/json' -H 'X-Key: ВАШ_КЛЮЧ'`}{' '}
                  <span className="text-slate-500">(по наличию в панели; иначе пусто)</span>
                  <br />
                  Скопируйте <strong className="text-slate-800 dark:text-slate-200">весь вывод</strong> каждой команды в поля ниже.
                </p>
                <div>
                  <label htmlFor="inferno-import-services" className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ответ services (JSON)
                  </label>
                  <textarea
                    id="inferno-import-services"
                    value={importServicesJson}
                    onChange={(e) => setImportServicesJson(e.target.value)}
                    spellCheck={false}
                    placeholder='{ "…": … }'
                    className="h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-2 font-mono text-[11px] leading-snug text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="inferno-import-orders" className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ответ orders (JSON)
                  </label>
                  <textarea
                    id="inferno-import-orders"
                    value={importOrdersJson}
                    onChange={(e) => setImportOrdersJson(e.target.value)}
                    spellCheck={false}
                    placeholder='{ "…": … }'
                    className="h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-2 font-mono text-[11px] leading-snug text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="inferno-import-invoices" className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ответ invoices (JSON), необязательно
                  </label>
                  <textarea
                    id="inferno-import-invoices"
                    value={importInvoicesJson}
                    onChange={(e) => setImportInvoicesJson(e.target.value)}
                    spellCheck={false}
                    placeholder="Если в биллинге «счёт выставлен», но в orders пусто — вставьте сюда ответ action=invoices"
                    className="h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-2 font-mono text-[11px] leading-snug text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleImportInfernoJson()}
                  disabled={isImportingInferno || accounts.length === 0}
                  className="w-full rounded-xl bg-slate-800 py-3 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
                >
                  {isImportingInferno ? 'Импорт…' : 'Применить импорт (без запроса к Inferno)'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mb-2 space-y-3 max-h-[min(62vh,560px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
            {accounts.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Нет добавленных биллингов</div>}
            {accounts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    {a.url ? (
                      <img
                        src={getFaviconSrc(a.url)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded bg-white shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"><Database size={15} /></span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{a.name}</div>
                      <div className="truncate text-xs font-mono text-slate-500">{a.login}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.url ? <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">URL</span> : null}
                    {a.hasPassword ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Pass</span> : null}
                    {a.hasApiKey ? <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">API</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 self-start">
                  <button type="button" onClick={() => openEdit(a)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-500" title="Редактировать"><Edit3 size={16} /></button>
                  <button onClick={() => handleDelete(a.id)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          {isEditorOpen && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80" onClick={resetForm}>
              <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] space-y-4 rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-2xl dark:border-cyan-900/30 dark:bg-[#0b1719]">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-cyan-700">{editingId ? 'Редактировать биллинг' : 'Добавить биллинг'}</h3>
                  <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Закрыть форму"><X size={18} /></button>
                </div>
                <div>
                  <label htmlFor="billing-name" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                    Название
                  </label>
                  <div className="relative">
                    <input
                      id="billing-name"
                      required
                      placeholder="Напр. Hetzner"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={`w-full rounded-xl border border-cyan-200 bg-white p-3 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900 ${form.name ? 'pr-11' : ''}`}
                    />
                    {form.name ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(form.name, `billing-form-name-${editingId || 'new'}`)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                        title="Скопировать название"
                      >
                        {copiedId === `billing-form-name-${editingId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label htmlFor="billing-url" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                    Ссылка на биллинг
                  </label>
                  <div className="relative">
                    <input
                      id="billing-url"
                      placeholder="https://…"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-11 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                    />
                    {form.url ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(form.url, `billing-form-url-${editingId || 'new'}`)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                        title="Скопировать ссылку"
                      >
                        {copiedId === `billing-form-url-${editingId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label htmlFor="billing-login" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                    Логин или email
                  </label>
                  <div className="relative">
                    <input
                      id="billing-login"
                      required
                      placeholder="Логин в биллинге"
                      value={form.login}
                      onChange={(e) => setForm({ ...form, login: e.target.value })}
                      className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-11 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                    />
                    {form.login ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(form.login, `billing-form-login-${editingId || 'new'}`)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                        title="Скопировать логин"
                      >
                        {copiedId === `billing-form-login-${editingId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label htmlFor="billing-password" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                    Пароль
                  </label>
                  <div className="relative">
                    <input
                      id="billing-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={editingId ? '' : 'Будет сохранён в зашифрованном виде'}
                      value={form.password || (secretMasks.password ? '••••••••••' : '')}
                      onFocus={() => {
                        if (secretMasks.password) {
                          setSecretMasks((prev) => ({ ...prev, password: false }));
                          setForm((prev) => ({ ...prev, password: '' }));
                        }
                      }}
                      onChange={(e) => {
                        setSecretMasks((prev) => ({ ...prev, password: false }));
                        setForm({ ...form, password: e.target.value });
                      }}
                      className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-20 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                    />
                    {form.password || (editingId && accounts.find((item) => item.id === editingId)?.hasPassword) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (form.password) {
                            void copyToClipboard(form.password, `billing-form-pass-field-${editingId || 'new'}`);
                          } else if (editingId) {
                            void copySecretToClipboard(editingId, 'password', `billing-form-pass-${editingId}`);
                          }
                        }}
                        className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                        title="Скопировать пароль"
                      >
                        {loadingSecretId === `billing-form-pass-${editingId}` && !form.password ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : copiedId === `billing-form-pass-${editingId}` || copiedId === `billing-form-pass-field-${editingId || 'new'}` ? (
                          <Check size={16} className="text-emerald-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        const bid = editingId;
                        if (showPassword) {
                          setShowPassword(false);
                          if (bid && accounts.find((x) => x.id === bid)?.hasPassword) {
                            setForm((p) => ({ ...p, password: '' }));
                            setSecretMasks((p) => ({ ...p, password: true }));
                          }
                          return;
                        }
                        if (!bid || !secretMasks.password) {
                          setShowPassword(true);
                          return;
                        }
                        setLoadingSecretId(`billing-reveal-pass-${bid}`);
                        try {
                          const s = await fetchSecretValue(bid, 'password');
                          setForm((p) => ({ ...p, password: s }));
                          setSecretMasks((p) => ({ ...p, password: false }));
                          setShowPassword(true);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : 'Не удалось получить пароль');
                        } finally {
                          setLoadingSecretId(null);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 disabled:opacity-50"
                      title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      disabled={!!editingId && (loadingSecretId === `billing-reveal-pass-${editingId}` || loadingSecretId === `billing-form-pass-${editingId}`)}
                    >
                      {editingId && loadingSecretId === `billing-reveal-pass-${editingId}` ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="billing-api-key" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      id="billing-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={editingId ? '' : 'Необязательно'}
                      value={form.apiKey || (secretMasks.apiKey ? '••••••••••' : '')}
                      onFocus={() => {
                        if (secretMasks.apiKey) {
                          setSecretMasks((prev) => ({ ...prev, apiKey: false }));
                          setForm((prev) => ({ ...prev, apiKey: '' }));
                        }
                      }}
                      onChange={(e) => {
                        setSecretMasks((prev) => ({ ...prev, apiKey: false }));
                        setClearApiKey(false);
                        setForm({ ...form, apiKey: e.target.value });
                      }}
                      className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-28 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                    />
                    {form.apiKey || (editingId && accounts.find((item) => item.id === editingId)?.hasApiKey) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (form.apiKey) {
                            void copyToClipboard(form.apiKey, `billing-form-key-field-${editingId || 'new'}`);
                          } else if (editingId) {
                            void copySecretToClipboard(editingId, 'apiKey', `billing-form-key-${editingId}`);
                          }
                        }}
                        className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                        title="Скопировать API Key"
                      >
                        {loadingSecretId === `billing-form-key-${editingId}` && !form.apiKey ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : copiedId === `billing-form-key-${editingId}` || copiedId === `billing-form-key-field-${editingId || 'new'}` ? (
                          <Check size={16} className="text-emerald-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    ) : null}
                    {editingId && (accounts.find((item) => item.id === editingId)?.hasApiKey || form.apiKey || secretMasks.apiKey) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowApiKey(false);
                          setSecretMasks((prev) => ({ ...prev, apiKey: false }));
                          setClearApiKey(true);
                          setForm((prev) => ({ ...prev, apiKey: '' }));
                        }}
                        className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                        title="Удалить API Key"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        const bid = editingId;
                        if (showApiKey) {
                          setShowApiKey(false);
                          if (bid && accounts.find((x) => x.id === bid)?.hasApiKey) {
                            setForm((p) => ({ ...p, apiKey: '' }));
                            setSecretMasks((p) => ({ ...p, apiKey: true }));
                          }
                          return;
                        }
                        if (!bid || !secretMasks.apiKey) {
                          setShowApiKey(true);
                          return;
                        }
                        setLoadingSecretId(`billing-reveal-key-${bid}`);
                        try {
                          const s = await fetchSecretValue(bid, 'apiKey');
                          setForm((p) => ({ ...p, apiKey: s }));
                          setSecretMasks((p) => ({ ...p, apiKey: false }));
                          setClearApiKey(false);
                          setShowApiKey(true);
                        } catch (e) {
                          alert(e instanceof Error ? e.message : 'Не удалось получить API Key');
                        } finally {
                          setLoadingSecretId(null);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 disabled:opacity-50"
                      title={showApiKey ? 'Скрыть' : 'Показать'}
                      disabled={!!editingId && loadingSecretId === `billing-reveal-key-${editingId}`}
                    >
                      {editingId && loadingSecretId === `billing-reveal-key-${editingId}` ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : showApiKey ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isSaving} className="mt-2 w-full rounded-xl bg-cyan-600 p-4 text-sm font-black uppercase text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Сохраняю...' : editingId ? 'Сохранить' : 'Добавить'}</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
