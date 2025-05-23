import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
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
import { PlusCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox

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
});

type MealFormValues = z.infer<typeof mealFormSchema>;

const MealForm = () => {
  const queryClient = useQueryClient();

  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: "",
      ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
      instructions: "",
      meal_tags: [], // Default to empty array
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
      });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
    onError: (error) => {
      console.error("Error adding meal:", error);
      showError(`Failed to add meal: ${error.message}`);
    },
  });

  const onSubmit = (values: MealFormValues) => {
    addMealMutation.mutate(values);
  };

  return (
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
            <Button type="submit" disabled={addMealMutation.isPending} className="w-full">
              {addMealMutation.isPending ? "Adding..." : "Add Meal"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default MealForm;