import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/AuthLayout";

export default Reset;

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (pw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated successfully");
    nav("/dashboard");
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password with at least 6 characters">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            minLength={6}
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            minLength={6}
            required
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Repeat new password"
          />
        </div>
        <Button className="w-full" disabled={busy}>
          {busy ? "Updating password..." : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
