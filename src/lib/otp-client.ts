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

/**
 * Request server to generate and send a 6-digit OTP via Resend API
 */
export async function sendOtpRequest(email: string, name: string): Promise<SendOtpResponse> {
  try {
    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || data?.error || `Failed to send OTP (${res.status})`,
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
      success: false,
      message: err?.message || "Network error while requesting OTP",
      error: err?.message || "Network error",
    };
  }
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

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || data?.error || `Invalid verification code (${res.status})`,
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
      message: err?.message || "Network error while verifying OTP",
      error: err?.message || "Network error",
    };
  }
}
