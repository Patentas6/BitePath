import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Meal {
  id: string;
  name: string;
  ingredients?: string;
  instructions?: string;
}

const MealList = () => {
  // Query to fetch meals for the logged-in user
  const { data: meals, isLoading, error } = useQuery<Meal[]>({
    queryKey: ["meals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // This case should ideally be handled by ProtectedRoute, but good to have a fallback
        throw new Error("User not logged in.");
      }

      const { data, error } = await supabase
        .from("meals")
        .select("id, name, ingredients, instructions")
        .eq("user_id", user.id); // Filter by the logged-in user's ID

      if (error) {
        throw error;
      }
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meals:", error);
    showError(`Failed to load meals: ${error.message}`);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Meals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading meals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Meals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {meals && meals.length > 0 ? (
          meals.map((meal) => (
            <div key={meal.id} className="border p-4 rounded-md">
              <h3 className="text-lg font-semibold">{meal.name}</h3>
              {meal.ingredients && <p className="text-sm text-gray-600 mt-1">Ingredients: {meal.ingredients}</p>}
              {meal.instructions && <p className="text-sm text-gray-600 mt-1">Instructions: {meal.instructions}</p>}
            </div>
          ))
        ) : (
          <p className="text-gray-600">No meals added yet. Add one using the form above!</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MealList;