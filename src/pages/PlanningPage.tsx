import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader"; 
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"; 
import { startOfWeek, addDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button"; 
import { useIsMobile } from "@/hooks/use-mobile"; // Import useIsMobile
import { cn } from "@/lib/utils"; // Import cn

const PlanningPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isMobile = useIsMobile(); // Initialize useIsMobile

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        // AppHeader handles this for desktop, ProtectedRoute for overall access
      }
    };
    fetchUser();
  }, [navigate]);

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };

  if (userId === null && !supabase.auth.getSession()) { 
    return <div className="min-h-screen flex items-center justify-center">Loading user data...</div>;
  }


  return (
    <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
      <AppHeader /> 
      <div className={cn("space-y-6", !isMobile && "container mx-auto")}>
        {/* Desktop header is now handled by the single AppHeader above */}
        
        {/* Title - hidden on mobile */}
        <div className={cn("flex justify-center items-center mb-0", isMobile && "hidden")}>
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