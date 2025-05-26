import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
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

    const { data: { user }, error: userError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false }
    }).auth.getUser();


    if (userError || !user) {
      console.error("Authentication failed:", userError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Authentication failed: Invalid or expired token." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Authenticated user:", user.id);

    const { data: profile, error: profileErrorDb } = await serviceSupabaseClient
      .from('profiles')
      .select('ai_preferences, is_admin, image_generation_count, last_image_generation_reset')
      .eq('id', user.id)
      .single();

    if (profileErrorDb && profileErrorDb.code !== 'PGRST116') {
        console.error("Error fetching user profile:", profileErrorDb);
        return new Response(JSON.stringify({ error: "Could not retrieve user profile." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    
    const userIsAdmin = profile?.is_admin || false;
    let userAiPreferences = profile?.ai_preferences || '';
    let userImageGenerationCount = profile?.image_generation_count || 0;
    let userLastImageGenerationReset = profile?.last_image_generation_reset || '';
    
    console.log(`User profile for ${user.id}: admin=${userIsAdmin}, count=${userImageGenerationCount}, resetMonth='${userLastImageGenerationReset}'`);

    const requestBody = await req.json();
    const { mealType, kinds, styles, preferences, mealData } = requestBody;

    let generatedMealData: GeneratedMeal | undefined;
    let mealNameForImage: string;
    let anImageWillBeGenerated = true;

    if (mealData) {
        console.log("Received existing meal data for image generation:", mealData.name);
        generatedMealData = mealData as GeneratedMeal;
        mealNameForImage = mealData.name;
        if (typeof generatedMealData.ingredients === 'string') {
             try { generatedMealData.ingredients = JSON.parse(generatedMealData.ingredients); } 
             catch (e) { console.warn("Failed to parse ingredients string from mealData:", e); generatedMealData.ingredients = []; }
        } else if (!Array.isArray(generatedMealData.ingredients)) { generatedMealData.ingredients = []; }
        if (!Array.isArray(generatedMealData.meal_tags)) { generatedMealData.meal_tags = []; }
        
        if (mealData.image_url) {
            anImageWillBeGenerated = false;
            console.log("MealData already contains an image_url. Skipping new image generation.");
            generatedMealData.image_url = mealData.image_url;
        }
    } else {
        console.log("Request body for full generation:", { mealType, kinds, styles, preferences });
        const serviceAccountJsonStringForGemini = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
        if (!serviceAccountJsonStringForGemini) { 
            console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set for Gemini.");
            throw new Error("AI service (Gemini) not configured.");
        }
        const accessTokenForGemini = await getAccessToken(serviceAccountJsonStringForGemini);
        const saGemini = JSON.parse(serviceAccountJsonStringForGemini);
        const projectIdGemini = saGemini.project_id;
        const regionGemini = "us-central1";
        const geminiModelId = "gemini-1.5-flash-001"; // Changed model ID
        const geminiEndpoint = `https://${regionGemini}-aiplatform.googleapis.com/v1/projects/${projectIdGemini}/locations/${regionGemini}/publishers/google/models/${geminiModelId}:generateContent`;
        
        let prompt = `Generate a detailed meal recipe in JSON format. The JSON object should have the following structure:
        {
          "name": "Meal Name (string, e.g., Spicy Chicken Stir-fry)",
          "ingredients": [
            { "name": "Ingredient Name (string)", "quantity": "Quantity (number or string like '1/2')", "unit": "Unit (string, e.g., 'cup', 'tbsp', 'g', 'piece')", "description": "Optional description (string, e.g., 'finely chopped')" }
          ],
          "instructions": "Detailed cooking instructions (string, newline separated steps).",
          "meal_tags": ["Tag1 (string)", "Tag2 (string)"] 
        }
        The meal should be a ${mealType || 'general'} type.`;
        if (kinds && kinds.length > 0) prompt += ` It should fit these kinds: ${kinds.join(', ')}.`;
        if (styles && styles.length > 0) prompt += ` The style should be: ${styles.join(', ')}.`;
        if (userAiPreferences) prompt += ` Consider these user preferences: ${userAiPreferences}.`;
        if (preferences) prompt += ` Also consider these specific request preferences: ${preferences}.`;
        prompt += ` Ensure the response is ONLY the JSON object, nothing else. Do not wrap it in markdown backticks.`;

        const geminiPayload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        };
        
        const geminiResponse = await fetch(geminiEndpoint, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessTokenForGemini}`, "Content-Type": "application/json" },
            body: JSON.stringify(geminiPayload),
        });

        if (!geminiResponse.ok) { 
            const errorText = await geminiResponse.text();
            console.error("Gemini API error:", errorText);
            throw new Error(`Gemini API request failed: ${geminiResponse.status} ${errorText}`);
        }
        const geminiData = await geminiResponse.json();
        const generatedContentString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedContentString) { 
            console.error("No content string from Gemini:", geminiData);
            throw new Error("Failed to generate recipe: No content from AI.");
        }
        try {
            generatedMealData = JSON.parse(generatedContentString);
            if (!generatedMealData.name || !Array.isArray(generatedMealData.ingredients) || !generatedMealData.instructions) { 
                console.error("Invalid recipe format from Gemini:", generatedMealData);
                throw new Error("Invalid recipe format from AI."); 
            }
        } catch (parseError) { 
            console.error("Failed to parse Gemini JSON response:", parseError, "Raw content:", generatedContentString);
            throw new Error("Failed to parse recipe from AI.");
        }
        console.log("Generated Recipe:", generatedMealData.name);
        mealNameForImage = generatedMealData.name;
    }

    if (anImageWillBeGenerated && !userIsAdmin) {
        const currentMonthYear = formatDate(new Date(), "yyyy-MM");
        if (userLastImageGenerationReset !== currentMonthYear) {
            console.log(`User ${user.id}: New month detected. Resetting generation count. Old: '${userLastImageGenerationReset}', New: '${currentMonthYear}'`);
            userImageGenerationCount = 0;
            userLastImageGenerationReset = currentMonthYear;
        }

        if (userImageGenerationCount >= IMAGE_GENERATION_LIMIT_PER_MONTH) {
            console.log(`User ${user.id} has reached the monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}. Current count: ${userImageGenerationCount}`);
            return new Response(JSON.stringify({ 
                error: `You have reached your monthly image generation limit of ${IMAGE_GENERATION_LIMIT_PER_MONTH}.`,
                ...(mealData ? {} : { mealData: generatedMealData }) 
            }), {
                status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    }
    
    if (anImageWillBeGenerated) {
        const serviceAccountJsonStringForImagen = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
        if (!serviceAccountJsonStringForImagen) {
            console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set for Imagen.");
            if (generatedMealData && !mealData) {
                 generatedMealData.image_url = undefined;
                 return new Response(JSON.stringify(generatedMealData), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
            }
            throw new Error("AI service (Imagen) not configured for image generation.");
        }

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
        
        console.log(`Attempting to call Imagen for user ${user.id}. Prompt: "${imagePromptText}"`);
        const imagenResponse = await fetch(imagenEndpoint, {
            method: "POST",
            headers: { "Authorization": `Bearer ${accessTokenForImagen}`, "Content-Type": "application/json" },
            body: JSON.stringify(imagenPayload),
        });

        let imageUrl: string | undefined = undefined;
        if (!imagenResponse.ok) {
            const errorBody = await imagenResponse.text();
            console.error(`Vertex AI Imagen API error for user ${user.id}: ${imagenResponse.status} ${imagenResponse.statusText}`, errorBody);
            console.warn(`Vertex AI Imagen failed. Proceeding without image for user ${user.id}.`);
        } else {
            const imagenData = await imagenResponse.json();
            const base64EncodedImage = imagenData.predictions?.[0]?.bytesBase64Encoded;
            if (base64EncodedImage) { 
                imageUrl = `data:image/png;base64,${base64EncodedImage}`; 
                console.log(`Image generated successfully for user ${user.id}.`);
            } else {
                console.warn(`No image data returned from Imagen for user ${user.id}. Predictions:`, imagenData.predictions);
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
            } else {
                console.log(`Successfully updated image generation count for user ${user.id} to ${userImageGenerationCount}. Reset month: ${userLastImageGenerationReset}`);
            }
        }
    }

    if (mealData) { 
         return new Response(
            JSON.stringify({ image_url: generatedMealData?.image_url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
         );
    } else { 
        if (!generatedMealData) { 
            console.error("Critical error: generatedMealData is undefined before final response.");
            throw new Error("Failed to generate meal data."); 
        }
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