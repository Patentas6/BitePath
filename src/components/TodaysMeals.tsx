import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, isToday, startOfToday, parseISO } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  meals: {
    name: string;
    image_url?: string | null; // Added image_url
  } | null;
}

interface TodaysMealsProps {
  userId: string;
}

// Define the desired display order for meal types
const MEAL_TYPE_DISPLAY_ORDER: PlanningMealType[] = ["Breakfast", "Brunch Snack", "Lunch", "Afternoon Snack", "Dinner"];

const TodaysMeals: React.FC<TodaysMealsProps> = ({ userId }) => {
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  const { data: mealPlans, isLoading, error } = useQuery<MealPlan[]>({
    queryKey: ["todaysMealPlans", userId, todayStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name, image_url )") // Select image_url
        .eq("user_id", userId)
        .eq("plan_date", todayStr); // Filter specifically for today
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Sort meal plans by meal type display order
  const sortedMealPlans = useMemo(() => {
    if (!mealPlans) return [];
    return [...mealPlans].sort((a, b) => {
      const aIndex = MEAL_TYPE_DISPLAY_ORDER.indexOf(a.meal_type as PlanningMealType);
      const bIndex = MEAL_TYPE_DISPLAY_ORDER.indexOf(b.meal_type as PlanningMealType);
      // Handle cases where meal_type might not be in the defined order (put them at the end)
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [mealPlans]);


  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>;
  if (error) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading today's meals.</p></CardContent></Card>;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <CardTitle>Today's Meals ({format(today, 'MMM dd')})</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {sortedMealPlans.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <UtensilsCrossed className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">No Meals Planned</p>
            <p className="text-sm">Plan some meals for today in the <Link to="/weekly-plan" className="underline hover:text-foreground">Weekly Plan</Link>.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedMealPlans.map(plannedMeal => (
              <li key={plannedMeal.id} className="border rounded-md p-3 bg-card shadow-sm flex items-center space-x-3"> {/* Added flex and spacing */}
                 {plannedMeal.meals?.image_url && (
                    <img
                      src={plannedMeal.meals.image_url}
                      alt={plannedMeal.meals.name || 'Meal image'}
                      className="h-12 w-12 object-cover rounded-md flex-shrink-0" // Fixed size, object-cover, rounded
                      onError={(e) => (e.currentTarget.style.display = 'none')} // Hide image on error
                    />
                 )}
                 <div className="flex-grow"> {/* Allow text to take remaining space */}
                   <div className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                     {plannedMeal.meal_type || 'Meal'}
                   </div>
                   <div className="text-base font-semibold text-foreground mt-1">
                     {plannedMeal.meals?.name || 'Unknown Meal'}
                   </div>
                 </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysMeals;