import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'; // Added useLocation
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Image as ImageIcon, Users, Zap, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { calculateCaloriesPerServing, parseFirstNumber } from '@/utils/mealUtils';

interface Meal {
  id: string;
  name: string;
  ingredients: string | null;
  instructions: string | null;
  image_url: string | null;
  meal_tags: string[] | null;
  estimated_calories?: string | null;
  servings?: string | null;
}

interface ParsedIngredient {
  name: string;
  quantity: number | string | null;
  unit: string | null;
  description?: string;
}

interface UserProfileData {
  track_calories?: boolean;
}

const MealDetailPage = () => {
  const { mealId } = useParams<{ mealId: string }>();
  const navigate = useNavigate();
  const location = useLocation(); // Get location object
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<string | null>(null);

  const desiredServingsFromState = location.state?.desiredServings as number | undefined;

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<UserProfileData | null>({
    queryKey: ['userProfileForMealDetail', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('track_calories')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile for Meal Detail:", error);
        return { track_calories: false }; 
      }
      return data || { track_calories: false };
    },
    enabled: !!userId,
  });

  const { data: meal, isLoading, error } = useQuery<Meal | null>({
    queryKey: ['mealDetail', mealId],
    queryFn: async () => {
      if (!mealId) return null;
      const { data, error } = await supabase
        .from('meals')
        .select('id, name, ingredients, instructions, image_url, meal_tags, estimated_calories, servings')
        .eq('id', mealId)
        .single();
      if (error) {
        console.error('Error fetching meal details:', error);
        throw error;
      }
      return data;
    },
    enabled: !!mealId,
  });

  const scaledAndParsedIngredients = useMemo(() => {
    if (!meal?.ingredients) return [];
    try {
      const parsed = JSON.parse(meal.ingredients) as ParsedIngredient[];
      const ingredientsToDisplay = parsed.filter(ing => ing.name && ing.name.trim() !== '');

      if (desiredServingsFromState && meal.servings) {
        const originalServingsNum = parseFirstNumber(meal.servings);
        if (originalServingsNum && originalServingsNum > 0 && desiredServingsFromState > 0 && desiredServingsFromState !== originalServingsNum) {
          const scalingFactor = desiredServingsFromState / originalServingsNum;
          return ingredientsToDisplay.map(ing => {
            let scaledQuantity: number | string | null = ing.quantity;
            if (typeof ing.quantity === 'number') {
              scaledQuantity = parseFloat((ing.quantity * scalingFactor).toFixed(2));
            } else if (typeof ing.quantity === 'string') {
              const numQuantity = parseFloat(ing.quantity);
              if (!isNaN(numQuantity)) {
                scaledQuantity = parseFloat((numQuantity * scalingFactor).toFixed(2));
              }
            }
            // Ensure "to taste" or null quantities are not scaled numerically
            if (ing.description?.toLowerCase() === 'to taste' || ing.quantity === null) {
                scaledQuantity = ing.quantity; 
            }
            return { ...ing, quantity: scaledQuantity };
          });
        }
      }
      return ingredientsToDisplay;
    } catch (e) {
      console.error('Failed to parse or scale ingredients:', e);
      return [];
    }
  }, [meal?.ingredients, meal?.servings, desiredServingsFromState]);

  const displayServingsStr = useMemo(() => {
    if (desiredServingsFromState && desiredServingsFromState > 0) {
      return `${desiredServingsFromState} serving${desiredServingsFromState !== 1 ? 's' : ''}`;
    }
    return meal?.servings || "N/A";
  }, [desiredServingsFromState, meal?.servings]);

  const caloriesPerDisplayServing = useMemo(() => {
    if (meal && userProfile?.track_calories) {
      // Use desiredServingsFromState for calculation if available, otherwise meal's original servings
      const servingsForCalc = desiredServingsFromState && desiredServingsFromState > 0 
        ? desiredServingsFromState.toString() 
        : meal.servings;
      return calculateCaloriesPerServing(meal.estimated_calories, servingsForCalc);
    }
    return null;
  }, [meal, userProfile, desiredServingsFromState]);


  if (isLoading || isLoadingProfile) {
    return (
      <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
        <AppHeader />
        <div className={cn("space-y-6", !isMobile && "container mx-auto")}>
          <Button variant="outline" size="sm" className="mb-4" disabled><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-48 w-full sm:h-64 md:h-80 rounded-md" />
              <div>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !meal) {
    return (
      <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
        <AppHeader />
        <div className={cn("space-y-6 text-center", !isMobile && "container mx-auto")}>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <p className="text-xl text-destructive">
            {error ? 'Error loading meal details.' : 'Meal not found.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background text-foreground", isMobile ? "pt-4 pb-20 px-2" : "p-4")}>
      <AppHeader />
      <div className={cn("space-y-6", !isMobile && "container mx-auto")}>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">{meal.name}</CardTitle>
            {meal.meal_tags && meal.meal_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {meal.meal_tags.map(tag => (
                  <Badge key={tag} variant="secondary"><Tag className="mr-1 h-3 w-3" />{tag}</Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {meal.image_url ? (
              <div className="w-full h-48 sm:h-64 md:h-80 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                <img src={meal.image_url} alt={meal.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-full h-48 sm:h-64 md:h-80 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                <ImageIcon size={48} />
              </div>
            )}

            {(displayServingsStr !== "N/A" || (userProfile?.track_calories && caloriesPerDisplayServing !== null)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 border rounded-md bg-muted/50">
                {displayServingsStr !== "N/A" && (
                  <div className="flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Servings</p>
                      <p className="text-base font-semibold">{displayServingsStr}</p>
                    </div>
                  </div>
                )}
                {userProfile?.track_calories && caloriesPerDisplayServing !== null && (
                   <div className="flex items-center">
                    <Zap className="mr-2 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Est. Calories</p>
                      <p className="text-base font-semibold">{caloriesPerDisplayServing} per serving</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {scaledAndParsedIngredients.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-2">Ingredients</h3>
                <ul className="list-disc list-inside space-y-1 pl-4 text-muted-foreground">
                  {scaledAndParsedIngredients.map((ing, index) => (
                    <li key={index}>
                      {typeof ing.quantity === 'number' && ing.unit && ing.description?.toLowerCase() !== 'to taste' ? `${ing.quantity} ${ing.unit} ` : ''}
                      {typeof ing.quantity === 'string' && ing.quantity.trim() !== "" && ing.unit && ing.description?.toLowerCase() !== 'to taste' ? `${ing.quantity} ${ing.unit} ` : ''}
                      {ing.name}
                      {ing.description ? ` (${ing.description})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meal.instructions && (
              <div>
                <h3 className="text-xl font-semibold mb-2">Instructions</h3>
                <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{meal.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MealDetailPage;