import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Wand2, Save } from "lucide-react"; // Added Save icon
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast"; // Import toast functions
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

interface AiRecipe {
  name: string;
  ingredients: string;
  instructions: string;
}

const AIRecipeGeneratorPage = () => {
  const [prompt, setPrompt] = useState("");
  const [generatedRecipe, setGeneratedRecipe] = useState<AiRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateRecipe = async () => {
    if (!prompt.trim()) {
      showError("Please enter a prompt for the AI.");
      return;
    }

    setIsLoading(true);
    setGeneratedRecipe(null);
    const loadingToastId = showLoading("AI is crafting your recipe...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-recipe', {
        body: { prompt },
      });

      dismissToast(loadingToastId);

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }
      
      if (data.error) { // Handle errors returned in the data payload from the function
        throw new Error(`AI error: ${data.error}`);
      }

      if (data.recipe) {
        setGeneratedRecipe(data.recipe);
        showSuccess("AI recipe generated!");
      } else {
        throw new Error("No recipe data received from AI.");
      }

    } catch (error: any) {
      dismissToast(loadingToastId);
      console.error("Error generating AI recipe:", error);
      showError(error.message || "Failed to generate recipe.");
      setGeneratedRecipe(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Placeholder for saving the recipe
  const handleSaveRecipe = () => {
    if (!generatedRecipe) return;
    // This would involve:
    // 1. Parsing generatedRecipe.ingredients and generatedRecipe.instructions
    //    into the structured format expected by your 'meals' table.
    //    This is the most complex part as AI output can be varied.
    // 2. Calling a mutation to insert the new meal into the 'meals' table.
    showSuccess(`"${generatedRecipe.name}" saving to My Meals (placeholder)...`);
    // Example: addMealMutation.mutate({ name: generatedRecipe.name, ingredients: parsedIngredients, instructions: parsedInstructions });
  };


  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-2xl font-bold group">
              <span className="text-[#7BB390] dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-[#FC5A50] dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center">
            <Wand2 className="h-8 w-8 mr-3 text-purple-500 hidden sm:block" />
            <h1 className="text-xl sm:text-3xl font-bold">AI Recipe Generator</h1>
          </div>
          <Button variant="default" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </header>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle>Craft a New Recipe with AI</CardTitle>
            <CardDescription>
              Describe the kind of recipe you're looking for, list some ingredients you have, or suggest a theme. Let the AI try to whip something up!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder="e.g., 'A quick vegan pasta dish with mushrooms and spinach' or 'What can I make with chicken, rice, and broccoli?'"
                className="min-h-[100px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button 
              onClick={handleGenerateRecipe} 
              disabled={isLoading || !prompt.trim()}
              className="w-full"
            >
              <Wand2 className="mr-2 h-4 w-4" /> 
              {isLoading ? "Generating..." : "Generate Recipe"}
            </Button>
          </CardContent>
        </Card>
            
        {isLoading && (
          <Card>
            <CardHeader><CardTitle>Generating your masterpiece...</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-6 w-3/4" /> 
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        )}
            
        {generatedRecipe && !isLoading && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{generatedRecipe.name}</CardTitle>
                <Button variant="outline" size="sm" onClick={handleSaveRecipe} disabled> {/* Disabled until save is implemented */}
                  <Save className="mr-2 h-4 w-4" /> Save to My Meals (Coming Soon)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Ingredients:</h4>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md font-sans">{generatedRecipe.ingredients}</pre>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Instructions:</h4>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md font-sans">{generatedRecipe.instructions}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !generatedRecipe && (
           <div className="text-center p-6 border-2 border-dashed rounded-lg mt-6">
              <Wand2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-muted-foreground">AI Recipe Output Will Appear Here</h3>
              <p className="text-sm text-muted-foreground">
                Enter a prompt above and click "Generate Recipe".
              </p>
            </div>
        )}
        
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-lg">How it Works (Current Mock)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. You type a description or list of ingredients into the text box above.</p>
                <p>2. The app calls a Supabase Edge Function. This function currently returns a <span className="font-semibold">mock/pre-defined recipe</span> based on keywords like "pasta" or "chicken" to simulate AI behavior.</p>
                <p>3. The mock recipe (name, ingredients, instructions) appears above.</p>
                <p>4. <span className="font-semibold">Future:</span> This Edge Function would be updated to call a real AI service. The "Save to My Meals" button would also be enabled to parse and save the recipe.</p>
            </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AIRecipeGeneratorPage;