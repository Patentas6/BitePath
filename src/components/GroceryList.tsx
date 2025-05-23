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
    ingredients: string | null; // This will be a JSON string
  } | null;
}

interface ParsedIngredientItem {
  name: string;
  quantity: number;
  unit: string;
}

// Constants for unit categorization (can be refined)
const SUMMABLE_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "piece", "pieces", "can", "cans", "bottle", "bottles", "package", "packages",
  "slice", "slices", "item", "items", "clove", "cloves", "sprig", "sprigs",
  "head", "heads", "bunch", "bunches"
];

// Units that are typically not summed but listed with their quantities
const NON_SUMMABLE_DISPLAY_UNITS: ReadonlyArray<string> = [
  "cup", "cups", "tsp", "teaspoon", "teaspoons",
  "tbsp", "tablespoon", "tablespoons", "pinch", "pinches", "dash", "dashes"
];


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


interface GroceryListItem {
  name: string;
  totalQuantity: number;
  unit: string | null; // Unit might be null if not summable or not consistently defined
  isSummable: boolean; // Indicates if totalQuantity represents a sum
  originalItems: ParsedIngredientItem[]; // To store original parsed items for tooltip or detailed view
}

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

  const aggregatedIngredients = useMemo(() => {
    if (!plannedMeals) return [];
    
    const ingredientMap = new Map<string, GroceryListItem>();

    plannedMeals.forEach(pm => {
      const ingredientsBlock = pm.meals?.ingredients;
      if (ingredientsBlock && typeof ingredientsBlock === 'string') {
        try {
          const parsedIngredientList: ParsedIngredientItem[] = JSON.parse(ingredientsBlock);
          if (Array.isArray(parsedIngredientList)) {
            parsedIngredientList.forEach(item => {
              if (!item.name || typeof item.quantity !== 'number' || !item.unit) {
                console.warn("Skipping malformed ingredient item:", item);
                return;
              }

              const normalizedName = item.name.trim().toLowerCase();
              const unitLower = item.unit.toLowerCase();
              
              // Use a composite key if units are not meant to be mixed (e.g. "flour, 1 cup" and "flour, 200g")
              // For simplicity here, we'll use normalizedName as key and handle unit logic below.
              const mapKey = normalizedName;

              const existing = ingredientMap.get(mapKey);

              if (existing) {
                existing.originalItems.push(item);
                if (existing.isSummable && SUMMABLE_UNITS.includes(unitLower) && existing.unit?.toLowerCase() === unitLower) {
                  existing.totalQuantity += item.quantity;
                } else if (existing.isSummable && SUMMABLE_UNITS.includes(unitLower) && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitLower)) {
                  // If units are different but both summable (e.g. g and kg), this needs conversion logic (not implemented here)
                  // For now, if units differ, we might list them separately or just add to originalItems
                  // This part can be enhanced for unit conversion.
                  // As a simple approach, if units differ, we might make it non-summable for display.
                  console.warn(`Mixing units for ${normalizedName}: ${existing.unit} and ${item.unit}. Summation might be inaccurate without conversion.`);
                  existing.isSummable = false; // Mark as non-summable if units are mixed without conversion
                } else {
                  // If existing is not summable, or new item's unit is not summable with existing
                  existing.isSummable = false;
                }
              } else {
                const isItemSummable = SUMMABLE_UNITS.includes(unitLower);
                ingredientMap.set(mapKey, {
                  name: item.name, // Keep original casing for display name
                  totalQuantity: item.quantity,
                  unit: item.unit,
                  isSummable: isItemSummable,
                  originalItems: [item]
                });
              }
            });
          }
        } catch (e) {
          console.warn("Failed to parse ingredients JSON for a meal, or it's in old format:", ingredientsBlock, e);
        }
      }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMeals]);

  const categorizedDisplayList = useMemo(() => {
    const grouped: Record<Category, Array<{ name: string; displayText: string; originalItemsTooltip: string }>> = 
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, Array<{ name: string; displayText: string; originalItemsTooltip: string }>>);

    aggregatedIngredients.forEach(item => {
      let foundCategory: Category = 'Other';
      const itemLower = item.name.toLowerCase();
      for (const cat of categoryOrder) {
        if (cat === 'Other') continue;
        const keywords = categoriesMap[cat];
        if (keywords.some(keyword => itemLower.includes(keyword))) {
          foundCategory = cat;
          break;
        }
      }
      
      let displayText = item.name;
      if (item.isSummable && item.totalQuantity > 0) {
        const displayTotalQuantity = item.totalQuantity % 1 === 0 ? item.totalQuantity : item.totalQuantity.toFixed(1);
        let unitDisplay = item.unit || "";
        if (item.totalQuantity > 1 && unitDisplay && !unitDisplay.endsWith('s') && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitDisplay.toLowerCase())) {
           // Basic pluralization, can be improved
           if (unitDisplay.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitDisplay.toLowerCase())) {
              unitDisplay = unitDisplay.slice(0, -1) + 'ies';
           } else {
              unitDisplay += "s";
           }
        }
        displayText = `${item.name}: ${displayTotalQuantity} ${unitDisplay}`;
      } else if (!item.isSummable && item.originalItems.length > 0) {
        // For non-summable items, list them or show the first one
        displayText = item.originalItems.map(orig => `${item.name}: ${orig.quantity} ${orig.unit}`).join('; ');
         if (item.originalItems.length > 1) displayText = `${item.name} (multiple entries)`; // Simpler display for multiple non-summable
         else displayText = `${item.name}: ${item.originalItems[0].quantity} ${item.originalItems[0].unit}`;

      }


      const originalItemsTooltip = item.originalItems.map(oi => `${oi.quantity} ${oi.unit} ${oi.name}`).join('\n');

      grouped[foundCategory].push({ name: item.name, displayText, originalItemsTooltip });
    });

    for (const cat of categoryOrder) {
      grouped[cat].sort((a,b) => a.name.localeCompare(b.name));
    }
    return grouped;
  }, [aggregatedIngredients]);


  useEffect(() => {
    setStruckItems(prevStruckItems => {
      const newPersistedStruckItems = new Set<string>();
      const currentDisplayTexts = Object.values(categorizedDisplayList).flat().map(item => item.displayText);
      if (currentDisplayTexts.length > 0) {
        for (const item of prevStruckItems) {
          if (currentDisplayTexts.includes(item)) {
            newPersistedStruckItems.add(item);
          }
        }
      }
      return newPersistedStruckItems;
    });
  }, [categorizedDisplayList]);


  const handleItemClick = (displayText: string) => {
    setStruckItems(prevStruckItems => {
      const newStruckItems = new Set(prevStruckItems);
      if (newStruckItems.has(displayText)) {
        newStruckItems.delete(displayText);
      } else {
        newStruckItems.add(displayText);
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
  
  const isEmptyList = Object.values(categorizedDisplayList).every(list => list.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmptyList ? (
          <p className="text-sm text-gray-600">No ingredients found for the planned meals this week, or ingredients could not be processed into the new format.</p>
        ) : (
          categoryOrder.map(category => {
            const itemsInCategory = categorizedDisplayList[category];
            if (itemsInCategory && itemsInCategory.length > 0) {
              const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item.displayText));
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
                    {itemsInCategory.map((item) => (
                      <li
                        key={item.displayText}
                        onClick={() => handleItemClick(item.displayText)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 ${
                          struckItems.has(item.displayText) ? 'line-through text-gray-400' : 'text-gray-700'
                        }`}
                        title={item.originalItemsTooltip}
                      >
                        {item.displayText}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            return null;
          })
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryList;