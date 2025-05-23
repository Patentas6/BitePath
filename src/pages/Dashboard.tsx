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
  console.log("[Dashboard.tsx] Component rendering or re-rendering."); // Added log

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    console.log("[Dashboard.tsx] useEffect for session and auth listener running."); // Added log
    const getSession = async () => {
      console.log("[Dashboard.tsx] getSession called."); // Added log
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[Dashboard.tsx] Error getting session:", sessionError);
        // Potentially navigate or show error, but for now, log it.
      }
      if (session?.user) {
        console.log("[Dashboard.tsx] User session found:", session.user.id); // Added log
        setUser(session.user);
      } else {
        console.log("[Dashboard.tsx] No user session, navigating to /auth."); // Added log
        navigate("/auth");
      }
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[Dashboard.tsx] onAuthStateChange triggered. Event:", _event); // Added log
      setUser(session?.user ?? null);
      if (!session?.user) {
        console.log("[Dashboard.tsx] No user from onAuthStateChange, navigating to /auth."); // Added log
        navigate("/auth");
      }
    });

    return () => {
      console.log("[Dashboard.tsx] Cleaning up auth listener."); // Added log
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const { data: userProfile, isLoading: isUserProfileLoading, error: userProfileError } = useQuery<UserProfile | null>({ // Added error state
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
          throw error; // This will be caught by React Query and set in userProfileError
        }
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    console.log("[Dashboard.tsx] handleLogout called."); // Added log
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Dashboard.tsx] Logout error:", error);
    }
    // setUser(null); // Handled by onAuthStateChange
    // navigate("/auth"); // Handled by onAuthStateChange
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

      if (firstName && lastName) {
        return `Welcome, ${firstName} ${lastName}!`;
      } else if (firstName) {
        return `Welcome, ${firstName}!`;
      } else if (lastName) { 
        return `Welcome, ${lastName}!`;
      }
    }
    
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user && !isUserProfileLoading) { // Adjusted condition slightly
    console.log("[Dashboard.tsx] No user and not loading profile, rendering loading/redirect state."); // Added log
    // This state might be hit briefly before navigate kicks in from useEffect
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }

  if (userProfileError) {
    console.error("[Dashboard.tsx] Error rendering due to userProfileError:", userProfileError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-red-500">Could not load dashboard data: {userProfileError.message}</p>
            <Button onClick={() => navigate("/")} className="mt-4">Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  console.log("[Dashboard.tsx] Proceeding to render main content. User ID:", user?.id); // Added log

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-teal-600 transition-colors">
            BitePath
          </Link>
          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-700 hidden md:inline">{getWelcomeMessage()}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/discover-meals">
                <Sparkles className="mr-2 h-4 w-4" /> Discover Meals
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