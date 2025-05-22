import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
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

  // 1. Remove parenthetical phrases and common trailing qualifiers
  processedLine = processedLine.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // Note: The explicit loop for trailingQualifiers that was in the enhanced version is removed here
  // to match the state before the "handle numbers after ingredient" change.
  // The original version from context handled some of this implicitly or had a TODO.
  // For a strict revert to the initial context's stripPortions:
  const trailingQualifiersPatterns = [
    /,?\s*to taste/i, /,?\s*for garnish/i, /,?\s*optional/i, /,?\s*as needed/i,
    /,?\s*for serving/i, /,?\s*if desired/i, /,?\s*if using/i, /,?\s*or more to taste/i,
    /,?\s*or as needed/i
  ];
  for (const pattern of trailingQualifiersPatterns) {
    processedLine = processedLine.replace(pattern, '');
  }
  processedLine = processedLine.trim();
  
  // 2. Remove leading numbers/fractions
  processedLine = processedLine.replace(/^\d+-\d+\s+/, ''); // e.g., "1-2 "
  processedLine = processedLine.replace(/^\d+(\s*\/\s*\d+)?(\.\d+)?\s*/, ''); // e.g., "1 ", "1/2 ", "0.5 "
  
  // 3. Remove "a " if it's at the beginning (e.g., "a pinch")
  processedLine = processedLine.replace(/^a\s+/, '');
  processedLine = processedLine.trim();

  // 4. Iteratively remove known units and adjectives from the beginning of the string
  const unitsAndAdjectives = [
    'tablespoons', 'tablespoon', 'tbsp', 'teaspoons', 'teaspoon', 'tsp', 
    'fluid ounces', 'fluid ounce', 'fl oz', 'ounces', 'ounce', 'oz', 
    'pounds', 'pound', 'lbs', 'lb', 'kilograms', 'kilogram', 'kg', 
    'grams', 'gram', 'g', 'milliliters', 'milliliter', 'ml', 'liters', 'liter', 'l', 
    'cups', 'cup', 'c', 'pints', 'pint', 'pt', 'quarts', 'quart', 'qt', 
    'gallons', 'gallon', 'gal', 'cloves', 'clove', 'pinches', 'pinch', 
    'dashes', 'dash', 'cans', 'can', 'packages', 'package', 'pkg', 
    'bunches', 'bunch', 'heads', 'head', 'stalks', 'stalk', 'sprigs', 'sprig', 
    'slices', 'slice', 'pieces', 'piece', 'sticks', 'stick', 'bottles', 'bottle', 
    'boxes', 'box', 'bags', 'bag', 'containers', 'container', 'bars', 'bar', 
    'loaves', 'loaf', 'bulbs', 'bulb', 'ears', 'ear', 'sheets', 'sheet', 'leaves', 'leaf',
    // Adjectives / descriptors (often precede the noun)
    'large', 'medium', 'small', 'fresh', 'dried', 'ground', 'boneless', 
    'skinless', 'whole', 'diced', 'sliced', 'chopped', 'minced', 'grated', 
    'pounded', 'melted', 'softened', 'beaten', 'crushed', 'toasted', 
    'cooked', 'uncooked', 'ripe', 'firm', 'raw', 'peeled', 'cored', 'seeded', 
    'rinsed', 'drained', 'divided'
  ];

  let unitFoundAndRemoved = true;
  while (unitFoundAndRemoved) {
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
  processedLine = processedLine.trim();

  // 5. Capitalize the first letter of the remaining string
  if (processedLine.length > 0) {
    processedLine = processedLine.charAt(0).toUpperCase() + processedLine.slice(1);
  }

  return processedLine;
}


const categoriesMap = {
  Produce: ['apple', 'banana', 'orange', 'pear', 'grape', 'berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'broccoli', 'spinach', 'lettuce', 'salad greens', 'celery', 'cucumber', 'bell pepper', 'pepper', 'zucchini', 'mushroom', 'lemon', 'lime', 'cabbage', 'kale', 'asparagus', 'eggplant', 'corn', 'sweet potato', 'ginger', 'parsley', 'cilantro', 'basil', 'mint', 'rosemary', 'thyme', 'dill', 'leek', 'scallion', 'green bean', 'pea', 'artichoke', 'beet', 'radish', 'squash'],
  'Meat & Poultry': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'sausage', 'bacon', 'ham', 'steak', 'mince', 'ground meat', 'veal', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'trout', 'sardines', 'halibut', 'catfish', 'crab', 'lobster', 'scallop', 'mussel', 'clam'],
  'Dairy & Eggs': ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream', 'cottage cheese', 'cream cheese', 'half-and-half', 'ghee'],
  Pantry: ['flour', 'sugar', 'salt', 'black pepper', 'spice', 'herb', 'olive oil', 'vegetable oil', 'coconut oil', 'vinegar', 'rice', 'pasta', 'noodle', 'bread', 'cereal', 'oats', 'oatmeal', 'beans', 'lentils', 'chickpeas', 'nuts', 'almonds', 'walnuts', 'peanuts', 'seeds', 'chia seeds', 'flax seeds', 'canned tomatoes', 'canned beans', 'canned corn', 'soup', 'broth', 'stock', 'bouillon', 'soy sauce', 'worcestershire', 'hot sauce', 'bbq sauce', 'condiment', 'ketchup', 'mustard', 'mayonnaise', 'relish', 'jam', 'jelly', 'honey', 'maple syrup', 'baking soda', 'baking powder', 'yeast', 'vanilla extract', 'chocolate', 'cocoa powder', 'coffee', 'tea', 'crackers', 'pretzels', 'chips', 'popcorn', 'dried fruit', 'protein powder', 'breadcrumbs', 'tortillas', 'tahini', 'peanut butter', 'almond butter'],
  Frozen: ['ice cream', 'sorbet', 'frozen vegetables', 'frozen fruit', 'frozen meal', 'frozen pizza', 'frozen fries', 'frozen peas', 'frozen corn', 'frozen spinach'],
  Beverages: ['water', 'sparkling water', 'juice', 'soda', 'cola', 'wine', 'beer', 'spirits', 'kombucha', 'coconut water', 'sports drink', 'energy drink'],
  Other: [], 
};
type Category = keyof typeof categoriesMap;
const categoryOrder: Category[] = ['Produce', 'Meat & Poultry', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Beverages', 'Other'];


const GroceryList: React.FC<GroceryListProps> = ({ userId, currentWeekStart }) => {
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const [struckItems, setStruckItems] = useState<Set<string>>(new Set());

  const { data: plannedMeals, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["groceryList", userId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId) return [];
      const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
      const endDateStr = format(weekEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase.from("meal_plans").select("meals ( name, ingredients )").eq("user_id", userId).gte("plan_date", startDateStr).lte("plan_date", endDateStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const uniqueIngredientLines = useMemo(() => {
    if (!plannedMeals) return [];
    const allIngredientBlocks = plannedMeals.map(pm => pm.meals?.ingredients).filter(Boolean) as string[];
    const processedLines = allIngredientBlocks.flatMap(block => block.split('\n').map(line => line.trim()).filter(line => line.length > 0).map(line => stripPortions(line)).filter(line => line.length > 0));
    return Array.from(new Set(processedLines)).sort();
  }, [plannedMeals]);

  useEffect(() => {
    setStruckItems(prevStruckItems => {
      const newPersistedStruckItems = new Set<string>();
      if (uniqueIngredientLines && uniqueIngredientLines.length > 0) {
        for (const item of prevStruckItems) {
          if (uniqueIngredientLines.includes(item)) {
            newPersistedStruckItems.add(item);
          }
        }
      }
      return newPersistedStruckItems;
    });
  }, [uniqueIngredientLines]);

  const categorizedIngredients = useMemo(() => {
    const grouped: Record<Category, string[]> = {} as Record<Category, string[]>;
    categoryOrder.forEach(cat => grouped[cat] = []);

    for (const line of uniqueIngredientLines) {
      let foundCategory: Category = 'Other';
      const lineLower = line.toLowerCase();
      for (const cat of categoryOrder) {
        if (cat === 'Other') continue;
        const keywords = categoriesMap[cat];
        if (keywords.some(keyword => lineLower.includes(keyword))) {
          foundCategory = cat;
          break;
        }
      }
      grouped[foundCategory].push(line);
    }
    return grouped;
  }, [uniqueIngredientLines]);

  const handleItemClick = (item: string) => {
    setStruckItems(prevStruckItems => {
      const newStruckItems = new Set(prevStruckItems);
      if (newStruckItems.has(item)) {
        newStruckItems.delete(item);
      } else {
        newStruckItems.add(item);
      }
      return newStruckItems;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Grocery List</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-4 w-1/2 mb-2" /><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Grocery List</CardTitle></CardHeader>
        <CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Failed to load grocery list: {error.message}</AlertDescription></Alert></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}</CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueIngredientLines.length > 0 ? (
          categoryOrder.map(category => {
            const itemsInCategory = categorizedIngredients[category];
            if (itemsInCategory && itemsInCategory.length > 0) {
              const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item));
              return (
                <div key={category} className="mb-4">
                  <h3 
                    className={`text-md font-semibold text-gray-800 border-b pb-1 mb-2 ${
                      allItemsInCategoryStruck ? 'line-through text-gray-400' : ''
                    }`}
                  >
                    {category}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {itemsInCategory.map((line, index) => (
                      <li
                        key={`${category}-${index}-${line}`}
                        onClick={() => handleItemClick(line)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 ${
                          struckItems.has(line) ? 'line-through text-gray-400' : 'text-gray-700'
                        }`}
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            return null;
          })
        ) : (
          <p className="text-sm text-gray-600">No ingredients found for the planned meals this week, or ingredients could not be processed.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryList;