import { useState } from "react"; // Import useState
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation and queryClient
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast"; // Import showSuccess for delete

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button"; // Import Button
import { Trash2, Edit3 } from "lucide-react"; // Import Edit3 icon
import EditMealDialog, { MealForEditing } from "./EditMealDialog"; // Import EditMealDialog and MealForEditing type
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface Meal extends MealForEditing { // Ensure Meal type here includes user_id for passing to dialog
  // id, name, ingredients, instructions are already in MealForEditing
}


const MealList = () => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [mealToEdit, setMealToEdit] = useState<MealForEditing | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<MealForEditing | null>(null);
  
  const queryClient = useQueryClient();

  const { data: meals, isLoading, error } = useQuery<Meal[]>({
    queryKey: ["meals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in.");

      const { data, error } = await supabase
        .from("meals")
        .select("id, name, ingredients, instructions, user_id") // Ensure user_id is selected
        .eq("user_id", user.id);

      if (error) throw error;
      return data || [];
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async (mealId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in.");

      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealId)
        .eq("user_id", user.id); // Ensure user can only delete their own meals

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meal deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] }); // Invalidate plans as deleted meal might be used
      queryClient.invalidateQueries({ queryKey: ["groceryList"] }); // Invalidate grocery list
    },
    onError: (error) => {
      console.error("Error deleting meal:", error);
      showError(`Failed to delete meal: ${error.message}`);
    },
  });

  const handleEditClick = (meal: MealForEditing) => {
    setMealToEdit(meal);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (meal: MealForEditing) => {
    setMealToDelete(meal);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (mealToDelete) {
      deleteMealMutation.mutate(mealToDelete.id);
      setIsDeleteDialogOpen(false);
      setMealToDelete(null);
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Your Meals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meals:", error);
    showError(`Failed to load meals: ${error.message}`);
    return (
      <Card>
        <CardHeader><CardTitle>Your Meals</CardTitle></CardHeader>
        <CardContent><p className="text-red-500">Error loading meals.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meals && meals.length > 0 ? (
            meals.map((meal) => (
              <div key={meal.id} className="border p-3 rounded-md shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{meal.name}</h3>
                    {meal.ingredients && <p className="text-xs text-gray-500 mt-1">Ingredients: {meal.ingredients.substring(0,50)}{meal.ingredients.length > 50 ? '...' : ''}</p>}
                    {meal.instructions && <p className="text-xs text-gray-500 mt-1">Instructions: {meal.instructions.substring(0,50)}{meal.instructions.length > 50 ? '...' : ''}</p>}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEditClick(meal)} aria-label="Edit meal">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(meal)} aria-label="Delete meal">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-600">No meals added yet. Add one using the form above!</p>
          )}
        </CardContent>
      </Card>

      {mealToEdit && (
        <EditMealDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          meal={mealToEdit}
        />
      )}

      {mealToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the meal "{mealToDelete.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMealToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

export default MealList;