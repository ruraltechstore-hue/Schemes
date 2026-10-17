import * as XLSX from "xlsx";
import { isYouTubeUrl } from "./video-helpers";
import { CASTE_CATEGORIES, DOC_TYPES, GENDERS, OCCUPATIONS, SCHEME_CATEGORIES, STATES } from "./constants";
import { splitRequiredDocuments } from "./document-helpers";
export { splitRequiredDocuments } from "./document-helpers";
import type { Scheme, Eligibility } from "./matching";

export type TargetFieldKey =
  | "name"
  | "description"
  | "ministry"
  | "level"
  | "state"
  | "category"
  | "benefits"
  | "eligibility_text"
  | "required_documents"
  | "application_process"
  | "apply_url"
  | "application_deadline"
  | "application_video_url"
  | "min_age"
  | "max_age"
  | "max_income"
  | "genders"
  | "caste_categories"
  | "occupations"
  | "states"
  | "area"
  | "farmer"
  | "student"
  | "disability"
  | "__ignore__";

export interface TargetFieldDef {
  key: TargetFieldKey;
  label: string;
  required?: boolean;
  group: "core" | "process" | "eligibility_rule";
  description: string;
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  {
    key: "name",
    label: "Scheme Name",
    required: true,
    group: "core",
    description: "Full title or name of the scheme (Required)",
    aliases: [
      "scheme name",
      "name",
      "scheme_name",
      "scheme",
      "title",
      "name of scheme",
      "schemename",
      "scheme title",
      "scheme_title",
      "program name",
      "project name",
    ],
  },
  {
    key: "description",
    label: "Description",
    group: "core",
    description: "Detailed description and overview of the scheme",
    aliases: [
      "description",
      "desc",
      "details",
      "about",
      "summary",
      "overview",
      "scheme description",
      "about scheme",
      "scheme details",
      "objective",
      "objectives",
    ],
  },
  {
    key: "ministry",
    label: "Department / Ministry",
    group: "core",
    description: "Nodal Ministry or implementing Government Department",
    aliases: [
      "department",
      "ministry",
      "dept",
      "ministry/department",
      "ministry department",
      "department ministry",
      "nodal ministry",
      "nodal department",
      "implementing agency",
      "agency",
      "govt department",
      "government department",
      "ministry name",
    ],
  },
  {
    key: "level",
    label: "Government Type / Level",
    group: "core",
    description: "Central or State government",
    aliases: [
      "government type",
      "government_type",
      "gov type",
      "govt type",
      "level",
      "govt_type",
      "scheme type",
      "type",
      "central state",
      "central or state",
      "government level",
    ],
  },
  {
    key: "state",
    label: "State",
    group: "core",
    description: "Applicable state name (or blank / All for Central schemes)",
    aliases: [
      "state",
      "state / ut",
      "state ut",
      "state/ut",
      "target state",
      "state name",
      "applicable state",
      "specific state",
      "province",
    ],
  },
  {
    key: "category",
    label: "Category",
    group: "core",
    description: "Sector (e.g. Agriculture, Healthcare, Education, Women, Housing)",
    aliases: [
      "category",
      "sector",
      "scheme category",
      "domain",
      "category name",
      "theme",
      "focus area",
    ],
  },
  {
    key: "benefits",
    label: "Benefits",
    group: "core",
    description: "Financial, subsidy, or in-kind assistance provided",
    aliases: [
      "benefits",
      "benefit",
      "scheme benefits",
      "financial assistance",
      "assistance",
      "coverage",
      "grant",
      "support",
      "financial benefit",
      "subsidy",
    ],
  },
  {
    key: "eligibility_text",
    label: "Eligibility Criteria",
    group: "core",
    description: "Summary or rules of who can apply for the scheme",
    aliases: [
      "eligibility criteria",
      "eligibility",
      "eligibility_text",
      "eligibility details",
      "criteria",
      "eligibility summary",
      "who can apply",
      "eligibility condition",
      "eligibility conditions",
      "qualification",
      "eligible persons",
    ],
  },
  {
    key: "required_documents",
    label: "Required Documents",
    group: "core",
    description: "Documents required (separated by commas or semicolons)",
    aliases: [
      "required documents",
      "required_documents",
      "documents required",
      "documents",
      "doc required",
      "docs",
      "supporting documents",
      "mandatory documents",
      "document list",
      "certificates required",
    ],
  },
  {
    key: "apply_url",
    label: "Official Website URL",
    required: true,
    group: "process",
    description: "Official portal or application website link (Required)",
    aliases: [
      "official website url",
      "official website",
      "official url",
      "apply url",
      "apply_url",
      "website",
      "url",
      "portal url",
      "link",
      "official link",
      "website url",
      "portal",
      "application link",
      "online portal",
      "application url",
    ],
  },
  {
    key: "application_process",
    label: "Application Process",
    group: "process",
    description: "Step-by-step instructions on how to apply",
    aliases: [
      "application process",
      "application_process",
      "how to apply",
      "application procedure",
      "mode of application",
      "application steps",
      "procedure",
      "process",
      "how to apply guide",
    ],
  },
  {
    key: "application_deadline",
    label: "Application Deadline",
    group: "process",
    description: "Last date or closing deadline to apply",
    aliases: [
      "application deadline",
      "application_deadline",
      "deadline",
      "last date",
      "end date",
      "due date",
      "valid till",
      "closing date",
      "expiry date",
      "last date to apply",
    ],
  },
  {
    key: "application_video_url",
    label: "Application Tutorial Video",
    group: "process",
    description: "YouTube link or video guide URL",
    aliases: [
      "application tutorial video",
      "application_video_url",
      "tutorial video",
      "video url",
      "video link",
      "youtube link",
      "youtube url",
      "application video",
      "how to apply video",
      "video",
      "tutorial",
      "video guide",
    ],
  },
  {
    key: "min_age",
    label: "Min Age",
    group: "eligibility_rule",
    description: "Minimum age required",
    aliases: ["min age", "min_age", "minimum age", "age min", "lower age limit", "min age limit"],
  },
  {
    key: "max_age",
    label: "Max Age",
    group: "eligibility_rule",
    description: "Maximum age allowed",
    aliases: ["max age", "max_age", "maximum age", "age max", "upper age limit", "max age limit"],
  },
  {
    key: "max_income",
    label: "Max Income (₹)",
    group: "eligibility_rule",
    description: "Annual family income ceiling (e.g. 250000)",
    aliases: [
      "max income",
      "max_income",
      "maximum income",
      "income limit",
      "annual income limit",
      "income ceiling",
      "family income limit",
      "annual income",
    ],
  },
  {
    key: "genders",
    label: "Target Gender(s)",
    group: "eligibility_rule",
    description: "Male, Female, or Other (comma or semicolon separated)",
    aliases: ["gender", "genders", "target gender", "applicable gender", "sex"],
  },
  {
    key: "caste_categories",
    label: "Caste / Social Categories",
    group: "eligibility_rule",
    description: "SC, ST, OBC, General, EWS",
    aliases: [
      "caste categories",
      "caste category",
      "caste",
      "social categories",
      "social category",
      "categories",
      "castes",
      "community",
    ],
  },
  {
    key: "occupations",
    label: "Target Occupations",
    group: "eligibility_rule",
    description: "Farmer, Student, Artisan, Self-employed, etc.",
    aliases: [
      "occupations",
      "occupation",
      "target occupation",
      "profession",
      "target professions",
      "employment status",
    ],
  },
  {
    key: "states",
    label: "Eligible States (Multiple)",
    group: "eligibility_rule",
    description: "States where scheme is applicable (comma or semicolon separated)",
    aliases: ["states", "eligible states", "applicable states", "state list", "target states"],
  },
  {
    key: "area",
    label: "Area (Rural/Urban)",
    group: "eligibility_rule",
    description: "Rural, Urban, or Any",
    aliases: ["area", "residence", "locality", "residential area", "rural urban", "area type"],
  },
  {
    key: "farmer",
    label: "Farmer Only (Yes/No)",
    group: "eligibility_rule",
    description: "Whether the scheme is specifically for farmers",
    aliases: ["farmer", "is_farmer", "farmers only", "for farmers", "farmer only"],
  },
  {
    key: "student",
    label: "Student Only (Yes/No)",
    group: "eligibility_rule",
    description: "Whether the scheme is specifically for students",
    aliases: ["student", "is_student", "students only", "for students", "student only"],
  },
  {
    key: "disability",
    label: "Disability Only (Yes/No)",
    group: "eligibility_rule",
    description: "Whether the scheme is for persons with disabilities",
    aliases: [
      "disability",
      "has_disability",
      "disabled only",
      "for persons with disability",
      "disability only",
      "pwd",
      "divyangjan",
    ],
  },
];

/**
 * Normalizes a header string for reliable matching:
 * - Lowercase
 * - Replaces dashes, underscores, slashes, periods, and parentheses with spaces
 * - Collapses repeated whitespace
 * - Trims
 */
export function normalizeHeader(header: string): string {
  if (!header) return "";
  return header
    .toLowerCase()
    .replace(/[_\-/.()[\]{}*#:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches a column header against known target fields.
 * Returns the best matching TargetFieldKey, or null if no confident match.
 */
export function matchHeaderToField(header: string): TargetFieldKey | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;

  // 1. Direct exact alias match
  for (const field of TARGET_FIELDS) {
    for (const alias of field.aliases) {
      if (norm === alias) {
        return field.key;
      }
    }
  }

  // 2. Specific multi-word precedence checks to prevent sub-string false positives
  // e.g. "application tutorial video" before "application process" or "url"
  if (norm.includes("video") || norm.includes("youtube") || norm.includes("tutorial")) {
    return "application_video_url";
  }
  if (norm.includes("deadline") || norm.includes("last date") || norm.includes("closing date")) {
    return "application_deadline";
  }
  if (
    norm.includes("process") ||
    norm.includes("how to apply") ||
    norm.includes("procedure") ||
    norm.includes("steps to apply")
  ) {
    return "application_process";
  }
  if (
    norm.includes("website") ||
    norm.includes("portal") ||
    norm.includes("apply url") ||
    norm.includes("official url") ||
    (norm.includes("url") && !norm.includes("video")) ||
    (norm.includes("link") && !norm.includes("video"))
  ) {
    return "apply_url";
  }
  if (norm.includes("document") || norm.includes("docs required") || norm.includes("required doc")) {
    return "required_documents";
  }
  if (norm.includes("eligib") || norm.includes("criteria") || norm.includes("who can apply")) {
    return "eligibility_text";
  }
  if (norm.includes("benefit") || norm.includes("assistance") || norm.includes("subsidy")) {
    return "benefits";
  }
  if (norm.includes("ministry") || norm.includes("department") || norm.includes("nodal dept")) {
    return "ministry";
  }
  if (norm.includes("scheme name") || (norm.includes("name") && !norm.includes("state") && !norm.includes("dept") && !norm.includes("ministry"))) {
    return "name";
  }
  if (norm.includes("govt type") || norm.includes("government type") || norm.includes("level")) {
    return "level";
  }
  if (norm === "state" || norm.includes("state name") || norm.includes("target state") || norm.includes("state ut")) {
    return "state";
  }
  if (norm === "category" || norm.includes("scheme category") || norm.includes("sector")) {
    return "category";
  }
  if (norm.includes("desc") || norm.includes("overview") || norm.includes("about")) {
    return "description";
  }

  // 3. Substring check on aliases
  for (const field of TARGET_FIELDS) {
    for (const alias of field.aliases) {
      if (alias.length >= 4 && (norm.startsWith(alias) || norm.endsWith(alias) || norm.includes(` ${alias}`) || norm.includes(`${alias} `))) {
        return field.key;
      }
    }
  }

  return null;
}

/**
 * Automatically maps a list of uploaded headers to target fields.
 * Ensures each target field is assigned at most once by default (first or most confident wins).
 */
export function autoMapHeaders(headers: string[]): Record<string, TargetFieldKey | "__ignore__"> {
  const mapping: Record<string, TargetFieldKey | "__ignore__"> = {};
  const assigned = new Set<TargetFieldKey>();

  for (const header of headers) {
    const matched = matchHeaderToField(header);
    if (matched && matched !== "__ignore__" && !assigned.has(matched)) {
      mapping[header] = matched;
      assigned.add(matched);
    } else {
      mapping[header] = "__ignore__";
    }
  }

  return mapping;
}

/**
 * Robustly parses delimited text (supports commas, semicolons, newlines, pipes)
 * into a trimmed, deduplicated array of non-empty strings.
/**
 * Robustly parses delimited text (supports commas, semicolons, newlines, pipes, and full stops separating items)
 * into a trimmed, deduplicated array of non-empty strings.
 * Respects JSON array strings like `["Aadhaar", "PAN"]`.
 */
export function parseDelimitedList(value: unknown): string[] {
  return splitRequiredDocuments(value);
}

/**
 * Parses and canonicalizes required documents against DOC_TYPES
 */
export function parseRequiredDocuments(value: unknown): string[] {
  const rawList = splitRequiredDocuments(value);
  return rawList.map((doc) => {
    const lower = doc.toLowerCase().replace(/card|doc|documents|certificate/g, "").trim();
    // Match against known DOC_TYPES
    const found = DOC_TYPES.find((dt) => {
      const dtLower = dt.toLowerCase().replace(/card|doc|documents|certificate/g, "").trim();
      return dtLower === lower || dt.toLowerCase() === doc.toLowerCase();
    });
    return found || doc;
  });
}

/**
 * Parses numbers including Indian commas, Lakhs, ₹ symbols, and suffixes
 */
export function parseIndianNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return isNaN(value) ? undefined : value;

  const str = String(value).trim();
  if (!str) return undefined;

  // Handle "Lakh" or "Lac" notation: e.g. "2.5 Lakh" -> 250000
  const lakhMatch = str.match(/([\d.]+)\s*(?:lakh|lakhs|lac|lacs)/i);
  if (lakhMatch && lakhMatch[1]) {
    const n = parseFloat(lakhMatch[1]);
    return isNaN(n) ? undefined : Math.round(n * 100000);
  }

  // Handle Crore notation: e.g. "1 Cr" -> 10000000
  const crMatch = str.match(/([\d.]+)\s*(?:cr|crore|crores)/i);
  if (crMatch && crMatch[1]) {
    const n = parseFloat(crMatch[1]);
    return isNaN(n) ? undefined : Math.round(n * 10000000);
  }

  // Strip currency symbols, commas, spaces, dashes
  const cleaned = str.replace(/[₹Rs$,/ \t-]/gi, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses boolean representations (true, false, yes, no, 1, 0, y, n)
 */
export function parseBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "applicable", "only"].includes(s)) return true;
  if (["false", "no", "n", "0", "none", "not applicable", "na"].includes(s)) return false;
  return undefined;
}

/**
 * Normalizes URL: prepends https:// if missing protocol, validates format
 */
export function parseUrl(value: unknown): { url: string; valid: boolean } {
  if (!value) return { url: "", valid: false };
  let str = String(value).trim();
  if (!str) return { url: "", valid: false };

  // If no protocol given, add https://
  if (!/^https?:\/\//i.test(str)) {
    str = `https://${str}`;
  }

  try {
    const u = new URL(str);
    // Needs a valid hostname with at least one dot or localhost
    const valid = !!u.hostname && (u.hostname.includes(".") || u.hostname === "localhost");
    return { url: str, valid };
  } catch {
    return { url: str, valid: false };
  }
}

/**
 * Resolves scheme category against known SCHEME_CATEGORIES
 */
export function parseCategory(value: unknown): string {
  const str = String(value || "").trim();
  if (!str) return "Social Welfare";

  // Exact or case-insensitive match
  const found = SCHEME_CATEGORIES.find((c) => c.toLowerCase() === str.toLowerCase());
  if (found) return found;

  // Keyword heuristic matching
  const lower = str.toLowerCase();
  if (lower.includes("agri") || lower.includes("farm") || lower.includes("crop")) return "Agriculture";
  if (lower.includes("health") || lower.includes("medic") || lower.includes("hospital")) return "Healthcare";
  if (lower.includes("edu") || lower.includes("scholar") || lower.includes("school") || lower.includes("student")) return "Education";
  if (lower.includes("women") || lower.includes("woman") || lower.includes("girl") || lower.includes("female")) return "Women";
  if (lower.includes("house") || lower.includes("awas") || lower.includes("housing")) return "Housing";
  if (lower.includes("employ") || lower.includes("job") || lower.includes("skill") || lower.includes("train")) return "Employment";
  if (lower.includes("business") || lower.includes("msme") || lower.includes("loan") || lower.includes("startup")) return "Business";
  if (lower.includes("rural") || lower.includes("gramin") || lower.includes("village")) return "Rural Development";

  return str;
}

/**
 * Resolves Government Type (level) and State
 */
export function parseLevelAndState(
  levelRaw: unknown,
  stateRaw: unknown
): { level: "Central" | "State"; state: string | null } {
  const lStr = String(levelRaw || "").trim().toLowerCase();
  const sStr = String(stateRaw || "").trim();

  let state: string | null = null;
  if (sStr && !["all", "central", "all india", "india", "national", "none", "na", "-"].includes(sStr.toLowerCase())) {
    // Check if matches a known state
    const matchState = STATES.find((st) => st.toLowerCase() === sStr.toLowerCase());
    state = matchState || sStr;
  }

  let level: "Central" | "State" = "Central";
  if (lStr.includes("state")) {
    level = "State";
  } else if (lStr.includes("central") || lStr.includes("union") || lStr.includes("national")) {
    level = "Central";
  } else if (state) {
    // If state is provided and level wasn't explicitly central, set level to State
    level = "State";
  }

  return { level, state: level === "Central" ? null : state };
}

/**
 * Parses and extracts structured conditions from an Eligibility Criteria summary text
 * (e.g. "Min age: 18; Max income: 2.5 Lakh; Farmers only")
 */
export function extractStructuredEligibility(text: string): Partial<Eligibility> {
  const structured: Partial<Eligibility> = {};
  if (!text) return structured;

  // Age match e.g. "Age 18 to 60" or "Aged 18-50" or "Age: 18-50" or "Min age 18"
  const ageRangeMatch = text.match(/(?:age(?:d)?\s*(?:is|between|:)?\s*)(\d{1,2})\s*(?:to|-|–)\s*(\d{1,2})/i);
  if (ageRangeMatch && ageRangeMatch[1] && ageRangeMatch[2]) {
    structured.min_age = parseInt(ageRangeMatch[1], 10);
    structured.max_age = parseInt(ageRangeMatch[2], 10);
  } else {
    const minAgeMatch = text.match(/(?:min(?:imum)?\s*age\s*(?:is|:)?\s*|age\s*(?:>=|above|over)\s*)(\d{1,2})/i);
    if (minAgeMatch && minAgeMatch[1]) structured.min_age = parseInt(minAgeMatch[1], 10);
    const maxAgeMatch = text.match(/(?:max(?:imum)?\s*age\s*(?:is|:)?\s*|age\s*(?:<=|below|under|up\s*to)\s*)(\d{1,2})/i);
    if (maxAgeMatch && maxAgeMatch[1]) structured.max_age = parseInt(maxAgeMatch[1], 10);
  }

  // Income match e.g. "Income <= 250000" or "Income under 3,00,000" or "Income up to 2.5 Lakh"
  const incomeMatch = text.match(/(?:income|family income)\s*(?:<=|below|under|up\s*to|less\s*than|limit|:)?\s*([₹\d.,]+\s*(?:lakh|lakhs|cr|crore)?)/i);
  if (incomeMatch && incomeMatch[1]) {
    const parsedIncome = parseIndianNumber(incomeMatch[1]);
    if (parsedIncome) structured.max_income = parsedIncome;
  }

  // Keywords
  if (/\b(?:farmers?|kisan)\b/i.test(text) && !/\b(?:not\s+for\s+farmers?)\b/i.test(text)) {
    structured.farmer = true;
  }
  if (/\b(?:students?|pupils?)\b/i.test(text) && !/\b(?:not\s+for\s+students?)\b/i.test(text)) {
    structured.student = true;
  }
  if (/\b(?:disab(?:ility|led)|pwd|divyangjan)\b/i.test(text)) {
    structured.disability = true;
  }
  if (/\brural\b/i.test(text) && !/\burban\b/i.test(text)) {
    structured.area = "Rural";
  } else if (/\burban\b/i.test(text) && !/\brural\b/i.test(text)) {
    structured.area = "Urban";
  }

  // Genders
  if (/\b(?:women|female|girls?|mahila)\b/i.test(text) && !/\bmen\b/i.test(text)) {
    structured.genders = ["Female"];
  }

  // Social categories
  const matchedCategories: string[] = [];
  if (/\bSC\b/i.test(text)) matchedCategories.push("SC");
  if (/\bST\b/i.test(text)) matchedCategories.push("ST");
  if (/\bOBC\b/i.test(text)) matchedCategories.push("OBC");
  if (/\bEWS\b/i.test(text)) matchedCategories.push("EWS");
  if (matchedCategories.length > 0) {
    structured.categories = matchedCategories;
  }

  return structured;
}

export interface SchemeImportPayload {
  name: string;
  description: string;
  ministry: string;
  category: string;
  level: string;
  state: string | null;
  benefits: string;
  eligibility_text: string;
  required_documents: string[];
  apply_url: string;
  application_video_url: string | null;
  video_type: string | null;
  eligibility: Eligibility;
}

export interface ParsedRowResult {
  id: string; // unique key for UI
  originalRowIndex: number;
  rawRow: Record<string, any>;
  payload: SchemeImportPayload;
  status: "valid" | "duplicate" | "invalid";
  errors: string[];
  warnings: string[];
  existingScheme?: Scheme | undefined;
  skip: boolean;
}

/**
 * Safely extracts a cell value from a raw row by column header,
 * with fallbacks for exact match, trimmed match, BOM-stripped match, and normalized comparison.
 */
export function getRowValue(rawRow: Record<string, any>, colHeader: string): any {
  if (!rawRow || !colHeader) return undefined;

  // 1. Exact match
  if (rawRow[colHeader] !== undefined && rawRow[colHeader] !== null && rawRow[colHeader] !== "") {
    return rawRow[colHeader];
  }

  // 2. Clean/trimmed match
  const cleanHeader = colHeader.replace(/^\uFEFF/, "").trim();
  if (rawRow[cleanHeader] !== undefined && rawRow[cleanHeader] !== null && rawRow[cleanHeader] !== "") {
    return rawRow[cleanHeader];
  }

  // 3. Search through rawRow keys with normalized comparison
  const normTarget = cleanHeader.toLowerCase().replace(/[\s_\-]+/g, "");
  for (const [key, value] of Object.entries(rawRow)) {
    const normKey = key.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
    if (normKey === normTarget && value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

/**
 * Transforms a raw row using active column mappings into a complete database-ready Scheme payload.
 */
export function transformRowToPayload(
  rawRow: Record<string, any>,
  mapping: Record<string, TargetFieldKey | "__ignore__">
): SchemeImportPayload {
  // Aggregate all raw values by target field key
  const values: Partial<Record<TargetFieldKey, any>> = {};

  for (const [colHeader, targetKey] of Object.entries(mapping)) {
    if (targetKey && targetKey !== "__ignore__") {
      const val = getRowValue(rawRow, colHeader);
      if (val !== undefined && val !== null && val !== "") {
        values[targetKey] = val;
      }
    }
  }

  // Parse fields
  const name = String(values.name || "").trim();
  const description = String(values.description || "").trim();
  const ministry = String(values.ministry || "").trim();
  const category = parseCategory(values.category);
  const { level, state } = parseLevelAndState(values.level, values.state);
  const benefits = String(values.benefits || "").trim();
  const eligibility_text = String(values.eligibility_text || "").trim();
  const required_documents = parseRequiredDocuments(values.required_documents);

  const { url: apply_url } = parseUrl(values.apply_url);

  // Video
  const videoRaw = String(values.application_video_url || "").trim();
  const application_video_url = videoRaw || null;
  const video_type = application_video_url
    ? isYouTubeUrl(application_video_url)
      ? "youtube"
      : "uploaded"
    : null;

  // Process and deadline
  const application_process = values.application_process ? String(values.application_process).trim() : undefined;
  const application_deadline = values.application_deadline ? String(values.application_deadline).trim() : undefined;

  // Structured eligibility
  const textInferred = extractStructuredEligibility(eligibility_text);

  const min_age = parseIndianNumber(values.min_age) ?? textInferred.min_age;
  const max_age = parseIndianNumber(values.max_age) ?? textInferred.max_age;
  const max_income = parseIndianNumber(values.max_income) ?? textInferred.max_income;

  const rawGenders = parseDelimitedList(values.genders);
  const genders = rawGenders.length > 0 ? rawGenders : textInferred.genders;

  const rawCaste = parseDelimitedList(values.caste_categories);
  const categories = rawCaste.length > 0 ? rawCaste : textInferred.categories;

  const occupations = parseDelimitedList(values.occupations);
  const states = parseDelimitedList(values.states);

  const areaStr = String(values.area || "").trim().toLowerCase();
  const area = areaStr.includes("rural") ? "Rural" : areaStr.includes("urban") ? "Urban" : textInferred.area;

  const farmer = parseBoolean(values.farmer) ?? textInferred.farmer;
  const student = parseBoolean(values.student) ?? textInferred.student;
  const disability = parseBoolean(values.disability) ?? textInferred.disability;

  const eligibility: Eligibility = {};
  if (min_age !== undefined) eligibility.min_age = min_age;
  if (max_age !== undefined) eligibility.max_age = max_age;
  if (max_income !== undefined) eligibility.max_income = max_income;
  if (genders && genders.length > 0) eligibility.genders = genders;
  if (categories && categories.length > 0) eligibility.categories = categories;
  if (occupations && occupations.length > 0) eligibility.occupations = occupations;
  if (states && states.length > 0) eligibility.states = states;
  if (area) eligibility.area = area;
  if (farmer !== undefined) eligibility.farmer = farmer;
  if (student !== undefined) eligibility.student = student;
  if (disability !== undefined) eligibility.disability = disability;
  if (application_process) eligibility.application_process = application_process;
  if (application_deadline) eligibility.application_deadline = application_deadline;
  if (application_video_url) eligibility.application_video_url = application_video_url;
  if (video_type) eligibility.video_type = video_type;

  return {
    name,
    description,
    ministry,
    category,
    level,
    state,
    benefits,
    eligibility_text,
    required_documents,
    apply_url,
    application_video_url,
    video_type,
    eligibility,
  };
}

/**
 * Validates a parsed row and assigns its status (valid, duplicate, invalid)
 */
export function validateRowPayload(
  payload: SchemeImportPayload,
  rawRow: Record<string, any>,
  rowIndex: number,
  existingSchemes: Scheme[]
): ParsedRowResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload.name) {
    errors.push("Scheme Name is required");
  }

  if (!payload.apply_url) {
    errors.push("Official Website URL is required");
  } else {
    const { valid } = parseUrl(payload.apply_url);
    if (!valid) {
      errors.push("Invalid Official Website URL (e.g. https://example.gov.in)");
    }
  }

  if (payload.application_video_url) {
    const { valid } = parseUrl(payload.application_video_url);
    if (!valid) {
      warnings.push("Application Video URL appears malformed");
    }
  }

  // Check for duplicate scheme by name (case-insensitive)
  const existingScheme = existingSchemes.find(
    (s) => s.name.trim().toLowerCase() === payload.name.trim().toLowerCase()
  );

  const status: "valid" | "duplicate" | "invalid" =
    errors.length > 0 ? "invalid" : existingScheme ? "duplicate" : "valid";

  return {
    id: `row-${rowIndex}-${Math.random().toString(36).slice(2, 9)}`,
    originalRowIndex: rowIndex,
    rawRow,
    payload,
    status,
    errors,
    warnings,
    existingScheme,
    // By default, duplicate rows are NOT skipped if user selects 'update', but skipped if user selects 'skip'
    skip: false,
  };
}

/**
 * Standard CSV / Excel sample data template generator
 */
export function generateSampleData(): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    "Scheme Name",
    "Description",
    "Department",
    "Government Type",
    "State",
    "Category",
    "Eligibility Criteria",
    "Required Documents",
    "Benefits",
    "Application Process",
    "Official Website URL",
    "Application Deadline",
    "Application Tutorial Video",
  ];

  const rows: (string | number)[][] = [
    [
      "PM Kisan Samman Nidhi Yojana",
      "Direct income support of ₹6,000 per year in three equal installments to all landholding farmer families across the country.",
      "Ministry of Agriculture & Farmers Welfare",
      "Central",
      "",
      "Agriculture",
      "Landholding farmer families with cultivable land; Valid bank account linked with Aadhaar; Age 18+",
      "Aadhaar, Land Documents; Bank Documents",
      "₹6,000 per year deposited directly into bank accounts via DBT in three instalments of ₹2,000 each.",
      "1. Register on PM-KISAN portal (pmkisan.gov.in)\n2. Complete Aadhaar e-KYC\n3. Upload land records and bank details\n4. Submit for State verification",
      "https://pmkisan.gov.in",
      "2026-12-31",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "Ayushman Bharat - PMJAY",
      "World's largest government-funded health assurance scheme providing secondary and tertiary care hospitalization cover.",
      "Ministry of Health & Family Welfare",
      "Central",
      "",
      "Healthcare",
      "Economically vulnerable families identified by SECC 2011; Annual family income ≤ ₹2,50,000; No age restriction",
      "Aadhaar; Ration Card; Income Certificate",
      "Cashless health insurance coverage up to ₹5 lakh per family per year for hospitalisation in empanelled hospitals.",
      "1. Check eligibility on mera.pmjay.gov.in\n2. Visit nearest CSC or empanelled hospital with Aadhaar\n3. Generate Ayushman Golden Card",
      "https://pmjay.gov.in",
      "2026-12-31",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "Mukhyamantri Baliraja Shetkari Yojana",
      "Electricity bill concession and power tariff assistance for agricultural pump sets owned by farmers.",
      "Department of Energy & Agriculture",
      "State",
      "Maharashtra",
      "Agriculture",
      "Registered agricultural electricity consumers in Maharashtra; Farmers with active pump connections",
      "Aadhaar, Electricity Bill; Land Documents; 7/12 Extract",
      "Free daytime electricity and full subsidy on agricultural power bills for up to 5 years.",
      "Apply through Mahavitaran portal or visit local Mahavitaran sub-division office with electricity consumer number.",
      "https://mahadiscom.in",
      "2026-11-30",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
  ];

  return { headers, rows };
}

/**
 * Downloads a sample template in Excel or CSV format
 */
export function downloadSchemeTemplate(format: "xlsx" | "csv") {
  const { headers, rows } = generateSampleData();
  const aoa = [headers, ...rows];

  if (format === "csv") {
    // Escape values properly for CSV
    const csvContent = aoa
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "");
            if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scheme_upload_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Set nice column widths
    ws["!cols"] = [
      { wch: 30 }, // Scheme Name
      { wch: 45 }, // Description
      { wch: 35 }, // Department
      { wch: 18 }, // Government Type
      { wch: 18 }, // State
      { wch: 18 }, // Category
      { wch: 40 }, // Eligibility Criteria
      { wch: 35 }, // Required Documents
      { wch: 40 }, // Benefits
      { wch: 40 }, // Application Process
      { wch: 30 }, // Official Website URL
      { wch: 22 }, // Application Deadline
      { wch: 35 }, // Application Tutorial Video
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schemes_Template");
    XLSX.writeFile(wb, "scheme_upload_template.xlsx");
  }
}
