import MealList from "@/components/MealList";
import AppHeader from "@/components/AppHeader"; // Import AppHeader
// Removed Link, ArrowLeft, ThemeToggleButton as they are in AppHeader

const MealsPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <AppHeader /> {/* Use AppHeader */}
        <div className="flex justify-center items-center mb-0"> {/* Adjusted mb from 6 to 0 or remove if not needed */}
            <h1 className="text-xl sm:text-3xl font-bold">My Meals</h1>
        </div>
        <div className="space-y-6">
          <MealList />
        </div>
      </div>
    </div>
  );
};

export default MealsPage;