import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, addDays, parseISO, startOfToday } from "date-fns"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListChecks, ShoppingCart, PlusCircle, Info } from "lucide-react";
import { convertToPreferredSystem, ConvertedIngredient } from "@/utils/conversionUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ManualAddItemForm from "./ManualAddItemForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import convert from 'convert-units';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


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
  mealName?: string; // Added for tracking origin
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
  isManual: boolean;
}

const PIECE_UNITS: ReadonlyArray<string> = ['piece', 'pieces', 'item', 'items', 'unit', 'units', 'clove', 'cloves', 'slice', 'slices', 'sprig', 'sprigs', 'head', 'heads', 'bunch', 'bunches', 'can', 'cans', 'bottle', 'bottles', 'package', 'packages'];
const SPICE_MEASUREMENT_UNITS: ReadonlyArray<string> = ['tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'pinch', 'pinches', 'dash', 'dashes'];


// Helper to convert to a base unit for aggregation
const convertToAggregationBaseUnit = (quantity: number, unit: string): { quantity: number, baseUnit: string, originalUnit: string } | null => {
  const u = unit.toLowerCase().trim();
  try {
    const description = convert().describe(u);
    if (description.measure === 'mass') {
      return { quantity: convert(quantity).from(u as convert.Unit).to('g'), baseUnit: 'g', originalUnit: unit };
    }
    if (description.measure === 'volume') {
      return { quantity: convert(quantity).from(u as convert.Unit).to('ml'), baseUnit: 'ml', originalUnit: unit };
    }
    // For count-based units or units not in mass/volume (like 'piece', 'item')
    if (PIECE_UNITS.includes(u) || SPICE_MEASUREMENT_UNITS.includes(u) || u === 'to taste' || u === '') {
       return { quantity, baseUnit: u, originalUnit: unit };
    }
  } catch (e) {
    // If unit is not recognized by convert-units, or not mass/volume
    // console.warn(`Unit ${u} not directly convertible for aggregation, treating as discrete.`);
  }
  // Default: return as is, unit becomes the baseUnit (treated as a discrete unit type)
  return { quantity, baseUnit: u, originalUnit: unit };
};


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

  const aggregatedGroceryList = useMemo((): AggregatedDisplayListItem[] => {
    if (!plannedMealsData) return [];

    const aggregatedMap = new Map<string, {
      name: string;
      totalQuantity: number;
      baseUnit: string; // e.g., 'g', 'ml', or the original unit if not convertible
      originalItems: Array<{ mealName: string; quantity: number; unit: string; description?: string }>;
    }>();

    plannedMealsData.forEach(pm => {
      if (!pm.meals || !pm.meals.ingredients) return;
      try {
        const parsedIngredients: ParsedIngredientItem[] = JSON.parse(pm.meals.ingredients);
        parsedIngredients.forEach(ing => {
          if (!ing.name || ing.name.trim() === "") return;

          const quantityNum = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : Number(ing.quantity);
          if (ing.quantity !== null && ing.quantity !== undefined && isNaN(quantityNum)) return; // Skip if quantity is invalid

          const aggregationUnitInfo = (ing.unit && quantityNum > 0) 
            ? convertToAggregationBaseUnit(quantityNum, ing.unit)
            : { quantity: quantityNum ?? 0, baseUnit: ing.unit?.toLowerCase().trim() || (ing.description?.toLowerCase() === 'to taste' ? 'to taste' : 'unitless'), originalUnit: ing.unit || '' };
          
          if (!aggregationUnitInfo) return; // Should not happen with current logic but good for safety

          const normalizedName = ing.name.trim().toLowerCase();
          // Key uses baseUnit for aggregation, or 'to taste' / 'unitless' if applicable
          const aggKey = `${normalizedName}:${aggregationUnitInfo.baseUnit}`;

          const current = aggregatedMap.get(aggKey);
          if (current) {
            current.totalQuantity += aggregationUnitInfo.quantity;
            current.originalItems.push({ mealName: pm.meals!.name, quantity: quantityNum, unit: ing.unit || '', description: ing.description });
          } else {
            aggregatedMap.set(aggKey, {
              name: ing.name.trim(), // Keep original casing for display name
              totalQuantity: aggregationUnitInfo.quantity,
              baseUnit: aggregationUnitInfo.baseUnit,
              originalItems: [{ mealName: pm.meals!.name, quantity: quantityNum, unit: ing.unit || '', description: ing.description }],
            });
          }
        });
      } catch (e) {
        console.warn("Error parsing ingredients for aggregation:", e, "Meal:", pm.meals.name, "Ingredients:", pm.meals.ingredients);
      }
    });
    
    const displayList: AggregatedDisplayListItem[] = [];
    aggregatedMap.forEach((item) => {
      let detailsPartStr = "";
      let itemDetailsClass = "text-foreground";
      const uniqueKey = `agg:${item.name.toLowerCase().trim()}:${item.baseUnit}`;

      if (item.baseUnit === 'to taste') {
        detailsPartStr = "to taste";
        itemDetailsClass = "text-gray-500 dark:text-gray-400";
      } else if (item.totalQuantity > 0 && item.baseUnit !== 'unitless') {
        const convertedForDisplay = convertToPreferredSystem(item.totalQuantity, item.baseUnit, displaySystem);
        let displayQuantity = convertedForDisplay ? convertedForDisplay.quantity : item.totalQuantity;
        let displayUnit = convertedForDisplay ? convertedForDisplay.unit : item.baseUnit;

        // Smart unit display (e.g., 1500g -> 1.5kg)
        if (displayUnit === 'g' && displayQuantity >= 1000) {
          displayQuantity /= 1000;
          displayUnit = 'kg';
        } else if (displayUnit === 'ml' && displayQuantity >= 1000) {
          displayQuantity /= 1000;
          displayUnit = 'L';
        } else if (displayUnit === 'tsp' && displayQuantity >= 3) {
            // Optional: convert tsp to tbsp if displaySystem is imperial and quantity is high enough
            // For now, keeping it simpler.
        }
        
        const roundedDisplayQty = (displayQuantity % 1 === 0) ? Math.round(displayQuantity) : parseFloat(displayQuantity.toFixed(1));
        
        let unitStr = displayUnit;
        if (roundedDisplayQty !== 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && !unitStr.endsWith('s') && unitStr.length > 0 && unitStr !== 'to taste' && unitStr !== 'unitless') {
            if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
                unitStr = unitStr.slice(0, -1) + 'ies';
            } else { unitStr += "s"; }
        }
        detailsPartStr = `${roundedDisplayQty} ${unitStr}`;
        if (SPICE_MEASUREMENT_UNITS.includes(item.baseUnit.toLowerCase())) {
          itemDetailsClass = "text-gray-500 dark:text-gray-400";
        }
      } else if (item.totalQuantity > 0 && item.baseUnit === 'unitless') {
        detailsPartStr = `${item.totalQuantity}`; // Just show quantity for unitless items
      }


      const originalItemsTooltip = item.originalItems.map(orig => 
        `${orig.quantity ?? ''} ${orig.unit || ''} ${orig.description ? `(${orig.description})` : ''} (from: ${orig.mealName})`
      ).join('\n');

      displayList.push({
        itemName: item.name,
        itemNameClass: "text-foreground",
        detailsPart: detailsPartStr,
        detailsClass: itemDetailsClass,
        originalItemsTooltip,
        uniqueKey,
        isManual: false,
      });
    });
    
    // Add manual items
    manualItems.forEach(manual => {
      const uniqueKey = `manual:${manual.id}`;
      let detailsPartStr = "";
      let itemDetailsClass = "text-foreground";
      const quantityNum = parseFloat(manual.quantity);

      if (!isNaN(quantityNum) && manual.unit) {
        const convertedForDisplay = convertToPreferredSystem(quantityNum, manual.unit, displaySystem);
        let displayQuantity = convertedForDisplay ? convertedForDisplay.quantity : quantityNum;
        let displayUnit = convertedForDisplay ? convertedForDisplay.unit : manual.unit;

        if (displayUnit === 'g' && displayQuantity >= 1000) {
          displayQuantity /= 1000;
          displayUnit = 'kg';
        } else if (displayUnit === 'ml' && displayQuantity >= 1000) {
          displayQuantity /= 1000;
          displayUnit = 'L';
        }
        const roundedDisplayQty = (displayQuantity % 1 === 0) ? Math.round(displayQuantity) : parseFloat(displayQuantity.toFixed(1));
        let unitStr = displayUnit;
         if (roundedDisplayQty !== 1 && !['L', 'ml', 'g', 'kg'].includes(unitStr) && !unitStr.endsWith('s') && unitStr.length > 0) {
            if (unitStr.endsWith('y') && !['day', 'key', 'way', 'toy', 'boy', 'guy'].includes(unitStr.toLowerCase())) {
                unitStr = unitStr.slice(0, -1) + 'ies';
            } else { unitStr += "s"; }
        }
        detailsPartStr = `${roundedDisplayQty} ${unitStr}`;
      } else if (!isNaN(quantityNum)) {
        detailsPartStr = `${quantityNum}`;
      } else if (manual.unit) {
        detailsPartStr = manual.unit;
      }


      displayList.push({
        itemName: manual.name,
        itemNameClass: "text-foreground font-medium", // Differentiate manual items slightly
        detailsPart: detailsPartStr,
        detailsClass: itemDetailsClass,
        originalItemsTooltip: "Manually added item",
        uniqueKey,
        isManual: true,
      });
    });

    return displayList.sort((a, b) => {
      if (a.isManual && !b.isManual) return 1;
      if (!a.isManual && b.isManual) return -1;
      return a.itemName.localeCompare(b.itemName);
    });

  }, [plannedMealsData, displaySystem, manualItems]);


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SHARED_LOCAL_STORAGE_KEY) {
        const newGlobalValue = event.newValue;
        const newGlobalStruckItems = newGlobalValue ? new Set<string>(JSON.parse(newGlobalValue)) : new Set<string>();
        const currentDisplayKeys = new Set(aggregatedGroceryList.map(item => item.uniqueKey));
        setStruckItems(prevLocalStruckItems => {
          const updatedLocalStruckItems = new Set<string>();
          newGlobalStruckItems.forEach(key => {
            if (currentDisplayKeys.has(key)) updatedLocalStruckItems.add(key);
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
  }, [aggregatedGroceryList]);

  useEffect(() => {
    const currentDisplayKeys = new Set(aggregatedGroceryList.map(item => item.uniqueKey));
    const globalRaw = localStorage.getItem(SHARED_LOCAL_STORAGE_KEY);
    const globalStruckItems = globalRaw ? new Set<string>(JSON.parse(globalRaw)) : new Set<string>();
    const newRelevantStruckItems = new Set<string>();
    globalStruckItems.forEach(key => {
      if (currentDisplayKeys.has(key)) newRelevantStruckItems.add(key);
    });
    setStruckItems(prevLocalStruckItems => {
      if (newRelevantStruckItems.size !== prevLocalStruckItems.size || !Array.from(prevLocalStruckItems).every(key => newRelevantStruckItems.has(key))) {
        return newRelevantStruckItems;
      }
      return prevLocalStruckItems;
    });
  }, [aggregatedGroceryList, userId, selectedDays, displaySystem, today]);

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

  const isEmptyList = aggregatedGroceryList.length === 0;

  return (
    <TooltipProvider>
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
             </div>
           </div>

          {isEmptyList ? (
            <div className="text-center py-6 text-muted-foreground">
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold mb-1">Your List is Empty</p>
              <p className="text-sm">Plan some meals or add items manually to see them here.</p>
            </div>
          ) : (
            <ul className="space-y-1 text-sm pl-2">
              {aggregatedGroceryList.map((item) => (
                <Tooltip key={item.uniqueKey} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <li
                      onClick={() => handleItemClick(item.uniqueKey)}
                      className={cn(
                        "cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex justify-between items-center",
                        struckItems.has(item.uniqueKey) && "line-through text-gray-400 dark:text-gray-600"
                      )}
                    >
                      <div>
                        <span className={cn(item.itemNameClass, item.isManual && "italic")}>{item.itemName}</span>
                        {item.detailsPart && <span className={cn("ml-1", item.detailsClass)}>{item.detailsPart}</span>}
                      </div>
                      {!item.isManual && item.originalItemsTooltip && (
                        <Info size={14} className="ml-2 text-muted-foreground/70 shrink-0" />
                      )}
                    </li>
                  </TooltipTrigger>
                  {!item.isManual && item.originalItemsTooltip && (
                    <TooltipContent side="top" align="start" className="max-w-xs whitespace-pre-line bg-background border text-foreground p-2 rounded-md shadow-lg text-xs">
                      <p className="font-semibold mb-1">From meals:</p>
                      {item.originalItemsTooltip}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </ul>
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
    </TooltipProvider>
  );
};

export default GroceryList;