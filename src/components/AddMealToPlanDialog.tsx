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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, X, Check, ChevronsUpDown } from "lucide-react";
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

const AddMealToPlanDialog: React.FC<AddMealToPlanDialogProps> = ({
  open,
  onOpenChange,
  planDate,
  userId,
  initialMealType,
}) => {
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(undefined);
  const [selectedMealType, setSelectedMealType] = useState<PlanningMealType | undefined>(undefined);
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
        .select("id, name, meal_tags, image_url")
        .eq("user_id", userId)
        .order("name", { ascending: true }); 
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open, 
  });

  useEffect(() => {
    if (open) {
      setSelectedTags([]);
      setSearchTerm("");
      setSelectedMealId(undefined);
      const validInitialType = PLANNING_MEAL_TYPES.find(type => type === initialMealType);
      setSelectedMealType(validInitialType || undefined);
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
      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .match({ user_id: userId, plan_date: plan_date_str, meal_type: meal_type_str });
      if (deleteError) console.warn("Error deleting existing meal plan entry:", deleteError.message);
      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{ user_id: userId, meal_id: meal_id, plan_date: plan_date_str, meal_type: meal_type_str }])
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
    if (!selectedMealId || !planDate || !selectedMealType) { 
      showError("Please select a meal and a meal type.");
      return;
    }
    const plan_date_str = format(planDate, "yyyy-MM-dd");
    addMealToPlanMutation.mutate({ meal_id: selectedMealId, plan_date_str, meal_type_str: selectedMealType }); 
  };

  if (!planDate) return null; 

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl"> {/* Changed from sm:max-w-xl to sm:max-w-3xl */}
        <DialogHeader>
          <DialogTitle>Add / Change Meal</DialogTitle> 
          <DialogDescription>
            Select a meal and a meal type for {format(planDate, "EEEE, MMM dd, yyyy")}. 
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="meal-type-buttons" className="text-sm font-medium">Meal Type</Label>
            <div id="meal-type-buttons" className="flex flex-wrap gap-2">
              {PLANNING_MEAL_TYPES.map(type => (
                <Button key={type} variant={selectedMealType === type ? "default" : "outline"} size="sm" onClick={() => setSelectedMealType(type)} className="text-xs px-3 py-1.5 h-auto">
                  {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Select Meal ({isLoadingMeals ? '...' : filteredMeals?.length || 0} matching)
              </Label>
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
                <PopoverContent 
                  side="bottom" 
                  sideOffset={5} 
                  className="w-[--radix-popover-trigger-width] p-0 max-h-72 overflow-y-auto" 
                  align="start"
                  avoidCollisions={false}
                >
                  <Command shouldFilter={false}> 
                    <CommandInput 
                      placeholder="Search meal by name..."
                      value={searchTerm}
                      onValueChange={(value) => {
                        setSearchTerm(value);
                        if (!isComboboxOpen && value) setIsComboboxOpen(true); 
                      }}
                    />
                    <CommandList>
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
                          {filteredMeals.map((meal) => (
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
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Filter by tags:</Label>
              <div className="flex flex-wrap gap-2">
                {MEAL_TAG_OPTIONS.map(tag => (
                  <Button key={tag} variant={selectedTags.includes(tag) ? "default" : "outline"} size="sm" onClick={() => toggleTagFilter(tag)} className="text-xs px-2 py-1 h-auto">
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMealToPlanMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isLoadingMeals || addMealToPlanMutation.isPending || !selectedMealId || !selectedMealType}> 
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;