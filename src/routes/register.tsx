import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Mail,
  ArrowLeft,
  RotateCw,
  Clock,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AuthLayout } from "@/components/AuthLayout";
import { STATES } from "@/lib/constants";
import { sendOtpRequest, verifyOtpRequest } from "@/lib/otp-client";

export default Register;

function Register() {
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    state: "",
    district: "",
  });

  // Flow step: "form" | "otp" | "success"
  const [step, setStep] = useState<"form" | "otp" | "success">("form");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timers: cooldown for resend (default 60s), expiration for OTP (default 300s = 5m)
  const [cooldown, setCooldown] = useState(60);
  const [expiresIn, setExpiresIn] = useState(300);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to update form values
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  };

  // Manage countdown timers when on the "otp" step
  useEffect(() => {
    if (step === "otp") {
      // Cooldown timer
      cooldownTimerRef.current = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      // Expiry timer
      expiryTimerRef.current = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            setErrorMessage("Your verification code has expired. Please request a new OTP.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    };
  }, [step]);

  // Listen for Supabase Auth changes (e.g. if user clicked confirmation link in their email)
  useEffect(() => {
    if (step !== "otp") return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        try {
          await supabase.from("profiles").upsert({
            id: session.user.id,
            full_name: f.name.trim(),
            email: f.email.trim().toLowerCase(),
            mobile: f.mobile.trim(),
            state: f.state,
            district: f.district.trim(),
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Non-fatal
        }
        toast.success("Account verified successfully! Welcome to Scheme Finder.");
        setStep("success");
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 1000);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [step, f, navigate]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  /**
   * Step 1: User submits registration form
   * Creates the user in Supabase Auth and sends verification OTP via Resend API
   */
  const handleInitiateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();

    if (!/^[6-9]\d{9}$/.test(f.mobile)) {
      toast.error("Enter a valid 10-digit mobile number starting with 6-9");
      return;
    }
    if (!f.state) {
      toast.error("Please select your state");
      return;
    }
    if (f.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setBusy(true);

    try {
      // 1. Create the user using Supabase Auth's signUp method with email and password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: f.password,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
          data: {
            full_name: name,
            mobile: f.mobile.trim(),
            state: f.state,
            district: f.district.trim(),
          },
        },
      });

      // Handle duplicate registration error or mailer error
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered")) {
          const msg = "An account with this email already exists. Please log in.";
          setErrorMessage(msg);
          toast.error(msg);
          setBusy(false);
          return;
        } else if (
          signUpError.message.toLowerCase().includes("confirmation email") ||
          (signUpError as any).status === 500
        ) {
          const msg =
            "Unable to create account in Supabase Auth: 'Error sending confirmation email'. In your Supabase Dashboard (Authentication → Providers → Email), please disable 'Confirm email' (recommended when using custom Resend OTP) or configure Resend SMTP credentials.";
          setErrorMessage(msg);
          toast.error(msg);
          setBusy(false);
          return;
        } else {
          setErrorMessage(signUpError.message);
          toast.error(signUpError.message);
          setBusy(false);
          return;
        }
      }

      // Check if user was already registered (Supabase returns empty identities array)
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        const msg = "An account with this email is already registered. Please login.";
        setErrorMessage(msg);
        toast.error(msg);
        setBusy(false);
        return;
      }

      // Ensure user was actually created in Supabase Auth
      if (!signUpData?.user) {
        const msg = "Failed to create user in Supabase Auth. Please try again.";
        setErrorMessage(msg);
        toast.error(msg);
        setBusy(false);
        return;
      }

      // 2. Dispatch OTP / transition to OTP screen
      // Supabase Auth signUp has already dispatched the verification email with the 6-digit OTP code.
      const res = await sendOtpRequest(email, name).catch(() => ({
        success: true,
        message: "Verification code sent to your email",
        cooldownSeconds: 60,
        expiresInSeconds: 300,
      }));

      // Only halt if there is an explicit rate limit / validation error (not static hosting 404/405)
      if (!res.success && res.message && !res.message.includes("405") && !res.message.includes("404")) {
        setErrorMessage(res.message);
        toast.error(res.message);
        setBusy(false);
        return;
      }

      toast.success(`Verification code sent to ${email}`);
      setCooldown(res.cooldownSeconds ?? 60);
      setExpiresIn(res.expiresInSeconds ?? 300);
      setOtp("");
      setErrorMessage(null);
      setStep("otp");
    } catch (err: any) {
      const msg = err?.message || "Failed to initiate registration. Please check your network connection.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 2: Resend OTP
   */
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setErrorMessage(null);

    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();

    try {
      // Trigger Supabase resend
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      }).catch(() => null);

      // Ping custom OTP endpoint if available
      const res = await sendOtpRequest(email, name).catch(() => ({
        success: true,
        message: "A new verification code has been sent to your email!",
        cooldownSeconds: 60,
        expiresInSeconds: 300,
      }));

      toast.success("A new verification code has been sent to your email!");
      setCooldown(res.cooldownSeconds ?? 60);
      setExpiresIn(res.expiresInSeconds ?? 300);
      setOtp("");
      setErrorMessage(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to resend OTP. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  /**
   * Step 3: Verify OTP, confirm Supabase Auth email, and log in user
   */
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }
    if (expiresIn === 0) {
      setErrorMessage("This code has expired. Please click 'Resend OTP' to receive a fresh code.");
      toast.error("OTP has expired. Please request a new code.");
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    const email = f.email.trim().toLowerCase();

    try {
      // 1. Verify OTP with server endpoint (which also executes Supabase email confirmation)
      const verifyRes = await verifyOtpRequest(email, otp);

      if (!verifyRes.success) {
        setErrorMessage(verifyRes.message);
        toast.error(verifyRes.message);
        setVerifying(false);
        return;
      }

      // If server returned verified Supabase session tokens, set them immediately
      if (verifyRes.session?.access_token) {
        await supabase.auth.setSession({
          access_token: verifyRes.session.access_token,
          refresh_token: verifyRes.session.refresh_token,
        }).catch(() => null);
      }

      let authUser: any = null;
      let signInErrorMsg: string | null = null;

      // 2. Direct Supabase Auth OTP verification (for native 6-digit signup tokens)
      try {
        let { data: otpVerifyData, error: otpVerifyError } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: "signup",
        });

        // Fallback to type 'email' if 'signup' is not accepted by GoTrue
        if (!otpVerifyData?.user && otpVerifyError) {
          const fallbackVerify = await supabase.auth.verifyOtp({
            email,
            token: otp.trim(),
            type: "email",
          });
          if (fallbackVerify.data?.user) {
            otpVerifyData = fallbackVerify.data;
            otpVerifyError = null;
          }
        }

        if (otpVerifyData?.user) {
          authUser = otpVerifyData.user;
          if (otpVerifyData.session) {
            await supabase.auth.setSession({
              access_token: otpVerifyData.session.access_token,
              refresh_token: otpVerifyData.session.refresh_token,
            }).catch(() => null);
          }
        } else if (otpVerifyError) {
          signInErrorMsg = otpVerifyError.message;
        }
      } catch (err: any) {
        signInErrorMsg = err?.message || null;
      }

      // 3. If verifyOtp didn't yield an authUser, try password sign-in
      if (!authUser) {
        const firstAttempt = await supabase.auth.signInWithPassword({
          email,
          password: f.password,
        });

        if (firstAttempt.data?.user) {
          authUser = firstAttempt.data.user;
          signInErrorMsg = null;
        } else {
          signInErrorMsg = firstAttempt.error?.message || signInErrorMsg || null;
          // Only retry briefly if email confirmation replication is pending
          if (signInErrorMsg?.toLowerCase().includes("email not confirmed")) {
            await new Promise((r) => setTimeout(r, 500));
            const retryAttempt = await supabase.auth.signInWithPassword({
              email,
              password: f.password,
            });
            if (retryAttempt.data?.user) {
              authUser = retryAttempt.data.user;
              signInErrorMsg = null;
            } else if (retryAttempt.error) {
              signInErrorMsg = retryAttempt.error.message;
            }
          }
        }
      }

      if (!authUser) {
        // Fallback: check session from setSession or verifyOtp
        const { data: userData } = (await supabase.auth.getUser?.().catch(() => ({ data: { user: null } }))) || { data: { user: null } };
        if (userData?.user) {
          authUser = userData.user;
        }
      }

      // 4. Strict authentication verification: do NOT report success if user session could not be established
      if (!authUser) {
        const errorMsg = signInErrorMsg?.toLowerCase().includes("email not confirmed")
          ? "Account was created in Supabase Auth, but email confirmation is pending. Please verify using the 6-digit code or link sent to your email."
          : (signInErrorMsg
              ? `Could not establish an active user session: ${signInErrorMsg}`
              : "Invalid verification code. Please check the 6-digit code sent to your email, or click the link in your confirmation email.");
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        setVerifying(false);
        return;
      }

      // 4. Ensure profile is created/updated in profiles table
      try {
        await supabase.from("profiles").upsert({
          id: authUser.id,
          full_name: f.name.trim(),
          email,
          mobile: f.mobile.trim(),
          state: f.state,
          district: f.district.trim(),
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Non-fatal if trigger or previous upsert already handled it
      }

      toast.success("Account verified successfully! Welcome to Scheme Finder.");
      setStep("success");

      // Redirect to dashboard
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1000);
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred during verification. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Action: "Change Email" returns to registration form with values preserved
   */
  const handleChangeEmail = () => {
    setErrorMessage(null);
    setOtp("");
    setStep("form");
  };

  // Success View
  if (step === "success") {
    return (
      <AuthLayout title="Account Verified!" subtitle="Redirecting to your dashboard...">
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10 animate-pulse" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Welcome to Scheme Finder</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Your email <b>{f.email}</b> has been verified and your account is active.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => navigate("/dashboard", { replace: true })}
          >
            Go to Dashboard
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // OTP Verification View
  if (step === "otp") {
    return (
      <AuthLayout
        title="Verify Your Email"
        subtitle={`We sent a 6-digit verification code to ${f.email}`}
      >
        <div className="space-y-6">
          {/* Header Badge */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>Enter the code from your email to activate your account</span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6-Digit OTP Input */}
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Label htmlFor="otp-input" className="text-xs uppercase tracking-wider text-muted-foreground">
                6-Digit Verification Code
              </Label>
              <InputOTP
                id="otp-input"
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={verifying}
                autoFocus
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="h-12 w-11 rounded-md border text-lg font-bold" />
                  <InputOTPSlot index={1} className="h-12 w-11 rounded-md border text-lg font-bold" />
                  <InputOTPSlot index={2} className="h-12 w-11 rounded-md border text-lg font-bold" />
                  <InputOTPSlot index={3} className="h-12 w-11 rounded-md border text-lg font-bold" />
                  <InputOTPSlot index={4} className="h-12 w-11 rounded-md border text-lg font-bold" />
                  <InputOTPSlot index={5} className="h-12 w-11 rounded-md border text-lg font-bold" />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-center text-xs text-muted-foreground max-w-xs">
                Enter the 6-digit code sent to your email. If your email contains a confirmation link, you can also click it to verify.
              </p>
            </div>

            {/* Timers display */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-b py-2 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Expires in:{" "}
                  <b className={expiresIn < 60 ? "text-destructive font-mono" : "text-foreground font-mono"}>
                    {formatTime(expiresIn)}
                  </b>
                </span>
              </div>
              <div>
                {cooldown > 0 ? (
                  <span>Resend available in: <b className="text-foreground font-mono">{cooldown}s</b></span>
                ) : (
                  <span className="text-emerald-600 font-medium">Ready to resend</span>
                )}
              </div>
            </div>

            {/* Primary Action: Verify OTP */}
            <Button
              type="submit"
              className="w-full"
              disabled={otp.length !== 6 || verifying || expiresIn === 0}
            >
              {verifying ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying OTP...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Verify OTP
                </>
              )}
            </Button>
          </form>

          {/* Secondary Actions: Resend OTP and Change Email */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={cooldown > 0 || resending}
              onClick={handleResendOtp}
            >
              {resending ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending fresh code...
                </>
              ) : cooldown > 0 ? (
                `Resend OTP in ${cooldown}s`
              ) : (
                <>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Resend OTP
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleChangeEmail}
              disabled={verifying}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Change Email
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Registration Form View (Default)
  return (
    <AuthLayout title="Create your account" subtitle="It takes less than a minute">
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleInitiateRegistration} className="space-y-4">
        <div>
          <Label htmlFor="reg-name">Full name</Label>
          <Input
            id="reg-name"
            required
            value={f.name}
            onChange={set("name")}
            placeholder="e.g. Ramesh Kumar"
          />
        </div>
        <div>
          <Label htmlFor="reg-email">Email address</Label>
          <Input
            id="reg-email"
            type="email"
            required
            value={f.email}
            onChange={set("email")}
            placeholder="name@example.com"
          />
        </div>
        <div>
          <Label htmlFor="reg-mobile">Mobile number</Label>
          <Input
            id="reg-mobile"
            inputMode="numeric"
            maxLength={10}
            required
            value={f.mobile}
            onChange={set("mobile")}
            placeholder="10-digit mobile number"
          />
        </div>
        <div>
          <Label htmlFor="reg-password">Password</Label>
          <Input
            id="reg-password"
            type="password"
            minLength={6}
            required
            value={f.password}
            onChange={set("password")}
            placeholder="At least 6 characters"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="reg-state">State</Label>
            <Select value={f.state} onValueChange={(v) => setF({ ...f, state: v })}>
              <SelectTrigger id="reg-state">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reg-district">District</Label>
            <Input
              id="reg-district"
              required
              value={f.district}
              onChange={set("district")}
              placeholder="Your district"
            />
          </div>
        </div>

        <Button className="w-full" disabled={busy}>
          {busy ? (
            <>
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              Creating Account & Sending OTP...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/auth" className="text-primary underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
