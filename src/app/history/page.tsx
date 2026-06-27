"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, Globe, Wifi, WifiOff,
  Server, RefreshCw, Filter, BarChart3, X,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { getSaoPauloDateString } from '@/lib/date';

interface Incident {
  id: string;
  siteId: number;
  siteName: string;
  url: string;
  timestamp: string;
  errorType: string;
  latency: number | null;
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function getErrorColor(errorType: string): string {
  const lower = (errorType || '').toLowerCase();
  if (lower.includes('timeout') || lower.includes('4.0s')) return 'text-amber-400';
  if (lower.includes('http') || lower.includes('status')) return 'text-orange-400';
  return 'text-red-400';
}

function getErrorBg(errorType: string): string {
  const lower = (errorType || '').toLowerCase();
  if (lower.includes('timeout') || lower.includes('4.0s')) return 'bg-amber-500/10 border-amber-500/20';
  if (lower.includes('http') || lower.includes('status')) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch { return iso; }
}

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch { return dateStr; }
}

// Inner component that uses useSearchParams (must be wrapped in Suspense)
function HistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterSiteId = searchParams.get('site') ? Number(searchParams.get('site')) : null;

  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = () => {
      // 1. Check if demo mode
      if (typeof window !== 'undefined') {
        const isDemoLoggedIn = window.sessionStorage.getItem('demo_admin_logged_in') === 'true';
        if (isDemoLoggedIn) {
          setUser({ email: window.sessionStorage.getItem('demo_admin_email') || 'demo@sentry3d.com' });
          setAuthChecking(false);
          return;
        }
      }

      // 2. Check Firebase Auth
      if (isFirebaseConfigured && auth) {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            setAuthChecking(false);
          } else {
            router.push('/login');
          }
        });
        return () => unsubscribe();
      } else {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const now = new Date();
  const todayStr = getSaoPauloDateString(now);
  const [y, m] = todayStr.split('-').map(Number);
  const [viewYear, setViewYear] = useState(y);
  const [viewMonth, setViewMonth] = useState(m - 1);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

  const [dayData, setDayData] = useState<Incident[]>([]);
  const [monthSummary, setMonthSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedSites({});
  }, [selectedDay]);

  const fetchDayIncidents = useCallback(async (dateStr: string) => {
    setLoading(true);
    setDayData([]);
    if (!isFirebaseConfigured || !db) { setLoading(false); return; }
    try {
      // Busca sem orderBy para evitar erro de índice composto no Firestore
      const incCol = collection(db, 'history', dateStr, 'incidents');
      const snap = await getDocs(incCol);
      const items: Incident[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          siteId: d.siteId ?? 0,
          siteName: d.siteName ?? 'Desconhecido',
          url: d.url ?? '',
          timestamp: d.timestamp ?? '',
          errorType: d.errorType ?? 'Sem resposta',
          latency: d.latency ?? null,
        });
      });
      // Ordena no cliente por timestamp decrescente (mais recente primeiro) para evitar necessidade de índice no Firestore
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      console.log(`[History] ${items.length} incidente(s) encontrado(s) para ${dateStr}`);
      setDayData(items);
    } catch (err) {
      console.error('[History] Erro ao carregar dia:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMonthSummary = useCallback(async (year: number, month: number) => {
    setMonthLoading(true);
    if (!isFirebaseConfigured || !db) { setMonthLoading(false); return; }
    const summary: Record<string, number> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const tasks = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      tasks.push(
        getDocs(collection(db, 'history', ds, 'incidents'))
          .then((snap) => { summary[ds] = snap.size; })
          .catch(() => { summary[ds] = 0; })
      );
    }
    await Promise.all(tasks);
    setMonthSummary(summary);
    setMonthLoading(false);
  }, []);

  useEffect(() => { fetchMonthSummary(viewYear, viewMonth); }, [viewYear, viewMonth, fetchMonthSummary]);
  useEffect(() => { fetchDayIncidents(selectedDay); }, [selectedDay, fetchDayIncidents]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const calendarDays: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Filter by site if query param is set
  const filteredData = filterSiteId
    ? dayData.filter(inc => inc.siteId === filterSiteId)
    : dayData;

  // Group by site
  const incidentsBySite: Record<string, Incident[]> = {};
  filteredData.forEach((inc) => {
    const key = `${inc.siteId}-${inc.siteName}`;
    if (!incidentsBySite[key]) incidentsBySite[key] = [];
    incidentsBySite[key].push(inc);
  });

  const toggleSiteExpanded = (siteKey: string) => {
    setExpandedSites((prev) => ({
      ...prev,
      [siteKey]: !prev[siteKey],
    }));
  };

  const isAllExpanded = Object.keys(incidentsBySite).length > 0 &&
    Object.keys(incidentsBySite).every((key) => expandedSites[key]);

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedSites({});
    } else {
      const all: Record<string, boolean> = {};
      Object.keys(incidentsBySite).forEach((key) => {
        all[key] = true;
      });
      setExpandedSites(all);
    }
  };

  const monthTotal = Object.values(monthSummary).reduce((a, b) => a + b, 0);
  const monthAffected = Object.values(monthSummary).filter(c => c > 0).length;

  if (authChecking) {
    return (
      <div className="w-screen h-screen bg-[#050505] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <Server size={32} className="text-[#a855f7] animate-pulse" />
          <span className="text-xs uppercase font-mono tracking-widest text-neutral-400">Verificando credenciais...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden relative">

      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[30vw] bg-[rgba(168, 85, 247,0.03)] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[30vw] h-[30vw] bg-[rgba(255,50,100,0.02)] blur-[130px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="h-20 border-b border-white/5 px-8 flex justify-between items-center bg-white/[0.01] backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#a855f7]/30 text-neutral-400 hover:text-[#a855f7] transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              <BarChart3 className="text-[#a855f7]" size={15} />
              Histórico de Incidentes
              {filterSiteId && (
                <span className="text-[9px] font-mono bg-white/5 text-neutral-400 border border-white/10 px-2 py-0.5 rounded">
                  NÓ_{String(filterSiteId).padStart(2, '0')}
                </span>
              )}
            </h1>
            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
              Registro detalhado de falhas e indisponibilidades por dia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {filterSiteId && (
            <Link
              href="/history"
              className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-white font-mono uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
            >
              <X size={11} />
              Limpar Filtro
            </Link>
          )}
          <button
            onClick={() => { fetchDayIncidents(selectedDay); fetchMonthSummary(viewYear, viewMonth); }}
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-[#a855f7] font-bold uppercase tracking-wider px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#a855f7]/20 hover:bg-[#a855f7]/5 transition-all cursor-pointer"
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden p-8 gap-8 z-10">

        {/* Left: Calendar */}
        <aside className="w-[310px] shrink-0 flex flex-col gap-4">

          <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-5 flex flex-col gap-4">
            {/* Month nav */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <div className="text-center">
                <div className="text-xs font-black tracking-wider text-white uppercase">{MONTH_NAMES[viewMonth]}</div>
                <div className="text-[10px] font-mono text-neutral-500">{viewYear}</div>
              </div>
              <button
                onClick={nextMonth}
                disabled={`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}` >= todayStr.slice(0, 7)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* DOW headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                <div key={i} className="text-[9px] font-bold text-neutral-600 uppercase py-1">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((ds, i) => {
                if (!ds) return <div key={i} />;
                const count = monthSummary[ds] ?? 0;
                const isSelected = ds === selectedDay;
                const isToday = ds === todayStr;
                const isFuture = ds > todayStr;
                return (
                  <button
                    key={ds}
                    onClick={() => !isFuture && setSelectedDay(ds)}
                    disabled={isFuture}
                    className={`
                      relative aspect-square rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center flex-col gap-0.5
                      ${isFuture ? 'text-neutral-700 cursor-not-allowed' : 'hover:bg-white/10'}
                      ${isSelected ? 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30' : isToday ? 'bg-white/5 text-white border border-white/10' : 'text-neutral-400 border border-transparent'}
                    `}
                  >
                    <span>{parseInt(ds.slice(8))}</span>
                    {count > 0 && !isFuture && (
                      <span className={`w-1 h-1 rounded-full ${count > 5 ? 'bg-red-500' : 'bg-amber-500'}`} />
                    )}
                    {monthLoading && !isFuture && count === 0 && (
                      <span className="w-1 h-1 rounded-full bg-neutral-700 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month summary */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Filter size={13} className="text-[#a855f7]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Resumo do Mês</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.02] rounded-2xl p-3 border border-white/5">
                <div className="text-[20px] font-black text-white font-mono">{monthLoading ? '–' : monthTotal}</div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono mt-0.5">Total incidentes</div>
              </div>
              <div className="bg-white/[0.02] rounded-2xl p-3 border border-white/5">
                <div className="text-[20px] font-black text-white font-mono">{monthLoading ? '–' : monthAffected}</div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono mt-0.5">Dias afetados</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Day Detail */}
        <section className="flex-1 flex flex-col min-w-0 h-full">
          <div className="bg-white/[0.02] border border-white/5 rounded-[28px] p-6 flex flex-col h-full">

            {/* Day header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#a855f7]/10 border border-[#a855f7]/20">
                  <Calendar size={15} className="text-[#a855f7]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white tracking-wide">{formatDate(selectedDay)}</h2>
                  <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
                    {loading ? 'Carregando...' : `${filteredData.length} registro(s) de falha`}
                  </p>
                </div>
              </div>
              {filteredData.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAll}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400 hover:text-white transition-colors bg-white/5 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    {isAllExpanded ? 'Recolher todos' : 'Expandir todos'}
                  </button>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                    <AlertTriangle size={11} />
                    {filteredData.length} falha(s) detectada(s)
                  </div>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500">
                  <Server size={28} className="animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest">Carregando registros...</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 border border-dashed border-white/5 rounded-2xl">
                  <div className="p-4 rounded-full bg-[#a855f7]/5 border border-[#a855f7]/10">
                    <Wifi size={28} className="text-[#a855f7]/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-neutral-400">Nenhum incidente registrado</p>
                    <p className="text-[11px] text-neutral-600 mt-1 max-w-[280px] leading-normal">
                      Todos os sites estavam online neste dia, ou ainda não há dados de monitoramento para esta data.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(incidentsBySite).map(([siteKey, incidents]) => {
                    const isExpanded = !!expandedSites[siteKey];
                    return (
                      <div key={siteKey} className="bg-white/[0.015] border border-white/5 rounded-2xl overflow-hidden">
                        {/* Site header row */}
                        <div
                          onClick={() => toggleSiteExpanded(siteKey)}
                          className={`flex items-center justify-between px-5 py-3.5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer select-none ${isExpanded ? 'border-b border-white/5' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <div>
                              <div className="text-xs font-black text-neutral-200 tracking-wide">{incidents[0].siteName}</div>
                              <a
                                href={incidents[0].url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-neutral-500 hover:text-[#a855f7] transition-colors flex items-center gap-1 mt-0.5"
                              >
                                <Globe size={9} />{incidents[0].url}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <WifiOff size={13} className="text-red-400" />
                              <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                                {incidents.length} falha{incidents.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-neutral-400 shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="text-neutral-400 shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Incident rows */}
                        {isExpanded && (
                          <div className="divide-y divide-white/[0.03]">
                            {incidents.map((inc) => (
                              <div key={inc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-1.5 shrink-0 min-w-[90px]">
                                  <Clock size={11} className="text-neutral-600 shrink-0" />
                                  <span className="text-[11px] font-mono text-neutral-300 tabular-nums">{formatTime(inc.timestamp)}</span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold shrink-0 ${getErrorBg(inc.errorType)} ${getErrorColor(inc.errorType)}`}>
                                  <AlertTriangle size={10} />
                                  {inc.errorType}
                                </div>
                                {inc.latency !== null && (
                                  <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 ml-auto shrink-0">
                                    <span className="text-neutral-600">latência:</span>
                                    <span className={inc.latency > 2000 ? 'text-red-400' : inc.latency > 1000 ? 'text-amber-400' : 'text-neutral-400'}>
                                      {inc.latency}ms
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen bg-[#050505] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <Server size={32} className="text-[#a855f7] animate-pulse" />
          <span className="text-xs uppercase font-mono tracking-widest text-neutral-400">Carregando histórico...</span>
        </div>
      </div>
    }>
      <HistoryContent />
    </Suspense>
  );
}
