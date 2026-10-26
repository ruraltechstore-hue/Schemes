import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, ShieldAlert, Video, Loader2, RotateCcw, AlertCircle, X, Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BulkUpload } from "@/components/BulkUpload";
import { AdminVideoUploader } from "@/components/AdminVideoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin, useSchemes } from "@/hooks/use-app-data";
import type { Eligibility, Scheme } from "@/lib/matching";
import { getSchemeVideo, isYouTubeUrl } from "@/lib/video-helpers";
import { CASTE_CATEGORIES, DOC_TYPES, GENDERS, OCCUPATIONS, SCHEME_CATEGORIES, STATES } from "@/lib/constants";
import { splitRequiredDocuments } from "@/lib/document-helpers";

export default Admin;

type Form = Omit<Scheme, "id" | "created_at" | "eligibility"> & {
  id?: string;
  eligibility: Eligibility;
  application_video_url?: string | null;
  video_type?: string | null;
};

const empty: Form = {
  name: "",
  description: "",
  ministry: "",
  category: "Social Welfare",
  level: "Central",
  state: null,
  benefits: "",
  eligibility: {},
  eligibility_text: "",
  required_documents: [],
  apply_url: "",
  application_video_url: null,
  video_type: null,
};

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const v = value ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(v.includes(o) ? v.filter((x) => x !== o) : [...v, o])}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            v.includes(o) ? "border-primary bg-primary text-primary-foreground font-medium" : "bg-card hover:bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Admin() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const { data: schemes } = useSchemes();
  const qc = useQueryClient();

  // Dialog and form state
  const [f, setF] = useState<Form | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingScheme, setIsLoadingScheme] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customDocInput, setCustomDocInput] = useState("");

  // Bulk selection and deletion state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedLevel, setSelectedLevel] = useState<string>("All");

  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-2 font-medium">Admin access required.</p>
      </div>
    );
  }

  const e = f?.eligibility ?? {};

  const setE = (k: keyof Eligibility, v: unknown) => {
    if (f) {
      setF({
        ...f,
        eligibility: {
          ...f.eligibility,
          [k]: v === "" || v === undefined || (Array.isArray(v) && !v.length) || v === false ? undefined : v,
        },
      });
    }
  };

  const num = (v: string) => (v === "" ? undefined : Number(v));

  // Opens dialog and fetches latest scheme record from database by ID
  const openEditScheme = async (schemeId: string) => {
    setSelectedSchemeId(schemeId);
    setIsDialogOpen(true);
    setIsLoadingScheme(true);
    setFetchError(null);
    setCustomDocInput("");

    try {
      const { data, error } = await supabase
        .from("schemes")
        .select("*")
        .eq("id", schemeId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Scheme not found in database.");

      const vid = getSchemeVideo(data);
      const rawElig =
        typeof data.eligibility === "string" ? JSON.parse(data.eligibility) : data.eligibility || {};

      const appProcess = rawElig.application_process || (data as any).application_process || "";
      const appDeadline = rawElig.application_deadline || (data as any).application_deadline || "";

      setF({
        id: data.id,
        name: data.name || "",
        description: data.description || "",
        ministry: data.ministry || "",
        category: data.category || "Social Welfare",
        level: data.level || "Central",
        state: data.state || null,
        benefits: data.benefits || "",
        eligibility_text: data.eligibility_text || "",
        required_documents: splitRequiredDocuments(data.required_documents),
        apply_url: data.apply_url || "",
        application_video_url: vid.url,
        video_type: vid.type,
        eligibility: {
          ...rawElig,
          application_process: appProcess || undefined,
          application_deadline: appDeadline || undefined,
          application_video_url: vid.url || undefined,
          video_type: vid.type || undefined,
        },
      });
    } catch (err: any) {
      console.error("Failed to load scheme:", err);
      setFetchError(err.message || "Failed to load scheme details");
      toast.error("Failed to load scheme: " + (err.message || "Unknown error"));
    } finally {
      setIsLoadingScheme(false);
    }
  };

  // Opens dialog for creating a brand new scheme
  const openAddScheme = () => {
    setSelectedSchemeId(null);
    setFetchError(null);
    setIsLoadingScheme(false);
    setCustomDocInput("");
    setF({ ...empty });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setF(null);
    setSelectedSchemeId(null);
    setFetchError(null);
    setIsLoadingScheme(false);
  };

  // Adds custom required document(s)
  const addCustomDoc = () => {
    if (!f || !customDocInput.trim()) return;
    const docsToAdd = splitRequiredDocuments(customDocInput.trim());
    const updated = [...f.required_documents];
    for (const doc of docsToAdd) {
      if (!updated.includes(doc)) {
        updated.push(doc);
      }
    }
    setF({ ...f, required_documents: updated });
    setCustomDocInput("");
  };

  // Saves modified or new scheme to database
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!f) return;
    setIsSaving(true);

    const { id, ...row } = f;
    const elig = JSON.parse(JSON.stringify(row.eligibility));

    // Clean up undefined / empty values in eligibility JSON
    const cleanedElig: any = {};
    for (const [k, v] of Object.entries(elig)) {
      if (v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)) {
        cleanedElig[k] = v;
      }
    }

    if (f.application_video_url) {
      cleanedElig.application_video_url = f.application_video_url;
      cleanedElig.video_type = f.video_type || (isYouTubeUrl(f.application_video_url) ? "youtube" : "uploaded");
    }
    if (f.eligibility?.application_process) {
      cleanedElig.application_process = f.eligibility.application_process;
    }
    if (f.eligibility?.application_deadline) {
      cleanedElig.application_deadline = f.eligibility.application_deadline;
    }

    const rowToSave: any = {
      ...row,
      apply_url: f.apply_url?.trim() || "",
      state: f.level === "State" ? f.state || null : null,
      application_video_url: f.application_video_url || null,
      video_type: f.video_type || null,
      eligibility: cleanedElig,
    };

    try {
      let res = id
        ? await supabase.from("schemes").update(rowToSave).eq("id", id)
        : await supabase.from("schemes").insert(rowToSave);

      // Fallback if dedicated video columns are not yet cached by PostgREST
      if (res.error && res.error.message?.includes("application_video_url")) {
        const { application_video_url, video_type, ...fallbackRow } = rowToSave;
        res = id
          ? await supabase.from("schemes").update(fallbackRow).eq("id", id)
          : await supabase.from("schemes").insert(fallbackRow);
      }

      if (res.error) throw res.error;

      toast.success(id ? "Scheme updated successfully" : "Scheme added successfully");
      closeDialog();
      qc.invalidateQueries({ queryKey: ["schemes"] });
    } catch (err: any) {
      console.error("Save scheme error:", err);
      toast.error("Failed to save scheme: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Filter schemes based on search, category, and level
  const displayedSchemes = (schemes ?? []).filter((s) => {
    const matchesSearch =
      !searchTerm ||
      `${s.name} ${s.description} ${s.ministry} ${s.benefits}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || s.category === selectedCategory;
    const matchesLevel = selectedLevel === "All" || s.level === selectedLevel;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  const allDisplayedSelected =
    displayedSchemes.length > 0 &&
    displayedSchemes.every((s) => selectedIds.has(s.id));

  const someDisplayedSelected =
    displayedSchemes.some((s) => selectedIds.has(s.id)) && !allDisplayedSelected;

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const next = new Set(selectedIds);
    if (checked) {
      displayedSchemes.forEach((s) => next.add(s.id));
    } else {
      displayedSchemes.forEach((s) => next.delete(s.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectScheme = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) {
      toast.error("Unauthorized: Admin access required.");
      return;
    }
    if (selectedIds.size === 0) return;

    setIsBulkDeleting(true);
    const idsToDelete = Array.from(selectedIds);

    try {
      const { error } = await supabase
        .from("schemes")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      const count = idsToDelete.length;
      toast.success(
        `Successfully deleted ${count} ${count === 1 ? "scheme" : "schemes"}`
      );
      setSelectedIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["schemes"] });
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      toast.error("Failed to delete schemes: " + (err.message || "Unknown error"));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this scheme?")) return;
    const { error } = await supabase.from("schemes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Scheme deleted");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    qc.invalidateQueries({ queryKey: ["schemes"] });
  };

  return (
    <div>
      <PageHeader
        title="Admin · Schemes"
        subtitle={`${schemes?.length ?? 0} schemes in database`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="gap-1.5"
                data-testid="header-bulk-delete-button"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
            <Button asChild variant="outline" className="gap-1.5">
              <a href="/admin/profile">
                <User className="h-4 w-4" />
                Admin Profile
              </a>
            </Button>
            <BulkUpload existingSchemes={schemes ?? []} />
            <Button onClick={openAddScheme} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add scheme
            </Button>
          </div>
        }
      />

      {/* Search and Filters Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search schemes by name, ministry, benefits…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {SCHEME_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Levels</SelectItem>
            <SelectItem value="Central">Central</SelectItem>
            <SelectItem value="State">State</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || selectedCategory !== "All" || selectedLevel !== "All") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("All");
              setSelectedLevel("All");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground animate-in fade-in"
          data-testid="bulk-actions-bar"
        >
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="font-semibold">
              {selectedIds.size} selected
            </Badge>
            <span className="text-sm font-medium">
              {selectedIds.size} of {displayedSchemes.length} schemes selected
              {(searchTerm || selectedCategory !== "All" || selectedLevel !== "All") && " (filtered view)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={clearSelection}
              className="text-xs"
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              className="gap-1.5"
              data-testid="bulk-delete-button"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={
                    displayedSchemes.length > 0 && allDisplayedSelected
                      ? true
                      : someDisplayedSelected
                      ? "indeterminate"
                      : false
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all schemes"
                  title={allDisplayedSelected ? "Deselect all schemes" : "Select all schemes"}
                  data-testid="select-all-checkbox"
                />
              </th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Level / State</th>
              <th className="p-3">Docs</th>
              <th className="p-3">Video</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedSchemes.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No schemes found matching your criteria.
                </td>
              </tr>
            ) : (
              displayedSchemes.map((s) => {
                const isSelected = selectedIds.has(s.id);
                const vid = getSchemeVideo(s);
                return (
                  <tr
                    key={s.id}
                    className={`border-t transition-colors ${
                      isSelected ? "bg-muted/60" : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="p-3 w-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectScheme(s.id)}
                        aria-label={`Select ${s.name}`}
                        data-testid={`select-scheme-${s.id}`}
                      />
                    </td>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{s.category}</td>
                    <td className="p-3">
                      <span>{s.level}</span>
                      {s.state && <span className="text-xs text-muted-foreground ml-1">({s.state})</span>}
                    </td>
                    <td className="p-3">{splitRequiredDocuments(s.required_documents).length}</td>
                    <td className="p-3">
                      {vid.url ? (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5 text-xs">
                          <Video className="h-3 w-3" />
                          {vid.type === "youtube" ? "YouTube" : "Uploaded"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditScheme(s.id)}
                        title="Edit scheme"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => del(s.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete scheme"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Selected Schemes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected {selectedIds.size === 1 ? "scheme" : "schemes"}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              data-testid="confirm-bulk-delete-button"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedIds.size} {selectedIds.size === 1 ? "Scheme" : "Schemes"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit / Add Scheme Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => (!o ? closeDialog() : null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isLoadingScheme
                ? "Loading scheme..."
                : f?.id
                ? "Edit scheme"
                : "Add new scheme"}
            </DialogTitle>
          </DialogHeader>

          {isLoadingScheme ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Fetching scheme details from database...</p>
              <p className="text-xs text-muted-foreground mt-1">Populating all saved fields</p>
            </div>
          ) : fetchError ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="text-base font-semibold text-destructive">Failed to load scheme</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{fetchError}</p>
              <div className="pt-2 flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={closeDialog}>
                  Close
                </Button>
                {selectedSchemeId && (
                  <Button size="sm" onClick={() => openEditScheme(selectedSchemeId)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ) : f ? (
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>Scheme name *</Label>
                <Input
                  required
                  value={f.name}
                  onChange={(x) => setF({ ...f, name: x.target.value })}
                  placeholder="e.g. PM Kisan Samman Nidhi"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={f.description}
                  onChange={(x) => setF({ ...f, description: x.target.value })}
                  placeholder="Detailed overview and scope of the scheme"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Department / Ministry</Label>
                  <Input
                    value={f.ministry}
                    onChange={(x) => setF({ ...f, ministry: x.target.value })}
                    placeholder="e.g. Ministry of Agriculture"
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEME_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Government Type</Label>
                  <Select
                    value={f.level}
                    onValueChange={(v) =>
                      setF({ ...f, level: v, state: v === "Central" ? null : f.state })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Central">Central Government</SelectItem>
                      <SelectItem value="State">State Government</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {f.level === "State" ? (
                  <div>
                    <Label>State</Label>
                    <Select
                      value={f.state || ""}
                      onValueChange={(v) => setF({ ...f, state: v || null })}
                    >
                      <SelectTrigger>
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
                ) : (
                  <div>
                    <Label>Official application URL</Label>
                    <Input
                      type="url"
                      value={f.apply_url}
                      onChange={(x) => setF({ ...f, apply_url: x.target.value })}
                      placeholder="https://... (Optional)"
                    />
                  </div>
                )}
              </div>

              {f.level === "State" && (
                <div>
                  <Label>Official application URL</Label>
                  <Input
                    type="url"
                    value={f.apply_url}
                    onChange={(x) => setF({ ...f, apply_url: x.target.value })}
                    placeholder="https://... (Optional)"
                  />
                </div>
              )}

              <div>
                <Label>Benefits</Label>
                <Textarea
                  rows={2}
                  value={f.benefits}
                  onChange={(x) => setF({ ...f, benefits: x.target.value })}
                  placeholder="Details of financial assistance, subsidy, or physical grants"
                />
              </div>

              <div>
                <Label>Eligibility Criteria (summary shown to users)</Label>
                <Textarea
                  rows={2}
                  value={f.eligibility_text}
                  onChange={(x) => setF({ ...f, eligibility_text: x.target.value })}
                  placeholder="Who is eligible to apply for this scheme"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Application Process</Label>
                  <Textarea
                    rows={3}
                    value={e.application_process ?? ""}
                    onChange={(x) => setE("application_process", x.target.value)}
                    placeholder="Step-by-step application instructions"
                  />
                </div>
                <div>
                  <Label>Application Deadline</Label>
                  <Input
                    type="date"
                    value={e.application_deadline ?? ""}
                    onChange={(x) => setE("application_deadline", x.target.value)}
                  />
                </div>
              </div>

              {/* Tutorial Video Section */}
              <AdminVideoUploader
                videoUrl={f.application_video_url}
                videoType={f.video_type as any}
                schemeId={f.id}
                onChange={(url, type) =>
                  setF({ ...f, application_video_url: url, video_type: type })
                }
              />

              {/* Eligibility Rules */}
              <fieldset className="space-y-3 rounded-md border p-4 bg-muted/20">
                <legend className="px-1 text-sm font-semibold">Structured eligibility rules</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Min age</Label>
                    <Input
                      type="number"
                      value={e.min_age ?? ""}
                      onChange={(x) => setE("min_age", num(x.target.value))}
                      placeholder="e.g. 18"
                    />
                  </div>
                  <div>
                    <Label>Max age</Label>
                    <Input
                      type="number"
                      value={e.max_age ?? ""}
                      onChange={(x) => setE("max_age", num(x.target.value))}
                      placeholder="e.g. 60"
                    />
                  </div>
                  <div>
                    <Label>Max income (₹)</Label>
                    <Input
                      type="number"
                      value={e.max_income ?? ""}
                      onChange={(x) => setE("max_income", num(x.target.value))}
                      placeholder="e.g. 250000"
                    />
                  </div>
                </div>

                <div>
                  <Label>Residence area</Label>
                  <Select
                    value={e.area ?? "any"}
                    onValueChange={(v) => setE("area", v === "any" ? undefined : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any (Rural & Urban)</SelectItem>
                      <SelectItem value="Rural">Rural Only</SelectItem>
                      <SelectItem value="Urban">Urban Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Gender</Label>
                  <Chips options={GENDERS} value={e.genders} onChange={(v) => setE("genders", v)} />
                </div>

                <div>
                  <Label>Social Category</Label>
                  <Chips options={CASTE_CATEGORIES} value={e.categories} onChange={(v) => setE("categories", v)} />
                </div>

                <div>
                  <Label>Occupation</Label>
                  <Chips options={OCCUPATIONS} value={e.occupations} onChange={(v) => setE("occupations", v)} />
                </div>

                <div>
                  <Label>States (leave empty for All India)</Label>
                  <Chips options={STATES} value={e.states} onChange={(v) => setE("states", v)} />
                </div>

                <div className="grid gap-2 sm:grid-cols-3 pt-1">
                  {(
                    [
                      ["farmer", "Farmers only"],
                      ["student", "Students only"],
                      ["disability", "Persons with Disability only"],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k} className="flex items-center justify-between rounded-md border p-2 text-xs font-medium bg-card">
                      {l}
                      <Switch checked={!!e[k]} onCheckedChange={(v) => setE(k, v)} />
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Required Documents Section */}
              <div className="space-y-2">
                <Label>Required documents</Label>

                {/* Selected document badges with remove button */}
                {f.required_documents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md border bg-card mb-2">
                    {f.required_documents.map((doc) => (
                      <Badge
                        key={doc}
                        variant="secondary"
                        className="gap-1 pl-2.5 pr-1 py-1 text-xs font-normal"
                      >
                        {doc}
                        <button
                          type="button"
                          onClick={() =>
                            setF({
                              ...f,
                              required_documents: f.required_documents.filter((d) => d !== doc),
                            })
                          }
                          className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
                          title={`Remove ${doc}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Common Document Chips */}
                <Chips
                  options={Array.from(new Set([...DOC_TYPES, ...f.required_documents]))}
                  value={f.required_documents}
                  onChange={(v) => setF({ ...f, required_documents: v })}
                />

                {/* Add Custom Document Input */}
                <div className="flex gap-2 pt-1.5">
                  <Input
                    placeholder="Add other required document name..."
                    value={customDocInput}
                    onChange={(e) => setCustomDocInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomDoc();
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addCustomDoc}
                    disabled={!customDocInput.trim()}
                  >
                    Add Doc
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-1.5 min-w-[120px]">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : f.id ? (
                    "Update Scheme"
                  ) : (
                    "Create Scheme"
                  )}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
