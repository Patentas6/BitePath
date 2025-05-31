import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import Index from '@/pages/Index'; // Adjusted path
import { Session } from '@supabase/supabase-js';
import { Progress } from "@/components/ui/progress"; // Using shadcn Progress component

const RootHandler = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [environmentChecked, setEnvironmentChecked] = useState(false);
  const [isAppEnvironment, setIsAppEnvironment] = useState(false);

  // Check environment once on component mount
  useEffect(() => {
    const pwa = window.matchMedia('(display-mode: standalone)').matches;
    const native = Capacitor.isNativePlatform();
    setIsAppEnvironment(pwa || native);
    setEnvironmentChecked(true);
    console.log(`Environment Check: PWA=${pwa}, Native=${native}, IsAppEnv=${pwa || native}`);
  }, []);

  // Handle Supabase session loading and updates
  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false); // Initial auth check done
      console.log('Initial session fetched:', session);
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('Auth state changed:', _event, session);
        setSession(session);
        // Ensure loading is false if we get an event, especially INITIAL_SESSION
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
            setAuthLoading(false);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  // Perform redirection based on environment and auth state
  useEffect(() => {
    if (!environmentChecked || authLoading) {
      console.log(`Redirection check: Waiting. EnvChecked=${environmentChecked}, AuthLoading=${authLoading}`);
      return; // Wait for both environment and auth checks to complete
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
    // If not isAppEnvironment, it will fall through to render Index page
  }, [environmentChecked, authLoading, isAppEnvironment, session, navigate]);

  // Conditional rendering logic
  if (!environmentChecked || (isAppEnvironment && authLoading)) {
    // Show a loader if:
    // 1. Environment hasn't been checked yet.
    // 2. It's an app environment (PWA/Native) AND we're still waiting for auth status.
    // This prevents flashing the landing page in PWA/APK.
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
    // If it's an app environment and we've passed the loading states,
    // but redirection useEffect might still be pending or just fired,
    // continue showing a loader or null to ensure Index page doesn't flash.
    console.log('Rendering: Loader (AppEnv, redirection should be in progress)');
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <BitePathStyledText />
        <Progress value={90} className="w-1/2 md:w-1/4 mt-4" />
        <p className="mt-2 text-sm text-muted-foreground">Almost there...</p>
      </div>
    );
  }

  // If it's a browser environment (not PWA/APK), render the landing page.
  console.log('Rendering: Index page (Browser)');
  return <Index />;
};

// Helper component for styled text, can be co-located or imported
const BitePathStyledText = () => (
  <div className="text-3xl font-bold">
    <span className="text-accent dark:text-foreground">Bite</span>
    <span className="text-primary dark:text-primary">Path</span>
  </div>
);

export default RootHandler;