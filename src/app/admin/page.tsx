"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Plus, Trash2, Edit3, Server, Settings, Globe, MapPin, Eye, Info, X, Check, BarChart3 } from 'lucide-react';
import { db, auth, isFirebaseConfigured } from '@/lib/firebase';
import { collection, getDocs, setDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { SiteData } from '@/types/monitor';
import { getDaysUntil } from '@/lib/date';

const defaultSites: Omit<SiteData, 'status' | 'visitors'>[] = [];

export default function AdminPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // CRUD state
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'site' | 'server'>('site');

  // Form fields
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [editPosition, setEditPosition] = useState<[number, number, number] | null>(null);
  const [gaPropertyId, setGaPropertyId] = useState('');
  const [domainExpiration, setDomainExpiration] = useState('');
  const [hostingFrontend, setHostingFrontend] = useState('');
  const [hostingBackend, setHostingBackend] = useState('');
  const [hostingDatabase, setHostingDatabase] = useState('');

  // Global settings states
  const [syncInterval, setSyncInterval] = useState(12000);
  const [pingTimeout, setPingTimeout] = useState(4000);
  const [alarm1Threshold, setAlarm1Threshold] = useState(60);
  const [alarm2Threshold, setAlarm2Threshold] = useState(300);
  const [whoisSyncEnabled, setWhoisSyncEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load Global Settings
  const loadSettings = async (demo: boolean) => {
    setSettingsLoading(true);
    const defaultSettings = {
      syncInterval: 12000,
      pingTimeout: 4000,
      alarm1Threshold: 60,
      alarm2Threshold: 300,
      whoisSyncEnabled: true
    };

    if (demo) {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('global_settings');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setSyncInterval(parsed.syncInterval ?? 12000);
            setPingTimeout(parsed.pingTimeout ?? 4000);
            setAlarm1Threshold(parsed.alarm1Threshold ?? 60);
            setAlarm2Threshold(parsed.alarm2Threshold ?? 300);
            setWhoisSyncEnabled(parsed.whoisSyncEnabled !== false);
          } catch (e) {
            console.error("Erro ao analisar configurações locais:", e);
          }
        } else {
          window.localStorage.setItem('global_settings', JSON.stringify(defaultSettings));
        }
      }
      setSettingsLoading(false);
      return;
    }

    if (!isFirebaseConfigured || !db) {
      setSettingsLoading(false);
      return;
    }

    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSyncInterval(data.syncInterval ?? 12000);
        setPingTimeout(data.pingTimeout ?? 4000);
        setAlarm1Threshold(data.alarm1Threshold ?? 60);
        setAlarm2Threshold(data.alarm2Threshold ?? 300);
        setWhoisSyncEnabled(data.whoisSyncEnabled !== false);
      } else {
        await setDoc(docRef, defaultSettings);
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do Firestore:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Save Global Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setLoading(true);

    const updatedSettings = {
      syncInterval: Number(syncInterval),
      pingTimeout: Number(pingTimeout),
      alarm1Threshold: Number(alarm1Threshold),
      alarm2Threshold: Number(alarm2Threshold),
      whoisSyncEnabled: Boolean(whoisSyncEnabled)
    };

    try {
      if (isDemoMode) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('global_settings', JSON.stringify(updatedSettings));
        }
        setFormSuccess("Configurações salvas localmente!");
      } else if (db) {
        const docRef = doc(db, 'settings', 'global');
        await setDoc(docRef, updatedSettings);
        setFormSuccess("Configurações do monitor atualizadas com sucesso!");
      }
    } catch (err: any) {
      setFormError(`Erro ao salvar configurações: ${err.message || 'Erro de conexão.'}`);
    } finally {
      setLoading(false);
    }
  };

  // 1. Auth Protection
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserEmail(user.email);
          setIsDemoMode(false);
          setAuthChecking(false);
          loadSites(false);
          loadSettings(false);
        } else {
          // If not logged in, check if demo session exists
          checkDemoSession();
        }
      });
      return () => unsubscribe();
    } else {
      checkDemoSession();
    }
  }, []);

  const checkDemoSession = () => {
    if (typeof window !== 'undefined') {
      const isDemoLoggedIn = window.sessionStorage.getItem('demo_admin_logged_in') === 'true';
      const demoEmail = window.sessionStorage.getItem('demo_admin_email');
      
      if (isDemoLoggedIn && demoEmail) {
        setUserEmail(demoEmail);
        setIsDemoMode(true);
        setAuthChecking(false);
        loadSites(true);
        loadSettings(true);
      } else {
        router.push('/login');
      }
    }
  };

  // 2. Load Monitored Sites
  const loadSites = async (demo: boolean) => {
    setLoading(true);
    if (demo) {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('demo_sites');
        if (stored) {
          setSites(JSON.parse(stored));
        } else {
          window.localStorage.setItem('demo_sites', JSON.stringify(defaultSites));
          setSites(defaultSites);
        }
      }
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured || !db) return;

    try {
      const sitesCollection = collection(db, 'sites');
      const snapshot = await getDocs(sitesCollection);
      const fetched: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetched.push({
          id: typeof data.id === 'number' ? data.id : parseInt(doc.id, 10),
          name: data.name || "Sem Nome",
          url: data.url || "",
          type: data.type || "site",
          gaPropertyId: data.gaPropertyId || "",
          position: Array.isArray(data.position) ? data.position : [0, 0, 0],
          domainExpiration: data.domainExpiration || "",
          hostingFrontend: data.hostingFrontend || "",
          hostingBackend: data.hostingBackend || "",
          hostingDatabase: data.hostingDatabase || ""
        });
      });
      fetched.sort((a, b) => a.id - b.id);
      setSites(fetched);
    } catch (err) {
      console.error("Erro ao carregar sites:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    if (isDemoMode) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('demo_admin_logged_in');
        window.sessionStorage.removeItem('demo_admin_email');
      }
      router.push('/login');
      return;
    }

    if (auth) {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (err) {
        console.error("Erro ao deslogar:", err);
      }
    }
  };

  // 4. CRUD Submit (Save or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Basic Validation
    if (!name.trim() || !url.trim()) {
      setFormError("Nome e URL são obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      if (editId !== null) {
        // Edit existing site - keep its original coordinates
        const siteData = {
          id: editId,
          name: name.trim(),
          url: url.trim(),
          type: activeTab,
          position: editPosition || [0, 1.2, 0],
          gaPropertyId: gaPropertyId.trim(),
          domainExpiration: domainExpiration.trim(),
          hostingFrontend: hostingFrontend.trim(),
          hostingBackend: hostingBackend.trim(),
          hostingDatabase: hostingDatabase.trim()
        };

        if (isDemoMode) {
          const updated = sites.map(s => s.id === editId ? siteData : s);
          setSites(updated);
          window.localStorage.setItem('demo_sites', JSON.stringify(updated));
        } else if (db) {
          await setDoc(doc(db, 'sites', String(editId)), siteData);
        }
        setFormSuccess(activeTab === 'site' ? "Site atualizado com sucesso!" : "Servidor atualizado com sucesso!");
        resetForm();
      } else {
        // Create new site - generate random coordinates inside the 3D neural net layout
        const nextId = sites.length > 0 ? Math.max(...sites.map(s => s.id)) + 1 : 1;
        
        // Random layout coordinates that spread nicely within ThreeJS scene range
        const x = parseFloat((Math.random() * 2.6 - 1.3).toFixed(2));
        const y = parseFloat((Math.random() * 2.0 - 0.8).toFixed(2));
        const z = parseFloat((Math.random() * 2.0 - 1.0).toFixed(2));

        const siteData = {
          id: nextId,
          name: name.trim(),
          url: url.trim(),
          type: activeTab,
          position: [x, y, z],
          gaPropertyId: gaPropertyId.trim(),
          domainExpiration: domainExpiration.trim(),
          hostingFrontend: hostingFrontend.trim(),
          hostingBackend: hostingBackend.trim(),
          hostingDatabase: hostingDatabase.trim()
        };

        if (isDemoMode) {
          const updated = [...sites, siteData];
          setSites(updated);
          window.localStorage.setItem('demo_sites', JSON.stringify(updated));
        } else if (db) {
          await setDoc(doc(db, 'sites', String(nextId)), siteData);
        }
        setFormSuccess("Novo site adicionado com sucesso!");
        resetForm();
      }
      
      // Reload sites to match database
      await loadSites(isDemoMode);
    } catch (err: any) {
      setFormError(`Erro ao salvar: ${err.message || 'Erro de conexão.'}`);
    } finally {
      setLoading(false);
    }
  };

  // 5. Populate Form for Edit
  const handleStartEdit = (site: any) => {
    setEditId(site.id);
    setName(site.name);
    setUrl(site.url);
    setEditPosition(site.position);
    setGaPropertyId(site.gaPropertyId || '');
    setDomainExpiration(site.domainExpiration || '');
    setHostingFrontend(site.hostingFrontend || '');
    setHostingBackend(site.hostingBackend || '');
    setHostingDatabase(site.hostingDatabase || '');
    setActiveTab(site.type || 'site');
    setFormError(null);
    setFormSuccess(null);
  };

  // 6. Delete Site
  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover este site do monitoramento?")) return;
    setLoading(true);

    try {
      if (isDemoMode) {
        const updated = sites.filter(s => s.id !== id);
        setSites(updated);
        window.localStorage.setItem('demo_sites', JSON.stringify(updated));
      } else if (db) {
        await deleteDoc(doc(db, 'sites', String(id)));
      }
      setFormSuccess("Site removido do monitoramento!");
      await loadSites(isDemoMode);
      if (editId === id) resetForm();
    } catch (err: any) {
      setFormError(`Erro ao remover: ${err.message || 'Erro de conexão.'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setUrl('');
    setEditPosition(null);
    setGaPropertyId('');
    setDomainExpiration('');
    setHostingFrontend('');
    setHostingBackend('');
    setHostingDatabase('');
  };

  // Auth checking UI
  if (authChecking) {
    return (
      <div className="w-screen h-screen bg-[#050505] flex items-center justify-center font-sans text-white">
        <div className="flex flex-col items-center gap-4">
          <Server size={32} className="text-[#a855f7] animate-spin" />
          <span className="text-xs uppercase font-mono tracking-widest text-neutral-400">
            Acessando Malha Segura...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden relative">
      
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[rgba(168, 85, 247,0.03)] blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-[rgba(168, 85, 247,0.02)] blur-[130px] rounded-full pointer-events-none" />

      {/* Header bar */}
      <header className="h-20 border-b border-white/5 px-8 flex justify-between items-center bg-white/[0.01] backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#a855f7]/30 text-neutral-400 hover:text-[#a855f7] transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              PAINEL ADMINISTRATIVO 
              <span className="text-[9px] font-mono bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 px-2 py-0.5 rounded">
                MALHA
              </span>
            </h1>
            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
              AUTENTICADO COMO: <span className="text-neutral-300 font-semibold">{userEmail}</span>
              {isDemoMode && <span className="text-amber-500 ml-1.5 font-bold uppercase">(MODO DEMO)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-[#a855f7] font-bold uppercase tracking-wider px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#a855f7]/20 hover:bg-[#a855f7]/5 transition-all cursor-pointer"
          >
            <BarChart3 size={14} />
            Histórico
          </Link>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-[#ff3366] font-bold uppercase tracking-wider px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#ff3366]/20 hover:bg-[#ff3366]/5 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            Desconectar
          </button>
        </div>
      </header>

      {/* Main panel layout */}
      <main className="flex-1 flex overflow-hidden p-8 gap-8 z-10">
        
        {/* Left Side: Form config */}
        <section className="w-[380px] flex flex-col shrink-0">
          <div className="glass-panel p-6 rounded-[32px] border border-white/5 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Settings className={activeTab === 'site' ? "text-[#a855f7]" : "text-[#00d2ff]"} size={16} />
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-300">
                {editId !== null 
                  ? (activeTab === 'site' ? "Editar Site" : "Editar Servidor") 
                  : (activeTab === 'site' ? "Adicionar Novo Site" : "Adicionar Novo Servidor")}
              </h2>
            </div>

            {/* Tab Selector inside Admin Form */}
            <div className="flex gap-2 mb-6 bg-white/[0.02] border border-white/5 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (editId === null) setActiveTab('site');
                }}
                disabled={editId !== null}
                className={`flex-1 py-2 text-center rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-40 ${
                  activeTab === 'site'
                    ? 'bg-gradient-to-r from-[#a855f7]/10 to-[#9333ea]/10 text-[#a855f7] border border-[#a855f7]/20'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                Sites
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editId === null) setActiveTab('server');
                }}
                disabled={editId !== null}
                className={`flex-1 py-2 text-center rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-40 ${
                  activeTab === 'server'
                    ? 'bg-gradient-to-r from-[#00d2ff]/10 to-[#0078ff]/10 text-[#00d2ff] border border-[#00d2ff]/20'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                Servidores
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-400 text-xs leading-normal">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-xs leading-normal">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
              
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  {activeTab === 'site' ? "Nome do Site" : "Nome do Servidor"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeTab === 'site' ? "Ex: E-commerce Principal" : "Ex: Servidor de Produção"}
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                  required
                />
              </div>

              {/* URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  {activeTab === 'site' ? "URL do Site" : "URL do Servidor"}
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://meusite.com"
                    className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl py-3 pl-10 pr-4 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                    required
                  />
                </div>
              </div>

             

              {/* GA4 Property ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  ID de Propriedade do GA4 (Opcional)
                </label>
                <input
                  type="text"
                  value={gaPropertyId}
                  onChange={(e) => setGaPropertyId(e.target.value)}
                  placeholder="Ex: 412345678"
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                />
                <span className="text-[8px] text-neutral-500 font-mono pl-1 leading-normal flex items-start gap-1">
                  <Info size={10} className="shrink-0 mt-0.5 text-neutral-500" />
                  Se deixado em branco, a telemetria de visitantes do Google Analytics será ocultada na Malha 3D.
                </span>
              </div>

              {/* Domain Expiration Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  Expiração do Domínio (Opcional)
                </label>
                <input
                  type="date"
                  value={domainExpiration}
                  onChange={(e) => setDomainExpiration(e.target.value)}
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none transition-all duration-300"
                  style={{ colorScheme: 'dark' }}
                />
                <span className="text-[8px] text-neutral-500 font-mono pl-1 leading-normal flex items-start gap-1">
                  <Info size={10} className="shrink-0 mt-0.5 text-neutral-500" />
                  Selecione a data de vencimento do domínio do site para alertas.
                </span>
              </div>

              {/* Hosting Details */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  Hospedagem Frontend (Opcional)
                </label>
                <input
                  type="text"
                  value={hostingFrontend}
                  onChange={(e) => setHostingFrontend(e.target.value)}
                  placeholder="Ex: Vercel, Netlify, Cloudflare"
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  Hospedagem Backend (Opcional)
                </label>
                <input
                  type="text"
                  value={hostingBackend}
                  onChange={(e) => setHostingBackend(e.target.value)}
                  placeholder="Ex: AWS, Render, Heroku"
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                  Hospedagem Banco de Dados (Opcional)
                </label>
                <input
                  type="text"
                  value={hostingDatabase}
                  onChange={(e) => setHostingDatabase(e.target.value)}
                  placeholder="Ex: Supabase, MongoDB Atlas"
                  className="bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/5 focus:border-[#a855f7]/30 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none transition-all duration-300"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col gap-2 mt-auto pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full font-extrabold text-xs tracking-widest uppercase py-3.5 rounded-2xl border transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    activeTab === 'server'
                      ? 'bg-gradient-to-r from-[#00d2ff] to-[#0078ff] text-white border-[#00d2ff]/20 hover:border-[#00d2ff]/40 shadow-[#00d2ff]/5'
                      : 'bg-gradient-to-r from-[#a855f7] to-[#9333ea] text-black border-[#a855f7]/20 hover:border-[#a855f7]/40 shadow-[#a855f7]/5'
                  }`}
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      {editId !== null ? "Salvar Alterações" : "Adicionar Nó"}
                    </>
                  )}
                </button>

                {editId !== null && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs tracking-wider uppercase py-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <X size={14} />
                    Cancelar Edição
                  </button>
                )}
              </div>

            </form>
          </div>
        </section>

        {/* Right Side: Site List */}
        <section className="flex-1 flex flex-col h-full min-w-0">
          <div className="glass-panel p-6 rounded-[32px] border border-white/5 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Server className={activeTab === 'site' ? "text-[#a855f7]" : "text-[#00d2ff]"} size={16} />
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-300">
                  {activeTab === 'site' ? "Sites Registrados" : "Servidores Registrados"} ({sites.filter(s => (s.type || 'site') === activeTab).length})
                </h2>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#a855f7]/30 hover:text-[#a855f7] transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  showSettings 
                    ? 'border-[#a855f7]/40 text-[#a855f7] bg-[#a855f7]/5 shadow-[#a855f7]/5 shadow-md' 
                    : 'text-neutral-400 hover:bg-white/[0.02]'
                }`}
                title="Configurações Globais do Monitoramento"
              >
                <Settings size={12} className={showSettings ? "animate-spin" : ""} />
                Painel Geral
              </button>
            </div>

            {showSettings && (
              <form onSubmit={handleSaveSettings} className="glass-panel border-white/5 bg-white/[0.01] p-5 rounded-2xl mb-6 flex flex-col gap-4 relative shrink-0">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="text-[#a855f7]" size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Configurações do Monitor</span>
                  </div>
                  {settingsLoading && (
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest animate-pulse">Carregando...</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sync Interval */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                      Sincronização Telemetria
                    </label>
                    <select
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      className="bg-[#050505] hover:bg-white/[0.02] border border-white/5 focus:border-[#a855f7]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all duration-300"
                    >
                      <option value={5000} className="bg-[#050505] text-white">5 segundos (Rápido)</option>
                      <option value={12000} className="bg-[#050505] text-white">12 segundos (Padrão)</option>
                      <option value={30000} className="bg-[#050505] text-white">30 segundos</option>
                      <option value={60000} className="bg-[#050505] text-white">1 minuto</option>
                      <option value={120000} className="bg-[#050505] text-white">2 minutos</option>
                    </select>
                  </div>

                  {/* Ping Timeout */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                      Timeout de Requisição (Ping)
                    </label>
                    <select
                      value={pingTimeout}
                      onChange={(e) => setPingTimeout(Number(e.target.value))}
                      className="bg-[#050505] hover:bg-white/[0.02] border border-white/5 focus:border-[#a855f7]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all duration-300"
                    >
                      <option value={2000} className="bg-[#050505] text-white">2 segundos</option>
                      <option value={4000} className="bg-[#050505] text-white">4 segundos (Padrão)</option>
                      <option value={6000} className="bg-[#050505] text-white">6 segundos</option>
                      <option value={10000} className="bg-[#050505] text-white">10 segundos</option>
                    </select>
                  </div>

                  {/* Alarm 1 (Warning) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                      Tempo de Tolerância Alerta 1 (Aviso)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={alarm1Threshold}
                        onChange={(e) => setAlarm1Threshold(Number(e.target.value))}
                        className="w-full bg-[#050505] hover:bg-white/[0.02] focus:bg-white/[0.03] border border-white/5 focus:border-[#a855f7]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all duration-300 pr-10"
                        required
                      />
                      <span className="absolute right-3 text-[9px] font-mono text-neutral-500 uppercase">seg</span>
                    </div>
                  </div>

                  {/* Alarm 2 (Critical) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                      Tempo de Tolerância Alerta 2 (Crítico)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={30}
                        max={3600}
                        value={alarm2Threshold}
                        onChange={(e) => setAlarm2Threshold(Number(e.target.value))}
                        className="w-full bg-[#050505] hover:bg-white/[0.02] focus:bg-white/[0.03] border border-white/5 focus:border-[#a855f7]/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all duration-300 pr-10"
                        required
                      />
                      <span className="absolute right-3 text-[9px] font-mono text-neutral-500 uppercase">seg</span>
                    </div>
                  </div>

                  {/* WHOIS toggle */}
                  <div className="flex items-center gap-3 md:col-span-2 mt-2 bg-[#050505]/40 border border-white/5 p-3 rounded-xl">
                    <input
                      type="checkbox"
                      id="whoisSyncEnabled"
                      checked={whoisSyncEnabled}
                      onChange={(e) => setWhoisSyncEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#a855f7] rounded border-white/10 bg-white/[0.02] cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="whoisSyncEnabled" className="text-[10px] font-bold text-neutral-300 uppercase tracking-wide cursor-pointer">
                        Sincronização WHOIS (Expiração do Domínio)
                      </label>
                      <span className="text-[8px] text-neutral-500 font-mono leading-tight mt-0.5">
                        Verifica automaticamente a data de expiração dos domínios em servidores RDAP globais durante a noite.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-white/5 pt-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-neutral-300 font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#9333ea] border border-[#a855f7]/20 text-black font-extrabold text-[9px] uppercase tracking-wider hover:border-[#a855f7]/40 shadow-[#a855f7]/5 shadow active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : "Salvar Configurações"}
                  </button>
                </div>
              </form>
            )}

            {loading && sites.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-2">
                <Server size={24} className="animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest">Carregando lista...</span>
              </div>
            ) : sites.filter(s => (s.type || 'site') === activeTab).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-2 border border-dashed border-white/5 rounded-2xl">
                <Info size={24} className="text-neutral-600" />
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Nenhum {activeTab === 'site' ? 'site' : 'servidor'} cadastrado
                </span>
                <span className="text-[10px] text-neutral-600 text-center max-w-[250px] leading-normal font-sans">
                  Use o formulário à esquerda para adicionar o primeiro {activeTab === 'site' ? 'site' : 'servidor'} ao monitoramento.
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-neutral-500 font-mono text-[9px] uppercase tracking-widest pb-3">
                      <th className="py-3 px-2">ID</th>
                      <th className="py-3 px-3">Nome / URL</th>
                      <th className="py-3 px-3">Coordenadas 3D</th>
                      <th className="py-3 px-3">Propriedade GA4</th>
                      <th className="py-3 px-3">Expiração Domínio</th>
                      <th className="py-3 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.filter(s => (s.type || 'site') === activeTab).map((site) => (
                      <tr 
                        key={site.id} 
                        className={`border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors ${
                          editId === site.id 
                            ? activeTab === 'server'
                              ? 'bg-[#00d2ff]/[0.02] border-b-[#00d2ff]/25'
                              : 'bg-[#a855f7]/[0.02] border-b-[#a855f7]/25'
                            : ''
                        }`}
                      >
                        <td className="py-4 px-2 font-mono font-bold text-neutral-400">
                          {String(site.id).padStart(2, '0')}
                        </td>
                        <td className="py-4 px-3 max-w-[200px]">
                          <div className="font-bold text-neutral-200 truncate">{site.name}</div>
                          <div className={`text-[10px] text-neutral-500 truncate mt-0.5 transition-colors ${
                            activeTab === 'server' ? 'hover:text-[#00d2ff]' : 'hover:text-[#a855f7]'
                          }`}>
                            <a href={site.url} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                              <Globe size={10} className="shrink-0" />
                              {site.url}
                            </a>
                          </div>
                        </td>
                        <td className="py-4 px-3 font-mono text-[10px] text-neutral-400">
                          <span className={activeTab === 'server' ? "text-[#00d2ff]/70" : "text-[#a855f7]/70"}>X:</span> {site.position[0]?.toFixed(1) ?? '0.0'}, 
                          <span className={activeTab === 'server' ? "text-[#00d2ff]/70" : "text-[#a855f7]/70"}> Y:</span> {site.position[1]?.toFixed(1) ?? '0.0'}, 
                          <span className={activeTab === 'server' ? "text-[#00d2ff]/70" : "text-[#a855f7]/70"}> Z:</span> {site.position[2]?.toFixed(1) ?? '0.0'}
                        </td>
                        <td className="py-4 px-3 font-mono text-[10px]">
                          {site.gaPropertyId && site.gaPropertyId.trim() !== '' && !site.gaPropertyId.startsWith('YOUR_GA4') ? (
                            <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              {site.gaPropertyId}
                            </span>
                          ) : (
                            <span className="text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded border border-white/5 uppercase text-[9px] tracking-wide">
                              Sem Analytics
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 font-mono text-[10px]">
                          {site.domainExpiration ? (
                            (() => {
                              const days = getDaysUntil(site.domainExpiration);
                              if (days <= 0) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[#ff3366] bg-[#ff3366]/10 px-2 py-0.5 rounded border border-[#ff3366]/20 font-bold uppercase text-[9px] w-max">
                                      Expirado
                                    </span>
                                    <span className="text-[9px] text-neutral-500">{site.domainExpiration}</span>
                                  </div>
                                );
                              } else if (days <= 7) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase text-[9px] w-max">
                                      {days} d (Urgente)
                                    </span>
                                    <span className="text-[9px] text-neutral-500">{site.domainExpiration}</span>
                                  </div>
                                );
                              } else if (days <= 30) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase text-[9px] w-max">
                                      {days} d (Atenção)
                                    </span>
                                    <span className="text-[9px] text-neutral-500">{site.domainExpiration}</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 rounded border border-[#a855f7]/20 font-bold text-[9px] w-max">
                                      {days} d
                                    </span>
                                    <span className="text-[9px] text-neutral-500">{site.domainExpiration}</span>
                                  </div>
                                );
                              }
                            })()
                          ) : (
                            <span className="text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded border border-white/5 uppercase text-[9px] tracking-wide">
                              Não monitorado
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleStartEdit(site)}
                              disabled={loading}
                              className={`p-2 rounded-xl bg-white/5 border border-white/5 transition-all cursor-pointer text-neutral-400 ${
                                activeTab === 'server' ? 'hover:border-[#00d2ff]/30 hover:text-[#00d2ff]' : 'hover:border-[#a855f7]/30 hover:text-[#a855f7]'
                              }`}
                              title="Editar Nó"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(site.id)}
                              disabled={loading}
                              className="p-2 rounded-xl bg-white/5 border border-white/5 hover:border-[#ff3366]/30 text-neutral-400 hover:text-[#ff3366] transition-all cursor-pointer"
                              title="Excluir Nó"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
