"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "react-hot-toast";
import { UploadCloud, Sparkles, Link as LinkIcon, ChefHat } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// Define a type for the meal
interface Meal {
  name: string;
  ingredients: string;
  instructions: string;
  meal_tags?: string[];
  image_url?: string;
  estimated_calories?: string;
  servings?: string;
}

export default function NewMeal() {
  const router = useRouter();
  const [meal, setMeal] = useState<Partial<Meal>>({
    name: "",
    ingredients: "",
    instructions: "",
    meal_tags: [],
    estimated_calories: "",
    servings: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        toast.error("You must be logged in to add a meal.");
        router.push("/login");
      }
    };
    getUser();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMeal((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMeal((prev) => ({ ...prev, meal_tags: e.target.value.split(",").map((tag) => tag.trim()) }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setImageUrl(""); // Clear manual URL if a file is selected
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!userId) {
      toast.error("User ID not found.");
      return null;
    }
    setIsUploading(true);
    setUploadProgress(0);

    const fileName = `${userId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("meal-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    // Simulate progress for demo purposes if actual progress isn't available directly
    // For actual progress, you might need a more complex setup or use a library that supports it with Supabase.
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress <= 100) {
        setUploadProgress(currentProgress);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);


    setIsUploading(false);
    clearInterval(progressInterval); // Clear interval once upload is done or fails
    setUploadProgress(100); // Mark as complete

    if (error) {
      toast.error(`Image upload failed: ${error.message}`);
      console.error("Image upload error:", error);
      setUploadProgress(0);
      return null;
    }

    if (data) {
      const { data: publicUrlData } = supabase.storage.from("meal-images").getPublicUrl(data.path);
      toast.success("Image uploaded successfully!");
      setUploadProgress(0);
      return publicUrlData.publicUrl;
    }
    setUploadProgress(0);
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) {
      toast.error("User not authenticated.");
      return;
    }
    if (!meal.name) {
      toast.error("Meal name is required.");
      return;
    }

    setIsLoading(true);
    let finalImageUrl = meal.image_url || "";

    if (selectedFile) {
      const uploadedUrl = await uploadImage(selectedFile);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      } else if (!imageUrl) { // Only fail if no manual URL was set as fallback
        setIsLoading(false);
        toast.error("Image upload failed and no manual URL provided. Please try again.");
        return;
      }
    } else if (imageUrl) { // This case is being removed, but logic kept for structure
      finalImageUrl = imageUrl;
    }


    const mealDataToInsert: Omit<Meal, 'id'> & { user_id: string; image_url?: string } = {
      ...meal,
      user_id: userId,
      image_url: finalImageUrl || undefined, // Ensure it's undefined if empty, not an empty string
    };

    const { error } = await supabase.from("meals").insert([mealDataToInsert]);

    setIsLoading(false);
    if (error) {
      toast.error(`Failed to add meal: ${error.message}`);
      console.error("Error inserting meal:", error);
    } else {
      toast.success("Meal added successfully!");
      router.push("/meals");
    }
  };

  const generateRecipeWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt for the AI recipe generator.");
      return;
    }
    setIsGeneratingRecipe(true);
    const toastId = toast.loading("Generating recipe...");
    try {
      const response = await supabase.functions.invoke("generate-recipe", {
        body: { prompt: aiPrompt },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const { recipeName, ingredients, instructions, estimatedCalories, servings, mealTags } = response.data;

      setMeal(prev => ({
        ...prev,
        name: recipeName || prev.name,
        ingredients: ingredients ? (Array.isArray(ingredients) ? ingredients.join("\n") : ingredients) : prev.ingredients,
        instructions: instructions || prev.instructions,
        estimated_calories: estimatedCalories || prev.estimated_calories,
        servings: servings || prev.servings,
        meal_tags: mealTags || prev.meal_tags,
      }));
      toast.success("Recipe generated!", { id: toastId });
    } catch (error: any) {
      console.error("Error generating recipe:", error);
      toast.error(`Recipe generation failed: ${error.message}`, { id: toastId });
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const generateImageWithAI = async () => {
    if (!meal.name) {
      toast.error("Please enter a meal name to generate an image.");
      return;
    }
    setIsGeneratingImage(true);
    const toastId = toast.loading("Generating image...");
    try {
      const imagePrompt = `A delicious looking plate of ${meal.name}, high quality food photography.`;
      const response = await supabase.functions.invoke("generate-image", {
        body: { prompt: imagePrompt },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (response.data && response.data.imageUrl) {
        setImageUrl(response.data.imageUrl); // Set for display and potential use
        setImagePreview(response.data.imageUrl); // Show preview
        setMeal(prev => ({ ...prev, image_url: response.data.imageUrl }));
        setSelectedFile(null); // Clear selected file if AI image is generated
        toast.success("Image generated and set!", { id: toastId });
      } else {
        throw new Error("No image URL returned from AI.");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(`Image generation failed: ${error.message}`, { id: toastId });
    } finally {
      setIsGeneratingImage(false);
    }
  };


  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Add New Meal</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="manual"><ChefHat className="w-4 h-4 mr-2 inline-block" />Add Manually</TabsTrigger>
              <TabsTrigger value="ai"><Sparkles className="w-4 h-4 mr-2 inline-block" />AI Generate</TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Meal Name</Label>
                  <Input id="name" name="name" value={meal.name || ""} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="ingredients">Ingredients</Label>
                  <Textarea id="ingredients" name="ingredients" value={meal.ingredients || ""} onChange={handleChange} placeholder="List each ingredient on a new line or separated by commas." />
                </div>
                <div>
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea id="instructions" name="instructions" value={meal.instructions || ""} onChange={handleChange} placeholder="Step-by-step instructions." />
                </div>
                <div>
                  <Label htmlFor="estimated_calories">Estimated Calories (optional)</Label>
                  <Input id="estimated_calories" name="estimated_calories" value={meal.estimated_calories || ""} onChange={handleChange} placeholder="e.g., 500 kcal" />
                </div>
                <div>
                  <Label htmlFor="servings">Servings (optional)</Label>
                  <Input id="servings" name="servings" value={meal.servings || ""} onChange={handleChange} placeholder="e.g., 2" />
                </div>
                <div>
                  <Label htmlFor="meal_tags">Tags (optional, comma-separated)</Label>
                  <Input id="meal_tags" name="meal_tags" value={meal.meal_tags?.join(", ") || ""} onChange={handleTagsChange} placeholder="e.g., vegan, quick, dinner" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Meal Image (optional)</Label>
                  <div className="flex items-center space-x-2 p-2 border rounded-md">
                    <UploadCloud className="w-6 h-6 text-gray-500" />
                    <Input id="image" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>
                  </div>
                  
                  {isUploading && (
                    <div className="mt-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-sm text-center mt-1">{uploadProgress}% uploaded</p>
                    </div>
                  )}

                  {/* The "or use your own image url" button and input field were here. They have been removed. */}

                  {imagePreview && (
                    <div className="mt-4">
                      <Label>Image Preview:</Label>
                      <img src={imagePreview} alt="Preview" className="mt-2 rounded-md max-h-60 w-auto object-contain border" />
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || isUploading}>
                  {isLoading ? "Adding Meal..." : "Add Meal"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="ai">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="ai-prompt">Describe the meal you want to generate:</Label>
                  <Textarea 
                    id="ai-prompt" 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)} 
                    placeholder="e.g., A healthy chicken stir-fry with brown rice and lots of vegetables." 
                    rows={3}
                  />
                  <Button onClick={generateRecipeWithAI} className="mt-2 w-full" disabled={isGeneratingRecipe || isGeneratingImage}>
                    {isGeneratingRecipe ? "Generating Recipe..." : "Generate Recipe with AI"}
                  </Button>
                </div>

                {meal.name && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Recipe Generated!</AlertTitle>
                    <AlertDescription>
                      <p><strong>Name:</strong> {meal.name}</p>
                      <p><strong>Calories:</strong> {meal.estimated_calories || "Not specified"}</p>
                      <p><strong>Servings:</strong> {meal.servings || "Not specified"}</p>
                      <p className="mt-2">Review and edit the details in the 'Add Manually' tab if needed. You can also generate an image below.</p>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label>AI Generated Image (optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate an image for your meal based on its name. The generated image URL will be automatically used.
                  </p>
                  <Button onClick={generateImageWithAI} className="w-full" disabled={isGeneratingImage || !meal.name}>
                    {isGeneratingImage ? "Generating Image..." : "Generate Image with AI"}
                  </Button>
                  {isGeneratingImage && <p className="text-sm text-center mt-1">AI is creating your image...</p>}
                  {imagePreview && meal.image_url === imagePreview && ( // Only show if it's the AI generated one
                     <div className="mt-4">
                       <Label>AI Image Preview:</Label>
                       <img src={imagePreview} alt="AI Generated Preview" className="mt-2 rounded-md max-h-60 w-auto object-contain border" />
                     </div>
                  )}
                </div>
                
                <Alert>
                  <ChefHat className="h-4 w-4" />
                  <AlertTitle>Final Step</AlertTitle>
                  <AlertDescription>
                    After generating content with AI, please switch to the 'Add Manually' tab to review, make any necessary edits, and then click 'Add Meal' to save it.
                  </AlertDescription>
                </Alert>

              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}