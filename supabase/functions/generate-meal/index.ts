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
  image_url?: string; // Added image_url field
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function received request for AI meal generation (Gemini + DALL-E).");
    const { mealType, kinds, styles, preferences } = await req.json();
    console.log("Request body:", { mealType, kinds, styles, preferences });

    // Get API keys from environment variables
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY secret not set.");
      return new Response(JSON.stringify({ error: "Gemini API key not configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
     if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY secret not set.");
      // We can still return the recipe even if image generation fails due to missing key
      // But for now, let's require it for this feature
       return new Response(JSON.stringify({ error: "OpenAI API key not configured. Cannot generate image." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // --- Step 1: Generate Recipe using Gemini ---
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

    console.log("Sending prompt to Gemini:", prompt);

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`, errorBody);
      throw new Error(`AI API error (Gemini): ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedContentString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContentString) {
       console.error("Gemini response did not contain expected content.", geminiData);
       throw new Error("Gemini did not return a valid recipe.");
    }

    let generatedMealData: GeneratedMeal;
    try {
        const jsonMatch = generatedContentString.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : generatedContentString;
        generatedMealData = JSON.parse(jsonString);
        if (!generatedMealData.name || !Array.isArray(generatedMealData.ingredients) || !generatedMealData.instructions || !Array.isArray(generatedMealData.meal_tags)) {
             console.error("Parsed Gemini JSON does not match expected structure:", generatedMealData);
             throw new Error("Gemini returned invalid recipe format.");
        }
    } catch (parseError) {
        console.error("Failed to parse Gemini response JSON:", generatedContentString, parseError);
        throw new Error(`Failed to parse Gemini response: ${(parseError as Error).message}`);
    }

    console.log("Generated Recipe:", generatedMealData.name);

    // --- Step 2: Generate Image using DALL-E ---
    const imagePrompt = `A realistic photo of the meal "${generatedMealData.name}". Focus on the finished dish presented nicely.`;
    console.log("Sending prompt to DALL-E:", imagePrompt);

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: imagePrompt,
            n: 1, // Number of images to generate
            size: "512x512", // Image size
            response_format: "url", // Request a URL
        }),
    });

    if (!openaiResponse.ok) {
        const errorBody = await openaiResponse.json();
        console.error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`, errorBody);
        // Decide if you want to throw an error or just proceed without an image
        // For now, let's throw an error if image generation fails
        throw new Error(`AI API error (DALL-E): ${openaiResponse.statusText} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const openaiData = await openaiResponse.json();
    console.log("OpenAI API response:", openaiData);

    const imageUrl = openaiData.data?.[0]?.url;

    if (!imageUrl) {
        console.error("OpenAI response did not contain an image URL.", openaiData);
        // Decide if you want to throw an error or just proceed without an image
        // Let's proceed without an image if the URL is missing but the API call was OK
        console.warn("No image URL returned from DALL-E, proceeding without image.");
        generatedMealData.image_url = undefined; // Ensure it's not set if missing
    } else {
        generatedMealData.image_url = imageUrl;
        console.log("Generated Image URL:", imageUrl);
    }

    // --- Step 3: Return Combined Data ---
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