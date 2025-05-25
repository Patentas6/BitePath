import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
// Removed imports for WeeklyPlanner and GroceryList
import type { User } from "@supabase/supabase-js";
// Removed startOfWeek, addDays as they are now in PlannerViewPage
import { UserCircle, PlusCircle } from "lucide-react"; // Added PlusCircle for quick action
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import BottomNavBar from "@/components/BottomNavBar"; // Import the new bottom nav
import ProfileButton from "../components/ProfileButton"; // Changed import to relative path
import AddMealToPlanDialog from "@/components/AddMealToPlanDialog"; // Import dialog for quick action
import { startOfToday } from "date-fns"; // Needed for today's date

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  // Removed currentWeekStart state and handleWeekNavigate function

  const [isAddMealDialogOpen, setIsAddMealDialogOpen] = useState(false);
  const today = startOfToday(); // Get today's date for quick action

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

  const { data: userProfile, isLoading: isUserProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getWelcomeMessage = () => {
    if (!user) return "Loading...";
    if (isUserProfileLoading && !userProfile) return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
    if (userProfile) {
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) return `Welcome, ${first_name} ${last_name}!`;
      if (first_name) return `Welcome, ${first_name}!`;
      if (last_name) return `Welcome, ${last_name}!`;
    }
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="w-full p-4 bg-background shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {/* Profile Button */}
            <ProfileButton userId={user.id} />
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-[#7BB390] dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-[#FC5A50] dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-4">
             <span className="text-base hidden md:inline">{getWelcomeMessage()}</span>
             <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 space-y-6">
        {/* Quick Action Button */}
        <div className="text-center">
            <Button size="lg" onClick={() => setIsAddMealDialogOpen(true)}>
                <PlusCircle className="mr-2 h-5 w-5" /> Add Meal to Today's Plan
            </Button>
        </div>

        {/* Placeholder for Dashboard content - maybe a summary or welcome message */}
        <div className="text-center py-10">
            <h2 className="text-3xl font-bold mb-4">Welcome to BitePath!</h2>
            <p className="text-lg text-muted-foreground">Use the navigation below to plan your meals, manage your recipes, and generate your grocery list.</p>
        </div>

      </main>

      {/* Bottom Navigation Bar */}
      <BottomNavBar />

      {/* Dialog for Quick Action */}
      {user && (
        <AddMealToPlanDialog
          open={isAddMealDialogOpen}
          onOpenChange={setIsAddMealDialogOpen}
          planDate={today}
          mealType="Dinner" // Default to Dinner, or could let user choose
          userId={user.id}
        />
      )}
    </div>
  );
};

export default Dashboard;