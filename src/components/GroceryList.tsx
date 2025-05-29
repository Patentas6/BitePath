import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays, parseISO, startOfToday } from "date-fns"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListChecks, ShoppingCart, Utensils, LayoutGrid, PlusCircle } from "lucide-react";
import { convertToPreferredSystem } from "@/utils/conversionUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ManualAddItemForm from "./ManualAddItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';
const GROCERY_VIEW_MODE_KEY = 'bitepath-groceryViewMode';
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

interface UnitQuantity {
  unit: string;
  totalQuantity: number;
}

interface AggregatedGroceryItem {
  name: string;
  unitQuantities: UnitQuantity[]; 
  originalItems: ParsedIngredientItem[]; 
}


const SUMMABLE_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "piece", "pieces", "can", "cans", "bottle", "bottles", "package", "packages",
  "slice", "slices", "item", "items", "clove", "cloves", "sprig", "sprigs",
  'head', 'heads', 'bunch', 'bunches',
  'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups'
];

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const SPICE_MEASUREMENT_UNITS: ReadonlyArray<string> = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'pinch', 'pinches', 'dash', 'dashes'];


const categoriesMap = {
  Produce: ['apple', 'banana', 'orange', 'pear', 'grape', 'berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'broccoli', 'spinach', 'lettuce', 'salad greens', 'celery', 'cucumber', 'bell pepper', 'pepper', 'zucchini', 'mushroom', 'lemon', 'lime', 'cabbage', 'kale', 'asparagus', 'eggplant', 'corn', 'sweet potato', 'ginger', 'parsley', 'cilantro', 'basil', 'mint', 'rosemary', 'thyme', 'dill', 'leek', 'scallion', 'green bean', 'pea', 'artichoke', 'beet', 'radish', 'squash'],
  'Meat & Poultry': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'sausage', 'bacon', 'ham', 'steak', 'mince', 'ground meat', 'veal', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'trout', 'sardines', 'halibut', 'catfish', 'crab', 'lobster', 'scallop', 'mussel', 'clam'],
  'Dairy & Eggs': ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream', 'cottage cheese', 'cream cheese', 'half-and-half', 'ghee'],
  Pantry: ['flour', 'sugar', 'salt', 'black pepper', 'spice', 'herb', 'olive oil', 'vegetable oil', 'coconut oil', 'vinegar', 'rice', 'pasta', 'noodle', 'bread', 'cereal', 'oats', 'oatmeal', 'beans', 'lentils', 'chickpeas', 'nuts', 'almonds', 'walnuts', 'peanuts', 'seeds', 'chia seeds', 'flax seeds', 'canned tomatoes', 'canned beans', 'canned corn', 'soup', 'broth', 'stock', 'bouillon', 'soy sauce', 'worcestershire', 'hot sauce', 'bbq sauce', 'condiment', 'ketchup', 'mustard', 'mayonnaise', 'relish', 'jam', 'jelly', 'honey', 'maple syrup', 'baking soda', 'baking powder', 'yeast', 'vanilla extract', 'chocolate', 'cocoa powder', 'coffee', 'tea', 'crackers', 'pretzels', 'chips', 'popcorn', 'dried fruit', 'protein powder', 'breadcrumbs', 'tortillas', 'tahini', 'peanut butter', 'almond butter'],
  Frozen: ['ice cream', 'sorbet', 'frozen vegetables', 'frozen fruit', 'frozen meal', 'frozen pizza', 'frozen fries', 'frozen peas', 'frozen corn', 'frozen spinach'],
  Beverages: ['water', 'sparkling water', 'juice', 'soda', 'cola', 'wine', 'beer', 'spirits', 'kombucha', 'coconut water', 'sports drink', 'energy drink'],
  Other: [],
  "Manually Added": [],
};
type Category = keyof typeof categoriesMap;
const categoryOrder: Category[] = ['Produce', 'Meat & Poultry', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Beverages', 'Other', "Manually Added"];

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
  currentWeekStart?: Date;
}

const GroceryList: React.FC<GroceryListProps> = ({ userId }) => {
  const [displaySystem, setDisplaySystem] = useState<'imperial' | 'metric'>('imperial');
  const [selectedDays, setSelectedDays] = useState<string>('7');
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

  const today = useMemo(() => startOfToday(), []);
  const queryStartDate = today;
  const queryEndDate = useMemo(() => addDays(today, parseInt(selectedDays) - 1), [today, selectedDays]);

  const dateRangeQueryKeyPart = `${format(today, 'yyyy-MM-dd')}_${selectedDays}`;

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

  const aggregatedIngredients = useMemo((): AggregatedGroceryItem[] => {
    if (!plannedMealsData) return [];
    const ingredientMap = new Map<string, AggregatedGroceryItem>();

    plannedMealsData.forEach(pm => {
      if (!pm.meals || !pm.meals.ingredients) return;
      const mealName = pm.meals.name;
      try {
        const parsedIngredientList: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
        if (Array.isArray(parsedIngredientList)) {
          parsedIngredientList.forEach(item => {
            if (!item.name) return;

            const processedItem: ParsedIngredientItem = { ...item, mealName };
            const normalizedName = processedItem.name.trim().toLowerCase();
            const unitLower = processedItem.unit?.trim().toLowerCase();
            const descriptionLower = processedItem.description?.trim().toLowerCase();

            let existingAggItem = ingredientMap.get(normalizedName);
            if (!existingAggItem) {
              existingAggItem = { name: processedItem.name, unitQuantities: [], originalItems: [] };
              ingredientMap.set(normalizedName, existingAggItem);
            }
            existingAggItem.originalItems.push(processedItem);

            if (descriptionLower === 'to taste') {
              const hasToTasteEntry = existingAggItem.unitQuantities.some(uq => uq.unit === '_TO_TASTE_');
              if (!hasToTasteEntry) {
                existingAggItem.unitQuantities.push({ unit: '_TO_TASTE_', totalQuantity: 0 });
              }
            } else if (typeof processedItem.quantity === 'number' && unitLower && processedItem.quantity !== null) {
              const quantityAsNumber = Number(processedItem.quantity);
              if (isNaN(quantityAsNumber)) return;

              let existingUnitQuantity = existingAggItem.unitQuantities.find(uq => uq.unit.toLowerCase() === unitLower);
              if (existingUnitQuantity) {
                if (SUMMABLE_UNITS.includes(unitLower)) {
                  existingUnitQuantity.totalQuantity += quantityAsNumber;
                } else {
                  existingAggItem.unitQuantities.push({ unit: processedItem.unit!, totalQuantity: quantityAsNumber });
                }
              } else {
                existingAggItem.unitQuantities.push({ unit: processedItem.unit!, totalQuantity: quantityAsNumber });
              }
            }
          });
        }
      } catch (e) { console.warn("[GroceryList.tsx] Failed to parse ingredients JSON:", pm.meals.ingredients, e); }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMealsData]);

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


  const categorizedDisplayList = useMemo(() => {
    const grouped: Record<Category, CategorizedDisplayListItem[]> =
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, CategorizedDisplayListItem[]>);

    aggregatedIngredients.forEach(aggItem => {
      let foundCategory: Category = 'Other';
      const itemLower = aggItem.name.toLowerCase();
      for (const cat of categoryOrder) {
        if (cat === 'Other' || cat === "Manually Added") continue;
        if (categoriesMap[cat].some(keyword => itemLower.includes(keyword))) {
          foundCategory = cat; break;
        }
      }

      const detailsParts: string[] = [];
      let combinedDetailsClass = "text-foreground";

      aggItem.unitQuantities.forEach(uq => {
        if (uq.unit === '_TO_TASTE_') {
          if (!detailsParts.includes('to taste')) {
            detailsParts.push('to taste');
          }
          combinedDetailsClass = "text-gray-500 dark:text-gray-400";
        } else {
          const formatted = formatQuantityAndUnitForDisplay(uq.totalQuantity, uq.unit);
          if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
            detailsParts.push(`${formatted.quantity}`);
          } else if (formatted.quantity > 0 && formatted.unit) {
            detailsParts.push(`${formatted.quantity} ${formatted.unit}`);
          } else if (formatted.unit) {
            detailsParts.push(formatted.unit);
          }
          if (SPICE_MEASUREMENT_UNITS.includes(uq.unit.toLowerCase())) {
            combinedDetailsClass = "text-gray-500 dark:text-gray-400";
          }
        }
      });

      const detailsPartStr = detailsParts.join(' + ');
      const uniqueKey = `agg:${aggItem.name.trim().toLowerCase()}-${foundCategory.toLowerCase()}`;
      const originalItemsTooltip = aggItem.originalItems
        .map(oi => `${oi.description === 'to taste' ? '' : (oi.quantity || '') + ' '}${oi.description === 'to taste' ? '' : (oi.unit || '')} ${oi.name} ${oi.description ? `(${oi.description})` : ''} (from: ${oi.mealName})`.trim())
        .join('\n');

      if (detailsPartStr.trim() !== "" || aggItem.name.trim() !== "") {
        grouped[foundCategory].push({
            itemName: aggItem.name,
            itemNameClass: "text-foreground",
            detailsPart: detailsPartStr,
            detailsClass: combinedDetailsClass,
            originalItemsTooltip,
            uniqueKey
        });
      }
    });

    manualItems.forEach(manualItem => {
      const formatted = formatQuantityAndUnitForDisplay(
        typeof manualItem.quantity === 'string' ? parseFloat(manualItem.quantity) || 0 : manualItem.quantity,
        manualItem.unit
      );
      let detailsPartStr = "";
      if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
        detailsPartStr = `${formatted.quantity}`;
      } else if (formatted.quantity > 0 && formatted.unit) {
        detailsPartStr = `${formatted.quantity} ${formatted.unit}`;
      } else if (formatted.unit) {
        detailsPartStr = formatted.unit;
      }

      const uniqueKey = `manual:${manualItem.id}`;
      grouped["Manually Added"].push({
        itemName: manualItem.name,
        itemNameClass: "text-foreground",
        detailsPart: detailsPartStr,
        detailsClass: formatted.detailsClass,
        originalItemsTooltip: "Manually added item",
        uniqueKey
      });
    });

    return grouped;
  }, [aggregatedIngredients, manualItems, displaySystem]);

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

            const uniqueKeyForStriking = `mealwise:${pm.meals!.name}:${ing.name.trim().toLowerCase()}:${(ing.unit || "").trim().toLowerCase()}-${index}`;
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
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode, manualItems]);

  useEffect(() => {
    const currentDisplayKeys = new Set(
      viewMode === 'category'
        ? Object.values(categorizedDisplayList).flat().map(item => item.uniqueKey)
        : mealWiseDisplayList.flatMap(meal => meal.ingredients.map(ing => ing.uniqueKey))
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
  }, [categorizedDisplayList, mealWiseDisplayList, viewMode, userId, selectedDays, displaySystem, manualItems, today]);

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

  const isAggregatedEmpty = aggregatedIngredients.length === 0;
  const isManualEmpty = manualItems.length === 0;
  const isEmptyList = viewMode === 'category'
    ? Object.values(categorizedDisplayList).every(list => list.length === 0)
    : (mealWiseDisplayList.length === 0 && isManualEmpty);

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
                  onClick={() => setViewMode(prev => prev === 'category' ? 'meal' : 'category')}
                  className="h-8 w-8 p-1 sm:p-0 sm:h-8 sm:w-auto sm:px-3"
               >
                  {viewMode === 'category' ? <Utensils className="h-5 w-5 sm:mr-1" /> : <LayoutGrid className="h-5 w-5 sm:mr-1" />}
                  <span className="hidden sm:inline">{viewMode === 'category' ? 'View by Meal' : 'View by Category'}</span>
               </Button>
           </div>
         </div>

        {isEmptyList ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">Your List is Empty</p>
            <p className="text-sm">Plan some meals or add items manually to see them here.</p>
          </div>
        ) : viewMode === 'category' ? (
          categoryOrder.map(category => {
            const itemsInCategory = categorizedDisplayList[category];
            if (itemsInCategory && itemsInCategory.length > 0) {
              const allItemsInCategoryStruck = itemsInCategory.every(item => struckItems.has(item.uniqueKey));
              return (
                <div key={category} className="mb-4">
                  <h3 className={`text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2 ${allItemsInCategoryStruck ? 'line-through text-gray-400 dark:text-gray-600 opacity-70' : ''}`}>
                    {category}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {itemsInCategory.map((item) => (
                      <li
                        key={item.uniqueKey}
                        onClick={() => handleItemClick(item.uniqueKey)}
                        className={`cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${struckItems.has(item.uniqueKey) ? 'line-through text-gray-400 dark:text-gray-600 opacity-70' : ''}`}
                        title={item.originalItemsTooltip}
                      >
                        {item.detailsPart === "to taste" ? (
                          <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>
                            {item.itemName}{' '}
                            <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>(to taste)</span>
                          </span>
                        ) : (
                          <>
                            <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>{item.itemName}</span>
                            {item.detailsPart && <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>: {item.detailsPart}</span>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            return null;
          })
        ) : (
          <>
            {mealWiseDisplayList.map(mealItem => (
              <div key={`${mealItem.planDate}-${mealItem.mealName}`} className="mb-4">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                  {mealItem.mealName} ({format(parseISO(mealItem.planDate), 'MMM dd')})
                </h3>
                <ul className="space-y-1 text-sm pl-2">
                  {mealItem.ingredients.map((item, index) => (
                    <li
                      key={`${item.uniqueKey}-${index}`}
                      onClick={() => handleItemClick(item.uniqueKey)}
                      className={`cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${struckItems.has(item.uniqueKey) ? 'line-through text-gray-400 dark:text-gray-600' : ''}`}
                      title={item.originalItemsTooltip}
                    >
                      {item.detailsPart === "to taste" ? (
                        <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>
                          {item.itemName}{' '}
                          <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>(to taste)</span>
                        </span>
                      ) : (
                        <>
                          <span className={struckItems.has(item.uniqueKey) ? '' : item.itemNameClass}>{item.itemName}</span>
                          {item.detailsPart && <span className={struckItems.has(item.uniqueKey) ? '' : item.detailsClass}>: {item.detailsPart}</span>}
                        </>
                      )}
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
                        {detailsPartStr === "to taste" ? (
                          <span className={struckItems.has(uniqueKey) ? '' : "text-foreground"}>
                            {item.name}{' '}
                            <span className={struckItems.has(uniqueKey) ? '' : formatted.detailsClass}>(to taste)</span>
                          </span>
                        ) : (
                          <>
                            <span className={struckItems.has(uniqueKey) ? '' : "text-foreground"}>{item.name}</span>
                            {detailsPartStr && <span className={struckItems.has(uniqueKey) ? '' : formatted.detailsClass}>: {detailsPartStr}</span>}
                          </>
                        )}
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

export default GroceryList;