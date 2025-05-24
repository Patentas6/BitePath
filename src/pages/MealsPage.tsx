import MealForm from "@/components/MealForm";
import MealList from "@/components/MealList";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ThemeToggleButton } from "@/components/ThemeToggleButton"; // Import

const MealsPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              BitePath
            </Link>
            <ThemeToggleButton />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold">My Meals</h1>
          <Button variant="outline" asChild> {/* Keeping this outline as it's a back button */}
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <div className="space-y-6">
          <MealForm />
          <MealList />
        </div>
      </div>
    </div>
  );
};

export default MealsPage;