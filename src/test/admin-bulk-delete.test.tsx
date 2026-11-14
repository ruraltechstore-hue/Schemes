import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Admin from "@/routes/_authenticated/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Mock Supabase
const deleteMock = vi.fn();
const inMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "schemes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          delete: deleteMock,
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn().mockResolvedValue({ error: null }),
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

const mockSchemes = [
  {
    id: "scheme-1",
    name: "PM-KISAN Samman Nidhi",
    description: "Income support for farmers",
    ministry: "Ministry of Agriculture",
    category: "Agriculture",
    level: "Central",
    state: null,
    benefits: "₹6,000 per year",
    eligibility_text: "Farmers with land",
    required_documents: ["Aadhaar", "Land Documents"],
    apply_url: "https://pmkisan.gov.in",
    application_video_url: null,
    video_type: null,
    eligibility: { farmer: true },
  },
  {
    id: "scheme-2",
    name: "Maharashtra Krishi Sanman",
    description: "State aid for farmers",
    ministry: "Agriculture Dept",
    category: "Agriculture",
    level: "State",
    state: "Maharashtra",
    benefits: "₹12,000 yearly",
    eligibility_text: "Maharashtra farmers",
    required_documents: ["Aadhaar", "7/12 Extract"],
    apply_url: "https://krishi.maharashtra.gov.in",
    application_video_url: null,
    video_type: null,
    eligibility: { state: ["Maharashtra"] },
  },
  {
    id: "scheme-3",
    name: "National Scholarship",
    description: "Scholarship for reserved categories",
    ministry: "Ministry of Social Justice",
    category: "Education",
    level: "Central",
    state: null,
    benefits: "Tuition support",
    eligibility_text: "Students",
    required_documents: ["Aadhaar", "Caste Certificate"],
    apply_url: "https://scholarships.gov.in",
    application_video_url: null,
    video_type: null,
    eligibility: { student: true },
  },
];

let currentMockSchemes: any[] = mockSchemes;

vi.mock("@/hooks/use-app-data", () => ({
  useIsAdmin: () => ({ data: true, isLoading: false }),
  useSchemes: () => ({ data: currentMockSchemes, isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin />
    </QueryClientProvider>,
  );
}

describe("Admin Bulk Delete Schemes Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockSchemes = mockSchemes;
    inMock.mockReset();
    inMock.mockResolvedValue({ error: null });
    deleteMock.mockReturnValue({ in: inMock });
  });

  it("renders table with Select All checkbox and individual scheme checkboxes", () => {
    renderAdmin();

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox");
    expect(selectAllCheckbox).toBeInTheDocument();
    expect(screen.getByTestId("select-scheme-scheme-1")).toBeInTheDocument();
    expect(screen.getByTestId("select-scheme-scheme-2")).toBeInTheDocument();
    expect(screen.getByTestId("select-scheme-scheme-3")).toBeInTheDocument();

    // No bulk actions bar initially when 0 selected
    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
  });

  it("allows selecting and deselecting individual schemes and shows correct count", () => {
    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    const cb2 = screen.getByTestId("select-scheme-scheme-2");

    // Select scheme 1
    fireEvent.click(cb1);

    // Bulk actions bar should appear showing 1 selected
    expect(screen.getByTestId("bulk-actions-bar")).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toHaveTextContent("Delete Selected (1)");

    // Select scheme 2
    fireEvent.click(cb2);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toHaveTextContent("Delete Selected (2)");

    // Deselect scheme 1
    fireEvent.click(cb1);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toHaveTextContent("Delete Selected (1)");
  });

  it("allows selecting all schemes at once using the Select All checkbox", () => {
    renderAdmin();

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox");

    // Click Select All
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toHaveTextContent("Delete Selected (3)");

    // Click Select All again to deselect all
    fireEvent.click(selectAllCheckbox);
    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
  });

  it("clears selection when Clear Selection button is clicked", () => {
    renderAdmin();

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox");
    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText("3 selected")).toBeInTheDocument();

    const clearBtn = screen.getByText("Clear selection");
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
  });

  it("opens confirmation dialog with warning message before deleting", async () => {
    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    const cb2 = screen.getByTestId("select-scheme-scheme-3");
    fireEvent.click(cb1);
    fireEvent.click(cb2);

    const deleteBtn = screen.getByTestId("bulk-delete-button");
    fireEvent.click(deleteBtn);

    // Dialog should be open
    await waitFor(() => {
      expect(
        screen.getByText(
          /Are you sure you want to delete 2 selected schemes\? This action cannot be undone\./i,
        ),
      ).toBeInTheDocument();
    });

    // Test Cancel button closes dialog
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByText(/Are you sure you want to delete 2 selected schemes\?/i),
      ).not.toBeInTheDocument();
    });
    // Deletion was not performed
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("performs bulk deletion using unique scheme IDs upon confirmation", async () => {
    const { toast } = await import("sonner");
    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    const cb2 = screen.getByTestId("select-scheme-scheme-2");
    fireEvent.click(cb1);
    fireEvent.click(cb2);

    const deleteBtn = screen.getByTestId("bulk-delete-button");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-bulk-delete-button")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId("confirm-bulk-delete-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("schemes");
      expect(deleteMock).toHaveBeenCalled();
      expect(inMock).toHaveBeenCalledWith("id", expect.arrayContaining(["scheme-1", "scheme-2"]));
      expect(toast.success).toHaveBeenCalledWith("Successfully deleted 2 schemes");
    });

    // Selection should be cleared
    await waitFor(() => {
      expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
    });
  });

  it("displays error toast and does not report success if bulk deletion fails", async () => {
    const { toast } = await import("sonner");
    inMock.mockResolvedValueOnce({ error: { message: "Permission denied or network failure" } });

    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    fireEvent.click(cb1);

    const deleteBtn = screen.getByTestId("bulk-delete-button");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-bulk-delete-button")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId("confirm-bulk-delete-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to delete schemes: Permission denied or network failure",
      );
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it("selects only filtered schemes when a search filter is active and Select All is clicked", () => {
    renderAdmin();

    const searchInput = screen.getByPlaceholderText(/Search schemes by name/i);
    // Search for "Scholarship" which matches only scheme-3
    fireEvent.change(searchInput, { target: { value: "Scholarship" } });

    // Table should now display only 1 scheme
    expect(screen.getByText("National Scholarship")).toBeInTheDocument();
    expect(screen.queryByText("PM-KISAN Samman Nidhi")).not.toBeInTheDocument();

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox");
    fireEvent.click(selectAllCheckbox);

    // Only 1 scheme selected
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toHaveTextContent("Delete Selected (1)");
  });

  it("batches large deletions into safe chunks of 50 to prevent URI/header overflow", async () => {
    const { toast } = await import("sonner");
    // Generate 60 schemes to test multi-chunk batching (>50)
    currentMockSchemes = Array.from({ length: 60 }, (_, i) => ({
      id: `bulk-scheme-${i + 1}`,
      name: `Bulk Scheme ${i + 1}`,
      description: `Description ${i + 1}`,
      ministry: "Ministry of Test",
      category: "General",
      level: "Central",
      state: null,
      benefits: "Benefits",
      eligibility_text: "Eligibility",
      required_documents: ["Aadhaar"],
      apply_url: "https://example.com",
      application_video_url: null,
      video_type: null,
      eligibility: {},
    }));

    renderAdmin();

    const selectAllCheckbox = screen.getByTestId("select-all-checkbox");
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("60 selected")).toBeInTheDocument();
    const deleteBtn = screen.getByTestId("bulk-delete-button");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-bulk-delete-button")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId("confirm-bulk-delete-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      // 60 schemes in batches of 50 should produce 2 chunk calls: 50, 10
      expect(inMock).toHaveBeenCalledTimes(2);
      expect((inMock.mock.calls[0] as any)?.[1]).toHaveLength(50);
      expect((inMock.mock.calls[1] as any)?.[1]).toHaveLength(10);
      expect(toast.success).toHaveBeenCalledWith("Successfully deleted 60 schemes");
    });
  }, 15000);

  it("accurately displays the number of schemes uploaded across the admin dashboard", () => {
    renderAdmin();

    // 1. Header subtitle
    expect(screen.getByText("3 schemes uploaded in database")).toBeInTheDocument();

    // 2. Tab button title
    expect(screen.getByRole("button", { name: /Schemes Management \(3\)/i })).toBeInTheDocument();

    // 3. Stat cards
    const statsContainer = screen.getByTestId("admin-schemes-stats");
    expect(statsContainer).toBeInTheDocument();
    expect(screen.getByTestId("total-schemes-uploaded-count")).toHaveTextContent("3");
    expect(screen.getByText("Central Schemes")).toBeInTheDocument();
    expect(screen.getByText("State Schemes")).toBeInTheDocument();
    expect(screen.getByText("Scheme Categories")).toBeInTheDocument();

    // 4. Pagination summary
    expect(screen.getByTestId("pagination-summary")).toHaveTextContent(
      "Showing 1–3 of 3 schemes (Total schemes uploaded: 3)",
    );
  });

  it("provides 'Delete All Schemes' in header action bar and prompts confirmation dialog", async () => {
    renderAdmin();

    const deleteAllBtn = screen.getByTestId("header-delete-all-button");
    expect(deleteAllBtn).toBeInTheDocument();
    expect(deleteAllBtn).toHaveTextContent("Delete All Schemes");

    // Click Delete All Schemes
    fireEvent.click(deleteAllBtn);

    // Verify confirmation dialog opens with warning message and scheme count
    await waitFor(() => {
      expect(screen.getByTestId("delete-all-dialog-content")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();
      expect(screen.getByTestId("confirm-delete-all-button")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-delete-all-button")).toHaveTextContent(
        "Delete All 3 Schemes",
      );
    });

    // Clicking cancel closes dialog without executing deletion
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("delete-all-dialog-content")).not.toBeInTheDocument();
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes all schemes when confirmed from the 'Delete All Schemes' dialog", async () => {
    const { toast } = await import("sonner");
    renderAdmin();

    const deleteAllBtn = screen.getByTestId("header-delete-all-button");
    fireEvent.click(deleteAllBtn);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-delete-all-button")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId("confirm-delete-all-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("schemes");
      expect(deleteMock).toHaveBeenCalled();
      expect(inMock).toHaveBeenCalledWith(
        "id",
        expect.arrayContaining(["scheme-1", "scheme-2", "scheme-3"]),
      );
      expect(toast.success).toHaveBeenCalledWith("Successfully deleted all 3 schemes");
    });
  });

  it("provides 'Delete All Schemes' option in the bulk action bar when items are selected", async () => {
    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    fireEvent.click(cb1);

    const bulkDeleteAllBtn = screen.getByTestId("bulk-delete-all-button");
    expect(bulkDeleteAllBtn).toBeInTheDocument();
    expect(bulkDeleteAllBtn).toHaveTextContent("Delete All Schemes (3)");

    fireEvent.click(bulkDeleteAllBtn);

    await waitFor(() => {
      expect(screen.getByTestId("delete-all-dialog-content")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-delete-all-button")).toBeInTheDocument();
    });
  });

  it("shows only delete selected schemes options in the confirmation popup when clicking delete selected", async () => {
    renderAdmin();

    const cb1 = screen.getByTestId("select-scheme-scheme-1");
    fireEvent.click(cb1);

    const bulkDeleteBtn = screen.getByTestId("bulk-delete-button");
    fireEvent.click(bulkDeleteBtn);

    await waitFor(() => {
      // Confirms dialog opens with Delete Selected Schemes title and button
      expect(screen.getByText("Delete Selected Schemes")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-bulk-delete-button")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-bulk-delete-button")).toHaveTextContent(
        "Delete 1 Selected Scheme",
      );
      // Ensures "Delete All Schemes Instead" is NOT shown in this popup
      expect(screen.queryByTestId("dialog-delete-all-option-button")).not.toBeInTheDocument();
      expect(screen.queryByText(/Delete All Schemes Instead/i)).not.toBeInTheDocument();
    });
  });
});
