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
import { Brain, Save, RefreshCw, Info, Image as ImageIcon, Edit2, Zap, Users } from 'lucide-react'; 
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IMAGE_GENERATION_LIMIT_PER_MONTH, RECIPE_GENERATION_LIMIT_PER_PERIOD, RECIPE_GENERATION_PERIOD_DAYS } from '@/lib/constants';
import { calculateCaloriesPerServing } from '@/utils/mealUtils';
import type { CombinedGenerationLimits } from '@/pages/ManageMealEntryPage';

interface GeneratedIngredient {
  name: string;
  quantity: number | string; 
  unit: string;
  description?: string;
}

export interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[];
  instructions: string;
  meal_tags: string[];
  image_url?: string;
  estimated_calories?: string;
  servings?: string; 
}

interface UserProfileDataForAI { 
  ai_preferences?: string | null;
  track_calories?: boolean;
}

// Define types for GenerateMealFlow state to be lifted (matches ManageMealEntryPage)
interface GenerateMealSelections {
  selectedMealType: string | undefined;
  selectedKinds: string[];
  selectedStyles: string[];
  ingredientPreferences: string;
  refinementPrompt: string;
}

interface GenerateMealFlowProps {
  recipeGenerationStatus: CombinedGenerationLimits['recipe'];
  imageGenerationStatus: CombinedGenerationLimits['image'];
  isLoadingProfile: boolean;
  userProfile: UserProfileDataForAI | null;
  onEditGeneratedMeal: (meal: GeneratedMeal) => void; 
  onSaveSuccess: (savedMeal: {id: string, name: string}) => void;
  // Props for lifted state
  selections: GenerateMealSelections;
  onSelectionsChange: (selections: GenerateMealSelections) => void;
  generatedMealData: GeneratedMeal | null;
  onGeneratedMealDataChange: (meal: GeneratedMeal | null) => void;
}

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealKinds = ["High Protein", "Vegan", "Vegetarian", "Gluten-Free", "Low Carb", "Kid-Friendly", "Spicy"];
const mealStyles = ["Simple", "Fast (under 30 min)", "1 Pan", "Chef Inspired", "Comfort Food", "Healthy"];

const PREFERENCES_MAX_LENGTH = 300;
const REFINEMENT_MAX_LENGTH = 200;

const GenerateMealFlow: React.FC<GenerateMealFlowProps> = ({
  recipeGenerationStatus,
  imageGenerationStatus,
  isLoadingProfile,
  userProfile,
  onEditGeneratedMeal,
  onSaveSuccess,
  selections,
  onSelectionsChange,
  generatedMealData,
  onGeneratedMealDataChange,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recipeCardRef = useRef<HTMLDivElement>(null); 
  const [userId, setUserId] = useState<string | null>(null);

  // Local component state for UI interactions, not directly part of the form data
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
  
  useEffect(() => {
    console.log("[GenerateMealFlow] UserProfile Prop:", userProfile);
  }, [userProfile]);

  const handleSelectionChange = (field: keyof GenerateMealSelections, value: any) => {
    onSelectionsChange({ ...selections, [field]: value });
  };

  const handleKindChange = (kind: string, checked: boolean) => {
    const newKinds = checked 
      ? [...selections.selectedKinds, kind] 
      : selections.selectedKinds.filter(k => k !== kind);
    handleSelectionChange('selectedKinds', newKinds);
  };

  const handleStyleChange = (style: string, checked: boolean) => {
    const newStyles = checked
      ? [...selections.selectedStyles, style]
      : selections.selectedStyles.filter(s => s !== style);
    handleSelectionChange('selectedStyles', newStyles);
  };

  const recipeGenerationMutation = useMutation({
    mutationFn: async (params: { isRefinement: boolean; currentMeal?: GeneratedMeal | null; refinementText?: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!params.isRefinement && !selections.selectedMealType) {
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
        mealType: selections.selectedMealType,
        kinds: selections.selectedKinds,
        styles: selections.selectedStyles,
        preferences: selections.ingredientPreferences, 
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
            queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
            return null;
        }
        if (data?.error) { 
            showError(data.error); 
            queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
            return null; 
        }
        // Update lifted state
        onGeneratedMealDataChange({ ...data, image_url: params.isRefinement ? generatedMealData?.image_url : undefined });
        handleSelectionChange('refinementPrompt', ''); // Clear refinement prompt
        showSuccess(params.isRefinement ? "Recipe refined!" : "Recipe generated!");
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
        return data;
      } catch (error: any) { 
        dismissToast(loadingToastId);
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
             queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
             return null;
        }
        if (data?.error) { 
            showError(data.error); 
            if (data.mealData) onGeneratedMealDataChange(prev => ({...prev!, ...data.mealData}));
            queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
            return null;
        }
        if (data?.image_url !== undefined) { 
          onGeneratedMealDataChange(prev => prev ? { 
            ...prev, 
            image_url: data.image_url,
            estimated_calories: data.estimated_calories !== undefined ? data.estimated_calories : prev.estimated_calories,
            servings: data.servings !== undefined ? data.servings : prev.servings,
          } : null);
          showSuccess("Image generated!");
          setTimeout(() => { 
            recipeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        } else {
          showError("Image generation did not return an image URL.");
        }
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
        return data;
      } catch (error: any) {
        dismissToast(loadingToastId);
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
            servings: mealToSave.servings, 
          },])
        .select();
      if (error) throw error;
      return { data, mealToSave };
    },
    onSuccess: ({ data, mealToSave }) => {
      showSuccess(`"${mealToSave.name}" saved to My Meals!`);
      const savedMealEntry = data?.[0];
      if (savedMealEntry && onSaveSuccess) {
        onSaveSuccess({ id: savedMealEntry.id, name: mealToSave.name });
      } else if (onSaveSuccess) {
        onSaveSuccess({ id: 'unknown', name: mealToSave.name });
      }
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      // Do not reset generatedMealData here, ManageMealEntryPage will handle it
    },
    onError: (error: any, vars) => {
      showError(`Failed to save meal "${vars.name}": ${error.message || 'Please try again.'}`);
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const handleSaveMeal = () => {
    if (generatedMealData) {
      setIsSaving(true);
      saveMealMutation.mutate(generatedMealData);
    }
  };

  const handleGenerateNewRecipeRequest = () => { 
    onGeneratedMealDataChange(null); // Clear lifted state
    handleSelectionChange('refinementPrompt', ''); // Clear refinement prompt
  };

  const handleInitialGenerateRecipeClick = async () => {
     const { data: authData } = await supabase.auth.getUser();
     if (!authData.user) { showError("You must be logged in to generate meals."); navigate("/auth"); return; }
     recipeGenerationMutation.mutate({ isRefinement: false });
  };
  
  const handleRefineRecipeClick = async () => {
    if (!generatedMealData || !selections.refinementPrompt.trim()) {
      showError("Please provide refinement instructions.");
      return;
    }
    recipeGenerationMutation.mutate({ isRefinement: true, currentMeal: generatedMealData, refinementText: selections.refinementPrompt });
  };

  const handleGenerateImageClick = () => {
    if (generatedMealData) {
      generateImageMutation.mutate(generatedMealData);
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

  const caloriesPerServing = useMemo(() => {
    if (generatedMealData) {
      return calculateCaloriesPerServing(generatedMealData.estimated_calories, generatedMealData.servings);
    }
    return null;
  }, [generatedMealData]);

  return (
    <div className="space-y-6">
      {!generatedMealData && (
        <Card>
          <CardHeader>
            <CardTitle>Tell us what you're craving!</CardTitle>
            <CardDescription>Select your preferences and let AI suggest a meal recipe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base">What meal type do you want?</Label>
              <RadioGroup 
                onValueChange={(value) => handleSelectionChange('selectedMealType', value)} 
                value={selections.selectedMealType} 
                className="flex flex-wrap gap-4 mt-2"
              >
                {mealTypes.map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`gen-meal-type-${type.toLowerCase()}`} />
                    <Label htmlFor={`gen-meal-type-${type.toLowerCase()}`}>{type}</Label>
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
                      id={`gen-meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}
                      checked={selections.selectedKinds.includes(kind)}
                      onCheckedChange={(checked) => handleKindChange(kind, checked as boolean)}
                    />
                    <Label htmlFor={`gen-meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}>{kind}</Label>
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
                      id={`gen-meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}
                      checked={selections.selectedStyles.includes(style)}
                      onCheckedChange={(checked) => handleStyleChange(style, checked as boolean)}
                    />
                    <Label htmlFor={`gen-meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}>{style}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="gen-ingredient-preferences" className="text-base font-semibold">
                Tell the AI about your meal vision (Optional)
              </Label>
              <Textarea
                id="gen-ingredient-preferences"
                placeholder="e.g., 'Use only: chicken, broccoli, rice', 'Max 500 cals', 'No nuts, no onions'"
                value={selections.ingredientPreferences}
                onChange={(e) => handleSelectionChange('ingredientPreferences', e.target.value)}
                className="mt-2"
                maxLength={PREFERENCES_MAX_LENGTH}
              />
              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded-md space-y-1">
                <div className="flex items-start">
                  <Info size={14} className="inline mr-1.5 relative -top-px flex-shrink-0 mt-0.5" />
                  <span>Your general AI preferences from your profile are automatically included by the AI. Add more specific requests here for this meal.</span>
                </div>
                <div>
                  <strong className="block mt-1">Pro Tips:</strong>
                  <ul className="list-disc list-inside pl-1 space-y-0.5">
                    <li>List ingredients you have (e.g., "use only: ground beef, onions"), and the AI will try to use just those.</li>
                    <li>If adding a full custom meal feels like too much work, just type the meal name (e.g., 'Spaghetti Bolognese'), and let the AI try to generate the rest for you!</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {selections.ingredientPreferences.length}/{PREFERENCES_MAX_LENGTH} characters
              </p>
            </div>
            <Button
              onClick={handleInitialGenerateRecipeClick}
              disabled={!selections.selectedMealType || isGeneratingRecipe || recipeGenerationMutation.isPending || (!isLoadingProfile && !recipeGenerationStatus.isAdmin && recipeGenerationStatus.limitReached)}
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

      {generatedMealData && (
        <Card ref={recipeCardRef}> 
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-grow order-2 sm:order-1">
                <CardTitle>{generatedMealData.name}</CardTitle>
                <CardDescription>
                  {generatedMealData.image_url ? "Generated Recipe & Image" : "Generated Recipe Text"}
                </CardDescription>
                <div className="mt-1 space-y-0.5">
                  {generatedMealData.servings && (
                    <div className="text-sm text-muted-foreground flex items-center">
                      <Users size={14} className="mr-1.5 text-primary" />
                      Servings: {generatedMealData.servings}
                    </div>
                  )}
                  {userProfile?.track_calories && caloriesPerServing !== null && (
                    <div className="text-sm text-muted-foreground flex items-center">
                      <Zap size={14} className="mr-1.5 text-primary" />
                      Est. {caloriesPerServing} kcal per serving
                    </div>
                  )}
                </div>
              </div>
              {generatedMealData.image_url && (
                <div
                  className="cursor-pointer w-full h-48 sm:w-48 sm:h-48 md:w-56 md:h-56 flex-shrink-0 rounded-md bg-muted order-1 sm:order-2 mb-4 sm:mb-0"
                  onClick={() => setViewingImageUrl(generatedMealData.image_url || null)}
                >
                  <img
                    src={generatedMealData.image_url}
                    alt={`Image of ${generatedMealData.name}`}
                    className="h-full w-full object-contain rounded-md"
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
                {generatedMealData.ingredients.map((ing, index) => (
                  <li key={index} className="text-muted-foreground">
                    {typeof ing.quantity === 'number' ? ing.quantity : `"${ing.quantity}"`} {ing.unit} {ing.name} {ing.description && `(${ing.description})`}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Instructions:</h3>
              <p className="text-muted-foreground whitespace-pre-line">{generatedMealData.instructions}</p>
            </div>

            <div className="pt-4 border-t">
              <Label htmlFor="gen-refinement-prompt" className="text-base">Want to change something?</Label>
              <Textarea
                id="gen-refinement-prompt"
                placeholder="e.g., 'Replace chicken with tofu', 'Make it spicier', 'Add mushrooms'"
                value={selections.refinementPrompt}
                onChange={(e) => handleSelectionChange('refinementPrompt', e.target.value)}
                className="mt-2"
                maxLength={REFINEMENT_MAX_LENGTH}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {selections.refinementPrompt.length}/{REFINEMENT_MAX_LENGTH} characters
              </p>
              <Button
                onClick={handleRefineRecipeClick}
                disabled={!selections.refinementPrompt.trim() || isGeneratingRecipe || recipeGenerationMutation.isPending || (!isLoadingProfile && !recipeGenerationStatus.isAdmin && recipeGenerationStatus.limitReached && recipeGenerationStatus.generationsUsedThisPeriod >= RECIPE_GENERATION_LIMIT_PER_PERIOD) }
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6">
              <Button
                onClick={handleSaveMeal}
                disabled={isSaving || saveMealMutation.isPending}
                className="w-full" 
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving || saveMealMutation.isPending ? 'Saving...' : 'Save to My Meals'}
              </Button>
              <Button
                onClick={() => onEditGeneratedMeal(generatedMealData)}
                variant="outline"
                className="w-full" 
                disabled={isSaving || saveMealMutation.isPending || isGeneratingRecipe || recipeGenerationMutation.isPending || isGeneratingImage || generateImageMutation.isPending}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Before Saving
              </Button>
              <Button
                onClick={handleGenerateNewRecipeRequest}
                variant="outline"
                disabled={isGeneratingRecipe || recipeGenerationMutation.isPending || isSaving || saveMealMutation.isPending || isGeneratingImage || generateImageMutation.isPending}
                className="w-full" 
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate New Recipe
              </Button>
            </div>
          </CardContent>
        </Card>
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
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateMealFlow;