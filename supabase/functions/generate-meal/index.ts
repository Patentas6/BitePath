import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Not needed for this mock

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// This is a MOCK Edge Function for AI meal generation.
// It does NOT actually use AI yet, but returns a predefined structure.
// Replace this with actual AI integration later.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function received request for meal generation.");
    const body = await req.json();
    console.log("Request body:", body);

    // --- MOCK AI GENERATION LOGIC ---
    // This is where your actual AI call would go.
    // For now, we return a consistent mock structure.

    let generatedName = "AI Generated Delight";
    let generatedInstructions = "Follow these simple steps:\n1. Combine ingredients.\n2. Cook thoroughly.\n3. Enjoy!";
    let generatedIngredients = [
      { name: "Mock Ingredient 1", quantity: 1, unit: "cup", description: "chopped" },
      { name: "Mock Ingredient 2", quantity: 2, unit: "pieces" },
      { name: "Mock Ingredient 3", quantity: 500, unit: "g" },
    ];
    let generatedTags = ["Mock", "Generated"];

    // You could add some basic logic here based on the input 'body'
    if (body.mealType) {
      generatedName = `${body.mealType} ${generatedName}`;
      generatedTags.push(body.mealType);
    }
    if (body.kinds && body.kinds.length > 0) {
       generatedTags = [...generatedTags, ...body.kinds];
    }
     if (body.styles && body.styles.length > 0) {
       generatedTags = [...generatedTags, ...body.styles];
    }
    generatedTags = Array.from(new Set(generatedTags)); // Remove duplicates

    const generatedMealData = {
      name: generatedName,
      ingredients: generatedIngredients,
      instructions: generatedInstructions,
      meal_tags: generatedTags,
    };
    // --- END MOCK LOGIC ---

    console.log("Returning mock generated meal:", generatedMealData);

    return new Response(
      JSON.stringify(generatedMealData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in Edge Function during mock generation:", error);
    return new Response(
      JSON.stringify({ error: `Failed during mock generation: ${error.message || 'Unknown error'}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});