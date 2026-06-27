"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Activity, ShieldAlert, CheckCircle2, Sparkles, LogIn, Eye, EyeOff, UserPlus } from 'lucide-react';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync tab option from URL search query on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'register') {
        setActiveTab('register');
      } else {
        setActiveTab('login');
      }
    }
  }, []);

  // If already logged in, redirect to main monitoring panel
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Password strength checks (evaluated in real-time)
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  // 1. Google Auth Handler (registers or logs in)
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isFirebaseConfigured || !auth) {
      setError("Firebase não está configurado. Por favor, adicione as credenciais no arquivo .env.local.");
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      await signInWithPopup(auth, provider);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      console.error("Erro no login do Google:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login cancelado: janela popup fechada pelo usuário.");
      } else {
        setError(`Erro ao autenticar: ${err.message || 'Tente novamente.'}`);
      }
      setLoading(false);
    }
  };

  // 2. Email & Password Login Handler
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isFirebaseConfigured || !auth) {
      setError("Firebase não está configurado. Por favor, adicione as credenciais no arquivo .env.local.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      console.error("Erro no login de email:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Email ou senha incorretos. Verifique suas credenciais.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Formato de email inválido.");
      } else {
        setError(`Erro ao autenticar: ${err.message || 'Tente novamente.'}`);
      }
      setLoading(false);
    }
  };

  // 3. Email & Password Registration Handler
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isFirebaseConfigured || !auth) {
      setError("Firebase não está configurado. Por favor, adicione as credenciais no arquivo .env.local.");
      setLoading(false);
      return;
    }

    if (!isPasswordStrong) {
      setError("A senha informada não atende a todos os critérios de senha forte.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      console.error("Erro no cadastro de email:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este endereço de email já está cadastrado.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Formato de email inválido.");
      } else {
        setError(`Erro ao criar conta: ${err.message || 'Tente novamente.'}`);
      }
      setLoading(false);
    }
  };

  // 4. Demo Mode Fallback
  const handleDemoBypass = () => {
    setLoading(true);
    setSuccess(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('demo_admin_logged_in', 'true');
      window.sessionStorage.setItem('demo_admin_email', 'admin-demo@sentry3d.io');
    }
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-[#050505] flex items-center justify-center font-sans py-12 px-4">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] bg-[rgba(168,85,247,0.06)] blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[45vw] h-[45vw] max-w-[600px] bg-[rgba(6,182,212,0.04)] blur-[150px] rounded-full pointer-events-none" />

      {/* Main card container */}
      <div className="w-full max-w-[440px] z-10 relative">
        
        {/* Back Link to Landing */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao Início
        </Link>

        <div className="glass-panel p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Top glowing bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#a855f7] to-[#06b6d4] opacity-80" />

          {/* Form Header */}
          <div className="flex flex-col items-center text-center mb-8">
            
            <div className="flex items-center gap-3">
          <div>
            <img src="/images/sentry_logo.png" alt="Sentry Logo" className="w-50 h-auto object-contain" />
          </div>
        </div>
            <p className="text-[10px] text-neutral-400 font-mono mt-1 tracking-wider uppercase">
              {activeTab === 'login' ? 'Identificação do Usuário' : 'Registro de Empresa'}
            </p>
          </div>

          {/* Sliding Tabs */}
          <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'login' 
                  ? 'bg-[#a855f7] text-white shadow-md' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError(null);
              }}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'register' 
                  ? 'bg-[#a855f7] text-white shadow-md' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {/* Error / Success Notifications */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95 duration-200">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95 duration-200">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{activeTab === 'login' ? 'Acesso concedido. Redirecionando...' : 'Conta criada com sucesso. Acessando painel...'}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading || success}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold text-xs tracking-wider uppercase py-4 px-6 rounded-2xl border border-white/10 hover:border-white/20 shadow-md transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {activeTab === 'login' ? 'Entrar com o Google' : 'Cadastrar com o Google'}
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="h-[1px] bg-white/5 flex-grow" />
            <span className="text-[9px] text-neutral-500 font-mono px-4 uppercase tracking-wider">ou continuar com email</span>
            <div className="h-[1px] bg-white/5 flex-grow" />
          </div>

          {/* Email Form */}
          <form onSubmit={activeTab === 'login' ? handleEmailLogin : handleEmailRegister} className="flex flex-col gap-4">
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">E-mail corporativo / pessoal</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || success}
                placeholder="exemplo@empresa.com"
                className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/50 rounded-2xl py-3.5 px-4 text-xs text-white placeholder-neutral-600 outline-none transition-all"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Senha</label>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || success}
                  placeholder={activeTab === 'login' ? "Digite sua senha" : "Crie uma senha forte"}
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/50 rounded-2xl py-3.5 px-4 pr-12 text-xs text-white placeholder-neutral-600 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Real-time Password Strength indicator (Only for registration) */}
            {activeTab === 'register' && password && (
              <div className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Requisitos de segurança:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[9px] font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-[#a855f7]' : 'bg-neutral-600'}`} />
                    <span className={hasMinLength ? 'text-neutral-300' : 'text-neutral-500'}>Mínimo de 8 caracteres</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-[#a855f7]' : 'bg-neutral-600'}`} />
                    <span className={hasUppercase ? 'text-neutral-300' : 'text-neutral-500'}>Uma letra maiúscula</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasLowercase ? 'bg-[#a855f7]' : 'bg-neutral-600'}`} />
                    <span className={hasLowercase ? 'text-neutral-300' : 'text-neutral-500'}>Uma letra minúscula</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-[#a855f7]' : 'bg-neutral-600'}`} />
                    <span className={hasNumber ? 'text-neutral-300' : 'text-neutral-500'}>Pelo menos um número</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasSpecialChar ? 'bg-[#a855f7]' : 'bg-neutral-600'}`} />
                    <span className={hasSpecialChar ? 'text-neutral-300' : 'text-neutral-500'}>Um caractere especial (@, $, !, %, etc)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Password Field (Only for registration) */}
            {activeTab === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Confirmar Senha</label>
                <div className="relative w-full">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading || success}
                    placeholder="Repita sua senha exatamente"
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/50 rounded-2xl py-3.5 px-4 pr-12 text-xs text-white placeholder-neutral-600 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success || (activeTab === 'register' && !isPasswordStrong)}
              className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white font-extrabold text-xs tracking-widest uppercase py-4 rounded-2xl border border-transparent shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_25px_rgba(168,85,247,0.2)] transition-all duration-300 transform active:scale-[0.98] mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : activeTab === 'login' ? (
                <>
                  <LogIn size={15} />
                  Entrar no Painel
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  Criar Conta
                </>
              )}
            </button>
          </form>

          {/* Offline / Demo fallback option (shows when Firebase config is missing) */}
          {!isFirebaseConfigured && (
            <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3 text-[10px] text-amber-400 font-mono leading-normal">
                ⚠️ <strong>Aviso:</strong> Firebase não configurado no .env.local.
              </div>
              <button
                onClick={handleDemoBypass}
                type="button"
                className="w-full bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#a855f7] font-bold text-[10px] tracking-widest uppercase py-3 rounded-2xl border border-[#a855f7]/20 hover:border-[#a855f7]/40 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={12} />
                Entrar em Modo Demo
              </button>
            </div>
          )}

        </div>

        {/* Info Footer */}
        <p className="text-[9px] text-center text-neutral-500 font-mono mt-6 tracking-widest uppercase">
          Área de Autenticação • Sentry 3D
        </p>

      </div>
    </div>
  );
}
