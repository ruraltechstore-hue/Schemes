import { useState, useRef, useMemo, useEffect } from "react";
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
  Plus,
  Trash2,
  Files,
  X,
  FileCheck,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  ParsedFileData,
  parseBulkFile,
  downloadSchemeTemplate,
  getRowValue,
  splitIntoPoints,
  normalizeHeader,
} from "@/lib/scheme-bulk-import";

type DuplicateHandlingMode = "skip" | "update" | "new";

export function BulkUpload({
  existingSchemes,
  onUploadComplete,
}: {
  existingSchemes: Scheme[];
  onUploadComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "mapping" | "preview" | "importing" | "results">(
    "select",
  );

  // Multi-file state
  const [uploadedFiles, setUploadedFiles] = useState<ParsedFileData[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [isParsingFiles, setIsParsingFiles] = useState<boolean>(false);

  // Rows state for preview
  const [rows, setRows] = useState<ParsedRowResult[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandlingMode>("skip");
  const [filterTab, setFilterTab] = useState<"all" | "valid" | "duplicate" | "invalid">("all");
  const [fileFilter, setFileFilter] = useState<string>("all");

  // Import tracking
  const [currentImportName, setCurrentImportName] = useState("");
  const [currentImportFile, setCurrentImportFile] = useState("");
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [totalImportCount, setTotalImportCount] = useState(0);
  const [stats, setStats] = useState({ success: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
  const [perFileStats, setPerFileStats] = useState<
    { name: string; success: number; updated: number; skipped: number; failed: number }[]
  >([]);
  const [failureDetails, setFailureDetails] = useState<
    { name: string; error: string; file?: string | undefined }[]
  >([]);
  const [progress, setProgress] = useState(0);

  // Results step state (resizable, collapsible top panel & schemes list)
  const [importedSchemes, setImportedSchemes] = useState<
    {
      row: ParsedRowResult;
      status: "added" | "updated" | "failed" | "skipped";
      error?: string;
    }[]
  >([]);
  const [topPanelHeight, setTopPanelHeight] = useState<number>(200);
  const [isTopPanelCollapsed, setIsTopPanelCollapsed] = useState<boolean>(false);
  const [resultsSearch, setResultsSearch] = useState<string>("");
  const [resultsFilterStatus, setResultsFilterStatus] = useState<
    "all" | "added" | "updated" | "skipped" | "failed"
  >("all");
  const [resultsViewMode, setResultsViewMode] = useState<"cards" | "rows">("cards");
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(200);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = topPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = moveEvent.clientY - dragStartYRef.current;
      const newHeight = Math.min(Math.max(100, dragStartHeightRef.current + delta), 420);
      setTopPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleTouchStartResize = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = true;
    dragStartYRef.current = touch.clientY;
    dragStartHeightRef.current = topPanelHeight;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const t = moveEvent.touches[0];
      if (!t) return;
      const delta = t.clientY - dragStartYRef.current;
      const newHeight = Math.min(Math.max(100, dragStartHeightRef.current + delta), 420);
      setTopPanelHeight(newHeight);
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
  };

  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Active file being configured in column mapping step
  const activeFile = useMemo(() => {
    return uploadedFiles.find((f) => f.id === activeFileId) || uploadedFiles[0] || null;
  }, [uploadedFiles, activeFileId]);

  const fileName = activeFile?.name || "";
  const fileHeaders = useMemo(() => activeFile?.headers || [], [activeFile]);
  const rawRows = useMemo(() => activeFile?.rawRows || [], [activeFile]);
  const columnMapping = useMemo(() => activeFile?.columnMapping || {}, [activeFile]);

  const totalSchemesCount = useMemo(() => {
    return uploadedFiles.reduce((acc, f) => acc + f.rawRows.length, 0);
  }, [uploadedFiles]);

  const reset = () => {
    setStep("select");
    setUploadedFiles([]);
    setActiveFileId("");
    setRows([]);
    setProgress(0);
    setFailureDetails([]);
    setPerFileStats([]);
    setImportedSchemes([]);
    setIsTopPanelCollapsed(false);
    setResultsSearch("");
    setResultsFilterStatus("all");
    setCurrentImportFile("");
    setCurrentImportName("");
    setCurrentImportIndex(0);
    setTotalImportCount(0);
    setStats({ success: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
    setFileFilter("all");
    setFilterTab("all");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Re-evaluates rows across all uploaded files
  const recomputeAllRows = (fileList: ParsedFileData[], mode: DuplicateHandlingMode) => {
    const allResults: ParsedRowResult[] = [];
    const seenSchemeNames = new Map<string, string>(); // name.toLowerCase() -> sourceFileName

    fileList.forEach((f) => {
      f.rawRows.forEach((raw, idx) => {
        const payload = transformRowToPayload(raw, f.columnMapping);
        const res = validateRowPayload(payload, raw, idx, existingSchemes);
        res.sourceFileId = f.id;
        res.sourceFileName = f.name;

        const normName = payload.name?.trim().toLowerCase();
        if (normName) {
          if (seenSchemeNames.has(normName)) {
            const firstSeenFile = seenSchemeNames.get(normName);
            if (res.status === "valid") {
              res.status = "duplicate";
              res.warnings.push(
                firstSeenFile === f.name
                  ? "Duplicate scheme name within this file"
                  : `Duplicate of scheme in "${firstSeenFile}"`,
              );
            }
          } else {
            seenSchemeNames.set(normName, f.name);
          }
        }

        if (res.status === "duplicate" && mode === "skip") {
          res.skip = true;
        }

        allResults.push(res);
      });
    });

    setRows(allResults);
  };

  // Handle uploaded file(s) - supports one or multiple files
  const handleFiles = async (filesToAdd: FileList | File[] | null | undefined) => {
    if (!filesToAdd || filesToAdd.length === 0) return;
    const fileArray = Array.from(filesToAdd);
    setIsParsingFiles(true);

    try {
      const results = await Promise.allSettled(fileArray.map((f) => parseBulkFile(f)));
      const successful: ParsedFileData[] = [];
      const errors: string[] = [];

      results.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          successful.push(res.value);
        } else {
          errors.push(res.reason?.message || `Failed to parse ${fileArray[idx]?.name}`);
        }
      });

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }

      if (successful.length > 0) {
        setUploadedFiles((prev) => {
          const next = [...prev, ...successful];
          recomputeAllRows(next, duplicateHandling);
          return next;
        });

        // Activate the newly uploaded file tab so user can review and adjust its column mappings
        if (successful[0]) {
          setActiveFileId(successful[0].id);
        }

        const totalAddedRows = successful.reduce((sum, f) => sum + f.rawRows.length, 0);
        const firstSuccess = successful[0];
        if (successful.length === 1 && firstSuccess) {
          toast.success(
            `Loaded ${firstSuccess.rawRows.length} rows with ${firstSuccess.headers.length} columns from ${firstSuccess.name}`,
          );
        } else {
          toast.success(
            `Loaded ${successful.length} bulk data files with ${totalAddedRows} total schemes!`,
          );
        }

        setStep("mapping");
      }
    } catch (err: unknown) {
      console.error("Bulk upload processing error:", err);
      const message = err instanceof Error ? err.message : "Failed to process bulk data files";
      toast.error(message);
    } finally {
      setIsParsingFiles(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // Change individual column mapping for active file
  const setMappingForHeader = (header: string, targetKey: TargetFieldKey | "__ignore__") => {
    if (!activeFile) return;
    const updatedMapping = { ...activeFile.columnMapping, [header]: targetKey };
    const updatedFiles = uploadedFiles.map((f) =>
      f.id === activeFile.id ? { ...f, columnMapping: updatedMapping } : f,
    );
    setUploadedFiles(updatedFiles);
    recomputeAllRows(updatedFiles, duplicateHandling);
  };

  // Reset active file to auto-detected mappings
  const handleResetMapping = () => {
    if (!activeFile) return;
    const auto = autoMapHeaders(activeFile.headers);
    const updatedFiles = uploadedFiles.map((f) =>
      f.id === activeFile.id ? { ...f, columnMapping: auto } : f,
    );
    setUploadedFiles(updatedFiles);
    recomputeAllRows(updatedFiles, duplicateHandling);
    toast.info(`Reset column mappings to auto-detected defaults for ${activeFile.name}`);
  };

  // Copy mapping of active file to other files where headers match
  const handleApplyMappingToAll = () => {
    if (!activeFile) return;
    let affectedCount = 0;
    const updatedFiles = uploadedFiles.map((f) => {
      if (f.id === activeFile.id) return f;
      const newMap = { ...f.columnMapping };
      let updated = false;

      f.headers.forEach((h) => {
        const normH = normalizeHeader(h);
        for (const [ah, mapped] of Object.entries(activeFile.columnMapping)) {
          if (
            mapped !== "__ignore__" &&
            (ah.toLowerCase() === h.toLowerCase() || normalizeHeader(ah) === normH)
          ) {
            if (newMap[h] !== mapped) {
              newMap[h] = mapped;
              updated = true;
            }
          }
        }
      });

      if (updated) affectedCount++;
      return { ...f, columnMapping: newMap };
    });

    setUploadedFiles(updatedFiles);
    recomputeAllRows(updatedFiles, duplicateHandling);
    toast.success(`Applied matching mappings across ${affectedCount} other bulk file(s)`);
  };

  // Remove an uploaded file
  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = uploadedFiles.find((f) => f.id === fileId);
    const remaining = uploadedFiles.filter((f) => f.id !== fileId);
    if (remaining.length === 0) {
      reset();
      toast.info("All files removed");
      return;
    }
    setUploadedFiles(remaining);
    const firstRemaining = remaining[0];
    if (activeFileId === fileId && firstRemaining) {
      setActiveFileId(firstRemaining.id);
    }
    recomputeAllRows(remaining, duplicateHandling);
    toast.info(`Removed ${fileToRemove?.name || "file"}`);
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
      }),
    );
  };

  // Sample values preview for each header in active file
  const sampleValuesMap = useMemo(() => {
    if (!activeFile) return {};
    const map: Record<string, string[]> = {};
    for (const h of activeFile.headers) {
      const samples: string[] = [];
      for (const row of activeFile.rawRows) {
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
  }, [activeFile]);

  // Check required mappings across all uploaded files
  const filesMissingName = useMemo(() => {
    return uploadedFiles.filter((f) => {
      const mapped = new Set(Object.values(f.columnMapping));
      return !mapped.has("name");
    });
  }, [uploadedFiles]);

  const mappedTargets = useMemo(() => {
    return new Set(Object.values(columnMapping));
  }, [columnMapping]);

  const hasNameMapped = mappedTargets.has("name");
  const canProceedToPreview = uploadedFiles.length > 0 && filesMissingName.length === 0;

  // Inline row edits in preview
  const updateRowField = (id: string, field: "name" | "apply_url", val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newPayload = { ...r.payload, [field]: val };
        const updated = validateRowPayload(
          newPayload,
          r.rawRow,
          r.originalRowIndex,
          existingSchemes,
        );
        return {
          ...updated,
          id: r.id,
          skip: r.skip,
          sourceFileId: r.sourceFileId,
          sourceFileName: r.sourceFileName,
        };
      }),
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
    let list = rows;
    if (fileFilter !== "all") {
      list = list.filter((r) => r.sourceFileId === fileFilter);
    }
    if (filterTab === "valid") return list.filter((r) => r.status === "valid");
    if (filterTab === "duplicate") return list.filter((r) => r.status === "duplicate");
    if (filterTab === "invalid") return list.filter((r) => r.status === "invalid");
    return list;
  }, [rows, filterTab, fileFilter]);

  // Execute database import
  const startImport = async () => {
    setStep("importing");
    const toProcess = rows.filter((r) => !r.skip && r.status !== "invalid");
    setTotalImportCount(toProcess.length);
    setCurrentImportIndex(0);
    const s = {
      success: 0,
      updated: 0,
      skipped: rows.length - toProcess.length,
      failed: 0,
      total: rows.length,
    };
    const fails: { name: string; error: string; file?: string }[] = [];
    const fileStatsMap: Record<
      string,
      { name: string; success: number; updated: number; skipped: number; failed: number }
    > = {};

    uploadedFiles.forEach((f) => {
      fileStatsMap[f.id] = { name: f.name, success: 0, updated: 0, skipped: 0, failed: 0 };
    });

    const resultsList: {
      row: ParsedRowResult;
      status: "added" | "updated" | "failed" | "skipped";
      error?: string;
    }[] = [];

    // Count skipped for each file and record in results list
    rows.forEach((r) => {
      if (r.skip || r.status === "invalid") {
        const fid = r.sourceFileId;
        if (fid && fileStatsMap[fid]) {
          fileStatsMap[fid].skipped++;
        }
        resultsList.push({
          row: r,
          status: "skipped",
          error: r.status === "invalid" ? r.errors.join(", ") : "Skipped by user",
        });
      }
    });

    for (let i = 0; i < toProcess.length; i++) {
      const r = toProcess[i]!;
      const payload = r.payload;
      setCurrentImportIndex(i + 1);
      setCurrentImportName(payload.name);
      setCurrentImportFile(r.sourceFileName || "");

      const isUpdate =
        r.status === "duplicate" && duplicateHandling === "update" && r.existingScheme?.id;
      const fid = r.sourceFileId;

      try {
        if (isUpdate && r.existingScheme) {
          let res = await supabase
            .from("schemes")
            .update(payload as never)
            .eq("id", r.existingScheme.id);
          // Fallback if application_video_url column is not in PostgREST cache
          if (res.error && res.error.message?.includes("application_video_url")) {
            const { application_video_url, video_type, ...fallback } = payload;
            res = await supabase
              .from("schemes")
              .update(fallback as never)
              .eq("id", r.existingScheme.id);
          }
          if (res.error) throw res.error;
          s.updated++;
          if (fid && fileStatsMap[fid]) fileStatsMap[fid].updated++;
          resultsList.push({ row: r, status: "updated" });
        } else {
          let res = await supabase.from("schemes").insert(payload as never);
          // Fallback if application_video_url column is not in PostgREST cache
          if (res.error && res.error.message?.includes("application_video_url")) {
            const { application_video_url, video_type, ...fallback } = payload;
            res = await supabase.from("schemes").insert(fallback as never);
          }
          if (res.error) throw res.error;
          s.success++;
          if (fid && fileStatsMap[fid]) fileStatsMap[fid].success++;
          resultsList.push({ row: r, status: "added" });
        }
      } catch (err: unknown) {
        console.error("Import row failed:", err);
        s.failed++;
        if (fid && fileStatsMap[fid]) fileStatsMap[fid].failed++;
        const rowErrMessage =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : "Database insert error";
        fails.push({
          name: payload.name || `Row ${r.originalRowIndex + 1}`,
          error: rowErrMessage,
          ...(r.sourceFileName ? { file: r.sourceFileName } : {}),
        });
        resultsList.push({ row: r, status: "failed", error: rowErrMessage });
      }

      setProgress(Math.round(((i + 1) / toProcess.length) * 100));
    }

    await qc.invalidateQueries({ queryKey: ["schemes"] });
    await qc.refetchQueries({ queryKey: ["schemes"] });
    onUploadComplete?.();
    setStats(s);
    setPerFileStats(Object.values(fileStatsMap));
    setFailureDetails(fails);
    setImportedSchemes(resultsList);
    setStep("results");
  };

  const displaySchemesList = useMemo(() => {
    const baseList: {
      row: ParsedRowResult;
      status: "added" | "updated" | "failed" | "skipped";
      error?: string;
    }[] =
      importedSchemes.length > 0
        ? importedSchemes
        : rows.map((r) => ({
            row: r,
            status: (r.skip || r.status === "invalid" ? "skipped" : "added") as
              "added" | "updated" | "failed" | "skipped",
          }));

    return baseList.filter((item) => {
      if (resultsFilterStatus !== "all" && item.status !== resultsFilterStatus) return false;
      if (!resultsSearch.trim()) return true;
      const q = resultsSearch.toLowerCase();
      const p = item.row.payload;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.ministry?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.benefits?.toLowerCase().includes(q) ||
        item.row.sourceFileName?.toLowerCase().includes(q)
      );
    });
  }, [importedSchemes, rows, resultsFilterStatus, resultsSearch]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          reset();
          qc.invalidateQueries({ queryKey: ["schemes"] });
          qc.refetchQueries({ queryKey: ["schemes"] });
          onUploadComplete?.();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Bulk Upload Schemes
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] max-h-[90vh] flex flex-col p-4 sm:p-5 overflow-hidden gap-0">
        {/* Hidden persistent file input accessible across all dialog steps */}
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          multiple
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={onInputChange}
        />

        <DialogHeader className="pb-2.5 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
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

        {/* STEP 1: SELECT FILE(S) */}
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
              <h3 className="text-lg font-semibold mb-1">
                Drag and drop your CSV or Excel file here
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-2">
                Supports uploading <b>multiple bulk data files</b> (.csv, .xlsx, .xls) at once.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mb-6">
                You can select or drag multiple files together. Column headers will be automatically
                mapped to scheme database fields.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={isParsingFiles}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                >
                  {isParsingFiles ? "Parsing Bulk Data..." : "Select Bulk Files from Computer"}
                </Button>
              </div>
            </div>

            {/* Template Download & Info Box */}
            <div className="mt-8 w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-card border">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-left text-xs">
                  <p className="font-semibold text-foreground">Need standard headers template?</p>
                  <p className="text-muted-foreground">
                    Download a ready-to-use template with sample schemes.
                  </p>
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
          <div
            className="flex-1 flex flex-col min-h-0 pt-1.5 overflow-y-auto overflow-x-hidden pr-1.5 scroll-smooth [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_hsl(var(--muted)/0.2)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/60"
            data-testid="mapping-scroll-container"
          >
            {/* Multi-file switcher tabs (if multiple files or option to add more) */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 mb-2 bg-muted/40 rounded-lg border text-xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Files className="h-3.5 w-3.5 text-primary" />
                  Bulk Files ({uploadedFiles.length}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {uploadedFiles.map((f, i) => {
                    const isActive = f.id === activeFile?.id;
                    const hasName = new Set(Object.values(f.columnMapping)).has("name");
                    return (
                      <div
                        key={f.id}
                        onClick={() => setActiveFileId(f.id)}
                        className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card text-foreground hover:bg-accent border-muted-foreground/20"
                        }`}
                        data-testid={`file-tab-${i}`}
                      >
                        <FileSpreadsheet
                          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`}
                        />
                        <span className="max-w-[130px] truncate" title={f.name}>
                          {f.name}
                        </span>
                        <span
                          className={`text-[10px] px-1 rounded ${
                            isActive
                              ? "bg-white/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {f.rawRows.length}
                        </span>
                        {hasName ? (
                          <Check
                            className={`h-3 w-3 ${isActive ? "text-primary-foreground" : "text-green-600"}`}
                          />
                        ) : (
                          <span
                            title="Missing Scheme Name mapping"
                            className="inline-flex items-center"
                          >
                            <AlertCircle
                              className={`h-3 w-3 ${isActive ? "text-amber-300" : "text-amber-500"}`}
                            />
                          </span>
                        )}
                        {uploadedFiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(f.id);
                            }}
                            className={`p-0.5 rounded hover:bg-black/20 ${
                              isActive
                                ? "text-primary-foreground"
                                : "text-muted-foreground hover:text-destructive"
                            }`}
                            title={`Remove ${f.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isParsingFiles}
                  onClick={() => fileRef.current?.click()}
                  className="h-7 text-xs gap-1 border-dashed"
                >
                  <Plus className="h-3 w-3" /> {isParsingFiles ? "Adding..." : "Add More Files"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b shrink-0">
              <div>
                <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Review Column Header Mapping
                </h3>
                <p className="text-xs text-muted-foreground">
                  File: <span className="font-medium text-foreground">{fileName}</span> (
                  {rawRows.length} rows, {fileHeaders.length} columns)
                  {uploadedFiles.length > 1 && (
                    <span className="ml-2 font-medium text-primary">
                      · Total: {totalSchemesCount} schemes across {uploadedFiles.length} files
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {uploadedFiles.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyMappingToAll}
                    title="Apply matching column mappings to all other files"
                    className="h-8 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Mapping to All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetMapping}
                  title="Auto-detect all columns again"
                  className="h-8 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Auto-Map
                </Button>
                <Button variant="outline" size="sm" onClick={reset} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!canProceedToPreview}
                  onClick={() => setStep("preview")}
                  className="gap-1.5 h-8 text-xs"
                >
                  Preview Data ({totalSchemesCount} schemes)
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Validation alerts if required fields are missing */}
            {!hasNameMapped && (
              <div className="mb-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <b>Required column missing:</b> Scheme Name must be mapped in <b>{fileName}</b> to
                  proceed.
                </span>
              </div>
            )}

            {hasNameMapped && filesMissingName.length > 0 && (
              <div className="mb-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <b>Other file missing mapping:</b> Please select{" "}
                  <b>{filesMissingName[0]?.name}</b> and map Scheme Name to proceed.
                </span>
              </div>
            )}

            {/* Column Mapping Table */}
            <div
              className="flex-1 min-h-[380px] overflow-y-auto overflow-x-auto rounded-md border bg-card shadow-inner focus:outline-none"
              data-testid="column-mapping-table-container"
            >
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-20 text-muted-foreground font-semibold border-b shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 w-[26%] text-xs">Uploaded File Column</th>
                    <th className="py-2.5 px-3 w-[34%] text-xs">Sample Values in File</th>
                    <th className="py-2.5 px-3 w-[40%] text-xs">Maps to Scheme Database Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fileHeaders.map((header) => {
                    const mappedKey = columnMapping[header] || "__ignore__";
                    const isMapped = mappedKey !== "__ignore__";
                    const isRequired = mappedKey === "name";
                    const samples = sampleValuesMap[header] || [];

                    return (
                      <tr key={header} className="hover:bg-accent/40 transition-colors">
                        <td className="py-2 px-3 font-medium align-middle">
                          <span
                            className="inline-block px-2 py-0.5 rounded bg-muted border font-mono text-[11px] max-w-[220px] truncate"
                            title={header}
                          >
                            {header}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-[11px] align-middle">
                          {samples.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap max-w-[340px]">
                              {samples.slice(0, 2).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="truncate bg-muted/60 px-1.5 py-0.5 rounded text-[11px] text-foreground/80 max-w-[155px] border border-muted-foreground/10"
                                  title={s}
                                >
                                  "{s}"
                                </span>
                              ))}
                              {samples.length > 2 && (
                                <span
                                  className="text-[10px] text-muted-foreground font-medium px-1 bg-muted/40 rounded"
                                  title={samples.slice(2).join(", ")}
                                >
                                  +{samples.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/60 text-[11px]">
                              (empty column)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Select
                              value={mappedKey}
                              onValueChange={(val) =>
                                setMappingForHeader(header, val as TargetFieldKey | "__ignore__")
                              }
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Select destination field..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="__ignore__" className="text-muted-foreground">
                                  — Do Not Import (Skip Column) —
                                </SelectItem>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-primary">
                                    Required Fields
                                  </SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.required).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      ★ {f.label} (Required)
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">
                                    Scheme Details
                                  </SelectLabel>
                                  {TARGET_FIELDS.filter(
                                    (f) => f.group === "core" && !f.required,
                                  ).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">
                                    Application & Video
                                  </SelectLabel>
                                  {TARGET_FIELDS.filter(
                                    (f) => f.group === "process" && !f.required,
                                  ).map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel className="text-xs font-bold text-foreground">
                                    Eligibility Rules
                                  </SelectLabel>
                                  {TARGET_FIELDS.filter((f) => f.group === "eligibility_rule").map(
                                    (f) => (
                                      <SelectItem key={f.key} value={f.key}>
                                        {f.label}
                                      </SelectItem>
                                    ),
                                  )}
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

            {/* Mapping Footer Controls */}
            <div className="flex items-center justify-between pt-2 pb-0.5 text-xs text-muted-foreground border-t mt-2 shrink-0">
              <span className="hidden sm:inline">
                Tip: You can switch files above to review and adjust each file's column mapping
                before previewing.
              </span>
              <Button
                disabled={!canProceedToPreview}
                onClick={() => setStep("preview")}
                className="gap-1.5 ml-auto h-8 text-xs"
              >
                Continue to Preview →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & VALIDATION */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col min-h-0 pt-1 overflow-hidden">
            {/* Control & Summary Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-2 border-b">
              {/* Summary Stats */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    filterTab === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("valid")}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    filterTab === "valid"
                      ? "bg-green-600 text-white font-semibold"
                      : "bg-card text-green-700 dark:text-green-300 hover:bg-muted"
                  }`}
                >
                  Valid ({validCount})
                </button>
                {duplicateCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("duplicate")}
                    className={`px-2.5 py-1 rounded-md border transition-colors ${
                      filterTab === "duplicate"
                        ? "bg-amber-600 text-white font-semibold"
                        : "bg-card text-amber-700 dark:text-amber-300 hover:bg-muted"
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
                      filterTab === "invalid"
                        ? "bg-destructive text-destructive-foreground font-semibold"
                        : "bg-card text-destructive hover:bg-muted"
                    }`}
                  >
                    Errors ({invalidCount})
                  </button>
                )}
              </div>

              {/* Source File Filter & Duplicate Handling selector & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {uploadedFiles.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs bg-muted/50 p-1 rounded-md border">
                    <span className="text-muted-foreground font-medium pl-1">File:</span>
                    <Select value={fileFilter} onValueChange={setFileFilter}>
                      <SelectTrigger className="h-7 text-xs w-[180px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Files ({rows.length})</SelectItem>
                        {uploadedFiles.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} ({f.rawRows.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs bg-muted/50 p-1 rounded-md border">
                  <span className="text-muted-foreground font-medium pl-1">Duplicates:</span>
                  <Select
                    value={duplicateHandling}
                    onValueChange={(val) =>
                      handleDuplicateHandlingChange(val as DuplicateHandlingMode)
                    }
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

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isParsingFiles}
                  onClick={() => fileRef.current?.click()}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> {isParsingFiles ? "Adding..." : "Add File"}
                </Button>

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
            <div className="flex-1 min-h-[380px] overflow-auto rounded-md border bg-card text-xs shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/95 backdrop-blur-sm sticky top-0 z-10 text-muted-foreground border-b font-semibold shadow-sm">
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
                    {uploadedFiles.length > 1 && <th className="p-2 min-w-[140px]">Source File</th>}
                    <th className="p-2 min-w-[220px]">Scheme Name</th>
                    <th className="p-2 min-w-[130px]">Category & Level</th>
                    <th className="p-2 min-w-[160px]">Department</th>
                    <th className="p-2 min-w-[150px]">Required Documents</th>
                    <th className="p-2 min-w-[170px]">Benefits</th>
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
                          r.skip
                            ? "opacity-50 bg-muted/20"
                            : r.status === "invalid"
                              ? "bg-red-500/5"
                              : ""
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
                              title={
                                r.warnings.find((w) => w.includes("Duplicate")) ||
                                `Matches existing scheme: "${r.existingScheme?.name}"`
                              }
                            >
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                              Invalid
                            </span>
                          )}
                        </td>

                        {/* Source File Badge (if multi-file) */}
                        {uploadedFiles.length > 1 && (
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted border font-mono text-muted-foreground max-w-[130px] truncate"
                              title={r.sourceFileName}
                            >
                              <FileSpreadsheet className="h-3 w-3 text-primary shrink-0" />
                              <span className="truncate">{r.sourceFileName}</span>
                            </span>
                          </td>
                        )}

                        {/* Name (editable if error) */}
                        <td className="p-2">
                          <Input
                            value={r.payload.name}
                            onChange={(e) => updateRowField(r.id, "name", e.target.value)}
                            placeholder="Scheme Name (Required)"
                            className={`h-7 text-xs ${hasNameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          />
                          {r.payload.description && (
                            <p
                              className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5"
                              title={r.payload.description}
                            >
                              {r.payload.description}
                            </p>
                          )}
                        </td>

                        {/* Category & Level */}
                        <td className="p-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">
                              {r.payload.category}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {r.payload.level} {r.payload.state ? `· ${r.payload.state}` : ""}
                            </span>
                          </div>
                        </td>

                        {/* Department */}
                        <td
                          className="p-2 text-muted-foreground text-[11px] truncate max-w-[180px]"
                          title={r.payload.ministry}
                        >
                          {r.payload.ministry || "—"}
                        </td>

                        {/* Required Documents (Point-wise) */}
                        <td className="p-2 text-[11px] text-muted-foreground max-w-[190px]">
                          {r.payload.required_documents.length > 0 ? (
                            <div
                              className="flex flex-col gap-0.5"
                              title={r.payload.required_documents.join(", ")}
                            >
                              {r.payload.required_documents.slice(0, 3).map((doc, idx) => (
                                <div key={idx} className="truncate flex items-center gap-1">
                                  <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                  <span className="truncate">{doc}</span>
                                </div>
                              ))}
                              {r.payload.required_documents.length > 3 && (
                                <span className="text-[10px] text-primary">
                                  +{r.payload.required_documents.length - 3} more documents
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-[11px]">
                              None listed
                            </span>
                          )}
                        </td>

                        {/* Benefits (Point-wise) */}
                        <td className="p-2 text-[11px] text-muted-foreground max-w-[190px]">
                          {r.payload.benefits ? (
                            <div className="flex flex-col gap-0.5" title={r.payload.benefits}>
                              {splitIntoPoints(r.payload.benefits)
                                .slice(0, 2)
                                .map((b, idx) => (
                                  <div key={idx} className="truncate flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                    <span className="truncate">{b}</span>
                                  </div>
                                ))}
                              {splitIntoPoints(r.payload.benefits).length > 2 && (
                                <span className="text-[10px] text-primary">
                                  +{splitIntoPoints(r.payload.benefits).length - 2} more points
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-[11px]">
                              None listed
                            </span>
                          )}
                        </td>

                        {/* Eligibility Criteria (Point-wise) */}
                        <td className="p-2 text-[11px] text-muted-foreground max-w-[190px]">
                          {r.payload.eligibility_text ? (
                            <div
                              className="flex flex-col gap-0.5"
                              title={r.payload.eligibility_text}
                            >
                              {splitIntoPoints(r.payload.eligibility_text)
                                .slice(0, 2)
                                .map((e, idx) => (
                                  <div key={idx} className="truncate flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                    <span className="truncate">{e}</span>
                                  </div>
                                ))}
                              {splitIntoPoints(r.payload.eligibility_text).length > 2 && (
                                <span className="text-[10px] text-primary">
                                  +{splitIntoPoints(r.payload.eligibility_text).length - 2} more
                                  points
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-[11px]">
                              None listed
                            </span>
                          )}
                        </td>

                        {/* Official Website URL (editable if error) */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Input
                              value={r.payload.apply_url}
                              onChange={(e) => updateRowField(r.id, "apply_url", e.target.value)}
                              placeholder="https://... (Optional)"
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
                            <span
                              className="text-muted-foreground/60 text-[11px]"
                              title="No tutorial video provided"
                            >
                              No Video
                            </span>
                          )}
                        </td>

                        {/* Errors & Warnings */}
                        <td className="p-2">
                          {r.errors.length > 0 ? (
                            <span className="text-destructive font-medium text-[11px]">
                              {r.errors.join(", ")}
                            </span>
                          ) : r.warnings.length > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                              {r.warnings.join(", ")}
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
                {uploadedFiles.length > 1 && ` (across ${uploadedFiles.length} files)`}
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
          <div
            className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center"
            data-testid="importing-step-container"
          >
            <div className="h-14 w-14 rounded-full border-4 border-primary border-t-transparent animate-spin mb-5 shadow-xs" />

            <h3 className="text-xl font-bold text-foreground mb-1">
              Importing Schemes to Database...
            </h3>

            {/* Total valid schemes count badge */}
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold my-3 shadow-xs"
              data-testid="importing-schemes-count"
            >
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                Total Valid Schemes: <b>{totalImportCount || willImportCount}</b>
              </span>
              <span className="text-primary/30">•</span>
              <span>
                Uploaded: <b>{currentImportIndex}</b> of <b>{totalImportCount || willImportCount}</b>
              </span>
            </div>

            {/* Current scheme being processed */}
            <p className="text-sm text-muted-foreground mb-6 max-w-lg truncate">
              {currentImportName ? (
                <span>
                  Processing ({currentImportIndex}/{totalImportCount || willImportCount}):{" "}
                  <b className="text-foreground">"{currentImportName}"</b>
                  {currentImportFile && (
                    <span className="text-xs text-primary ml-1.5 font-medium">
                      ({currentImportFile})
                    </span>
                  )}
                </span>
              ) : (
                <span>Saving valid scheme records to database...</span>
              )}
            </p>

            {/* Progress bar with explicit count */}
            <div className="w-full max-w-md space-y-2 bg-card p-4 rounded-xl border shadow-xs">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                <span data-testid="importing-uploaded-count-label">
                  Schemes Uploaded: <b>{currentImportIndex}</b> /{" "}
                  <b>{totalImportCount || willImportCount}</b>
                </span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Valid schemes importing</span>
                <span>
                  {Math.max(0, (totalImportCount || willImportCount) - currentImportIndex)} remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: RESULTS WITH ADJUSTABLE, COLLAPSIBLE TOP PANEL & MULTIPLE SCHEMES LIST */}
        {step === "results" && (
          <div
            className="flex-1 flex flex-col min-h-0 pt-1 overflow-y-auto overflow-x-hidden pr-1.5 scroll-smooth [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_hsl(var(--muted)/0.2)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/60"
            data-testid="results-scroll-container"
          >
            {/* TOP PANEL: Uploaded File Information (Adjustable & Collapsible) */}
            <div
              className="flex flex-col shrink-0 border rounded-lg bg-card overflow-hidden shadow-xs"
              data-testid="uploaded-files-panel"
            >
              {/* Top Panel Header */}
              <div className="flex items-center justify-between p-2.5 bg-muted/60 border-b text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span>Uploaded File Information</span>
                  </div>
                  <Badge variant="outline" className="bg-background text-[11px] font-normal">
                    {uploadedFiles.length} {uploadedFiles.length === 1 ? "file" : "files"}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] hover:bg-primary/20 font-medium">
                    {stats.success + stats.updated} schemes uploaded
                  </Badge>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTopPanelCollapsed(!isTopPanelCollapsed)}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  data-testid="toggle-top-panel-btn"
                  title={
                    isTopPanelCollapsed
                      ? "Expand uploaded files panel"
                      : "Minimize uploaded files panel"
                  }
                >
                  {isTopPanelCollapsed ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 text-primary" />
                      <span className="text-primary font-medium">Expand Panel</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      <span>Minimize Panel</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Collapsed State: Compact Summary */}
              {isTopPanelCollapsed ? (
                <div
                  className="p-2.5 bg-muted/20 text-xs flex flex-wrap items-center justify-between gap-2"
                  data-testid="collapsed-summary-bar"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground font-medium">Files:</span>
                    {(uploadedFiles.length > 0
                      ? uploadedFiles
                      : [{ id: "1", name: fileName || "bulk_schemes.csv", rawRows: [] }]
                    ).map((f, i) => (
                      <span
                        key={f.id || i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border text-[11px]"
                      >
                        <FileCheck className="h-3 w-3 text-primary" />
                        <span className="max-w-[140px] truncate" title={f.name}>
                          {f.name}
                        </span>
                        {f.rawRows?.length > 0 && (
                          <span className="text-muted-foreground">({f.rawRows.length})</span>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-600 font-semibold">{stats.success} added</span>
                    {stats.updated > 0 && (
                      <span className="text-primary font-semibold">{stats.updated} updated</span>
                    )}
                    {stats.skipped > 0 && (
                      <span className="text-amber-600 font-medium">{stats.skipped} skipped</span>
                    )}
                    {stats.failed > 0 && (
                      <span className="text-destructive font-medium">{stats.failed} failed</span>
                    )}
                  </div>
                </div>
              ) : (
                /* Expanded State: Resizable with internal vertical scrollbar */
                <div
                  style={{ height: `${topPanelHeight}px` }}
                  className="overflow-y-auto p-3 space-y-3 focus:outline-none"
                  data-testid="expanded-top-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Import Process Finished</span>
                        <span className="text-muted-foreground ml-1.5 hidden sm:inline">
                          Database updated and schemes are now reflected across the dashboard.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 border rounded-lg bg-card text-center">
                      <p className="text-xl font-bold text-green-600">{stats.success}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Schemes Added</p>
                    </div>
                    <div className="p-2.5 border rounded-lg bg-card text-center">
                      <p className="text-xl font-bold text-primary">{stats.updated}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Updated</p>
                    </div>
                    <div className="p-2.5 border rounded-lg bg-card text-center">
                      <p className="text-xl font-bold text-amber-600">{stats.skipped}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Skipped</p>
                    </div>
                    <div className="p-2.5 border rounded-lg bg-card text-center">
                      <p className="text-xl font-bold text-destructive">{stats.failed}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">Failed</p>
                    </div>
                  </div>

                  {/* Per-file breakdown */}
                  <div className="w-full text-left border rounded-lg overflow-hidden bg-card text-xs">
                    <div className="p-2 bg-muted/60 font-semibold text-foreground border-b flex items-center gap-2">
                      <Files className="h-3.5 w-3.5 text-primary" />
                      <span>Breakdown by Uploaded Bulk File</span>
                    </div>
                    <div className="divide-y max-h-36 overflow-y-auto">
                      {(perFileStats.length > 0
                        ? perFileStats
                        : (uploadedFiles.length > 0
                            ? uploadedFiles
                            : [{ name: fileName || "uploaded_file.csv" }]
                          ).map((f) => ({
                            name: f.name,
                            success: stats.success,
                            updated: stats.updated,
                            skipped: stats.skipped,
                            failed: stats.failed,
                          }))
                      ).map((fs, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium truncate max-w-[240px]" title={fs.name}>
                              {fs.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 text-xs">
                            <span className="text-green-600 font-semibold">{fs.success} added</span>
                            {fs.updated > 0 && (
                              <span className="text-primary font-semibold">
                                {fs.updated} updated
                              </span>
                            )}
                            {fs.skipped > 0 && (
                              <span className="text-amber-600">{fs.skipped} skipped</span>
                            )}
                            {fs.failed > 0 && (
                              <span className="text-destructive font-semibold">
                                {fs.failed} failed
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Failure details if any */}
                  {failureDetails.length > 0 && (
                    <div className="text-left p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 text-xs">
                      <p className="font-semibold text-destructive mb-1">
                        Failed to import {failureDetails.length} schemes:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground max-h-24 overflow-auto">
                        {failureDetails.map((f, i) => (
                          <li key={i}>
                            <b>{f.name}</b> {f.file ? `(${f.file})` : ""}: {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DRAGGABLE RESIZE HANDLE (between top panel and schemes section) */}
            {!isTopPanelCollapsed && (
              <div
                onMouseDown={handleMouseDownResize}
                onTouchStart={handleTouchStartResize}
                className="w-full flex items-center justify-center py-1 cursor-row-resize select-none group shrink-0 my-0.5"
                title="Drag up or down to adjust uploaded files panel height"
                data-testid="results-resize-handle"
              >
                <div className="h-1.5 w-full bg-border rounded-full group-hover:bg-primary/50 transition-colors flex items-center justify-center">
                  <div className="bg-muted-foreground/40 group-hover:bg-primary w-12 h-1 rounded-full flex items-center justify-center">
                    <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>
            )}

            {/* SCHEMES RESULTS SECTION (Multiple scheme cards or rows) */}
            <div
              className="flex-1 min-h-[360px] flex flex-col overflow-hidden border rounded-lg bg-card mt-1 shadow-xs"
              data-testid="schemes-results-section"
            >
              {/* Schemes Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-muted/40 border-b text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Uploaded Schemes Results
                  </h4>
                  <Badge variant="outline" className="bg-background text-[11px] font-semibold">
                    {displaySchemesList.length} schemes
                  </Badge>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search within results */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      data-testid="results-search-input"
                      placeholder="Search schemes..."
                      value={resultsSearch}
                      onChange={(e) => setResultsSearch(e.target.value)}
                      className="h-7 text-xs pl-8 w-[150px] sm:w-[190px] bg-background"
                    />
                  </div>

                  {/* Status filter tabs */}
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded border">
                    <button
                      type="button"
                      data-testid="filter-tab-all"
                      onClick={() => setResultsFilterStatus("all")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        resultsFilterStatus === "all"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All
                    </button>
                    {stats.success > 0 && (
                      <button
                        type="button"
                        data-testid="filter-tab-added"
                        onClick={() => setResultsFilterStatus("added")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          resultsFilterStatus === "added"
                            ? "bg-green-600 text-white shadow-xs"
                            : "text-green-700 dark:text-green-300 hover:bg-muted"
                        }`}
                      >
                        Added ({stats.success})
                      </button>
                    )}
                    {stats.updated > 0 && (
                      <button
                        type="button"
                        data-testid="filter-tab-updated"
                        onClick={() => setResultsFilterStatus("updated")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          resultsFilterStatus === "updated"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-primary hover:bg-muted"
                        }`}
                      >
                        Updated ({stats.updated})
                      </button>
                    )}
                    {(stats.skipped > 0 || stats.failed > 0) && (
                      <button
                        type="button"
                        data-testid="filter-tab-skipped"
                        onClick={() => setResultsFilterStatus("skipped")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          resultsFilterStatus === "skipped"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-amber-700 dark:text-amber-300 hover:bg-muted"
                        }`}
                      >
                        Skipped ({stats.skipped + stats.failed})
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle: Cards vs Rows */}
                  <div className="flex items-center rounded border bg-muted/50 p-0.5">
                    <button
                      type="button"
                      data-testid="view-cards-btn"
                      onClick={() => setResultsViewMode("cards")}
                      className={`p-1 rounded transition-colors ${
                        resultsViewMode === "cards"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Cards View"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid="view-rows-btn"
                      onClick={() => setResultsViewMode("rows")}
                      className={`p-1 rounded transition-colors ${
                        resultsViewMode === "rows"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Rows / Table View"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Schemes Display Area (Multiple cards or rows simultaneously visible) */}
              <div
                className="flex-1 min-h-0 overflow-y-auto p-3 focus:outline-none scroll-smooth [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_hsl(var(--muted)/0.2)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/60"
                data-testid="schemes-results-list"
              >
                {displaySchemesList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-xs">
                    <p className="font-medium text-foreground text-sm mb-1">
                      No schemes match the current filter
                    </p>
                    <p>
                      Try clearing your search term or selecting "All" to view all imported schemes.
                    </p>
                  </div>
                ) : resultsViewMode === "cards" ? (
                  /* CARDS VIEW: Multiple scheme cards in a responsive grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displaySchemesList.map((item, idx) => {
                      const p = item.row.payload;
                      const status = item.status;
                      const isAdded = status === "added";
                      const isUpdated = status === "updated";
                      const isSkipped = status === "skipped";

                      return (
                        <div
                          key={item.row.id || idx}
                          className="rounded-lg border bg-background p-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between text-xs"
                          data-testid={`scheme-result-card-${idx}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold px-1.5 py-0 ${
                                  isAdded
                                    ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                                    : isUpdated
                                      ? "bg-primary/10 text-primary border-primary/30"
                                      : isSkipped
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                        : "bg-destructive/10 text-destructive border-destructive/30"
                                }`}
                              >
                                {isAdded
                                  ? "Added"
                                  : isUpdated
                                    ? "Updated"
                                    : isSkipped
                                      ? "Skipped"
                                      : "Failed"}
                              </Badge>

                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1 py-0 font-normal"
                                >
                                  {p.level || "Central"}
                                  {p.state ? ` · ${p.state}` : ""}
                                </Badge>
                              </div>
                            </div>

                            <h5
                              className="font-bold text-sm text-foreground line-clamp-1 mb-0.5"
                              title={p.name}
                            >
                              {p.name}
                            </h5>

                            {p.ministry && (
                              <p
                                className="text-[11px] text-muted-foreground line-clamp-1 mb-1"
                                title={p.ministry}
                              >
                                {p.ministry}
                              </p>
                            )}

                            {p.category && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-muted/60 text-[10px] text-foreground/80 font-medium mb-1.5">
                                {p.category}
                              </span>
                            )}

                            {p.benefits && (
                              <p
                                className="text-[11px] text-foreground/90 bg-muted/30 p-1.5 rounded line-clamp-2"
                                title={p.benefits}
                              >
                                {p.benefits}
                              </p>
                            )}

                            {item.error && (
                              <p className="mt-1.5 text-[10px] text-destructive font-medium bg-destructive/10 p-1 rounded">
                                {item.error}
                              </p>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                            <span
                              className="truncate max-w-[130px]"
                              title={item.row.sourceFileName}
                            >
                              {item.row.sourceFileName || "Uploaded File"}
                            </span>
                            {p.apply_url && (
                              <a
                                href={p.apply_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-0.5 shrink-0"
                              >
                                Link <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ROWS / TABLE VIEW: Compact rows showing multiple schemes */
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/80 sticky top-0 z-10 text-muted-foreground font-semibold border-b">
                        <tr>
                          <th className="p-2 w-20">Status</th>
                          <th className="p-2 min-w-[180px]">Scheme Name</th>
                          <th className="p-2 min-w-[120px]">Category & Level</th>
                          <th className="p-2 min-w-[150px]">Department</th>
                          <th className="p-2 min-w-[160px]">Benefits</th>
                          <th className="p-2 min-w-[120px]">Source File</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {displaySchemesList.map((item, idx) => {
                          const p = item.row.payload;
                          const isAdded = item.status === "added";
                          const isUpdated = item.status === "updated";
                          const isSkipped = item.status === "skipped";

                          return (
                            <tr
                              key={item.row.id || idx}
                              className="hover:bg-accent/40 transition-colors"
                            >
                              <td className="p-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    isAdded
                                      ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                                      : isUpdated
                                        ? "bg-primary/10 text-primary border-primary/30"
                                        : isSkipped
                                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                          : "bg-destructive/10 text-destructive border-destructive/30"
                                  }`}
                                >
                                  {isAdded
                                    ? "Added"
                                    : isUpdated
                                      ? "Updated"
                                      : isSkipped
                                        ? "Skipped"
                                        : "Failed"}
                                </Badge>
                              </td>
                              <td className="p-2 font-medium">
                                <span className="line-clamp-1" title={p.name}>
                                  {p.name}
                                </span>
                              </td>
                              <td className="p-2 text-muted-foreground">
                                <span className="line-clamp-1">
                                  {p.category} · {p.level}
                                </span>
                              </td>
                              <td className="p-2 text-muted-foreground">
                                <span className="line-clamp-1" title={p.ministry}>
                                  {p.ministry || "—"}
                                </span>
                              </td>
                              <td className="p-2 text-muted-foreground">
                                <span className="line-clamp-1" title={p.benefits}>
                                  {p.benefits || "—"}
                                </span>
                              </td>
                              <td className="p-2 text-muted-foreground text-[11px]">
                                <span className="line-clamp-1" title={item.row.sourceFileName}>
                                  {item.row.sourceFileName || "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t shrink-0 text-xs text-muted-foreground">
              <div>
                Processed <b>{stats.success + stats.updated}</b> schemes across{" "}
                <b>{uploadedFiles.length > 0 ? uploadedFiles.length : 1}</b>{" "}
                {uploadedFiles.length === 1 || uploadedFiles.length === 0 ? "file" : "files"}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  Upload More Bulk Data
                </Button>
                <Button size="sm" onClick={() => setOpen(false)} className="px-6 font-semibold">
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
