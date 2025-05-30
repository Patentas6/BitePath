import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns"; 
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag, PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; 
import { cn, transformSupabaseImage } from "@/lib/utils";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check, ChevronsUpDown } from "lucide-react"; 

interface Meal {
  id: string;
  name: string;
  meal_tags?: string[] | null;
  image_url?: string | null;
  created_at?: string | null;
}

interface AddMealToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planDate: Date | null;
  userId: string | null;
  initialMealType?: PlanningMealType | string | null; 
}

const AddMealToPlanDialog: React.FC<AddMealToPlanDialogProps> = ({
  open,
  onOpenChange,
  planDate,
  userId,
  initialMealType,
}) => {
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(undefined);
  const [selectedMealTypeForSaving, setSelectedMealTypeForSaving] = useState<PlanningMealType | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<MealTag[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: meals, isLoading: isLoadingMeals, error: mealsError } = useQuery<Meal[]>({
    queryKey: ["userMealsWithTagsAndImages", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meals.");
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, meal_tags, image_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }); 
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open, 
  });

  useEffect(() => {
    if (open) {
      console.log("--------------------------------------------------");
      console.log("[AddMealToPlanDialog] useEffect triggered because 'open' or 'initialMealType' changed.");
      console.log("[AddMealToPlanDialog] Current `open` state:", open);
      console.log("[AddMealToPlanDialog] Received `initialMealType` prop:", initialMealType);

      setSearchTerm("");
      setSelectedMealId(undefined);

      const typeForSavingDatabase = PLANNING_MEAL_TYPES.find(t => t === initialMealType);
      setSelectedMealTypeForSaving(typeForSavingDatabase);
      console.log("[AddMealToPlanDialog] `selectedMealTypeForSaving` (for database) state set to:", typeForSavingDatabase);

      let tagsToPreselect: MealTag[] = [];
      const snackTag = MEAL_TAG_OPTIONS.find(tag => tag === "Snack"); // Explicitly find "Snack"

      if (initialMealType) {
        if (MEAL_TAG_OPTIONS.includes(initialMealType as MealTag)) {
          // Exact match (e.g., "Breakfast" -> "Breakfast" tag)
          console.log(`[AddMealToPlanDialog] Tag Pre-selection: Exact match. '${initialMealType}' is in MEAL_TAG_OPTIONS.`);
          tagsToPreselect = [initialMealType as MealTag];
        } else if (
          (initialMealType === "Afternoon Snack" || initialMealType === "Brunch Snack") &&
          snackTag // Check if "Snack" tag exists in MEAL_TAG_OPTIONS
        ) {
          // Specific mapping for "Afternoon Snack" or "Brunch Snack" to "Snack" tag
          console.log(`[AddMealToPlanDialog] Tag Pre-selection: Mapping '${initialMealType}' to 'Snack' tag.`);
          tagsToPreselect = [snackTag];
        } else {
          console.log(`[AddMealToPlanDialog] Tag Pre-selection: No specific rule for '${initialMealType}'. Resetting tags.`);
        }
      } else {
        console.log(`[AddMealToPlanDialog] Tag Pre-selection: initialMealType is falsy. Resetting tags.`);
      }
      setSelectedTags(tagsToPreselect);
      console.log("[AddMealToPlanDialog] `selectedTags` state set to:", tagsToPreselect);
      console.log("--------------------------------------------------");
      
    } else {
      setIsComboboxOpen(false); 
    }
  }, [open, initialMealType]);


  const filteredMeals = useMemo(() => {
    if (!meals) return [];
    let tempFilteredMeals = meals;

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
  }, [meals, searchTerm, selectedTags]);

  const toggleTagFilter = (tag: MealTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_str, meal_type_str }: { meal_id: string; plan_date_str: string; meal_type_str: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!selectedMealTypeForSaving) {
        console.error("Save attempt with undefined selectedMealTypeForSaving. This should not happen if initialMealType was valid.");
        throw new Error("Meal type for saving is not defined.");
      }
      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .match({ user_id: userId, plan_date: plan_date_str, meal_type: selectedMealTypeForSaving }); 
      if (deleteError) console.warn("Error deleting existing meal plan entry:", deleteError.message);
      
      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{ user_id: userId, meal_id: meal_id, plan_date: plan_date_str, meal_type: selectedMealTypeForSaving }]) 
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
    },
    onError: (error) => {
      console.error("Error updating meal plan:", error);
      showError(`Failed to update meal plan: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!selectedMealId || !planDate || !selectedMealTypeForSaving) { 
      showError("Please select a meal. The meal type is determined by the planner slot.");
      console.error("Save validation failed: selectedMealId:", selectedMealId, "planDate:", planDate, "selectedMealTypeForSaving:", selectedMealTypeForSaving);
      return;
    }
    const plan_date_str = format(planDate, "yyyy-MM-dd");
    addMealToPlanMutation.mutate({ meal_id: selectedMealId, plan_date_str, meal_type_str: selectedMealTypeForSaving }); 
  };

  if (!planDate) return null; 

  const descriptionDisplayMealType = initialMealType || "Meal"; 

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add / Change Meal</DialogTitle> 
          <DialogDescription>
            For {descriptionDisplayMealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto flex-grow pr-2">
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
                    ? meals?.find((meal) => meal.id === selectedMealId)?.name
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
                    {isLoadingMeals ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading meals...</div>
                    ) : mealsError ? (
                      <div className="p-2 text-sm text-red-500">Error loading meals.</div>
                    ) : filteredMeals.length === 0 ? (
                      <CommandEmpty>
                        {meals && meals.length > 0 ? "No meals match your search/filters." : "No meals found. Add some first!"}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredMeals.map((meal) => {
                          const transformedImageUrl = transformSupabaseImage(meal.image_url, { width: 100, height: 100 });
                          return (
                            <CommandItem
                              key={meal.id}
                              value={meal.id}
                              onSelect={(currentValue) => {
                                setSelectedMealId(currentValue === selectedMealId ? undefined : currentValue);
                                setIsComboboxOpen(false);
                                setSearchTerm(""); 
                              }}
                              className="cursor-pointer"
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedMealId === meal.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex items-center space-x-2 overflow-hidden">
                                {meal.image_url && (
                                  <img 
                                    src={transformedImageUrl} 
                                    alt={meal.name} 
                                    className="h-8 w-8 object-cover rounded-sm flex-shrink-0" 
                                    onError={(e) => (e.currentTarget.style.display = 'none')} 
                                    loading="lazy"
                                  />
                                )}
                                {!meal.image_url && <div className="h-8 w-8 bg-muted rounded-sm flex-shrink-0"></div>}
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
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t"> 
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMealToPlanMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isLoadingMeals || addMealToPlanMutation.isPending || !selectedMealId || !selectedMealTypeForSaving}> 
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;