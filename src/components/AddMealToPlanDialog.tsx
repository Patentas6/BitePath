import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag, PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants";
import { parseFirstNumber } from "@/utils/mealUtils";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MealTextData {
  id: string;
  name: string;
  meal_tags?: string[] | null;
  servings?: string | null; 
}

interface MealImageData {
  id: string;
  image_url?: string | null;
}

interface MealWithImage extends MealTextData {
  image_url?: string | null;
}

interface AddMealToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planDate: Date | null;
  userId: string | null;
  initialMealType?: PlanningMealType | string | null;
  preSelectedMealId?: string; 
  preSelectedMealName?: string; 
  originalMealServings?: string | null | undefined; 
  onSaveSuccessCallback?: () => void; 
}

const AddMealToPlanDialog: React.FC<AddMealToPlanDialogProps> = ({
  open,
  onOpenChange,
  planDate,
  userId,
  initialMealType,
  preSelectedMealId,
  preSelectedMealName,
  originalMealServings,
  onSaveSuccessCallback,
}) => {
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(preSelectedMealId);
  const [selectedMealTypeForSaving, setSelectedMealTypeForSaving] = useState<PlanningMealType | undefined>(undefined);
  const [desiredServings, setDesiredServings] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<MealTag[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [processedMeals, setProcessedMeals] = useState<MealWithImage[]>([]);
  const queryClient = useQueryClient();

  const { data: mealsTextData, isLoading: isLoadingTextData, error: textDataError } = useQuery<MealTextData[]>({
    queryKey: ["userMealsTextOnlyWithServings", userId], 
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meal text data.");
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, meal_tags, servings") 
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open && !preSelectedMealId, 
  });

  const { data: mealsImageData, isLoading: isLoadingImageData, error: imageDataError } = useQuery<MealImageData[]>({
    queryKey: ["userMealImagesOnly", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meal image data.");
      const { data, error } = await supabase
        .from("meals")
        .select("id, image_url")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open && !preSelectedMealId && !isLoadingTextData && !!mealsTextData, 
  });
  
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedMealId(preSelectedMealId); 
      
      const typeForSavingDatabase = PLANNING_MEAL_TYPES.find(t => t === initialMealType);
      setSelectedMealTypeForSaving(typeForSavingDatabase);

      if (preSelectedMealId && originalMealServings) {
        const originalServingsNum = parseFirstNumber(originalMealServings);
        setDesiredServings(originalServingsNum ?? undefined);
      } else {
        setDesiredServings(undefined);
      }

      if (!preSelectedMealId) {
        setProcessedMeals([]); 
        let tagsToPreselect: MealTag[] = [];
        const snackTag = MEAL_TAG_OPTIONS.find(tag => tag === "Snack");
        if (initialMealType) {
          if (MEAL_TAG_OPTIONS.includes(initialMealType as MealTag)) {
            tagsToPreselect = [initialMealType as MealTag];
          } else if ((initialMealType === "Afternoon Snack" || initialMealType === "Brunch Snack") && snackTag) {
            tagsToPreselect = [snackTag];
          }
        }
        setSelectedTags(tagsToPreselect);
      } else {
        setSelectedTags([]);
      }

    } else {
      setIsComboboxOpen(false);
    }
  }, [open, initialMealType, preSelectedMealId, originalMealServings]);

  useEffect(() => {
    if (preSelectedMealId) {
      setProcessedMeals([]);
      return;
    }
    if (mealsTextData) {
      let currentProcessedMeals = mealsTextData.map(meal => ({
        ...meal,
        image_url: undefined, 
      }));

      if (mealsImageData) {
        const imageMap = new Map(mealsImageData.map(img => [img.id, img.image_url]));
        currentProcessedMeals = currentProcessedMeals.map(meal => ({
          ...meal,
          image_url: imageMap.get(meal.id) || meal.image_url, 
        }));
      }
      setProcessedMeals(currentProcessedMeals);
    } else {
      setProcessedMeals([]); 
    }
  }, [mealsTextData, mealsImageData, preSelectedMealId]);

  const filteredMeals = useMemo(() => {
    if (preSelectedMealId || !processedMeals) return []; 
    let tempFilteredMeals = processedMeals;

    if (searchTerm) {
      tempFilteredMeals = tempFilteredMeals.filter(meal =>
        meal.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedTags.length > 0) {
      tempFilteredMeals = tempFilteredMeals.filter(meal =>
        meal.meal_tags && selectedTags.every(tag => meal.meal_tags!.includes(tag))
      );
    }
    return tempFilteredMeals;
  }, [processedMeals, searchTerm, selectedTags, preSelectedMealId]);

  const toggleTagFilter = (tag: MealTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_str, meal_type_str, desired_servings_val }: { meal_id: string; plan_date_str: string; meal_type_str: string; desired_servings_val: number | undefined }) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!selectedMealTypeForSaving) {
        throw new Error("Meal type for saving is not defined.");
      }
      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .match({ user_id: userId, plan_date: plan_date_str, meal_type: selectedMealTypeForSaving }); 
      if (deleteError) console.warn("Error deleting existing meal plan entry:", deleteError.message);
      
      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{ 
          user_id: userId, 
          meal_id: meal_id, 
          plan_date: plan_date_str, 
          meal_type: selectedMealTypeForSaving,
          desired_servings: desired_servings_val 
        }]) 
        .select();
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal plan updated!");
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["todaysMealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
      onOpenChange(false);
      onSaveSuccessCallback?.(); 
    },
    onError: (error) => {
      console.error("Error updating meal plan:", error);
      showError(`Failed to update meal plan: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!selectedMealId || !planDate || !selectedMealTypeForSaving) {
      showError("Please select a meal. The meal type is determined by the planner slot.");
      return;
    }
    if (desiredServings !== undefined && (isNaN(desiredServings) || desiredServings <= 0)) {
      showError("Please enter a valid number for desired servings (must be greater than 0).");
      return;
    }
    const plan_date_str = format(planDate, "yyyy-MM-dd");
    addMealToPlanMutation.mutate({ 
      meal_id: selectedMealId, 
      plan_date_str, 
      meal_type_str: selectedMealTypeForSaving,
      desired_servings_val: desiredServings 
    });
  };

  const handleMealSelection = (mealId: string) => {
    setSelectedMealId(mealId);
    const meal = processedMeals?.find(m => m.id === mealId);
    if (meal?.servings) {
      const originalServingsNum = parseFirstNumber(meal.servings);
      setDesiredServings(originalServingsNum ?? undefined);
    } else {
      setDesiredServings(undefined);
    }
    setIsComboboxOpen(false);
    setSearchTerm("");
  };

  if (!planDate) return null;
  const descriptionDisplayMealType = initialMealType || "Meal";
  
  const currentSelectedMealName = preSelectedMealId 
    ? preSelectedMealName 
    : processedMeals?.find((meal) => meal.id === selectedMealId)?.name;

  const servingsPlaceholder = `Original: ${
    preSelectedMealId 
      ? (originalMealServings || 'N/A') 
      : (processedMeals?.find(m => m.id === selectedMealId)?.servings || 'N/A')
  }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{preSelectedMealId ? `Set Servings for "${preSelectedMealName}"` : "Add / Change Meal"}</DialogTitle>
          <DialogDescription>
            For {descriptionDisplayMealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
            {preSelectedMealId && originalMealServings && ` Original servings: ${originalMealServings}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto flex-grow pr-2">
          {!preSelectedMealId && (
            <>
              <div>
                <Label className="text-sm font-medium">Filter by tags:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MEAL_TAG_OPTIONS.map(tag => (
                    <Button key={tag} variant={selectedTags.includes(tag) ? "default" : "outline"} size="sm" onClick={() => toggleTagFilter(tag)} className="text-xs px-2 py-1 h-auto">
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-2">
                <Label className="text-sm font-medium">Select Meal</Label>
                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isComboboxOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedMealId
                        ? currentSelectedMealName
                        : "Select a meal..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search meal by name..."
                        value={searchTerm}
                        onValueChange={(value) => {
                          setSearchTerm(value);
                          if (!isComboboxOpen && value) setIsComboboxOpen(true);
                        }}
                      />
                      <CommandList className="max-h-[200px] sm:max-h-[250px]">
                        {isLoadingTextData ? (
                          <div className="p-2 text-sm text-muted-foreground">Loading meals...</div>
                        ) : textDataError ? (
                          <div className="p-2 text-sm text-red-500">Error loading meal details.</div>
                        ) : !mealsTextData || mealsTextData.length === 0 ? (
                          <CommandEmpty>No meals found. Add some first!</CommandEmpty>
                        ) : 
                          filteredMeals.length === 0 ? (
                          <CommandEmpty>No meals match your search/filters.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {filteredMeals.map((meal) => (
                              <CommandItem
                                key={meal.id}
                                value={meal.id} 
                                onSelect={() => handleMealSelection(meal.id)}
                                className="cursor-pointer"
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedMealId === meal.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex items-center space-x-2 overflow-hidden">
                                  {meal.image_url ? (
                                    <img
                                      src={meal.image_url}
                                      alt={meal.name}
                                      className="h-8 w-8 object-cover rounded-sm flex-shrink-0"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 bg-muted rounded-sm flex-shrink-0"></div> 
                                  )}
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="font-medium truncate">{meal.name}</span>
                                    {meal.meal_tags && meal.meal_tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {meal.meal_tags.slice(0,3).map(tag => <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">{tag}</Badge>)}
                                        {meal.meal_tags.length > 3 && <Badge variant="secondary" className="text-xs px-1 py-0">...</Badge>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {imageDataError && !textDataError && (
                            <div className="p-1 text-xs text-amber-600 text-center">Could not load all meal images.</div>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {(selectedMealId || preSelectedMealId) && (
            <div className="grid grid-cols-1 items-center gap-2">
              <Label htmlFor="desiredServings" className="text-sm font-medium">
                Desired Servings for this Plan
              </Label>
              <Input
                id="desiredServings"
                type="number"
                min="1"
                value={desiredServings === undefined ? '' : desiredServings}
                onChange={(e) => {
                  const val = e.target.value;
                  setDesiredServings(val === '' ? undefined : parseInt(val, 10));
                }}
                placeholder={servingsPlaceholder}
                className="w-full"
              />
              {(originalMealServings || processedMeals?.find(m => m.id === selectedMealId)?.servings) && (
                <p className="text-xs text-muted-foreground">
                  This meal was originally created for {originalMealServings || processedMeals?.find(m => m.id === selectedMealId)?.servings}. 
                  Adjust if you want a different amount for this specific plan entry.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMealToPlanMutation.isPending}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSave} 
            disabled={
              (isLoadingTextData && !preSelectedMealId) || 
              addMealToPlanMutation.isPending || 
              !selectedMealId || 
              !selectedMealTypeForSaving ||
              (desiredServings !== undefined && (isNaN(desiredServings) || desiredServings <= 0))
            }
          >
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal to Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;