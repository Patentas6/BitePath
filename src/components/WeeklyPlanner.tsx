import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { format, addDays, isSameDay, isToday, isPast, startOfToday, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; 

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, XCircle, Plus, Zap } from "lucide-react"; // Added Zap
import AddMealToPlanDialog from "./AddMealToPlanDialog";

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  meals: {
    name: string;
    estimated_calories?: string | null; // Added estimated_calories
  } | null;
}

interface UserProfileData {
  track_calories?: boolean;
}

interface WeeklyPlannerProps {
  userId: string;
  currentWeekStart: Date;
}

const MEAL_TYPE_DISPLAY_ORDER: PlanningMealType[] = ["Breakfast", "Brunch Snack", "Lunch", "Afternoon Snack", "Dinner"];

// Helper function to parse calorie strings (can be moved to a utils file if used elsewhere)
const parseCalories = (calorieString: string | null | undefined): number | null => {
  if (!calorieString) return null;
  const match = calorieString.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId, currentWeekStart }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<PlanningMealType | undefined>(undefined);

  const queryClient = useQueryClient();
  const today = startOfToday();

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfileData | null>({
    queryKey: ['userProfileForWeeklyPlanner', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('track_calories')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile for Weekly Planner:", error);
        return { track_calories: false };
      }
      return data || { track_calories: false };
    },
    enabled: !!userId,
  });

  const { data: mealPlans, isLoading: isLoadingMealPlans, error, refetch: refetchMealPlans } = useQuery<MealPlan[]>({
    queryKey: ["mealPlans", userId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId) return [];
      const start = format(currentWeekStart, 'yyyy-MM-dd');
      const end = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name, estimated_calories )") // Fetch estimated_calories
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
        queryKey: ["groceryListSource"] 
      });
      queryClient.invalidateQueries({
        queryKey: ["todaysGroceryListSource"]
      });
      queryClient.invalidateQueries({
        queryKey: ["todaysMealPlans"]
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

  const handleAddOrChangeMealClick = (day: Date, mealType?: PlanningMealType) => {
    if (isPast(day) && !isToday(day)) {
        console.log("Cannot plan for a past date (excluding today).");
        return;
    }
    setSelectedDateForDialog(day);
    setSelectedMealTypeForDialog(mealType); 
    setIsDialogOpen(true);
  };

  const mealPlansByDateAndType = useMemo(() => {
    const grouped = new Map<string, Map<string, MealPlan>>(); 
    mealPlans?.forEach(plan => {
      const dateKey = format(parseISO(plan.plan_date), 'yyyy-MM-dd');
      const mealTypeKey = plan.meal_type || 'Unknown';

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new Map<string, MealPlan>());
      }
      grouped.get(dateKey)?.set(mealTypeKey, plan);
    });
    return grouped;
  }, [mealPlans]);

  const dailyTotalsByDate = useMemo(() => {
    if (!userProfile?.track_calories || !mealPlans) return new Map<string, number>();
    const totals = new Map<string, number>();
    daysOfWeek.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const mealsForDay = mealPlansByDateAndType.get(dateKey);
      let dailySum = 0;
      if (mealsForDay) {
        mealsForDay.forEach(plan => {
          const calories = parseCalories(plan.meals?.estimated_calories);
          dailySum += calories || 0;
        });
      }
      if (dailySum > 0) {
        totals.set(dateKey, dailySum);
      }
    });
    return totals;
  }, [daysOfWeek, mealPlansByDateAndType, userProfile]);

  const isLoading = isLoadingMealPlans || isLoadingProfile;

  if (isLoading) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading meal plans.</p></CardContent></Card>;

  return (
    <>
      <div className="bg-muted p-4 rounded-lg shadow">
        <div className="grid grid-cols-7 gap-2 text-center mb-2">
          {daysOfWeek.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyTotal = dailyTotalsByDate.get(dateKey);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col items-center p-1 rounded-md",
                  isToday(day) && "bg-primary/10 dark:bg-primary/20"
                )}
              >
                <div className="font-semibold text-foreground">{format(day, 'EEE')}</div>
                <div className="text-sm text-muted-foreground">{format(day, 'MMM dd')}</div>
                {userProfile?.track_calories && dailyTotal && dailyTotal > 0 && (
                  <div className="text-xs text-primary mt-0.5 flex items-center">
                    <Zap size={10} className="mr-0.5" />
                    {dailyTotal} kcal
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {daysOfWeek.map(day => {
            const isDayPast = isPast(day) && !isToday(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const mealsForDayMap = mealPlansByDateAndType.get(dateKey);

            return (
              <div key={day.toISOString() + "-slots"} className={cn("flex flex-col space-y-1", isDayPast && "opacity-60")}>
                {MEAL_TYPE_DISPLAY_ORDER.map(mealType => {
                  const plannedMeal = mealsForDayMap?.get(mealType);
                  const mealCalories = parseCalories(plannedMeal?.meals?.estimated_calories);
                  return (
                    <div
                      key={mealType}
                      onClick={() => !isDayPast && handleAddOrChangeMealClick(day, plannedMeal ? mealType : undefined)}
                      className={cn(
                        "border rounded-md p-2 text-xs flex flex-col justify-between overflow-hidden relative transition-colors min-h-[70px]", // Adjusted min height
                        isDayPast ? "bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed" : "bg-card hover:bg-card/80 cursor-pointer"
                      )}
                    >
                      {plannedMeal ? (
                        <>
                          <div className={cn(
                            "font-medium self-start text-gray-600 dark:text-gray-400 text-[10px] leading-tight", 
                            isDayPast && "text-gray-500 dark:text-gray-500"
                          )}>
                            {plannedMeal.meal_type || mealType}
                          </div>
                          <div className={cn(
                            "text-xs font-semibold truncate self-start flex-grow mt-0.5", 
                            isDayPast ? "line-through text-gray-500 dark:text-gray-500" : "text-foreground"
                          )}>
                            {plannedMeal.meals?.name || 'Unknown Meal'}
                          </div>
                          {userProfile?.track_calories && mealCalories !== null && (
                            <div className={cn(
                              "text-[10px] text-primary self-start flex items-center mt-0.5",
                              isDayPast && "text-gray-500 dark:text-gray-500"
                            )}>
                              <Zap size={10} className="mr-0.5" />
                              {mealCalories} kcal
                            </div>
                          )}
                          {!isDayPast && (
                            <button
                              onClick={(e) => handleRemoveMeal(plannedMeal.id, e)}
                              className="absolute top-0.5 right-0.5 p-0.5 rounded-full text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500/80 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                              aria-label="Remove meal"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-[10px] text-muted-foreground/70">{mealType}</span>
                          {!isDayPast && <Plus size={14} className="text-muted-foreground/50 mt-0.5" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <AddMealToPlanDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
             setSelectedDateForDialog(null);
             setSelectedMealTypeForDialog(undefined);
          }
        }}
        planDate={selectedDateForDialog}
        userId={userId}
        initialMealType={selectedMealTypeForDialog}
      />
    </>
  );
};

export default WeeklyPlanner;