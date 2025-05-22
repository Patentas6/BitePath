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

interface GroceryListProps {
  userId: string;
  currentWeekStart: Date;
}

// --- Start of new parsing logic ---

interface ParsedIngredient {
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  isCountable: boolean;
  originalLine: string;
}

const UNITS_AND_ADJECTIVES: ReadonlyArray<string> = [
  'tablespoons', 'tablespoon', 'tbsp', 'teaspoons', 'teaspoon', 'tsp',
  'fluid ounces', 'fluid ounce', 'fl oz', 'ounces', 'ounce', 'oz',
  'pounds', 'pound', 'lbs', 'lb', 'kilograms', 'kilogram', 'kg',
  'grams', 'gram', 'g', 'milliliters', 'milliliter', 'ml', 'liters', 'liter', 'l',
  'cups', 'cup', 'c', 'pints', 'pint', 'pt', 'quarts', 'quart', 'qt',
  'gallons', 'gallon', 'gal', 'cloves', 'clove', 'pinches', 'pinch',
  'dashes', 'dash', 'cans', 'can', 'packages', 'package', 'pkg',
  'bunches', 'bunch', 'heads', 'head', 'stalks', 'stalk', 'sprigs', 'sprig',
  'slices', 'slice', 'pieces', 'piece', 'sticks', 'stick', 'bottles', 'bottle',
  'boxes', 'box', 'bags', 'bag', 'containers', 'container', 'bars', 'bar',
  'loaves', 'loaf', 'bulbs', 'bulb', 'ears', 'ear', 'sheets', 'sheet', 'leaves', 'leaf',
  'large', 'medium', 'small', 'fresh', 'dried', 'ground', 'boneless',
  'skinless', 'whole', 'diced', 'sliced', 'chopped', 'minced', 'grated',
  'pounded', 'melted', 'softened', 'beaten', 'crushed', 'toasted',
  'cooked', 'uncooked', 'ripe', 'firm', 'raw', 'peeled', 'cored', 'seeded',
  'rinsed', 'drained', 'divided'
];

const TRAILING_QUALIFIERS_PATTERNS: ReadonlyArray<RegExp> = [
  /,?\s*to taste/i, /,?\s*for garnish/i, /,?\s*optional/i, /,?\s*as needed/i,
  /,?\s*for serving/i, /,?\s*if desired/i, /,?\s*if using/i, /,?\s*or more to taste/i,
  /,?\s*or as needed/i
];

const COUNTABLE_UNITS_KEYWORDS: ReadonlyArray<string> = [
  'egg', 'eggs', 'clove', 'cloves', 'can', 'cans', 'bottle', 'bottles', 'head', 'heads',
  'bunch', 'bunches', 'stalk', 'stalks', 'sprig', 'sprigs', 'slice', 'slices',
  'piece', 'pieces', 'fillet', 'fillets', 'breast', 'breasts', 'thigh', 'thighs',
  'link', 'links', 'sheet', 'sheets', 'bar', 'bars', 'loaf', 'loaves', 'bulb', 'bulbs', 'ear', 'ears'
];

const IMPLICITLY_COUNTABLE_INGREDIENTS_ENDINGS: ReadonlyArray<string> = [
  'apple', 'apples', 'potato', 'potatoes', 'onion', 'onions', 'carrot', 'carrots', 'tomato', 'tomatoes',
  'lemon', 'lemons', 'lime', 'limes', 'banana', 'bananas', 'pepper', 'peppers', 'zucchini', 'zucchinis',
  'cucumber', 'cucumbers', 'mushroom', 'mushrooms', 'radish', 'radishes', 'beet', 'beets',
  'orange', 'oranges', 'pear', 'pears', 'peach', 'peaches', 'plum', 'plums'
];

// Units that, if present, mean the quantity is a measurement for the recipe, not a purchase count.
const NON_COUNTABLE_PURCHASE_UNITS: ReadonlyArray<string> = [
  "cup", "cups", "tsp", "teaspoon", "teaspoons", "tbsp", "tablespoon", "tablespoons",
  "gram", "grams", "g", "kg", "kgs", "kilogram", "kilograms",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "pinch", "pinches", "dash", "dashes", "fl oz", "fluid ounce", "fluid ounces",
  "c", "pt", "pint", "pints", "qt", "quart", "quarts", "gal", "gallon", "gallons"
];

function smartParseFloat(numStr: string | undefined): number | null {
  if (!numStr) return null;
  if (numStr.includes('/')) {
    const parts = numStr.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
    return null;
  }
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val;
}

function parseIngredientLine(line: string): ParsedIngredient {
  const originalLine = line;
  let ingredientPart = line.toLowerCase();
  let quantity: number | null = null;
  let extractedUnit: string | null = null;

  ingredientPart = ingredientPart.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); 

  const leadingRegex = /^\s*(\d+(?:[\.\/]\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+){0,1})?\s*(.*)/;
  let match = ingredientPart.match(leadingRegex);

  if (match) {
    const numStr = match[1];
    const potentialUnit = match[2]?.trim().toLowerCase();
    const remainingName = match[3]?.trim();
    const tempQty = smartParseFloat(numStr);

    if (tempQty !== null) {
      if (potentialUnit && UNITS_AND_ADJECTIVES.includes(potentialUnit)) {
        quantity = tempQty;
        extractedUnit = potentialUnit;
        ingredientPart = remainingName || "";
      } else {
        quantity = tempQty;
        ingredientPart = potentialUnit ? `${potentialUnit} ${remainingName || ""}`.trim() : remainingName || "";
      }
    }
  }

  if (quantity === null) {
    const trailingRegex = /^(.*?)\s+(\d+(?:[\.\/]\d+)?)\s*([a-zA-Z]+)?\s*$/;
    match = ingredientPart.match(trailingRegex);
    if (match) {
      const numStr = match[2];
      const potentialUnit = match[3]?.trim().toLowerCase();
      const namePart = match[1]?.trim();
      const tempQty = smartParseFloat(numStr);

      if (tempQty !== null) {
        quantity = tempQty;
        extractedUnit = potentialUnit && UNITS_AND_ADJECTIVES.includes(potentialUnit) ? potentialUnit : null;
        ingredientPart = namePart || "";
        if (potentialUnit && !extractedUnit && namePart) { // Unit was part of name
             ingredientPart = `${namePart} ${potentialUnit}`;
        }
      }
    }
  }
  
  ingredientPart = ingredientPart.replace(/^a\s+/, '').trim();
  for (const pattern of TRAILING_QUALIFIERS_PATTERNS) {
    ingredientPart = ingredientPart.replace(pattern, '').trim();
  }

  let currentName = ingredientPart;
  let changed;
  do {
    changed = false;
    for (const adj of UNITS_AND_ADJECTIVES) {
      if (currentName.startsWith(adj + " ")) {
        if (adj !== extractedUnit) { // Don't strip the extracted unit itself from the name here
            currentName = currentName.substring(adj.length + 1).trim();
            changed = true;
            break;
        }
      }
      if (currentName.endsWith(" " + adj)) {
         if (adj !== extractedUnit) {
            currentName = currentName.substring(0, currentName.length - (adj.length + 1)).trim();
            changed = true;
            break;
         }
      }
    }
  } while (changed);
  
  let normalizedName = currentName.trim();
  const commonIrregularPlurals: {[key: string]: string} = { 'potatoes': 'potato', 'tomatoes': 'tomato', 'leaves': 'leaf', 'loaves': 'loaf'};
  if (commonIrregularPlurals[normalizedName]) {
      normalizedName = commonIrregularPlurals[normalizedName];
  } else if (normalizedName.endsWith('ies') && normalizedName.length > 3) {
      normalizedName = normalizedName.slice(0, -3) + 'y';
  } else if (normalizedName.endsWith('s') && !normalizedName.endsWith('ss') && !['gas', 'bus', 'lens', 'series', 'species', 'molasses', 'hummus', 'cress', 'asparagus'].includes(normalizedName) && normalizedName.length > 1) {
      normalizedName = normalizedName.slice(0, -1);
  }

  normalizedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
  if (normalizedName.length === 0 && originalLine.length > 0) {
    normalizedName = originalLine.charAt(0).toUpperCase() + originalLine.slice(1);
  } else if (normalizedName.length === 0) {
    normalizedName = "Unknown ingredient";
  }
  
  let isCountableForPurchase = false;
  if (quantity !== null) {
    const unitForCountCheck = (extractedUnit || "").toLowerCase();
    const nameForCountCheck = normalizedName.toLowerCase();

    isCountableForPurchase = true; // Assume countable if quantity exists, unless overridden

    if (COUNTABLE_UNITS_KEYWORDS.some(kw => unitForCountCheck.includes(kw) || nameForCountCheck.includes(kw))) {
      isCountableForPurchase = true;
    } else if (IMPLICITLY_COUNTABLE_INGREDIENTS_ENDINGS.some(ending => nameForCountCheck.endsWith(ending) && !unitForCountCheck)) {
      // Only implicitly countable by name if no unit was specified or unit is also countable
      isCountableForPurchase = true;
    } else if (unitForCountCheck) { // If there's a unit, it must not be a non-countable one
        isCountableForPurchase = !NON_COUNTABLE_PURCHASE_UNITS.includes(unitForCountCheck);
    } else { // No unit, and not implicitly countable by name ending - likely not countable for sum (e.g. "water")
        isCountableForPurchase = false;
    }
    
    // Final override: if unit is explicitly a non-countable purchase type, it's NOT countable for sum.
    if (extractedUnit && NON_COUNTABLE_PURCHASE_UNITS.includes(unitForCountCheck)) {
        isCountableForPurchase = false;
    }
  }

  return { normalizedName, quantity, unit: extractedUnit, isCountable: isCountableForPurchase, originalLine };
}
// --- End of new parsing logic ---

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
    
    const ingredientMap = new Map<string, { 
      name: string; 
      totalQuantity: number; 
      unitForSum: string | null; // Unit associated with summed quantities (e.g. "eggs", not "tbsp")
      isSumCountable: boolean; // Is the sum meaningful for display?
      originalLines: string[];
      allUnits: Set<string>; // To track all units encountered for this ingredient
    }>();

    plannedMeals.forEach(pm => {
      const ingredientsBlock = pm.meals?.ingredients;
      if (ingredientsBlock) {
        ingredientsBlock.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          const parsed = parseIngredientLine(trimmedLine);
          
          let existing = ingredientMap.get(parsed.normalizedName);
          if (existing) {
            if (parsed.isCountable && parsed.quantity !== null) {
              existing.totalQuantity += parsed.quantity;
              if (!existing.unitForSum && parsed.unit && !NON_COUNTABLE_PURCHASE_UNITS.includes(parsed.unit.toLowerCase())) {
                existing.unitForSum = parsed.unit; // Prefer unit from a countable item
              }
            }
            if (parsed.isCountable) existing.isSumCountable = true; // If any instance is countable, the sum might be
            existing.originalLines.push(trimmedLine);
            if(parsed.unit) existing.allUnits.add(parsed.unit);
          } else {
            ingredientMap.set(parsed.normalizedName, {
              name: parsed.normalizedName,
              totalQuantity: (parsed.isCountable && parsed.quantity !== null) ? parsed.quantity : 0,
              unitForSum: (parsed.isCountable && parsed.unit && !NON_COUNTABLE_PURCHASE_UNITS.includes(parsed.unit.toLowerCase())) ? parsed.unit : null,
              isSumCountable: parsed.isCountable,
              originalLines: [trimmedLine],
              allUnits: parsed.unit ? new Set([parsed.unit]) : new Set()
            });
          }
        });
      }
    });
    return Array.from(ingredientMap.values());
  }, [plannedMeals]);

  const categorizedDisplayList = useMemo(() => {
    const grouped: Record<Category, Array<{ name: string; displayText: string; originalLines: string[] }>> = 
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, Array<{ name: string; displayText: string; originalLines: string[] }>>);

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
      // Display summed quantity only if isSumCountable is true AND totalQuantity > 0
      if (item.isSumCountable && item.totalQuantity > 0) {
        let unitForDisplay = item.unitForSum || ""; 
        
        // Pluralize unitForDisplay if it's not empty, quantity > 1, and it's not a non-countable unit
        if (item.totalQuantity > 1 && unitForDisplay && !unitForDisplay.endsWith('s') && !NON_COUNTABLE_PURCHASE_UNITS.includes(unitForDisplay.toLowerCase())) {
            if (unitForDisplay.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitForDisplay)) {
                unitForDisplay = unitForDisplay.slice(0, -1) + 'ies';
            } else if (!['sheep', 'fish', 'deer', 'moose', 'series', 'species'].includes(unitForDisplay)) { // Avoid pluralizing unchangeables
                unitForDisplay += 's';
            }
        }
        
        const quantityStr = item.totalQuantity % 1 === 0 ? item.totalQuantity.toString() : item.totalQuantity.toFixed(1);
        displayText = `${item.name}: ${quantityStr} ${unitForDisplay}`.trim();
      } else {
         // If not displaying sum, check if any original unit was non-countable, if so, just name.
         // This handles cases like "1 cup flour" where isSumCountable might be false.
         const hasNonCountableUnit = Array.from(item.allUnits).some(u => NON_COUNTABLE_PURCHASE_UNITS.includes(u.toLowerCase()));
         if (hasNonCountableUnit || !item.isSumCountable) {
            displayText = item.name;
         }
         // If it was isSumCountable but totalQuantity was 0, it also defaults to item.name
      }


      grouped[foundCategory].push({ name: item.name, displayText, originalLines: item.originalLines });
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
          <p className="text-sm text-gray-600">No ingredients found for the planned meals this week, or ingredients could not be processed.</p>
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
                        title={item.originalLines.join('\n')} 
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