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
    if (flag === 'true') {
      setJustLoggedInForTour(true);
      sessionStorage.removeItem('justLoggedInForTour'); // Clear flag after reading
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    };
    getSession();
    // AppHeader's onAuthStateChange will also handle navigation on sign out
  }, [navigate]);

  const { data: profileTourStatus, isLoading: isLoadingTourStatus } = useQuery<{ has_completed_tour: boolean } | null>({
    queryKey: ['userProfileForDashboardTour', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('has_completed_tour')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { 
        console.error("Error fetching tour status for dashboard:", error);
        return { has_completed_tour: false }; 
      }
      if (!data) return { has_completed_tour: false }; 
      return data;
    },
    enabled: !!user?.id && isClient, 
    staleTime: 5 * 60 * 1000, 
  });

  const shouldStartTour = useMemo(() => {
    if (isLoadingTourStatus || !profileTourStatus) {
      return false; // Don't start if profile status is not ready
    }
    // Start tour only if it's a fresh login AND the tour hasn't been completed yet
    return justLoggedInForTour && !profileTourStatus.has_completed_tour;
  }, [profileTourStatus, isLoadingTourStatus, justLoggedInForTour]);


  if (!user && !isLoadingTourStatus) { 
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }
  
  if (user && isLoadingTourStatus && isClient) {
     return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {isClient && user && shouldStartTour && <AppTour startTour={true} userId={user.id} />}
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