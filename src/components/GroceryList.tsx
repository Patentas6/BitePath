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

interface ParsedIngredientItem {
  name: string;
  quantity: number; 
  unit: string;
  description?: string; 
}

// Units that are typically not summed but listed with their quantities
const NON_SUMMABLE_DISPLAY_UNITS: ReadonlyArray<string> = [
  "cup", "cups", "tsp", "teaspoon", "teaspoons",
  "tbsp", "tablespoon", "tablespoons", "pinch", "pinches", "dash", "dashes"
];

const SUMMABLE_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "piece", "pieces", "can", "cans", "bottle", "bottles", "package", "packages",
  "slice", "slices", "item", "items", "clove", "cloves", "sprig", "sprigs",
  "head", "heads", "bunch", "bunches"
];

// New constants for display logic
const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units']; // Added 'unit' as it's sometimes used generically
const MEASUREMENT_UNITS_FOR_LIGHTER_COLOR: ReadonlyArray<string> = [
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'pinch', 'pinches', 'dash', 'dashes',
  'ml', 'milliliter', 'milliliters',
  'l', 'liter', 'liters', // Liters can be borderline, but often a recipe measurement for liquids
  'fl oz', 'fluid ounce', 'fluid ounces',
  'g', 'gram', 'grams', // Grams can be for buying (e.g. spices) but often recipe specific for small amounts
  'oz', 'ounce', 'ounces' // Ounces can be for buying (e.g. cheese) but often recipe specific
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
  unit: string | null; 
  isSummable: boolean; 
  originalItems: ParsedIngredientItem[]; 
}

// Updated structure for the display list
interface CategorizedDisplayListItem {
  name: string;
  displayText: string;
  originalItemsTooltip: string;
  applyLighterColor: boolean;
}

interface GroceryListProps {
  userId: string;
  currentWeekStart: Date;
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
              const quantityAsNumber = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;

              if (!item.name || typeof quantityAsNumber !== 'number' || isNaN(quantityAsNumber) || !item.unit) {
                console.warn("Skipping malformed ingredient item (name, quantity, or unit issue):", item);
                return;
              }
              const processedItem: ParsedIngredientItem = { ...item, quantity: quantityAsNumber };

              const normalizedName = processedItem.name.trim().toLowerCase();
              const unitLower = processedItem.unit.toLowerCase();
              
              const mapKey = normalizedName; 

              const existing = ingredientMap.get(mapKey);

              if (existing) {
                existing.originalItems.push(processedItem);
                if (existing.isSummable && SUMMABLE_UNITS.includes(unitLower) && existing.unit?.toLowerCase() === unitLower) {
                  existing.totalQuantity += processedItem.quantity;
                } else if (existing.isSummable && SUMMABLE_UNITS.includes(unitLower) && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitLower)) {
                  console.warn(`Mixing units for ${normalizedName}: ${existing.unit} and ${processedItem.unit}. Summation might be inaccurate without conversion.`);
                  existing.isSummable = false; 
                } else {
                  existing.isSummable = false;
                }
              } else {
                const isItemSummable = SUMMABLE_UNITS.includes(unitLower) && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitLower);
                ingredientMap.set(mapKey, {
                  name: processedItem.name, 
                  totalQuantity: processedItem.quantity,
                  unit: processedItem.unit,
                  isSummable: isItemSummable,
                  originalItems: [processedItem]
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
    const grouped: Record<Category, CategorizedDisplayListItem[]> = 
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, CategorizedDisplayListItem[]>);

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
      
      const itemUnitLower = item.unit?.toLowerCase() || '';
      const isPieceUnitItem = PIECE_UNITS.includes(itemUnitLower);
      const applyLighterColor = MEASUREMENT_UNITS_FOR_LIGHTER_COLOR.includes(itemUnitLower);

      let currentDisplayText = item.name; // Default to just name for piece units or if logic below doesn't apply

      if (item.isSummable && item.totalQuantity > 0) {
        if (isPieceUnitItem) {
          currentDisplayText = item.name; // Only name if it's a piece unit
        } else {
          const displayTotalQuantity = item.totalQuantity % 1 === 0 ? item.totalQuantity : item.totalQuantity.toFixed(1);
          let unitDisplay = item.unit || "";
          if (item.totalQuantity > 1 && unitDisplay && !unitDisplay.endsWith('s') && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitDisplay.toLowerCase()) && !PIECE_UNITS.includes(unitDisplay.toLowerCase())) {
             if (unitDisplay.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitDisplay.toLowerCase())) {
                unitDisplay = unitDisplay.slice(0, -1) + 'ies';
             } else {
                unitDisplay += "s";
             }
          }
          currentDisplayText = `${item.name}: ${displayTotalQuantity} ${unitDisplay}`;
        }
      } else if (!item.isSummable && item.originalItems.length > 0) {
         // For non-summable, show individual entries or a summary
         // If it's a piece unit, just the name might be preferred if quantities are small or implied
        if (item.originalItems.length === 1 && PIECE_UNITS.includes(item.originalItems[0].unit.toLowerCase())) {
            currentDisplayText = item.originalItems[0].name;
        } else if (item.originalItems.length > 1 && item.originalItems.every(oi => PIECE_UNITS.includes(oi.unit.toLowerCase()))) {
            currentDisplayText = item.name; // If multiple "piece" items, just show the aggregated name
        } else {
            // Fallback for non-summable, non-piece, or mixed units
            currentDisplayText = item.originalItems.map(orig => {
                if (PIECE_UNITS.includes(orig.unit.toLowerCase())) return orig.name;
                return `${orig.name}: ${orig.quantity} ${orig.unit}`;
            }).join('; ');
            if (item.originalItems.length > 1) currentDisplayText = `${item.name} (multiple entries)`;
            else if (!PIECE_UNITS.includes(item.originalItems[0].unit.toLowerCase())) {
                 currentDisplayText = `${item.name}: ${item.originalItems[0].quantity} ${item.originalItems[0].unit}`;
            } else {
                 currentDisplayText = item.name; // Single non-summable piece item
            }
        }
      }


      const originalItemsTooltip = item.originalItems.map(oi => {
        let tip = `${oi.quantity} ${oi.unit} ${oi.name}`;
        if (oi.description) { 
          tip += ` (${oi.description})`;
        }
        return tip;
      }).join('\n');

      grouped[foundCategory].push({ name: item.name, displayText: currentDisplayText, originalItemsTooltip, applyLighterColor });
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
                        key={item.displayText + item.name} // Ensure unique key if displayText can be non-unique
                        onClick={() => handleItemClick(item.displayText)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 ${
                          struckItems.has(item.displayText) 
                            ? 'line-through text-gray-400' 
                            : (item.applyLighterColor ? 'text-gray-500' : 'text-gray-700')
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