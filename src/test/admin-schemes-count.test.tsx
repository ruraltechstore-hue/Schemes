import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Admin from "@/routes/_authenticated/admin";
import { BulkUpload } from "@/components/BulkUpload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Scheme } from "@/lib/matching";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "schemes") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "s-1",
                  name: "Valid Scheme 1",
                  category: "Social",
                  level: "Central",
                  benefits: "B1",
                },
                {
                  id: "s-2",
                  name: "Valid Scheme 2",
                  category: "Agriculture",
                  level: "State",
                  state: "Delhi",
                  benefits: "B2",
                },
                // Invalid record: empty name
                { id: "s-3", name: "   ", category: "Invalid", level: "Central", benefits: "" },
                // Soft-deleted record
                {
                  id: "s-4",
                  name: "Soft Deleted Scheme",
                  category: "Social",
                  level: "Central",
                  benefits: "",
                  is_deleted: true,
                },
                // Duplicate ID record
                {
                  id: "s-1",
                  name: "Valid Scheme 1 Dup",
                  category: "Social",
                  level: "Central",
                  benefits: "B1",
                },
              ],
              error: null,
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
            neq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn().mockResolvedValue({ error: null }),
          neq: vi.fn().mockResolvedValue({ error: null }),
        }),
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

const mockSchemes: Scheme[] = [
  {
    id: "s-1",
    name: "Valid Scheme 1",
    description: "Desc 1",
    ministry: "Min 1",
    category: "Social Welfare",
    level: "Central",
    state: null,
    benefits: "Benefits 1",
    eligibility_text: "Elig 1",
    required_documents: ["Aadhaar"],
    apply_url: "https://example.com/1",
    eligibility: {},
    application_video_url: null,
    video_type: null,
    created_at: null,
  },
  {
    id: "s-2",
    name: "Valid Scheme 2",
    description: "Desc 2",
    ministry: "Min 2",
    category: "Agriculture",
    level: "State",
    state: "Delhi",
    benefits: "Benefits 2",
    eligibility_text: "Elig 2",
    required_documents: ["Aadhaar"],
    apply_url: "https://example.com/2",
    eligibility: {},
    application_video_url: null,
    video_type: null,
    created_at: null,
  },
  // Invalid empty scheme
  {
    id: "s-invalid",
    name: "   ",
    description: "",
    ministry: "",
    category: "Social Welfare",
    level: "Central",
    state: null,
    benefits: "",
    eligibility_text: "",
    required_documents: [],
    apply_url: "",
    eligibility: {},
    application_video_url: null,
    video_type: null,
    created_at: null,
  },
  // Soft-deleted scheme
  {
    id: "s-deleted",
    name: "Deleted Scheme",
    description: "",
    ministry: "",
    category: "Social Welfare",
    level: "Central",
    state: null,
    benefits: "",
    eligibility_text: "",
    required_documents: [],
    apply_url: "",
    eligibility: {},
    application_video_url: null,
    video_type: null,
    created_at: null,
    is_deleted: true,
  } as unknown as Scheme,
  // Duplicate ID scheme
  {
    id: "s-1",
    name: "Duplicate ID Scheme",
    description: "",
    ministry: "",
    category: "Social Welfare",
    level: "Central",
    state: null,
    benefits: "",
    eligibility_text: "",
    required_documents: [],
    apply_url: "",
    eligibility: {},
    application_video_url: null,
    video_type: null,
    created_at: null,
  },
];

vi.mock("@/hooks/use-app-data", () => ({
  useIsAdmin: () => ({ data: true, isLoading: false }),
  useSchemes: () => ({ data: mockSchemes, isLoading: false }),
}));

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin />
    </QueryClientProvider>,
  );
}

function renderBulkUpload(existing: Scheme[] = [mockSchemes[0]!]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BulkUpload existingSchemes={existing} />
    </QueryClientProvider>,
  );
}

describe("Admin Dashboard Scheme Counting & Bulk Upload Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates Total Schemes Uploaded by counting only valid, non-deleted, unique scheme records", () => {
    renderAdmin();

    // From the 5 records in mockSchemes, only 2 are valid and non-deleted
    const countCard = screen.getByTestId("total-schemes-uploaded-count");
    expect(countCard).toHaveTextContent("2");

    // Header subtitle reflects the same valid count
    expect(screen.getByText("2 schemes uploaded in database")).toBeInTheDocument();

    // Tab title reflects the valid count
    expect(screen.getByRole("button", { name: /Schemes Management \(2\)/i })).toBeInTheDocument();
  });

  it("displays separate metric cards for Successfully Uploaded, Invalid, Duplicate, and Failed records in Bulk Upload", async () => {
    // Scheme 1 is an existing scheme, Scheme 2 is valid new, Row 3 has empty Scheme Name (invalid)
    const existing = [mockSchemes[0]!]; // "Valid Scheme 1"
    renderBulkUpload(existing);

    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csvContent = [
      `Scheme Name,Category,Benefits`,
      `"Valid Scheme 1","Social Welfare","B1"`, // Duplicate of existing
      `"Fresh New Scheme","Education","Scholarship"`, // Valid new
      `"","Healthcare","Free hospital"`, // Invalid (missing name)
    ].join("\n");

    const file = new File([csvContent], "mixed_data.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    // Preview button shows 1 valid scheme to import (since duplicate is skipped by default, and empty name is invalid)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /import 1 valid scheme/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /import 1 valid scheme/i }));

    await waitFor(() => {
      expect(screen.getByText(/Import Process Finished/i)).toBeInTheDocument();
    });

    // 1. Successfully Uploaded Card: only 1 valid scheme was uploaded
    const successCard = screen.getByTestId("stat-card-successful");
    expect(successCard).toBeInTheDocument();
    expect(successCard).toHaveTextContent("1");
    expect(successCard).toHaveTextContent("Successfully Uploaded");

    // 2. Invalid Records Card: 1 invalid row
    const invalidCard = screen.getByTestId("stat-card-invalid");
    expect(invalidCard).toBeInTheDocument();
    expect(invalidCard).toHaveTextContent("1");
    expect(invalidCard).toHaveTextContent("Invalid Records");

    // 3. Duplicate Records Card: 1 duplicate skipped
    const dupCard = screen.getByTestId("stat-card-duplicates");
    expect(dupCard).toBeInTheDocument();
    expect(dupCard).toHaveTextContent("1");
    expect(dupCard).toHaveTextContent("Duplicate Records");

    // 4. Failed Records Card: 0 failed
    const failedCard = screen.getByTestId("stat-card-failed");
    expect(failedCard).toBeInTheDocument();
    expect(failedCard).toHaveTextContent("0");
    expect(failedCard).toHaveTextContent("Failed Records");
  });

  it("displays exact count from Supabase database when schemes exceed 1,000 without 1.0K abbreviation", async () => {
    const useSchemesCountMock = await import("@/hooks/use-schemes-count");
    const spy = vi.spyOn(useSchemesCountMock, "useSchemesCount").mockReturnValue({
      data: 1250,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemesCountMock.useSchemesCount>);

    renderAdmin();

    const countCard = screen.getByTestId("total-schemes-uploaded-count");
    expect(countCard).toHaveTextContent("1,250");
    expect(countCard).not.toHaveTextContent("1.0K");
    expect(countCard).not.toHaveTextContent("1000");

    expect(screen.getByText("1,250 schemes uploaded in database")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Schemes Management \(1,250\)/i }),
    ).toBeInTheDocument();

    spy.mockRestore();
  });

  it("displays 2,450 and 850 exact counts accurately without abbreviation", async () => {
    const useSchemesCountMock = await import("@/hooks/use-schemes-count");

    // Test 2,450
    const spy2450 = vi.spyOn(useSchemesCountMock, "useSchemesCount").mockReturnValue({
      data: 2450,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemesCountMock.useSchemesCount>);

    const { unmount } = renderAdmin();
    expect(screen.getByTestId("total-schemes-uploaded-count")).toHaveTextContent("2,450");
    unmount();
    spy2450.mockRestore();

    // Test 850
    const spy850 = vi.spyOn(useSchemesCountMock, "useSchemesCount").mockReturnValue({
      data: 850,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemesCountMock.useSchemesCount>);

    renderAdmin();
    expect(screen.getByTestId("total-schemes-uploaded-count")).toHaveTextContent("850");
    spy850.mockRestore();
  });

  it("useSchemesCount queries Supabase using head: true and exact count parameter", async () => {
    const selectMock = vi.fn().mockResolvedValue({ count: 1850, error: null });
    const fromSpy = vi
      .spyOn(supabase, "from")
      .mockReturnValue({ select: selectMock } as unknown as ReturnType<typeof supabase.from>);

    const { useSchemesCount } = await import("@/hooks/use-schemes-count");
    const { renderHook } = await import("@testing-library/react");

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSchemesCount(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe(1850);
    });

    expect(fromSpy).toHaveBeenCalledWith("schemes");
    expect(selectMock).toHaveBeenCalledWith("id", { count: "exact", head: true });
    fromSpy.mockRestore();
  });
});
