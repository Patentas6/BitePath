import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AddMealToPlanDialog from "./AddMealToPlanDialog"; // Import the dialog

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  meals: {
    name: string;
  } | null;
}

const mealTypes = ["Breakfast", "Lunch", "Dinner"];

interface WeeklyPlannerProps {
  userId: string; // Add userId prop
}

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // State for the dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<string | null>(null);

  const { data: mealPlans, isLoading, error, refetch: refetchMealPlans } = useQuery<MealPlan[]>({
    queryKey: ["mealPlans", userId, currentWeekStart.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!userId) {
        // This check is more for type safety, as userId is required by the component
        console.warn("User ID not provided to WeeklyPlanner, cannot fetch meal plans.");
        return [];
      }

      const start = format(currentWeekStart, 'yyyy-MM-dd');
      const end = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name )")
        .eq("user_id", userId)
        .gte("plan_date", start)
        .lte("plan_date", end);

      if (error) {
        throw error;
      }
      return data || [];
    },
    // enabled: !!userId, // Ensure userId is present before querying
  });

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const navigateWeek = (direction: "prev" | "next") => {
    const days = direction === "next" ? 7 : -7;
    setCurrentWeekStart(addDays(currentWeekStart, days));
  };

  const handleMealSlotClick = (day: Date, mealType: string) => {
    setSelectedDateForDialog(day);
    setSelectedMealTypeForDialog(mealType);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meal plans:", error);
    showError(`Failed to load meal plans: ${error.message}`);
    return (
      <Card>
        <CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader>
        <CardContent><p className="text-red-500">Error loading meal plans.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Weekly Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <h3 className="text-lg font-semibold text-center">
              {format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}
            </h3>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {daysOfWeek.map(day => (
              <div key={day.toISOString()} className="flex flex-col items-center">
                <div className="font-semibold">{format(day, 'EEE')}</div>
                <div className="text-sm text-gray-600">{format(day, 'MMM dd')}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map(day => (
              <div key={day.toISOString() + "-meals"} className="flex flex-col space-y-2">
                {mealTypes.map(mealType => {
                  const plannedMeal = mealPlans?.find(plan =>
                    isSameDay(new Date(plan.plan_date), day) && plan.meal_type === mealType
                  );
                  return (
                    <div 
                      key={mealType} 
                      className="border rounded-md p-2 text-sm h-20 flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleMealSlotClick(day, mealType)}
                    >
                      <div className="font-medium text-gray-700 self-start">{mealType}</div>
                      {plannedMeal ? (
                        <div className="text-xs text-gray-500 truncate self-start">{plannedMeal.meals?.name || 'Unknown Meal'}</div>
                      ) : (
                        <div className="text-xs text-gray-400 italic self-start">Click to add</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AddMealToPlanDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) { // If dialog is closing, refetch meal plans
            refetchMealPlans();
          }
        }}
        planDate={selectedDateForDialog}
        mealType={selectedMealTypeForDialog}
        userId={userId}
      />
    </>
  );
};

export default WeeklyPlanner;