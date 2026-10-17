import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Admin from "@/routes/_authenticated/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-user-id" } } }),
      },
    },
  };
});

// Mock user and admin hooks
vi.mock("@/hooks/use-app-data", () => ({
  useIsAdmin: () => ({ data: true, isLoading: false }),
  useSchemes: () => ({
    data: [
      {
        id: "scheme-123",
        name: "Solar Rooftop Scheme",
        description: "Rooftop solar assistance",
        ministry: "Ministry of Power",
        category: "Social Welfare",
        level: "State",
        state: "Maharashtra",
        benefits: "Subsidy up to 40%",
        eligibility_text: "Households with grid connection",
        required_documents: ["Aadhaar", "Electricity Bill", "7/12 Extract"],
        apply_url: "https://solarrooftop.gov.in",
        application_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_type: "youtube",
        eligibility: {
          min_age: 18,
          max_age: 65,
          max_income: 800000,
          application_process: "1. Apply online\n2. DISCOM approval",
          application_deadline: "2026-12-31",
          application_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          video_type: "youtube",
        },
      },
    ],
    isLoading: false,
  }),
}));

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin />
    </QueryClientProvider>
  );
}

describe("Admin Edit Scheme Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches scheme by ID from database and pre-fills all fields when clicking Edit", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "scheme-123",
        name: "Solar Rooftop Scheme",
        description: "Rooftop solar assistance",
        ministry: "Ministry of Power",
        category: "Social Welfare",
        level: "State",
        state: "Maharashtra",
        benefits: "Subsidy up to 40%",
        eligibility_text: "Households with grid connection",
        required_documents: ["Aadhaar", "Electricity Bill", "7/12 Extract"],
        apply_url: "https://solarrooftop.gov.in",
        application_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_type: "youtube",
        eligibility: {
          min_age: 18,
          max_age: 65,
          max_income: 800000,
          application_process: "1. Apply online\n2. DISCOM approval",
          application_deadline: "2026-12-31",
        },
      },
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    renderAdmin();

    // Click the Edit (pencil) button on the scheme row
    const editButtons = screen.getAllByTitle("Edit scheme");
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);

    // Verify database was queried by unique ID
    expect(supabase.from).toHaveBeenCalledWith("schemes");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(eqMock).toHaveBeenCalledWith("id", "scheme-123");

    // Wait for the modal and pre-filled values
    await waitFor(() => {
      expect(screen.getByText("Edit scheme")).toBeInTheDocument();
    });

    // Check pre-filled inputs
    expect(screen.getByDisplayValue("Solar Rooftop Scheme")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Rooftop solar assistance")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ministry of Power")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Subsidy up to 40%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Households with grid connection")).toBeInTheDocument();
    const processTextarea = screen.getByPlaceholderText(/Step-by-step/i) as HTMLTextAreaElement;
    expect(processTextarea.value).toContain("1. Apply online");
    expect(screen.getByDisplayValue("2026-12-31")).toBeInTheDocument();

    // Check structured eligibility pre-filled
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("65")).toBeInTheDocument();
    expect(screen.getByDisplayValue("800000")).toBeInTheDocument();

    // Check custom documents display
    expect(screen.getAllByText("Electricity Bill").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("7/12 Extract").length).toBeGreaterThanOrEqual(1);
  });

  it("handles loading state and displays error if fetching scheme fails", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Network connection lost" },
    });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    renderAdmin();

    const editButtons = screen.getAllByTitle("Edit scheme");
    fireEvent.click(editButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scheme/i)).toBeInTheDocument();
      expect(screen.getByText(/Network connection lost/i)).toBeInTheDocument();
    });
  });

  it("saves edited scheme with update and preserves unchanged fields", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "scheme-123",
        name: "Solar Rooftop Scheme",
        description: "Rooftop solar assistance",
        ministry: "Ministry of Power",
        category: "Social Welfare",
        level: "Central",
        state: null,
        benefits: "Old benefits",
        eligibility_text: "Old criteria",
        required_documents: ["Aadhaar"],
        apply_url: "https://solarrooftop.gov.in",
        eligibility: {},
      },
      error: null,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "schemes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: singleMock }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    renderAdmin();

    const editButtons = screen.getAllByTitle("Edit scheme");
    fireEvent.click(editButtons[0]!);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Solar Rooftop Scheme")).toBeInTheDocument();
    });

    // Modify benefits field only
    const benefitsInput = screen.getByDisplayValue("Old benefits");
    fireEvent.change(benefitsInput, { target: { value: "New updated subsidy 50%" } });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /update scheme/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    const savedPayload = updateMock.mock.calls[0]![0];
    // Check that benefits was updated while all other fields were preserved
    expect(savedPayload.benefits).toBe("New updated subsidy 50%");
    expect(savedPayload.name).toBe("Solar Rooftop Scheme");
    expect(savedPayload.ministry).toBe("Ministry of Power");
    expect(savedPayload.apply_url).toBe("https://solarrooftop.gov.in");
    expect(savedPayload.required_documents).toEqual(["Aadhaar"]);
  });
});
