"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client"; // Your Supabase client
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle, Trash2, Edit3, Utensils, ImageOff, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Meal {
  id: string;
  name: string;
  ingredients?: string;
  instructions?: string;
  created_at?: string;
  meal_tags?: string[];
  image_url?: string;
  user_id?: string;
  estimated_calories?: string;
  servings?: string;
}

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndMeals = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data, error: mealsError } = await supabase
          .from("meals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (mealsError) {
          console.error("Error fetching meals:", mealsError);
          setError(mealsError.message);
          toast.error(`Failed to fetch meals: ${mealsError.message}`);
        } else {
          setMeals(data || []);
        }
      } else {
        toast.error("You must be logged in to view meals.");
        navigate("/login");
      }
      setLoading(false);
    };

    fetchUserAndMeals();
  }, [navigate]);

  const handleDeleteMeal = async (mealId: string) => {
    if (!userId) {
      toast.error("User not authenticated.");
      return;
    }

    const toastId = toast.loading("Deleting meal...");
    const { error: deleteError } = await supabase
      .from("meals")
      .delete()
      .eq("id", mealId)
      .eq("user_id", userId); // Ensure user can only delete their own meals

    if (deleteError) {
      toast.error(`Failed to delete meal: ${deleteError.message}`, { id: toastId });
      console.error("Error deleting meal:", deleteError);
    } else {
      setMeals((prevMeals) => prevMeals.filter((meal) => meal.id !== mealId));
      toast.success("Meal deleted successfully!", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Utensils className="w-12 h-12 mx-auto animate-pulse text-blue-500" />
        <p className="mt-2">Loading your meals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Meals</h1>
        <Button asChild>
          <Link to="/meals/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Meal
          </Link>
        </Button>
      </div>

      {meals.length === 0 ? (
        <Card className="text-center py-10">
          <CardHeader>
            <Utensils className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <CardTitle>No Meals Yet!</CardTitle>
            <CardDescription>
              You haven't added any meals. Click "Add New Meal" to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meals.map((meal) => (
            <Card key={meal.id} className="flex flex-col">
              <CardHeader>
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt={meal.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-t-lg">
                    <ImageOff className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                <CardTitle className="mt-4">{meal.name}</CardTitle>
                {meal.meal_tags && meal.meal_tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {meal.meal_tags.map((tag) => (
                      <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-gray-600 line-clamp-3">
                  {meal.ingredients ? `Ingredients: ${meal.ingredients.substring(0,100)}...` : "No ingredients listed."}
                </p>
                 {meal.estimated_calories && <p className="text-sm text-gray-500 mt-1">Calories: ~{meal.estimated_calories} kcal</p>}
                 {meal.servings && <p className="text-sm text-gray-500">Servings: {meal.servings}</p>}
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/meals/${meal.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View Details
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the meal "{meal.name}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteMeal(meal.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}