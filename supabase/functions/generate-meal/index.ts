import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// Updated Google Auth import URL
import { GoogleAuth } from 'https://deno.land/x/google_auth@v0.6.0/mod.ts'; 
import { HarmBlockThreshold, HarmCategory } from "https://esm.sh/@google/generative-ai@0.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GOOGLE_PROJECT_ID = "bitepath"; 
const VERTEX_AI_REGION = "us-central1"; 

// Helper function to parse servings string
function parseServings(servingsText?: string): string {
  if (!servingsText || typeof servingsText !== 'string') {
    return "2"; // Default if no text or invalid type
  }

  const rangeMatch = servingsText.match(/(\d+)\s*[-to]+\s*(\d+)/);
  if (rangeMatch && rangeMatch[1]) {
    return parseInt(rangeMatch[1], 10).toString(); 
  }

  const singleMatch = servingsText.match(/(\d+)/);
  if (singleMatch && singleMatch[1]) {
    return parseInt(singleMatch[1], 10).toString();
  }

  return "2"; 
}

// Helper function to parse quantity string to number
function parseQuantity(quantityStr?: string | number): number | null {
  if (quantityStr === null || quantityStr === undefined || typeof quantityStr === 'number') {
    return typeof quantityStr === 'number' && !isNaN(quantityStr) ? quantityStr : null;
  }
  if (typeof quantityStr !== 'string' || quantityStr.trim() === "" || quantityStr.toLowerCase() === "to taste") {
    return null;
  }

  if (quantityStr.includes('/')) {
    const parts = quantityStr.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }
  
  const num = parseFloat(quantityStr);
  return isNaN(num) ? null : num;
}

interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  description?: string | null;
}

interface MealData {
  name?: string;
  ingredients?: Array<{ name?: string; quantity?: string | number; unit?: string; description?: string }>;
  instructions?: string;
  meal_tags?: string[];
  ai_preferences?: string; 
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!, 
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('image_generation_count, last_image_generation_reset, is_admin, ai_preferences, preferred_unit_system')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(JSON.stringify({ error: "Failed to fetch user profile." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const IMAGE_GENERATION_LIMIT_PER_MONTH = 10; 
    let currentCount = profile.image_generation_count || 0;
    const lastReset = profile.last_image_generation_reset ? new Date(profile.last_image_generation_reset) : new Date(0);
    const now = new Date();

    if (now.getFullYear() > lastReset.getFullYear() || now.getMonth() > lastReset.getMonth()) {
      currentCount = 0;
       supabaseClient.from('profiles').update({ 
          image_generation_count: 0,
          last_image_generation_reset: now.toISOString().split('T')[0] 
       }).eq('id', user.id).then();
    }
    
    if (!profile.is_admin && currentCount >= IMAGE_GENERATION_LIMIT_PER_MONTH) {
      return new Response(JSON.stringify({ error: `Monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH} reached.` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mealData } = (await req.json()) as { mealData: MealData };
    const mealName = mealData.name || "a delicious meal";
    const userAIPrefs = profile.ai_preferences || mealData.ai_preferences || "No specific dietary preferences.";
    const unitSystem = profile.preferred_unit_system || "imperial";

    const ingredientsHint = mealData.ingredients && mealData.ingredients.length > 0 
      ? `Consider these existing ingredients if relevant: ${mealData.ingredients.map(i => `${i.quantity || ''} ${i.unit || ''} ${i.name}`).join(', ')}.`
      : "";
    const tagsHint = mealData.meal_tags && mealData.meal_tags.length > 0
      ? `Consider these tags: ${mealData.meal_tags.join(', ')}.`
      : "";

    const prompt = `
      You are a creative chef and recipe generator.
      User's AI Preferences: ${userAIPrefs}
      Preferred Unit System for ingredients: ${unitSystem}

      Generate a recipe for a meal based on the name: "${mealName}".
      ${ingredientsHint}
      ${tagsHint}

      Provide the following details in a JSON format:
      1.  "mealName": A catchy and descriptive name for the meal.
      2.  "ingredients": An array of objects, where each object has "name" (string), "quantity" (number, e.g., 0.5, 1, 2.5), and "unit" (string, e.g., "cup", "g", "tsp"). If quantity is not applicable (e.g., "to taste"), set quantity to null and unit to null, you can add a "description" field like "to taste".
      3.  "instructions": Step-by-step cooking instructions as a single string with newlines.
      4.  "servings": The number of people this meal serves. THIS MUST BE A SINGLE WHOLE NUMBER (e.g., "4"). If you think it serves a range like 2-3 people, USE THE LOWER NUMBER (e.g., "2"). If unsure, default to "2".
      5.  "meal_tags": An array of relevant tags (e.g., "vegetarian", "quick", "dinner").
      6.  "imagePrompt": A short, vivid description of the finished meal, suitable for an image generation model (e.g., "A vibrant bowl of spaghetti bolognese, topped with fresh basil and parmesan cheese, close-up shot").

      Example for an ingredient: { "name": "All-purpose Flour", "quantity": 1.5, "unit": "cups" }
      Example for "to taste": { "name": "Salt", "quantity": null, "unit": null, "description": "to taste" }
      Example for servings: "servings": "4"

      Output ONLY the JSON object. Do not include any other text before or after the JSON.
    `;

    const auth = new GoogleAuth();
    const token = await auth.getAccessToken('https://www.googleapis.com/auth/cloud-platform');
    
    const geminiResponse = await fetch(
      `https://${VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${VERTEX_AI_REGION}/publishers/google/models/gemini-1.5-flash-001:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 30,
            topP: 0.9,
            maxOutputTokens: 2048,
          },
           safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Gemini API error:", errorBody);
      throw new Error(`Gemini API request failed: ${geminiResponse.status} ${errorBody}`);
    }

    const geminiResult = await geminiResponse.json();
    
    let recipeJsonText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!recipeJsonText) {
        console.error("No text found in Gemini response:", JSON.stringify(geminiResult, null, 2));
        throw new Error("Failed to get recipe details from AI: No text in response.");
    }
    
    recipeJsonText = recipeJsonText.replace(/^```json\s*|```\s*$/g, '').trim();

    let parsedRecipe;
    try {
      parsedRecipe = JSON.parse(recipeJsonText);
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", e);
      console.error("Problematic AI response text:", recipeJsonText);
      throw new Error("Failed to parse recipe details from AI. The AI response was not valid JSON.");
    }

    const finalServings = parseServings(parsedRecipe.servings);
    const finalIngredients: Ingredient[] = (parsedRecipe.ingredients || []).map((ing: any) => ({
      name: ing.name || "Unknown Ingredient",
      quantity: parseQuantity(ing.quantity),
      unit: ing.unit || null,
      description: ing.description || null,
    }));

    let imageUrl = mealData.name ? `https://source.unsplash.com/500x300/?${encodeURIComponent(parsedRecipe.imagePrompt || mealData.name)}` : "/placeholder-image.png";
    if (parsedRecipe.imagePrompt) {
        imageUrl = `https://source.unsplash.com/500x300/?${encodeURIComponent(parsedRecipe.imagePrompt)}`;
    }

    if (!profile.is_admin) {
      await supabaseClient
        .from('profiles')
        .update({ image_generation_count: currentCount + 1 })
        .eq('id', user.id);
    }

    const responsePayload = {
      name: parsedRecipe.mealName || mealData.name,
      ingredients: finalIngredients,
      instructions: parsedRecipe.instructions || "",
      servings: finalServings,
      meal_tags: parsedRecipe.meal_tags || [],
      image_url: imageUrl,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-meal function:", error);
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});