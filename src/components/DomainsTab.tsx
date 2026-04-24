'use client';

import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import {
  Globe, Plus, RefreshCw, Trash2, Server, ExternalLink, X, Database, FileCode,
  ShieldCheck, ChevronDown, ChevronUp, Info, Edit3, FolderOpen, Check, Lock,
  Copy, Cloud, Filter, CornerDownRight, ArrowRight, Link2, MessageSquare, Save, Eye, EyeOff, CalendarDays, ChevronLeft, ChevronRight, Bell, BellOff, Wifi, WifiOff, Clock3
} from 'lucide-react';

import {
  SITE_UI_REFRESH_MS,
  SiteHistory,
  checkboxBaseClass,
  checkboxCheckedStyle,
  getGroupColor,
  getLanguageItems,
  getRootLikeDomain,
  getTagColor,
  isDomainLevelRedirect,
  isSubdomainSite,
  normalizedHost,
} from './domainsTab.shared';

import { copyTextToClipboard } from '@/lib/copy-text';

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

const getDomainZone = (value?: string | null) => {
  const host = normalizeUrlForFavicon(value);
  if (!host) return '';
  const parts = host.replace(/^www\./i, '').split('.').filter(Boolean);
  if (parts.length < 2) return '';
  const last = parts[parts.length - 1].toLowerCase();
  const prev = parts[parts.length - 2].toLowerCase();
  const countrySecondLevel = new Set(['com', 'net', 'org', 'gov', 'edu', 'ac', 'co', 'nom']);

  // Compound zones like .com.de, .co.uk, etc.
  if (parts.length >= 3 && last.length === 2 && countrySecondLevel.has(prev)) {
    return `.${prev}.${last}`;
  }

  // Common delegated zones like .it.com
  if (parts.length >= 3 && ['com', 'net', 'org'].includes(last) && prev.length === 2) {
    return `.${prev}.${last}`;
  }

  return `.${last}`;
};

const isSecondLevelZone = (zone: string) =>
  zone.replace(/^\./, '').split('.').filter(Boolean).length > 1;

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${pad2(date.getFullYear() % 100)}`;
};

const parseIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDaysUntilDate = (value?: string | null) => {
  const date = parseIsoDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
};

const parseLooseWhoisDate = (raw?: string | null) => {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    direct.setHours(0, 0, 0, 0);
    return direct;
  }

  const normalized = value.replace(/[/.]/g, '-');
  const ymd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const date = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const dmy = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const date = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
};

const getExpiryBadgeClass = (value?: string | null) => {
  const days = getDaysUntilDate(value);
  if (days === null) return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  if (days < 0) return 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200';
  if (days < 7) return 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
  if (days < 30) return 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300';
  return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300';
};

const hasPublicWhoisData = (site: any) => {
  try {
    const payload = site?.whoisInfoJson ? JSON.parse(site.whoisInfoJson) : null;
    if (!payload || typeof payload !== 'object') return false;
    const ownerName = String(payload.ownerName || '').trim();
    const ownerOrg = String(payload.ownerOrganization || '').trim();
    const ownerEmail = String(payload.ownerEmail || '').trim();
    const raw = `${ownerName} ${ownerOrg} ${ownerEmail}`.toLowerCase();
    if (!raw.trim()) return false;

    const privacyPattern = /(privacy|protected|redacted|whois.?guard|gdpr|not disclosed|private|n\/a|none|hidden|proxy|contact privacy|anonym)/i;
    if (privacyPattern.test(raw)) return false;
    // Some WHOIS providers return registrar legal entity as "owner".
    const registrarEntityPattern = /(pdr ltd|publicdomainregistry\.com|publicdomainregistry|resellerclub)/i;
    if (registrarEntityPattern.test(raw)) return false;

    // IDs like SUB-1577414 usually indicate masked/pseudonymized owner in WHOIS.
    const maskedNamePattern = /^(sub|id|anon|hidden|privacy)[-_ ]?\d+$/i;
    if (ownerName && maskedNamePattern.test(ownerName)) return false;

    if (ownerEmail) return true;
    if (ownerOrg && ownerOrg.length >= 3) return true;
    if (ownerName && ownerName.length >= 4 && /[a-zа-я]/i.test(ownerName) && !/\d{4,}/.test(ownerName)) return true;
    return false;
  } catch {
    return false;
  }
};

const buildCalendarGrid = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};
export default function DomainsTab({
  onNavigateToServer,
}: {
  onNavigateToServer?: (serverId: string) => void;
}) {
  const [sites, setSites] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [cfAccounts, setCfAccounts] = useState<any[]>([]);
  const [registrarAccounts, setRegistrarAccounts] = useState<any[]>([]);
  const [hostingAccounts, setHostingAccounts] = useState<any[]>([]);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isRefreshingWhoisAll, setIsRefreshingWhoisAll] = useState(false);
  const [whoisBatchProgress, setWhoisBatchProgress] = useState({ total: 0, done: 0, assigned: 0, dateFilled: 0, failed: 0 });
  const [checkingSingleId, setCheckingSingleId] = useState<string | null>(null);
  const [networkInfoRefreshingId, setNetworkInfoRefreshingId] = useState<string | null>(null);
  const [siteCheckQueue, setSiteCheckQueue] = useState<string[]>([]);
  const [expandedSites, setExpandedSites] = useState<string[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCfFormOpen, setIsCfFormOpen] = useState(false);
  const [isCfEditorOpen, setIsCfEditorOpen] = useState(false);
  const [isRegistrarFormOpen, setIsRegistrarFormOpen] = useState(false);
  const [isRegistrarEditorOpen, setIsRegistrarEditorOpen] = useState(false);
  const [isHostingFormOpen, setIsHostingFormOpen] = useState(false);
  const [isHostingEditorOpen, setIsHostingEditorOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterZones, setFilterZones] = useState<string[]>([]);
  const [filterCfAccountId, setFilterCfAccountId] = useState('');
  const [filterRegistrarAccountId, setFilterRegistrarAccountId] = useState('');
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'month' | 'week' | 'expired' | 'none'>('all');
  const [sortConfig, setSortConfig] = useState({ key: 'url', direction: 'asc' });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);

  const [isGroupSelectOpen, setIsGroupSelectOpen] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isCfSelectOpen, setIsCfSelectOpen] = useState(false);
  const [isRegistrarSelectOpen, setIsRegistrarSelectOpen] = useState(false);
  const [cfSelectQuery, setCfSelectQuery] = useState('');
  const [registrarSelectQuery, setRegistrarSelectQuery] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [isFilterGroupOpen, setIsFilterGroupOpen] = useState(false);
  const [isFilterTagOpen, setIsFilterTagOpen] = useState(false);
  const [isFilterZoneOpen, setIsFilterZoneOpen] = useState(false);
  const [filterZoneQuery, setFilterZoneQuery] = useState('');
  const [isFilterCfOpen, setIsFilterCfOpen] = useState(false);
  const [isFilterRegistrarOpen, setIsFilterRegistrarOpen] = useState(false);
  const [isFilterExpiryOpen, setIsFilterExpiryOpen] = useState(false);

  const [hasAdmin, setHasAdmin] = useState(false);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    group: '',
    tags: '',
    tagMode: 'add' as 'add' | 'replace',
    cfAccountId: '',
    registrarAccountId: '',
    telegramNotifyMode: '' as '' | 'on' | 'off',
  });
  const [isBulkGroupOpen, setIsBulkGroupOpen] = useState(false);
  const [isBulkTagsOpen, setIsBulkTagsOpen] = useState(false);
  const [isBulkCfOpen, setIsBulkCfOpen] = useState(false);
  const [isBulkRegistrarOpen, setIsBulkRegistrarOpen] = useState(false);
  const [isFiltersPinned, setIsFiltersPinned] = useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [filterBarWidth, setFilterBarWidth] = useState<number | null>(null);
  const [filterBarLeft, setFilterBarLeft] = useState<number>(0);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    serverId: '',
    tags: '',
    group: '',
    comment: '',
    adminUrl: '',
    adminLogin: '',
    adminPassword: '',
    cfAccountId: '',
    registrarAccountId: '',
    domainExpiresAt: '',
    telegramMuted: false,
  });
  const [cfData, setCfData] = useState({ name: '', login: '', password: '', apiToken: '', apiKey: '' });
  const [editingCfAccountId, setEditingCfAccountId] = useState<string | null>(null);
  const [isSavingCf, setIsSavingCf] = useState(false);
  const [registrarData, setRegistrarData] = useState({ name: '', url: '', login: '', password: '', apiKey: '' });
  const [hostingData, setHostingData] = useState({ name: '', url: '', login: '', password: '', apiKey: '' });
  const [editingRegistrarAccountId, setEditingRegistrarAccountId] = useState<string | null>(null);
  const [editingHostingAccountId, setEditingHostingAccountId] = useState<string | null>(null);
  const [isSavingRegistrar, setIsSavingRegistrar] = useState(false);
  const [isSavingHosting, setIsSavingHosting] = useState(false);
  const [isSyncingCf, setIsSyncingCf] = useState(false);
  const [syncingCfAccountId, setSyncingCfAccountId] = useState<string | null>(null);
  const [cfSiteMeta, setCfSiteMeta] = useState<Record<string, {
    loading?: boolean;
    updating?: boolean;
    loaded?: boolean;
    devMode?: 'on' | 'off';
    error?: string | null;
  }>>({});
  const [cfSecretMasks, setCfSecretMasks] = useState({ password: false, apiToken: false, apiKey: false });
  const [registrarSecretMasks, setRegistrarSecretMasks] = useState({ password: false, apiKey: false });
  const [hostingSecretMasks, setHostingSecretMasks] = useState({ password: false, apiKey: false });
  const [cfSecretClear, setCfSecretClear] = useState({ apiToken: false, apiKey: false });
  const [registrarClearApiKey, setRegistrarClearApiKey] = useState(false);
  const [hostingClearApiKey, setHostingClearApiKey] = useState(false);
  const [openLanguagePopoverId, setOpenLanguagePopoverId] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showCfPassword, setShowCfPassword] = useState(false);
  const [showCfApiToken, setShowCfApiToken] = useState(false);
  const [showCfApiKey, setShowCfApiKey] = useState(false);
  const [showRegistrarPassword, setShowRegistrarPassword] = useState(false);
  const [showRegistrarApiKey, setShowRegistrarApiKey] = useState(false);
  const [showHostingPassword, setShowHostingPassword] = useState(false);
  const [showHostingApiKey, setShowHostingApiKey] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingSecretId, setRevealingSecretId] = useState<string | null>(null);

  const dropdownsRef = useRef<HTMLDivElement>(null);
  const siteCheckQueueRef = useRef<string[]>([]);
  const isQueueProcessingRef = useRef(false);
  const pinnedFilterBarRef = useRef<HTMLDivElement>(null);
  const serverSelectRef = useRef<HTMLDivElement>(null);
  const groupSelectRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLDivElement>(null);
  const cfSelectRef = useRef<HTMLDivElement>(null);
  const registrarSelectRef = useRef<HTMLDivElement>(null);
  const bulkGroupRef = useRef<HTMLDivElement>(null);
  const bulkTagsRef = useRef<HTMLDivElement>(null);
  const bulkCfRef = useRef<HTMLDivElement>(null);
  const bulkRegistrarRef = useRef<HTMLDivElement>(null);
  const listWrapperRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const getSiteCheckLabel = (site: any) => {
    const latestCheck = site?.checks?.[0]?.createdAt;
    if (!latestCheck) return 'без проверки';
    return new Date(latestCheck).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };


  const getAutoDomainTag = (siteUrl: string, allUrls: string[]) => {
    if (!isSubdomainSite(siteUrl)) return null;
    const host = normalizedHost(siteUrl);
    const root = getRootLikeDomain(host);
    const hasMainDomainInPanel = allUrls.some((url) => {
      const candidate = normalizedHost(url);
      if (!candidate || candidate === host) return false;
      return candidate === root || candidate === `www.${root}`;
    });
    return hasMainDomainInPanel ? 'Поддомен' : 'Домен 2 ур.';
  };

  const siteHostsSet = useMemo(
    () => new Set(sites.map((site) => normalizedHost(site.url)).filter(Boolean)),
    [sites]
  );

  const shouldIgnoreRegistrarForSite = (siteLike: { url?: string | null } | null | undefined) => {
    const siteUrl = String(siteLike?.url || '').trim();
    if (!siteUrl || !isSubdomainSite(siteUrl)) return false;
    const host = normalizedHost(siteUrl);
    if (!host) return false;
    const root = getRootLikeDomain(host);
    if (!root || root === host) return false;
    return siteHostsSet.has(root) || siteHostsSet.has(`www.${root}`);
  };

  const getEffectiveRegistrarAccountId = (site: any) => {
    if (shouldIgnoreRegistrarForSite(site)) return '';
    return site?.registrarAccountId || '';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      setOpenLanguagePopoverId(null);
      const insideNormalFilterBar = filterBarRef.current?.contains(target) || false;
      const insidePinnedFilterBar = pinnedFilterBarRef.current?.contains(target) || false;
      if (!insideNormalFilterBar && !insidePinnedFilterBar) {
        setIsFilterGroupOpen(false);
        setIsFilterTagOpen(false);
        setIsFilterZoneOpen(false);
        setFilterZoneQuery('');
        setIsFilterCfOpen(false);
        setIsFilterRegistrarOpen(false);
        setIsFilterExpiryOpen(false);
      }

      if (serverSelectRef.current && !serverSelectRef.current.contains(target)) {
        setIsSelectOpen(false);
      }

      if (groupSelectRef.current && !groupSelectRef.current.contains(target)) {
        setIsGroupSelectOpen(false);
      }

      if (tagInputRef.current && !tagInputRef.current.contains(target)) {
        setIsTagInputOpen(false);
      }

      if (cfSelectRef.current && !cfSelectRef.current.contains(target)) {
        setIsCfSelectOpen(false);
        setCfSelectQuery('');
      }

      if (registrarSelectRef.current && !registrarSelectRef.current.contains(target)) {
        setIsRegistrarSelectOpen(false);
        setRegistrarSelectQuery('');
      }

      if (bulkGroupRef.current && !bulkGroupRef.current.contains(target)) {
        setIsBulkGroupOpen(false);
      }

      if (bulkTagsRef.current && !bulkTagsRef.current.contains(target)) {
        setIsBulkTagsOpen(false);
      }

      if (bulkCfRef.current && !bulkCfRef.current.contains(target)) {
        setIsBulkCfOpen(false);
      }

      if (bulkRegistrarRef.current && !bulkRegistrarRef.current.contains(target)) {
        setIsBulkRegistrarOpen(false);
      }

      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFormOpen(false);
      setShowAdminPassword(false);
      setIsCfFormOpen(false);
      setIsRegistrarFormOpen(false);
      setIsHostingFormOpen(false);
      setIsBulkEditOpen(false);
      setIsRegistrarEditorOpen(false);
      setIsHostingEditorOpen(false);
      setEditingSite(null);
      setIsBulkGroupOpen(false);
      setIsBulkTagsOpen(false);
      setIsBulkCfOpen(false);
      setIsBulkRegistrarOpen(false);
      setIsGroupSelectOpen(false);
      setIsSelectOpen(false);
      setIsCfSelectOpen(false);
      setIsRegistrarSelectOpen(false);
      setCfSelectQuery('');
      setRegistrarSelectQuery('');
      setIsFilterGroupOpen(false);
      setIsFilterTagOpen(false);
      setIsFilterZoneOpen(false);
      setFilterZoneQuery('');
      setIsFilterCfOpen(false);
      setIsFilterRegistrarOpen(false);
      setIsFilterExpiryOpen(false);
      setIsTagInputOpen(false);
      setOpenLanguagePopoverId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [sitesRes, serversRes, cfRes, registrarsRes, hostingsRes] = await Promise.all([
        fetch(`/api/sites?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/servers?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/cloudflare?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/registrars?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/hostings?t=${ts}`, { cache: 'no-store' }),
      ]);

      if (sitesRes.ok) setSites(await sitesRes.json());
      if (serversRes.ok) setServers(await serversRes.json());
      if (cfRes.ok) setCfAccounts(await cfRes.json());
      if (registrarsRes.ok) setRegistrarAccounts(await registrarsRes.json());
      if (hostingsRes.ok) setHostingAccounts(await hostingsRes.json());
    } catch (e) {
      console.error('Ошибка загрузки данных', e);
    }
  };

  const refreshNetworkInfo = async (id: string) => {
    setNetworkInfoRefreshingId(id);
    try {
      const res = await fetch('/api/sites/refresh-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await res.json();
        await fetchData();
      }
    } catch (e) {
      console.error('refreshNetworkInfo', e);
    } finally {
      setNetworkInfoRefreshingId(null);
    }
  };

  useEffect(() => {
    fetchData();

    const refreshTimer = setInterval(() => {
      fetchData();
    }, SITE_UI_REFRESH_MS);

    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const onFocus = () => fetchData();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const cloudflareSites = sites.filter((site) => !!site.cfAccount);
    if (!cloudflareSites.length) return;

    cloudflareSites.forEach((site) => {
      const meta = cfSiteMeta[site.id];
      if (meta?.loading || meta?.updating) return;
      if (!meta?.loaded || meta?.error) {
        loadCfSiteMeta(site.id);
      }
    });
  }, [sites]);

  const runQueuedCheck = async (id: string) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      await fetch('/api/sites/check-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, queued: true }),
        signal: controller.signal,
      });
    } catch (error) {
      console.error('Ошибка ручной проверки сайта', error);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const processSiteQueue = async () => {
    if (isQueueProcessingRef.current) return;
    isQueueProcessingRef.current = true;

    try {
      while (siteCheckQueueRef.current.length > 0) {
        const nextId = siteCheckQueueRef.current[0];
        setCheckingSingleId(nextId);
        await runQueuedCheck(nextId);
        await fetchData();

        const nextQueue = siteCheckQueueRef.current.filter((id) => id !== nextId);
        siteCheckQueueRef.current = nextQueue;
        setSiteCheckQueue(nextQueue);
      }
    } finally {
      setCheckingSingleId(null);
      isQueueProcessingRef.current = false;
      setIsCheckingAll(false);
    }
  };

  const enqueueSiteChecks = (ids: string[], markAll = false) => {
    if (!ids.length) return;
    const nextQueue = Array.from(new Set([...siteCheckQueueRef.current, ...ids]));
    siteCheckQueueRef.current = nextQueue;
    setSiteCheckQueue(nextQueue);
    if (markAll) setIsCheckingAll(true);
    window.setTimeout(() => {
      processSiteQueue().catch((error) => console.error('Queue process failed', error));
    }, 0);
  };

  const checkAllSitesSequentially = async () => {
    const ids = sortedSites.map((site) => site.id);
    enqueueSiteChecks(ids, true);
  };

  const refreshWhoisForUnassigned = async () => {
    const targetIds = sites
      .filter((site) => !shouldIgnoreRegistrarForSite(site))
      .filter((site) => !site.registrarAccountId)
      .map((site) => site.id);
    if (targetIds.length === 0) {
      alert('Нет сайтов без привязанного регистратора');
      return;
    }

    setIsRefreshingWhoisAll(true);
    setWhoisBatchProgress({ total: targetIds.length, done: 0, assigned: 0, dateFilled: 0, failed: 0 });
    try {
      let assigned = 0;
      let dateFilled = 0;
      let failed = 0;

      for (let i = 0; i < targetIds.length; i += 1) {
        const siteId = targetIds[i];
        try {
          const res = await fetch('/api/sites/refresh-whois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: siteId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'WHOIS refresh failed');
          assigned += Number(data?.assigned || 0);
          dateFilled += Number(data?.dateFilled || 0);
        } catch {
          failed += 1;
        }

        setWhoisBatchProgress({
          total: targetIds.length,
          done: i + 1,
          assigned,
          dateFilled,
          failed,
        });

        if ((i + 1) % 5 === 0) {
          await fetchData();
        }
      }

      await fetchData();
      alert(`WHOIS обновление завершено.\nПроверено: ${targetIds.length}\nАвтопривязано регистраторов: ${assigned}\nЗаполнено дат: ${dateFilled}\nОшибок: ${failed}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось обновить WHOIS');
    } finally {
      setIsRefreshingWhoisAll(false);
      setTimeout(() => setWhoisBatchProgress({ total: 0, done: 0, assigned: 0, dateFilled: 0, failed: 0 }), 1500);
    }
  };

  const checkSingleSite = async (id: string) => {
    enqueueSiteChecks([id]);
  };

  const toggleSiteHistory = (id: string) => {
    setExpandedSites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const copyToClipboard = async (text: string | null | undefined, id: string) => {
    if (!text) return;
    try {
      await copyTextToClipboard(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Не удалось скопировать в буфер обмена', error);
      alert('Не удалось скопировать в буфер обмена');
    }
  };

  const fetchSecretValue = async (siteId: string, secretType: 'adminPassword' | 'cfPassword') => {
    const res = await fetch(`/api/sites/secret?siteId=${siteId}&secretType=${secretType}`, {
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Не удалось получить пароль');
    }

    return data.secret as string;
  };

  const copySecretToClipboard = async (siteId: string, secretType: 'adminPassword' | 'cfPassword', id: string) => {
    setLoadingSecretId(id);
    try {
      const secret = await fetchSecretValue(siteId, secretType);
      await copyToClipboard(secret, id);
    } catch (error) {
      console.error('Ошибка копирования пароля', error);
      alert(error instanceof Error ? error.message : 'Не удалось получить пароль');
    } finally {
      setLoadingSecretId(null);
    }
  };

  const fetchCfSecretValue = async (accountId: string, secretType: 'password' | 'apiToken' | 'apiKey') => {
    const res = await fetch(`/api/cloudflare/secret?accountId=${accountId}&secretType=${secretType}`, {
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Не удалось получить секрет Cloudflare');
    }

    return data.secret as string;
  };

  const copyCfSecretToClipboard = async (accountId: string, secretType: 'password' | 'apiToken' | 'apiKey', id: string) => {
    setLoadingSecretId(id);
    try {
      const secret = await fetchCfSecretValue(accountId, secretType);
      await copyToClipboard(secret, id);
    } catch (error) {
      console.error('Ошибка копирования секрета Cloudflare', error);
      alert(error instanceof Error ? error.message : 'Не удалось получить секрет Cloudflare');
    } finally {
      setLoadingSecretId(null);
    }
  };


  const fetchRegistrarSecretValue = async (accountId: string, secretType: 'password' | 'apiKey') => {
      const res = await fetch(`/api/registrars/secret?accountId=${accountId}&secretType=${secretType}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось получить секрет регистратора');
    return data.secret as string;
  };

  const fetchHostingSecretValue = async (accountId: string, secretType: 'password' | 'apiKey') => {
    const res = await fetch(`/api/hostings/secret?accountId=${accountId}&secretType=${secretType}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Не удалось получить секрет хостинга');
    return data.secret as string;
  };

  const copyRegistrarSecretToClipboard = async (accountId: string, secretType: 'password' | 'apiKey', id: string) => {
    setLoadingSecretId(id);
    try {
      const secret = await fetchRegistrarSecretValue(accountId, secretType);
      await copyToClipboard(secret, id);
    } catch (error) {
      console.error('Ошибка копирования секрета регистратора', error);
      alert(error instanceof Error ? error.message : 'Не удалось получить секрет регистратора');
    } finally {
      setLoadingSecretId((prev) => (prev === id ? null : prev));
    }
  };

  const copyHostingSecretToClipboard = async (accountId: string, secretType: 'password' | 'apiKey', id: string) => {
    setLoadingSecretId(id);
    try {
      const secret = await fetchHostingSecretValue(accountId, secretType);
      await copyToClipboard(secret, id);
    } catch (error) {
      console.error('Ошибка копирования секрета хостинга', error);
      alert(error instanceof Error ? error.message : 'Не удалось получить секрет хостинга');
    } finally {
      setLoadingSecretId((prev) => (prev === id ? null : prev));
    }
  };

  const loadCfSiteMeta = async (siteId: string) => {
    setCfSiteMeta((prev) => ({ ...prev, [siteId]: { ...prev[siteId], loading: true, error: null } }));
    try {
      const res = await fetch(`/api/cloudflare/site?siteId=${siteId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось получить данные Cloudflare по сайту');
      }

      setCfSiteMeta((prev) => ({
        ...prev,
        [siteId]: {
          loading: false,
          updating: false,
          loaded: true,
          devMode: data?.devMode?.value === 'on' ? 'on' : 'off',
          error: null,
        },
      }));
    } catch (error) {
      setCfSiteMeta((prev) => ({
        ...prev,
        [siteId]: { ...prev[siteId], loading: false, updating: false, loaded: true, error: error instanceof Error ? error.message : 'Не удалось получить данные Cloudflare' },
      }));
    }
  };

  const toggleCfDeveloperMode = async (siteId: string, enabled: boolean) => {
    setCfSiteMeta((prev) => ({ ...prev, [siteId]: { ...prev[siteId], updating: true, error: null } }));
    try {
      const res = await fetch('/api/cloudflare/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось изменить режим разработчика');
      }

      setCfSiteMeta((prev) => ({
        ...prev,
        [siteId]: {
          ...prev[siteId],
          updating: false,
          loaded: true,
          devMode: data?.devMode?.value === 'on' ? 'on' : 'off',
          error: null,
        },
      }));
    } catch (error) {
      setCfSiteMeta((prev) => ({
        ...prev,
        [siteId]: { ...prev[siteId], updating: false, error: error instanceof Error ? error.message : 'Не удалось изменить режим разработчика' },
      }));
    }
  };

  const toggleSecretVisibility = async (siteId: string, secretType: 'adminPassword' | 'cfPassword', id: string) => {
    if (revealedSecrets[id]) {
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealingSecretId(id);
    try {
      const secret = await fetchSecretValue(siteId, secretType);
      setRevealedSecrets((prev) => ({ ...prev, [id]: secret }));
    } catch (error) {
      console.error('Ошибка получения пароля', error);
      alert(error instanceof Error ? error.message : 'Не удалось получить пароль');
    } finally {
      setRevealingSecretId(null);
    }
  };

  const handleAddSite = async (e: FormEvent) => {
    e.preventDefault();

    const isEdit = !!editingSite;
    const url = '/api/sites';
    const method = isEdit ? 'PATCH' : 'POST';
    const preparedDataBase = hasAdmin
      ? formData
      : {
          ...formData,
          adminUrl: '',
          adminLogin: '',
          adminPassword: '',
        };
    const preparedData = shouldIgnoreRegistrarForSite({ url: preparedDataBase.url })
      ? { ...preparedDataBase, registrarAccountId: '' }
      : preparedDataBase;

    const body = isEdit
      ? { id: editingSite.id, hasAdmin, ...preparedData }
      : { hasAdmin, ...preparedData };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setIsFormOpen(false);
      setShowAdminPassword(false);
      setEditingSite(null);
      setFormData({
        url: '',
        serverId: '',
        tags: '',
        group: '',
        comment: '',
        adminUrl: '',
        adminLogin: '',
        adminPassword: '',
        cfAccountId: '',
        registrarAccountId: '',
        domainExpiresAt: '',
        telegramMuted: false,
      });
      setHasAdmin(false);
      fetchData();
    } else {
      alert((await res.json()).error || 'Ошибка');
    }
  };

  const resetCfForm = () => {
    setCfData({ name: '', login: '', password: '', apiToken: '', apiKey: '' });
    setEditingCfAccountId(null);
    setShowCfPassword(false);
    setShowCfApiToken(false);
    setShowCfApiKey(false);
    setCfSecretMasks({ password: false, apiToken: false, apiKey: false });
    setCfSecretClear({ apiToken: false, apiKey: false });
    setIsCfEditorOpen(false);
  };

  const handleAddCf = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingCf(true);
    try {
      const res = await fetch('/api/cloudflare', {
        method: editingCfAccountId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCfAccountId ? { id: editingCfAccountId, ...cfData, clearApiToken: cfSecretClear.apiToken, clearApiKey: cfSecretClear.apiKey } : cfData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось сохранить Cloudflare-аккаунт');
      }

      setIsCfEditorOpen(false);
      resetCfForm();
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось сохранить Cloudflare-аккаунт');
    } finally {
      setIsSavingCf(false);
    }
  };

  const openEditCfAccount = (account: any) => {
    setEditingCfAccountId(account.id);
    setCfData({
      name: account.name || '',
      login: account.login || '',
      password: '',
      apiToken: '',
      apiKey: '',
    });
    setCfSecretMasks({
      password: !!account.hasPassword,
      apiToken: !!account.hasApiToken,
      apiKey: !!account.hasApiKey,
    });
    setCfSecretClear({ apiToken: false, apiKey: false });
    setShowCfPassword(false);
    setShowCfApiToken(false);
    setShowCfApiKey(false);
    setIsCfEditorOpen(true);
  };

  const syncCloudflareAssignments = async (accountId?: string) => {
    if (accountId) {
      setSyncingCfAccountId(accountId);
    } else {
      setIsSyncingCf(true);
    }

    try {
      const res = await fetch('/api/cloudflare/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideExisting: false, accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось запустить авто-привязку Cloudflare');
      }
      await fetchData();
      const accountInfo = Array.isArray(data?.accountsChecked)
        ? data.accountsChecked.map((item: any) => `${item.name}: зон ${item.zonesCount}${item.error ? `, ошибка ${item.error}` : ''}`).join(' | ')
        : '';
      const errors = Array.isArray(data?.accountErrors) && data.accountErrors.length
        ? `
Ошибки: ${data.accountErrors.join(' | ')}`
        : '';
      const scope = accountId ? 'По аккаунту' : 'По всем аккаунтам';
      alert(`${scope}. Привязано: ${data.matched ?? 0}. Пропущено: ${data.skipped ?? 0}. Проверено сайтов: ${data.checked ?? 0}.${accountInfo ? `
${accountInfo}` : ''}${errors}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось запустить авто-привязку Cloudflare');
    } finally {
      if (accountId) {
        setSyncingCfAccountId(null);
      } else {
        setIsSyncingCf(false);
      }
    }
  };

  const deleteCfAccount = async (id: string) => {
    if (!confirm('Удалить аккаунт Cloudflare?')) return;
    await fetch(`/api/cloudflare?id=${id}`, { method: 'DELETE' });
    if (editingCfAccountId === id) resetCfForm();
    fetchData();
  };

  const resetRegistrarForm = () => {
    setRegistrarData({ name: '', url: '', login: '', password: '', apiKey: '' });
    setEditingRegistrarAccountId(null);
    setShowRegistrarPassword(false);
    setShowRegistrarApiKey(false);
    setRegistrarSecretMasks({ password: false, apiKey: false });
    setRegistrarClearApiKey(false);
    setIsRegistrarEditorOpen(false);
  };

  const handleAddRegistrar = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingRegistrar(true);
    try {
      const res = await fetch('/api/registrars', {
        method: editingRegistrarAccountId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRegistrarAccountId ? { id: editingRegistrarAccountId, ...registrarData, clearApiKey: registrarClearApiKey } : registrarData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось сохранить регистратора');
      }
      resetRegistrarForm();
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось сохранить регистратора');
    } finally {
      setIsSavingRegistrar(false);
    }
  };

  const openEditRegistrarAccount = (account: any) => {
    setEditingRegistrarAccountId(account.id);
    setRegistrarData({ name: account.name || '', url: account.url || '', login: account.login || '', password: '', apiKey: '' });
    setRegistrarSecretMasks({ password: !!account.hasPassword, apiKey: !!account.hasApiKey });
    setRegistrarClearApiKey(false);
    setShowRegistrarPassword(false);
    setShowRegistrarApiKey(false);
    setIsRegistrarEditorOpen(true);
  };

  const deleteRegistrarAccount = async (id: string) => {
    if (!confirm('Удалить регистратора?')) return;
    await fetch(`/api/registrars?id=${id}`, { method: 'DELETE' });
    if (editingRegistrarAccountId === id) resetRegistrarForm();
    fetchData();
  };

  const resetHostingForm = () => {
    setHostingData({ name: '', url: '', login: '', password: '', apiKey: '' });
    setEditingHostingAccountId(null);
    setShowHostingPassword(false);
    setShowHostingApiKey(false);
    setHostingSecretMasks({ password: false, apiKey: false });
    setHostingClearApiKey(false);
    setIsHostingEditorOpen(false);
  };

  const handleAddHosting = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingHosting(true);
    try {
      const res = await fetch('/api/hostings', {
        method: editingHostingAccountId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingHostingAccountId ? { id: editingHostingAccountId, ...hostingData, clearApiKey: hostingClearApiKey } : hostingData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось сохранить хостинг');
      }
      resetHostingForm();
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось сохранить хостинг');
    } finally {
      setIsSavingHosting(false);
    }
  };

  const openEditHostingAccount = (account: any) => {
    setEditingHostingAccountId(account.id);
    setHostingData({ name: account.name || '', url: account.url || '', login: account.login || '', password: '', apiKey: '' });
    setHostingSecretMasks({ password: !!account.hasPassword, apiKey: !!account.hasApiKey });
    setHostingClearApiKey(false);
    setShowHostingPassword(false);
    setShowHostingApiKey(false);
    setIsHostingEditorOpen(true);
  };

  const deleteHostingAccount = async (id: string) => {
    if (!confirm('Удалить хостинг?')) return;
    await fetch(`/api/hostings?id=${id}`, { method: 'DELETE' });
    if (editingHostingAccountId === id) resetHostingForm();
    fetchData();
  };

  const openEditModal = (site: any) => {
    setEditingSite(site);
    setShowAdminPassword(false);
    const tagsStr = JSON.parse(site.tags || '[]').join(', ');
    setFormData({
      url: site.url,
      serverId: site.serverId || '',
      tags: tagsStr,
      group: site.group || '',
      comment: site.comment || '',
      adminUrl: site.adminUrl || '',
      adminLogin: site.adminLogin || '',
      adminPassword: '',
      cfAccountId: site.cfAccountId || '',
      registrarAccountId: shouldIgnoreRegistrarForSite(site) ? '' : (site.registrarAccountId || ''),
      domainExpiresAt: site.domainExpiresAt ? new Date(site.domainExpiresAt).toISOString().slice(0, 10) : '',
      telegramMuted: !!site.telegramMuted,
    });
    setHasAdmin(!!site.adminUrl || !!site.adminLogin || !!site.hasAdminPassword);
    setIsFormOpen(true);
  };

  const deleteSite = async (id: string) => {
    if (!confirm('Точно удалить этот сайт из мониторинга?')) return;
    await fetch(`/api/sites?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const allTags = useMemo(() => {
    const tags = Array.from(new Set(sites.flatMap((s) => JSON.parse(s.tags || '[]')))).sort();
    return tags.filter((tag) => !['С Cloudflare', 'Cloudflare'].includes(tag));
  }, [sites]);

  const allGroups = useMemo(
    () => Array.from(new Set(sites.map((s) => s.group).filter(Boolean))).sort(),
    [sites]
  );

  const allZones = useMemo(
    () => Array.from(new Set(sites.map((s) => getDomainZone(s.url)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [sites]
  );
  const filteredZones = useMemo(() => {
    const q = filterZoneQuery.trim().toLowerCase();
    if (!q) return allZones;
    return allZones.filter((zone) => zone.toLowerCase().includes(q));
  }, [allZones, filterZoneQuery]);
  const whoisOpenCount = useMemo(
    () => sites.filter((site) => hasPublicWhoisData(site)).length,
    [sites]
  );
  const autoFilterTags = useMemo(() => {
    const base = ['Cloudflare', 'Поддомен', 'Домен 2 ур.', 'Редирект', 'С уведомлениями'];
    return whoisOpenCount > 0 ? [...base, 'WHOIS открыт'] : base;
  }, [whoisOpenCount]);
  const filteredCfAccounts = useMemo(() => {
    const q = cfSelectQuery.trim().toLowerCase();
    if (!q) return cfAccounts;
    return cfAccounts.filter((a) =>
      [a.name, a.login, a.url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [cfAccounts, cfSelectQuery]);
  const filteredRegistrarAccounts = useMemo(() => {
    const q = registrarSelectQuery.trim().toLowerCase();
    if (!q) return registrarAccounts;
    return registrarAccounts.filter((a) =>
      [a.name, a.login, a.url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [registrarAccounts, registrarSelectQuery]);
  useEffect(() => {
    if (!shouldIgnoreRegistrarForSite({ url: formData.url })) return;
    if (!formData.registrarAccountId) return;
    setFormData((prev) => ({ ...prev, registrarAccountId: '' }));
    setIsRegistrarSelectOpen(false);
    setRegistrarSelectQuery('');
  }, [formData.url, formData.registrarAccountId]);
  const cfFilterLabel = useMemo(() => {
    if (!filterCfAccountId) return 'Cloudflare';
    if (filterCfAccountId === '__none__') return 'CF: не привязан';
    return cfAccounts.find((a) => a.id === filterCfAccountId)?.name || 'Cloudflare';
  }, [filterCfAccountId, cfAccounts]);
  const registrarFilterLabel = useMemo(() => {
    if (!filterRegistrarAccountId) return 'Регистратор';
    if (filterRegistrarAccountId === '__none__') return 'REG: не привязан';
    return registrarAccounts.find((a) => a.id === filterRegistrarAccountId)?.name || 'Регистратор';
  }, [filterRegistrarAccountId, registrarAccounts]);
  useEffect(() => {
    if (filterTag === 'WHOIS открыт' && whoisOpenCount === 0) {
      setFilterTag('');
    }
  }, [filterTag, whoisOpenCount]);
  const zoneFilterLabel = useMemo(() => {
    if (filterZones.length === 0) return 'Зона';
    if (filterZones.length <= 2) return filterZones.join(', ');
    return `Зоны: ${filterZones.length}`;
  }, [filterZones]);
  const expiryFilterLabel = useMemo(() => {
    if (filterExpiry === 'month') return 'Истекает: месяц';
    if (filterExpiry === 'week') return 'Истекает: неделя';
    if (filterExpiry === 'expired') return 'Истек';
    if (filterExpiry === 'none') return 'Без даты';
    return 'Срок домена';
  }, [filterExpiry]);
  const getDomainExpirySource = (site: any): 'whois' | 'manual' | null => {
    if (!site?.domainExpiresAt) return null;
    const domainDate = parseIsoDate(site.domainExpiresAt);
    if (!domainDate) return null;
    try {
      const payload = site?.whoisInfoJson ? JSON.parse(site.whoisInfoJson) : null;
      const whoisDate = parseLooseWhoisDate(payload?.expires);
      if (!whoisDate) return 'manual';
      return whoisDate.getTime() === domainDate.getTime() ? 'whois' : 'manual';
    } catch {
      return 'manual';
    }
  };


  const redirectMeta = useMemo(() => {
    const sourceByTarget = new Map<string, any[]>();
    const targetIdByHost = new Map<string, string>();

    for (const site of sites) {
      targetIdByHost.set(site.url, site.id);
    }

    for (const site of sites) {
      const stack = JSON.parse(site.techStack || '{}');
      const redirectUrl = normalizedHost(stack.redirectUrl);
      if (!redirectUrl || redirectUrl === site.url) continue;
      const list = sourceByTarget.get(redirectUrl) || [];
      list.push({ id: site.id, url: site.url });
      sourceByTarget.set(redirectUrl, list);
    }

    return { sourceByTarget, targetIdByHost };
  }, [sites]);

  const counts = useMemo(() => ({
    total: sites.length,
    online: sites.filter((s) => s.status === 'online').length,
    offline: sites.filter((s) => s.status === 'offline').length,
    pending: sites.filter((s) => !['online', 'offline'].includes(s.status)).length,
  }), [sites]);
  const allSiteUrls = useMemo(() => sites.map((item) => item.url), [sites]);

  const toggleSiteSelection = (siteId: string) => {
    setSelectedSiteIds((prev) => prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = sortedSites.map((site) => site.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSiteIds.includes(id));
    setSelectedSiteIds(allSelected ? selectedSiteIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedSiteIds, ...visibleIds])));
  };

  const jumpToSiteCard = (siteId: string) => {
    const el = document.getElementById(`site-row-${siteId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedTargetId(siteId);
    window.setTimeout(() => setHighlightedTargetId((prev) => prev === siteId ? null : prev), 2200);
  };


  const openBulkEditModal = () => {
    if (selectedSiteIds.length === 0) return;
    const selectedSites = sites.filter((site) => selectedSiteIds.includes(site.id));
    const groups = Array.from(new Set(selectedSites.map((site) => site.group || '').filter(Boolean)));
    const cfIds = Array.from(new Set(selectedSites.map((site) => site.cfAccountId || '').filter(Boolean)));
    const registrarIds = Array.from(new Set(selectedSites.map((site) => getEffectiveRegistrarAccountId(site)).filter(Boolean)));
    const selectedTagLists = selectedSites.map((site) => JSON.parse(site.tags || '[]') as string[]);
    const commonTags = selectedTagLists.length
      ? selectedTagLists.reduce<string[]>((acc, list, index) => (
          index === 0 ? [...list] : acc.filter((tag) => list.includes(tag))
        ), [])
      : [];

    setBulkData({
      group: groups.length === 1 ? groups[0] : '',
      tags: commonTags.join(', '),
      tagMode: 'add',
      cfAccountId: cfIds.length === 1 ? cfIds[0] : '',
      registrarAccountId: registrarIds.length === 1 ? registrarIds[0] : '',
      telegramNotifyMode: '',
    });
    setIsBulkCfOpen(false);
    setIsBulkRegistrarOpen(false);
    setIsBulkEditOpen(true);
  };

  const applyBulkEdit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (selectedSiteIds.length === 0) return;
    const selectedSites = sites.filter((site) => selectedSiteIds.includes(site.id));

    try {
      await Promise.all(selectedSites.map(async (site) => {
        const currentTags = JSON.parse(site.tags || '[]');
        const newTags = bulkData.tags.split(',').map((t) => t.trim()).filter(Boolean);
        const mergedTags = bulkData.tagMode === 'replace'
          ? newTags
          : Array.from(new Set([...currentTags, ...newTags]));
        const nextCfAccountId = bulkData.cfAccountId === ''
          ? (site.cfAccountId || '')
          : (bulkData.cfAccountId === '__none__' ? '' : bulkData.cfAccountId);
        const nextRegistrarAccountId = shouldIgnoreRegistrarForSite(site)
          ? ''
          : (bulkData.registrarAccountId === ''
            ? (site.registrarAccountId || '')
            : (bulkData.registrarAccountId === '__none__' ? '' : bulkData.registrarAccountId));
        const nextTelegramMuted =
          bulkData.telegramNotifyMode === 'on'
            ? false
            : bulkData.telegramNotifyMode === 'off'
              ? true
              : Boolean(site.telegramMuted);

        await fetch('/api/sites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: site.id,
            serverId: site.serverId || '',
            group: bulkData.group || site.group || '',
            tags: mergedTags.join(', '),
            comment: site.comment || '',
            adminUrl: site.adminUrl || '',
            adminLogin: site.adminLogin || '',
            adminPassword: '',
            hasAdmin: !!site.adminUrl || !!site.adminLogin || !!site.hasAdminPassword,
            cfAccountId: nextCfAccountId,
            registrarAccountId: nextRegistrarAccountId,
            telegramMuted: nextTelegramMuted,
          }),
        });
      }));

      setIsBulkEditOpen(false);
      setIsRegistrarEditorOpen(false);
      setIsHostingEditorOpen(false);
      setIsBulkGroupOpen(false);
      setIsBulkTagsOpen(false);
      setIsBulkCfOpen(false);
      setIsBulkRegistrarOpen(false);
      setSelectedSiteIds([]);
      setBulkData({ group: '', tags: '', tagMode: 'add', cfAccountId: '', registrarAccountId: '', telegramNotifyMode: '' });
      await fetchData();
    } catch (error) {
      console.error('Bulk update failed', error);
      alert('Не удалось выполнить массовое обновление');
    }
  };

  useEffect(() => {
    const handlePinnedFilters = () => {
      if (window.innerWidth < 1024) {
        setIsFiltersPinned(false);
        setFilterBarWidth(null);
        return;
      }
      const wrapperEl = listWrapperRef.current;
      if (!wrapperEl) return;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const shouldPin = wrapperRect.top <= 12 && wrapperRect.bottom > 140;
      setIsFiltersPinned(shouldPin);
      setFilterBarWidth(wrapperRect.width - 2);
      setFilterBarLeft(wrapperRect.left + 1);
    };

    handlePinnedFilters();
    window.addEventListener('scroll', handlePinnedFilters, { passive: true });
    window.addEventListener('resize', handlePinnedFilters);
    return () => {
      window.removeEventListener('scroll', handlePinnedFilters);
      window.removeEventListener('resize', handlePinnedFilters);
    };
  }, [sites.length, searchQuery, filterGroup, filterTag, filterZones, filterCfAccountId, filterRegistrarAccountId, filterExpiry]);

  useEffect(() => {
    const handleScrollTopButton = () => {
      setShowScrollTopButton(window.scrollY > 320);
    };
    handleScrollTopButton();
    window.addEventListener('scroll', handleScrollTopButton, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollTopButton);
  }, []);

  const renderBulkBar = (fixed = false) => (
    <div className={`overflow-visible ${fixed ? 'border-b border-slate-300/90 dark:border-slate-700 bg-slate-100/95 dark:bg-slate-900/95 px-4 pt-4 pb-3' : 'border-b border-slate-300/90 dark:border-slate-700 bg-slate-100/95 dark:bg-slate-900/95 px-4 pt-4 pb-3 rounded-t-[28px]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Выбрано сайтов: {selectedSiteIds.length}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={openBulkEditModal}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase text-white shadow-lg shadow-blue-500/20"
          >
            <Save size={14} /> Массовое редактирование
          </button>
          <button
            onClick={() => setSelectedSiteIds([])}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
          >
            Сбросить
          </button>
        </div>
      </div>
    </div>
  );

  const renderFilterBar = (fixed = false) => (
    <div className={`relative z-[120] overflow-visible p-4 ${fixed ? 'bg-slate-100/95 dark:bg-slate-900/95' : 'border-b border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-[#11151d]/90 shadow-sm'} backdrop-blur-xl`}>
      <div className="relative">
        <input
          type="text"
          placeholder="Поиск по домену..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-4 pr-10 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Очистить поиск"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-slate-500 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap xl:gap-2 2xl:gap-3">
        <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 2xl:block">
          Домены: <span className="text-blue-600 dark:text-blue-400">{sortedSites.length}</span> / {sites.length}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
            onClick={() => setIsFilterGroupOpen(!isFilterGroupOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <Filter size={16} className={filterGroup ? 'text-indigo-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-28 xl:w-24 truncate ${filterGroup ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {filterGroup || 'Все группы'}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterGroupOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
              <div onClick={() => { setFilterGroup(''); setIsFilterGroupOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
              {allGroups.map((g) => (
                <div key={g} onClick={() => { setFilterGroup(g); setIsFilterGroupOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-indigo-600 dark:text-indigo-400">{g}</div>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
            onClick={() => setIsFilterTagOpen(!isFilterTagOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <Filter size={16} className={filterTag ? 'text-blue-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-28 xl:w-24 truncate ${filterTag ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {filterTag || 'Фильтр'}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterTagOpen && (
            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
              <div onClick={() => { setFilterTag(''); setIsFilterTagOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
              {autoFilterTags.map((t) => (
                <div key={t} onClick={() => { setFilterTag(t); setIsFilterTagOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">{t}</div>
              ))}
              {allTags.length > 0 && (
                <div className="mx-3 my-1 border-t border-slate-200 dark:border-slate-700" />
              )}
              {allTags.map((t) => (
                <div key={`manual-${t}`} onClick={() => { setFilterTag(t); setIsFilterTagOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">{t}</div>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
            onClick={() => setIsFilterCfOpen(!isFilterCfOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <Cloud size={16} className={filterCfAccountId ? 'text-orange-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-36 xl:w-28 truncate ${filterCfAccountId ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {cfFilterLabel}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterCfOpen && (
            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
              <div onClick={() => { setFilterCfAccountId(''); setIsFilterCfOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
              <div onClick={() => { setFilterCfAccountId('__none__'); setIsFilterCfOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">Не привязан</div>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-slate-700" />
              {cfAccounts.map((a) => (
                <div key={a.id} onClick={() => { setFilterCfAccountId(a.id); setIsFilterCfOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
            onClick={() => setIsFilterRegistrarOpen(!isFilterRegistrarOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <Link2 size={16} className={filterRegistrarAccountId ? 'text-violet-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-36 xl:w-28 truncate ${filterRegistrarAccountId ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {registrarFilterLabel}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterRegistrarOpen && (
            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
              <div onClick={() => { setFilterRegistrarAccountId(''); setIsFilterRegistrarOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
              <div onClick={() => { setFilterRegistrarAccountId('__none__'); setIsFilterRegistrarOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">Не привязан</div>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-slate-700" />
              {registrarAccounts.map((a) => (
                <div key={a.id} onClick={() => { setFilterRegistrarAccountId(a.id); setIsFilterRegistrarOpen(false); }} className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
          onClick={() => {
            setIsFilterZoneOpen((prev) => {
              const next = !prev;
              if (!next) setFilterZoneQuery('');
              return next;
            });
          }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <Globe size={16} className={filterZones.length > 0 ? 'text-emerald-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-32 xl:w-24 truncate ${filterZones.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {zoneFilterLabel}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterZoneOpen && (
            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
              <input
                type="text"
                value={filterZoneQuery}
                onChange={(e) => setFilterZoneQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Поиск зоны..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
              <div onClick={() => { setFilterZones([]); setIsFilterZoneOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
            {filteredZones.map((zone) => (
                <div
                  key={zone}
                  onClick={() => {
                    setFilterZones((prev) => prev.includes(zone) ? prev.filter((item) => item !== zone) : [...prev, zone]);
                  }}
                className={`px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between gap-3 ${isSecondLevelZone(zone) ? 'text-violet-700 dark:text-violet-300' : ''}`}
                >
                <span className="inline-flex items-center gap-2">
                  {zone}
                  {isSecondLevelZone(zone) ? (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                      2L
                    </span>
                  ) : null}
                </span>
                {filterZones.includes(zone) ? <Check size={14} className="text-emerald-500 shrink-0" /> : null}
                </div>
              ))}
            {filteredZones.length === 0 && (
              <div className="px-4 py-3 text-sm font-semibold text-slate-400">Ничего не найдено</div>
            )}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-auto">
          <div
            onClick={() => setIsFilterExpiryOpen(!isFilterExpiryOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 px-4 transition-all hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 sm:w-auto xl:px-3 xl:py-2.5 cursor-pointer"
          >
            <CalendarDays size={16} className={filterExpiry !== 'all' ? 'text-rose-500' : 'text-slate-400'} />
            <span className={`text-sm font-bold flex-1 sm:w-36 xl:w-28 truncate ${filterExpiry !== 'all' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {expiryFilterLabel}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          {isFilterExpiryOpen && (
            <div className="absolute top-full right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[160] py-1 max-h-60 overflow-y-auto animate-in fade-in">
              <div onClick={() => { setFilterExpiry('all'); setIsFilterExpiryOpen(false); }} className="px-4 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700">Сбросить фильтр</div>
              {[
                { id: 'month', label: 'Истекает в течение месяца' },
                { id: 'week', label: 'Истекает в течение недели' },
                { id: 'expired', label: 'Истек' },
                { id: 'none', label: 'Без даты' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => { setFilterExpiry(item.id as 'month' | 'week' | 'expired' | 'none'); setIsFilterExpiryOpen(false); }}
                  className="px-4 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const toggleTagInForm = (tag: string) => {
    const currentTags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    if (currentTags.includes(tag)) {
      setFormData({ ...formData, tags: currentTags.filter((t) => t !== tag).join(', ') });
    } else {
      setFormData({ ...formData, tags: [...currentTags, tag].join(', ') });
    }
  };

  const sortedSites = useMemo(() => {
    const allSiteUrls = sites.map((item) => item.url);
    const baseSites = [...sites]
      .filter((s) => s.url.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((s) => (filterGroup ? s.group === filterGroup : true))
      .filter((s) => (filterCfAccountId
        ? (filterCfAccountId === '__none__' ? !s.cfAccountId : s.cfAccountId === filterCfAccountId)
        : true))
      .filter((s) => (filterRegistrarAccountId
        ? (filterRegistrarAccountId === '__none__'
          ? !getEffectiveRegistrarAccountId(s)
          : getEffectiveRegistrarAccountId(s) === filterRegistrarAccountId)
        : true))
      .filter((s) => (filterZones.length > 0 ? filterZones.includes(getDomainZone(s.url)) : true))
      .filter((s) => {
        if (filterExpiry === 'all') return true;
        const days = getDaysUntilDate(s.domainExpiresAt);
        if (filterExpiry === 'none') return days === null;
        if (days === null) return false;
        if (filterExpiry === 'month') return days >= 0 && days <= 30;
        if (filterExpiry === 'week') return days >= 0 && days <= 7;
        return days < 0;
      });

    const matchesRedirectTag = (site: any) => {
      const tags = JSON.parse(site.tags || '[]');
      const stack = JSON.parse(site.techStack || '{}');
      const redirectHost = normalizedHost(stack.redirectUrl);
      const isDomainRedirect = isDomainLevelRedirect(stack.redirectUrl, site.url);
      const incoming = redirectMeta.sourceByTarget.get(site.url) || [];

      if (filterTag === 'Редирект') {
        return isDomainRedirect || incoming.length > 0 || tags.includes('Редирект');
      }

      if (filterTag === 'Cloudflare' || filterTag === 'С Cloudflare') {
        return Boolean(site.cfAccountId || site.cfAccount);
      }

      if (filterTag === 'Поддомен' || filterTag === 'Домен 2 ур.') {
        return getAutoDomainTag(site.url, allSiteUrls) === filterTag;
      }

      if (filterTag === 'WHOIS открыт') {
        return hasPublicWhoisData(site);
      }

      if (filterTag === 'С уведомлениями') {
        return !site.telegramMuted;
      }

      return filterTag ? tags.includes(filterTag) : true;
    };

    const filtered = baseSites.filter(matchesRedirectTag);

    const defaultSorted = filtered.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortConfig.key === 'url') {
        const rootA = getRootLikeDomain(a.url);
        const rootB = getRootLikeDomain(b.url);
        const rankA = a.url.toLowerCase() === rootA ? '0' : '1';
        const rankB = b.url.toLowerCase() === rootB ? '0' : '1';
        valA = `${rootA}|${rankA}|${a.url.toLowerCase()}`;
        valB = `${rootB}|${rankB}|${b.url.toLowerCase()}`;
      } else if (sortConfig.key === 'server') {
        valA = a.server?.name?.toLowerCase() || 'яяя';
        valB = b.server?.name?.toLowerCase() || 'яяя';
      } else if (sortConfig.key === 'status') {
        valA = a.status;
        valB = b.status;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    if (filterTag !== 'Редирект') return defaultSorted;

    const byId = new Map(defaultSorted.map((site) => [site.id, site]));
    const placed = new Set<string>();
    const ordered: any[] = [];

    const targetIds = Array.from(new Set(defaultSorted
      .filter((site) => (redirectMeta.sourceByTarget.get(site.url) || []).length > 0)
      .map((site) => site.id)))
      .sort((a, b) => {
        const siteA = byId.get(a);
        const siteB = byId.get(b);
        return (siteA?.url || '').localeCompare(siteB?.url || '');
      });

    for (const targetId of targetIds) {
      const target = byId.get(targetId);
      if (!target) continue;
      const incoming = (redirectMeta.sourceByTarget.get(target.url) || [])
        .map((source: any) => byId.get(source.id))
        .filter(Boolean)
        .sort((a: any, b: any) => a.url.localeCompare(b.url));

      incoming.forEach((source: any) => {
        if (!placed.has(source.id)) {
          ordered.push(source);
          placed.add(source.id);
        }
      });

      if (!placed.has(target.id)) {
        ordered.push(target);
        placed.add(target.id);
      }
    }

    defaultSorted.forEach((site) => {
      if (!placed.has(site.id)) ordered.push(site);
    });

    return ordered;
  }, [sites, searchQuery, filterGroup, filterTag, filterZones, filterCfAccountId, filterRegistrarAccountId, filterExpiry, sortConfig, redirectMeta]);

  const domainsForRenewalSoon = sites.filter((site) => {
    const days = getDaysUntilDate(site.domainExpiresAt);
    return days !== null && days >= 0 && days < 7;
  }).length;
  const hasDomainsForRenewalSoon = domainsForRenewalSoon > 0;
  const hasBlockingOverlayOpen =
    isFormOpen ||
    isCfFormOpen ||
    isRegistrarFormOpen ||
    isHostingFormOpen ||
    isBulkEditOpen ||
    isCfEditorOpen ||
    isRegistrarEditorOpen ||
    isHostingEditorOpen;
  const isRegistrarIgnoredInForm = shouldIgnoreRegistrarForSite({ url: formData.url });


  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20" ref={dropdownsRef}>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h2 className="mb-2 text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Домены и сайты
          </h2>
          <div className="mt-3 inline-flex flex-col gap-2 rounded-[28px] border border-slate-200 bg-white/85 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Globe size={12} className="text-slate-400" />
                Всего: <span className="text-slate-900 dark:text-white">{counts.total}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wifi size={12} className="text-emerald-500" />
                Online: <span className="text-emerald-500">{counts.online}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <WifiOff size={12} className="text-red-500" />
                Offline: <span className="text-red-500">{counts.offline}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={12} className="text-amber-500" />
                Ожидание: <span className="text-amber-500">{counts.pending}</span>
              </span>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${hasDomainsForRenewalSoon ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
              <Bell size={12} className={hasDomainsForRenewalSoon ? 'text-rose-500' : 'text-emerald-500'} />
              <span>На продление до 7 дней:</span>
              <span className={hasDomainsForRenewalSoon ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{domainsForRenewalSoon}</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[520px] self-end rounded-3xl border border-slate-200/90 bg-white/85 p-2.5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70">
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => { resetCfForm(); setIsCfFormOpen(true); }}
                className="w-full flex h-11 items-center justify-center gap-2 bg-orange-50 dark:bg-orange-500/10 text-orange-600 border border-orange-200 dark:border-orange-500/20 p-3 px-4 rounded-2xl shadow-sm hover:bg-orange-100 transition-colors"
              >
                <Cloud size={14} />
                <span className="text-xs font-bold uppercase">Аккаунты CF</span>
              </button>

              <button
                onClick={() => { resetRegistrarForm(); setIsRegistrarFormOpen(true); }}
                className="w-full flex h-11 items-center justify-center gap-2 bg-violet-50 dark:bg-violet-500/10 text-violet-600 border border-violet-200 dark:border-violet-500/20 p-3 px-4 rounded-2xl shadow-sm hover:bg-violet-100 transition-colors"
              >
                <Link2 size={14} />
                <span className="text-xs font-bold uppercase">Регистраторы</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={refreshWhoisForUnassigned}
                disabled={isRefreshingWhoisAll}
                className="w-full flex h-11 items-center justify-center gap-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 p-3 px-4 rounded-2xl shadow-sm hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={`text-violet-500 ${isRefreshingWhoisAll ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                  {isRefreshingWhoisAll
                    ? `WHOIS ${whoisBatchProgress.done}/${whoisBatchProgress.total}`
                    : 'ОБНОВИТЬ WHOIS (БЕЗ REG)'}
                </span>
              </button>

              <button
                onClick={checkAllSitesSequentially}
                disabled={isCheckingAll}
                className="w-full flex h-11 items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm hover:border-blue-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={`text-slate-500 ${isCheckingAll ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold text-blue-600 dark:text-blue-500">
                  {isCheckingAll ? 'СКАНИРОВАНИЕ...' : 'ОБНОВИТЬ ВСЕ (1/10 МИН)'}
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                setEditingSite(null);
                setShowAdminPassword(false);
                setFormData({
                  url: '',
                  serverId: '',
                  tags: '',
                  group: '',
                  comment: '',
                  adminUrl: '',
                  adminLogin: '',
                  adminPassword: '',
                  cfAccountId: '',
                  registrarAccountId: '',
                  domainExpiresAt: '',
                  telegramMuted: false,
                });
                setDatePickerMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                setHasAdmin(false);
                setIsFormOpen(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20"
            >
              <Plus size={18} /> ДОБАВИТЬ САЙТ
            </button>
          </div>
        </div>
      </header>

      <div className="hidden lg:grid grid-cols-12 gap-6 px-8 py-4 mb-4 bg-white dark:bg-[#141820] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        <div
          className="col-span-4 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors select-none"
          onClick={() => handleSort('url')}
        >
          <input
            type="checkbox"
            checked={sortedSites.length > 0 && sortedSites.every((site) => selectedSiteIds.includes(site.id))}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleSelectAllVisible()}
            className={checkboxBaseClass} style={checkboxCheckedStyle(sortedSites.length > 0 && sortedSites.every((site) => selectedSiteIds.includes(site.id)))}
          />
          Домен и метки
          {sortConfig.key === 'url'
            ? (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)
            : <span className="w-3.5" />}
        </div>

        <div
          className="col-span-3 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors select-none"
          onClick={() => handleSort('server')}
        >
          Расположение
          {sortConfig.key === 'server'
            ? (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)
            : <span className="w-3.5" />}
        </div>

        <div className="col-span-2 flex items-center gap-2 select-none">Технологии и SSL</div>

        <div
          className="col-span-2 flex items-center justify-end gap-2 cursor-pointer hover:text-blue-600 transition-colors pr-[140px] select-none"
          onClick={() => handleSort('status')}
        >
          Статус
          {sortConfig.key === 'status'
            ? (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)
            : <span className="w-3.5" />}
        </div>
      </div>

      <div ref={listWrapperRef} className="bg-white dark:bg-[#141820] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col relative">
        {isFiltersPinned && filterBarWidth && !hasBlockingOverlayOpen ? (
          <div
            ref={pinnedFilterBarRef}
            className="fixed z-[120] overflow-visible isolate rounded-[28px] border border-slate-300/95 bg-slate-100/95 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95"
            style={{ top: 12, left: filterBarLeft, width: filterBarWidth }}
          >
            {selectedSiteIds.length > 0 && renderBulkBar(true)}
            {renderFilterBar(true)}
          </div>
        ) : null}

        {selectedSiteIds.length > 0 && !isFiltersPinned && renderBulkBar()}

        <div ref={filterBarRef} className={isFiltersPinned && !hasBlockingOverlayOpen ? `pointer-events-none opacity-0 ${selectedSiteIds.length > 0 ? 'h-[252px]' : 'h-[192px]'}` : ''}>
          {renderFilterBar()}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 rounded-b-3xl">
          {sortedSites.length === 0 && (
            <div className="p-10 text-center text-slate-400 font-bold">Сайты не найдены</div>
          )}

          {sortedSites.map((site, index) => {
            const stack = JSON.parse(site.techStack || '{}');
            const tags = JSON.parse(site.tags || '[]');
            const hasWhoisOpenData = hasPublicWhoisData(site);
            const isExpanded = expandedSites.includes(site.id);
            const protocol = stack.ssl ? 'https://' : 'http://';
            const isRowChecking = checkingSingleId === site.id;
            const redirectHost = normalizedHost(stack.redirectUrl);
            const incomingRedirects = redirectMeta.sourceByTarget.get(site.url) || [];
            const redirectTargetId = redirectMeta.targetIdByHost.get(redirectHost);
            const isDomainRedirect = isDomainLevelRedirect(stack.redirectUrl, site.url);
            const isRedirectTarget = incomingRedirects.length > 0;
            const ignoreRegistrarForSite = shouldIgnoreRegistrarForSite(site);
            const computedTags = Array.from(new Set([
              ...(tags || []),
              ...(isDomainRedirect ? ['Редирект'] : []),
              ...(hasWhoisOpenData ? ['WHOIS открыт'] : []),
            ]));

            let displayRedirect = stack.redirectUrl;
            if (displayRedirect) {
              displayRedirect = String(displayRedirect);
            }

            const redirectGroupId = filterTag === 'Редирект'
              ? (isDomainRedirect ? (redirectTargetId || `dangling-${site.id}`) : isRedirectTarget ? site.id : null)
              : null;
            const prevSite = index > 0 ? sortedSites[index - 1] : null;
            const nextSite = index < sortedSites.length - 1 ? sortedSites[index + 1] : null;
            const prevStack = prevSite ? JSON.parse(prevSite.techStack || '{}') : null;
            const nextStack = nextSite ? JSON.parse(nextSite.techStack || '{}') : null;
            const prevIncoming = prevSite ? (redirectMeta.sourceByTarget.get(prevSite.url) || []) : [];
            const nextIncoming = nextSite ? (redirectMeta.sourceByTarget.get(nextSite.url) || []) : [];
            const prevRedirectGroupId = filterTag === 'Редирект' && prevSite
              ? (isDomainLevelRedirect(prevStack?.redirectUrl, prevSite.url)
                  ? (redirectMeta.targetIdByHost.get(normalizedHost(prevStack?.redirectUrl)) || `dangling-${prevSite.id}`)
                  : prevIncoming.length > 0
                    ? prevSite.id
                    : null)
              : null;
            const nextRedirectGroupId = filterTag === 'Редирект' && nextSite
              ? (isDomainLevelRedirect(nextStack?.redirectUrl, nextSite.url)
                  ? (redirectMeta.targetIdByHost.get(normalizedHost(nextStack?.redirectUrl)) || `dangling-${nextSite.id}`)
                  : nextIncoming.length > 0
                    ? nextSite.id
                    : null)
              : null;
            const isRedirectGroupStart = !!redirectGroupId && redirectGroupId !== prevRedirectGroupId;
            const isRedirectGroupEnd = !!redirectGroupId && redirectGroupId !== nextRedirectGroupId;
            const languageMeta = getLanguageItems(stack);
            return (
              <div
                key={site.id}
                id={`site-row-${site.id}`}
                className={`flex flex-col scroll-mt-36 ${isRedirectGroupStart ? 'mt-5' : ''} ${isRedirectGroupEnd ? 'mb-5 border-b-[3px] border-amber-300/80 dark:border-amber-500/40 pb-3' : ''}`}
              >
                <div
                  className={`group rounded-[inherit] p-3 transition-all sm:p-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between ${
                    filterTag === 'Редирект'
                      ? isRedirectTarget
                        ? 'w-full xl:ml-12 xl:w-[calc(100%-3rem)]'
                        : 'ml-0 w-full'
                      : 'w-full'
                  } ${
                    isRowChecking
                      ? 'bg-blue-50/80 dark:bg-blue-900/20 animate-pulse shadow-inner'
                      : highlightedTargetId === site.id
                        ? 'bg-amber-50/90 ring-2 ring-amber-300'
                        : isRedirectTarget && filterTag === 'Редирект'
                          ? 'bg-sky-100/90 ring-1 ring-sky-300 border-l-4 border-l-sky-400'
                          : filterTag === 'Редирект' && isDomainRedirect
                            ? 'bg-amber-50/90 border-l-4 border-l-amber-400 pr-2'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex w-full items-start gap-4 xl:w-[28%]">
                    <input
                      type="checkbox"
                      checked={selectedSiteIds.includes(site.id)}
                      onChange={() => toggleSiteSelection(site.id)}
                      className={`${checkboxBaseClass} mt-2`} style={checkboxCheckedStyle(selectedSiteIds.includes(site.id))}
                    />
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${site.url}&sz=32`}
                      alt=""
                      className={`mt-1 w-6 h-6 rounded shadow-sm bg-white shrink-0 ${isRowChecking ? 'animate-spin' : ''}`}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />

                    <div className="flex flex-col min-w-0">
                      {incomingRedirects.length > 0 && (
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-amber-700">
                          <Link2 size={12} className="text-amber-500" />
                          {incomingRedirects.map((source: any) => (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => jumpToSiteCard(source.id)}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 hover:bg-amber-100"
                              title={`Перейти к ${source.url}`}
                            >
                              ← {source.url}
                            </button>
                          ))}
                        </div>
                      )}

                      <a
                        href={`${protocol}${site.url}`}
                        target="_blank"
                    className="flex items-center gap-2 break-all text-lg font-bold leading-none tracking-tight text-slate-900 transition-colors hover:text-blue-500 dark:text-white sm:break-normal"
                      >
                        {site.url}
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      {(() => {
                        const autoDomainTag = getAutoDomainTag(site.url, allSiteUrls);
                        if (!autoDomainTag) return null;
                        return (
                          <div className="mt-1 inline-flex w-fit rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                            {autoDomainTag}
                          </div>
                        );
                      })()}

                      {displayRedirect && (
                        <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500 font-mono font-bold flex-wrap">
                          <CornerDownRight size={16} className="text-blue-500" />
                          <a
                            href={displayRedirect}
                            target="_blank"
                            className="truncate max-w-[240px] hover:text-blue-500 transition-colors"
                            title={displayRedirect}
                          >
                            {displayRedirect.replace(/^https?:\/\//, '')}
                          </a>
                          {redirectTargetId ? (
                            <button
                              type="button"
                              onClick={() => jumpToSiteCard(redirectTargetId)}
                              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 p-1 text-blue-600 hover:bg-blue-100"
                              title="Перейти к карточке"
                            >
                              <ArrowRight size={12} />
                            </button>
                          ) : null}
                        </div>
                      )}

                      {site.comment && (
                        <div className="mt-2 inline-flex w-fit items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <MessageSquare size={13} className="mt-0.5 text-slate-400" />
                          <span className="max-w-[320px] leading-relaxed">{site.comment}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {site.group && (
                          <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest shadow-sm ${getGroupColor(site.group)}`}>
                            {site.group}
                          </div>
                        )}

                        {computedTags.map((t: string) => (
                          <span
                            key={t}
                            className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${getTagColor(t)}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 w-full flex-col gap-2 xl:w-[6%]">
  {languageMeta.total > 0 ? (
    <div className="flex flex-wrap gap-1">
      {languageMeta.visible.map((lang) => (
        <span
          key={lang.code}
          className={`inline-flex items-center rounded-md border px-1.5 py-1 text-[10px] font-black uppercase leading-none ${
            lang.primary
              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title={lang.primary ? `${lang.title} — основной` : lang.title}
        >
          {lang.flagUrl ? <img src={lang.flagUrl} alt="" className="mr-1 inline-block h-3 w-4 rounded-[2px] object-cover align-[-1px] shadow-sm" loading="lazy" /> : null}
          {lang.short}
        </span>
      ))}

      {languageMeta.hidden.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setOpenLanguagePopoverId(site.id)}
          onMouseLeave={() => setOpenLanguagePopoverId((prev) => prev === site.id ? null : prev)}
        >
          <button
            type="button"
            onClick={() => setOpenLanguagePopoverId((prev) => prev === site.id ? null : site.id)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-black uppercase leading-none text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="Показать остальные языки"
          >
            +{languageMeta.hidden.length}
          </button>

          <div className={`${openLanguagePopoverId === site.id ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'} absolute left-0 top-[calc(100%-2px)] z-[100] transition-opacity duration-150`}>
            <div className="mt-1.5 flex max-w-[240px] min-w-[168px] flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {languageMeta.hidden.map((lang) => (
                <span
                  key={`hidden-${lang.code}`}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title={lang.title}
                >
                  {lang.flagUrl ? <img src={lang.flagUrl} alt="" className="mr-1 inline-block h-3 w-4 rounded-[2px] object-cover align-[-1px] shadow-sm" loading="lazy" /> : null}
                  {lang.short}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <span className="text-xs font-medium text-slate-400">—</span>
  )}
</div>

<div className="flex w-full flex-col gap-2 xl:w-[29%]">
  {site.server ? (
    <div
      onClick={() => onNavigateToServer && onNavigateToServer(site.server.id)}
      className="flex flex-col cursor-pointer group/server w-fit"
      title="Перейти к управлению сервером"
    >
                        <div className="flex items-center gap-2 break-words text-sm font-black uppercase tracking-wider text-blue-500 transition-colors group-hover/server:text-blue-400">
        <Server size={16} /> {site.server.name}
      </div>
      <div className="text-xs font-mono font-bold text-slate-500 pl-6 leading-none mt-1.5 group-hover/server:text-blue-400">
        {site.server.ip}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-500">
      <Globe size={16} className="text-slate-400" /> Внешний ресурс
    </div>
  )}

  <div className="mt-1 flex w-full flex-col items-start gap-1.5">
    {site.cfAccount ? (
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:whitespace-nowrap">
        <a
          href="https://dash.cloudflare.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 min-w-0 w-full flex-1 items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black uppercase text-orange-600 shadow-sm transition-colors hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20 sm:w-[calc(100%-144px)]"
          title="Открыть Cloudflare"
        >
          <Cloud size={10} className="shrink-0" />
          <span className="truncate">CF: {site.cfAccount.name}</span>
        </a>

        <button
          onClick={() => copyToClipboard(site.cfAccount.login, `cf-log-${site.id}`)}
          className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-700 shadow-sm transition-colors hover:text-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-[66px]"
          title="Копировать логин Cloudflare"
        >
          {copiedId === `cf-log-${site.id}` ? <Check size={10} className="text-emerald-500" /> : 'User'}
          <Copy size={10} className="shrink-0" />
        </button>

        <button
          onClick={() => copySecretToClipboard(site.id, 'cfPassword', `cf-pass-${site.id}`)}
          disabled={loadingSecretId === `cf-pass-${site.id}` || !site.cfAccount.hasPassword}
          className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-700 shadow-sm transition-colors hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-[66px]"
          title="Скопировать пароль Cloudflare"
        >
          {loadingSecretId === `cf-pass-${site.id}` ? <RefreshCw size={10} className="animate-spin text-orange-500" /> : copiedId === `cf-pass-${site.id}` ? <Check size={10} className="text-emerald-500" /> : 'Pass'}
          <Copy size={10} className="shrink-0" />
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={cfSiteMeta[site.id]?.devMode === 'on'}
          onClick={() => {
            const currentState = cfSiteMeta[site.id]?.devMode === 'on';
            void toggleCfDeveloperMode(site.id, !currentState);
          }}
          disabled={cfSiteMeta[site.id]?.loading || cfSiteMeta[site.id]?.updating}
          className={`relative flex h-8 w-full shrink-0 items-center rounded-md border px-1 transition-colors sm:w-[66px] ${cfSiteMeta[site.id]?.devMode === 'on' ? 'border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10' : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'} ${cfSiteMeta[site.id]?.loading || cfSiteMeta[site.id]?.updating ? 'opacity-70 cursor-wait' : ''}`}
          title={cfSiteMeta[site.id]?.devMode === 'on' ? 'Development Mode включён' : 'Development Mode выключен'}
        >
          <span
            className={`flex h-6 w-8 items-center justify-center rounded border bg-white text-[8px] font-black leading-none shadow-[0_1px_3px_rgba(15,23,42,0.14)] transition-all duration-200 ${cfSiteMeta[site.id]?.devMode === 'on' ? 'translate-x-[25px] border-orange-200 text-orange-500 dark:border-orange-400/30 dark:bg-slate-950 dark:text-orange-300' : 'translate-x-0 border-slate-200 text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
          >
            {cfSiteMeta[site.id]?.loading || cfSiteMeta[site.id]?.updating ? '…' : '</>'}
          </span>
        </button>
      </div>
    ) : null}

      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:whitespace-nowrap">
      {!ignoreRegistrarForSite && (
        <>
          {site.registrarAccount ? (
            <>
              {site.registrarAccount.url ? (
                <a
                  href={site.registrarAccount.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 min-w-0 w-full flex-1 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-600 shadow-sm transition-colors hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20 sm:w-[calc(100%-144px)]"
                  title="Открыть регистратора"
                >
                  <Link2 size={10} className="shrink-0" />
                  <span className="truncate">REG: {site.registrarAccount.name}</span>
                </a>
              ) : (
                <div className="flex min-w-0 w-full flex-1 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-600 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 sm:w-[calc(100%-144px)]">
                  <Link2 size={10} className="shrink-0" />
                  <span className="truncate">REG: {site.registrarAccount.name}</span>
                </div>
              )}

              <button
                onClick={() => copyToClipboard(site.registrarAccount.login, `reg-log-${site.id}`)}
                className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-700 shadow-sm transition-colors hover:text-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-[66px]"
                title="Копировать логин регистратора"
              >
                {copiedId === `reg-log-${site.id}` ? <Check size={10} className="text-emerald-500" /> : 'User'}
                <Copy size={10} className="shrink-0" />
              </button>

              <button
                onClick={() => copyRegistrarSecretToClipboard(site.registrarAccount.id, 'password', `reg-pass-${site.id}`)}
                disabled={loadingSecretId === `reg-pass-${site.id}` || !site.registrarAccount.hasPassword}
                className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-700 shadow-sm transition-colors hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-[66px]"
                title="Копировать пароль регистратора"
              >
                {loadingSecretId === `reg-pass-${site.id}` ? <RefreshCw size={10} className="animate-spin text-violet-500" /> : copiedId === `reg-pass-${site.id}` ? <Check size={10} className="text-emerald-500" /> : 'Pass'}
                <Copy size={10} className="shrink-0" />
              </button>
            </>
          ) : (
            <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-500">
              <Link2 size={10} className="shrink-0" />
              <span className="truncate">REG: не привязан</span>
            </div>
          )}
        </>
      )}

      <div className={`relative flex h-8 ${ignoreRegistrarForSite ? 'w-full' : 'w-full sm:w-[66px] sm:shrink-0'} items-center justify-center rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${getExpiryBadgeClass(site.domainExpiresAt)}`}>
        {site.domainExpiresAt ? new Date(site.domainExpiresAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
        {site.domainExpiresAt ? (
          <span
            className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              getDomainExpirySource(site) === 'whois' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            title={getDomainExpirySource(site) === 'whois' ? 'Дата из WHOIS' : 'Дата заполнена вручную'}
          />
        ) : null}
      </div>
    </div>
  </div>
</div>

                  <div className="ml-0 flex w-full flex-col gap-2 xl:ml-5 xl:w-[16%]">
                    {site.adminUrl && (
                      <div className="flex items-center gap-1.5 relative group/admin">
                        <a
                          href={site.adminUrl}
                          target="_blank"
                          className="flex items-center gap-1 text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors shadow-sm"
                        >
                          <Lock size={10} /> CMS
                        </a>

                        <button
                          onClick={() => copyToClipboard(site.adminLogin, `adm-log-${site.id}`)}
                          className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:text-blue-500 transition-colors shadow-sm"
                          title="Копировать Логин"
                        >
                          {copiedId === `adm-log-${site.id}`
                            ? <Check size={10} className="inline text-emerald-500" />
                            : 'User'} <Copy size={10} className="inline ml-0.5" />
                        </button>

                        {site.hasAdminPassword ? (
                          <button
                            onClick={() => copySecretToClipboard(site.id, 'adminPassword', `adm-pass-${site.id}`)}
                            disabled={loadingSecretId === `adm-pass-${site.id}`}
                            className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:text-blue-500 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait"
                            title="Копировать пароль"
                          >
                            {loadingSecretId === `adm-pass-${site.id}` ? (
                              <RefreshCw size={10} className="inline animate-spin text-blue-500" />
                            ) : copiedId === `adm-pass-${site.id}` ? (
                              <Check size={10} className="inline text-emerald-500" />
                            ) : (
                              <>Copy <Copy size={10} className="inline ml-0.5" /></>
                            )}
                          </button>
                        ) : (
                          <span
                            className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 shadow-sm"
                            title="Пароль не заполнен"
                          >
                            Pass empty
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 items-center">
                      {stack.wordpress && (
                        <span className="bg-[#e0f0ff] text-[#0073AA] border-[#0073AA]/20 dark:bg-[#0073AA]/20 dark:text-[#68b3d3] border text-[9px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.158 12.786l-2.698 7.84c.806.236 1.657.365 2.54.365 1.047 0 2.051-.18 2.986-.51-.024-.037-.046-.078-.065-.123l-2.763-7.57zM3.007 12c0 3.568 2.06 6.644 5.082 8.169l2.794-7.766C9.9 11.233 9.38 10.601 9.38 9.615c0-.687.279-1.393.635-1.921l-3.322 9.171C4.306 15.342 3.007 13.753 3.007 12zm13.15 1.037c0-1.63-.586-2.612-1.394-3.528-.857-.962-1.688-1.91-1.688-3.197 0-1.353 1.054-2.585 2.502-2.585 1.488 0 2.659 1.134 2.659 2.652 0 .044-.002.088-.005.131-.832-1.988-2.658-3.411-4.836-3.805l3.541 9.771c.712-2.146 1.096-4.471 1.096-6.902 0-.256-.008-.51-.023-.763h-.001c-.139 1.344-1.077 2.378-1.851 3.226zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22.842c-5.98 0-10.842-4.862-10.842-10.842S6.02 1.158 12 1.158s10.842 4.862 10.842 10.842-4.862 10.842-10.842 10.842z" />
                          </svg>
                          WP
                        </span>
                      )}

                      {stack.html && (
                        <span className="bg-[#fff0e5] text-[#e34f26] border-[#e34f26]/20 dark:bg-[#e34f26]/20 dark:text-[#ff7f59] border text-[9px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.212-2.352H6.276l.382 4.62 5.335 1.48 5.305-1.482.723-8.356H8.531z" />
                          </svg>
                          HTML
                        </span>
                      )}

                      {stack.php && (
                        <span className="bg-[#ebeaf6] text-[#777BB4] border-[#777BB4]/20 dark:bg-[#777BB4]/20 dark:text-[#a0a5d4] border text-[9px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                          <FileCode size={10} /> PHP{stack.phpVersion ? ` ${stack.phpVersion}` : ''}
                        </span>
                      )}

                      {stack.db && (
                        <span className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 border text-[9px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1">
                          <Database size={10} /> {String(stack.db).toUpperCase()}
                        </span>
                      )}

                      {stack.ssl && (
                        <div
                          className={`flex flex-col text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            stack.ssl.daysLeft < 7
                              ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400'
                              : stack.ssl.daysLeft < 30
                                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                          }`}
                          title={stack.ssl.issuer}
                        >
                          <div className="flex items-center gap-0.5">
                            <ShieldCheck size={8} /> {stack.ssl.daysLeft} ДН.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-col items-start gap-3 xl:w-[21%] xl:items-end">
                    {site.status === 'online' ? (
                      <div className="flex w-full flex-col items-start sm:w-auto sm:items-end">
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-md">
                          <span className="text-[12px] leading-none font-mono text-emerald-700/80 dark:text-emerald-300/80">{getSiteCheckLabel(site)}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-emerald-600 font-bold text-[13px] leading-none">Online</span>
                        </div>
                      </div>
                    ) : site.status === 'offline' ? (
                      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 dark:bg-red-500/10 px-2 py-1 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-red-600 font-bold text-xs uppercase">Offline</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">{isRowChecking ? 'Проверка...' : siteCheckQueue.includes(site.id) ? 'В очереди...' : 'Ожидание...'}</span>
                    )}

                    <div className="flex w-full items-center justify-end border-t border-slate-100 pt-2 dark:border-slate-800 sm:w-auto sm:justify-start sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2 sm:ml-2">
                      <span
                        className={`p-2.5 rounded-xl transition-all ${
                          site.telegramMuted
                            ? 'text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                            : 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                        }`}
                        title={site.telegramMuted ? 'Telegram-уведомления выключены' : 'Telegram-уведомления включены'}
                      >
                        {site.telegramMuted ? <BellOff size={14} /> : <Bell size={14} />}
                      </span>

                      <button
                        onClick={() => toggleSiteHistory(site.id)}
                        className={`p-2.5 rounded-xl transition-all ${
                          isExpanded
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                        }`}
                        title="Инфо"
                      >
                        <Info size={14} />
                      </button>

                      <button
                        onClick={() => checkSingleSite(site.id)}
                        disabled={isRowChecking}
                        className={`text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-2.5 rounded-xl transition-all ${siteCheckQueue.includes(site.id) && !isRowChecking ? 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-500/20' : ''}`}
                        title="Обновить"
                      >
                        <RefreshCw size={14} className={isRowChecking ? 'animate-spin' : ''} />
                      </button>

                      <button
                        onClick={() => openEditModal(site)}
                        className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 p-2.5 rounded-xl transition-all"
                        title="Редактировать"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => deleteSite(site.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2.5 rounded-xl transition-all"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <SiteHistory
                    checks={site.checks}
                    siteId={site.id}
                    onRefreshNetwork={refreshNetworkInfo}
                    isRefreshingNetwork={networkInfoRefreshingId === site.id}
                    site={{
                      apexARecord: site.apexARecord,
                      apexARecordSource: site.apexARecordSource,
                      apexARecordUpdatedAt: site.apexARecordUpdatedAt,
                      publicDnsInfoJson: site.publicDnsInfoJson,
                      publicDnsInfoUpdatedAt: site.publicDnsInfoUpdatedAt,
                      whoisInfoJson: site.whoisInfoJson,
                      whoisInfoUpdatedAt: site.whoisInfoUpdatedAt,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isBulkEditOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md" onClick={() => { setIsBulkEditOpen(false); setIsBulkGroupOpen(false); setIsBulkTagsOpen(false); setIsBulkCfOpen(false); setIsBulkRegistrarOpen(false); }}>
          <div className="w-full max-w-xl rounded-[36px] border border-slate-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Массовое редактирование</h3>
              <button onClick={() => { setIsBulkEditOpen(false); setIsBulkGroupOpen(false); setIsBulkTagsOpen(false); setIsBulkCfOpen(false); setIsBulkRegistrarOpen(false); }} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
            </div>
            <form onSubmit={applyBulkEdit} className="space-y-5">
              <div className="relative" ref={bulkGroupRef}>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Группа</label>
                <div className="relative">
                  <input
                    value={bulkData.group}
                    onFocus={() => setIsBulkGroupOpen(true)}
                    onChange={(e) => setBulkData({ ...bulkData, group: e.target.value })}
                    placeholder="Новая группа или оставить пусто"
                      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500 ${bulkData.group ? 'pr-20' : 'pr-10'}`}
                    />
                    {bulkData.group ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bulkData.group, 'bulk-form-group')}
                        className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                        title="Скопировать группу"
                      >
                        {copiedId === 'bulk-form-group' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    ) : null}
                  <ChevronDown onClick={() => setIsBulkGroupOpen((v) => !v)} className={`absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-transform ${isBulkGroupOpen ? 'rotate-180' : ''}`} size={16} />
                </div>
                {isBulkGroupOpen && allGroups.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {allGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onMouseDown={() => { setBulkData({ ...bulkData, group }); setIsBulkGroupOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50"
                      >
                        <FolderOpen size={14} className="text-indigo-500" /> {group}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={bulkTagsRef}>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Метки</label>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <button type="button" onClick={() => setBulkData({ ...bulkData, tagMode: 'add' })} className={`rounded-full px-3 py-1 ${bulkData.tagMode === 'add' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Добавить</button>
                    <button type="button" onClick={() => setBulkData({ ...bulkData, tagMode: 'replace' })} className={`rounded-full px-3 py-1 ${bulkData.tagMode === 'replace' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Заменить</button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    value={bulkData.tags}
                    onFocus={() => setIsBulkTagsOpen(true)}
                    onChange={(e) => setBulkData({ ...bulkData, tags: e.target.value })}
                    placeholder="tag1, tag2"
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500 ${bulkData.tags ? 'pr-20' : 'pr-10'}`}
                  />
                  {bulkData.tags ? (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bulkData.tags, 'bulk-form-tags')}
                      className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                      title="Скопировать метки"
                    >
                      {copiedId === 'bulk-form-tags' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  ) : null}
                  <ChevronDown onClick={() => setIsBulkTagsOpen((v) => !v)} className={`absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-transform ${isBulkTagsOpen ? 'rotate-180' : ''}`} size={16} />
                </div>
                {isBulkTagsOpen && allTags.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {allTags.map((tag) => {
                      const selectedTags = bulkData.tags.split(',').map((t) => t.trim()).filter(Boolean);
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={() => {
                            const nextTags = active ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
                            setBulkData({ ...bulkData, tags: nextTags.join(', ') }); setIsBulkTagsOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold hover:bg-slate-50"
                        >
                          <span>{tag}</span>
                          {active ? <Check size={14} className="text-blue-500" /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative" ref={bulkCfRef}>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Cloudflare</label>
                  <button
                    type="button"
                    onClick={() => setIsBulkCfOpen((prev) => !prev)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm font-bold outline-none transition-colors hover:border-blue-400 focus:border-blue-500"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2 truncate">
                        <Cloud size={15} className={bulkData.cfAccountId && bulkData.cfAccountId !== '__none__' ? 'text-orange-500' : 'text-slate-400'} />
                        <span className="truncate">
                          {bulkData.cfAccountId === ''
                            ? 'Не менять'
                            : bulkData.cfAccountId === '__none__'
                              ? 'Не привязан'
                              : (cfAccounts.find((a) => a.id === bulkData.cfAccountId)?.name || 'Cloudflare')}
                        </span>
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isBulkCfOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isBulkCfOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <button type="button" onMouseDown={() => { setBulkData({ ...bulkData, cfAccountId: '' }); setIsBulkCfOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                        <Cloud size={14} className="text-slate-400" /> Не менять
                      </button>
                      <button type="button" onMouseDown={() => { setBulkData({ ...bulkData, cfAccountId: '__none__' }); setIsBulkCfOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                        <Cloud size={14} className="text-slate-400" /> Не привязан
                      </button>
                      <div className="mx-3 h-px bg-slate-100" />
                      {cfAccounts.map((account) => (
                        <button key={account.id} type="button" onMouseDown={() => { setBulkData({ ...bulkData, cfAccountId: account.id }); setIsBulkCfOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                          <Cloud size={14} className="text-orange-500" /> {account.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative" ref={bulkRegistrarRef}>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Регистратор</label>
                  <button
                    type="button"
                    onClick={() => setIsBulkRegistrarOpen((prev) => !prev)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm font-bold outline-none transition-colors hover:border-violet-400 focus:border-violet-500"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2 truncate">
                        <Link2 size={15} className={bulkData.registrarAccountId && bulkData.registrarAccountId !== '__none__' ? 'text-violet-500' : 'text-slate-400'} />
                        <span className="truncate">
                          {bulkData.registrarAccountId === ''
                            ? 'Не менять'
                            : bulkData.registrarAccountId === '__none__'
                              ? 'Не привязан'
                              : (registrarAccounts.find((a) => a.id === bulkData.registrarAccountId)?.name || 'Регистратор')}
                        </span>
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isBulkRegistrarOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isBulkRegistrarOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <button type="button" onMouseDown={() => { setBulkData({ ...bulkData, registrarAccountId: '' }); setIsBulkRegistrarOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                        <Link2 size={14} className="text-slate-400" /> Не менять
                      </button>
                      <button type="button" onMouseDown={() => { setBulkData({ ...bulkData, registrarAccountId: '__none__' }); setIsBulkRegistrarOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                        <Link2 size={14} className="text-slate-400" /> Не привязан
                      </button>
                      <div className="mx-3 h-px bg-slate-100" />
                      {registrarAccounts.map((account) => (
                        <button key={account.id} type="button" onMouseDown={() => { setBulkData({ ...bulkData, registrarAccountId: account.id }); setIsBulkRegistrarOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50">
                          <Link2 size={14} className="text-violet-500" /> {account.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Telegram-уведомления</label>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setBulkData({ ...bulkData, telegramNotifyMode: '' })}
                    className={`rounded-full px-3 py-1 ${bulkData.telegramNotifyMode === '' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                  >
                    Не менять
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkData({ ...bulkData, telegramNotifyMode: 'on' })}
                    className={`rounded-full px-3 py-1 ${bulkData.telegramNotifyMode === 'on' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                  >
                    Включить
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkData({ ...bulkData, telegramNotifyMode: 'off' })}
                    className={`rounded-full px-3 py-1 ${bulkData.telegramNotifyMode === 'off' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}
                  >
                    Выключить
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsBulkEditOpen(false); setIsBulkGroupOpen(false); setIsBulkTagsOpen(false); setIsBulkCfOpen(false); setIsBulkRegistrarOpen(false); }} className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase text-slate-600">Отмена</button>
                <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-500/20">Применить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[200] transition-all" onClick={() => { setIsFormOpen(false); setShowAdminPassword(false); setEditingSite(null); }}>
          <div className="bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-slate-800 rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                  {editingSite ? 'Настройки сайта' : 'Добавить сайт'}
                </h2>
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setShowAdminPassword(false);
                    setEditingSite(null);
                  }}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddSite} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Домен сайта
                    </label>
                    <div className="relative">
                      {formData.url ? (
                        <img
                          src={getFaviconSrc(formData.url)}
                          alt=""
                          className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 rounded bg-white shadow-sm"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : null}
                      <input
                        required
                        disabled={!!editingSite}
                        placeholder="example.com"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-900 dark:text-white disabled:opacity-50 ${formData.url ? 'pl-14 pr-12' : ''}`}
                      />
                      {formData.url ? (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.url, `site-form-url-${editingSite?.id || 'new'}`)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                          title="Скопировать домен"
                        >
                          {copiedId === `site-form-url-${editingSite?.id || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative" ref={serverSelectRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Расположение (Сервер)
                    </label>

                    <div
                      onClick={() => { if (!editingSite) setIsSelectOpen(!isSelectOpen); }}
                      className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white transition-all ${editingSite ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-blue-500'}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe size={16} className={formData.serverId ? 'text-slate-400' : 'text-blue-500'} />
                        <span className="truncate">
                          {formData.serverId ? servers.find((s) => s.id === formData.serverId)?.name : 'Внешний сайт'}
                        </span>
                      </div>
                      {!editingSite ? <ChevronDown size={16} className={`text-slate-400 transition-transform ${isSelectOpen ? 'rotate-180' : ''}`} /> : null}
                    </div>

                    {!editingSite && isSelectOpen && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                        <div
                          onClick={() => {
                            setFormData({ ...formData, serverId: '' });
                            setIsSelectOpen(false);
                          }}
                          className="p-4 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <Globe size={16} className="text-blue-500" /> Внешний сайт
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-700"></div>

                        {servers.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setFormData({ ...formData, serverId: s.id });
                              setIsSelectOpen(false);
                            }}
                            className="p-4 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <Server size={16} className="text-slate-400" /> {s.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="relative" ref={groupSelectRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Группа
                    </label>

                    <div className="relative flex items-center">
                      <input
                        value={formData.group}
                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                        placeholder="Создать или выбрать..."
                        onFocus={() => setIsGroupSelectOpen(true)}
                        className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm text-slate-900 dark:text-white ${formData.group ? 'pr-20' : 'pr-10'}`}
                      />
                      {formData.group ? (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.group, `site-form-group-${editingSite?.id || 'new'}`)}
                          className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                          title="Скопировать группу"
                        >
                          {copiedId === `site-form-group-${editingSite?.id || 'new'}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      ) : null}
                      <ChevronDown
                        onClick={() => setIsGroupSelectOpen(!isGroupSelectOpen)}
                        className={`absolute right-4 cursor-pointer text-slate-400 transition-transform ${isGroupSelectOpen ? 'rotate-180' : ''}`}
                        size={16}
                      />
                    </div>

                    {isGroupSelectOpen && allGroups.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                        {allGroups.map((g: any) => (
                          <div
                            key={g}
                            onMouseDown={() => {
                              setFormData({ ...formData, group: g });
                              setIsGroupSelectOpen(false);
                            }}
                            className="p-4 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <FolderOpen size={16} className="text-indigo-500" /> {g}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div ref={tagInputRef} className="relative">
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Метки (через запятую)
                    </label>
                    <div className="relative">
                      <input
                        placeholder="shop, priority..."
                        value={formData.tags}
                        onFocus={() => setIsTagInputOpen(true)}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl outline-none focus:border-blue-500 text-sm text-slate-900 dark:text-white ${formData.tags ? 'pr-20 font-semibold' : 'pr-11'}`}
                      />
                      {formData.tags ? (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.tags, `site-form-tags-${editingSite?.id || 'new'}`)}
                          className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                          title="Скопировать метки"
                        >
                          {copiedId === `site-form-tags-${editingSite?.id || 'new'}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      ) : null}
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    {isTagInputOpen && allTags.length > 0 && (
                      <div className="absolute top-full left-0 z-50 mt-2 max-h-48 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                        {allTags.map((tag: any) => (
                          <button
                            key={tag}
                            type="button"
                            onMouseDown={() => toggleTagInForm(tag)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold hover:bg-slate-50"
                          >
                            <span>{tag}</span>
                            {formData.tags.includes(tag) ? <Check size={14} className="text-blue-500" /> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Комментарий</label>
                  <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Любая заметка по сайту..."
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                      className={`w-full resize-y bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl outline-none focus:border-blue-500 text-sm text-slate-900 dark:text-white ${formData.comment ? 'pr-12' : ''}`}
                    />
                    {formData.comment ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.comment, `site-form-comment-${editingSite?.id || 'new'}`)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-blue-500"
                        title="Скопировать комментарий"
                      >
                        {copiedId === `site-form-comment-${editingSite?.id || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-12">
                  <div className="relative md:col-span-12" ref={cfSelectRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Cloudflare аккаунт
                    </label>

                    <div
                      onClick={() => {
                        setIsCfSelectOpen((prev) => {
                          const next = !prev;
                          if (!next) setCfSelectQuery('');
                          return next;
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl cursor-pointer flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white hover:border-blue-500 transition-all"
                    >
                      <div className="flex min-w-0 items-center gap-2 truncate">
                        <Cloud size={16} className={formData.cfAccountId ? 'text-orange-500' : 'text-slate-400'} />
                        <span className="truncate">
                          {formData.cfAccountId ? cfAccounts.find((a) => a.id === formData.cfAccountId)?.name : 'Не привязан'}
                        </span>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isCfSelectOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isCfSelectOpen && (
                      <div className="absolute top-full left-0 z-50 mt-2 w-full max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in dark:border-slate-700 dark:bg-slate-800 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <input
                            type="text"
                            value={cfSelectQuery}
                            onChange={(e) => setCfSelectQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Поиск аккаунта..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                        <div
                          onClick={() => {
                            setFormData({ ...formData, cfAccountId: '' });
                            setCfSelectQuery('');
                            setIsCfSelectOpen(false);
                          }}
                          className="p-4 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-slate-50"
                        >
                          <Cloud size={16} className="text-slate-400" /> Не привязан
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-700"></div>

                        {filteredCfAccounts.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setFormData({ ...formData, cfAccountId: a.id });
                              setCfSelectQuery('');
                              setIsCfSelectOpen(false);
                            }}
                            className="p-4 flex items-center gap-3 cursor-pointer text-sm font-bold hover:bg-slate-50"
                          >
                            <Cloud size={16} className="text-orange-500" /> {a.name}
                          </div>
                        ))}
                        {filteredCfAccounts.length === 0 && (
                          <div className="p-4 text-sm font-semibold text-slate-400">Ничего не найдено</div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isRegistrarIgnoredInForm && (
                  <div className="relative md:col-span-8" ref={registrarSelectRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">
                      Регистратор
                    </label>
                    <div
                      onClick={() => {
                        setIsRegistrarSelectOpen((prev) => {
                          const next = !prev;
                          if (!next) setRegistrarSelectQuery('');
                          return next;
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl cursor-pointer flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white hover:border-violet-500 transition-all"
                    >
                      <div className="flex min-w-0 items-center gap-2 truncate">
                        <Link2 size={16} className={formData.registrarAccountId ? 'text-violet-500' : 'text-slate-400'} />
                        <span className="truncate">
                          {formData.registrarAccountId ? registrarAccounts.find((a) => a.id === formData.registrarAccountId)?.name : 'Не привязан'}
                        </span>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isRegistrarSelectOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isRegistrarSelectOpen && (
                      <div className="absolute top-full left-0 z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in dark:border-slate-700 dark:bg-slate-800 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                          <input
                            type="text"
                            value={registrarSelectQuery}
                            onChange={(e) => setRegistrarSelectQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Поиск регистратора..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                        <div
                          onClick={() => {
                            setFormData({ ...formData, registrarAccountId: '' });
                            setRegistrarSelectQuery('');
                            setIsRegistrarSelectOpen(false);
                          }}
                          className="cursor-pointer p-4 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3"
                        >
                          <Link2 size={16} className="text-slate-400" /> Не привязан
                        </div>
                        <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
                        {filteredRegistrarAccounts.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setFormData({ ...formData, registrarAccountId: a.id });
                              setRegistrarSelectQuery('');
                              setIsRegistrarSelectOpen(false);
                            }}
                            className="cursor-pointer p-4 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3"
                          >
                            <Link2 size={16} className="text-violet-500" /> {a.name}
                          </div>
                        ))}
                        {filteredRegistrarAccounts.length === 0 && (
                          <div className="p-4 text-sm font-semibold text-slate-400">Ничего не найдено</div>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  <div className={`relative min-w-0 ${isRegistrarIgnoredInForm ? 'md:col-span-12' : 'md:col-span-4'}`} ref={datePickerRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Дата</label>
                    <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setDatePickerMonth(parseIsoDate(formData.domainExpiresAt) ? new Date(parseIsoDate(formData.domainExpiresAt)!.getFullYear(), parseIsoDate(formData.domainExpiresAt)!.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setIsDatePickerOpen((prev) => !prev); }}
                        className="min-w-0 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 pl-4 pr-12 py-4 rounded-2xl outline-none focus:border-violet-500 text-sm text-slate-900 dark:text-white flex items-center justify-between gap-3 hover:border-violet-500 transition-all"
                    >
                      <span className={formData.domainExpiresAt ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}>
                        {formData.domainExpiresAt ? formatDateInputValue(formData.domainExpiresAt) : 'дд.мм.гг'}
                      </span>
                      <CalendarDays size={16} className="shrink-0 text-violet-500" />
                    </button>
                    {formData.domainExpiresAt ? (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, domainExpiresAt: '' })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-red-400"
                        title="Очистить дату"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                    </div>

                    {isDatePickerOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-[#141820]">
                        {(() => {
                          const monthStart = new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth(), 1);
                          const calendarDays = buildCalendarGrid(monthStart);
                          const todayDate = new Date();
                          const todayIso = `${todayDate.getFullYear()}-${pad2(todayDate.getMonth() + 1)}-${pad2(todayDate.getDate())}`;
                          return (
                            <>
                              <div className="mb-4 flex items-center justify-between">
                                <button type="button" onClick={() => setDatePickerMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronLeft size={16} /></button>
                                <div className="text-sm font-black text-slate-900 capitalize dark:text-white">{monthStart.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div>
                                <button type="button" onClick={() => setDatePickerMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronRight size={16} /></button>
                              </div>
                              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => <span key={day} className="py-2">{day}</span>)}
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((date) => {
                                  const isoValue = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
                                  const isCurrentMonth = date.getMonth() === monthStart.getMonth();
                                  const isSelected = formData.domainExpiresAt === isoValue;
                                  const isToday = isoValue === todayIso;
                                  return (
                                    <button
                                      key={isoValue}
                                      type="button"
                                      onClick={() => { setFormData({ ...formData, domainExpiresAt: isoValue }); setDatePickerMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setIsDatePickerOpen(false); }}
                                      className={`h-10 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : isCurrentMonth ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800' : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/50'} ${isToday && !isSelected ? 'border border-violet-200 dark:border-violet-500/20' : ''}`}
                                    >
                                      {date.getDate()}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex items-center justify-between">
                                <button type="button" onClick={() => { setFormData({ ...formData, domainExpiresAt: '' }); setIsDatePickerOpen(false); }} className="text-xs font-black uppercase tracking-wide text-slate-400 hover:text-red-500">Очистить</button>
                                <button type="button" onClick={() => { setFormData({ ...formData, domainExpiresAt: todayIso }); setDatePickerMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setIsDatePickerOpen(false); }} className="text-xs font-black uppercase tracking-wide text-violet-600 hover:text-violet-700">Сегодня</button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                  <label className="flex items-center gap-3 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={!formData.telegramMuted}
                      onChange={() => setFormData((prev) => ({ ...prev, telegramMuted: !prev.telegramMuted }))}
                      className={checkboxBaseClass}
                      style={checkboxCheckedStyle(!formData.telegramMuted)}
                    />
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                      Отправлять Telegram-уведомления по этому сайту
                    </span>
                  </label>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Если выключить, сайт останется в мониторинге, но алерты по нему в Telegram отправляться не будут.
                  </p>
                </div>

                <div className="px-5 py-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                  <label className="flex items-center gap-3 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={hasAdmin}
                      onChange={() => {
                        const nextHasAdmin = !hasAdmin;
                        setHasAdmin(nextHasAdmin);
                        if (!nextHasAdmin) {
                          setFormData((prev) => ({
                            ...prev,
                            adminUrl: '',
                            adminLogin: '',
                            adminPassword: '',
                          }));
                        }
                      }}
                      className={checkboxBaseClass} style={checkboxCheckedStyle(hasAdmin)}
                    />
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                      Есть CMS
                    </span>
                  </label>

                  {hasAdmin && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">
                          Ссылка на вход
                        </label>
                        <div className="relative">
                        <input
                          placeholder="https://site.com/wp-admin"
                          value={formData.adminUrl}
                          onChange={(e) => setFormData({ ...formData, adminUrl: e.target.value })}
                            className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 text-sm ${formData.adminUrl ? 'pr-11' : ''}`}
                          />
                          {formData.adminUrl ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(formData.adminUrl, `site-form-admin-url-${editingSite?.id || 'new'}`)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                              title="Скопировать ссылку"
                            >
                              {copiedId === `site-form-admin-url-${editingSite?.id || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">
                          Логин
                        </label>
                        <div className="relative">
                        <input
                          placeholder="admin"
                          value={formData.adminLogin}
                          onChange={(e) => setFormData({ ...formData, adminLogin: e.target.value })}
                            className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 text-sm ${formData.adminLogin ? 'pr-11' : ''}`}
                          />
                          {formData.adminLogin ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(formData.adminLogin, `site-form-admin-login-${editingSite?.id || 'new'}`)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                              title="Скопировать логин"
                            >
                              {copiedId === `site-form-admin-login-${editingSite?.id || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                          Пароль
                        </label>
                        <div className="relative">
                          <input
                            type={showAdminPassword ? 'text' : 'password'}
                            placeholder={editingSite?.hasAdminPassword ? '••••••••••••' : 'Пароль (будет сохранён в зашифрованном виде)'}
                            value={formData.adminPassword}
                            onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 pr-20 rounded-xl outline-none focus:border-blue-500 text-sm"
                          />
                          {formData.adminPassword || (editingSite?.id && editingSite?.hasAdminPassword) ? (
                          <button
                            type="button"
                              onClick={() => {
                                if (formData.adminPassword) {
                                  void copyToClipboard(formData.adminPassword, `site-form-admin-pass-field-${editingSite?.id || 'new'}`);
                                } else if (editingSite?.id) {
                                  void copySecretToClipboard(editingSite.id, 'adminPassword', `site-form-adm-pass-${editingSite.id}`);
                                }
                              }}
                              className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                              title="Скопировать пароль"
                            >
                              {loadingSecretId === `site-form-adm-pass-${editingSite?.id}` && !formData.adminPassword ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : copiedId === `site-form-adm-pass-${editingSite?.id}` || copiedId === `site-form-admin-pass-field-${editingSite?.id || 'new'}` ? (
                                <Check size={16} className="text-emerald-500" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              const sid = editingSite?.id;
                              if (showAdminPassword) {
                                setShowAdminPassword(false);
                                if (sid && editingSite?.hasAdminPassword) {
                                  setFormData((prev) => ({ ...prev, adminPassword: '' }));
                                }
                                return;
                              }
                              if (!sid || !editingSite?.hasAdminPassword || formData.adminPassword) {
                                setShowAdminPassword(true);
                                return;
                              }
                              setLoadingSecretId('site-form-admin-reveal');
                              try {
                                const s = await fetchSecretValue(sid, 'adminPassword');
                                setFormData((prev) => ({ ...prev, adminPassword: s }));
                                setShowAdminPassword(true);
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Не удалось получить пароль');
                              } finally {
                                setLoadingSecretId(null);
                              }
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 disabled:opacity-50"
                            title={showAdminPassword ? 'Скрыть пароль' : 'Показать пароль'}
                            disabled={loadingSecretId === 'site-form-admin-reveal' || (!!editingSite?.id && loadingSecretId === `site-form-adm-pass-${editingSite.id}`)}
                          >
                            {loadingSecretId === 'site-form-admin-reveal' ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : showAdminPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 p-5 rounded-2xl font-black text-sm text-white hover:bg-blue-700 uppercase shadow-lg shadow-blue-500/20 mt-4"
                >
                  Сохранить изменения
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {isCfFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[200] transition-all" onClick={() => { setIsCfFormOpen(false); resetCfForm(); }}>
          <div className="bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                    Аккаунты Cloudflare
                  </h2>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Для авто-привязки сайтов, A-записей и режима разработчика лучше добавить API Token или Global API Key. Логин и пароль остаются для ручного хранения.
                  </p>
                </div>
                <button onClick={() => { setIsCfFormOpen(false); resetCfForm(); }} className="text-slate-400 hover:text-slate-900">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => syncCloudflareAssignments()}
                  disabled={isSyncingCf}
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-600 transition-colors hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
                >
                  {isSyncingCf ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                  Авто-привязать сайты
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isCfEditorOpen && !editingCfAccountId) {
                      resetCfForm();
                    } else {
                      resetCfForm();
                      setIsCfEditorOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
                >
                  <Plus size={14} /> Добавить новый аккаунт
                </button>

                {isCfEditorOpen ? (
                  <button
                    type="button"
                    onClick={resetCfForm}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <X size={14} /> Закрыть форму
                  </button>
                ) : null}
              </div>

              <div className="mb-2 space-y-3 max-h-[min(62vh,560px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                {cfAccounts.length === 0 && (
                  <div className="text-sm text-slate-400 text-center py-4">Нет добавленных аккаунтов</div>
                )}

                {cfAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        {a.url ? (
                          <img
                            src={getFaviconSrc(a.url)}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded bg-white shadow-sm"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                            <Link2 size={14} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{a.name}</div>
                          <div className="truncate text-xs font-mono text-slate-500">{a.login}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">Сайтов: {a.sitesCount || 0}</span>
                        {a.hasPassword ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Login pass</span> : null}
                        {a.hasApiToken ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">API token</span> : null}
                        {a.hasApiKey ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">API key</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-start">
                      <button
                        type="button"
                        onClick={() => syncCloudflareAssignments(a.id)}
                        disabled={syncingCfAccountId === a.id}
                        className="text-slate-400 hover:text-orange-500 p-2 rounded-lg hover:bg-orange-50 transition-colors disabled:cursor-wait disabled:opacity-60"
                        title="Авто-привязать сайты по этому аккаунту"
                      >
                        <RefreshCw size={16} className={syncingCfAccountId === a.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCfAccount(a)}
                        className="text-slate-400 hover:text-blue-500 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Редактировать"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => deleteCfAccount(a.id)}
                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {isCfEditorOpen && (
                <div
                  className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80"
                  onClick={resetCfForm}
                >
                  <form
                    onSubmit={handleAddCf}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-[420px] space-y-4 rounded-3xl border border-orange-200 bg-orange-50 p-6 shadow-2xl dark:border-orange-900/30 dark:bg-[#17120b]"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-widest text-orange-600">
                        {editingCfAccountId ? 'Редактировать Cloudflare-аккаунт' : 'Добавить новый аккаунт'}
                      </h3>
                      <button
                        type="button"
                        onClick={resetCfForm}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        title="Закрыть форму"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div>
                      <label htmlFor="cf-account-name" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-orange-900/70 dark:text-orange-200/90">
                        Название
                      </label>
                      <div className="relative">
                    <input
                          id="cf-account-name"
                      required
                          placeholder="Напр. Клиентский"
                      value={cfData.name}
                      onChange={(e) => setCfData({ ...cfData, name: e.target.value })}
                          className={`w-full rounded-xl border border-orange-200 bg-white p-3 text-sm outline-none focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900 ${cfData.name ? 'pr-11' : ''}`}
                        />
                        {cfData.name ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(cfData.name, `cf-form-name-${editingCfAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                            title="Скопировать название"
                          >
                            {copiedId === `cf-form-name-${editingCfAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cf-account-login" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-orange-900/70 dark:text-orange-200/90">
                        Email (логин Cloudflare)
                      </label>
                    <div className="relative">
                      <input
                          id="cf-account-login"
                        required
                          placeholder="account@email.com"
                        value={cfData.login}
                        onChange={(e) => setCfData({ ...cfData, login: e.target.value })}
                          className="w-full rounded-xl border border-orange-200 bg-white p-3 pr-11 text-sm outline-none focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900"
                      />
                      {cfData.login ? (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cfData.login, `cf-form-email-${editingCfAccountId || 'new'}`)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                          title="Скопировать email"
                        >
                          {copiedId === `cf-form-email-${editingCfAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      ) : null}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cf-account-password" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-orange-900/70 dark:text-orange-200/90">
                        Пароль Cloudflare
                      </label>
                    <div className="relative">
                      <input
                          id="cf-account-password"
                        type={showCfPassword ? 'text' : 'password'}
                        required={!editingCfAccountId}
                          placeholder={editingCfAccountId ? '' : 'Будет сохранён в зашифрованном виде'}
                        value={cfData.password || (cfSecretMasks.password ? '••••••••••' : '')}
                        onFocus={() => {
                          if (cfSecretMasks.password) {
                            setCfSecretMasks((prev) => ({ ...prev, password: false }));
                            setCfData((prev) => ({ ...prev, password: '' }));
                          }
                        }}
                        onChange={(e) => {
                          setCfSecretMasks((prev) => ({ ...prev, password: false }));
                          setCfData({ ...cfData, password: e.target.value });
                        }}
                        className="w-full rounded-xl border border-orange-200 bg-white p-3 pr-20 text-sm outline-none focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900"
                      />
                        {cfData.password || (editingCfAccountId && cfAccounts.find((item) => item.id === editingCfAccountId)?.hasPassword) ? (
                        <button
                          type="button"
                            onClick={() => {
                              if (cfData.password) {
                                void copyToClipboard(cfData.password, `cf-form-pass-field-${editingCfAccountId || 'new'}`);
                              } else if (editingCfAccountId) {
                                void copyCfSecretToClipboard(editingCfAccountId, 'password', `cf-form-pass-${editingCfAccountId}`);
                              }
                            }}
                            className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                            title="Скопировать пароль"
                          >
                            {loadingSecretId === `cf-form-pass-${editingCfAccountId}` && !cfData.password ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `cf-form-pass-${editingCfAccountId}` || copiedId === `cf-form-pass-field-${editingCfAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                          onClick={async () => {
                            const cid = editingCfAccountId;
                            if (showCfPassword) {
                              setShowCfPassword(false);
                              if (cid && cfAccounts.find((x) => x.id === cid)?.hasPassword) {
                                setCfData((p) => ({ ...p, password: '' }));
                                setCfSecretMasks((p) => ({ ...p, password: true }));
                              }
                              return;
                            }
                            if (!cid || !cfSecretMasks.password) {
                              setShowCfPassword(true);
                              return;
                            }
                            setLoadingSecretId(`cf-reveal-password-${cid}`);
                            try {
                              const s = await fetchCfSecretValue(cid, 'password');
                              setCfData((p) => ({ ...p, password: s }));
                              setCfSecretMasks((p) => ({ ...p, password: false }));
                              setShowCfPassword(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить пароль');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 disabled:opacity-50"
                        title={showCfPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          disabled={!!editingCfAccountId && loadingSecretId === `cf-reveal-password-${editingCfAccountId}`}
                        >
                          {editingCfAccountId && loadingSecretId === `cf-reveal-password-${editingCfAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showCfPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                      </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cf-account-api-token" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-orange-900/70 dark:text-orange-200/90">
                        API Token
                      </label>
                    <div className="relative">
                      <input
                          id="cf-account-api-token"
                          type={showCfApiToken ? 'text' : 'password'}
                          placeholder={editingCfAccountId ? '' : 'Необязательно: авто-проверки и Dev Mode'}
                        value={cfData.apiToken || (cfSecretMasks.apiToken ? '••••••••••' : '')}
                        onFocus={() => {
                          if (cfSecretMasks.apiToken) {
                            setCfSecretMasks((prev) => ({ ...prev, apiToken: false }));
                            setCfData((prev) => ({ ...prev, apiToken: '' }));
                          }
                        }}
                        onChange={(e) => {
                          setCfSecretMasks((prev) => ({ ...prev, apiToken: false }));
                          setCfSecretClear((prev) => ({ ...prev, apiToken: false }));
                          setCfData({ ...cfData, apiToken: e.target.value });
                        }}
                          className="w-full rounded-xl border border-orange-200 bg-white p-3 pr-28 text-sm outline-none focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900"
                      />
                        {cfData.apiToken || (editingCfAccountId && cfAccounts.find((item) => item.id === editingCfAccountId)?.hasApiToken) ? (
                        <button
                          type="button"
                            onClick={() => {
                              if (cfData.apiToken) {
                                void copyToClipboard(cfData.apiToken, `cf-form-token-field-${editingCfAccountId || 'new'}`);
                              } else if (editingCfAccountId) {
                                void copyCfSecretToClipboard(editingCfAccountId, 'apiToken', `cf-form-token-${editingCfAccountId}`);
                              }
                            }}
                            className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                            title="Скопировать API Token"
                          >
                            {loadingSecretId === `cf-form-token-${editingCfAccountId}` && !cfData.apiToken ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `cf-form-token-${editingCfAccountId}` || copiedId === `cf-form-token-field-${editingCfAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                        </button>
                      ) : null}
                      {editingCfAccountId && (cfAccounts.find((item) => item.id === editingCfAccountId)?.hasApiToken || cfData.apiToken || cfSecretMasks.apiToken) ? (
                        <button
                          type="button"
                          onClick={() => {
                              setShowCfApiToken(false);
                            setCfSecretMasks((prev) => ({ ...prev, apiToken: false }));
                            setCfSecretClear((prev) => ({ ...prev, apiToken: true }));
                            setCfData((prev) => ({ ...prev, apiToken: '' }));
                          }}
                            className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                          title="Удалить API Token"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            const cid = editingCfAccountId;
                            if (showCfApiToken) {
                              setShowCfApiToken(false);
                              if (cid && cfAccounts.find((x) => x.id === cid)?.hasApiToken) {
                                setCfData((p) => ({ ...p, apiToken: '' }));
                                setCfSecretMasks((p) => ({ ...p, apiToken: true }));
                              }
                              return;
                            }
                            if (!cid || !cfSecretMasks.apiToken) {
                              setShowCfApiToken(true);
                              return;
                            }
                            setLoadingSecretId(`cf-reveal-token-${cid}`);
                            try {
                              const s = await fetchCfSecretValue(cid, 'apiToken');
                              setCfData((p) => ({ ...p, apiToken: s }));
                              setCfSecretMasks((p) => ({ ...p, apiToken: false }));
                              setCfSecretClear((p) => ({ ...p, apiToken: false }));
                              setShowCfApiToken(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить API Token');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 disabled:opacity-50"
                          title={showCfApiToken ? 'Скрыть' : 'Показать'}
                          disabled={!!editingCfAccountId && loadingSecretId === `cf-reveal-token-${editingCfAccountId}`}
                        >
                          {editingCfAccountId && loadingSecretId === `cf-reveal-token-${editingCfAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showCfApiToken ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cf-account-api-key" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-orange-900/70 dark:text-orange-200/90">
                        Global API Key
                      </label>
                    <div className="relative">
                      <input
                          id="cf-account-api-key"
                          type={showCfApiKey ? 'text' : 'password'}
                          placeholder={editingCfAccountId ? '' : 'Необязательно, альтернатива токену'}
                        value={cfData.apiKey || (cfSecretMasks.apiKey ? '••••••••••' : '')}
                        onFocus={() => {
                          if (cfSecretMasks.apiKey) {
                            setCfSecretMasks((prev) => ({ ...prev, apiKey: false }));
                            setCfData((prev) => ({ ...prev, apiKey: '' }));
                          }
                        }}
                        onChange={(e) => {
                          setCfSecretMasks((prev) => ({ ...prev, apiKey: false }));
                          setCfSecretClear((prev) => ({ ...prev, apiKey: false }));
                          setCfData({ ...cfData, apiKey: e.target.value });
                        }}
                          className="w-full rounded-xl border border-orange-200 bg-white p-3 pr-28 text-sm outline-none focus:border-orange-500 dark:border-orange-800 dark:bg-slate-900"
                      />
                        {cfData.apiKey || (editingCfAccountId && cfAccounts.find((item) => item.id === editingCfAccountId)?.hasApiKey) ? (
                        <button
                          type="button"
                            onClick={() => {
                              if (cfData.apiKey) {
                                void copyToClipboard(cfData.apiKey, `cf-form-key-field-${editingCfAccountId || 'new'}`);
                              } else if (editingCfAccountId) {
                                void copyCfSecretToClipboard(editingCfAccountId, 'apiKey', `cf-form-key-${editingCfAccountId}`);
                              }
                            }}
                            className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500"
                            title="Скопировать Global API Key"
                          >
                            {loadingSecretId === `cf-form-key-${editingCfAccountId}` && !cfData.apiKey ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `cf-form-key-${editingCfAccountId}` || copiedId === `cf-form-key-field-${editingCfAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                        </button>
                      ) : null}
                      {editingCfAccountId && (cfAccounts.find((item) => item.id === editingCfAccountId)?.hasApiKey || cfData.apiKey || cfSecretMasks.apiKey) ? (
                        <button
                          type="button"
                          onClick={() => {
                              setShowCfApiKey(false);
                            setCfSecretMasks((prev) => ({ ...prev, apiKey: false }));
                            setCfSecretClear((prev) => ({ ...prev, apiKey: true }));
                            setCfData((prev) => ({ ...prev, apiKey: '' }));
                          }}
                            className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                          title="Удалить Global API Key"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            const cid = editingCfAccountId;
                            if (showCfApiKey) {
                              setShowCfApiKey(false);
                              if (cid && cfAccounts.find((x) => x.id === cid)?.hasApiKey) {
                                setCfData((p) => ({ ...p, apiKey: '' }));
                                setCfSecretMasks((p) => ({ ...p, apiKey: true }));
                              }
                              return;
                            }
                            if (!cid || !cfSecretMasks.apiKey) {
                              setShowCfApiKey(true);
                              return;
                            }
                            setLoadingSecretId(`cf-reveal-key-${cid}`);
                            try {
                              const s = await fetchCfSecretValue(cid, 'apiKey');
                              setCfData((p) => ({ ...p, apiKey: s }));
                              setCfSecretMasks((p) => ({ ...p, apiKey: false }));
                              setCfSecretClear((p) => ({ ...p, apiKey: false }));
                              setShowCfApiKey(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить Global API Key');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 disabled:opacity-50"
                          title={showCfApiKey ? 'Скрыть' : 'Показать'}
                          disabled={!!editingCfAccountId && loadingSecretId === `cf-reveal-key-${editingCfAccountId}`}
                        >
                          {editingCfAccountId && loadingSecretId === `cf-reveal-key-${editingCfAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showCfApiKey ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed text-orange-700/80 dark:text-orange-200/80">
                      Для Cloudflare API достаточно одного варианта: либо API Token, либо Global API Key. Если поля пустые, ручная привязка аккаунта к сайту продолжит работать как и раньше.
                    </p>

                    <button
                      type="submit"
                      disabled={isSavingCf}
                      className="mt-2 w-full rounded-xl bg-orange-500 p-4 text-sm font-black uppercase text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isSavingCf ? 'Сохраняю...' : editingCfAccountId ? 'Сохранить аккаунт' : 'Добавить'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isRegistrarFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[200] transition-all" onClick={() => { setIsRegistrarFormOpen(false); resetRegistrarForm(); }}>
          <div className="bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Регистраторы</h2>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">Хранилище доступов к регистраторам доменов: ссылка, логин или email, пароль и API-ключ.</p>
                </div>
                <button onClick={() => { setIsRegistrarFormOpen(false); resetRegistrarForm(); }} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isRegistrarEditorOpen && !editingRegistrarAccountId) {
                      resetRegistrarForm();
                    } else {
                      resetRegistrarForm();
                      setIsRegistrarEditorOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-600 transition-colors hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  <Plus size={14} /> Добавить регистратора
                </button>
                {isRegistrarEditorOpen ? (
                  <button
                    type="button"
                    onClick={resetRegistrarForm}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <X size={14} /> Закрыть форму
                  </button>
                ) : null}
              </div>

              <div className="mb-2 space-y-3 max-h-[min(62vh,560px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                {registrarAccounts.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Нет добавленных регистраторов</div>}
                {registrarAccounts.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        {a.url ? (
                          <img
                            src={getFaviconSrc(a.url)}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded bg-white shadow-sm"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                            <Link2 size={14} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{a.name}</div>
                          <div className="truncate text-xs font-mono text-slate-500">{a.login}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {a.hasPassword ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Login pass</span> : null}
                        {a.hasApiKey ? <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">API key</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-start">
                      <button type="button" onClick={() => openEditRegistrarAccount(a)} className="text-slate-400 hover:text-blue-500 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Редактировать"><Edit3 size={16} /></button>
                      <button onClick={() => deleteRegistrarAccount(a.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {isRegistrarEditorOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80" onClick={resetRegistrarForm}>
                  <form onSubmit={handleAddRegistrar} onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] space-y-4 rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-2xl dark:border-violet-900/30 dark:bg-[#120c19]">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-widest text-violet-600">{editingRegistrarAccountId ? 'Редактировать регистратора' : 'Добавить регистратора'}</h3>
                      <button type="button" onClick={resetRegistrarForm} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Закрыть форму"><X size={18} /></button>
                    </div>
                    <div>
                      <label htmlFor="registrar-name" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-violet-800/80 dark:text-violet-200/90">
                        Название
                      </label>
                    <div className="relative">
                        <input
                          id="registrar-name"
                          required
                          placeholder="Напр. Namecheap"
                          value={registrarData.name}
                          onChange={(e) => setRegistrarData({ ...registrarData, name: e.target.value })}
                          className={`w-full rounded-xl border border-violet-200 bg-white p-3 text-sm outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900 ${registrarData.name ? 'pr-11' : ''}`}
                        />
                        {registrarData.name ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(registrarData.name, `registrar-form-name-${editingRegistrarAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                            title="Скопировать название"
                          >
                            {copiedId === `registrar-form-name-${editingRegistrarAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="registrar-url" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-violet-800/80 dark:text-violet-200/90">
                        Ссылка на регистратора
                      </label>
                    <div className="relative">
                        <input
                          id="registrar-url"
                          placeholder="https://…"
                          value={registrarData.url}
                          onChange={(e) => setRegistrarData({ ...registrarData, url: e.target.value })}
                          className="w-full rounded-xl border border-violet-200 bg-white p-3 pr-11 text-sm outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900"
                        />
                        {registrarData.url ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(registrarData.url, `registrar-form-url-${editingRegistrarAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                            title="Скопировать ссылку"
                          >
                            {copiedId === `registrar-form-url-${editingRegistrarAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="registrar-login" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-violet-800/80 dark:text-violet-200/90">
                        Логин или email
                      </label>
                    <div className="relative">
                        <input
                          id="registrar-login"
                          required
                          placeholder="Логин в панели регистратора"
                          value={registrarData.login}
                          onChange={(e) => setRegistrarData({ ...registrarData, login: e.target.value })}
                          className="w-full rounded-xl border border-violet-200 bg-white p-3 pr-11 text-sm outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900"
                        />
                        {registrarData.login ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(registrarData.login, `registrar-form-email-${editingRegistrarAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                            title="Скопировать логин"
                          >
                            {copiedId === `registrar-form-email-${editingRegistrarAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="registrar-password" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-violet-800/80 dark:text-violet-200/90">
                        Пароль
                      </label>
                    <div className="relative">
                        <input
                          id="registrar-password"
                          type={showRegistrarPassword ? 'text' : 'password'}
                          placeholder={editingRegistrarAccountId ? '' : 'Будет сохранён в зашифрованном виде'}
                          value={registrarData.password || (registrarSecretMasks.password ? '••••••••••' : '')}
                          onFocus={() => {
                            if (registrarSecretMasks.password) {
                              setRegistrarSecretMasks((prev) => ({ ...prev, password: false }));
                              setRegistrarData((prev) => ({ ...prev, password: '' }));
                            }
                          }}
                          onChange={(e) => {
                            setRegistrarSecretMasks((prev) => ({ ...prev, password: false }));
                            setRegistrarData({ ...registrarData, password: e.target.value });
                          }}
                          className="w-full rounded-xl border border-violet-200 bg-white p-3 pr-20 text-sm outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900"
                        />
                        {registrarData.password || (editingRegistrarAccountId && registrarAccounts.find((item) => item.id === editingRegistrarAccountId)?.hasPassword) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (registrarData.password) {
                                void copyToClipboard(registrarData.password, `registrar-form-pass-field-${editingRegistrarAccountId || 'new'}`);
                              } else if (editingRegistrarAccountId) {
                                void copyRegistrarSecretToClipboard(editingRegistrarAccountId, 'password', `registrar-form-pass-${editingRegistrarAccountId}`);
                              }
                            }}
                            className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                            title="Скопировать пароль"
                          >
                            {loadingSecretId === `registrar-form-pass-${editingRegistrarAccountId}` && !registrarData.password ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `registrar-form-pass-${editingRegistrarAccountId}` || copiedId === `registrar-form-pass-field-${editingRegistrarAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            const rid = editingRegistrarAccountId;
                            if (showRegistrarPassword) {
                              setShowRegistrarPassword(false);
                              if (rid && registrarAccounts.find((x) => x.id === rid)?.hasPassword) {
                                setRegistrarData((p) => ({ ...p, password: '' }));
                                setRegistrarSecretMasks((p) => ({ ...p, password: true }));
                              }
                              return;
                            }
                            if (!rid || !registrarSecretMasks.password) {
                              setShowRegistrarPassword(true);
                              return;
                            }
                            setLoadingSecretId(`registrar-reveal-pass-${rid}`);
                            try {
                              const s = await fetchRegistrarSecretValue(rid, 'password');
                              setRegistrarData((p) => ({ ...p, password: s }));
                              setRegistrarSecretMasks((p) => ({ ...p, password: false }));
                              setShowRegistrarPassword(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить пароль');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 disabled:opacity-50"
                          title={showRegistrarPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          disabled={!!editingRegistrarAccountId && loadingSecretId === `registrar-reveal-pass-${editingRegistrarAccountId}`}
                        >
                          {editingRegistrarAccountId && loadingSecretId === `registrar-reveal-pass-${editingRegistrarAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showRegistrarPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="registrar-api-key" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-violet-800/80 dark:text-violet-200/90">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          id="registrar-api-key"
                          type={showRegistrarApiKey ? 'text' : 'password'}
                          placeholder={editingRegistrarAccountId ? '' : 'Необязательно'}
                          value={registrarData.apiKey || (registrarSecretMasks.apiKey ? '••••••••••' : '')}
                          onFocus={() => {
                            if (registrarSecretMasks.apiKey) {
                              setRegistrarSecretMasks((prev) => ({ ...prev, apiKey: false }));
                              setRegistrarData((prev) => ({ ...prev, apiKey: '' }));
                            }
                          }}
                          onChange={(e) => {
                            setRegistrarSecretMasks((prev) => ({ ...prev, apiKey: false }));
                            setRegistrarClearApiKey(false);
                            setRegistrarData({ ...registrarData, apiKey: e.target.value });
                          }}
                          className="w-full rounded-xl border border-violet-200 bg-white p-3 pr-28 text-sm outline-none focus:border-violet-500 dark:border-violet-800 dark:bg-slate-900"
                        />
                        {registrarData.apiKey || (editingRegistrarAccountId && registrarAccounts.find((item) => item.id === editingRegistrarAccountId)?.hasApiKey) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (registrarData.apiKey) {
                                void copyToClipboard(registrarData.apiKey, `registrar-form-key-field-${editingRegistrarAccountId || 'new'}`);
                              } else if (editingRegistrarAccountId) {
                                void copyRegistrarSecretToClipboard(editingRegistrarAccountId, 'apiKey', `registrar-form-key-${editingRegistrarAccountId}`);
                              }
                            }}
                            className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500"
                            title="Скопировать API Key"
                          >
                            {loadingSecretId === `registrar-form-key-${editingRegistrarAccountId}` && !registrarData.apiKey ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `registrar-form-key-${editingRegistrarAccountId}` || copiedId === `registrar-form-key-field-${editingRegistrarAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        ) : null}
                        {editingRegistrarAccountId && (registrarAccounts.find((item) => item.id === editingRegistrarAccountId)?.hasApiKey || registrarData.apiKey || registrarSecretMasks.apiKey) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowRegistrarApiKey(false);
                              setRegistrarSecretMasks((prev) => ({ ...prev, apiKey: false }));
                              setRegistrarClearApiKey(true);
                              setRegistrarData((prev) => ({ ...prev, apiKey: '' }));
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
                            const rid = editingRegistrarAccountId;
                            if (showRegistrarApiKey) {
                              setShowRegistrarApiKey(false);
                              if (rid && registrarAccounts.find((x) => x.id === rid)?.hasApiKey) {
                                setRegistrarData((p) => ({ ...p, apiKey: '' }));
                                setRegistrarSecretMasks((p) => ({ ...p, apiKey: true }));
                              }
                              return;
                            }
                            if (!rid || !registrarSecretMasks.apiKey) {
                              setShowRegistrarApiKey(true);
                              return;
                            }
                            setLoadingSecretId(`registrar-reveal-key-${rid}`);
                            try {
                              const s = await fetchRegistrarSecretValue(rid, 'apiKey');
                              setRegistrarData((p) => ({ ...p, apiKey: s }));
                              setRegistrarSecretMasks((p) => ({ ...p, apiKey: false }));
                              setRegistrarClearApiKey(false);
                              setShowRegistrarApiKey(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить API Key');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 disabled:opacity-50"
                          title={showRegistrarApiKey ? 'Скрыть' : 'Показать'}
                          disabled={!!editingRegistrarAccountId && loadingSecretId === `registrar-reveal-key-${editingRegistrarAccountId}`}
                        >
                          {editingRegistrarAccountId && loadingSecretId === `registrar-reveal-key-${editingRegistrarAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showRegistrarApiKey ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={isSavingRegistrar} className="mt-2 w-full rounded-xl bg-violet-500 p-4 text-sm font-black uppercase text-white shadow-lg shadow-violet-500/20 hover:bg-violet-600 disabled:cursor-wait disabled:opacity-60">{isSavingRegistrar ? 'Сохраняю...' : editingRegistrarAccountId ? 'Сохранить' : 'Добавить'}</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isHostingFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[200] transition-all" onClick={() => { setIsHostingFormOpen(false); resetHostingForm(); }}>
          <div className="bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-slate-800 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Хостинг (биллинг)</h2>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">Хранилище доступов к биллингам хостинга: ссылка, логин или email, пароль и API-ключ.</p>
                </div>
                <button onClick={() => { setIsHostingFormOpen(false); resetHostingForm(); }} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isHostingEditorOpen && !editingHostingAccountId) {
                      resetHostingForm();
                    } else {
                      resetHostingForm();
                      setIsHostingEditorOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300"
                >
                  <Plus size={14} /> Добавить хостинг
                </button>
                {isHostingEditorOpen ? (
                  <button type="button" onClick={resetHostingForm} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><X size={14} /> Закрыть форму</button>
                ) : null}
              </div>

              <div className="mb-2 space-y-3 max-h-[min(62vh,560px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                {hostingAccounts.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Нет добавленных хостингов</div>}
                {hostingAccounts.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{a.name}</div>
                      <div className="truncate text-xs font-mono text-slate-500">{a.login}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {a.hasPassword ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Login pass</span> : null}
                        {a.hasApiKey ? <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">API key</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-start">
                      <button type="button" onClick={() => openEditHostingAccount(a)} className="text-slate-400 hover:text-blue-500 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Редактировать"><Edit3 size={16} /></button>
                      <button onClick={() => deleteHostingAccount(a.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {isHostingEditorOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80" onClick={resetHostingForm}>
                  <form onSubmit={handleAddHosting} onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] space-y-4 rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-2xl dark:border-cyan-900/30 dark:bg-[#0b1719]">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-widest text-cyan-700">{editingHostingAccountId ? 'Редактировать хостинг' : 'Добавить хостинг'}</h3>
                      <button type="button" onClick={resetHostingForm} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Закрыть форму"><X size={18} /></button>
                    </div>
                    <div>
                      <label htmlFor="hosting-name" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                        Название
                      </label>
                    <div className="relative">
                        <input
                          id="hosting-name"
                          required
                          placeholder="Напр. Hetzner"
                          value={hostingData.name}
                          onChange={(e) => setHostingData({ ...hostingData, name: e.target.value })}
                          className={`w-full rounded-xl border border-cyan-200 bg-white p-3 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900 ${hostingData.name ? 'pr-11' : ''}`}
                        />
                        {hostingData.name ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(hostingData.name, `hosting-form-name-${editingHostingAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                            title="Скопировать название"
                          >
                            {copiedId === `hosting-form-name-${editingHostingAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="hosting-url" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                        Ссылка на биллинг
                      </label>
                    <div className="relative">
                        <input
                          id="hosting-url"
                          placeholder="https://…"
                          value={hostingData.url}
                          onChange={(e) => setHostingData({ ...hostingData, url: e.target.value })}
                          className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-11 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                        />
                        {hostingData.url ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(hostingData.url, `hosting-form-url-${editingHostingAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                            title="Скопировать ссылку"
                          >
                            {copiedId === `hosting-form-url-${editingHostingAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="hosting-login" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                        Логин или email
                      </label>
                    <div className="relative">
                        <input
                          id="hosting-login"
                          required
                          placeholder="Логин в биллинге"
                          value={hostingData.login}
                          onChange={(e) => setHostingData({ ...hostingData, login: e.target.value })}
                          className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-11 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                        />
                        {hostingData.login ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(hostingData.login, `hosting-form-email-${editingHostingAccountId || 'new'}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                            title="Скопировать логин"
                          >
                            {copiedId === `hosting-form-email-${editingHostingAccountId || 'new'}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                        ) : null}
                    </div>
                    </div>
                    <div>
                      <label htmlFor="hosting-password" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                        Пароль
                      </label>
                    <div className="relative">
                        <input
                          id="hosting-password"
                          type={showHostingPassword ? 'text' : 'password'}
                          placeholder={editingHostingAccountId ? '' : 'Будет сохранён в зашифрованном виде'}
                          value={hostingData.password || (hostingSecretMasks.password ? '••••••••••' : '')}
                          onFocus={() => {
                            if (hostingSecretMasks.password) {
                              setHostingSecretMasks((prev) => ({ ...prev, password: false }));
                              setHostingData((prev) => ({ ...prev, password: '' }));
                            }
                          }}
                          onChange={(e) => {
                            setHostingSecretMasks((prev) => ({ ...prev, password: false }));
                            setHostingData({ ...hostingData, password: e.target.value });
                          }}
                          className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-20 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                        />
                        {hostingData.password || (editingHostingAccountId && hostingAccounts.find((item) => item.id === editingHostingAccountId)?.hasPassword) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (hostingData.password) {
                                void copyToClipboard(hostingData.password, `hosting-form-pass-field-${editingHostingAccountId || 'new'}`);
                              } else if (editingHostingAccountId) {
                                void copyHostingSecretToClipboard(editingHostingAccountId, 'password', `hosting-form-pass-${editingHostingAccountId}`);
                              }
                            }}
                            className="absolute right-11 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                            title="Скопировать пароль"
                          >
                            {loadingSecretId === `hosting-form-pass-${editingHostingAccountId}` && !hostingData.password ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `hosting-form-pass-${editingHostingAccountId}` || copiedId === `hosting-form-pass-field-${editingHostingAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            const hid = editingHostingAccountId;
                            if (showHostingPassword) {
                              setShowHostingPassword(false);
                              if (hid && hostingAccounts.find((x) => x.id === hid)?.hasPassword) {
                                setHostingData((p) => ({ ...p, password: '' }));
                                setHostingSecretMasks((p) => ({ ...p, password: true }));
                              }
                              return;
                            }
                            if (!hid || !hostingSecretMasks.password) {
                              setShowHostingPassword(true);
                              return;
                            }
                            setLoadingSecretId(`hosting-reveal-pass-${hid}`);
                            try {
                              const s = await fetchHostingSecretValue(hid, 'password');
                              setHostingData((p) => ({ ...p, password: s }));
                              setHostingSecretMasks((p) => ({ ...p, password: false }));
                              setShowHostingPassword(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить пароль');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 disabled:opacity-50"
                          title={showHostingPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          disabled={!!editingHostingAccountId && loadingSecretId === `hosting-reveal-pass-${editingHostingAccountId}`}
                        >
                          {editingHostingAccountId && loadingSecretId === `hosting-reveal-pass-${editingHostingAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showHostingPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="hosting-api-key" className="mb-2 block text-[10px] font-black uppercase tracking-wide text-cyan-900/80 dark:text-cyan-200/90">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          id="hosting-api-key"
                          type={showHostingApiKey ? 'text' : 'password'}
                          placeholder={editingHostingAccountId ? '' : 'Необязательно'}
                          value={hostingData.apiKey || (hostingSecretMasks.apiKey ? '••••••••••' : '')}
                          onFocus={() => {
                            if (hostingSecretMasks.apiKey) {
                              setHostingSecretMasks((prev) => ({ ...prev, apiKey: false }));
                              setHostingData((prev) => ({ ...prev, apiKey: '' }));
                            }
                          }}
                          onChange={(e) => {
                            setHostingSecretMasks((prev) => ({ ...prev, apiKey: false }));
                            setHostingClearApiKey(false);
                            setHostingData({ ...hostingData, apiKey: e.target.value });
                          }}
                          className="w-full rounded-xl border border-cyan-200 bg-white p-3 pr-28 text-sm outline-none focus:border-cyan-500 dark:border-cyan-800 dark:bg-slate-900"
                        />
                        {hostingData.apiKey || (editingHostingAccountId && hostingAccounts.find((item) => item.id === editingHostingAccountId)?.hasApiKey) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (hostingData.apiKey) {
                                void copyToClipboard(hostingData.apiKey, `hosting-form-key-field-${editingHostingAccountId || 'new'}`);
                              } else if (editingHostingAccountId) {
                                void copyHostingSecretToClipboard(editingHostingAccountId, 'apiKey', `hosting-form-key-${editingHostingAccountId}`);
                              }
                            }}
                            className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                            title="Скопировать API Key"
                          >
                            {loadingSecretId === `hosting-form-key-${editingHostingAccountId}` && !hostingData.apiKey ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : copiedId === `hosting-form-key-${editingHostingAccountId}` || copiedId === `hosting-form-key-field-${editingHostingAccountId || 'new'}` ? (
                              <Check size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        ) : null}
                        {editingHostingAccountId && (hostingAccounts.find((item) => item.id === editingHostingAccountId)?.hasApiKey || hostingData.apiKey || hostingSecretMasks.apiKey) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowHostingApiKey(false);
                              setHostingSecretMasks((prev) => ({ ...prev, apiKey: false }));
                              setHostingClearApiKey(true);
                              setHostingData((prev) => ({ ...prev, apiKey: '' }));
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
                            const hid = editingHostingAccountId;
                            if (showHostingApiKey) {
                              setShowHostingApiKey(false);
                              if (hid && hostingAccounts.find((x) => x.id === hid)?.hasApiKey) {
                                setHostingData((p) => ({ ...p, apiKey: '' }));
                                setHostingSecretMasks((p) => ({ ...p, apiKey: true }));
                              }
                              return;
                            }
                            if (!hid || !hostingSecretMasks.apiKey) {
                              setShowHostingApiKey(true);
                              return;
                            }
                            setLoadingSecretId(`hosting-reveal-key-${hid}`);
                            try {
                              const s = await fetchHostingSecretValue(hid, 'apiKey');
                              setHostingData((p) => ({ ...p, apiKey: s }));
                              setHostingSecretMasks((p) => ({ ...p, apiKey: false }));
                              setHostingClearApiKey(false);
                              setShowHostingApiKey(true);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Не удалось получить API Key');
                            } finally {
                              setLoadingSecretId(null);
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 disabled:opacity-50"
                          title={showHostingApiKey ? 'Скрыть' : 'Показать'}
                          disabled={!!editingHostingAccountId && loadingSecretId === `hosting-reveal-key-${editingHostingAccountId}`}
                        >
                          {editingHostingAccountId && loadingSecretId === `hosting-reveal-key-${editingHostingAccountId}` ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : showHostingApiKey ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={isSavingHosting} className="mt-2 w-full rounded-xl bg-cyan-600 p-4 text-sm font-black uppercase text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-60">{isSavingHosting ? 'Сохраняю...' : editingHostingAccountId ? 'Сохранить' : 'Добавить'}</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showScrollTopButton && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[220] inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 shadow-xl transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronUp size={14} />
          Наверх
        </button>
      )}
    </div>
  );
}