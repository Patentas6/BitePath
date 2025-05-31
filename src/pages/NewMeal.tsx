"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Upload, Brain, ChefHat, Sparkles, Image as ImageIcon, Trash2, Edit3, CheckCircle, XCircle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MealTemplate {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  category: string;
  image_url?: string;
  meal_tags?: string[];
}

interface Profile {
  recipe_generation_count: number;
  last_recipe_generation_reset: string | null;
  image_generation_count: number;
  last_image_generation_reset: string | null;
  ai_preferences: string | null;
}

const NewMealPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'template'>('ai');
  const [mealName, setMealName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mealTags, setMealTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState<{ title: string, description: string, onConfirm: () => void } | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedRecipe, setGeneratedRecipe] = useState<{ name: string, ingredients: string, instructions: string, meal_tags: string[] } | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showAiPreferences, setShowAiPreferences] = useState(false);
  const [aiPreferences, setAiPreferences] = useState('');
  const [servings, setServings] = useState<string>('');


  const RECIPE_GENERATION_LIMIT = 5;
  const IMAGE_GENERATION_LIMIT = 10;

  const fetchUserProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('recipe_generation_count, last_recipe_generation_reset, image_generation_count, last_image_generation_reset, ai_preferences')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      toast({ title: 'Error', description: 'Could not fetch user profile.', variant: 'destructive' });
    } else if (data) {
      setProfile(data);
      setAiPreferences(data.ai_preferences || '');
    }
  }, [toast]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        fetchUserProfile(session.user.id);
      } else {
        navigate('/login');
      }
    };
    getUser();
  }, [navigate, fetchUserProfile]);

  const checkAndResetLimits = useCallback(async () => {
    if (!userId || !profile) return;

    const today = new Date().toISOString().split('T')[0];
    let profileUpdates: Partial<Profile> = {};

    if (profile.last_recipe_generation_reset !== today) {
      profileUpdates.recipe_generation_count = 0;
      profileUpdates.last_recipe_generation_reset = today;
    }
    if (profile.last_image_generation_reset !== today) {
      profileUpdates.image_generation_count = 0;
      profileUpdates.last_image_generation_reset = today;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
      if (error) {
        console.error('Error resetting limits:', error);
      } else {
        fetchUserProfile(userId); // Refresh profile data
      }
    }
  }, [userId, profile, fetchUserProfile]);

  useEffect(() => {
    checkAndResetLimits();
  }, [checkAndResetLimits]);


  const handleGenerateRecipe = async () => {
    if (!userId || !profile) return;
    await checkAndResetLimits(); // Ensure limits are up-to-date

    // Re-fetch profile to get the latest counts after potential reset
    const { data: updatedProfileData, error: fetchError } = await supabase
      .from('profiles')
      .select('recipe_generation_count, last_recipe_generation_reset')
      .eq('id', userId)
      .single();

    if (fetchError || !updatedProfileData) {
        toast({ title: 'Error', description: 'Could not verify generation limits.', variant: 'destructive' });
        return;
    }
    
    const currentProfile = updatedProfileData;


    if (currentProfile.recipe_generation_count >= RECIPE_GENERATION_LIMIT) {
      toast({
        title: 'Limit Reached',
        description: `You have reached your daily limit of ${RECIPE_GENERATION_LIMIT} recipe generations. Please try again tomorrow.`,
        variant: 'destructive',
      });
      return;
    }

    if (!aiPrompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a prompt for the AI.', variant: 'destructive' });
      return;
    }
    setIsGeneratingRecipe(true);
    setGeneratedRecipe(null);
    setGeneratedImageUrl(null); // Clear previous image if any

    try {
      const fullPrompt = `Generate a recipe based on the following: "${aiPrompt}". User's AI preferences: "${aiPreferences || 'No specific preferences.'}". Please provide the output as a JSON object with the following keys: "name" (string), "ingredients" (string, use newline characters for each ingredient), "instructions" (string, use newline characters for each step), "meal_tags" (array of strings). Ensure ingredients and instructions are detailed and clearly formatted.`;
      console.log("Sending prompt to AI:", fullPrompt);

      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: { prompt: fullPrompt },
      });

      if (error) throw error;

      console.log("AI Response data:", data);

      if (data && data.recipe) {
        // Attempt to parse the recipe string if it's a string
        let recipeData;
        if (typeof data.recipe === 'string') {
          try {
            recipeData = JSON.parse(data.recipe);
          } catch (parseError) {
            console.error("Failed to parse recipe string:", parseError);
            toast({ title: 'Error', description: 'AI returned an invalid recipe format. Please try a different prompt.', variant: 'destructive' });
            setIsGeneratingRecipe(false);
            return;
          }
        } else {
          recipeData = data.recipe;
        }
        
        setGeneratedRecipe(recipeData);
        setMealName(recipeData.name || '');
        setIngredients(recipeData.ingredients || '');
        setInstructions(recipeData.instructions || '');
        setMealTags(recipeData.meal_tags || []);
        setImageUrl(''); // Reset image URL for AI generated recipes, user can generate one
        
        // Update recipe generation count
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ recipe_generation_count: currentProfile.recipe_generation_count + 1 })
          .eq('id', userId);

        if (updateError) console.error('Error updating recipe generation count:', updateError);
        fetchUserProfile(userId); // Refresh profile

        toast({ title: 'Success', description: 'Recipe generated by AI!' });
      } else {
        throw new Error('Invalid response structure from AI');
      }
    } catch (error: any) {
      console.error('Error generating recipe with AI:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate recipe. The AI might be busy or the prompt too complex. Try simplifying your prompt.', variant: 'destructive' });
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!userId || !profile || !generatedRecipe?.name) return;
    await checkAndResetLimits();

    const { data: updatedProfileData, error: fetchError } = await supabase
      .from('profiles')
      .select('image_generation_count, last_image_generation_reset')
      .eq('id', userId)
      .single();

    if (fetchError || !updatedProfileData) {
        toast({ title: 'Error', description: 'Could not verify image generation limits.', variant: 'destructive' });
        return;
    }
    const currentProfile = updatedProfileData;

    if (currentProfile.image_generation_count >= IMAGE_GENERATION_LIMIT) {
      toast({
        title: 'Limit Reached',
        description: `You have reached your daily limit of ${IMAGE_GENERATION_LIMIT} image generations. Please try again tomorrow.`,
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    try {
      const imagePrompt = `Generate a vibrant, appetizing, high-quality food photograph of "${generatedRecipe.name}". Focus on realistic lighting and presentation. ${aiPreferences || ''}`;
      console.log("Sending image prompt to AI:", imagePrompt);

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: imagePrompt },
      });

      if (error) throw error;
      console.log("AI Image Response data:", data);

      if (data && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        setImageUrl(data.imageUrl); // Set this to be saved with the meal
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ image_generation_count: currentProfile.image_generation_count + 1 })
          .eq('id', userId);
        if (updateError) console.error('Error updating image generation count:', updateError);
        fetchUserProfile(userId); // Refresh profile

        toast({ title: 'Success', description: 'Image generated by AI!' });
      } else {
        throw new Error('Invalid response structure from AI for image generation');
      }
    } catch (error: any) {
      console.error('Error generating image with AI:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate image.', variant: 'destructive' });
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  const handleSaveAiPreferences = async () => {
    if (!userId) return;
    setIsLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ ai_preferences: aiPreferences })
      .eq('id', userId);
    setIsLoading(false);
    if (error) {
      toast({ title: 'Error', description: 'Could not save AI preferences.', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'AI preferences saved!' });
      fetchUserProfile(userId); // Refresh profile to reflect changes
    }
  };


  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meal_templates')
        .select('*')
        .ilike('name', `%${searchTerm}%`); // Filter by search term

      if (error) {
        console.error('Error fetching templates:', error);
        toast({ title: 'Error', description: 'Could not fetch meal templates.', variant: 'destructive' });
      } else {
        setTemplates(data || []);
      }
      setIsLoading(false);
    };

    if (activeTab === 'template') {
      fetchTemplates();
    }
  }, [activeTab, searchTerm, toast]);

  const handleImageUpload = async (file: File) => {
    if (!userId) return;
    setIsLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `meal-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('meal_images')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Upload Error', description: uploadError.message, variant: 'destructive' });
      setIsLoading(false);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('meal_images')
      .getPublicUrl(filePath);

    setIsLoading(false);
    if (!publicUrlData) {
        toast({ title: 'Error', description: 'Could not get public URL for image.', variant: 'destructive' });
        return null;
    }
    return publicUrlData.publicUrl;
  };

  const handleAddTag = () => {
    if (newTag.trim() !== '' && !mealTags.includes(newTag.trim())) {
      setMealTags([...mealTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setMealTags(mealTags.filter(tag => tag !== tagToRemove));
  };

  const resetForm = () => {
    setMealName('');
    setIngredients('');
    setInstructions('');
    setImageUrl('');
    setImageFile(null);
    setMealTags([]);
    setNewTag('');
    setSelectedTemplate(null);
    setAiPrompt('');
    setGeneratedRecipe(null);
    setGeneratedImageUrl(null);
    setServings('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    if (!mealName.trim()) {
      toast({ title: 'Error', description: 'Meal name is required.', variant: 'destructive' });
      return;
    }
    
    setConfirmModalContent({
      title: 'Confirm Meal Creation',
      description: `Are you sure you want to add "${mealName}" to your meals?`,
      onConfirm: async () => {
        setIsLoading(true);
        let finalImageUrl = imageUrl;

        if (activeTab === 'manual' && imageFile) {
          const uploadedUrl = await handleImageUpload(imageFile);
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
          } else {
            // Error handled in handleImageUpload, prevent submission
            setIsLoading(false);
            return;
          }
        } else if (activeTab === 'ai' && generatedImageUrl) {
          finalImageUrl = generatedImageUrl;
        }


        const { error } = await supabase.from('meals').insert({
          user_id: userId,
          name: mealName,
          ingredients,
          instructions,
          image_url: finalImageUrl,
          meal_tags: mealTags,
          servings: servings || null, // Save servings
        });

        setIsLoading(false);
        if (error) {
          console.error('Error saving meal:', error);
          toast({ title: 'Error', description: `Could not save meal: ${error.message}`, variant: 'destructive' });
        } else {
          toast({ title: 'Success!', description: `${mealName} added to your meals.` });
          resetForm();
          navigate('/meals');
        }
        setIsConfirmModalOpen(false);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSelectTemplate = (template: MealTemplate) => {
    setSelectedTemplate(template);
    setMealName(template.name);
    setIngredients(template.ingredients);
    setInstructions(template.instructions);
    setImageUrl(template.image_url || '');
    setMealTags(template.meal_tags || []);
    // Optionally, switch to manual tab to allow editing, or keep in template tab
    // setActiveTab('manual'); 
    toast({ title: 'Template Loaded', description: `Loaded ${template.name}. You can now customize and save it.`});
  };
  
  const commonFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="mealName">Meal Name</Label>
        <Input id="mealName" value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="e.g., Spaghetti Carbonara" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ingredients">Ingredients</Label>
        <Textarea id="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="List each ingredient on a new line" rows={6} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="List each step on a new line" rows={8} />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="servings">Servings (Optional)</Label>
        <Input id="servings" type="text" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="e.g., 4 servings, 2 people" />
      </div>

      <div className="space-y-2">
        <Label>Meal Tags</Label>
        <div className="flex items-center gap-2">
          <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="e.g., Quick, Dinner" />
          <Button type="button" onClick={handleAddTag} variant="outline" size="icon"><PlusCircle className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {mealTags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </>
  );

  const recipeGenerationQuota = profile ? RECIPE_GENERATION_LIMIT - profile.recipe_generation_count : 0;
  const imageGenerationQuota = profile ? IMAGE_GENERATION_LIMIT - profile.image_generation_count : 0;

  return (
    <TooltipProvider>
    <div className="container mx-auto p-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <ChefHat className="mr-2 h-7 w-7" /> Add New Meal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'ai' | 'manual' | 'template')} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="ai"><Brain className="mr-2 h-4 w-4" />AI Generate</TabsTrigger>
              <TabsTrigger value="manual"><Edit3 className="mr-2 h-4 w-4" />Add Manually</TabsTrigger>
              <TabsTrigger value="template"><Sparkles className="mr-2 h-4 w-4" />From Template</TabsTrigger>
            </TabsList>

            <TabsContent value="ai">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Daily Generation Limits</AlertTitle>
                  <AlertDescription>
                    You can generate <span className="font-semibold">{recipeGenerationQuota < 0 ? 0 : recipeGenerationQuota} more recipes</span> and <span className="font-semibold">{imageGenerationQuota < 0 ? 0 : imageGenerationQuota} more images</span> today. Limits reset daily.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="aiPrompt">Describe your desired meal</Label>
                  <Textarea 
                    id="aiPrompt" 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)} 
                    placeholder="e.g., A quick and healthy chicken stir-fry with broccoli and brown rice, ready in 30 minutes." 
                    rows={3}
                  />
                   <Button type="button" variant="link" onClick={() => setShowAiPreferences(!showAiPreferences)} className="p-0 h-auto text-sm">
                    {showAiPreferences ? 'Hide' : 'Show'} AI Preferences (Optional)
                  </Button>
                   {showAiPreferences && (
                    <div className="space-y-2 mt-2 p-4 border rounded-md">
                      <Label htmlFor="aiPreferences">Your AI Preferences</Label>
                      <Textarea 
                        id="aiPreferences" 
                        value={aiPreferences} 
                        onChange={(e) => setAiPreferences(e.target.value)} 
                        placeholder="e.g., I prefer low-carb meals, avoid gluten, like spicy food, use metric units." 
                        rows={3}
                      />
                      <Button type="button" onClick={handleSaveAiPreferences} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save Preferences'}
                      </Button>
                      <p className="text-xs text-muted-foreground">These preferences will be used for future AI generations.</p>
                    </div>
                  )}
                </div>
                <Button type="button" onClick={handleGenerateRecipe} disabled={isGeneratingRecipe || (profile && profile.recipe_generation_count >= RECIPE_GENERATION_LIMIT)}>
                  {isGeneratingRecipe ? 'Generating Recipe...' : <><Brain className="mr-2 h-4 w-4" />Generate Recipe</>}
                </Button>

                {isGeneratingRecipe && <p className="text-sm text-muted-foreground">AI is thinking... this might take a moment.</p>}
                
                {generatedRecipe && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Generated Recipe Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {commonFields}
                      {generatedImageUrl && (
                        <div className="space-y-2">
                          <Label>Generated Image</Label>
                          <img src={generatedImageUrl} alt="Generated meal" className="rounded-md max-h-64 w-auto" />
                        </div>
                      )}
                       {!generatedImageUrl && (
                        <Button type="button" onClick={handleGenerateImage} disabled={isGeneratingImage || (profile && profile.image_generation_count >= IMAGE_GENERATION_LIMIT)}>
                          {isGeneratingImage ? 'Generating Image...' : <><ImageIcon className="mr-2 h-4 w-4" />Generate Image for this Recipe</>}
                        </Button>
                       )}
                       {isGeneratingImage && <p className="text-sm text-muted-foreground">AI is creating an image... this can take up to 30 seconds.</p>}
                    </CardContent>
                  </Card>
                )}
                
                {generatedRecipe && (
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Saving Meal...' : <><CheckCircle className="mr-2 h-4 w-4" />Save AI Generated Meal</>}
                  </Button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="manual">
              <form onSubmit={handleSubmit} className="space-y-6">
                {commonFields}
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                  <Input id="imageUrl" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }} placeholder="https://example.com/image.jpg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageFile">Upload Image (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input id="imageFile" type="file" accept="image/*" onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setImageFile(e.target.files[0]);
                        setImageUrl(''); // Clear URL if file is selected
                      } else {
                        setImageFile(null);
                      }
                    }} className="flex-grow" />
                    {imageFile && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setImageFile(null)}>
                            <XCircle className="h-5 w-5 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clear selected image</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {imageFile && <p className="text-sm text-muted-foreground">Selected: {imageFile.name}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Saving...' : <><CheckCircle className="mr-2 h-4 w-4" />Save Meal</>}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="template">
              <div className="space-y-4">
                <Input 
                  placeholder="Search templates by name..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
                {isLoading && <p>Loading templates...</p>}
                {!isLoading && templates.length === 0 && <p>No templates found matching your search, or no templates available.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                  {templates.map(template => (
                    <Card key={template.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.image_url && <img src={template.image_url} alt={template.name} className="rounded-md mt-2 max-h-40 w-full object-cover" />}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-1">Category: {template.category}</p>
                        {template.meal_tags && template.meal_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {template.meal_tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
                          </div>
                        )}
                        <Button onClick={() => handleSelectTemplate(template)} className="w-full mt-2">
                          <PlusCircle className="mr-2 h-4 w-4" /> Use This Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {selectedTemplate && (
                  <form onSubmit={handleSubmit} className="space-y-6 mt-6 border-t pt-6">
                    <h3 className="text-xl font-semibold">Customizing: {selectedTemplate.name}</h3>
                    {commonFields}
                     <div className="space-y-2">
                      <Label htmlFor="templateImageUrl">Image URL (from template, editable)</Label>
                      <Input id="templateImageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
                      {selectedTemplate.image_url && !imageUrl && (
                        <p className="text-xs text-muted-foreground">Original template image will be used if this field is empty.</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Saving...' : <><CheckCircle className="mr-2 h-4 w-4" />Save Customized Meal</>}
                    </Button>
                  </form>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmModalContent?.title}</DialogTitle>
            <DialogDescription>
              {confirmModalContent?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={() => confirmModalContent?.onConfirm()} disabled={isLoading}>
              {isLoading ? 'Confirming...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default NewMealPage;