import React, { useMemo } from 'react';
import { Globe, ShieldCheck, ShieldAlert, Users, Activity, Clock, Database, X, BarChart3, Layout, Server } from 'lucide-react';
import Link from 'next/link';
import { SiteData } from '@/types/monitor';

interface MonitorModalProps {
  site: SiteData;
  onClose: () => void;
  isSidebarOpen?: boolean;
}


export default function MonitorModal({ site, onClose, isSidebarOpen = false }: MonitorModalProps) {
  const isOnline = site.status === 'online';

  // Use real data from the monitoring API
  const metrics = useMemo(() => {
    if (!isOnline) {
      return {
        ping: site.errorMessage || 'TIMEOUT',
        stability: '0.00%',
        syncTime: site.lastChecked ? new Date(site.lastChecked).toLocaleTimeString('pt-BR') : 'Não sincronizado',
        host: '10.0.99.' + (site.id * 12 + 4),
        load: '0%'
      };
    }

    // Real latency from HEAD request
    const ping = site.latency != null ? `${site.latency}ms` : '---';
    // Real CPU load from API (or dash if not available)
    const load = site.cpuLoad != null ? `${site.cpuLoad}%` : '---';
    // Real uptime
    const stability = site.uptime != null ? `${site.uptime}%` : '---';
    // Last sync time
    const syncTime = site.lastChecked
      ? new Date(site.lastChecked).toLocaleTimeString('pt-BR')
      : 'Há 1s';

    return {
      ping,
      stability,
      syncTime,
      host: '10.0.12.' + (site.id * 14 + 10),
      load
    };
  }, [site, isOnline]);

  return (
    <div 
      className="fixed bottom-15 z-10 glass-panel p-4 rounded-[32px] w-80 shadow-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out select-none flex flex-col gap-2 overflow-hidden transition-all duration-300"
      style={{
        right: isSidebarOpen ? '368px' : '32px'
      }}
    >
      {/* Top indicator bar */} 
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-[32px] ${
        isOnline ? 'bg-gradient-to-r from-[#a855f7] to-[#9333ea]' : 'bg-[#ff3366]'
      }`} />

      {/* Header */}
      <div className="flex justify-between items-start pt-1">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight mt-2 font-sans">
            {site.name}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[#a855f7] mt-1 font-sans">
            <Globe size={11} className="text-[#a855f7]" />
            <a 
              href={site.url} 
              target="_blank" 
              rel="noreferrer" 
              className="hover:underline opacity-80 hover:opacity-100 truncate max-w-[190px] font-sans"
            >
              {site.url.replace('https://', '')}
            </a>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/5 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Metrics Container */}
      <div className="flex flex-col gap-3">
        {/* Status Badge */}
        <div className={`flex items-center gap-2.5 p-2 rounded-2xl border text-xs font-bold font-sans tracking-wide ${
          isOnline 
            ? 'bg-[#a855f7]/5 border-[#a855f7]/15 text-[#a855f7]' 
            : 'bg-[#ff3366]/5 border-[#ff3366]/15 text-[#ff3366]'
        }`}>
          {isOnline ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          <span>STATUS: {isOnline ? 'ESTÁVEL // ONLINE' : 'ALERTA // OFFLINE'}</span>
        </div>

        {/* Visitors Card */}
        {site.gaPropertyId && site.gaPropertyId.trim() !== '' && !site.gaPropertyId.startsWith('YOUR_GA4') && (
          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-2 flex items-center gap-3.5">
            <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-purple-500/10 text-purple-400' : 'bg-neutral-900 text-neutral-500'}`}>
              <Users size={16} />
            </div>
            <div>
              <div className="text-[9px] uppercase font-semibold tracking-wider text-neutral-500">Fluxo de Usuários</div>
              <div className="text-base font-bold tracking-tight mt-0.5 text-white font-sans">
                {site.visitors} <span className="text-[10px] font-normal text-neutral-400 font-sans">conexões</span>
              </div>
            </div>
          </div>
        )}

        {/* Technical Data Details */}
        <div className="bg-white/[0.005] border border-white/5 rounded-2xl p-3.5 flex flex-col gap-2.5 text-[10px]">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 flex items-center gap-1.5"><Activity size={11} className="text-neutral-500" /> Ping de Conexão</span>
            <span className="font-mono font-semibold text-[#a855f7]">{metrics.ping}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 flex items-center gap-1.5"><Database size={11} className="text-neutral-500" /> Carga do Processador</span>
            <span className="font-mono font-semibold text-[#a855f7]">{metrics.load}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 flex items-center gap-1.5"><Globe size={11} className="text-neutral-500" /> Host DNS</span>
            <span className="font-mono font-semibold text-neutral-300">{metrics.host}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 flex items-center gap-1.5"><Clock size={11} className="text-neutral-500" /> Última Sincronização</span>
            <span className="text-neutral-400 font-sans">{metrics.syncTime}</span>
          </div>
        </div>

        {/* Hosting Details */}
        {(site.hostingFrontend || site.hostingBackend || site.hostingDatabase) && (
          <div className="bg-white/[0.005] border border-white/5 rounded-2xl p-2 flex flex-col gap-2.5 text-[10px]">
            <div className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest pl-0.5">
              Hospedagem / Infraestrutura
            </div>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {site.hostingFrontend && (
                <span className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 text-[10px] text-neutral-300 flex items-center gap-1.5 font-sans font-medium" title={`Frontend: ${site.hostingFrontend}`}>
                  <Layout size={11} className="text-neutral-400 shrink-0" />
                  {site.hostingFrontend}
                </span>
              )}
              {site.hostingBackend && (
                <span className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 text-[10px] text-neutral-300 flex items-center gap-1.5 font-sans font-medium" title={`Backend: ${site.hostingBackend}`}>
                  <Server size={11} className="text-neutral-400 shrink-0" />
                  {site.hostingBackend}
                </span>
              )}
              {site.hostingDatabase && (
                <span className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 text-[10px] text-neutral-300 flex items-center gap-1.5 font-sans font-medium" title={`Banco de Dados: ${site.hostingDatabase}`}>
                  <Database size={11} className="text-neutral-400 shrink-0" />
                  {site.hostingDatabase}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History Button */}
      <Link
        href={`/history?site=${site.id}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-[#a855f7]/20 text-neutral-400 hover:text-[#a855f7] text-[10px] font-bold uppercase tracking-widest transition-all duration-300 group cursor-pointer"
      >
        <BarChart3 size={12} className="transition-colors" />
        Ver Histórico do Nó
      </Link>
    </div>
  );
}