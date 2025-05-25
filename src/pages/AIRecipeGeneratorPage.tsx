import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

const AIRecipeGeneratorPage = () => {
  // Placeholder state and functions for AI interaction
  // const [prompt, setPrompt] = useState("");
  // const [generatedRecipe, setGeneratedRecipe] = useState<string | null>(null);
  // const [isLoading, setIsLoading] = useState(false);

  // const handleGenerateRecipe = async () => {
  //   setIsLoading(true);
  //   setGeneratedRecipe(null);
  //   // AI generation logic will go here
  //   // For now, simulate a delay and a placeholder response
  //   await new Promise(resolve => setTimeout(resolve, 2000));
  //   setGeneratedRecipe("AI Generated Recipe:\n\nIngredients:\n- 2 cups flour\n- 1 cup sugar\n\nInstructions:\n1. Mix ingredients.\n2. Bake at 350°F for 30 minutes.");
  //   setIsLoading(false);
  // };

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
              Describe the kind of recipe you're looking for, list some ingredients you have, or suggest a theme. Let AI do the rest!
              (Note: AI functionality is not yet implemented.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder="e.g., 'A quick vegan pasta dish with mushrooms and spinach' or 'What can I make with chicken, rice, and broccoli?'"
                className="min-h-[100px]"
                // value={prompt}
                // onChange={(e) => setPrompt(e.target.value)}
                disabled // Disabled until AI is implemented
              />
            </div>
            <Button 
              // onClick={handleGenerateRecipe} 
              // disabled={isLoading || !prompt.trim()}
              disabled // Disabled until AI is implemented
              className="w-full"
            >
              {/* {isLoading ? "Generating..." : "Generate Recipe"} */}
              <Wand2 className="mr-2 h-4 w-4" /> Generate Recipe (Coming Soon)
            </Button>

            {/* {isLoading && <p className="text-center">Generating your recipe...</p>} */}
            
            {/* {generatedRecipe && (
              <Card>
                <CardHeader><CardTitle>Generated Recipe</CardTitle></CardHeader>
                <CardContent className="whitespace-pre-line">
                  {generatedRecipe}
                  <Button className="mt-4 w-full" variant="outline">Save to My Meals (Coming Soon)</Button>
                </CardContent>
              </Card>
            )} */}
            <div className="text-center p-6 border-2 border-dashed rounded-lg mt-6">
              <Wand2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-muted-foreground">AI Recipe Output Will Appear Here</h3>
              <p className="text-sm text-muted-foreground">
                Once you provide a prompt and click generate, your AI-crafted recipe will be displayed.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-lg">How it Will Work (Future)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. You'll type a description or list of ingredients into the text box above.</p>
                <p>2. Our AI assistant will process your request and generate a unique recipe tailored to your input.</p>
                <p>3. The generated recipe (ingredients, instructions) will appear in the space above.</p>
                <p>4. You'll then have an option to save this AI-generated recipe directly to your "My Meals" list.</p>
            </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AIRecipeGeneratorPage;