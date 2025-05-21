import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";

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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Define validation schema for the meal form (can be reused or adapted)
const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.string().optional(),
  instructions: z.string().optional(),
});

type MealFormValues = z.infer<typeof mealFormSchema>;

export interface MealForEditing {
  id: string;
  name: string;
  ingredients?: string | null; // Allow null from DB
  instructions?: string | null; // Allow null from DB
  user_id: string; // To ensure user owns the meal
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
      ingredients: "",
      instructions: "",
    },
  });

  useEffect(() => {
    if (meal && open) {
      form.reset({
        name: meal.name,
        ingredients: meal.ingredients || "",
        instructions: meal.instructions || "",
      });
    }
  }, [meal, open, form]);

  const editMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      if (!meal) throw new Error("No meal selected for editing.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== meal.user_id) {
        throw new Error("You can only edit your own meals.");
      }

      const { data, error } = await supabase
        .from("meals")
        .update({
          name: values.name,
          ingredients: values.ingredients,
          instructions: values.instructions,
        })
        .eq("id", meal.id)
        .eq("user_id", user.id) // Ensure user owns the meal they are updating
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      // Potentially invalidate mealPlans and groceryList if ingredients change often
      // For simplicity, we'll start with just invalidating meals
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Meal</DialogTitle>
          <DialogDescription>Make changes to your meal here. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
              name="ingredients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredients</FormLabel>
                  <FormControl>
                    <Textarea placeholder="List ingredients..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Cooking steps..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
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