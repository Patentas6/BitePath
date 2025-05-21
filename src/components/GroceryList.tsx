import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns"; // Added endOfWeek for clarity
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks } from "lucide-react";

interface PlannedMealWithIngredients {
  meals: {
    name: string; // Meal name
    ingredients: string | null; // Ingredients string
  } | null;
}

interface GroceryListProps {
  userId: string;
}

const GroceryList: React.FC<GroceryListProps> = ({ userId }) => {
  // Determine the start and end of the current week (e.g., Monday to Sunday)
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday, or addDays(currentWeekStart, 6)

  const { data: plannedMeals, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["groceryList", userId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId) return [];

      const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
      const endDateStr = format(currentWeekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("meal_plans")
        .select("meals ( name, ingredients )") // Select meal name and ingredients
        .eq("user_id", userId)
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const allIngredients = plannedMeals
    ?.map(pm => pm.meals?.ingredients)
    .filter(Boolean) as string[] || [];
  
  // A very simple way to get unique lines of ingredients
  const uniqueIngredientLines = Array.from(new Set(
    allIngredients.flatMap(block => block.split('\n').map(line => line.trim()).filter(Boolean))
  ));


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5" />
            Grocery List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5" />
            Grocery List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load grocery list: {error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListChecks className="mr-2 h-5 w-5" />
          Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(currentWeekEnd, 'MMM dd')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueIngredientLines.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {uniqueIngredientLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">
            No ingredients found for the planned meals this week. Plan some meals with ingredients to see them here!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryList;