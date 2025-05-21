import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { showError, showSuccess } from "@/utils/toast";

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
import { Skeleton } from "@/components/ui/skeleton";

interface Meal {
  id: string;
  name: string;
}

interface AddMealToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planDate: Date | null;
  mealType: string | null;
  userId: string | null;
}

const AddMealToPlanDialog: React.FC<AddMealToPlanDialogProps> = ({
  open,
  onOpenChange,
  planDate,
  mealType,
  userId,
}) => {
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: meals, isLoading: isLoadingMeals, error: mealsError } = useQuery<Meal[]>({
    queryKey: ["userMeals", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required to fetch meals.");
      const { data, error } = await supabase
        .from("meals")
        .select("id, name")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && open,
  });

  useEffect(() => {
    if (open) {
      setSelectedMealId(undefined);
    }
  }, [open, planDate, mealType]);

  const addMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_str, meal_type_str }: { meal_id: string; plan_date_str: string; meal_type_str: string }) => {
      if (!userId) throw new Error("User not authenticated.");

      // Step 1: Delete any existing meal plan for this user, date, and meal type
      const { error: deleteError } = await supabase
        .from("meal_plans")
        .delete()
        .match({ 
          user_id: userId, 
          plan_date: plan_date_str, 
          meal_type: meal_type_str 
        });

      if (deleteError) {
        // Log the error but proceed to insert, as the main goal is to set the new meal.
        // Or, you could throw deleteError here if you want to be stricter.
        console.error("Error deleting existing meal plan, attempting to insert new one anyway:", deleteError);
      }

      // Step 2: Insert the new meal plan
      const { data, error: insertError } = await supabase
        .from("meal_plans")
        .insert([{
          user_id: userId,
          meal_id: meal_id,
          plan_date: plan_date_str,
          meal_type: meal_type_str,
        }])
        .select(); // Ensure .select() is here if you need the inserted data back

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal plan updated!"); // Changed message
      // Invalidate queries to refetch data for WeeklyPlanner and GroceryList
      // The queryKey for mealPlans in WeeklyPlanner includes the week's start date.
      // We need to ensure this specific week is invalidated.
      // A more general invalidation like queryClient.invalidateQueries({ queryKey: ["mealPlans"] })
      // will also work and might be simpler if specific week invalidation is tricky.
      if (planDate) {
         // This targets the specific week's data if your query keys are structured like ['mealPlans', userId, 'YYYY-MM-DD']
        queryClient.invalidateQueries({ queryKey: ["mealPlans", userId, format(planDate, 'yyyy-MM-dd').substring(0, 7)] }); // Invalidate by month for safety
      }
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] }); // General invalidation
      queryClient.invalidateQueries({ queryKey: ["groceryList"] }); // Invalidate grocery list too
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add / Change Meal in Plan</DialogTitle>
          <DialogDescription>
            Select a meal for {mealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="meal-select" className="text-right">
              Meal
            </Label>
            {isLoadingMeals ? (
              <Skeleton className="h-10 col-span-3" />
            ) : mealsError ? (
              <p className="col-span-3 text-red-500 text-sm">Error loading meals.</p>
            ) : (
              <Select value={selectedMealId} onValueChange={setSelectedMealId}>
                <SelectTrigger id="meal-select" className="col-span-3">
                  <SelectValue placeholder="Select a meal" />
                </SelectTrigger>
                <SelectContent>
                  {meals && meals.length > 0 ? (
                    meals.map((meal) => (
                      <SelectItem key={meal.id} value={meal.id}>
                        {meal.name}
                      </SelectItem>
                    ))
                  ) : (
                    <p className="p-2 text-sm text-gray-500">No meals found. Add some meals first!</p>
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