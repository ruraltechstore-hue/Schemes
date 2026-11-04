import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Upload,
  FileText,
  Trash2,
  Eye,
  Download,
  BadgeCheck,
  ExternalLink,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  DollarSign,
  Clock,
  RotateCw,
  Building2,
  PlayCircle,
  ShieldCheck,
  Pencil,
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  HelpCircle,
  History,
  FileCheck2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemeSummaryCard } from "@/components/SchemeSummaryCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  useManagedUser,
  useBeneficiaryDocuments,
  useUserSchemeMatches,
  useBeneficiaryCheckHistory,
  useSchemes,
  useUser,
  useIsAdmin,
} from "@/hooks/use-app-data";
import { matchScheme, age as calcAge, type MatchResult } from "@/lib/matching";
import { CASTE_CATEGORIES, GENDERS, OCCUPATIONS, STATES } from "@/lib/constants";
import { splitRequiredDocuments } from "@/lib/document-helpers";

const BENEFICIARY_DOC_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Income Certificate",
  "Caste Certificate",
  "Residence/Domicile Certificate",
  "Ration Card",
  "Bank Passbook",
  "Land Ownership/Patta Documents",
  "Disability Certificate",
  "Educational Certificates",
  "Other Supporting Documents",
];

const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

const COMMON_REQUIRED_DOCS = [
  "Aadhaar Card",
  "Income Certificate",
  "Bank Passbook",
  "Residence/Domicile Certificate",
  "Caste Certificate",
];

export default function IndividualUserDetails() {
  const { userId, id } = useParams<{ userId?: string; id?: string }>();
  const paramUserId = userId || id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const { data: currentUser } = useUser();
  const { data: isAdmin } = useIsAdmin();
  const { data: managedUser, isLoading: userLoading, refetch: refetchUser } = useManagedUser(paramUserId);
  const effectiveUserId = paramUserId || managedUser?.id;
  const { data: uploadedDocs = [], isLoading: docsLoading, refetch: refetchDocs } = useBeneficiaryDocuments(effectiveUserId);
  const { data: savedMatches = [], isLoading: matchesLoading } = useUserSchemeMatches(effectiveUserId);
  const { data: checkHistory = [] } = useBeneficiaryCheckHistory(effectiveUserId);
  const { data: schemes = [] } = useSchemes();

  // Upload state
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [customDocType, setCustomDocType] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Delete document state
  const [docToDelete, setDocToDelete] = useState<any | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Eligibility evaluation state
  const [isChecking, setIsChecking] = useState(false);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(
    tabParam === "needs_info" || tabParam === "ineligible" ? tabParam : "eligible"
  );
  const [showHistory, setShowHistory] = useState(false);

  // Sync activeTab with URL tab query parameter
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab && ["eligible", "needs_info", "ineligible"].includes(currentTab)) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", val);
        return next;
      },
      { replace: true }
    );
  };

  // Edit User State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Auto trigger check if ?check=1 is in URL
  useEffect(() => {
    if (searchParams.get("check") === "1" && managedUser && schemes.length > 0 && !isChecking) {
      runEligibilityCheck();
    }
  }, [searchParams, managedUser?.id, schemes.length]);

  // Sync edit form with user data
  useEffect(() => {
    if (managedUser) {
      setEditForm({
        full_name: managedUser.full_name || "",
        dob: managedUser.dob || "",
        age: managedUser.age != null ? String(managedUser.age) : "",
        gender: managedUser.gender || "Male",
        mobile: managedUser.mobile || "",
        email: managedUser.email || "",
        state: managedUser.state || "",
        district: managedUser.district || "",
        area: managedUser.area || "Rural",
        annual_income: managedUser.annual_income != null ? String(managedUser.annual_income) : "0",
        occupation: managedUser.occupation || "",
        education: managedUser.education || "",
        category: managedUser.category || "General",
        has_disability: Boolean(managedUser.has_disability),
        disability_percentage: managedUser.disability_percentage != null ? String(managedUser.disability_percentage) : "",
        is_farmer: Boolean(managedUser.is_farmer),
        is_student: Boolean(managedUser.is_student),
        marital_status: managedUser.marital_status || "Single",
        family_size: managedUser.family_size != null ? String(managedUser.family_size) : "1",
      });
    }
  }, [managedUser]);

  if (userLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
        <RotateCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading beneficiary profile...</p>
      </div>
    );
  }

  if (!managedUser) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-card">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-xl font-bold">Beneficiary Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          The requested beneficiary record does not exist or you do not have permission to view it.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/users">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Users
          </Link>
        </Button>
      </div>
    );
  }

  // Calculate live matches from schemes and uploaded docs
  const docTypesList = uploadedDocs.map((d: any) => d.doc_type).filter(Boolean);
  const liveMatchResults: MatchResult[] = schemes.map((s) => matchScheme(s, managedUser, docTypesList));

  const eligibleSchemes = liveMatchResults.filter((m) => m.status === "eligible");
  const ineligibleSchemes = liveMatchResults.filter((m) => m.status === "ineligible");
  const needsMoreInfoSchemes = liveMatchResults.filter((m) => m.status === "needs_verification");

  // Document Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const invalidFiles = filesArray.filter((f) => !ACCEPTED_FILE_TYPES.includes(f.type));
      if (invalidFiles.length > 0) {
        toast.error("Only PDF, JPG, JPEG, and PNG files are allowed.");
        return;
      }
      const oversized = filesArray.filter((f) => f.size > 10 * 1024 * 1024);
      if (oversized.length > 0) {
        toast.error("Maximum file size is 10 MB per document.");
        return;
      }
      setSelectedFiles(filesArray);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("You must be logged in to upload documents.");
      return;
    }
    const finalDocType = selectedDocType === "Other Supporting Documents" ? customDocType.trim() : selectedDocType;

    if (!finalDocType) {
      toast.error("Please select or specify a document type.");
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one document to upload.");
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;

    try {
      for (const file of selectedFiles) {
        const sanitizedName = file.name.replace(/[^\w.-]/g, "_");
        const filePath = `${currentUser.id}/beneficiaries/${effectiveUserId}/${Date.now()}-${sanitizedName}`;

        // 1. Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (storageError) {
          throw new Error(`Failed to upload ${file.name}: ${storageError.message}`);
        }

        // 2. Insert into documents table
        const docPayload: any = {
          user_id: currentUser.id,
          doc_type: finalDocType,
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          status: "Verified",
        };

        try {
          await supabase.from("documents").insert({
            ...docPayload,
            managed_user_id: effectiveUserId,
            agent_id: currentUser.id,
          });
        } catch {
          await supabase.from("documents").insert(docPayload);
        }

        // 3. Sync to managed_users.extra_criteria.documents
        const existingCriteria = (managedUser.extra_criteria as any) || {};
        const existingDocs = existingCriteria.documents || [];
        const newDocMeta = {
          id: crypto.randomUUID(),
          doc_type: finalDocType,
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          status: "Verified",
          uploaded_at: new Date().toISOString(),
          agent_id: currentUser.id,
        };

        if (effectiveUserId) {
          await supabase
            .from("managed_users")
            .update({
              extra_criteria: {
                ...existingCriteria,
                documents: [...existingDocs, newDocMeta],
              },
            })
            .eq("id", effectiveUserId);
        }

        uploadedCount++;
      }

      toast.success(
        `Successfully uploaded ${uploadedCount} document${uploadedCount > 1 ? "s" : ""} for ${managedUser.full_name}!`
      );

      // Reset form
      setSelectedDocType("");
      setCustomDocType("");
      setSelectedFiles([]);
      const fileInput = document.getElementById("beneficiary-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Refresh queries
      await qc.invalidateQueries({ queryKey: ["beneficiaryDocuments", effectiveUserId] });
      await qc.invalidateQueries({ queryKey: ["managedUser", effectiveUserId] });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
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
        .createSignedUrl(doc.file_path, 120, { download: doc.file_name });

      if (error || !data?.signedUrl) {
        throw error || new Error("Failed to create download link");
      }

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error("Could not download document: " + (err.message || "Error"));
    }
  };

  // Delete Document
  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);

    try {
      // 1. Remove from Storage
      if (docToDelete.file_path) {
        await supabase.storage.from("documents").remove([docToDelete.file_path]);
      }

      // 2. Remove from documents table if exists
      if (docToDelete.id) {
        await supabase.from("documents").delete().eq("id", docToDelete.id);
      }

      // 3. Remove from managed_users.extra_criteria
      const existingCriteria = (managedUser.extra_criteria as any) || {};
      const existingDocs = existingCriteria.documents || [];
      const updatedDocs = existingDocs.filter(
        (d: any) => d.id !== docToDelete.id && d.file_path !== docToDelete.file_path
      );

      if (effectiveUserId) {
        await supabase
          .from("managed_users")
          .update({
            extra_criteria: {
              ...existingCriteria,
              documents: updatedDocs,
            },
          })
          .eq("id", effectiveUserId);
      }

      toast.success("Document deleted successfully");
      setDocToDelete(null);
      await qc.invalidateQueries({ queryKey: ["beneficiaryDocuments", effectiveUserId] });
      await qc.invalidateQueries({ queryKey: ["managedUser", effectiveUserId] });
    } catch (err: any) {
      toast.error("Failed to delete document: " + (err.message || "Error"));
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Run Scheme Eligibility Evaluation Engine
  const runEligibilityCheck = async () => {
    if (!managedUser || !currentUser) return;
    setIsChecking(true);

    try {
      const currentDocTypes = uploadedDocs.map((d: any) => d.doc_type).filter(Boolean);
      const evalResults = schemes.map((scheme) => matchScheme(scheme, managedUser, currentDocTypes));

      const eligible = evalResults.filter((r) => r.status === "eligible");
      const ineligible = evalResults.filter((r) => r.status === "ineligible");
      const needsInfo = evalResults.filter((r) => r.status === "needs_verification");

      // 1. Create eligibility_check_history record
      const checkRecord: any = {
        agent_id: currentUser.id,
        batch_id: `user_${effectiveUserId}`,
        check_type: "individual",
        total_users: 1,
        total_schemes_checked: schemes.length,
        total_eligible_matches: eligible.length,
        status: "completed",
      };

      let checkId: string | null = null;
      try {
        const { data: histData } = await supabase
          .from("eligibility_check_history")
          .insert(checkRecord)
          .select("id")
          .single();
        if (histData) checkId = histData.id;
      } catch (e) {
        console.warn("History insert notice:", e);
      }

      // 2. Upsert each scheme match in user_scheme_matches
      for (const res of evalResults) {
        try {
          await supabase.from("user_scheme_matches").upsert({
            user_id: effectiveUserId!,
            scheme_id: res.scheme.id,
            agent_id: currentUser.id,
            check_id: checkId,
            status: res.status,
            match_percentage: res.percent,
            reasons: res.reasons,
            missing_criteria: [...res.failedReasons, ...res.missing],
            missing_documents: res.missingDocs,
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Match upsert notice:", err);
        }
      }

      // 3. Save chronological history record in managed_users extra_criteria
      const existingCriteria = (managedUser.extra_criteria as any) || {};
      const previousHistory = existingCriteria.check_history || [];
      const newHistoryEntry = {
        id: checkId || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agent_id: currentUser.id,
        total_schemes: schemes.length,
        eligible_count: eligible.length,
        ineligible_count: ineligible.length,
        needs_info_count: needsInfo.length,
      };

      if (effectiveUserId) {
        await supabase
          .from("managed_users")
          .update({
            extra_criteria: {
              ...existingCriteria,
              check_history: [newHistoryEntry, ...previousHistory],
              last_checked_at: new Date().toISOString(),
            },
          })
          .eq("id", effectiveUserId);
      }

      toast.success(
        `Eligibility evaluation complete: ${eligible.length} eligible, ${needsMoreInfoSchemes.length} need more info, ${ineligible.length} not eligible.`
      );

      await qc.invalidateQueries({ queryKey: ["userSchemeMatches", effectiveUserId] });
      await qc.invalidateQueries({ queryKey: ["beneficiaryCheckHistory", effectiveUserId] });
      await qc.invalidateQueries({ queryKey: ["managedUser", effectiveUserId] });
    } catch (err: any) {
      toast.error("Failed to run eligibility check: " + (err.message || "Unknown error"));
    } finally {
      setIsChecking(false);
    }
  };

  // Save edited user profile details
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);

    try {
      const computedAge = editForm.age ? parseInt(editForm.age, 10) : calcAge(editForm.dob);

      const updatePayload: any = {
        full_name: editForm.full_name?.trim(),
        dob: editForm.dob || null,
        age: computedAge,
        gender: editForm.gender,
        mobile: editForm.mobile?.trim() || null,
        email: editForm.email?.trim().toLowerCase() || null,
        state: editForm.state,
        district: editForm.district?.trim(),
        area: editForm.area || "Rural",
        annual_income: editForm.annual_income ? parseFloat(editForm.annual_income) : 0,
        occupation: editForm.occupation || null,
        education: editForm.education || null,
        category: editForm.category || "General",
        has_disability: editForm.has_disability,
        disability_percentage:
          editForm.has_disability && editForm.disability_percentage
            ? parseInt(editForm.disability_percentage, 10)
            : null,
        is_farmer: editForm.is_farmer,
        is_student: editForm.is_student,
        marital_status: editForm.marital_status || "Single",
        family_size: editForm.family_size ? parseInt(editForm.family_size, 10) : 1,
        updated_at: new Date().toISOString(),
      };

      if (effectiveUserId) {
        const { error } = await supabase
          .from("managed_users")
          .update(updatePayload)
          .eq("id", effectiveUserId);

        if (error) throw error;
      }

      toast.success("Beneficiary profile updated successfully!");
      setIsEditOpen(false);
      await qc.invalidateQueries({ queryKey: ["managedUser", effectiveUserId] });
      await qc.invalidateQueries({ queryKey: ["managedUsers"] });
    } catch (err: any) {
      toast.error("Failed to update profile: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingUser(false);
    }
  };

  // Compute missing common documents
  const uploadedTypeSet = new Set(uploadedDocs.map((d: any) => (d.doc_type || "").toLowerCase()));
  const missingCommonDocs = COMMON_REQUIRED_DOCS.filter(
    (doc) => !uploadedTypeSet.has(doc.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="individual-user-page">
      {/* Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/users">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {managedUser.full_name}
              </h1>
              <Badge variant="outline" className="text-xs font-normal">
                {managedUser.category || "General"}
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                Managed Beneficiary
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registered on {managedUser.created_at ? new Date(managedUser.created_at).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Recently"}
              {managedUser.mobile && ` • Mobile: ${managedUser.mobile}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsEditOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" /> Edit Profile
          </Button>

          <Button
            onClick={() => {
              document.getElementById("scheme-eligibility-results")?.scrollIntoView({ behavior: "smooth" });
              runEligibilityCheck();
            }}
            disabled={isChecking}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md gap-2"
          >
            {isChecking ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" /> Evaluating Schemes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" /> Check Eligible Schemes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Beneficiary Profile Card */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Beneficiary Profile Overview
          </h2>
          <span className="text-xs text-muted-foreground">ID: {managedUser.id}</span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {/* Column 1: Demographics */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Demographics
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Age / DOB: </span>
                <span className="font-medium text-foreground">
                  {managedUser.age ? `${managedUser.age} years` : "Age N/A"}
                  {managedUser.dob && ` (${managedUser.dob})`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Gender: </span>
                <span className="font-medium text-foreground">{managedUser.gender || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Marital Status: </span>
                <span className="font-medium text-foreground">{managedUser.marital_status || "Single"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Family Size: </span>
                <span className="font-medium text-foreground">{managedUser.family_size || 1} members</span>
              </div>
            </div>
          </div>

          {/* Column 2: Location */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Location
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">State: </span>
                <span className="font-medium text-foreground">{managedUser.state || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">District: </span>
                <span className="font-medium text-foreground">{managedUser.district || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Area Type: </span>
                <Badge variant="secondary" className="text-xs">
                  {managedUser.area || "Rural"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Column 3: Socioeconomic */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Socioeconomic Details
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Annual Income: </span>
                <span className="font-medium text-foreground">
                  {managedUser.annual_income != null
                    ? `₹${Number(managedUser.annual_income).toLocaleString("en-IN")}`
                    : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Social Category: </span>
                <span className="font-medium text-foreground">{managedUser.category || "General"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Occupation: </span>
                <span className="font-medium text-foreground">{managedUser.occupation || "Unemployed"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Education: </span>
                <span className="font-medium text-foreground">{managedUser.education || "Not specified"}</span>
              </div>
            </div>
          </div>

          {/* Column 4: Welfare Profile Tags */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Special Welfare Criteria
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {managedUser.is_farmer ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-none">
                  Farmer
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Non-farmer</span>
              )}
              {managedUser.is_student && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-none">
                  Student
                </Badge>
              )}
              {managedUser.has_disability && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-none">
                  Disability {managedUser.disability_percentage ? `(${managedUser.disability_percentage}%)` : ""}
                </Badge>
              )}
            </div>
            {managedUser.email && (
              <div className="text-xs text-muted-foreground pt-1 truncate">
                Email: {managedUser.email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: Dedicated Document Upload Section */}
      <div className="rounded-xl border bg-card p-6 shadow-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Document Vault ({uploadedDocs.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Securely store official beneficiary certificates to verify eligibility criteria. All files are encrypted and private.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Allowed formats:</span>
            <Badge variant="outline">PDF</Badge>
            <Badge variant="outline">JPG</Badge>
            <Badge variant="outline">PNG</Badge>
            <span className="text-muted-foreground">Max 10 MB</span>
          </div>
        </div>

        {/* Missing Required Documents Notification */}
        {missingCommonDocs.length > 0 && (
          <div className="rounded-lg border border-amber-300/80 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Recommended Verification Documents</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                To maximize scheme eligibility matching, upload the following documents for {managedUser.full_name}:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missingCommonDocs.map((doc) => (
                  <Badge
                    key={doc}
                    variant="outline"
                    className="border-amber-400/60 bg-amber-100/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-normal cursor-pointer hover:bg-amber-200/60"
                    onClick={() => setSelectedDocType(doc)}
                  >
                    + {doc}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upload Form */}
        <form
          onSubmit={handleUploadSubmit}
          className="grid gap-4 rounded-xl border bg-muted/20 p-5 md:grid-cols-[1.5fr_2fr_auto] md:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="doc-type-select">Document Type</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger id="doc-type-select">
                <SelectValue placeholder="Select certificate type..." />
              </SelectTrigger>
              <SelectContent>
                {BENEFICIARY_DOC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedDocType === "Other Supporting Documents" && (
              <div className="pt-2">
                <Label htmlFor="custom-doc-type" className="text-xs">Specify Document Name</Label>
                <Input
                  id="custom-doc-type"
                  placeholder="e.g. Land Revenue Receipt, Disability ID Card"
                  value={customDocType}
                  onChange={(e) => setCustomDocType(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="beneficiary-file-input">Select Document File(s)</Label>
            <Input
              id="beneficiary-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileChange}
              className="cursor-pointer file:cursor-pointer"
            />
            {selectedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected (
                {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB total)
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isUploading || selectedFiles.length === 0 || !selectedDocType}
            className="w-full md:w-auto"
          >
            {isUploading ? (
              <>
                <RotateCw className="mr-2 h-4 w-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Upload Document
              </>
            )}
          </Button>
        </form>

        {/* Uploaded Documents Table */}
        {docsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Loading uploaded documents...
          </div>
        ) : uploadedDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-2 text-sm font-semibold">No Documents Uploaded Yet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Upload certificates such as Aadhaar, Income Certificate, and Bank Passbook to confirm scheme eligibility.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Uploaded Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {uploadedDocs.map((doc: any, index: number) => (
                  <tr key={doc.id || doc.file_path || index} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Badge variant="outline" className="text-xs font-normal">
                        {doc.doc_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[220px]" title={doc.file_name}>
                      {doc.file_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {doc.created_at || doc.uploaded_at
                        ? new Date(doc.created_at || doc.uploaded_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Uploaded"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handlePreviewDoc(doc)}
                          title="Preview Document Securely"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleDownloadDoc(doc)}
                          title="Download Document"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setDocToDelete(doc)}
                          title="Delete Document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 5 & 6: Scheme Eligibility Results Section */}
      <div id="scheme-eligibility-results" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BadgeCheck className="h-6 w-6 text-primary" />
              Government Scheme Eligibility Results
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automated evaluation against central and state government welfare schemes for {managedUser.full_name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-1.5 text-xs"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Hide Check History" : `View Check History (${checkHistory.length})`}
            </Button>

            <Button
              onClick={runEligibilityCheck}
              disabled={isChecking}
              size="sm"
              className="bg-primary text-primary-foreground gap-1.5"
            >
              {isChecking ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" /> Evaluating...
                </>
              ) : (
                <>
                  <RotateCw className="h-3.5 w-3.5" /> Re-check Schemes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Previous History Accordion */}
        {showHistory && (
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Chronological Eligibility Check History
            </h3>
            {checkHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prior eligibility check records found.</p>
            ) : (
              <div className="divide-y divide-border text-xs">
                {checkHistory.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">
                        {new Date(item.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        Evaluated {item.total_schemes_checked} schemes
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                        {item.total_eligible_matches} Eligible Schemes
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Tabs: Eligible, Not Eligible, Needs More Information */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="eligible" className="gap-2 text-xs md:text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Eligible ({eligibleSchemes.length})
            </TabsTrigger>
            <TabsTrigger value="needs_info" className="gap-2 text-xs md:text-sm">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              Needs More Info ({needsMoreInfoSchemes.length})
            </TabsTrigger>
            <TabsTrigger value="ineligible" className="gap-2 text-xs md:text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              Not Eligible ({ineligibleSchemes.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Eligible Schemes */}
          <TabsContent value="eligible" className="space-y-4">
            {eligibleSchemes.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-3 text-base font-semibold">No Eligible Schemes Found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  Based on the current profile and verified documents, no schemes fully match. Check the "Needs More Information" tab to see if uploading additional certificates unlocks eligibility.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="eligible-schemes-list">
                {eligibleSchemes.map((res) => (
                  <SchemeSummaryCard
                    key={res.scheme.id}
                    matchResult={res}
                    userId={effectiveUserId!}
                    activeTab="eligible"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Needs More Information */}
          <TabsContent value="needs_info" className="space-y-4">
            {needsMoreInfoSchemes.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/50" />
                <h3 className="mt-3 text-base font-semibold">No Pending Scheme Verifications</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  All platform schemes have been decisively categorized as either fully eligible or ineligible based on complete user data.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="needs-info-schemes-list">
                {needsMoreInfoSchemes.map((res) => (
                  <SchemeSummaryCard
                    key={res.scheme.id}
                    matchResult={res}
                    userId={effectiveUserId!}
                    activeTab="needs_info"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Not Eligible Schemes */}
          <TabsContent value="ineligible" className="space-y-4">
            {ineligibleSchemes.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center shadow-card">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/50" />
                <h3 className="mt-3 text-base font-semibold">No Explicitly Disqualified Schemes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The applicant has not been disqualified by mandatory restriction criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="ineligible-schemes-list">
                {ineligibleSchemes.map((res) => (
                  <SchemeSummaryCard
                    key={res.scheme.id}
                    matchResult={res}
                    userId={effectiveUserId!}
                    activeTab="ineligible"
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG: Edit Profile Information */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Beneficiary Details: {managedUser.full_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUserEdit} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  required
                  value={editForm.full_name || ""}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-mobile">Mobile Number</Label>
                <Input
                  id="edit-mobile"
                  value={editForm.mobile || ""}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-dob">Date of Birth</Label>
                <Input
                  id="edit-dob"
                  type="date"
                  value={editForm.dob || ""}
                  onChange={(e) => {
                    const dobVal = e.target.value;
                    const cAge = calcAge(dobVal);
                    setEditForm({
                      ...editForm,
                      dob: dobVal,
                      age: cAge != null ? String(cAge) : editForm.age,
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-age">Age (Years)</Label>
                <Input
                  id="edit-age"
                  type="number"
                  value={editForm.age || ""}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select
                  value={editForm.gender || "Male"}
                  onValueChange={(val) => setEditForm({ ...editForm, gender: val })}
                >
                  <SelectTrigger id="edit-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Social Category</Label>
                <Select
                  value={editForm.category || "General"}
                  onValueChange={(val) => setEditForm({ ...editForm, category: val })}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASTE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-state">State *</Label>
                <Select
                  value={editForm.state || ""}
                  onValueChange={(val) => setEditForm({ ...editForm, state: val })}
                >
                  <SelectTrigger id="edit-state">
                    <SelectValue placeholder="Select state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-district">District *</Label>
                <Input
                  id="edit-district"
                  required
                  value={editForm.district || ""}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-area">Area</Label>
                <Select
                  value={editForm.area || "Rural"}
                  onValueChange={(val) => setEditForm({ ...editForm, area: val })}
                >
                  <SelectTrigger id="edit-area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rural">Rural</SelectItem>
                    <SelectItem value="Urban">Urban</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-income">Annual Family Income (₹)</Label>
                <Input
                  id="edit-income"
                  type="number"
                  value={editForm.annual_income || ""}
                  onChange={(e) => setEditForm({ ...editForm, annual_income: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-occupation">Occupation</Label>
                <Input
                  id="edit-occupation"
                  value={editForm.occupation || ""}
                  onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-education">Education Level</Label>
                <Input
                  id="edit-education"
                  value={editForm.education || ""}
                  onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-farmer" className="font-semibold">Is Applicant a Farmer?</Label>
                  <p className="text-xs text-muted-foreground">Required for agricultural welfare schemes</p>
                </div>
                <Switch
                  id="edit-farmer"
                  checked={editForm.is_farmer || false}
                  onCheckedChange={(val) => setEditForm({ ...editForm, is_farmer: val })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-student" className="font-semibold">Is Applicant a Student?</Label>
                  <p className="text-xs text-muted-foreground">Required for scholarships & education grants</p>
                </div>
                <Switch
                  id="edit-student"
                  checked={editForm.is_student || false}
                  onCheckedChange={(val) => setEditForm({ ...editForm, is_student: val })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="edit-disability" className="font-semibold">Person with Disability (PWD)?</Label>
                  <p className="text-xs text-muted-foreground">Required for special disability pensions and equipment subsidies</p>
                </div>
                <Switch
                  id="edit-disability"
                  checked={editForm.has_disability || false}
                  onCheckedChange={(val) => setEditForm({ ...editForm, has_disability: val })}
                />
              </div>

              {editForm.has_disability && (
                <div className="pt-2">
                  <Label htmlFor="edit-disability-pct" className="text-xs">Disability Percentage (%)</Label>
                  <Input
                    id="edit-disability-pct"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 40"
                    value={editForm.disability_percentage || ""}
                    onChange={(e) => setEditForm({ ...editForm, disability_percentage: e.target.value })}
                    className="mt-1 w-32"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingUser}>
                {isSavingUser ? (
                  <>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Delete Document Confirmation */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{docToDelete?.file_name}</span> ({docToDelete?.doc_type})? This will permanently remove the certificate from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDoc}
              disabled={isDeletingDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingDoc ? "Deleting..." : "Delete Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
