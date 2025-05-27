import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Save, RefreshCw, Info, Image as ImageIcon, Edit2, Zap, Users } from 'lucide-react'; // Added Users for servings
import AppHeader from "@/components/AppHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format as formatDateFns, differenceInCalendarDays, addDays, parse as parseDateFns } from "date-fns"; 
import { IMAGE_GENERATION_LIMIT_PER_MONTH, RECIPE_GENERATION_LIMIT_PER_PERIOD, RECIPE_GENERATION_PERIOD_DAYS } from '@/lib/constants';

interface GeneratedIngredient {
  name: string;
  quantity: number | string; 
  unit: string;
  description?: string;
}

interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[];
  instructions: string;
  meal_tags: string[];
  image_url?: string;
  estimated_calories?: string;
  servings?: string; // Added servings
}

interface UserProfileData {
  is_admin: boolean;
  image_generation_count: number;
  last_image_generation_reset: string | null; // YYYY-MM
  recipe_generation_count: number | null;
  last_recipe_generation_reset: string | null; // YYYY-MM-DD
  track_calories?: boolean; 
}

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealKinds = ["High Protein", "Vegan", "Vegetarian", "Gluten-Free", "Low Carb", "Kid-Friendly", "Spicy"];
const mealStyles = ["Simple", "Fast (under 30 min)", "1 Pan", "Chef Inspired", "Comfort Food", "Healthy"];

const PREFERENCES_MAX_LENGTH = 300;
const REFINEMENT_MAX_LENGTH = 200;

interface ImageGenerationStatus {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

interface RecipeGenerationStatus {
  generationsUsedThisPeriod: number;
  limitReached: boolean;
  daysRemainingInPeriod: number;
  periodResetsToday: boolean;
  isAdmin: boolean;
}

const GenerateMealPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recipeCardRef = useRef<HTMLDivElement>(null); 
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [ingredientPreferences, setIngredientPreferences] = useState('');
  const [refinementPrompt, setRefinementPrompt] = useState('');

  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: userProfile, isLoading: isLoadingProfile, refetch: refetchUserProfile } = useQuery<UserProfileData | null>({
    queryKey: ['userProfileForGenerationLimits', userId], 
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, image_generation_count, last_image_generation_reset, recipe_generation_count, last_recipe_generation_reset, track_calories') 
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
  });

  const imageGenerationStatus = useMemo((): ImageGenerationStatus => {
    if (!userProfile) return { generationsUsedThisMonth: 0, limitReached: true, isAdmin: false };
    if (userProfile.is_admin) return { generationsUsedThisMonth: 0, limitReached: false, isAdmin: true };

    const currentMonthYear = formatDateFns(new Date(), "yyyy-MM");
    let generationsUsedThisMonth = userProfile.image_generation_count || 0;

    if (userProfile.last_image_generation_reset !== currentMonthYear) {
      generationsUsedThisMonth = 0;
    }
    
    return { 
      generationsUsedThisMonth,
      limitReached: generationsUsedThisMonth >= IMAGE_GENERATION_LIMIT_PER_MONTH,
      isAdmin: userProfile.is_admin
    };
  }, [userProfile]);

  const recipeGenerationStatus = useMemo((): RecipeGenerationStatus => {
    const defaultStatus = { 
      generationsUsedThisPeriod: 0, 
      limitReached: true, 
      daysRemainingInPeriod: RECIPE_GENERATION_PERIOD_DAYS, 
      periodResetsToday: false,
      isAdmin: false 
    };

    if (!userProfile) return defaultStatus;
    if (userProfile.is_admin) {
      return { ...defaultStatus, limitReached: false, isAdmin: true };
    }

    const today = new Date();
    let currentCount = userProfile.recipe_generation_count || 0;
    let daysRemaining = RECIPE_GENERATION_PERIOD_DAYS;
    let periodResetsToday = false;

    if (userProfile.last_recipe_generation_reset) {
      try {
        const lastResetDate = parseDateFns(userProfile.last_recipe_generation_reset, "yyyy-MM-dd", new Date());
        const daysSinceLastReset = differenceInCalendarDays(today, lastResetDate);

        if (daysSinceLastReset >= RECIPE_GENERATION_PERIOD_DAYS) {
          currentCount = 0; 
          periodResetsToday = true;
          daysRemaining = RECIPE_GENERATION_PERIOD_DAYS;
        } else {
          daysRemaining = RECIPE_GENERATION_PERIOD_DAYS - daysSinceLastReset;
        }
      } catch (e) {
        console.warn("Could not parse last_recipe_generation_reset date:", userProfile.last_recipe_generation_reset);
        currentCount = 0; 
        periodResetsToday = true;
      }
    } else {
      currentCount = 0;
      periodResetsToday = true;
    }
    
    return { 
      generationsUsedThisPeriod: currentCount,
      limitReached: currentCount >= RECIPE_GENERATION_LIMIT_PER_PERIOD,
      daysRemainingInPeriod: daysRemaining,
      periodResetsToday: periodResetsToday,
      isAdmin: userProfile.is_admin
    };
  }, [userProfile]);


  const handleKindChange = (kind: string, checked: boolean) => {
    setSelectedKinds(prev =>
      checked ? [...prev, kind] : prev.filter(k => k !== kind)
    );
  };

  const handleStyleChange = (style: string, checked: boolean) => {
    setSelectedStyles(prev =>
      checked ? [...prev, style] : prev.filter(s => s !== style)
    );
  };

  const recipeGenerationMutation = useMutation({
    mutationFn: async (params: { isRefinement: boolean; currentMeal?: GeneratedMeal | null; refinementText?: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!params.isRefinement && !selectedMealType) {
        showError("Please select a meal type for initial generation.");
        return null;
      }
      if (params.isRefinement && (!params.currentMeal || !params.refinementText)) {
        showError("Cannot refine without a current meal and refinement instructions.");
        return null;
      }

      setIsGeneratingRecipe(true);
      const loadingToastId = showLoading(params.isRefinement ? "Refining recipe..." : "Generating recipe...");
      
      const bodyPayload: any = {
        mealType: selectedMealType,
        kinds: selectedKinds,
        styles: selectedStyles,
        preferences: ingredientPreferences,
      };

      if (params.isRefinement && params.currentMeal && params.refinementText) {
        bodyPayload.existingRecipeText = params.currentMeal;
        bodyPayload.refinementInstructions = params.refinementText;
      }

      try {
        const { data, error: functionError } = await supabase.functions.invoke('generate-meal', { body: bodyPayload });
        dismissToast(loadingToastId);

        if (functionError) {
            if (functionError.message.includes("Functions_Relay_Error") && functionError.message.includes("429")) {
                 showError(`You've reached your recipe generation limit for the current period. Please try again later.`);
            } else {
                 showError(`Recipe generation failed: ${functionError.message}`);
            }
            refetchUserProfile(); 
            return null;
        }
        if (data?.error) { 
            showError(data.error); 
            refetchUserProfile();
            return null; 
        }
        setGeneratedMeal({ ...data, image_url: generatedMeal?.image_url }); 
        setRefinementPrompt(''); 
        showSuccess(params.isRefinement ? "Recipe refined!" : "Recipe generated!");
        refetchUserProfile(); 
        return data;
      } catch (error: any) { 
        dismissToast(loadingToastId);
        console.error('Error in recipe generation/refinement:', error);
        showError(`Failed to ${params.isRefinement ? 'refine' : 'generate'} recipe: ${error.message || 'Please try again.'}`);
        throw error;
      } finally {
        setIsGeneratingRecipe(false);
      }
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async (mealToGetImageFor: GeneratedMeal) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!mealToGetImageFor) throw new Error("No meal data to generate image for.");

      if (!imageGenerationStatus.isAdmin && imageGenerationStatus.limitReached) {
        showError(`You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`);
        return null;
      }
      setIsGeneratingImage(true);
      const loadingToastId = showLoading("Generating image...");
      try {
        const { data, error: functionError } = await supabase.functions.invoke('generate-meal', {
          body: { mealData: mealToGetImageFor }, 
        });
        dismissToast(loadingToastId);
        if (functionError) {
             if (functionError.message.includes("Functions_Relay_Error") && functionError.message.includes("429")) {
                 showError(`Image generation limit reached. This was also caught by the server.`);
             } else {
                 showError(`Image generation failed: ${functionError.message}`);
             }
             refetchUserProfile(); 
             return null;
        }
        if (data?.error) { 
            showError(data.error); 
            if (data.mealData) setGeneratedMeal(prev => ({...prev!, ...data.mealData}));
            refetchUserProfile(); 
            return null;
        }
        if (data?.image_url) {
          setGeneratedMeal(prev => prev ? { ...prev, image_url: data.image_url } : null);
          showSuccess("Image generated!");
          setTimeout(() => { 
            recipeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        } else {
          showError("Image generation did not return an image URL.");
        }
        refetchUserProfile(); 
        return data;
      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error generating image:', error);
        showError(`Failed to generate image: ${error.message || 'Please try again.'}`);
        throw error;
      } finally {
        setIsGeneratingImage(false);
      }
    }
  });

  const saveMealMutation = useMutation({
    mutationFn: async (mealToSave: GeneratedMeal) => {
      if (!userId) throw new Error("User not authenticated.");
      const ingredientsJSON = mealToSave.ingredients ? JSON.stringify(mealToSave.ingredients) : null;
      const { data, error } = await supabase
        .from("meals")
        .insert([{
            user_id: userId,
            name: mealToSave.name,
            ingredients: ingredientsJSON,
            instructions: mealToSave.instructions,
            meal_tags: mealToSave.meal_tags,
            image_url: mealToSave.image_url,
            estimated_calories: mealToSave.estimated_calories,
            servings: mealToSave.servings, // Save servings
          },])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      showSuccess(`"${vars.name}" saved to My Meals!`);
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setGeneratedMeal(null); 
      setRefinementPrompt('');
    },
    onError: (error: any, vars) => {
      console.error("Error saving meal:", error);
      showError(`Failed to save meal "${vars.name}": ${error.message || 'Please try again.'}`);
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const handleSaveMeal = () => {
    if (generatedMeal) {
      setIsSaving(true);
      saveMealMutation.mutate(generatedMeal);
    }
  };

  const handleGenerateNewRecipeRequest = () => { 
    setGeneratedMeal(null); 
    setRefinementPrompt('');
  };

  const handleInitialGenerateRecipeClick = async () => {
     const { data: authData } = await supabase.auth.getUser();
     if (!authData.user) { showError("You must be logged in to generate meals."); navigate("/auth"); return; }
     recipeGenerationMutation.mutate({ isRefinement: false });
  };
  
  const handleRefineRecipeClick = async () => {
    if (!generatedMeal || !refinementPrompt.trim()) {
      showError("Please provide refinement instructions.");
      return;
    }
    recipeGenerationMutation.mutate({ isRefinement: true, currentMeal: generatedMeal, refinementText: refinementPrompt });
  };

  const handleGenerateImageClick = () => {
    if (generatedMeal) {
      generateImageMutation.mutate(generatedMeal);
    }
  };

  const getRecipeLimitText = () => {
    if (isLoadingProfile) return "Loading recipe generation limits...";
    if (recipeGenerationStatus.isAdmin) return "Admin: Recipe generation limits bypassed.";
    
    let resetText = "";
    if (recipeGenerationStatus.periodResetsToday && recipeGenerationStatus.generationsUsedThisPeriod === 0) {
      resetText = `New period started. Resets in ${RECIPE_GENERATION_PERIOD_DAYS} days.`;
    } else if (recipeGenerationStatus.daysRemainingInPeriod === RECIPE_GENERATION_PERIOD_DAYS && recipeGenerationStatus.generationsUsedThisPeriod > 0) {
      resetText = `Resets in ${recipeGenerationStatus.daysRemainingInPeriod} days.`;
    } 
    else {
      resetText = `Resets in ${recipeGenerationStatus.daysRemainingInPeriod} day${recipeGenerationStatus.daysRemainingInPeriod !== 1 ? 's' : ''}.`;
    }
    return `Recipe Generations Used: ${recipeGenerationStatus.generationsUsedThisPeriod} / ${RECIPE_GENERATION_LIMIT_PER_PERIOD}. ${resetText}`;
  };


  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <AppHeader />
        <div className="flex justify-center items-center mb-0">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center"><Brain className="mr-2 h-6 w-6" /> Generate Meal with AI</h1>
        </div>

        {!generatedMeal && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us what you're craving!</CardTitle>
              <CardDescription>Select your preferences and let AI suggest a meal recipe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base">What meal type do you want?</Label>
                <RadioGroup onValueChange={setSelectedMealType} value={selectedMealType} className="flex flex-wrap gap-4 mt-2">
                  {mealTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <RadioGroupItem value={type} id={`meal-type-${type.toLowerCase()}`} />
                      <Label htmlFor={`meal-type-${type.toLowerCase()}`}>{type}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="text-base">What kind of meal?</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {mealKinds.map(kind => (
                    <div key={kind} className="flex items-center space-x-2">
                      <Checkbox
                        id={`meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}
                        checked={selectedKinds.includes(kind)}
                        onCheckedChange={(checked) => handleKindChange(kind, checked as boolean)}
                      />
                      <Label htmlFor={`meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}>{kind}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base">What style of meal?</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {mealStyles.map(style => (
                    <div key={style} className="flex items-center space-x-2">
                      <Checkbox
                        id={`meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}
                        checked={selectedStyles.includes(style)}
                        onCheckedChange={(checked) => handleStyleChange(style, checked as boolean)}
                      />
                      <Label htmlFor={`meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}>{style}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="ingredient-preferences" className="text-base font-semibold">
                  Tell the AI about your meal vision (Optional)
                </Label>
                <Textarea
                  id="ingredient-preferences"
                  placeholder="e.g., 'Use only: chicken, broccoli, rice', 'Max 500 cals', 'No nuts'"
                  value={ingredientPreferences}
                  onChange={(e) => setIngredientPreferences(e.target.value)}
                  className="mt-2"
                  maxLength={PREFERENCES_MAX_LENGTH}
                />
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded-md">
                  <Info size={14} className="inline mr-1.5 relative -top-px flex-shrink-0" />
                  <strong>Pro Tip:</strong> List ingredients you have at home (e.g., "use only: ground beef, onions"), and the AI will try to create a recipe using just those. You can also set goals like "under 600 calories".
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {ingredientPreferences.length}/{PREFERENCES_MAX_LENGTH} characters
                </p>
              </div>
              <Button
                onClick={handleInitialGenerateRecipeClick}
                disabled={!selectedMealType || isGeneratingRecipe || recipeGenerationMutation.isPending || (!isLoadingProfile && !recipeGenerationStatus.isAdmin && recipeGenerationStatus.limitReached)}
                className="w-full"
              >
                {isGeneratingRecipe || recipeGenerationMutation.isPending ? 'Generating Recipe...' : 'Generate Recipe'}
              </Button>
              <div className="text-xs text-muted-foreground text-center pt-2">
                <Info size={14} className="inline mr-1 flex-shrink-0" />
                 {getRecipeLimitText()}
              </div>
            </CardContent>
          </Card>
        )}

        {generatedMeal && (
          <Card ref={recipeCardRef}> 
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-grow">
                  <CardTitle>{generatedMeal.name}</CardTitle>
                  <CardDescription>
                    {generatedMeal.image_url ? "Generated Recipe & Image" : "Generated Recipe Text"}
                  </CardDescription>
                  <div className="mt-1 space-y-0.5">
                    {generatedMeal.servings && (
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Users size={14} className="mr-1.5 text-primary" />
                        Servings: {generatedMeal.servings}
                      </div>
                    )}
                    {generatedMeal.estimated_calories && userProfile?.track_calories && (
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Zap size={14} className="mr-1.5 text-primary" />
                        Estimated Calories: {generatedMeal.estimated_calories}
                      </div>
                    )}
                  </div>
                </div>
                {generatedMeal.image_url && (
                  <div
                    className="cursor-pointer w-auto h-72 flex-shrink-0 rounded-md bg-muted"
                    onClick={() => setViewingImageUrl(generatedMeal.image_url || null)}
                  >
                    <img
                      src={generatedMeal.image_url}
                      alt={`Image of ${generatedMeal.name}`}
                      className="h-full object-contain rounded-md"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Ingredients:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {generatedMeal.ingredients.map((ing, index) => (
                    <li key={index} className="text-muted-foreground">
                      {typeof ing.quantity === 'number' ? ing.quantity : `"${ing.quantity}"`} {ing.unit} {ing.name} {ing.description && `(${ing.description})`}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Instructions:</h3>
                <p className="text-muted-foreground whitespace-pre-line">{generatedMeal.instructions}</p>
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="refinement-prompt" className="text-base">Want to change something?</Label>
                <Textarea
                  id="refinement-prompt"
                  placeholder="e.g., 'Replace chicken with tofu', 'Make it spicier', 'Add mushrooms'"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  className="mt-2"
                  maxLength={REFINEMENT_MAX_LENGTH}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {refinementPrompt.length}/{REFINEMENT_MAX_LENGTH} characters
                </p>
                <Button
                  onClick={handleRefineRecipeClick}
                  disabled={!refinementPrompt.trim() || isGeneratingRecipe || recipeGenerationMutation.isPending || (!isLoadingProfile && !recipeGenerationStatus.isAdmin && recipeGenerationStatus.limitReached && recipeGenerationStatus.generationsUsedThisPeriod >= RECIPE_GENERATION_LIMIT_PER_PERIOD) }
                  className="w-full mt-2"
                  variant="outline" 
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {isGeneratingRecipe && recipeGenerationMutation.isLoading && recipeGenerationMutation.variables?.isRefinement ? 'Refining...' : 'Refine Recipe'}
                </Button>
                 <div className="text-xs text-muted-foreground text-center pt-2">
                    <Info size={14} className="inline mr-1 flex-shrink-0" />
                    {getRecipeLimitText()}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={handleGenerateImageClick}
                  disabled={isGeneratingImage || generateImageMutation.isPending || isLoadingProfile || (!imageGenerationStatus.isAdmin && imageGenerationStatus.limitReached)}
                  className="w-full mb-2"
                  variant="secondary" 
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {isGeneratingImage || generateImageMutation.isPending ? 'Generating Image...' : 'Generate Image for this Meal'}
                </Button>
                {!isLoadingProfile && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground">
                    <Info size={14} className="mr-1 flex-shrink-0 text-primary" />
                    {imageGenerationStatus.isAdmin 
                      ? "Admin account: Image generation limits bypassed."
                      : `Image Generations Used This Month: ${imageGenerationStatus.generationsUsedThisMonth} / ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`}
                  </div>
                )}
              </div>

              <div className="flex space-x-4 mt-6">
                <Button
                  onClick={handleSaveMeal}
                  disabled={isSaving || saveMealMutation.isPending}
                  className="flex-grow"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving || saveMealMutation.isPending ? 'Saving...' : 'Save to My Meals'}
                </Button>
                <Button
                  onClick={handleGenerateNewRecipeRequest}
                  variant="outline"
                  disabled={isGeneratingRecipe || recipeGenerationMutation.isPending || isSaving || saveMealMutation.isPending || isGeneratingImage || generateImageMutation.isPending}
                  className="flex-grow"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate New Recipe
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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
    </div>
  );
};

export default GenerateMealPage;