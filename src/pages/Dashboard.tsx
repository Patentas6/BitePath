import AppHeader from "@/components/AppHeader"; // Import AppHeader
import TodaysMeals from "@/components/TodaysMeals";
import TodaysGroceryList from "@/components/TodaysGroceryList";
import { supabase } from "@/lib/supabase"; // Keep for user check if needed directly on page
import { useEffect, useState } from "react"; // Keep for user check
import type { User } from "@supabase/supabase-js"; // Keep for user type
import { useNavigate } from "react-router-dom"; // Keep for navigation
import AppTour from "@/components/AppTour"; // Import the AppTour component

const Dashboard = () => {
  // Minimal user check, AppHeader handles detailed user/profile for header itself
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false); // To ensure localStorage is accessed only on client

  useEffect(() => {
    setIsClient(true); // Set to true once component mounts on client
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


  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {isClient && <AppTour />} {/* Conditionally render AppTour only on client */}
      <div className="container mx-auto space-y-6">
        <AppHeader /> {/* Use AppHeader */}
        {/* Page specific title can go here if needed, e.g., <h1 className="text-3xl font-bold">Dashboard</h1> */}
        {/* For now, dashboard doesn't have an explicit title below header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {user && <TodaysMeals userId={user.id} />}
          {user && <TodaysGroceryList userId={user.id} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;