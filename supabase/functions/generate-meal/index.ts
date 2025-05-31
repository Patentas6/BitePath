import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";
import { format as formatDate } from "https://deno.land/std@0.224.0/datetime/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Re-using the robust getAccessToken function you provided
async function getAccessToken(serviceAccountJsonString: string): Promise<string> {
  const getAccessTokenStartTime = Date.now();
  try {
    const sa = JSON.parse(serviceAccountJsonString);
    const privateKeyPem = sa.private_key;
    const clientEmail = sa.client_email;
    // const projectId = sa.project_id; // Project ID is in the SA, used implicitly by Google's token URI

    if (!privateKeyPem || !clientEmail) {
      console.error("Missing required fields (private_key, client_email) in service account JSON.");
      throw new Error("Invalid service account key format.");
    }

    const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
    const audience = tokenUri;
    const now = getNumericDate(0); // current time
    const expires = getNumericDate(3600); // 1 hour from now

    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform", // Broad scope, ensure it's appropriate
      aud: audience,
      iat: now,
      exp: expires,
    };

    // Prepare the private key for import
    const cleanedPrivateKeyPem = privateKeyPem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s+/g, ''); // Remove all whitespace and newlines
    
    const binaryDer = Uint8Array.from(atob(cleanedPrivateKeyPem), (c) => c.charCodeAt(0));

    let cryptoKey;
    try {
        cryptoKey = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false, // not extractable
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
    // Do not re-throw generic "Authentication failed" if it's already a specific error
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

    // Ensure you have the correct region and model ID for your Vertex AI setup
    // Example: gemini-1.5-flash-001 or gemini-1.0-pro
    const modelId = "gemini-1.5-flash-001"; 
    const region = "us-central1"; // Replace with your Vertex AI region
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
        // Add generationConfig if needed, e.g.,
        // generation_config: {
        //   "maxOutputTokens": 2048,
        //   "temperature": 0.7,
        //   "topP": 1,
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