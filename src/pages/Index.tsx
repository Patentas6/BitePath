import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, startOfToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMemo } from "react";
import { convertToPreferredSystem } from "@/utils/conversionUtils"; // Import conversion utility
import { ListChecks, ShoppingCart, Utensils } from "lucide-react"; // Import icons

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


const Index = () => {
   const today = startOfToday();
   const todayStr = format(today, 'yyyy-MM-dd');

   const { data: todayMealPlans, isLoading: isLoadingTodayMeals, error: todayMealsError } = useQuery<PlannedMealWithDetails[]>({
     queryKey: ["todayMealPlans", todayStr],
     queryFn: async () => {
       // This page is not protected, so we need to check if a user is logged in
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return []; // Return empty array if no user

       const { data, error } = await supabase
         .from("meal_plans")
         .select("meal_type, meals ( name, ingredients )")
         .eq("user_id", user.id)
         .eq("plan_date", todayStr);

       if (error) {
         console.error("Error fetching today's meal plans:", error);
         throw error; // Throw to let react-query handle the error state
       }
       return data || [];
     },
     // Only enable this query if a user is logged in (check happens inside queryFn)
     // We don't need to explicitly check here because the queryFn handles the empty case
   });

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
         } catch (e) { console.warn("[Index.tsx] Failed to parse ingredients JSON for today's list:", ingredientsBlock, e); }
       }
     });
     return Array.from(ingredientMap.values());
   }, [todayMealPlans]);

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
         detailsPart = aggItem.originalItems.map(orig => {
           let q = orig.quantity;
           let u = orig.unit;
           // No metric conversion for home page preview
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


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="w-full p-4 bg-background shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              className="text-2xl font-bold group"
            >
              <span className="text-accent dark:text-foreground transition-opacity duration-150 ease-in-out group-hover:opacity-80">Bite</span>
              <span className="text-primary dark:text-primary transition-opacity duration-150 ease-in-out group-hover:opacity-80">Path</span>
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#pricing" className="hover:underline">Pricing</a>
            <a href="#testimonials" className="hover:underline">Testimonials</a>
            <Link to="/auth" className="hover:underline">Login</Link>
            <Button
              size="sm"
              variant="default"
              asChild
            >
              <Link to="/auth?mode=signup"><span>Sign Up</span></Link>
            </Button>
            <ThemeToggleButton />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-20 text-center bg-gradient-to-r from-primary/20 to-accent/20 dark:from-green-900/30 dark:to-blue-900/30">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Ditch the Dinner Dilemma. Embrace the BitePath.
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            Plan your week in minutes and get an instant grocery list. Less stress, more delicious meals.
          </p>
          <Button size="lg" asChild>
            <Link to="/auth?mode=signup"><span>Start Planning for Free</span></Link>
          </Button>
        </div>
      </section>

      {/* Today's Preview Section */}
      <section className="w-full py-16 bg-background">
         <div className="container mx-auto px-4">
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


      {/* Features Section Placeholder */}
      <section id="features" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> {/* Adjusted grid for responsiveness */}
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">Minimalist Planning</h3>
              <p className="text-muted-foreground">Easily place meals onto your weekly calendar.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">Automated Grocery Lists</h3>
              <p className="text-muted-foreground">Get a simple, consolidated list generated instantly from your plan.</p>
            </div>
            <div className="p-6 border rounded-lg shadow-sm dark:border-gray-700 bg-card">
              <h3 className="text-xl font-semibold mb-2">Saves Time & Reduces Stress</h3>
              <p className="text-muted-foreground">Spend less time deciding what to eat and what to buy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section Placeholder */}
      <section id="testimonials" className="w-full py-16 bg-background text-center"> {/* Reverted section to bg-background */}
        <div className="container mx-auto px-4">
          {/* Added inner div styled as a card */}
          <div className="bg-card p-8 border rounded-lg shadow-sm dark:border-gray-700 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">What Our Users Say</h2>
            <p className="text-muted-foreground">Testimonials coming soon!</p>
            {/* Future testimonial items would go inside this box */}
          </div>
        </div>
      </section>

      {/* Pricing Section Placeholder */}
      <section id="pricing" className="w-full py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Simple Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto"> {/* Adjusted grid for responsiveness */}
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700 bg-card">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <p className="text-muted-foreground mb-4">Limited features to get you started.</p>
              <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Basic planning</li>
                <li>✓ Limited meal library</li>
                <li>✓ Grocery list generation</li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth?mode=signup"><span>Sign Up for Free</span></Link>
              </Button>
            </div>
            <div className="p-6 border rounded-lg shadow-sm flex flex-col dark:border-gray-700 bg-card">
              <h3 className="text-2xl font-bold mb-4">Premium</h3>
              <p className="text-muted-foreground mb-4">Unlock full potential.</p>
               <ul className="text-left text-muted-foreground mb-6 flex-grow">
                <li>✓ Unlimited planning</li>
                <li>✓ Unlimited meal library</li>
                <li>✓ Advanced grocery list</li>
                <li>✓ Priority support</li>
              </ul>
              <Button className="w-full"><span>Go Premium</span></Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full py-8 bg-gray-800 text-white text-center dark:bg-black">
        <div className="container mx-auto px-4">
          <p>&copy; 2025 BitePath. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;