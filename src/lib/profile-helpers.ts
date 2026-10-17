import { supabase } from "@/integrations/supabase/client";

/**
 * Valid MIME types for admin avatar image uploads.
 * Restricted to JPG and PNG matching the storage bucket configuration.
 */
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];

/**
 * Maximum avatar file size (5 MB in bytes).
 */
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Extract clean initials from a full name or email address.
 * E.g., "John Doe" -> "JD", "Admin" -> "AD", "admin@domain.com" -> "AD"
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const cleanName = name?.trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (cleanName.length >= 2) {
      return cleanName.slice(0, 2).toUpperCase();
    }
    return cleanName.slice(0, 1).toUpperCase();
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    const username = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    if (username.length >= 2) {
      return username.slice(0, 2).toUpperCase();
    }
    if (username.length === 1) {
      return username.toUpperCase();
    }
  }

  return "AD";
}

/**
 * Validate an avatar image file before upload.
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: "Please select a valid image file. Only JPG and PNG images are supported.",
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `The selected image is ${sizeInMB} MB. Maximum allowed size is 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Format account creation date into a human-readable string.
 * E.g., "October 9, 2026"
 */
export function formatAccountDate(dateString?: string | null): string {
  if (!dateString) return "Not available";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "Not available";
  }
}

/**
 * Upload an admin avatar image to Supabase Storage in the 'documents' bucket,
 * and create a long-lived signed URL for display.
 */
export async function uploadAdminAvatar(
  userId: string,
  file: File
): Promise<{ signedUrl: string; path: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = extension === "jpeg" ? "jpg" : extension;
  const path = `${userId}/avatars/avatar-${Date.now()}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, {
      contentType: file.type || (safeExt === "png" ? "image/png" : "image/jpeg"),
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  // Create a 1-year (31,536,000s) signed URL for authenticated image rendering
  const { data: signedData, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 31536000);

  if (signError || !signedData?.signedUrl) {
    throw new Error(signError?.message || "Failed to generate signed URL for avatar");
  }

  return {
    signedUrl: signedData.signedUrl,
    path,
  };
}

/**
 * Remove an admin avatar image from Supabase Storage.
 */
export async function removeAdminAvatar(path: string): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from("documents").remove([path]);
  } catch (err) {
    console.warn("Could not delete previous avatar file:", err);
  }
}
