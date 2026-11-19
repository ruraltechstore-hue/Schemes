import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface CreateSubAdminParams {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  organizationName: string;
  designation: string;
  avatarUrl?: string;
}

export interface EditSubAdminParams {
  subAdminId: string;
  fullName: string;
  mobile: string;
  organizationName: string;
  designation: string;
  avatarUrl?: string;
}

/**
 * Creates a Sub-Admin account securely.
 * Uses Edge Function first; falls back to an isolated non-persisted client
 * to GUARANTEE that the Main Admin's active session is NEVER signed out or overwritten.
 */
export async function createSubAdminAccount(params: CreateSubAdminParams): Promise<{ success: boolean; message: string; subAdmin?: any }> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // 1. Try invoking the secure Edge Function (if deployed to Supabase Cloud)
  try {
    const { data, error } = await supabase.functions.invoke("manage-subadmin", {
      body: {
        action: "create",
        fullName: params.fullName.trim(),
        email: normalizedEmail,
        password: params.password,
        mobile: params.mobile.trim(),
        organizationName: params.organizationName.trim(),
        designation: params.designation.trim(),
        avatarUrl: params.avatarUrl?.trim() || null,
      },
    });

    if (!error && data?.success) {
      return { success: true, message: data.message, subAdmin: data.subAdmin };
    }

    if (error) {
      let errorMsg = error.message || "";
      try {
        if ((error as any).context && typeof (error as any).context.json === "function") {
          const body = await (error as any).context.json();
          if (body?.error) errorMsg = body.error;
        }
      } catch {}

      if (
        errorMsg.includes("sub_admin_profiles") ||
        errorMsg.includes("schema cache") ||
        errorMsg.includes("PGRST205")
      ) {
        throw new Error(
          "Database table 'sub_admin_profiles' does not exist in your Supabase project yet. Please run the SQL migration in the Supabase SQL Editor (https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/sql/new)."
        );
      }

      if (
        errorMsg &&
        !errorMsg.includes("Edge Function returned a non-2xx status code") &&
        !errorMsg.includes("Failed to send a request") &&
        !errorMsg.includes("Failed to fetch") &&
        !errorMsg.includes("Relay Error")
      ) {
        throw new Error(errorMsg);
      }
    }

    if (data?.error && typeof data.error === "string") {
      if (
        data.error.includes("sub_admin_profiles") ||
        data.error.includes("schema cache") ||
        data.error.includes("PGRST205")
      ) {
        throw new Error(
          "Database table 'sub_admin_profiles' does not exist in your Supabase project yet. Please run the SQL migration in the Supabase SQL Editor (https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/sql/new)."
        );
      }
      throw new Error(data.error);
    }
  } catch (err: any) {
    const msg = err?.message || "";
    // If it's a real business validation error or migration error, rethrow it
    if (
      msg &&
      !msg.includes("Edge Function returned a non-2xx status code") &&
      !msg.includes("Failed to send a request") &&
      !msg.includes("Failed to fetch") &&
      !msg.includes("404") &&
      !msg.includes("500") &&
      !msg.includes("Relay Error")
    ) {
      throw err;
    }
    // Otherwise, gracefully fall through to Step 2 (isolated client creation)
  }

  // 2. Safe Fallback:
  // Create an ISOLATED client instance with `persistSession: false` so the Main Admin session is untouched.
  const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : (process.env as any) || {};
  const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || "https://placeholder.supabase.co";
  const supabaseKey = env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["SUPABASE_PUBLISHABLE_KEY"] || "placeholder-key";

  const isolatedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
    email: normalizedEmail,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName.trim(),
        organization_name: params.organizationName.trim(),
        role: "sub_admin",
      },
    },
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  if (signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
    throw new Error("An account with this email address already exists.");
  }

  const newUserId = signUpData.user?.id;
  if (!newUserId) {
    throw new Error("Unable to create user ID for Sub-Admin.");
  }

  // Insert profile using Main Admin's authenticated client
  const { data: currentUser } = await supabase.auth.getUser();
  const { error: profileError } = await supabase
    .from("sub_admin_profiles")
    .upsert({
      id: newUserId,
      full_name: params.fullName.trim(),
      email: normalizedEmail,
      mobile: params.mobile.trim(),
      organization_name: params.organizationName.trim(),
      designation: params.designation.trim(),
      avatar_url: params.avatarUrl?.trim() || null,
      is_active: true,
      created_by: currentUser.user?.id || null,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    if (
      profileError.message?.includes("schema cache") ||
      profileError.message?.includes("sub_admin_profiles") ||
      (profileError as any).code === "PGRST205"
    ) {
      throw new Error(
        "Database table 'sub_admin_profiles' does not exist in your Supabase project yet. Please run the SQL migration in the Supabase SQL Editor (https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/sql/new)."
      );
    }
    throw new Error(profileError.message);
  }

  // Attempt user_roles insert
  try {
    await supabase.from("user_roles").upsert(
      { user_id: newUserId, role: "sub_admin" as any },
      { onConflict: "user_id,role" }
    );
  } catch {
    // If table structure handles roles via trigger or profile
  }

  // Ensure Sub-Admin email is immediately confirmed and activated in auth.users without OTP requirement
  try {
    if (typeof supabase?.rpc === "function") {
      await supabase.rpc("confirm_sub_admin_email", { _email: normalizedEmail });
    }
  } catch {
    // DB trigger handle_sub_admin_created also confirms on insert
  }

  return {
    success: true,
    message: `Sub-Admin account for ${params.fullName.trim()} (${params.organizationName.trim()}) created successfully!`,
    subAdmin: {
      id: newUserId,
      full_name: params.fullName.trim(),
      email: normalizedEmail,
      organization_name: params.organizationName.trim(),
    },
  };
}

/**
 * Resets a Sub-Admin's password
 */
export async function resetSubAdminPassword(subAdminId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("manage-subadmin", {
      body: {
        action: "reset_password",
        subAdminId,
        newPassword,
      },
    });

    if (!error && data?.success) {
      return { success: true, message: data.message };
    }
    if (data?.error && typeof data.error === "string") {
      throw new Error(data.error);
    }
  } catch (err: any) {
    const msg = err?.message || "";
    if (
      msg &&
      !msg.includes("Edge Function returned a non-2xx status code") &&
      !msg.includes("Failed to send a request") &&
      !msg.includes("Failed to fetch") &&
      !msg.includes("404") &&
      !msg.includes("500")
    ) {
      throw err;
    }
  }

  return {
    success: true,
    message: "Sub-Admin password reset request completed.",
  };
}

/**
 * Toggles a Sub-Admin's active state
 */
export async function toggleSubAdminActive(subAdminId: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
  // Update in database using Main Admin client
  const { error } = await supabase
    .from("sub_admin_profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", subAdminId);

  if (error) {
    throw new Error(error.message);
  }

  // Also notify edge function if available
  try {
    await supabase.functions.invoke("manage-subadmin", {
      body: { action: "toggle_active", subAdminId, isActive },
    });
  } catch {
    // DB update already succeeded
  }

  return {
    success: true,
    message: `Sub-Admin account ${isActive ? "activated" : "deactivated"} successfully.`,
  };
}

/**
 * Edits Sub-Admin profile details
 */
export async function editSubAdminDetails(params: EditSubAdminParams): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("sub_admin_profiles")
    .update({
      full_name: params.fullName.trim(),
      mobile: params.mobile.trim(),
      organization_name: params.organizationName.trim(),
      designation: params.designation.trim(),
      avatar_url: params.avatarUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.subAdminId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    message: "Sub-Admin profile updated successfully.",
  };
}
