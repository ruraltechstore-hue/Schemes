import { supabase } from "@/integrations/supabase/client";

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const ALLOWED_VIDEO_FORMATS = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

/**
 * Extracts standard 11-character YouTube video ID from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  );
  return match && match[1]?.length === 11 ? match[1] : null;
}

/**
 * Returns a standardized YouTube embed URL or null if not a valid YouTube URL
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

/**
 * Checks if a string is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

/**
 * Formats file size in bytes to human-readable string (e.g. 14.5 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Validates video file extension, MIME type, and file size
 */
export function isValidVideoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No video file provided." };
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  const isExtensionValid = ALLOWED_VIDEO_EXTENSIONS.includes(extension);
  const isMimeValid = ALLOWED_VIDEO_FORMATS.includes(file.type);

  if (!isExtensionValid && !isMimeValid) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload an MP4, WebM, or MOV video.",
    };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of 100 MB. (Selected: ${formatFileSize(file.size)})`,
    };
  }

  return { valid: true };
}

/**
 * Uploads video file to Supabase Storage bucket 'scheme-videos' with real-time progress reporting.
 */
export async function uploadSchemeVideo(
  file: File,
  schemeId?: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string; path: string }> {
  const validation = isValidVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error("You must be logged in as an administrator to upload videos.");
  }

  const SUPABASE_URL =
    import.meta.env["VITE_SUPABASE_URL"] ||
    (typeof process !== "undefined" ? process.env?.["SUPABASE_URL"] : "");
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    (typeof process !== "undefined" ? process.env?.["SUPABASE_PUBLISHABLE_KEY"] : "");

  const cleanName = file.name.replace(/[^\w.-]/g, "_");
  const prefix = schemeId ? `scheme_${schemeId}` : "scheme_new";
  const path = `${prefix}/${Date.now()}_${cleanName}`;

  // Try uploading using XMLHttpRequest to provide real-time progress feedback
  return new Promise((resolve, reject) => {
    try {
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/scheme-videos/${encodeURIComponent(path)}`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY || "");
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.setRequestHeader("x-upsert", "true");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          const { data } = supabase.storage.from("scheme-videos").getPublicUrl(path);
          resolve({ url: data.publicUrl, path });
        } else {
          // If XHR failed, attempt standard Supabase SDK upload
          try {
            const { error: sdkError } = await supabase.storage
              .from("scheme-videos")
              .upload(path, file, { upsert: true, contentType: file.type });

            if (sdkError) {
              if (
                sdkError.message?.toLowerCase().includes("bucket not found") ||
                (sdkError as any)?.statusCode === "404"
              ) {
                reject(
                  new Error(
                    "Storage bucket 'scheme-videos' not found. Please apply the migration in supabase/migrations/20261013190000_scheme_videos.sql in your Supabase SQL editor.",
                  ),
                );
              } else {
                reject(new Error(sdkError.message || `Upload failed with status ${xhr.status}`));
              }
              return;
            }

            if (onProgress) onProgress(100);
            const { data } = supabase.storage.from("scheme-videos").getPublicUrl(path);
            resolve({ url: data.publicUrl, path });
          } catch (err: any) {
            let msg = err?.message || `Upload failed (${xhr.status}: ${xhr.statusText})`;
            if (xhr.status === 404 || msg.includes("Bucket not found")) {
              msg =
                "Storage bucket 'scheme-videos' not found. Please run the migration script in Supabase SQL Editor.";
            }
            reject(new Error(msg));
          }
        }
      };

      xhr.onerror = async () => {
        // Fallback to Supabase SDK upload
        try {
          const { error: sdkError } = await supabase.storage
            .from("scheme-videos")
            .upload(path, file, { upsert: true, contentType: file.type });
          if (sdkError) {
            reject(new Error(sdkError.message));
          } else {
            if (onProgress) onProgress(100);
            const { data } = supabase.storage.from("scheme-videos").getPublicUrl(path);
            resolve({ url: data.publicUrl, path });
          }
        } catch (err: any) {
          reject(new Error(err?.message || "Network error occurred during video upload."));
        }
      };

      xhr.send(file);
    } catch (err: any) {
      reject(new Error(err?.message || "Failed to initiate video upload."));
    }
  });
}

/**
 * Extracts storage path from a Supabase Storage public URL
 */
export function extractStoragePath(url: string, bucket = "scheme-videos"): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(url.substring(idx + marker.length));
  }
  return null;
}

/**
 * Deletes a video file from Supabase Storage bucket 'scheme-videos'
 */
export async function deleteSchemeVideoFile(urlOrPath: string): Promise<boolean> {
  if (!urlOrPath) return false;
  const path = urlOrPath.startsWith("http") ? extractStoragePath(urlOrPath) : urlOrPath;
  if (!path) return false;

  try {
    const { error } = await supabase.storage.from("scheme-videos").remove([path]);
    return !error;
  } catch (err) {
    console.error("Failed to delete video from storage:", err);
    return false;
  }
}

/**
 * Gets video URL and type from a scheme record, checking both root columns and eligibility JSON fallback
 */
export function getSchemeVideo(scheme: any): {
  url: string | null;
  type: "uploaded" | "youtube" | null;
} {
  if (!scheme) return { url: null, type: null };

  const directUrl = scheme.application_video_url;
  const fallbackUrl = scheme.eligibility?.application_video_url;
  const url: string | null = (directUrl || fallbackUrl || null)?.trim() || null;

  if (!url) return { url: null, type: null };

  const directType = scheme.video_type;
  const fallbackType = scheme.eligibility?.video_type;
  let type: "uploaded" | "youtube" | null = directType || fallbackType || null;

  if (!type) {
    type = isYouTubeUrl(url) ? "youtube" : "uploaded";
  }

  return { url, type };
}
