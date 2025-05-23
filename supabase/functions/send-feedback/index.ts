import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Specify allowed methods
};

// Placeholder for your email. Replace this with your actual email address.
const TO_EMAIL_ADDRESS = "YOUR_EMAIL_HERE@example.com"; 
// Placeholder for the "from" email. Some services require this to be a verified domain.
const FROM_EMAIL_ADDRESS = "feedback@yourdomain.com"; // e.g., noreply@yourdomain.com

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, feedbackType, message } = await req.json();

    console.log("Received feedback submission:");
    console.log("Name:", name || "Not provided");
    console.log("Email:", email || "Not provided");
    console.log("Feedback Type:", feedbackType);
    console.log("Message:", message);

    // ** IMPORTANT: Email Sending Logic Placeholder **
    // To actually send an email, you need to integrate an email service provider.
    // Below is a conceptual placeholder. You'll replace this with API calls
    // to a service like Resend, SendGrid, Mailgun, etc.
    //
    // Example using Resend (you'd need to install their SDK or use fetch):
    // const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY"); // Store API key as a Supabase secret
    // if (!RESEND_API_KEY) {
    //   console.error("Resend API key is not set in environment variables.");
    //   return new Response(JSON.stringify({ error: "Email service not configured." }), {
    //     status: 500,
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }
    //
    // const emailPayload = {
    //   from: FROM_EMAIL_ADDRESS,
    //   to: TO_EMAIL_ADDRESS,
    //   subject: `New BitePath Feedback: ${feedbackType}`,
    //   html: `
    //     <p><strong>Name:</strong> ${name || 'N/A'}</p>
    //     <p><strong>Email:</strong> ${email || 'N/A'}</p>
    //     <p><strong>Type:</strong> ${feedbackType}</p>
    //     <p><strong>Message:</strong></p>
    //     <p>${message.replace(/\n/g, '<br>')}</p>
    //   `,
    // };
    //
    // const resendResponse = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(emailPayload),
    // });
    //
    // if (!resendResponse.ok) {
    //   const errorData = await resendResponse.json();
    //   console.error("Failed to send email via Resend:", errorData);
    //   throw new Error(`Email sending failed: ${errorData.message || resendResponse.statusText}`);
    // }
    //
    // console.log("Email sent successfully via Resend (placeholder).");
    // End of Email Sending Logic Placeholder

    // For now, we'll just return a success message as if the email was sent.
    // The actual email sending requires further setup from your side.
    return new Response(
      JSON.stringify({ success: true, message: "Feedback received and logged. Email sending placeholder." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing feedback:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});