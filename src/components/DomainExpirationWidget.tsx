import React, { useState } from 'react';
import { SiteData } from '@/types/monitor';
import { getDaysUntil } from '@/lib/date';
import { Globe, Calendar, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Bell } from 'lucide-react';

interface DomainExpirationWidgetProps {
  sites: SiteData[];
  isFailuresOpen?: boolean;
}

export default function DomainExpirationWidget({ sites, isFailuresOpen = false }: DomainExpirationWidgetProps) {
  const [isOpen, setIsOpen] = useState(true);
  const leftValue = isFailuresOpen ? '32px' : '32px';

  // Filter sites that have domainExpiration set
  const sitesWithExpiration = sites.filter(s => s.domainExpiration && s.domainExpiration.trim() !== '');

  // Calculate days for each site and classify them
  const processedSites = sitesWithExpiration
    .map(site => {
      const days = getDaysUntil(site.domainExpiration);
      return {
        ...site,
        daysRemaining: days
      };
    })
    // Sort by urgent (most remaining days <= 0 first, then smallest positive days)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Filter those expiring in 30 days or less (or already expired)
  const expiringSites = processedSites.filter(site => site.daysRemaining <= 30);

  const totalAlerts = expiringSites.length;
  const criticalAlerts = expiringSites.filter(s => s.daysRemaining <= 7).length;

  // Render minimized state
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        id="btn-domain-widget-expand"
        title="Ver Alertas de Domínios"
        className={`fixed bottom-8 z-30 p-3.5 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer group hover:scale-105 active:scale-95 ${
          totalAlerts > 0
            ? criticalAlerts > 0
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/30 hover:border-red-500/50 shadow-red-500/5'
              : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:border-yellow-500/50 shadow-yellow-500/5'
            : 'bg-white/5 hover:bg-[#a855f7]/10 text-neutral-400 hover:text-[#a855f7] border-white/10 hover:border-[#a855f7]/30'
        }`}
        style={{
          left: leftValue
        }}
      >
        <div className="relative">
          <Globe size={18} className="animate-pulse" />
          {totalAlerts > 0 && (
            <span className={`absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border font-sans ${
              criticalAlerts > 0
                ? 'bg-[#ff3366] border-[#ff3366]/20 text-white animate-bounce'
                : 'bg-yellow-500 border-yellow-500/20 text-black'
            }`}>
              {totalAlerts}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-8 z-30 w-[340px] glass-panel rounded-[24px] border border-white/5 shadow-2xl flex flex-col overflow-hidden max-h-[420px] transition-all duration-300 select-none animate-in fade-in slide-in-from-bottom-5 duration-300"
      style={{
        left: leftValue,
        boxShadow: totalAlerts > 0 
          ? criticalAlerts > 0 
            ? '0 20px 40px -15px rgba(255, 51, 102, 0.08), 0 0 0 1px rgba(255, 51, 102, 0.05)'
            : '0 20px 40px -15px rgba(234, 179, 8, 0.08), 0 0 0 1px rgba(234, 179, 8, 0.05)'
          : 'none'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-white/[0.01] border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsOpen(false)}
        id="domain-widget-header"
      >
        <div className="flex items-center gap-2">
          {totalAlerts > 0 ? (
            criticalAlerts > 0 ? (
              <ShieldAlert size={14} className="text-[#ff3366] animate-pulse" />
            ) : (
              <AlertTriangle size={14} className="text-yellow-500" />
            )
          ) : (
            <Globe size={14} className="text-[#a855f7]" />
          )}
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300 font-sans">
            Expiração de Domínios
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
              criticalAlerts > 0 
                ? 'bg-[#ff3366]/10 text-[#ff3366] border border-[#ff3366]/20' 
                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
            }`}>
              {totalAlerts} {totalAlerts === 1 ? 'ALERTA' : 'ALERTAS'}
            </span>
          )}
          <button 
            id="btn-domain-widget-collapse"
            className="text-neutral-400 hover:text-white transition-colors"
            title="Minimizar Widget"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 max-h-[340px]">
        {expiringSites.length === 0 ? (
          <div className="py-8 px-4 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2.5 text-center bg-white/[0.005]">
            <div className="w-8 h-8 rounded-full bg-[#a855f7]/10 flex items-center justify-center border border-[#a855f7]/20">
              <Globe size={16} className="text-[#a855f7]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-neutral-200">Tudo sob controle</p>
              <p className="text-[9px] text-neutral-500 mt-1 max-w-[200px] leading-relaxed">
                Nenhum domínio registrado expira nos próximos 30 dias.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {expiringSites.map((site) => {
              const days = site.daysRemaining;
              
              // Formatting expiration date beautifully
              let dateFormatted = site.domainExpiration;
              try {
                if (site.domainExpiration) {
                  const [year, month, day] = site.domainExpiration.split('-');
                  dateFormatted = `${day}/${month}/${year}`;
                }
              } catch (e) {
                // fall back to default string
              }

              // Color configuration depending on days left
              let textColor = 'text-[#a855f7]';
              let bgColor = 'bg-[#a855f7]/5';
              let borderColor = 'border-[#a855f7]/20';
              let badgeText = `${days} dias`;

              if (days <= 0) {
                textColor = 'text-[#ff3366]';
                bgColor = 'bg-[#ff3366]/10';
                borderColor = 'border-[#ff3366]/25';
                badgeText = 'Expirado';
              } else if (days <= 7) {
                textColor = 'text-amber-500';
                bgColor = 'bg-amber-500/10';
                borderColor = 'border-amber-500/25';
                badgeText = `Urgente: ${days}d`;
              } else if (days <= 30) {
                textColor = 'text-yellow-400';
                bgColor = 'bg-yellow-500/10';
                borderColor = 'border-yellow-500/25';
                badgeText = `Atenção: ${days}d`;
              }

              return (
                <div 
                  key={site.id} 
                  className={`p-3 rounded-xl border bg-white/[0.015] hover:bg-white/[0.03] transition-all flex flex-col gap-1.5 ${
                    days <= 0 
                      ? 'border-[#ff3366]/15 hover:border-[#ff3366]/30 shadow-[0_4px_12px_rgba(255,51,102,0.02)]' 
                      : days <= 7
                        ? 'border-amber-500/15 hover:border-amber-500/30'
                        : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-neutral-200 truncate font-sans">
                        {site.name}
                      </div>
                      <div className="text-[8px] font-mono text-neutral-500 truncate mt-0.5">
                        {site.url.replace(/^https?:\/\//i, '')}
                      </div>
                    </div>
                    
                    <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded font-mono shrink-0 ${textColor} ${bgColor} border ${borderColor}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div className="h-[1px] bg-white/[0.03] w-full" />

                  <div className="flex items-center justify-between text-[8px] font-mono text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} className="text-neutral-500" />
                      Vencimento:
                    </span>
                    <span className="text-neutral-300 font-medium">
                      {dateFormatted}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
