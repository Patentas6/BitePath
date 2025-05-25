import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import TodaysMeals from "@/components/TodaysMeals"; // Import new component
import TodaysGroceryList from "@/components/TodaysGroceryList"; // Import new component
import type { User } from "@supabase/supabase-js";
import { startOfWeek, addDays } from "date-fns";
import { UserCircle, BookOpenText, Brain, SquarePen, CalendarDays, ShoppingCart, Home } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  // Removed currentWeekStart as it's not needed for today's view

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

  const getWelcomeMessage = () => {
    if (!user) return "Loading...";
    if (isUserProfileLoading && !userProfile) return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
    if (userProfile) {
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) return `Welcome, ${first_name} ${last_name}!`;
      if (first_name) return `Welcome, ${first_name}!`;
      if (last_name) return `Welcome, ${last_name}!`;
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
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-base hidden md:inline">{getWelcomeMessage()}</span>
            {/* Buttons in the new order */}
             <Button variant="default" size="sm" asChild> {/* New Home button */}
              <Link to="/dashboard"><Home className="mr-2 h-4 w-4" /> Home</Link> {/* Changed link to /dashboard */}
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate Meal</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Meal</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/weekly-plan"><CalendarDays className="mr-2 h-4 w-4" /> Weekly Plan</Link>
            </Button>
             {/* New Grocery List Button */}
            <Button variant="default" size="sm" asChild>
              <Link to="/grocery-list"><ShoppingCart className="mr-2 h-4 w-4" /> Grocery List</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /> Profile</Link>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>

        {/* Two-column layout for today's info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Today's Meals */}
          {user && (
            <TodaysMeals userId={user.id} />
          )}

          {/* Right Column: Today's Grocery List */}
          {user && (
            <TodaysGroceryList userId={user.id} />
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;