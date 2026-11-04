import { useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Building2,
  Calendar,
  ExternalLink,
  PlayCircle,
  User,
  FileText,
  FileCheck2,
  FileX2,
  Eye,
  Download,
  Upload,
  RotateCw,
  Info,
  Sparkles,
  MapPin,
  Tag,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PointWiseList } from "@/components/PointWiseList";
import { SchemeVideoPlayer } from "@/components/SchemeVideoPlayer";
import {
  useManagedUser,
  useBeneficiaryDocuments,
  useSchemes,
  useUser,
} from "@/hooks/use-app-data";
import { matchScheme, type MatchResult } from "@/lib/matching";
import { splitRequiredDocuments } from "@/lib/document-helpers";
import { getSchemeVideo } from "@/lib/video-helpers";
import { toast } from "sonner";

const docNormalizeRegex = /\b(?:card|documents|document|doc|certificate|certificates|passbook|passbooks)\b/gi;

function findMatchingDoc(reqDocName: string, docs: any[]) {
  if (!docs || docs.length === 0) return null;
  const target = reqDocName.trim().toLowerCase();
  const targetSimple = target.replace(docNormalizeRegex, "").trim();

  return docs.find((d: any) => {
    const docType = (d.doc_type || "").trim().toLowerCase();
    if (!docType) return false;
    if (docType === target) return true;
    if (docType.includes(target) || target.includes(docType)) return true;
    const docSimple = docType.replace(docNormalizeRegex, "").trim();
    if (docSimple.length > 0 && targetSimple.length > 0) {
      if (docSimple === targetSimple || docSimple.includes(targetSimple) || targetSimple.includes(docSimple)) {
        return true;
      }
    }
    return false;
  });
}

export default function UserSchemeDetail() {
  const { userId, schemeId } = useParams<{ userId: string; schemeId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const tabParam = searchParams.get("tab");
  const backToResultsUrl = tabParam
    ? `/agent/users/${userId}?tab=${tabParam}#scheme-eligibility-results`
    : `/agent/users/${userId}`;

  const { data: currentUser } = useUser();
  const { data: managedUser, isLoading: userLoading } = useManagedUser(userId);
  const { data: uploadedDocs = [], isLoading: docsLoading } = useBeneficiaryDocuments(userId);
  const { data: schemes = [], isLoading: schemesLoading } = useSchemes();

  // Document upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const scheme = schemes.find((s) => s.id === schemeId);

  // Loading state
  if (userLoading || schemesLoading || docsLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
        <RotateCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading scheme details and citizen assessment...</p>
      </div>
    );
  }

  // Not found state
  if (!managedUser || !scheme) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-card space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Record Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {!managedUser
            ? "The selected beneficiary could not be found."
            : "The selected government scheme could not be found."}
        </p>
        <Button asChild variant="outline">
          <Link to={userId ? `/agent/users/${userId}` : "/users"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Beneficiary
          </Link>
        </Button>
      </div>
    );
  }

  // Run user-specific scheme match evaluation
  const docTypesList = uploadedDocs.map((d: any) => d.doc_type).filter(Boolean);
  const matchResult: MatchResult = matchScheme(scheme, managedUser, docTypesList);

  const e = ((scheme as any).eligibility ?? {}) as any;
  const appProcess = e.application_process || (scheme as any).application_process;
  const appDeadline = e.application_deadline || (scheme as any).application_deadline;
  const officialWebsiteUrl = scheme.apply_url || (scheme as any).official_website_url || e.official_website_url;
  const reqDocs = splitRequiredDocuments(scheme.required_documents);
  const videoInfo = getSchemeVideo(scheme);

  // Trigger file dialog for a specific document
  const triggerUploadForDoc = (docType: string) => {
    setUploadingDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Upload file handler
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocType || !managedUser || !scheme) return;

    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const validExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(fileExt)) {
      toast.error("Only PDF, JPG, JPEG, and PNG formats are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size cannot exceed 10 MB.");
      return;
    }

    setIsUploading(true);
    const targetType = uploadingDocType;
    try {
      const agentId = currentUser?.id || "agent";
      const sanitizedName = file.name.replace(/[^\w.-]/g, "_");
      const filePath = `${agentId}/beneficiaries/${managedUser.id}/${Date.now()}-${sanitizedName}`;

      // 1. Storage upload
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (storageError) {
        throw new Error(`Upload failed: ${storageError.message}`);
      }

      // 2. Save document record in documents table
      const docPayload: any = {
        user_id: agentId,
        agent_id: agentId,
        managed_user_id: managedUser.id,
        scheme_id: scheme.id,
        doc_type: targetType,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || "application/octet-stream",
        status: "Verified",
      };

      try {
        const { error: dbError } = await supabase.from("documents").insert(docPayload);
        if (dbError) {
          // Fallback if scheme_id column is not in remote table
          const fallback = { ...docPayload };
          delete fallback.scheme_id;
          await supabase.from("documents").insert(fallback);
        }
      } catch {
        const fallback = { ...docPayload };
        delete fallback.scheme_id;
        await supabase.from("documents").insert(fallback);
      }

      // 3. Sync to managed_users extra_criteria.documents
      const existingCriteria = (managedUser.extra_criteria as any) || {};
      const existingDocs = existingCriteria.documents || [];
      const remainingDocs = existingDocs.filter(
        (d: any) => (d.doc_type || "").trim().toLowerCase() !== targetType.trim().toLowerCase()
      );
      const newDocMeta = {
        id: crypto.randomUUID(),
        doc_type: targetType,
        scheme_id: scheme.id,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || "application/octet-stream",
        status: "Verified",
        uploaded_at: new Date().toISOString(),
        agent_id: agentId,
      };

      await supabase
        .from("managed_users")
        .update({
          extra_criteria: {
            ...existingCriteria,
            documents: [...remainingDocs, newDocMeta],
          },
        })
        .eq("id", managedUser.id);

      toast.success(`${targetType} uploaded successfully!`);

      // Refresh queries
      await qc.invalidateQueries({ queryKey: ["beneficiaryDocuments", managedUser.id] });
      await qc.invalidateQueries({ queryKey: ["managedUser", managedUser.id] });
      await qc.invalidateQueries({ queryKey: ["userSchemeMatches", managedUser.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
      setUploadingDocType("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Preview Document securely using Signed URL
  const handlePreviewDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 120);

      if (error || !data?.signedUrl) {
        throw error || new Error("Failed to create secure link");
      }
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error("Could not preview document: " + (err.message || "Error"));
    }
  };

  // Download Document securely using Signed URL
  const handleDownloadDoc = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 120, { download: doc.file_name || "document" });

      if (error || !data?.signedUrl) {
        throw error || new Error("Failed to create download link");
      }

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error("Could not download document: " + (err.message || "Error"));
    }
  };

  return (
    <div className="space-y-8" data-testid="user-scheme-detail-page">
      {/* Hidden File Input for in-place upload/replace */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        data-testid="scheme-doc-file-input"
        onChange={handleFileSelected}
      />

      {/* Top Back Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" className="gap-2 -ml-2 text-primary hover:text-primary/80 font-medium">
          <Link
            to={backToResultsUrl}
            aria-label={`Back to Results - Back to ${managedUser.full_name}'s Eligibility Results`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Link>
        </Button>

        <Badge variant="outline" className="text-xs">
          Tailored Evaluation for Citizen
        </Badge>
      </div>

      {/* Selected Beneficiary Context Banner */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
                Citizen Evaluation Profile
              </span>
              <span className="text-xs text-indigo-200/60">•</span>
              <span className="text-xs text-indigo-200/80">ID: {managedUser.id}</span>
            </div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-400" />
              {managedUser.full_name}
            </h2>
            <p className="text-xs text-indigo-100/70">
              {managedUser.gender} · {managedUser.age ? `${managedUser.age} yrs` : "Age N/A"} · {managedUser.category || "General"} · {managedUser.district}, {managedUser.state} ({managedUser.area || "Rural"})
              {managedUser.annual_income != null && ` · Income: ₹${Number(managedUser.annual_income).toLocaleString("en-IN")}/yr`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {matchResult.status === "eligible" && (
              <Badge className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 text-xs shadow-sm">
                <CheckCircle2 className="h-4 w-4 mr-1 text-slate-950" />
                Eligible ({matchResult.percent}% Match)
              </Badge>
            )}
            {matchResult.status === "needs_verification" && (
              <Badge className="bg-amber-500 text-slate-950 font-bold px-3 py-1.5 text-xs shadow-sm">
                <HelpCircle className="h-4 w-4 mr-1 text-slate-950" />
                Needs More Info ({matchResult.percent}%)
              </Badge>
            )}
            {matchResult.status === "ineligible" && (
              <Badge className="bg-red-500 text-white font-bold px-3 py-1.5 text-xs shadow-sm">
                <XCircle className="h-4 w-4 mr-1 text-white" />
                Not Eligible
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Scheme Content Container */}
      <div className="rounded-xl border bg-card p-6 md:p-8 shadow-card space-y-6">
        {/* 1. Scheme Name and Overview */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {scheme.category || "Social Welfare"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {scheme.level || "Central"} Government
            </Badge>
            {scheme.state && (
              <Badge variant="outline" className="text-xs">
                State: {scheme.state}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            {scheme.name}
          </h1>
        </div>

        {/* 2. Scheme Description */}
        {scheme.description && (
          <div className="rounded-lg bg-muted/20 p-4 border text-sm text-foreground/90 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              About Scheme
            </div>
            <PointWiseList text={scheme.description} />
          </div>
        )}

        {/* 3. Department, Government Type, State and Category */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border bg-muted/10 text-xs">
          <div>
            <span className="text-muted-foreground block font-medium">Department</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{scheme.ministry || "N/A"}</span>
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Government Type</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
              {scheme.level || "Central"} Government
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">State / Coverage</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              {scheme.state || "All India"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block font-medium">Category</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
              {scheme.category || "Social Welfare"}
            </span>
          </div>
        </div>

        {/* 4. Benefits */}
        {scheme.benefits && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-2">
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
              Scheme Benefits & Financial Assistance
            </h3>
            <div className="text-sm text-foreground">
              <PointWiseList text={scheme.benefits} icon="check" inlineIfSingle />
            </div>
          </div>
        )}

        {/* 5. Application Process */}
        {appProcess && (
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Step-by-Step Application Process
            </h3>
            <div className="text-sm text-foreground">
              <PointWiseList text={appProcess} inlineIfSingle />
            </div>
          </div>
        )}

        {/* 6. Official Website URL, if available */}
        {officialWebsiteUrl && officialWebsiteUrl.trim() && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-foreground text-sm">Official Government Portal</h4>
              <p className="text-xs text-muted-foreground truncate max-w-md">
                {officialWebsiteUrl}
              </p>
            </div>
            <Button asChild className="bg-primary text-primary-foreground font-semibold gap-2 shadow-xs">
              <a href={officialWebsiteUrl} target="_blank" rel="noopener noreferrer">
                Apply on Official Website <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}

        {/* 7. Application Deadline, if available */}
        {appDeadline && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <span className="font-bold text-foreground">Application Deadline: </span>
              <span className="font-medium text-amber-900 dark:text-amber-200">{appDeadline}</span>
            </div>
          </div>
        )}

        {/* 8. Application Tutorial Video, if available */}
        {videoInfo.url && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-primary" />
              Scheme Application Tutorial Video
            </h3>
            <SchemeVideoPlayer
              videoUrl={videoInfo.url}
              videoType={videoInfo.type}
              schemeName={scheme.name}
              applyUrl={officialWebsiteUrl || undefined}
            />
          </div>
        )}

        {/* 9. Your Match / Eligibility Criteria and Required Documents (two-column layout) */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"
          data-testid="eligibility-and-documents-section"
        >
          {/* Left Card – Your Match / Eligibility Criteria */}
          <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Match
              </h2>
              <div className="flex items-center gap-3">
                <Progress value={matchResult.percent} className="h-2.5 flex-1" />
                <span className="text-sm font-bold text-foreground shrink-0">{matchResult.percent}%</span>
              </div>
              <p
                className={`text-sm font-semibold ${
                  matchResult.status === "eligible"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : matchResult.status === "needs_verification"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
                }`}
              >
                {matchResult.status === "eligible"
                  ? "You may be eligible"
                  : matchResult.status === "needs_verification"
                  ? "Additional documents or information required"
                  : "You may not meet some criteria"}
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ELIGIBILITY
              </h3>

              {/* Satisfied criteria */}
              {matchResult.reasons.length > 0 && (
                <div className="space-y-2">
                  {matchResult.status === "eligible" && (
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Why {managedUser.full_name} is eligible:
                    </p>
                  )}
                  <ul className="space-y-2 text-xs">
                    {matchResult.reasons.map((r, i) => (
                      <li key={`reason-${i}`} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <span className="text-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unsatisfied / Failed criteria */}
              {matchResult.failedReasons.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-destructive">
                    Why {managedUser.full_name} does not meet criteria:
                  </p>
                  <ul className="space-y-2 text-xs">
                    {matchResult.failedReasons.map((fr, i) => (
                      <li key={`fail-${i}`} className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <span className="text-foreground">{fr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing profile info */}
              {matchResult.missing.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Information needed for verification:
                  </p>
                  <ul className="space-y-2 text-xs">
                    {matchResult.missing.map((m, i) => (
                      <li key={`missing-${i}`} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                        <span className="text-foreground">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing documents from assessment */}
              {matchResult.missingDocs.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Pending required certificates:
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {matchResult.missingDocs.map((mDoc, i) => (
                      <li key={`missing-doc-${i}`} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                        <span className="text-foreground">Certificate required: {mDoc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* General eligibility conditions whenever present in the scheme data */}
              {scheme.eligibility_text && (
                <div className="pt-3 border-t text-xs space-y-1.5">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                    General Scheme Conditions
                  </span>
                  <PointWiseList
                    text={scheme.eligibility_text}
                    icon="bullet"
                    inlineIfSingle
                    className="text-foreground/90"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Card – Required Documents */}
          <div className="rounded-xl border bg-card p-6 shadow-card space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Required Documents
                </h2>
                <Badge variant="outline" className="text-xs font-normal">
                  {reqDocs.length} {reqDocs.length === 1 ? "document" : "documents"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Document Verification for {managedUser.full_name}
              </p>
            </div>

            {/* Verification Caution Notice */}
            <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold">Verification Caution:</span> Do not assume a document is valid merely because it has been uploaded. All uploaded certificates must be inspected for authenticity, active validity period, and competent authority seals before final submission.
              </p>
            </div>

            {/* Documents Checklist & Upload Actions */}
            {reqDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No specific documents required for this scheme.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-xl border">
                {reqDocs.map((reqDoc, idx) => {
                  const matchedUploaded = findMatchingDoc(reqDoc, uploadedDocs);
                  const isUploaded = Boolean(matchedUploaded);

                  return (
                    <div
                      key={idx}
                      className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                      data-testid={`req-doc-row-${idx}`}
                    >
                      <div className="space-y-1 min-w-[180px]">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {isUploaded ? (
                            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <FileX2 className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                          <span>{reqDoc}</span>
                          {isUploaded ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                              Uploaded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 bg-amber-50/50 text-[10px] font-semibold">
                              Missing
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {isUploaded ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Uploaded in vault: {matchedUploaded?.file_name || "Verified Document"}
                              {matchedUploaded?.created_at && (
                                <span className="text-muted-foreground ml-1">
                                  ({new Date(matchedUploaded.created_at).toLocaleDateString()})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-300 font-medium">
                              Certificate not yet uploaded for this citizen.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isUploaded ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1.5"
                              onClick={() => handlePreviewDoc(matchedUploaded)}
                              title="Preview document in browser"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1.5"
                              onClick={() => handleDownloadDoc(matchedUploaded)}
                              title="Download secure copy"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => triggerUploadForDoc(reqDoc)}
                              disabled={isUploading}
                              title="Replace with updated certificate"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                              Replace
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => triggerUploadForDoc(reqDoc)}
                            disabled={isUploading}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Back Button */}
        <div className="pt-4 border-t flex justify-between items-center">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link
              to={backToResultsUrl}
              aria-label={`Back to Results - Back to ${managedUser.full_name}'s Eligibility Results`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Results
            </Link>
          </Button>

          <Button asChild size="sm" variant="ghost" className="text-xs text-muted-foreground">
            <Link to="/users">
              All Managed Users
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
