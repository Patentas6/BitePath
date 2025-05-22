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
  'fluid ounces', 'fluid ounce', 'fl oz', 'ounces', 'ounce', 'oz', // Note: "oz" is ambiguous, handled by specific lists below
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

const COUNTABLE_UNITS_KEYWORDS: ReadonlyArray<string> = [ // For ingredient names or units that imply direct count
  'egg', 'eggs', 'clove', 'cloves', 'can', 'cans', 'bottle', 'bottles', 'head', 'heads',
  'bunch', 'bunches', 'stalk', 'stalks', 'sprig', 'sprigs', 'slice', 'slices',
  'piece', 'pieces', 'fillet', 'fillets', 'breast', 'breasts', 'thigh', 'thighs',
  'link', 'links', 'sheet', 'sheets', 'bar', 'bars', 'loaf', 'loaves', 'bulb', 'bulbs', 'ear', 'ears'
];

const IMPLICITLY_COUNTABLE_INGREDIENTS_ENDINGS: ReadonlyArray<string> = [ // If no unit, these names imply countability
  'apple', 'apples', 'potato', 'potatoes', 'onion', 'onions', 'carrot', 'carrots', 'tomato', 'tomatoes',
  'lemon', 'lemons', 'lime', 'limes', 'banana', 'bananas', 'pepper', 'peppers', // For bell peppers etc.
  'zucchini', 'zucchinis', 'cucumber', 'cucumbers', 'mushroom', 'mushrooms', 
  'radish', 'radishes', 'beet', 'beets', 'orange', 'oranges', 'pear', 'pears', 'peach', 'peaches', 'plum', 'plums'
];

// Units whose quantities should be summed up (e.g., "Chicken: 700g")
const SUMMABLE_WEIGHT_MASS_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", 
  "kg", "kgs", "kilogram", "kilograms", 
  "lb", "lbs", "pound", "pounds",
  "oz", "ounce", "ounces" // Assuming "oz" here refers to weight
];

// Units where we just display the ingredient name (e.g., "Flour", "Salt")
const DISPLAY_NAME_ONLY_UNITS: ReadonlyArray<string> = [
  "cup", "cups", 
  "tsp", "teaspoon", "teaspoons", 
  "tbsp", "tablespoon", "tablespoons",
  "ml", "milliliter", "milliliters", 
  "l", "liter", "liters",
  "fl oz", "fluid ounce", "fluid ounces", // Explicit fluid oz
  "pinch", "pinches", "dash", "dashes"
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

  const rangeRegex = /^\s*(\d+(?:[\.\/]\d+)?)\s*-\s*(\d+(?:[\.\/]\d+)?)\s*/;
  const rangeMatch = ingredientPart.match(rangeRegex);
  let match; 

  if (rangeMatch) {
    const num1 = smartParseFloat(rangeMatch[1]);
    const num2 = smartParseFloat(rangeMatch[2]);
    if (num1 !== null && num2 !== null) {
      quantity = Math.max(num1, num2); 
      ingredientPart = ingredientPart.substring(rangeMatch[0].length); 
      const unitAfterRangeRegex = /^\s*([a-zA-Z]+(?:\s+[a-zA-Z]+){0,1})?\s*(.*)/;
      const unitMatch = ingredientPart.match(unitAfterRangeRegex);
      if (unitMatch) {
          const potentialUnit = unitMatch[1]?.trim();
          if (potentialUnit && UNITS_AND_ADJECTIVES.includes(potentialUnit)) {
              extractedUnit = potentialUnit;
              ingredientPart = unitMatch[2]?.trim() || "";
          } else {
              ingredientPart = unitMatch[0]?.trim(); 
          }
      }
    }
  } else {
    const singleNumRegex = /^\s*(\d+(?:[\.\/]\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+){0,1})?\s*(.*)/;
    match = ingredientPart.match(singleNumRegex);
    if (match) {
      const numStr = match[1];
      const potentialUnit = match[2]?.trim();
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
  }

  if (quantity === null) {
    const trailingRegex = /^(.*?)\s+(\d+(?:[\.\/]\d+)?)\s*([a-zA-Z]+)?\s*$/;
    match = ingredientPart.match(trailingRegex);
    if (match) {
      const numStr = match[2];
      const potentialUnit = match[3]?.trim();
      const namePart = match[1]?.trim();
      const tempQty = smartParseFloat(numStr);
      if (tempQty !== null) {
        quantity = tempQty;
        extractedUnit = potentialUnit || null; 
        ingredientPart = namePart || "";
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
        if (extractedUnit && adj.toLowerCase() === extractedUnit.toLowerCase()) continue;
        currentName = currentName.substring(adj.length + 1).trim();
        changed = true;
        break;
      }
      if (currentName.endsWith(" " + adj)) {
         if (extractedUnit && adj.toLowerCase() === extractedUnit.toLowerCase()) continue;
        currentName = currentName.substring(0, currentName.length - (adj.length + 1)).trim();
        changed = true;
        break;
      }
    }
  } while (changed);
  
  let normalizedName = currentName.trim();

  const commonIrregularPlurals: {[key: string]: string} = { 'potatoes': 'potato', 'tomatoes': 'tomato', 'leaves': 'leaf', 'loaves': 'loaf', 'knives': 'knife', 'lives': 'life', 'shelves': 'shelf', 'wolves': 'wolf', 'elves': 'elf' };
  if (commonIrregularPlurals[normalizedName]) {
      normalizedName = commonIrregularPlurals[normalizedName];
  } else if (normalizedName.endsWith('ies') && normalizedName.length > 3) {
      normalizedName = normalizedName.slice(0, -3) + 'y';
  } else if (normalizedName.endsWith('s') && !normalizedName.endsWith('ss') && !['gas', 'bus', 'lens', 'series', 'species', 'molasses', 'hummus', 'cress'].includes(normalizedName) && normalizedName.length > 1) {
      normalizedName = normalizedName.slice(0, -1);
  }

  normalizedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
  if (normalizedName.length === 0 && originalLine.length > 0) {
    normalizedName = originalLine.charAt(0).toUpperCase() + originalLine.slice(1);
  } else if (normalizedName.length === 0) {
    normalizedName = "Unknown ingredient";
  }
  
  let isCountable = false;
  if (quantity !== null) {
    const unitLC = (extractedUnit || "").toLowerCase();
    const nameLC = normalizedName.toLowerCase();

    if (SUMMABLE_WEIGHT_MASS_UNITS.includes(unitLC)) {
      isCountable = true;
    } else if (DISPLAY_NAME_ONLY_UNITS.includes(unitLC)) {
      isCountable = false; 
    } else {
      // Default logic if unit doesn't strongly dictate countability
      if (nameLC === "black pepper" || nameLC === "white pepper" || nameLC === "cayenne pepper" || nameLC === "ground pepper" || nameLC === "chilli powder" || nameLC === "curry powder" || nameLC === "paprika" || nameLC === "salt") {
        isCountable = false; 
      } else if (COUNTABLE_UNITS_KEYWORDS.some(kw => unitLC.includes(kw) || nameLC.includes(kw))) {
        isCountable = true;
      } else if (IMPLICITLY_COUNTABLE_INGREDIENTS_ENDINGS.some(ending => nameLC.endsWith(ending))) {
        isCountable = true;
      }
      // If none of the above, isCountable remains false (default from initialization)
    }
  }

  return { normalizedName, quantity, unit: extractedUnit, isCountable, originalLine };
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
    
    const ingredientMap = new Map<string, { name: string; totalQuantity: number; unit: string | null; isCountable: boolean; originalLines: string[] }>();

    plannedMeals.forEach(pm => {
      const ingredientsBlock = pm.meals?.ingredients;
      if (ingredientsBlock) {
        ingredientsBlock.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          const parsed = parseIngredientLine(trimmedLine);
          
          const existing = ingredientMap.get(parsed.normalizedName);
          if (existing) {
            // If this new parsed entry uses a unit that makes it non-countable for display sum,
            // then the aggregated item becomes non-countable for display sum.
            if (parsed.unit && DISPLAY_NAME_ONLY_UNITS.includes(parsed.unit.toLowerCase())) {
              existing.isCountable = false;
              existing.totalQuantity = 0; 
            } else if (parsed.isCountable && parsed.quantity !== null) {
              // Only add to quantity if the existing item is still considered countable
              if (existing.isCountable) {
                existing.totalQuantity += parsed.quantity;
              } else {
                // If existing was not countable, but this parsed one is (and not overridden by unit type)
                // make it countable and start sum.
                existing.isCountable = true;
                existing.totalQuantity = parsed.quantity;
              }
            }
            // If parsed is countable and existing was not, and existing hasn't been forced non-countable by unit:
            // This logic is now more integrated: if existing.isCountable is false, the above block handles it.

            if (!existing.unit && parsed.unit) existing.unit = parsed.unit; // Try to retain a unit
            existing.originalLines.push(trimmedLine);
          } else { // New entry
            ingredientMap.set(parsed.normalizedName, {
              name: parsed.normalizedName,
              totalQuantity: (parsed.isCountable && parsed.quantity !== null) ? parsed.quantity : 0,
              unit: parsed.unit,
              isCountable: parsed.isCountable,
              originalLines: [trimmedLine]
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
      if (item.isCountable && item.totalQuantity > 0) {
        const displayTotalQuantity = item.totalQuantity % 1 === 0 ? item.totalQuantity : item.totalQuantity.toFixed(1);
        let displayUnitText = item.unit || "";

        if (item.totalQuantity > 1 && displayUnitText && !displayUnitText.endsWith('s') && !DISPLAY_NAME_ONLY_UNITS.includes(displayUnitText.toLowerCase()) && !SUMMABLE_WEIGHT_MASS_UNITS.includes(displayUnitText.toLowerCase())) {
            // Basic pluralization for units not in specific lists (e.g. "clove" -> "cloves")
            if (displayUnitText.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(displayUnitText)) { 
                displayUnitText = displayUnitText.slice(0, -1) + 'ies';
            } else if (displayUnitText.length > 0) {
                displayUnitText += 's';
            }
        } else if (SUMMABLE_WEIGHT_MASS_UNITS.includes(displayUnitText.toLowerCase()) && item.totalQuantity > 1 && displayUnitText.length > 0 && !displayUnitText.endsWith('s')) {
            // Pluralize summable weight units if not already, e.g. "gram" -> "grams"
             if (displayUnitText.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(displayUnitText)) { 
                displayUnitText = displayUnitText.slice(0, -1) + 'ies';
             } else {
                displayUnitText += 's';
             }
        }
        
        if (!item.unit && item.name) { 
           let nameForDisplay = item.name;
           if (item.totalQuantity > 1 && !nameForDisplay.endsWith('s') && !nameForDisplay.endsWith('es')) {
             if (nameForDisplay.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(nameForDisplay)) {
                nameForDisplay = nameForDisplay.slice(0,-1) + "ies";
             } else {
                nameForDisplay += "s";
             }
           }
           displayText = `${nameForDisplay}: ${displayTotalQuantity}`;
        } else {
           displayText = `${item.name}: ${displayTotalQuantity}${displayUnitText ? ' ' + displayUnitText : ''}`.trim();
        }
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