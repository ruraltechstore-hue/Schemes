import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useProfile } from "@/hooks/use-app-data";
import { profileCompletion, type Profile } from "@/lib/matching";
import { CASTE_CATEGORIES, GENDERS, OCCUPATIONS, STATES } from "@/lib/constants";

export default ProfilePage;

function Sel({ label, value, options, onChange }: { label: string; value?: string | null | undefined; options: string[]; onChange: (v: string) => void }) {
  return (
    <div><Label>{label}</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select></div>
  );
}

function ProfilePage() {
  const { data } = useProfile(); const qc = useQueryClient();
  const [p, setP] = useState<Partial<Profile>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setP(data); }, [data]);
  const up = (k: keyof Profile, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!data) return; setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name ?? null, mobile: p.mobile ?? null, state: p.state ?? null, district: p.district ?? null, dob: p.dob || null, gender: p.gender ?? null,
      category: p.category ?? null, annual_income: p.annual_income == null || (p.annual_income as unknown) === "" ? null : Number(p.annual_income),
      occupation: p.occupation ?? null, family_size: p.family_size ? Number(p.family_size) : null, is_farmer: !!p.is_farmer, is_student: !!p.is_student,
      has_disability: !!p.has_disability, area: p.area ?? null, updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const pc = profileCompletion(p as Profile);
  return (
    <div>
      <PageHeader title="My Profile" subtitle="This information is used to match you with schemes." />
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-card">
        <div className="flex justify-between text-sm"><span>Profile completion</span><b>{pc}%</b></div>
        <Progress value={pc} className="mt-2 h-2" />
      </div>
      <form onSubmit={save} className="space-y-6 rounded-lg border bg-card p-6 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Full name</Label><Input value={p.full_name ?? ""} onChange={(e) => up("full_name", e.target.value)} /></div>
          <div><Label>Mobile</Label><Input value={p.mobile ?? ""} onChange={(e) => up("mobile", e.target.value)} /></div>
          <div><Label>Date of birth</Label><Input type="date" value={p.dob ?? ""} onChange={(e) => up("dob", e.target.value)} /></div>
          <Sel label="Gender" value={p.gender} options={GENDERS} onChange={(v) => up("gender", v)} />
          <Sel label="State" value={p.state} options={STATES} onChange={(v) => up("state", v)} />
          <div><Label>District</Label><Input value={p.district ?? ""} onChange={(e) => up("district", e.target.value)} /></div>
          <Sel label="Category" value={p.category} options={CASTE_CATEGORIES} onChange={(v) => up("category", v)} />
          <div><Label>Annual family income (₹)</Label><Input type="number" min={0} value={p.annual_income ?? ""} onChange={(e) => up("annual_income", e.target.value)} /></div>
          <Sel label="Occupation" value={p.occupation} options={OCCUPATIONS} onChange={(v) => up("occupation", v)} />
          <div><Label>Family size</Label><Input type="number" min={1} value={p.family_size ?? ""} onChange={(e) => up("family_size", e.target.value)} /></div>
          <Sel label="Residence" value={p.area} options={["Rural", "Urban"]} onChange={(v) => up("area", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {([["is_farmer", "I am a farmer"], ["is_student", "I am a student"], ["has_disability", "I have a disability"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center justify-between rounded-md border p-3 text-sm">{l}
              <Switch checked={!!p[k]} onCheckedChange={(v) => up(k, v)} /></label>
          ))}
        </div>
        <Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </form>
    </div>
  );
}
