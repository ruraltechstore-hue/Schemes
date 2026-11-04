import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SchemeSummaryCard } from "../components/SchemeSummaryCard";
import IndividualUserDetails from "../routes/_authenticated/users.$id";
import UserSchemeDetail from "../routes/_authenticated/users.$id.schemes.$schemeId";
import * as appDataHooks from "../hooks/use-app-data";

// Mock Supabase
vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "agent-test-id" } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/doc.pdf" }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

describe("Final UI Update – Scheme Cards and View Details in Agent Dashboard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: "agent-test-id", email: "agent@agency.org" } as any,
      isLoading: false,
    } as any);
  });

  const mockScheme = {
    id: "scheme-housing-1",
    name: "Pradhan Mantri Awas Yojana",
    ministry: "Ministry of Housing and Urban Affairs",
    category: "Housing",
    description: "Financial assistance for pucca house construction for homeless families.",
    benefits: "Subsidy of up to Rs. 2.67 Lakhs on housing loans.",
    application_process: "Apply online at pmaymis.gov.in with Aadhaar and income proof.",
    eligibility_criteria: { max_income: 600000 },
    required_documents: ["Aadhaar Card", "Income Certificate"],
    level: "Central",
    state: "All India",
    is_active: true,
  };

  it("1. SchemeSummaryCard renders exact required layout: top row, scheme info, bottom row, and dark blue View Details button", () => {
    const eligibleResult: any = {
      scheme: mockScheme,
      status: "eligible",
      percent: 95,
      reasons: ["Income within ceiling"],
      missing: [],
      failedReasons: [],
      missingDocs: [],
    };

    render(
      <MemoryRouter initialEntries={["/"]}>
        <SchemeSummaryCard
          matchResult={eligibleResult}
          userId="user-123"
          activeTab="eligible"
        />
      </MemoryRouter>
    );

    // Card container styling
    const card = screen.getByTestId("scheme-card-scheme-housing-1");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("rounded-xl");
    expect(card).toHaveClass("border-emerald-200");

    // Top row: Eligible badge, Housing category badge, 95% Match badge aligned right
    expect(screen.getByText("Eligible")).toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("95% Match")).toBeInTheDocument();

    // Scheme information: prominent heading, department name, short description
    const heading = screen.getByRole("heading", { name: /Pradhan Mantri Awas Yojana/i });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-bold");
    expect(screen.getByText("Ministry of Housing and Urban Affairs")).toBeInTheDocument();
    expect(screen.getByText(/Financial assistance for pucca house construction/i)).toBeInTheDocument();

    // Bottom row: "Click card to view details", prominent dark blue "View Details →" button
    expect(screen.getByText("Click card to view details")).toBeInTheDocument();
    const viewDetailsBtn = screen.getByRole("link", { name: /View Details/i });
    expect(viewDetailsBtn).toBeInTheDocument();
    expect(viewDetailsBtn.className).toContain("bg-[#1e3a8a]");
    expect(viewDetailsBtn.className).toContain("text-white");
    expect(viewDetailsBtn.getAttribute("href")).toBe("/agent/users/user-123/schemes/scheme-housing-1");

    // Full scheme details MUST NOT appear on card
    expect(screen.queryByText(/Subsidy of up to Rs. 2.67 Lakhs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apply online at pmaymis.gov.in/i)).not.toBeInTheDocument();
  });

  it("2. SchemeSummaryCard applies appropriate status colors for Needs More Info and Not Eligible categories", () => {
    const needsInfoResult: any = {
      scheme: { ...mockScheme, id: "scheme-needs-info", name: "Agriculture Infrastructure Fund", category: "Agriculture" },
      status: "needs_verification",
      percent: 65,
      reasons: [],
      missing: ["Land record"],
      failedReasons: [],
      missingDocs: ["Land Certificate"],
    };

    const notEligibleResult: any = {
      scheme: { ...mockScheme, id: "scheme-ineligible", name: "Senior Citizen Pension", category: "Social Welfare" },
      status: "ineligible",
      percent: 20,
      reasons: [],
      missing: [],
      failedReasons: ["Age below 60"],
      missingDocs: [],
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SchemeSummaryCard
          matchResult={needsInfoResult}
          userId="user-123"
          activeTab="needs_info"
        />
      </MemoryRouter>
    );

    // Needs More Info card
    const needsInfoCard = screen.getByTestId("scheme-card-scheme-needs-info");
    expect(needsInfoCard).toHaveClass("border-amber-200");
    expect(screen.getByText("Needs More Info")).toBeInTheDocument();
    expect(screen.getByText("Agriculture")).toBeInTheDocument();
    expect(screen.getByText("65% Match")).toBeInTheDocument();
    const needsInfoLink = screen.getByRole("link", { name: /View Details/i });
    expect(needsInfoLink.getAttribute("href")).toBe("/agent/users/user-123/schemes/scheme-needs-info?tab=needs_info");

    // Re-render with Ineligible card
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <SchemeSummaryCard
          matchResult={notEligibleResult}
          userId="user-123"
          activeTab="ineligible"
        />
      </MemoryRouter>
    );

    const ineligibleCard = screen.getByTestId("scheme-card-scheme-ineligible");
    expect(ineligibleCard).toHaveClass("border-rose-200");
    expect(screen.getByText("Not Eligible")).toBeInTheDocument();
    expect(screen.getByText("Social Welfare")).toBeInTheDocument();
    expect(screen.getByText("20% Match")).toBeInTheDocument();
    const ineligibleLink = screen.getByRole("link", { name: /View Details/i });
    expect(ineligibleLink.getAttribute("href")).toBe("/agent/users/user-123/schemes/scheme-ineligible?tab=ineligible");
  });

  it("3. IndividualUserDetails renders dynamic tabs (Eligible, Needs More Info, Not Eligible) in a 2-column grid and preserves tab state", async () => {
    const mockUser: any = {
      id: "u-sunita",
      full_name: "Sunita Devi",
      age: 35,
      gender: "Female",
      state: "Bihar",
      district: "Patna",
      area: "Rural",
      annual_income: 120000,
      category: "OBC",
      is_farmer: true,
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [
        {
          id: "scheme-el-1",
          name: "PM Kisan Samman Nidhi",
          ministry: "Ministry of Agriculture",
          category: "Agriculture",
          description: "Direct income support to farmers.",
          eligibility: { is_farmer: true },
          is_active: true,
        },
        {
          id: "scheme-ni-1",
          name: "Solar Pump Scheme",
          ministry: "Ministry of New and Renewable Energy",
          category: "Energy",
          description: "Subsidized solar water pumps.",
          eligibility: { is_farmer: true },
          required_documents: ["Land Document"],
          is_active: true,
        },
      ],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u-sunita?tab=eligible"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Three dynamic tabs exist
    expect(screen.getByRole("tab", { name: /^Eligible/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Needs More Info/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Not Eligible/i })).toBeInTheDocument();

    // 2-column grid for schemes list
    const eligibleList = screen.getByTestId("eligible-schemes-list");
    expect(eligibleList).toHaveClass("grid");
    expect(eligibleList).toHaveClass("md:grid-cols-2");

    // PM Kisan card rendered
    expect(screen.getByText("PM Kisan Samman Nidhi")).toBeInTheDocument();
    expect(screen.getByText("Ministry of Agriculture")).toBeInTheDocument();
  });

  it("4. IndividualUserDetails activates needs_info tab when ?tab=needs_info is passed in URL", async () => {
    const mockUser: any = {
      id: "u-sunita",
      full_name: "Sunita Devi",
      age: 35,
      gender: "Female",
      state: "Bihar",
      district: "Patna",
      area: "Rural",
      annual_income: null,
      category: "OBC",
      is_farmer: true,
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [
        {
          id: "scheme-ni-1",
          name: "Solar Pump Scheme",
          ministry: "Ministry of New and Renewable Energy",
          category: "Energy",
          description: "Subsidized solar water pumps.",
          eligibility: { max_income: 100000 },
          required_documents: ["Land Document"],
          is_active: true,
        },
      ],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u-sunita?tab=needs_info"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Needs More Info list rendered in 2-column grid
    const needsInfoList = screen.getByTestId("needs-info-schemes-list");
    expect(needsInfoList).toHaveClass("grid");
    expect(needsInfoList).toHaveClass("md:grid-cols-2");
    expect(screen.getByText("Solar Pump Scheme")).toBeInTheDocument();
  });

  it("4. UserSchemeDetail renders complete scheme details, side-by-side criteria/documents, and Back to Results preserving active tab", async () => {
    const mockUser: any = {
      id: "u-sunita",
      full_name: "Sunita Devi",
      age: 35,
      gender: "Female",
      state: "Bihar",
      district: "Patna",
      area: "Rural",
      annual_income: 120000,
      category: "OBC",
      is_farmer: true,
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        {
          id: "doc-aadhaar",
          doc_type: "Aadhaar Card",
          file_name: "aadhaar.pdf",
          file_path: "agent-test-id/beneficiaries/u-sunita/aadhaar.pdf",
          status: "Verified",
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [
        {
          id: "scheme-housing-1",
          name: "Pradhan Mantri Awas Yojana",
          ministry: "Ministry of Housing and Urban Affairs",
          category: "Housing",
          description: "Full description of housing support.",
          benefits: "Subsidy of Rs. 2.67 Lakhs on housing loans.",
          application_process: "Step 1: Fill form. Step 2: Upload documents.",
          official_website_url: "https://pmaymis.gov.in",
          application_deadline: "31st December 2026",
          video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          eligibility_text: "Citizen must not own a pucca house anywhere in India.",
          required_documents: ["Aadhaar Card", "Income Certificate"],
          level: "Central",
          state: "All India",
          is_active: true,
        },
      ],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u-sunita/schemes/scheme-housing-1?tab=needs_info"]}>
          <Routes>
            <Route path="/agent/users/:userId/schemes/:schemeId" element={<UserSchemeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Displays all full scheme details
    expect(screen.getByRole("heading", { name: "Pradhan Mantri Awas Yojana" })).toBeInTheDocument();
    expect(screen.getByText("Full description of housing support.")).toBeInTheDocument();
    expect(screen.getByText("Ministry of Housing and Urban Affairs")).toBeInTheDocument();
    expect(screen.getAllByText(/Central Government/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/All India/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Housing").length).toBeGreaterThan(0);
    expect(screen.getByText(/Subsidy of Rs. 2.67 Lakhs on housing loans/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1: Fill form/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply on Official Website/i)).toBeInTheDocument();
    expect(screen.getByText("31st December 2026")).toBeInTheDocument();

    // Side-by-side cards below video
    const sideBySide = screen.getByTestId("eligibility-and-documents-section");
    expect(sideBySide).toBeInTheDocument();
    expect(sideBySide).toHaveClass("md:grid-cols-2");

    // Left card: Your Match / Eligibility
    expect(screen.getByRole("heading", { name: /Your Match/i })).toBeInTheDocument();
    expect(screen.getByText("ELIGIBILITY")).toBeInTheDocument();
    expect(screen.getByText(/Citizen must not own a pucca house/i)).toBeInTheDocument();

    // Right card: Required Documents
    expect(screen.getByRole("heading", { name: /Required Documents/i })).toBeInTheDocument();
    expect(screen.getByText("Aadhaar Card")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded in vault: aadhaar.pdf/i)).toBeInTheDocument();
    expect(screen.getByText("Income Certificate")).toBeInTheDocument();
    expect(screen.getByText(/Certificate not yet uploaded/i)).toBeInTheDocument();

    // Back to Results button preserves active tab "needs_info" and beneficiary
    const backBtn = screen.getAllByRole("link", { name: /Back to Results/i })[0];
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.getAttribute("href")).toBe("/agent/users/u-sunita?tab=needs_info#scheme-eligibility-results");
  });
});
