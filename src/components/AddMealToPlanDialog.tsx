import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { showError, showSuccess } from "@/utils/toast";
import { MEAL_TAG_OPTIONS, MealTag } from "@/lib/constants"; // Import tags

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // Import Input
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Search, X } from "lucide-react";

interface Meal {
  id: string;
  name: string;
  meal_tags?: string[] | null; // Added meal_tags
}

interface AddMealToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planDate: Date | null;
  mealType: string | null; // This is the slot type (Breakfast, Lunch, Dinner)
  userId: string | null;
}

const AddMealToPlanDialog: React.FC<AddMealToPlanDialogProps> = ({
  open,
  onOpenChange,
  planDate,
  mealType, // This is the slot type from the planner
  userId,
}) => {
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<MealTag[]>([]);
  const queryClient = useQueryClient();

  const { data: meals, isLoading: isLoadingMeals, error: mealsError } = useQuery<Meal[]>({
    queryKey: ["userMealsWithTags", userId], // Changed queryKey to reflect tags
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meals.");
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, meal_tags") // Fetch meal_tags
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open,
  });

  // Suggest initial tag filter based on the mealType of the slot
  useEffect(() => {
    if (open && mealType && MEAL_TAG_OPTIONS.includes(mealType as MealTag)) {
      setSelectedTags([mealType as MealTag]);
    } else if (open) {
      setSelectedTags([]); // Default to no tags selected if mealType is not a valid tag
    }
    setSearchTerm(""); // Reset search term when dialog opens
    setSelectedMealId(undefined); // Reset selected meal
  }, [open, mealType]);


  const filteredMeals = useMemo(() => {
    if (!meals) return [];
    return meals.filter(meal => {
      const nameMatch = meal.name.toLowerCase().includes(searchTerm.toLowerCase());
      const tagsMatch = selectedTags.length === 0 || 
                        (meal.meal_tags && selectedTags.every(tag => meal.meal_tags!.includes(tag)));
      return nameMatch && tagsMatch;
    });
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
        .match({ 
          user_id: userId, 
          plan_date: plan_date_str, 
          meal_type: meal_type_str 
        });

      if (deleteError) {
        console.error("Error deleting existing meal plan, attempting to insert new one anyway:", deleteError);
      }

      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{
          user_id: userId,
          meal_id: meal_id,
          plan_date: plan_date_str,
          meal_type: meal_type_str,
        }])
        .select(); 

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal plan updated!");
      if (planDate) {
        queryClient.invalidateQueries({ queryKey: ["mealPlans", userId, format(planDate, 'yyyy-MM-dd').substring(0, 7)] });
      }
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["groceryList"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating meal plan:", error);
      showError(`Failed to update meal plan: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!selectedMealId || !planDate || !mealType) {
      showError("Please select a meal and ensure date/type are set.");
      return;
    }
    const plan_date_str = format(planDate, "yyyy-MM-dd");
    addMealToPlanMutation.mutate({ meal_id: selectedMealId, plan_date_str, meal_type_str: mealType });
  };

  if (!planDate || !mealType) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"> {/* Adjusted width */}
        <DialogHeader>
          <DialogTitle>Add / Change Meal for {mealType}</DialogTitle>
          <DialogDescription>
            Select a meal for {mealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search and Filter Controls */}
        <div className="grid gap-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search meal by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
            {searchTerm && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchTerm('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div>
            <Label className="text-sm font-medium">Filter by tags:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MEAL_TAG_OPTIONS.map(tag => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTagFilter(tag)}
                  className="text-xs px-2 py-1 h-auto"
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>

          {/* Meal Selection */}
          <div className="grid grid-cols-1 items-center gap-4">
            <Label htmlFor="meal-select" className="text-sm font-medium">
              Available Meals ({filteredMeals?.length || 0})
            </Label>
            {isLoadingMeals ? (
              <Skeleton className="h-10 w-full" />
            ) : mealsError ? (
              <p className="col-span-3 text-red-500 text-sm">Error loading meals.</p>
            ) : (
              <Select value={selectedMealId} onValueChange={setSelectedMealId}>
                <SelectTrigger id="meal-select" className="w-full">
                  <SelectValue placeholder="Select a meal" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {filteredMeals && filteredMeals.length > 0 ? (
                    filteredMeals.map((meal) => (
                      <SelectItem key={meal.id} value={meal.id}>
                        <div className="flex flex-col">
                          <span>{meal.name}</span>
                          {meal.meal_tags && meal.meal_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {meal.meal_tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <p className="p-2 text-sm text-gray-500 text-center">
                      {meals && meals.length > 0 ? "No meals match your filters." : "No meals found. Add some first!"}
                    </p>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMealToPlanMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isLoadingMeals || addMealToPlanMutation.isPending || !selectedMealId}>
            {addMealToPlanMutation.isPending ? "Saving..." : "Save Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMealToPlanDialog;