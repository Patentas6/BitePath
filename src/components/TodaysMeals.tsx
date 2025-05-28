import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, isToday, startOfToday, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed, Edit, Zap, Image as ImageIcon, Users } from "lucide-react"; 
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddMealToPlanDialog from "./AddMealToPlanDialog"; 
import { calculateCaloriesPerServing } from '@/utils/mealUtils'; 

interface MealPlan {
  id: string;
  meal_id: string;
  plan_date: string;
  meal_type?: string | null; 
  meals: {
    name: string;
    image_url?: string | null;
    estimated_calories?: string | null; 
    servings?: string | null;
  } | null;
}

interface UserProfileData {
  track_calories?: boolean;
}

interface TodaysMealsProps {
  userId: string;
}

const MEAL_TYPE_DISPLAY_ORDER: PlanningMealType[] = ["Breakfast", "Brunch Snack", "Lunch", "Afternoon Snack", "Dinner"];

const exampleMealsData = [
  { 
    id: 'ex-bf', 
    meal_type: 'Breakfast', 
    meals: { 
      name: 'Example: Yogurt & Granola', 
      image_url: '/Breakfasttest.png', 
      estimated_calories: '350 kcal', 
      servings: '1 serving' 
    } 
  },
  { 
    id: 'ex-ln', 
    meal_type: 'Lunch', 
    meals: { 
      name: 'Example: Salad with Chicken', 
      image_url: '/lunchtest.png',
      estimated_calories: '500 kcal', 
      servings: '1 serving' 
    } 
  },
  { 
    id: 'ex-dn', 
    meal_type: 'Dinner', 
    meals: { 
      name: 'Example: Spaghetti Carbonara', 
      image_url: '/dinnertest.png', 
      estimated_calories: '650 kcal',
      servings: '2-3 servings' 
    } 
  },
];

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
        .select("id, meal_id, plan_date, meal_type, meals ( name, image_url, estimated_calories, servings )")
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
    if (!userProfile?.track_calories || !sortedMealPlans || sortedMealPlans.length === 0) return null;
    return sortedMealPlans.reduce((total, plan) => {
      const caloriesPerServing = calculateCaloriesPerServing(plan.meals?.estimated_calories, plan.meals?.servings);
      return total + (caloriesPerServing || 0);
    }, 0);
  }, [sortedMealPlans, userProfile]);

  const isLoading = isLoadingMealPlans || isLoadingProfile;
  const showExampleData = !isLoading && !error && sortedMealPlans.length === 0;

  const exampleTotalCalories = useMemo(() => {
    if (!userProfile?.track_calories || !showExampleData) return null;
    return exampleMealsData.reduce((total, plan) => {
      const caloriesPerServing = calculateCaloriesPerServing(plan.meals?.estimated_calories, plan.meals?.servings);
      return total + (caloriesPerServing || 0);
    }, 0);
  }, [showExampleData, userProfile]);

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>;
  if (error) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Meals</CardTitle></CardHeader><CardContent><p className="text-red-500 dark:text-red-400">Error loading today's meals.</p></CardContent></Card>;

  const handleChangeMealClick = (planDate: Date, mealType: PlanningMealType | string | null) => {
    setMealToChange({ planDate, mealType });
    setIsChangeMealDialogOpen(true);
  };
  
  const displayPlans = showExampleData ? exampleMealsData : sortedMealPlans;
  const currentTotalCalories = showExampleData ? exampleTotalCalories : dailyTotalCaloriesPerServing;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Today's Meals ({format(today, 'MMM dd')})</CardTitle>
            {userProfile?.track_calories && currentTotalCalories !== null && currentTotalCalories > 0 && (
              <div className="text-sm font-semibold text-primary flex items-center">
                <Zap size={16} className="mr-1.5" />
                Total Est: {currentTotalCalories} kcal (per serving)
              </div>
            )}
          </div>
          {showExampleData && (
            <p className="text-sm text-muted-foreground mt-1">
              Plan meals in <Link to="/planning" className="underline hover:text-foreground">Plan & Shop</Link> to see them here. Here's an example:
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-grow">
          {displayPlans.length === 0 && !showExampleData ? ( 
            <div className="text-center py-6 text-muted-foreground">
              <UtensilsCrossed className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold mb-1">No Meals Planned</p>
              <p className="text-sm">Plan some meals for today in the <Link to="/planning" className="underline hover:text-foreground">Plan & Shop</Link> page.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {displayPlans.map(plannedMeal => {
                const caloriesPerServing = calculateCaloriesPerServing(plannedMeal.meals?.estimated_calories, plannedMeal.meals?.servings);
                return (
                  <li 
                    key={plannedMeal.id} 
                    className={cn(
                      "border rounded-md p-3 bg-card shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center", 
                      showExampleData && "opacity-80 border-dashed"
                    )}
                  >
                     {plannedMeal.meals?.image_url ? (
                      <div
                        className="w-full h-40 sm:w-24 sm:h-24 object-cover rounded-md mb-2 sm:mb-0 sm:mr-3 flex-shrink-0 cursor-pointer flex items-center justify-center overflow-hidden bg-muted" 
                        onClick={() => !showExampleData && plannedMeal.meals?.image_url && setViewingImageUrl(plannedMeal.meals.image_url)}
                      >
                        <img
                          src={plannedMeal.meals.image_url}
                          alt={plannedMeal.meals.name || 'Meal image'}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const iconContainer = document.createElement('div');
                              iconContainer.className = "w-full h-40 sm:w-24 sm:h-24 rounded-md flex-shrink-0 flex items-center justify-center bg-muted text-muted-foreground";
                              iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'; // ImageIcon
                              parent.appendChild(iconContainer);
                            }
                          }}
                        />
                      </div>
                     ) : (
                       <div className="w-full h-40 sm:w-24 sm:h-24 rounded-md mb-2 sm:mb-0 sm:mr-3 flex-shrink-0 flex items-center justify-center bg-muted text-muted-foreground">
                         <ImageIcon size={32} />
                       </div>
                     )}
                     <div className="flex-grow w-full sm:w-auto">
                       <div className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                         {plannedMeal.meal_type || 'Meal'}
                       </div>
                       <div className="text-base font-semibold text-foreground mt-1">
                         {plannedMeal.meals?.name || 'Unknown Meal'}
                       </div>
                       {plannedMeal.meals?.servings && (
                         <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
                           <Users size={12} className="mr-1" />
                           Servings: {plannedMeal.meals.servings}
                         </div>
                       )}
                       {userProfile?.track_calories && caloriesPerServing !== null && (
                         <div className="text-xs text-primary mt-0.5 flex items-center">
                           <Zap size={12} className="mr-1" />
                           Est. {caloriesPerServing} kcal per serving
                         </div>
                       )}
                     </div>
                     {!showExampleData && (
                       <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleChangeMealClick(parseISO((plannedMeal as MealPlan).plan_date), plannedMeal.meal_type)}
                          className="mt-2 sm:mt-0 sm:ml-auto self-end sm:self-center px-2 sm:px-3"
                        >
                         <Edit className="h-4 w-4 sm:mr-2" />
                         <span className="hidden sm:inline">Change</span>
                       </Button>
                     )}
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
        <DialogContent 
          className="max-w-screen-md w-[90vw] h-[90vh] p-0 flex items-center justify-center bg-transparent border-none"
          onClick={() => setViewingImageUrl(null)}
        >
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged meal image"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()} // Optional: if you want clicking image itself to NOT close
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TodaysMeals;