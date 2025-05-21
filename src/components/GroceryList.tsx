import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, endOfWeek, addDays } from "date-fns"; // Removed startOfWeek
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks } from "lucide-react";

interface PlannedMealWithIngredients {
  meals: {
    name: string;
    ingredients: string | null;
  } | null;
}

interface GroceryListProps {
  userId: string;
  currentWeekStart: Date; // Prop for the start date of the week to display
}

const GroceryList: React.FC<GroceryListProps> = ({ userId, currentWeekStart }) => {
  // Determine the end of the week based on the currentWeekStart prop
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 }); // Or addDays(currentWeekStart, 6)

  const { data: plannedMeals, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    // Query key now depends on the currentWeekStart prop
    queryKey: ["groceryList", userId, format(currentWeekStart, 'yyyy-MM-dd')], 
    queryFn: async () => {
      if (!userId) return [];

      const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
      const endDateStr = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("meal_plans")
        .select("meals ( name, ingredients )")
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
          Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}
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