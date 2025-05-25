import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Define the expected structure for the AI's JSON response
interface GeneratedIngredient {
  name: string;
  quantity: number;
  unit: string;
  description?: string;
}

interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[];
  instructions: string;
  meal_tags: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function received request for AI meal generation.");
    const { mealType, kinds, styles, preferences } = await req.json();
    console.log("Request body:", { mealType, kinds, styles, preferences });

    // Get the OpenAI API key from environment variables
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY secret not set.");
      return new Response(JSON.stringify({ error: "AI service not configured. Please set OPENAI_API_KEY secret." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construct the prompt for the AI
    let prompt = `Generate a detailed meal recipe in JSON format. The JSON object should have the following structure:
    {
      "name": string, // Name of the meal
      "ingredients": [ // Array of ingredients
        {
          "name": string, // Ingredient name (e.g., "chicken breast")
          "quantity": number, // Quantity (e.g., 2, 500)
          "unit": string, // Unit (e.g., "pieces", "g", "cup", "tbsp") - use common units
          "description": string | undefined // Optional description (e.g., "diced", "freshly ground")
        }
      ],
      "instructions": string, // Step-by-step cooking instructions (use \\n for new lines)
      "meal_tags": string[] // Array of relevant tags (e.g., "Breakfast", "Lunch", "Dinner", "Snack", "High Protein", "Vegan", etc.)
    }

    The meal should be a ${mealType || 'general'} meal.`;

    if (kinds && kinds.length > 0) {
      prompt += ` It should be ${kinds.join(', ')}.`;
    }
    if (styles && styles.length > 0) {
      prompt += ` It should be ${styles.join(', ')}.`;
    }
    if (preferences) {
      prompt += ` Consider these ingredient preferences: ${preferences}.`;
    }

    prompt += ` Ensure the response is ONLY the JSON object, nothing else.`;

    console.log("Sending prompt to AI:", prompt);

    // Call the OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Or another suitable model like 'gpt-3.5-turbo'
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }, // Request JSON output
        temperature: 0.7, // Adjust creativity
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`, errorBody);
      throw new Error(`AI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log("OpenAI API response:", openaiData);

    // Extract and parse the JSON content from the AI's response
    const generatedContentString = openaiData.choices?.[0]?.message?.content;

    if (!generatedContentString) {
       console.error("AI response did not contain expected content.");
       throw new Error("AI did not return a valid recipe.");
    }

    let generatedMealData: GeneratedMeal;
    try {
        generatedMealData = JSON.parse(generatedContentString);
        // Basic validation to ensure it has the expected structure
        if (!generatedMealData.name || !Array.isArray(generatedMealData.ingredients) || !generatedMealData.instructions || !Array.isArray(generatedMealData.meal_tags)) {
             console.error("Parsed JSON does not match expected structure:", generatedMealData);
             throw new Error("AI returned invalid recipe format.");
        }
    } catch (parseError) {
        console.error("Failed to parse AI response JSON:", generatedContentString, parseError);
        throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
    }


    console.log("Returning generated meal data:", generatedMealData);

    return new Response(
      JSON.stringify(generatedMealData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in Edge Function during AI generation:", error);
    return new Response(
      JSON.stringify({ error: `Failed to generate meal: ${error.message || 'Unknown error'}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});