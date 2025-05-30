"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Utensils, ImageOff, Tag, Clock, Flame, Users } from "lucide-react";
import { toast } from "react-hot-toast";

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

export default function MealDetailPage() {
  const { id: mealId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMealDetails = async () => {
      setLoading(true);
      if (!mealId) {
        setError("Meal ID is missing.");
        toast.error("Meal ID is missing.");
        setLoading(false);
        navigate("/meals"); // Or a 404 page
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data, error: mealError } = await supabase
          .from("meals")
          .select("*")
          .eq("id", mealId)
          .eq("user_id", user.id) // Ensure user can only view their own meals
          .single(); // We expect only one meal

        if (mealError) {
          console.error("Error fetching meal details:", mealError);
          setError(mealError.message);
          toast.error(`Failed to fetch meal: ${mealError.message}`);
          if (mealError.code === 'PGRST116') { // PostgREST error for "Searched item was not found"
            setError("Meal not found or you don't have permission to view it.");
            toast.error("Meal not found or you don't have permission to view it.");
          }
        } else if (data) {
          setMeal(data);
        } else {
          setError("Meal not found.");
          toast.error("Meal not found.");
        }
      } else {
        toast.error("You must be logged in to view meal details.");
        navigate("/login");
      }
      setLoading(false);
    };

    fetchMealDetails();
  }, [mealId, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Utensils className="w-12 h-12 mx-auto animate-pulse text-blue-500" />
        <p className="mt-2">Loading meal details...</p>
      </div>
    );
  }

  if (error || !meal) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Meal could not be loaded."}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate("/meals")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Meals
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Button variant="outline" size="sm" asChild className="mb-6">
        <Link to="/meals">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Meals
        </Link>
      </Button>

      <Card>
        {meal.image_url ? (
          <img
            src={meal.image_url}
            alt={meal.name}
            className="w-full h-64 md:h-96 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-64 md:h-96 bg-gray-200 flex items-center justify-center rounded-t-lg">
            <ImageOff className="w-24 h-24 text-gray-400" />
          </div>
        )}
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold">{meal.name}</CardTitle>
          {meal.created_at && (
            <CardDescription className="text-sm text-gray-500 flex items-center">
              <Clock className="mr-1.5 h-4 w-4" /> Added on: {new Date(meal.created_at).toLocaleDateString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {meal.estimated_calories || meal.servings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {meal.estimated_calories && (
                <div className="flex items-center text-gray-700">
                  <Flame className="mr-2 h-5 w-5 text-orange-500" />
                  <span>~{meal.estimated_calories} kcal</span>
                </div>
              )}
              {meal.servings && (
                <div className="flex items-center text-gray-700">
                  <Users className="mr-2 h-5 w-5 text-blue-500" />
                  <span>Serves {meal.servings}</span>
                </div>
              )}
            </div>
          ) : null}

          {meal.ingredients && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Ingredients</h3>
              <ul className="list-disc list-inside pl-2 space-y-1 text-gray-700 whitespace-pre-line">
                {meal.ingredients.split('\n').map((item, index) => item.trim() && <li key={index}>{item.trim()}</li>)}
              </ul>
            </div>
          )}

          {meal.instructions && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Instructions</h3>
              <div className="prose prose-sm sm:prose max-w-none whitespace-pre-line text-gray-700">
                {meal.instructions.split('\n').map((step, index) => step.trim() && <p key={index}>{step.trim()}</p>)}
              </div>
            </div>
          )}

          {meal.meal_tags && meal.meal_tags.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {meal.meal_tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    <Tag className="mr-1.5 h-4 w-4" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
            {/* Placeholder for future actions like Edit or Delete if needed on this page */}
        </CardFooter>
      </Card>
    </div>
  );
}