import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { UserCircle, BookOpenText, Brain, SquarePen, CalendarDays, Home, PlusCircle } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const AppHeader = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile(); // Initialize useIsMobile

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        if (isMobile) { // Only navigate if mobile and no session, desktop might have public pages
             // navigate("/auth"); // Decided against auto-navigating from header directly
        }
      }
    };
    getSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user && isMobile) {
         // navigate("/auth"); // Decided against auto-navigating from header directly
      }
    });
    return () => authListener?.subscription.unsubscribe();
  }, [navigate, isMobile]);

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
    if (isUserProfileLoading && !userProfile) { 
      namePart = user.email ? user.email.split('@')[0] : 'User';
    } else if (userProfile) { 
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) namePart = `${first_name} ${last_name}`;
      else if (first_name) namePart = first_name;
      else if (last_name) namePart = last_name;
      else namePart = user.email ? user.email.split('@')[0] : 'User'; 
    } else { 
      namePart = user.email ? user.email.split('@')[0] : 'User';
    }
    
    return namePart ? `Welcome ${namePart}!` : "";
  };
  
  // Mobile Layout
  if (isMobile) {
    if (!user) { // If mobile and not logged in, render minimal top theme toggle
        return (
            <div className="fixed top-4 left-4 z-50">
                <ThemeToggleButton />
            </div>
        );
    }
    return (
      <>
        <div className="fixed top-4 left-4 z-50">
          <ThemeToggleButton />
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg p-1 flex justify-around items-center z-50 h-16">
          <Link to="/dashboard" data-tourid="tour-home-button" className="flex flex-col items-center justify-center text-xs text-muted-foreground hover:text-primary p-1 w-1/5 h-full">
            <Home className="h-5 w-5 mb-0.5" />
            <span className="truncate">Home</span>
          </Link>
          <Link to="/meals" data-tourid="tour-my-meals-button" className="flex flex-col items-center justify-center text-xs text-muted-foreground hover:text-primary p-1 w-1/5 h-full">
            <BookOpenText className="h-5 w-5 mb-0.5" />
            <span className="truncate">Meals</span>
          </Link>
          <Link to="/manage-meal-entry" data-tourid="tour-new-meal-button" className="flex flex-col items-center justify-center text-xs text-muted-foreground hover:text-primary p-1 w-1/5 h-full">
            <PlusCircle className="h-7 w-7 text-primary" />
            {/* <span className="mt-0.5 truncate text-primary">New</span> */}
          </Link>
          <Link to="/planning" data-tourid="tour-planning-button" className="flex flex-col items-center justify-center text-xs text-muted-foreground hover:text-primary p-1 w-1/5 h-full">
            <CalendarDays className="h-5 w-5 mb-0.5" />
            <span className="truncate">Plan</span>
          </Link>
          <Link to="/profile" data-tourid="tour-profile-button" className="flex flex-col items-center justify-center text-xs text-muted-foreground hover:text-primary p-1 w-1/5 h-full">
            <UserCircle className="h-5 w-5 mb-0.5" />
            <span className="truncate">Profile</span>
          </Link>
        </nav>
      </>
    );
  }

  // Desktop/Tablet Layout (Original code)
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
      <div className="flex items-center space-x-1 sm:space-x-3">
        <Link to="/dashboard" className="text-2xl font-bold group" data-tourid="tour-logo">
          <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
          <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
        </Link>
        <ThemeToggleButton />
        <Button variant="default" size="sm" asChild data-tourid="tour-home-button" className="px-2 sm:px-3">
          <Link to="/dashboard">
            <Home className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </Button>
        <span className="text-base hidden md:inline font-medium">{getWelcomeMessage()}</span>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button variant="default" size="sm" asChild data-tourid="tour-my-meals-button" className="px-2 sm:px-3">
          <Link to="/meals">
            <BookOpenText className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">My Meals</span>
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-new-meal-button" className="px-2 sm:px-3">
          <Link to="/manage-meal-entry">
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Meal</span>
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-planning-button" className="px-2 sm:px-3">
          <Link to="/planning">
            <CalendarDays className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Plan & Shop</span>
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild data-tourid="tour-profile-button" className="px-2 sm:px-3">
          <Link to="/profile">
            <UserCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;