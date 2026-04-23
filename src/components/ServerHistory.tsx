import { useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, Calendar, Check, Clock, Sparkles } from 'lucide-react';

const BELGRADE_TZ = 'Europe/Belgrade';

type CheckItem = {
  id: string;
  status: string;
  cpuUsage: number;
  ramUsage: number;
  isIncident?: boolean;
  createdAt: string;
  trigger?: string;
  bucketType?: string;
};

function getBucketType(check: CheckItem) {
  return check.bucketType || 'interval';
}

function getTrigger(check: CheckItem) {
  return check.trigger || 'worker';
}

function inRange(date: Date, mode: 'hour' | 'day' | 'week') {
  const now = Date.now();
  const age = now - date.getTime();
  if (mode === 'hour') return age <= 60 * 60 * 1000;
  if (mode === 'day') return age <= 24 * 60 * 60 * 1000;
  return age <= 7 * 24 * 60 * 60 * 1000;
}

export default function ServerHistory({ checks }: { checks: CheckItem[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'hour' | 'day' | 'week'>('hour');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    if (!checks.length) return [] as CheckItem[];

    const sorted = [...checks].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (viewMode === 'hour') {
      return sorted.filter((check) => getBucketType(check) === 'interval').slice(-12);
    }

    if (viewMode === 'day') {
      return sorted.filter((check) => getBucketType(check) === 'hourly').slice(-24);
    }

    return sorted.filter((check) => getBucketType(check) === 'daily').slice(-7);
  }, [checks, viewMode]);

  const logData = useMemo(() => {
    const bucketType =
      viewMode === 'hour' ? 'interval' : viewMode === 'day' ? 'hourly' : 'daily';

    return [...checks]
      .filter((check) => {
        const created = new Date(check.createdAt);
        return (
          getBucketType(check) === bucketType ||
          (getTrigger(check) === 'manual' && inRange(created, viewMode))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [checks, viewMode]);

  if (!checks.length) {
    return (
      <div className="text-slate-400 text-sm text-center py-10">
        История пока пуста, данные собираются...
      </div>
    );
  }

  const maxPoints = Math.max(chartData.length - 1, 1);

  const formatAxisTime = (dateStr: string) => {
    const d = new Date(dateStr);

    if (viewMode === 'hour') {
      return d.toLocaleTimeString('ru-RU', {
        timeZone: BELGRADE_TZ,
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    if (viewMode === 'day') {
      return d.toLocaleTimeString('ru-RU', {
        timeZone: BELGRADE_TZ,
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return d.toLocaleDateString('ru-RU', {
      timeZone: BELGRADE_TZ,
      day: '2-digit',
      month: 'short',
    });
  };

  const getPoints = (key: 'cpuUsage' | 'ramUsage') => {
    if (chartData.length === 0) return '';
    if (chartData.length === 1) {
      return `0,${100 - chartData[0][key]} 100,${100 - chartData[0][key]}`;
    }

    return chartData
      .map((item, i) => `${(i / maxPoints) * 100},${100 - (item[key] || 0)}`)
      .join(' ');
  };

  const cpuPoints = getPoints('cpuUsage');
  const ramPoints = getPoints('ramUsage');
  const cpuFill = cpuPoints ? `0,100 ${cpuPoints} 100,100` : '';
  const ramFill = ramPoints ? `0,100 ${ramPoints} 100,100` : '';

  const handleGraphHover = (id: string) => {
    setHoveredId(id);
    const el = document.getElementById(`log-item-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const title =
    viewMode === 'hour'
      ? 'Последний час • шаг 5 минут'
      : viewMode === 'day'
        ? 'Последние 24 часа • первый срез часа'
        : 'Последние 7 дней • первый срез суток';

  return (
    <div className="bg-white dark:bg-[linear-gradient(180deg,rgba(10,14,29,0.94)_0%,rgba(5,8,22,0.98)_100%)] border border-slate-200 dark:border-cyan-400/10 p-8 rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_0_40px_rgba(8,145,178,0.08)] animate-in fade-in slide-in-from-top-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-sky-600 dark:text-cyan-300/80 mb-2">
            <Activity size={16} /> История нагрузки (CPU и RAM)
          </h4>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{title}</div>
        </div>

        <div className="flex items-center bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-cyan-400/10 p-1 rounded-2xl backdrop-blur-xl">
          <button
            onClick={() => setViewMode('hour')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'hour'
                ? 'bg-[linear-gradient(135deg,_#38bdf8,_#8b5cf6_60%,_#ec4899)] text-white shadow-[0_0_20px_rgba(168,85,247,0.22)]'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Clock size={12} /> 1 час
          </button>

          <button
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'day'
                ? 'bg-[linear-gradient(135deg,_#38bdf8,_#8b5cf6_60%,_#ec4899)] text-white shadow-[0_0_20px_rgba(168,85,247,0.22)]'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Calendar size={12} /> 24 часа
          </button>

          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'week'
                ? 'bg-[linear-gradient(135deg,_#38bdf8,_#8b5cf6_60%,_#ec4899)] text-white shadow-[0_0_20px_rgba(168,85,247,0.22)]'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles size={12} /> 7 дней
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        <div className="flex flex-col w-full h-[380px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500 mr-2">Срезы:</span>
              <span className="text-cyan-600 dark:text-cyan-300 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div> CPU
              </span>
              <span className="text-fuchsia-600 dark:text-fuchsia-300 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-fuchsia-500"></div> RAM
              </span>
            </div>

            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-md border border-slate-200 dark:border-cyan-400/10">
              Точек: {chartData.length}
            </span>
          </div>

          <div
            className="flex-1 w-full relative border-b border-l border-slate-200 dark:border-cyan-400/10 pb-1 pl-1 group"
            onMouseLeave={() => setHoveredId(null)}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible absolute inset-0"
            >
              <line
                x1="0"
                y1="25"
                x2="100"
                y2="25"
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-slate-300 dark:text-cyan-400/10"
                strokeDasharray="2"
              />
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-slate-300 dark:text-cyan-400/10"
                strokeDasharray="2"
              />
              <line
                x1="0"
                y1="75"
                x2="100"
                y2="75"
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-slate-300 dark:text-cyan-400/10"
                strokeDasharray="2"
              />

              {ramFill && <polygon points={ramFill} fill="#d946ef" className="opacity-[0.06]" />}
              {cpuFill && <polygon points={cpuFill} fill="#38bdf8" className="opacity-[0.10]" />}
              {ramPoints && (
                <polyline
                  points={ramPoints}
                  fill="none"
                  stroke="#d946ef"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-90"
                />
              )}
              {cpuPoints && (
                <polyline
                  points={cpuPoints}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {chartData.map((item, i) => {
              const xPercent = chartData.length === 1 ? 50 : (i / maxPoints) * 100;
              const isHovered = hoveredId === item.id;

              return (
                <div
                  key={item.id}
                  className="absolute w-6 h-full -ml-3 top-0 cursor-crosshair z-10"
                  style={{ left: `${xPercent}%` }}
                  onMouseEnter={() => handleGraphHover(item.id)}
                >
                  {isHovered && (
                    <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-300/40 -translate-x-1/2 pointer-events-none" />
                  )}

                  <div
                    className={`absolute left-1/2 w-1.5 h-1.5 rounded-full bg-fuchsia-500 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all ${
                      isHovered
                        ? 'scale-[2.5] ring-2 ring-fuchsia-500/30 border border-white/50'
                        : 'border-none'
                    }`}
                    style={{ top: `${100 - (item.ramUsage || 0)}%` }}
                  />

                  <div
                    className={`absolute left-1/2 w-2 h-2 rounded-full border border-white/50 bg-cyan-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all ${
                      isHovered ? 'scale-[2.5] ring-2 ring-cyan-400/30' : ''
                    }`}
                    style={{ top: `${100 - (item.cpuUsage || 0)}%` }}
                  />

                  {isHovered && (
                    <div className="absolute z-20 top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-[#090d1c] text-slate-900 dark:text-white p-3 rounded-xl shadow-xl border border-slate-200 dark:border-cyan-400/10 w-36 pointer-events-none">
                      <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-2 text-center">
                        {new Date(item.createdAt).toLocaleString('ru-RU', {
                          timeZone: BELGRADE_TZ,
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-cyan-600 dark:text-cyan-300 font-bold">CPU</span>
                        <span className="font-mono font-bold">{item.cpuUsage}%</span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-fuchsia-600 dark:text-fuchsia-300 font-bold">RAM</span>
                        <span className="font-mono font-bold">{item.ramUsage}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="absolute -left-7 top-[-4px] text-[9px] font-mono text-slate-400 select-none">
              100%
            </div>
            <div className="absolute -left-6 top-[calc(50%-6px)] text-[9px] font-mono text-slate-400 select-none">
              50%
            </div>
            <div className="absolute -left-5 bottom-[-2px] text-[9px] font-mono text-slate-400 select-none">
              0%
            </div>
          </div>

          <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-3 px-1 select-none">
            <span>{chartData.length > 0 ? formatAxisTime(chartData[0].createdAt) : ''}</span>
            <span>
              {chartData.length > 2
                ? formatAxisTime(chartData[Math.floor(chartData.length / 2)].createdAt)
                : ''}
            </span>
            <span>
              {chartData.length > 1
                ? formatAxisTime(chartData[chartData.length - 1].createdAt)
                : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-col h-[380px]">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 px-3 flex justify-between">
            <span>Лог сервера</span>
            <span>Статус</span>
          </h4>

          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto pr-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-cyan-400/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            <div className="relative border-l-2 border-slate-200 dark:border-cyan-400/10 ml-3 space-y-3 py-2">
              {logData.map((check) => {
                const checkTime = new Date(check.createdAt).toLocaleString('ru-RU', {
                  timeZone: BELGRADE_TZ,
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isFail = check.status !== 'online';
                const isHovered = hoveredId === check.id;
                const isManual = getTrigger(check) === 'manual';

                return (
                  <div
                    key={check.id}
                    id={`log-item-${check.id}`}
                    className="relative pl-6 group transition-all"
                    onMouseEnter={() => setHoveredId(check.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div
                      className={`absolute -left-[13px] top-2.5 flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-[#0b1020] text-slate-400 shadow-sm transition-colors ${
                        isFail || check.isIncident
                          ? 'ring-2 ring-red-500/20 bg-red-500 text-white'
                          : isHovered
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-100 dark:bg-white/10'
                      }`}
                    >
                      {isFail ? (
                        <AlertCircle size={10} />
                      ) : check.isIncident ? (
                        <Activity size={10} />
                      ) : (
                        <Check size={10} />
                      )}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 border transition-all cursor-default ${
                        isFail || check.isIncident
                          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                          : isHovered
                            ? 'bg-cyan-50 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-400/20 shadow-md z-10 relative'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-cyan-400/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`font-bold text-xs ${
                            isHovered ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {checkTime}
                        </span>

                        {check.isIncident && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                            Событие
                          </span>
                        )}

                        {isManual && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-300 bg-fuchsia-100 dark:bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
                            Ручной запуск
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono whitespace-nowrap flex-wrap justify-end">
                        <span className="text-slate-500 dark:text-slate-400">
                          CPU: <b className="text-cyan-600 dark:text-cyan-300">{check.cpuUsage}%</b>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          RAM: <b className="text-fuchsia-600 dark:text-fuchsia-300">{check.ramUsage}%</b>
                        </span>
                        <div className="w-px h-3 bg-slate-200 dark:bg-cyan-400/10"></div>
                        <span
                          className={
                            isFail
                              ? 'text-red-600 dark:text-red-300 font-bold uppercase text-[10px] tracking-wider'
                              : 'text-emerald-600 dark:text-emerald-300 font-bold uppercase text-[10px] tracking-wider'
                          }
                        >
                          {check.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}