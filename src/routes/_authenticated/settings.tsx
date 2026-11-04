import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { useUser } from "@/hooks/use-app-data";

export default SettingsPage;

function SettingsPage() {
  const { data: user } = useUser();
  const [current, setCurrent] = useState(""); const [pw, setPw] = useState("");
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed"); setPw(""); setCurrent("");
  };
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" />
      <div className="mb-6 rounded-lg border bg-card p-6 shadow-card">
        <h2 className="font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </div>
      <form onSubmit={change} className="space-y-4 rounded-lg border bg-card p-6 shadow-card">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1.5"><Label htmlFor="current-password">Current password</Label><PasswordInput id="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" /></div>
        <div className="space-y-1.5"><Label htmlFor="settings-new-password">New password</Label><PasswordInput id="settings-new-password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min. 6 characters)" /></div>
        <Button>Update password</Button>
      </form>
    </div>
  );
}
