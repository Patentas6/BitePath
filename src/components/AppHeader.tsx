import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { UserCircle, BookOpenText, Brain, SquarePen, CalendarDays, Home } from "lucide-react";
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
    queryKey: ["userProfileDataForHeader", user?.id],
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

  const getWelcomeMessage = () => {
    if (!user) return ""; 
    
    let namePart = "";
    if (isUserProfileLoading && !userProfile) { // Still loading profile, use email part or 'User'
      namePart = user.email ? user.email.split('@')[0] : 'User';
    } else if (userProfile) { // Profile loaded
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) namePart = `${first_name} ${last_name}`;
      else if (first_name) namePart = first_name;
      else if (last_name) namePart = last_name;
      else namePart = user.email ? user.email.split('@')[0] : 'User'; // Profile exists but names are null/empty
    } else { // Profile not loaded (and not loading, e.g., error or no profile row yet)
      namePart = user.email ? user.email.split('@')[0] : 'User';
    }
    
    return namePart ? `Welcome ${namePart}!` : "";
  };
  
  if (!user) { 
    return ( 
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
        <Link to="/dashboard" className="text-2xl font-bold group" data-tourid="tour-logo">
          <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
          <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
        </Link>
        <ThemeToggleButton />
        <span className="text-base hidden md:inline font-medium">{getWelcomeMessage()}</span>
      </div>
      <div className="flex items-center space-x-2">
        {/* Welcome message moved to the left group, remove from here if it was duplicated */}
        <Button variant="default" size="sm" asChild data-tourid="tour-home-button">
          <Link to="/dashboard"><Home className="mr-2 h-4 w-4" /> Home</Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-my-meals-button">
          <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-generate-meal-button">
          <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate Meal</Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-add-meal-button">
          <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Meal</Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-planning-button">
          <Link to="/planning"><CalendarDays className="mr-2 h-4 w-4" /> Plan & Shop</Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-profile-button">
          <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /> Profile</Link>
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;