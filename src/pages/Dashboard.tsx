import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList";
import type { User } from "@supabase/supabase-js";
import { startOfWeek, addDays } from "date-fns";
import { UserCircle, BookOpenText } from "lucide-react";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const fetchUserAndProfile = async (currentUser: User) => {
      setIsProfileLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', currentUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116: row not found
          console.error("Dashboard: Error fetching profile:", profileError);
          setProfile(null);
        } else {
          setProfile(profileData as UserProfile | null);
        }
      } catch (e) {
        console.error("Dashboard: Exception fetching profile:", e);
        setProfile(null);
      } finally {
        setIsProfileLoading(false);
      }
    };

    const checkUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        setUser(null);
        setProfile(null);
        setIsProfileLoading(false);
      } else {
        setUser(session.user);
        await fetchUserAndProfile(session.user);
      }
    };

    checkUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        navigate("/auth");
        setUser(null);
        setProfile(null);
        setIsProfileLoading(false);
      } else {
        setUser(session.user);
        // If user changes (e.g. re-login as different user), fetch their profile
        if (user?.id !== session.user.id) {
            await fetchUserAndProfile(session.user);
        } else {
            // User is the same, profile might already be loaded or loading
            // If profile is not loaded yet, fetch it (e.g. initial load after redirect)
            if (!profile && !isProfileLoading) {
                 await fetchUserAndProfile(session.user);
            }
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate, user?.id]); // Add user.id to re-run if user identity changes

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error);
    }
    // Auth listener will handle navigation
  };

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prevWeekStart => addDays(prevWeekStart, direction === "next" ? 7 : -7));
  };

  const getWelcomeMessage = () => {
    if (!user) return "Loading..."; // Should be caught by the main loading check

    if (isProfileLoading && !profile) {
      return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}! (Loading name...)`;
    }
    if (profile?.first_name && profile?.last_name) {
      return `Welcome, ${profile.first_name} ${profile.last_name}!`;
    }
    if (profile?.first_name) {
      return `Welcome, ${profile.first_name}!`;
    }
    // Fallback if profile is loaded but names are null/empty
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user) { // Main loading check for user session
    return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
          <div className="flex items-center space-x-2">
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
            <Button onClick={handleLogout} variant="outline" size="sm">Logout</Button>
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