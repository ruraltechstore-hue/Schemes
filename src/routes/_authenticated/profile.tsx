import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useProfile, useAgentProfile } from "@/hooks/use-app-data";
import { STATES } from "@/lib/constants";

export default function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: agentProfile, isLoading: agentLoading } = useAgentProfile();
  const qc = useQueryClient();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    mobile: "",
    agency_name: "",
    address: "",
    state: "",
    district: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (agentProfile) {
      setFormData({
        full_name: agentProfile.full_name || profile?.full_name || "",
        email: agentProfile.email || "",
        mobile: agentProfile.mobile || profile?.mobile || "",
        agency_name: agentProfile.agency_name || "",
        address: agentProfile.address || "",
        state: agentProfile.state || profile?.state || "",
        district: agentProfile.district || profile?.district || "",
      });
    } else if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: "",
        mobile: profile.mobile || "",
        agency_name: "",
        address: "",
        state: profile.state || "",
        district: profile.district || "",
      });
    }
  }, [agentProfile, profile]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("User session expired");

      // Update agent profile
      const { error: agentErr } = await supabase
        .from("agent_profiles")
        .update({
          full_name: formData.full_name,
          mobile: formData.mobile,
          agency_name: formData.agency_name,
          address: formData.address,
          state: formData.state,
          district: formData.district,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (agentErr) throw agentErr;

      // Update regular profile if exists for backward compatibility
      if (profile) {
        await supabase
          .from("profiles")
          .update({
            full_name: formData.full_name,
            mobile: formData.mobile,
            state: formData.state,
            district: formData.district,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      }

      toast.success("Agent profile details saved successfully");
      qc.invalidateQueries({ queryKey: ["agentProfile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  const status = agentProfile?.status || (agentProfile as any)?.approval_status || "approved";

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Agent Profile"
        subtitle="Manage your authorized agency profile, contact credentials, and operating jurisdiction."
      />

      {/* Approval Status Card */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">
                  {formData.agency_name || "Agency / Organization"}
                </h2>
                {status === "approved" && (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approved Agent
                  </Badge>
                )}
                {status === "pending" && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <Clock className="mr-1 h-3.5 w-3.5" /> Pending Verification
                  </Badge>
                )}
                {status === "rejected" && (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Rejected
                  </Badge>
                )}
                {status === "suspended" && (
                  <Badge variant="destructive" className="bg-rose-700">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Suspended
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                <span>Agent In-Charge: <b>{formData.full_name || "Agent"}</b></span>
                {(agentProfile?.reviewed_at || (agentProfile as any)?.approved_at) && (
                  <span className="text-xs text-muted-foreground">
                    • Reviewed on {new Date(agentProfile.reviewed_at || (agentProfile as any).approved_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account Status
            </div>
            <div className="text-sm font-medium capitalize text-foreground mt-0.5">
              {status} Partner
            </div>
          </div>
        </div>

        {agentProfile?.rejection_reason && status === "rejected" && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Reason: {agentProfile.rejection_reason}</span>
          </div>
        )}

        {agentProfile?.suspension_reason && status === "suspended" && (
          <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Suspension Notice: {agentProfile.suspension_reason}</span>
          </div>
        )}
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="space-y-6 rounded-xl border bg-card p-6 shadow-card">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Agency & Contact Information
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agency_name">Organization / Agency Name *</Label>
            <Input
              id="agency_name"
              value={formData.agency_name}
              onChange={(e) => handleChange("agency_name", e.target.value)}
              placeholder="e.g. Gramin Seva Kendra"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Agent In-Charge Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground">
              Primary email linked to your secure authentication account.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Number *</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => handleChange("mobile", e.target.value)}
              placeholder="10-digit mobile number"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Operating Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Office or field station address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select value={formData.state} onValueChange={(val) => handleChange("state", val)}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">District *</Label>
            <Input
              id="district"
              value={formData.district}
              onChange={(e) => handleChange("district", e.target.value)}
              placeholder="e.g. Varanasi"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button type="submit" disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving Changes..." : "Save Profile Details"}
          </Button>
        </div>
      </form>
    </div>
  );
}
