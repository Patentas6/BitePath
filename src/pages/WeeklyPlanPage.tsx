import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WeeklyPlanner from "@/components/WeeklyPlanner";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { startOfWeek, addDays, format } from "date-fns";
import { supabase } from "@/lib/supabase";

const WeeklyPlanPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

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

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prev => addDays(prev, direction === "next" ? 7 : -7));
  };

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
          <h1 className="text-xl sm:text-3xl font-bold flex items-center"><CalendarDays className="mr-2 h-6 w-6" /> Weekly Meal Plan</h1>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        {/* Weekly Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="default" size="sm" onClick={() => handleWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
          <h3 className="text-lg font-semibold text-center text-foreground">{format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}</h3>
          <Button variant="default" size="sm" onClick={() => handleWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>

        {/* Weekly Planner Component */}
        {/* Pass the fetched userId to the WeeklyPlanner */}
        <WeeklyPlanner userId={userId} currentWeekStart={currentWeekStart} />

      </div>
    </div>
  );
};

export default WeeklyPlanPage;