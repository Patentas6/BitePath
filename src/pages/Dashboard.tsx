import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList";
import type { User } from "@supabase/supabase-js";
import { startOfWeek, addDays } from "date-fns";
import { UserCircle, BookOpenText, Sparkles } from "lucide-react";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log("Dashboard: No user ID, skipping profile fetch.");
        return null;
      }
      console.log(`Dashboard: Attempting to fetch profile for user ID: ${user.id}`);
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      
      console.log('Dashboard: Profile data fetched from Supabase:', data);
      if (error) {
        console.error('Dashboard: Error fetching profile data:', error);
        if (error.code !== 'PGRST116') { 
          throw error; 
        }
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error);
    }
  };

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prevWeekStart => addDays(prevWeekStart, direction === "next" ? 7 : -7));
  };

  const getWelcomeMessage = () => {
    if (!user) return "Loading..."; 

    if (isUserProfileLoading && !userProfile) {
      return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
    }
    if (userProfile?.first_name) {
      return `Welcome, ${userProfile.first_name}!`;
    }
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user) { 
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-teal-600 transition-colors">
            BitePath
          </Link>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 hidden md:inline">{getWelcomeMessage()}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/discover-meals">
                <Sparkles className="mr-2 h-4 w-4" /> Discover
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/meals">
                <BookOpenText className="mr-2 h-4 w-4" /> My Meals
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </Link>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>
        
        <WeeklyPlanner 
          userId={user.id} 
          currentWeekStart={currentWeekStart}
          onWeekNavigate={handleWeekNavigate} 
        />

        <GroceryList 
          userId={user.id} 
          currentWeekStart={currentWeekStart} 
        />
        
      </div>
    </div>
  );
};

export default Dashboard;