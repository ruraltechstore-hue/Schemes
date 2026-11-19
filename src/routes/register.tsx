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
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { sendOtpRequest, verifyOtpRequest, notifyAdminApprovalRequest } from "@/lib/otp-client";
import { useActiveSubAdmins } from "@/hooks/use-agent-data";

export default Register;

function Register() {
  const navigate = useNavigate();
  const [activeSubAdmins, setActiveSubAdmins] = useState<any[]>([]);
  const [subAdminsLoading, setSubAdminsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadActiveSubAdmins() {
      try {
        if (typeof supabase?.from !== "function") return;
        const fromRes = supabase.from("sub_admin_profiles");
        if (typeof fromRes?.select !== "function") return;
        const query = fromRes.select("id, full_name, email, organization_name, designation, avatar_url, is_active");
        const filtered = typeof query?.eq === "function" ? query.eq("is_active", true) : query;
        const ordered = typeof filtered?.order === "function" ? filtered.order("organization_name", { ascending: true }) : filtered;
        const { data, error } = await ordered;
        if (!error && Array.isArray(data) && isMounted) {
          setActiveSubAdmins(data);
        }
        if (isMounted) setSubAdminsLoading(false);
      } catch {
        if (isMounted) setSubAdminsLoading(false);
      }
    }
    loadActiveSubAdmins();
    return () => {
      isMounted = false;
    };
  }, []);

  const [f, setF] = useState({
    name: "",
    email: "",
    mobile: "",
    subAdminId: "",
    agencyName: "",
    address: "",
    state: "",
    district: "",
    password: "",
    confirmPassword: "",
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
  const isSubmittingRef = useRef(false);
  const isResendingRef = useRef(false);
  const isVerifyingRef = useRef(false);

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

    // Prevent duplicate submissions if already submitting
    if (isSubmittingRef.current || busy) {
      return;
    }
    isSubmittingRef.current = true;

    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();

    if (!/^[6-9]\d{9}$/.test(f.mobile)) {
      toast.error("Enter a valid 10-digit mobile number starting with 6-9");
      isSubmittingRef.current = false;
      return;
    }
    if (activeSubAdmins.length === 0) {
      toast.error("No active Sub-Admin is currently available. Please contact the administrator before registering.");
      setErrorMessage("No active Sub-Admin is currently available. Please contact the administrator before registering.");
      isSubmittingRef.current = false;
      return;
    }
    if (!f.subAdminId) {
      toast.error("Please select your Sub-Admin / Organization");
      setErrorMessage("Please select your Sub-Admin / Organization to route your registration.");
      isSubmittingRef.current = false;
      return;
    }

    const selectedSubAdmin = activeSubAdmins.find((s) => s.id === f.subAdminId);
    if (!selectedSubAdmin) {
      toast.error("The selected Sub-Admin is not active or valid. Please choose an active Sub-Admin.");
      setErrorMessage("The selected Sub-Admin is not active. Please choose an active Sub-Admin.");
      isSubmittingRef.current = false;
      return;
    }

    if (!f.state) {
      toast.error("Please select your state");
      isSubmittingRef.current = false;
      return;
    }
    if (f.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      isSubmittingRef.current = false;
      return;
    }
    if (f.confirmPassword && f.confirmPassword !== f.password) {
      toast.error("Passwords do not match");
      setErrorMessage("Passwords do not match");
      isSubmittingRef.current = false;
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
            agency_name: f.agencyName?.trim() || `${name}'s Agency`,
            address: f.address?.trim() || `${f.district.trim()}, ${f.state}`,
            state: f.state,
            district: f.district.trim(),
            role: "agent",
            is_agent: true,
            sub_admin_id: f.subAdminId,
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
          isSubmittingRef.current = false;
          return;
        } else if (
          signUpError.message.toLowerCase().includes("signups are disabled") ||
          signUpError.message.toLowerCase().includes("signup is disabled")
        ) {
          const msg =
            "Email signups are disabled in Supabase. In your Supabase Dashboard (Authentication → Providers → Email), ensure BOTH 'Enable Email provider' and 'Allow new users to sign up' are toggled ON. Only 'Confirm email' should be toggled OFF.";
          setErrorMessage(msg);
          toast.error(msg);
          setBusy(false);
          isSubmittingRef.current = false;
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
          isSubmittingRef.current = false;
          return;
        } else {
          setErrorMessage(signUpError.message);
          toast.error(signUpError.message);
          setBusy(false);
          isSubmittingRef.current = false;
          return;
        }
      }

      // Check if user was already registered (Supabase returns empty identities array)
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        const msg = "An account with this email is already registered. Please login.";
        setErrorMessage(msg);
        toast.error(msg);
        setBusy(false);
        isSubmittingRef.current = false;
        return;
      }

      // Ensure user was actually created in Supabase Auth
      if (!signUpData?.user) {
        const msg = "Failed to create user in Supabase Auth. Please try again.";
        setErrorMessage(msg);
        toast.error(msg);
        setBusy(false);
        isSubmittingRef.current = false;
        return;
      }

      // Create corresponding agent profile as UNVERIFIED (no Admin approval request at this stage)
      try {
        await supabase.from("agent_profiles").upsert({
          id: signUpData.user.id,
          full_name: name,
          email,
          mobile: f.mobile.trim(),
          agency_name: f.agencyName?.trim() || `${name}'s Agency`,
          address: f.address?.trim() || `${f.district.trim()}, ${f.state}`,
          state: f.state,
          district: f.district.trim(),
          status: "unverified",
          email_verified: false,
          sub_admin_id: f.subAdminId,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Could not pre-register unverified agent profile:", err);
      }

      // 2. Dispatch exactly ONE OTP email via Resend API
      const res = await sendOtpRequest(email, name);

      // Only halt if there is an explicit rate limit / validation error
      if (!res.success && res.message && !res.message.includes("405") && !res.message.includes("404")) {
        setErrorMessage(res.message);
        toast.error(res.message);
        setBusy(false);
        isSubmittingRef.current = false;
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
      isSubmittingRef.current = false;
    }
  };

  /**
   * Step 2: Resend OTP
   * Sends exactly ONE new OTP email via Resend API (no redundant Supabase Auth resend call)
   */
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending || isResendingRef.current) return;
    isResendingRef.current = true;
    setResending(true);
    setErrorMessage(null);

    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();

    try {
      // Retain only one single OTP-sending mechanism (Resend API)
      const res = await sendOtpRequest(email, name);

      if (!res.success) {
        setErrorMessage(res.message);
        toast.error(res.message);
        setResending(false);
        isResendingRef.current = false;
        return;
      }

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
      isResendingRef.current = false;
    }
  };

  /**
   * Step 3: Verify OTP, confirm Supabase Auth email, and log in user
   */
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifyingRef.current || verifying) return;
    isVerifyingRef.current = true;

    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      isVerifyingRef.current = false;
      return;
    }
    if (expiresIn === 0) {
      setErrorMessage("This code has expired. Please click 'Resend OTP' to receive a fresh code.");
      toast.error("OTP has expired. Please request a new code.");
      isVerifyingRef.current = false;
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    const email = f.email.trim().toLowerCase();

    try {
      // 1. Verify OTP with server endpoint (single OTP generation and delivery mechanism)
      const verifyRes = await verifyOtpRequest(email, otp);

      if (!verifyRes.success) {
        setErrorMessage(verifyRes.message);
        toast.error(verifyRes.message);
        setVerifying(false);
        isVerifyingRef.current = false;
        return;
      }

      // Verify selected Sub-Admin exists and is active before creating the approval request
      let subAdminCheck: any = null;
      if (f.subAdminId) {
        const { data: sap } = await supabase
          .from("sub_admin_profiles")
          .select("id, is_active, full_name, organization_name, email")
          .eq("id", f.subAdminId)
          .maybeSingle();

        if (!sap || sap.is_active !== true) {
          const subAdminErrMsg = "The selected Sub-Admin is no longer active. Please return to the registration form and select another active Sub-Admin.";
          setErrorMessage(subAdminErrMsg);
          toast.error(subAdminErrMsg);
          setStep("form");
          setVerifying(false);
          isVerifyingRef.current = false;
          return;
        }
        subAdminCheck = sap;
      } else {
        const subAdminErrMsg = "No Sub-Admin was selected for routing. Please select an active Sub-Admin.";
        setErrorMessage(subAdminErrMsg);
        toast.error(subAdminErrMsg);
        setStep("form");
        setVerifying(false);
        isVerifyingRef.current = false;
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
          ? "Account was created in Supabase Auth, but email confirmation is pending. Please verify using the 6-digit code sent to your email."
          : (signInErrorMsg
            ? `Could not establish an active user session: ${signInErrorMsg}`
            : "Invalid verification code. Please check the 6-digit code sent to your email.");
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        setVerifying(false);
        isVerifyingRef.current = false;
        return;
      }

      // Step 3 – Successful OTP Verification:
      // Mark agent's email as verified, activate agent profile with approval status 'pending',
      // assign explicitly to the selected Sub-Admin, and route the approval request.
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

        await supabase.from("agent_profiles").upsert({
          id: authUser.id,
          full_name: f.name.trim(),
          email,
          mobile: f.mobile.trim(),
          agency_name: f.agencyName?.trim() || `${f.name.trim()}'s Agency`,
          address: f.address?.trim() || `${f.district.trim()}, ${f.state}`,
          state: f.state,
          district: f.district.trim(),
          status: "pending",
          email_verified: true,
          otp_verified_at: new Date().toISOString(),
          sub_admin_id: f.subAdminId,
          updated_at: new Date().toISOString(),
        });

        // Trigger secure RPC to ensure server-side verification status
        try {
          await supabase.rpc("complete_agent_email_verification", { _user_id: authUser.id });
        } catch {
          // Fallback if RPC is not yet applied in remote schema
        }

        // Notify the exact selected Sub-Admin through in-app notifications
        if (f.subAdminId) {
          try {
            await supabase.from("notifications").insert({
              user_id: f.subAdminId,
              title: "New Agent Approval Request",
              message: `${f.name.trim()} (${f.agencyName?.trim() || "Agent Partner"}) has registered under ${subAdminCheck.organization_name} and requested approval.`,
              type: "agent_approval",
              data: {
                agent_id: authUser.id,
                agent_name: f.name.trim(),
                email,
                mobile: f.mobile.trim(),
                sub_admin_id: f.subAdminId,
                organization_name: subAdminCheck.organization_name,
              },
            });
          } catch (notifErr) {
            console.warn("Could not insert sub-admin notification:", notifErr);
          }
        }

        // Send approval notification email to assigned Sub-Admin and Main Admin
        await notifyAdminApprovalRequest({
          id: authUser.id,
          fullName: f.name.trim(),
          email,
          mobile: f.mobile.trim(),
          agencyName: f.agencyName?.trim() || `${f.name.trim()}'s Agency`,
          address: f.address?.trim() || `${f.district.trim()}, ${f.state}`,
          state: f.state,
          district: f.district.trim(),
          subAdminId: f.subAdminId,
          subAdminName: subAdminCheck.full_name,
          subAdminEmail: subAdminCheck.email,
          organizationName: subAdminCheck.organization_name,
        }).catch(() => null);
      } catch (err) {
        console.warn("Could not activate verified agent profile:", err);
      }

      const verifiedSuccessMsg =
        `Your email has been verified successfully. Your registration request has been routed to ${subAdminCheck.organization_name} for review and approval.`;
      toast.success(verifiedSuccessMsg);
      setStep("success");
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred during verification. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
      isVerifyingRef.current = false;
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

  // Success View - Agent Registration Pending Approval
  if (step === "success") {
    return (
      <AuthLayout title="Registration Submitted" subtitle="Agent Approval Pending">
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-foreground">Welcome to Scheme Finder</h3>
          <p className="mt-3 text-sm font-medium text-emerald-800 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            Your email has been verified successfully. Your registration request has been sent to the Admin for approval. You will be able to access your Agent Dashboard after approval.
          </p>
          <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-left text-xs space-y-1.5">
            <p><span className="text-muted-foreground">Full Name:</span> <span className="font-semibold">{f.name}</span></p>
            <p><span className="text-muted-foreground">Email:</span> <span className="font-semibold">{f.email}</span></p>
            <p><span className="text-muted-foreground">Agency / Organization:</span> <span className="font-semibold">{f.agencyName || `${f.name}'s Agency`}</span></p>
            <p><span className="text-muted-foreground">Status:</span> <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">Pending Admin Approval</span></p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Once approved by the platform administrator, you will be able to log in and access the Agent Dashboard to manage beneficiaries and check scheme eligibility.
          </p>
          <Button
            className="mt-6 w-full"
            variant="outline"
            asChild
          >
            <Link to="/auth">Return to Agent Login</Link>
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
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-2">
          <div className="flex items-start gap-2 font-semibold text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Registration Notice</span>
          </div>
          <p className="leading-relaxed">{errorMessage}</p>
          {(errorMessage.includes("Confirm email") || errorMessage.includes("signups are disabled")) && (
            <div className="mt-2 pt-2 border-t border-destructive/20 text-xs text-foreground/90 space-y-2">
              <p className="font-semibold text-foreground">Exact Supabase Dashboard Settings:</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-muted-foreground">
                <li>
                  Go to{" "}
                  <a
                    href="https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/auth/providers"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-primary font-medium hover:text-primary/80 inline-flex items-center gap-0.5"
                  >
                    Supabase Dashboard ➔ Authentication ➔ Providers ➔ Email <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </li>
                <li><b>Enable Email provider</b>: Keep <span className="text-emerald-600 font-semibold">ON</span></li>
                <li><b>Allow new users to sign up</b>: Keep <span className="text-emerald-600 font-semibold">ON</span> (Required for user accounts)</li>
                <li><b>Confirm email</b>: Toggle <span className="text-amber-600 font-semibold">OFF</span> (Disabled, Scheme Compass handles 6-digit OTP verification)</li>
                <li>Click <b>Save</b> at the bottom, then click <b>Register Agent</b> again</li>
              </ol>
            </div>
          )}
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
          <Label htmlFor="reg-agency">Organization / Agency Name</Label>
          <Input
            id="reg-agency"
            value={f.agencyName}
            onChange={set("agencyName")}
            placeholder="e.g. Gram Seva Kendra / Citizen Connect"
          />
        </div>
        <div>
          <Label htmlFor="reg-sub-admin" className="flex items-center justify-between">
            <span>Select Your Sub-Admin <span className="text-destructive">*</span></span>
            {subAdminsLoading && <span className="text-xs text-muted-foreground font-normal">Loading...</span>}
          </Label>
          <Select
            id="reg-sub-admin"
            value={f.subAdminId}
            onValueChange={(v) => setF({ ...f, subAdminId: v })}
            disabled={subAdminsLoading || activeSubAdmins.length === 0}
          >
            <SelectTrigger id="reg-sub-admin" aria-label="Select Your Sub-Admin">
              <SelectValue placeholder={subAdminsLoading ? "Loading Sub-Admins..." : "Select organization / Sub-Admin"} />
            </SelectTrigger>
            <SelectContent>
              {activeSubAdmins.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.organization_name} — {s.full_name} ({s.designation || "Sub-Admin"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Select the Sub-Admin / Organization responsible for reviewing and approving your agent registration.
          </p>
          {!subAdminsLoading && activeSubAdmins.length === 0 && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>No active Sub-Admin is currently available. Please contact the administrator before registering.</span>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="reg-address">Address</Label>
          <Input
            id="reg-address"
            value={f.address}
            onChange={set("address")}
            placeholder="Office / operational address"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="reg-state">State</Label>
            <Select id="reg-state" value={f.state} onValueChange={(v) => setF({ ...f, state: v })}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="reg-password">Password</Label>
            <PasswordInput
              id="reg-password"
              minLength={6}
              required
              value={f.password}
              onChange={set("password")}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <Label htmlFor="reg-confirm-password">Confirm Pass&#8203;word</Label>
            <PasswordInput
              id="reg-confirm-password"
              minLength={6}
              value={f.confirmPassword}
              onChange={set("confirmPassword")}
              placeholder="Repeat password"
            />
          </div>
        </div>

        <Button className="w-full" disabled={busy || (!subAdminsLoading && activeSubAdmins.length === 0)}>
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
