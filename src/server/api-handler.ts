import type { IncomingMessage, ServerResponse } from "node:http";
import {
  sendEmailOtp,
  verifyEmailOtp,
  validateAndConsumeToken,
} from "./otp-service";

/**
 * Parse JSON body from an incoming HTTP request
 */
export async function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const str = Buffer.concat(chunks).toString("utf-8");
        resolve(str ? JSON.parse(str) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response helper
 */
export function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

/**
 * Handle API requests for OTP operations
 */
export async function handleOtpApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = req.url?.split("?")[0] || "";

  if (!url.startsWith("/api/")) {
    return false;
  }

  // Handle CORS Preflight if any
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed. Use POST." });
    return true;
  }

  try {
    const body = await parseJsonBody(req);

    if (url === "/api/send-otp") {
      const { email, name } = body || {};
      if (!email) {
        sendJson(res, 400, { success: false, message: "Email is required" });
        return true;
      }
      const result = await sendEmailOtp(email, name || "User");
      sendJson(res, result.success ? 200 : 400, result);
      return true;
    }

    if (url === "/api/verify-otp") {
      const { email, otp } = body || {};
      if (!email || !otp) {
        sendJson(res, 400, { success: false, message: "Email and OTP are required" });
        return true;
      }
      const result = await verifyEmailOtp(email, otp);
      sendJson(res, result.success ? 200 : 400, result);
      return true;
    }

    if (url === "/api/validate-token") {
      const { email, token } = body || {};
      const isValid = validateAndConsumeToken(email, token);
      sendJson(res, isValid ? 200 : 400, { valid: isValid });
      return true;
    }

    return false;
  } catch (err: any) {
    sendJson(res, 500, { success: false, message: err?.message || "Internal server error" });
    return true;
  }
}
