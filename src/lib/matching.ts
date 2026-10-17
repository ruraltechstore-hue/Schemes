import type { Tables } from "@/integrations/supabase/types";
import { DOC_TYPES } from "@/lib/constants";
import { splitRequiredDocuments } from "@/lib/document-helpers";

export type Scheme = Tables<"schemes">;
export type Profile = Tables<"profiles">;

export type Eligibility = {
  min_age?: number; max_age?: number; genders?: string[]; categories?: string[];
  max_income?: number; occupations?: string[]; states?: string[];
  farmer?: boolean; student?: boolean; disability?: boolean; area?: string;
  application_process?: string; application_deadline?: string;
  application_video_url?: string; video_type?: string;
};

export type MatchResult = {
  scheme: Scheme; percent: number; eligible: boolean;
  reasons: string[]; missing: string[]; missingDocs: string[];
};

export function age(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob); const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
}

export function matchScheme(scheme: Scheme, p: Profile | null, docTypes: string[]): MatchResult {
  const e = (scheme.eligibility ?? {}) as Eligibility;
  const reasons: string[] = []; const missing: string[] = []; let failed = false;
  let total = 0; let met = 0;
  const check = (applies: boolean, value: unknown, ok: () => boolean, okMsg: string, failMsg: string, unknownMsg: string) => {
    if (!applies) return;
    total++;
    if (value === null || value === undefined || value === "") { missing.push(unknownMsg); return; }
    if (ok()) { met++; reasons.push(okMsg); } else { failed = true; missing.push(failMsg); }
  };
  const a = age(p?.dob);
  check(e.min_age != null || e.max_age != null, a, () => (e.min_age == null || a! >= e.min_age) && (e.max_age == null || a! <= e.max_age),
    `Your age (${a}) fits the ${e.min_age ?? 0}–${e.max_age ?? "∞"} range`, `Age must be ${e.min_age ?? 0}–${e.max_age ?? "any"}`, "Add your date of birth");
  check(!!e.genders?.length, p?.gender, () => e.genders!.includes(p!.gender!), `Open to ${e.genders?.join("/")} applicants`, `Only for ${e.genders?.join("/")} applicants`, "Add your gender");
  check(!!e.categories?.length, p?.category, () => e.categories!.includes(p!.category!), `Your category (${p?.category}) is covered`, `Only for ${e.categories?.join("/")} categories`, "Add your social category");
  check(e.max_income != null, p?.annual_income, () => Number(p!.annual_income) <= e.max_income!, `Income within ₹${e.max_income?.toLocaleString("en-IN")} limit`, `Income must be ≤ ₹${e.max_income?.toLocaleString("en-IN")}`, "Add your annual income");
  check(!!e.occupations?.length, p?.occupation, () => e.occupations!.includes(p!.occupation!), `Your occupation (${p?.occupation}) qualifies`, `For ${e.occupations?.join("/")} only`, "Add your occupation");
  check(!!e.states?.length, p?.state, () => e.states!.includes(p!.state!), `Available in ${p?.state}`, `Only available in ${e.states?.join(", ")}`, "Add your state");
  check(!!e.area, p?.area, () => p!.area === e.area, `You live in a ${e.area?.toLowerCase()} area`, `Only for ${e.area?.toLowerCase()} residents`, "Add rural/urban status");
  check(e.farmer === true, p?.is_farmer, () => !!p!.is_farmer, "You are a farmer", "Only for farmers", "Add farmer status");
  check(e.student === true, p?.is_student, () => !!p!.is_student, "You are a student", "Only for students", "Add student status");
  check(e.disability === true, p?.has_disability, () => !!p!.has_disability, "You have a recorded disability", "Only for persons with disability", "Add disability status");

  const formattedDocs = splitRequiredDocuments(scheme.required_documents);
  const lowerDocTypes = new Set(docTypes.map((d) => d.trim().toLowerCase()));
  const standardTypesLower = DOC_TYPES.filter((t) => t.toLowerCase() !== "other documents").map((t) => t.toLowerCase());
  const hasCustomDoc = docTypes.some((dt) => !standardTypesLower.includes(dt.trim().toLowerCase()));

  const missingDocs = formattedDocs.filter((d) => {
    const dTrimmed = d.trim();
    const dLower = dTrimmed.toLowerCase();
    if (docTypes.includes(dTrimmed) || lowerDocTypes.has(dLower)) return false;

    // Check canonical / simplified match: e.g. "Aadhaar Card" matches "Aadhaar", "Bank Passbook" matches "Bank Documents"
    const docNormalizeRegex = /\b(?:card|documents|document|doc|certificate|certificates|passbook|passbooks)\b/gi;
    const foundCanonical = docTypes.some((dt) => {
      const dtSimple = dt.replace(docNormalizeRegex, "").trim().toLowerCase();
      const dSimple = dLower.replace(docNormalizeRegex, "").trim().toLowerCase();
      return (dtSimple.length > 0 && dtSimple === dSimple) || dt.toLowerCase() === dLower;
    });
    if (foundCanonical) return false;

    if (dLower === "other documents" && hasCustomDoc) return false;
    return true;
  });
  const docTotal = formattedDocs.length;
  const docMet = docTotal - missingDocs.length;
  if (docMet > 0) reasons.push(`${docMet} of ${docTotal} required documents uploaded`);
  if (total === 0) reasons.push("Open to all citizens");
  const percent = Math.round(((met + docMet + (total === 0 ? 1 : 0)) / Math.max(1, total + docTotal + (total === 0 ? 1 : 0))) * 100);
  return { scheme, percent, eligible: !failed, reasons, missing, missingDocs };
}

const PROFILE_FIELDS: (keyof Profile)[] = ["full_name","mobile","state","district","dob","gender","category","annual_income","occupation","family_size","area"];
export function profileCompletion(p: Profile | null) {
  if (!p) return 0;
  const filled = PROFILE_FIELDS.filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== "").length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}
