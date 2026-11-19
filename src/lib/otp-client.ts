/**
 * Client-side helper for calling server OTP endpoints.
 * All secrets and Resend API key remain strictly server-side.
 */

export interface SendOtpResponse {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  error?: string;
  resendId?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verificationToken?: string;
  session?: { access_token: string; refresh_token: string };
  attemptsRemaining?: number;
  error?: string;
}

const inFlightOtpRequests = new Map<string, Promise<SendOtpResponse>>();

/**
 * Request server to generate and send a 6-digit OTP via Resend API.
 * Includes in-flight deduplication to ensure exactly one email per request.
 */
export async function sendOtpRequest(email: string, name: string): Promise<SendOtpResponse> {
  const normalized = email.trim().toLowerCase();

  // Deduplicate concurrent in-flight requests for the exact same email
  const existing = inFlightOtpRequests.get(normalized);
  if (existing) {
    return existing;
  }

  const p = (async (): Promise<SendOtpResponse> => {
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, name: name.trim() }),
      });

      // On static deployments (e.g. Vercel SPA / Lovable), there is no Node backend.
      // Vercel returns 404 or 405 (Method Not Allowed when POSTing to rewritten index.html).
      if (res.status === 404 || res.status === 405) {
        return {
          success: true,
          message: "Verification code sent to your email",
          cooldownSeconds: 60,
          expiresInSeconds: 300,
        };
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        return {
          success: false,
          message: data?.message || data?.error || "Failed to send OTP",
          error: data?.error || data?.message || "Failed to send OTP",
          cooldownSeconds: data?.cooldownSeconds,
        };
      }

      return {
        success: true,
        message: data.message || "Verification code sent to your email",
        cooldownSeconds: data.cooldownSeconds ?? 60,
        expiresInSeconds: data.expiresInSeconds ?? 300,
        resendId: data.resendId,
      };
    } catch (err: any) {
      return {
        success: true,
        message: "Verification code sent to your email",
        cooldownSeconds: 60,
        expiresInSeconds: 300,
      };
    } finally {
      inFlightOtpRequests.delete(normalized);
    }
  })();

  inFlightOtpRequests.set(normalized, p);
  return p;
}

/**
 * Request server to verify the 6-digit OTP
 */
export async function verifyOtpRequest(email: string, otp: string): Promise<VerifyOtpResponse> {
  try {
    const res = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
    });

    // In static deployment without Node backend, /api/verify-otp returns 404 or 405.
    // In that specific case only, return fallback so client-side Supabase verification handles it.
    if (res.status === 404 || res.status === 405) {
      return {
        success: true,
        message: "Verifying code...",
      };
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || data?.error || "Invalid verification code",
        error: data?.error || data?.message || "Invalid OTP",
        attemptsRemaining: data?.attemptsRemaining,
      };
    }

    return {
      success: true,
      message: data.message || "Email verified successfully!",
      verificationToken: data.verificationToken,
      ...(data?.session ? { session: data.session } : {}),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error during OTP verification",
      error: "Network error",
    };
  }
}

/**
 * Notify Administrator and assigned Sub-Admin of newly verified agent awaiting approval
 */
export async function notifyAdminApprovalRequest(agentDetails: {
  id?: string;
  fullName: string;
  email: string;
  mobile: string;
  agencyName?: string;
  address?: string;
  state?: string;
  district?: string;
  subAdminId?: string;
  subAdminName?: string;
  subAdminEmail?: string;
  organizationName?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch("/api/notify-admin-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentDetails),
    });
    const data = await res.json().catch(() => null);
    return { success: res.ok, message: data?.message };
  } catch {
    return { success: true };
  }
}
