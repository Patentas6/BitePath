"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, XCircle, Image as ImageIcon, Wand2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageGenerationModal } from './ImageGenerationModal'; // Assuming this component exists

const mealFormSchema = z.object({
  name: z.string().min(1, "Meal name is required"),
  ingredients: z.string().min(1, "Ingredients are required"),
  instructions: z.string().min(1, "Instructions are required"),
  meal_tags: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  servings: z.string().optional(),
  estimated_calories: z.string().optional(),
});

export type MealFormData = z.infer<typeof mealFormSchema>;

interface MealFormProps {
  onSubmit: (data: MealFormData) => Promise<void>;
  defaultValues?: Partial<MealFormData & { id?: string }>;
  isEditing?: boolean;
  onImageGenerated?: (imageUrl: string) => void;
  onGenerateImageWithAI?: (prompt: string) => Promise<string | null>;
}

export const MealForm: React.FC<MealFormProps> = ({ onSubmit, defaultValues, isEditing = false, onImageGenerated, onGenerateImageWithAI }) => {
  const [currentTag, setCurrentTag] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');

  const form = useForm<MealFormData>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      ingredients: defaultValues?.ingredients || '',
      instructions: defaultValues?.instructions || '',
      meal_tags: defaultValues?.meal_tags || [],
      imageUrl: defaultValues?.imageUrl || '',
      servings: defaultValues?.servings || '',
      estimated_calories: defaultValues?.estimated_calories || '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name || '',
        ingredients: defaultValues.ingredients || '',
        instructions: defaultValues.instructions || '',
        meal_tags: defaultValues.meal_tags || [],
        imageUrl: defaultValues.imageUrl || '',
        servings: defaultValues.servings || '',
        estimated_calories: defaultValues.estimated_calories || '',
      });
    }
  }, [defaultValues, form]);

  const handleAddTag = () => {
    if (currentTag.trim() !== '') {
      const currentTags = form.getValues('meal_tags') || [];
      if (!currentTags.includes(currentTag.trim())) {
        form.setValue('meal_tags', [...currentTags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues('meal_tags') || [];
    form.setValue('meal_tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleFormSubmit = async (data: MealFormData) => {
    await onSubmit(data);
  };

  const handleGenerateImage = async () => {
    if (!onGenerateImageWithAI) {
      toast.error("Image generation service is not configured.");
      return;
    }
    if (!imagePrompt && !form.getValues('name')) {
      toast.error("Please enter a meal name or a custom prompt for image generation.");
      setIsImageModalOpen(true); // Open modal if no prompt
      return;
    }
    
    setIsGeneratingImage(true);
    setIsImageModalOpen(false); // Close modal if it was open

    const promptToUse = imagePrompt || `A delicious looking plate of ${form.getValues('name')}`;
    
    try {
      const newImageUrl = await onGenerateImageWithAI(promptToUse);
      if (newImageUrl) {
        form.setValue('imageUrl', newImageUrl);
        if (onImageGenerated) {
          onImageGenerated(newImageUrl);
        }
        toast.success("Image generated successfully!");
      } else {
        toast.error("Failed to generate image. No URL returned.");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingImage(false);
      setImagePrompt(''); // Reset custom prompt
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meal Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Spaghetti Carbonara" {...field} />
              </FormControl>
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
                <Textarea placeholder="List all ingredients, one per line..." {...field} rows={5} />
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
                <Textarea placeholder="Step-by-step cooking instructions..." {...field} rows={8} />
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
              <FormLabel>Servings (Optional)</FormLabel>
              <FormControl>
                <Input type="text" placeholder="e.g., 4 servings" {...field} />
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
              <FormLabel>Estimated Calories (Optional)</FormLabel>
              <FormControl>
                <Input type="text" placeholder="e.g., 500 kcal per serving" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Meal Tags (Optional)</FormLabel>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g., Quick, Healthy, Italian"
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={handleAddTag} className="shrink-0">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Tag
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.watch('meal_tags')?.map((tag) => (
              <span key={tag} className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm flex items-center">
                {tag}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 p-0 h-auto hover:bg-transparent"
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </span>
            ))}
          </div>
          <FormMessage />
        </FormItem>

        <FormItem>
          <FormLabel>Meal Image (Optional)</FormLabel>
          <div className="flex flex-col gap-2">
            {onGenerateImageWithAI && (
              <>
                <Button type="button" variant="outline" onClick={() => setIsImageModalOpen(true)} disabled={isGeneratingImage}>
                  {isGeneratingImage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  AI Generate Image
                </Button>
              </>
            )}

            {form.watch('imageUrl') && (
              <div className="mt-4">
                <img src={form.watch('imageUrl')} alt="Meal preview" className="rounded-md max-h-64 w-auto" />
                <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('imageUrl', '')} className="mt-2">
                  Remove Image
                </Button>
              </div>
            )}
          </div>
          <FormMessage />
        </FormItem>
        
        {isImageModalOpen && onGenerateImageWithAI && (
          <ImageGenerationModal
            isOpen={isImageModalOpen}
            onClose={() => setIsImageModalOpen(false)}
            onGenerate={handleGenerateImage}
            currentPrompt={imagePrompt}
            setCurrentPrompt={setImagePrompt}
            defaultPrompt={`A delicious looking plate of ${form.getValues('name') || 'the meal'}`}
            isGenerating={isGeneratingImage}
          />
        )}

        <Button type="submit" disabled={form.formState.isSubmitting || isGeneratingImage} className="w-full">
          {form.formState.isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isEditing ? 'Update Meal' : 'Add Meal'}
        </Button>
      </form>
    </Form>
  );
};