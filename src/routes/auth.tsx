import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/AuthLayout";

export default Login;

function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [expiredMsg, setExpiredMsg] = useState<string | null>(() => {
    if (location.state?.message) return location.state.message as string;
    try {
      const stored = sessionStorage.getItem("inactivity_logout_message");
      if (stored) {
        sessionStorage.removeItem("inactivity_logout_message");
        return stored;
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    if (location.state?.message && location.state.message !== expiredMsg) {
      setExpiredMsg(location.state.message as string);
    }
  }, [location.state?.message, expiredMsg]);

  useEffect(() => {
    if (expiredMsg) {
      toast.warning(expiredMsg);
    }
  }, [expiredMsg]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Please enter your email address");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setBusy(true);
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      // If Supabase returned "Email not confirmed", check if this account belongs to an active Sub-Admin
      // Sub-Admins are provisioned by Main Admin and log in directly without OTP/email confirmation
      if (error && error.message.toLowerCase().includes("email not confirmed")) {
        try {
          if (typeof supabase?.rpc === "function") {
            const { data: wasSubAdmin } = await supabase.rpc("confirm_sub_admin_email", {
              _email: normalizedEmail,
            });

            if (wasSubAdmin) {
              // Sub-Admin confirmed; retry sign-in immediately
              const retryRes = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });
              data = retryRes.data;
              error = retryRes.error;
            }
          }
        } catch (rpcErr) {
          console.warn("Sub-admin auto-confirm check error:", rpcErr);
        }
      }

      setBusy(false);

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          toast.error("Invalid email or password. Please verify your credentials and try again.");
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          let isSubAdminAccount = false;
          try {
            const { data: subAdminCheck } = await supabase
              .from("sub_admin_profiles")
              .select("id, is_active")
              .ilike("email", normalizedEmail)
              .maybeSingle();
            if (subAdminCheck) {
              isSubAdminAccount = true;
            }
          } catch {
            // ignore
          }

          if (isSubAdminAccount) {
            toast.error(
              "Sub-Admin email is not yet confirmed. Please ensure 'Confirm email' is turned OFF in Supabase Auth (Authentication -> Providers -> Email) or run the migration script in Supabase SQL editor.",
              { duration: 8000 }
            );
          } else {
            toast.error(
              "Your email is not verified yet. Please complete registration OTP verification.",
            );
          }
        } else if (
          error.message.toLowerCase().includes("fetch") ||
          error.message.toLowerCase().includes("network")
        ) {
          toast.error(
            "Network error. Unable to connect to authentication service. Please check your connection.",
          );
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data?.user) {
        let { data: roleRecords } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        let roles = (roleRecords || []).map((r: any) => r.role);

        // Fallback: If role is not in user_roles, check sub_admin_profiles directly
        if (!roles.includes("admin") && !roles.includes("sub_admin")) {
          const { data: subAdminCheck } = await supabase
            .from("sub_admin_profiles")
            .select("id, is_active")
            .eq("id", data.user.id)
            .maybeSingle();

          if (subAdminCheck) {
            roles.push("sub_admin");
          }
        }

        if (roles.includes("admin")) {
          toast.success("Welcome back, Administrator!");
          nav("/admin");
          return;
        }

        if (roles.includes("sub_admin")) {
          const { data: subAdminProfile } = await supabase
            .from("sub_admin_profiles")
            .select("*")
            .eq("id", data.user.id)
            .maybeSingle();

          if (subAdminProfile && subAdminProfile.is_active === false) {
            await supabase.auth.signOut();
            toast.error("Your Sub-Admin account has been deactivated. Please contact the Main Administrator.");
            return;
          }

          toast.success(
            `Welcome back, ${subAdminProfile?.full_name || "Sub-Admin"}${
              subAdminProfile?.organization_name ? ` (${subAdminProfile.organization_name})` : ""
            }!`
          );
          nav("/sub-admin");
          return;
        }

        const { data: agentData } = await supabase
          .from("agent_profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

        if (agentData) {
          if (agentData.status === "unverified" || agentData.email_verified === false) {
            toast.error("Please complete email verification to activate your agent account.");
            nav("/register");
            return;
          }
          if (agentData.status === "pending") {
            toast.info(
              "Your agent registration has been submitted. Please wait for admin approval.",
            );
            nav("/dashboard");
            return;
          }
          if (agentData.status === "rejected") {
            toast.error("Your agent application has been rejected. Please contact support.");
            nav("/dashboard");
            return;
          }
          if (agentData.status === "suspended") {
            toast.error("Your agent account has been suspended. Please contact administrator.");
            nav("/dashboard");
            return;
          }
          toast.success(`Welcome back, Agent ${agentData.full_name || ""}!`);
          nav("/dashboard");
          return;
        }

        toast.success("Welcome back!");
        nav("/dashboard");
      }
    } catch (err: unknown) {
      setBusy(false);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(errorMessage);
    }
  };

  return (
    <AuthLayout title="Agent Login" subtitle="Access your scheme dashboard & beneficiary portal">
      {expiredMsg && (
        <div
          role="alert"
          data-testid="session-expired-alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900 shadow-sm"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 font-medium">{expiredMsg}</div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link to="/forgot-password" className="text-sm text-primary underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>
        <Button className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Login"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New agent?{" "}
        <Link to="/register" className="text-primary underline font-medium">
          Register as an Agent
        </Link>
      </p>
    </AuthLayout>
  );
}
