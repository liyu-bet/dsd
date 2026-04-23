import { Bell, Clock3, RefreshCw, Wifi, WifiOff } from 'lucide-react';

type MainDashboardTabProps = {
  serversCount: number;
  onlineServers: number;
  offlineServers: number;
  pendingServers: number;
  sitesCount: number;
  onlineSites: number;
  offlineSites: number;
  pendingSites: number;
  avgCpu: number;
  avgRam: number;
  renewalsInWeek: number;
  renewalsInMonth: number;
  expiredDomains: number;
  sitesWithoutExpiryDate: number;
  sitesWithoutRegistrar: number;
  isManualRefreshing: boolean;
  onRefresh: () => void;
  onOpenServers: () => void;
  onOpenDomains: () => void;
};

export default function MainDashboardTab({
  serversCount,
  onlineServers,
  offlineServers,
  pendingServers,
  sitesCount,
  onlineSites,
  offlineSites,
  pendingSites,
  avgCpu,
  avgRam,
  renewalsInWeek,
  renewalsInMonth,
  expiredDomains,
  sitesWithoutExpiryDate,
  sitesWithoutRegistrar,
  isManualRefreshing,
  onRefresh,
  onOpenServers,
  onOpenDomains,
}: MainDashboardTabProps) {
  const serverHealth = serversCount > 0 ? Math.round((onlineServers / serversCount) * 100) : 0;
  const domainHealth = sitesCount > 0 ? Math.round((onlineSites / sitesCount) * 100) : 0;

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Главный дашборд</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ключевые показатели инфраструктуры, доменов и рисков продления в одном экране.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenServers} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 shadow-sm transition-colors hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">К серверам</button>
          <button onClick={onOpenDomains} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 shadow-sm transition-colors hover:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">К доменам</button>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_14px_40px_rgba(6,182,212,0.16)] dark:border-cyan-500/20 dark:from-cyan-500/10 dark:via-slate-900 dark:to-sky-500/5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">Серверы</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{serversCount}</div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"><Wifi size={12} /> {onlineServers}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><WifiOff size={12} /> {offlineServers}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><Clock3 size={12} /> {pendingServers}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 shadow-[0_14px_40px_rgba(59,130,246,0.16)] dark:border-blue-500/20 dark:from-blue-500/10 dark:via-slate-900 dark:to-indigo-500/5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Домены и сайты</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{sitesCount}</div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"><Wifi size={12} /> {onlineSites}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><WifiOff size={12} /> {offlineSites}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><Clock3 size={12} /> {pendingSites}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_14px_40px_rgba(139,92,246,0.16)] dark:border-violet-500/20 dark:from-violet-500/10 dark:via-slate-900 dark:to-fuchsia-500/5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Нагрузка ядра</div>
          <div className="flex items-end gap-2"><div className="text-3xl font-black text-slate-900 dark:text-white">{avgCpu}%</div><div className="pb-1 text-xs font-bold uppercase tracking-widest text-slate-500">CPU</div></div>
          <div className="mt-2 flex items-end gap-2"><div className="text-2xl font-black text-slate-900 dark:text-white">{avgRam}%</div><div className="pb-1 text-xs font-bold uppercase tracking-widest text-slate-500">RAM</div></div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5 shadow-[0_14px_40px_rgba(244,63,94,0.16)] dark:border-rose-500/20 dark:from-rose-500/10 dark:via-slate-900 dark:to-orange-500/5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-300">Продления</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{renewalsInWeek}</div>
          <div className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">до 7 дней</div>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
            <Bell size={11} />
            до 30 дней: {renewalsInMonth}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Риски доменов</div>
          <div className="space-y-2 text-sm font-bold">
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><span>Истекли</span><span>{expiredDomains}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"><span>Без даты</span><span>{sitesWithoutExpiryDate}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"><span>Без регистратора</span><span>{sitesWithoutRegistrar}</span></div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/60 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Состояние инфраструктуры</div>
            <button onClick={onRefresh} disabled={isManualRefreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <RefreshCw size={12} className={isManualRefreshing ? 'animate-spin' : ''} />
              Обновить
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Server Health</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: `${serverHealth}%` }} /></div>
              <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">{serverHealth}% online</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Domain Health</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all" style={{ width: `${domainHealth}%` }} /></div>
              <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">{domainHealth}% online</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
