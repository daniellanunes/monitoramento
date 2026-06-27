"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from './Sidebar';
import MonitorModal from './MonitorModal';
import DomainExpirationWidget from './DomainExpirationWidget';
import { Activity, Lock, PanelLeftClose, PanelLeftOpen, Volume2, VolumeX, AlertTriangle, ArrowRight, PanelRightClose, PanelRightOpen, LogOut, Settings } from 'lucide-react';
import { SiteData } from '@/types/monitor';
import Link from 'next/link';
import { playTestSound, playAlertSound, playFaahSound } from '@/lib/sound';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getSaoPauloDateString } from '@/lib/date';

// Dynamic loading of Canvas/Three.js to disable SSR warnings
const BrainCanvas = dynamic(() => import('./BrainCanvas'), { ssr: false });

interface Incident {
  id: string;
  siteId: number;
  siteName: string;
  url: string;
  timestamp: string;
  errorType: string;
  latency: number | null;
}

const initialSitesData: SiteData[] = [];

export default function BrainContainer() {
  const [sites, setSites] = useState<SiteData[]>(initialSitesData);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [failuresVisible, setFailuresVisible] = useState(true);
  const [investigationModalSite, setInvestigationModalSite] = useState<SiteData | null>(null);

  // Global settings values
  const [syncInterval, setSyncInterval] = useState(12000);
  const [alarm1Threshold, setAlarm1Threshold] = useState(60); // in seconds
  const [alarm2Threshold, setAlarm2Threshold] = useState(300); // in seconds

  // Refs for tracking escalated alarms per site
  const offlineStartTimes = useRef<Record<number, number>>({});
  const alarm1MinTriggered = useRef<Record<number, boolean>>({});
  const alarm5MinTriggered = useRef<Record<number, boolean>>({});
  const activeAlarms30s = useRef<Record<number, () => void>>({});

  // Audio Alerts State and Config
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(audioEnabled);

  const handleLogout = async () => {
    // 1. Check if demo session exists
    if (typeof window !== 'undefined') {
      const isDemoLoggedIn = window.sessionStorage.getItem('demo_admin_logged_in') === 'true';
      if (isDemoLoggedIn) {
        window.sessionStorage.removeItem('demo_admin_logged_in');
        window.sessionStorage.removeItem('demo_admin_email');
        window.location.reload();
        return;
      }
    }

    // 2. Sign out Firebase Auth
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
        window.location.reload();
      } catch (err) {
        console.error("Erro ao deslogar:", err);
      }
    }
  };

  // Async function to fetch today's incidents
  const fetchTodayIncidents = useCallback(async () => {
    if (!isFirebaseConfigured || !db) {
      setIncidentsLoading(false);
      return;
    }
    try {
      const today = getSaoPauloDateString();
      const incidentsCol = collection(db, 'history', today, 'incidents');
      const snap = await getDocs(incidentsCol);
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
      // Order by timestamp descending (newest first)
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setRecentIncidents(items.slice(0, 3));
    } catch (err) {
      console.warn("Erro ao buscar incidentes recentes:", err);
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  // Load Global Settings on mount
  useEffect(() => {
    const loadGlobalSettings = async () => {
      let isDemo = false;
      if (typeof window !== 'undefined') {
        isDemo = window.sessionStorage.getItem('demo_admin_logged_in') === 'true';
      }

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('global_settings');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed.syncInterval) setSyncInterval(parsed.syncInterval);
              if (parsed.alarm1Threshold) setAlarm1Threshold(parsed.alarm1Threshold);
              if (parsed.alarm2Threshold) setAlarm2Threshold(parsed.alarm2Threshold);
            } catch (e) {}
          }
        }
        return;
      }

      if (isFirebaseConfigured && db) {
        try {
          const docRef = doc(db, 'settings', 'global');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.syncInterval) setSyncInterval(data.syncInterval);
            if (data.alarm1Threshold) setAlarm1Threshold(data.alarm1Threshold);
            if (data.alarm2Threshold) setAlarm2Threshold(data.alarm2Threshold);
          }
        } catch (err) {
          console.warn("Erro ao buscar configurações globais no dashboard:", err);
        }
      }
    };

    loadGlobalSettings();
  }, []);

  // Hydrate audio state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('audio_alerts_enabled');
    if (saved === 'true') {
      setAudioEnabled(true);
      audioEnabledRef.current = true;
    }
  }, []);

  // Sync ref with audioEnabled state changes
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const toggleAudio = () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    localStorage.setItem('audio_alerts_enabled', String(nextState));
    if (nextState) {
      playTestSound();
    } else {
      // Stop all active 30s alarms when muted
      Object.keys(activeAlarms30s.current).forEach(id => {
        const numId = Number(id);
        if (activeAlarms30s.current[numId]) {
          activeAlarms30s.current[numId]();
        }
      });
      activeAlarms30s.current = {};
    }
  };

  const triggerAlert = useCallback(() => {
    if (audioEnabledRef.current) {
      playAlertSound();
    }
  }, []);

  const triggerFaahAlert = useCallback(() => {
    if (audioEnabledRef.current) {
      playFaahSound();
    }
  }, []);

  const handleStartInvestigation = useCallback((siteId: number) => {
    if (activeAlarms30s.current[siteId]) {
      activeAlarms30s.current[siteId]();
      delete activeAlarms30s.current[siteId];
    }
    setInvestigationModalSite(null);
  }, []);

  // Derive the selected site object dynamically from the list state
  const selectedSite = sites.find(s => s.id === selectedSiteId) || null;

  // Async function to query live site ping and visitor telemetry
  const fetchTelemetry = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/monitor');
      if (res.ok) {
        const data: SiteData[] = await res.json();
        
        // Process escalated audio alarms per site
        data.forEach(site => {
          if (site.status === 'offline') {
            if (!offlineStartTimes.current[site.id]) {
              // Newly offline
              offlineStartTimes.current[site.id] = Date.now();
              alarm1MinTriggered.current[site.id] = false;
              alarm5MinTriggered.current[site.id] = false;
            } else {
              const duration = Date.now() - offlineStartTimes.current[site.id];
              // Warning Alarm (Alarm 1)
              if (duration >= alarm1Threshold * 1000 && !alarm1MinTriggered.current[site.id]) {
                alarm1MinTriggered.current[site.id] = true;
                triggerFaahAlert();
              }
              // Critical Alarm (Alarm 2, plays for 60s)
              if (duration >= alarm2Threshold * 1000 && !alarm5MinTriggered.current[site.id]) {
                alarm5MinTriggered.current[site.id] = true;
                
                // Open the investigation warning modal
                setInvestigationModalSite(site);
                
                // Start repeating alarm for 60 seconds
                if (audioEnabledRef.current) {
                  playAlertSound();
                  let count = 0;
                  const intervalId = setInterval(() => {
                    if (audioEnabledRef.current) {
                      playAlertSound();
                    }
                    count++;
                    if (count >= 40) { // 40 * 1.5s = 60s
                      clearInterval(intervalId);
                      if (activeAlarms30s.current[site.id] === clearFn) {
                        delete activeAlarms30s.current[site.id];
                      }
                    }
                  }, 1500);
                  const clearFn = () => clearInterval(intervalId);
                  
                  if (activeAlarms30s.current[site.id]) {
                    activeAlarms30s.current[site.id]();
                  }
                  activeAlarms30s.current[site.id] = clearFn;
                }
              }
            }
          } else {
            // Site is online
            delete offlineStartTimes.current[site.id];
            delete alarm1MinTriggered.current[site.id];
            delete alarm5MinTriggered.current[site.id];
            if (activeAlarms30s.current[site.id]) {
              activeAlarms30s.current[site.id]();
              delete activeAlarms30s.current[site.id];
            }
            setInvestigationModalSite(prev => prev?.id === site.id ? null : prev);
          }
        });

        // Update sites state
        setSites(data);
      } else {
        console.warn("Erro HTTP ao carregar telemetria:", res.status);
        triggerAlert();
      }
      // Fetch incidents
      await fetchTodayIncidents();
    } catch (error) {
      console.warn("Erro ao carregar telemetria em tempo real:", error);
      triggerAlert();
    } finally {
      // Simulate slight network delay for high-tech HUD feel
      setTimeout(() => setSyncing(false), 600);
    }
  }, [triggerAlert, fetchTodayIncidents]); // Empty dependencies breaks the infinite API polling loop

  // Set up dynamic auto-polling loop
  useEffect(() => {
    // Run initial fetch in next tick to avoid synchronous setState cascading renders in effect body
    const timeoutId = setTimeout(fetchTelemetry, 0);
    const interval = setInterval(fetchTelemetry, syncInterval);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
      // Clean up all active alarms on unmount
      Object.keys(activeAlarms30s.current).forEach(id => {
        const numId = Number(id);
        if (activeAlarms30s.current[numId]) {
          activeAlarms30s.current[numId]();
        }
      });
    };
  }, [fetchTelemetry, syncInterval]);

  return (
    <div className="relative w-full h-full text-white">
      {/* Access Panel & Control Group */}
      <div className="absolute top-8 right-8 z-20 flex items-center gap-3">
        <Link 
          href="/admin" 
          title="Administração"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-[#a855f7]/40 text-neutral-400 hover:text-[#a855f7] backdrop-blur-md shadow-lg hover:shadow-[#a855f7]/10 cursor-pointer transition-all duration-300"
        >
          <Settings size={15} />
        </Link>

        <button
          onClick={handleLogout}
          title="Sair"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-red-500/40 text-neutral-400 hover:text-red-400 backdrop-blur-md shadow-lg hover:shadow-red-500/10 cursor-pointer transition-all duration-300"
        >
          <LogOut size={15} />
        </button>
      </div>

      {/* Recent Failures — clip wrapper hides it when sliding out */}
      <div
        className="absolute top-12 left-0 z-10 overflow-hidden"
        style={{
          width: failuresVisible ? '360px' : '0px',
          transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
          // tall enough to not clip content, invisible overflow to the left
          maxHeight: 'calc(100vh - 7rem)',
        }}
      >
        <div className="pl-8 pt-0">
          {/* Recent Failures Widget */}
          <div className="w-80 glass-panel p-5 rounded-[24px] border border-white/5 shadow-2xl flex flex-col gap-3 select-none pointer-events-auto">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" /> Falhas Recentes (Hoje)
              </span>
              <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest">
                Live
              </span>
            </div>

            <div className="h-[1px] bg-white/5 w-full" />

            {incidentsLoading ? (
              <div className="py-4 text-center text-[10px] font-mono text-neutral-500 uppercase tracking-wider animate-pulse">
                Carregando...
              </div>
            ) : recentIncidents.length === 0 ? (
              <div className="py-5 px-3 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 text-center bg-white/[0.005]">
                <div className="w-5 h-5 rounded-full bg-[#a855f7]/10 flex items-center justify-center border border-[#a855f7]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-300">Tudo operando normalmente</p>
                  <p className="text-[9px] text-neutral-500 mt-0.5">Nenhum incidente registrado hoje</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentIncidents.map((incident) => {
                  const timeString = new Date(incident.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                  return (
                    <div key={incident.id} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff3366] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-neutral-200 truncate">{incident.siteName}</div>
                          <div className="text-[8px] font-mono text-neutral-500 truncate mt-0.5">{incident.errorType}</div>
                        </div>
                      </div>
                      <div className="text-[8px] font-mono text-neutral-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                        {timeString}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="h-[1px] bg-white/5 w-full mt-0.5" />

            <Link href="/history" className="w-full py-2 bg-white/5 hover:bg-[#a855f7]/10 text-neutral-300 hover:text-[#a855f7] border border-white/10 hover:border-[#a855f7]/30 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer">
              <span>Ver Histórico Geral</span>
              <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      </div>

      {/* Toggle button for failures — always visible, slides left/right with failures panel */}
      <button
        onClick={() => setFailuresVisible(v => !v)}
        title={failuresVisible ? 'Ocultar falhas' : 'Exibir falhas'}
        className="absolute top-12 mt-2 z-20 w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d0d0d]/80 border border-white/10 hover:border-[#a855f7]/40 text-neutral-400 hover:text-[#a855f7] backdrop-blur-md shadow-lg hover:shadow-[#a855f7]/10 cursor-pointer transition-colors duration-200"
        style={{
          left: failuresVisible ? '368px' : '8px',
          transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {failuresVisible ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
      </button>

      {/* Logo Centralizado */}
      <div className="absolute flex flex-col items-center top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
        <img src="/images/sentry_logo.png" alt="Logo NVGO" className="w-50 h-auto object-contain" />
        <div className="absolute flex flex-row items-center top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-amber-400 animate-ping' : 'bg-[#a855f7]'}`} />
            <span className={`text-[8px] font-mono uppercase tracking-wider ${syncing ? 'text-amber-400' : 'text-[#a855f7]'}`}>
                {syncing ? 'SYNCING...' : 'LIVE'}
            </span>
        </div>
      </div>


      {/* Sidebar — clip wrapper hides it when sliding out */}
      <div
        className="absolute top-28 right-0 z-10 overflow-hidden"
        style={{
          width: sidebarVisible ? '360px' : '0px',
          transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
          // tall enough to not clip content, invisible overflow to the right
          maxHeight: 'calc(100vh - 7rem)',
        }}
      >
        <div className="pr-8 pt-0">
          <Sidebar
            sites={sites}
            onSelectSite={(site) => setSelectedSiteId(site.id)}
            selectedSiteId={selectedSiteId}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
          />
        </div>
      </div>

      {/* Toggle button — always visible, slides right/left with sidebar */}
      <button
        onClick={() => setSidebarVisible(v => !v)}
        title={sidebarVisible ? 'Ocultar menu' : 'Exibir menu'}
        className="absolute top-28 mt-2 z-20 w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d0d0d]/80 border border-white/10 hover:border-[#a855f7]/40 text-neutral-400 hover:text-[#a855f7] backdrop-blur-md shadow-lg hover:shadow-[#a855f7]/10 cursor-pointer transition-colors duration-200"
        style={{
          right: sidebarVisible ? '368px' : '8px',
          transition: 'right 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {sidebarVisible ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
      </button>

      <div className="w-full h-full">
        <BrainCanvas sites={sites} onSelectSite={(site) => setSelectedSiteId(site.id)} selectedSiteId={selectedSiteId} />
      </div>

      {/* Modal Reativo */}
      {selectedSite && (
        <MonitorModal 
          site={selectedSite} 
          onClose={() => setSelectedSiteId(null)} 
          isSidebarOpen={sidebarVisible}
        />
      )}

      {/* Widget de Expiração de Domínios */}
      <DomainExpirationWidget sites={sites} isFailuresOpen={failuresVisible} />

      {/* Modal de Investigação (Alerta de 5 min) */}
      {investigationModalSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative glass-panel p-6 rounded-[28px] max-w-sm w-full border border-red-500/30 shadow-2xl shadow-red-500/5 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300 select-none">
            {/* Top red warning line */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[28px] bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
            
            {/* Glowing Icon */}
            <div className="relative mt-2">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-md animate-ping" />
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 relative">
                <AlertTriangle size={28} className="animate-pulse" />
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-extrabold text-red-500 uppercase tracking-wider font-sans">
                ALERTA CRÍTICO
              </h3>
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                O site <strong className="text-white font-bold">{investigationModalSite.name}</strong> está offline há mais de 5 minutos!
              </p>
              <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[280px]">
                {investigationModalSite.url}
              </span>
            </div>

            {/* Button */}
            <button
              onClick={() => handleStartInvestigation(investigationModalSite.id)}
              className="mt-2 w-full py-3 rounded-2xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-500/10 hover:shadow-red-500/25 cursor-pointer active:scale-95"
            >
              Iniciando investigação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}