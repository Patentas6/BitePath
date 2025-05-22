import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from 'lucide-react';

export interface MealTemplate {
  id: string;
  name: string;
  ingredients?: string | null;
  instructions?: string | null;
  category?: string | null;
  image_url?: string | null;
}

interface MealTemplateCardProps {
  template: MealTemplate;
  onAddToMyMeals: (template: MealTemplate) => void;
  isAdding: boolean;
}

const MealTemplateCard: React.FC<MealTemplateCardProps> = ({ template, onAddToMyMeals, isAdding }) => {
  const truncateText = (text: string | null | undefined, maxLength: number) => {
    if (!text) return 'Not specified';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        {template.image_url && (
          <img 
            src={template.image_url} 
            alt={template.name} 
            className="w-full h-40 object-cover rounded-t-md mb-4" 
            onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
          />
        )}
        <CardTitle>{template.name}</CardTitle>
        {template.category && (
          <CardDescription className="text-sm text-muted-foreground">{template.category}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <div>
          <h4 className="font-semibold text-sm mb-1">Ingredients:</h4>
          <p className="text-xs text-gray-600 mb-2 whitespace-pre-line">
            {truncateText(template.ingredients, 100)}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-1">Instructions:</h4>
          <p className="text-xs text-gray-600 whitespace-pre-line">
            {truncateText(template.instructions, 120)}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onAddToMyMeals(template)} 
          className="w-full"
          disabled={isAdding}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {isAdding ? 'Adding...' : 'Add to My Meals'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MealTemplateCard;