"use client";

import React, { useState, useEffect } from 'react';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import BrainContainer from '@/components/BrainContainer';
import WelcomeHome from '@/components/WelcomeHome';
import { Server } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = () => {
      // 1. Check if we are in demo mode via sessionStorage
      if (typeof window !== 'undefined') {
        const isDemoLoggedIn = window.sessionStorage.getItem('demo_admin_logged_in') === 'true';
        if (isDemoLoggedIn) {
          setUser({ email: window.sessionStorage.getItem('demo_admin_email') || 'demo@sentry3d.com', isDemo: true });
          setLoading(false);
          return;
        }
      }

      // 2. Check Firebase authentication state
      if (isFirebaseConfigured && auth) {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          setUser(firebaseUser);
          setLoading(false);
        });
        return () => unsubscribe();
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#050505] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <Server size={32} className="text-[#a855f7] animate-pulse" />
          <span className="text-xs uppercase font-mono tracking-widest text-neutral-400">Carregando painel...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <main className="w-screen h-screen overflow-hidden bg-[#090d16]">
        <BrainContainer />
      </main>
    );
  }

  return <WelcomeHome />;
}