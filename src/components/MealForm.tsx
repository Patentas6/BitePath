"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import IngredientInput from './IngredientInput';
import TagInput from './TagInput'; 
import { Loader2, Info } from 'lucide-react';
import { UNITS, Unit, MEAL_TAG_OPTIONS, MealTagOption } from '@/lib/constants'; // CRITICAL: Import from constants
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MAX_INGREDIENTS = 20;
const MAX_TAGS = 10;

const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required').max(100, 'Ingredient name too long'),
  quantity: z.string().min(1, 'Quantity is required').max(20, 'Quantity too long'),
  unit: z.enum(UNITS, { errorMap: () => ({ message: "Please select a valid unit." }) })
});

const mealFormSchema = z.object({
  name: z.string().min(1, 'Meal name is required').max(150, 'Meal name too long'),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required').max(MAX_INGREDIENTS, `Maximum ${MAX_INGREDIENTS} ingredients`),
  instructions: z.string().min(1, 'Instructions are required').max(5000, 'Instructions too long'),
  meal_tags: z.array(z.string()).max(MAX_TAGS, `Maximum ${MAX_TAGS} tags`),
  image_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  servings: z.string().optional(),
  estimated_calories: z.string().optional(),
});

export type MealFormData = z.infer<typeof mealFormSchema>;

interface MealFormProps {
  onSubmit: (data: MealFormData, currentImageUrl?: string) => Promise<void>;
  initialData?: Partial<MealFormData & { id?: string; image_url?: string | null }>;
  isLoading: boolean;
  userId: string; 
}

const MealForm: React.FC<MealFormProps> = ({ onSubmit, initialData, isLoading, userId }) => {
  const [showImageUrlInput, setShowImageUrlInput] = useState(!!initialData?.image_url);
  const [currentImageUrl, setCurrentImageUrl] = useState(initialData?.image_url || undefined);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<MealFormData>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      ingredients: initialData?.ingredients || [{ name: '', quantity: '', unit: UNITS[0] }],
      instructions: initialData?.instructions || '',
      meal_tags: initialData?.meal_tags || [],
      image_url: initialData?.image_url || '',
      servings: initialData?.servings || '',
      estimated_calories: initialData?.estimated_calories || '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ingredients",
  });

  useEffect(() => {
    if (initialData) {
      const resetData = {
        name: initialData.name || '',
        ingredients: initialData.ingredients?.length ? initialData.ingredients.map(ing => ({...ing, unit: ing.unit || UNITS[0]})) : [{ name: '', quantity: '', unit: UNITS[0] }],
        instructions: initialData.instructions || '',
        meal_tags: initialData.meal_tags || [],
        image_url: initialData.image_url || '',
        servings: initialData.servings || '',
        estimated_calories: initialData.estimated_calories || '',
      };
      reset(resetData);
      setShowImageUrlInput(!!initialData.image_url);
      setCurrentImageUrl(initialData.image_url || undefined);
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: MealFormData) => {
    console.log("Form data submitted:", data);
    await onSubmit(data, currentImageUrl);
  };

  const watchedImageUrl = watch('image_url');
  useEffect(() => {
    setCurrentImageUrl(watchedImageUrl);
  }, [watchedImageUrl]);

  const handleAddIngredient = () => {
    if (fields.length < MAX_INGREDIENTS) {
      append({ name: '', quantity: '', unit: UNITS[0] });
    } else {
      toast.error(`You can add a maximum of ${MAX_INGREDIENTS} ingredients.`);
    }
  };
  
  const handleRemoveIngredient = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      toast.error("At least one ingredient is required.");
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 p-4 sm:p-6 bg-white shadow-md rounded-lg">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Meal Name</label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => <Input id="name" {...field} placeholder="e.g., Spaghetti Bolognese" className="mt-1" />}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ingredients</h3>
        {fields.map((item, index) => (
          <IngredientInput
            key={item.id}
            index={index}
            ingredient={item as any} // Cast to any to match IngredientInputProps, RHF provides 'id'
            onChange={(idx, fieldName, value) => {
              const currentIngredients = watch('ingredients');
              const updatedIngredients = [...currentIngredients];
              updatedIngredients[idx] = { ...updatedIngredients[idx], [fieldName]: value };
              control.setValue(`ingredients`, updatedIngredients, { shouldValidate: true });
            }}
            onRemove={handleRemoveIngredient}
          />
        ))}
        {errors.ingredients && !errors.ingredients.root && errors.ingredients.length === 0 && (
            <p className="text-red-500 text-xs mt-1">{errors.ingredients.message}</p>
        )}
        {errors.ingredients?.root && <p className="text-red-500 text-xs mt-1">{errors.ingredients.root.message}</p>}
         {Array.isArray(errors.ingredients) && errors.ingredients.map((err, index) => (
          <div key={index}>
            {err?.name && <p className="text-red-500 text-xs mt-1">Ingredient {index + 1}: {err.name.message}</p>}
            {err?.quantity && <p className="text-red-500 text-xs mt-1">Ingredient {index + 1}: {err.quantity.message}</p>}
            {err?.unit && <p className="text-red-500 text-xs mt-1">Ingredient {index + 1}: {err.unit.message}</p>}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={handleAddIngredient} className="mt-2">
          Add Ingredient
        </Button>
      </div>

      <div>
        <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">Instructions</label>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => <Textarea id="instructions" {...field} placeholder="e.g., 1. Cook pasta. 2. Prepare sauce..." rows={6} className="mt-1" />}
        />
        {errors.instructions && <p className="text-red-500 text-xs mt-1">{errors.instructions.message}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Meal Tags (Optional)</label>
        <Controller
            name="meal_tags"
            control={control}
            render={({ field }) => (
                <TagInput
                    tags={field.value as MealTagOption[]}
                    setTags={(newTags) => field.onChange(newTags)}
                    availableTags={MEAL_TAG_OPTIONS as ReadonlyArray<string>} // Cast for TagInput
                    maxTags={MAX_TAGS}
                    placeholder="Add tags like 'Vegan', 'Quick Meal'..."
                />
            )}
        />
        {errors.meal_tags && <p className="text-red-500 text-xs mt-1">{errors.meal_tags.message}</p>}
      </div>

      <div>
        <label htmlFor="servings" className="block text-sm font-medium text-gray-700">Servings (Optional)</label>
        <Controller
          name="servings"
          control={control}
          render={({ field }) => <Input id="servings" {...field} placeholder="e.g., 4" className="mt-1" />}
        />
        {errors.servings && <p className="text-red-500 text-xs mt-1">{errors.servings.message}</p>}
      </div>

      <div>
        <label htmlFor="estimated_calories" className="block text-sm font-medium text-gray-700">Estimated Calories (Optional)</label>
        <Controller
          name="estimated_calories"
          control={control}
          render={({ field }) => <Input id="estimated_calories" {...field} placeholder="e.g., 500 kcal" className="mt-1" />}
        />
        {errors.estimated_calories && <p className="text-red-500 text-xs mt-1">{errors.estimated_calories.message}</p>}
      </div>

      <div>
        {showImageUrlInput ? (
          <>
            <label htmlFor="image_url" className="block text-sm font-medium text-gray-700">Image URL (Optional)</label>
            <Controller
              name="image_url"
              control={control}
              render={({ field }) => <Input id="image_url" {...field} placeholder="https://example.com/image.jpg" className="mt-1" />}
            />
            {errors.image_url && <p className="text-red-500 text-xs mt-1">{errors.image_url.message}</p>}
            <Button type="button" variant="ghost" size="sm" onClick={() => { control.setValue('image_url', ''); setShowImageUrlInput(false); }} className="mt-1 text-xs text-blue-600 hover:text-blue-800">
              Remove Image URL
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={() => setShowImageUrlInput(true)} className="mt-2">
            Add Image URL (Optional)
          </Button>
        )}
      </div>
      
      {initialData?.id && (
        <Alert variant="default" className="mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            You are editing an existing meal. Submitting will update the current meal details.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData?.id ? 'Update Meal' : 'Add Meal'}
      </Button>
    </form>
  );
};

export default MealForm;