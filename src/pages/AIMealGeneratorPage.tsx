import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import BottomNavBar from "@/components/BottomNavBar"; // Import BottomNavBar
import type { User } from "@supabase/supabase-js";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface GeneratedMeal {
  name: string;
  ingredients: { name: string; quantity: number; unit: string; description?: string }[];
  instructions: string;
  meal_tags?: string[];
}

const AIMealGeneratorPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState('');
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    };
    getSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });
    return () => authListener?.subscription.unsubscribe();
  }, [navigate]);

  const generateMealMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      if (!user) throw new Error("User not logged in.");
      if (!userPrompt.trim()) throw new Error("Please enter a prompt.");

      const loadingToastId = showLoading("Generating meal...");

      try {
        // Call the Edge Function
        const { data, error } = await supabase.functions.invoke('generate-meal', {
          method: 'POST',
          body: { prompt: userPrompt },
        });

        dismissToast(loadingToastId);

        if (error) {
          console.error("Edge Function error:", error);
          throw new Error(error.message || "Failed to generate meal.");
        }

        // Assuming the Edge Function returns { meal: GeneratedMeal } or { error: string }
        if (data?.error) {
           throw new Error(data.error);
        }

        if (!data?.meal) {
           throw new Error("AI did not return a valid meal structure.");
        }

        return data.meal as GeneratedMeal;

      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error calling generate-meal function:', error);
        throw new Error(`Generation failed: ${error.message || 'An unexpected error occurred.'}`);
      }
    },
    onSuccess: (mealData) => {
      setGeneratedMeal(mealData);
      showSuccess("Meal generated!");
    },
    onError: (error) => {
      console.error("Error generating meal:", error);
      showError(`Failed to generate meal: ${error.message}`);
      setGeneratedMeal(null); // Clear previous result on error
    },
  });

  const saveMealMutation = useMutation({
    mutationFn: async (meal: GeneratedMeal) => {
      if (!user) throw new Error("User not logged in.");

      const ingredientsJSON = meal.ingredients ? JSON.stringify(meal.ingredients) : null;

      const { data, error } = await supabase
        .from("meals")
        .insert([
          {
            user_id: user.id,
            name: meal.name,
            ingredients: ingredientsJSON,
            instructions: meal.instructions,
            meal_tags: meal.meal_tags,
          },
        ])
        .select();

      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: (data, vars) => {
      showSuccess(`"${vars.name}" saved to My Meals!`);
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      // Optionally clear the generated meal or navigate
      setGeneratedMeal(null);
      setPrompt('');
    },
    onError: (error) => {
      console.error("Error saving meal:", error);
      showError(`Failed to save meal: ${error.message}`);
    },
  });

  const handleGenerateClick = () => {
    generateMealMutation.mutate(prompt);
  };

  const handleSaveClick = () => {
    if (generatedMeal) {
      saveMealMutation.mutate(generatedMeal);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
      <div className="container mx-auto space-y-6 flex-grow">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-[#7BB390] dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-[#FC5A50] dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center"><Sparkles className="mr-2 h-6 w-6 text-teal-600" /> AI Meal Generator</h1>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Generate a Meal Idea</CardTitle>
            <CardDescription>Tell the AI what kind of meal you're looking for!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., 'A quick weeknight pasta dish with chicken and broccoli', 'A healthy vegetarian soup for lunch', 'A fancy dessert for a special occasion'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={generateMealMutation.isPending}
            />
            <Button
              onClick={handleGenerateClick}
              disabled={generateMealMutation.isPending || !prompt.trim()}
              className="w-full"
            >
              {generateMealMutation.isPending ? 'Generating...' : 'Generate Meal Idea'}
            </Button>
          </CardContent>
        </Card>

        {generateMealMutation.isPending && (
           <Card className="hover:shadow-lg transition-shadow duration-200">
             <CardHeader><CardTitle>Generated Meal</CardTitle></CardHeader>
             <CardContent className="space-y-4">
               <Skeleton className="h-8 w-3/4" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-20 w-full" />
               <Skeleton className="h-20 w-full" />
               <Skeleton className="h-10 w-full" />
             </CardContent>
           </Card>
        )}

        {generatedMeal && !generateMealMutation.isPending && (
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle>{generatedMeal.name}</CardTitle>
              {generatedMeal.meal_tags && generatedMeal.meal_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {generatedMeal.meal_tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Ingredients:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {generatedMeal.ingredients && generatedMeal.ingredients.length > 0 ? (
                    generatedMeal.ingredients.map((ing, index) => (
                      <li key={index}>
                        {ing.quantity} {ing.unit} {ing.name}{ing.description ? ` (${ing.description})` : ''}
                      </li>
                    ))
                  ) : (
                    <li>No ingredients provided by AI.</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Instructions:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {generatedMeal.instructions || 'No instructions provided by AI.'}
                </p>
              </div>
              <Button
                onClick={handleSaveClick}
                disabled={saveMealMutation.isPending}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" /> {saveMealMutation.isPending ? 'Saving...' : 'Save to My Meals'}
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
      <BottomNavBar /> {/* Add BottomNavBar */}
    </div>
  );
};

export default AIMealGeneratorPage;