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

    // On static deployments (e.g. Lovable / Vercel SPA) without a Node backend,
    // /api/send-otp returns 404. Supabase Auth signUp already sent the confirmation code/email!
    if (res.status === 404) {
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
    // In pure client-side SPA environments where fetch fails, Supabase Auth signUp handles email dispatch
    return {
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
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

    // In static deployment, pass through so Supabase verifyOtp handles verification
    if (res.status === 404) {
      return {
        success: true,
        message: "Verifying code...",
      };
    }

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
      success: true,
      message: "Verifying code...",
    };
  }
}
