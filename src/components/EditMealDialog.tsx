import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag } from "@/lib/constants"; // Import tags

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
  FormDescription, // Added for tag description
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { UNITS } from "./MealForm"; // Assuming UNITS is exported from MealForm or a constants file

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

export interface MealForEditing {
  id: string;
  name: string;
  ingredients?: string | null;
  instructions?: string | null;
  user_id: string;
  meal_tags?: string[] | null; // Expect tags from DB
}

interface EditMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealForEditing | null;
}

const EditMealDialog: React.FC<EditMealDialogProps> = ({ open, onOpenChange, meal }) => {
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

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  useEffect(() => {
    if (meal && open) {
      let parsedIngredients = [{ name: "", quantity: "", unit: "", description: "" }];
      if (meal.ingredients) {
        try {
          const parsed = JSON.parse(meal.ingredients);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsedIngredients = parsed.map(item => ({
              name: item.name || "",
              quantity: item.quantity || "",
              unit: item.unit || "",
              description: item.description || "",
            }));
          } else if (Array.isArray(parsed) && parsed.length === 0) {
             parsedIngredients = [{ name: "", quantity: "", unit: "", description: "" }];
          }
        } catch (e) {
          console.warn("Failed to parse ingredients JSON, starting fresh for this meal:", e);
        }
      }
      
      form.reset({
        name: meal.name,
        ingredients: parsedIngredients,
        instructions: meal.instructions || "",
        meal_tags: meal.meal_tags || [], // Populate tags
      });
    } else if (!open) {
      form.reset({
        name: "",
        ingredients: [{ name: "", quantity: "", unit: "", description: "" }],
        instructions: "",
        meal_tags: [],
      });
    }
  }, [meal, open, form, replace]);

  const editMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      if (!meal) throw new Error("No meal selected for editing.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== meal.user_id) {
        throw new Error("You can only edit your own meals.");
      }

      const ingredientsJSON = values.ingredients ? JSON.stringify(values.ingredients) : null;

      const { data, error } = await supabase
        .from("meals")
        .update({
          name: values.name,
          ingredients: ingredientsJSON,
          instructions: values.instructions,
          meal_tags: values.meal_tags, // Save tags
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
      queryClient.invalidateQueries({ queryKey: ["groceryList"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating meal:", error);
      showError(`Failed to update meal: ${error.message}`);
    },
  });

  const onSubmit = (values: MealFormValues) => {
    editMealMutation.mutate(values);
  };

  if (!meal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Meal</DialogTitle>
          <DialogDescription>Make changes to your meal here. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
                      Select tags that apply to this meal.
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
                  <Card key={field.id} className="p-3 bg-slate-50">
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
                              <Input type="number" placeholder="e.g., 2" {...itemField} step="any"/>
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
            <DialogFooter className="mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={editMealMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMealMutation.isPending}>
                {editMealMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMealDialog;