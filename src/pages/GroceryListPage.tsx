import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import GroceryList from "@/components/GroceryList";
import type { User } from "@supabase/supabase-js";
import { startOfWeek } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import BottomNavBar from "@/components/BottomNavBar"; // Import BottomNavBar

const GroceryListPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  // TODO: Add state and logic for 1/3/7 day toggle

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

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col"> {/* Added flex-col */}
      <div className="container mx-auto space-y-6 flex-grow"> {/* Added flex-grow */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-[#7BB390] dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-[#FC5A50] dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold">Grocery List</h1>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>
        {user && <GroceryList userId={user.id} currentWeekStart={currentWeekStart} />}
        {/* TODO: Add 1/3/7 day toggle UI */}
      </div>
      <BottomNavBar /> {/* Added BottomNavBar */}
    </div>
  );
};

export default GroceryListPage;