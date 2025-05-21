import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-4">Welcome to your Dashboard, {user.email}!</h1>
        <p>This is where your meal planning calendar and grocery list will go.</p>
        <Button onClick={handleLogout} className="mt-4">Logout</Button>
      </div>
    </div>
  );
};

export default Dashboard;