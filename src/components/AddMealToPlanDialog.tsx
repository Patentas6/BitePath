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

  // Fetch user's meals
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
    enabled: !!userId && open, // Only fetch when the dialog is open and userId is available
  });

  useEffect(() => {
    // Reset selected meal when dialog opens or props change
    if (open) {
      setSelectedMealId(undefined);
    }
  }, [open, planDate, mealType]);

  const addMealToPlanMutation = useMutation({
    mutationFn: async ({ meal_id, plan_date_str, meal_type_str }: { meal_id: string; plan_date_str: string; meal_type_str: string }) => {
      if (!userId) throw new Error("User not authenticated.");

      const { data, error } = await supabase
        .from("meal_plans")
        .insert([{
          user_id: userId,
          meal_id: meal_id,
          plan_date: plan_date_str,
          meal_type: meal_type_str,
        }]);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Meal added to plan!");
      queryClient.invalidateQueries({ queryKey: ["mealPlans", format(planDate!, 'yyyy-MM-dd').substring(0, 7)] }); // More general invalidation
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] }); // Invalidate general mealPlans query too
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error adding meal to plan:", error);
      showError(`Failed to add meal to plan: ${error.message}`);
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

  if (!planDate || !mealType) return null; // Should not happen if dialog is controlled properly

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Meal to Plan</DialogTitle>
          <DialogDescription>
            Select a meal to add to {mealType} on {format(planDate, "EEEE, MMM dd, yyyy")}.
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