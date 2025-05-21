import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string; // Supabase returns date as string
  meal_type?: string;
  meals: { // This assumes we can join the meals table
    name: string;
  } | null;
}

const mealTypes = ["Breakfast", "Lunch", "Dinner"];

const WeeklyPlanner = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Start week on Monday

  const { data: mealPlans, isLoading, error } = useQuery<MealPlan[]>({
    queryKey: ["mealPlans", currentWeekStart.toISOString().split('T')[0]], // Include week start date in query key
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not logged in.");
      }

      const start = format(currentWeekStart, 'yyyy-MM-dd');
      const end = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("meal_plans")
        .select(\`
          id,
          meal_id,
          plan_date,
          meal_type,
          meals ( name )
        \`)
        .eq("user_id", user.id)
        .gte("plan_date", start)
        .lte("plan_date", end);

      if (error) {
        throw error;
      }
      return data || [];
    },
  });

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const navigateWeek = (direction: "prev" | "next") => {
    const days = direction === "next" ? 7 : -7;
    setCurrentWeekStart(addDays(currentWeekStart, days));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meal plans:", error);
    showError(`Failed to load meal plans: ${error.message}`);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading meal plans.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous Week
          </Button>
          <h3 className="text-lg font-semibold">
            {format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}
          </h3>
          <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
            Next Week <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {daysOfWeek.map(day => (
            <div key={day.toISOString()} className="flex flex-col items-center">
              <div className="font-semibold">{format(day, 'EEE')}</div> {/* Day of week (Mon, Tue, etc.) */}
              <div className="text-sm text-gray-600">{format(day, 'MMM dd')}</div> {/* Date */}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 mt-2">
          {daysOfWeek.map(day => (
            <div key={day.toISOString()} className="flex flex-col space-y-2">
              {mealTypes.map(mealType => {
                const plannedMeal = mealPlans?.find(plan =>
                  isSameDay(new Date(plan.plan_date), day) && plan.meal_type === mealType
                );
                return (
                  <div key={mealType} className="border rounded-md p-2 text-sm h-16 overflow-hidden">
                    <div className="font-medium text-gray-700">{mealType}</div>
                    {plannedMeal ? (
                      <div className="text-xs text-gray-500 truncate">{plannedMeal.meals?.name || 'Unknown Meal'}</div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No plan</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlanner;