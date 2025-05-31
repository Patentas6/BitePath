import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import { format as formatDate, parse as parseDate, difference } from "https://deno.land/std@0.224.0/datetime/mod.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IMAGE_GENERATION_LIMIT_PER_MONTH = 30;
const RECIPE_GENERATION_LIMIT_PER_PERIOD = 100;
const RECIPE_GENERATION_PERIOD_DAYS = 15;

interface GeneratedIngredient {
  name: string;
  quantity: number | string | null; // Allow null for "to taste"
  unit: string | null; // Allow null for "to taste"
  description?: string;
}

interface GeneratedMeal {
  name: string;
  ingredients: GeneratedIngredient[] | string;
  instructions: string;
  meal_tags: string[];
  image_url?: string;
  estimated_calories?: string;
  servings?: string;
}

async function getAccessToken(serviceAccountJsonString: string): Promise<string> {
  const getAccessTokenStartTime = Date.now();
  try {
    const sa = JSON.parse(serviceAccountJsonString);
    let privateKeyPem = sa.private_key;
    const clientEmail = sa.client_email;
    const projectId = sa.project_id;

    if (!privateKeyPem || !clientEmail || !projectId) {
        console.error("Missing required fields in service account JSON.");
        throw new Error("Invalid service account key format.");
    }

    const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
    const audience = tokenUri;

    const now = getNumericDate(0);
    const expires = getNumericDate(3600);

    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: audience,
      iat: now,
      exp: expires,
    };

    let privateKey: CryptoKey;
    try {
        privateKeyPem = privateKeyPem
            .replace('-----BEGIN PRIVATE KEY-----', '')
            .replace('-----END PRIVATE KEY-----', '')
            .replace(/\s+/g, '');

        const binaryDer = Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0));

        privateKey = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );
    } catch (importError) {
        console.error("Failed to import private key:", importError);
        throw new Error("Failed to import private key for JWT signing.");
    }

    const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, privateKey);

    const response = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Token exchange error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Failed to obtain access token: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] getAccessToken completed. Duration: ${Date.now() - getAccessTokenStartTime}ms`);
    return data.access_token;
  } catch (error) {
    console.error(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Error in getAccessToken. Duration: ${Date.now() - getAccessTokenStartTime}ms`, error);
    throw new Error(`Authentication failed: ${(error as Error).message}`);
  }
}

serve(async (req) => {
  const functionStartTime = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let serviceSupabaseClient: SupabaseClient;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase URL or Service Role Key not configured.");
      return new Response(JSON.stringify({ error: "Server configuration error." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    serviceSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Edge Function received request.`);
    let stageStartTime = Date.now();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.error("Authentication failed: Authorization header missing.");
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false }
    }).auth.getUser();

    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] User authentication completed. Duration: ${Date.now() - stageStartTime}ms`);
    stageStartTime = Date.now();

    if (userError || !user) {
      console.error("Authentication failed:", userError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Authentication failed: Invalid or expired token." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Authenticated user:", user.id);

    const { data: profile, error: profileErrorDb } = await serviceSupabaseClient
      .from('profiles')
      .select('ai_preferences, is_admin, image_generation_count, last_image_generation_reset, recipe_generation_count, last_recipe_generation_reset, track_calories, preferred_unit_system')
      .eq('id', user.id)
      .single();

    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] User profile fetch completed. Duration: ${Date.now() - stageStartTime}ms`);
    stageStartTime = Date.now();

    if (profileErrorDb && profileErrorDb.code !== 'PGRST116') {
        console.error("Error fetching user profile:", profileErrorDb);
        return new Response(JSON.stringify({ error: "Could not retrieve user profile." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const userIsAdmin = profile?.is_admin || false;
    let userAiPreferences = profile?.ai_preferences || '';
    const userTracksCalories = profile?.track_calories || false;
    const userPreferredUnitSystem = profile?.preferred_unit_system || 'imperial';

    let userImageGenerationCount = profile?.image_generation_count || 0;
    let userLastImageGenerationReset = profile?.last_image_generation_reset || '';

    let userRecipeGenerationCount = profile?.recipe_generation_count || 0;
    let userLastRecipeGenerationResetDateStr = profile?.last_recipe_generation_reset || '';

    console.log(`User profile for ${user.id}: admin=${userIsAdmin}, track_calories=${userTracksCalories}, preferred_unit_system=${userPreferredUnitSystem}, img_count=${userImageGenerationCount}, img_reset='${userLastImageGenerationReset}', recipe_count=${userRecipeGenerationCount}, recipe_reset='${userLastRecipeGenerationResetDateStr}'`);

    const requestBody = await req.json();
    const { mealType, kinds, styles, preferences, mealData, existingRecipeText, refinementInstructions } = requestBody;

    let generatedMealData: GeneratedMeal | undefined;
    let mealNameForImage: string | undefined;
    let anImageShouldBeGenerated = false;

    if (mealData) {
        console.log("Received existing meal data for image generation (or re-generation):", mealData.name);
        generatedMealData = mealData as GeneratedMeal;
        mealNameForImage = mealData.name;
        if (typeof generatedMealData.ingredients === 'string') {
             try { generatedMealData.ingredients = JSON.parse(generatedMealData.ingredients); }
             catch (e) { console.warn("Failed to parse ingredients string from mealData:", e); generatedMealData.ingredients = []; }
        } else if (!Array.isArray(generatedMealData.ingredients)) { generatedMealData.ingredients = []; }
        if (!Array.isArray(generatedMealData.meal_tags)) { generatedMealData.meal_tags = []; }

        anImageShouldBeGenerated = true;
        console.log("Proceeding to generate/re-generate image for:", mealNameForImage);

    } else {
        if (!userIsAdmin) {
            const today = new Date();
            const todayStr = formatDate(today, "yyyy-MM-dd");
            let resetRecipePeriod = false;

            if (!userLastRecipeGenerationResetDateStr) {
                resetRecipePeriod = true;
            } else {
                try {
                    const lastResetDate = parseDate(userLastRecipeGenerationResetDateStr, "yyyy-MM-dd");
                    const daysSinceLastReset = difference(today, lastResetDate, { units: ["days"] }).days || 0;
                    if (daysSinceLastReset >= RECIPE_GENERATION_PERIOD_DAYS) {
                        resetRecipePeriod = true;
                    }
                } catch (dateParseError) {
                    console.error(`Error parsing last_recipe_generation_reset date '${userLastRecipeGenerationResetDateStr}':`, dateParseError);
                    resetRecipePeriod = true;
                }
            }

            if (resetRecipePeriod) {
                userRecipeGenerationCount = 0;
                userLastRecipeGenerationResetDateStr = todayStr;
            }

            if (userRecipeGenerationCount >= RECIPE_GENERATION_LIMIT_PER_PERIOD) {
                return new Response(JSON.stringify({
                    error: `You have reached your recipe generation limit of ${RECIPE_GENERATION_LIMIT_PER_PERIOD} per ${RECIPE_GENERATION_PERIOD_DAYS} days. Please try again later.`
                }), {
                    status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Starting recipe generation specific logic.`);
        const recipeGenerationStartTime = Date.now();

        const serviceAccountJsonStringForGemini = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
        if (!serviceAccountJsonStringForGemini) {
            console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set for Gemini.");
            throw new Error("AI service (Gemini) not configured.");
        }
        const preGeminiCallTime = Date.now();
        const accessTokenForGemini = await getAccessToken(serviceAccountJsonStringForGemini);
        console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] getAccessToken and prompt construction completed. Duration: ${Date.now() - preGeminiCallTime}ms`);

        const saGemini = JSON.parse(serviceAccountJsonStringForGemini);
        const projectIdGemini = saGemini.project_id;
        const regionGemini = "us-central1";
        const geminiModelId = "gemini-2.5-flash-preview-05-20"; 
        const geminiEndpoint = `https://${regionGemini}-aiplatform.googleapis.com/v1/projects/${projectIdGemini}/locations/${regionGemini}/publishers/google/models/${geminiModelId}:generateContent`;

        let prompt = `Generate a detailed meal recipe in JSON format. The JSON object must have the following structure:
        {
          "name": "Meal Name (string, e.g., Spicy Chicken Stir-fry)",
          "ingredients": [
            { "name": "Ingredient Name (string)", "quantity": "Quantity (number or string like '1/2', or null if 'to taste')", "unit": "Unit (string, e.g., 'cup', 'tbsp', 'g', 'piece', or null if 'to taste')", "description": "Optional description (string, e.g., 'finely chopped', or 'to taste' if applicable)" }
          ],
          "instructions": "Detailed cooking instructions (string, newline separated steps).",
          "meal_tags": ["Tag1 (string)", "Tag2 (string)"],
          "servings": "Estimated number of servings this recipe makes (string, e.g., '4' or '2-3 servings'). THIS FIELD IS MANDATORY.",
          "estimated_calories": "Estimated total calories for the ENTIRE recipe (all servings) (string, e.g., '2200 kcal' or '500-600 kcal total'). THIS FIELD IS MANDATORY."
        }
        IMPORTANT:
        - The "servings" field MUST contain the number of servings (e.g., "4", "2 servings").
        - The "estimated_calories" field MUST contain the total calorie count for the entire recipe (e.g., "2000 kcal total", "550 kcal"). Do NOT put per-serving calories here.
        - Do NOT embed serving information within the "estimated_calories" string. Keep them separate. For example, "estimated_calories": "2000 kcal", "servings": "4". NOT "estimated_calories": "500 kcal per serving (serves 4)".
        - For ingredients like salt, pepper, or others specified 'to taste':
            - Set the \`quantity\` field to \`null\`.
            - Set the \`unit\` field to \`null\`.
            - Set the \`description\` field to the string \`"to taste"\`.
            Example: { "name": "Black Pepper", "quantity": null, "unit": null, "description": "to taste" }`;

        if (userPreferredUnitSystem === 'metric') {
            prompt += `\nUNIT SYSTEM: The user's preferred unit system is METRIC. Please provide all ingredient quantities primarily in grams (g), kilograms (kg), milliliters (ml), or liters (L). For common small measurements like spices, you can use teaspoons (tsp) or tablespoons (tbsp). For items counted as whole units, use 'piece' or similar. Avoid imperial units like ounces, pounds, fluid ounces, and especially cups for bulk ingredients like flour/sugar (these should be in grams or ml).`;
        } else {
            prompt += `\nUNIT SYSTEM: The user's preferred unit system is IMPERIAL. Please provide ingredient quantities in common imperial units (e.g., cups, oz, lbs, tsp, tbsp, fl oz).`;
        }

        if (existingRecipeText && refinementInstructions) {
            prompt += `\n\nYou previously generated the following recipe:
Name: ${existingRecipeText.name}
Ingredients: ${typeof existingRecipeText.ingredients === 'string' ? existingRecipeText.ingredients : JSON.stringify(existingRecipeText.ingredients)}
Instructions: ${existingRecipeText.instructions}
Original Tags: ${JSON.stringify(existingRecipeText.meal_tags)}
${existingRecipeText.estimated_calories ? `Original Estimated Calories: ${existingRecipeText.estimated_calories}` : ''}
${existingRecipeText.servings ? `Original Servings: ${existingRecipeText.servings}` : ''}

Now, please refine this recipe based on the following request: "${refinementInstructions}".
Ensure the output is a *complete new recipe* in the specified JSON format, incorporating the changes.
The meal should still generally be a ${mealType || 'general'} type.`;
            if (kinds && kinds.length > 0) prompt += ` It should still generally fit these kinds: ${kinds.join(', ')}.`;
            if (styles && styles.length > 0) prompt += ` The style should still generally be: ${styles.join(', ')}.`;
            prompt += `\nCRITICAL INSTRUCTION FOR SCALING SERVINGS: If the refinement request involves changing the number of servings (e.g., from '2 servings' to '4 servings', or vice-versa), you MUST adjust ALL ingredient quantities. Calculate the scaling factor (new servings / old servings). For EACH ingredient, multiply its original quantity by this scaling factor. For example, if changing from 2 to 4 servings, the factor is 2, so all quantities double. If changing from 4 to 2 servings, the factor is 0.5, so all quantities halve. This scaling MUST be applied consistently to every ingredient. Do not selectively scale or invert the scaling for any ingredients. Update the 'servings' field to the new number of servings. Also update the 'estimated_calories' field by multiplying the original total calories by the same scaling factor.`;
        } else {
            prompt += `\nThe meal should be a ${mealType || 'general'} type.`;
            if (kinds && kinds.length > 0) prompt += ` It should fit these kinds: ${kinds.join(', ')}.`;
            if (styles && styles.length > 0) prompt += ` The style should be: ${styles.join(', ')}.`;
        }

        if (userAiPreferences) prompt += ` Consider these user profile preferences: ${userAiPreferences}.`;
        if (preferences && !existingRecipeText) {
             prompt += ` Also consider these specific request preferences: ${preferences}.`;
        }
        prompt += `\nEnsure "estimated_calories" (total for recipe) and "servings" are always provided.`;
        prompt += `\nEnsure the response is ONLY the JSON object, nothing else. Do not wrap it in markdown backticks.`;

        const geminiPayload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        };

        console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Starting Gemini API call for user ${user.id}. Model: ${geminiModelId}`);
        const geminiStartTime = Date.now();
        const geminiResponse = await fetch(geminiEndpoint, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessTokenForGemini}`, "Content-Type": "application/json" },
            body: JSON.stringify(geminiPayload),
        });
        const geminiEndTime = Date.now();
        console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Gemini API call completed for user ${user.id}. Duration: ${geminiEndTime - geminiStartTime}ms. Status: ${geminiResponse.status}`);
        console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Recipe generation completed. Duration: ${Date.now() - recipeGenerationStartTime}ms`);

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API error:", errorText);
            let errorMessage = errorText;
            try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.error?.message || errorText; } catch (e) { /* ignore */ }
            throw new Error(`Gemini API request failed: ${geminiResponse.status} ${errorMessage}. Duration: ${geminiEndTime - geminiStartTime}ms`);
        }
        const geminiData = await geminiResponse.json();
        const generatedContentString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedContentString) {
            console.error("No content string from Gemini. Full response:", JSON.stringify(geminiData, null, 2));
            throw new Error("Failed to generate recipe: No content from AI.");
        }
        try {
            generatedMealData = JSON.parse(generatedContentString);
            if (!generatedMealData || !generatedMealData.name || !Array.isArray(generatedMealData.ingredients) || !generatedMealData.instructions || generatedMealData.servings === undefined || generatedMealData.estimated_calories === undefined) {
                console.error("Invalid recipe format from Gemini (missing servings, estimated_calories or other core fields):", generatedMealData);
                throw new Error("Invalid recipe format from AI. Check Gemini output structure (especially 'servings' and 'estimated_calories').");
            }
            if (generatedMealData.estimated_calories === undefined) {
                console.warn("AI did not return 'estimated_calories' even though it was requested as mandatory.");
            }
        } catch (parseError) {
            console.error("Failed to parse Gemini JSON response:", parseError, "Raw content from Gemini:", generatedContentString);
            throw new Error("Failed to parse recipe from AI. The AI may have returned non-JSON text or incomplete JSON.");
        }

        if (generatedMealData) {
            mealNameForImage = generatedMealData.name;
            anImageShouldBeGenerated = true;
            console.log(existingRecipeText ? "Refined Recipe Text:" : "Generated Recipe Text:", generatedMealData.name);
            if (generatedMealData.estimated_calories) console.log("Estimated Calories:", generatedMealData.estimated_calories);
            if (generatedMealData.servings) console.log("Servings:", generatedMealData.servings);
        }

        if (!userIsAdmin) {
            userRecipeGenerationCount += 1;
            const { error: updateRecipeCountError } = await serviceSupabaseClient
                .from('profiles')
                .update({
                    recipe_generation_count: userRecipeGenerationCount,
                    last_recipe_generation_reset: userLastRecipeGenerationResetDateStr
                })
                .eq('id', user.id);
            if (updateRecipeCountError) {
                console.error(`Failed to update recipe generation count for user ${user.id}:`, updateRecipeCountError);
            }
            console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Recipe count update completed. Duration: ${Date.now() - stageStartTime}ms`);
        }
    }

    if (anImageShouldBeGenerated && mealNameForImage) {
        if (!userIsAdmin) {
            const currentMonthYear = formatDate(new Date(), "yyyy-MM");
            if (userLastImageGenerationReset !== currentMonthYear) {
                userImageGenerationCount = 0;
                userLastImageGenerationReset = currentMonthYear;
            }

            if (userImageGenerationCount >= IMAGE_GENERATION_LIMIT_PER_MONTH) {
                if (!requestBody.mealData && generatedMealData) {
                    console.warn(`Image generation limit reached for user ${user.id}, but returning generated recipe text.`);
                    generatedMealData.image_url = undefined;
                } else {
                    return new Response(JSON.stringify({
                        error: `You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`,
                        ...(requestBody.mealData && {
                            mealData: {
                                ...generatedMealData,
                                image_url: generatedMealData?.image_url
                            }
                        })
                    }), {
                        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }
        }

        if (userIsAdmin || userImageGenerationCount < IMAGE_GENERATION_LIMIT_PER_MONTH || userLastImageGenerationReset !== formatDate(new Date(), "yyyy-MM")) {
            const serviceAccountJsonStringForImagen = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
            if (!serviceAccountJsonStringForImagen) {
                console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set for Imagen.");
                if (generatedMealData) generatedMealData.image_url = undefined;
            } else {
                const accessTokenForImagen = await getAccessToken(serviceAccountJsonStringForImagen);
                const saImagen = JSON.parse(serviceAccountJsonStringForImagen);
                const projectIdImagen = saImagen.project_id;
                const regionImagen = "us-central1";
                const imagenModelId = "imagegeneration@006";
                const imagenEndpoint = `https://${regionImagen}-aiplatform.googleapis.com/v1/projects/${projectIdImagen}/locations/${regionImagen}/publishers/google/models/${imagenModelId}:predict`;

                const imagePromptText = `A vibrant, appetizing, realistic photo of the meal "${mealNameForImage}". Focus on the finished dish presented nicely on a plate or in a bowl, suitable for a food blog. Ensure main ingredients are clearly visible. Good lighting, sharp focus.`;

                const imagenPayload = {
                  instances: [{ prompt: imagePromptText }],
                  parameters: { 
                    sampleCount: 1, 
                    aspectRatio: "1:1", 
                    outputFormat: "png" 
                  }
                };

                const imagenResponse = await fetch(imagenEndpoint, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${accessTokenForImagen}`, "Content-Type": "application/json" },
                    body: JSON.stringify(imagenPayload),
                });

                let imageUrl: string | undefined = undefined;
                if (!imagenResponse.ok) {
                    const errorBody = await imagenResponse.text();
                    console.error(`Vertex AI Imagen API error for user ${user.id}: ${imagenResponse.status} ${imagenResponse.statusText}`, errorBody);
                } else {
                    const imagenData = await imagenResponse.json();
                    const base64EncodedImage = imagenData.predictions?.[0]?.bytesBase64Encoded;
                    if (base64EncodedImage) {
                        imageUrl = `data:image/png;base64,${base64EncodedImage}`;
                    }
                }

                if (generatedMealData) generatedMealData.image_url = imageUrl;

                if (!userIsAdmin) {
                    userImageGenerationCount += 1;
                    const { error: updateError } = await serviceSupabaseClient
                        .from('profiles')
                        .update({
                            image_generation_count: userImageGenerationCount,
                            last_image_generation_reset: userLastImageGenerationReset
                        })
                        .eq('id', user.id);
                    if (updateError) {
                        console.error(`Failed to update image generation count for user ${user.id}:`, updateError);
                    }
                }
            }
        }
    }

    if (requestBody.mealData) {
         return new Response(
            JSON.stringify({
                image_url: generatedMealData?.image_url,
                estimated_calories: generatedMealData?.estimated_calories,
                servings: generatedMealData?.servings
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
         );
    } else if (generatedMealData) {
        return new Response(
          JSON.stringify(generatedMealData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } else {
        console.error("Critical error: No meal data to return after processing.");
        return new Response(JSON.stringify({ error: "Failed to process or generate meal data." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

  } catch (error) {
    console.error(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Error in Edge Function. Total duration: ${Date.now() - functionStartTime}ms`, error.message, error.stack);
    return new Response(
      JSON.stringify({ error: `Failed to process request: ${error.message || 'Unknown error'}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Edge Function processing complete. Total duration: ${Date.now() - functionStartTime}ms`);
});