import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns"; 
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag, PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; 
import useDebounce from "@/hooks/use-debounce";

import { Button } from "@/components/ui/button";
import {
  Dialog as ShadDialog, 
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
import { Search, X, Check, ChevronsUpDown, Loader2 } from "lucide-react"; 
import { cn } from "@/lib/utils";

const DIALOG_PAGE_SIZE = 15;

interface Meal {
  id: string;
  name: string;
  meal_tags?: string[] | null;
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
  const [selectedMealName, setSelectedMealName] = useState<string | undefined>(undefined);
  const [selectedMealTypeForSaving, setSelectedMealTypeForSaving] = useState<PlanningMealType | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [selectedTags, setSelectedTags] = useState<MealTag[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const queryClient = useQueryClient();

  const fetchMeals = async ({ pageParam = 0, queryKey }: { pageParam?: number, queryKey: any }) => {
    const [_queryName, currentUserId, currentSearchTerm, currentSelectedTagsString] = queryKey;
    if (!currentUserId) return { data: [], error: null };

    let query = supabase
      .from("meals")
      .select("id, name, meal_tags, image_url", { count: 'exact' })
      .eq("user_id", currentUserId);

    if (currentSearchTerm) {
      query = query.ilike("name", `%${currentSearchTerm}%`);
    }

    const currentSelectedTags: MealTag[] = currentSelectedTagsString ? currentSelectedTagsString.split(',') : [];
    if (currentSelectedTags.length > 0) {
      query = query.contains("meal_tags", currentSelectedTags); 
    }
    
    const from = pageParam * DIALOG_PAGE_SIZE;
    const to = from + DIALOG_PAGE_SIZE - 1;
    query = query.order("name", { ascending: true }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching meals for dialog:", error);
      throw error;
    }
    
    return {
      data: data || [],
      nextPage: count && data.length === DIALOG_PAGE_SIZE ? pageParam + 1 : undefined,
      totalCount: count || 0,
    };
  };

  const selectedTagsString = useMemo(() => selectedTags.sort().join(','), [selectedTags]);

  const {
    data: mealsData,
    error: mealsError,
    isLoading: isLoadingMeals,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Awaited<ReturnType<typeof fetchMeals>>, Error>({
    queryKey: ["userMealsForPlanner", userId, debouncedSearchTerm, selectedTagsString],
    queryFn: fetchMeals,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!userId && open,
  });

  const allFetchedMeals = useMemo(() => mealsData?.pages.flatMap(page => page.data) || [], [mealsData]);
  const totalMealsCount = useMemo(() => mealsData?.pages[0]?.totalCount || 0, [mealsData]);

  useEffect(() => {
    if (open) {
      console.log("[AddMealToPlanDialog] Opened. InitialMealType:", initialMealType);
      setSearchTerm(""); 
      setSelectedMealId(undefined);
      setSelectedMealName(undefined);

      const typeForSavingDatabase = PLANNING_MEAL_TYPES.find(t => t === initialMealType);
      setSelectedMealTypeForSaving(typeForSavingDatabase);
      
      let tagsToPreselect: MealTag[] = [];
      const snackTag = MEAL_TAG_OPTIONS.find(tag => tag === "Snack");

      if (initialMealType) {
        if (MEAL_TAG_OPTIONS.includes(initialMealType as MealTag)) {
          tagsToPreselect = [initialMealType as MealTag];
        } else if (
          (initialMealType === "Afternoon Snack" || initialMealType === "Brunch Snack") &&
          snackTag
        ) {
          tagsToPreselect = [snackTag];
        }
      }
      setSelectedTags(tagsToPreselect); 
    } else {
      setIsComboboxOpen(false); 
    }
  }, [open, initialMealType]);

  useEffect(() => {
    if (selectedMealId) {
      const meal = allFetchedMeals.find(m => m.id === selectedMealId);
      setSelectedMealName(meal?.name);
    } else {
      setSelectedMealName(undefined);
    }
  }, [selectedMealId, allFetchedMeals]);

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
    <ShadDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add / Change Meal</DialogTitle> 
          <DialogDescription>
            For {descriptionDisplayMealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto flex-grow pr-2">
          <Label>Content temporarily simplified for debugging.</Label>
        </div>
        
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMealToPlanMutation.isPending}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSave} 
            disabled={isLoadingMeals || addMealToPlanMutation.isPending || !selectedMealId || !selectedMealTypeForSaving}
          > 
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </ShadDialog> 
  );
};

export default AddMealToPlanDialog;