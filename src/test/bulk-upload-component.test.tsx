import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { BulkUpload } from "@/components/BulkUpload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Scheme } from "@/lib/matching";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}));

function renderBulkUpload(existingSchemes: Scheme[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BulkUpload existingSchemes={existingSchemes} />
    </QueryClientProvider>,
  );
}

describe("BulkUpload Component Integration Tests", () => {
  const existingSchemes: Scheme[] = [
    {
      id: "dup-1",
      name: "Existing Solar Scheme",
      description: "Existing desc",
      ministry: "Ministry of Power",
      category: "Social Welfare",
      level: "Central",
      state: null,
      benefits: "Subsidy",
      eligibility: {},
      eligibility_text: "Citizens",
      required_documents: ["Aadhaar"],
      apply_url: "https://solarexisting.gov.in",
      application_video_url: null,
      video_type: null,
      created_at: new Date().toISOString(),
    },
  ];

  it("renders trigger button and opens dialog", () => {
    renderBulkUpload();
    const btn = screen.getByRole("button", { name: /bulk upload schemes/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText("Bulk Scheme Upload & Column Mapping")).toBeInTheDocument();
    expect(screen.getByText(/drag and drop your csv or excel file here/i)).toBeInTheDocument();
  });

  it("parses CSV file, automatically maps columns, and displays sample values", async () => {
    const { container } = renderBulkUpload(existingSchemes);
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csvContent = `"  Scheme_Name  ","Description","Department / Ministry","Official Website URL","Required Documents","Eligibility Criteria"
"New Test Scheme","Description of scheme","Ministry of Agriculture","https://test.gov.in","Aadhaar, Land Documents; Bank Documents","Farmers in Maharashtra; Age between 18 to 65"
"Existing Solar Scheme","Solar scheme description","Ministry of New Energy","https://solar.gov.in","Aadhaar; Electricity Bill","Households with grid connectivity"`;

    const file = new File([csvContent], "test_schemes.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    });

    // Verify detected headers and mapping screen
    expect(screen.getByText("Scheme_Name")).toBeInTheDocument();
    expect(screen.getAllByText("Department / Ministry").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Official Website URL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Required Documents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Eligibility Criteria").length).toBeGreaterThanOrEqual(1);

    // Verify sample values appear
    expect(screen.getByText(/"New Test Scheme"/i)).toBeInTheDocument();
    expect(screen.getByText(/"https:\/\/test.gov.in"/i)).toBeInTheDocument();

    // Verify Continue / Preview Data button is enabled
    const previewBtn = screen.getByRole("button", { name: /preview data/i });
    expect(previewBtn).not.toBeDisabled();
    fireEvent.click(previewBtn);

    // Verify Preview Table renders schemes
    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 schemes/i)).toBeInTheDocument();
    });

    // Check row data in preview
    expect(screen.getByDisplayValue("New Test Scheme")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Solar Scheme")).toBeInTheDocument();

    // Check duplicate status badge
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();

    // Check parsed document badges
    expect(screen.getByText("Land Documents")).toBeInTheDocument();
    expect(screen.getByText("Bank Documents")).toBeInTheDocument();

    // Check point-wise eligibility criteria rendered in preview table
    expect(screen.getByText("Farmers in Maharashtra")).toBeInTheDocument();
    expect(screen.getByText("Age between 18 to 65")).toBeInTheDocument();
    expect(screen.getByText("Households with grid connectivity")).toBeInTheDocument();
  });

  it("allows switching back to adjust column mappings", async () => {
    const { container } = renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csvContent = `Scheme Name,Official Website URL\n"Test Scheme 1","https://example.com"`;
    const file = new File([csvContent], "sample.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /adjust mapping/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /adjust mapping/i }));

    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    });
  });

  it("allows proceeding to preview and validates scheme when Official Website URL and video are absent", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    // CSV containing only Scheme Name and Description, without website URL or video
    const csvContent = `Scheme Name,Description\n"Scheme Without Any Link","Description only"`;
    const file = new File([csvContent], "no_urls.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });

    const previewBtn = screen.getByRole("button", { name: /preview data/i });
    expect(previewBtn).not.toBeDisabled();
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText("Valid")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Scheme Without Any Link")).toBeInTheDocument();
    expect(screen.getByTitle("No tutorial video provided")).toBeInTheDocument();
  });

  it("displays 8 mapping rows in a dedicated scrollable table container with sticky header", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    // CSV with 8 distinct column headers
    const csvContent = `"Col 1 - Scheme Name","Col 2 - Description","Col 3 - Ministry","Col 4 - Category","Col 5 - Benefits","Col 6 - Criteria","Col 7 - Docs","Col 8 - Apply URL"
"Test Scheme A","Desc A","Ministry A","Welfare","Benefits A","Eligible A","Aadhaar","https://a.gov.in"`;

    const file = new File([csvContent], "eight_columns.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    });

    // Check table container presence and scrollability classes
    const tableContainer = screen.getByTestId("column-mapping-table-container");
    expect(tableContainer).toBeInTheDocument();
    expect(tableContainer.className).toContain("overflow-y-auto");
    expect(tableContainer.className).toContain("min-h-[380px]");

    // Verify all 8 column header rows are rendered in the mapping table
    expect(screen.getByText("Col 1 - Scheme Name")).toBeInTheDocument();
    expect(screen.getByText("Col 2 - Description")).toBeInTheDocument();
    expect(screen.getByText("Col 3 - Ministry")).toBeInTheDocument();
    expect(screen.getByText("Col 4 - Category")).toBeInTheDocument();
    expect(screen.getByText("Col 5 - Benefits")).toBeInTheDocument();
    expect(screen.getByText("Col 6 - Criteria")).toBeInTheDocument();
    expect(screen.getByText("Col 7 - Docs")).toBeInTheDocument();
    expect(screen.getByText("Col 8 - Apply URL")).toBeInTheDocument();

    // Verify fixed / sticky table header with backdrop blur
    const tableHeader = tableContainer.querySelector("thead");
    expect(tableHeader).not.toBeNull();
    expect(tableHeader?.className).toContain("sticky");
    expect(tableHeader?.className).toContain("top-0");

    // Verify outer vertical scrolling container on the right corner encompasses Bulk Files and Review Column Header Mapping
    const scrollContainer = screen.getByTestId("mapping-scroll-container");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain("overflow-y-auto");
    expect(within(scrollContainer).getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    expect(within(scrollContainer).getByText(/Bulk Files/i)).toBeInTheDocument();
  });

  it("verifies arrow mark drag scroll feature is removed and right corner vertical scrolling encompasses mapping sections", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csvContent = `"Col 1 - Scheme Name","Col 2 - Description","Col 3 - Ministry","Col 4 - Category","Col 5 - Benefits"\n"Test A","Desc A","Ministry A","Category A","Benefits A"`;
    const file = new File([csvContent], "resize_test.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    });

    // 1. Verify arrow mark drag scroll handle is NOT in the document
    expect(screen.queryByTestId("column-mapping-resize-handle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mapping-scroll-up-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mapping-scroll-down-btn")).not.toBeInTheDocument();

    // 2. Verify right corner vertical scrolling container encompasses Bulk Files and Review Column Header Mapping
    const scrollContainer = screen.getByTestId("mapping-scroll-container");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain("overflow-y-auto");
    expect(within(scrollContainer).getByText(/Bulk Files/i)).toBeInTheDocument();
    expect(within(scrollContainer).getByText(/Review Column Header Mapping/i)).toBeInTheDocument();

    // 3. Verify clean column mapping table container with sticky header
    const tableContainer = screen.getByTestId("column-mapping-table-container");
    expect(tableContainer).toBeInTheDocument();
    expect(tableContainer.className).toContain("overflow-y-auto");
    expect(tableContainer.className).toContain("min-h-[380px]");

    const tableHeader = tableContainer.querySelector("thead");
    expect(tableHeader?.className).toContain("sticky");
    expect(tableHeader?.className).toContain("top-0");
  });
});
