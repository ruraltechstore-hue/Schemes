import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IndividualUserDetails from "../routes/_authenticated/users.$id";
import UserSchemeDetail from "../routes/_authenticated/users.$id.schemes.$schemeId";
import { SchemeSummaryCard } from "../components/SchemeSummaryCard";
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

describe("Eligibility Match Sorting Filter on Scheme Results", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.spyOn(appDataHooks, "useUser").mockReturnValue({
      data: { id: "agent-test-id", email: "agent@agency.org" } as any,
      isLoading: false,
    } as any);
  });

  const mockUser: any = {
    id: "user-sort-test",
    full_name: "Rameshwar Prasad",
    age: 42,
    gender: "Male",
    state: "Bihar",
    district: "Gaya",
    area: "Rural",
    annual_income: 80000,
    category: "OBC",
    is_farmer: true,
  };

  // 4 schemes designed with distinct match percentages:
  // Scheme A (95%), Scheme B (75%), Scheme C (50%), Scheme D (20%)
  const mockSchemes: any[] = [
    {
      id: "scheme-c-50",
      name: "Rural Irrigation Mission",
      ministry: "Ministry of Jal Shakti",
      category: "Water",
      description: "Support for micro irrigation systems in rural farms.",
      eligibility_criteria: { is_farmer: true, max_income: 150000 },
      required_documents: ["Aadhaar Card", "Irrigation Certificate"],
      is_active: true,
    },
    {
      id: "scheme-a-95",
      name: "PM Kisan Samman Nidhi",
      ministry: "Ministry of Agriculture",
      category: "Agriculture",
      description: "Direct income support of Rs 6000 per year for farmer families.",
      eligibility_criteria: { is_farmer: true, max_income: 300000 },
      required_documents: ["Aadhaar Card"],
      is_active: true,
    },
    {
      id: "scheme-d-20",
      name: "Solar Pump Subsidy",
      ministry: "Ministry of New and Renewable Energy",
      category: "Energy",
      description: "Solar agricultural pump subsidy scheme.",
      eligibility_criteria: { is_farmer: true, max_income: 200000 },
      required_documents: ["Aadhaar Card", "Electricity Bill", "Land Possession Certificate", "Water Test"],
      is_active: true,
    },
    {
      id: "scheme-b-75",
      name: "Kisan Credit Card Scheme",
      ministry: "Ministry of Finance",
      category: "Finance",
      description: "Subsidized agricultural credit support for farmers.",
      eligibility_criteria: { is_farmer: true, max_income: 250000 },
      required_documents: ["Aadhaar Card", "Land Record"],
      is_active: true,
    },
  ];

  it("1. Renders the Sort by Eligibility Match dropdown above scheme cards on the Eligible Schemes tab", async () => {
    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        { id: "doc-1", doc_type: "Aadhaar Card", file_name: "aadhaar.pdf", status: "Verified" },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: mockSchemes,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Dropdown and label are present
    expect(screen.getByText(/Sort by Eligibility Match/i)).toBeInTheDocument();
    const sortTrigger = screen.getByTestId("sort-eligibility-trigger");
    expect(sortTrigger).toBeInTheDocument();
    expect(sortTrigger).toHaveAttribute("aria-label", "Sort by Eligibility Match");

    // Positioned above the scheme cards container
    const sortContainer = screen.getByTestId("sort-filter-container");
    const cardsList = screen.getByTestId("eligible-schemes-list");
    expect(sortContainer).toBeInTheDocument();
    expect(cardsList).toBeInTheDocument();
  });

  it("2. Highest to Lowest (Default) displays schemes with highest match percentage first", async () => {
    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        { id: "doc-1", doc_type: "Aadhaar Card", file_name: "aadhaar.pdf", status: "Verified" },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: mockSchemes,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const cardsList = screen.getByTestId("eligible-schemes-list");
    const renderedCardHeadings = cardsList.querySelectorAll("h3");
    const cardNames = Array.from(renderedCardHeadings).map((h) => h.textContent?.trim());

    // Schemas should be sorted from highest percentage to lowest percentage
    // PM Kisan has fewest pending docs -> highest match %
    expect(cardNames[0]).toBe("PM Kisan Samman Nidhi");
    // Solar Pump has most pending docs -> lowest match %
    expect(cardNames[cardNames.length - 1]).toBe("Solar Pump Subsidy");
  });

  it("3. Lowest to Highest displays schemes with lowest match percentage first when selected via URL parameter", async () => {
    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        { id: "doc-1", doc_type: "Aadhaar Card", file_name: "aadhaar.pdf", status: "Verified" },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: mockSchemes,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test?sort=lowest"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const cardsList = screen.getByTestId("eligible-schemes-list");
    const renderedCardHeadings = cardsList.querySelectorAll("h3");
    const cardNames = Array.from(renderedCardHeadings).map((h) => h.textContent?.trim());

    // Lowest match scheme (Solar Pump Subsidy) should come FIRST
    expect(cardNames[0]).toBe("Solar Pump Subsidy");
    // Highest match scheme (PM Kisan Samman Nidhi) should come LAST
    expect(cardNames[cardNames.length - 1]).toBe("PM Kisan Samman Nidhi");
  });

  it("4. Preserves relative order if two schemes have identical match percentages (stable sort)", async () => {
    const twinSchemes: any[] = [
      {
        id: "scheme-twin-1",
        name: "Alpha Welfare Fund",
        ministry: "Ministry of Social Justice",
        category: "Welfare",
        description: "Welfare grant alpha.",
        eligibility_criteria: { is_farmer: true, max_income: 200000 },
        required_documents: ["Aadhaar Card"],
        is_active: true,
      },
      {
        id: "scheme-twin-2",
        name: "Beta Welfare Fund",
        ministry: "Ministry of Social Justice",
        category: "Welfare",
        description: "Welfare grant beta.",
        eligibility_criteria: { is_farmer: true, max_income: 200000 },
        required_documents: ["Aadhaar Card"],
        is_active: true,
      },
    ];

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        { id: "doc-1", doc_type: "Aadhaar Card", file_name: "aadhaar.pdf", status: "Verified" },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: twinSchemes,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const cardsList = screen.getByTestId("eligible-schemes-list");
    const renderedCardHeadings = cardsList.querySelectorAll("h3");
    const cardNames = Array.from(renderedCardHeadings).map((h) => h.textContent?.trim());

    // Alpha came before Beta originally, and must remain before Beta
    expect(cardNames[0]).toBe("Alpha Welfare Fund");
    expect(cardNames[1]).toBe("Beta Welfare Fund");
  });

  it("5. Preserves sort parameter when navigating from scheme card to details and clicking Back to Results", () => {
    const eligibleResult: any = {
      scheme: mockSchemes[1],
      status: "eligible",
      percent: 95,
      reasons: [],
      missing: [],
      failedReasons: [],
      missingDocs: [],
    };

    render(
      <MemoryRouter initialEntries={["/agent/users/user-sort-test?sort=lowest"]}>
        <SchemeSummaryCard
          matchResult={eligibleResult}
          userId="user-sort-test"
          activeTab="eligible"
          sort="lowest"
        />
      </MemoryRouter>
    );

    const viewDetailsLink = screen.getByRole("link", { name: /View Details/i });
    expect(viewDetailsLink.getAttribute("href")).toBe(
      "/agent/users/user-sort-test/schemes/scheme-a-95?sort=lowest"
    );
  });

  it("6. Transitions smoothly from loading state to loaded user details without React hook mismatch or crashing", async () => {
    const userHookSpy = vi.spyOn(appDataHooks, "useManagedUser");
    userHookSpy.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: mockSchemes,
      isLoading: false,
    } as any);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial render displays loader
    expect(screen.getByText(/Loading beneficiary profile.../i)).toBeInTheDocument();

    // Now transition to loaded user data (must not throw Rules of Hooks error)
    userHookSpy.mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/user-sort-test"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Profile renders successfully without crashing into blank page
    expect(screen.getByText("Rameshwar Prasad")).toBeInTheDocument();
    expect(screen.getByText(/Gaya/i)).toBeInTheDocument();
  });
});

