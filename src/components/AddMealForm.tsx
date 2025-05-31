"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { parseServings } from "@/utils/servingUtils";

// Updated schema: removed image_url
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Meal name must be at least 2 characters.",
  }),
  ingredients: z.string().min(10, {
    message: "Ingredients must be at least 10 characters.",
  }),
  instructions: z.string().min(10, {
    message: "Instructions must be at least 10 characters.",
  }),
  meal_tags: z.array(z.string()).optional(),
  servings: z.coerce
    .number({ invalid_type_error: "Servings must be a number." })
    .min(1, "Servings must be at least 1.")
    .int("Servings must be a whole number."),
  estimated_calories: z.string().optional(),
});

export type AddMealFormValues = z.infer<typeof formSchema>;

interface AddMealFormProps {
  initialData?: Partial<Omit<AddMealFormValues, 'servings'>> & { id?: string; servings?: string | number };
  onSuccess?: () => void;
}

export function AddMealForm({ initialData, onSuccess }: AddMealFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTag, setCurrentTag] = useState("");

  const form = useForm<AddMealFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      ingredients: initialData?.ingredients || "",
      instructions: initialData?.instructions || "",
      meal_tags: initialData?.meal_tags || [],
      servings: initialData?.servings ? parseServings(initialData.servings) : 1,
      estimated_calories: initialData?.estimated_calories || "",
    },
  });

  const handleAddTag = () => {
    if (currentTag.trim() !== "") {
      const currentTags = form.getValues("meal_tags") || [];
      if (!currentTags.includes(currentTag.trim())) {
        form.setValue("meal_tags", [...currentTags, currentTag.trim()]);
        setCurrentTag("");
      } else {
        toast.info("Tag already added.");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues("meal_tags") || [];
    form.setValue("meal_tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  async function onSubmit(values: AddMealFormValues) {
    if (!user) {
      toast.error("You must be logged in to add a meal.");
      return;
    }
    setIsLoading(true);
    try {
      const mealData = {
        user_id: user.id,
        name: values.name,
        ingredients: values.ingredients,
        instructions: values.instructions,
        meal_tags: values.meal_tags,
        servings: String(values.servings), 
        estimated_calories: values.estimated_calories,
      };

      let error;
      if (initialData?.id) {
        const { error: updateError } = await supabase
          .from("meals")
          .update(mealData)
          .eq("id", initialData.id)
          .eq("user_id", user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("meals")
          .insert(mealData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      toast.success(initialData?.id ? "Meal updated successfully!" : "Meal added successfully!");
      form.reset();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/my-meals");
      }
      router.refresh();
    } catch (error: any) {
      console.error("Error submitting meal:", error);
      toast.error(`Failed to ${initialData?.id ? 'update' : 'add'} meal: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* TEMPORARY VISUAL MARKER - REMOVE LATER */}
      <h1 style={{ color: 'red', fontSize: '24px', fontWeight: 'bold', border: '2px solid red', padding: '10px', margin: '10px 0' }}>
        ADDMEALFORM.TSX UPDATED - TEST MARKER
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meal Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Chicken Alfredo" {...field} />
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
                <FormLabel>Number of Servings</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="e.g., 2" // Updated placeholder
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Enter a whole number for how many portions this recipe makes (e.g., 1, 2, 4).
                </FormDescription>
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
                  <Textarea
                    placeholder="List all ingredients, one per line if possible. e.g.,&#10;1 cup flour&#10;2 eggs&#10;100g chicken breast"
                    className="min-h-[150px]"
                    {...field}
                  />
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
                  <Textarea
                    placeholder="Provide step-by-step cooking instructions."
                    className="min-h-[150px]"
                    {...field}
                  />
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
                <FormLabel>Estimated Calories (per serving)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 550" {...field} />
                </FormControl>
                <FormDescription>
                  Optional: Estimated calories for one serving of the meal.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Image URL FormField has been removed */}

          <FormField
            control={form.control}
            name="meal_tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meal Tags</FormLabel>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., breakfast, quick, vegan"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
                <FormDescription>
                  Add tags to help categorize your meal. Press Enter or click + to add.
                </FormDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                  {field.value?.map((tag) => (
                    <span key={tag} className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-sm flex items-center">
                      {tag}
                      <Button type="button" variant="ghost" size="xs" className="ml-1" onClick={() => handleRemoveTag(tag)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </span>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (initialData?.id ? "Updating Meal..." : "Adding Meal...") : (initialData?.id ? "Update Meal" : "Add Meal")}
          </Button>
        </form>
      </Form>
    </>
  );
}