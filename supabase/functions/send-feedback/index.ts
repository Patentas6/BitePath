import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TO_EMAIL_ADDRESS = "YOUR_EMAIL_HERE@example.com"; 
const FROM_EMAIL_ADDRESS = "feedback-bitepath@yourdomain.com"; // Changed for clarity

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const feedbackData = await req.json();

    console.log("Received feedback submission (New Format):");
    // Log each piece of feedback if present
    const logEntries = [
      `Wishlist: ${feedbackData.q_wishlist || 'N/A'}`,
      `Do Differently: ${feedbackData.q_do_differently || 'N/A'}`,
      `Remove Feature: ${feedbackData.q_remove_feature || 'N/A'}`,
      `Pain - Grocery Listing (0-10): ${feedbackData.s_pain_grocery || 'N/A'}`,
      `Pain - Meal Planning (0-10): ${feedbackData.s_pain_planning || 'N/A'}`,
      `App Solves Pain (0-10): ${feedbackData.s_app_solves_pain || 'N/A'}`,
      `Favorite Feature: ${feedbackData.q_favorite_feature || 'N/A'}`,
      `Confusing Feature: ${feedbackData.q_confusing_feature || 'N/A'}`,
      `Additional Message: ${feedbackData.additional_message || 'N/A'}`,
    ];
    console.log(logEntries.join('\n'));

    // ** IMPORTANT: Email Sending Logic Placeholder **
    // Replace this section with your actual email sending logic using a service like Resend.
    // const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // if (!RESEND_API_KEY) {
    //   console.error("Resend API key is not set.");
    //   return new Response(JSON.stringify({ error: "Email service not configured." }), {
    //     status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }
    //
    // let emailHtmlBody = "<h1>New BitePath Feedback</h1>";
    // if (feedbackData.q_wishlist) emailHtmlBody += `<p><strong>Wishlist:</strong><br>${feedbackData.q_wishlist.replace(/\n/g, '<br>')}</p>`;
    // if (feedbackData.q_do_differently) emailHtmlBody += `<p><strong>Do Differently:</strong><br>${feedbackData.q_do_differently.replace(/\n/g, '<br>')}</p>`;
    // if (feedbackData.q_remove_feature) emailHtmlBody += `<p><strong>Remove Feature:</strong><br>${feedbackData.q_remove_feature.replace(/\n/g, '<br>')}</p>`;
    // emailHtmlBody += "<h2>Pain & Solution Scores (0-10):</h2>";
    // if (feedbackData.s_pain_grocery) emailHtmlBody += `<p>Pain - Grocery Listing: ${feedbackData.s_pain_grocery}</p>`;
    // if (feedbackData.s_pain_planning) emailHtmlBody += `<p>Pain - Meal Planning: ${feedbackData.s_pain_planning}</p>`;
    // if (feedbackData.s_app_solves_pain) emailHtmlBody += `<p>App Solves Pain: ${feedbackData.s_app_solves_pain}</p>`;
    // if (feedbackData.q_favorite_feature) emailHtmlBody += `<p><strong>Favorite Feature:</strong><br>${feedbackData.q_favorite_feature.replace(/\n/g, '<br>')}</p>`;
    // if (feedbackData.q_confusing_feature) emailHtmlBody += `<p><strong>Confusing Feature:</strong><br>${feedbackData.q_confusing_feature.replace(/\n/g, '<br>')}</p>`;
    // if (feedbackData.additional_message) emailHtmlBody += `<p><strong>Additional Message:</strong><br>${feedbackData.additional_message.replace(/\n/g, '<br>')}</p>`;
    //
    // const emailPayload = {
    //   from: FROM_EMAIL_ADDRESS,
    //   to: TO_EMAIL_ADDRESS,
    //   subject: "New BitePath User Feedback",
    //   html: emailHtmlBody,
    // };
    //
    // const resendResponse = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify(emailPayload),
    // });
    //
    // if (!resendResponse.ok) { /* ... error handling ... */ }
    // console.log("Email sent successfully (placeholder).");
    // End of Email Sending Logic Placeholder

    return new Response(
      JSON.stringify({ success: true, message: "Feedback received and logged. Email sending placeholder." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error processing feedback:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});