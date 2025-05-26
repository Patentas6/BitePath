import { useState, useEffect } from "react";
// import { Link, useNavigate } from "react-router-dom"; // Link not needed if only for logo
import { useNavigate } from "react-router-dom";
// import { Button } from "@/components/ui/button"; // Button not needed for header items
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"; // Removed ArrowLeft
// import { ThemeToggleButton } from "@/components/ThemeToggleButton"; // In AppHeader
import { startOfWeek, addDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader"; // Import AppHeader
import { Button } from "@/components/ui/button"; // Keep for week navigation

const PlanningPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        // navigate("/auth"); // AppHeader handles this
      }
    };
    fetchUser();
    // AppHeader's onAuthStateChange will also handle navigation on sign out
  }, [navigate]);

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };

  if (userId === null && !supabase.auth.getSession()) { // Check if session is truly null before showing loading
    return <div className="min-h-screen flex items-center justify-center">Loading user data...</div>;
  }


  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <AppHeader /> {/* Use AppHeader */}
        <div className="flex justify-center items-center mb-0">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center"><CalendarDays className="mr-2 h-6 w-6" /> Plan & Shop</h1>
        </div>
        <div className="flex justify-between items-center mb-4">
          <Button variant="default" size="sm" onClick={() => handleWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
          <h3 className="text-lg font-semibold text-center text-foreground">{format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}</h3>
          <Button variant="default" size="sm" onClick={() => handleWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
        <div className="space-y-6">
          <div>
            {userId && <WeeklyPlanner userId={userId} currentWeekStart={currentWeekStart} />}
          </div>
          <div>
            {userId && <GroceryList userId={userId} currentWeekStart={currentWeekStart} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningPage;