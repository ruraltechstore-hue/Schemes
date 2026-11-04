import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserPlus,
  ArrowLeft,
  Save,
  CheckCircle,
  RotateCw,
  Building,
  User,
  BadgeCheck,
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
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { useUser, useIsAdmin } from "@/hooks/use-app-data";
import { useAgentProfile } from "@/hooks/use-agent-data";
import { CASTE_CATEGORIES, GENDERS, OCCUPATIONS, STATES } from "@/lib/constants";
import { age as calcAge } from "@/lib/matching";

const EDUCATION_LEVELS = [
  "Below 10th",
  "10th Pass",
  "12th Pass",
  "ITI / Vocational",
  "Diploma",
  "Graduate (B.A, B.Sc, B.Com, etc.)",
  "Post Graduate (M.A, M.Sc, etc.)",
  "Doctorate / PhD",
  "No Formal Education",
];

const MARITAL_STATUSES = ["Single", "Married", "Widowed", "Divorced / Separated"];

export default function AddNewUser() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const { data: isAdmin } = useIsAdmin();
  const { data: agentProfile } = useAgentProfile(user?.id);
  const isBlocked = Boolean(!isAdmin && (
    agentProfile?.status === "pending" ||
    agentProfile?.status === "rejected" ||
    agentProfile?.status === "suspended"
  ));
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    age: "",
    gender: "",
    mobile: "",
    email: "",
    state: "",
    district: "",
    area: "Rural",
    annualIncome: "",
    occupation: "",
    education: "",
    category: "General",
    hasDisability: false,
    disabilityPercentage: "",
    isFarmer: false,
    isStudent: false,
    maritalStatus: "Single",
    familySize: "1",
  });

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dobVal = e.target.value;
    const computed = calcAge(dobVal);
    setForm((prev) => ({
      ...prev,
      dob: dobVal,
      age: computed != null ? String(computed) : prev.age,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to add beneficiaries.");
      return;
    }

    if (isBlocked) {
      if (agentProfile?.status === "pending") {
        toast.error("Your agent registration has been submitted. Please wait for admin approval before adding beneficiaries.");
      } else if (agentProfile?.status === "rejected") {
        toast.error("Your agent account has been rejected by the administrator.");
      } else if (agentProfile?.status === "suspended") {
        toast.error("Your agent account has been suspended by the administrator.");
      }
      return;
    }

    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!form.gender) {
      toast.error("Please select a gender");
      return;
    }
    if (!form.state) {
      toast.error("Please select a state");
      return;
    }
    if (!form.district.trim()) {
      toast.error("District is required");
      return;
    }
    if (form.mobile && !/^\d{10}$/.test(form.mobile.trim())) {
      toast.error("Mobile number must be 10 digits");
      return;
    }

    setBusy(true);

    try {
      // Prevent accidental duplicate records for this agent
      if (form.mobile) {
        const { data: existingByMobile } = await supabase
          .from("managed_users")
          .select("id, full_name, mobile")
          .eq("agent_id", user.id)
          .eq("mobile", form.mobile.trim())
          .maybeSingle();

        if (existingByMobile) {
          toast.error(
            `A beneficiary with mobile ${form.mobile.trim()} already exists: "${existingByMobile.full_name}".`
          );
          setBusy(false);
          return;
        }
      }

      if (form.fullName.trim() && form.dob) {
        const { data: existingByNameDob } = await supabase
          .from("managed_users")
          .select("id, full_name")
          .eq("agent_id", user.id)
          .ilike("full_name", form.fullName.trim())
          .eq("dob", form.dob)
          .maybeSingle();

        if (existingByNameDob) {
          toast.error(
            `A beneficiary named "${form.fullName.trim()}" with the same date of birth already exists.`
          );
          setBusy(false);
          return;
        }
      }

      const payload: any = {
        agent_id: user.id,
        full_name: form.fullName.trim(),
        dob: form.dob || null,
        age: form.age ? parseInt(form.age, 10) : calcAge(form.dob),
        gender: form.gender,
        mobile: form.mobile.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        state: form.state,
        district: form.district.trim(),
        area: form.area || "Rural",
        annual_income: form.annualIncome ? parseFloat(form.annualIncome) : 0,
        occupation: form.occupation || "Unemployed",
        education: form.education || null,
        category: form.category || "General",
        has_disability: form.hasDisability,
        disability_percentage:
          form.hasDisability && form.disabilityPercentage
            ? parseInt(form.disabilityPercentage, 10)
            : null,
        is_farmer: form.isFarmer,
        is_student: form.isStudent,
        marital_status: form.maritalStatus || "Single",
        family_size: form.familySize ? parseInt(form.familySize, 10) : 1,
      };

      const { data, error } = await supabase
        .from("managed_users")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Beneficiary ${form.fullName} registered successfully!`);
      await qc.invalidateQueries({ queryKey: ["managedUsers"] });

      // Navigate to individual user details & document upload page
      navigate(`/agent/users/${data.id}`);
    } catch (err: any) {
      console.error("Add user error:", err);
      toast.error("Failed to add user: " + (err.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Beneficiary</h1>
          <p className="text-sm text-muted-foreground">
            Register a citizen profile to check eligibility across all central and state government schemes.
          </p>
        </div>
      </div>

      {isBlocked && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 text-sm flex items-start gap-3 shadow-sm">
          <BadgeCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">
              {agentProfile?.status === "pending"
                ? "Agent Registration Pending Admin Approval"
                : "Agent Access Suspended or Rejected"}
            </p>
            <p className="text-xs text-amber-800">
              {agentProfile?.status === "pending"
                ? "Your agent registration has been submitted and is awaiting administrator verification. Once approved by an admin, you can add and manage beneficiary profiles."
                : "Your agent account is currently not active. Please contact platform administration."}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal & Identity Information */}
        <div className="rounded-xl border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold border-b pb-2 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Personal & Identification Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                required
                placeholder="Full name as per Aadhaar / Official ID"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={form.dob}
                onChange={handleDobChange}
              />
            </div>
            <div>
              <Label htmlFor="age">Age (Years)</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="125"
                placeholder="Calculated or manual age"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="marital_status">Marital Status</Label>
              <Select
                value={form.maritalStatus}
                onValueChange={(v) => setForm({ ...form, maritalStatus: v })}
              >
                <SelectTrigger id="marital_status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mobile">Mobile Number (10 digits)</Label>
              <Input
                id="mobile"
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="beneficiary@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Residential & Location Details */}
        <div className="rounded-xl border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold border-b pb-2 flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Residential & Location Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="state">State *</Label>
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
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
              <Label htmlFor="district">District *</Label>
              <Input
                id="district"
                required
                placeholder="e.g. Pune / Lucknow"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="area">Area Type (Rural / Urban)</Label>
              <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                <SelectTrigger id="area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rural">Rural</SelectItem>
                  <SelectItem value="Urban">Urban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 3: Socio-Economic & Eligibility Attributes */}
        <div className="rounded-xl border bg-card p-5 md:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold border-b pb-2 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Socio-Economic & Scheme Eligibility Criteria
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="annual_income">Annual Family Income (₹)</Label>
              <Input
                id="annual_income"
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 180000"
                value={form.annualIncome}
                onChange={(e) => setForm({ ...form, annualIncome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="category">Social Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASTE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="family_size">Family Size</Label>
              <Input
                id="family_size"
                type="number"
                min="1"
                placeholder="e.g. 4"
                value={form.familySize}
                onChange={(e) => setForm({ ...form, familySize: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="occupation">Occupation</Label>
              <Select
                value={form.occupation}
                onValueChange={(v) => setForm({ ...form, occupation: v })}
              >
                <SelectTrigger id="occupation">
                  <SelectValue placeholder="Select primary occupation" />
                </SelectTrigger>
                <SelectContent>
                  {OCCUPATIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="education">Highest Education Completed</Label>
              <Select
                value={form.education}
                onValueChange={(v) => setForm({ ...form, education: v })}
              >
                <SelectTrigger id="education">
                  <SelectValue placeholder="Select educational level" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((ed) => (
                    <SelectItem key={ed} value={ed}>
                      {ed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Eligibility Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="is_farmer" className="cursor-pointer font-medium">
                  Landholding Farmer
                </Label>
                <p className="text-xs text-muted-foreground">Engaged in agriculture</p>
              </div>
              <Switch
                id="is_farmer"
                checked={form.isFarmer}
                onCheckedChange={(c) => setForm({ ...form, isFarmer: c })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="is_student" className="cursor-pointer font-medium">
                  Enrolled Student
                </Label>
                <p className="text-xs text-muted-foreground">School or college attendee</p>
              </div>
              <Switch
                id="is_student"
                checked={form.isStudent}
                onCheckedChange={(c) => setForm({ ...form, isStudent: c })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="has_disability" className="cursor-pointer font-medium">
                  Person with Disability
                </Label>
                <p className="text-xs text-muted-foreground">Specially-abled criteria</p>
              </div>
              <Switch
                id="has_disability"
                checked={form.hasDisability}
                onCheckedChange={(c) => setForm({ ...form, hasDisability: c })}
              />
            </div>
          </div>

          {form.hasDisability && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 max-w-sm">
              <Label htmlFor="disability_percentage">Disability Percentage (%)</Label>
              <Input
                id="disability_percentage"
                type="number"
                min="1"
                max="100"
                placeholder="e.g. 40, 80"
                value={form.disabilityPercentage}
                onChange={(e) => setForm({ ...form, disabilityPercentage: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Certain pension schemes require 40% or 80%+ certified disability.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/users">Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy} className="gap-2 min-w-[160px]">
            {busy ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save & Check Schemes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
