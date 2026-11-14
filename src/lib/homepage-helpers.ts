export interface SchemeRecord {
  id: string;
  name: string;
  description?: string | null;
  ministry?: string | null;
  category?: string | null;
  level?: string | null;
  state?: string | null;
  benefits?: string | null;
  eligibility?: any;
  eligibility_criteria?: any;
  eligibility_text?: string | null;
  required_documents?: string[] | null;
  apply_url?: string | null;
  application_video_url?: string | null;
  video_type?: string | null;
  created_at?: string | null;
}

export interface HomepageStats {
  totalSchemes: number;
  centralSchemes: number;
  stateSchemes: number;
  departmentsCount: number;
}

export interface HomepageCategoryDef {
  slug: string;
  title: string;
  description: string;
  dbCategory?: string;
}

export interface CitizenAudienceDef {
  slug: string;
  title: string;
  fallbackDescription: string;
}

export const HOMEPAGE_CATEGORIES: HomepageCategoryDef[] = [
  {
    slug: "agriculture",
    title: "Agriculture & Farmers",
    description: "Crop insurance, direct income support, and agricultural subsidies.",
    dbCategory: "Agriculture",
  },
  {
    slug: "education",
    title: "Education & Scholarships",
    description: "Pre-matric, post-matric scholarships, and tuition assistance.",
    dbCategory: "Education",
  },
  {
    slug: "healthcare",
    title: "Healthcare & Medical Assistance",
    description: "Cashless hospitalization, medical insurance, and health coverage.",
    dbCategory: "Healthcare",
  },
  {
    slug: "housing-rural",
    title: "Housing & Rural Development",
    description: "Affordable pucca houses and rural infrastructure initiatives.",
    dbCategory: "Housing",
  },
  {
    slug: "women",
    title: "Women Empowerment",
    description: "Support for women entrepreneurs, clean cooking fuel, and savings.",
    dbCategory: "Women",
  },
  {
    slug: "business",
    title: "Business & Entrepreneurship",
    description: "Collateral-free MSME loans, mudra credit, and enterprise grants.",
    dbCategory: "Business",
  },
  {
    slug: "employment",
    title: "Employment & Skill Development",
    description: "Free skill certification, artisan toolkits, and wage employment.",
    dbCategory: "Employment",
  },
  {
    slug: "social-welfare",
    title: "Social Welfare",
    description: "Social security pensions and support for vulnerable sections.",
    dbCategory: "Social Welfare",
  },
  {
    slug: "financial-assistance",
    title: "Financial Assistance",
    description: "Direct benefit transfers, low-interest credit, and pension plans.",
  },
  {
    slug: "transport-infrastructure",
    title: "Transport & Infrastructure",
    description: "Public mobility, rural connectivity, and infrastructure programs.",
  },
  {
    slug: "disability-welfare",
    title: "Disability Welfare",
    description: "Financial pensions and assistive support for persons with disabilities.",
  },
  {
    slug: "environment-rural",
    title: "Environment & Rural Development",
    description: "Clean energy, LPG access, and sustainable rural livelihoods.",
    dbCategory: "Rural Development",
  },
];

export const CITIZEN_AUDIENCES: CitizenAudienceDef[] = [
  {
    slug: "farmers",
    title: "Farmers",
    fallbackDescription:
      "Crop insurance, direct income transfers, and agricultural credit programs for landholding farmers.",
  },
  {
    slug: "students",
    title: "Students",
    fallbackDescription:
      "Tuition assistance, merit-based and reserved-category scholarships, and skill certification programs.",
  },
  {
    slug: "women",
    title: "Women",
    fallbackDescription:
      "Clean fuel access, girl-child savings, and greenfield enterprise financing initiatives for women.",
  },
  {
    slug: "entrepreneurs",
    title: "Entrepreneurs",
    fallbackDescription:
      "Collateral-free business credit, MSME enterprise loans, and support for self-employed founders.",
  },
  {
    slug: "job-seekers",
    title: "Job Seekers",
    fallbackDescription:
      "Industry-relevant skill training, guaranteed rural wage employment, and career readiness schemes.",
  },
  {
    slug: "working-professionals",
    title: "Working Professionals",
    fallbackDescription:
      "Artisan support, guaranteed pension plans, and social security for salaried and unorganised workers.",
  },
  {
    slug: "rural-families",
    title: "Rural Families",
    fallbackDescription:
      "Pucca housing grants, rural wage employment, household health cover, and essential welfare access.",
  },
  {
    slug: "senior-citizens",
    title: "Senior Citizens",
    fallbackDescription:
      "Post-retirement pension security, social welfare support, and healthcare assistance programs.",
  },
];

function getCombinedSchemeText(s: SchemeRecord): string {
  return [
    s.name,
    s.description,
    s.ministry,
    s.category,
    s.benefits,
    s.eligibility_text,
    s.state,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface EligibilityCriteriaObject {
  farmer?: boolean;
  is_farmer?: boolean;
  student?: boolean;
  is_student?: boolean;
  genders?: string[];
  occupations?: string[];
  disability?: boolean;
  has_disability?: boolean;
  area?: string;
  min_age?: number;
}

function getEligibilityObject(s: SchemeRecord): EligibilityCriteriaObject {
  const elig = s.eligibility_criteria || s.eligibility || {};
  return typeof elig === "object" && elig !== null
    ? (elig as EligibilityCriteriaObject)
    : {};
}

export function computeSchemeStats(schemes: SchemeRecord[] | null | undefined): HomepageStats {
  const list = Array.isArray(schemes) ? schemes : [];
  const totalSchemes = list.length;

  let centralSchemes = 0;
  let stateSchemes = 0;
  const departments = new Set<string>();

  for (const s of list) {
    const level = (s.level || "").trim().toLowerCase();
    if (level.includes("central")) {
      centralSchemes++;
    } else if (level.includes("state")) {
      stateSchemes++;
    }

    const ministry = (s.ministry || "").trim();
    if (ministry) {
      departments.add(ministry.toLowerCase());
    }
  }

  return {
    totalSchemes,
    centralSchemes,
    stateSchemes,
    departmentsCount: departments.size,
  };
}

export function schemeMatchesCategoryFilter(
  s: SchemeRecord,
  categoryParam: string
): boolean {
  if (!categoryParam) return true;
  const normParam = categoryParam.trim().toLowerCase();
  const cat = (s.category || "").trim().toLowerCase();
  const ministry = (s.ministry || "").trim().toLowerCase();
  const text = getCombinedSchemeText(s);
  const elig = getEligibilityObject(s);

  // Direct category name match (e.g. "Agriculture", "Education", "Social Welfare")
  if (cat && cat === normParam) return true;

  switch (normParam) {
    case "agriculture":
    case "agriculture & farmers":
      return (
        cat === "agriculture" ||
        elig.farmer === true ||
        elig.is_farmer === true ||
        /\b(agricult|farmer|farmers|kisan|crop|irrigation)\b/i.test(text)
      );

    case "education":
    case "education & scholarships":
      return (
        cat === "education" ||
        elig.student === true ||
        elig.is_student === true ||
        /\b(education|scholarship|student|students|school|college|tuition)\b/i.test(text)
      );

    case "healthcare":
    case "healthcare & medical assistance":
      return (
        cat === "healthcare" ||
        /\b(health|healthcare|medical|hospital|hospitalisation|ayushman)\b/i.test(text)
      );

    case "housing-rural":
    case "housing & rural development":
      return (
        cat === "housing" ||
        cat === "rural development" ||
        /\b(housing|awas|pucca house|homeless|rural development)\b/i.test(text)
      );

    case "women":
    case "women empowerment": {
      const genders: string[] = Array.isArray(elig.genders) ? elig.genders : [];
      const hasFemale = genders.some((g) => String(g).toLowerCase() === "female");
      return (
        cat === "women" ||
        hasFemale ||
        /\b(women|woman|female|girl child|mahila|daughter|ujjwala|sukanya)\b/i.test(text)
      );
    }

    case "business":
    case "business & entrepreneurship": {
      const occupations: string[] = Array.isArray(elig.occupations) ? elig.occupations : [];
      const hasBiz = occupations.some((o) =>
        ["business", "self-employed"].includes(String(o).toLowerCase())
      );
      return (
        cat === "business" ||
        hasBiz ||
        /\b(business|entrepreneur|entrepreneurs|mudra|msme|enterprise|enterprises|startup|self-employed)\b/i.test(
          text
        )
      );
    }

    case "employment":
    case "employment & skill development":
      return (
        cat === "employment" ||
        /\b(employment|skill|training|artisan|artisans|kaushal|rozgar|mgnrega|wage)\b/i.test(
          text
        )
      );

    case "social-welfare":
    case "social welfare":
      return (
        cat === "social welfare" ||
        /\b(social welfare|social justice|social security)\b/i.test(text)
      );

    case "financial-assistance":
    case "financial assistance":
      return (
        cat === "financial assistance" ||
        ministry.includes("finance") ||
        /\b(income support|dbt|subsidy|pension|loan|loans|credit|financial assistance|savings)\b/i.test(
          text
        )
      );

    case "transport-infrastructure":
    case "transport & infrastructure":
      return (
        cat === "transport" ||
        cat === "transport & infrastructure" ||
        /\b(transport|infrastructure|road|highway|railway|vehicle|mobility)\b/i.test(text)
      );

    case "disability-welfare":
    case "disability welfare":
      return (
        cat === "disability welfare" ||
        elig.disability === true ||
        elig.has_disability === true ||
        /\b(disability|divyang|disabled|handicap)\b/i.test(text)
      );

    case "environment-rural":
    case "environment & rural development":
      return (
        cat === "rural development" ||
        cat === "environment" ||
        elig.area === "Rural" ||
        /\b(environment|solar|clean energy|lpg|forest|sanitation|gramin|rural)\b/i.test(text)
      );

    default:
      return cat === normParam || text.includes(normParam);
  }
}

export function getCategorySchemeCount(
  schemes: SchemeRecord[] | null | undefined,
  categorySlug: string
): number {
  if (!Array.isArray(schemes)) return 0;
  return schemes.filter((s) => schemeMatchesCategoryFilter(s, categorySlug)).length;
}

export function schemeMatchesAudience(
  s: SchemeRecord,
  audienceSlug: string
): boolean {
  if (!audienceSlug) return true;
  const text = getCombinedSchemeText(s);
  const cat = (s.category || "").trim().toLowerCase();
  const elig = getEligibilityObject(s);
  const occupations: string[] = Array.isArray(elig.occupations) ? elig.occupations : [];
  const genders: string[] = Array.isArray(elig.genders) ? elig.genders : [];

  switch (audienceSlug.toLowerCase()) {
    case "farmers":
      return (
        elig.farmer === true ||
        elig.is_farmer === true ||
        cat === "agriculture" ||
        /\b(farmer|farmers|kisan|landholding|crop)\b/i.test(text)
      );

    case "students":
      return (
        elig.student === true ||
        elig.is_student === true ||
        occupations.some((o) => String(o).toLowerCase() === "student") ||
        cat === "education" ||
        /\b(student|students|scholarship|school|college|tuition|youth)\b/i.test(text)
      );

    case "women":
      return (
        cat === "women" ||
        genders.some((g) => String(g).toLowerCase() === "female") ||
        /\b(women|woman|female|girl child|daughter|mahila|ujjwala|sukanya)\b/i.test(text)
      );

    case "entrepreneurs":
      return (
        cat === "business" ||
        occupations.some((o) =>
          ["business", "self-employed"].includes(String(o).toLowerCase())
        ) ||
        /\b(entrepreneur|entrepreneurs|enterprise|msme|mudra|startup|self-employed|business)\b/i.test(
          text
        )
      );

    case "job-seekers":
      return (
        cat === "employment" ||
        occupations.some((o) => String(o).toLowerCase() === "unemployed") ||
        /\b(skill training|unemployed|wage employment|rozgar|kaushal|mgnrega|job)\b/i.test(
          text
        )
      );

    case "working-professionals":
      return (
        occupations.some((o) =>
          ["salaried", "artisan", "worker", "self-employed"].includes(
            String(o).toLowerCase()
          )
        ) ||
        /\b(worker|workers|unorganised sector|artisan|artisans|salaried|employee)\b/i.test(
          text
        )
      );

    case "rural-families":
      return (
        String(elig.area || "").toLowerCase() === "rural" ||
        cat === "rural development" ||
        /\b(rural|gramin|village|homeless families|poor households|economically vulnerable)\b/i.test(
          text
        )
      );

    case "senior-citizens":
      return (
        (typeof elig.min_age === "number" && elig.min_age >= 55) ||
        /\b(senior citizen|senior citizens|old age|elderly|after 60|aged 60|retirement pension)\b/i.test(
          text
        )
      );

    default:
      return false;
  }
}

export function getAudienceSchemeCount(
  schemes: SchemeRecord[] | null | undefined,
  audienceSlug: string
): number {
  if (!Array.isArray(schemes)) return 0;
  return schemes.filter((s) => schemeMatchesAudience(s, audienceSlug)).length;
}

