import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, isToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Utensils } from "lucide-react";

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  meals: {
    name: string;
  } | null;
}

interface TodaysMealsSummaryProps {
  userId: string;
}

const mealTypes = ["Breakfast", "Lunch", "Dinner"];

const TodaysMealsSummary: React.FC<TodaysMealsSummaryProps> = ({ userId }) => {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: mealPlans, isLoading, error } = useQuery<MealPlan[]>({
    queryKey: ["todaysMealPlans", userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name )")
        .eq("user_id", userId)
        .eq("plan_date", today); // Filter specifically for today
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching today's meal plans:", error);
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not load today's meals.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const todaysMeals = mealTypes.map(type => {
    const planned = mealPlans?.find(plan => plan.meal_type === type);
    return {
      type,
      mealName: planned?.meals?.name || "Not planned",
      isPlanned: !!planned,
    };
  });

  const hasPlannedMeals = todaysMeals.some(meal => meal.isPlanned);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="flex items-center"><Utensils className="mr-2 h-5 w-5" /> Today's Meals ({format(new Date(), 'EEE, MMM dd')})</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasPlannedMeals ? (
          <div className="text-center text-muted-foreground">
             <p className="text-sm">No meals planned for today.</p>
             <p className="text-xs mt-1">Click "Add Meal to Today's Plan" above or use the Planner tab below.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todaysMeals.map(({ type, mealName, isPlanned }) => (
              <li key={type} className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground">{type}:</span>
                <span className={isPlanned ? "text-muted-foreground" : "italic text-gray-500 dark:text-gray-400"}>
                  {mealName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysMealsSummary;