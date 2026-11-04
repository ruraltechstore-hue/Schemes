import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BulkUpload } from "@/components/BulkUpload";
import { parseBulkFile } from "@/lib/scheme-bulk-import";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Scheme } from "@/lib/matching";

// Mock Supabase client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
}));

function renderBulkUpload(existingSchemes: Scheme[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BulkUpload existingSchemes={existingSchemes} />
    </QueryClientProvider>
  );
}

describe("Multiple Bulk Data Upload Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parseBulkFile correctly parses CSV and auto-maps headers", async () => {
    const csv = `Scheme Name,Department,Category,Benefits\n"PM Mudra Yojana","Ministry of Finance","Financial Services","Loans up to 10 Lakh"`;
    const file = new File([csv], "mudra.csv", { type: "text/csv" });
    const parsed = await parseBulkFile(file);

    expect(parsed.name).toBe("mudra.csv");
    expect(parsed.headers).toEqual(["Scheme Name", "Department", "Category", "Benefits"]);
    expect(parsed.rawRows.length).toBe(1);
    expect(parsed.columnMapping["Scheme Name"]).toBe("name");
    expect(parsed.columnMapping["Department"]).toBe("ministry");
    expect(parsed.columnMapping["Category"]).toBe("category");
    expect(parsed.columnMapping["Benefits"]).toBe("benefits");
  });

  it("parseBulkFile throws an error on empty files", async () => {
    const emptyFile = new File(["   "], "empty.csv", { type: "text/csv" });
    await expect(parseBulkFile(emptyFile)).rejects.toThrow(/empty/i);
  });

  it("allows selecting multiple bulk files at once and shows tabs for each file", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name,Category,Official Website URL\n"Central Scheme 1","Agriculture","https://central1.gov.in"\n"Central Scheme 2","Healthcare","https://central2.gov.in"`;
    const csv2 = `Scheme Name,State,Official Website URL\n"State Scheme A","Maharashtra","https://state-a.gov.in"\n"State Scheme B","Karnataka","https://state-b.gov.in"`;

    const file1 = new File([csv1], "central_schemes.csv", { type: "text/csv" });
    const file2 = new File([csv2], "state_schemes.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    // Input must have multiple attribute enabled
    expect(fileInput.hasAttribute("multiple")).toBe(true);

    // Upload both files simultaneously
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
    });

    // Both files should appear in the bulk files tabs bar
    expect(screen.getAllByText("central_schemes.csv").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("state_schemes.csv")).toBeInTheDocument();
    expect(screen.getByText(/Total: 4 schemes across 2 files/i)).toBeInTheDocument();

    // Verify switching tabs
    const tab2 = screen.getByTestId("file-tab-1");
    fireEvent.click(tab2);

    // Should now show columns from state_schemes.csv (e.g., State column)
    await waitFor(() => {
      expect(screen.getAllByText("State").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("allows copying column mappings to other uploaded files", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name,Department,Official Website URL\n"Scheme One","Ministry of Electronics","https://meity.gov.in"`;
    const csv2 = `Scheme Name,Department,Official Website URL\n"Scheme Two","Ministry of Electronics","https://meity2.gov.in"`;

    const file1 = new File([csv1], "batch_a.csv", { type: "text/csv" });
    const file2 = new File([csv2], "batch_b.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy mapping to all/i })).toBeInTheDocument();
    });

    // Click Copy Mapping to All
    fireEvent.click(screen.getByRole("button", { name: /copy mapping to all/i }));

    // Both files are ready to preview
    const previewBtn = screen.getByRole("button", { name: /preview data/i });
    expect(previewBtn).not.toBeDisabled();
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 schemes/i)).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Scheme One")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Scheme Two")).toBeInTheDocument();
  });

  it("combines schemes from multiple files in preview, shows source file badges, and filters by file", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name,Category\n"PM Awas Yojana","Housing"`;
    const csv2 = `Scheme Name,Category\n"Ayushman Bharat","Healthcare"`;

    const file1 = new File([csv1], "housing.csv", { type: "text/csv" });
    const file2 = new File([csv2], "health.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 schemes/i)).toBeInTheDocument();
    });

    // Verify source file badges appear
    expect(screen.getByText("housing.csv")).toBeInTheDocument();
    expect(screen.getByText("health.csv")).toBeInTheDocument();

    // Verify both schemes are in the table
    expect(screen.getByDisplayValue("PM Awas Yojana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ayushman Bharat")).toBeInTheDocument();
  });

  it("detects cross-file duplicates between uploaded bulk files", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    // Both files contain a scheme with the same name "National Solar Mission"
    const csv1 = `Scheme Name,Benefits\n"National Solar Mission","Subsidies"`;
    const csv2 = `Scheme Name,Benefits\n"National Solar Mission","Low interest loan"`;

    const file1 = new File([csv1], "solar_part1.csv", { type: "text/csv" });
    const file2 = new File([csv2], "solar_part2.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 schemes/i)).toBeInTheDocument();
    });

    // The first scheme is Valid, the second scheme is flagged as Duplicate
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText(/Duplicates \(1\)/i)).toBeInTheDocument();
  });

  it("allows removing an uploaded file from the batch", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name\n"Scheme Keep"`;
    const csv2 = `Scheme Name\n"Scheme Delete"`;

    const file1 = new File([csv1], "keep.csv", { type: "text/csv" });
    const file2 = new File([csv2], "remove_me.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText("remove_me.csv")).toBeInTheDocument();
    });

    // Remove remove_me.csv
    const removeBtn = screen.getByTitle("Remove remove_me.csv");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText("remove_me.csv")).not.toBeInTheDocument();
      expect(screen.getAllByText("keep.csv").length).toBeGreaterThanOrEqual(1);
    });

    // Proceed to preview - only keep.csv scheme should be present
    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 1 schemes/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Scheme Keep")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Scheme Delete")).not.toBeInTheDocument();
    });
  });

  it("imports all schemes across multiple files and displays per-file results breakdown", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name,Category\n"Digital India 1","Technology"`;
    const csv2 = `Scheme Name,Category\n"Digital India 2","Technology"`;

    const file1 = new File([csv1], "tech_batch1.csv", { type: "text/csv" });
    const file2 = new File([csv2], "tech_batch2.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preview data/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /preview data/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /import 2 schemes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /import 2 schemes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Import Process Finished/i)).toBeInTheDocument();
    });

    // Check overall summary
    expect(screen.getByText("Schemes Added")).toBeInTheDocument();

    // Check per-file breakdown table
    expect(screen.getByText("Breakdown by Uploaded Bulk File")).toBeInTheDocument();
    expect(screen.getByText("tech_batch1.csv")).toBeInTheDocument();
    expect(screen.getByText("tech_batch2.csv")).toBeInTheDocument();
    expect(screen.getAllByText(/1 added/i).length).toBe(2);

    // Verify upload more bulk data button resets state
    const uploadMoreBtn = screen.getByRole("button", { name: /upload more bulk data/i });
    fireEvent.click(uploadMoreBtn);

    expect(screen.getByText(/drag and drop your csv or excel file here/i)).toBeInTheDocument();
  });

  it("allows adding more files using the 'Add More Files' button in the mapping step", async () => {
    renderBulkUpload();
    fireEvent.click(screen.getByRole("button", { name: /bulk upload schemes/i }));

    const csv1 = `Scheme Name,Category\n"Scheme Alpha","Education"`;
    const file1 = new File([csv1], "initial_file.csv", { type: "text/csv" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput, { target: { files: [file1] } });

    // Step 2: Mapping step is reached
    await waitFor(() => {
      expect(screen.getByText(/Review Column Header Mapping/i)).toBeInTheDocument();
      expect(screen.getAllByText("initial_file.csv").length).toBeGreaterThanOrEqual(1);
    });

    // The persistent file input MUST still exist in the DOM during mapping step
    const persistentInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(persistentInput).not.toBeNull();

    // Clicking "Add More Files" should trigger the file input click
    const clickSpy = vi.spyOn(persistentInput, "click");
    const addMoreBtn = screen.getByRole("button", { name: /add more files/i });
    expect(addMoreBtn).toBeInTheDocument();
    fireEvent.click(addMoreBtn);
    expect(clickSpy).toHaveBeenCalled();

    // Add a second file
    const csv2 = `Scheme Name,Category\n"Scheme Beta","Finance"`;
    const file2 = new File([csv2], "second_file.csv", { type: "text/csv" });
    fireEvent.change(persistentInput, { target: { files: [file2] } });

    // Both files should now be listed in the switcher tabs
    await waitFor(() => {
      expect(screen.getAllByText("second_file.csv").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Total: 2 schemes across 2 files/i)).toBeInTheDocument();
    });

    // The newly uploaded file should be actively selected
    expect(screen.getByText(/File:/i)).toHaveTextContent("second_file.csv");
  });
});

