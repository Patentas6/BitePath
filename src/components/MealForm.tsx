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
import { PlusCircle, Trash2, Brain, XCircle, Info, Link2, Zap } from "lucide-react"; // Added Zap
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

export const UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pinch', 'dash', 'clove', 'can', 'bottle', 'package', 'slice', 'item', 'sprig', 'head', 'bunch'] as const;

const ingredientSchema = z.object({
  name: z.string().min(1, { message: "Ingredient name is required." }),
  quantity: z.union([
    z.coerce.number().positive({ message: "Quantity must be a positive number." }),
    z.literal("").transform(() => undefined), 
    z.null().transform(() => undefined) 
  ]).optional(),
  unit: z.string().min(1, { message: "Unit is required." }),
  description: z.string().optional(),
}).refine(data => {
  return data.quantity === undefined || (data.quantity !== undefined && data.unit && data.unit.trim() !== "");
}, {
  message: "Unit is required if quantity is specified.",
  path: ["unit"],
});


const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.string().optional(),
  meal_tags: z.array(z.string()).optional(),
  image_url: z.string().optional(),
  estimated_calories: z.string().optional(), // Added estimated_calories
});

type MealFormValues = z.infer<typeof mealFormSchema>;

export interface GenerationStatusInfo {
  generationsUsedThisMonth: number;
  limitReached: boolean;
  isAdmin: boolean;
}

interface MealFormProps {
  generationStatus?: GenerationStatusInfo;
  isLoadingProfile?: boolean;
}

const MealForm: React.FC<MealFormProps> = ({ generationStatus, isLoadingProfile }) => {
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
      image_url: "",
      estimated_calories: "", // Added default
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  const addMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not logged in.");
      }

      const ingredientsToSave = values.ingredients?.map(ing => ({
        name: ing.name,
        quantity: (ing.quantity === undefined || ing.quantity === "") ? null : parseFloat(ing.quantity as any),
        unit: (ing.quantity === undefined || ing.quantity === "") ? "" : ing.unit,
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
            estimated_calories: values.estimated_calories, // Save estimated_calories
          },
        ])
        .select();

      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal added successfully!");
      form.reset({
        name: "",
        ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
        instructions: "",
        meal_tags: [],
        image_url: "",
        estimated_calories: "", // Reset estimated_calories
      });
      setShowImageUrlInput(false); // Reset this state too
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
        setShowImageUrlInput(false); // Hide input if image was generated
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
    setShowImageUrlInput(false); // Reset to default state
  };

  const currentImageUrl = form.watch('image_url'); 

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
                                <Input type="number" placeholder="e.g., 2" {...itemField} value={itemField.value === undefined ? "" : itemField.value} step="any" />
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
                              <FormLabel className="text-xs">Description (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., minced, finely chopped" {...itemField} />
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
              name="estimated_calories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-primary" />
                    Estimated Calories (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 550 or 500-600 kcal" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter a number or a range for the meal's estimated calorie count.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          <img
                            src={currentImageUrl}
                            alt="Meal preview"
                            className="h-full object-contain"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
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
                            className="w-full" // Make generate button prominent
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

                          <div className="text-center">
                            <Button 
                              type="button" 
                              variant="link" 
                              className="text-sm p-0 h-auto"
                              onClick={() => setShowImageUrlInput(!showImageUrlInput)}
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

            <Button type="submit" disabled={addMealMutation.isPending || generateImageMutation.isPending} className="w-full">
              {addMealMutation.isPending ? "Adding..." : "Add Meal"}
            </Button>
          </form>
        </Form>
        </CardContent>
      </Card>

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

export default MealForm;