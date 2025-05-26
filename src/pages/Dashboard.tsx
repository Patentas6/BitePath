import AppHeader from "@/components/AppHeader";
import TodaysMeals from "@/components/TodaysMeals";
import TodaysGroceryList from "@/components/TodaysGroceryList";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import AppTour from "@/components/AppTour";
import { useQuery } from '@tanstack/react-query';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
      
      if (error && error.code !== 'PGRST116') { // PGRST116 means no row found
        console.error("Error fetching tour status for dashboard:", error);
        return { has_completed_tour: false }; // Assume not completed if error or no profile
      }
      if (!data) return { has_completed_tour: false }; // No profile row, assume not completed
      return data;
    },
    enabled: !!user?.id && isClient, // Only run query if user and client are ready
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const shouldStartTour = useMemo(() => {
    if (isLoadingTourStatus || !profileTourStatus) {
      // If still loading or profileTourStatus is null (e.g. user just signed up and profile might not be there instantly)
      // default to true if it's a new user context (which is hard to determine here without more flags)
      // For now, if profileTourStatus is explicitly fetched and says false, or is null/undefined, start tour.
      return profileTourStatus === null || profileTourStatus?.has_completed_tour === false;
    }
    return !profileTourStatus.has_completed_tour;
  }, [profileTourStatus, isLoadingTourStatus]);


  if (!user && !isLoadingTourStatus) { // Added !isLoadingTourStatus to prevent premature redirect
    // This check might be redundant if AppHeader handles it, but good for safety
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }
  
  // Show loading if user is set but tour status is still loading
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