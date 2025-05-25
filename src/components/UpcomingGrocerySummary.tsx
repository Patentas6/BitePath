import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, addDays, startOfToday, parseISO, isBefore, isAfter } from "date-fns";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShoppingCart } from "lucide-react";
import { convertToPreferredSystem } from "@/utils/conversionUtils"; // Reuse conversion logic

interface PlannedMealWithIngredients {
  plan_date: string;
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

// Re-defining these constants locally or importing if they were in a shared file
const SUMMABLE_UNITS: ReadonlyArray<string> = [
  "g", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
  "lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces",
  "ml", "milliliter", "milliliters", "l", "liter", "liters",
  "piece", "pieces", "can", "cans", "bottle", "bottles", "package", "packages",
  "slice", "slices", "item", "items", "clove", "cloves", "sprig", "sprigs",
  "head", "heads", "bunch", "bunches"
];

const NON_SUMMABLE_DISPLAY_UNITS: ReadonlyArray<string> = [
  "cup", "cups",
  "tsp", "teaspoon", "teaspoons",
  "tbsp", "tablespoon", "tablespoons", "pinch", "pinches", "dash", "dashes"
];


interface UpcomingGrocerySummaryProps {
  userId: string;
  daysAhead?: number; // Number of days ahead to include (default 3)
}

const UpcomingGrocerySummary: React.FC<UpcomingGrocerySummaryProps> = ({ userId, daysAhead = 2 }) => { // Default to 2 days ahead, making it today + 2 = 3 days total
  const today = startOfToday();
  const endDate = addDays(today, daysAhead);
  const startDateStr = format(today, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: plannedMealsData, isLoading, error } = useQuery<PlannedMealWithIngredients[]>({
    queryKey: ["upcomingGrocerySource", userId, startDateStr, endDateStr],
    queryFn: async () => {
      if (!userId) return [];
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

  const aggregatedIngredients = useMemo(() => {
    if (!plannedMealsData) return [];

    const ingredientMap = new Map<string, { name: string; totalQuantity: number; unit: string | null; isSummable: boolean; originalItems: ParsedIngredientItem[] }>();

    plannedMealsData.forEach(pm => {
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
              const mapKey = normalizedName; // Simple key for aggregation

              const existing = ingredientMap.get(mapKey);

              if (existing) {
                 existing.originalItems.push(processedItem);
                 // Only sum if units are the same and are in the SUMMABLE_UNITS list
                 if (existing.isSummable && SUMMABLE_UNITS.includes(unitLower) && existing.unit?.toLowerCase() === unitLower) {
                    existing.totalQuantity += processedItem.quantity;
                 } else {
                    // If units don't match or not summable, mark the aggregated item as non-summable
                    existing.isSummable = false;
                 }
              } else {
                const isItemSummable = SUMMABLE_UNITS.includes(unitLower) && !NON_SUMMABLE_DISPLAY_UNITS.includes(unitLower);
                ingredientMap.set(mapKey, {
                  name: processedItem.name,
                  totalQuantity: processedItem.quantity,
                  unit: processedItem.unit,
                  isSummable: isItemSummable,
                  originalItems: [processedItem]
                });
              }
            });
          }
        } catch (e) { console.warn("[UpcomingGrocerySummary.tsx] Failed to parse ingredients JSON:", ingredientsBlock, e); }
      }
    });

    // Convert to display format, using Imperial by default for summary
    const displayList = Array.from(ingredientMap.values()).map(aggItem => {
        let displayQuantity = aggItem.totalQuantity;
        let displayUnit = aggItem.unit || "";

        // For summary, let's stick to original units or a simple count if not easily summable
        if (aggItem.isSummable && aggItem.unit) {
             // Use original unit for display if summable
             const roundedDisplayQty = (displayQuantity % 1 === 0) ? Math.round(displayQuantity) : parseFloat(displayQuantity.toFixed(1));
             let unitStr = displayUnit;
             // Simple pluralization for display
             if (roundedDisplayQty > 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && !unitStr.endsWith('s') && unitStr.length > 0) {
                if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
                   unitStr = unitStr.slice(0, -1) + 'ies';
                } else { unitStr += "s"; }
             }
             return `${aggItem.name}: ${roundedDisplayQty} ${unitStr}`;
        } else if (aggItem.originalItems.length > 0) {
            // For non-summable or mixed units, list the individual items concisely
            return `${aggItem.name}: ${aggItem.originalItems.map(oi => `${oi.quantity} ${oi.unit}`).join('; ')}`;
        }
        return aggItem.name; // Fallback
    }).filter(item => item.trim() !== ""); // Filter out any empty strings

    return displayList;

  }, [plannedMealsData]);


  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>Upcoming Groceries ({format(today, 'MMM dd')} - {format(endDate, 'MMM dd')})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching upcoming grocery data:", error);
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>Upcoming Groceries</CardTitle></CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not load upcoming grocery items.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isEmptyList = aggregatedIngredients.length === 0;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="flex items-center"><ShoppingCart className="mr-2 h-5 w-5" /> Upcoming Groceries ({format(today, 'MMM dd')} - {format(endDate, 'MMM dd')})</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmptyList ? (
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No ingredients needed for meals planned in the next {daysAhead + 1} days.</p>
            <p className="text-xs mt-1">Plan some meals using the Planner tab below!</p>
          </div>
        ) : (
          <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
            {aggregatedIngredients.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingGrocerySummary;