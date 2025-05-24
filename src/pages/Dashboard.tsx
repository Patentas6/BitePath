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
import { ThemeToggleButton } from "@/components/ThemeToggleButton"; // Import

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  console.log("[Dashboard.tsx] Component rendering or re-rendering.");

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    console.log("[Dashboard.tsx] useEffect for session and auth listener running.");
    const getSession = async () => {
      console.log("[Dashboard.tsx] getSession called.");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[Dashboard.tsx] Error getting session:", sessionError);
      }
      if (session?.user) {
        console.log("[Dashboard.tsx] User session found:", session.user.id);
        setUser(session.user);
      } else {
        console.log("[Dashboard.tsx] No user session, navigating to /auth.");
        navigate("/auth");
      }
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[Dashboard.tsx] onAuthStateChange triggered. Event:", _event);
      setUser(session?.user ?? null);
      if (!session?.user) {
        console.log("[Dashboard.tsx] No user from onAuthStateChange, navigating to /auth.");
        navigate("/auth");
      }
    });

    return () => {
      console.log("[Dashboard.tsx] Cleaning up auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const { data: userProfile, isLoading: isUserProfileLoading, error: userProfileError } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log("[Dashboard.tsx] No user ID, skipping profile fetch.");
        return null;
      }
      console.log(`[Dashboard.tsx] Attempting to fetch profile for user ID: ${user.id}`);
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      
      console.log('[Dashboard.tsx] Profile data fetched from Supabase:', data);
      if (error) {
        console.error('[Dashboard.tsx] Error fetching profile data:', error);
        if (error.code !== 'PGRST116') { 
          throw error;
        }
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    console.log("[Dashboard.tsx] handleLogout called.");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Dashboard.tsx] Logout error:", error);
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
    if (userProfile) {
      const firstName = userProfile.first_name;
      const lastName = userProfile.last_name;
      if (firstName && lastName) return `Welcome, ${firstName} ${lastName}!`;
      if (firstName) return `Welcome, ${firstName}!`;
      if (lastName) return `Welcome, ${lastName}!`;
    }
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user && !isUserProfileLoading) {
    console.log("[Dashboard.tsx] No user and not loading profile, rendering loading/redirect state.");
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }

  if (userProfileError) {
    console.error("[Dashboard.tsx] Error rendering due to userProfileError:", userProfileError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        {/* Card content omitted for brevity but would be here */}
      </div>
    );
  }
  
  console.log("[Dashboard.tsx] Proceeding to render main content. User ID:", user?.id);

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-3"> {/* Group logo and theme button */}
            <Link to="/dashboard" className="text-2xl font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              BitePath
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-base hidden md:inline">{getWelcomeMessage()}</span>
            <Button variant="default" size="sm" asChild>
              <Link to="/discover-meals">
                <Sparkles className="mr-2 h-4 w-4" /> Discover Meals
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/meals">
                <BookOpenText className="mr-2 h-4 w-4" /> My Meals
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/profile">
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </Link>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>
        
        {user && <WeeklyPlanner 
          userId={user.id} 
          currentWeekStart={currentWeekStart}
          onWeekNavigate={handleWeekNavigate} 
        />}

        {user && <GroceryList 
          userId={user.id} 
          currentWeekStart={currentWeekStart} 
        />}
        
      </div>
    </div>
  );
};

export default Dashboard;