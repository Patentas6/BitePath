import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, IMAGE_GENERATION_LIMIT_PER_MONTH } from "@/lib/constants";

import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Brain, XCircle, Info, Link2, Zap, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

export const UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pinch', 'dash', 'clove', 'can', 'bottle', 'package', 'slice', 'item', 'sprig', 'head', 'bunch'] as const;

const ingredientSchema = z.object({
  name: z.string().min(1, { message: "Ingredient name is required." }),
  quantity: z.string()
    .transform((val) => val.trim() === "" ? undefined : parseFloat(val))
    .refine((val) => val === undefined || (typeof val === 'number' && !isNaN(val) && val >= 0), {
      message: "Quantity must be a non-negative number if provided.",
    })
    .optional(),
  unit: z.string().optional().transform(val => val === "" ? undefined : val),
  description: z.string().optional(),
}).refine(data => {
  const hasQuantity = data.quantity !== undefined;
  const hasUnit = data.unit !== undefined && data.unit.trim() !== "";
  const isToTasteDesc = data.description?.trim().toLowerCase() === 'to taste';

  if (isToTasteDesc) {
    return !hasQuantity && !hasUnit;
  }
  if (hasQuantity && !hasUnit) return false;
  return true;
}, {
  message: "If quantity is specified, unit is required. For 'to taste', leave quantity & unit empty and write 'to taste' in description.",
  path: ["unit"],
});

export type MealFormValues = z.infer<typeof mealFormSchema>;

const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.string().optional(),
  meal_tags: z.array(z.string()).optional(),
  image_url: z.string().optional(),
  estimated_calories: z.string().optional(),
  servings: z.string()
    .min(1, { message: "Number of servings is required." })
    .refine(val => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num >= 1 && num <= 12;
    }, { message: "Please select a valid number of servings (1-12)." }),
});

export interface GenerationStatusInfo {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

interface MealFormProps {
  generationStatus?: GenerationStatusInfo;
  isLoadingProfile?: boolean;
  showCaloriesField?: boolean;
  initialData?: MealFormValues | null;
  onInitialDataProcessed?: () => void;
  onSaveSuccess?: (savedMeal: {id: string, name: string}) => void;
}

const MealForm: React.FC<MealFormProps> = ({
  generationStatus,
  isLoadingProfile,
  showCaloriesField,
  initialData,
  onInitialDataProcessed,
  onSaveSuccess,
 }) => {
  const queryClient = useQueryClient();
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: "",
      ingredients: [],
      instructions: "",
      meal_tags: [],
      image_url: "",
      estimated_calories: "",
      servings: "", 
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
      replace(initialData.ingredients || []);
      if (onInitialDataProcessed) {
        onInitialDataProcessed();
      }
    } else {
      form.reset({
        name: "",
        ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
        instructions: "",
        meal_tags: [],
        image_url: "",
        estimated_calories: "",
        servings: "",
      });
      replace([{ name: "", quantity: "", unit: "", description: "" }]);
    }
  }, [initialData, form, onInitialDataProcessed, replace]);

  const addMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not logged in.");
      }

      const ingredientsToSave = values.ingredients?.map(ing => ({
        name: ing.name,
        quantity: ing.quantity !== undefined ? ing.quantity : null,
        unit: (ing.quantity !== undefined && ing.unit) ? ing.unit : null, 
        description: ing.description,
      })).filter(ing => ing.name.trim() !== "");

      const ingredientsJSON = ingredientsToSave && ingredientsToSave.length > 0 ? JSON.stringify(ingredientsToSave) : null;

      const { data, error } = await supabase
        .from("meals")
        .insert([
          {
            user_id: user.id,
            name: values.name,
            ingredients: ingredientsJSON,
            instructions: values.instructions,
            meal_tags: values.meal_tags,
            image_url: values.image_url,
            estimated_calories: showCaloriesField ? values.estimated_calories : null,
            servings: values.servings,
          },
        ])
        .select();

      if (error) {
        throw error;
      }
      return { data, values };
    },
    onSuccess: ({ data, values }) => {
      showSuccess("Meal added successfully!");
      const savedMealEntry = data?.[0];
      if (savedMealEntry && onSaveSuccess) {
        onSaveSuccess({ id: savedMealEntry.id, name: values.name });
      } else if (onSaveSuccess) {
        onSaveSuccess({ id: 'unknown', name: values.name });
      }

      form.reset({
        name: "",
        ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
        instructions: "",
        meal_tags: [],
        image_url: "",
        estimated_calories: "",
        servings: "",
      });
      replace([{ name: "", quantity: "", unit: "", description: "" }]);
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ['userProfileForAddMealLimits'] });
      queryClient.invalidateQueries({ queryKey: ['userProfileForGenerationLimits'] });
    },
    onError: (error) => {
      console.error("Error adding meal:", error);
      showError(`Failed to add meal: ${error.message}`);
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async (mealData: MealFormValues) => {
      if (!mealData.name) {
        showError("Please enter a meal name before generating an image.");
        return null;
      }
      if (generationStatus && !generationStatus.isAdmin && generationStatus.limitReached) {
        showError(`You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`);
        return null;
      }

      const loadingToastId = showLoading("Generating image...");
      try {
        const { data, error } = await supabase.functions.invoke('generate-meal', {
          body: { mealData: mealData },
        });
        dismissToast(loadingToastId);
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
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
        showSuccess("Image generated!");
        queryClient.invalidateQueries({ queryKey: ['userProfileForAddMealLimits'] });
        queryClient.invalidateQueries({ queryKey: ['userProfileForGenerationLimits'] });
      } else {
        showError("Image generation succeeded but no image URL was returned.");
      }
    },
  });

  const onSubmit = (values: MealFormValues) => {
    addMealMutation.mutate(values);
  };

  const handleGenerateImageClick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showError("You must be logged in to generate images.");
      return;
    }
    if (!form.watch('name')) {
      showError("Please enter a meal name before generating an image.");
      return;
    }
    const currentMealData = form.getValues();
    generateImageMutation.mutate(currentMealData);
  };

  const handleClearImage = () => {
    form.setValue('image_url', '');
  };

  const currentImageUrl = form.watch('image_url');
  const servingOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add New Meal</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                          )
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
                    <Card key={field.id} className="p-3 bg-muted">
                      <div className="grid grid-cols-1 md:grid-cols-10 gap-2 items-end">
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.name`}
                          render={({ field: itemField }) => (
                            <FormItem className="md:col-span-3">
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
                            <FormItem className="md:col-span-1">
                              <FormLabel className="text-xs">Qty (Optional)</FormLabel>
                              <FormControl>
                                <Input type="text" placeholder="e.g., 2" {...itemField} value={itemField.value ?? ""} />
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
                              <FormLabel className="text-xs">Unit (Optional)</FormLabel>
                              <Select onValueChange={itemField.onChange} value={itemField.value || undefined} >
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
                              <FormLabel className="text-xs">Desc. (e.g., to taste)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., minced, to taste" {...itemField} />
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
                    Number of Servings
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select number of servings" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {servingOptions.map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select how many people this meal typically serves. This field is required.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showCaloriesField && (
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
                            alt="Meal preview"
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
                              isLoadingProfile ||
                              (generationStatus && !generationStatus.isAdmin && generationStatus.limitReached)
                            }
                            className="w-full"
                          >
                            <Brain className="mr-2 h-4 w-4" /> Generate Image with AI
                          </Button>
                          <div className="text-xs text-muted-foreground text-center">
                            <Info size={14} className="inline mr-1 flex-shrink-0" />
                            {generationStatus && !isLoadingProfile && (
                              generationStatus.isAdmin
                                ? "Admin: Limits bypassed for AI generation."
                                : `AI Generations Used: ${generationStatus.generationsUsedThisMonth}/${IMAGE_GENERATION_LIMIT_PER_MONTH}.`
                            )}
                            {isLoadingProfile && "Loading AI generation limit..."}
                          </div>
                        </>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={addMealMutation.isPending || generateImageMutation.isPending} className="w-full">
              {addMealMutation.isPending ? "Adding..." : "Add Meal"}
            </Button>
          </form>
        </Form>
        </CardContent>
      </Card>

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

export default MealForm;