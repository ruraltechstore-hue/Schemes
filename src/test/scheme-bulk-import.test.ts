import { describe, it, expect } from "vitest";
import {
  normalizeHeader,
  matchHeaderToField,
  autoMapHeaders,
  parseDelimitedList,
  parseRequiredDocuments,
  parseIndianNumber,
  parseUrl,
  parseLevelAndState,
  parseCategory,
  transformRowToPayload,
  validateRowPayload,
  extractStructuredEligibility,
} from "@/lib/scheme-bulk-import";
import type { Scheme } from "@/lib/matching";

describe("scheme-bulk-import utility tests", () => {
  describe("normalizeHeader", () => {
    it("cleans capitalization, underscores, dashes, slashes, and spaces", () => {
      expect(normalizeHeader("  Scheme_Name  ")).toBe("scheme name");
      expect(normalizeHeader("Department / Ministry")).toBe("department ministry");
      expect(normalizeHeader("Govt. Type (Level)")).toBe("govt type level");
      expect(normalizeHeader("Official-Website-URL")).toBe("official website url");
      expect(normalizeHeader("Application_Tutorial_Video")).toBe("application tutorial video");
    });
  });

  describe("matchHeaderToField", () => {
    it("correctly identifies fields with variations in casing and spaces", () => {
      expect(matchHeaderToField("Scheme Name")).toBe("name");
      expect(matchHeaderToField("scheme_name")).toBe("name");
      expect(matchHeaderToField("NAME OF SCHEME")).toBe("name");
      expect(matchHeaderToField("Department")).toBe("ministry");
      expect(matchHeaderToField("Ministry / Department")).toBe("ministry");
      expect(matchHeaderToField("Government Type")).toBe("level");
      expect(matchHeaderToField("Govt Type")).toBe("level");
      expect(matchHeaderToField("State / UT")).toBe("state");
      expect(matchHeaderToField("Category")).toBe("category");
      expect(matchHeaderToField("Eligibility Criteria")).toBe("eligibility_text");
      expect(matchHeaderToField("Required Documents")).toBe("required_documents");
      expect(matchHeaderToField("Documents Required")).toBe("required_documents");
      expect(matchHeaderToField("Benefits")).toBe("benefits");
      expect(matchHeaderToField("Application Process")).toBe("application_process");
      expect(matchHeaderToField("How to Apply")).toBe("application_process");
      expect(matchHeaderToField("Official Website URL")).toBe("apply_url");
      expect(matchHeaderToField("Portal URL")).toBe("apply_url");
      expect(matchHeaderToField("Application Deadline")).toBe("application_deadline");
      expect(matchHeaderToField("Last Date")).toBe("application_deadline");
      expect(matchHeaderToField("Application Tutorial Video")).toBe("application_video_url");
      expect(matchHeaderToField("YouTube URL")).toBe("application_video_url");
    });

    it("returns null for unknown column names", () => {
      expect(matchHeaderToField("Random Column 123")).toBeNull();
    });
  });

  describe("autoMapHeaders", () => {
    it("maps recognized headers and sets unrecognized headers to __ignore__ without collision", () => {
      const headers = [
        "Scheme Name",
        "Description",
        "Department",
        "Government Type",
        "Official Website URL",
        "Extra Column",
      ];
      const mapping = autoMapHeaders(headers);
      expect(mapping["Scheme Name"]).toBe("name");
      expect(mapping["Description"]).toBe("description");
      expect(mapping["Department"]).toBe("ministry");
      expect(mapping["Government Type"]).toBe("level");
      expect(mapping["Official Website URL"]).toBe("apply_url");
      expect(mapping["Extra Column"]).toBe("__ignore__");
    });
  });

  describe("parseDelimitedList", () => {
    it("handles comma-separated values", () => {
      expect(parseDelimitedList("Aadhaar, PAN, Bank Documents")).toEqual([
        "Aadhaar",
        "PAN",
        "Bank Documents",
      ]);
    });

    it("handles semicolon-separated values", () => {
      expect(parseDelimitedList("Aadhaar; Income Certificate; Residence Certificate")).toEqual([
        "Aadhaar",
        "Income Certificate",
        "Residence Certificate",
      ]);
    });

    it("handles mixed commas, semicolons, and newlines", () => {
      const input = "Aadhaar, Land Documents; Bank Documents\nOther Documents";
      expect(parseDelimitedList(input)).toEqual([
        "Aadhaar",
        "Land Documents",
        "Bank Documents",
        "Other Documents",
      ]);
    });

    it("strips numbering and bullet points", () => {
      const input = "1. Aadhaar; 2. PAN Card; 3. Bank Passbook";
      expect(parseDelimitedList(input)).toEqual(["Aadhaar", "PAN Card", "Bank Passbook"]);
    });

    it("handles JSON array strings", () => {
      expect(parseDelimitedList('["Aadhaar", "PAN"]')).toEqual(["Aadhaar", "PAN"]);
    });

    it("splits document list wherever a full stop (.) separates two documents", () => {
      const input = "Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook.";
      expect(parseDelimitedList(input)).toEqual([
        "Aadhaar Card",
        "Income Certificate",
        "Caste Certificate",
        "Bank Passbook",
      ]);
    });

    it("handles full-stop separated documents with numbering and trailing spaces", () => {
      const input = "1. Aadhaar Card. 2. Income Certificate. 3. Bank Passbook.";
      expect(parseDelimitedList(input)).toEqual([
        "Aadhaar Card",
        "Income Certificate",
        "Bank Passbook",
      ]);
    });

    it("returns empty array for empty inputs", () => {
      expect(parseDelimitedList("")).toEqual([]);
      expect(parseDelimitedList(null)).toEqual([]);
      expect(parseDelimitedList(undefined)).toEqual([]);
    });
  });

  describe("parseRequiredDocuments", () => {
    it("canonicalizes known DOC_TYPES while keeping custom docs", () => {
      const result = parseRequiredDocuments("Aadhaar Card; PAN Card; Custom Certificate");
      expect(result).toEqual(["Aadhaar", "PAN", "Custom Certificate"]);
    });

    it("splits documents on full stops and canonicalizes known types", () => {
      const result = parseRequiredDocuments("Aadhaar Card. Income Certificate. Caste Certificate. Bank Passbook.");
      expect(result).toEqual([
        "Aadhaar",
        "Income Certificate",
        "Caste Certificate",
        "Bank Passbook",
      ]);
    });
  });

  describe("parseIndianNumber", () => {
    it("handles formatted numbers and Indian words", () => {
      expect(parseIndianNumber("250000")).toBe(250000);
      expect(parseIndianNumber("2,50,000")).toBe(250000);
      expect(parseIndianNumber("₹2,50,000/-")).toBe(250000);
      expect(parseIndianNumber("2.5 Lakh")).toBe(250000);
      expect(parseIndianNumber("1.5 Crore")).toBe(15000000);
      expect(parseIndianNumber("invalid")).toBeUndefined();
    });
  });

  describe("parseUrl", () => {
    it("prepends https:// when missing and validates", () => {
      expect(parseUrl("https://pmkisan.gov.in")).toEqual({
        url: "https://pmkisan.gov.in",
        valid: true,
      });
      expect(parseUrl("pmkisan.gov.in")).toEqual({
        url: "https://pmkisan.gov.in",
        valid: true,
      });
      expect(parseUrl("not a url")).toEqual({
        url: "https://not a url",
        valid: false,
      });
    });
  });

  describe("parseLevelAndState", () => {
    it("detects Central level", () => {
      expect(parseLevelAndState("Central", "")).toEqual({ level: "Central", state: null });
      expect(parseLevelAndState("Central Govt", "All India")).toEqual({ level: "Central", state: null });
    });

    it("detects State level and state name", () => {
      expect(parseLevelAndState("State", "Maharashtra")).toEqual({
        level: "State",
        state: "Maharashtra",
      });
      expect(parseLevelAndState("", "Gujarat")).toEqual({
        level: "State",
        state: "Gujarat",
      });
    });
  });

  describe("extractStructuredEligibility", () => {
    it("extracts age range, income, and farmer status from text", () => {
      const text = "Landholding farmer families; Age between 18 to 60; Income up to 2.5 Lakh";
      const structured = extractStructuredEligibility(text);
      expect(structured.farmer).toBe(true);
      expect(structured.min_age).toBe(18);
      expect(structured.max_age).toBe(60);
      expect(structured.max_income).toBe(250000);
    });
  });

  describe("transformRowToPayload & validateRowPayload", () => {
    const mapping = {
      "Scheme Name": "name" as const,
      "Description": "description" as const,
      "Department": "ministry" as const,
      "Government Type": "level" as const,
      "State": "state" as const,
      "Category": "category" as const,
      "Eligibility Criteria": "eligibility_text" as const,
      "Required Documents": "required_documents" as const,
      "Benefits": "benefits" as const,
      "Application Process": "application_process" as const,
      "Official Website URL": "apply_url" as const,
      "Application Deadline": "application_deadline" as const,
      "Application Tutorial Video": "application_video_url" as const,
    };

    it("maps all fields into the scheme payload correctly", () => {
      const rawRow = {
        "Scheme Name": "Pradhan Mantri Test Scheme",
        "Description": "A test government scheme for testing bulk import.",
        "Department": "Ministry of Electronics & IT",
        "Government Type": "Central",
        "State": "",
        "Category": "Social Welfare",
        "Eligibility Criteria": "Citizens aged 18-50; Annual income under 3,00,000",
        "Required Documents": "Aadhaar, PAN; Bank Documents",
        "Benefits": "Financial grant of ₹10,000",
        "Application Process": "Apply online at the official portal",
        "Official Website URL": "https://example.gov.in",
        "Application Deadline": "2026-12-31",
        "Application Tutorial Video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      };

      const payload = transformRowToPayload(rawRow, mapping);

      expect(payload.name).toBe("Pradhan Mantri Test Scheme");
      expect(payload.description).toBe("A test government scheme for testing bulk import.");
      expect(payload.ministry).toBe("Ministry of Electronics & IT");
      expect(payload.level).toBe("Central");
      expect(payload.state).toBeNull();
      expect(payload.category).toBe("Social Welfare");
      expect(payload.benefits).toBe("Financial grant of ₹10,000");
      expect(payload.required_documents).toEqual(["Aadhaar", "PAN", "Bank Documents"]);
      expect(payload.apply_url).toBe("https://example.gov.in");
      expect(payload.application_video_url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(payload.video_type).toBe("youtube");
      expect(payload.eligibility.application_process).toBe("Apply online at the official portal");
      expect(payload.eligibility.application_deadline).toBe("2026-12-31");
      expect(payload.eligibility.min_age).toBe(18);
      expect(payload.eligibility.max_age).toBe(50);
      expect(payload.eligibility.max_income).toBe(300000);

      const existingSchemes: Scheme[] = [];
      const result = validateRowPayload(payload, rawRow, 0, existingSchemes);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("detects duplicates and validation errors", () => {
      const existing: Scheme[] = [
        {
          id: "existing-1",
          name: "Existing Scheme",
          description: "",
          ministry: "",
          category: "Social Welfare",
          level: "Central",
          state: null,
          benefits: "",
          eligibility: {},
          eligibility_text: "",
          required_documents: [],
          apply_url: "https://existing.gov.in",
          application_video_url: null,
          video_type: null,
          created_at: new Date().toISOString(),
        },
      ];

      // Missing name (URL is optional, so empty URL is not an error)
      const invalidRow = {
        "Scheme Name": "",
        "Official Website URL": "",
      };
      const invalidPayload = transformRowToPayload(invalidRow, mapping);
      const invalidResult = validateRowPayload(invalidPayload, invalidRow, 0, existing);
      expect(invalidResult.status).toBe("invalid");
      expect(invalidResult.errors).toContain("Scheme Name is required");
      expect(invalidResult.errors).not.toContain("Official Website URL is required");

      // Invalid URL format when URL is provided
      const invalidUrlRow = {
        "Scheme Name": "Scheme With Malformed URL",
        "Official Website URL": "invalid-url-without-domain",
      };
      const invalidUrlPayload = transformRowToPayload(invalidUrlRow, mapping);
      const invalidUrlResult = validateRowPayload(invalidUrlPayload, invalidUrlRow, 0, existing);
      expect(invalidUrlResult.status).toBe("invalid");
      expect(invalidUrlResult.errors).toContain("Invalid Official Website URL (e.g. https://example.gov.in)");

      // Duplicate scheme
      const dupRow = {
        "Scheme Name": "Existing Scheme",
        "Official Website URL": "https://example.gov.in",
      };
      const dupPayload = transformRowToPayload(dupRow, mapping);
      const dupResult = validateRowPayload(dupPayload, dupRow, 1, existing);
      expect(dupResult.status).toBe("duplicate");
      expect(dupResult.existingScheme?.id).toBe("existing-1");
    });
  });

  describe("CSV & Excel integration parsing tests", () => {
    it("preserves quotes, embedded commas, and multiline text in CSV parsing", async () => {
      const Papa = (await import("papaparse")).default;
      const csvString = `Scheme Name,Description,Department,Government Type,State,Category,Eligibility Criteria,Required Documents,Benefits,Application Process,Official Website URL,Application Deadline,Application Tutorial Video
"Scheme Alpha","This is a description with, commas, and ""quotes"", and\nmultiple lines.","Ministry of Agriculture","Central","","Agriculture","Farmers with land; Age 18-60","Aadhaar, Land Documents; Bank Documents","₹6,000 yearly","Step 1: Go to portal\nStep 2: Apply","https://pmkisan.gov.in","2026-12-31","https://youtu.be/dQw4w9WgXcQ"
"Scheme Beta","State level scheme for women","Women & Child Dept","State","Maharashtra","Women","Women aged 21-50; Income under 2.5 Lakh","Aadhaar; Income Certificate; Residence Certificate","Monthly allowance","Apply at District office","https://maharashtra.gov.in","2026-10-31",""`;

      const parsed = Papa.parse<Record<string, string>>(csvString, {
        header: true,
        skipEmptyLines: "greedy",
      });

      expect(parsed.data.length).toBe(2);

      const mapping = autoMapHeaders(parsed.meta.fields || []);
      expect(mapping["Scheme Name"]).toBe("name");
      expect(mapping["Description"]).toBe("description");
      expect(mapping["Department"]).toBe("ministry");
      expect(mapping["Official Website URL"]).toBe("apply_url");

      const row1Payload = transformRowToPayload(parsed.data[0]!, mapping);
      expect(row1Payload.name).toBe("Scheme Alpha");
      expect(row1Payload.description).toContain("with, commas, and \"quotes\"");
      expect(row1Payload.description).toContain("multiple lines.");
      expect(row1Payload.ministry).toBe("Ministry of Agriculture");
      expect(row1Payload.level).toBe("Central");
      expect(row1Payload.required_documents).toEqual(["Aadhaar", "Land Documents", "Bank Documents"]);
      expect(row1Payload.apply_url).toBe("https://pmkisan.gov.in");
      expect(row1Payload.application_video_url).toBe("https://youtu.be/dQw4w9WgXcQ");
      expect(row1Payload.video_type).toBe("youtube");

      const row2Payload = transformRowToPayload(parsed.data[1]!, mapping);
      expect(row2Payload.name).toBe("Scheme Beta");
      expect(row2Payload.level).toBe("State");
      expect(row2Payload.state).toBe("Maharashtra");
      expect(row2Payload.category).toBe("Women");
      expect(row2Payload.required_documents).toEqual(["Aadhaar", "Income Certificate", "Residence Certificate"]);
      expect(row2Payload.eligibility.min_age).toBe(21);
      expect(row2Payload.eligibility.max_age).toBe(50);
      expect(row2Payload.eligibility.max_income).toBe(250000);
    });

    it("reads Excel worksheets correctly without mixing columns", async () => {
      const XLSX = await import("xlsx");
      const headers = [
        "Scheme Name",
        "Description",
        "Department",
        "Official Website URL",
        "Required Documents",
      ];
      const data = [
        headers,
        ["Excel Scheme 1", "Desc 1", "Dept 1", "https://scheme1.gov.in", "Aadhaar; PAN"],
        ["Excel Scheme 2", "Desc 2", "Dept 2", "https://scheme2.gov.in", "Bank Documents, Land Documents"],
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

      // Read it back
      const readWb = XLSX.read(buffer, { type: "array" });
      const readWs = readWb.Sheets[readWb.SheetNames[0]!];
      const readRows = XLSX.utils.sheet_to_json<string[]>(readWs!, { header: 1 });
      const fileHeaders = (readRows[0] || []).map((h) => String(h).trim());
      const fileData = XLSX.utils.sheet_to_json<Record<string, any>>(readWs!, {
        defval: "",
        raw: false,
      });

      expect(fileHeaders).toEqual(headers);
      expect(fileData.length).toBe(2);

      const mapping = autoMapHeaders(fileHeaders);
      const payload1 = transformRowToPayload(fileData[0]!, mapping);
      expect(payload1.name).toBe("Excel Scheme 1");
      expect(payload1.description).toBe("Desc 1");
      expect(payload1.ministry).toBe("Dept 1");
      expect(payload1.apply_url).toBe("https://scheme1.gov.in");
      expect(payload1.required_documents).toEqual(["Aadhaar", "PAN"]);

      const payload2 = transformRowToPayload(fileData[1]!, mapping);
      expect(payload2.name).toBe("Excel Scheme 2");
      expect(payload2.description).toBe("Desc 2");
      expect(payload2.ministry).toBe("Dept 2");
      expect(payload2.apply_url).toBe("https://scheme2.gov.in");
      expect(payload2.required_documents).toEqual(["Bank Documents", "Land Documents"]);
    });

    it("correctly extracts data from sample_schemes_test.csv with padded headers", async () => {
      const Papa = (await import("papaparse")).default;
      const fs = await import("fs");
      const path = await import("path");
      const csvPath = path.resolve(process.cwd(), "sample_schemes_test.csv");
      const csvContent = fs.readFileSync(csvPath, "utf-8");

      const parsed = Papa.parse<Record<string, any>>(csvContent.replace(/^\uFEFF/, ""), {
        header: true,
        skipEmptyLines: "greedy",
      });

      expect(parsed.data.length).toBe(3);
      const headers = (parsed.meta.fields || []).map((h) => h.trim());
      const mapping = autoMapHeaders(headers);

      // Verify Scheme Name and apply_url are auto-mapped
      expect(mapping["Scheme_Name"]).toBe("name");
      expect(mapping["Official Website URL"]).toBe("apply_url");

      // Verify every row extracts data properly without being empty
      const payload1 = transformRowToPayload(parsed.data[0]!, mapping);
      expect(payload1.name).toBe("Solar Rooftop Subsidy Scheme");
      expect(payload1.description).toContain("Rooftop solar installation subsidy");
      expect(payload1.ministry).toBe("Ministry of New and Renewable Energy");
      expect(payload1.apply_url).toBe("https://solarrooftop.gov.in");
      expect(payload1.required_documents.length).toBeGreaterThan(0);

      const payload2 = transformRowToPayload(parsed.data[1]!, mapping);
      expect(payload2.name).toBe("Maharashtra Krishi Sanman Yojana");
      expect(payload2.state).toBe("Maharashtra");
      expect(payload2.level).toBe("State");
      expect(payload2.apply_url).toBe("https://krishi.maharashtra.gov.in");

      const payload3 = transformRowToPayload(parsed.data[2]!, mapping);
      expect(payload3.name).toBe("PM Yuva Internship Scheme");
      expect(payload3.apply_url).toBe("https://pminternship.mca.gov.in");
    });
  });

  describe("Acceptance Criteria: Optional Official Website URL and Tutorial Video handling", () => {
    const defaultMapping = {
      "Scheme Name": "name" as const,
      "Official Website URL": "apply_url" as const,
      "Application Tutorial Video": "application_video_url" as const,
      Description: "description" as const,
      Department: "ministry" as const,
    };

    it("1. A scheme with an official website URL and a YouTube tutorial link uploads and validates successfully", () => {
      const row = {
        "Scheme Name": "Scheme With Both Links",
        "Official Website URL": "https://service.gov.in",
        "Application Tutorial Video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        Description: "Complete scheme details",
        Department: "Ministry of Social Justice",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      expect(payload.name).toBe("Scheme With Both Links");
      expect(payload.apply_url).toBe("https://service.gov.in");
      expect(payload.application_video_url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(payload.video_type).toBe("youtube");

      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("2. A scheme without an official website URL uploads and validates successfully", () => {
      const row = {
        "Scheme Name": "Scheme Without Official URL",
        "Official Website URL": "",
        "Application Tutorial Video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        Description: "No website available yet",
        Department: "Department of Agriculture",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      expect(payload.name).toBe("Scheme Without Official URL");
      expect(payload.apply_url).toBe("");
      expect(payload.application_video_url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(payload.video_type).toBe("youtube");

      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("3. A scheme without an application tutorial video uploads and validates successfully", () => {
      const row = {
        "Scheme Name": "Scheme Without Tutorial Video",
        "Official Website URL": "https://portal.gov.in",
        "Application Tutorial Video": "",
        Description: "No tutorial video available",
        Department: "Ministry of Education",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      expect(payload.name).toBe("Scheme Without Tutorial Video");
      expect(payload.apply_url).toBe("https://portal.gov.in");
      expect(payload.application_video_url).toBeNull();
      expect(payload.video_type).toBeNull();

      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("4. A scheme without either link (no website URL and no tutorial video) uploads and validates successfully", () => {
      const row = {
        "Scheme Name": "Scheme Without Either Link",
        "Official Website URL": "",
        "Application Tutorial Video": "",
        Description: "Neither link provided",
        Department: "Ministry of Rural Development",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      expect(payload.name).toBe("Scheme Without Either Link");
      expect(payload.apply_url).toBe("");
      expect(payload.application_video_url).toBeNull();
      expect(payload.video_type).toBeNull();

      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("5. Treats whitespace-only values as missing values without failing validation", () => {
      const row = {
        "Scheme Name": "Scheme With Whitespace Links",
        "Official Website URL": "   ",
        "Application Tutorial Video": "     \t  \n  ",
        Description: "Whitespace in URL fields",
        Department: "Ministry of Power",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      expect(payload.name).toBe("Scheme With Whitespace Links");
      expect(payload.apply_url).toBe("");
      expect(payload.application_video_url).toBeNull();
      expect(payload.video_type).toBeNull();

      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("valid");
      expect(result.errors).toHaveLength(0);
    });

    it("6. Continues validating URL format when an official website URL is provided", () => {
      const row = {
        "Scheme Name": "Scheme With Bad URL",
        "Official Website URL": "invalid_url_not_a_domain",
        "Application Tutorial Video": "",
      };
      const payload = transformRowToPayload(row, defaultMapping);
      const result = validateRowPayload(payload, row, 0, []);
      expect(result.status).toBe("invalid");
      expect(result.errors).toContain("Invalid Official Website URL (e.g. https://example.gov.in)");
    });
  });
});
