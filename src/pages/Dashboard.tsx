import AppHeader from "@/components/AppHeader";
import TodaysMeals from "@/components/TodaysMeals";
import TodaysGroceryList from "@/components/TodaysGroceryList";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import AppTour from "@/components/AppTour";
import { useQuery } from '@tanstack/react-query';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);
  const [justLoggedInForTour, setJustLoggedInForTour] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const flag = sessionStorage.getItem('justLoggedInForTour');
    console.log('[Dashboard] Reading sessionStorage justLoggedInForTour:', flag);
    if (flag === 'true') {
      setJustLoggedInForTour(true);
      console.log('[Dashboard] Set justLoggedInForTour state to true');
      sessionStorage.removeItem('justLoggedInForTour');
      console.log('[Dashboard] Removed justLoggedInForTour from sessionStorage');
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Dashboard] User session:', session);
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    };
    getSession();
    // AppHeader's onAuthStateChange will also handle navigation on sign out
  }, [navigate]);

  const { data: profileTourStatus, isLoading: isLoadingTourStatus, error: profileTourError } = useQuery<{ has_completed_tour: boolean } | null>({
    queryKey: ['userProfileForDashboardTour', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[Dashboard] profileTourStatus queryFn: No user ID, returning null.');
        return null;
      }
      console.log('[Dashboard] profileTourStatus queryFn: Fetching for user ID:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('has_completed_tour')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { 
        console.error("[Dashboard] Error fetching tour status for dashboard:", error);
        throw error; // Throw error to be caught by useQuery
      }
      if (!data) {
        console.log('[Dashboard] profileTourStatus queryFn: No profile data found, returning { has_completed_tour: false }');
        return { has_completed_tour: false }; 
      }
      console.log('[Dashboard] profileTourStatus queryFn: Fetched data:', data);
      return data;
    },
    enabled: !!user?.id && isClient, 
    staleTime: 5 * 60 * 1000, 
  });

  console.log('[Dashboard] States before useMemo for shouldStartTour:', {
    justLoggedInForTour,
    profileTourStatus,
    isLoadingTourStatus,
    profileTourError: profileTourError?.message
  });

  const shouldStartTour = useMemo(() => {
    if (isLoadingTourStatus || !profileTourStatus) {
      console.log('[Dashboard] shouldStartTour: isLoading or no profileTourStatus. Returning false.');
      return false; 
    }
    const result = justLoggedInForTour && !profileTourStatus.has_completed_tour;
    console.log('[Dashboard] shouldStartTour calculated:', result, '(Inputs:', { justLoggedInForTour, has_completed_tour: profileTourStatus.has_completed_tour }, ')');
    return result;
  }, [profileTourStatus, isLoadingTourStatus, justLoggedInForTour]);


  if (!user && !isLoadingTourStatus) { 
    console.log('[Dashboard] Render: Loading user session...');
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }
  
  if (user && isLoadingTourStatus && isClient) {
     console.log('[Dashboard] Render: Loading dashboard (profile tour status)...');
     return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  console.log(`[Dashboard] Rendering AppTour with startTour = ${shouldStartTour}`);

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {isClient && user && <AppTour startTour={shouldStartTour} userId={user.id} />}
      <div className="container mx-auto space-y-6">
        <AppHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {user && <TodaysMeals userId={user.id} />}
          {user && <TodaysGroceryList userId={user.id} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;