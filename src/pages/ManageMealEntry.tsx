"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { MealForm, MealFormData } from '@/components/MealForm';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateRecipeWithAI, generateImageWithAI } from '@/lib/aiUtils';
import { useSupabaseUser } from '@/integrations/supabase/hooks/useSupabaseUser';

const ManageMealEntry: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const mealId = params?.id as string | undefined;
  const isEditing = !!mealId;
  const [initialData, setInitialData] = useState<Partial<MealFormData & { id?: string }>>();
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [aiRecipePrompt, setAiRecipePrompt] = useState('');
  const { user } = useSupabaseUser();

  const fetchMeal = useCallback(async (id: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Failed to fetch meal details: ' + error.message);
      router.push('/my-meals');
    } else if (data) {
      setInitialData({
        id: data.id,
        name: data.name,
        ingredients: data.ingredients || '',
        instructions: data.instructions || '',
        meal_tags: data.meal_tags || [],
        imageUrl: data.image_url || '',
        servings: data.servings || '',
        estimated_calories: data.estimated_calories || '',
      });
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    if (isEditing && mealId) {
      fetchMeal(mealId);
    }
  }, [isEditing, mealId, fetchMeal]);

  const handleFormSubmit = async (formData: MealFormData) => {
    if (!user) {
      toast.error("You must be logged in to manage meals.");
      return;
    }

    const mealData = {
      user_id: user.id,
      name: formData.name,
      ingredients: formData.ingredients,
      instructions: formData.instructions,
      meal_tags: formData.meal_tags,
      image_url: formData.imageUrl,
      servings: formData.servings,
      estimated_calories: formData.estimated_calories,
    };

    try {
      let response;
      if (isEditing && mealId) {
        response = await supabase.from('meals').update(mealData).eq('id', mealId).select().single();
        if (response.error) throw response.error;
        toast.success('Meal updated successfully!');
      } else {
        response = await supabase.from('meals').insert(mealData).select().single();
        if (response.error) throw response.error;
        toast.success('Meal added successfully!');
      }
      
      if (response.data) {
        // Redirect to the meal detail page or my-meals page
        router.push(`/my-meals/${response.data.id}`);
      } else {
        router.push('/my-meals');
      }

    } catch (error: any) {
      console.error('Error saving meal:', error);
      toast.error(`Error saving meal: ${error.message}`);
    }
  };

  const handleGenerateRecipe = async () => {
    if (!aiRecipePrompt.trim()) {
      toast.error("Please enter a prompt for the AI recipe generation.");
      return;
    }
    setIsGeneratingRecipe(true);
    try {
      const recipe = await generateRecipeWithAI(aiRecipePrompt);
      if (recipe) {
        setInitialData(prevData => ({
          ...prevData,
          name: recipe.name || prevData?.name || '',
          ingredients: recipe.ingredients || prevData?.ingredients || '',
          instructions: recipe.instructions || prevData?.instructions || '',
          servings: recipe.servings || prevData?.servings || '',
          estimated_calories: recipe.estimated_calories || prevData?.estimated_calories || '',
          meal_tags: recipe.meal_tags || prevData?.meal_tags || [],
        }));
        toast.success("AI recipe generated! Fill in any remaining details.");
      } else {
        toast.error("Failed to generate recipe. Please try again.");
      }
    } catch (error: any) {
      toast.error(`Recipe generation failed: ${error.message}`);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };
  
  const handleGenerateImageForForm = async (prompt: string): Promise<string | null> => {
    if (!user) {
        toast.error("You must be logged in to generate images.");
        return null;
    }
    // Here you might want to check user's image generation limits if implemented
    try {
        const imageUrl = await generateImageWithAI(prompt, user.id);
        if (imageUrl) {
            // Optionally update profile with new generation count if that logic is here
            // await supabase.rpc('increment_user_image_generation_count', { p_user_id: user.id });
            return imageUrl;
        }
        return null;
    } catch (error: any) {
        console.error("Error in handleGenerateImageForForm:", error);
        toast.error(error.message || "Failed to generate image.");
        return null;
    }
  };


  if (isLoading && isEditing) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading meal details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {isEditing ? 'Edit Meal' : 'Add New Meal'}
      </h1>

      {!isEditing && (
        <div className="mb-8 p-4 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-3">Generate Recipe with AI</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiRecipePrompt}
              onChange={(e) => setAiRecipePrompt(e.target.value)}
              placeholder="e.g., 'Quick healthy chicken stir-fry'"
              className="flex-grow p-2 border rounded-md"
              disabled={isGeneratingRecipe}
            />
            <Button
              onClick={handleGenerateRecipe}
              disabled={isGeneratingRecipe || !aiRecipePrompt.trim()}
              className="w-full sm:w-auto"
            >
              {isGeneratingRecipe ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Generate Recipe
            </Button>
          </div>
          {isGeneratingRecipe && <p className="text-sm text-muted-foreground mt-2">Generating, please wait...</p>}
        </div>
      )}

      <MealForm 
        onSubmit={handleFormSubmit} 
        defaultValues={initialData} 
        isEditing={isEditing}
        onGenerateImageWithAI={handleGenerateImageForForm}
      />
    </div>
  );
};

export default ManageMealEntry;