import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersNew from "../routes/_authenticated/users.new";
import UsersIndex from "../routes/_authenticated/users.index";
import IndividualUserDetails from "../routes/_authenticated/users.$id";
import UserSchemeDetail from "../routes/_authenticated/users.$id.schemes.$schemeId";
import { matchScheme, type ManagedUser, type Scheme } from "../lib/matching";
import { supabase } from "../integrations/supabase/client";
import * as appDataHooks from "../hooks/use-app-data";

// Mock Supabase
vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "agent-test-id" } } }),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/doc.pdf" }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

// Mock Select for jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select aria-label="SelectField" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

describe("Multi-User Beneficiary Management & 3-State Scheme Eligibility", () => {
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

  const mockSchemeWithCriteria: any = {
    id: "scheme-kisan-id",
    name: "PM-Kisan Samman Nidhi",
    description: "Income support to all landholding farmer families",
    ministry: "Ministry of Agriculture",
    category: "Agriculture",
    benefits: "Rs. 6000 per year in three 4-monthly installments",
    eligibility: {
      is_farmer: true,
      max_income: 300000,
      min_age: 18,
      max_age: 75,
      states: ["Uttar Pradesh", "Bihar"],
    },
    eligibility_criteria: {
      is_farmer: true,
      max_income: 300000,
      min_age: 18,
      max_age: 75,
      states: ["Uttar Pradesh", "Bihar"],
    },
    required_documents: ["Aadhaar Card", "Land Ownership Record"],
    application_process: "Apply online at pmkisan.gov.in",
    official_website_url: "https://pmkisan.gov.in",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("7. Adds new beneficiary with complete demographic and socioeconomic profile", async () => {
    const mockSelectChain: any = {
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "new-user-123" }, error: null }),
    };
    const mockSelect = vi.fn().mockReturnValue(mockSelectChain);
    const mockInsert = vi.fn().mockReturnValue({
      select: mockSelect,
    });
    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UsersNew />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify key fields
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Age \(Years\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Annual Family Income/i)).toBeInTheDocument();

    // Fill the beneficiary details
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Anita Devi" },
    });
    fireEvent.change(screen.getByLabelText(/Mobile Number/i), {
      target: { value: "9871122334" },
    });
    fireEvent.change(screen.getByLabelText(/Age \(Years\)/i), {
      target: { value: "38" },
    });
    fireEvent.change(screen.getByLabelText(/Annual Family Income/i), {
      target: { value: "120000" },
    });
    fireEvent.change(screen.getByLabelText(/District/i), {
      target: { value: "Patna" },
    });

    // Select gender and state
    const selectElements = screen.getAllByLabelText("SelectField");
    fireEvent.change(selectElements[0]!, { target: { value: "Female" } }); // Gender
    fireEvent.change(selectElements[2]!, { target: { value: "Bihar" } }); // State

    // Toggle farmer switch
    const farmerSwitch = screen.getByRole("switch", { name: /Landholding Farmer/i });
    fireEvent.click(farmerSwitch);

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /Save & Check Schemes/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Anita Devi",
          mobile: "9871122334",
          age: 38,
          annual_income: 120000,
          district: "Patna",
          state: "Bihar",
          gender: "Female",
          is_farmer: true,
        })
      );
    });
  });

  it("8. Strict 3-state evaluation: eligible, ineligible, needs_verification", () => {
    // Case A: Fully eligible user
    const eligibleUser: any = {
      id: "user-1",
      agent_id: "agent-test-id",
      full_name: "Ramesh Farmer",
      age: 40,
      state: "Uttar Pradesh",
      district: "Varanasi",
      annual_income: 150000,
      is_farmer: true,
      category: "OBC",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const matchA = matchScheme(mockSchemeWithCriteria, eligibleUser, []);
    expect(matchA.status).toBe("eligible");
    expect(matchA.eligible).toBe(true);
    expect(matchA.reasons.length).toBeGreaterThan(0);
    expect(matchA.missing.length).toBe(0);

    // Case B: Ineligible user (income exceeds limit, not a farmer)
    const ineligibleUser: any = {
      id: "user-2",
      agent_id: "agent-test-id",
      full_name: "Sunil Trader",
      age: 40,
      state: "Uttar Pradesh",
      annual_income: 600000, // exceeds 300000
      is_farmer: false, // scheme requires farmer
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const matchB = matchScheme(mockSchemeWithCriteria, ineligibleUser, []);
    expect(matchB.status).toBe("ineligible");
    expect(matchB.eligible).toBe(false);
    expect(matchB.failedReasons.some((r) => r.includes("Income"))).toBe(true);
    expect(matchB.failedReasons.some((r) => r.includes("Only for farmers"))).toBe(true);

    // Case C: Missing mandatory criteria - MUST NEVER be marked eligible
    const missingDataUser: any = {
      id: "user-3",
      agent_id: "agent-test-id",
      full_name: "Incomplete User",
      // state is missing, annual_income is missing, is_farmer is null
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const matchC = matchScheme(mockSchemeWithCriteria, missingDataUser, []);
    expect(matchC.status).toBe("needs_verification");
    expect(matchC.eligible).toBe(false); // Requirement: NEVER mark scheme as eligible when mandatory info is missing
    expect(matchC.missing.length).toBeGreaterThan(0);
  });

  it("9. Individual user details page renders profile, document vault, and eligibility checks", async () => {
    const mockUser: any = {
      id: "u123",
      agent_id: "agent-test-id",
      full_name: "Sunita Kumari",
      age: 32,
      gender: "Female",
      mobile: "9876543210",
      state: "Bihar",
      district: "Gaya",
      area: "Rural",
      annual_income: 90000,
      category: "OBC",
      is_farmer: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        {
          id: "doc-1",
          doc_type: "Aadhaar Card",
          file_name: "aadhaar.pdf",
          file_path: "agent-test-id/beneficiaries/u123/aadhaar.pdf",
          status: "Verified",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [mockSchemeWithCriteria],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u123"]}>
          <IndividualUserDetails />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Profile overview rendered
    expect(screen.getByText("Sunita Kumari")).toBeInTheDocument();
    expect(screen.getByText(/Gaya/i)).toBeInTheDocument();

    // Document vault rendered with uploaded document
    expect(screen.getByText(/Document Vault/i)).toBeInTheDocument();
    expect(screen.getAllByText("Aadhaar Card").length).toBeGreaterThan(0);
    expect(screen.getByText("aadhaar.pdf")).toBeInTheDocument();

    // Check Eligible Schemes action available
    expect(screen.getByRole("button", { name: /Check Eligible Schemes/i })).toBeInTheDocument();

    // Results tabs exist
    expect(screen.getByRole("tab", { name: /^Eligible/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Needs More Info/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Not Eligible/i })).toBeInTheDocument();
  });

  it("10. Lists managed beneficiaries and supports filtering and selection", async () => {
    const mockUsers: any[] = [
      {
        id: "u1",
        agent_id: "agent-test-id",
        full_name: "Pooja Sharma",
        mobile: "9988776655",
        state: "Rajasthan",
        district: "Jaipur",
        age: 29,
        category: "General",
        annual_income: 200000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "u2",
        agent_id: "agent-test-id",
        full_name: "Amit Verma",
        mobile: "9123412345",
        state: "Madhya Pradesh",
        district: "Bhopal",
        age: 45,
        category: "SC",
        annual_income: 80000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(appDataHooks, "useManagedUsers").mockReturnValue({
      data: mockUsers,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UsersIndex />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Pooja Sharma")).toBeInTheDocument();
    expect(screen.getByText("Amit Verma")).toBeInTheDocument();
    expect(screen.getAllByText("Jaipur").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rajasthan/i).length).toBeGreaterThan(0);

    // View Details button exists
    expect(screen.getAllByRole("button", { name: /View Details/i }).length).toBe(2);

    // Search filter test
    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    fireEvent.change(searchInput, { target: { value: "Pooja" } });

    expect(screen.getByText("Pooja Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Amit Verma")).not.toBeInTheDocument();
  });

  it("11. Initial schemes view displays condensed cards without full details and links to scheme details page", async () => {
    const mockUser: any = {
      id: "u123",
      agent_id: "agent-test-id",
      full_name: "Sunita Kumari",
      age: 32,
      gender: "Female",
      mobile: "9876543210",
      state: "Bihar",
      district: "Gaya",
      area: "Rural",
      annual_income: 90000,
      category: "OBC",
      is_farmer: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        {
          id: "doc-1",
          doc_type: "Aadhaar Card",
          file_name: "aadhaar.pdf",
          file_path: "agent-test-id/beneficiaries/u123/aadhaar.pdf",
          status: "Verified",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [mockSchemeWithCriteria],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u123"]}>
          <Routes>
            <Route path="/agent/users/:userId" element={<IndividualUserDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial scheme card displays Scheme Name, Department, short description, and Eligible badge
    expect(screen.getByText("PM-Kisan Samman Nidhi")).toBeInTheDocument();
    expect(screen.getByText("Ministry of Agriculture")).toBeInTheDocument();
    expect(screen.getByText(/Income support to all landholding farmer families/i)).toBeInTheDocument();

    // Contains View Details button linking to /agent/users/u123/schemes/scheme-kisan-id
    const viewDetailsLink = screen.getByRole("link", { name: /View Details/i });
    expect(viewDetailsLink).toBeInTheDocument();
    expect(viewDetailsLink.getAttribute("href")).toBe("/agent/users/u123/schemes/scheme-kisan-id");

    // Must NOT display full benefits, required documents checklist, or application process on initial card
    expect(screen.queryByText(/Rs. 6000 per year in three 4-monthly installments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apply online at pmkisan.gov.in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step-by-Step Application Process/i)).not.toBeInTheDocument();
  });

  it("11. Dedicated Scheme Details page renders complete user-tailored scheme details, document verification caution, and back button", async () => {
    const mockUser: any = {
      id: "u123",
      agent_id: "agent-test-id",
      full_name: "Sunita Kumari",
      age: 32,
      gender: "Female",
      mobile: "9876543210",
      state: "Bihar",
      district: "Gaya",
      area: "Rural",
      annual_income: 90000,
      category: "OBC",
      is_farmer: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: [
        {
          id: "doc-1",
          doc_type: "Aadhaar Card",
          file_name: "aadhaar.pdf",
          file_path: "agent-test-id/beneficiaries/u123/aadhaar.pdf",
          status: "Verified",
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [mockSchemeWithCriteria],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u123/schemes/scheme-kisan-id"]}>
          <Routes>
            <Route path="/agent/users/:userId/schemes/:schemeId" element={<UserSchemeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Selected user context banner rendered
    expect(screen.getAllByText("Sunita Kumari").length).toBeGreaterThan(0);
    expect(screen.getByText(/Citizen Evaluation Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Gaya, Bihar/i)).toBeInTheDocument();

    // Scheme information rendered
    expect(screen.getByText("PM-Kisan Samman Nidhi")).toBeInTheDocument();
    expect(screen.getByText("Ministry of Agriculture")).toBeInTheDocument();

    // Complete Details: Benefits & Application Process
    expect(screen.getByText(/Rs. 6000 per year in three 4-monthly installments/i)).toBeInTheDocument();
    expect(screen.getByText(/Step-by-Step Application Process/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply online at pmkisan.gov.in/i)).toBeInTheDocument();

    // User-specific qualification reasons
    expect(screen.getByText(/Why Sunita Kumari is eligible/i)).toBeInTheDocument();

    // Document Verification with Caution notice
    expect(screen.getByText(/Document Verification for Sunita Kumari/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not assume a document is valid merely because it has been uploaded/i)).toBeInTheDocument();

    // Uploaded vs Missing documents distinction
    expect(screen.getByText(/Uploaded in vault: aadhaar.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificate not yet uploaded for this citizen/i)).toBeInTheDocument();

    // Official Website CTA
    expect(screen.getByText(/Apply on Official Website/i)).toBeInTheDocument();

    // Back to user eligibility results navigation (both top and bottom buttons)
    const backButtons = screen.getAllByRole("link", { name: /Back to Sunita Kumari's Eligibility Results/i });
    expect(backButtons.length).toBeGreaterThanOrEqual(1);
    expect(backButtons[0].getAttribute("href")).toBe("/agent/users/u123");
  });

  it("12. Renders Your Match and Required Documents side-by-side cards below tutorial video with document upload, preview, download, and replace", async () => {
    const mockUser: any = {
      id: "u123",
      agent_id: "agent-test-id",
      full_name: "Sunita Kumari",
      age: 32,
      gender: "Female",
      mobile: "9876543210",
      state: "Bihar",
      district: "Gaya",
      area: "Rural",
      annual_income: 90000,
      category: "OBC",
      is_farmer: true,
      extra_criteria: { documents: [] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockDocs = [
      {
        id: "doc-1",
        doc_type: "Aadhaar Card",
        file_name: "aadhaar.pdf",
        file_path: "agent-test-id/beneficiaries/u123/aadhaar.pdf",
        status: "Verified",
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(appDataHooks, "useManagedUser").mockReturnValue({
      data: mockUser,
      isLoading: false,
    } as any);

    vi.spyOn(appDataHooks, "useBeneficiaryDocuments").mockReturnValue({
      data: mockDocs,
      isLoading: false,
    } as any);

    const schemeWithGeneral = {
      ...mockSchemeWithCriteria,
      eligibility_text: "Landholding farmer families",
      required_documents: ["Aadhaar Card", "Land Documents", "Bank Documents"],
    };

    vi.spyOn(appDataHooks, "useSchemes").mockReturnValue({
      data: [schemeWithGeneral],
      isLoading: false,
    } as any);

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "documents") {
        return { insert: mockInsert } as any;
      }
      if (table === "managed_users") {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/users/u123/schemes/scheme-kisan-id"]}>
          <Routes>
            <Route path="/agent/users/:userId/schemes/:schemeId" element={<UserSchemeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Section 9: Side-by-side container exists
    const sideBySideSection = screen.getByTestId("eligibility-and-documents-section");
    expect(sideBySideSection).toBeInTheDocument();
    expect(sideBySideSection).toHaveClass("grid");
    expect(sideBySideSection).toHaveClass("md:grid-cols-2");

    // Left Card: Your Match / Eligibility Criteria
    expect(screen.getByRole("heading", { name: /Your Match/i })).toBeInTheDocument();
    expect(screen.getByText(/You may be eligible/i)).toBeInTheDocument();
    expect(screen.getByText("ELIGIBILITY")).toBeInTheDocument();

    // Satisfied criteria bullet points
    expect(screen.getByText(/Why Sunita Kumari is eligible:/i)).toBeInTheDocument();
    // General scheme conditions
    expect(screen.getByText(/General Scheme Conditions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Landholding farmer families/i).length).toBeGreaterThanOrEqual(1);

    // Right Card: Required Documents
    expect(screen.getByRole("heading", { name: /Required Documents/i })).toBeInTheDocument();
    expect(screen.getByText(/3 documents/i)).toBeInTheDocument();

    // Verification Caution notice inside Required Documents card
    expect(screen.getByText(/Verification Caution:/i)).toBeInTheDocument();

    // Uploaded status for already uploaded document (Aadhaar Card)
    expect(screen.getByText("Aadhaar Card")).toBeInTheDocument();
    expect(screen.getByText("Uploaded in vault: aadhaar.pdf")).toBeInTheDocument();

    // Preview, Download, Replace buttons for uploaded document
    expect(screen.getByRole("button", { name: /Preview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replace/i })).toBeInTheDocument();

    // Missing status and Upload buttons for Land Documents and Bank Documents
    const uploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    expect(uploadButtons.length).toBeGreaterThanOrEqual(2); // Land Documents & Bank Documents

    // Test file upload action for a missing document
    const landUploadButton = uploadButtons[0];
    fireEvent.click(landUploadButton);

    const fileInput = screen.getByTestId("scheme-doc-file-input") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const samplePdf = new File(["dummy pdf content"], "land_record.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [samplePdf] } });

    await waitFor(() => {
      expect(supabase.storage.from).toHaveBeenCalledWith("documents");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          scheme_id: "scheme-kisan-id",
          managed_user_id: "u123",
          file_name: "land_record.pdf",
        })
      );
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});

