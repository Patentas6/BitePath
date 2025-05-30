import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"; 
import { supabase } from "@/lib/supabase";
import { format } from "date-fns"; 
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag, PLANNING_MEAL_TYPES, PlanningMealType } from "@/lib/constants"; 
import useDebounce from "@/hooks/use-debounce"; 

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog"; 
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

const PAGE_SIZE = 15; 

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
    
    if (!currentUserId) return { data: [], nextPage: undefined, totalCount: 0 };

    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("meals")
      .select("id, name, meal_tags, image_url", { count: 'exact' })
      .eq("user_id", currentUserId);

    if (currentSearchTerm) {
      query = query.ilike("name", `%${currentSearchTerm}%`);
    }

    const currentSelectedTags: MealTag[] = currentSelectedTagsString ? currentSelectedTagsString.split(',') : [];
    if (currentSelectedTags.length > 0) {
      const tagsArrayString = `{${currentSelectedTags.join(',')}}`;
      query = query.filter("meal_tags", "@>", tagsArrayString); 
    }
    
    query = query.order("name", { ascending: true }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching meals for dialog:", error);
      console.error("Supabase error details:", error);
      throw error;
    }
    
    const hasMore = (count || 0) > (from + (data?.length || 0));

    return {
      data: data || [],
      nextPage: hasMore ? pageParam + 1 : undefined,
      totalCount: count || 0,
    };
  };
  
  const selectedTagsString = useMemo(() => selectedTags.sort().join(','), [selectedTags]); 

  const {
    data: mealsData,
    fetchNextPage,
    hasNextPage,
    isLoading: isLoadingMeals,
    isFetchingNextPage,
    error: mealsError,
    refetch: refetchMeals, 
  } = useInfiniteQuery<Awaited<ReturnType<typeof fetchMeals>>, Error>({
    queryKey: ["userMealsForPlanner", userId, debouncedSearchTerm, selectedTagsString], 
    queryFn: fetchMeals,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!userId && open, 
    initialPageParam: 0,
  });

  const allFetchedMeals = useMemo(() => mealsData?.pages.flatMap(page => page.data) || [], [mealsData]);
  
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

  const totalMealsCount = mealsData?.pages[0]?.totalCount || 0;

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
                  {selectedMealName
                    ? selectedMealName
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
                    {isLoadingMeals && !isFetchingNextPage && !allFetchedMeals.length && ( 
                      <div className="p-2 text-sm text-muted-foreground flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading meals...
                      </div>
                    )}
                    {mealsError && (
                      <div className="p-2 text-sm text-red-500">Error: {mealsError.message}</div>
                    )}
                    {!isLoadingMeals && !mealsError && allFetchedMeals.length === 0 && (
                      <CommandEmpty>
                        {totalMealsCount > 0 ? "No meals match your search/filters." : "No meals found. Add some first!"}
                      </CommandEmpty>
                    ))
                    
                    {allFetchedMeals.length > 0 && (
                      <CommandGroup>
                        {allFetchedMeals.map((meal) => (
                          <CommandItem
                            key={meal.id}
                            value={meal.id} 
                            onSelect={(currentValue) => { 
                              setSelectedMealId(currentValue === selectedMealId ? undefined : currentValue);
                              setIsComboboxOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedMealId === meal.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex items-center space-x-2 overflow-hidden">
                              {meal.image_url && (
                                <img src={meal.image_url} alt={meal.name} className="h-8 w-8 object-cover rounded-sm flex-shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
                        ))}
                      </CommandGroup>
                    )}
                    {hasNextPage && (
                      <CommandItem
                        key="load-more"
                        onSelect={() => {
                          if (!isFetchingNextPage) {
                            fetchNextPage();
                          }
                        }}
                        className="flex items-center justify-center cursor-pointer text-sm text-muted-foreground hover:bg-accent"
                        disabled={isFetchingNextPage}
                      >
                        {isFetchingNextPage ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                          </>
                        ) : (
                          "Load More Results"
                        )}
                      </CommandItem>
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
          <Button 
            type="submit" 
            onClick={handleSave} 
            disabled={isLoadingMeals || addMealToPlanMutation.isPending || !selectedMealId || !selectedMealTypeForSaving}
          > 
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;