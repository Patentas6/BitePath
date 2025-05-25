import { useEffect, useState, useMemo } from "react"; // Import useMemo
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { UserCircle, BookOpenText, Brain, SquarePen, CalendarDays, Utensils, ListChecks, ShoppingCart } from "lucide-react"; // Import icons
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { format, startOfToday } from "date-fns"; // Import date-fns
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { convertToPreferredSystem } from "@/utils/conversionUtils"; // Import conversion utility

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

// Define types for today's meal plans and ingredients (copied from Index.tsx)
interface PlannedMealWithDetails {
  plan_date: string;
  meal_type?: string;
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


const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');


  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    };
    getSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });
    return () => authListener?.subscription.unsubscribe();
  }, [navigate]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useQuery<UserProfile | null>({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch today's meal plans for the preview
  const { data: todayMealPlans, isLoading: isLoadingTodayMeals, error: todayMealsError } = useQuery<PlannedMealWithDetails[]>({
    queryKey: ["todayMealPlans", user?.id, todayStr], // Add user?.id to query key
    queryFn: async () => {
      if (!user?.id) return []; // Only fetch if user is logged in
      const { data, error } = await supabase
        .from("meal_plans")
        .select("meal_type, meals ( name, ingredients )")
        .eq("user_id", user.id)
        .eq("plan_date", todayStr);

      if (error) {
        console.error("Error fetching today's meal plans:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id, // Enable query only when user is available
  });

  // Aggregate ingredients for today's grocery list preview (copied from Index.tsx)
  const todayAggregatedIngredients = useMemo(() => {
    if (!todayMealPlans) return [];

    const ingredientMap = new Map<string, GroceryListItem>();
    todayMealPlans.forEach(pm => {
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
        } catch (e) { console.warn("[Dashboard.tsx] Failed to parse ingredients JSON for today's list:", ingredientsBlock, e); }
      }
    });
    return Array.from(ingredientMap.values());
  }, [todayMealPlans]);

  // Categorize and format ingredients for display (copied from Index.tsx)
  const todayCategorizedDisplayList = useMemo(() => {
    const grouped: Record<Category, CategorizedDisplayListItem[]> =
      categoryOrder.reduce((acc, cat) => { acc[cat] = []; return acc; }, {} as Record<Category, CategorizedDisplayListItem[]>);

    todayAggregatedIngredients.forEach(aggItem => {
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

      // For the home page preview, let's just show original units for simplicity
      // If metric conversion is desired here, the logic from GroceryList would be needed
      currentQuantity = aggItem.totalQuantity;
      currentUnit = aggItem.unit || "";


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
         // For non-summable, show original items details
         detailsPart = aggItem.originalItems.map(orig => {
           let q = orig.quantity;
           let u = orig.unit;
           // No metric conversion for dashboard preview
           if (PIECE_UNITS.includes(orig.unit.toLowerCase())) return `${q}`;
           return `${q} ${u}`;
         }).join('; ');
         detailsClass = "text-gray-500 dark:text-gray-400";
       }


      const uniqueKey = `${itemName}:${detailsPart}-${foundCategory}-imperial`; // Use imperial as key suffix for simplicity
      const originalItemsTooltip = aggItem.originalItems.map(oi => `${oi.quantity} ${oi.unit} ${oi.name}${oi.description ? ` (${oi.description})` : ''}`).join('\n');

      if (detailsPart.trim() !== "" || itemName.trim() !== "") {
        grouped[foundCategory].push({ itemName, itemNameClass, detailsPart, detailsClass, originalItemsTooltip, uniqueKey });
      }
    });
    return grouped;
  }, [todayAggregatedIngredients]);

  const isTodayListEmpty = Object.values(todayCategorizedDisplayList).every(list => list.length === 0);


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getWelcomeMessage = () => {
    if (!user) return "Loading...";
    if (isUserProfileLoading && !userProfile) return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
    if (userProfile) {
      const { first_name, last_name } = userProfile;
      if (first_name && last_name) return `Welcome, ${first_name} ${last_name}!`;
      if (first_name) return `Welcome, ${first_name}!`;
      if (last_name) return `Welcome, ${last_name}!`;
    }
    return `Welcome, ${user.email ? user.email.split('@')[0] : 'User'}!`;
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading user session...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="container mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link to="/" className="text-2xl font-bold group">
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
            <ThemeToggleButton />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-base hidden md:inline">{getWelcomeMessage()}</span>
            {/* Navigation Links in new order */}
            <Button variant="default" size="sm" asChild>
              <Link to="/meals"><BookOpenText className="mr-2 h-4 w-4" /> My Meals</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/generate-meal"><Brain className="mr-2 h-4 w-4" /> Generate Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/add-meal"><SquarePen className="mr-2 h-4 w-4" /> Add Own Meal</Link>
            </Button>
             <Button variant="default" size="sm" asChild>
              <Link to="/profile"><CalendarDays className="mr-2 h-4 w-4" /> Weekly Plan</Link> {/* Link to Profile page */}
            </Button>
            {/* Profile link removed from main nav */}
            <Button onClick={handleLogout} variant="destructive" size="sm">Logout</Button>
          </div>
        </header>

        {/* Today's Preview Section - ADDED */}
        <section className="w-full py-8 bg-background"> {/* Adjusted padding */}
           <div className="container mx-auto px-0"> {/* Removed horizontal padding */}
              <h2 className="text-3xl font-bold text-center mb-8">Today's Plan & Groceries</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Today's Meals */}
                 <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                       <CardTitle className="flex items-center"><Utensils className="mr-2 h-5 w-5" /> Meals for {format(today, 'EEEE, MMM dd')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {isLoadingTodayMeals ? (
                          <Skeleton className="h-20 w-full" />
                       ) : todayMealsError ? (
                          <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load today's meals.</AlertDescription></Alert>
                       ) : todayMealPlans && todayMealPlans.length > 0 ? (
                          <ul className="space-y-2">
                             {todayMealPlans.map(plan => (
                                <li key={plan.meals?.name || 'unknown'} className="text-muted-foreground">
                                   <span className="font-semibold text-foreground">{plan.meal_type || 'Meal'}:</span> {plan.meals?.name || 'Unknown Meal'}
                                </li>
                             ))}
                          </ul>
                       ) : (
                          <div className="text-center text-muted-foreground">
                             <p className="text-lg font-semibold mb-1">No Meals Planned</p>
                             <p className="text-sm">Plan your meals for today on the <Link to="/profile" className="underline">Weekly Plan</Link> page.</p>
                          </div>
                       )}
                    </CardContent>
                 </Card>

                 {/* Today's Grocery List */}
                 <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                       <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Groceries for Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {isLoadingTodayMeals ? ( // Use same loading state as meals
                          <Skeleton className="h-20 w-full" />
                       ) : todayMealsError ? ( // Use same error state as meals
                          <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load today's groceries.</AlertDescription></Alert>
                       ) : isTodayListEmpty ? (
                          <div className="text-center text-muted-foreground">
                             <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                             <p className="text-lg font-semibold mb-1">Your List is Empty</p>
                             <p className="text-sm">Plan meals for today to see ingredients here.</p>
                          </div>
                       ) : (
                          <div className="space-y-4">
                             {categoryOrder.map(category => {
                               const itemsInCategory = todayCategorizedDisplayList[category];
                               if (itemsInCategory && itemsInCategory.length > 0) {
                                 return (
                                   <div key={category}>
                                     <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">
                                       {category}
                                     </h3>
                                     <ul className="space-y-1 text-sm text-muted-foreground">
                                       {itemsInCategory.map((item) => (
                                         <li key={item.uniqueKey} title={item.originalItemsTooltip}>
                                           <span className={item.itemNameClass}>{item.itemName}: </span>
                                           {item.detailsPart && <span className={item.detailsClass}>{item.detailsPart}</span>}
                                         </li>
                                       ))}
                                     </ul>
                                   </div>
                                 );
                               }
                               return null;
                             })}
                          </div>
                       )}
                    </CardContent>
                 </Card>
              </div>
           </div>
        </section>

      </div>
    </div>
  );
};

export default Dashboard;