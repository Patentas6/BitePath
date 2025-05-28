import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase"; // Import the Supabase client

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // If no user is logged in, redirect to auth page
        navigate("/auth", { replace: true }); // Use replace to avoid adding auth to history
      } else {
        setIsLoading(false); // User is logged in, stop loading
      }
    };

    checkUser();

    // Listen for auth state changes (e.g., logout from another tab)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // User logged out
        navigate("/auth", { replace: true });
      } else {
        setIsLoading(false); // User logged in
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  // You could render a loading spinner here while checking auth status
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If user is authenticated, render the children (the protected page)
  return <>{children}</>;
};

export default ProtectedRoute;