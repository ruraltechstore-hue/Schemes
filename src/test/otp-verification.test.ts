import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  generateSecureOtp,
  hashOtp,
  normalizeEmail,
  sendEmailOtp,
  verifyEmailOtp,
  validateAndConsumeToken,
  _clearOtpStore,
  _getOtpRecord,
  OTP_CONFIG,
} from "../server/otp-service";

describe("Email OTP Verification with Resend API", () => {
  beforeEach(() => {
    _clearOtpStore();
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_resend_mock" }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("OTP Generation & Security", () => {
    it("generates a random 6-digit OTP", () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateSecureOtp();
        expect(otp).toMatch(/^\d{6}$/);
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });

    it("hashes the OTP using SHA-256 so plaintext is not retained", () => {
      const otp = "123456";
      const hash1 = hashOtp(otp);
      const hash2 = hashOtp(otp);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash1).not.toBe(otp);
    });

    it("normalizes email addresses by trimming and lowercasing", () => {
      expect(normalizeEmail("  User.Test@Example.COM  ")).toBe("user.test@example.com");
    });
  });

  describe("Resend API Email Delivery", () => {
    it("formats the email with exact Subject and body per specification", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg_resend_12345" }),
      });
      global.fetch = mockFetch;

      const email = "applicant@example.com";
      const name = "Ramesh Kumar";
      const testOtp = "584920";

      const res = await sendEmailOtp(email, name, {
        apiKey: "re_test_key_123456",
        overrideOtp: testOtp,
      });

      expect(res.success).toBe(true);
      expect(res.resendId).toBe("msg_resend_12345");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, any];
      expect(url).toBe("https://api.resend.com/emails");
      expect(options.headers["Authorization"]).toBe("Bearer re_test_key_123456");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const payload = JSON.parse(options.body);
      expect(payload.to).toEqual(["applicant@example.com"]);
      expect(payload.subject).toBe("Verify Your Email — Scheme Finder");

      // Verify exact plaintext email content required by specification
      expect(payload.text).toContain("Hello Ramesh Kumar,");
      expect(payload.text).toContain("Thank you for registering with Scheme Finder. Your email verification code is:");
      expect(payload.text).toContain("584920");
      expect(payload.text).toContain("This code expires in 5 minutes. Please do not share it with anyone.");
      expect(payload.text).toContain("If you did not request this code, you can ignore this email.");
      expect(payload.text).toContain("Regards,\nScheme Finder Team");

      // Verify HTML content
      expect(payload.html).toContain("584920");
      expect(payload.html).toContain("Ramesh Kumar");
    });

    it("handles Resend API rejection gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          message: "You can only send testing emails to your own verified email address.",
        }),
      });
      global.fetch = mockFetch;

      const res = await sendEmailOtp("unverified@example.com", "Anita", {
        apiKey: "re_invalid_or_restricted_key",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("You can only send testing emails to your own verified email address.");
    });
  });

  describe("OTP Expiration & Verification Attempts", () => {
    it("successfully verifies with the correct 6-digit OTP within 5 minutes", async () => {
      const email = "user1@example.com";
      const otp = "654321";

      await sendEmailOtp(email, "User One", {
        apiKey: "re_mock_key",
        overrideOtp: otp,
      });

      const verifyRes = await verifyEmailOtp(email, otp);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.message).toBe("Email verified successfully!");
      expect(verifyRes.verificationToken).toBeDefined();

      // Verifying token consumption
      const valid = validateAndConsumeToken(email, verifyRes.verificationToken!);
      expect(valid).toBe(true);

      // Token cannot be reused (consumed)
      const validAgain = validateAndConsumeToken(email, verifyRes.verificationToken!);
      expect(validAgain).toBe(false);
    });

    it("fails verification when given an incorrect OTP and tracks remaining attempts", async () => {
      const email = "user2@example.com";
      const correctOtp = "112233";

      await sendEmailOtp(email, "User Two", {
        apiKey: "re_mock_key",
        overrideOtp: correctOtp,
      });

      const attempt1 = await verifyEmailOtp(email, "000000");
      expect(attempt1.success).toBe(false);
      expect(attempt1.attemptsRemaining).toBe(4);
      expect(attempt1.message).toContain("4 attempts remaining");

      const attempt2 = await verifyEmailOtp(email, "999999");
      expect(attempt2.success).toBe(false);
      expect(attempt2.attemptsRemaining).toBe(3);
    });

    it("invalidates the OTP after 5 consecutive failed attempts", async () => {
      const email = "user3@example.com";
      const correctOtp = "778899";

      await sendEmailOtp(email, "User Three", {
        apiKey: "re_mock_key",
        overrideOtp: correctOtp,
      });

      for (let i = 0; i < 4; i++) {
        await verifyEmailOtp(email, `00000${i}`);
      }

      // 5th failed attempt
      const attempt5 = await verifyEmailOtp(email, "999999");
      expect(attempt5.success).toBe(false);
      expect(attempt5.attemptsRemaining).toBe(0);
      expect(attempt5.message).toContain("Maximum attempts reached");

      // Record is removed, so subsequent attempt fails
      const afterLocked = await verifyEmailOtp(email, correctOtp);
      expect(afterLocked.success).toBe(false);
      expect(afterLocked.message).toContain("No active verification request");
    });

    it("rejects verification if OTP is expired (5 minutes)", async () => {
      vi.useFakeTimers();
      const email = "expired@example.com";
      const otp = "123456";

      await sendEmailOtp(email, "Expired User", {
        apiKey: "re_mock_key",
        overrideOtp: otp,
      });

      // Advance clock by 5 minutes + 1 second
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const res = await verifyEmailOtp(email, otp);
      expect(res.success).toBe(false);
      expect(res.message).toContain("OTP has expired");
    });
  });

  describe("Resend Cooldown & Previous OTP Invalidation", () => {
    it("enforces a 60-second cooldown before allowing another OTP request", async () => {
      vi.useFakeTimers();
      const email = "cooldown@example.com";

      const res1 = await sendEmailOtp(email, "Cooldown User", { apiKey: "re_mock_key" });
      expect(res1.success).toBe(true);

      // Attempt immediate resend (0 seconds elapsed)
      const res2 = await sendEmailOtp(email, "Cooldown User", { apiKey: "re_mock_key" });
      expect(res2.success).toBe(false);
      expect(res2.message).toContain("Please wait 60 second(s)");

      // Advance by 30 seconds -> still blocked
      vi.advanceTimersByTime(30 * 1000);
      const res3 = await sendEmailOtp(email, "Cooldown User", { apiKey: "re_mock_key" });
      expect(res3.success).toBe(false);
      expect(res3.message).toContain("Please wait 30 second(s)");

      // Advance past 60 seconds -> allowed!
      vi.advanceTimersByTime(31 * 1000);
      const res4 = await sendEmailOtp(email, "Cooldown User", { apiKey: "re_mock_key" });
      expect(res4.success).toBe(true);
    });

    it("invalidates previous OTP when a new OTP is generated", async () => {
      vi.useFakeTimers();
      const email = "invalidate@example.com";
      const oldOtp = "111111";
      const newOtp = "222222";

      await sendEmailOtp(email, "Test User", {
        apiKey: "re_mock_key",
        overrideOtp: oldOtp,
      });

      // Advance 61 seconds so resend is allowed
      vi.advanceTimersByTime(61 * 1000);

      // Send new OTP
      await sendEmailOtp(email, "Test User", {
        apiKey: "re_mock_key",
        overrideOtp: newOtp,
      });

      // Old OTP must now be rejected
      const oldVerify = await verifyEmailOtp(email, oldOtp);
      expect(oldVerify.success).toBe(false);
      expect(oldVerify.error).toBe("Incorrect OTP");

      // New OTP must succeed
      const newVerify = await verifyEmailOtp(email, newOtp);
      expect(newVerify.success).toBe(true);
    });

    it("limits excessive resend requests within 15 minutes", async () => {
      vi.useFakeTimers();
      const email = "rate_limit@example.com";

      // 1 initial + 4 resends
      for (let i = 0; i <= OTP_CONFIG.MAX_RESENDS; i++) {
        await sendEmailOtp(email, "Rate Limited User", { apiKey: "re_mock_key" });
        vi.advanceTimersByTime(61 * 1000); // Wait out cooldown
      }

      // Next resend within 15 minutes should be blocked by rate limiting
      const blockedRes = await sendEmailOtp(email, "Rate Limited User", { apiKey: "re_mock_key" });
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.message).toContain("Too many OTP requests");
    });
  });
});
