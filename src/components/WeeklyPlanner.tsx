import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, XCircle } from "lucide-react"; // Added XCircle icon
import AddMealToPlanDialog from "./AddMealToPlanDialog";

interface MealPlan {
  id: string; // Crucial for deletion
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  meals: {
    name: string;
  } | null;
}

const mealTypes = ["Breakfast", "Lunch", "Dinner"];

interface WeeklyPlannerProps {
  userId: string;
}

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: mealPlans, isLoading, error, refetch: refetchMealPlans } = useQuery<MealPlan[]>({
    queryKey: ["mealPlans", userId, currentWeekStart.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!userId) return [];
      const start = format(currentWeekStart, 'yyyy-MM-dd');
      const end = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name )")
        .eq("user_id", userId)
        .gte("plan_date", start)
        .lte("plan_date", end);
      if (error) throw error;
      return data || [];
    },
  });

  const removeMealFromPlanMutation = useMutation({
    mutationFn: async (mealPlanId: string) => {
      const { error } = await supabase
        .from("meal_plans")
        .delete()
        .eq("id", mealPlanId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meal removed from plan!");
      refetchMealPlans(); // Refetch to update the UI
    },
    onError: (error) => {
      console.error("Error removing meal from plan:", error);
      showError(`Failed to remove meal: ${error.message}`);
    },
  });

  const handleRemoveMeal = (mealPlanId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the add dialog when clicking remove
    // Optional: Add a confirmation dialog here
    removeMealFromPlanMutation.mutate(mealPlanId);
  };

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeekStart(addDays(currentWeekStart, direction === "next" ? 7 : -7));
  };

  const handleMealSlotClick = (day: Date, mealType: string, plannedMeal: MealPlan | undefined) => {
    // If a meal is already planned, don't open the dialog to add another one immediately.
    // The user can remove it first if they want to change.
    // Or, we could allow clicking to "edit" (which would be similar to add).
    // For now, clicking an empty slot or a slot to "add" is the primary action.
    // If we want to edit, we might need a different interaction or button.
    // Let's keep it simple: clicking always tries to add/change.
    setSelectedDateForDialog(day);
    setSelectedMealTypeForDialog(mealType);
    setIsDialogOpen(true);
  };

  if (isLoading) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><p className="text-red-500">Error loading meal plans.</p></CardContent></Card>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Weekly Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
            <h3 className="text-lg font-semibold text-center">{format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}</h3>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {daysOfWeek.map(day => (<div key={day.toISOString()} className="flex flex-col items-center"><div className="font-semibold">{format(day, 'EEE')}</div><div className="text-sm text-gray-600">{format(day, 'MMM dd')}</div></div>))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map(day => (
              <div key={day.toISOString() + "-meals"} className="flex flex-col space-y-2">
                {mealTypes.map(mealType => {
                  const plannedMeal = mealPlans?.find(plan => isSameDay(new Date(plan.plan_date), day) && plan.meal_type === mealType);
                  return (
                    <div 
                      key={mealType} 
                      className="border rounded-md p-2 text-sm h-24 flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors relative" // Added relative for positioning remove button
                      onClick={() => handleMealSlotClick(day, mealType, plannedMeal)}
                    >
                      <div className="font-medium text-gray-700 self-start">{mealType}</div>
                      {plannedMeal ? (
                        <>
                          <div className="text-xs text-gray-600 truncate self-start flex-grow mt-1">{plannedMeal.meals?.name || 'Unknown Meal'}</div>
                          <button 
                            onClick={(e) => handleRemoveMeal(plannedMeal.id, e)} 
                            className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
                            aria-label="Remove meal"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 italic self-start mt-1">Click to add</div>
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
          if (!isOpen) refetchMealPlans();
        }}
        planDate={selectedDateForDialog}
        mealType={selectedMealTypeForDialog}
        userId={userId}
      />
    </>
  );
};

export default WeeklyPlanner;