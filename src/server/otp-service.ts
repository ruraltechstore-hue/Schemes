import crypto from "node:crypto";

export interface OtpRecord {
  email: string;
  userName: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  resendCount: number;
  lastSentAt: number;
  createdAt: number;
  verified?: boolean;
  verificationToken?: string;
  tokenExpiresAt?: number;
}

// In-memory store for server-side OTP records
const otpStore = new Map<string, OtpRecord>();

// Security configurations
export const OTP_CONFIG = {
  EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  COOLDOWN_MS: 60 * 1000, // 60 seconds between resends
  MAX_ATTEMPTS: 5, // Maximum 5 failed verification attempts
  MAX_RESENDS: 4, // Maximum 4 resends per window
  RESEND_WINDOW_MS: 15 * 60 * 1000, // 15-minute window for resend limits
  TOKEN_EXPIRY_MS: 10 * 60 * 1000, // 10 minutes to complete registration with token
};

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP using SHA-256 for secure storage
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

/**
 * Normalize an email address
 */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Send an OTP via Resend API to the given email address
 */
export async function sendEmailOtp(
  emailInput: string,
  userNameInput: string,
  options?: { apiKey?: string; fromEmail?: string; overrideOtp?: string }
): Promise<{
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  error?: string;
  resendId?: string;
}> {
  const email = normalizeEmail(emailInput);
  const userName = (userNameInput || "User").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Invalid email address", error: "Invalid email address" };
  }

  const now = Date.now();
  const existing = otpStore.get(email);

  if (existing) {
    // Check cooldown
    const timeSinceLastSent = now - existing.lastSentAt;
    if (timeSinceLastSent < OTP_CONFIG.COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_CONFIG.COOLDOWN_MS - timeSinceLastSent) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSec} second(s) before requesting another OTP.`,
        error: `Please wait ${waitSec} second(s) before requesting another OTP.`,
        cooldownSeconds: waitSec,
      };
    }

    // Check resend window limits
    if (now - existing.createdAt < OTP_CONFIG.RESEND_WINDOW_MS) {
      if (existing.resendCount >= OTP_CONFIG.MAX_RESENDS) {
        return {
          success: false,
          message: "Too many OTP requests. Please wait a few minutes before trying again.",
          error: "Too many OTP requests. Please wait a few minutes before trying again.",
        };
      }
    }
  }

  // Generate new OTP
  const otp = options?.overrideOtp || generateSecureOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = now + OTP_CONFIG.EXPIRY_MS;

  const resendCount = existing && now - existing.createdAt < OTP_CONFIG.RESEND_WINDOW_MS
    ? existing.resendCount + 1
    : 0;

  // Invalidate any previous OTP by setting new record
  const newRecord: OtpRecord = {
    email,
    userName,
    otpHash,
    expiresAt,
    attempts: 0,
    resendCount,
    lastSentAt: now,
    createdAt: existing && now - existing.createdAt < OTP_CONFIG.RESEND_WINDOW_MS ? existing.createdAt : now,
  };
  otpStore.set(email, newRecord);
  console.log(`[OTP Service] Generated 6-digit OTP for ${email}: ${otp}`);

  // Email parameters
  const apiKey = options?.apiKey || process.env["RESEND_API_KEY"];
  const fromEmail = options?.fromEmail || process.env["RESEND_FROM_EMAIL"] || "Scheme Finder <onboarding@resend.dev>";
  const subject = "Verify Your Email — Scheme Finder";

  const textContent = `Hello ${userName},

Thank you for registering with Scheme Finder. Your email verification code is:

${otp}

This code expires in 5 minutes. Please do not share it with anyone.

If you did not request this code, you can ignore this email.

Regards,
Scheme Finder Team`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email — Scheme Finder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="margin-bottom: 24px; text-align: center;">
      <div style="display: inline-block; padding: 6px 14px; background: #eff6ff; color: #2563eb; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 12px;">
        Government Scheme Finder
      </div>
      <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">Verify Your Email Address</h1>
      <p style="color: #64748b; font-size: 14px; margin: 0;">Complete your account registration</p>
    </div>
    
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${userName}</strong>,</p>
    
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Thank you for registering with Scheme Finder. Your email verification code is:
    </p>
    
    <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #0284c7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; display: inline-block; padding-left: 10px;">
        ${otp}
      </span>
    </div>
    
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
      This code expires in <strong>5 minutes</strong>. Please do not share it with anyone.
    </p>
    
    <p style="font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0;">
      If you did not request this code, you can ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0;">
      Regards,<br>
      <strong>Scheme Finder Team</strong>
    </p>
  </div>
</body>
</html>`;

  // Check if Resend API key is present
  if (!apiKey) {
    // If in test environment without key, allow mock simulation
    if (process.env["NODE_ENV"] === "test" || process.env["VITEST"]) {
      return {
        success: true,
        message: "Verification code sent to your email (test mode)",
        cooldownSeconds: 60,
        expiresInSeconds: 300,
        resendId: "mock-resend-id-" + otp,
      };
    }
    return {
      success: false,
      message: "Resend API key is not configured. Please set RESEND_API_KEY in your server environment.",
      error: "RESEND_API_KEY missing",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        text: textContent,
        html: htmlContent,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errDetail = data?.message || data?.error?.message || res.statusText || "Failed to send email";
      return {
        success: false,
        message: `Failed to deliver email: ${errDetail}`,
        error: errDetail,
      };
    }

    return {
      success: true,
      message: "Verification code sent to your email",
      cooldownSeconds: 60,
      expiresInSeconds: 300,
      resendId: data?.id,
    };
  } catch (err: any) {
    const errorMsg = err?.message || "Network error while connecting to Resend API";
    return {
      success: false,
      message: `Email delivery failure: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Confirm the user's email in Supabase Auth by executing the verify token URL sent via Resend
 */
export async function confirmSupabaseUser(
  emailInput: string,
  resendApiKey?: string
): Promise<{
  success: boolean;
  session?: { access_token: string; refresh_token: string };
  error?: string;
}> {
  const email = normalizeEmail(emailInput);
  const apiKey = resendApiKey || process.env["RESEND_API_KEY"];

  if (!apiKey) {
    return { success: true };
  }

  // Allow up to 4 attempts with 1-second pause to handle SMTP dispatch latency
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const listRes = await fetch("https://api.resend.com/emails", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!listRes.ok) {
        if (attempt === 3) return { success: false, error: "Failed to query Resend API" };
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const listData = (await listRes.json()) as any;
      const candidates = (listData?.data || []).filter(
        (e: any) =>
          Array.isArray(e.to) &&
          e.to.some((t: string) => t.toLowerCase() === email)
      );

      // Prioritize emails containing "Confirm" (Supabase Auth subject) over OTP notifications
      const sortedCandidates = [...candidates].sort((a: any, b: any) => {
        const aIsConfirm = (a.subject || "").toLowerCase().includes("confirm");
        const bIsConfirm = (b.subject || "").toLowerCase().includes("confirm");
        if (aIsConfirm && !bIsConfirm) return -1;
        if (!aIsConfirm && bIsConfirm) return 1;
        return 0;
      });

      for (const item of sortedCandidates) {
        // Skip the 6-digit OTP delivery email itself
        if ((item.subject || "").toLowerCase().includes("verify your email")) {
          continue;
        }

        const detailRes = await fetch(`https://api.resend.com/emails/${item.id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!detailRes.ok) continue;

        const detail = (await detailRes.json()) as any;
        const content = `${detail?.html || ""} ${detail?.text || ""}`;

        const urlMatch = content.match(/https:\/\/[^\s"'>]+\/auth\/v1\/verify\?[^\s"'>]+/);
        if (urlMatch) {
          const verifyUrl = urlMatch[0].replace(/&amp;/g, "&");
          const vRes = await fetch(verifyUrl, { redirect: "manual" });
          if (vRes.status === 303 || vRes.status === 200) {
            console.log(`[Supabase Auth] Successfully confirmed email for ${email}`);

            const location = vRes.headers.get("location") || "";
            const hash = location.split("#")[1] || "";
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            return {
              success: true,
              ...(accessToken && refreshToken ? {
                session: {
                  access_token: accessToken,
                  refresh_token: refreshToken,
                }
              } : {}),
            };
          }
        }
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      return { success: false, error: "No Supabase confirmation link found" };
    } catch (err: any) {
      if (attempt === 3) {
        return { success: false, error: err?.message || "Network error" };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { success: false, error: "Confirmation timeout" };
}

/**
 * Verify an OTP submitted by the user
 */
export async function verifyEmailOtp(
  emailInput: string,
  otpInput: string,
  options?: { apiKey?: string }
): Promise<{
  success: boolean;
  message: string;
  verificationToken?: string;
  session?: { access_token: string; refresh_token: string };
  attemptsRemaining?: number;
  error?: string;
}> {
  const email = normalizeEmail(emailInput);
  const otp = (otpInput || "").trim();

  if (!email || !otp) {
    return { success: false, message: "Email and 6-digit OTP are required", error: "Missing required fields" };
  }

  const record = otpStore.get(email);
  if (!record) {
    return {
      success: false,
      message: "No active verification request found for this email. Please request a new code.",
      error: "No active verification request",
    };
  }

  const now = Date.now();

  // Check 5-minute expiration
  if (now > record.expiresAt) {
    otpStore.delete(email);
    return {
      success: false,
      message: "OTP has expired. Please request a new verification code.",
      error: "OTP expired",
    };
  }

  // Check maximum attempts limit
  if (record.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    otpStore.delete(email);
    return {
      success: false,
      message: "Too many failed attempts. This OTP has been invalidated. Please request a new code.",
      error: "Too many failed attempts",
    };
  }

  // Check hash
  const inputHash = hashOtp(otp);
  if (inputHash !== record.otpHash) {
    record.attempts += 1;
    const remaining = Math.max(0, OTP_CONFIG.MAX_ATTEMPTS - record.attempts);
    if (remaining === 0) {
      otpStore.delete(email);
      return {
        success: false,
        message: "Incorrect OTP. Maximum attempts reached. This code is now invalid. Please request a new one.",
        error: "Maximum attempts reached",
        attemptsRemaining: 0,
      };
    }
    return {
      success: false,
      message: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      error: "Incorrect OTP",
      attemptsRemaining: remaining,
    };
  }

  // Verification succeeded!
  // Invalidate OTP hash so it cannot be reused
  const verificationToken = crypto.randomBytes(32).toString("hex");
  record.verified = true;
  record.otpHash = ""; // Invalidate OTP
  record.verificationToken = verificationToken;
  record.tokenExpiresAt = now + OTP_CONFIG.TOKEN_EXPIRY_MS;

  // Confirm email in Supabase Auth if confirmation email exists in Resend
  const confirmResult = await confirmSupabaseUser(email, options?.apiKey);

  return {
    success: true,
    message: "Email verified successfully!",
    verificationToken,
    ...(confirmResult.session ? { session: confirmResult.session } : {}),
  };
}

/**
 * Validate and consume a one-time verification token
 */
export function validateAndConsumeToken(emailInput: string, token: string): boolean {
  const email = normalizeEmail(emailInput);
  if (!email || !token) return false;

  const record = otpStore.get(email);
  if (!record || !record.verified || record.verificationToken !== token) {
    return false;
  }

  if (record.tokenExpiresAt && Date.now() > record.tokenExpiresAt) {
    otpStore.delete(email);
    return false;
  }

  // Token consumed
  otpStore.delete(email);
  return true;
}

/**
 * Test/Internal helpers
 */
export function _getOtpRecord(email: string) {
  return otpStore.get(normalizeEmail(email));
}

export function _clearOtpStore() {
  otpStore.clear();
}
