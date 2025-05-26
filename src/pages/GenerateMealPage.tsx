import React, { useState, useEffect, useMemo } from 'react';
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
import { Brain, Save, RefreshCw, Info, Image as ImageIcon, Edit2 } from 'lucide-react'; // Added Edit2
import AppHeader from "@/components/AppHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format as formatDateFns } from "date-fns"; 
import { IMAGE_GENERATION_LIMIT_PER_MONTH } from '@/lib/constants';

interface GeneratedIngredient {
  name: string;
  quantity: number | string; // Allow string for flexibility like "1/2"
  unit: string;
  description?: string;
}

interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[];
  instructions: string;
  meal_tags: string[];
  image_url?: string;
}

interface UserProfileData {
  is_admin: boolean;
  image_generation_count: number;
  last_image_generation_reset: string | null; // YYYY-MM
}

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealKinds = ["High Protein", "Vegan", "Vegetarian", "Gluten-Free", "Low Carb", "Kid-Friendly", "Spicy"];
const mealStyles = ["Simple", "Fast (under 30 min)", "1 Pan", "Chef Inspired", "Comfort Food", "Healthy"];

const PREFERENCES_MAX_LENGTH = 300;
const REFINEMENT_MAX_LENGTH = 200;
const MOCK_RECIPE_GENERATION_LIMIT = 100; // Placeholder

interface GenerationStatus {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

const GenerateMealPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
        .select('is_admin, image_generation_count, last_image_generation_reset')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
  });

  const generationStatus = useMemo((): GenerationStatus => {
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
      isAdmin: false
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

  const recipeGenerationMutation = useMutation({ // Renamed for clarity
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
        mealType: selectedMealType, // Send original selections even for refinement
        kinds: selectedKinds,
        styles: selectedStyles,
        preferences: ingredientPreferences, // User's general preferences from profile/initial form
      };

      if (params.isRefinement && params.currentMeal && params.refinementText) {
        bodyPayload.existingRecipeText = params.currentMeal;
        bodyPayload.refinementInstructions = params.refinementText;
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-meal', { body: bodyPayload });
        dismissToast(loadingToastId);
        if (error) throw error;
        if (data?.error) { 
            showError(data.error);
            // Don't clear generatedMeal on error if it was a refinement attempt, user might want to try again
            // setGeneratedMeal(null); 
            return null; 
        }
        setGeneratedMeal({ ...data, image_url: undefined }); // New/refined recipe, clear any old image
        setRefinementPrompt(''); // Clear refinement prompt after use
        showSuccess(params.isRefinement ? "Recipe refined!" : "Recipe generated!");
        return data;
      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error in recipe generation/refinement:', error);
        showError(`Failed to ${params.isRefinement ? 'refine' : 'generate'} recipe: ${error.message || 'Please try again.'}`);
        // setGeneratedMeal(null); // Potentially clear on error
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

      if (!generationStatus.isAdmin && generationStatus.limitReached) {
        showError(`You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`);
        return null;
      }
      setIsGeneratingImage(true);
      const loadingToastId = showLoading("Generating image...");
      try {
        const { data, error } = await supabase.functions.invoke('generate-meal', {
          body: { mealData: mealToGetImageFor }, // mealData implies image generation for this content
        });
        dismissToast(loadingToastId);
        if (error) throw error;
        if (data?.error) { 
            showError(data.error);
            if (data.mealData) setGeneratedMeal(prev => ({...prev!, ...data.mealData}));
            refetchUserProfile(); 
            return null;
        }
        if (data?.image_url) {
          setGeneratedMeal(prev => prev ? { ...prev, image_url: data.image_url } : null);
          showSuccess("Image generated!");
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

  const handleGenerateNewRecipeRequest = () => { // Renamed to avoid conflict
    setGeneratedMeal(null); 
    setRefinementPrompt('');
    // Optionally reset other form fields like selectedMealType, kinds, styles if desired
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
                <Label htmlFor="ingredient-preferences" className="text-base">Any ingredients you want or don't want, or other general preferences?</Label>
                <Textarea
                  id="ingredient-preferences"
                  placeholder="e.g., 'use chicken, no cilantro'"
                  value={ingredientPreferences}
                  onChange={(e) => setIngredientPreferences(e.target.value)}
                  className="mt-2"
                  maxLength={PREFERENCES_MAX_LENGTH}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {ingredientPreferences.length}/{PREFERENCES_MAX_LENGTH} characters
                </p>
              </div>
              <Button
                onClick={handleInitialGenerateRecipeClick}
                disabled={!selectedMealType || isGeneratingRecipe || recipeGenerationMutation.isPending}
                className="w-full"
              >
                {isGeneratingRecipe || recipeGenerationMutation.isPending ? 'Generating Recipe...' : 'Generate Recipe'}
              </Button>
              <div className="text-xs text-muted-foreground text-center pt-2">
                <Info size={14} className="inline mr-1 flex-shrink-0" />
                Recipe Generations Available (Illustrative): {MOCK_RECIPE_GENERATION_LIMIT} per period.
              </div>
            </CardContent>
          </Card>
        )}

        {generatedMeal && (
          <Card>
            <CardHeader>
              {generatedMeal.image_url && (
                <div
                  className="cursor-pointer w-full h-48 flex items-center justify-center overflow-hidden rounded-t-md mb-4 bg-muted"
                  onClick={() => setViewingImageUrl(generatedMeal.image_url || null)}
                >
                  <img
                    src={generatedMeal.image_url}
                    alt={`Image of ${generatedMeal.name}`}
                    className="h-full object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
              <CardTitle>{generatedMeal.name}</CardTitle>
              <CardDescription>
                {generatedMeal.image_url ? "Generated Recipe & Image" : "Generated Recipe Text"}
              </CardDescription>
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

              {/* Refinement Section */}
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
                  disabled={!refinementPrompt.trim() || isGeneratingRecipe || recipeGenerationMutation.isPending}
                  className="w-full mt-2"
                  variant="secondary"
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {isGeneratingRecipe && recipeGenerationMutation.isLoading && recipeGenerationMutation.variables?.isRefinement ? 'Refining...' : 'Refine Recipe'}
                </Button>
              </div>

              {!generatedMeal.image_url && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleGenerateImageClick}
                    disabled={isGeneratingImage || generateImageMutation.isPending || isLoadingProfile || (!generationStatus.isAdmin && generationStatus.limitReached)}
                    className="w-full mb-2"
                    variant="outline"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {isGeneratingImage || generateImageMutation.isPending ? 'Generating Image...' : 'Generate Image for this Meal'}
                  </Button>
                  {!isLoadingProfile && (
                    <div className="flex items-center justify-center text-xs text-muted-foreground">
                      <Info size={14} className="mr-1 flex-shrink-0 text-primary" />
                      {generationStatus.isAdmin 
                        ? "Admin account: Image generation limits bypassed."
                        : `Image Generations Used This Month: ${generationStatus.generationsUsedThisMonth} / ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`}
                    </div>
                  )}
                </div>
              )}

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