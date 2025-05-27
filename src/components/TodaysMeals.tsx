import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, isToday, startOfToday, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, Edit, Zap } from "lucide-react"; 
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddMealToPlanDialog from "./AddMealToPlanDialog"; 
import { calculateCaloriesPerServing } from '@/utils/mealUtils'; // Import new util

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string | null; 
  meals: {
    name: string;
    image_url?: string | null;
    estimated_calories?: string | null; 
    servings?: string | null; // Added servings
  } | null;
}

interface UserProfileData {
  track_calories?: boolean;
}

interface TodaysMealsProps {
  userId: string;
}

const MEAL_TYPE_DISPLAY_ORDER: PlanningMealType[] = ["Breakfast", "Brunch Snack", "Lunch", "Afternoon Snack", "Dinner"];

const TodaysMeals: React.FC<TodaysMealsProps> = ({ userId }) => {
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [isChangeMealDialogOpen, setIsChangeMealDialogOpen] = useState(false);
  const [mealToChange, setMealToChange] = useState<{ planDate: Date; mealType: PlanningMealType | string | null } | null>(null);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfileData | null>({
    queryKey: ['userProfileForTodaysMeals', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('track_calories')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile for Today's Meals:", error);
        return { track_calories: false }; 
      }
      return data || { track_calories: false };
    },
    enabled: !!userId,
  });

  const { data: mealPlans, isLoading: isLoadingMealPlans, error } = useQuery<MealPlan[]>({
    queryKey: ["todaysMealPlans", userId, todayStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, meal_id, plan_date, meal_type, meals ( name, image_url, estimated_calories, servings )") // Fetch servings
        .eq("user_id", userId)
        .eq("plan_date", todayStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const sortedMealPlans = useMemo(() => {
    if (!mealPlans) return [];
    return [...mealPlans].sort((a, b) => {
      const aIndex = MEAL_TYPE_DISPLAY_ORDER.indexOf(a.meal_type as PlanningMealType);
      const bIndex = MEAL_TYPE_DISPLAY_ORDER.indexOf(b.meal_type as PlanningMealType);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [mealPlans]);

  const dailyTotalCaloriesPerServing = useMemo(() => {
    if (!userProfile?.track_calories || !sortedMealPlans) return null;
    return sortedMealPlans.reduce((total, plan) => {
      const caloriesPerServing = calculateCaloriesPerServing(plan.meals?.estimated_calories, plan.meals?.servings);
      return total + (caloriesPerServing || 0);
    }, 0);
  }, [sortedMealPlans, userProfile]);

  const handleChangeMealClick = (planDate: Date, mealType: PlanningMealType | string | null) => {
    setMealToChange({ planDate, mealType });
    setIsChangeMealDialogOpen(true);
  };

  const isLoading = isLoadingMealPlans || isLoadingProfile;

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>;
  if (error) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading today's meals.</p></CardContent></Card>;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Today's Meals ({format(today, 'MMM dd')})</CardTitle>
            {userProfile?.track_calories && dailyTotalCaloriesPerServing !== null && dailyTotalCaloriesPerServing > 0 && (
              <div className="text-sm font-semibold text-primary flex items-center">
                <Zap size={16} className="mr-1.5" />
                Total Est: {dailyTotalCaloriesPerServing} kcal (per serving)
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          {sortedMealPlans.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <UtensilsCrossed className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold mb-1">No Meals Planned</p>
              <p className="text-sm">Plan some meals for today in the <Link to="/planning" className="underline hover:text-foreground">Plan & Shop</Link> page.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedMealPlans.map(plannedMeal => {
                const caloriesPerServing = calculateCaloriesPerServing(plannedMeal.meals?.estimated_calories, plannedMeal.meals?.servings);
                return (
                  <li key={plannedMeal.id} className="border rounded-md p-3 bg-card shadow-sm flex items-center space-x-3">
                     {plannedMeal.meals?.image_url && (
                      <div
                        className="h-24 w-24 object-cover rounded-md flex-shrink-0 cursor-pointer flex items-center justify-center overflow-hidden bg-muted" 
                        onClick={() => setViewingImageUrl(plannedMeal.meals?.image_url || null)}
                      >
                        <img
                          src={plannedMeal.meals.image_url}
                          alt={plannedMeal.meals.name || 'Meal image'}
                          className="h-full w-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                     )}
                     <div className="flex-grow">
                       <div className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                         {plannedMeal.meal_type || 'Meal'}
                       </div>
                       <div className="text-base font-semibold text-foreground mt-1">
                         {plannedMeal.meals?.name || 'Unknown Meal'}
                       </div>
                       {userProfile?.track_calories && caloriesPerServing !== null && (
                         <div className="text-xs text-primary mt-0.5 flex items-center">
                           <Zap size={12} className="mr-1" />
                           Est. {caloriesPerServing} kcal per serving
                         </div>
                       )}
                     </div>
                     <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleChangeMealClick(parseISO(plannedMeal.plan_date), plannedMeal.meal_type)}
                        className="ml-auto"
                      >
                       <Edit className="h-4 w-4 mr-2" /> Change
                     </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {mealToChange && (
        <AddMealToPlanDialog
          open={isChangeMealDialogOpen}
          onOpenChange={(isOpen) => {
            setIsChangeMealDialogOpen(isOpen);
            if (!isOpen) setMealToChange(null);
          }}
          planDate={mealToChange.planDate}
          userId={userId}
          initialMealType={mealToChange.mealType}
        />
      )}

      <Dialog open={!!viewingImageUrl} onOpenChange={(open) => !open && setViewingImageUrl(null)}>
        <DialogContent className="max-w-screen-md w-[90vw] h-[90vh] p-0 flex items-center justify-center bg-transparent border-none">
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged meal image"
              className="max-w-full max-h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TodaysMeals;