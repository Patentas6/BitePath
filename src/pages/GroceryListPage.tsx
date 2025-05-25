import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GroceryList from "@/components/GroceryList";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { startOfWeek } from "date-fns";
import { supabase } from "@/lib/supabase";

const GroceryListPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        navigate("/auth");
      }
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserId(null);
        navigate("/auth", { replace: true });
      } else {
        setUserId(session.user.id);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  if (userId === null) {
    return <div className="min-h-screen flex items-center justify-center">Loading user data...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center"><ShoppingCart className="mr-2 h-6 w-6" /> Grocery List</h1>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        {/* Grocery List Component */}
        {/* Pass the fetched userId and currentWeekStart to the GroceryList */}
        <GroceryList userId={userId} currentWeekStart={currentWeekStart} />

      </div>
    </div>
  );
};

export default GroceryListPage;