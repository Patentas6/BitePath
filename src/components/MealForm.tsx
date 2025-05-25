import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast"; // Import toast utilities
import { MEAL_TAG_OPTIONS, MealTag } from "@/lib/constants"; // Import tags

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, // Added for tag description
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, Brain, XCircle } from "lucide-react"; // Import Brain and XCircle icons
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Dialog, DialogContent } from "@/components/ui/dialog"; // Import Dialog components for image viewer
import { useState } from "react"; // Import useState

export const UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pinch', 'dash', 'clove', 'can', 'bottle', 'package', 'slice', 'item', 'sprig', 'head', 'bunch'] as const;

const ingredientSchema = z.object({
  name: z.string().min(1, { message: "Ingredient name is required." }),
  quantity: z.coerce.number().positive({ message: "Quantity must be a positive number." }),
  unit: z.string().min(1, { message: "Unit is required." }),
  description: z.string().optional(),
});

const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.string().optional(),
  meal_tags: z.array(z.string()).optional(), // Added meal_tags
  image_url: z.string().optional(), // Added image_url field
});

type MealFormValues = z.infer<typeof mealFormSchema>;

const MealForm = () => {
  const queryClient = useQueryClient();
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null); // State for enlarged image view

  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: "",
      ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
      instructions: "",
      meal_tags: [], // Default to empty array
      image_url: "", // Default image_url
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

      const ingredientsJSON = values.ingredients ? JSON.stringify(values.ingredients) : null;

      const { data, error } = await supabase
        .from("meals")
        .insert([
          {
            user_id: user.id,
            name: values.name,
            ingredients: ingredientsJSON,
            instructions: values.instructions,
            meal_tags: values.meal_tags, // Save tags
            image_url: values.image_url, // Save the image URL from the form
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
        meal_tags: [], // Reset tags
        image_url: "", // Reset image URL
      });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
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
      const loadingToastId = showLoading("Generating image...");
      try {
        const { data, error } = await supabase.functions.invoke('generate-meal', {
          body: { mealData: mealData }, // Send mealData to the function
        });
        dismissToast(loadingToastId);
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data as { image_url?: string }; // Expecting just the image_url back
      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error generating image:', error);
        showError(`Failed to generate image: ${error.message || 'Please try again.'}`);
        throw error; // Re-throw to let useMutation handle it
      }
    },
    onSuccess: (data) => {
      if (data?.image_url) {
        form.setValue('image_url', data.image_url); // Set the generated image URL in the form
        showSuccess("Image generated!");
      } else {
        showError("Image generation succeeded but no image URL was returned.");
      }
    },
    onError: (error) => {
       // Error handled in mutationFn catch block with toast
    }
  });

  const onSubmit = (values: MealFormValues) => {
    addMealMutation.mutate(values);
  };

  const handleGenerateImage = () => {
    const currentMealData = form.getValues(); // Get current form values
    generateImageMutation.mutate(currentMealData);
  };

  const handleClearImage = () => {
    form.setValue('image_url', ''); // Clear the image URL in the form
  };

  const currentImageUrl = form.watch('image_url'); // Watch the image_url field

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

              {/* Meal Tags Checkboxes */}
              <FormField
                control={form.control}
                name="meal_tags"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Meal Tags</FormLabel>
                      <FormDescription>
                        Select tags that apply to this meal (e.g., for breakfast, lunch).
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
                    <Card key={field.id} className="p-3 bg-muted"> {/* Changed bg-slate-50 to bg-muted */}
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
                              <FormLabel className="text-xs">Qty</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 2" {...itemField} step="any" />
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
                              <Select onValueChange={itemField.onChange} defaultValue={itemField.value}>
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

            {/* Image Generation and Preview */}
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meal Image (Optional)</FormLabel>
                  <FormControl>
                    <div className="flex flex-col space-y-2">
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
                              onClick={(e) => { e.stopPropagation(); handleClearImage(); }} // Prevent modal on clear click
                              aria-label="Clear image"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                      ) : (
                         <div className="flex items-center space-x-2">
                            <Input
                              placeholder="Paste image URL or generate below"
                              {...field}
                              value={field.value || ''} // Ensure value is controlled
                            />
                            <Button
                              type="button"
                              onClick={handleGenerateImage}
                              disabled={!form.watch('name') || generateImageMutation.isPending} // Disable if no name or generating
                              variant="outline"
                            >
                              <Brain className="mr-2 h-4 w-4" /> Generate Image
                            </Button>
                         </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Add an image URL or use AI to generate one based on the meal name.
                  </FormDescription>
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

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImageUrl} onOpenChange={(open) => !open && setViewingImageUrl(null)}>
        <DialogContent className="max-w-screen-md w-[90vw] h-[90vh] p-0 flex items-center justify-center bg-transparent border-none">
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged meal image"
              className="max-w-full max-h-full object-contain" // Ensure image fits within dialog
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MealForm;