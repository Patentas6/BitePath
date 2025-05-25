import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Brain, Save, RefreshCw } from 'lucide-react';
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { MEAL_TAG_OPTIONS, MealTag } from "@/lib/constants";
import { Dialog, DialogContent } from "@/components/ui/dialog"; // Import Dialog components

// Define types for the generated meal structure
interface GeneratedIngredient {
  name: string;
  quantity: number;
  unit: string;
  description?: string;
}

interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[];
  instructions: string;
  meal_tags: string[];
  image_url?: string; // Added image_url field
}

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealKinds = ["High Protein", "Vegan", "Vegetarian", "Gluten-Free", "Low Carb", "Kid-Friendly", "Spicy"];
const mealStyles = ["Simple", "Fast (under 30 min)", "1 Pan", "Chef Inspired", "Comfort Food", "Healthy"];

const GenerateMealPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [ingredientPreferences, setIngredientPreferences] = useState('');

  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null); // State for enlarged image view

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
      if (!data.user) {
        navigate("/auth"); // Redirect if not logged in
      }
    };
    fetchUser();
  }, [navigate]);

  const handleKindChange = (kind: string, checked: boolean) => {
    setSelectedKinds(prev =>
      checked ? [...prev, kind] : prev.filter(k => k !== kind)
    );
  };

  const handleStyleChange = (style: string, checked: boolean) => {
    setSelectedStyles(prev =>
      checked ? [...prev, style] : prev.filter(s => s !== style)
    );
  };

  const generateMealMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      if (!selectedMealType) {
        showError("Please select a meal type.");
        return null;
      }

      setIsGenerating(true);
      const loadingToastId = showLoading("Generating meal and image...");

      try {
        const { data, error } = await supabase.functions.invoke('generate-meal', {
          body: {
            mealType: selectedMealType,
            kinds: selectedKinds,
            styles: selectedStyles,
            preferences: ingredientPreferences,
          },
        });

        dismissToast(loadingToastId);

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setGeneratedMeal(data as GeneratedMeal);
        showSuccess("Meal and image generated!");
        return data;

      } catch (error: any) {
        dismissToast(loadingToastId);
        console.error('Error generating meal:', error);
        showError(`Failed to generate meal: ${error.message || 'Please try again.'}`);
        setGeneratedMeal(null); // Clear previous result on error
        throw error; // Re-throw to let useMutation handle it
      } finally {
        setIsGenerating(false);
      }
    },
  });

  const saveMealMutation = useMutation({
    mutationFn: async (mealToSave: GeneratedMeal) => {
      if (!userId) throw new Error("User not authenticated.");

      const ingredientsJSON = mealToSave.ingredients ? JSON.stringify(mealToSave.ingredients) : null;

      const { data, error } = await supabase
        .from("meals")
        .insert([
          {
            user_id: userId,
            name: mealToSave.name,
            ingredients: ingredientsJSON,
            instructions: mealToSave.instructions,
            meal_tags: mealToSave.meal_tags,
            image_url: mealToSave.image_url, // Save the image URL
          },
        ])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      showSuccess(`"${vars.name}" saved to My Meals!`);
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      // Optionally clear the generated meal or indicate it's saved
      // setGeneratedMeal(null); // Or add a 'saved' state to the generated meal
    },
    onError: (error: any, vars) => {
      console.error("Error saving meal:", error);
      showError(`Failed to save meal "${vars.name}": ${error.message || 'Please try again.'}`);
    },
  });

  const handleSaveMeal = () => {
    if (generatedMeal) {
      setIsSaving(true);
      saveMealMutation.mutate(generatedMeal, {
        onSettled: () => setIsSaving(false),
      });
    }
  };

  const handleGenerateNew = () => {
    setGeneratedMeal(null);
    // Optionally reset form selections here if desired
    // setSelectedMealType(undefined);
    // setSelectedKinds([]);
    // setSelectedStyles([]);
    // setIngredientPreferences('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center"><Brain className="mr-2 h-6 w-6" /> Generate Meal with AI</h1>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Tell us what you're craving!</CardTitle>
            <CardDescription>Select your preferences and let AI suggest a meal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Meal Type */}
            <div>
              <Label className="text-base">What meal type do you want?</Label>
              <RadioGroup onValueChange={setSelectedMealType} value={selectedMealType} className="flex flex-wrap gap-4 mt-2">
                {mealTypes.map(type => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`meal-type-${type.toLowerCase()}`} />
                    <Label htmlFor={`meal-type-${type.toLowerCase()}`}>{type}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Meal Kind */}
            <div>
              <Label className="text-base">What kind of meal?</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {mealKinds.map(kind => (
                  <div key={kind} className="flex items-center space-x-2">
                    <Checkbox
                      id={`meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}
                      checked={selectedKinds.includes(kind)}
                      onCheckedChange={(checked) => handleKindChange(kind, checked as boolean)}
                    />
                    <Label htmlFor={`meal-kind-${kind.toLowerCase().replace(/\s+/g, '-')}`}>{kind}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal Style */}
            <div>
              <Label className="text-base">What style of meal?</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {mealStyles.map(style => (
                  <div key={style} className="flex items-center space-x-2">
                    <Checkbox
                      id={`meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}
                      checked={selectedStyles.includes(style)}
                      onCheckedChange={(checked) => handleStyleChange(style, checked as boolean)}
                    />
                    <Label htmlFor={`meal-style-${style.toLowerCase().replace(/\s+/g, '-')}`}>{style}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Ingredient Preferences */}
            <div>
              <Label htmlFor="ingredient-preferences" className="text-base">Any ingredients you want or don't want?</Label>
              <Textarea
                id="ingredient-preferences"
                placeholder="e.g., 'use chicken, no cilantro'"
                value={ingredientPreferences}
                onChange={(e) => setIngredientPreferences(e.target.value)}
                className="mt-2"
              />
            </div>

            <Button
              onClick={() => generateMealMutation.mutate()}
              disabled={!selectedMealType || isGenerating || generateMealMutation.isPending}
              className="w-full"
            >
              {isGenerating || generateMealMutation.isPending ? 'Generating...' : 'Generate Meal'}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Meal Display */}
        {generatedMeal && (
          <Card>
            <CardHeader>
              {generatedMeal.image_url && (
                <div 
                  className="cursor-pointer w-full h-48 flex items-center justify-center overflow-hidden rounded-t-md mb-4 bg-muted" // Added flex centering and background
                  onClick={() => setViewingImageUrl(generatedMeal.image_url || null)} // Set state on click
                >
                  <img
                    src={generatedMeal.image_url}
                    alt={`Image of ${generatedMeal.name}`}
                    className="h-full object-contain" // Use h-full and object-contain to fit within container
                    onError={(e) => (e.currentTarget.style.display = 'none')} // Hide image on error
                  />
                </div>
              )}
              <CardTitle>{generatedMeal.name}</CardTitle>
              <CardDescription>Generated Recipe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ingredients */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Ingredients:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {generatedMeal.ingredients.map((ing, index) => (
                    <li key={index} className="text-muted-foreground">
                      {ing.quantity} {ing.unit} {ing.name} {ing.description && `(${ing.description})`}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Instructions:</h3>
                <p className="text-muted-foreground whitespace-pre-line">{generatedMeal.instructions}</p>
              </div>

              {/* Actions */}
              <div className="flex space-x-4 mt-6">
                <Button
                  onClick={handleSaveMeal}
                  disabled={isSaving || saveMealMutation.isPending}
                  className="flex-grow"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving || saveMealMutation.isPending ? 'Saving...' : 'Save to My Meals'}
                </Button>
                <Button
                  onClick={handleGenerateNew}
                  variant="outline"
                  disabled={isGenerating || generateMealMutation.isPending || isSaving || saveMealMutation.isPending}
                  className="flex-grow"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate New One
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
    </div>
  );
};

export default GenerateMealPage;