import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' // Example if you needed Supabase client within function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS
}

// Placeholder for actual AI API call logic
async function callActualAI(prompt: string): Promise<{ name: string; ingredients: string; instructions: string }> {
  console.log(`Mock AI: Received prompt - "${prompt}"`);
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Return a mock recipe based on a simple keyword in the prompt or a default one
  if (prompt.toLowerCase().includes("pasta")) {
    return {
      name: "Mock AI Speedy Tomato Pasta",
      ingredients: "- 200g Pasta\n- 1 can Chopped Tomatoes\n- 1 clove Garlic\n- 1 tbsp Olive Oil\n- Salt & Pepper to taste\n- Optional: Basil",
      instructions: "1. Cook pasta according to package directions.\n2. While pasta cooks, heat olive oil in a pan, add minced garlic and cook until fragrant.\n3. Add chopped tomatoes, salt, and pepper. Simmer for 5-7 minutes.\n4. Drain pasta, add to the sauce. Toss to combine.\n5. Serve immediately, garnished with basil if desired."
    };
  } else if (prompt.toLowerCase().includes("chicken")) {
     return {
      name: "Mock AI Simple Baked Chicken",
      ingredients: "- 2 Chicken Breasts\n- 1 tbsp Olive Oil\n- 1 tsp Paprika\n- 1/2 tsp Garlic Powder\n- Salt & Pepper to taste",
      instructions: "1. Preheat oven to 200°C (400°F).\n2. Rub chicken breasts with olive oil.\n3. Mix paprika, garlic powder, salt, and pepper. Sprinkle over chicken.\n4. Bake for 20-25 minutes, or until cooked through."
    };
  }
  return {
    name: "Mock AI Mystery Dish",
    ingredients: "- 1 cup Imagination\n- 2 tbsp Creativity\n- A pinch of Fun",
    instructions: "1. Combine all ingredients with enthusiasm.\n2. Let your culinary spirit guide you.\n3. Enjoy your unique creation!"
  };
}

serve(async (req: Request) => {
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      return new Response(JSON.stringify({ error: "Prompt is required and must be a non-empty string." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In a real scenario, you'd call your AI model here
    // For now, we use our mock function
    const recipe = await callActualAI(prompt);
    
    console.log("Mock AI: Successfully generated recipe for prompt:", prompt);
    return new Response(JSON.stringify({ recipe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in AI recipe function:", error);
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});