import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { splitIntoPoints, isPointWise } from "@/lib/point-helpers";
import { PointWiseList } from "@/components/PointWiseList";

describe("point-helpers utility tests", () => {
  describe("isPointWise", () => {
    it("identifies newline-separated text as point-wise", () => {
      expect(isPointWise("Point 1\nPoint 2")).toBe(true);
      expect(isPointWise("Single line without points")).toBe(false);
    });

    it("identifies bullet characters as point-wise", () => {
      expect(isPointWise("• Subsidy up to 40%")).toBe(true);
      expect(isPointWise("- First item\n- Second item")).toBe(true);
      expect(isPointWise("* Special grant")).toBe(true);
    });

    it("identifies numbered lists as point-wise", () => {
      expect(isPointWise("1. First point\n2. Second point")).toBe(true);
      expect(isPointWise("1) Option A\n2) Option B")).toBe(true);
    });

    it("identifies semicolon-separated items as point-wise", () => {
      expect(isPointWise("Subsidy up to 50%; Free training; Tool kit")).toBe(true);
      expect(isPointWise("Just a single sentence with no semicolons")).toBe(false);
    });

    it("returns false for null, undefined, or empty strings", () => {
      expect(isPointWise(null)).toBe(false);
      expect(isPointWise(undefined)).toBe(false);
      expect(isPointWise("   ")).toBe(false);
    });
  });

  describe("splitIntoPoints", () => {
    it("splits newline-separated lines cleanly", () => {
      const input = "Line 1: Direct financial grant\nLine 2: Free medical checkup\nLine 3: Travel allowance";
      expect(splitIntoPoints(input)).toEqual([
        "Line 1: Direct financial grant",
        "Line 2: Free medical checkup",
        "Line 3: Travel allowance",
      ]);
    });

    it("splits bulleted lists and strips leading bullet markers", () => {
      const input = "• Direct income support of ₹6,000 per year\n• Paid in 3 instalments\n• Aadhaar DBT linked";
      expect(splitIntoPoints(input)).toEqual([
        "Direct income support of ₹6,000 per year",
        "Paid in 3 instalments",
        "Aadhaar DBT linked",
      ]);
    });

    it("splits dash and asterisk bullet points", () => {
      const input = "- 50% subsidy on solar rooftop\n- Free net meter\n* 5 years free maintenance";
      expect(splitIntoPoints(input)).toEqual([
        "50% subsidy on solar rooftop",
        "Free net meter",
        "5 years free maintenance",
      ]);
    });

    it("splits inline bullets in single line text", () => {
      const input = "• 50% subsidy • Free installation • Comprehensive warranty";
      expect(splitIntoPoints(input)).toEqual([
        "50% subsidy",
        "Free installation",
        "Comprehensive warranty",
      ]);
    });

    it("splits numbered items in text", () => {
      const input = "1. Register on portal\n2. Complete Aadhaar e-KYC\n3. Upload bank documents";
      expect(splitIntoPoints(input)).toEqual([
        "Register on portal",
        "Complete Aadhaar e-KYC",
        "Upload bank documents",
      ]);
    });

    it("splits semicolon-separated points", () => {
      const input = "Cashless health insurance; Free generic medicines; Diagnostic support";
      expect(splitIntoPoints(input)).toEqual([
        "Cashless health insurance",
        "Free generic medicines",
        "Diagnostic support",
      ]);
    });

    it("does not split numbers with decimals like 2.5 Lakh or ₹6,000.50", () => {
      const input = "Income ceiling of 2.5 Lakh per year with ₹6,000.50 assistance";
      expect(splitIntoPoints(input)).toEqual([
        "Income ceiling of 2.5 Lakh per year with ₹6,000.50 assistance",
      ]);
    });

    it("preserves single continuous paragraphs as 1 point", () => {
      const input = "Direct income support of ₹6,000 per year in three equal installments to all landholding farmer families across the country.";
      expect(splitIntoPoints(input)).toEqual([input]);
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(splitIntoPoints(null)).toEqual([]);
      expect(splitIntoPoints(undefined)).toEqual([]);
      expect(splitIntoPoints("")).toEqual([]);
      expect(splitIntoPoints("   ")).toEqual([]);
    });
  });
});

describe("PointWiseList Component", () => {
  it("renders multiple points as a bulleted list", () => {
    const text = "• Monthly pension of ₹1,000\n• Free bus travel passes\n• Free health checkup";
    const { container } = render(<PointWiseList text={text} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
    expect(screen.getByText("Monthly pension of ₹1,000")).toBeInTheDocument();
    expect(screen.getByText("Free bus travel passes")).toBeInTheDocument();
    expect(screen.getByText("Free health checkup")).toBeInTheDocument();
    expect(container.querySelector("ul")).not.toBeNull();
  });

  it("renders check icons when icon='check' is specified", () => {
    const text = "• Point A\n• Point B";
    const { container } = render(<PointWiseList text={text} icon="check" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders single plain paragraph when text has only 1 non-bullet statement", () => {
    const text = "A single continuous description of the scheme without any bullets.";
    const { container } = render(<PointWiseList text={text} />);

    expect(container.querySelector("ul")).toBeNull();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders inline span when inlineIfSingle is true and text has only 1 point", () => {
    const text = "Subsidy up to 40%";
    const { container } = render(<PointWiseList text={text} inlineIfSingle />);

    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("respects maxItems and indicates remaining count", () => {
    const text = "• Benefit 1\n• Benefit 2\n• Benefit 3\n• Benefit 4";
    render(<PointWiseList text={text} maxItems={2} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Benefit 1")).toBeInTheDocument();
    expect(screen.getByText("Benefit 2")).toBeInTheDocument();
    expect(screen.queryByText("Benefit 3")).toBeNull();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
