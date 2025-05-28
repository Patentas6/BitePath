import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Utensils, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import { convertToPreferredSystem } from "@/utils/conversionUtils"; 
import { cn } from "@/lib/utils";

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';
const GROCERY_VIEW_MODE_KEY = 'bitepath-groceryViewMode';

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
  mealName?: string; 
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
  'Meat & Poultry': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'sausage', 'bacon', 'ham', 'steak', 'mince', 'ground meat', 'veal', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'trout', 'sardines', 'halibut', 'catfish', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'pancetta'],
  'Dairy & Eggs': ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream', 'cottage cheese', 'cream cheese', 'half-and-half', 'ghee'],
  Pantry: ['flour', 'sugar', 'salt', 'black pepper', 'spice', 'herb', 'olive oil', 'vegetable oil', 'coconut oil', 'vinegar', 'rice', 'pasta', 'noodle', 'bread', 'cereal', 'oats', 'oatmeal', 'beans', 'lentils', 'chickpeas', 'nuts', 'almonds', 'walnuts', 'peanuts', 'seeds', 'chia seeds', 'flax seeds', 'canned tomatoes', 'canned beans', 'canned corn', 'soup', 'broth', 'stock', 'bouillon', 'soy sauce', 'worcestershire', 'hot sauce', 'bbq sauce', 'condiment', 'ketchup', 'mustard', 'mayonnaise', 'relish', 'jam', 'jelly', 'honey', 'maple syrup', 'baking soda', 'baking powder', 'yeast', 'vanilla extract', 'chocolate', 'cocoa powder', 'coffee', 'tea', 'crackers', 'pretzels', 'chips', 'popcorn', 'dried fruit', 'protein powder', 'breadcrumbs', 'tortillas', 'tahini', 'peanut butter', 'almond butter', 'spaghetti', 'salad dressing', 'granola'],
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

interface MealWiseDisplayItem {
  mealName: string;
  planDate: string; // For actual data
  ingredients: CategorizedDisplayListItem[];
}

// New structure for example data (meal-wise)
interface ExampleMealIngredientItem {
  itemName: string;
  detailsPart: string;
  uniqueKey: string;
}
interface ExampleMealDisplayItem {
  mealName: string;
  ingredients: ExampleMealIngredientItem[];
}

const exampleMealWiseGroceryData: ExampleMealDisplayItem[] = [
  {
    mealName: "Example: Yogurt & Granola (Breakfast)",
    ingredients: [
      { itemName: "Yogurt", detailsPart: "1 cup", uniqueKey: "ex-yogurt" },
      { itemName: "Granola", detailsPart: "1/2 cup", uniqueKey: "ex-granola" },
      { itemName: "Berries", detailsPart: "1/4 cup (e.g., blueberries)", uniqueKey: "ex-berries" },
    ],
  },
  {
    mealName: "Example: Salad with Chicken (Lunch)",
    ingredients: [
      { itemName: "Chicken Breast", detailsPart: "1 piece", uniqueKey: "ex-chicken" },
      { itemName: "Lettuce", detailsPart: "1 head", uniqueKey: "ex-lettuce" },
      { itemName: "Tomatoes", detailsPart: "2 medium", uniqueKey: "ex-tomatoes" },
      { itemName: "Cucumber", detailsPart: "1/2 medium", uniqueKey: "ex-cucumber" },
      { itemName: "Salad Dressing", detailsPart: "2 tbsp", uniqueKey: "ex-dressing" },
    ],
  },
  {
    mealName: "Example: Spaghetti Carbonara (Dinner)",
    ingredients: [
      { itemName: "Spaghetti", detailsPart: "200g", uniqueKey: "ex-spaghetti" },
      { itemName: "Pancetta (or Bacon)", detailsPart: "100g", uniqueKey: "ex-pancetta" },
      { itemName: "Eggs", detailsPart: "2 large", uniqueKey: "ex-eggs" },
      { itemName: "Parmesan Cheese", detailsPart: "50g (grated)", uniqueKey: "ex-parmesan" },
      { itemName: "Black Pepper", detailsPart: "to taste", uniqueKey: "ex-pepper" },
    ],
  },
];


interface TodaysGroceryListProps {
  userId: string;
}

const TodaysGroceryList: React.FC<TodaysGroceryListProps> = ({ userId }) => {
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [displaySystem, setDisplaySystem] = useState<'imperial' | 'metric'>('imperial'); 
  
  const [viewMode, setViewMode] = useState<'category' | 'meal'>(() => {
    const savedViewMode = localStorage.getItem(GROCERY_VIEW_MODE_KEY);
    return (savedViewMode === 'category' || savedViewMode === 'meal') ? savedViewMode : 'meal';
  });

  useEffect(() => {
    localStorage.setItem(GROCERY_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const [struckItems, setStruckItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(SHARED_LOCAL_STORAGE_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const { data: userProfile } = useQuery<{ preferred_unit_system: 'imperial' | 'metric' | null } | null>({
    queryKey: ["userProfileForGrocery", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("profiles").select("preferred_unit_system").eq("id", userId).single();
      if (error && error.code !== 'PGRST116') { console.error("Error fetching profile for grocery unit system:", error); return null; }
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, 
  });

  useEffect(() => {
    if (userProfile?.preferred_unit_system) {
      setDisplaySystem(userProfile.preferred_unit_system);
    }
  }, [userProfile]);


  const { data: plannedMealsData, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["todaysGroceryListSource", userId, todayStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan_date, meals ( name, ingredients )")
        .eq("user_id", userId)
        .eq("plan_date", todayStr);
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
        } catch (e) { console.warn("[TodaysGroceryList.tsx] Failed to parse ingredients JSON:", ingredientsBlock, e); }
      }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMealsData]);

  const formatSingleIngredientForDisplay = (
    name: string, 
    quantity: number | string, 
    unit: string, 
    isSummableOverride?: boolean 
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
      
      let finalDetailsPart = detailsPart;
      if (!aggItem.isSummable && aggItem.originalItems.length > 0) {
        finalDetailsPart = aggItem.originalItems.map(orig => {
          const formattedOrig = formatSingleIngredientForDisplay(orig.name, orig.quantity, orig.unit, false);
          return formattedOrig.detailsPart;
        }).filter(Boolean).join(' + ');
      }

      const uniqueKey = `${itemName.trim().toLowerCase()}:${(aggItem.unit || "").trim().toLowerCase()}-${foundCategory.toLowerCase()}`;
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
          parsedIngredients.forEach((ing) => {
            if (!ing.name || typeof ing.quantity !== 'number' && typeof ing.quantity !== 'string' || !ing.unit) return;
            
            const { itemName, itemNameClass, detailsPart, detailsClass } = formatSingleIngredientForDisplay(
              ing.name, 
              ing.quantity, 
              ing.unit,
              false 
            );
            
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
              uniqueKey: uniqueKeyForStriking, 
            });
          });
        } catch (e) { console.warn("Error parsing ingredients for meal-wise view (Today's List):", e); }
      }
    });
    return Array.from(mealsMap.values());
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
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode, userId, displaySystem]);


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

  const actualIsEmptyList = useMemo(() => {
    // Check based on actual data, not example data
    return viewMode === 'category' 
      ? Object.values(categorizedDisplayList).every(list => list.length === 0)
      : mealWiseDisplayList.length === 0;
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode]);
  
  const showExampleData = actualIsEmptyList && !isLoading && !error;

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Ingredients</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>;
  if (error) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Ingredients</CardTitle></CardHeader><CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load today's ingredients: {error.message}</AlertDescription></Alert></CardContent></Card>;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Today's Ingredients ({format(today, 'MMM dd')})</CardTitle>
        <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(prev => prev === 'category' ? 'meal' : 'category')}
            className="ml-auto h-8 w-8 sm:h-8 sm:w-auto sm:px-3 text-xs"
            disabled={showExampleData} 
        >
            {viewMode === 'category' ? <Utensils className="h-5 w-5 sm:mr-1" /> : <LayoutGrid className="h-5 w-5 sm:mr-1" />}
            <span className="hidden sm:inline">{viewMode === 'category' ? 'By Meal' : 'By Category'}</span>
        </Button>
      </CardHeader>
      <CardContent className="flex-grow">
        {showExampleData && (
          <p className="text-sm text-muted-foreground mb-3">
            Plan meals to see their ingredients here. Here's an example of what your list might look like (ingredients by meal):
          </p>
        )}

        {showExampleData ? (
          <div className="space-y-4">
            {exampleMealWiseGroceryData.map(mealItem => (
              <div key={mealItem.mealName} className="opacity-80 border-dashed border rounded-md p-3">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-b border-dashed pb-1 mb-2">
                  {mealItem.mealName}
                </h3>
                <ul className="space-y-1 text-sm pl-2">
                  {mealItem.ingredients.map((item) => (
                    <li
                      key={item.uniqueKey}
                      className="p-1 rounded"
                    >
                      <span className="text-foreground">{item.itemName}: </span>
                      {item.detailsPart && <span className="text-foreground">{item.detailsPart}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : actualIsEmptyList ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">Your List is Empty</p>
            <p className="text-sm">Plan some meals for today to see ingredients here.</p>
          </div>
        ) : viewMode === 'category' ? (
          <div className="space-y-4">
            {categoryOrder.map(category => {
              const itemsInCategory = categorizedDisplayList[category];
              if (itemsInCategory && itemsInCategory.length > 0) {
                const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item.uniqueKey));
                return (
                  <div key={category}>
                    <h3 
                      className={`text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2 ${allItemsInCategoryStruck ? 'line-through text-gray-400 dark:text-gray-600 opacity-70' : ''}`}
                    >
                      {category}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {itemsInCategory.map((item) => (
                        <li
                          key={item.uniqueKey}
                          onClick={() => handleItemClick(item.uniqueKey)}
                          className={cn(
                            "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer",
                            struckItems.has(item.uniqueKey) ? 'line-through text-gray-400 dark:text-gray-600 opacity-70' : ''
                          )}
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
            })}
          </div>
        ) : ( // Actual data, meal-wise view
          mealWiseDisplayList.map(mealItem => (
            <div key={`${mealItem.planDate}-${mealItem.mealName}`} className="mb-4">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                {mealItem.mealName}
              </h3>
              <ul className="space-y-1 text-sm pl-2">
                {mealItem.ingredients.map((item, index) => (
                  <li
                    key={`${item.uniqueKey}-${index}`} 
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

export default TodaysGroceryList;