import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/AuthLayout";

export default Reset;

function Reset() {
  const nav = useNavigate(); const [pw, setPw] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated"); nav("/dashboard");
  };
  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>New password</Label><Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full">Update password</Button>
      </form>
    </AuthLayout>
  );
}
