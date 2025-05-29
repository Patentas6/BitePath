import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShoppingCart, PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { convertToPreferredSystem } from "@/utils/conversionUtils";
import { cn } from "@/lib/utils";
import ManualAddItemForm from "./ManualAddItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';
const MANUAL_ITEMS_LOCAL_STORAGE_KEY = 'bitepath-manualGroceryItems';

interface PlannedMealWithIngredients {
  plan_date: string;
  meals: {
    name: string;
    ingredients: string | null;
  } | null;
}

interface ParsedIngredientItem {
  name: string;
  quantity: number | string | null;
  unit: string | null;
  description?: string;
  mealName?: string;
}

interface ManualGroceryItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface CategorizedDisplayListItem { // Still needed for mealWiseDisplayList structure
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

interface ExampleMealIngredientItem {
  itemName: string;
  detailsPart: string;
  uniqueKey: string;
}
interface ExampleMealDisplayItem {
  mealName: string;
  ingredients: ExampleMealIngredientItem[];
}

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const SPICE_MEASUREMENT_UNITS: ReadonlyArray<string> = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'pinch', 'pinches', 'dash', 'dashes'];


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
  const [isManualAddDialogOpen, setIsManualAddDialogOpen] = useState(false);

  const [manualItems, setManualItems] = useState<ManualGroceryItem[]>(() => {
    const saved = localStorage.getItem(MANUAL_ITEMS_LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(MANUAL_ITEMS_LOCAL_STORAGE_KEY, JSON.stringify(manualItems));
  }, [manualItems]);

  const handleAddManualItem = (item: { name: string; quantity: string; unit: string }) => {
    const newItem: ManualGroceryItem = {
      id: `manual-${Date.now()}`,
      ...item,
    };
    setManualItems(prev => [...prev, newItem]);
    setIsManualAddDialogOpen(false);
  };

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

  const formatQuantityAndUnitForDisplay = (
    quantity: number,
    unit: string,
  ): { quantity: number, unit: string, detailsClass: string } => {
    let currentQuantityNum = quantity;
    let currentUnit = unit;
    let detailsClass = "text-foreground";

    if (displaySystem === 'metric') {
        const converted = convertToPreferredSystem(currentQuantityNum, unit, 'metric');
        if (converted) {
            currentQuantityNum = converted.quantity;
            currentUnit = converted.unit;
        }
    }

    if (SPICE_MEASUREMENT_UNITS.includes(currentUnit.toLowerCase())) {
        detailsClass = "text-gray-500 dark:text-gray-400";
    }

    const roundedDisplayQty = (currentQuantityNum % 1 === 0) ? Math.round(currentQuantityNum) : parseFloat(currentQuantityNum.toFixed(1));
    let unitStr = currentUnit;
    if (roundedDisplayQty > 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && !unitStr.endsWith('s') && unitStr.length > 0) {
        if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
            unitStr = unitStr.slice(0, -1) + 'ies';
        } else { unitStr += "s"; }
    }
    return { quantity: roundedDisplayQty, unit: unitStr, detailsClass };
  };

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
          const parsedIngredients: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
          parsedIngredients.forEach((ing, index) => {
            if (!ing.name) return;
            let detailsPartStr = "";
            let itemDetailsClass = "text-foreground";

            if (ing.description?.trim().toLowerCase() === 'to taste') {
              detailsPartStr = "to taste";
              itemDetailsClass = "text-gray-500 dark:text-gray-400";
            } else if (ing.quantity !== null && ing.quantity !== undefined && ing.unit) {
              const quantityNum = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : Number(ing.quantity);
              if (isNaN(quantityNum)) return;

              const formatted = formatQuantityAndUnitForDisplay(quantityNum, ing.unit);
              itemDetailsClass = formatted.detailsClass;
              if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
                  detailsPartStr = `${formatted.quantity}`;
              } else if (formatted.quantity > 0 && formatted.unit) {
                  detailsPartStr = `${formatted.quantity} ${formatted.unit}`;
              } else if (formatted.unit) {
                  detailsPartStr = formatted.unit;
              }
            }

            const uniqueKeyForStriking = `mealwise-today:${pm.meals!.name}:${ing.name.trim().toLowerCase()}:${(ing.unit || "").trim().toLowerCase()}-${index}`;
            const originalTooltip = `${ing.description === 'to taste' ? '' : (ing.quantity || '') + ' '}${ing.description === 'to taste' ? '' : (ing.unit || '')} ${ing.name} ${ing.description ? `(${ing.description})` : ''} (from: ${pm.meals!.name})`.trim();

            mealEntry!.ingredients.push({
              itemName: ing.name,
              itemNameClass: "text-foreground",
              detailsPart: detailsPartStr,
              detailsClass: itemDetailsClass,
              originalItemsTooltip: originalTooltip,
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
           mealWiseDisplayList.flatMap(meal => meal.ingredients.map(ing => ing.uniqueKey))
                .concat(manualItems.map(item => `manual:${item.id}`))
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
      } else if (event.key === MANUAL_ITEMS_LOCAL_STORAGE_KEY) {
        const newManualItems = event.newValue ? JSON.parse(event.newValue) : [];
        setManualItems(newManualItems);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [mealWiseDisplayList, manualItems]);

  useEffect(() => {
    const currentDisplayKeys = new Set(
      mealWiseDisplayList.flatMap(meal => meal.ingredients.map(ing => ing.uniqueKey))
            .concat(manualItems.map(item => `manual:${item.id}`))
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
  }, [mealWiseDisplayList, userId, displaySystem, manualItems]);

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

  const isManualEmpty = manualItems.length === 0;
  const actualIsEmptyList = useMemo(() => {
    return mealWiseDisplayList.length === 0 && isManualEmpty;
  }, [mealWiseDisplayList, isManualEmpty]);

  const showExampleData = actualIsEmptyList && !isLoading && !error;

  if (isLoading) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Ingredients</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>;
  if (error) return <Card className="hover:shadow-lg transition-shadow duration-200"><CardHeader><CardTitle>Today's Ingredients</CardTitle></CardHeader><CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load today's ingredients: {error.message}</AlertDescription></Alert></CardContent></Card>;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Today's Ingredients ({format(today, 'MMM dd')})</CardTitle>
        {/* View mode toggle button removed */}
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
                      <span className="text-foreground">{item.itemName}</span>
                      {item.detailsPart && <span className="text-foreground">: {item.detailsPart}</span>}
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
            <p className="text-sm">Plan some meals for today or add items manually to see them here.</p>
          </div>
        ) : (
          <>
            {mealWiseDisplayList.map(mealItem => (
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
                      <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>{item.itemName}</span>
                      {item.detailsPart && <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>: {item.detailsPart}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {manualItems.length > 0 && (
              <div className="mb-4">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                  Manually Added Items
                </h3>
                <ul className="space-y-1 text-sm pl-2">
                  {manualItems.map(item => {
                    const formatted = formatQuantityAndUnitForDisplay(
                        typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : Number(item.quantity),
                        item.unit
                    );
                    let detailsPartStr = "";
                    if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
                        detailsPartStr = `${formatted.quantity}`;
                    } else if (formatted.quantity > 0 && formatted.unit) {
                        detailsPartStr = `${formatted.quantity} ${formatted.unit}`;
                    } else if (formatted.unit) {
                        detailsPartStr = formatted.unit;
                    }
                    const uniqueKey = `manual:${item.id}`;
                    return (
                      <li
                        key={uniqueKey}
                        onClick={() => handleItemClick(uniqueKey)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${struckItems.has(uniqueKey) ? 'line-through text-gray-400 dark:text-gray-600' : ''}`}
                        title="Manually added item"
                      >
                        <span className={struckItems.has(uniqueKey) ? '' : "text-foreground"}>{item.name}</span>
                        {detailsPartStr && <span className={struckItems.has(uniqueKey) ? '' : formatted.detailsClass}>: {detailsPartStr}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
        <Dialog open={isManualAddDialogOpen} onOpenChange={setIsManualAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Item Manually
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Custom Grocery Item</DialogTitle>
              <DialogDescription>
                Enter the details for the item you want to add to your list.
              </DialogDescription>
            </DialogHeader>
            <ManualAddItemForm
              onAddItem={handleAddManualItem}
              onCancel={() => setIsManualAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TodaysGroceryList;