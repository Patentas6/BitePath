import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
// import { parse } from "https://deno.land/std@0.224.0/yaml/parse.ts"; // Not used
import { format as formatDate } from "https://deno.land/std@0.224.0/datetime/format.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IMAGE_GENERATION_LIMIT_PER_MONTH = 30;

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
  image_url?: string;
}

async function getAccessToken(serviceAccountJsonString: string): Promise<string> {
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
    return data.access_token;
  } catch (error) {
    console.error("Error in getAccessToken:", error);
    throw new Error(`Authentication failed: ${(error as Error).message}`);
  }
}

serve(async (req) => {
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

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.error("Authentication failed: Authorization header missing.");
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await serviceSupabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Authentication failed:", userError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Authentication failed: Invalid or expired token." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Authenticated user:", user.id);

    // Fetch user's profile for preferences and generation limits
    const { data: profile, error: profileErrorDb } = await serviceSupabaseClient
      .from('profiles')
      .select('ai_preferences, is_admin, image_generation_count, last_image_generation_reset')
      .eq('id', user.id)
      .single();

    if (profileErrorDb && profileErrorDb.code !== 'PGRST116') { // PGRST116 means no row found
        console.error("Error fetching user profile:", profileErrorDb);
        return new Response(JSON.stringify({ error: "Could not retrieve user profile." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    
    const userIsAdmin = profile?.is_admin || false;
    let userAiPreferences = profile?.ai_preferences || '';
    let userImageGenerationCount = profile?.image_generation_count || 0;
    let userLastImageGenerationReset = profile?.last_image_generation_reset || '';
    
    console.log(`User profile fetched: admin=${userIsAdmin}, count=${userImageGenerationCount}, resetMonth=${userLastImageGenerationReset}`);

    const requestBody = await req.json();
    const { mealType, kinds, styles, preferences, mealData } = requestBody;

    let generatedMealData: GeneratedMeal | undefined;
    let mealNameForImage: string;
    let anImageWillBeGenerated = true; // Assume an image will be generated unless mealData is provided AND has an image_url

    if (mealData) {
        console.log("Received existing meal data for image generation:", mealData.name);
        generatedMealData = mealData as GeneratedMeal;
        mealNameForImage = mealData.name;
        if (typeof generatedMealData.ingredients === 'string') {
             try { generatedMealData.ingredients = JSON.parse(generatedMealData.ingredients); } 
             catch (e) { console.warn("Failed to parse ingredients string from mealData:", e); generatedMealData.ingredients = []; }
        } else if (!Array.isArray(generatedMealData.ingredients)) { generatedMealData.ingredients = []; }
        if (!Array.isArray(generatedMealData.meal_tags)) { generatedMealData.meal_tags = []; }
        
        // If mealData is provided and already has an image_url, we might not generate a new one.
        // For the "Add Meal" flow, image_url might be empty, so we'd generate.
        // If an image_url is already present in mealData, we skip Imagen.
        if (mealData.image_url) {
            anImageWillBeGenerated = false;
            console.log("MealData already contains an image_url. Skipping new image generation.");
            generatedMealData.image_url = mealData.image_url; // Ensure it's passed through
        }

    } else {
        // Full generation path (recipe text + image)
        console.log("Request body for full generation:", { mealType, kinds, styles, preferences });
        // ... (Gemini recipe generation logic remains the same)
        const serviceAccountJsonStringForGemini = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
        if (!serviceAccountJsonStringForGemini) { /* ... error handling ... */ }
        const accessTokenForGemini = await getAccessToken(serviceAccountJsonStringForGemini);
        const saGemini = JSON.parse(serviceAccountJsonStringForGemini);
        const projectIdGemini = saGemini.project_id;
        const regionGemini = "us-central1";
        const geminiModelId = "gemini-2.5-flash-preview-05-20";
        const geminiEndpoint = `https://${regionGemini}-aiplatform.googleapis.com/v1/projects/${projectIdGemini}/locations/${regionGemini}/publishers/google/models/${geminiModelId}:generateContent`;
        let prompt = `Generate a detailed meal recipe in JSON format...`; // Full prompt
        if (userAiPreferences) prompt += ` Consider these user preferences: ${userAiPreferences}.`;
        if (preferences) prompt += ` Also consider these specific request preferences: ${preferences}.`;
        prompt += ` Ensure the response is ONLY the JSON object, nothing else.`;
        
        const geminiResponse = await fetch(geminiEndpoint, { /* ... */ });
        if (!geminiResponse.ok) { /* ... error handling ... */ }
        const geminiData = await geminiResponse.json();
        const generatedContentString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedContentString) { /* ... error handling ... */ }
        try {
            const jsonMatch = generatedContentString.match(/```json\n([\s\S]*?)\n```/);
            const jsonString = jsonMatch ? jsonMatch[1] : generatedContentString;
            generatedMealData = JSON.parse(jsonString);
            if (!generatedMealData.name /* ... other checks ... */) { throw new Error("Invalid recipe format from Gemini."); }
        } catch (parseError) { /* ... error handling ... */ }
        console.log("Generated Recipe:", generatedMealData.name);
        mealNameForImage = generatedMealData.name;
    }

    // --- Image Generation Limit Check (only if anImageWillBeGenerated is true) ---
    if (anImageWillBeGenerated && !userIsAdmin) {
        const currentMonthYear = formatDate(new Date(), "yyyy-MM");
        if (userLastImageGenerationReset !== currentMonthYear) {
            console.log(`New month detected. Resetting generation count for user ${user.id}. Old month: ${userLastImageGenerationReset}, New month: ${currentMonthYear}`);
            userImageGenerationCount = 0;
            userLastImageGenerationReset = currentMonthYear;
            // Update in DB will happen after successful generation or with other profile updates
        }

        if (userImageGenerationCount >= IMAGE_GENERATION_LIMIT_PER_MONTH) {
            console.log(`User ${user.id} has reached the monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`);
            return new Response(JSON.stringify({ 
                error: `You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`,
                mealData: mealData ? undefined : generatedMealData // Return recipe if generated, but no image
            }), {
                status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    }
    
    // --- Step 2: Generate Image using Vertex AI Imagen (if anImageWillBeGenerated is true) ---
    if (anImageWillBeGenerated) {
        const serviceAccountJsonStringForImagen = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
        if (!serviceAccountJsonStringForImagen) {
            console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set for Imagen.");
            if (generatedMealData && !mealData) { // Full generation, return recipe without image
                 generatedMealData.image_url = undefined;
                 return new Response(JSON.stringify(generatedMealData), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
            }
            throw new Error("AI service not configured for image generation.");
        }

        const accessTokenForImagen = await getAccessToken(serviceAccountJsonStringForImagen);
        const saImagen = JSON.parse(serviceAccountJsonStringForImagen);
        const projectIdImagen = saImagen.project_id;
        const regionImagen = "us-central1";
        const imagenModelId = "imagegeneration@002";
        const imagenEndpoint = `https://${regionImagen}-aiplatform.googleapis.com/v1/projects/${projectIdImagen}/locations/${regionImagen}/publishers/google/models/${imagenModelId}:predict`;
        const imagePrompt = `A realistic photo of the meal "${mealNameForImage}". Focus on the finished dish presented nicely, ensuring main ingredients, especially protein, are clearly visible.`;
        
        console.log("Attempting to call Imagen endpoint for user:", user.id);
        const imagenResponse = await fetch(imagenEndpoint, { /* ... */ });

        if (!imagenResponse.ok) {
            const errorBody = await imagenResponse.json(); // Use .json() for Vertex AI errors
            console.error(`Vertex AI Imagen API error: ${imagenResponse.status} ${imagenResponse.statusText}`, errorBody);
            console.warn(`Vertex AI Imagen failed. Proceeding without image for user ${user.id}.`);
            if (generatedMealData) generatedMealData.image_url = undefined;
        } else {
            const imagenData = await imagenResponse.json();
            const base64EncodedImage = imagenData.predictions?.[0]?.bytesBase64Encoded;
            // ... (other image data extraction logic)
            let imageUrl;
            if (base64EncodedImage) { imageUrl = `data:image/png;base64,${base64EncodedImage}`; }
            // ...
            if (imageUrl && generatedMealData) {
                generatedMealData.image_url = imageUrl;
                console.log(`Image generated successfully for user ${user.id}.`);
            } else {
                 if (generatedMealData) generatedMealData.image_url = undefined;
            }
        }
        
        // Increment count if not admin and image generation was attempted
        if (!userIsAdmin) {
            userImageGenerationCount += 1;
            const { error: updateError } = await serviceSupabaseClient
                .from('profiles')
                .update({ 
                    image_generation_count: userImageGenerationCount,
                    last_image_generation_reset: userLastImageGenerationReset // This is currentMonthYear if reset happened
                })
                .eq('id', user.id);
            if (updateError) {
                console.error(`Failed to update image generation count for user ${user.id}:`, updateError);
                // Non-fatal, proceed with returning the meal data
            } else {
                console.log(`Successfully updated image generation count for user ${user.id} to ${userImageGenerationCount}. Reset month: ${userLastImageGenerationReset}`);
            }
        }
    } // End of anImageWillBeGenerated block

    // --- Step 3: Return Data ---
    if (mealData) { // If mealData was originally provided (e.g., from Add Meal form for image only)
         return new Response(
            JSON.stringify({ image_url: generatedMealData?.image_url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
         );
    } else { // Full generation, return the full meal data
        if (!generatedMealData) { throw new Error("Failed to generate meal data."); }
        return new Response(
          JSON.stringify(generatedMealData),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    }

  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(
      JSON.stringify({ error: `Failed to process request: ${error.message || 'Unknown error'}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});