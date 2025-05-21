import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom"; // Import Link
import { Button } from "@/components/ui/button";
import MealForm from "@/components/MealForm";
import MealList from "@/components/MealList";
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList";
import type { User } from "@supabase/supabase-js";
import { startOfWeek, addDays } from "date-fns";
import { UserCircle } from "lucide-react"; // Icon for profile link

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate("/auth");
      } else {
        setUser(currentUser);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error);
    }
  };

  const handleWeekNavigate = (direction: "prev" | "next") => {
    setCurrentWeekStart(prevWeekStart => addDays(prevWeekStart, direction === "next" ? 7 : -7));
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Welcome, {user.email ? user.email.split('@')[0] : 'User'}!</h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </Link>
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">Logout</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MealForm />
          <MealList />
        </div>
        
        <WeeklyPlanner 
          userId={user.id} 
          currentWeekStart={currentWeekStart}
          onWeekNavigate={handleWeekNavigate} 
        />

        <GroceryList 
          userId={user.id} 
          currentWeekStart={currentWeekStart} 
        />
        
      </div>
    </div>
  );
};

export default Dashboard;