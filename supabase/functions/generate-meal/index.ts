// --- IMPORTANT CONFIGURATION NOTES ---
//
// Google Cloud Project ID:
//   Extracted from the `project_id` field within the `VERTEX_SERVICE_ACCOUNT_KEY_JSON` environment variable.
//
// Authentication:
//   Uses OAuth 2.0 with a JWT bearer token. The `getAccessToken` function in this file handles:
//   1. Parsing the `VERTEX_SERVICE_ACCOUNT_KEY_JSON` environment variable.
//   2. Creating a signed JWT using the service account's private key and client email.
//   3. Exchanging this JWT for an access token from Google's token URI (`https://oauth2.googleapis.com/token`).
//   This access token is then used in the 'Authorization: Bearer <token>' header for Vertex AI API calls.
//
// Vertex AI Model:
//   Model ID: gemini-2.5-flash-preview-05-20
//   Region: us-central1 (Ensure this matches your Vertex AI setup)
//
// --- END CONFIGURATION NOTES ---

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import { format as formatDate } from "https://deno.land/std@0.224.0/datetime/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getAccessToken(serviceAccountJsonString: string): Promise<string> {
  const getAccessTokenStartTime = Date.now();
  try {
    const sa = JSON.parse(serviceAccountJsonString);
    const privateKeyPem = sa.private_key;
    const clientEmail = sa.client_email;

    if (!privateKeyPem || !clientEmail) {
      console.error("Missing required fields (private_key, client_email) in service account JSON.");
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

    const cleanedPrivateKeyPem = privateKeyPem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, ''); 
    
    const binaryDer = Uint8Array.from(atob(cleanedPrivateKeyPem), (c) => c.charCodeAt(0));

    let cryptoKey;
    try {
        cryptoKey = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false, 
            ["sign"]
        );
    } catch (importError) {
        console.error("Failed to import private key:", importError.message, importError.stack);
        console.error("Cleaned Private Key (first 64 chars):", cleanedPrivateKeyPem.substring(0,64));
        throw new Error(`Failed to import private key for JWT signing: ${importError.message}`);
    }
    
    const jwt = await create(
      { alg: "RS256", typ: "JWT" },
      payload,
      cryptoKey
    );

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
      throw new Error(`Failed to obtain access token: ${response.statusText}. Body: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] getAccessToken completed. Duration: ${Date.now() - getAccessTokenStartTime}ms`);
    return data.access_token;

  } catch (error) {
    console.error(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Error in getAccessToken. Duration: ${Date.now() - getAccessTokenStartTime}ms`, error.message, error.stack);
    throw error instanceof Error ? error : new Error(`Authentication failed: ${error.message}`);
  }
}

serve(async (req) => {
  const functionStartTime = Date.now();
  console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] generate-meal function invoked. Method: ${req.method}`);

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJsonString = Deno.env.get("VERTEX_SERVICE_ACCOUNT_KEY_JSON");
    if (!serviceAccountJsonString) {
      console.error("VERTEX_SERVICE_ACCOUNT_KEY_JSON environment variable not set.");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing credentials." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const serviceAccount = JSON.parse(serviceAccountJsonString);
    const googleProjectId = serviceAccount.project_id;
    if (!googleProjectId) {
        console.error("Project ID not found in service account JSON.");
        return new Response(JSON.stringify({ error: "Server configuration error: Missing project ID in credentials." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log("Attempting to get access token...");
    const accessToken = await getAccessToken(serviceAccountJsonString);
    console.log("Successfully obtained access token.");

    const { prompt, preferences } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing 'prompt' in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const fullPrompt = `Generate a meal recipe based on the following: ${prompt}. Preferences: ${preferences || 'No specific preferences.'}`;

    // --- Using the specified model ID ---
    const modelId = "gemini-2.5-flash-preview-05-20"; 
    const region = "us-central1"; // As noted in comments above
    const apiUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${googleProjectId}/locations/${region}/publishers/google/models/${modelId}:generateContent`;

    console.log(`Sending request to Vertex AI: ${apiUrl}`);
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }],
        }],
        // generation_config: { // You can uncomment and adjust these if needed
        //   "maxOutputTokens": 8192, // Max for gemini-1.5-flash is 8192, check for 2.5
        //   "temperature": 1.0,    // Default is 1.0 for flash models
        //   "topP": 0.95,          // Default is 0.95 for flash models
        // }
      }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      console.error(`Vertex AI API error: ${aiResponse.status} ${aiResponse.statusText}`, errorBody);
      return new Response(JSON.stringify({ error: `AI service error: ${aiResponse.statusText}`, details: errorBody }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    console.log("Successfully received response from Vertex AI.");
    console.log(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] generate-meal completed. Duration: ${Date.now() - functionStartTime}ms`);

    return new Response(JSON.stringify(aiData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(`[${formatDate(new Date(), "yyyy-MM-dd HH:mm:ss")}] Critical error in generate-meal function. Duration: ${Date.now() - functionStartTime}ms`, error.message, error.stack);
    return new Response(JSON.stringify({ error: "Internal server error.", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});