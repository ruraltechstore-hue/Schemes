import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "../routes/index";
import AllSchemes from "../routes/_authenticated/schemes.index";
import SchemeDetail from "../routes/_authenticated/schemes.$id";
import { SchemePublicOrAuthLayout } from "../components/SchemePublicOrAuthLayout";
import * as appDataHooks from "../hooks/use-app-data";
import { computeSchemeStats, type SchemeRecord } from "../lib/homepage-helpers";

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

const MOCK_SCHEMES: SchemeRecord[] = [
  {
    id: "scheme-1",
    name: "PM-KISAN Direct Income Support",
    ministry: "Ministry of Agriculture & Farmers Welfare",
    category: "Agriculture",
    level: "Central",
    description:
      "Income support benefit of Rs. 6,000 per year for small and marginal landholding farmers.",
    benefits: "Rs. 6,000 direct benefit transfer annually.",
    eligibility_text: "Landholding farmer families",
    eligibility_criteria: { occupations: ["farmer"], area: "rural" },
    required_documents: ["Aadhaar Card", "Land Ownership Record"],
    apply_url: "https://pmkisan.gov.in",
  },
  {
    id: "scheme-2",
    name: "National Scholarship Portal Post-Matric Scheme",
    ministry: "Ministry of Education",
    category: "Education",
    level: "Central",
    description: "Tuition and maintenance scholarship support for eligible college students.",
    benefits: "Annual academic scholarship reimbursement.",
    eligibility_text: "Enrolled higher education students",
    eligibility_criteria: { occupations: ["student"] },
    required_documents: ["Student ID Card", "Income Certificate"],
    apply_url: "https://scholarships.gov.in",
  },
  {
    id: "scheme-3",
    name: "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
    ministry: "Ministry of Health and Family Welfare",
    category: "Healthcare",
    level: "Central",
    description: "Cashless secondary and tertiary hospitalisation cover for vulnerable families.",
    benefits: "Health coverage up to Rs. 5 lakh per family per year.",
    eligibility_text: "Economically vulnerable households",
    eligibility_criteria: {},
    required_documents: ["Aadhaar Card", "Ration Card"],
    apply_url: "https://pmjay.gov.in",
  },
  {
    id: "scheme-4",
    name: "Maharashtra Rural Housing Awas Assistance",
    ministry: "Rural Housing Department",
    category: "Housing",
    level: "State",
    state: "Maharashtra",
    description: "Financial grant for constructing pucca homes for rural homeless families.",
    benefits: "Direct housing construction grant.",
    eligibility_text: "Homeless rural households",
    eligibility_criteria: { area: "rural" },
    required_documents: ["Aadhaar Card", "Domicile Certificate"],
    apply_url: "https://pmayg.nic.in",
  },
  {
    id: "scheme-5",
    name: "Lakhpati Mahila Entrepreneurship Grant",
    ministry: "Ministry of Women and Child Development",
    category: "Women",
    level: "State",
    state: "Karnataka",
    description: "Interest subsidy and enterprise training for self-employed women entrepreneurs.",
    benefits: "Business startup credit support and skill mentoring.",
    eligibility_text: "Women self-help entrepreneurs",
    eligibility_criteria: { genders: ["female"], occupations: ["business"] },
    required_documents: ["Aadhaar Card", "Bank Passbook"],
    apply_url: "https://wcd.nic.in",
  },
  {
    id: "scheme-6",
    name: "Skill India Youth Rozgar & Artisan Toolkit",
    ministry: "Ministry of Skill Development",
    category: "Employment",
    level: "Central",
    description:
      "Free vocational skill certification and wage employment placement for job seekers and artisans.",
    benefits: "Certified skill training plus starter artisan toolkit.",
    eligibility_text: "Unemployed youth, workers, and artisans",
    eligibility_criteria: { occupations: ["unemployed", "artisan"] },
    required_documents: ["Aadhaar Card"],
    apply_url: "https://skillindiadigital.gov.in",
  },
  {
    id: "scheme-7",
    name: "Senior Citizen Vaya Vandana Pension",
    ministry: "Ministry of Social Justice",
    category: "Social Welfare",
    level: "Central",
    description: "Monthly old-age retirement pension support for elderly senior citizens.",
    benefits: "Guaranteed monthly social security pension.",
    eligibility_text: "Citizens aged 60 years and above",
    eligibility_criteria: { min_age: 60 },
    required_documents: ["Aadhaar Card", "Age Proof"],
    apply_url: "https://nsap.nic.in",
  },
];

describe("Homepage Enhancement & Public Scheme Browsing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: null,
      isLoading: false,
    } as any);
    vi.spyOn(appDataHooks, "useIsAdmin").mockReturnValue({
      data: false,
      isLoading: false,
    } as any);
    vi.spyOn(appDataHooks, "useApplications").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: MOCK_SCHEMES,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(appDataHooks, "useMatches").mockReturnValue({
      all: MOCK_SCHEMES.map((scheme) => ({
        scheme,
        eligible: false,
        needsInfo: false,
        percent: 0,
        matchedCount: 0,
        totalCriteria: 0,
        missingDocs: [],
      })),
      eligible: [],
      needsInfo: [],
      notEligible: [],
      isLoading: false,
    } as any);
  });

  const renderWithRouter = (initialEntry: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route element={<SchemePublicOrAuthLayout />}>
              <Route path="/schemes" element={<AllSchemes />} />
              <Route path="/schemes/:id" element={<SchemeDetail />} />
            </Route>
            <Route path="/auth" element={<div>Login Page</div>} />
            <Route path="/register" element={<div>Register Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("computes scheme statistics accurately from records", () => {
    const stats = computeSchemeStats(MOCK_SCHEMES);
    expect(stats.totalSchemes).toBe(7);
    expect(stats.centralSchemes).toBe(5);
    expect(stats.stateSchemes).toBe(2);
    expect(stats.departmentsCount).toBe(7);

    const emptyStats = computeSchemeStats([]);
    expect(emptyStats).toEqual({
      totalSchemes: 0,
      centralSchemes: 0,
      stateSchemes: 0,
      departmentsCount: 0,
    });
  });

  it("preserves hero, sample match card, login/get-started buttons, and 4-step How It Works", () => {
    renderWithRouter("/");

    expect(
      screen.getByRole("heading", {
        name: /Find Government Schemes You May Be Eligible For/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("PM-KISAN Samman Nidhi")).toBeInTheDocument();
    expect(screen.getByText(/86% match/i)).toBeInTheDocument();

    const registerLinks = screen.getAllByRole("link", { name: /Get Started/i });
    expect(registerLinks.some((el) => el.getAttribute("href") === "/register")).toBe(true);
    const loginLinks = screen.getAllByRole("link", { name: /Login/i });
    expect(loginLinks.some((el) => el.getAttribute("href") === "/auth")).toBe(true);

    const headerNav = screen.getByRole("navigation");
    const navLinks = Array.from(headerNav.querySelectorAll("a"));
    expect(navLinks.map((a) => a.textContent?.trim())).toEqual([
      "How It Works",
      "Categories",
      "FAQs",
    ]);

    expect(screen.getByRole("heading", { name: "How It Works" })).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    expect(screen.getByText("Check Eligibility")).toBeInTheDocument();
    expect(screen.getByText("View Schemes")).toBeInTheDocument();
  }, 15000);

  it("places How It Works immediately below the hero and removes the scheme statistics cards", () => {
    renderWithRouter("/");

    expect(screen.queryByLabelText("Government Scheme Statistics")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Government Schemes")).not.toBeInTheDocument();
    expect(screen.queryByText("Central Government Schemes")).not.toBeInTheDocument();
    expect(screen.queryByText("State Government Schemes")).not.toBeInTheDocument();
    expect(screen.queryByText("Government Departments")).not.toBeInTheDocument();

    const howItWorksHeadings = screen.getAllByRole("heading", {
      name: "How It Works",
    });
    expect(howItWorksHeadings).toHaveLength(1);

    const howItWorksHeading = howItWorksHeadings[0]!;
    const categoriesHeading = screen.getByRole("heading", {
      name: "Explore Government Schemes by Category",
    });
    // How It Works appears before Explore Government Schemes by Category in document order
    expect(
      Boolean(
        howItWorksHeading.compareDocumentPosition(categoriesHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  }, 15000);

  it("renders all 12 scheme categories as non-clickable cards without Featured Government Schemes", () => {
    renderWithRouter("/");
    const categoriesHeading = screen.getByRole("heading", {
      name: "Explore Government Schemes by Category",
    });
    expect(categoriesHeading).toBeInTheDocument();

    const expectedCategoryTitles = [
      "Agriculture & Farmers",
      "Education & Scholarships",
      "Healthcare & Medical Assistance",
      "Housing & Rural Development",
      "Women Empowerment",
      "Business & Entrepreneurship",
      "Employment & Skill Development",
      "Social Welfare",
      "Financial Assistance",
      "Transport & Infrastructure",
      "Disability Welfare",
      "Environment & Rural Development",
    ];

    for (const title of expectedCategoryTitles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    const categorySection = categoriesHeading.closest("section");
    expect(categorySection).not.toBeNull();
    expect(screen.queryByRole("link", { name: /Agriculture & Farmers/i })).not.toBeInTheDocument();
    expect(categorySection).not.toHaveTextContent("Explore Schemes");
    expect(categorySection).toHaveTextContent("1 Scheme");

    expect(
      screen.queryByRole("heading", { name: "Featured Government Schemes" }),
    ).not.toBeInTheDocument();
  }, 15000);

  it("renders all 8 citizen support blocks as non-clickable cards and Why Choose Scheme Finder features", () => {
    renderWithRouter("/");
    const citizenHeading = screen.getByRole("heading", {
      name: "Government Support for Every Citizen",
    });
    expect(citizenHeading).toBeInTheDocument();

    const audiences = [
      "Farmers",
      "Students",
      "Women",
      "Entrepreneurs",
      "Job Seekers",
      "Working Professionals",
      "Rural Families",
      "Senior Citizens",
    ];
    for (const aud of audiences) {
      expect(screen.getByRole("heading", { name: aud })).toBeInTheDocument();
    }

    expect(screen.queryByRole("link", { name: /Explore for Farmers/i })).not.toBeInTheDocument();
    const citizenSection = citizenHeading.closest("section");
    expect(citizenSection).not.toHaveTextContent(/Explore for /i);

    expect(screen.getByRole("heading", { name: "Why Choose Scheme Finder?" })).toBeInTheDocument();
    expect(screen.getByText("Personalized Scheme Eligibility Checking")).toBeInTheDocument();
    expect(screen.getByText("Central and State Government Scheme Discovery")).toBeInTheDocument();
    expect(screen.getByText("Secure Document Management")).toBeInTheDocument();
    expect(screen.getByText("Eligibility Match Percentage")).toBeInTheDocument();
    expect(screen.getByText("Required Document Information")).toBeInTheDocument();
    expect(screen.getByText("Application Process Guidance")).toBeInTheDocument();
    expect(screen.getByText("Tutorial Videos")).toBeInTheDocument();
    expect(screen.getByText("Easy Scheme Tracking")).toBeInTheDocument();
  }, 15000);

  it("renders all 10 FAQ accordions, Final CTA without Explore Schemes, and Footer with Cookies", async () => {
    renderWithRouter("/");

    const questions = [
      "What is Government Scheme Finder?",
      "How can I find government schemes?",
      "How does eligibility checking work?",
      "Which documents are required?",
      "Are both Central and State Government schemes available?",
      "Is registration free?",
      "How can I apply for a government scheme?",
      "Are my uploaded documents secure?",
      "Can I check eligibility for multiple schemes?",
      "Does eligibility confirmation guarantee approval of my application?",
    ];

    for (const q of questions) {
      expect(screen.getByRole("button", { name: q })).toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByRole("button", {
        name: "Does eligibility confirmation guarantee approval of my application?",
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/strictly informational and intended only as guidance/i),
      ).toBeInTheDocument();
    });

    const ctaHeading = screen.getByRole("heading", {
      name: /Don't Miss the Government Benefits You May Be Eligible For/i,
    });
    expect(ctaHeading).toBeInTheDocument();
    const ctaSection = ctaHeading.closest("section");
    expect(ctaSection).not.toHaveTextContent("Explore Schemes");

    const footer = screen.getByRole("contentinfo");
    expect(footer).not.toHaveTextContent("Scheme Categories");
    expect(within(footer).getByRole("heading", { name: "Quick Links" })).toBeInTheDocument();
    expect(within(footer).queryByRole("link", { name: "Explore Schemes" })).not.toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "How It Works" })).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "FAQs" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "About Us" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Terms & Conditions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disclaimer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cookies" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Contact Info/i })).toBeInTheDocument();
    const phoneLink = screen.getByRole("link", { name: "+91 93928 98733" });
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveAttribute("href", "tel:+919392898733");
    const emailLink = screen.getByRole("link", {
      name: "support@services.ruraltechstore.com",
    });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", "mailto:support@services.ruraltechstore.com");

    fireEvent.click(screen.getByRole("button", { name: "Cookies" }));
    await waitFor(() => {
      expect(screen.getByText(/Essential Browser Storage & Session Cookies/i)).toBeInTheDocument();
    });
  }, 15000);

  it("allows unauthenticated public browsing of /schemes with ?category, ?group, and /schemes/:id", () => {
    const { unmount } = renderWithRouter("/schemes?category=agriculture");
    expect(screen.getByRole("heading", { name: "All Schemes" })).toBeInTheDocument();
    expect(screen.getByText("1 of 7 schemes")).toBeInTheDocument();
    expect(screen.getByText("PM-KISAN Direct Income Support")).toBeInTheDocument();
    expect(screen.queryByText(/You may be eligible/i)).not.toBeInTheDocument();
    unmount();

    const { unmount: unmountGroup } = renderWithRouter("/schemes?group=farmers");
    expect(screen.getByRole("heading", { name: "All Schemes" })).toBeInTheDocument();
    expect(screen.getByText("PM-KISAN Direct Income Support")).toBeInTheDocument();
    unmountGroup();

    renderWithRouter("/schemes/scheme-1");
    expect(
      screen.getByRole("heading", { name: "PM-KISAN Direct Income Support" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Check Your Personalized Eligibility Match")).toBeInTheDocument();
    expect(screen.getByText("Aadhaar Card")).toBeInTheDocument();
    expect(screen.getByText("Land Ownership Record")).toBeInTheDocument();
    expect(screen.queryByText("Your match")).not.toBeInTheDocument();
    expect(screen.queryByText("Track this scheme")).not.toBeInTheDocument();
  });
});
