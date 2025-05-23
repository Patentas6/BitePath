import MealForm from "@/components/MealForm";
import MealList from "@/components/MealList";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const MealsPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-teal-600 transition-colors">
            BitePath
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold">My Meals</h1>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        {/* Changed from grid to vertical stacking with space */}
        <div className="space-y-6">
          <MealForm />
          <MealList />
        </div>
      </div>
    </div>
  );
};

export default MealsPage;