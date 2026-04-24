'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Server, Globe, Settings, CreditCard, Plus, Trash2, X, Terminal,
  ChevronDown, ChevronUp, Activity, ExternalLink, Copy, Check, Clock, RefreshCw,
  Sun, Moon, Cpu, ArrowDownToLine, ArrowUpToLine, Database, AppWindow, AlertCircle, ArrowDownWideNarrow, History, Eye, EyeOff, Link2, UserRound, Shield, PanelTopOpen, Pencil, BellRing, DollarSign, Bell, ChevronLeft, ChevronRight, CalendarDays, Wifi, WifiOff, Clock3
} from "lucide-react";
import ServerHistory from '@/components/ServerHistory';
import DomainsTab from '@/components/DomainsTab';
import BillingManager from '@/components/BillingManager';
import MainDashboardTab from '@/components/MainDashboardTab';
import { getRootLikeDomain, isSubdomainSite, normalizedHost } from '@/components/domainsTab.shared';
import { copyTextToClipboard } from '@/lib/copy-text';

const SERVER_UI_REFRESH_MS = 30000;

function formatBilling14dUnpaidLine(count: number, sum: string) {
  if (count <= 0) return 'Нет неоплаченных счетов (окно 14 дн.)';
  const n = count;
  let word: string;
  if (n % 10 === 1 && n % 100 !== 11) word = 'счёт';
  else if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) word = 'счёта';
  else word = 'счетов';
  return `${n} ${word} на сумму ${sum}`;
}

const LinearProgress = ({
  value,
  label,
  color,
  subLabel
}: {
  value: number;
  label: string;
  color: string;
  subLabel?: string;
}) => {
  const textColor = value >= 90
    ? 'text-red-500 font-black'
    : value >= 75
      ? 'text-amber-500 font-black'
      : 'text-slate-700 dark:text-slate-300';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
          {subLabel && (
            <span className="text-slate-400 font-mono tracking-normal normal-case text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {subLabel}
            </span>
          )}
          <span className={textColor}>{value}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

const SidebarClock = () => {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return null;

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');

  const date = time.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="mt-5 mb-6 px-2 select-none">
      <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.96)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,18,25,0.96)_0%,rgba(10,14,20,0.98)_100%)] px-4 py-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(2,8,23,0.45)]">
        <div className="flex items-center justify-center gap-2">
          <div className="min-w-[56px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 px-3 py-3 text-center shadow-sm">
            <div className="text-[28px] leading-none font-black tracking-tight text-slate-900 dark:text-white">
              {hours}
            </div>
          </div>

          <div className="text-slate-300 dark:text-slate-600 text-xl font-black -mt-1">:</div>

          <div className="min-w-[56px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 px-3 py-3 text-center shadow-sm">
            <div className="text-[28px] leading-none font-black tracking-tight text-slate-900 dark:text-white">
              {minutes}
            </div>
          </div>

          <div className="text-slate-300 dark:text-slate-600 text-xl font-black -mt-1">:</div>

          <div className="min-w-[56px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-center shadow-sm">
            <div className="text-[22px] leading-none font-black tracking-tight text-sky-600 dark:text-sky-400">
              {seconds}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <div className="text-[11px] font-black tracking-[0.14em] uppercase text-slate-500 dark:text-slate-400">
            Текущее время
          </div>
          <div className="mt-1 text-[13px] font-semibold text-slate-700 dark:text-slate-300 capitalize">
            {date}
          </div>
        </div>
      </div>
    </div>
  );
};


const PANEL_OPTIONS = [
  { value: 'none', label: 'Без панели' },
  { value: 'fastpanel', label: 'FastPanel' },
  { value: 'aapanel', label: 'aaPanel' },
  { value: 'ispmanager', label: 'ISPmanager' },
  { value: 'cpanel', label: 'cPanel' },
  { value: 'plesk', label: 'Plesk' },
  { value: 'directadmin', label: 'DirectAdmin' },
  { value: 'cyberpanel', label: 'CyberPanel' },
  { value: 'cloudpanel', label: 'CloudPanel' },
  { value: 'hestia', label: 'HestiaCP' },
  { value: 'vestacp', label: 'VestaCP' },
  { value: 'apiscp', label: 'ApisCP' },
  { value: 'cwp', label: 'CWP / CWPpro' },
  { value: 'froxlor', label: 'Froxlor' },
  { value: 'keyhelp', label: 'KeyHelp' },
  { value: 'webmin', label: 'Webmin' },
  { value: 'tinycp', label: 'TinyCP' },
];

const PANEL_STYLES: Record<string, { label: string; badge: string; icon: string }> = {
  none: { label: 'Без панели', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: '•' },
  fastpanel: { label: 'FastPanel', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: 'F' },
  aapanel: { label: 'aaPanel', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', icon: 'aa' },
  ispmanager: { label: 'ISPmanager', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: 'I' },
  cpanel: { label: 'cPanel', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', icon: 'cP' },
  plesk: { label: 'Plesk', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', icon: 'P' },
  directadmin: { label: 'DirectAdmin', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: 'DA' },
  cyberpanel: { label: 'CyberPanel', badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200', icon: 'Cy' },
  cloudpanel: { label: 'CloudPanel', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200', icon: 'Cl' },
  vestacp: { label: 'VestaCP', badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: 'V' },
  hestia: { label: 'HestiaCP', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', icon: 'H' },
  apiscp: { label: 'ApisCP', badge: 'bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200', icon: 'A' },
  cwp: { label: 'CWP / CWPpro', badge: 'bg-stone-200 text-stone-800 dark:bg-stone-500/20 dark:text-stone-200', icon: 'CWP' },
  froxlor: { label: 'Froxlor', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200', icon: 'Fr' },
  keyhelp: { label: 'KeyHelp', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200', icon: 'KH' },
  webmin: { label: 'Webmin', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300', icon: 'W' },
  tinycp: { label: 'TinyCP', badge: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-600/30 dark:text-neutral-200', icon: 'T' },
};

const detectPanelType = (server: any) => {
  const explicit = String(server.panelType || '').toLowerCase();
  if (explicit && explicit !== 'none' && PANEL_STYLES[explicit]) return explicit;
  if (explicit && explicit !== 'none') return explicit;
  const source = `${server.panelUrl || ''} ${server.name || ''}`.toLowerCase();
  if (source.includes('fastpanel')) return 'fastpanel';
  if (source.includes('aapanel') || source.includes('aa panel')) return 'aapanel';
  if (source.includes('ispmanager') || source.includes('ispmgr') || source.includes('ispsystem')) return 'ispmanager';
  if (source.includes('cpanel') || /:2083(\/|$)/.test(source)) return 'cpanel';
  if (source.includes('plesk')) return 'plesk';
  if (source.includes('directadmin') || /:2222(\/|$)/.test(source)) return 'directadmin';
  if (source.includes('cyberpanel')) return 'cyberpanel';
  if (source.includes('cloudpanel') || /cloudpanel\.(me|one)/.test(source)) return 'cloudpanel';
  if (source.includes('vesta')) return 'vestacp';
  if (source.includes('hestia')) return 'hestia';
  if (source.includes('apnscp') || source.includes('apiscp')) return 'apiscp';
  if (source.includes('cwp') || source.includes('centos web panel') || /:2030(\/|$)/.test(source)) return 'cwp';
  if (source.includes('froxlor')) return 'froxlor';
  if (source.includes('keyhelp')) return 'keyhelp';
  if (source.includes('webmin')) return 'webmin';
  if (source.includes('tinycp')) return 'tinycp';
  return 'none';
};

const PasswordField = ({ value, revealed, onToggle }: { value?: string | null; revealed: boolean; onToggle: () => void }) => (
  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
    <span className="truncate font-mono text-slate-700 dark:text-slate-200">
      {value ? (revealed ? value : '••••••••') : '—'}
    </span>
    {value ? (
      <button type="button" onClick={onToggle} className="text-slate-400 hover:text-blue-500 transition-colors">
        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    ) : null}
  </div>
);

const parseJsonArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};



const AccessRow = ({
  label,
  value,
  copyValue,
  copyKey,
  copiedId,
  onCopy,
  href,
  hidden = false,
  revealed = false,
  onToggle,
}: {
  label: string;
  value?: string | null;
  copyValue?: string | null;
  copyKey: string;
  copiedId: string | null;
  onCopy: (text: string, key: string) => void | Promise<void>;
  href?: string | null;
  hidden?: boolean;
  revealed?: boolean;
  onToggle?: () => void;
}) => {
  const hasValue = !!value;
  const displayValue = !hasValue ? '—' : hidden && !revealed ? '••••••••' : value;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="flex items-center gap-2">
        {href && hasValue ? (
          <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300">
            {displayValue}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
            {displayValue}
          </span>
        )}
        {hidden && hasValue && onToggle ? (
          <button type="button" onClick={onToggle} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (hasValue) void onCopy(String(copyValue ?? value), copyKey);
          }}
          disabled={!hasValue}
          className="inline-flex h-8 min-w-[36px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-slate-500 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          title="Копировать"
        >
          {copiedId === copyKey ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [servers, setServers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [hostingAccounts, setHostingAccounts] = useState<any[]>([]);
  const [siteStatuses, setSiteStatuses] = useState<Record<string, string>>({});
  const [sitesForRenewalSoon, setSitesForRenewalSoon] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTabLoaded, setIsTabLoaded] = useState(false);
  const [expandedServers, setExpandedServers] = useState<string[]>([]);
  const [serverSubTab, setServerSubTab] = useState<Record<string, 'sites' | 'system' | 'history' | 'access'>>({});

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBillingManagerOpen, setIsBillingManagerOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'instructions'>('form');
  const [formData, setFormData] = useState({ name: '', ip: '', user: 'root', password: '', panelType: 'none', panelUrl: '', panelLogin: '', panelPassword: '', hostingAccountId: '' });
  const [isHostingSelectOpen, setIsHostingSelectOpen] = useState(false);
  const [isPanelSelectOpen, setIsPanelSelectOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [installScript, setInstallScript] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('light');
    }

    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && ['dashboard', 'servers', 'domains', 'settings'].includes(savedTab)) {
      setActiveTab(savedTab);
    } else {
      setActiveTab('dashboard');
    }
    setIsTabLoaded(true);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  const navigateToServer = (serverId: string) => {
    handleTabChange('servers');
    if (!expandedServers.includes(serverId)) {
      setExpandedServers([...expandedServers, serverId]);
      setServerSubTab({ ...serverSubTab, [serverId]: 'system' });
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const fetchServers = async () => {
    try {
      const [serversRes, sitesRes, hostingsRes] = await Promise.all([
        fetch('/api/servers', { cache: 'no-store' }),
        fetch('/api/sites', { cache: 'no-store' }),
        fetch('/api/hostings', { cache: 'no-store' }),
      ]);

      if (serversRes.ok) {
        const data = await serversRes.json();
        setServers(data);
      }

      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        const list = Array.isArray(sitesData) ? sitesData : [];
        setSites(list);
        const nextStatuses = list.reduce((acc: Record<string, string>, site: any) => {
          const host = String(site?.url || '').trim().toLowerCase();
          if (host) acc[host] = String(site?.status || 'unknown').toLowerCase();
          return acc;
        }, {});
        setSiteStatuses(nextStatuses);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const soonCount = list.filter((site: any) => {
          if (!site?.domainExpiresAt) return false;
          const exp = new Date(site.domainExpiresAt);
          if (Number.isNaN(exp.getTime())) return false;
          exp.setHours(0, 0, 0, 0);
          const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
          return days >= 0 && days < 7;
        }).length;
        setSitesForRenewalSoon(soonCount);
      }

      if (hostingsRes.ok) {
        const hostings = await hostingsRes.json();
        setHostingAccounts(Array.isArray(hostings) ? hostings : []);
      }
    } catch (error) {
      console.error("Ошибка загрузки серверов:", error);
    }
  };

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await fetch('/api/servers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      await fetchServers();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleManualRefreshServer = async (id: string) => {
    try {
      await fetch('/api/servers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        cache: 'no-store',
      });
      await fetchServers();
    } catch (error) {
      console.error('Ошибка ручной проверки сервера:', error);
    }
  };

  const showAgentInstallForServer = async (id: string) => {
    try {
      const res = await fetch(`/api/servers/${id}/agent-install`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Не удалось получить скрипт агента');
        return;
      }
      const data = await res.json();
      setInstallScript(data.installScript || '');
      setEditingServerId(null);
      setStep('instructions');
      setIsFormOpen(true);
    } catch (error) {
      console.error('Ошибка загрузки скрипта агента:', error);
      alert('Сетевая ошибка');
    }
  };

  const deleteServer = async (id: string) => {
    if (!confirm('Удалить этот сервер из мониторинга?')) return;
    await fetch(`/api/servers?id=${id}`, { method: 'DELETE' });
    fetchServers();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const payload = { ...formData, id: editingServerId };
    const res = await fetch('/api/servers', {
      method: editingServerId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Ошибка при сохранении');
      return;
    }

    if (editingServerId) {
      await closeAndReset();
      return;
    }

    const data = await res.json();
    setInstallScript(data.installScript || '');
    setStep('instructions');
    fetchServers();
  };

  const closeAndReset = async () => {
    setIsFormOpen(false);
    setStep('form');
    setEditingServerId(null);
    setFormData({ name: '', ip: '', user: 'root', password: '', panelType: 'none', panelUrl: '', panelLogin: '', panelPassword: '', hostingAccountId: '' });
    setInstallScript('');
    setIsPanelSelectOpen(false);
    setIsHostingSelectOpen(false);
    await fetchServers();
  };

  const copyScript = async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      alert('Не удалось скопировать в буфер обмена');
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await copyTextToClipboard(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      alert('Не удалось скопировать в буфер обмена');
    }
  };
  const copyHostingSecretToClipboard = async (accountId: string, secretType: 'password' | 'apiKey', key: string) => {
    try {
      setLoadingSecretId(key);
      const res = await fetch(`/api/hostings/secret?accountId=${accountId}&secretType=${secretType}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось получить секрет');
      await copyTextToClipboard(data.secret);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось получить секрет');
    } finally {
      setLoadingSecretId((prev) => (prev === key ? null : prev));
    }
  };


  const copySshCmd = async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setCopiedSsh(true);
      setTimeout(() => setCopiedSsh(false), 2000);
    } catch {
      alert('Не удалось скопировать в буфер обмена');
    }
  };

  const openEditServer = (server: any) => {
    setEditingServerId(server.id);
    setStep('form');
    setFormData({
      name: server.name || '',
      ip: server.ip || '',
      user: server.user || 'root',
      password: server.password || '',
      panelType: detectPanelType(server),
      panelUrl: server.panelUrl || '',
      panelLogin: server.panelLogin || '',
      panelPassword: server.panelPassword || '',
      hostingAccountId: server.hostingAccountId || server.hostingAccount?.id || '',
    });
    setIsFormOpen(true);
  };

  const toggleRevealedPassword = (key: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    fetchServers();
    const timer = setInterval(() => {
      fetchServers();
    }, SERVER_UI_REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  const toggleDrawer = (serverId: string, tab: 'sites' | 'system' | 'history' | 'access') => {
    const isCurrentlyExpanded = expandedServers.includes(serverId);
    const currentTab = serverSubTab[serverId];

    if (isCurrentlyExpanded && currentTab === tab) {
      setExpandedServers(expandedServers.filter(id => id !== serverId));
    } else {
      if (!isCurrentlyExpanded) setExpandedServers([...expandedServers, serverId]);
      setServerSubTab({ ...serverSubTab, [serverId]: tab });
    }
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  function getDaysUntil(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  }

  const totalSites = servers.reduce((acc, s) => acc + parseJsonArray(s.sitesJson).length, 0);
  const onlineServers = servers.filter(s => s.status === 'online').length;
  const offlineServers = servers.filter((s) => s.status === 'offline').length;
  const pendingServers = servers.filter((s) => !['online', 'offline'].includes(String(s.status || ''))).length;
  const billing14dUnpaid = useMemo(() => {
    let count = 0;
    let sum = 0;
    for (const h of hostingAccounts) {
      const c = Number((h as { billingUnpaid14dCount?: number }).billingUnpaid14dCount);
      if (Number.isFinite(c)) count += c;
      const raw = (h as { billingUnpaid14dTotal?: string | null }).billingUnpaid14dTotal;
      const t = parseFloat(String(raw || '0').replace(/\s/g, '').replace(',', '.')) || 0;
      sum += t;
    }
    return { count, sum: sum.toFixed(2) };
  }, [hostingAccounts]);
  const onlineSites = sites.filter((s) => String(s?.status || '').toLowerCase() === 'online').length;
  const offlineSites = sites.filter((s) => String(s?.status || '').toLowerCase() === 'offline').length;
  const pendingSites = sites.filter((s) => !['online', 'offline'].includes(String(s?.status || '').toLowerCase())).length;
  const siteHostsSet = useMemo(
    () => new Set(sites.map((site) => normalizedHost(site?.url)).filter(Boolean)),
    [sites]
  );
  const shouldIgnoreRegistrarForSite = (siteLike: { url?: string | null } | null | undefined) => {
    const rawUrl = String(siteLike?.url || '').trim();
    if (!rawUrl || !isSubdomainSite(rawUrl)) return false;
    const host = normalizedHost(rawUrl);
    if (!host) return false;
    const root = getRootLikeDomain(host);
    if (!root || root === host) return false;
    return siteHostsSet.has(root) || siteHostsSet.has(`www.${root}`);
  };
  const sitesWithoutRegistrar = sites.filter((s) => !shouldIgnoreRegistrarForSite(s) && !s?.registrarAccountId).length;
  const sitesWithoutExpiryDate = sites.filter((s) => getDaysUntil(s?.domainExpiresAt) === null).length;
  const expiredDomains = sites.filter((s) => {
    const days = getDaysUntil(s?.domainExpiresAt);
    return days !== null && days < 0;
  }).length;
  const domainsForRenewalMonth = sites.filter((s) => {
    const days = getDaysUntil(s?.domainExpiresAt);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const avgCpu = onlineServers > 0
    ? Math.round(servers.reduce((acc, srv) => acc + (typeof srv.cpuUsage === 'number' ? srv.cpuUsage : 0), 0) / onlineServers)
    : 0;
  const avgRam = onlineServers > 0
    ? Math.round(servers.reduce((acc, srv) => acc + (typeof srv.ramUsage === 'number' ? srv.ramUsage : 0), 0) / onlineServers)
    : 0;

  const formatUptime = (value?: string | null) => {
  if (!value) return 'нет данных';

  const raw = String(value).trim().toLowerCase();

  let totalSeconds: number | null = null;

  if (/^\d+$/.test(raw)) {
    totalSeconds = Number(raw);
  } else {
    const unitMatch = raw.match(/^(\d+)([smhd])$/i);

    if (unitMatch) {
      const amount = Number(unitMatch[1]);
      const unit = unitMatch[2].toLowerCase();

      if (Number.isFinite(amount)) {
        if (unit === 's') totalSeconds = amount;
        if (unit === 'm') totalSeconds = amount * 60;
        if (unit === 'h') totalSeconds = amount * 3600;
        if (unit === 'd') totalSeconds = amount * 86400;
      }
    }
  }

  if (totalSeconds === null) {
    return String(value);
  }

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 'меньше минуты';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days} дн.`);
  if (hours > 0 || days > 0) parts.push(`${hours} ч.`);
  parts.push(`${minutes} мин.`);

  return parts.join(' ');
};

  const getExpiryTone = (value?: string | null) => {
    const days = getDaysUntil(value);
    if (days === null) return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (days < 7) return 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    if (days < 30) return 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300';
    return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300';
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getFaviconSrc = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const host = new URL(withProtocol).hostname;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    } catch {
      return '';
    }
  };

  const sortedServers = [...servers].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (sortConfig.key === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortConfig.key === 'sites') {
      valA = parseJsonArray(a.sitesJson).length;
      valB = parseJsonArray(b.sitesJson).length;
    } else if (sortConfig.key === 'load') {
      valA = parseFloat((a.loadAvg || "0").split(',')[0]);
      valB = parseFloat((b.loadAvg || "0").split(',')[0]);
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors duration-300 dark:bg-[#0B0E14] dark:text-slate-200 lg:flex-row font-sans">
      <aside className="w-full border-b border-slate-200 bg-white p-4 transition-colors duration-300 dark:border-slate-800 dark:bg-[#0F1219] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-6 z-10">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity size={20} className="text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Core</span>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="hidden lg:block">
          <SidebarClock />
        </div>

        <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-0 lg:flex lg:flex-col lg:gap-1">
          {[
            { id: 'dashboard', label: 'Дашборд', icon: Activity },
            { id: 'servers', label: 'Серверы', icon: Server },
            { id: 'domains', label: 'Домены', icon: Globe },
            { id: 'settings', label: 'Настройки', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? 'bg-blue-600/10 text-blue-600 dark:text-blue-500 border border-blue-500/20'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <item.icon size={18} />
              <span className="text-sm font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        {activeTab === 'dashboard' && (
          <MainDashboardTab
            serversCount={servers.length}
            onlineServers={onlineServers}
            offlineServers={offlineServers}
            pendingServers={pendingServers}
            sitesCount={sites.length}
            onlineSites={onlineSites}
            offlineSites={offlineSites}
            pendingSites={pendingSites}
            avgCpu={avgCpu}
            avgRam={avgRam}
            renewalsInWeek={sitesForRenewalSoon}
            renewalsInMonth={domainsForRenewalMonth}
            expiredDomains={expiredDomains}
            sitesWithoutExpiryDate={sitesWithoutExpiryDate}
            sitesWithoutRegistrar={sitesWithoutRegistrar}
            isManualRefreshing={isManualRefreshing}
            onRefresh={handleManualRefresh}
            onOpenServers={() => handleTabChange('servers')}
            onOpenDomains={() => handleTabChange('domains')}
          />
        )}

        {activeTab === 'servers' && (
          <div className="animate-in fade-in duration-500">
            <header className="mb-10 flex flex-col gap-5 xl:flex-row xl:flex-nowrap xl:items-end xl:justify-between">
              <div className="min-w-0 xl:flex-1 xl:min-w-0">
                <h2 className="mb-2 text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  Инфраструктура
                </h2>
                <div className="mt-3 inline-flex flex-col gap-2 rounded-[28px] border border-slate-200 bg-white/85 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Server size={12} className="text-slate-400" />
                      Всего: <span className="text-slate-900 dark:text-white">{servers.length}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Wifi size={12} className="text-emerald-500" />
                      Online: <span className="text-emerald-500">{onlineServers}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <WifiOff size={12} className="text-red-500" />
                      Offline: <span className="text-red-500">{offlineServers}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} className="text-amber-500" />
                      Ожидание: <span className="text-amber-500">{pendingServers}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Globe size={12} className="text-blue-500" />
                      Сайтов: <span className="text-blue-600 dark:text-blue-400">{totalSites}</span>
                    </span>
                  </div>
                  <div
                    className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border px-3 py-1.5 ${
                      billing14dUnpaid.count > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                    }`}
                  >
                    <Bell size={12} className={billing14dUnpaid.count > 0 ? 'shrink-0 text-rose-500' : 'shrink-0 text-emerald-500'} />
                    <span>На продление до 14 дн.:</span>
                    <span
                      className={
                        billing14dUnpaid.count > 0
                          ? 'font-black text-rose-600 dark:text-rose-300'
                          : 'font-bold text-emerald-700 dark:text-emerald-300'
                      }
                    >
                      {formatBilling14dUnpaidLine(billing14dUnpaid.count, billing14dUnpaid.sum)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-[520px] shrink-0 self-stretch rounded-3xl border border-slate-200/90 bg-white/85 p-2.5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70 sm:self-end xl:ml-auto xl:w-[520px] xl:max-w-none">
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleManualRefresh}
                      disabled={isManualRefreshing}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 px-4 shadow-sm transition-colors hover:border-blue-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <RefreshCw size={14} className={`text-slate-500 ${isManualRefreshing ? 'animate-spin' : ''}`} />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-500">
                        {isManualRefreshing ? 'ОБНОВЛЯЕМ...' : 'ОБНОВИТЬ ВСЕ (1/5 МИН)'}
                      </span>
                    </button>

                    <button
                      onClick={() => setIsBillingManagerOpen(true)}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 px-4 shadow-sm transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10"
                    >
                      <CreditCard size={14} className="text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">Биллинги</span>
                    </button>
                  </div>

                  <button
                    onClick={() => { setEditingServerId(null); setStep('form'); setFormData({ name: '', ip: '', user: 'root', password: '', panelType: 'none', panelUrl: '', panelLogin: '', panelPassword: '', hostingAccountId: '' }); setIsFormOpen(true); }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-black text-sm text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700"
                  >
                    <Plus size={18} /> ДОБАВИТЬ СЕРВЕР
                  </button>
                </div>
              </div>
            </header>

            <div className="lg:hidden flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-[#141820] border border-slate-200 dark:border-slate-800 p-2 rounded-2xl w-fit shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3 pr-1 flex items-center gap-2">
                <ArrowDownWideNarrow size={14} /> Сортировка:
              </span>
              {[
                { id: 'name', label: 'По названию' },
                { id: 'load', label: 'По нагрузке' },
                { id: 'sites', label: 'По сайтам' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSort(type.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    sortConfig.key === type.id
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:grid grid-cols-12 gap-6 px-8 py-4 mb-4 bg-white dark:bg-[#141820] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <div className="col-span-5 flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none" onClick={() => handleSort('name')}>
                Сервер и статусы
                {sortConfig.key === 'name'
                  ? (sortConfig.direction === 'asc' ? <ChevronDown size={14}/> : <ChevronUp size={14}/>)
                  : <span className="w-3.5"/>}
              </div>
              <div className="col-span-3 flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors pl-4 select-none" onClick={() => handleSort('load')}>
                Ресурсы (CPU, RAM, Disk)
                {sortConfig.key === 'load'
                  ? (sortConfig.direction === 'asc' ? <ChevronDown size={14}/> : <ChevronUp size={14}/>)
                  : <span className="w-3.5"/>}
              </div>
              <div className="col-span-4 flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors pr-6 select-none" onClick={() => handleSort('sites')}>
                Панель управления
                {sortConfig.key === 'sites'
                  ? (sortConfig.direction === 'asc' ? <ChevronDown size={14}/> : <ChevronUp size={14}/>)
                  : <span className="w-3.5"/>}
              </div>
            </div>

            <div className="grid gap-6">
              {sortedServers.map((server) => {
                const isOffline = server.status !== 'online';
                const sites = parseJsonArray(server.sitesJson);
                const sysMetrics = parseJsonObject(server.sysMetrics);
                const checks = server.checks || [];

                const procs = sysMetrics.procs || [];
                const services = sysMetrics.services || {};
                const net = sysMetrics.net || { rx_mb: 0, tx_mb: 0 };
                const hw = sysMetrics.hardware || {};

                const isExpanded = expandedServers.includes(server.id);
                const currentSubTab = serverSubTab[server.id] || 'sites';

                const loadParts = (server.loadAvg || "0.00, 0.00, 0.00").split(',').map((s: string) => s.trim());
                const load1 = parseFloat(loadParts[0] || '0');
                const loadColor = isOffline
                  ? 'text-slate-400'
                  : (load1 < 1.0 ? 'text-emerald-500' : load1 < 3.0 ? 'text-amber-500' : 'text-red-500');

                const cpuSub = hw.cpu_cores ? `${hw.cpu_cores} Cores` : '';
                const ramTotal = hw.ram_total ? (parseFloat(hw.ram_total) / 1024).toFixed(1) + ' GB' : '';
                const ramUsed = hw.ram_used ? (parseFloat(hw.ram_used) / 1024).toFixed(1) + ' GB' : '';
                const ramSub = ramTotal ? `${ramUsed} / ${ramTotal}` : '';
                const diskSub = hw.disk_total ? `${hw.disk_used} / ${hw.disk_total}` : '';

                const lastUpdated = new Date(server.updatedAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div
                    key={server.id}
                    className={`relative bg-white dark:bg-[#141820] border rounded-[32px] overflow-visible transition-all shadow-xl dark:shadow-2xl ${
                      isOffline
                        ? 'border-red-500/50 grayscale-[0.3] opacity-80'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {isOffline && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-black uppercase px-8 py-1.5 rounded-b-xl shadow-lg z-10 tracking-widest flex items-center gap-1.5">
                        <AlertCircle size={12} /> Server Offline
                      </div>
                    )}

                    <div className="p-8 grid grid-cols-12 items-center gap-6">
                      <div className="col-span-12 lg:col-span-5 flex items-start gap-5">
                        <div className={`mt-2 w-3 h-3 shrink-0 rounded-full ${isOffline ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'}`} />
                        <div className="w-full">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{server.name}</h3>

                          <div className="flex flex-col gap-3 mt-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-transparent">
                                <Server size={14} className="text-slate-400" /> {server.ip}
                              </div>

                              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border ${isOffline ? 'bg-red-50 text-red-500 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'}`}>
                                <Clock size={14} className={isOffline ? 'text-red-400' : 'text-emerald-500'} />
                                <span className="text-[10px] uppercase tracking-widest opacity-80">В сети:</span>
                                <span>{isOffline ? 'OFFLINE' : formatUptime(server.uptime)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-2.5 px-4 rounded-xl w-fit">
                                <Activity size={14} className="text-slate-400 dark:text-slate-500" />
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">1 MIN</span>
                                    <span className={`text-sm font-black leading-none ${loadColor}`}>{loadParts[0]}</span>
                                  </div>
                                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">5 MIN</span>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-none">{loadParts[1]}</span>
                                  </div>
                                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">15 MIN</span>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-none">{loadParts[2]}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 lg:col-span-3 flex flex-col justify-center gap-4 border-l border-slate-100 dark:border-slate-800/50 pl-4 pr-4 xl:pr-5">
                        <LinearProgress value={isOffline ? 0 : server.cpuUsage} label="Процессор (CPU)" color="bg-blue-500" subLabel={cpuSub} />
                        <LinearProgress value={isOffline ? 0 : server.ramUsage} label="Память (RAM)" color="bg-purple-500" subLabel={ramSub} />
                        <LinearProgress value={isOffline ? 0 : server.diskUsage} label="Накопитель (Disk)" color="bg-orange-500" subLabel={diskSub} />
                      </div>

                      <div className="col-span-12 lg:col-span-4 flex flex-col items-stretch justify-center gap-4 mt-4 lg:mt-0">
                        <div className="flex items-center justify-end pr-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-black border border-blue-100 dark:border-blue-500/20 shadow-sm tracking-wider">
                            <RefreshCw size={12} className={isManualRefreshing ? 'animate-spin' : ''} />
                            {lastUpdated}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => toggleDrawer(server.id, 'sites')}
                          className={`px-5 py-3.5 rounded-xl flex items-center gap-2 transition-all font-bold text-[13px] ${
                            isExpanded && currentSubTab === 'sites'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="Сайты"
                        >
                          <Globe size={18} className={isExpanded && currentSubTab === 'sites' ? "text-blue-200" : "text-slate-400"} />
                          <span>{sites.length}</span>
                        </button>

                        <button
                          onClick={() => toggleDrawer(server.id, 'system')}
                          className={`relative p-3.5 rounded-xl flex items-center justify-center transition-all ${
                            isExpanded && currentSubTab === 'system'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="Система и процессы"
                        >
                          <Cpu size={18} className={isExpanded && currentSubTab === 'system' ? "text-blue-200" : "text-slate-400"} />
                          <span className={`absolute top-2 right-2 w-2 h-2 rounded-full border border-white dark:border-[#141820] ${isOffline ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                        </button>

                        <button
                          onClick={() => toggleDrawer(server.id, 'history')}
                          className={`p-3.5 rounded-xl flex items-center justify-center transition-all ${
                            isExpanded && currentSubTab === 'history'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="История нагрузки"
                        >
                          <History size={18} className={isExpanded && currentSubTab === 'history' ? "text-blue-200" : "text-slate-400"} />
                        </button>

                        <button
                          onClick={() => toggleDrawer(server.id, 'access')}
                          className={`p-3.5 rounded-xl flex items-center justify-center transition-all ${
                            isExpanded && currentSubTab === 'access'
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="Доступы"
                        >
                          <Shield size={18} className={isExpanded && currentSubTab === 'access' ? "text-blue-200" : "text-slate-400"} />
                        </button>

                        <button
                          onClick={() => showAgentInstallForServer(server.id)}
                          className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 p-3.5 rounded-xl transition-colors"
                          title="Скрипт агента (актуальный URL heartbeat)"
                        >
                          <Terminal size={18} />
                        </button>

                        <button
                          onClick={() => handleManualRefreshServer(server.id)}
                          className="text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 p-3.5 rounded-xl transition-colors"
                          title="Проверить этот сервер"
                        >
                          <RefreshCw size={18} />
                        </button>

                        <button
                          onClick={() => openEditServer(server)}
                          className="text-slate-500 hover:text-blue-600 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-3.5 rounded-xl transition-colors"
                          title="Редактировать сервер"
                        >
                          <Pencil size={18} />
                        </button>

                        <button
                          onClick={() => deleteServer(server.id)}
                          className="text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-500/10 p-3.5 rounded-xl transition-colors ml-2"
                        >
                          <Trash2 size={18} />
                        </button>
                        </div>

                        {server.hostingAccount ? (
                          <div className="w-full space-y-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {server.hostingAccount.url ? (
                                <a
                                  href={server.hostingAccount.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[9px] font-black uppercase leading-tight text-cyan-800 shadow-sm transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                                  title="Открыть биллинг сервера"
                                >
                                  {server.hostingAccount.url ? (
                                    <img
                                      src={getFaviconSrc(server.hostingAccount.url)}
                                      alt=""
                                      className="h-3.5 w-3.5 shrink-0 rounded-sm bg-white"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <Link2 size={9} className="shrink-0" />
                                  <span className="min-w-0 truncate">BIL: {server.hostingAccount.name}</span>
                                </a>
                              ) : (
                                <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[9px] font-black uppercase leading-tight text-cyan-800 shadow-sm dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                                  <Database size={9} className="shrink-0" />
                                  <span className="min-w-0 truncate">BIL: {server.hostingAccount.name}</span>
                                </div>
                              )}

                              <button
                                onClick={() => copyToClipboard(server.hostingAccount.login, `billing-log-${server.id}`)}
                                className="flex h-9 w-[68px] shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[9px] font-mono text-slate-700 shadow-sm transition-colors hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                title="Копировать логин биллинга"
                              >
                                {copiedId === `billing-log-${server.id}` ? <Check size={10} className="text-emerald-500" /> : 'User'}
                                <Copy size={9} className="shrink-0" />
                              </button>

                              <button
                                onClick={() => copyHostingSecretToClipboard(server.hostingAccount.id, 'password', `billing-pass-${server.id}`)}
                                disabled={loadingSecretId === `billing-pass-${server.id}` || !server.hostingAccount.hasPassword}
                                className="flex h-9 w-[68px] shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[9px] font-mono text-slate-700 shadow-sm transition-colors hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                title="Копировать пароль биллинга"
                              >
                                {loadingSecretId === `billing-pass-${server.id}` ? <RefreshCw size={10} className="animate-spin text-cyan-500" /> : copiedId === `billing-pass-${server.id}` ? <Check size={10} className="text-emerald-500" /> : 'Pass'}
                                <Copy size={9} className="shrink-0" />
                              </button>

                              <div className={`flex h-9 w-[68px] shrink-0 items-center justify-center rounded-md border px-1 text-[9px] font-black uppercase leading-tight tracking-wide sm:w-[72px] ${getExpiryTone(server.billingRenewalAt)}`}>
                                {formatShortDate(server.billingRenewalAt)}
                              </div>

                              <span
                                className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-600 shadow-sm dark:border-slate-600/40 dark:bg-slate-800/60 dark:text-slate-300"
                                title={
                                  server.billingHasUnpaidOrder
                                    ? 'Выставлен счет в биллинге'
                                    : 'Оплата: обновляется при синхронизации (action=orders, окно 14 дн. по nextduedate).'
                                }
                              >
                                <DollarSign size={13} />
                                {server.billingHasUnpaidOrder ? (
                                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-red-500 dark:border-[#141820]" aria-hidden />
                                ) : null}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
                            К серверу пока не привязан биллинг. Его можно выбрать в карточке редактирования сервера.
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50 dark:bg-black/20 border-t border-slate-200 dark:border-slate-800/50 p-8 rounded-b-[32px]">
                        {currentSubTab === 'sites' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                            {sites.length === 0 && <span className="text-slate-400 text-sm">Сайты не найдены</span>}
                            {sites.map((site: string) => {
                              const siteStatus = siteStatuses[String(site).toLowerCase()] || 'unknown';
                              const isOnlineSite = siteStatus === 'online';
                              const isOfflineSite = siteStatus === 'offline';

                              return (
                                <div key={site} className="flex items-center justify-between gap-4 bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800/50 p-4 rounded-2xl group hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all shadow-sm dark:shadow-none hover:-translate-y-[1px] hover:shadow-md">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${site}&sz=32`}
                                      alt=""
                                      className="w-5 h-5 rounded-sm bg-white"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    <span className="truncate text-sm font-bold text-slate-700 dark:text-slate-300">{site}</span>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-3">
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                                      isOnlineSite
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        : isOfflineSite
                                          ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                                          : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
                                    }`}>
                                      {isOnlineSite ? 'Online' : isOfflineSite ? 'Offline' : 'Нет данных'}
                                    </span>

                                    <a href={`https://${site}`} target="_blank" className="opacity-0 group-hover:opacity-100 transition-all text-blue-500 hover:scale-110">
                                      <ExternalLink size={16} />
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {currentSubTab === 'system' && (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-6">
                                <Database size={16} /> Статус сервисов
                              </h4>
                              <div className="flex flex-col gap-4">
                                {['nginx', 'mysql', 'docker', 'apache2'].map(srv => {
                                  if (services[srv] === undefined) return null;
                                  return (
                                    <div key={srv} className="flex items-center justify-between">
                                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{srv}</span>
                                      <div className={`flex items-center gap-2 text-xs font-bold px-2.5 py-1 rounded-md ${services[srv] ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-500'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${services[srv] ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        {services[srv] ? 'Active' : 'Offline'}
                                      </div>
                                    </div>
                                  );
                                })}
                                {Object.keys(services).length === 0 && <span className="text-xs text-slate-400">Нет данных о сервисах</span>}
                              </div>
                            </div>

                            <div className="bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-6">
                                <AppWindow size={16} /> ТОП-5 Процессов (CPU)
                              </h4>
                              <div className="flex flex-col gap-3">
                                {procs.length > 0 ? procs.map((p: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate w-32">{p.name}</span>
                                    <div className="flex items-center gap-4 text-xs">
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">{p.cpu}% CPU</span>
                                      <span className="text-slate-400">{p.ram}% RAM</span>
                                    </div>
                                  </div>
                                )) : <span className="text-xs text-slate-400">Загрузка данных...</span>}
                              </div>
                            </div>

                            <div className="bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col">
                              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-6">
                                <Globe size={16} /> Сетевой трафик (Всего)
                              </h4>
                              <div className="flex-1 flex flex-col justify-center gap-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500">
                                      <ArrowDownToLine size={16} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Download</span>
                                  </div>
                                  <span className="text-xl font-black text-slate-900 dark:text-white">{(net.rx_mb / 1024).toFixed(2)} GB</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500">
                                      <ArrowUpToLine size={16} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Upload</span>
                                  </div>
                                  <span className="text-xl font-black text-slate-900 dark:text-white">{(net.tx_mb / 1024).toFixed(2)} GB</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentSubTab === 'access' && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            {(() => {
                              const panelKey = detectPanelType(server);
                              const panelMeta = PANEL_STYLES[panelKey] || PANEL_STYLES.none;
                              const panelLabel = panelKey === 'none' ? (server.panelUrl ? 'Панель' : 'Нет панели') : panelMeta.label;
                              const panelDisplay = server.panelUrl || panelLabel;
                              return (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                  <div className="bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                                    <h4 className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                      <Server size={16} /> SSH доступ
                                    </h4>
                                    <div className="space-y-3">
                                      <AccessRow label="IP" value={server.ip} copyValue={server.ip} copyKey={`srv-ip-${server.id}`} copiedId={copiedId} onCopy={copyToClipboard} />
                                      <AccessRow label="Логин" value={server.user || 'root'} copyValue={server.user || 'root'} copyKey={`srv-user-${server.id}`} copiedId={copiedId} onCopy={copyToClipboard} />
                                      <AccessRow label="Пароль" value={server.password} copyValue={server.password} copyKey={`srv-pass-${server.id}`} copiedId={copiedId} onCopy={copyToClipboard} hidden revealed={!!revealedPasswords[`ssh-${server.id}`]} onToggle={() => toggleRevealedPassword(`ssh-${server.id}`)} />
                                    </div>
                                  </div>

                                  <div className="bg-white dark:bg-[#1A1F29] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                                    <h4 className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                      <PanelTopOpen size={16} /> Панель управления
                                    </h4>
                                    <div className="mb-4">
                                      {server.panelUrl ? (
                                        <a href={server.panelUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${panelMeta.badge}`}>
                                          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-white/80 px-1 text-[10px] leading-none text-slate-700 shadow-sm dark:bg-black/20 dark:text-white">{panelMeta.icon}</span>
                                          {panelLabel}
                                          <ExternalLink size={13} />
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                          <PanelTopOpen size={13} /> {panelLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-3">
                                      <AccessRow label="Логин" value={server.panelLogin} copyValue={server.panelLogin} copyKey={`panel-login-${server.id}`} copiedId={copiedId} onCopy={copyToClipboard} />
                                      <AccessRow label="Пароль" value={server.panelPassword} copyValue={server.panelPassword} copyKey={`panel-pass-${server.id}`} copiedId={copiedId} onCopy={copyToClipboard} hidden revealed={!!revealedPasswords[`panel-${server.id}`]} onToggle={() => toggleRevealedPassword(`panel-${server.id}`)} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {currentSubTab === 'history' && (
                          <ServerHistory checks={checks} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'domains' && <DomainsTab onNavigateToServer={navigateToServer} />}

        {activeTab !== 'dashboard' && activeTab !== 'servers' && activeTab !== 'domains' && (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest text-sm">
            Раздел в разработке...
          </div>
        )}
      </main>

      <BillingManager isOpen={isBillingManagerOpen} onClose={() => setIsBillingManagerOpen(false)} onChanged={fetchServers} />

      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-900/60 dark:bg-black/80 backdrop-blur-md p-4 sm:p-8 transition-all" onClick={closeAndReset}>
          <div className="mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-2xl items-center sm:min-h-[calc(100vh-4rem)] sm:my-6">
            <div className="w-full bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-slate-800 rounded-[40px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                  {step === 'form' ? (editingServerId ? 'Редактировать сервер' : 'Добавить сервер') : 'Настройка агента'}
                </h2>
                <button
                  onClick={closeAndReset}
                  className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Название сервера</label>
                      <div className="relative">
                        <input className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 dark:text-white ${formData.name ? 'pr-14' : ''}`} placeholder="Production Node 01" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        {formData.name ? (
                          <button type="button" onClick={() => copyToClipboard(formData.name, 'srv-form-name')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-name' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">IP Адрес</label>
                      <div className="relative">
                        <input className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-mono text-slate-900 dark:text-white ${formData.ip ? 'pr-14' : ''}`} placeholder="38.180.232.137" value={formData.ip} onChange={e => setFormData({ ...formData, ip: e.target.value })} required />
                        {formData.ip ? (
                          <button type="button" onClick={() => copyToClipboard(formData.ip, 'srv-form-ip')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-ip' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">SSH пользователь</label>
                      <div className="relative">
                        <input className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-mono text-slate-900 dark:text-white ${formData.user ? 'pr-14' : ''}`} placeholder="root" value={formData.user} onChange={e => setFormData({ ...formData, user: e.target.value })} />
                        {formData.user ? (
                          <button type="button" onClick={() => copyToClipboard(formData.user, 'srv-form-user')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-user' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">SSH пароль</label>
                      <div className="relative">
                        <input type="password" className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-mono text-slate-900 dark:text-white ${formData.password ? 'pr-14' : ''}`} placeholder="необязательно" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        {formData.password ? (
                          <button type="button" onClick={() => copyToClipboard(formData.password, 'srv-form-pass')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-pass' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative z-20">
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Панель</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHostingSelectOpen(false);
                          setIsPanelSelectOpen((prev) => !prev);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between gap-3 hover:border-blue-500"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <PanelTopOpen size={16} className="shrink-0 text-slate-500" />
                          <span className="truncate">{PANEL_OPTIONS.find((o) => o.value === formData.panelType)?.label ?? 'Без панели'}</span>
                        </div>
                        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isPanelSelectOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isPanelSelectOpen && (
                        <div className="absolute left-0 right-0 top-full z-40 max-h-64 overflow-y-auto overflow-x-hidden mt-2 rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#141820]">
                          {PANEL_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, panelType: option.value });
                                setIsPanelSelectOpen(false);
                              }}
                              className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 first:rounded-t-[24px] last:rounded-b-[24px] dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <span className="flex-1 truncate">{option.label}</span>
                              {formData.panelType === option.value ? <Check size={16} className="shrink-0 text-blue-500" /> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Ссылка на панель</label>
                      <div className="relative">
                        <input type="url" className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white ${formData.panelUrl ? 'pr-14' : ''}`} placeholder="https://host:8888" value={formData.panelUrl} onChange={e => setFormData({ ...formData, panelUrl: e.target.value })} />
                        {formData.panelUrl ? (
                          <button type="button" onClick={() => copyToClipboard(formData.panelUrl, 'srv-form-panel-url')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-panel-url' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Логин панели</label>
                      <div className="relative">
                        <input className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-mono text-slate-900 dark:text-white ${formData.panelLogin ? 'pr-14' : ''}`} placeholder="admin" value={formData.panelLogin} onChange={e => setFormData({ ...formData, panelLogin: e.target.value })} />
                        {formData.panelLogin ? (
                          <button type="button" onClick={() => copyToClipboard(formData.panelLogin, 'srv-form-panel-login')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-panel-login' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Пароль панели</label>
                      <div className="relative">
                        <input type="password" className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-mono text-slate-900 dark:text-white ${formData.panelPassword ? 'pr-14' : ''}`} placeholder="необязательно" value={formData.panelPassword} onChange={e => setFormData({ ...formData, panelPassword: e.target.value })} />
                        {formData.panelPassword ? (
                          <button type="button" onClick={() => copyToClipboard(formData.panelPassword, 'srv-form-panel-pass')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400" title="Скопировать">
                            {copiedId === 'srv-form-panel-pass' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="md:col-span-2 relative">
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1">Биллинг сервера</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPanelSelectOpen(false);
                          setIsHostingSelectOpen((prev) => !prev);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between gap-3 hover:border-blue-500"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <CreditCard size={16} className={formData.hostingAccountId ? 'text-cyan-600' : 'text-slate-400'} />
                          <span className="truncate">{formData.hostingAccountId ? hostingAccounts.find((account) => account.id === formData.hostingAccountId)?.name : 'Не выбран'}</span>
                        </div>
                        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isHostingSelectOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isHostingSelectOpen && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#141820]">
                          <button
                            type="button"
                            onClick={() => { setFormData({ ...formData, hostingAccountId: '' }); setIsHostingSelectOpen(false); }}
                            className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <CreditCard size={16} className="text-slate-400" />
                            <span className="flex-1">Не выбран</span>
                            {!formData.hostingAccountId ? <Check size={16} className="text-blue-500" /> : null}
                          </button>
                          {hostingAccounts.map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => { setFormData({ ...formData, hostingAccountId: account.id }); setIsHostingSelectOpen(false); }}
                              className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {account.url ? (
                                <img src={getFaviconSrc(account.url)} alt="" className="h-4 w-4 rounded-sm bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <CreditCard size={16} className="text-cyan-500" />
                              )}
                              <span className="flex-1 truncate">{account.name}</span>
                              {formData.hostingAccountId === account.id ? <Check size={16} className="text-blue-500" /> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 p-6 rounded-[24px] font-black text-sm text-white hover:bg-blue-700 transition-all uppercase shadow-lg shadow-blue-500/20">
                    {editingServerId ? 'Сохранить' : 'Продолжить'}
                  </button>
                </form>
              ) : (
                <div className="space-y-8">
                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-6 rounded-3xl flex gap-5 items-start">
                    <Terminal className="text-blue-500 shrink-0 mt-1" size={24} />
                    <div className="w-full flex flex-col gap-2">
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Подключитесь к серверу по SSH:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-blue-700 dark:text-blue-400/80 block bg-white dark:bg-black/30 p-3 rounded-xl flex-1 border border-blue-200 dark:border-blue-500/10 font-mono">
                          ssh {formData.user || 'root'}@{formData.ip}
                        </code>
                        <button
                          onClick={() => copySshCmd(`ssh ${formData.user || 'root'}@${formData.ip}`)}
                          className="bg-blue-100 dark:bg-blue-600/20 hover:bg-blue-200 dark:hover:bg-blue-600/40 text-blue-600 dark:text-blue-500 p-3 rounded-xl transition-all border border-blue-200 dark:border-blue-500/20"
                        >
                          {copiedSsh ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest px-1 flex justify-between">
                      Команда для установки
                    </label>
                    <div className="bg-slate-50 dark:bg-black/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 h-48 overflow-y-auto font-mono text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed scrollbar-hide whitespace-pre-wrap">
                      {installScript}
                    </div>
                    <button
                      onClick={() => copyScript(installScript)}
                      className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 px-5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl"
                    >
                      {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                      {copiedScript ? 'ГОТОВО' : 'КОПИРОВАТЬ'}
                    </button>
                  </div>

                  <button
                    onClick={closeAndReset}
                    className="w-full bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20 p-6 rounded-[24px] font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-600/20 transition-all uppercase"
                  >
                    Я всё запустил, закрыть
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}