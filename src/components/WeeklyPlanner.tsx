import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { format, addDays, isSameDay, isToday } from "date-fns"; // Added isToday
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils"; // Import cn

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import AddMealToPlanDialog from "./AddMealToPlanDialog";

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
  userId: string;
  currentWeekStart: Date;
  onWeekNavigate: (direction: "prev" | "next") => void;
}

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId, currentWeekStart, onWeekNavigate }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: mealPlans, isLoading, error, refetch: refetchMealPlans } = useQuery<MealPlan[]>({
    queryKey: ["mealPlans", userId, format(currentWeekStart, 'yyyy-MM-dd')], 
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
      refetchMealPlans(); 
      queryClient.invalidateQueries({ 
        queryKey: ["groceryList", userId, format(currentWeekStart, 'yyyy-MM-dd')] 
      });
    },
    onError: (error) => {
      console.error("Error removing meal from plan:", error);
      showError(`Failed to remove meal: ${error.message}`);
    },
  });

  const handleRemoveMeal = (mealPlanId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    removeMealFromPlanMutation.mutate(mealPlanId);
  };

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const handleMealSlotClick = (day: Date, mealType: string, plannedMeal: MealPlan | undefined) => {
    setSelectedDateForDialog(day);
    setSelectedMealTypeForDialog(mealType);
    setIsDialogOpen(true);
  };

  if (isLoading) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading meal plans.</p></CardContent></Card>;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle>Weekly Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={() => onWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
            <h3 className="text-lg font-semibold text-center text-foreground">{format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}</h3>
            <Button variant="outline" size="sm" onClick={() => onWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center mb-2">
            {daysOfWeek.map(day => (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "flex flex-col items-center p-1 rounded-md",
                  isToday(day) && "bg-primary/10 dark:bg-primary/20"
                )}
              >
                <div className="font-semibold text-foreground">{format(day, 'EEE')}</div>
                <div className="text-sm text-muted-foreground">{format(day, 'MMM dd')}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map(day => (
              <div key={day.toISOString() + "-meals"} className="flex flex-col space-y-2">
                {mealTypes.map(mealType => {
                  const plannedMeal = mealPlans?.find(plan => isSameDay(new Date(plan.plan_date), day) && plan.meal_type === mealType);
                  return (
                    <div 
                      key={mealType} 
                      className="border rounded-md p-2 text-xs h-24 flex flex-col justify-between overflow-hidden cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative"
                      onClick={() => handleMealSlotClick(day, mealType, plannedMeal)}
                    >
                      <div className="font-medium text-gray-600 dark:text-gray-400 self-start">{mealType}</div>
                      {plannedMeal ? (
                        <>
                          <div className="text-sm font-medium text-foreground truncate self-start flex-grow mt-1">{plannedMeal.meals?.name || 'Unknown Meal'}</div>
                          <button 
                            onClick={(e) => handleRemoveMeal(plannedMeal.id, e)} 
                            className="absolute top-1 right-1 p-0.5 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                            aria-label="Remove meal"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 dark:text-gray-500 italic self-start mt-1 flex-grow flex items-center justify-start">Click to add</div>
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
        }}
        planDate={selectedDateForDialog}
        mealType={selectedMealTypeForDialog}
        userId={userId}
      />
    </>
  );
};

export default WeeklyPlanner;