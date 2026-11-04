import type { Tables } from "@/integrations/supabase/types";
import { DOC_TYPES } from "@/lib/constants";
import { splitRequiredDocuments } from "@/lib/document-helpers";

export type Scheme = Tables<"schemes">;
export type Profile = Tables<"profiles">;
export type ManagedUser = Tables<"managed_users">;

export type BeneficiaryData = {
  id?: string;
  full_name?: string | null;
  dob?: string | null;
  age?: number | null;
  gender?: string | null;
  category?: string | null;
  annual_income?: number | string | null;
  occupation?: string | null;
  education?: string | null;
  state?: string | null;
  district?: string | null;
  area?: string | null;
  is_farmer?: boolean | null;
  is_student?: boolean | null;
  has_disability?: boolean | null;
  disability_percentage?: number | null;
  marital_status?: string | null;
  family_size?: number | null;
  mobile?: string | null;
  email?: string | null;
};

export type Eligibility = {
  min_age?: number; max_age?: number; genders?: string[]; categories?: string[];
  max_income?: number; occupations?: string[]; states?: string[];
  farmer?: boolean; student?: boolean; disability?: boolean; area?: string;
  application_process?: string; application_deadline?: string;
  application_video_url?: string; video_type?: string;
};

export type MatchStatus = "eligible" | "ineligible" | "needs_verification";

export type MatchResult = {
  scheme: Scheme;
  percent: number;
  eligible: boolean;
  status: MatchStatus;
  reasons: string[];
  missing: string[];
  failedReasons: string[];
  missingDocs: string[];
};

export function age(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a >= 0 ? a : null;
}

export function matchScheme(
  scheme: Scheme,
  p: BeneficiaryData | Profile | ManagedUser | null,
  docTypes: string[] = []
): MatchResult {
  const e = ((scheme as any).eligibility ?? (scheme as any).eligibility_criteria ?? {}) as Eligibility;
  const reasons: string[] = [];
  const missing: string[] = [];
  const failedReasons: string[] = [];
  let failed = false;
  let total = 0;
  let met = 0;

  const check = (
    applies: boolean,
    value: unknown,
    ok: () => boolean,
    okMsg: string,
    failMsg: string,
    unknownMsg: string
  ) => {
    if (!applies) return;
    total++;
    if (value === null || value === undefined || value === "") {
      missing.push(unknownMsg);
      return;
    }
    if (ok()) {
      met++;
      reasons.push(okMsg);
    } else {
      failed = true;
      failedReasons.push(failMsg);
    }
  };

  // Support both calculated age from dob or directly provided age
  const calculatedAge = (p as any)?.age != null && (p as any)?.age !== ""
    ? Number((p as any).age)
    : age(p?.dob);

  check(
    e.min_age != null || e.max_age != null,
    calculatedAge,
    () => (e.min_age == null || calculatedAge! >= e.min_age) && (e.max_age == null || calculatedAge! <= e.max_age),
    `Age (${calculatedAge}) fits the ${e.min_age ?? 0}–${e.max_age ?? "∞"} range`,
    `Age must be ${e.min_age ?? 0}–${e.max_age ?? "any"} (applicant is ${calculatedAge ?? "unknown"})`,
    "Date of birth / age is required"
  );

  check(
    !!e.genders?.length,
    p?.gender,
    () => e.genders!.some((g) => g.toLowerCase() === (p!.gender || "").toLowerCase()),
    `Open to ${e.genders?.join("/")} applicants`,
    `Only for ${e.genders?.join("/")} applicants`,
    "Gender is required"
  );

  check(
    !!e.categories?.length,
    p?.category,
    () => e.categories!.some((c) => c.toLowerCase() === (p!.category || "").toLowerCase()),
    `Category (${p?.category}) is covered`,
    `Only for ${e.categories?.join("/")} categories`,
    "Social category is required"
  );

  check(
    e.max_income != null,
    p?.annual_income,
    () => Number(p!.annual_income) <= e.max_income!,
    `Income within ₹${e.max_income?.toLocaleString("en-IN")} limit`,
    `Income must be ≤ ₹${e.max_income?.toLocaleString("en-IN")}`,
    "Annual income is required"
  );

  check(
    !!e.occupations?.length,
    p?.occupation,
    () => e.occupations!.some((o) => o.toLowerCase() === (p!.occupation || "").toLowerCase()),
    `Occupation (${p?.occupation}) qualifies`,
    `For ${e.occupations?.join("/")} only`,
    "Occupation is required"
  );

  check(
    !!e.states?.length,
    p?.state,
    () => e.states!.some((s) => s.toLowerCase() === (p!.state || "").toLowerCase()),
    `Available in ${p?.state}`,
    `Only available in ${e.states?.join(", ")}`,
    "State is required"
  );

  check(
    !!e.area,
    p?.area,
    () => (p!.area || "").toLowerCase() === (e.area || "").toLowerCase(),
    `Located in ${e.area} area`,
    `Only for ${e.area} residents`,
    "Rural/Urban area is required"
  );

  check(
    e.farmer === true || (e as any).is_farmer === true,
    p?.is_farmer,
    () => !!p!.is_farmer,
    "Applicant is a farmer",
    "Only for farmers",
    "Farmer status is required"
  );

  check(
    e.student === true || (e as any).is_student === true,
    p?.is_student,
    () => !!p!.is_student,
    "Applicant is a student",
    "Only for students",
    "Student status is required"
  );

  check(
    e.disability === true || (e as any).has_disability === true,
    p?.has_disability,
    () => !!p!.has_disability,
    "Applicant has recorded disability",
    "Only for persons with disability",
    "Disability status is required"
  );

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

  // Determine strict status:
  // - Ineligible: Any mandatory condition is explicitly failed
  // - Needs Verification: Condition information is missing / unverified
  // - Eligible: All condition requirements are satisfied without missing information
  let status: MatchStatus = "eligible";
  let isEligible = false;

  if (failed) {
    status = "ineligible";
    isEligible = false;
  } else if (missing.length > 0) {
    status = "needs_verification";
    isEligible = false; // NEVER mark as eligible when mandatory info is missing!
  } else {
    status = "eligible";
    isEligible = true;
  }

  const percent = Math.round(
    ((met + docMet + (total === 0 ? 1 : 0)) / Math.max(1, total + docTotal + (total === 0 ? 1 : 0))) * 100
  );

  return {
    scheme,
    percent,
    eligible: isEligible,
    status,
    reasons,
    missing,
    failedReasons,
    missingDocs,
  };
}

const PROFILE_FIELDS: (keyof BeneficiaryData)[] = [
  "full_name",
  "mobile",
  "state",
  "district",
  "dob",
  "gender",
  "category",
  "annual_income",
  "occupation",
  "family_size",
  "area",
];

export function profileCompletion(p: BeneficiaryData | Profile | null) {
  if (!p) return 0;
  const filled = PROFILE_FIELDS.filter((k) => (p as any)[k] !== null && (p as any)[k] !== undefined && (p as any)[k] !== "").length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}
