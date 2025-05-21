import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MealForm from "@/components/MealForm"; // Import MealForm
import MealList from "@/components/MealList"; // Import MealList

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // If no user is logged in, redirect to auth page
        navigate("/auth");
      } else {
        setUser(user);
      }
    };

    checkUser();

    // Listen for auth state changes (e.g., logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // User logged out
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
      // Optionally show an error toast
    }
    // The auth listener will handle the navigation after logout
  };

  if (!user) {
    // Optionally show a loading state or spinner
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6"> {/* Added spacing */}
        <div className="flex justify-between items-center"> {/* Added flex for layout */}
          <h1 className="text-2xl font-bold">Welcome to your Dashboard, {user.email}!</h1>
          <Button onClick={handleLogout}>Logout</Button>
        </div>

        {/* Add the MealForm and MealList components */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Layout for form and list */}
          <MealForm />
          <MealList />
        </div>

        {/* Placeholder for meal planning calendar and grocery list */}
        <div className="mt-8 p-4 border rounded-lg bg-white">
           <h2 className="text-xl font-semibold mb-2">Meal Planning Calendar</h2>
           <p className="text-gray-600">Coming soon: Drag and drop meals onto your calendar here.</p>
        </div>

         <div className="mt-4 p-4 border rounded-lg bg-white">
           <h2 className="text-xl font-semibold mb-2">Grocery List</h2>
           <p className="text-gray-600">Coming soon: Your automated grocery list will appear here.</p>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;