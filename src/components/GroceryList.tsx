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

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const MEASUREMENT_UNITS_FOR_LIGHTER_COLOR: ReadonlyArray<string> = [
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'pinch', 'pinches', 'dash', 'dashes',
  'ml', 'milliliter', 'milliliters',
  'l', 'liter', 'liters',
  'fl oz', 'fluid ounce', 'fluid ounces',
  'g', 'gram', 'grams', // Grams can be recipe specific for small amounts
  'oz', 'ounce', 'ounces' // Ounces can be recipe specific
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

interface CategorizedDisplayListItem {
  itemName: string;
  detailsPart: string;
  detailsClass: string; // Tailwind class for the details part
  originalItemsTooltip: string;
  uniqueKey: string; // For React key and struckItems Set
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
                console.warn("Skipping malformed ingredient item:", item); return;
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
                } else { existing.isSummable = false; }
              } else {
                const isItemSummable = SUMMABLE_UNITS.includes(unitLower) && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitLower);
                ingredientMap.set(mapKey, {
                  name: processedItem.name, totalQuantity: processedItem.quantity,
                  unit: processedItem.unit, isSummable: isItemSummable,
                  originalItems: [processedItem]
                });
              }
            });
          }
        } catch (e) { console.warn("Failed to parse ingredients JSON:", ingredientsBlock, e); }
      }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMeals]);

  const categorizedDisplayList = useMemo(() => {
    const grouped: Record<Category, CategorizedDisplayListItem[]> = 
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, CategorizedDisplayListItem[]>);

    aggregatedIngredients.forEach(aggItem => {
      let foundCategory: Category = 'Other';
      const itemLower = aggItem.name.toLowerCase();
      for (const cat of categoryOrder) {
        if (cat === 'Other') continue;
        if (categoriesMap[cat].some(keyword => itemLower.includes(keyword))) {
          foundCategory = cat; break;
        }
      }

      const itemName = aggItem.name;
      let detailsPart = "";
      let detailsClass = "text-gray-700"; // Default color for details

      const itemUnitLower = aggItem.unit?.toLowerCase() || '';
      const isPieceUnitItem = PIECE_UNITS.includes(itemUnitLower);
      const isMeasurementUnit = MEASUREMENT_UNITS_FOR_LIGHTER_COLOR.includes(itemUnitLower);

      if (aggItem.isSummable && aggItem.totalQuantity > 0) {
        const displayQty = aggItem.totalQuantity % 1 === 0 ? aggItem.totalQuantity : aggItem.totalQuantity.toFixed(1);
        if (isPieceUnitItem) {
          detailsPart = `${displayQty}`; // Only quantity for piece units
          // detailsClass remains normal color for piece quantity
        } else {
          let unitDisplay = aggItem.unit || "";
          if (aggItem.totalQuantity > 1 && unitDisplay && !unitDisplay.endsWith('s') && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitDisplay.toLowerCase()) && !PIECE_UNITS.includes(unitDisplay.toLowerCase())) {
            if (unitDisplay.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitDisplay.toLowerCase())) {
              unitDisplay = unitDisplay.slice(0, -1) + 'ies';
            } else { unitDisplay += "s"; }
          }
          detailsPart = `${displayQty} ${unitDisplay}`;
          if (isMeasurementUnit) {
            detailsClass = "text-gray-500"; // Lighter color for measurement unit details
          }
        }
      } else if (!aggItem.isSummable && aggItem.originalItems.length > 0) {
        // For non-summable items, create a combined string for details.
        // Coloring will be based on the first original item's unit as a heuristic.
        detailsPart = aggItem.originalItems.map(orig => {
          const origUnitLower = orig.unit.toLowerCase();
          if (PIECE_UNITS.includes(origUnitLower)) {
            return `${orig.quantity}`; // Just quantity for pieces
          }
          return `${orig.quantity} ${orig.unit}`;
        }).join('; ');

        if (aggItem.originalItems.length > 0) {
          const firstOrigUnitLower = aggItem.originalItems[0].unit.toLowerCase();
          if (MEASUREMENT_UNITS_FOR_LIGHTER_COLOR.includes(firstOrigUnitLower) && !PIECE_UNITS.includes(firstOrigUnitLower)) {
            detailsClass = "text-gray-500";
          }
        }
      }
      
      const uniqueKey = `${itemName}:${detailsPart}-${foundCategory}`;
      const originalItemsTooltip = aggItem.originalItems.map(oi => `${oi.quantity} ${oi.unit} ${oi.name}${oi.description ? ` (${oi.description})` : ''}`).join('\n');
      
      grouped[foundCategory].push({ itemName, detailsPart, detailsClass, originalItemsTooltip, uniqueKey });
    });

    for (const cat of categoryOrder) {
      grouped[cat].sort((a,b) => a.itemName.localeCompare(b.itemName));
    }
    return grouped;
  }, [aggregatedIngredients]);

  useEffect(() => {
    setStruckItems(prevStruckItems => {
      const newPersistedStruckItems = new Set<string>();
      const currentUniqueKeys = Object.values(categorizedDisplayList).flat().map(item => item.uniqueKey);
      if (currentUniqueKeys.length > 0) {
        for (const itemKey of prevStruckItems) {
          if (currentUniqueKeys.includes(itemKey)) {
            newPersistedStruckItems.add(itemKey);
          }
        }
      }
      return newPersistedStruckItems;
    });
  }, [categorizedDisplayList]);

  const handleItemClick = (uniqueKey: string) => {
    setStruckItems(prevStruckItems => {
      const newStruckItems = new Set(prevStruckItems);
      if (newStruckItems.has(uniqueKey)) { newStruckItems.delete(uniqueKey); } 
      else { newStruckItems.add(uniqueKey); }
      return newStruckItems;
    });
  };

  if (isLoading) { /* ... loading skeleton ... */ }
  if (error) { /* ... error display ... */ }
  const isEmptyList = Object.values(categorizedDisplayList).every(list => list.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Grocery List for {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmptyList ? (
          <p className="text-sm text-gray-600">No ingredients found for the planned meals this week.</p>
        ) : (
          categoryOrder.map(category => {
            const itemsInCategory = categorizedDisplayList[category];
            if (itemsInCategory && itemsInCategory.length > 0) {
              const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item.uniqueKey));
              return (
                <div key={category} className="mb-4">
                  <h3 className={`text-md font-semibold text-gray-800 border-b pb-1 mb-2 ${allItemsInCategoryStruck ? 'line-through text-gray-400' : ''}`}>
                    {category}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {itemsInCategory.map((item) => (
                      <li
                        key={item.uniqueKey}
                        onClick={() => handleItemClick(item.uniqueKey)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 ${struckItems.has(item.uniqueKey) ? 'line-through text-gray-400' : ''}`}
                        title={item.originalItemsTooltip} 
                      >
                        <span className="text-gray-700">{item.itemName}: </span>
                        <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>{item.detailsPart}</span>
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