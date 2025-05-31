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
  initialData?: Partial<MealFormData>; // Parent should convert meal_tags: string[] to string if needed
  isLoading?: boolean;
  submitButtonText?: string;
}

const MealForm: React.FC<MealFormProps> = ({ 
  onSubmit, 
  initialData, 
  isLoading = false,
  submitButtonText 
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
        meal_tags: initialData.meal_tags || '', // Expects comma-separated string
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
    // The parent component will be responsible for splitting meal_tags string into an array if needed for Supabase
    onSubmit(formData);
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
          placeholder="Enter ingredients, one per line or comma-separated (e.g., 1 cup flour, 2 eggs, 100g chocolate)"
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
        <div>
          <Label htmlFor="estimated_calories" className="block text-sm font-medium text-gray-700">Estimated Calories (Optional)</Label>
          <Input 
            id="estimated_calories" 
            name="estimated_calories" 
            value={formData.estimated_calories} 
            onChange={handleChange} 
            className="mt-1 block w-full"
            placeholder="e.g., 550"
          />
        </div>
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
      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? 'Saving...' : (submitButtonText || defaultButtonText)}
      </Button>
    </form>
  );
};

export default MealForm;