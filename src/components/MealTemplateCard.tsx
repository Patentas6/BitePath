import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge"; 
import { cn } from '@/lib/utils';

export interface MealTemplate {
  id: string;
  name: string;
  ingredients?: string | null;
  instructions?: string | null;
  category?: string | null; 
  image_url?: string | null;
  meal_tags?: string[] | null; 
}

interface ParsedIngredient {
  name: string;
  quantity?: number | string; 
  unit?: string;
  description?: string;
}

interface MealTemplateCardProps {
  template: MealTemplate;
  onAddToMyMeals: (template: MealTemplate) => void;
  isAdding: boolean;
  isAlreadyAdded: boolean;
}

const MealTemplateCard: React.FC<MealTemplateCardProps> = ({ template, onAddToMyMeals, isAdding, isAlreadyAdded }) => {
  
  const formatIngredientsForDisplay = (ingredientsString: string | null | undefined, maxLength: number = 100): string => {
    if (!ingredientsString) return 'Not specified';
    try {
      const parsedIngredients: ParsedIngredient[] = JSON.parse(ingredientsString);
      if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
        const names = parsedIngredients.map(ing => ing.name).filter(Boolean);
        if (names.length === 0) return 'Ingredients listed (check format).';
        
        let displayText = names.slice(0, 5).join(', ');
        if (names.length > 5) {
          displayText += ', ...';
        }
        return displayText;
      }
      return 'No ingredients listed or format error.';
    } catch (e) {
      if (ingredientsString.length <= maxLength) return ingredientsString;
      return ingredientsString.substring(0, maxLength) + '...';
    }
  };

  const truncateText = (text: string | null | undefined, maxLength: number) => {
    if (!text) return 'Not specified';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className={cn(
      "flex flex-col hover:shadow-lg transition-shadow duration-200",
      isAlreadyAdded && "opacity-70" 
    )}>
      <CardHeader>
        {template.image_url && (
          <img 
            src={template.image_url} 
            alt={template.name} 
            className="w-full h-40 object-cover rounded-t-md mb-4" 
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <CardTitle>{template.name}</CardTitle>
        {template.category && (
          <CardDescription className="text-sm text-muted-foreground">{template.category}</CardDescription>
        )}
        {template.meal_tags && template.meal_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.meal_tags.map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <div>
          <h4 className="font-semibold text-sm mb-1">Ingredients:</h4>
          <p className="text-xs text-muted-foreground mb-2 whitespace-pre-line">
            {formatIngredientsForDisplay(template.ingredients)}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-1">Instructions:</h4>
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {truncateText(template.instructions, 120)}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onAddToMyMeals(template)} 
          className="w-full"
          disabled={isAdding || isAlreadyAdded}
          variant={isAlreadyAdded ? "secondary" : "default"}
        >
          {isAlreadyAdded ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          {isAdding ? 'Adding...' : isAlreadyAdded ? 'Added to My Meals' : 'Add to My Meals'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MealTemplateCard;