"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface MealFormData {
  name: string;
  ingredients: string;
  instructions: string;
  meal_tags: string; // Comma-separated string
  image_url: string;
  estimated_calories: string;
  servings: string;
}

interface MealFormProps {
  onSubmit: (data: MealFormData) => void;
  initialData?: Partial<MealFormData>;
  isLoading?: boolean;
  submitButtonText?: string;
  userTracksCalories?: boolean; // New prop
}

const MealForm: React.FC<MealFormProps> = ({ 
  onSubmit, 
  initialData, 
  isLoading = false,
  submitButtonText,
  userTracksCalories = false, // Default to false if not provided
}) => {
  const [formData, setFormData] = useState<MealFormData>({
    name: '',
    ingredients: '',
    instructions: '',
    meal_tags: '',
    image_url: '',
    estimated_calories: '',
    servings: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || '',
        ingredients: initialData.ingredients || '',
        instructions: initialData.instructions || '',
        meal_tags: initialData.meal_tags || '',
        image_url: initialData.image_url || '',
        estimated_calories: initialData.estimated_calories || '',
        servings: initialData.servings || '',
      }));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = { ...formData };
    if (!userTracksCalories) {
      // If user is not tracking calories, ensure estimated_calories is not sent
      // or set to a value that indicates it's not being tracked (e.g., empty string or null)
      // For simplicity, we'll ensure it's an empty string if the field wasn't shown.
      // The parent component/Supabase logic should handle empty string as appropriate (e.g., store as NULL).
      dataToSubmit.estimated_calories = formData.estimated_calories || '';
    }
    onSubmit(dataToSubmit);
  };

  const defaultButtonText = initialData?.name ? 'Update Meal' : 'Add Meal';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name" className="block text-sm font-medium text-gray-700">Meal Name</Label>
        <Input 
          id="name" 
          name="name" 
          value={formData.name} 
          onChange={handleChange} 
          required 
          className="mt-1 block w-full"
          placeholder="e.g., Spaghetti Bolognese"
        />
      </div>
      <div>
        <Label htmlFor="ingredients" className="block text-sm font-medium text-gray-700">Ingredients</Label>
        <Textarea 
          id="ingredients" 
          name="ingredients" 
          value={formData.ingredients} 
          onChange={handleChange} 
          rows={4}
          className="mt-1 block w-full"
          placeholder="Enter ingredients, one per line or comma-separated"
        />
      </div>
      <div>
        <Label htmlFor="instructions" className="block text-sm font-medium text-gray-700">Instructions</Label>
        <Textarea 
          id="instructions" 
          name="instructions" 
          value={formData.instructions} 
          onChange={handleChange} 
          rows={6}
          className="mt-1 block w-full"
          placeholder="Enter cooking instructions step-by-step"
        />
      </div>
      <div>
        <Label htmlFor="meal_tags" className="block text-sm font-medium text-gray-700">Meal Tags (comma-separated)</Label>
        <Input 
          id="meal_tags" 
          name="meal_tags" 
          value={formData.meal_tags} 
          onChange={handleChange} 
          className="mt-1 block w-full"
          placeholder="e.g., breakfast, quick, healthy, italian"
        />
      </div>
      <div>
        <Label htmlFor="image_url" className="block text-sm font-medium text-gray-700">Image URL (Optional)</Label>
        <Input 
          id="image_url" 
          name="image_url" 
          type="url"
          value={formData.image_url} 
          onChange={handleChange} 
          className="mt-1 block w-full"
          placeholder="https://example.com/your-meal-image.jpg"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {userTracksCalories && ( // Conditionally render calorie field
          <div>
            <Label htmlFor="estimated_calories" className="block text-sm font-medium text-gray-700">Estimated Calories</Label>
            <Input 
              id="estimated_calories" 
              name="estimated_calories" 
              value={formData.estimated_calories} 
              onChange={handleChange} 
              className="mt-1 block w-full"
              placeholder="e.g., 550"
            />
          </div>
        )}
        <div>
          <Label htmlFor="servings" className="block text-sm font-medium text-gray-700">Servings (Optional)</Label>
          <Input 
            id="servings" 
            name="servings" 
            value={formData.servings} 
            onChange={handleChange} 
            className="mt-1 block w-full"
            placeholder="e.g., 2"
          />
        </div>
      </div>

      {/* Ensure the grid layout adjusts if calories are not shown */}
      {/* If only servings is shown, it will take full width in the grid cell. */}
      {/* If you want servings to always be half-width, even if calories is hidden, more complex styling might be needed, */}
      {/* or ensure the calorie div is present but hidden (display: none) rather than not rendered. */}
      {/* For simplicity, current approach is fine if servings taking full width (if calories hidden) is acceptable. */}

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? 'Saving...' : (submitButtonText || defaultButtonText)}
      </Button>
    </form>
  );
};

export default MealForm;