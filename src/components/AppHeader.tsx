import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { UserCircle, BookOpenText, Brain, SquarePen, CalendarDays } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const AppHeader = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth"); // Should not happen if ProtectedRoute is used, but good fallback
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
    queryKey: ["userProfileDataForHeader", user?.id], // Unique queryKey
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no row found, which is fine
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Navigation to /auth is handled by the onAuthStateChange listener
  };

  const getWelcomeMessage = () => {
    if (!user) return ""; // Don't show "Loading..." in header, just empty if no user yet
    if (isUserProfileLoading && !userProfile) return `${user.email ? user.email.split('@')[0] : 'User'}`;
    if (userProfile) {
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) return `${first_name} ${last_name}`;
      if (first_name) return `${first_name}`;
      if (last_name) return `${last_name}`;
    }
    return `${user.email ? user.email.split('@')[0] : 'User'}`;
  };
  
  // Avoid rendering header content until user is resolved to prevent flash of login state
  if (!user) {
    return ( // Minimal header during auth check
        <header className="flex justify-between items-center p-4 container mx-auto">
             <div className="flex items-center space-x-3">
                <Link to="/dashboard" className="text-2xl font-bold group">
                <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
                <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
                </Link>
            </div>
            <div><ThemeToggleButton /></div>
        </header>
    );
  }

  return (
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
        <Button variant="default" size="sm" asChild>
          <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Meal</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link to="/planning"><CalendarDays className="mr-2 h-4 w-4" /> Plan & Shop</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /> Profile</Link>
        </Button>
        <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
      </div>
    </header>
  );
};

export default AppHeader;