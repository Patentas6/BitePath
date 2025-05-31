"use client";

import React from 'react';
import { X, Edit3, Trash2, Image as ImageIcon, AlertTriangle, Utensils, Tag, Clock, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meal } from '@/types';
import { useUserProfile } from '@/contexts/UserProfileContext'; // Import useUserProfile

interface RecipeViewProps {
  meal: Meal | null;
  onClose: () => void;
  onEdit: (meal: Meal)_ => void;
  onDelete: (mealId: string)_ => Promise<void>;
  onGenerateImage: (meal: Meal) => void;
  isGeneratingImage: boolean;
}

const RecipeView: React.FC<RecipeViewProps> = ({ meal, onClose, onEdit, onDelete, onGenerateImage, isGeneratingImage }) => {
  const { profile, loading: profileLoading } = useUserProfile(); // Get profile and loading state

  if (!meal) return null;

  const handleEdit = () => {
    if (meal) {
      onEdit(meal);
    }
  };

  const handleDelete = async () => {
    if (meal && meal.id) {
      await onDelete(meal.id);
      onClose();
    }
  };

  const handleGenerateImage = () => {
    if (meal) {
      onGenerateImage(meal);
    }
  };

  const formatText = (text: string | undefined | null): string[] => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim() !== '');
  };

  const ingredientsList = formatText(meal.ingredients);
  const instructionsList = formatText(meal.instructions);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{meal.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {meal.image_url ? (
          <img src={meal.image_url} alt={meal.name} className="w-full h-64 object-cover rounded-md mb-4" />
        ) : (
          <div className="w-full h-64 bg-gray-200 rounded-md mb-4 flex flex-col items-center justify-center text-gray-500">
            <ImageIcon size={48} className="mb-2" />
            <p className="mb-2">No image available.</p>
            <Button onClick={handleGenerateImage} disabled={isGeneratingImage} size="sm">
              {isGeneratingImage ? 'Generating...' : 'Generate Image with AI'}
            </Button>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {meal.servings && (
            <div className="flex items-center text-sm text-gray-600">
              <Users className="h-4 w-4 mr-2 text-blue-500" />
              <span>Servings: {meal.servings}</span>
            </div>
          )}
          {/* Conditional display of calories */}
          {!profileLoading && profile?.track_calories && meal.estimated_calories && (
            <div className="flex items-center text-sm text-gray-600">
              <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" /> {/* Changed icon for variety */}
              <span>Est. Calories: {meal.estimated_calories}</span>
            </div>
          )}
        </div>


        {meal.meal_tags && meal.meal_tags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-purple-500" />
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {meal.meal_tags.map((tag, index) => (
                <Badge key={index} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>
        )}

        {ingredientsList.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 flex items-center">
              <Utensils className="h-5 w-5 mr-2 text-green-500" />
              Ingredients
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-gray-600">
              {ingredientsList.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {instructionsList.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-red-500" />
              Instructions
            </h3>
            <ol className="list-decimal list-inside pl-4 space-y-2 text-gray-600">
              {instructionsList.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button onClick={handleEdit} className="flex-1 bg-blue-500 hover:bg-blue-600">
            <Edit3 className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button onClick={handleDelete} variant="destructive" className="flex-1">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecipeView;