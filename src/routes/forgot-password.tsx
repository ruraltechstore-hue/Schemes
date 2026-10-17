import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/AuthLayout";

export default Forgot;

function Forgot() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };
  return (
    <AuthLayout title="Forgot password" subtitle="We'll email you a reset link">
      {sent ? <p className="text-sm">If an account exists for <b>{email}</b>, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/auth" className="text-primary underline">Back to login</Link></p>
    </AuthLayout>
  );
}
