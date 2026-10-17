import { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Video,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  FileText,
  Copy,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import type { Scheme } from "@/lib/matching";
import {
  TARGET_FIELDS,
  TargetFieldKey,
  autoMapHeaders,
  transformRowToPayload,
  validateRowPayload,
  ParsedRowResult,
  downloadSchemeTemplate,
  getRowValue,
} from "@/lib/scheme-bulk-import";

type DuplicateHandlingMode = "skip" | "update" | "new";

export function BulkUpload({ existingSchemes }: { existingSchemes: Scheme[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "mapping" | "preview" | "importing" | "results">("select");
  
  // File data
  const [fileName, setFileName] = useState("");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  
  // Mapping configuration: header -> target field key or __ignore__
  const [columnMapping, setColumnMapping] = useState<Record<string, TargetFieldKey | "__ignore__">>({});
  
  // Rows state for preview
  const [rows, setRows] = useState<ParsedRowResult[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandlingMode>("skip");
  const [filterTab, setFilterTab] = useState<"all" | "valid" | "duplicate" | "invalid">("all");
  
  // Import tracking
  const [currentImportName, setCurrentImportName] = useState("");
  const [stats, setStats] = useState({ success: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
  const [failureDetails, setFailureDetails] = useState<{ name: string; error: string }[]>([]);
  const [progress, setProgress] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => {
    setStep("select");
    setFileName("");
    setFileHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setRows([]);
    setProgress(0);
    setFailureDetails([]);
    setStats({ success: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  // Re-evaluates rows based on current column mapping
  const recomputeRows = (
    currentRawRows: Record<string, any>[],
    currentMapping: Record<string, TargetFieldKey | "__ignore__">,
    mode: DuplicateHandlingMode
  ) => {
    const computed = currentRawRows.map((raw, idx) => {
      const payload = transformRowToPayload(raw, currentMapping);
      const res = validateRowPayload(payload, raw, idx, existingSchemes);
      // Set skip based on duplicate handling
      if (res.status === "duplicate" && mode === "skip") {
        res.skip = true;
      }
      return res;
    });
    setRows(computed);
  };

  // Helper to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof file.text === "function") {
        file.text().then(resolve).catch(reject);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file, "UTF-8");
      }
    });
  };

  // Handle uploaded file
  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      let headers: string[] = [];
      let parsedData: Record<string, any>[] = [];

      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      const isExcel = /\.xlsx?$/i.test(file.name) || file.type.includes("spreadsheet");

      if (isCsv) {
        const rawText = await readFileAsText(file);
        const cleanText = rawText.replace(/^\uFEFF/, "");
        if (!cleanText.trim()) throw new Error("The uploaded CSV file is empty");

        // Parse with PapaParse
        let results = Papa.parse<Record<string, any>>(cleanText, {
          header: true,
          skipEmptyLines: "greedy",
          dynamicTyping: false,
        });

        // Delimiter fallback: if single field or semicolon separated
        if (
          (!results.meta.fields || results.meta.fields.length <= 1) &&
          cleanText.includes(";")
        ) {
          results = Papa.parse<Record<string, any>>(cleanText, {
            header: true,
            skipEmptyLines: "greedy",
            delimiter: ";",
            dynamicTyping: false,
          });
        }

        // If PapaParse returned 0 fields or failed, fallback to XLSX parser
        if (!results.meta.fields || results.meta.fields.length === 0 || !results.data || results.data.length === 0) {
          const wb = XLSX.read(cleanText, { type: "string" });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) throw new Error("Could not parse CSV content");
          const ws = wb.Sheets[sheetName];
          const sheetAoa = XLSX.utils.sheet_to_json<string[]>(ws!, { header: 1, blankrows: false });
          if (!sheetAoa.length) throw new Error("The uploaded file has no content");
          headers = (sheetAoa[0] || []).map((h) => String(h ?? "").replace(/^\uFEFF/, "").trim()).filter(Boolean);
          parsedData = XLSX.utils.sheet_to_json<Record<string, any>>(ws!, { defval: "", raw: false });
        } else {
          headers = (results.meta.fields || []).map((h) => String(h).replace(/^\uFEFF/, "").trim()).filter(Boolean);
          parsedData = results.data;
        }

        // Clean each row's keys so they are trimmed without BOM
        parsedData = parsedData
          .map((row) => {
            const cleanRow: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              const cleanK = String(k).replace(/^\uFEFF/, "").trim();
              if (cleanK) {
                cleanRow[cleanK] = v;
              }
            }
            return cleanRow;
          })
          .filter((row) => Object.values(row).some((val) => String(val ?? "").trim().length > 0));

      } else if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("The uploaded Excel workbook contains no sheets");
        const ws = wb.Sheets[sheetName];
        if (!ws) throw new Error("Cannot read first sheet in Excel file");

        const sheetAoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false });
        if (!sheetAoa.length) throw new Error("The selected Excel sheet is empty");

        headers = (sheetAoa[0] || []).map((h) => String(h ?? "").replace(/^\uFEFF/, "").trim()).filter(Boolean);
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        });

        parsedData = rawJson
          .map((row) => {
            const cleanRow: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              const cleanK = String(k).replace(/^\uFEFF/, "").trim();
              if (cleanK) {
                cleanRow[cleanK] = v;
              }
            }
            return cleanRow;
          })
          .filter((row) => Object.values(row).some((val) => String(val ?? "").trim().length > 0));
      } else {
        throw new Error("Unsupported format. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.");
      }

      if (!parsedData.length) {
        throw new Error("No data rows found in the uploaded file.");
      }

      setFileName(file.name);
      setFileHeaders(headers);
      setRawRows(parsedData);

      // Auto-detect mappings based on column headers
      const initialMapping = autoMapHeaders(headers);
      setColumnMapping(initialMapping);

      // Compute preview rows
      recomputeRows(parsedData, initialMapping, duplicateHandling);

      // Navigate to mapping adjustment step
      setStep("mapping");
      toast.success(`Loaded ${parsedData.length} rows with ${headers.length} columns from ${file.name}`);
    } catch (err: any) {
      console.error("File parse error:", err);
      toast.error(err.message || "Failed to parse file. Please check file formatting.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  // Change individual column mapping
  const setMappingForHeader = (header: string, targetKey: TargetFieldKey | "__ignore__") => {
    const updated = { ...columnMapping, [header]: targetKey };
    setColumnMapping(updated);
    recomputeRows(rawRows, updated, duplicateHandling);
  };

  // Reset to auto-detected mappings
  const handleResetMapping = () => {
    const auto = autoMapHeaders(fileHeaders);
    setColumnMapping(auto);
    recomputeRows(rawRows, auto, duplicateHandling);
    toast.info("Reset column mappings to auto-detected defaults");
  };

  // Duplicate handling change
  const handleDuplicateHandlingChange = (mode: DuplicateHandlingMode) => {
    setDuplicateHandling(mode);
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "duplicate") {
          return { ...r, skip: mode === "skip" };
        }
        return r;
      })
    );
  };

  // Sample values preview for each header
  const sampleValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of fileHeaders) {
      const samples: string[] = [];
      for (const row of rawRows) {
        const val = getRowValue(row, h);
        if (val !== undefined && val !== null && String(val).trim().length > 0) {
          const s = String(val).trim();
          if (!samples.includes(s)) {
            samples.push(s.length > 40 ? s.slice(0, 37) + "…" : s);
          }
        }
        if (samples.length >= 2) break;
      }
      map[h] = samples;
    }
    return map;
  }, [fileHeaders, rawRows]);

  // Check required mappings
  const mappedTargets = useMemo(() => new Set(Object.values(columnMapping)), [columnMapping]);
  const hasNameMapped = mappedTargets.has("name");
  const hasUrlMapped = mappedTargets.has("apply_url");
  const canProceedToPreview = hasNameMapped && hasUrlMapped;

  // Inline row edits in preview
  const updateRowField = (id: string, field: "name" | "apply_url", val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newPayload = { ...r.payload, [field]: val };
        const updated = validateRowPayload(newPayload, r.rawRow, r.originalRowIndex, existingSchemes);
        return { ...updated, id: r.id, skip: r.skip };
      })
    );
  };

  const toggleSkip = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, skip: !r.skip } : r)));
  };

  const toggleSelectAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, skip: !checked })));
  };

  // Summary counts
  const validCount = rows.filter((r) => r.status === "valid").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const willImportCount = rows.filter((r) => !r.skip && r.status !== "invalid").length;

  // Filtered rows for preview
  const filteredRows = useMemo(() => {
    if (filterTab === "valid") return rows.filter((r) => r.status === "valid");
    if (filterTab === "duplicate") return rows.filter((r) => r.status === "duplicate");
    if (filterTab === "invalid") return rows.filter((r) => r.status === "invalid");
    return rows;
  }, [rows, filterTab]);

  // Execute database import
  const startImport = async () => {
    setStep("importing");
    const toProcess = rows.filter((r) => !r.skip && r.status !== "invalid");
    const s = {
      success: 0,
      updated: 0,
      skipped: rows.length - toProcess.length,
      failed: 0,
      total: rows.length,
    };
    const fails: { name: string; error: string }[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      const r = toProcess[i]!;
      const payload = r.payload;
      setCurrentImportName(payload.name);

      const isUpdate = r.status === "duplicate" && duplicateHandling === "update" && r.existingScheme?.id;

      try {
        if (isUpdate && r.existingScheme) {
          let res = await supabase.from("schemes").update(payload as any).eq("id", r.existingScheme.id);
          // Fallback if application_video_url column is not in PostgREST cache
          if (res.error && res.error.message?.includes("application_video_url")) {
            const { application_video_url, video_type, ...fallback } = payload;
            res = await supabase.from("schemes").update(fallback as any).eq("id", r.existingScheme.id);
          }
          if (res.error) throw res.error;
          s.updated++;
        } else {
          let res = await supabase.from("schemes").insert(payload as any);
          // Fallback if application_video_url column is not in PostgREST cache
          if (res.error && res.error.message?.includes("application_video_url")) {
            const { application_video_url, video_type, ...fallback } = payload;
            res = await supabase.from("schemes").insert(fallback as any);
          }
          if (res.error) throw res.error;
          s.success++;
        }
      } catch (err: any) {
        console.error("Import row failed:", err);
        s.failed++;
        fails.push({ name: payload.name || `Row ${r.originalRowIndex + 1}`, error: err.message || "Database insert error" });
      }

      setProgress(Math.round(((i + 1) / toProcess.length) * 100));
    }

    qc.invalidateQueries({ queryKey: ["schemes"] });
    setStats(s);
    setFailureDetails(fails);
    setStep("results");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Bulk Upload Schemes
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Scheme Upload & Column Mapping
            </DialogTitle>
            {step !== "select" && step !== "importing" && step !== "results" && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    step === "mapping"
                      ? "font-semibold text-primary bg-primary/10 border border-primary/20"
                      : "hover:text-foreground hover:bg-muted"
                  }`}
                >
                  1. Column Mapping
                </button>
                <span>→</span>
                <button
                  type="button"
                  disabled={!canProceedToPreview}
                  onClick={() => setStep("preview")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    step === "preview"
                      ? "font-semibold text-primary bg-primary/10 border border-primary/20"
                      : canProceedToPreview
                      ? "hover:text-foreground hover:bg-muted"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  2. Preview & Validate
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* STEP 1: SELECT FILE */}
        {step === "select" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="w-full max-w-2xl border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center bg-accent/30 hover:bg-accent/60 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Drag and drop your CSV or Excel file here</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Supports .csv, .xlsx, and .xls files. Column headers will be automatically mapped to scheme database fields.
              </p>
              <Button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                Select File from Computer
              </Button>
              <input
                type="file"
                ref={fileRef}
                className="hidden"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={onInputChange}
              />
            </div>

            {/* Template Download & Info Box */}
            <div className="mt-8 w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-card border">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-left text-xs">
                  <p className="font-semibold text-foreground">Need standard headers template?</p>
                  <p className="text-muted-foreground">Download a ready-to-use template with sample schemes.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => downloadSchemeTemplate("xlsx")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Excel Template (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadSchemeTemplate("csv")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & ADJUST COLUMN MAPPING */}
        {step === "mapping" && (
          <div className="flex-1 flex flex-col min-h-0 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Review Column Header Mapping
                </h3>
                <p className="text-xs text-muted-foreground">
                  File: <span className="font-medium text-foreground">{fileName}</span> ({rawRows.length} rows, {fileHeaders.length} columns)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleResetMapping} title="Auto-detect all columns again">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Auto-Map
                </Button>
                <Button variant="outline" size="sm" onClick={reset}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!canProceedToPreview}
                  onClick={() => setStep("preview")}
                  className="gap-1.5"
                >
                  Preview Data ({rawRows.length} schemes)
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Validation alerts if required fields are missing */}
            {(!hasNameMapped || !hasUrlMapped) && (
              <div className="mb-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <b>Required columns missing:</b>{" "}
                  {[!hasNameMapped && "Scheme Name", !hasUrlMapped && "Official Website URL"].filter(Boolean).join(" and ")} must be mapped to proceed.
                </span>
              </div>
            )}

            {/* Column Mapping Table */}
            <div className="flex-1 overflow-auto rounded-md border bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted sticky top-0 z-10 text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-2.5 w-[28%]">Uploaded File Column</th>
                    <th className="p-2.5 w-[32%]">Sample Values in File</th>
                    <th className="p-2.5 w-[40%]">Maps to Scheme Database Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fileHeaders.map((header) => {
                    const mappedKey = columnMapping[header] || "__ignore__";
                    const isMapped = mappedKey !== "__ignore__";
                    const isRequired = mappedKey === "name" || mappedKey === "apply_url";
                    const samples = sampleValuesMap[header] || [];

                    return (
                      <tr key={header} className="hover:bg-accent/40 transition-colors">
                        <td className="p-2.5 font-medium">
                          <span className="inline-block px-2 py-0.5 rounded bg-muted border font-mono text-[11px] max-w-[240px] truncate" title={header}>
                            {header}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground text-[11px]">
                          {samples.length > 0 ? (
                            <div className="flex flex-col gap-0.5 max-w-[280px]">
                              {samples.map((s, idx) => (
                                <span key={idx} className="truncate bg-muted/40 px-1 rounded text-foreground/80">
                                  "{s}"
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/60">(empty column)</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <Select
                              value={mappedKey}
                              onValueChange={(val) => setMappingForHeader(header, val as TargetFieldKey | "__ignore__")}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Select destination field..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="__ignore__" className="text-muted-foreground">
                                  — Do Not Import (Skip Column) —
                                </SelectItem>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-primary">Required Fields</SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.required).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      ★ {f.label} (Required)
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">Scheme Details</SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.group === "core" && !f.required).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">Application & Video</SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.group === "process" && !f.required).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">Eligibility Rules</SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.group === "eligibility_rule").map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>

                            {isMapped && (
                              <span
                                className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  isRequired
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                                }`}
                              >
                                <Check className="h-3 w-3 mr-0.5" />
                                {isRequired ? "Required" : "Mapped"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground border-t mt-2">
              <span>
                Tip: You can change mappings anytime. If an uploaded column isn't mapped, it won't be imported.
              </span>
              <Button
                disabled={!canProceedToPreview}
                onClick={() => setStep("preview")}
                className="gap-1.5"
              >
                Continue to Preview →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & VALIDATION */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col min-h-0 pt-1">
            {/* Control & Summary Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-2 border-b">
              {/* Summary Stats */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    filterTab === "all" ? "bg-primary text-primary-foreground font-semibold" : "bg-card hover:bg-muted"
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("valid")}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    filterTab === "valid" ? "bg-green-600 text-white font-semibold" : "bg-card text-green-700 dark:text-green-300 hover:bg-muted"
                  }`}
                >
                  Valid ({validCount})
                </button>
                {duplicateCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("duplicate")}
                    className={`px-2.5 py-1 rounded-md border transition-colors ${
                      filterTab === "duplicate" ? "bg-amber-600 text-white font-semibold" : "bg-card text-amber-700 dark:text-amber-300 hover:bg-muted"
                    }`}
                  >
                    Duplicates ({duplicateCount})
                  </button>
                )}
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("invalid")}
                    className={`px-2.5 py-1 rounded-md border transition-colors ${
                      filterTab === "invalid" ? "bg-destructive text-destructive-foreground font-semibold" : "bg-card text-destructive hover:bg-muted"
                    }`}
                  >
                    Errors ({invalidCount})
                  </button>
                )}
              </div>

              {/* Duplicate Handling selector & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs bg-muted/50 p-1 rounded-md border">
                  <span className="text-muted-foreground font-medium pl-1">Duplicates:</span>
                  <Select
                    value={duplicateHandling}
                    onValueChange={(val) => handleDuplicateHandlingChange(val as DuplicateHandlingMode)}
                  >
                    <SelectTrigger className="h-7 text-xs w-[180px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip duplicates (Safe)</SelectItem>
                      <SelectItem value="update">Update existing schemes</SelectItem>
                      <SelectItem value="new">Import as new copies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm" onClick={() => setStep("mapping")}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Adjust Mapping
                </Button>

                <Button
                  size="sm"
                  disabled={willImportCount === 0}
                  onClick={startImport}
                  className="gap-1.5 font-semibold"
                >
                  Import {willImportCount} Schemes
                </Button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto rounded-md border bg-card text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted sticky top-0 z-10 text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="p-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r) => !r.skip)}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        title="Select/Deselect all"
                      />
                    </th>
                    <th className="p-2 w-24">Status</th>
                    <th className="p-2 min-w-[220px]">Scheme Name</th>
                    <th className="p-2 min-w-[130px]">Category & Level</th>
                    <th className="p-2 min-w-[160px]">Department</th>
                    <th className="p-2 min-w-[150px]">Required Documents</th>
                    <th className="p-2 min-w-[150px]">Eligibility</th>
                    <th className="p-2 min-w-[180px]">Official Website URL</th>
                    <th className="p-2 min-w-[110px]">Video Guide</th>
                    <th className="p-2 min-w-[160px]">Notes / Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRows.map((r) => {
                    const hasNameError = r.errors.some((e) => e.includes("Name"));
                    const hasUrlError = r.errors.some((e) => e.includes("URL"));

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-accent/30 transition-colors ${
                          r.skip ? "opacity-50 bg-muted/20" : r.status === "invalid" ? "bg-red-500/5" : ""
                        }`}
                      >
                        {/* Skip checkbox */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={!r.skip}
                            onChange={() => toggleSkip(r.id)}
                            title={r.skip ? "Include this row" : "Skip this row"}
                          />
                        </td>

                        {/* Status Badge */}
                        <td className="p-2 whitespace-nowrap">
                          {r.status === "valid" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
                              Valid
                            </span>
                          ) : r.status === "duplicate" ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              title={`Matches existing scheme: "${r.existingScheme?.name}"`}
                            >
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                              Invalid
                            </span>
                          )}
                        </td>

                        {/* Name (editable if error) */}
                        <td className="p-2">
                          <Input
                            value={r.payload.name}
                            onChange={(e) => updateRowField(r.id, "name", e.target.value)}
                            placeholder="Scheme Name (Required)"
                            className={`h-7 text-xs ${hasNameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          />
                        </td>

                        {/* Category & Level */}
                        <td className="p-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{r.payload.category}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {r.payload.level} {r.payload.state ? `· ${r.payload.state}` : ""}
                            </span>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="p-2 text-muted-foreground text-[11px] truncate max-w-[180px]" title={r.payload.ministry}>
                          {r.payload.ministry || "—"}
                        </td>

                        {/* Required Documents */}
                        <td className="p-2">
                          {r.payload.required_documents.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {r.payload.required_documents.slice(0, 3).map((doc, idx) => (
                                <span key={idx} className="px-1.5 py-0.2 rounded bg-muted text-[10px] border">
                                  {doc}
                                </span>
                              ))}
                              {r.payload.required_documents.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{r.payload.required_documents.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">None listed</span>
                          )}
                        </td>

                        {/* Eligibility Criteria */}
                        <td className="p-2 text-[11px] text-muted-foreground max-w-[180px] truncate" title={r.payload.eligibility_text}>
                          {r.payload.eligibility_text || "—"}
                        </td>

                        {/* Official Website URL (editable if error) */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Input
                              value={r.payload.apply_url}
                              onChange={(e) => updateRowField(r.id, "apply_url", e.target.value)}
                              placeholder="https://..."
                              className={`h-7 text-xs ${hasUrlError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                            {r.payload.apply_url && !hasUrlError && (
                              <a
                                href={r.payload.apply_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:text-primary/80 shrink-0 p-1"
                                title="Open URL in new tab"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Video */}
                        <td className="p-2 whitespace-nowrap">
                          {r.payload.application_video_url ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                              title={r.payload.application_video_url}
                            >
                              <Video className="h-3 w-3" />
                              {r.payload.video_type === "youtube" ? "YouTube" : "Video"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Errors & Warnings */}
                        <td className="p-2">
                          {r.errors.length > 0 ? (
                            <span className="text-destructive font-medium text-[11px]">
                              {r.errors.join(", ")}
                            </span>
                          ) : r.status === "duplicate" ? (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                              Existing scheme in database
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 text-[11px]">
                              Ready to import
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t mt-2 text-xs">
              <span className="text-muted-foreground">
                Showing {filteredRows.length} of {rows.length} schemes
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("mapping")}>
                  ← Back to Column Mapping
                </Button>
                <Button
                  size="sm"
                  disabled={willImportCount === 0}
                  onClick={startImport}
                  className="gap-1 font-semibold"
                >
                  Import {willImportCount} Valid Schemes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORTING PROGRESS */}
        {step === "importing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-6" />
            <h3 className="text-lg font-bold mb-1">Importing Schemes to Database...</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md truncate">
              {currentImportName ? `Processing "${currentImportName}"` : "Saving scheme records..."}
            </p>
            <div className="w-full max-w-md space-y-2">
              <Progress value={progress} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: RESULTS */}
        {step === "results" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold mb-1">Import Process Finished</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Database has been updated and schemes are now reflected across the dashboard.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl mb-6">
              <div className="p-3 border rounded-lg bg-card text-center">
                <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                <p className="text-xs text-muted-foreground font-medium">Schemes Added</p>
              </div>
              <div className="p-3 border rounded-lg bg-card text-center">
                <p className="text-2xl font-bold text-primary">{stats.updated}</p>
                <p className="text-xs text-muted-foreground font-medium">Updated</p>
              </div>
              <div className="p-3 border rounded-lg bg-card text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.skipped}</p>
                <p className="text-xs text-muted-foreground font-medium">Skipped</p>
              </div>
              <div className="p-3 border rounded-lg bg-card text-center">
                <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                <p className="text-xs text-muted-foreground font-medium">Failed</p>
              </div>
            </div>

            {/* List failures if any */}
            {failureDetails.length > 0 && (
              <div className="w-full max-w-xl mb-6 text-left p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs">
                <p className="font-semibold text-destructive mb-1">Failed to import {failureDetails.length} schemes:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground max-h-32 overflow-auto">
                  {failureDetails.map((f, i) => (
                    <li key={i}>
                      <b>{f.name}:</b> {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={() => setOpen(false)} className="px-8 font-semibold">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
