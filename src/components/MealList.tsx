import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Edit3, Search, ChefHat, List, Grid3X3, Zap, Users, Loader2 } from "lucide-react";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { calculateCaloriesPerServing } from '@/utils/mealUtils';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface Meal extends MealForEditing {
  meal_tags?: string[] | null;
  image_url?: string | null;
  estimated_calories?: string | null;
  servings?: string | null;
}

const PAGE_SIZE = 10; 

const MealList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [layoutView, setLayoutView] = useState<'list' | 'grid'>('list');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [mealToEdit, setMealToEdit] = useState<MealForEditing | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<MealForEditing | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); 
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    fetchUser();
  }, []);

  const { data: userProfile, isLoading: isLoadingUserProfile } = useQuery<{ track_calories: boolean } | null>({
    queryKey: ['userProfileForMealListDisplay', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('track_calories')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error("[MealList] Error fetching profile for meal list calorie display:", error);
        return { track_calories: false };
      }
      return data || { track_calories: false };
    },
    enabled: !!userId,
  });

  const fetchMeals = async ({ pageParam = 0 }) => {
    if (!userId) return { data: [], nextPage: undefined, totalCount: 0 };

    let query = supabase
      .from("meals")
      .select("id, name, ingredients, instructions, user_id, meal_tags, image_url, estimated_calories, servings", { count: 'exact' })
      .eq("user_id", userId)
      .order('created_at', { ascending: false })
      .range(pageParam, pageParam + PAGE_SIZE - 1);

    if (debouncedSearchTerm.trim()) {
      query = query.ilike('name', `%${debouncedSearchTerm.trim()}%`);
    }
    if (selectedCategory !== 'all') {
      query = query.cs('meal_tags', `{${selectedCategory}}`); 
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      nextPage: (data && data.length === PAGE_SIZE) ? pageParam + PAGE_SIZE : undefined,
      totalCount: count || 0,
    };
  };

  const {
    data: mealsData,
    fetchNextPage,
    hasNextPage,
    isLoading, 
    isFetching, 
    isFetchingNextPage,
    error: mealsError,
    status,
  } = useInfiniteQuery({
    queryKey: ["meals", userId, debouncedSearchTerm, selectedCategory],
    queryFn: fetchMeals,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!userId,
    initialPageParam: 0, 
    keepPreviousData: true, 
  });

  const allMeals = useMemo(() => mealsData?.pages.flatMap(page => page.data) ?? [], [mealsData]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


  const deleteMealMutation = useMutation({
    mutationFn: async (mealId: string) => {
      const { error } = await supabase.from("meals").delete().eq("id", mealId).eq("user_id", userId!); 
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meal deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["meals", userId, debouncedSearchTerm, selectedCategory] });
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["groceryListSource"] });
      queryClient.invalidateQueries({ queryKey: ["todaysGroceryListSource"] });
    },
    onError: (error: Error) => {
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

  const { data: uniqueCategoriesData } = useQuery<string[]>({
    queryKey: ['mealCategories', userId],
    queryFn: async () => {
        if (!userId) return [];
        const { data, error } = await supabase.rpc('get_unique_meal_tags', { p_user_id: userId });
        if (error) {
            console.error("Error fetching unique categories:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!userId,
  });
  const uniqueCategories = useMemo(() => uniqueCategoriesData || [], [uniqueCategoriesData]);


  const formatIngredientsDisplay = (ingredientsString: string | null | undefined): string => {
    if (!ingredientsString) return 'No ingredients listed.';
    try {
      let parsedIngredients: { name: string }[];
      if (ingredientsString.startsWith('[')) {
        parsedIngredients = JSON.parse(ingredientsString);
      } else {
        parsedIngredients = ingredientsString.split(',').map(name => ({ name: name.trim() }));
      }
      
      if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
        const names = parsedIngredients.filter(ing => ing.name && ing.name.trim() !== '').map(ing => ing.name);
        if (names.length === 0) return 'Ingredients listed (check format).';
        let displayText = names.slice(0, 5).join(', ');
        if (names.length > 5) displayText += ', ...';
        return displayText;
      }
      return 'No ingredients listed or format error.';
    } catch (e) {
      const maxLength = 70;
      return ingredientsString.substring(0, maxLength) + (ingredientsString.length > maxLength ? '...' : '');
    }
  };

  const showHeaderSpinner = isFetching && !isLoading && !isFetchingNextPage;

  if (status === 'pending' && !allMeals.length) { 
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>My Meals</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Skeleton className="h-10 flex-grow" />
            <Skeleton className="h-10 w-full sm:w-[180px]" />
            <div className="hidden sm:flex space-x-2">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status === 'error' && mealsError) {
    console.error("Error fetching meals:", mealsError);
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader><CardTitle>My Meals</CardTitle></CardHeader>
        <CardContent><p className="text-red-500">Error loading meals: {mealsError.message}. Please try again later.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <div className="flex items-center justify-between"> 
            <CardTitle>My Meals</CardTitle>
            {showHeaderSpinner && ( 
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search my meals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
                disabled={isFetching && !isFetchingNextPage} 
              />
            </div>
            <Select 
              value={selectedCategory} 
              onValueChange={setSelectedCategory}
              disabled={isFetching && !isFetchingNextPage} 
            >
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
                className="hidden sm:inline-flex"
              >
                <List className="h-5 w-5" />
              </Button>
              <Button
                variant={layoutView === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setLayoutView('grid')}
                aria-label="Switch to grid view"
                className="hidden sm:inline-flex"
              >
                <Grid3X3 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {status !== 'pending' && allMeals.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <ChefHat className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold mb-1">
                {debouncedSearchTerm || selectedCategory !== 'all' ? "No Meals Found" : "No Meals Yet!"}
              </p>
              <p className="text-sm">
                {debouncedSearchTerm || selectedCategory !== 'all' 
                  ? "Try adjusting your search or filters." 
                  : "Looks like your recipe book is empty. Add a meal or discover new ones!"}
              </p>
            </div>
          )}

          {allMeals.length > 0 && (
            <div className={cn(
              layoutView === 'list' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            )}>
              {allMeals.map((meal) => {
                const caloriesPerServing = calculateCaloriesPerServing(meal.estimated_calories, meal.servings);
                const canTrackCalories = userProfile && userProfile.track_calories;
                const shouldShowCalories = canTrackCalories && caloriesPerServing !== null;

                return (
                  <div
                    key={meal.id}
                    className="border p-3 sm:p-4 rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow duration-150 flex flex-col cursor-pointer"
                    onClick={() => navigate(`/meal/${meal.id}`)}
                  >
                    <div className="flex flex-col sm:flex-row items-start">
                      {meal.image_url && (
                         <div
                           className="w-full sm:w-24 md:w-28 h-40 sm:h-24 md:h-28 object-cover rounded-md mb-2 sm:mb-0 sm:mr-4 flex-shrink-0 flex items-center justify-center overflow-hidden bg-muted"
                           onClick={(e) => { e.stopPropagation(); setViewingImageUrl(meal.image_url || null); }}
                         >
                           <LazyLoadImage
                             alt={meal.name}
                             src={meal.image_url}
                             effect="blur"
                             wrapperClassName="h-full w-full"
                             className="h-full w-full object-cover"
                             placeholderSrc="/placeholder-image.png"
                             onError={(e: any) => {
                               const parent = e.currentTarget.closest('div');
                               if(parent) parent.style.display = 'none';
                             }}
                           />
                         </div>
                      )}
                      <div className="flex-grow min-w-0">
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground">{meal.name}</h3>
                        {meal.meal_tags && meal.meal_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {meal.meal_tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">{tag}</Badge>
                            ))}
                          </div>
                        )}
                         {meal.servings && (
                          <div className="mt-1.5 text-xs text-primary flex items-center">
                            <Users size={12} className="mr-1" />
                            Servings: {meal.servings}
                          </div>
                        )}
                         {shouldShowCalories && (
                          <div className="mt-1.5 text-xs text-primary flex items-center">
                            <Zap size={12} className="mr-1" />
                            Est. {caloriesPerServing} kcal per serving
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:flex flex-col space-y-2 ml-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleEditClick(meal); }}
                          aria-label="Edit meal"
                          className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 p-0"
                        >
                          <Edit3 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(meal); }}
                          aria-label="Delete meal"
                          className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 p-0"
                        >
                          <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
                        </Button>
                      </div>
                    </div>

                    {(meal.ingredients || (meal.instructions && meal.instructions.trim() !== "")) && (
                      <div className="space-y-2 mt-2 pt-2 border-t sm:border-t-0 sm:pt-2 flex-grow">
                        {meal.ingredients && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Ingredients:</p>
                            <p className="text-xs text-foreground/80 mt-0.5 pl-2">
                              {formatIngredientsDisplay(meal.ingredients)}
                            </p>
                          </div>
                        )}
                        {meal.instructions && meal.instructions.trim() !== "" && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-muted-foreground">Instructions:</p>
                            <p className="text-xs text-foreground/80 mt-0.5 pl-2 whitespace-pre-line">
                              {meal.instructions.substring(0, 100)}{meal.instructions.length > 100 ? '...' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex sm:hidden space-x-2 mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleEditClick(meal); }}
                        aria-label="Edit meal"
                        className="flex-1 h-10"
                      >
                        <Edit3 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(meal); }}
                        aria-label="Delete meal"
                        className="flex-1 h-10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={loadMoreRef} className="h-10 flex justify-center items-center">
            {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {!hasNextPage && allMeals.length > 0 && status !== 'pending' && (
              <p className="text-sm text-muted-foreground">No more meals to load.</p>
            )}
          </div>
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

      <Dialog open={!!viewingImageUrl} onOpenChange={(open) => !open && setViewingImageUrl(null)}>
        <DialogContent
          className="max-w-screen-md w-[90vw] h-[90vh] p-0 flex items-center justify-center bg-transparent border-none"
          onClick={() => setViewingImageUrl(null)}
        >
          {viewingImageUrl && (
            <img
              src={viewingImageUrl}
              alt="Enlarged meal image"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MealList;