import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "djwt"; // Import JWT functions
import { parse } from "https://deno.land/std@0.224.0/yaml/parse.ts"; // Using parse for PEM key
import { format } from "https://deno.land/std@0.224.0/datetime/format.ts"; // For logging timestamps

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
  image_url?: string;
}

// Helper function to get an OAuth2 access token using a service account key
async function getAccessToken(serviceAccountJsonString: string): Promise<string> {
  try {
    const sa = JSON.parse(serviceAccountJsonString);
    const privateKeyPem = sa.private_key;
    const clientEmail = sa.client_email;
    const projectId = sa.project_id;

    if (!privateKeyPem || !clientEmail || !projectId) {
        console.error("Missing required fields in service account JSON.");
        throw new Error("Invalid service account key format.");
    }

    // Google OAuth2 token endpoint
    const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
    const audience = tokenUri; // Audience is the token endpoint itself

    // JWT claims
    const now = getNumericDate(0);
    const expires = getNumericDate(3600); // Token valid for 1 hour

    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform", // Scope for Vertex AI
      aud: audience,
      iat: now,
      exp: expires,
    };

    // Import the private key
    // Need to convert PEM to JWK or use SubtleCrypto directly
    // SubtleCrypto requires PKCS8 format, PEM is usually PKCS8 or PKCS1
    // Let's assume PKCS8 for now, or try parsing
    let privateKey: CryptoKey;
    try {
        // Attempt to parse PEM and import
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const pemContents = privateKeyPem.substring(pemHeader.length, privateKeyPem.length - pemFooter.length).trim();
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        privateKey = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            {
                name: "RSASSA-PKCS1-v1_5", // Or "ECDSA" depending on key type
                hash: "SHA-256",
            },
            false, // not extractable
            ["sign"]
        );
         console.log("Successfully imported private key.");
    } catch (importError) {
        console.error("Failed to import private key:", importError);
        throw new Error("Failed to import private key for JWT signing.");
    }


    // Create and sign the JWT
    const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, privateKey);
    console.log("Created signed JWT.");

    // Request the access token
    const response = await fetch(tokenUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
    console.log("Successfully obtained access token.");
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

  try {
    console.log(`[${format(new Date(), "yyyy-MM-dd HH:mm:ss")}] Edge Function received request for AI meal generation (Vertex AI).`);
    const { mealType, kinds, styles, preferences } = await req.json();
    console.log("Request body:", { mealType, kinds, styles, preferences });

    // Get the service account key JSON from secrets
    const serviceAccountJsonString = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
    if (!serviceAccountJsonString) {
      console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON secret not set.");
      return new Response(JSON.stringify({ error: "AI service not configured. Please set VERTEX_SERVICE_ACCOUNT_KEY_JSON secret." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtain access token
    const accessToken = await getAccessToken(serviceAccountJsonString);
    console.log("Obtained access token.");

    const sa = JSON.parse(serviceAccountJsonString);
    const projectId = sa.project_id;
    const region = "us-central1"; // Specify your Vertex AI region

    // --- Step 1: Generate Recipe using Vertex AI Gemini ---
    const geminiModelId = "gemini-1.5-flash-001"; // Using a suitable Gemini model on Vertex
    const geminiEndpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${geminiModelId}:generateContent`;

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

    console.log("Sending prompt to Vertex AI Gemini:", prompt);

    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Vertex AI Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`, errorBody);
      throw new Error(`AI API error (Vertex Gemini): ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedContentString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContentString) {
       console.error("Vertex AI Gemini response did not contain expected content.", geminiData);
       throw new Error("Vertex AI Gemini did not return a valid recipe.");
    }

    let generatedMealData: GeneratedMeal;
    try {
        const jsonMatch = generatedContentString.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : generatedContentString;
        generatedMealData = JSON.parse(jsonString);
        if (!generatedMealData.name || !Array.isArray(generatedMealData.ingredients) || !generatedMealData.instructions || !Array.isArray(generatedMealData.meal_tags)) {
             console.error("Parsed Vertex AI Gemini JSON does not match expected structure:", generatedMealData);
             throw new Error("Vertex AI Gemini returned invalid recipe format.");
        }
    } catch (parseError) {
        console.error("Failed to parse Vertex AI Gemini response JSON:", generatedContentString, parseError);
        throw new Error(`Failed to parse Vertex AI Gemini response: ${(parseError as Error).message}`);
    }

    console.log("Generated Recipe:", generatedMealData.name);

    // --- Step 2: Generate Image using Vertex AI Imagen ---
    const imagenModelId = "imagegeneration@002"; // Using a suitable Imagen model on Vertex
    const imagenEndpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${imagenModelId}:predict`;

    const imagePrompt = `A realistic photo of the meal "${generatedMealData.name}". Focus on the finished dish presented nicely.`;
    console.log("Sending prompt to Vertex AI Imagen:", imagePrompt);

    const imagenResponse = await fetch(imagenEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: [{ prompt: imagePrompt }],
            parameters: { sampleCount: 1, aspect_ratio: "1:1" } // Request 1 image, square aspect ratio
        }),
    });

    if (!imagenResponse.ok) {
        const errorBody = await imagenResponse.json();
        console.error(`Vertex AI Imagen API error: ${imagenResponse.status} ${imagenResponse.statusText}`, errorBody);
        // Decide if you want to throw an error or just proceed without an image
        // For now, let's throw an error if image generation fails
        throw new Error(`AI API error (Vertex Imagen): ${imagenResponse.statusText} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const imagenData = await imagenResponse.json();
    console.log("Vertex AI Imagen API response:", imagenData);

    // Vertex AI Imagen response structure might vary, check documentation
    // Assuming the response contains a 'predictions' array with image data/urls
    const imageUrl = imagenData.predictions?.[0]?.bytesBase64 ? `data:image/png;base64,${imagenData.predictions[0].bytesBase64}` : imagenData.predictions?.[0]?.urls?.[0];


    if (!imageUrl) {
        console.error("Vertex AI Imagen response did not contain an image URL or data.", imagenData);
        // Let's proceed without an image if the URL/data is missing but the API call was OK
        console.warn("No image URL or data returned from Vertex AI Imagen, proceeding without image.");
        generatedMealData.image_url = undefined; // Ensure it's not set if missing
    } else {
        generatedMealData.image_url = imageUrl;
        console.log("Generated Image URL/Data:", imageUrl.substring(0, 50) + "..."); // Log snippet
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