"use client";

// Ensure this path is correct and there are no typos
import { AddMealForm } from "@/components/AddMealForm"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function AddMealPage() {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {/* TEMPORARY VISUAL MARKER - REMOVE LATER */}
      <h2 style={{ color: 'blue', fontSize: '20px', border: '1px solid blue', padding: '5px', margin: '5px 0' }}>
        ADD-MEAL/PAGE.TSX LOADED (Version 2)
      </h2>
      <Link href="/my-meals" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to My Meals
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Add a New Meal Manually</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMealForm />
        </CardContent>
      </Card>
    </div>
  );
}