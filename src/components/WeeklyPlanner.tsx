import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { format, addDays, isSameDay, isToday, isPast, startOfToday, parseISO } from "date-fns";
import { useMemo, useState, useEffect, useRef } from "react"; 
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; 
import { useIsMobile } from "@/hooks/use-mobile"; 

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, XCircle, Plus, Zap, Users } from "lucide-react"; 
import AddMealToPlanDialog from "./AddMealToPlanDialog";
import { calculateCaloriesPerServing, parseFirstNumber } from '@/utils/mealUtils'; 

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string;
  desired_servings?: number | null; 
  meals: {
    name: string;
    estimated_calories?: string | null; 
    servings?: string | null; 
  } | null;
}

interface UserProfileData {
  track_calories?: boolean;
}

interface WeeklyPlannerProps {
  userId: string;
  currentWeekStart: Date;
  preSelectedMealId?: string | null; 
  preSelectedMealName?: string | null; // New prop
  preSelectedMealOriginalServings?: string | null | undefined; // New prop
  onPreselectedMealSlotClick?: (planDate: Date, mealType: PlanningMealType, mealId: string, mealName: string, originalServings: string | null | undefined) => void; // New prop
  onMealPreSelectedAndPlanned?: () => void; // Kept for now, but its role might change
}

const MEAL_TYPE_DISPLAY_ORDER: PlanningMealType[] = ["Breakfast", "Brunch Snack", "Lunch", "Afternoon Snack", "Dinner"];

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ 
  userId, 
  currentWeekStart, 
  preSelectedMealId,
  preSelectedMealName,
  preSelectedMealOriginalServings,
  onPreselectedMealSlotClick,
  onMealPreSelectedAndPlanned 
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<PlanningMealType | undefined>(undefined);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null); 
  const isMobile = useIsMobile(); 

  const queryClient = useQueryClient();
  const todayDate = startOfToday(); 

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
        .select("id, meal_id, plan_date, meal_type, desired_servings, meals ( name, estimated_calories, servings )") 
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
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysMealPlans"] });
    },
    onError: (error) => {
      console.error("Error removing meal from plan:", error);
      showError(`Failed to remove meal: ${error.message}`);
    },
  });

  // This directAddMealToPlanMutation might become obsolete or only used by AddMealToPlanDialog
  // For now, keeping it to see how AddMealToPlanDialog is structured.
  const directAddMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_obj, meal_type_str }: { meal_id: string; plan_date_obj: Date; meal_type_str: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const plan_date_str = format(plan_date_obj, "yyyy-MM-dd");

      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .match({ user_id: userId, plan_date: plan_date_str, meal_type: meal_type_str });
      if (deleteError) console.warn("Error deleting existing meal plan entry for direct add:", deleteError.message);
      
      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{ user_id: userId, meal_id: meal_id, plan_date: plan_date_str, meal_type: meal_type_str }])
        .select();
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal added to plan!");
      refetchMealPlans(); 
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysMealPlans"] });
      onMealPreSelectedAndPlanned?.(); 
    },
    onError: (error) => {
      console.error("Error directly adding meal to plan:", error);
      showError(`Failed to add meal to plan: ${error.message}`);
    },
  });


  const handleRemoveMeal = (mealPlanId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    removeMealFromPlanMutation.mutate(mealPlanId);
  };

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  useEffect(() => {
    if (isMobile && !isLoadingMealPlans && scrollContainerRef.current && daysOfWeek.length > 0) {
      const todayFormatted = format(todayDate, 'yyyy-MM-dd');
      const todayElement = scrollContainerRef.current.querySelector(`[data-date="${todayFormatted}"]`) as HTMLElement | null;

      if (todayElement) {
        const firstDayOfCurrentWeek = daysOfWeek[0];
        const lastDayOfCurrentWeek = daysOfWeek[6];
        if (todayDate >= firstDayOfCurrentWeek && todayDate <= lastDayOfCurrentWeek) {
          const scrollPosition = todayElement.offsetLeft - scrollContainerRef.current.offsetLeft;
          scrollContainerRef.current.scrollTo({ left: scrollPosition, behavior: 'auto' });
        }
      }
    }
  }, [isMobile, isLoadingMealPlans, daysOfWeek, currentWeekStart, todayDate]);

  const handleAddOrChangeMealClick = (day: Date, mealType?: PlanningMealType) => {
    if (isPast(day) && !isToday(day)) {
      console.log("Cannot plan for a past date (excluding today).");
      return;
    }

    if (preSelectedMealId && preSelectedMealName && mealType && onPreselectedMealSlotClick) { 
      onPreselectedMealSlotClick(day, mealType, preSelectedMealId, preSelectedMealName, preSelectedMealOriginalServings);
    } else { 
      setSelectedDateForDialog(day);
      setSelectedMealTypeForDialog(mealType); 
      setIsDialogOpen(true);
    }
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

  const dailyTotalsByDatePerServing = useMemo(() => {
    if (!userProfile?.track_calories || !mealPlans) return new Map<string, number>();
    const totals = new Map<string, number>();
    daysOfWeek.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const mealsForDay = mealPlansByDateAndType.get(dateKey);
      let dailySum = 0;
      if (mealsForDay) {
        mealsForDay.forEach(plan => {
          const originalTotalCaloriesStr = plan.meals?.estimated_calories;
          const originalServingsStr = plan.meals?.servings;
          
          let caloriesPerOriginalServing = 0;
          if (originalTotalCaloriesStr && originalServingsStr) {
            const originalTotalCaloriesNum = parseFirstNumber(originalTotalCaloriesStr);
            const originalServingsNum = parseFirstNumber(originalServingsStr);
            if (originalTotalCaloriesNum && originalServingsNum && originalServingsNum > 0) {
              caloriesPerOriginalServing = originalTotalCaloriesNum / originalServingsNum;
            }
          }
          dailySum += caloriesPerOriginalServing;
        });
      }
      if (dailySum > 0) {
        totals.set(dateKey, Math.round(dailySum));
      }
    });
    return totals;
  }, [daysOfWeek, mealPlansByDateAndType, userProfile]);

  const isLoading = isLoadingMealPlans || isLoadingProfile;

  if (isLoading) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Weekly Plan</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading meal plans.</p></CardContent></Card>;

  return (
    <>
      <div className="bg-muted p-2 sm:p-4 rounded-lg shadow">
        <div className="overflow-x-auto pb-2" ref={scrollContainerRef}> 
          <div className="flex space-x-2 sm:grid sm:grid-cols-7 sm:gap-2 sm:space-x-0">
            {daysOfWeek.map(day => {
              const isDayPast = isPast(day) && !isToday(day);
              const dateKey = format(day, 'yyyy-MM-dd');
              const mealsForDayMap = mealPlansByDateAndType.get(dateKey);
              const dailyTotal = dailyTotalsByDatePerServing.get(dateKey);

              return (
                <div
                  key={day.toISOString()}
                  data-date={dateKey} 
                  className={cn(
                    "flex-shrink-0 w-[48%] sm:w-auto", 
                    "flex flex-col",                   
                    isDayPast && "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-col items-center p-1 rounded-md mb-1 sm:mb-2",
                      isToday(day) && "bg-primary/10 dark:bg-primary/20"
                    )}
                  >
                    <div className="font-semibold text-foreground text-sm sm:text-base">{format(day, 'EEE')}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{format(day, 'MMM dd')}</div>
                    {userProfile?.track_calories ? (
                      (dailyTotal && dailyTotal > 0) ? (
                        <div className="text-xs text-primary mt-0.5 flex items-center h-[1rem]">
                          <Zap size={10} className="mr-0.5" />
                          {dailyTotal} kcal
                        </div>
                      ) : (
                        <div className="mt-0.5 h-[1rem]">&nbsp;</div> 
                      )
                    ) : (
                      <div className="mt-0.5 h-[1rem]">&nbsp;</div> 
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    {MEAL_TYPE_DISPLAY_ORDER.map(mealType => {
                      const plannedMeal = mealsForDayMap?.get(mealType);
                      
                      const originalTotalCaloriesStr = plannedMeal?.meals?.estimated_calories;
                      const originalServingsStr = plannedMeal?.meals?.servings;
                      const desiredServingsNum = plannedMeal?.desired_servings;

                      let displayServingsStr = "N/A";
                      if (desiredServingsNum && desiredServingsNum > 0) {
                        displayServingsStr = `${desiredServingsNum} serving${desiredServingsNum !== 1 ? 's' : ''}`;
                      } else if (plannedMeal?.meals?.servings) {
                        displayServingsStr = plannedMeal.meals.servings;
                      }
                      
                      let caloriesPerOriginalServing: number | null = null;
                      if (userProfile?.track_calories && originalTotalCaloriesStr && originalServingsStr) {
                        const originalTotalCaloriesNum = parseFirstNumber(originalTotalCaloriesStr);
                        const originalServingsNum = parseFirstNumber(originalServingsStr);
                        if (originalTotalCaloriesNum && originalServingsNum && originalServingsNum > 0) {
                          caloriesPerOriginalServing = Math.round(originalTotalCaloriesNum / originalServingsNum);
                        }
                      }

                      return (
                        <div
                          key={mealType}
                          onClick={() => !isDayPast && handleAddOrChangeMealClick(day, mealType)}
                          className={cn(
                            "border rounded-md p-2 text-xs flex flex-col justify-between overflow-hidden relative transition-colors", 
                            "h-[96px] sm:h-[70px]", 
                            isDayPast ? "bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed" : "bg-card hover:bg-card/80 cursor-pointer",
                            preSelectedMealId && !isDayPast && "ring-2 ring-primary animate-pulse" 
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
                                "text-xs font-semibold self-start flex-grow mt-0.5", 
                                isDayPast ? "line-through text-gray-500 dark:text-gray-500" : "text-foreground",
                                isMobile ? "line-clamp-2" : "truncate" 
                              )}>
                                {plannedMeal.meals?.name || 'Unknown Meal'}
                              </div>
                              
                              {(displayServingsStr !== "N/A" || (userProfile?.track_calories && caloriesPerOriginalServing !== null)) && (
                                <div className={cn(
                                  "text-[9px] mt-auto flex items-center space-x-1 whitespace-nowrap overflow-hidden",
                                  isDayPast ? "text-gray-500 dark:text-gray-500" : "text-muted-foreground"
                                )}>
                                  {displayServingsStr !== "N/A" && (
                                    <span className="flex items-center">
                                      <Users size={9} className="mr-0.5 flex-shrink-0" />
                                      {displayServingsStr} 
                                    </span>
                                  )}
                                  {userProfile?.track_calories && caloriesPerOriginalServing !== null && displayServingsStr !== "N/A" && (
                                    <span>|</span>
                                  )}
                                  {userProfile?.track_calories && caloriesPerOriginalServing !== null && (
                                    <span className={cn("flex items-center", isDayPast ? "text-gray-500 dark:text-gray-500" : "text-primary")}>
                                      <Zap size={9} className="mr-0.5 flex-shrink-0" />
                                      {caloriesPerOriginalServing} kcal/s
                                    </span>
                                  )}
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
                              {!isDayPast && <Plus size={14} className={cn("mt-0.5", preSelectedMealId ? "text-primary" : "text-muted-foreground/50")} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isDialogOpen && (
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
          // No preSelectedMealId here, this is for general planning
        />
      )}
    </>
  );
};

export default WeeklyPlanner;