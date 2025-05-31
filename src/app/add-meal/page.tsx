"use client";

import { AddMealForm } from "@/components/AddMealForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function AddMealPage() {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
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