"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meal } from '@/types';
import { Utensils, Tag, Image as ImageIcon, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { useUserProfile } from '@/contexts/UserProfileContext'; // Import useUserProfile

interface MealCardProps {
  meal: Meal;
  onView: (meal: Meal) => void;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
  onPlan: (meal: Meal) => void;
}

const MealCard: React.FC<MealCardProps> = ({ meal, onView, onEdit, onDelete, onPlan }) => {
  const { profile, loading: profileLoading } = useUserProfile(); // Get profile and loading state

  const truncateText = (text: string | null | undefined, maxLength: number) => {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-2">
        {meal.image_url ? (
          <img src={meal.image_url} alt={meal.name} className="w-full h-40 object-cover rounded-t-lg" />
        ) : (
          <div className="w-full h-40 bg-gray-200 rounded-t-lg flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-400" />
          </div>
        )}
        <CardTitle className="mt-4 text-xl font-semibold text-gray-800">{meal.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          {meal.ingredients && (
            <div className="flex items-start text-sm text-gray-600">
              <Utensils className="h-4 w-4 mr-2 mt-1 text-green-500 flex-shrink-0" />
              <p>
                <span className="font-medium text-gray-700">Ingredients: </span>
                {truncateText(meal.ingredients.split('\n')[0], 50)}
              </p>
            </div>
          )}
          
          {/* Conditional display of calories */}
          {!profileLoading && profile?.track_calories && meal.estimated_calories && (
            <div className="flex items-center text-sm text-gray-600">
              <AlertTriangle className="h-4 w-4 mr-2 text-orange-500 flex-shrink-0" />
              <p>
                <span className="font-medium text-gray-700">Est. Calories: </span>
                {meal.estimated_calories}
              </p>
            </div>
          )}

          {meal.meal_tags && meal.meal_tags.length > 0 && (
            <div className="flex items-start text-sm text-gray-600">
              <Tag className="h-4 w-4 mr-2 mt-1 text-purple-500 flex-shrink-0" />
              <div>
                <span className="font-medium text-gray-700">Tags: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {meal.meal_tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                  {meal.meal_tags.length > 3 && <Badge variant="outline" className="text-xs">...</Badge>}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-4 border-t">
        <Button onClick={() => onView(meal)} variant="outline" className="w-full sm:w-auto">View Recipe</Button>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => onEdit(meal)} variant="ghost" size="sm" className="flex-1 sm:flex-none">Edit</Button>
          <Button onClick={() => onPlan(meal)} variant="default" size="sm" className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600">Plan</Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default MealCard;