"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, PlusCircle } from 'lucide-react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';

// Updated Zod schema: servings is a required string (from Select)
const mealSchema = z.object({
  mealName: z.string().min(1, "Meal name is required"),
  ingredients: z.string().min(1, "Ingredients are required"),
  instructions: z.string().min(1, "Instructions are required"),
  servings: z.string().min(1, "Number of servings is required"), 
  mealTags: z.string().optional(),
  estimatedCalories: z.string().optional(),
});

type MealFormData = z.infer<typeof mealSchema>;

const AddMealPage: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { control, handleSubmit, formState: { errors } } = useForm<MealFormData>({
    resolver: zodResolver(mealSchema),
    defaultValues: {
      mealName: '',
      ingredients: '',
      instructions: '',
      servings: '2', // Default to "2" servings
      mealTags: '',
      estimatedCalories: '',
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        toast({ title: "Error", description: "You must be logged in to add a meal.", variant: "destructive" });
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate, toast]);

  const onSubmit: SubmitHandler<MealFormData> = async (data) => {
    if (!userId) {
      toast({ title: "Error", description: "User not identified. Please log in again.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    try {
      const mealToInsert = {
        user_id: userId,
        name: data.mealName,
        ingredients: data.ingredients,
        instructions: data.instructions,
        servings: data.servings, // Value comes directly from the Select component
        meal_tags: data.mealTags?.split(',').map(tag => tag.trim()).filter(tag => tag) || [],
        estimated_calories: data.estimatedCalories,
        image_url: null, // Image URL is no longer collected from this form
      };

      console.log("Saving manual meal:", mealToInsert);

      const { error } = await supabase.from('meals').insert([mealToInsert]);

      if (error) throw error;

      toast({ title: "Meal Added!", description: `${data.mealName} has been successfully added.` });
      navigate('/my-meals'); 
    } catch (error: any) {
      console.error("Error saving meal:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Could not save meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><PlusCircle className="mr-2 h-6 w-6 text-primary" /> Add New Meal Manually</CardTitle>
          <CardDescription>Enter the details of your meal below. Number of servings is required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="mealName">Meal Name</Label>
              <Controller
                name="mealName"
                control={control}
                render={({ field }) => <Input id="mealName" placeholder="e.g., Chicken Stir-fry" {...field} />}
              />
              {errors.mealName && <p className="text-sm text-red-500 mt-1">{errors.mealName.message}</p>}
            </div>

            {/* Servings input is now a Select component */}
            <div>
              <Label htmlFor="servings">Number of Servings</Label>
              <Controller
                name="servings"
                control={control}
                defaultValue="2" // Ensure a default value is set for the controller
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="servings">
                      <SelectValue placeholder="Select number of servings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Serving</SelectItem>
                      <SelectItem value="2">2 Servings</SelectItem>
                      <SelectItem value="3">3 Servings</SelectItem>
                      <SelectItem value="4">4 Servings</SelectItem>
                      <SelectItem value="5">5 Servings</SelectItem>
                      <SelectItem value="6">6 Servings</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.servings && <p className="text-sm text-red-500 mt-1">{errors.servings.message}</p>}
            </div>

            <div>
              <Label htmlFor="ingredients">Ingredients</Label>
              <Controller
                name="ingredients"
                control={control}
                render={({ field }) => <Textarea id="ingredients" placeholder="List each ingredient on a new line, e.g.,&#10;1 cup rice&#10;2 chicken breasts&#10;1 tbsp soy sauce" rows={8} {...field} />}
              />
              {errors.ingredients && <p className="text-sm text-red-500 mt-1">{errors.ingredients.message}</p>}
            </div>

            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Controller
                name="instructions"
                control={control}
                render={({ field }) => <Textarea id="instructions" placeholder="List each step on a new line, e.g.,&#10;1. Cook rice according to package directions.&#10;2. Cut chicken into pieces.&#10;3. Stir-fry chicken until cooked." rows={10} {...field} />}
              />
              {errors.instructions && <p className="text-sm text-red-500 mt-1">{errors.instructions.message}</p>}
            </div>
            
            <div>
              <Label htmlFor="estimatedCalories">Estimated Calories (Optional)</Label>
              <Controller
                name="estimatedCalories"
                control={control}
                render={({ field }) => <Input id="estimatedCalories" placeholder="e.g., 450 kcal" {...field} />}
              />
              {errors.estimatedCalories && <p className="text-sm text-red-500 mt-1">{errors.estimatedCalories.message}</p>}
            </div>

            <div>
              <Label htmlFor="mealTags">Meal Tags (Optional, comma-separated)</Label>
              <Controller
                name="mealTags"
                control={control}
                render={({ field }) => <Input id="mealTags" placeholder="e.g., quick, healthy, dinner, vegetarian" {...field} />}
              />
            </div>

            {/* The input field for Image URL has been completely removed from this form. */}

            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Add Meal
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddMealPage;