import MealForm from "@/components/MealForm";
import AppHeader from "@/components/AppHeader"; // Import AppHeader
// Removed Link, ArrowLeft, ThemeToggleButton, Button

const AddMealPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <AppHeader /> {/* Use AppHeader */}
        <div className="flex justify-center items-center mb-0">
            <h1 className="text-xl sm:text-3xl font-bold">Add New Meal</h1>
        </div>
        <div className="space-y-6">
          <MealForm />
        </div>
      </div>
    </div>
  );
};

export default AddMealPage;