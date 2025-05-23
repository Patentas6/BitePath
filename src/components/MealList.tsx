import { useState, useMemo } from "react"; // Import useState and useMemo
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Trash2, Edit3, Search, Inbox } from "lucide-react"; // Import Search and Inbox icons
import EditMealDialog, { MealForEditing } from "./EditMealDialog";
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


interface Meal extends MealForEditing {
  // id, name, ingredients, instructions are already in MealForEditing
}

interface ParsedIngredient {
  name: string;
  quantity: number | string;
  unit: string;
}


const MealList = () => {
  const [searchTerm, setSearchTerm] = useState("");
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
        .select("id, name, ingredients, instructions, user_id")
        .eq("user_id", user.id)
        .order('created_at', { ascending: false }); // Order by creation date

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
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meal deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["groceryList"] });
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

  const filteredMeals = useMemo(() => {
    if (!meals) return [];
    return meals.filter(meal =>
      meal.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [meals, searchTerm]);

  const formatIngredientsDisplay = (ingredientsString: string | null | undefined): string => {
    if (!ingredientsString) return 'No ingredients listed.';
    try {
      const parsedIngredients: ParsedIngredient[] = JSON.parse(ingredientsString);
      if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
        const names = parsedIngredients.map(ing => ing.name).filter(Boolean);
        if (names.length === 0) return 'Ingredients listed (check format).';
        
        let displayText = names.slice(0, 4).join(', '); // Show up to 4 ingredient names
        if (names.length > 4) {
          displayText += ', ...';
        }
        return displayText;
      }
      // If JSON is valid but not an array or is an empty array
      return 'No ingredients listed or format error.'; 
    } catch (e) {
      // If JSON.parse fails, it's likely old plain text. Display as is, truncated.
      const maxLength = 60; // Slightly longer truncation for plain text
      return ingredientsString.substring(0, maxLength) + (ingredientsString.length > maxLength ? '...' : '');
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Your Meals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full mb-4" /> {/* Skeleton for search input */}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meals:", error);
    // showError(`Failed to load meals: ${error.message}`); // This might be too noisy if shown persistently
    return (
      <Card>
        <CardHeader><CardTitle>Your Meals</CardTitle></CardHeader>
        <CardContent><p className="text-red-500">Error loading meals. Please try again later.</p></CardContent>
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search your meals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          {meals && meals.length === 0 && (
            <div className="text-center py-6">
              <Inbox className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600">No meals added yet.</p>
              <p className="text-sm text-gray-500">Add one using the form on the left!</p>
            </div>
          )}

          {meals && meals.length > 0 && filteredMeals.length === 0 && (
            <div className="text-center py-6">
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600">No meals match your search "{searchTerm}".</p>
              <p className="text-sm text-gray-500">Try a different search term or clear the search.</p>
            </div>
          )}
          
          {filteredMeals && filteredMeals.length > 0 && (
            filteredMeals.map((meal) => (
              <div key={meal.id} className="border p-3 rounded-md shadow-sm bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{meal.name}</h3>
                    {meal.ingredients && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ingredients: {formatIngredientsDisplay(meal.ingredients)}
                      </p>
                    )}
                    {meal.instructions && <p className="text-xs text-gray-500 mt-1">Instructions: {meal.instructions.substring(0,50)}{meal.instructions.length > 50 ? '...' : ''}</p>}
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
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