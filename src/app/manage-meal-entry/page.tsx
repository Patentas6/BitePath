"use client";

import { AddMealForm } from "@/components/AddMealForm"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AddMealFormValues } from "@/components/AddMealForm"; // Import the type

export default function ManageMealEntryPage() {
  const searchParams = useSearchParams();
  const mealId = searchParams.get('id');
  const [initialData, setInitialData] = useState<Partial<AddMealFormValues> & { id?: string } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mealId) {
      setIsLoading(true);
      const fetchMealData = async () => {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('id', mealId)
          .single();

        if (error) {
          console.error("Error fetching meal data:", error);
          setError("Failed to load meal data. Please try again.");
          setInitialData(undefined); // Ensure form doesn't use stale data
        } else if (data) {
          // Ensure servings is passed as a string if it exists, or number for the form's expectation
          setInitialData({ ...data, id: data.id, servings: data.servings ? String(data.servings) : undefined });
        }
        setIsLoading(false);
      };
      fetchMealData();
    } else {
      // If no mealId, it's an "add new" form, so no initial data needed beyond defaults in AddMealForm
      setInitialData(undefined);
    }
  }, [mealId]);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 style={{ color: 'purple', fontSize: '24px', fontWeight: 'bold', border: '2px solid purple', padding: '10px', margin: '10px 0' }}>
        MANAGE-MEAL-ENTRY/PAGE.TSX LOADED (Correct URL!)
      </h1>
      <Link href="/my-meals" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to My Meals
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{mealId ? "Edit Meal" : "Add a New Meal Manually"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading meal data...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!isLoading && !error && (
            <AddMealForm 
              key={initialData ? initialData.id : 'new-meal'} // Re-mount form when initialData changes
              initialData={initialData} 
            />
          )}
          {!isLoading && !error && !mealId && !initialData && ( // Case for adding new meal explicitly
            <AddMealForm key="new-meal-explicit" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}