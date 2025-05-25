import MealForm from "@/components/MealForm";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpenText, Brain, SquarePen, CalendarDays } from "lucide-react"; // Import icons
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { supabase } from "@/lib/supabase"; // Import supabase for logout

const AddMealPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/" className="text-2xl font-bold group">
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-2">
            {/* Navigation Links in new order */}
            <Button variant="default" size="sm" asChild>
              <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Own Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/profile"><CalendarDays className="mr-2 h-4 w-4" /> Weekly Plan</Link> {/* Link to Profile page */}
            </Button>
            {/* Profile link removed from main nav */}
            <Button onClick={async () => { await supabase.auth.signOut(); }} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>

        <div className="space-y-6">
          <MealForm />
        </div>
      </div>
    </div>
  );
};

export default AddMealPage;