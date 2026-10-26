/**
 * Point Helpers
 * Utilities for detecting, splitting, and rendering point-wise text
 * (descriptions, benefits, eligibility notes) from uploaded data and user input.
 */

/**
 * Checks whether a given text contains point-wise formatting
 * (e.g. bullets, newlines, numbered lists, semicolons).
 */
export function isPointWise(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (!str) return false;

  // Has newlines with multiple non-empty lines
  if (str.includes("\n")) {
    const lines = str.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return true;
  }

  // Starts with or contains bullet symbols: •, ▪, ▫, ✦, ✔, ✓
  if (/[•▪▫✦✔✓]/.test(str)) return true;

  // Starts with dash/asterisk/arrow bullet: e.g. "- item" or "* item"
  if (/^\s*[-*–—>]\s+/m.test(str)) return true;

  // Starts with or contains numbered list items: e.g. "1. " or "1) "
  if (/^\s*(?:\d+[\.\)]|\(\d+\))\s+/m.test(str)) return true;

  // Contains multiple semicolon-separated items
  if (str.includes(";")) {
    const parts = str.split(";").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return true;
  }

  // Contains multiple sentence-like criteria separated by full stop
  if (/(?<!\b(?:e\.g|i\.e|dr|mr|mrs|ms|st|prof)\b)(?<=[^\d\s])\.\s+(?=[A-Za-z0-9₹"'])/i.test(str)) {
    const parts = str
      .split(/(?<!\b(?:e\.g|i\.e|dr|mr|mrs|ms|st|prof)\b)(?<=[^\d\s])\.\s+(?=[A-Za-z0-9₹"'])/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) return true;
  }

  return false;
}

/**
 * Splits text into a clean list of individual points,
 * stripping leading bullet characters and numbers while preserving content.
 */
export function splitIntoPoints(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  // If already an array, flatten and recursively process
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitIntoPoints(item));
  }

  const str = String(value).trim();
  if (!str) return [];

  // Normalize line breaks
  const normalized = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  let rawSegments: string[] = [];

  if (normalized.includes("\n")) {
    // 1. Text contains multiple lines
    const lines = normalized.split(/\n+/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if line itself contains multiple inline bullet points like "• Item 1 • Item 2"
      if (
        /[•▪▫✦]/.test(trimmedLine) &&
        trimmedLine.indexOf("•") !== trimmedLine.lastIndexOf("•")
      ) {
        const subItems = trimmedLine
          .split(/[•▪▫✦]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        rawSegments.push(...subItems);
      } else if (trimmedLine.includes(";")) {
        const subItems = trimmedLine
          .split(/;+/)
          .map((s) => s.trim())
          .filter(Boolean);
        rawSegments.push(...subItems);
      } else {
        rawSegments.push(trimmedLine);
      }
    }
  } else if (/[•▪▫✦]/.test(normalized)) {
    // 2. Single line with bullet symbols (e.g. "• Benefit 1 • Benefit 2")
    rawSegments = normalized
      .split(/[•▪▫✦]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (/^\s*[-*–—>]\s+/m.test(normalized)) {
    // 3. Single or multi-line starting with dash or asterisk
    rawSegments = normalized
      .split(/(?<=\s|^)[-*–—>]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (/(?<=\s|^)(?:\d+[\.\)]|\(\d+\))\s+(?=[A-Za-z0-9₹"'])/.test(normalized)) {
    // 4. Numbered points in text: e.g. "1. Point one 2. Point two"
    rawSegments = normalized
      .split(/(?<=\s|^)(?:\d+[\.\)]|\(\d+\))\s+(?=[A-Za-z0-9₹"'])/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (normalized.includes(";")) {
    // 5. Semicolon-separated list: e.g. "Subsidy up to 40%; Free meter; 5yr warranty"
    const parts = normalized
      .split(/;+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      rawSegments = parts;
    } else {
      rawSegments = [normalized];
    }
  } else if (/(?<!\b(?:e\.g|i\.e|dr|mr|mrs|ms|st|prof)\b)(?<=[^\d\s])\.\s+(?=[A-Za-z0-9₹"'])/i.test(normalized)) {
    // 6. Period-separated criteria e.g. "Criteria 1. Criteria 2. Criteria 3."
    const parts = normalized
      .split(/(?<!\b(?:e\.g|i\.e|dr|mr|mrs|ms|st|prof)\b)(?<=[^\d\s])\.\s+(?=[A-Za-z0-9₹"'])/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      rawSegments = parts;
    } else {
      rawSegments = [normalized];
    }
  } else {
    // 7. Plain single paragraph / sentence
    rawSegments = [normalized];
  }

  // Clean each segment
  const cleaned: string[] = [];
  for (const seg of rawSegments) {
    let item = seg
      .replace(/^["']|["']$/g, "") // strip outer quotes
      .replace(/^\s*(?:[•\-*▪▫–—✦✔✓>]|\d+[\.\)]|\(\d+\))\s*/, "") // strip leading bullet or list number
      .trim();

    // Strip trailing semicolon or dangling comma at end of point
    item = item.replace(/[;,]+$/, "").trim();

    // Strip trailing period if there were multiple segments or leading bullet was stripped
    if (rawSegments.length > 1) {
      item = item.replace(/\.+$/, "").trim();
    }

    if (item.length > 0) {
      cleaned.push(item);
    }
  }

  return cleaned.length > 0 ? cleaned : [str];
}
