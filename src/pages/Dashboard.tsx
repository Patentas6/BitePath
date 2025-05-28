import AppHeader from "@/components/AppHeader";
import TodaysMeals from "@/components/TodaysMeals";
import TodaysGroceryList from "@/components/TodaysGroceryList";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import AppTour from "@/components/AppTour";
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile
import { cn } from "@/lib/utils"; // Import cn for conditional classes

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isClient, setIsClient] = useState(false);
  const [justLoggedInForTour, setJustLoggedInForTour] = useState(false);
  const isMobile = useIsMobile(); // Initialize useIsMobile

  useEffect(() => {
    setIsClient(true);
    console.log('[Dashboard] useEffect for location state, location object:', JSON.stringify(location, null, 2));
    
    if (location.state?.justLoggedInForTour) {
      console.log('[Dashboard] Found justLoggedInForTour in location.state: true');
      setJustLoggedInForTour(true);
      navigate(location.pathname, { replace: true, state: {} });
      console.log('[Dashboard] Cleared justLoggedInForTour from location state.');
    } else {
      console.log('[Dashboard] No justLoggedInForTour flag in location.state. Current location.state:', JSON.stringify(location.state, null, 2));
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Dashboard] User session from getSession:', JSON.stringify(session, null, 2));
      if (session?.user) {
        setUser(session.user);
      } else {
        console.log('[Dashboard] No user session from getSession, navigating to /auth');
        navigate("/auth");
      }
    };
    getSession();
  }, [navigate, location]);

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
        throw error;
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
    profileTourStatus: profileTourStatus ? { has_completed_tour: profileTourStatus.has_completed_tour } : undefined,
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
    console.log('[Dashboard] Render: Loading user session (initial check)...');
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }
  
  if (user && isLoadingTourStatus && isClient) {
     console.log('[Dashboard] Render: Loading dashboard (profile tour status)...');
     return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  console.log(`[Dashboard] Rendering AppTour with startTour = ${shouldStartTour}`);

  return (
    <div className={cn(
      "min-h-screen bg-background text-foreground",
      isMobile ? "pt-4 pb-20 px-2" : "p-4" // Adjusted mobile top padding
    )}>
      {isClient && user && <AppTour startTour={shouldStartTour} userId={user.id} />}
      <AppHeader /> 
      <div className={cn(
        "space-y-6",
        !isMobile && "container mx-auto" 
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {user && <TodaysMeals userId={user.id} />}
          {user && <TodaysGroceryList userId={user.id} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;