import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag } from "@/lib/constants";
import { IMAGE_GENERATION_LIMIT_PER_MONTH } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Zap, Users, Brain, Info, Link2, XCircle } from "lucide-react"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { UNITS } from "./MealForm"; 
import { LazyLoadImage } from 'react-lazy-load-image-component'; 
import 'react-lazy-load-image-component/src/effects/blur.css'; 

const ingredientSchema = z.object({
  name: z.string().min(1, { message: "Ingredient name is required." }),
  quantity: z.string() 
    .transform((val) => val.trim() === "" ? undefined : parseFloat(val)) 
    .refine((val) => val === undefined || (typeof val === 'number' && !isNaN(val) && val >= 0), { // Allow 0
      message: "Quantity must be a non-negative number if provided.",
    })
    .optional(), 
  unit: z.string().optional().transform(val => val === "" ? undefined : val),
  description: z.string().optional(),
}).refine(data => {
  if (typeof data.quantity === 'number') {
    if (data.quantity === 0) { 
      return data.unit === undefined || data.unit.trim().toLowerCase() === "to taste" || data.unit.trim() === "";
    }
    return typeof data.unit === 'string' && data.unit.trim() !== "" && data.unit.trim().toLowerCase() !== "to taste";
  }
  return true; 
}, {
  message: "Unit is required for non-zero quantities. For 'to taste', set quantity to 0 and unit to 'to taste' or leave empty.",
  path: ["unit"],
});

const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.string().optional(),
  meal_tags: z.array(z.string()).optional(),
  estimated_calories: z.string().optional(), 
  servings: z.string().optional(), 
  image_url: z.string().optional(), 
});

type MealFormValues = z.infer<typeof mealFormSchema>;

export interface MealForEditing {
  id: string;
  name: string;
  ingredients?: string | null;
  instructions?: string | null;
  user_id: string;
  meal_tags?: string[] | null;
  image_url?: string | null;
  estimated_calories?: string | null; 
  servings?: string | null; 
}

interface EditMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealForEditing | null;
}

interface GenerationStatusInfo {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

const EditMealDialog: React.FC<EditMealDialogProps> = ({ open, onOpenChange, meal }) => {
  const queryClient = useQueryClient();
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [showImageUrlInput, setShowImageUrlInput] = useState(false); 

  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: "",
      ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
      instructions: "",
      meal_tags: [],
      estimated_calories: "", 
      servings: "", 
      image_url: "", 
    },
  });

  const { fields, append, remove } = useFieldArray({ 
    control: form.control,
    name: "ingredients",
  });

  const { data: userProfile, isLoading: isLoadingUserProfile } = useQuery({
    queryKey: ['userProfileForEditMealImageGeneration', meal?.user_id],
    queryFn: async () => {
      if (!meal?.user_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('image_generation_count, last_image_generation_reset, is_admin')
        .eq('id', meal.user_id)
        .single();
      if (error && error.code !== 'PGRST116') { 
        console.error("Error fetching profile for image generation limits:", error);
        showError("Could not load your image generation allowance.");
        return null;
      }
      return data;
    },
    enabled: !!meal && open, 
  });

  const generationStatus = useMemo((): GenerationStatusInfo | null => {
    if (!userProfile) return null;
    const { image_generation_count = 0, last_image_generation_reset, is_admin = false } = userProfile;

    let generationsUsed = image_generation_count;
    const today = new Date();
    const currentMonth = today.getFullYear() + '-' + (today.getMonth() + 1); 

    if (last_image_generation_reset !== currentMonth) {
      generationsUsed = 0; 
    }

    return {
      generationsUsedThisMonth: generationsUsed,
      limitReached: !is_admin && generationsUsed >= IMAGE_GENERATION_LIMIT_PER_MONTH,
      isAdmin: is_admin,
    };
  }, [userProfile]);

  useEffect(() => {
    if (meal && open) {
      let parsedIngredients: any[] = []; 
      if (meal.ingredients) {
        try {
          const parsed = JSON.parse(meal.ingredients);
          if (Array.isArray(parsed)) {
            parsedIngredients = parsed.map(item => ({
              name: item.name || "",
              quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : "",
              unit: item.unit || "",
              description: item.description || "",
            }));
          }
        } catch (e) {
          console.warn("Failed to parse ingredients JSON for editing:", e);
        }
      }
      
      form.reset({
        name: meal.name,
        ingredients: parsedIngredients, 
        instructions: meal.instructions || "",
        meal_tags: meal.meal_tags || [],
        estimated_calories: meal.estimated_calories || "", 
        servings: meal.servings || "", 
        image_url: meal.image_url || "", 
      });
      setShowImageUrlInput(false); 
    } else if (!open) {
      form.reset({
        name: "",
        ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
        instructions: "",
        meal_tags: [],
        estimated_calories: "", 
        servings: "", 
        image_url: "", 
      });
      setShowImageUrlInput(false); 
    }
  }, [meal, open, form]);

  const editMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      if (!meal) throw new Error("No meal selected for editing.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== meal.user_id) {
        throw new Error("You can only edit your own meals.");
      }

      const ingredientsToSave = values.ingredients?.map(ing => ({
        name: ing.name,
        quantity: ing.quantity !== undefined ? ing.quantity : null,
        unit: ing.quantity !== undefined ? (ing.unit || "") : null,
        description: ing.description,
      })).filter(ing => ing.name.trim() !== "");

      const ingredientsJSON = ingredientsToSave && ingredientsToSave.length > 0 ? JSON.stringify(ingredientsToSave) : null;

      const { data, error } = await supabase
        .from("meals")
        .update({
          name: values.name,
          ingredients: ingredientsJSON,
          instructions: values.instructions,
          meal_tags: values.meal_tags,
          estimated_calories: values.estimated_calories, 
          servings: values.servings, 
          image_url: values.image_url, 
        })
        .eq("id", meal.id)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] }); 
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] }); 
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] }); 
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating meal:", error);
      showError(`Failed to update meal: ${error.message}`);
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async (mealData: Pick<MealFormValues, 'name' | 'ingredients'>) => {
      if (!mealData.name) {
        showError("Please ensure the meal has a name before generating an image.");
        return null;
      }
      if (userProfile && !userProfile.is_admin && userProfile.image_generation_count >= IMAGE_GENERATION_LIMIT_PER_MONTH) {
        showError(`You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`);
        return null;
      }

      const loadingToastId = showLoading("Generating image...");
      try {
        const payload = {
          name: mealData.name,
          ingredients: mealData.ingredients?.map(ing => ({ 
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            description: ing.description,
          })) || [],
        };

        const { data, error: functionError } = await supabase.functions.invoke('generate-meal', {
          body: { mealData: payload }, 
        });

        dismissToast(loadingToastId);
        if (functionError) throw functionError;
        if (data?.error) throw new Error(data.error); 

        if (!data?.image_url) {
          throw new Error("Image URL not found in function response.");
        }
        return data as { image_url?: string };

      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error generating image:', error);
        showError(`Failed to generate image: ${error.message || 'Please try again.'}`);
        throw error; 
      }
    },
    onSuccess: (data) => {
      if (data?.image_url) {
        form.setValue('image_url', data.image_url);
        setShowImageUrlInput(false); 
        showSuccess("Image generated successfully!");
        queryClient.invalidateQueries({ queryKey: ['userProfileForEditMealImageGeneration', meal?.user_id] });
      } else if (data !== null) { 
        showError("Image generation succeeded but no image URL was returned.");
      }
    },
    onError: (error) => {
      console.error("Final error in generateImageMutation:", error);
    }
  });

  const onSubmit = (values: MealFormValues) => {
    editMealMutation.mutate(values);
  };

  const handleGenerateImageClick = async () => {
    const mealName = form.getValues('name');
    const mealIngredients = form.getValues('ingredients');
    if (!mealName) {
      showError("Please enter a meal name before generating an image.");
      return;
    }
    generateImageMutation.mutate({ name: mealName, ingredients: mealIngredients });
  };

  const handleClearImage = () => {
    form.setValue('image_url', '');
    setShowImageUrlInput(false); 
  };

  const currentImageUrl = form.watch('image_url'); 

  if (!meal) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl"> 
          <DialogHeader>
            <DialogTitle>Edit Meal</DialogTitle>
            <DialogDescription>Make changes to your meal here. Click save when you're done.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
               {meal.image_url && (
                  <div
                    className="cursor-pointer w-full h-40 flex items-center justify-center overflow-hidden rounded-md mb-4 bg-muted"
                    onClick={() => setViewingImageUrl(meal.image_url || null)}
                  >
                    <img
                      src={meal.image_url}
                      alt={`Image of ${meal.name}`}
                      className="h-full object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal Image (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {currentImageUrl ? (
                          <div className="relative w-full h-40 flex items-center justify-center overflow-hidden rounded-md bg-muted cursor-pointer"
                               onClick={() => setViewingImageUrl(currentImageUrl)}>
                            <LazyLoadImage
                              alt={`Image of ${form.getValues('name') || 'meal'}`}
                              src={currentImageUrl}
                              effect="blur"
                              wrapperClassName="h-full w-full"
                              className="h-full w-full object-contain"
                              placeholderSrc="/placeholder-image.png" 
                              onError={(e: any) => (e.currentTarget.style.display = 'none')}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute top-1 right-1 h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
                                onClick={(e) => { e.stopPropagation(); handleClearImage(); }}
                                aria-label="Clear image"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              type="button"
                              onClick={handleGenerateImageClick}
                              disabled={
                                !form.watch('name') ||
                                generateImageMutation.isPending ||
                                isLoadingUserProfile ||
                                (generationStatus && !generationStatus.isAdmin && generationStatus.limitReached) 
                              }
                              className="w-full"
                            >
                              <Brain className="mr-2 h-4 w-4" /> Generate Image with AI
                            </Button>
                            {(isLoadingUserProfile || generationStatus) && (
                              <div className="text-xs text-muted-foreground text-center">
                                <Info size={14} className="inline mr-1 flex-shrink-0" />
                                {isLoadingUserProfile && "Loading AI generation limit..."}
                                {!isLoadingUserProfile && generationStatus && (
                                  generationStatus.isAdmin
                                    ? "Admin: Limits bypassed for AI generation."
                                    : `AI Generations Used: ${generationStatus.generationsUsedThisMonth}/${IMAGE_GENERATION_LIMIT_PER_MONTH}.`
                                )}
                              </div>
                            )}
                            <div className="text-center">
                              <Button
                                type="button"
                                variant="link"
                                className="text-sm p-0 h-auto"
                                onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                                disabled={generateImageMutation.isPending}
                              >
                                <Link2 className="mr-1 h-3 w-3" />
                                {showImageUrlInput ? 'Hide URL input' : 'Or, use your own image URL'}
                              </Button>
                            </div>
                            {showImageUrlInput && (
                              <Input
                                placeholder="Paste image URL"
                                {...field}
                                value={field.value || ''} 
                                onChange={(e) => field.onChange(e.target.value)}
                                disabled={generateImageMutation.isPending}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Spaghetti Bolognese" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meal_tags"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Meal Tags</FormLabel>
                      <FormDescription>
                        Select tags that apply to this meal. These help you filter and find meals easier.
                      </FormDescription>
                    </div>
                    <div className="flex flex-wrap gap-4">
                    {MEAL_TAG_OPTIONS.map((tag) => (
                      <FormField
                        key={tag}
                        control={form.control}
                        name="meal_tags"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={tag}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(tag)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), tag])
                                      : field.onChange(
                                          (field.value || []).filter(
                                            (value) => value !== tag
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {tag}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Ingredients</FormLabel>
                <div className="space-y-4 mt-2">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-3 bg-slate-50 dark:bg-slate-800">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                         <FormField
                          control={form.control}
                          name={`ingredients.${index}.name`}
                          render={({ field: itemField }) => (
                            <FormItem className="md:col-span-4"> 
                              <FormLabel className="text-xs">Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Tomato" {...itemField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.quantity`}
                          render={({ field: itemField }) => (
                            <FormItem className="md:col-span-2"> 
                              <FormLabel className="text-xs">Qty (Optional)</FormLabel>
                              <FormControl>
                                <Input type="text" placeholder="e.g., 2 or 0" {...itemField} value={itemField.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.unit`}
                          render={({ field: itemField }) => (
                            <FormItem className="md:col-span-2"> 
                              <FormLabel className="text-xs">Unit</FormLabel>
                              <Select onValueChange={itemField.onChange} value={itemField.value || undefined}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.description`}
                          render={({ field: itemField }) => (
                            <FormItem className="md:col-span-3"> 
                              <FormLabel className="text-xs">Description (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., minced, cored" {...itemField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(index)}
                          className="md:col-span-1"
                          aria-label="Remove ingredient"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: "", quantity: "", unit: "", description: "" })}
                    className="mt-2"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Cooking steps..." {...field} rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="servings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-primary" />
                      Number of Servings (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 4 or 2-3" {...field} />
                    </FormControl>
                    <FormDescription>
                      How many people does this meal typically serve? (e.g., "4", "2-3 servings")
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimated_calories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Zap className="mr-2 h-4 w-4 text-primary" />
                      Total Estimated Calories (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2200 or 2000-2400 kcal" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the total estimated calorie count for the entire recipe (all servings). The app will display per-serving calories if servings are also provided.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={editMealMutation.isPending || generateImageMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMealMutation.isPending || generateImageMutation.isPending}>
                  {editMealMutation.isPending ? "Saving..." : (generateImageMutation.isPending ? "Generating..." : "Save Changes")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
    </>
  );
};

export default EditMealDialog;