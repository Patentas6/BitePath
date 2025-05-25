import { useState, useMemo, useEffect } from "react"; // Import useEffect
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Edit3, Search, ChefHat, List, Grid3X3 } from "lucide-react"; // Added List and Grid3X3 icons
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog"; // Import Dialog components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface Meal extends MealForEditing {
  meal_tags?: string[] | null;
  image_url?: string | null; // Added image_url
}

interface ParsedIngredient {
  name: string;
  quantity: number | string;
  unit: string;
  description?: string;
}

const MealList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all'); // State for category filter
  const [layoutView, setLayoutView] = useState<'list' | 'grid'>('list'); // State for layout view
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [mealToEdit, setMealToEdit] = useState<MealForEditing | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<MealForEditing | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null); // State for enlarged image view

  const queryClient = useQueryClient();

  const { data: meals, isLoading, error } = useQuery<Meal[]>({
    queryKey: ["meals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in.");

      const { data, error } = await supabase
        .from("meals")
        .select("id, name, ingredients, instructions, user_id, meal_tags, image_url") // Select image_url
        .eq("user_id", user.id)
        .order('created_at', { ascending: false });

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

  const handleEditClick = (meal: Meal) => {
    setMealToEdit(meal);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (meal: Meal) => {
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

  const uniqueCategories = useMemo(() => {
    if (!meals) return [];
    const allTags = meals.flatMap(meal => meal.meal_tags || []).filter(Boolean) as string[];
    return Array.from(new Set(allTags)).sort();
  }, [meals]);

  const filteredMeals = useMemo(() => {
    if (!meals) return [];
    return meals.filter(meal => {
      const nameMatch = meal.name.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = selectedCategory === 'all' || (meal.meal_tags && meal.meal_tags.includes(selectedCategory));
      return nameMatch && categoryMatch;
    });
  }, [meals, searchTerm, selectedCategory]);

  const formatIngredientsDisplay = (ingredientsString: string | null | undefined): string => {
    if (!ingredientsString) return 'No ingredients listed.';
    try {
      const parsedIngredients: ParsedIngredient[] = JSON.parse(ingredientsString);
      if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
        const names = parsedIngredients.map(ing => ing.name).filter(Boolean);
        if (names.length === 0) return 'Ingredients listed (check format).';

        let displayText = names.slice(0, 5).join(', '); // Show up to 5 ingredients
        if (names.length > 5) {
          displayText += ', ...';
        }
        return displayText;
      }
      return 'No ingredients listed or format error.';
    } catch (e) {
      const maxLength = 70; // Increased snippet length
      return ingredientsString.substring(0, maxLength) + (ingredientsString.length > maxLength ? '...' : '');
    }
  };

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>My Meals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error("Error fetching meals:", error);
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>My Meals</CardTitle></CardHeader>
        <CardContent><p className="text-red-500">Error loading meals. Please try again later.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle>My Meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls: Search, Category Filter, Layout Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search my meals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex space-x-2 w-full sm:w-auto justify-center sm:justify-start">
              <Button
                variant={layoutView === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setLayoutView('list')}
                aria-label="Switch to list view"
              >
                <List className="h-5 w-5" />
              </Button>
              <Button
                variant={layoutView === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setLayoutView('grid')}
                aria-label="Switch to grid view"
              >
                <Grid3X3 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {meals && meals.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <ChefHat className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold mb-1">No Meals Yet!</p>
              <p className="text-sm">Looks like your recipe book is empty. <br/>Add a meal using the "Add Meal" button above or discover new ones!</p>
            </div>
          )}

          {meals && meals.length > 0 && filteredMeals.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Search className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-lg">No meals match your current filters.</p>
              <p className="text-sm">Try a different search term or category.</p>
            </div>
          )}

          {/* Meal List/Grid Display */}
          {filteredMeals && filteredMeals.length > 0 && (
            <div className={cn(
              layoutView === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            )}>
              {filteredMeals.map((meal) => (
                <div key={meal.id} className="border p-4 rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow duration-150 space-y-2 flex flex-col"> {/* Added flex-col for grid consistency */}
                  <div className="flex items-start"> {/* Use flex to align image and text */}
                    {meal.image_url && (
                       <div
                         className="h-20 w-20 object-cover rounded-md mr-4 flex-shrink-0 cursor-pointer flex items-center justify-center overflow-hidden bg-muted" // Added styling and click handler
                         onClick={() => setViewingImageUrl(meal.image_url || null)}
                       >
                         <img
                           src={meal.image_url}
                           alt={meal.name}
                           className="h-full object-contain" // Use h-full and object-contain
                           onError={(e) => (e.currentTarget.style.display = 'none')} // Hide image on error
                         />
                       </div>
                    )}
                    <div className="flex-grow pr-2">
                      <h3 className="text-xl font-semibold text-foreground">{meal.name}</h3>
                      {meal.meal_tags && meal.meal_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {meal.meal_tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 flex-shrink-0 ml-2">
                      <Button variant="outline" size="icon" onClick={() => handleEditClick(meal)} aria-label="Edit meal">
                        <Edit3 className="h-5 w-5" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(meal)} aria-label="Delete meal">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  {(meal.ingredients || (meal.instructions && meal.instructions.trim() !== "")) && (
                    <div className="space-y-2 pt-2 border-t border-muted/50 flex-grow"> {/* Added flex-grow */}
                      {meal.ingredients && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Ingredients:</p>
                          <p className="text-xs text-foreground/80 mt-0.5 pl-2">
                            {formatIngredientsDisplay(meal.ingredients)}
                          </p>
                        </div>
                      )}
                      {meal.instructions && meal.instructions.trim() !== "" && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Instructions:</p>
                          <p className="text-xs text-foreground/80 mt-0.5 pl-2 whitespace-pre-line">
                            {meal.instructions.substring(0, 100)}{meal.instructions.length > 100 ? '...' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
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

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImageUrl} onOpenChange={(open) => !open && setViewingImageUrl(null)}>
        <DialogContent className="max-w-screen-md w-[90vw] h-[90vh] p-0 flex items-center justify-center bg-transparent border-none">
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged meal image"
              className="max-w-full max-h-full object-contain" // Ensure image fits within dialog
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MealList;