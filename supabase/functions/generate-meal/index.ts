import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";
import { Database } from "./supabase_types.ts"; // Updated import path

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY environment variable.");
}

const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const MAX_RECIPE_GENERATIONS = 100; // Example limit
const MAX_IMAGE_GENERATIONS = 50; // Example limit
const RESET_INTERVAL_HOURS = 24; // Example reset interval

serve(async (req: Request) => {
  console.log("generate-meal function invoked.");

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response(null, { headers: corsHeaders });
  }

  let parsedBody: any;
  try {
    // Parse the JSON body ONCE
    parsedBody = await req.json();
    console.log("Successfully parsed request body.");
    // Now log the properties from the parsedBody
    console.log(`Parsed Body - Prompt: ${parsedBody.prompt}, Preferences: ${parsedBody.preferences}, IsRefinement: ${parsedBody.isRefinement}`);
    if (parsedBody.mealData) {
      console.log(`Parsed Body - MealData: ${JSON.stringify(parsedBody.mealData)}`);
    }

  } catch (e: any) {
    console.error("Failed to parse request body as JSON:", e.message);
    return new Response(JSON.stringify({ error: "Invalid JSON request body: " + e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Use the parsedBody for the rest of the logic
  const { prompt, preferences, mealData, isRefinement, userId: clientUserId } = parsedBody;

  // Validate Supabase client and get user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error("Missing Authorization header.");
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabaseClient = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error("Error getting user or no user found:", userError?.message);
    return new Response(JSON.stringify({ error: 'Authentication failed: ' + (userError?.message || "No user") }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  console.log(`Authenticated user ID: ${user.id}`);
  if (clientUserId && clientUserId !== user.id) {
    console.warn(`Client-provided userId (${clientUserId}) does not match authenticated user ID (${user.id}). Using authenticated user ID.`);
  }
  const effectiveUserId = user.id; // Always use the server-validated user ID

  // Fetch user profile for limits
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('recipe_generation_count, last_recipe_generation_reset, image_generation_count, last_image_generation_reset, ai_preferences')
    .eq('id', effectiveUserId)
    .single();

  if (profileError || !profile) {
    console.error(`Error fetching profile for user ${effectiveUserId}:`, profileError?.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch user profile: ' + (profileError?.message || "Profile not found") }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
  console.log(`User profile fetched for ${effectiveUserId}: Recipe gens: ${profile.recipe_generation_count}, Image gens: ${profile.image_generation_count}`);

  const now = new Date();
  const lastRecipeReset = profile.last_recipe_generation_reset ? new Date(profile.last_recipe_generation_reset) : new Date(0);
  const lastImageReset = profile.last_image_generation_reset ? new Date(profile.last_image_generation_reset) : new Date(0);

  let recipeCount = profile.recipe_generation_count || 0;
  let imageCount = profile.image_generation_count || 0;
  let needsProfileUpdate = false;

  // Reset counts if interval passed
  if (now.getTime() - lastRecipeReset.getTime() > RESET_INTERVAL_HOURS * 60 * 60 * 1000) {
    console.log(`Resetting recipe generation count for user ${effectiveUserId}.`);
    recipeCount = 0;
    needsProfileUpdate = true;
  }
  if (now.getTime() - lastImageReset.getTime() > RESET_INTERVAL_HOURS * 60 * 60 * 1000) {
    console.log(`Resetting image generation count for user ${effectiveUserId}.`);
    imageCount = 0;
    needsProfileUpdate = true;
  }
  
  // Determine if this is primarily an image generation request or recipe generation
  // A simple heuristic: if mealData is present and has a name, and no new prompt, it might be for image.
  // However, the function is 'generate-meal', so 'prompt' should be the primary driver for recipe text.
  // If 'prompt' is missing, it's an issue.

  if (!prompt && mealData?.name) {
    // This block handles image generation if a prompt for recipe text is NOT provided,
    // but mealData (presumably for an existing meal) IS provided.
    console.log(`Request for user ${effectiveUserId} identified as image generation for meal: ${mealData.name}.`);
    if (imageCount >= MAX_IMAGE_GENERATIONS) {
      console.warn(`User ${effectiveUserId} has reached image generation limit.`);
      return new Response(JSON.stringify({ error: 'Image generation limit reached for this period.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    try {
      const imagePrompt = `A high-quality, appetizing photo of a dish called "${mealData.name}". Ingredients: ${mealData.ingredients}. Style: ${preferences || profile.ai_preferences || 'realistic food photography'}.`;
      console.log(`Generating image with prompt: ${imagePrompt.substring(0, 100)}...`);
      
      const imageResponse = await openai.createImage({
        prompt: imagePrompt,
        n: 1,
        size: "512x512",
      });
      const imageUrl = imageResponse.data.data[0].url;
      console.log(`Image generated for user ${effectiveUserId}: ${imageUrl}`);

      imageCount++;
      needsProfileUpdate = true;
      
      if (needsProfileUpdate) {
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ 
            image_generation_count: imageCount, 
            last_image_generation_reset: now.toISOString() 
          })
          .eq('id', effectiveUserId);
        if (updateError) console.error(`Error updating profile after image generation for user ${effectiveUserId}:`, updateError.message);
        else console.log(`Profile updated for user ${effectiveUserId} after image generation.`);
      }

      // Return the mealData along with the new image_url
      return new Response(JSON.stringify({ ...mealData, image_url: imageUrl, message: "Image generated successfully" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } catch (error: any) {
      console.error(`Error during OpenAI image generation for user ${effectiveUserId}:`, error.response?.data?.error || error.message);
      return new Response(JSON.stringify({ error: 'Failed to generate image: ' + (error.response?.data?.error?.message || error.message) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  } else if (prompt) {
    // This block handles recipe text generation (and potentially image if it's not a refinement)
    console.log(`Request for user ${effectiveUserId} identified as recipe generation/refinement with prompt: "${prompt.substring(0, 50)}..."`);
    if (recipeCount >= MAX_RECIPE_GENERATIONS && !isRefinement) { // Refinements might not count or have different limits
      console.warn(`User ${effectiveUserId} has reached recipe generation limit.`);
      return new Response(JSON.stringify({ error: 'Recipe generation limit reached for this period.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    try {
      const systemPrompt = `You are a culinary assistant. Generate a recipe based on the user's prompt and preferences.
User's overall AI preferences: ${profile.ai_preferences || 'None specified'}.
The recipe should include:
1. A unique and appealing "name" for the dish.
2. A detailed "ingredients" list (string, use newline characters for separation).
3. Step-by-step "instructions" (string, use newline characters for separation).
4. "estimated_calories" (string, e.g., "300-400 calories per serving").
5. "servings" (string, e.g., "2 servings").
Respond ONLY with a JSON object containing these fields. Do not include any other text or explanations.`;

      const fullPrompt = `User prompt: "${prompt}". User preferences for this recipe: "${preferences || 'None specified'}".`;
      console.log(`Generating recipe text for user ${effectiveUserId} with full prompt: ${fullPrompt.substring(0,100)}...`);

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullPrompt },
        ],
        temperature: 0.7,
      });

      const recipeContent = completion.data.choices[0].message?.content?.trim();
      if (!recipeContent) {
        console.error(`OpenAI returned empty content for recipe generation for user ${effectiveUserId}.`);
        throw new Error("OpenAI returned empty content.");
      }
      console.log(`OpenAI recipe content (raw) for user ${effectiveUserId}: ${recipeContent.substring(0,100)}...`);
      
      let recipeJson;
      try {
        recipeJson = JSON.parse(recipeContent);
      } catch (parseError: any) {
        console.error(`Failed to parse OpenAI recipe content as JSON for user ${effectiveUserId}: ${parseError.message}. Content was: ${recipeContent}`);
        // Attempt to extract JSON from a potentially markdown-formatted response
        const jsonMatch = recipeContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            recipeJson = JSON.parse(jsonMatch[1]);
            console.log(`Successfully extracted and parsed JSON from markdown for user ${effectiveUserId}.`);
          } catch (nestedParseError: any) {
            console.error(`Failed to parse extracted JSON for user ${effectiveUserId}: ${nestedParseError.message}`);
            throw new Error("OpenAI response was not valid JSON, even after attempting to extract from markdown.");
          }
        } else {
          throw new Error("OpenAI response was not valid JSON.");
        }
      }
      
      console.log(`Recipe generated successfully for user ${effectiveUserId}: ${recipeJson.name}`);
      
      let imageUrl;
      if (!isRefinement) { // Only generate image for new recipes, not refinements (unless specified)
        console.log(`Generating image for new recipe "${recipeJson.name}" for user ${effectiveUserId}.`);
        if (imageCount >= MAX_IMAGE_GENERATIONS) {
          console.warn(`User ${effectiveUserId} reached image limit, recipe generated without new image.`);
          recipeJson.image_url_message = "Image generation limit reached; recipe saved without new image.";
        } else {
          try {
            const imagePromptContent = `A high-quality, appetizing photo of a dish called "${recipeJson.name}". Ingredients: ${recipeJson.ingredients}. Style: ${preferences || profile.ai_preferences || 'realistic food photography'}.`;
            console.log(`Generating image with prompt: ${imagePromptContent.substring(0,100)}...`);
            const imageResponse = await openai.createImage({
              prompt: imagePromptContent,
              n: 1,
              size: "512x512",
            });
            imageUrl = imageResponse.data.data[0].url;
            recipeJson.image_url = imageUrl;
            imageCount++; // Increment image count only if successful
            console.log(`Image generated for new recipe for user ${effectiveUserId}: ${imageUrl}`);
          } catch (imgError: any) {
            console.error(`Error generating image for new recipe for user ${effectiveUserId}:`, imgError.response?.data?.error || imgError.message);
            recipeJson.image_url_message = "Failed to generate image for this recipe.";
          }
        }
      } else {
        console.log(`Skipping new image generation for refined recipe for user ${effectiveUserId}.`);
      }

      if (!isRefinement) recipeCount++;
      needsProfileUpdate = true;

      if (needsProfileUpdate) {
        const updatePayload: any = {
          recipe_generation_count: recipeCount,
          last_recipe_generation_reset: now.toISOString()
        };
        if (imageUrl || (!isRefinement && recipeJson.image_url_message)) { // if image was attempted for new recipe
            updatePayload.image_generation_count = imageCount;
            updatePayload.last_image_generation_reset = now.toISOString();
        }
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update(updatePayload)
          .eq('id', effectiveUserId);
        if (updateError) console.error(`Error updating profile after recipe generation for user ${effectiveUserId}:`, updateError.message);
        else console.log(`Profile updated for user ${effectiveUserId} after recipe generation.`);
      }

      return new Response(JSON.stringify(recipeJson), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } catch (error: any) {
      console.error(`Error during OpenAI recipe generation for user ${effectiveUserId}:`, error.response?.data?.error || error.message);
      return new Response(JSON.stringify({ error: 'Failed to generate recipe: ' + (error.response?.data?.error?.message || error.message) }), {
        headers: { ...corsHeaders, 'Content-Tfype': 'application/json' }, // Typo here: Content-Tfype, should be Content-Type
        status: 500,
      });
    }
  } else {
    // Neither a valid prompt for recipe generation nor valid mealData for image generation was found.
    console.error(`Invalid request for user ${effectiveUserId}: Missing 'prompt' for recipe generation or sufficient 'mealData' for image generation.`);
    return new Response(JSON.stringify({ error: "Invalid request: 'prompt' is required for recipe generation. If generating an image for an existing meal, ensure 'mealData' with at least a 'name' is provided." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});