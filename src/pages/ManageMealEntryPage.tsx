"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom'; // Changed from next/navigation
import { Loader2, Wand2, PlusCircle } from 'lucide-react';
import { generateMealWithAI } from '@/lib/ai';
import { useSession } from '@/integrations/supabase/SessionContext';

const ManageMealEntryPage = () => {
  const [entryMode, setEntryMode] = useState<'select' | 'ai' | 'manual'>('select');
  const [mealName, setMealName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mealTags, setMealTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate(); // Changed from useRouter
  const { session } = useSession();
  const user = session?.user;

  useEffect(() => {
    if (!user && !session) { // Check if session is also null to avoid redirect during initial load
      // Only navigate if the session has been checked and there's no user
    } else if (!user && session !== undefined) {
      navigate('/login');
    }
  }, [user, session, navigate]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to add a meal.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const tagsArray = mealTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const { data, error } = await supabase
        .from('meals')
        .insert([{ 
          user_id: user.id, 
          name: mealName, 
          ingredients, 
          instructions, 
          meal_tags: tagsArray 
        }])
        .select();

      if (error) throw error;

      toast({ title: "Success!", description: "Meal added manually." });
      navigate('/my-meals'); // Changed from router.push
    } catch (error: any) {
      console.error("Error adding meal manually:", error);
      toast({ title: "Error adding meal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to generate a meal.", variant: "destructive" });
      return;
    }
    if (!aiPrompt.trim()) {
      toast({ title: "Prompt needed", description: "Please enter a description for the AI to generate a meal.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const generatedMeal = await generateMealWithAI(aiPrompt, user.id);
      
      setMealName(generatedMeal.name || '');
      setIngredients(generatedMeal.ingredients || '');
      setInstructions(generatedMeal.instructions || '');
      setMealTags((generatedMeal.meal_tags || []).join(', '));
      
      toast({ title: "AI Meal Populated!", description: "Review and save the meal, or regenerate." });
      setEntryMode('manual');
    } catch (error: any) {
      console.error("Error generating meal with AI:", error);
      toast({ title: "AI Generation Failed", description: error.message || "Could not generate meal. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSelectionMode = () => (
    <div className="flex flex-col items-center space-y-6">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">How would you like to add your meal?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md">
        <Button 
          onClick={() => setEntryMode('ai')} 
          className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          size="lg"
        >
          <Wand2 className="mr-2 h-6 w-6" /> Generate with AI
        </Button>
        <Button 
          onClick={() => setEntryMode('manual')} 
          className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          size="lg"
        >
          <PlusCircle className="mr-2 h-6 w-6" /> Add Manually
        </Button>
      </div>
    </div>
  );

  const renderAiMode = () => (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Generate Meal with AI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., 'A healthy chicken stir-fry with broccoli and brown rice, ready in 30 minutes'"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={4}
          className="dark:bg-gray-700 dark:text-white"
        />
        <div className="flex justify-between items-center">
          <Button onClick={() => setEntryMode('select')} variant="outline" className="dark:text-white dark:border-gray-600">Back</Button>
          <Button onClick={handleAiGenerate} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate Meal
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderManualMode = () => (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Add Meal Manually</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label htmlFor="mealName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Meal Name</label>
            <Input
              id="mealName"
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g., Spaghetti Bolognese"
              required
              className="mt-1 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ingredients</label>
            <Textarea
              id="ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g., 200g pasta, 100g ground beef, 1 can chopped tomatoes..."
              rows={5}
              required
              className="mt-1 dark:bg-gray-700 dark:text-white"
            />
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tip: You can list ingredients, or paste a block of text. The AI can help parse this later if needed.</p>
          </div>
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instructions</label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., 1. Boil pasta. 2. Brown beef. 3. Add tomatoes and simmer..."
              rows={8}
              required
              className="mt-1 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="mealTags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Meal Tags (comma-separated)</label>
            <Input
              id="mealTags"
              type="text"
              value={mealTags}
              onChange={(e) => setMealTags(e.target.value)}
              placeholder="e.g., italian, quick, dinner"
              className="mt-1 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <Button type="button" onClick={() => setEntryMode('select')} variant="outline" className="dark:text-white dark:border-gray-600">Back to Selection</Button>
            <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Meal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <h1 className="text-5xl font-bold text-red-500 mb-8">TESTING</h1>
      {entryMode === 'select' && renderSelectionMode()}
      {entryMode === 'ai' && renderAiMode()}
      {entryMode === 'manual' && renderManualMode()}
    </div>
  );
};

export default ManageMealEntryPage;