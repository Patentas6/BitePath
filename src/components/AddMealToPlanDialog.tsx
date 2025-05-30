import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag, PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants";

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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MealTextData {
  id: string;
  name: string;
  meal_tags?: string[] | null;
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
  const [processedMeals, setProcessedMeals] = useState<MealWithImage[]>([]);
  const queryClient = useQueryClient();

  // Phase 1: Fetch text data (should be fast)
  const { data: mealsTextData, isLoading: isLoadingTextData, error: textDataError } = useQuery<MealTextData[]>({
    queryKey: ["userMealsTextOnly", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meal text data.");
      console.log("[AddMealToPlanDialog] Fetching text-only meal data...");
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, meal_tags")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open,
  });

  // Phase 2: Fetch image data (runs in parallel or after text, depending on cache)
  const { data: mealsImageData, isLoading: isLoadingImageData, error: imageDataError } = useQuery<MealImageData[]>({
    queryKey: ["userMealImagesOnly", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meal image data.");
      console.log("[AddMealToPlanDialog] Fetching image-only meal data...");
      const { data, error } = await supabase
        .from("meals")
        .select("id, image_url")
        .eq("user_id", userId);
      // No order needed here as we merge by ID
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open && !isLoadingTextData && !!mealsTextData, // Enable only when text data is available
  });
  
  useEffect(() => {
    if (open) {
      console.log("--------------------------------------------------");
      console.log("[AddMealToPlanDialog] Dialog opened or initialMealType changed.");
      setSearchTerm("");
      setSelectedMealId(undefined);
      setProcessedMeals([]); // Clear processed meals

      const typeForSavingDatabase = PLANNING_MEAL_TYPES.find(t => t === initialMealType);
      setSelectedMealTypeForSaving(typeForSavingDatabase);

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
      console.log("[AddMealToPlanDialog] `selectedTags` state set to:", tagsToPreselect);
      console.log("--------------------------------------------------");
    } else {
      setIsComboboxOpen(false);
    }
  }, [open, initialMealType]);

  // Merge text and image data
  useEffect(() => {
    if (mealsTextData) {
      if (!mealsImageData && !isLoadingImageData) {
        // Image data query hasn't run yet or finished, or has no data, use text data with undefined image_url
        setProcessedMeals(mealsTextData.map(meal => ({ ...meal, image_url: undefined })));
      } else if (mealsImageData) {
        // Both text and image data are available, merge them
        console.log("[AddMealToPlanDialog] Merging text and image data...");
        const imageMap = new Map(mealsImageData.map(img => [img.id, img.image_url]));
        setProcessedMeals(
          mealsTextData.map(meal => ({
            ...meal,
            image_url: imageMap.get(meal.id) || null,
          }))
        );
      }
    } else {
      setProcessedMeals([]);
    }
  }, [mealsTextData, mealsImageData, isLoadingImageData]);


  const filteredMeals = useMemo(() => {
    if (!processedMeals) return [];
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
  }, [processedMeals, searchTerm, selectedTags]);

  const toggleTagFilter = (tag: MealTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_str, meal_type_str }: { meal_id: string; plan_date_str: string; meal_type_str: string }) => {
      // ... (mutation logic remains the same)
      if (!userId) throw new Error("User not authenticated.");
      if (!selectedMealTypeForSaving) {
        console.error("Save attempt with undefined selectedMealTypeForSaving.");
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
      return;
    }
    const plan_date_str = format(planDate, "yyyy-MM-dd");
    addMealToPlanMutation.mutate({ meal_id: selectedMealId, plan_date_str, meal_type_str: selectedMealTypeForSaving });
  };

  if (!planDate) return null;
  const descriptionDisplayMealType = initialMealType || "Meal";
  const overallLoading = isLoadingTextData || (isLoadingImageData && mealsTextData && mealsTextData.length > 0);


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
                    ? processedMeals?.find((meal) => meal.id === selectedMealId)?.name
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
                    {isLoadingTextData ? ( // Primary loading state is for text
                      <div className="p-2 text-sm text-muted-foreground">Loading meals...</div>
                    ) : textDataError ? (
                      <div className="p-2 text-sm text-red-500">Error loading meal details.</div>
                    ) : filteredMeals.length === 0 && !searchTerm && selectedTags.length === 0 ? (
                       <CommandEmpty>
                        {mealsTextData && mealsTextData.length > 0 ? "No meals match your search/filters." : "No meals found. Add some first!"}
                      </CommandEmpty>
                    ) : filteredMeals.length === 0 ? (
                       <CommandEmpty>No meals match your search/filters.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredMeals.map((meal) => (
                          <CommandItem
                            key={meal.id}
                            value={meal.id} // Use meal.id for value
                            onSelect={(currentValue) => { // currentValue is meal.id
                              setSelectedMealId(currentValue === selectedMealId ? undefined : currentValue);
                              setIsComboboxOpen(false);
                              setSearchTerm("");
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedMealId === meal.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex items-center space-x-2 overflow-hidden">
                              {meal.image_url ? ( // Image might not be loaded yet if isLoadingImageData is true
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="h-8 w-8 object-cover rounded-sm flex-shrink-0"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-8 w-8 bg-muted rounded-sm flex-shrink-0"></div> // Placeholder
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
                     {imageDataError && <div className="p-2 text-xs text-red-400">Could not load all meal images.</div>}
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
          <Button type="submit" onClick={handleSave} disabled={overallLoading || addMealToPlanMutation.isPending || !selectedMealId || !selectedMealTypeForSaving}>
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;