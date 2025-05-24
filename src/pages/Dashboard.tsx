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
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

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
    return () => authListener?.subscription.unsubscribe();
  }, [navigate]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };

  const getWelcomeMessage = () => {
    if (!user) return "Loading...";
    if (isUserProfileLoading && !userProfile) return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
    if (userProfile) {
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) return `Welcome, ${first_name} ${last_name}!`;
      if (first_name) return `Welcome, ${first_name}!`;
      if (last_name) return `Welcome, ${last_name}!`; // Corrected from first_name
    }
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-accent transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-base hidden md:inline">{getWelcomeMessage()}</span>
            <Button variant="default" size="sm" asChild>
              <Link to="/discover-meals"><Sparkles className="mr-2 h-4 w-4" /> Discover Meals</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /> Profile</Link>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>
        {user && <WeeklyPlanner userId={user.id} currentWeekStart={currentWeekStart} onWeekNavigate={handleWeekNavigate} />}
        {user && <GroceryList userId={user.id} currentWeekStart={currentWeekStart} />}
      </div>
    </div>
  );
};

export default Dashboard;