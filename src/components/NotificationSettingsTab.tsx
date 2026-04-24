'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, RefreshCw, Trash2 } from 'lucide-react';

type Recipient = {
  id: string;
  name: string;
  chatId: string;
  isActive: boolean;
  notifyDown: boolean;
  notifyUp: boolean;
  notifyDomain: boolean;
  notifyBilling: boolean;
  notifySummary: boolean;
};

type SettingsState = {
  enabled: boolean;
  hasBotToken: boolean;
  botToken: string;
  timezone: string;
  morningSummaryHour: number;
  serverFailThreshold: number;
  siteFailThreshold: number;
  recoverySuccessCount: number;
  domainRenewalDays: number;
};

type NotificationLog = {
  id: string;
  eventType: string;
  eventKey: string;
  status: string;
  payloadJson?: string | null;
  createdAt: string;
};

const DEFAULTS: SettingsState = {
  enabled: false,
  hasBotToken: false,
  botToken: '',
  timezone: 'Europe/Belgrade',
  morningSummaryHour: 9,
  serverFailThreshold: 2,
  siteFailThreshold: 2,
  recoverySuccessCount: 2,
  domainRenewalDays: 14,
};

export default function NotificationSettingsTab() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', chatId: '' });
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, rRes, lRes] = await Promise.all([
        fetch('/api/notifications/settings', { cache: 'no-store' }),
        fetch('/api/notifications/recipients', { cache: 'no-store' }),
        fetch('/api/notifications/logs', { cache: 'no-store' }),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const rData = await rRes.json().catch(() => []);
      const lData = await lRes.json().catch(() => []);
      setSettings((prev) => ({
        ...prev,
        ...sData,
        botToken: '',
      }));
      setRecipients(Array.isArray(rData) ? rData : []);
      setLogs(Array.isArray(lData) ? lData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled: settings.enabled,
        timezone: settings.timezone,
        morningSummaryHour: Number(settings.morningSummaryHour),
        serverFailThreshold: Number(settings.serverFailThreshold),
        siteFailThreshold: Number(settings.siteFailThreshold),
        recoverySuccessCount: Number(settings.recoverySuccessCount),
        domainRenewalDays: Number(settings.domainRenewalDays),
      };
      if (settings.botToken.trim()) payload.botToken = settings.botToken.trim();
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось сохранить настройки');
      setSettings((prev) => ({ ...prev, ...data, botToken: '' }));
      alert('Настройки уведомлений сохранены');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = async () => {
    if (!newRecipient.name.trim() || !newRecipient.chatId.trim()) {
      alert('Укажите имя и Chat ID');
      return;
    }
    const res = await fetch('/api/notifications/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecipient),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || 'Не удалось добавить получателя');
      return;
    }
    setRecipients((prev) => [...prev, data]);
    setNewRecipient({ name: '', chatId: '' });
  };

  const updateRecipient = async (id: string, patch: Partial<Recipient>) => {
    const res = await fetch('/api/notifications/recipients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) return;
    setRecipients((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeRecipient = async (id: string) => {
    if (!confirm('Удалить получателя?')) return;
    const res = await fetch(`/api/notifications/recipients?id=${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setRecipients((prev) => prev.filter((x) => x.id !== id));
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось отправить тест');
      alert(`Тест отправлен (${data.sent ?? 0} получателей)`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось отправить тест');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500 text-sm font-semibold">Загрузка настроек уведомлений…</div>;
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <header>
        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Настройки уведомлений</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Telegram-уведомления по серверам, сайтам, доменам, счетам и утренний саммари.
        </p>
      </header>

      <form onSubmit={saveSettings} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Telegram Bot Token
            <input
              value={settings.botToken}
              onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
              placeholder={settings.hasBotToken ? 'Токен сохранен (введите для замены)' : '123456:ABC...'}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Таймзона
            <input
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Утренний саммари (час)
            <input
              type="number"
              min={0}
              max={23}
              value={settings.morningSummaryHour}
              onChange={(e) => setSettings({ ...settings, morningSummaryHour: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Дней до продления домена
            <input
              type="number"
              min={1}
              max={60}
              value={settings.domainRenewalDays}
              onChange={(e) => setSettings({ ...settings, domainRenewalDays: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Порог server DOWN (подряд)
            <input
              type="number"
              min={1}
              max={10}
              value={settings.serverFailThreshold}
              onChange={(e) => setSettings({ ...settings, serverFailThreshold: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Порог site DOWN (подряд)
            <input
              type="number"
              min={1}
              max={10}
              value={settings.siteFailThreshold}
              onChange={(e) => setSettings({ ...settings, siteFailThreshold: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Порог RECOVERY (подряд)
            <input
              type="number"
              min={1}
              max={10}
              value={settings.recoverySuccessCount}
              onChange={(e) => setSettings({ ...settings, recoverySuccessCount: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mt-8">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            Включить Telegram уведомления
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">
            <Check size={14} /> {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button type="button" onClick={() => void sendTest()} disabled={sendingTest} className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <RefreshCw size={14} className={sendingTest ? 'animate-spin' : ''} />
            Тест в Telegram
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 space-y-4">
        <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white">Получатели</h3>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={newRecipient.name}
            onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
            placeholder="Имя (например: Liz)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <input
            value={newRecipient.chatId}
            onChange={(e) => setNewRecipient({ ...newRecipient, chatId: e.target.value })}
            placeholder="Chat ID (например: -100...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <button type="button" onClick={() => void addRecipient()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700">
            <Plus size={14} /> Добавить
          </button>
        </div>

        <div className="space-y-2">
          {recipients.length === 0 ? <div className="text-sm text-slate-500">Получателей пока нет.</div> : null}
          {recipients.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                  <div className="text-xs font-mono text-slate-500">{r.chatId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs"><input type="checkbox" checked={r.isActive} onChange={(e) => void updateRecipient(r.id, { isActive: e.target.checked })} /> active</label>
                  <label className="text-xs"><input type="checkbox" checked={r.notifyDown} onChange={(e) => void updateRecipient(r.id, { notifyDown: e.target.checked })} /> down</label>
                  <label className="text-xs"><input type="checkbox" checked={r.notifyUp} onChange={(e) => void updateRecipient(r.id, { notifyUp: e.target.checked })} /> up</label>
                  <label className="text-xs"><input type="checkbox" checked={r.notifyDomain} onChange={(e) => void updateRecipient(r.id, { notifyDomain: e.target.checked })} /> domain</label>
                  <label className="text-xs"><input type="checkbox" checked={r.notifyBilling} onChange={(e) => void updateRecipient(r.id, { notifyBilling: e.target.checked })} /> billing</label>
                  <label className="text-xs"><input type="checkbox" checked={r.notifySummary} onChange={(e) => void updateRecipient(r.id, { notifySummary: e.target.checked })} /> summary</label>
                  <button type="button" onClick={() => void removeRecipient(r.id)} className="rounded-lg p-2 text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white">Лог уведомлений</h3>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <RefreshCw size={12} /> Обновить
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          {logs.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Пока нет отправленных событий.</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {logs.map((row) => (
                <div key={row.id} className="p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-black uppercase ${
                      row.status === 'sent'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : row.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}>
                      {row.status}
                    </span>
                    <span className="font-black text-slate-700 dark:text-slate-200">{row.eventType}</span>
                    <span className="text-slate-500">{new Date(row.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500 break-all">{row.eventKey}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
