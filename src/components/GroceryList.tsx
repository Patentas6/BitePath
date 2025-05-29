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

const SHARED_LOCAL_STORAGE_KEY = 'bitepath-struckSharedGroceryItems';
const MANUAL_ITEMS_LOCAL_STORAGE_KEY = 'bitepath-manualGroceryItems';

interface PlannedMealWithIngredients {
  id: string; 
  plan_date: string;
  meal_type: string | null;
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

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units', 'large', 'medium', 'small', 'clove', 'cloves', 'head', 'heads', 'bunch', 'bunches', 'sprig', 'sprigs'];
const COUNTABLE_ITEM_KEYWORDS = ['egg', 'apple', 'banana', 'orange', 'potato', 'onion', 'garlic clove', 'lemon', 'lime']; // Add more as needed

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
        .select("id, plan_date, meal_type, meals ( name, ingredients )")
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
    itemName?: string // Optional item name for context (e.g., for "large eggs")
  ): { quantity: number | string, unit: string, detailsClass: string } => {
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
  
    // Handle pluralization carefully
    if (roundedDisplayQty > 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && unitStr.length > 0) {
      if (PIECE_UNITS.includes(unitStr.toLowerCase())) {
        // For piece units, often the number itself is enough, or the unit doesn't pluralize (e.g. "large")
        // Or if it's like "piece", it becomes "pieces"
        if (unitStr.toLowerCase() === 'piece') unitStr = 'pieces';
        // else keep as is (e.g. "large")
      } else if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
        unitStr = unitStr.slice(0, -1) + 'ies';
      } else if (!unitStr.endsWith('s')) {
        unitStr += "s";
      }
    }
    
    // If the unit is a descriptor like "large" for "eggs", just return the quantity.
    if (itemName?.toLowerCase().includes("egg") && ["large", "medium", "small"].includes(unitStr.toLowerCase())) {
        return { quantity: String(roundedDisplayQty), unit: "", detailsClass };
    }

    return { quantity: String(roundedDisplayQty), unit: unitStr, detailsClass };
  };

  const globallyAggregatedIngredients = useMemo(() => {
    if (!plannedMealsData) return new Map();
    
    const ingredientsMap = new Map<string, { // Key: ingredient name (lowercase)
      displayName: string; // Original casing
      unitsData: Map<string, { // Key: unit (lowercase, normalized for counts)
        totalQuantity: number;
        originalSources: Set<string>;
        descriptions: Set<string>;
      }>;
    }>();

    plannedMealsData.forEach(pm => {
      if (!pm.meals || !pm.meals.name || !pm.meals.ingredients) return;
      const mealSourceInfo = `${pm.meals.name} (${pm.meal_type || 'Meal'} - ${format(parseISO(pm.plan_date), 'MMM dd')})`;

      try {
        const parsedIngredients: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
        parsedIngredients.forEach(ing => {
          if (!ing.name || ing.name.trim() === "") return;
          const ingNameLower = ing.name.trim().toLowerCase();
          const ingDisplayName = ing.name.trim();

          if (!ingredientsMap.has(ingNameLower)) {
            ingredientsMap.set(ingNameLower, { displayName: ingDisplayName, unitsData: new Map() });
          }
          const ingRecord = ingredientsMap.get(ingNameLower)!;

          const isToTaste = ing.description?.trim().toLowerCase() === 'to taste';
          let unitKey = isToTaste ? "to taste" : (ing.unit || "count").trim().toLowerCase();
          let quantityNum = 0;

          if (!isToTaste) {
            quantityNum = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : Number(ing.quantity);
            if (isNaN(quantityNum) || quantityNum < 0) quantityNum = 0; // Treat invalid as 0 for summation
            
            if (PIECE_UNITS.includes(unitKey) || (quantityNum > 0 && unitKey === "count" && COUNTABLE_ITEM_KEYWORDS.some(k => ingNameLower.includes(k)))) {
              unitKey = "count"; // Normalize various piece/count units
            }
          }
          
          const unitMapEntry = ingRecord.unitsData.get(unitKey);
          if (unitMapEntry) {
            if (!isToTaste) unitMapEntry.totalQuantity += quantityNum;
            if (unitMapEntry.originalSources) { 
                unitMapEntry.originalSources.add(mealSourceInfo);
            } else {
                unitMapEntry.originalSources = new Set([mealSourceInfo]); 
            }
            if (ing.description) {
                if (unitMapEntry.descriptions) { 
                    unitMapEntry.descriptions.add(ing.description);
                } else {
                    unitMapEntry.descriptions = new Set([ing.description]); 
                }
            }
          } else {
            ingRecord.unitsData.set(unitKey, {
              totalQuantity: quantityNum,
              originalSources: new Set([mealSourceInfo]),
              descriptions: ing.description ? new Set([ing.description]) : new Set(),
            });
          }
        });
      } catch (e) { console.warn(`Error parsing ingredients for meal "${pm.meals.name}":`, e); }
    });
    return ingredientsMap;
  }, [plannedMealsData]);


  const mealWiseDisplayList: AggregatedMealDisplayItem[] = useMemo(() => {
    const mealInstanceMap = new Map<string, AggregatedMealDisplayItem>();

    plannedMealsData.forEach(pm => {
        if (!pm.meals || !pm.meals.name || !pm.meals.ingredients) return;
        const mealInstanceKey = `${pm.id}_${pm.meals.name}`; 
        
        const mealDisplayItem: AggregatedMealDisplayItem = {
            mealName: `${pm.meals.name} (${pm.meal_type || 'Meal'} - ${format(parseISO(pm.plan_date), 'MMM dd')})`,
            ingredients: []
        };

        try {
            const parsedIngredients: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
            const instanceAggregatedIngredients = new Map<string, {
                name: string; totalQuantity: number; unit: string; descriptions: Set<string>;
            }>();

            parsedIngredients.forEach(ing => {
                if (!ing.name) return;
                const isToTaste = ing.description?.trim().toLowerCase() === 'to taste' || !ing.unit || ing.quantity === null || ing.quantity === undefined;
                const aggKey = isToTaste ? `${ing.name.trim().toLowerCase()}:to-taste` : `${ing.name.trim().toLowerCase()}_${(ing.unit || "count").trim().toLowerCase()}`;
                let quantityNum = 0;
                if (!isToTaste) {
                    quantityNum = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : Number(ing.quantity);
                    if (isNaN(quantityNum) || quantityNum < 0) quantityNum = 0;
                }

                if (instanceAggregatedIngredients.has(aggKey)) {
                    const existing = instanceAggregatedIngredients.get(aggKey)!;
                    if(!isToTaste) existing.totalQuantity += quantityNum;
                    if(ing.description) existing.descriptions.add(ing.description);
                } else {
                    instanceAggregatedIngredients.set(aggKey, {
                        name: ing.name.trim(),
                        totalQuantity: quantityNum,
                        unit: isToTaste ? "to taste" : (ing.unit || "count").trim(),
                        descriptions: ing.description ? new Set([ing.description]) : new Set(),
                    });
                }
            });
            
            instanceAggregatedIngredients.forEach(aggIng => {
                const formatted = formatQuantityAndUnitForDisplay(aggIng.totalQuantity, aggIng.unit, aggIng.name);
                let detailsPartStr = aggIng.unit.toLowerCase() === 'to taste' ? "to taste" : `${formatted.quantity} ${formatted.unit}`.trim();
                 if (aggIng.unit.toLowerCase() === "count" && aggIng.name.toLowerCase().includes("egg")) { 
                    detailsPartStr = String(formatted.quantity);
                }


                const uniqueDescriptions = Array.from(aggIng.descriptions).join(', ');
                if (uniqueDescriptions && aggIng.unit.toLowerCase() !== 'to taste') {
                    detailsPartStr += ` (${uniqueDescriptions})`;
                }
                const uniqueKey = `mealInstance:${mealInstanceKey}:${aggIng.name.toLowerCase()}:${aggIng.unit.toLowerCase()}`;
                mealDisplayItem.ingredients.push({
                    itemName: aggIng.name,
                    itemNameClass: "text-foreground",
                    detailsPart: detailsPartStr,
                    detailsClass: formatted.detailsClass,
                    originalItemsTooltip: `From ${pm.meals!.name}`,
                    uniqueKey: uniqueKey,
                });
            });
            mealDisplayItem.ingredients.sort((a,b) => a.itemName.localeCompare(b.itemName));
            mealInstanceMap.set(mealInstanceKey, mealDisplayItem);

        } catch (e) { console.warn("Error processing meal instance for 'By Meal' view", e); }
    });
    return Array.from(mealInstanceMap.values()).sort((a,b) => a.mealName.localeCompare(b.mealName));

  }, [plannedMealsData, displaySystem]);

  const categorizedDisplayList: CategorizedDisplayItem[] = useMemo(() => {
    if (groceryViewMode !== 'byCategory' || !globallyAggregatedIngredients) return [];
    
    const ingredientsByCategory = new Map<string, AggregatedDisplayListItem[]>();

    globallyAggregatedIngredients.forEach((ingData, ingNameLower) => {
      const category = getIngredientCategory(ingData.displayName);
      if (!ingredientsByCategory.has(category)) {
        ingredientsByCategory.set(category, []);
      }
      
      const detailsParts: string[] = [];
      let overallDetailsClass = "text-foreground";
      const allSourcesForTooltip = new Set<string>();
      
      if (ingData.unitsData && typeof ingData.unitsData.forEach === 'function') {
        ingData.unitsData.forEach((unitData, unitKey) => {
          if (!unitData) {
            console.warn(`[GroceryList] unitData is undefined for ingredient: ${ingData.displayName}, unitKey: ${unitKey}. Skipping this unit entry.`);
            return; 
          }
          const { totalQuantity, originalSources, descriptions } = unitData;

          if (originalSources instanceof Set && typeof originalSources.forEach === 'function') {
            originalSources.forEach(src => allSourcesForTooltip.add(src));
          } else {
            console.warn(`[GroceryList] unitData.originalSources is not a valid Set for ${ingData.displayName} - ${unitKey}. Value:`, originalSources);
          }
          
          const uniqueDescriptions = (descriptions instanceof Set && descriptions.size > 0) ? Array.from(descriptions).join(', ') : '';

          if (unitKey === "to taste") {
            detailsParts.push("to taste");
            overallDetailsClass = "text-gray-500 dark:text-gray-400";
          } else {
            let displayUnitForFormat = unitKey;
            if (unitKey === "count") {
               const originalEntry = plannedMealsData.flatMap(pm => pm.meals?.ingredients ? JSON.parse(pm.meals.ingredients) as ParsedIngredientItem[] : [])
                                  .find(pi => pi.name?.trim().toLowerCase() === ingNameLower && 
                                              (PIECE_UNITS.includes((pi.unit || "count").trim().toLowerCase()) || 
                                              (COUNTABLE_ITEM_KEYWORDS.some(k => ingNameLower.includes(k)) && (pi.unit || "count").trim().toLowerCase() === "count")));
               displayUnitForFormat = originalEntry?.unit || "items";
            }

            const formatted = formatQuantityAndUnitForDisplay(totalQuantity, displayUnitForFormat, ingData.displayName);
            let currentDetail = "";
            if (unitKey === "count") {
              currentDetail = String(formatted.quantity); 
            } else {
              currentDetail = `${formatted.quantity} ${formatted.unit}`.trim();
            }
            
            if (uniqueDescriptions) {
              currentDetail += ` (${uniqueDescriptions})`;
            }
            detailsParts.push(currentDetail);
            if (formatted.detailsClass !== "text-foreground") overallDetailsClass = formatted.detailsClass;
          }
        });
      } else {
        console.warn(`[GroceryList] ingData.unitsData is not iterable or undefined for ingredient: ${ingData.displayName} (key: ${ingNameLower}). Skipping this ingredient in category view.`);
      }

      const uniqueKey = `category:${category}:${ingNameLower}`;
      ingredientsByCategory.get(category)!.push({
        itemName: ingData.displayName,
        itemNameClass: "text-foreground",
        detailsPart: detailsParts.join(' + '),
        detailsClass: overallDetailsClass,
        originalItemsTooltip: `From: ${Array.from(allSourcesForTooltip).join('; ')}`,
        uniqueKey: uniqueKey,
      });
    });

    const displayList: CategorizedDisplayItem[] = [];
    const categoryOrder = ["Produce", "Meat & Poultry", "Dairy & Eggs", "Pantry", "Other"];
    categoryOrder.forEach(catName => {
      if (ingredientsByCategory.has(catName)) {
        const items = ingredientsByCategory.get(catName)!;
        items.sort((a,b) => a.itemName.localeCompare(b.itemName));
        displayList.push({ categoryName: catName, ingredients: items });
      }
    });
    return displayList;
  }, [groceryViewMode, globallyAggregatedIngredients, displaySystem, plannedMealsData]);


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
                size="sm" 
                onClick={() => setGroceryViewMode(prev => prev === 'byMeal' ? 'byCategory' : 'byMeal')}
                className="h-8 text-sm"
              >
                {groceryViewMode === 'byMeal' ? <LayoutGrid className="mr-2 h-4 w-4" /> : <List className="mr-2 h-4 w-4" />}
                View by {groceryViewMode === 'byMeal' ? 'Category' : 'Meal'}
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
                        item.unit,
                        item.name
                    );
                    let detailsPartStr = "";
                     if (item.name.toLowerCase().includes("egg") && ["large", "medium", "small", "piece", "pieces", "item", "items", "unit", "units"].includes(formatted.unit.toLowerCase())) {
                        detailsPartStr = String(formatted.quantity);
                    } else if (PIECE_UNITS.includes(formatted.unit.toLowerCase()) && parseFloat(String(formatted.quantity)) > 0) {
                        detailsPartStr = `${formatted.quantity}`;
                    } else if (parseFloat(String(formatted.quantity)) > 0 && formatted.unit) {
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