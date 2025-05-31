import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import Index from '@/pages/Index'; 
import { Session } from '@supabase/supabase-js';
import { Progress } from "@/components/ui/progress"; 

const RootHandler = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [environmentChecked, setEnvironmentChecked] = useState(false);
  const [isAppEnvironment, setIsAppEnvironment] = useState(false);

  useEffect(() => {
    const pwa = window.matchMedia('(display-mode: standalone)').matches;
    const native = Capacitor.isNativePlatform();
    const appEnv = pwa || native;
    setIsAppEnvironment(appEnv);
    setEnvironmentChecked(true);
    console.log(`[RootHandler] Environment Check: PWA=${pwa}, Native=${native}, IsAppEnv=${appEnv}`);
  }, []);

  useEffect(() => {
    console.log('[RootHandler] Initializing auth state listener and fetching session.');
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('[RootHandler] Initial session fetched:', initialSession ? initialSession.user.id : 'null');
      setSession(initialSession);
      setAuthLoading(false); 
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange( 
      (_event, currentSession) => {
        console.log('[RootHandler] Auth state changed:', _event, 'New session:', currentSession ? currentSession.user.id : 'null');
        setSession(currentSession);
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN' || _event === 'SIGNED_OUT' || _event === 'TOKEN_REFRESHED') {
            setAuthLoading(false);
        }
      }
    );

    return () => {
      console.log('[RootHandler] Unsubscribing auth listener.');
      authSubscription.subscription?.unsubscribe(); 
    };
  }, []);

  useEffect(() => {
    if (!environmentChecked || authLoading) {
      console.log(`[RootHandler] Redirection check: Waiting. EnvChecked=${environmentChecked}, AuthLoading=${authLoading}`);
      return; 
    }

    console.log(`[RootHandler] Redirection check: Ready. IsAppEnv=${isAppEnvironment}, Session=${!!session}, CurrentPath=${location.pathname}`);
    
    if (isAppEnvironment && location.pathname === '/') { 
      if (session) {
        console.log('[RootHandler] Redirecting from / to /dashboard (PWA/Native, Authenticated)');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('[RootHandler] Redirecting from / to /auth (PWA/Native, Not Authenticated)');
        navigate('/auth', { replace: true });
      }
    } else if (isAppEnvironment) {
      console.log(`[RootHandler] In App Environment but not on '/'. Path: ${location.pathname}. No redirection by RootHandler.`);
    } else {
      console.log(`[RootHandler] Not in App Environment. Path: ${location.pathname}. No redirection by RootHandler.`);
    }
  }, [environmentChecked, authLoading, isAppEnvironment, session, navigate, location.pathname]); 

  if (!environmentChecked || (isAppEnvironment && authLoading && location.pathname === '/')) { 
    console.log('[RootHandler] Rendering: Loader (Initial checks pending or AppEnv + AuthLoading on root)');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <BitePathStyledText />
        <Progress value={authLoading ? 30 : 60} className="w-1/2 md:w-1/4 mt-4" />
        <p className="mt-2 text-sm text-muted-foreground">Loading your experience...</p>
      </div>
    );
  }

  if (isAppEnvironment && location.pathname !== '/') {
     console.log(`[RootHandler] Rendering: Letting child route handle rendering for ${location.pathname} in AppEnv.`);
  }

  console.log(`[RootHandler] Rendering: Defaulting to router (e.g., Index for '/' or specific page for other paths). IsAppEnv=${isAppEnvironment}, Path=${location.pathname}`);
  if (location.pathname === '/') return <Index />; 

  return <Index />; 
};

const BitePathStyledText = () => (
  <div className="text-3xl font-bold">
    <span className="text-accent dark:text-foreground">Bite</span>
    <span className="text-primary dark:text-primary">Path</span>
  </div>
);

export default RootHandler;