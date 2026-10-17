import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Docs from "@/routes/_authenticated/documents";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchScheme, Scheme, Profile } from "@/lib/matching";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const createSignedUrlMock = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/test.pdf" }, error: null });
  const removeMock = vi.fn().mockResolvedValue({ error: null });
  const deleteEqMock = vi.fn().mockResolvedValue({ error: null });

  return {
    supabase: {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
          remove: removeMock,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "documents") {
          return {
            insert: insertMock,
            delete: vi.fn().mockReturnValue({
              eq: deleteEqMock,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }),
    },
  };
});

// Mock user and documents hook
const mockDocsData = [
  {
    id: "doc-1",
    file_name: "ration_card_copy.pdf",
    doc_type: "Ration Card",
    created_at: "2026-10-15T10:00:00Z",
    status: "Verified",
    file_path: "user-123/ration_card_copy.pdf",
  },
];

vi.mock("@/hooks/use-app-data", () => ({
  useUser: () => ({ data: { id: "user-123", email: "test@example.com" } }),
  useDocuments: () => ({ data: mockDocsData, isLoading: false }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Select component from Radix to simplify testing in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="Document type"
      data-testid="doc-type-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">Select type</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children, id }: any) => <div id={id}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

function renderDocs() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Docs />
    </QueryClientProvider>
  );
}

describe("Document Upload - Custom Document Name Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload form with select dropdown initially", () => {
    renderDocs();
    expect(screen.getByTestId("doc-type-select")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Enter document name/i)).not.toBeInTheDocument();
    expect(screen.getByText("My Documents")).toBeInTheDocument();
    expect(screen.getByText("Ration Card")).toBeInTheDocument();
  });

  it("switches to text input when 'Other Documents' is selected instead of displaying Other Documents", async () => {
    renderDocs();
    const select = screen.getByTestId("doc-type-select");

    // Select "Other Documents"
    fireEvent.change(select, { target: { value: "Other Documents" } });

    // Text input should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter document name/i)).toBeInTheDocument();
    });

    // The dropdown should be replaced by the custom name input
    expect(screen.queryByTestId("doc-type-select")).not.toBeInTheDocument();
    expect(screen.getByText(/Choose from list/i)).toBeInTheDocument();
  });

  it("allows typing a custom document name and switching back to list", async () => {
    renderDocs();
    const select = screen.getByTestId("doc-type-select");
    fireEvent.change(select, { target: { value: "Other Documents" } });

    const input = screen.getByPlaceholderText(/Enter document name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Electricity Bill" } });
    expect(input.value).toBe("Electricity Bill");

    // Click "Choose from list"
    const backBtn = screen.getByText(/Choose from list/i);
    fireEvent.click(backBtn);

    // Should return to select dropdown
    expect(screen.getByTestId("doc-type-select")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Enter document name/i)).not.toBeInTheDocument();
  });

  it("shows error if user selects Other Documents but leaves document name blank on upload", async () => {
    const { toast } = await import("sonner");
    renderDocs();
    const select = screen.getByTestId("doc-type-select");
    fireEvent.change(select, { target: { value: "Other Documents" } });

    const file = new File(["test-content"], "sample.pdf", { type: "application/pdf" });
    const fileInput = document.getElementById("file") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    fireEvent.click(uploadBtn);

    expect(toast.error).toHaveBeenCalledWith("Please enter the document name");
  });

  it("successfully uploads custom document with user-specified document name as doc_type", async () => {
    const { toast } = await import("sonner");
    renderDocs();
    const select = screen.getByTestId("doc-type-select");
    fireEvent.change(select, { target: { value: "Other Documents" } });

    const input = screen.getByPlaceholderText(/Enter document name/i);
    fireEvent.change(input, { target: { value: "Domicile Certificate" } });

    const file = new File(["content"], "domicile.pdf", { type: "application/pdf" });
    const fileInput = document.getElementById("file") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(supabase.from("documents").insert).toHaveBeenCalledWith(
        expect.objectContaining({
          doc_type: "Domicile Certificate",
          file_name: "domicile.pdf",
          mime_type: "application/pdf",
          status: "Verified",
        })
      );
      expect(toast.success).toHaveBeenCalledWith("Document uploaded");
    });
  });

  it("displays custom document name in table instead of 'Other Documents'", () => {
    renderDocs();
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("Ration Card");
    expect(table).toHaveTextContent("ration_card_copy.pdf");
    expect(table).not.toHaveTextContent("Other Documents");
  });
});

describe("matchScheme with custom document types", () => {
  const dummyScheme: Scheme = {
    id: "s1",
    name: "Farmer Scheme",
    description: "",
    ministry: "Agri",
    category: "Agriculture",
    level: "Central",
    state: null,
    benefits: "Money",
    eligibility_text: "Farmers",
    required_documents: ["Ration Card"],
    apply_url: "https://example.com",
    created_at: null,
    eligibility: {},
    slug: null,
  };

  const dummyProfile: Profile = {
    id: "p1",
    full_name: "Farmer John",
    annual_income: null,
    area: null,
    category: null,
    created_at: null,
    disability_type: null,
    district: null,
    dob: null,
    email: null,
    family_size: null,
    gender: null,
    has_disability: null,
    is_farmer: null,
    is_student: null,
    mobile: null,
    occupation: null,
    state: null,
  };

  it("matches scheme when user has uploaded written document name", () => {
    const result = matchScheme(dummyScheme, dummyProfile, ["Ration Card"]);
    expect(result.missingDocs).toEqual([]);
  });

  it("matches scheme case-insensitively for user written document name", () => {
    const result = matchScheme(dummyScheme, dummyProfile, ["ration card"]);
    expect(result.missingDocs).toEqual([]);
  });

  it("satisfies scheme requiring Other Documents when user has uploaded a custom document", () => {
    const otherDocScheme: Scheme = {
      ...dummyScheme,
      required_documents: ["Other Documents"],
    };
    const result = matchScheme(otherDocScheme, dummyProfile, ["Disability Certificate"]);
    expect(result.missingDocs).toEqual([]);
  });
});
