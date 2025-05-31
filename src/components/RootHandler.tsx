import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import Index from '@/pages/Index'; 
import { Session } from '@supabase/supabase-js';
import { Progress } from "@/components/ui/progress"; 

const RootHandler = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [environmentChecked, setEnvironmentChecked] = useState(false);
  const [isAppEnvironment, setIsAppEnvironment] = useState(false);

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const navigatorStandalone = (window.navigator as any).standalone === true; 
    
    let isPWA = displayModeStandalone;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) { 
        isPWA = navigatorStandalone || displayModeStandalone; 
        isPWA = navigatorStandalone; 
        if (!isPWA && !native) { 
            isPWA = displayModeStandalone;
        }
    }

    setIsAppEnvironment(native || isPWA); 
    setEnvironmentChecked(true);
    console.log(`Environment Check: Native=${native}, PWA=${isPWA}, displayModeStandalone=${displayModeStandalone}, navigatorStandalone=${navigatorStandalone}, IsAppEnv=${native || isPWA}`);
    console.log(`User Agent: ${navigator.userAgent}`);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false); 
      console.log('Initial session fetched:', session);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('Auth state changed:', _event, session);
        setSession(session);
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
            setAuthLoading(false);
        }
      }
    );

    return () => {
      data.subscription?.unsubscribe(); 
    };
  }, []);

  useEffect(() => {
    if (!environmentChecked || authLoading) {
      console.log(`Redirection check: Waiting. EnvChecked=${environmentChecked}, AuthLoading=${authLoading}`);
      return; 
    }

    console.log(`Redirection check: Ready. IsAppEnv=${isAppEnvironment}, Session=${!!session}`);
    if (isAppEnvironment) {
      if (session) {
        console.log('Redirecting to /dashboard (PWA/Native, Authenticated)');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('Redirecting to /auth (PWA/Native, Not Authenticated)');
        navigate('/auth', { replace: true });
      }
    }
  }, [environmentChecked, authLoading, isAppEnvironment, session, navigate]);

  if (!environmentChecked || (isAppEnvironment && authLoading)) {
    console.log('Rendering: Loader (Initial checks pending or AppEnv + AuthLoading)');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <BitePathStyledText />
        <Progress value={authLoading ? 30 : 60} className="w-1/2 md:w-1/4 mt-4" />
        <p className="mt-2 text-sm text-muted-foreground">Loading your experience...</p>
      </div>
    );
  }

  if (isAppEnvironment) {
    console.log('Rendering: Loader (AppEnv, redirection should be in progress)');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <BitePathStyledText />
        <Progress value={90} className="w-1/2 md:w-1/4 mt-4" />
        <p className="mt-2 text-sm text-muted-foreground">Almost there...</p>
      </div>
    );
  }

  console.log('Rendering: Index page (Browser) or waiting for redirect (App)');
  return <Index />;
};

const BitePathStyledText = () => (
  <div className="text-3xl font-bold">
    <span className="text-accent dark:text-foreground">Bite</span>
    <span className="text-primary dark:text-primary">Path</span>
  </div>
);

export default RootHandler;