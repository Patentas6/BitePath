import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MealForm from "@/components/MealForm";
import MealList from "@/components/MealList";
import WeeklyPlanner from "@/components/WeeklyPlanner";
import GroceryList from "@/components/GroceryList"; // Import GroceryList
import type { User } from "@supabase/supabase-js";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

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

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Welcome to your Dashboard, {user.email}!</h1>
          <Button onClick={handleLogout}>Logout</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MealForm />
          <MealList />
        </div>
        
        <WeeklyPlanner userId={user.id} />

        {/* Replace placeholder with GroceryList component */}
        <GroceryList userId={user.id} />
        
      </div>
    </div>
  );
};

export default Dashboard;