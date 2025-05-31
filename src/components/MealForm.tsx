"use client";

import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle, Image as ImageIcon, Loader2, AlertCircle, Info } from 'lucide-react';
import TagInput from '@/components/TagInput';
import { IMAGE_GENERATION_LIMIT_PER_MONTH } from '@/lib/constants'; // Assuming this is used for display or logic

// Schema definition (assuming it exists and includes image_url, which might now be optional or AI-populated)
const mealFormSchema = z.object({
  name: z.string().min(1, 'Meal name is required'),
  ingredients: z.array(z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    quantity: z.string().optional(),
    unit: z.string().optional(),
    description: z.string().optional(),
  })).min(1, 'At least one ingredient is required'),
  instructions: z.string().min(1, 'Instructions are required'),
  meal_tags: z.array(z.string()).optional(),
  image_url: z.string().url('Must be a valid URL if provided.').optional().or(z.literal('')), // Kept in schema for AI generation or initial data
  estimated_calories: z.string().optional(),
  servings: z.string().optional(),
});

export type MealFormValues = z.infer<typeof mealFormSchema>;

export interface GenerationStatusInfo {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

interface MealFormProps {
  initialData?: MealFormValues | null;
  onSaveSuccess?: (savedMeal: { id: string; name: string }) => void;
  generationStatus: GenerationStatusInfo;
  isLoadingProfile: boolean;
  showCaloriesField: boolean;
  onInitialDataProcessed?: () => void;
}

const MealForm: React.FC<MealFormProps> = ({ 
  initialData, 
  onSaveSuccess,
  generationStatus,
  isLoadingProfile,
  showCaloriesField,
  onInitialDataProcessed
}) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // State for AI image generation prompt (if you keep AI generation)
  const [imagePrompt, setImagePrompt] = useState('');


  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: '',
      ingredients: [{ name: '', quantity: '', unit: '', description: '' }],
      instructions: '',
      meal_tags: [],
      image_url: '',
      estimated_calories: '',
      servings: '',
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || '',
        ingredients: initialData.ingredients?.length ? initialData.ingredients.map(ing => ({
            name: ing.name || "",
            quantity: ing.quantity !== undefined && ing.quantity !== null ? String(ing.quantity) : "",
            unit: ing.unit || "",
            description: ing.description || "",
        })) : [{ name: '', quantity: '', unit: '', description: '' }],
        instructions: initialData.instructions || '',
        meal_tags: initialData.meal_tags || [],
        image_url: initialData.image_url || '', // Still set from initialData
        estimated_calories: initialData.estimated_calories || '',
        servings: initialData.servings || '',
      });
      if (onInitialDataProcessed) {
        onInitialDataProcessed();
      }
    }
  }, [initialData, form, onInitialDataProcessed]);

  const onSubmit = async (data: MealFormValues) => {
    if (!userId) {
      toast.error("User not found. Please log in again.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: mealData, error } = await supabase
        .from('meals')
        .upsert({
          ...(initialData && form.getValues('name') === initialData.name ? { id: (await supabase.from('meals').select('id').eq('name', initialData.name).eq('user_id', userId).single())?.data?.id } : {}),
          user_id: userId,
          name: data.name,
          ingredients: JSON.stringify(data.ingredients), // Store as JSON string
          instructions: data.instructions,
          meal_tags: data.meal_tags,
          image_url: data.image_url, // image_url is still part of the data
          estimated_calories: data.estimated_calories,
          servings: data.servings,
        })
        .select('id, name')
        .single();

      if (error) throw error;

      toast.success(`Meal "${mealData.name}" ${initialData ? 'updated' : 'saved'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['meals', userId] });
      queryClient.invalidateQueries({ queryKey: ['mealPlans', userId] });
      queryClient.invalidateQueries({ queryKey: ['uniqueMealTags', userId] });
      form.reset();
      if (onSaveSuccess && mealData) {
        onSaveSuccess({ id: mealData.id, name: mealData.name });
      }
    } catch (error: any) {
      console.error("Error saving meal:", error);
      toast.error(`Error saving meal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!userId) {
      toast.error("User not found. Please log in again.");
      return;
    }
    if (generationStatus.limitReached && !generationStatus.isAdmin) {
      toast.error("Image generation limit reached for this month.");
      return;
    }
    if (!form.getValues('name') && !imagePrompt) {
        toast.error("Please enter a meal name or a custom prompt to generate an image.");
        return;
    }

    setIsGeneratingImage(true);
    const effectivePrompt = imagePrompt || `A delicious looking plate of ${form.getValues('name') || 'food'}`;

    try {
      // IMPORTANT: Replace with your actual Supabase Edge Function invocation
      const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-image-prod', {
        body: { 
          prompt: effectivePrompt,
          userId: userId, // Pass userId to the function
        },
      });

      if (functionError) throw functionError;

      if (functionData.error) {
        throw new Error(functionData.error);
      }
      
      if (functionData.imageUrl) {
        form.setValue('image_url', functionData.imageUrl, { shouldValidate: true });
        toast.success("Image generated and URL updated!");
        // Invalidate queries related to user profile if generation count is updated server-side by the function
        queryClient.invalidateQueries({ queryKey: ['userProfileForMealEntryLimits', userId] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });

      } else {
        throw new Error("Image URL not found in function response.");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(`Error generating image: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingImage(false);
      setImagePrompt(''); // Clear prompt after attempt
    }
  };
  
  const currentImageUrl = form.watch('image_url');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Meal' : 'Add New Meal'}</CardTitle>
        <CardDescription>
          {initialData ? 'Update the details of your meal.' : 'Fill in the details of your new meal. You can generate an image using AI.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="name">Meal Name</Label>
            <Input id="name" {...form.register("name")} placeholder="e.g., Spaghetti Carbonara" />
            {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>

          <div>
            <Label>Ingredients</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2 mb-2 p-2 border rounded-md relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-grow">
                  <div>
                    <Label htmlFor={`ingredients.${index}.name`} className="text-xs">Name</Label>
                    <Input {...form.register(`ingredients.${index}.name`)} placeholder="e.g., Eggs" />
                    {form.formState.errors.ingredients?.[index]?.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.ingredients?.[index]?.name?.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`ingredients.${index}.quantity`} className="text-xs">Quantity</Label>
                    <Input {...form.register(`ingredients.${index}.quantity`)} placeholder="e.g., 2" type="text" />
                  </div>
                  <div>
                    <Label htmlFor={`ingredients.${index}.unit`} className="text-xs">Unit</Label>
                    <Input {...form.register(`ingredients.${index}.unit`)} placeholder="e.g., large, grams" />
                  </div>
                  <div>
                    <Label htmlFor={`ingredients.${index}.description`} className="text-xs">Notes (e.g. diced)</Label>
                    <Input {...form.register(`ingredients.${index}.description`)} placeholder="e.g., finely chopped" />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-5 text-destructive hover:text-destructive-foreground hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', quantity: '', unit: '', description: '' })} className="mt-2">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Ingredient
            </Button>
            {form.formState.errors.ingredients && typeof form.formState.errors.ingredients.message === 'string' && <p className="text-sm text-destructive mt-1">{form.formState.errors.ingredients.message}</p>}
          </div>

          <div>
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" {...form.register("instructions")} placeholder="Step 1: Boil water..." rows={5} />
            {form.formState.errors.instructions && <p className="text-sm text-destructive mt-1">{form.formState.errors.instructions.message}</p>}
          </div>

          <div>
            <Label htmlFor="meal_tags">Tags (e.g., breakfast, quick, vegetarian)</Label>
            <Controller
              name="meal_tags"
              control={form.control}
              render={({ field }) => (
                <TagInput
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Type and press Enter to add a tag"
                />
              )}
            />
          </div>
          
          {/* Image Section - Manual URL input removed */}
          <div className="space-y-2">
            <Label>Meal Image</Label>
            {currentImageUrl && (
              <div className="mt-2">
                <img src={currentImageUrl} alt="Current meal image" className="rounded-md max-h-48 w-auto object-cover" />
              </div>
            )}
            
            {/* AI Image Generation Button and Prompt Input */}
            {!generationStatus.limitReached || generationStatus.isAdmin ? (
              <div className="p-3 border rounded-md bg-muted/20 space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>Generate an image for your meal using AI.</span>
                </div>
                <Input 
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Optional: Describe the image (e.g., 'rustic, top-down view')" 
                  disabled={isGeneratingImage || isLoadingProfile}
                />
                <Button 
                  type="button" 
                  onClick={handleGenerateImage} 
                  disabled={isGeneratingImage || isLoadingProfile || (!form.getValues('name') && !imagePrompt)}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                  Generate Image
                </Button>
                {!generationStatus.isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Generations used this month: {generationStatus.generationsUsedThisMonth}/{IMAGE_GENERATION_LIMIT_PER_MONTH}.
                  </p>
                )}
              </div>
            ) : (
              !isLoadingProfile && (
                <div className="p-3 border rounded-md bg-amber-50 border-amber-200 text-amber-700 text-sm">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                    <p>You've reached your AI image generation limit for this month ({IMAGE_GENERATION_LIMIT_PER_MONTH} images).</p>
                  </div>
                </div>
              )
            )}
            {isLoadingProfile && (
                <div className="p-3 border rounded-md bg-muted/20 text-sm text-muted-foreground">
                    <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span>Loading image generation status...</span>
                    </div>
                </div>
            )}
            {/* The form.register for image_url is implicitly handled by form.setValue in handleGenerateImage */}
            {/* No direct input field for image_url is provided to the user anymore */}
            {form.formState.errors.image_url && <p className="text-sm text-destructive mt-1">{form.formState.errors.image_url.message}</p>}
          </div>


          {showCaloriesField && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimated_calories">Estimated Calories (per serving)</Label>
                <Input id="estimated_calories" {...form.register("estimated_calories")} placeholder="e.g., 550" />
              </div>
              <div>
                <Label htmlFor="servings">Number of Servings</Label>
                <Input id="servings" {...form.register("servings")} placeholder="e.g., 4" />
              </div>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting || isGeneratingImage} className="w-full sm:w-auto">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initialData ? 'Update Meal' : 'Save Meal'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MealForm;