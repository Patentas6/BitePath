import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, endOfWeek, isBefore, startOfToday, parseISO, addDays } from "date-fns"; // Import addDays
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw, ShoppingCart } from "lucide-react";
import { convertToPreferredSystem } from "@/utils/conversionUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components

interface PlannedMealWithIngredients {
  plan_date: string;
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
  'head', 'heads', 'bunch', 'bunches'
];

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const MEASUREMENT_UNITS_FOR_LIGHTER_COLOR: ReadonlyArray<string> = [
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'pinch', 'pinches', 'dash', 'dashes',
  'ml', 'milliliter', 'milliliters',
  'l', 'liter', 'liters',
  'fl oz', 'fluid ounce', 'fluid ounces', 'fl-oz',
  'g', 'gram', 'grams',
  'oz', 'ounce', 'ounces'
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
  itemNameClass: string;
  detailsPart: string;
  detailsClass: string;
  originalItemsTooltip: string;
  uniqueKey: string;
}

interface GroceryListProps {
  userId: string;
  currentWeekStart: Date; // Keep this prop, but query uses startOfToday
}

const GroceryList: React.FC<GroceryListProps> = ({ userId, currentWeekStart }) => {
  const [struckItems, setStruckItems] = useState<Set<string>>(new Set());
  const [displaySystem, setDisplaySystem] = useState<'imperial' | 'metric'>('imperial');
  const [selectedDays, setSelectedDays] = useState<string>('7'); // State for selected days, default to 7
  const today = startOfToday();

  const queryStartDate = today;
  const queryEndDate = addDays(today, parseInt(selectedDays) - 1); // Calculate end date based on selectedDays

  const { data: plannedMealsData, isLoading, error: plannedMealsError } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["groceryListSource", userId, format(queryStartDate, 'yyyy-MM-dd'), selectedDays], // Add selectedDays to queryKey
    queryFn: async () => {
      if (!userId) return [];
      const startDateStr = format(queryStartDate, 'yyyy-MM-dd');
      const endDateStr = format(queryEndDate, 'yyyy-MM-dd'); // Use calculated end date
      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan_date, meals ( name, ingredients )")
        .eq("user_id", userId)
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr); // Filter by the new date range
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const aggregatedIngredients = useMemo(() => {
    if (!plannedMealsData) return [];

    // The query already filters by date range from today, so no need for isBefore check here
    const ingredientMap = new Map<string, GroceryListItem>();
    plannedMealsData.forEach(pm => {
      const ingredientsBlock = pm.meals?.ingredients;
      if (ingredientsBlock && typeof ingredientsBlock === 'string') {
        try {
          const parsedIngredientList: ParsedIngredientItem[] = JSON.parse(ingredientsBlock);
          if (Array.isArray(parsedIngredientList)) {
            parsedIngredientList.forEach(item => {
              const quantityAsNumber = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
              if (!item.name || typeof quantityAsNumber !== 'number' || isNaN(quantityAsNumber) || !item.unit) return;
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
        } catch (e) { console.warn("[GroceryList.tsx] Failed to parse ingredients JSON:", ingredientsBlock, e); }
      }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMealsData]); // Depend on plannedMealsData

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
      const itemNameClass = "text-foreground";

      let currentQuantity = aggItem.totalQuantity;
      let currentUnit = aggItem.unit || "";
      const originalUnitForLogic = aggItem.unit?.toLowerCase() || '';

      let detailsClass = "text-gray-700 dark:text-gray-300";
      let detailsPart = "";

      if (displaySystem === 'metric') {
        if (aggItem.isSummable) {
          const converted = convertToPreferredSystem(aggItem.totalQuantity, aggItem.unit || "", 'metric');
          if (converted) {
            currentQuantity = converted.quantity;
            currentUnit = converted.unit;
          }
        }
      }

      const isOriginalUnitPiece = PIECE_UNITS.includes(originalUnitForLogic);
      const isOriginalUnitMeasurement = MEASUREMENT_UNITS_FOR_LIGHTER_COLOR.includes(originalUnitForLogic);

      if (isOriginalUnitPiece) {
        detailsClass = "text-gray-700 dark:text-gray-300";
      } else if (isOriginalUnitMeasurement) {
        detailsClass = "text-gray-500 dark:text-gray-400";
      }

      if (aggItem.isSummable && currentQuantity > 0) {
        const roundedDisplayQty = (currentQuantity % 1 === 0) ? Math.round(currentQuantity) : parseFloat(currentQuantity.toFixed(1));
        if (isOriginalUnitPiece) {
          detailsPart = `${roundedDisplayQty}`;
        } else {
          let unitStr = currentUnit;
          if (roundedDisplayQty > 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && !unitStr.endsWith('s') && unitStr.length > 0) {
             if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
                unitStr = unitStr.slice(0, -1) + 'ies';
             } else { unitStr += "s"; }
          }
          detailsPart = `${roundedDisplayQty} ${unitStr}`;
        }
      } else if (!aggItem.isSummable && aggItem.originalItems.length > 0) {
        detailsPart = aggItem.originalItems.map(orig => {
          let q = orig.quantity;
          let u = orig.unit;
          if (displaySystem === 'metric') {
            const convertedPart = convertToPreferredSystem(orig.quantity, orig.unit, 'metric');
            if (convertedPart) {
              q = convertedPart.quantity;
              u = convertedPart.unit;
            }
          }
          if (PIECE_UNITS.includes(orig.unit.toLowerCase())) return `${q}`;
          return `${q} ${u}`;
        }).join('; ');
        detailsClass = "text-gray-500 dark:text-gray-400";
      }

      const uniqueKey = `${itemName}:${detailsPart}-${foundCategory}-${displaySystem}`;
      const originalItemsTooltip = aggItem.originalItems.map(oi => `${oi.quantity} ${oi.unit} ${oi.name}${oi.description ? ` (${oi.description})` : ''}`).join('\n');

      if (detailsPart.trim() !== "" || itemName.trim() !== "") {
        grouped[foundCategory].push({ itemName, itemNameClass, detailsPart, detailsClass, originalItemsTooltip, uniqueKey });
      }
    });
    return grouped;
  }, [aggregatedIngredients, displaySystem]);

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
      else { newStruckItems.add(uniqueKey); } // Corrected typo here
      return newStruckItems;
    });
  };

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Grocery List</CardTitle></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>;
  if (plannedMealsError) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Grocery List</CardTitle></CardHeader><CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load grocery list: {plannedMealsError.message}</AlertDescription></Alert></CardContent></Card>;

  const isEmptyList = Object.values(categorizedDisplayList).every(list => list.length === 0);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row justify-between items-center">
        <div className="flex items-center">
          <ListChecks className="mr-2 h-5 w-5" />
          <CardTitle className="text-lg font-semibold">
            Grocery List for {format(queryStartDate, 'MMM dd')} - {format(queryEndDate, 'MMM dd')}
          </CardTitle>
        </div>
        <div className="flex items-center space-x-2">
           <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <SelectValue placeholder="Select days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Next 3 Days</SelectItem>
                <SelectItem value="5">Next 5 Days</SelectItem>
                <SelectItem value="7">Next 7 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button
                variant="default"
                size="sm"
                onClick={() => setDisplaySystem(prev => prev === 'imperial' ? 'metric' : 'imperial')}
            >
                <RefreshCw className="mr-2 h-4 w-4" />
                {displaySystem === 'imperial' ? 'Metric' : 'Imperial'}
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isEmptyList ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">Your List is Empty</p>
            <p className="text-sm">Plan some meals from today onwards for the next {selectedDays} days to see ingredients here.</p>
          </div>
        ) : (
          categoryOrder.map(category => {
            const itemsInCategory = categorizedDisplayList[category];
            if (itemsInCategory && itemsInCategory.length > 0) {
              const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item.uniqueKey));
              return (
                <div key={category} className="mb-4">
                  <h3 className={`text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2 ${allItemsInCategoryStruck ? 'line-through text-gray-400 dark:text-gray-600' : ''}`}>
                    {category}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {itemsInCategory.map((item) => (
                      <li
                        key={item.uniqueKey}
                        onClick={() => handleItemClick(item.uniqueKey)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${struckItems.has(item.uniqueKey) ? 'line-through text-gray-400 dark:text-gray-600' : ''}`}
                        title={item.originalItemsTooltip}
                      >
                        <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>{item.itemName}: </span>
                        {item.detailsPart && <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>{item.detailsPart}</span>}
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