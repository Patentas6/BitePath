tags around buttons with asChild prop to fix React.Children.only error.">
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
   // Removed today's meal and grocery list logic

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
            {/* Removed outer <a> tag */}
            <Link to="/auth" className="hover:underline">Login</Link>
            {/* Removed outer <a> tag */}
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

      {/* Today's Preview Section - REMOVED */}


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