"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChefHat, Save, Lightbulb, ImagePlus, Trash2 } from 'lucide-react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

const generationPreferencesSchema = z.object({
  dietaryRestrictions: z.string().optional(),
  preferredCuisine: z.string().optional(),
  ingredientsToExclude: z.string().optional(),
  specificRequests: z.string().optional(),
  targetCalories: z.string().optional(),
  generateImage: z.boolean().default(false),
});

type GenerationPreferencesFormData = z.infer<typeof generationPreferencesSchema>;

const mealSchema = z.object({
  mealName: z.string().min(1, "Meal name is required"),
  ingredients: z.string().min(1, "Ingredients are required"),
  instructions: z.string().min(1, "Instructions are required"),
  mealTags: z.string().optional(),
  servings: z.string().regex(/^[1-9]\d*$/, "Servings must be a positive number").min(1, "Servings are required"),
});

type MealFormData = z.infer<typeof mealSchema>;

interface GeneratedRecipe {
  mealName: string;
  ingredients: string;
  instructions: string;
  estimatedCalories?: string;
  servings?: string; 
  tags?: string[];
  imageUrl?: string;
}

const GenerateMealPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [imageGenerationCount, setImageGenerationCount] = useState(0);
  const [recipeGenerationCount, setRecipeGenerationCount] = useState(0);
  const [canGenerateImage, setCanGenerateImage] = useState(false);
  const [canGenerateRecipe, setCanGenerateRecipe] = useState(false);
  const [showResetQuotaDialog, setShowResetQuotaDialog] = useState(false);


  const { toast } = useToast();
  const navigate = useNavigate();

  const MAX_IMAGE_GENERATIONS = 5; // Example limit
  const MAX_RECIPE_GENERATIONS = 10; // Example limit

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('image_generation_count, recipe_generation_count, last_image_generation_reset, last_recipe_generation_reset, is_admin')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          toast({ title: "Error", description: "Could not fetch your profile data.", variant: "destructive" });
          return;
        }
        
        if (profile) {
          const today = new Date().toISOString().split('T')[0];
          
          let currentImageCount = profile.image_generation_count || 0;
          if (profile.last_image_generation_reset !== today) {
            currentImageCount = 0;
            // Optionally update the reset date and count in DB here or upon next generation
          }
          setImageGenerationCount(currentImageCount);
          setCanGenerateImage(profile.is_admin || currentImageCount < MAX_IMAGE_GENERATIONS);

          let currentRecipeCount = profile.recipe_generation_count || 0;
          if (profile.last_recipe_generation_reset !== today) {
            currentRecipeCount = 0;
          }
          setRecipeGenerationCount(currentRecipeCount);
          setCanGenerateRecipe(profile.is_admin || currentRecipeCount < MAX_RECIPE_GENERATIONS);
        } else {
          setCanGenerateImage(true); // Default for new users or if profile not found
          setCanGenerateRecipe(true);
        }

      } else {
        navigate('/login');
      }
    };
    fetchUserAndProfile();
  }, [navigate, toast]);

  const { control: generationControl, handleSubmit: handleGenerateSubmit, watch: watchGenerationPrefs, formState: { errors: generationErrors } } = useForm<GenerationPreferencesFormData>({
    resolver: zodResolver(generationPreferencesSchema),
    defaultValues: {
      dietaryRestrictions: '',
      preferredCuisine: '',
      ingredientsToExclude: '',
      specificRequests: '',
      targetCalories: '',
      generateImage: false,
    },
  });

  const { control: mealFormControl, handleSubmit: handleSaveSubmit, setValue, formState: { errors: mealErrors } } = useForm<MealFormData>({
    resolver: zodResolver(mealSchema),
    defaultValues: {
      mealName: '',
      ingredients: '',
      instructions: '',
      mealTags: '',
      servings: '2', // Default to 2 servings
    },
  });

  const generateImagePref = watchGenerationPrefs('generateImage');

  const onGenerateRecipe: SubmitHandler<GenerationPreferencesFormData> = async (data) => {
    if (!userId) {
      toast({ title: "Error", description: "User not found. Please log in again.", variant: "destructive" });
      return;
    }

    if (!canGenerateRecipe) {
        toast({
            title: "Recipe Generation Limit Reached",
            description: `You have reached your daily limit of ${MAX_RECIPE_GENERATIONS} recipe generations. Please try again tomorrow or contact support if you believe this is an error.`,
            variant: "destructive",
        });
        return;
    }
    
    if (data.generateImage && !canGenerateImage) {
        toast({
            title: "Image Generation Limit Reached",
            description: `You have reached your daily limit of ${MAX_IMAGE_GENERATIONS} image generations. You can still generate the recipe without an image.`,
            variant: "destructive",
        });
        // Optionally, allow recipe generation without image
        // data.generateImage = false; 
        // Or return if image is mandatory for this flow
        return; 
    }

    setIsLoading(true);
    setGeneratedRecipe(null);
    setRecipeImageUrl(null);

    const promptParts = [
      "Generate a recipe.",
      data.dietaryRestrictions && `It should follow these dietary restrictions: ${data.dietaryRestrictions}.`,
      data.preferredCuisine && `The preferred cuisine is ${data.preferredCuisine}.`,
      data.ingredientsToExclude && `Exclude these ingredients: ${data.ingredientsToExclude}.`,
      data.targetCalories && `Aim for around ${data.targetCalories} calories per serving.`,
      data.specificRequests && `Specific requests: ${data.specificRequests}.`,
      "Provide the response as a JSON object with the following keys: mealName (string), ingredients (string, newline separated), instructions (string, newline separated), estimatedCalories (string, e.g., 'Approx. X kcal per serving'), tags (array of strings).",
      "For ingredients, list each ingredient on a new line. For instructions, list each step on a new line, numbered.",
    ].filter(Boolean).join(' ');
    
    console.log("Generating recipe with prompt:", promptParts);
    console.log("Generate image preference:", data.generateImage);

    try {
      const { data: recipeData, error: recipeError } = await supabase.functions.invoke('gemini-generate-recipe', {
        body: { 
          prompt: promptParts,
          generateImage: data.generateImage 
        },
      });

      if (recipeError) throw recipeError;
      
      console.log("Raw recipe data from function:", recipeData);

      if (recipeData && recipeData.mealName) {
        setValue('mealName', recipeData.mealName);
        setValue('ingredients', recipeData.ingredients);
        setValue('instructions', recipeData.instructions);
        setValue('mealTags', recipeData.tags ? recipeData.tags.join(', ') : '');
        setValue('servings', recipeData.servings || '2'); // Use AI suggested servings or default to 2

        setGeneratedRecipe({
            ...recipeData,
            servings: recipeData.servings || '2' // Ensure servings is part of the state
        });
        if (recipeData.imageUrl) {
          setRecipeImageUrl(recipeData.imageUrl);
        }
        toast({ title: "Recipe Generated!", description: "Review and save your new meal." });
        
        // Update recipe generation count
        const newRecipeCount = recipeGenerationCount + 1;
        setRecipeGenerationCount(newRecipeCount);
        const { error: updateRecipeCountError } = await supabase
          .from('profiles')
          .update({ recipe_generation_count: newRecipeCount, last_recipe_generation_reset: new Date().toISOString().split('T')[0] })
          .eq('id', userId);
        if (updateRecipeCountError) console.error("Error updating recipe generation count:", updateRecipeCountError);
        setCanGenerateRecipe(newRecipeCount < MAX_RECIPE_GENERATIONS);


        if (data.generateImage && recipeData.imageUrl) {
            const newImageCount = imageGenerationCount + 1;
            setImageGenerationCount(newImageCount);
            const { error: updateImageCountError } = await supabase
              .from('profiles')
              .update({ image_generation_count: newImageCount, last_image_generation_reset: new Date().toISOString().split('T')[0] })
              .eq('id', userId);
            if (updateImageCountError) console.error("Error updating image generation count:", updateImageCountError);
            setCanGenerateImage(newImageCount < MAX_IMAGE_GENERATIONS);
        }


      } else {
        throw new Error("Invalid recipe format received from AI.");
      }
    } catch (error: any) {
      console.error("Error generating recipe:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveMeal: SubmitHandler<MealFormData> = async (data) => {
    if (!userId || !generatedRecipe) {
      toast({ title: "Error", description: "No recipe data to save or user not identified.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const mealToInsert = {
        user_id: userId,
        name: data.mealName,
        ingredients: data.ingredients,
        instructions: data.instructions,
        meal_tags: data.mealTags?.split(',').map(tag => tag.trim()).filter(tag => tag) || [],
        image_url: recipeImageUrl,
        estimated_calories: generatedRecipe.estimatedCalories,
        servings: data.servings, // Save the servings
      };

      console.log("Saving meal:", mealToInsert);

      const { error } = await supabase.from('meals').insert([mealToInsert]);
      if (error) throw error;

      toast({ title: "Meal Saved!", description: `${data.mealName} has been added to your meals.` });
      navigate('/my-meals');
    } catch (error: any) {
      console.error("Error saving meal:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Could not save meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleResetQuota = async () => {
    if (!userId) return;
    try {
        await supabase.functions.invoke('reset-user-quotas', {
            body: { userId: userId }
        });
        toast({ title: "Success", description: "Your generation quotas have been reset." });
        // Re-fetch profile to update UI
        const { data: profile } = await supabase.from('profiles').select('image_generation_count, recipe_generation_count, is_admin').eq('id', userId).single();
        if (profile) {
            setImageGenerationCount(profile.image_generation_count || 0);
            setRecipeGenerationCount(profile.recipe_generation_count || 0);
            setCanGenerateImage(profile.is_admin || (profile.image_generation_count || 0) < MAX_IMAGE_GENERATIONS);
            setCanGenerateRecipe(profile.is_admin || (profile.recipe_generation_count || 0) < MAX_RECIPE_GENERATIONS);
        }
        setShowResetQuotaDialog(false);
    } catch (error: any) {
        console.error("Error resetting quota:", error);
        toast({ title: "Error", description: error.message || "Failed to reset quotas.", variant: "destructive" });
    }
  };


  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center"><Lightbulb className="mr-2 h-6 w-6 text-yellow-500" /> AI Recipe Generator</CardTitle>
          <CardDescription>
            Tell us your preferences, and let our AI chef whip up a unique recipe for you! 
            You have {MAX_RECIPE_GENERATIONS - recipeGenerationCount} recipe generations and {MAX_IMAGE_GENERATIONS - imageGenerationCount} image generations left today.
            <Dialog open={showResetQuotaDialog} onOpenChange={setShowResetQuotaDialog}>
              <DialogTrigger asChild>
                <Button variant="link" size="sm" className="pl-1 text-xs" onClick={() => setShowResetQuotaDialog(true)}>(Admin: Reset Quotas)</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Generation Quotas</DialogTitle>
                  <DialogDescription>
                    This will reset the daily recipe and image generation quotas for your account. This action is typically for admin/testing purposes.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleResetQuota}>Confirm Reset</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateSubmit(onGenerateRecipe)} className="space-y-4">
            <div>
              <Label htmlFor="specificRequests">What are you in the mood for?</Label>
              <Controller
                name="specificRequests"
                control={generationControl}
                render={({ field }) => <Input id="specificRequests" placeholder="e.g., 'a quick pasta dish', 'something with chicken and broccoli'" {...field} />}
              />
              {generationErrors.specificRequests && <p className="text-sm text-red-500 mt-1">{generationErrors.specificRequests.message}</p>}
            </div>

            <Button type="button" variant="link" onClick={() => setShowAdvanced(!showAdvanced)} className="p-0 h-auto text-sm">
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options (Cuisine, Diet, etc.)
            </Button>

            {showAdvanced && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="preferredCuisine">Preferred Cuisine (Optional)</Label>
                  <Controller
                    name="preferredCuisine"
                    control={generationControl}
                    render={({ field }) => <Input id="preferredCuisine" placeholder="e.g., Italian, Mexican, Indian" {...field} />}
                  />
                </div>
                <div>
                  <Label htmlFor="dietaryRestrictions">Dietary Restrictions (Optional)</Label>
                  <Controller
                    name="dietaryRestrictions"
                    control={generationControl}
                    render={({ field }) => <Input id="dietaryRestrictions" placeholder="e.g., vegetarian, gluten-free, low-carb" {...field} />}
                  />
                </div>
                <div>
                  <Label htmlFor="ingredientsToExclude">Ingredients to Exclude (Optional)</Label>
                  <Controller
                    name="ingredientsToExclude"
                    control={generationControl}
                    render={({ field }) => <Input id="ingredientsToExclude" placeholder="e.g., peanuts, shellfish, dairy" {...field} />}
                  />
                </div>
                <div>
                  <Label htmlFor="targetCalories">Target Calories per Serving (Optional)</Label>
                  <Controller
                    name="targetCalories"
                    control={generationControl}
                    render={({ field }) => <Input id="targetCalories" placeholder="e.g., 500" {...field} />}
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2 mt-4">
              <Controller
                name="generateImage"
                control={generationControl}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="generateImage"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={!canGenerateImage && field.value}
                  />
                )}
              />
              <Label htmlFor="generateImage" className="text-sm font-medium">
                Generate an image for this recipe? ({MAX_IMAGE_GENERATIONS - imageGenerationCount} left)
              </Label>
            </div>
             {generateImagePref && !canGenerateImage && (
                <p className="text-sm text-orange-600 mt-1">
                    Image generation limit reached. Uncheck to proceed with recipe generation only.
                </p>
            )}


            <Button type="submit" disabled={isLoading || !canGenerateRecipe || (generateImagePref && !canGenerateImage) } className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChefHat className="mr-2 h-4 w-4" />}
              Generate Recipe
            </Button>
            {!canGenerateRecipe && (
                 <p className="text-sm text-red-500 mt-1 text-center">
                    Recipe generation limit reached for today.
                </p>
            )}
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center text-center p-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-semibold">Generating your culinary masterpiece...</p>
          <p className="text-sm text-muted-foreground">Our AI chef is hard at work. This might take a moment.</p>
        </div>
      )}

      {generatedRecipe && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Your Generated Recipe</CardTitle>
            <CardDescription>Review the details below. You can edit them before saving.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSubmit(onSaveMeal)} className="space-y-4">
              {recipeImageUrl && (
                <div className="mb-4">
                  <img src={recipeImageUrl} alt={generatedRecipe.mealName} className="rounded-md max-h-64 w-auto mx-auto" />
                </div>
              )}
              <div>
                <Label htmlFor="mealName">Meal Name</Label>
                <Controller
                  name="mealName"
                  control={mealFormControl}
                  render={({ field }) => <Input id="mealName" {...field} />}
                />
                {mealErrors.mealName && <p className="text-sm text-red-500 mt-1">{mealErrors.mealName.message}</p>}
              </div>

              <div>
                <Label htmlFor="servings">Number of Servings</Label>
                <Controller
                  name="servings"
                  control={mealFormControl}
                  render={({ field }) => <Input id="servings" type="number" min="1" {...field} />}
                />
                {mealErrors.servings && <p className="text-sm text-red-500 mt-1">{mealErrors.servings.message}</p>}
              </div>

              <div>
                <Label htmlFor="ingredients">Ingredients</Label>
                <Controller
                  name="ingredients"
                  control={mealFormControl}
                  render={({ field }) => <Textarea id="ingredients" rows={8} {...field} />}
                />
                {mealErrors.ingredients && <p className="text-sm text-red-500 mt-1">{mealErrors.ingredients.message}</p>}
              </div>
              <div>
                <Label htmlFor="instructions">Instructions</Label>
                <Controller
                  name="instructions"
                  control={mealFormControl}
                  render={({ field }) => <Textarea id="instructions" rows={10} {...field} />}
                />
                {mealErrors.instructions && <p className="text-sm text-red-500 mt-1">{mealErrors.instructions.message}</p>}
              </div>
              <div>
                <Label htmlFor="mealTags">Meal Tags (comma-separated)</Label>
                <Controller
                  name="mealTags"
                  control={mealFormControl}
                  render={({ field }) => <Input id="mealTags" placeholder="e.g., quick, healthy, dinner" {...field} />}
                />
              </div>
              {generatedRecipe.estimatedCalories && (
                <p className="text-sm text-muted-foreground">Estimated Calories: {generatedRecipe.estimatedCalories}</p>
              )}
               <p className="text-sm text-muted-foreground">Base Servings for this recipe: {watchGenerationPrefs('servings') || generatedRecipe.servings || 'Not set'}</p>


              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Meal
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GenerateMealPage;