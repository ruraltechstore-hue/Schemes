import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { splitRequiredDocuments } from "@/lib/document-helpers";
import { SchemeRequiredDocuments } from "@/components/SchemeRequiredDocuments";
import { matchScheme, Scheme, Profile } from "@/lib/matching";

describe("splitRequiredDocuments Helper", () => {
  it("splits the document list wherever a full stop (.) separates two documents", () => {
    const input = "Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook.";
    const result = splitRequiredDocuments(input);
    expect(result).toEqual([
      "Aadhaar Card",
      "Income Certificate",
      "Caste Certificate",
      "Bank Passbook",
    ]);
  });

  it("handles input without trailing full stop and trims unnecessary spaces", () => {
    const input = "  Aadhaar Card .   Income Certificate . Caste Certificate . Bank Passbook  ";
    const result = splitRequiredDocuments(input);
    expect(result).toEqual([
      "Aadhaar Card",
      "Income Certificate",
      "Caste Certificate",
      "Bank Passbook",
    ]);
  });

  it("handles existing scheme records stored as an array of a single full-stop separated string", () => {
    const existingDbRecord = ["Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook."];
    const result = splitRequiredDocuments(existingDbRecord);
    expect(result).toEqual([
      "Aadhaar Card",
      "Income Certificate",
      "Caste Certificate",
      "Bank Passbook",
    ]);
  });

  it("handles mixed delimiters (commas, semicolons, newlines, full stops)", () => {
    const input = "Aadhaar Card, Land Documents; Income Certificate\nCaste Certificate. Bank Passbook.";
    const result = splitRequiredDocuments(input);
    expect(result).toEqual([
      "Aadhaar Card",
      "Land Documents",
      "Income Certificate",
      "Caste Certificate",
      "Bank Passbook",
    ]);
  });

  it("handles numbered lists cleanly and strips leading numbering", () => {
    const input = "1. Aadhaar Card. 2. Income Certificate. 3. Bank Passbook.";
    const result = splitRequiredDocuments(input);
    expect(result).toEqual([
      "Aadhaar Card",
      "Income Certificate",
      "Bank Passbook",
    ]);
  });

  it("preserves original document names, case, and order", () => {
    const input = "7/12 Extract. Electricity Bill. Kisan Credit Card.";
    const result = splitRequiredDocuments(input);
    expect(result).toEqual([
      "7/12 Extract",
      "Electricity Bill",
      "Kisan Credit Card",
    ]);
  });

  it("returns empty array for empty, null, or undefined inputs", () => {
    expect(splitRequiredDocuments("")).toEqual([]);
    expect(splitRequiredDocuments(null)).toEqual([]);
    expect(splitRequiredDocuments(undefined)).toEqual([]);
    expect(splitRequiredDocuments([])).toEqual([]);
    expect(splitRequiredDocuments("   ")).toEqual([]);
  });
});

describe("SchemeRequiredDocuments Component", () => {
  it("displays every document on a separate line / list item instead of a single row", () => {
    const input = "Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook.";

    render(
      <MemoryRouter>
        <SchemeRequiredDocuments documents={input} />
      </MemoryRouter>
    );

    const items = screen.getAllByTestId("required-document-item");
    expect(items).toHaveLength(4);

    expect(items[0]).toHaveTextContent("Aadhaar Card");
    expect(items[1]).toHaveTextContent("Income Certificate");
    expect(items[2]).toHaveTextContent("Caste Certificate");
    expect(items[3]).toHaveTextContent("Bank Passbook");
  });

  it("handles existing array data where documents were stored in a single element", () => {
    const dbData = ["Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook."];

    render(
      <MemoryRouter>
        <SchemeRequiredDocuments documents={dbData} />
      </MemoryRouter>
    );

    const items = screen.getAllByTestId("required-document-item");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Aadhaar Card");
    expect(items[1]).toHaveTextContent("Income Certificate");
    expect(items[2]).toHaveTextContent("Caste Certificate");
    expect(items[3]).toHaveTextContent("Bank Passbook");
  });

  it("displays uploaded vs missing document status and provides upload links", () => {
    const docs = "Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook.";
    // Only Caste Certificate and Bank Passbook are missing
    const missingDocs = ["Caste Certificate", "Bank Passbook"];

    render(
      <MemoryRouter>
        <SchemeRequiredDocuments documents={docs} missingDocs={missingDocs} />
      </MemoryRouter>
    );

    const items = screen.getAllByTestId("required-document-item");
    expect(items).toHaveLength(4);

    // Uploaded docs should have checkmark and no Upload link
    expect(items[0]).toHaveTextContent("Aadhaar Card");
    expect(items[0].querySelector("a")).toBeNull();

    expect(items[1]).toHaveTextContent("Income Certificate");
    expect(items[1].querySelector("a")).toBeNull();

    // Missing docs should have Upload link
    expect(items[2]).toHaveTextContent("Caste Certificate");
    expect(items[2].querySelector("a")).toHaveAttribute("href", "/documents");

    expect(items[3]).toHaveTextContent("Bank Passbook");
    expect(items[3].querySelector("a")).toHaveAttribute("href", "/documents");
  });

  it("displays fallback message when no documents are required", () => {
    render(
      <MemoryRouter>
        <SchemeRequiredDocuments documents={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText("No specific documents required.")).toBeInTheDocument();
  });
});

describe("Eligibility Matching with Full-Stop Separated Scheme Documents", () => {
  const dummyProfile: Profile = {
    id: "p-1",
    full_name: "Test User",
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

  it("correctly matches individual documents when scheme has full-stop separated documents string in database", () => {
    const schemeWithBlob: Scheme = {
      id: "s-blob",
      name: "Solar Scheme",
      description: "Solar roof",
      ministry: "MNRE",
      category: "Social Welfare",
      level: "Central",
      state: null,
      benefits: "Subsidy",
      eligibility_text: "Households",
      required_documents: ["Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook."],
      apply_url: "https://example.com",
      created_at: null,
      eligibility: {},
      slug: null,
    };

    // User has uploaded Aadhaar Card and Income Certificate
    const userDocTypes = ["Aadhaar Card", "Income Certificate"];
    const match = matchScheme(schemeWithBlob, dummyProfile, userDocTypes);

    // Total documents should be 4, not 1!
    expect(match.reasons).toContain("2 of 4 required documents uploaded");
    expect(match.missingDocs).toEqual(["Caste Certificate", "Bank Passbook"]);
  });

  it("supports fuzzy / canonical matching between Aadhaar Card and Aadhaar", () => {
    const scheme: Scheme = {
      id: "s-canonical",
      name: "Krishi Scheme",
      description: "Agri",
      ministry: "Agriculture",
      category: "Agriculture",
      level: "Central",
      state: null,
      benefits: "Financial assistance",
      eligibility_text: "Farmers",
      required_documents: ["Aadhaar Card. Bank Passbook."],
      apply_url: "https://example.com",
      created_at: null,
      eligibility: {},
      slug: null,
    };

    // User uploaded "Aadhaar" and "Bank Documents"
    const userDocTypes = ["Aadhaar", "Bank Documents"];
    const match = matchScheme(scheme, dummyProfile, userDocTypes);

    expect(match.reasons).toContain("2 of 2 required documents uploaded");
    expect(match.missingDocs).toEqual([]);
  });
});
