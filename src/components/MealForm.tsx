import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";

import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Define validation schema for the meal form
const mealFormSchema = z.object({
  name: z.string().min(1, { message: "Meal name is required." }),
  ingredients: z.string().optional(),
  instructions: z.string().optional(),
});

type MealFormValues = z.infer<typeof mealFormSchema>;

const MealForm = () => {
  const queryClient = useQueryClient();

  const form = useForm<MealFormValues>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: "",
      ingredients: "",
      instructions: "",
    },
  });

  // Mutation to add a new meal
  const addMealMutation = useMutation({
    mutationFn: async (values: MealFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not logged in.");
      }

      const { data, error } = await supabase
        .from("meals")
        .insert([
          {
            user_id: user.id,
            name: values.name,
            ingredients: values.ingredients,
            instructions: values.instructions,
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
      form.reset(); // Clear the form
      queryClient.invalidateQueries({ queryKey: ["meals"] }); // Invalidate the meals query to refetch
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <Button type="submit" disabled={addMealMutation.isPending}>
              {addMealMutation.isPending ? "Adding..." : "Add Meal"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default MealForm;