import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays, parseISO, startOfToday } from "date-fns"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListChecks, ShoppingCart, PlusCircle, LayoutGrid, List } from "lucide-react";
import { convertToPreferredSystem } from "@/utils/conversionUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ManualAddItemForm from "./ManualAddItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { parseFirstNumber } from "@/utils/mealUtils";

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';
const MANUAL_ITEMS_LOCAL_STORAGE_KEY = 'bitepath-manualGroceryItems';

interface PlannedMealWithIngredients {
  id: string; 
  plan_date: string;
  meal_type: string | null;
  desired_servings?: number | null; // Added desired_servings
  meals: {
    name: string;
    ingredients: string | null;
    servings?: string | null; // Added original servings from meals table
  } | null;
}

interface ParsedIngredientItem {
  name: string;
  quantity: number | string | null; 
  unit: string | null; 
  description?: string;
}

interface ManualGroceryItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface AggregatedDisplayListItem {
  itemName: string;
  itemNameClass: string;
  detailsPart: string;
  detailsClass: string;
  originalItemsTooltip: string;
  uniqueKey: string;
}

interface AggregatedMealDisplayItem {
  mealName: string;
  ingredients: AggregatedDisplayListItem[];
}

interface CategorizedDisplayItem {
  categoryName: string;
  ingredients: AggregatedDisplayListItem[];
}

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units'];
const SPICE_MEASUREMENT_UNITS: ReadonlyArray<string> = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'pinch', 'pinches', 'dash', 'dashes'];

const PRODUCE_KEYWORDS = ['apple', 'apricot', 'artichoke', 'asparagus', 'avocado', 'banana', 'basil', 'bean', 'beans', 'beet', 'bell pepper', 'berry', 'berries', 'bok choy', 'broccoli', 'brussels sprout', 'cabbage', 'cantaloupe', 'carrot', 'cauliflower', 'celery', 'chard', 'cherry', 'chile', 'cilantro', 'citrus', 'collard greens', 'corn', 'cucumber', 'date', 'dill', 'eggplant', 'endive', 'fennel', 'fig', 'fruit', 'fruits', 'garlic', 'ginger', 'grape', 'grapefruit', 'green bean', 'greens', 'herb', 'herbs', 'honeydew', 'kale', 'kiwi', 'kohlrabi', 'leek', 'lemon', 'lettuce', 'lime', 'mango', 'melon', 'mint', 'mushroom', 'nectarine', 'okra', 'onion', 'orange', 'oregano', 'papaya', 'parsley', 'parsnip', 'pea', 'peach', 'pear', 'pepper', 'pineapple', 'plum', 'pomegranate', 'potato', 'pumpkin', 'radicchio', 'radish', 'raspberry', 'rhubarb', 'rosemary', 'rutabaga', 'scallion', 'shallot', 'spinach', 'squash', 'strawberry', 'sweet potato', 'swiss chard', 'tangerine', 'thyme', 'tomatillo', 'tomato', 'turnip', 'vegetable', 'vegetables', 'watermelon', 'yam', 'zucchini'];
const MEAT_POULTRY_KEYWORDS = ['anchovy', 'bacon', 'beef', 'bratwurst', 'bresaola', 'capicola', 'charcuterie', 'chicken', 'chorizo', 'clam', 'cod', 'crab', 'duck', 'fish', 'flounder', 'game', 'giblets', 'goat', 'goose', 'ground beef', 'ground chicken', 'ground pork', 'ground turkey', 'grouper', 'haddock', 'halibut', 'ham', 'hot dog', 'kielbasa', 'lamb', 'liver', 'lobster', 'loin', 'lumpfish', 'mackerel', 'mahi-mahi', 'meat', 'meatball', 'mignon', 'mortadella', 'mussel', 'octopus', 'ostrich', 'oxtail', 'oyster', 'pancetta', 'pastrami', 'pepperoni', 'pheasant', 'pork', 'prosciutto', 'quail', 'rabbit', 'ribeye', 'ribs', 'roast beef', 'salami', 'salmon', 'sardine', 'sausage', 'scallop', 'sea bass', 'seafood', 'shad', 'shellfish', 'shrimp', 'sirloin', 'skate', 'smelt', 'snapper', 'sole', 'squid', 'steak', 'stew meat', 'strip steak', 'sturgeon', 'swordfish', 'tilapia', 'tongue', 'tripe', 'trout', 'tuna', 'turkey', 'veal', 'venison', 'whitefish'];
const DAIRY_EGGS_KEYWORDS = ['butter', 'buttermilk', 'casein', 'cheese', 'cheddar', 'cottage cheese', 'cream', 'cream cheese', 'creme fraiche', 'curd', 'dairy', 'egg', 'eggs', 'feta', 'ghee', 'goat cheese', 'gouda', 'half-and-half', 'ice cream', 'kefir', 'mascarpone', 'milk', 'mozzarella', 'paneer', 'parmesan', 'provolone', 'ricotta', 'sherbet', 'sour cream', 'whey', 'yogurt', 'yoghurt'];
const PANTRY_KEYWORDS = ['agave', 'almond flour', 'almond meal', 'amaranth', 'arrowroot', 'baking mix', 'baking powder', 'baking soda', 'barley', 'bean thread', 'bicarbonate of soda', 'biscuit mix', 'bouillon', 'bran', 'bread', 'breadcrumb', 'breadcrumbs', 'broth', 'brown rice', 'brownie mix', 'buckwheat', 'bulgur', 'cake mix', 'canned', 'capellini', 'cereal', 'chia seed', 'chickpea flour', 'chocolate', 'cocoa', 'coconut flour', 'coconut milk', 'coffee', 'condensed milk', 'confectioners sugar', 'cookie mix', 'corn flour', 'corn syrup', 'cornmeal', 'cornstarch', 'couscous', 'cracker', 'crackers', 'crispbread', 'crouton', 'demerara sugar', 'ditalini', 'dried fruit', 'durum', 'edamame', 'elbow macaroni', 'emmer', 'evaporated milk', 'extract', 'farfalle', 'farina', 'farro', 'fettuccine', 'flax seed', 'flour', 'food coloring', 'freekeh', 'fusilli', 'gelatin', 'gnocchi', 'graham cracker', 'granola', 'grits', 'icing sugar', 'instant coffee', 'jam', 'jelly', 'juice', 'kamut', 'ketchup', 'lasagna', 'lentil', 'linguine', 'macaroni', 'maple syrup', 'marmalade', 'marshmallow', 'matzo', 'mayonnaise', 'millet', 'molasses', 'muesli', 'mustard', 'noodle', 'noodles', 'nut', 'nuts', 'oat', 'oatmeal', 'oil', 'olive oil', 'orzo', 'panko', 'pappardelle', 'pasta', 'peanut butter', 'pearl barley', 'pectin', 'penne', 'pickle', 'pie crust', 'pita', 'polenta', 'popcorn', 'poppy seed', 'potato starch', 'powdered sugar', 'preserves', 'pretzel', 'protein powder', 'pudding mix', 'puff pastry', 'quinoa', 'ramen', 'relish', 'rigatoni', 'rice', 'rice flour', 'risotto', 'rolled oat', 'rotelle', 'rotini', 'rye', 'sago', 'salt', 'sauce', 'semolina', 'sesame seed', 'shortening', 'soda', 'sorghum', 'soup mix', 'soy sauce', 'spaghetti', 'spelt', 'spice', 'spices', 'split pea', 'sprinkles', 'steel cut oat', 'stock', 'sugar', 'sunflower seed', 'syrup', 'taco shell', 'tahini', 'tapioca', 'tea', 'teriyaki sauce', 'tofu', 'tomato paste', 'tomato sauce', 'tortellini', 'tortilla', 'triticale', 'tuna can', 'vanilla', 'vermicelli', 'vinegar', 'vital wheat gluten', 'wafer', 'water chestnut', 'wheat', 'wheat germ', 'white rice', 'worcestershire sauce', 'yeast', 'ziti'];

function getIngredientCategory(ingredientName: string): string {
  const name = ingredientName.toLowerCase().trim();
  if (PRODUCE_KEYWORDS.some(keyword => name.includes(keyword))) return "Produce";
  if (MEAT_POULTRY_KEYWORDS.some(keyword => name.includes(keyword))) return "Meat & Poultry";
  if (DAIRY_EGGS_KEYWORDS.some(keyword => name.includes(keyword))) return "Dairy & Eggs";
  if (PANTRY_KEYWORDS.some(keyword => name.includes(keyword))) return "Pantry";
  return "Other";
}

interface GroceryListProps {
  userId: string;
  currentWeekStart?: Date; 
}

const GroceryList: React.FC<GroceryListProps> = ({ userId }) => {
  const [displaySystem, setDisplaySystem] = useState<'imperial' | 'metric'>('imperial');
  const [selectedDays, setSelectedDays] = useState<string>('7');
  const [isManualAddDialogOpen, setIsManualAddDialogOpen] = useState(false);
  const [groceryViewMode, setGroceryViewMode] = useState<'byMeal' | 'byCategory'>('byMeal');

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
        .select("id, plan_date, meal_type, desired_servings, meals ( name, ingredients, servings )") // Added desired_servings and meals.servings
        .eq("user_id", userId)
        .gte("plan_date", startDateStr)
        .lte("plan_date", endDateStr);
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

  const globallyAggregatedIngredients = useMemo(() => {
    if (!plannedMealsData) return [];
    
    const ingredientsByMealName = new Map<string, Map<string, {
      name: string;
      totalQuantity: number;
      unit: string;
      descriptions: Set<string>;
      originalSources: string[];
    }>>();

    plannedMealsData.forEach(pm => {
      if (!pm.meals || !pm.meals.name || !pm.meals.ingredients) return;
      const mealName = pm.meals.name;
      const mealSourceInfo = `${pm.meals.name} (${pm.meal_type || 'Meal'} - ${format(parseISO(pm.plan_date), 'MMM dd')})`;

      if (!ingredientsByMealName.has(mealName)) {
        ingredientsByMealName.set(mealName, new Map());
      }
      const mealIngredientMap = ingredientsByMealName.get(mealName)!;

      try {
        const parsedIngredients: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
        
        let scalingFactor = 1;
        const originalMealServingsStr = pm.meals.servings;
        const desiredPlanServings = pm.desired_servings;

        if (desiredPlanServings && originalMealServingsStr) {
          const originalServingsNum = parseFirstNumber(originalMealServingsStr);
          if (originalServingsNum && originalServingsNum > 0 && desiredPlanServings > 0) {
            scalingFactor = desiredPlanServings / originalServingsNum;
          }
        }

        parsedIngredients.forEach(ing => {
          if (!ing.name) return;

          const isToTaste = ing.description?.trim().toLowerCase() === 'to taste' || !ing.unit || ing.quantity === null || ing.quantity === undefined;
          const aggKey = isToTaste 
            ? `${ing.name.trim().toLowerCase()}:to-taste` 
            : `${ing.name.trim().toLowerCase()}_${ing.unit!.trim().toLowerCase()}`;
          
          let quantityNum = 0;
          if (!isToTaste) {
            const baseQuantity = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : Number(ing.quantity);
            if (isNaN(baseQuantity) || baseQuantity < 0) return;
            quantityNum = baseQuantity * scalingFactor; // Apply scaling factor
          }

          if (mealIngredientMap.has(aggKey)) {
            const existing = mealIngredientMap.get(aggKey)!;
            if (!isToTaste) existing.totalQuantity += quantityNum;
            if (ing.description) existing.descriptions.add(ing.description);
            existing.originalSources.push(mealSourceInfo);
          } else {
            mealIngredientMap.set(aggKey, {
              name: ing.name.trim(),
              totalQuantity: isToTaste ? 0 : quantityNum,
              unit: isToTaste ? "to taste" : ing.unit!.trim(),
              descriptions: ing.description ? new Set([ing.description]) : new Set(),
              originalSources: [mealSourceInfo],
            });
          }
        });
      } catch (e) { console.warn(`Error parsing ingredients for meal "${mealName}":`, e); }
    });
    return ingredientsByMealName;
  }, [plannedMealsData]);


  const mealWiseDisplayList: AggregatedMealDisplayItem[] = useMemo(() => {
    const displayList: AggregatedMealDisplayItem[] = [];
    globallyAggregatedIngredients.forEach((ingredientMap, mealName) => {
      const mealDisplayItem: AggregatedMealDisplayItem = { mealName, ingredients: [] };
      ingredientMap.forEach(aggIng => {
        let detailsPartStr = "";
        let formattedDetailsClass = "text-foreground";

        if (aggIng.unit.toLowerCase() === 'to taste' || aggIng.totalQuantity === 0 && aggIng.unit.toLowerCase() !== 'to taste') {
          detailsPartStr = "to taste";
          formattedDetailsClass = "text-gray-500 dark:text-gray-400";
        } else {
          const formatted = formatQuantityAndUnitForDisplay(aggIng.totalQuantity, aggIng.unit);
          formattedDetailsClass = formatted.detailsClass;
          if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
            detailsPartStr = `${formatted.quantity}`;
          } else if (formatted.quantity > 0 && formatted.unit) {
            detailsPartStr = `${formatted.quantity} ${formatted.unit}`;
          } else if (formatted.unit) {
            detailsPartStr = formatted.unit;
          }
        }
        
        const uniqueDescriptions = Array.from(aggIng.descriptions).join(', ');
        if (uniqueDescriptions && aggIng.unit.toLowerCase() !== 'to taste') {
          detailsPartStr += ` (${uniqueDescriptions})`;
        }
        
        const uniqueKeyForStriking = `global-agg:${mealName}:${aggIng.name.trim().toLowerCase()}:${aggIng.unit.trim().toLowerCase()}`;
        const combinedTooltip = `Total: ${detailsPartStr || aggIng.totalQuantity} ${aggIng.unit} ${aggIng.name}. From: ${Array.from(new Set(aggIng.originalSources)).join('; ')}.`;

        mealDisplayItem.ingredients.push({
          itemName: aggIng.name,
          itemNameClass: "text-foreground",
          detailsPart: detailsPartStr.trim(),
          detailsClass: formattedDetailsClass,
          originalItemsTooltip: combinedTooltip,
          uniqueKey: uniqueKeyForStriking,
        });
      });
      mealDisplayItem.ingredients.sort((a, b) => a.itemName.localeCompare(b.itemName));
      displayList.push(mealDisplayItem);
    });
    return displayList.sort((a,b) => a.mealName.localeCompare(b.mealName));
  }, [globallyAggregatedIngredients, displaySystem]);

  const categorizedDisplayList: CategorizedDisplayItem[] = useMemo(() => {
    if (groceryViewMode !== 'byCategory') return [];

    const ingredientsByCategory = new Map<string, Map<string, {
        displayName: string;
        unitsData: { quantity: number; unit: string; originalSources: string[] }[];
        allOriginalSources: Set<string>;
    }>>();

    globallyAggregatedIngredients.forEach((ingredientMap) => {
        ingredientMap.forEach(aggIng => {
            const category = getIngredientCategory(aggIng.name);
            if (!ingredientsByCategory.has(category)) {
                ingredientsByCategory.set(category, new Map());
            }
            const categoryIngredientMap = ingredientsByCategory.get(category)!;
            const ingKey = aggIng.name.toLowerCase();

            if (!categoryIngredientMap.has(ingKey)) {
                categoryIngredientMap.set(ingKey, {
                    displayName: aggIng.name,
                    unitsData: [],
                    allOriginalSources: new Set(),
                });
            }
            const ingInfo = categoryIngredientMap.get(ingKey)!;
            ingInfo.unitsData.push({
                quantity: aggIng.totalQuantity,
                unit: aggIng.unit,
                originalSources: aggIng.originalSources,
            });
            aggIng.originalSources.forEach(src => ingInfo.allOriginalSources.add(src));
        });
    });
    
    const displayList: CategorizedDisplayItem[] = [];
    const categoryOrder = ["Produce", "Meat & Poultry", "Dairy & Eggs", "Pantry", "Other"];

    categoryOrder.forEach(categoryName => {
        if (ingredientsByCategory.has(categoryName)) {
            const categoryDisplayItem: CategorizedDisplayItem = { categoryName, ingredients: [] };
            const ingredientMapForCategory = ingredientsByCategory.get(categoryName)!;
            
            Array.from(ingredientMapForCategory.values()).sort((a,b) => a.displayName.localeCompare(b.displayName)).forEach(ingInfo => {
                let detailsParts: string[] = [];
                let overallDetailsClass = "text-foreground"; // Default
                
                ingInfo.unitsData.forEach(unitData => {
                    if (unitData.unit.toLowerCase() === 'to taste' || unitData.quantity === 0) {
                        detailsParts.push("to taste");
                        overallDetailsClass = "text-gray-500 dark:text-gray-400"; // If any part is "to taste", mark it
                    } else {
                        const formatted = formatQuantityAndUnitForDisplay(unitData.quantity, unitData.unit);
                        if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && formatted.quantity > 0) {
                            detailsParts.push(`${formatted.quantity}`);
                        } else if (formatted.quantity > 0 && formatted.unit) {
                            detailsParts.push(`${formatted.quantity} ${formatted.unit}`);
                        } else if (formatted.unit) {
                            detailsParts.push(formatted.unit);
                        }
                        if (formatted.detailsClass !== "text-foreground") {
                           overallDetailsClass = formatted.detailsClass; // Prioritize special class like spice
                        }
                    }
                });

                const uniqueKeyForStriking = `category-agg:${categoryName}:${ingInfo.displayName.toLowerCase()}`;
                const combinedTooltip = `From: ${Array.from(ingInfo.allOriginalSources).join('; ')}.`;

                categoryDisplayItem.ingredients.push({
                    itemName: ingInfo.displayName,
                    itemNameClass: "text-foreground",
                    detailsPart: detailsParts.join(' + ') || "Amount not specified",
                    detailsClass: overallDetailsClass,
                    originalItemsTooltip: combinedTooltip,
                    uniqueKey: uniqueKeyForStriking,
                });
            });
            if (categoryDisplayItem.ingredients.length > 0) {
                 displayList.push(categoryDisplayItem);
            }
        }
    });
    return displayList;
  }, [globallyAggregatedIngredients, displaySystem, groceryViewMode]);


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SHARED_LOCAL_STORAGE_KEY) {
        const newGlobalValue = event.newValue;
        const newGlobalStruckItems = newGlobalValue ? new Set<string>(JSON.parse(newGlobalValue)) : new Set<string>();
        
        const currentList = groceryViewMode === 'byMeal' ? mealWiseDisplayList.flatMap(m => m.ingredients) : categorizedDisplayList.flatMap(c => c.ingredients);
        const currentDisplayKeys = new Set(currentList.map(ing => ing.uniqueKey).concat(manualItems.map(item => `manual:${item.id}`)));

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
  }, [mealWiseDisplayList, categorizedDisplayList, manualItems, groceryViewMode]);

  useEffect(() => {
    const currentList = groceryViewMode === 'byMeal' ? mealWiseDisplayList.flatMap(m => m.ingredients) : categorizedDisplayList.flatMap(c => c.ingredients);
    const currentDisplayKeys = new Set(currentList.map(ing => ing.uniqueKey).concat(manualItems.map(item => `manual:${item.id}`)));
    
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
  }, [mealWiseDisplayList, categorizedDisplayList, manualItems, groceryViewMode, userId, selectedDays, displaySystem, today]);

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

  const isManualEmpty = manualItems.length === 0;
  const currentListToDisplay = groceryViewMode === 'byMeal' ? mealWiseDisplayList : categorizedDisplayList;
  const isEmptyList = currentListToDisplay.length === 0 && isManualEmpty;

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
              <Button 
                variant="outline" 
                size={isMobile ? "icon" : "sm"}
                onClick={() => setGroceryViewMode(prev => prev === 'byMeal' ? 'byCategory' : 'byMeal')}
                className="h-8 text-sm"
              >
                {groceryViewMode === 'byMeal' ? <LayoutGrid className={cn("h-4 w-4", !isMobile && "mr-2")} /> : <List className={cn("h-4 w-4", !isMobile && "mr-2")} />}
                {!isMobile && `View by ${groceryViewMode === 'byMeal' ? 'Category' : 'Meal'}`}
              </Button>
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
           </div>
         </div>

        {isEmptyList ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg font-semibold mb-1">Your List is Empty</p>
            <p className="text-sm">Plan some meals or add items manually to see them here.</p>
          </div>
        ) : (
          <>
            {groceryViewMode === 'byMeal' && mealWiseDisplayList.map(mealItem => (
              <div key={mealItem.mealName} className="mb-4">
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
            {groceryViewMode === 'byCategory' && categorizedDisplayList.map(categoryItem => (
              <div key={categoryItem.categoryName} className="mb-4">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                  {categoryItem.categoryName}
                </h3>
                <ul className="space-y-1 text-sm pl-2">
                  {categoryItem.ingredients.map((item, index) => (
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

export default GroceryList;