import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { format, addDays, isSameDay, isToday, isPast, startOfToday, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; // Import PLANNING_MEAL_TYPES

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, XCircle, Plus } from "lucide-react"; // Import Plus icon
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

interface WeeklyPlannerProps {
  userId: string;
  currentWeekStart: Date;
  onWeekNavigate: (direction: "prev" | "next") => void;
}

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ userId, currentWeekStart, onWeekNavigate }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<Date | null>(null);
  const [selectedMealTypeForDialog, setSelectedMealTypeForDialog] = useState<PlanningMealType | undefined>(undefined); // State for meal type when opening dialog

  const queryClient = useQueryClient();
  const today = startOfToday();

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
        queryKey: ["groceryListSource", userId, format(startOfToday(), 'yyyy-MM-dd')] // Invalidate grocery list from today
      });
    },
    onError: (error) => {
      console.error("Error removing meal from plan:", error);
      showError(`Failed to remove meal: ${error.message}`);
    },
  });

  const handleRemoveMeal = (mealPlanId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the slot click handler
    removeMealFromPlanMutation.mutate(mealPlanId);
  };

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Group meal plans by date and then by meal type
  const mealPlansByDateAndType = useMemo(() => {
    const grouped = new Map<string, Map<PlanningMealType, MealPlan>>();
    mealPlans?.forEach(plan => {
      const dateKey = plan.plan_date;
      const mealType = plan.meal_type as PlanningMealType | undefined; // Cast to PlanningMealType
      if (mealType && PLANNING_MEAL_TYPES.includes(mealType)) { // Only include valid planning types
         if (!grouped.has(dateKey)) {
           grouped.set(dateKey, new Map());
         }
         grouped.get(dateKey)?.set(mealType, plan);
      } else if (mealType) {
         console.warn(`Meal plan with unknown type "${mealType}" found for date ${dateKey}. Skipping.`);
      }
    });
    return grouped;
  }, [mealPlans]);

  // Handler to open dialog for a specific day and meal type slot
  const handleSlotClick = (day: Date, mealType: PlanningMealType) => {
    if (isPast(day) && !isToday(day)) {
        console.log("Cannot plan for a past date (excluding today).");
        return;
    }
    setSelectedDateForDialog(day);
    setSelectedMealTypeForDialog(mealType); // Set the meal type for the dialog
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
            <Button variant="default" size="sm" onClick={() => onWeekNavigate("prev")}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
            <h3 className="text-lg font-semibold text-center text-foreground">{format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 6), 'MMM dd, yyyy')}</h3>
            <Button variant="default" size="sm" onClick={() => onWeekNavigate("next")}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
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
            {daysOfWeek.map(day => {
              const isDayPast = isPast(day) && !isToday(day);
              const dateKey = format(day, 'yyyy-MM-dd');
              const mealsForDay = mealPlansByDateAndType.get(dateKey) || new Map(); // Get map for the day

              return (
                <div key={day.toISOString() + "-meals"} className={cn("flex flex-col space-y-2", isDayPast && "opacity-60")}>
                   {/* Render slots for each meal type in the defined order */}
                   {PLANNING_MEAL_TYPES.map(mealType => {
                      const plannedMeal = mealsForDay.get(mealType);
                      const slotKey = `${dateKey}-${mealType}`;

                      return (
                         <div
                           key={slotKey}
                           className={cn(
                             "border rounded-md p-2 text-xs flex flex-col justify-between overflow-hidden relative transition-colors h-16", // Fixed height for slots
                             isDayPast ? "bg-gray-50 dark:bg-gray-800/30" : "bg-card",
                             !isDayPast && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" // Add hover effect for clickable slots
                           )}
                           onClick={() => !isDayPast && handleSlotClick(day, mealType)} // Open dialog on click
                         >
                           <div className={cn(
                             "font-medium self-start text-gray-600 dark:text-gray-400",
                             isDayPast && "text-gray-500 dark:text-gray-500"
                           )}>
                             {mealType} {/* Display meal type */}
                           </div>
                           {plannedMeal ? (
                             <>
                               <div className={cn(
                                 "text-sm font-medium truncate self-start flex-grow mt-1",
                                 isDayPast ? "line-through text-gray-500 dark:text-gray-500" : "text-foreground"
                               )}>
                                 {plannedMeal.meals?.name || 'Unknown Meal'}
                               </div>
                               {!isDayPast && (
                                 <button
                                   onClick={(e) => handleRemoveMeal(plannedMeal.id, e)}
                                   className="absolute top-1 right-1 p-0.5 rounded-full text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                   aria-label={`Remove ${plannedMeal.meals?.name || 'meal'} from ${mealType} on ${format(day, 'MMM dd')}`}
                                 >
                                   <XCircle size={16} />
                                 </button>
                               )}
                             </>
                           ) : (
                             !isDayPast && (
                                <div className="text-xs italic self-start mt-1 flex-grow flex items-center justify-start text-gray-400 dark:text-gray-500">
                                   <Plus className="h-3 w-3 mr-1" /> Add {mealType}
                                </div>
                             )
                           )}
                            {isDayPast && !plannedMeal && (
                                <div className="text-xs italic self-start mt-1 flex-grow flex items-center justify-start text-gray-400 dark:text-gray-600">
                                   {/* Empty past slot */}
                                </div>
                             )}
                         </div>
                      );
                   })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AddMealToPlanDialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
             setSelectedDateForDialog(null); // Clear selected date when dialog closes
             setSelectedMealTypeForDialog(undefined); // Clear selected meal type when dialog closes
          }
        }}
        planDate={selectedDateForDialog}
        initialMealType={selectedMealTypeForDialog} // Pass the selected meal type
        userId={userId}
      />
    </>
  );
  };

export default WeeklyPlanner;