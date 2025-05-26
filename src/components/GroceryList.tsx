import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw, ShoppingCart, Utensils, LayoutGrid } from "lucide-react"; // Added Utensils, LayoutGrid
import { convertToPreferredSystem } from "@/utils/conversionUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';

interface PlannedMealWithIngredients {
  plan_date: string;
  meals: {
    name: string;
    ingredients: string | null;
  } | null;
}

interface ParsedIngredientItem {
  name: string;
  quantity: number | string;
  unit: string;
  description?: string;
  mealName?: string; // Added for tooltip
}

const NON_SUMMABLE_DISPLAY_UNITS: ReadonlyArray<string> = [
  "cup", "cups", "pinch", "pinches", "dash", "dashes"
];

const SUMMABLE_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "piece", "pieces", "can", "cans", "bottle", "bottles", "package", "packages",
  "slice", "slices", "item", "items", "clove", "cloves", "sprig", "sprigs",
  'head', 'heads', 'bunch', 'bunches',
  'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons'
];

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const SPICE_MEASUREMENT_UNITS: ReadonlyArray<string> = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons'];

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
  originalItems: ParsedIngredientItem[]; // Will now include mealName
}

interface CategorizedDisplayListItem {
  itemName: string;
  itemNameClass: string;
  detailsPart: string;
  detailsClass: string;
  originalItemsTooltip: string;
  uniqueKey: string;
}

interface MealWiseDisplayItem {
  mealName: string;
  planDate: string;
  ingredients: CategorizedDisplayListItem[];
}


interface GroceryListProps {
  userId: string;
  currentWeekStart: Date;
}

const GroceryList: React.FC<GroceryListProps> = ({ userId, currentWeekStart }) => {
  const [displaySystem, setDisplaySystem] = useState<'imperial' | 'metric'>('imperial');
  const [selectedDays, setSelectedDays] = useState<string>('7');
  const [viewMode, setViewMode] = useState<'category' | 'meal'>('category');

  const [struckItems, setStruckItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(SHARED_LOCAL_STORAGE_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const queryStartDate = currentWeekStart;
  const queryEndDate = addDays(queryStartDate, parseInt(selectedDays) - 1);
  const dateRangeQueryKeyPart = `${format(queryStartDate, 'yyyy-MM-dd')}_${selectedDays}`;

  const { data: plannedMealsData, isLoading, error: plannedMealsError, refetch } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["groceryListSource", userId, dateRangeQueryKeyPart], 
    queryFn: async () => {
      if (!userId) return [];
      const startDateStr = format(queryStartDate, 'yyyy-MM-dd');
      const endDateStr = format(queryEndDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan_date, meals ( name, ingredients )")
        .eq("user_id", userId)
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const aggregatedIngredients = useMemo(() => {
    if (!plannedMealsData) return [];
    const ingredientMap = new Map<string, GroceryListItem>();
    plannedMealsData.forEach(pm => {
      if (!pm.meals) return;
      const ingredientsBlock = pm.meals.ingredients;
      const mealName = pm.meals.name;

      if (ingredientsBlock && typeof ingredientsBlock === 'string') {
        try {
          const parsedIngredientList: Omit<ParsedIngredientItem, 'mealName'>[] = JSON.parse(ingredientsBlock);
          if (Array.isArray(parsedIngredientList)) {
            parsedIngredientList.forEach(item => {
              const quantityAsNumber = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
              if (!item.name || typeof quantityAsNumber !== 'number' || isNaN(quantityAsNumber) || !item.unit) return;
              
              const processedItem: ParsedIngredientItem = { ...item, quantity: quantityAsNumber, mealName };
              const normalizedName = processedItem.name.trim().toLowerCase();
              const unitLower = processedItem.unit.toLowerCase();
              const mapKey = normalizedName;
              const existing = ingredientMap.get(mapKey);

              if (existing) {
                existing.originalItems.push(processedItem);
                // Basic summation: only if units are identical and summable.
                // More advanced same-dimension conversion (e.g. tsp to tbsp) is complex for this pass.
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
  }, [plannedMealsData]);
  
  const formatSingleIngredientForDisplay = (
    name: string, 
    quantity: number | string, 
    unit: string, 
    isSummableOverride?: boolean // Used for meal-wise view where items are not pre-summed
  ): Pick<CategorizedDisplayListItem, 'itemName' | 'itemNameClass' | 'detailsPart' | 'detailsClass'> => {
    
    const itemName = name;
    const itemNameClass = "text-foreground";
    let currentQuantity = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
    let currentUnit = unit;
    let detailsPart = "";
    let detailsClass = "text-foreground";

    if (displaySystem === 'metric' && (isSummableOverride || SUMMABLE_UNITS.includes(unit.toLowerCase()))) {
        const converted = convertToPreferredSystem(currentQuantity, unit, 'metric');
        if (converted) {
            currentQuantity = converted.quantity;
            currentUnit = converted.unit;
        }
    }
    
    if (SPICE_MEASUREMENT_UNITS.includes(currentUnit.toLowerCase())) {
        detailsClass = "text-gray-500 dark:text-gray-400";
    }

    if (currentQuantity > 0) {
        const roundedDisplayQty = (currentQuantity % 1 === 0) ? Math.round(currentQuantity) : parseFloat(currentQuantity.toFixed(1));
        if (PIECE_UNITS.includes(currentUnit.toLowerCase())) {
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
    }
    return { itemName, itemNameClass, detailsPart, detailsClass };
  };

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
      
      const { itemName, itemNameClass, detailsPart, detailsClass } = formatSingleIngredientForDisplay(
        aggItem.name, 
        aggItem.totalQuantity, 
        aggItem.unit || "",
        aggItem.isSummable
      );
      
      // If not summable, reconstruct detailsPart from original items
      let finalDetailsPart = detailsPart;
      if (!aggItem.isSummable && aggItem.originalItems.length > 0) {
        finalDetailsPart = aggItem.originalItems.map(orig => {
          const formattedOrig = formatSingleIngredientForDisplay(orig.name, orig.quantity, orig.unit, false);
          return formattedOrig.detailsPart;
        }).filter(Boolean).join('; ');
      }


      const uniqueKey = `${aggItem.name.trim().toLowerCase()}:${(aggItem.unit || "").trim().toLowerCase()}-${foundCategory.toLowerCase()}`; // Key for striking
      const originalItemsTooltip = aggItem.originalItems
        .map(oi => `${oi.quantity} ${oi.unit} ${oi.name} (from: ${oi.mealName})${oi.description ? ` (${oi.description})` : ''}`)
        .join('\n');

      if (finalDetailsPart.trim() !== "" || itemName.trim() !== "") {
        grouped[foundCategory].push({ itemName, itemNameClass, detailsPart: finalDetailsPart, detailsClass, originalItemsTooltip, uniqueKey });
      }
    });
    return grouped;
  }, [aggregatedIngredients, displaySystem]);

  const mealWiseDisplayList = useMemo(() => {
    if (!plannedMealsData) return [];
    const mealsMap = new Map<string, MealWiseDisplayItem>();

    plannedMealsData.forEach(pm => {
      if (!pm.meals) return;
      const mealKey = `${pm.plan_date}-${pm.meals.name}`;
      let mealEntry = mealsMap.get(mealKey);
      if (!mealEntry) {
        mealEntry = { mealName: pm.meals.name, planDate: pm.plan_date, ingredients: [] };
        mealsMap.set(mealKey, mealEntry);
      }

      if (pm.meals.ingredients && typeof pm.meals.ingredients === 'string') {
        try {
          const parsedIngredients: Omit<ParsedIngredientItem, 'mealName'>[] = JSON.parse(pm.meals.ingredients);
          parsedIngredients.forEach((ing, index) => {
            if (!ing.name || typeof ing.quantity !== 'number' && typeof ing.quantity !== 'string' || !ing.unit) return;
            
            const { itemName, itemNameClass, detailsPart, detailsClass } = formatSingleIngredientForDisplay(
              ing.name, 
              ing.quantity, 
              ing.unit,
              false // In meal-wise view, items are not pre-summed from other meals
            );
            
            // For meal-wise view, unique key for striking should be specific to this instance if we want per-instance striking
            // Or, use a global key if striking one "tomato" strikes all "tomatoes"
            // Let's use a more global key for striking consistency for now.
            let foundCategory: Category = 'Other';
            const itemLower = ing.name.toLowerCase();
            for (const cat of categoryOrder) { if (cat !== 'Other' && categoriesMap[cat].some(keyword => itemLower.includes(keyword))) { foundCategory = cat; break; } }
            const uniqueKeyForStriking = `${ing.name.trim().toLowerCase()}:${(ing.unit || "").trim().toLowerCase()}-${foundCategory.toLowerCase()}`;


            mealEntry!.ingredients.push({
              itemName,
              itemNameClass,
              detailsPart,
              detailsClass,
              originalItemsTooltip: `${ing.quantity} ${ing.unit} ${ing.name}${ing.description ? ` (${ing.description})` : ''} (from: ${pm.meals!.name})`,
              uniqueKey: uniqueKeyForStriking, // Use the more global key for striking
            });
          });
        } catch (e) { console.warn("Error parsing ingredients for meal-wise view:", e); }
      }
    });
    return Array.from(mealsMap.values()).sort((a,b) => new Date(a.planDate).getTime() - new Date(b.planDate).getTime() || a.mealName.localeCompare(b.mealName));
  }, [plannedMealsData, displaySystem]);


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SHARED_LOCAL_STORAGE_KEY) {
        const newGlobalValue = event.newValue;
        const newGlobalStruckItems = newGlobalValue ? new Set<string>(JSON.parse(newGlobalValue)) : new Set<string>();
        
        const currentDisplayKeys = new Set(
          viewMode === 'category' 
            ? Object.values(categorizedDisplayList).flat().map(item => item.uniqueKey)
            : mealWiseDisplayList.flatMap(meal => meal.ingredients.map(ing => ing.uniqueKey))
        );

        setStruckItems(prevLocalStruckItems => {
          const updatedLocalStruckItems = new Set<string>();
          newGlobalStruckItems.forEach(key => {
            if (currentDisplayKeys.has(key)) {
              updatedLocalStruckItems.add(key);
            }
          });
          if (updatedLocalStruckItems.size !== prevLocalStruckItems.size || !Array.from(prevLocalStruckItems).every(key => updatedLocalStruckItems.has(key))) {
            return updatedLocalStruckItems;
          }
          return prevLocalStruckItems;
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode]);

  useEffect(() => {
    const currentDisplayKeys = new Set(
      viewMode === 'category' 
        ? Object.values(categorizedDisplayList).flat().map(item => item.uniqueKey)
        : mealWiseDisplayList.flatMap(meal => meal.ingredients.map(ing => ing.uniqueKey))
    );
    const globalRaw = localStorage.getItem(SHARED_LOCAL_STORAGE_KEY);
    const globalStruckItems = globalRaw ? new Set<string>(JSON.parse(globalRaw)) : new Set<string>();

    const newRelevantStruckItems = new Set<string>();
    globalStruckItems.forEach(key => {
      if (currentDisplayKeys.has(key)) {
        newRelevantStruckItems.add(key);
      }
    });

    setStruckItems(prevLocalStruckItems => {
      if (newRelevantStruckItems.size !== prevLocalStruckItems.size || !Array.from(prevLocalStruckItems).every(key => newRelevantStruckItems.has(key))) {
        return newRelevantStruckItems;
      }
      return prevLocalStruckItems;
    });
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode, userId, currentWeekStart, selectedDays, displaySystem]);


  const handleItemClick = (uniqueKey: string) => {
    const globalRaw = localStorage.getItem(SHARED_LOCAL_STORAGE_KEY);
    let globalSet = globalRaw ? new Set<string>(JSON.parse(globalRaw)) : new Set<string>();
    const newLocalSet = new Set(struckItems);

    if (globalSet.has(uniqueKey)) {
      globalSet.delete(uniqueKey);
      newLocalSet.delete(uniqueKey);
    } else {
      globalSet.add(uniqueKey);
      newLocalSet.add(uniqueKey);
    }
    
    localStorage.setItem(SHARED_LOCAL_STORAGE_KEY, JSON.stringify(Array.from(globalSet)));
    setStruckItems(newLocalSet);

    window.dispatchEvent(new StorageEvent('storage', {
      key: SHARED_LOCAL_STORAGE_KEY,
      newValue: JSON.stringify(Array.from(globalSet)),
      oldValue: globalRaw,
      storageArea: localStorage,
    }));
  };

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Grocery List</CardTitle></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>;
  if (plannedMealsError) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Grocery List</CardTitle></CardHeader><CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load grocery list: {plannedMealsError.message}</AlertDescription></Alert></CardContent></Card>;

  const isEmptyList = viewMode === 'category' 
    ? Object.values(categorizedDisplayList).every(list => list.length === 0)
    : mealWiseDisplayList.length === 0;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Grocery List</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
           <div className="flex items-center">
             <ListChecks className="mr-2 h-5 w-5" />
             <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
               For: {format(queryStartDate, 'MMM dd')} - {format(queryEndDate, 'MMM dd')}
             </h2>
           </div>
           <div className="flex items-center space-x-2 ml-auto">
              <Select value={selectedDays} onValueChange={(value) => { setSelectedDays(value); refetch(); }}>
                 <SelectTrigger className="w-[120px] h-8 text-sm">
                   <SelectValue placeholder="Select days" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="1">Next 1 Day</SelectItem>
                   <SelectItem value="2">Next 2 Days</SelectItem>
                   <SelectItem value="3">Next 3 Days</SelectItem>
                   <SelectItem value="4">Next 4 Days</SelectItem>
                   <SelectItem value="5">Next 5 Days</SelectItem>
                   <SelectItem value="6">Next 6 Days</SelectItem>
                   <SelectItem value="7">Next 7 Days</SelectItem>
                   <SelectItem value="15">Next 15 Days</SelectItem>
                   <SelectItem value="30">Next 30 Days</SelectItem>
                 </SelectContent>
               </Select>
               <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setDisplaySystem(prev => prev === 'imperial' ? 'metric' : 'imperial')}
               >
                   <RefreshCw className="mr-1 h-3 w-3" />
                   {displaySystem === 'imperial' ? 'To Metric' : 'To Imperial'}
               </Button>
               <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(prev => prev === 'category' ? 'meal' : 'category')}
               >
                  {viewMode === 'category' ? <Utensils className="mr-1 h-3 w-3" /> : <LayoutGrid className="mr-1 h-3 w-3" />}
                  {viewMode === 'category' ? 'View by Meal' : 'View by Category'}
               </Button>
           </div>
         </div>

        {isEmptyList ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">Your List is Empty</p>
            <p className="text-sm">Plan some meals for the selected date range to see ingredients here.</p>
          </div>
        ) : viewMode === 'category' ? (
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
        ) : ( // Meal-wise view
          mealWiseDisplayList.map(mealItem => (
            <div key={`${mealItem.planDate}-${mealItem.mealName}`} className="mb-4">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                {mealItem.mealName} ({format(parseISO(mealItem.planDate), 'MMM dd')})
              </h3>
              <ul className="space-y-1 text-sm pl-2">
                {mealItem.ingredients.map((item, index) => (
                  <li
                    key={`${item.uniqueKey}-${index}`} // Ensure unique key for meal-wise list items
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
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default GroceryList;