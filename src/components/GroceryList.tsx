import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format, endOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks } from "lucide-react";

interface PlannedMealWithIngredients {
  meals: {
    name: string;
    ingredients: string | null;
  } | null;
}

interface GroceryListProps {
  userId: string;
  currentWeekStart: Date;
}

// Helper function to strip portions, units, and some descriptors
function stripPortions(line: string): string {
  let processedLine = line.toLowerCase();

  // 1. Remove all parenthetical content (e.g., "(optional)", "(for garnish)")
  processedLine = processedLine.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // 2. Remove common trailing qualifiers
  const trailingQualifiers = [
    /,?\s*to taste/, /,?\s*for garnish/, /,?\s*optional/, /,?\s*as needed/,
    /,?\s*for serving/, /,?\s*if desired/, /,?\s*if using/,
    /,?\s*or more to taste/, /,?\s*or as needed/
  ];
  for (const regex of trailingQualifiers) {
    processedLine = processedLine.replace(new RegExp(regex.source + '$', 'i'), '');
  }
  processedLine = processedLine.trim();

  // 3. Remove leading numbers, fractions, and ranges (e.g., "1-2")
  processedLine = processedLine.replace(/^\d+-\d+\s+/, ''); // e.g. "1-2 "
  processedLine = processedLine.replace(/^\d+(\s*\/\s*\d+)?(\.\d+)?\s*/, ''); // e.g. "1 ", "1/2 ", "0.5 "
  processedLine = processedLine.replace(/^a\s+/, ''); // e.g. "a pinch" -> "pinch"
  processedLine = processedLine.trim();

  // 4. Loop to remove common units and descriptive adjectives that often precede ingredients
  // Order can be important; longer units/phrases first if they are substrings of others.
  const unitsAndAdjectives = [
    'tablespoons', 'tablespoon', 'tbsp',
    'teaspoons', 'teaspoon', 'tsp',
    'fluid ounces', 'fluid ounce', 'fl oz',
    'ounces', 'ounce', 'oz',
    'pounds', 'pound', 'lbs', 'lb',
    'kilograms', 'kilogram', 'kg',
    'grams', 'gram', 'g',
    'milliliters', 'milliliter', 'ml',
    'liters', 'liter', 'l',
    'cups', 'cup', 'c',
    'pints', 'pint', 'pt',
    'quarts', 'quart', 'qt',
    'gallons', 'gallon', 'gal',
    'cloves', 'clove', // for garlic
    'pinches', 'pinch',
    'dashes', 'dash',
    'cans', 'can',
    'packages', 'package', 'pkg',
    'bunches', 'bunch',
    'heads', 'head', // for lettuce, garlic
    'stalks', 'stalk', // for celery
    'sprigs', 'sprig', // for herbs
    'slices', 'slice',
    'pieces', 'piece',
    'sticks', 'stick', // for butter
    'bottles', 'bottle', 'boxes', 'box', 'bags', 'bag', 'containers', 'container',
    'bars', 'bar', 'loaves', 'loaf', 'bulbs', 'bulb', 'ears', 'ear', 'sheets', 'sheet', 'leaves', 'leaf',
    // Common adjectives
    'large', 'medium', 'small',
    'fresh', 'dried', 'ground',
    'boneless', 'skinless',
    'whole', 'diced', 'sliced', 'chopped', 'minced', 'grated', 'pounded',
    'melted', 'softened', 'beaten', 'crushed', 'toasted', 'cooked', 'uncooked',
    'ripe', 'firm', 'raw', 'peeled', 'cored', 'seeded', 'rinsed', 'drained', 'divided'
  ];

  let unitFoundAndRemoved = true;
  while(unitFoundAndRemoved) {
    unitFoundAndRemoved = false;
    for (const unit of unitsAndAdjectives) {
      const unitRegex = new RegExp(`^${unit}(\\s+|$)`, 'i');
      if (unitRegex.test(processedLine)) {
        processedLine = processedLine.replace(unitRegex, '').trim();
        unitFoundAndRemoved = true;
        break; 
      }
    }
  }
  
  // 5. Final trim and capitalize
  processedLine = processedLine.trim();
  if (processedLine.length > 0) {
    processedLine = processedLine.charAt(0).toUpperCase() + processedLine.slice(1);
  }

  return processedLine;
}

const GroceryList: React.FC<GroceryListProps> = ({ userId, currentWeekStart }) => {
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 }); // Assuming week starts on Monday

  const { data: plannedMeals, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["groceryList", userId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId) return [];
      const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
      const endDateStr = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("meal_plans")
        .select("meals ( name, ingredients )")
        .eq("user_id", userId)
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const uniqueIngredientLines = useMemo(() => {
    if (!plannedMeals) return [];

    const allIngredientBlocks = plannedMeals
      .map(pm => pm.meals?.ingredients)
      .filter(Boolean) as string[];

    const processedLines = allIngredientBlocks.flatMap(block =>
      block.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => stripPortions(line)) // Apply stripping function
        .filter(line => line.length > 0) // Filter out if stripping made it empty
    );
    
    // Make unique *after* stripping portions and sort for consistent order
    return Array.from(new Set(processedLines)).sort();
  }, [plannedMeals]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5" />
            Grocery List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5" />
            Grocery List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load grocery list: {error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListChecks className="mr-2 h-5 w-5" />
          Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueIngredientLines.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {uniqueIngredientLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">
            No ingredients found for the planned meals this week, or ingredients could not be processed.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryList;