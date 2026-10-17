// Supabase Edge Function for sending Email OTP via Resend API
// Deploy with: supabase functions deploy send-email-otp --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Scheme Finder <onboarding@resend.dev>";
    const userName = (name || "User").trim();

    const textContent = `Hello ${userName},

Thank you for registering with Scheme Finder. Your email verification code is:

${otp}

This code expires in 5 minutes. Please do not share it with anyone.

If you did not request this code, you can ignore this email.

Regards,
Scheme Finder Team`;

    const htmlContent = `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h2>Verify Your Email — Scheme Finder</h2>
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Thank you for registering with Scheme Finder. Your email verification code is:</p>
    <div style="background: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7;">${otp}</span>
    </div>
    <p>This code expires in 5 minutes. Please do not share it with anyone.</p>
    <p style="color: #64748b; font-size: 13px;">If you did not request this code, you can ignore this email.</p>
    <p>Regards,<br>Scheme Finder Team</p>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Verify Your Email — Scheme Finder",
        text: textContent,
        html: htmlContent,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.message || "Failed to send email" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent to your email", resendId: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
