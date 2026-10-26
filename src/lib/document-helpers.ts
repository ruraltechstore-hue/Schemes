/**
 * Document Helpers
 * Utilities for formatting, splitting, and handling required documents
 * across government schemes.
 */

/**
 * Splits and formats a list of required documents for display or matching.
 * Handles strings or arrays of strings, splitting wherever a full stop (.),
 * comma, semicolon, newline, carriage return, or pipe separates two documents.
 *
 * Requirements:
 * - Read Required Documents field from CSV/Excel or existing database array.
 * - Split the document list wherever a full stop (.) separates two documents.
 * - Display each document as a separate bullet point or list item in the scheme details page.
 * - Trim unnecessary spaces and remove empty items.
 * - Preserve original document names and their order.
 * - Support both bulk-uploaded and manually created schemes.
 * - Handle existing scheme records as well as newly uploaded schemes.
 * - Keep original database data intact; format for display.
 */
export function splitRequiredDocuments(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  const rawStrings: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        rawStrings.push(item);
      } else if (item != null) {
        rawStrings.push(String(item));
      }
    }
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // Handle JSON string array e.g. ["Aadhaar", "PAN"]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return splitRequiredDocuments(parsed);
        }
      } catch {
        // Fallback to normal string processing
      }
    }
    rawStrings.push(trimmed);
  } else {
    rawStrings.push(String(value));
  }

  const results: string[] = [];
  const seen = new Set<string>();

  for (const rawStr of rawStrings) {
    if (!rawStr || typeof rawStr !== "string") continue;

    // Split on:
    // 1. Commas, semicolons, newlines, pipes, bullets: [,;\n\r|•▪▫✦✔✓]+
    // 2. Numbered items: (?<=\s|^)(?:\d+[\.\)]|\(\d+\))\s+(?=[A-Za-z0-9])
    // 3. Full stops (.) separating documents:
    //    - Preceded by a non-digit / non-whitespace character (not e.g. list numbering "1.")
    //    - Not preceded by common honorifics (dr, mr, etc.)
    //    - Followed by whitespace, end of string, or the next document start
    const segments = rawStr
      .split(/(?:[,;\n\r|•▪▫✦✔✓]+|(?<!\b(?:dr|mr|mrs|ms|st|prof)\b)(?<=[^\d\s])\s*\.+(?:\s+|$|\s*(?=[A-Za-z0-9]))|(?<=\s|^)(?:\d+[\.\)]|\(\d+\))\s+(?=[A-Za-z0-9]))/i)
      .map((seg) => {
        return seg
          .replace(/^["']|["']$/g, "") // strip outer quotes
          .replace(/^\s*(?:[\*\-•▪▫✦✔✓>]+|(?:\d+[\.\)]|\(\d+\)))\s*/, "") // strip leading list markers or numbering
          .replace(/\s*\.+\s*$/, "") // strip any trailing period
          .trim();
      })
      .filter((seg) => seg.length > 0);

    for (const seg of segments) {
      const key = seg.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(seg);
      }
    }
  }

  return results;
}
