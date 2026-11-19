// @ts-nocheck
// Supabase Edge Function for managing Sub-Admin accounts securely by Main Admin
// Deploy with: supabase functions deploy manage-subadmin

// @ts-ignore: Deno URL import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno URL import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller identity from JWT
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is Main Admin
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only Main Administrator can perform Sub-Admin operations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { fullName, email, password, mobile, organizationName, designation, avatarUrl } = body;

      if (!fullName || !email || !password || !mobile || !organizationName || !designation) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for Sub-Admin creation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if email already exists in sub_admin_profiles
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from("sub_admin_profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (checkError) {
        const checkMsg = checkError.message || "";
        if (checkMsg.includes("sub_admin_profiles") || checkMsg.includes("schema cache") || (checkError as any).code === "PGRST205") {
          return new Response(
            JSON.stringify({ error: "Database table 'sub_admin_profiles' does not exist in your Supabase project yet. Please run the SQL migration in the Supabase SQL Editor." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "A Sub-Admin with this email already exists." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user via Supabase Admin API
      const { data: createdUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          organization_name: organizationName.trim(),
          role: "sub_admin",
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message || "Failed to create user account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newUserId = createdUserData.user.id;

      // Assign 'sub_admin' role in user_roles
      const { error: insertRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newUserId, role: "sub_admin" }, { onConflict: "user_id,role" });

      if (insertRoleError) {
        console.error("Error setting sub_admin role:", insertRoleError);
      }

      // Insert sub_admin_profiles
      const { error: profileError } = await supabaseAdmin
        .from("sub_admin_profiles")
        .upsert({
          id: newUserId,
          full_name: fullName.trim(),
          email: normalizedEmail,
          mobile: mobile.trim(),
          organization_name: organizationName.trim(),
          designation: designation.trim(),
          avatar_url: avatarUrl?.trim() || null,
          is_active: true,
          created_by: caller.id,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        let msg = profileError.message || "Failed to create Sub-Admin profile";
        if (
          msg.includes("sub_admin_profiles") ||
          msg.includes("schema cache") ||
          (profileError as any).code === "PGRST205"
        ) {
          msg = "Database table 'sub_admin_profiles' does not exist in your Supabase project yet. Please run the SQL migration in the Supabase SQL Editor.";
        }
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sub-Admin account for ${fullName.trim()} (${organizationName.trim()}) created successfully!`,
          subAdmin: {
            id: newUserId,
            full_name: fullName.trim(),
            email: normalizedEmail,
            organization_name: organizationName.trim(),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset_password") {
      const { subAdminId, newPassword } = body;
      if (!subAdminId || !newPassword) {
        return new Response(
          JSON.stringify({ error: "Missing subAdminId or newPassword" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(subAdminId, {
        password: newPassword,
      });

      if (updateAuthError) {
        return new Response(
          JSON.stringify({ error: updateAuthError.message || "Failed to reset password" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Sub-Admin password reset successfully!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle_active") {
      const { subAdminId, isActive } = body;
      if (!subAdminId || typeof isActive !== "boolean") {
        return new Response(
          JSON.stringify({ error: "Missing subAdminId or isActive flag" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateProfileError } = await supabaseAdmin
        .from("sub_admin_profiles")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", subAdminId);

      if (updateProfileError) {
        return new Response(
          JSON.stringify({ error: updateProfileError.message || "Failed to update Sub-Admin status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sub-Admin account ${isActive ? "activated" : "deactivated"} successfully.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "edit") {
      const { subAdminId, fullName, mobile, organizationName, designation, avatarUrl } = body;
      if (!subAdminId) {
        return new Response(
          JSON.stringify({ error: "Missing subAdminId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("sub_admin_profiles")
        .update({
          full_name: fullName?.trim(),
          mobile: mobile?.trim(),
          organization_name: organizationName?.trim(),
          designation: designation?.trim(),
          avatar_url: avatarUrl?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subAdminId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message || "Failed to update Sub-Admin profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Sub-Admin details updated successfully!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
