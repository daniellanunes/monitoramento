"use client";

import React from 'react';
import Link from 'next/link';
import { Activity, Globe, History, ShieldAlert, ArrowRight, Server, ShieldCheck, Sparkles } from 'lucide-react';

export default function WelcomeHome() {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#050505] text-slate-100 font-sans custom-scrollbar relative">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] bg-[rgba(168,85,247,0.05)] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-x-1/2 translate-y-1/2 w-[45vw] h-[45vw] max-w-[600px] bg-[rgba(6,182,212,0.03)] blur-[160px] rounded-full pointer-events-none" />

      {/* Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex justify-between items-center border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div>
            <img src="/images/sentry_logo.png" alt="Sentry Logo" className="w-35 h-auto object-contain" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[12px] text-[#a855f7] font-mono tracking-widest uppercase">
              Monitoramento Avançado de Sites e Servidores
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/login?tab=login" 
            className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors duration-200"
          >
            Entrar
          </Link>
          <Link 
            href="/login?tab=register" 
            className="bg-white/5 hover:bg-[#a855f7]/10 text-white hover:text-[#a855f7] text-xs font-bold tracking-wider uppercase py-2.5 px-5 rounded-xl border border-white/10 hover:border-[#a855f7]/30 transition-all duration-300 flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <span>Criar Conta</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-7xl mx-auto px-6 pt-16 pb-24 relative z-10 flex flex-col items-center">
        
        {/* Decorative Badge */}

        {/* Hero Headlines */}
        <div className="text-center max-w-3xl flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight uppercase font-sans">
            Sua Infraestrutura em <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#06b6d4] drop-shadow-[0_2px_15px_rgba(168,85,247,0.15)]">
              Malha Neural 3D
            </span>
          </h2>
          <p className="mt-6 text-sm md:text-base text-neutral-400 font-sans leading-relaxed max-w-2xl">
            Monitore a saúde de seus sites, APIs e servidores em tempo real com uma interface visual tridimensional interativa. Receba telemetria instantânea, histórico de incidentes e alertas inteligentes de domínio em um único painel centralizado.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full justify-center max-w-sm animate-fade-in">
          <Link
            href="/login?tab=register"
            className="flex-1 bg-[#a855f7] hover:bg-[#9333ea] text-white font-extrabold text-xs tracking-widest uppercase py-4 px-6 rounded-2xl border border-transparent shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] transition-all duration-300 flex items-center justify-center text-center active:scale-95"
          >
            Cadastrar Minha Empresa
          </Link>
          <Link
            href="/login?tab=login"
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs tracking-widest uppercase py-4 px-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center text-center active:scale-95"
          >
            Acessar Painel
          </Link>
        </div>

        {/* Mockup / Feature Showcase */}
        <div className="w-full max-w-5xl mt-20 relative rounded-3xl overflow-hidden border border-white/5 bg-white/[0.01] backdrop-blur-sm p-4 md:p-6 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-[1] pointer-events-none" />
         

          {/* Core Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 mt-2">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/50 hover:bg-[#a855f7]/5 hover:border-[#a855f7]/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#a855f7] group-hover:bg-[#a855f7]/10 group-hover:border-[#a855f7]/25 transition-all mb-4">
                <Server size={18} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Malha Neural 3D
              </h3>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed font-sans">
                Interface interativa em ThreeJS que mapeia sites e microsserviços como nós neuronais interconectados no espaço 3D.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/50 hover:bg-[#a855f7]/5 hover:border-[#a855f7]/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#a855f7] group-hover:bg-[#a855f7]/10 group-hover:border-[#a855f7]/25 transition-all mb-4">
                <Activity size={18} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Telemetria Realtime
              </h3>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed font-sans">
                Acompanhamento contínuo de latência, incidentes online/offline e visitas com alarmes sonoros configuráveis em caso de quedas.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/50 hover:bg-[#a855f7]/5 hover:border-[#a855f7]/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#a855f7] group-hover:bg-[#a855f7]/10 group-hover:border-[#a855f7]/25 transition-all mb-4">
                <History size={18} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Histórico Inteligente
              </h3>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed font-sans">
                Calendário integrado e relatórios de instabilidades que compilam dados diários e mensais sobre a estabilidade de cada cliente.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-white/5 bg-[#0a0a0a]/50 hover:bg-[#a855f7]/5 hover:border-[#a855f7]/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-[#a855f7] group-hover:bg-[#a855f7]/10 group-hover:border-[#a855f7]/25 transition-all mb-4">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Alerta de Domínios
              </h3>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed font-sans">
                Widget inteligente de DNS e certificados que alerta quantos dias faltam para a expiração de domínio de cada site ativo.
              </p>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-[#020202] py-8 text-center text-[10px] text-neutral-500 font-mono tracking-wider uppercase relative z-10">
        <p>© 2026 Sentry 3D • Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
