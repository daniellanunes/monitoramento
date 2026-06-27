import React from 'react';
import { SiteData } from '@/types/monitor';
import { Cpu, Activity, Server, ServerCrash, Crosshair, Volume2, VolumeX } from 'lucide-react';

interface SidebarProps {
  sites: SiteData[];
  onSelectSite?: (site: SiteData) => void;
  selectedSiteId?: number | null;
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
}

export default function Sidebar({ 
  sites, 
  onSelectSite, 
  selectedSiteId,
  audioEnabled = false,
  onToggleAudio
}: SidebarProps) {
  const total = sites.length;
  const online = sites.filter(s => s.status === 'online').length;
  const offline = total - online;

  const onlySites = sites
    .filter(s => (s.type || 'site') === 'site')
    .map((site, index) => ({ site, index }))
    .sort((a, b) => {
      if (a.site.status === 'offline' && b.site.status === 'online') return -1;
      if (a.site.status === 'online' && b.site.status === 'offline') return 1;
      return a.index - b.index;
    })
    .map(item => item.site);

  const onlyServers = sites
    .filter(s => s.type === 'server')
    .map((site, index) => ({ site, index }))
    .sort((a, b) => {
      if (a.site.status === 'offline' && b.site.status === 'online') return -1;
      if (a.site.status === 'online' && b.site.status === 'offline') return 1;
      return a.index - b.index;
    })
    .map(item => item.site);

  const renderSiteItem = (site: SiteData) => {
    const isOnline = site.status === 'online';
    const isServer = site.type === 'server';
    // Use real latency from monitoring API
    const latency = isOnline && site.latency ? `${site.latency}ms` : 'TIMEOUT';
    
    const isSelected = selectedSiteId === site.id;
    return (
      <div
        key={site.id}
        onClick={() => onSelectSite?.(site)}
        className={`w-full relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 group cursor-pointer ${
          isSelected
            ? isServer
              ? 'bg-[#00d2ff]/[0.06] border-[#00d2ff]/30 shadow-[0_0_16px_rgba(0,210,255,0.08)]'
              : 'bg-[#a855f7]/[0.06] border-[#a855f7]/30 shadow-[0_0_16px_rgba(168, 85, 247,0.08)]'
            : isOnline
              ? 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
              : 'border-[#ff3366]/15 bg-[#ff3366]/[0.02] hover:border-[#ff3366]/25'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl transition-colors ${
            isOnline 
              ? isServer
                ? 'bg-[#00d2ff]/5 text-[#00d2ff] group-hover:bg-[#00d2ff]/10'
                : 'bg-[#a855f7]/5 text-[#a855f7] group-hover:bg-[#a855f7]/10' 
              : 'bg-[#ff3366]/5 text-[#ff3366] group-hover:bg-[#ff3366]/10'
          }`}>
            {isOnline ? <Server size={14} /> : <ServerCrash size={14} />}
          </div>
          <div>
            <div className="text-[12px] font-bold text-neutral-200 group-hover:text-white transition-colors truncate max-w-[140px] font-sans">
              {site.name}
            </div>
            <div className="text-[9px] text-neutral-500 font-mono mt-0.5 flex items-center gap-1.5">
              <span>ping: {latency}</span>
              {isOnline && site.gaPropertyId && site.gaPropertyId.trim() !== '' && !site.gaPropertyId.startsWith('YOUR_GA4') && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                  <span>acc: {site.visitors}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pulsing state light indicator */}
        <div className="flex items-center gap-2 pr-1">
          {isSelected && (
            <Crosshair size={13} className={`${isServer ? 'text-[#00d2ff]' : 'text-[#a855f7]'} animate-pulse`} />
          )}
          <span className="relative flex h-2 w-2">
            {isOnline && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isServer ? 'bg-[#00d2ff]' : 'bg-[#a855f7]'
              }`}></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isOnline 
                ? isServer 
                  ? 'bg-[#00d2ff]' 
                  : 'bg-[#a855f7]'
                : 'bg-[#ff3366]'
            }`}></span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 h-[calc(100vh-170px)] glass-panel p-6 rounded-[32px] border border-white/5 shadow-2xl flex flex-col gap-5 select-none">
      
      {/* Network Overview */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Cpu className="text-[#a855f7]" size={16} />
            <h2 className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase font-sans">
              Status da Rede
            </h2>
          </div>
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              title={audioEnabled ? 'Mutar Alertas' : 'Ativar Alertas'}
              className={`p-1.5 rounded-xl border transition-all duration-300 backdrop-blur-md cursor-pointer flex items-center justify-center ${
                audioEnabled
                  ? 'bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#a855f7] border-[#a855f7]/30 hover:border-[#a855f7]/50 shadow-lg shadow-[#a855f7]/5'
                  : 'bg-white/5 hover:bg-amber-500/10 text-amber-500/80 hover:text-amber-400 border-amber-500/20 hover:border-amber-500/40 animate-pulse'
              }`}
            >
              {audioEnabled ? (
                <Volume2 size={13} />
              ) : (
                <VolumeX size={13} className="text-amber-500" />
              )}
            </button>
          )}
        </div>
        
        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">Total</span>
            <span className="text-lg font-bold text-white mt-0.5 font-sans">{total}</span>
          </div>
          <div className="bg-[#a855f7]/[0.01] border border-[#a855f7]/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] font-semibold text-[#a855f7]/70 uppercase tracking-wider">Ativos</span>
            <span className="text-lg font-bold text-[#a855f7] mt-0.5 font-sans">{online}</span>
          </div>
          <div className="bg-[#ff3366]/[0.01] border border-[#ff3366]/10 rounded-2xl p-3 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] font-semibold text-[#ff3366]/70 uppercase tracking-wider">Falha</span>
            <span className="text-lg font-bold text-[#ff3366] mt-0.5 font-sans">{offline}</span>
          </div>
        </div>
      </div>

      <div className="h-[1px] bg-white/5 w-full" />

      {/* Nodes list */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={12} className="text-neutral-500" /> Nós do Sistema
          </span>
          <span className="text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 font-mono animate-pulse">
            LIVE
          </span>
        </div>

        {/* Sites Section */}
        <div className="flex-1 min-h-0 flex flex-col mb-2">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#a855f7] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
              Sites ({onlySites.length})
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
            {onlySites.length === 0 ? (
              <div className="py-6 text-center text-[9px] font-mono text-neutral-500 uppercase tracking-wider border border-dashed border-white/5 rounded-2xl">
                Nenhum site cadastrado
              </div>
            ) : (
              onlySites.map((site) => renderSiteItem(site))
            )}
          </div>
        </div>

        {/* Separator line between Sites and Servers */}
        <div className="h-[1px] bg-white/5 w-full shrink-0 my-1" />

        {/* Servers Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2 mt-2 px-1 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00d2ff] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff]" />
              Servidores ({onlyServers.length})
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
            {onlyServers.length === 0 ? (
              <div className="py-6 text-center text-[9px] font-mono text-neutral-500 uppercase tracking-wider border border-dashed border-white/5 rounded-2xl">
                Nenhum servidor cadastrado
              </div>
            ) : (
              onlyServers.map((site) => renderSiteItem(site))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}