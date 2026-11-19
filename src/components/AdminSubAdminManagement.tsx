import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Search,
  KeyRound,
  Pencil,
  Power,
  Users,
  Building2,
  Mail,
  Phone,
  UserCheck,
  UserX,
  ExternalLink,
  RotateCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SUBADMIN_MIGRATION_SQL } from "@/lib/subadmin-migration-sql";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  useAllSubAdmins,
  useAllAgentProfiles,
} from "@/hooks/use-agent-data";
import {
  createSubAdminAccount,
  editSubAdminDetails,
  resetSubAdminPassword,
  toggleSubAdminActive,
} from "@/lib/subadmin-client";

export function AdminSubAdminManagement({
  onSelectSubAdminToFilter,
}: {
  onSelectSubAdminToFilter?: (subAdminId: string) => void;
}) {
  const qc = useQueryClient();
  const { data: subAdmins = [], isLoading, refetch } = useAllSubAdmins();
  const { data: allAgents = [] } = useAllAgentProfiles();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Schema state
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkTableExistence() {
      try {
        if (typeof supabase?.from !== "function") return;
        const { error } = await supabase.from("sub_admin_profiles").select("id").limit(1);
        if (
          error &&
          ((error as any).code === "PGRST205" ||
            error.message?.includes("schema cache") ||
            error.message?.includes("does not exist") ||
            error.message?.includes("sub_admin_profiles"))
        ) {
          if (isMounted) setIsTableMissing(true);
        } else if (!error) {
          if (isMounted) setIsTableMissing(false);
        }
      } catch {
        // ignore
      }
    }
    checkTableExistence();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyMigrationSql = async () => {
    try {
      await navigator.clipboard.writeText(SUBADMIN_MIGRATION_SQL);
      setCopiedSql(true);
      toast.success("Migration SQL copied to clipboard!");
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      toast.error("Failed to copy automatically. Please copy the SQL from supabase/migrations folder.");
    }
  };

  // Create Sub-Admin Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    organizationName: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
    designation: "",
    avatarUrl: "",
  });
  const [createBusy, setCreateBusy] = useState(false);

  // Edit Sub-Admin Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    organizationName: "",
    mobile: "",
    designation: "",
    avatarUrl: "",
  });
  const [editBusy, setEditBusy] = useState(false);

  // Reset Password Modal
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Toggle Active Dialog
  const [isToggleOpen, setIsToggleOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<any | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  // View Assigned Agents Modal
  const [viewAgentsTarget, setViewAgentsTarget] = useState<any | null>(null);
  const [isViewAgentsOpen, setIsViewAgentsOpen] = useState(false);

  // Count assigned agents per sub-admin
  const agentsCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allAgents.forEach((agent) => {
      if (agent.sub_admin_id) {
        map.set(agent.sub_admin_id, (map.get(agent.sub_admin_id) || 0) + 1);
      }
    });
    return map;
  }, [allAgents]);

  // Filtered sub-admins
  const filteredSubAdmins = useMemo(() => {
    return subAdmins.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.organization_name?.toLowerCase().includes(q) ||
        s.mobile?.toLowerCase().includes(q) ||
        s.designation?.toLowerCase().includes(q)
      );
    });
  }, [subAdmins, search, statusFilter]);

  const activeCount = subAdmins.filter((s) => s.is_active).length;
  const inactiveCount = subAdmins.filter((s) => !s.is_active).length;
  const distinctOrgs = new Set(subAdmins.map((s) => s.organization_name?.trim()).filter(Boolean)).size;

  // Handler: Create Sub-Admin
  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!createForm.organizationName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (!createForm.email.trim() || !createForm.email.includes("@")) {
      toast.error("Valid email address is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(createForm.mobile.trim())) {
      toast.error("Enter a valid 10-digit mobile number starting with 6-9");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!createForm.designation.trim()) {
      toast.error("Designation is required");
      return;
    }

    setCreateBusy(true);
    try {
      const res = await createSubAdminAccount({
        fullName: createForm.fullName,
        organizationName: createForm.organizationName,
        email: createForm.email,
        password: createForm.password,
        mobile: createForm.mobile,
        designation: createForm.designation,
        avatarUrl: createForm.avatarUrl || undefined,
      });

      toast.success(res.message);
      setIsCreateOpen(false);
      setCreateForm({
        fullName: "",
        organizationName: "",
        email: "",
        password: "",
        confirmPassword: "",
        mobile: "",
        designation: "",
        avatarUrl: "",
      });
      qc.invalidateQueries({ queryKey: ["allSubAdmins"] });
      qc.invalidateQueries({ queryKey: ["activeSubAdmins"] });
    } catch (err: any) {
      const errMsg = err?.message || "Unknown error";
      if (
        errMsg.includes("schema cache") ||
        errMsg.includes("sub_admin_profiles") ||
        errMsg.includes("does not exist") ||
        err?.code === "PGRST205"
      ) {
        setIsTableMissing(true);
      }
      toast.error("Failed to create Sub-Admin: " + errMsg);
    } finally {
      setCreateBusy(false);
    }
  };

  // Handler: Edit Sub-Admin
  const openEditDialog = (subAdmin: any) => {
    setEditTarget(subAdmin);
    setEditForm({
      fullName: subAdmin.full_name || "",
      organizationName: subAdmin.organization_name || "",
      mobile: subAdmin.mobile || "",
      designation: subAdmin.designation || "",
      avatarUrl: subAdmin.avatar_url || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    if (!editForm.fullName.trim() || !editForm.organizationName.trim() || !editForm.designation.trim()) {
      toast.error("Full name, organization name, and designation are required");
      return;
    }

    setEditBusy(true);
    try {
      await editSubAdminDetails({
        subAdminId: editTarget.id,
        fullName: editForm.fullName,
        organizationName: editForm.organizationName,
        mobile: editForm.mobile,
        designation: editForm.designation,
        avatarUrl: editForm.avatarUrl,
      });

      toast.success("Sub-Admin details updated successfully!");
      setIsEditOpen(false);
      qc.invalidateQueries({ queryKey: ["allSubAdmins"] });
      qc.invalidateQueries({ queryKey: ["activeSubAdmins"] });
    } catch (err: any) {
      toast.error("Failed to update Sub-Admin: " + (err.message || "Unknown error"));
    } finally {
      setEditBusy(false);
    }
  };

  // Handler: Reset Password
  const openResetPasswordDialog = (subAdmin: any) => {
    setPasswordTarget(subAdmin);
    setNewPassword("");
    setConfirmNewPassword("");
    setIsPasswordOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setPasswordBusy(true);
    try {
      await resetSubAdminPassword(passwordTarget.id, newPassword);
      toast.success(`Password reset successfully for ${passwordTarget.full_name}`);
      setIsPasswordOpen(false);
    } catch (err: any) {
      toast.error("Failed to reset password: " + (err.message || "Unknown error"));
    } finally {
      setPasswordBusy(false);
    }
  };

  // Handler: Toggle Active/Deactivate
  const openToggleDialog = (subAdmin: any) => {
    setToggleTarget(subAdmin);
    setIsToggleOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!toggleTarget) return;
    const nextState = !toggleTarget.is_active;

    setToggleBusy(true);
    try {
      await toggleSubAdminActive(toggleTarget.id, nextState);
      toast.success(
        `Sub-Admin ${toggleTarget.full_name} (${toggleTarget.organization_name}) is now ${
          nextState ? "Active" : "Deactivated"
        }.`
      );
      setIsToggleOpen(false);
      qc.invalidateQueries({ queryKey: ["allSubAdmins"] });
      qc.invalidateQueries({ queryKey: ["activeSubAdmins"] });
    } catch (err: any) {
      toast.error("Failed to update status: " + (err.message || "Unknown error"));
    } finally {
      setToggleBusy(false);
    }
  };

  // Handler: View Assigned Agents
  const openViewAgents = (subAdmin: any) => {
    setViewAgentsTarget(subAdmin);
    setIsViewAgentsOpen(true);
  };

  const agentsUnderSelectedSubAdmin = useMemo(() => {
    if (!viewAgentsTarget) return [];
    return allAgents.filter((a) => a.sub_admin_id === viewAgentsTarget.id);
  }, [allAgents, viewAgentsTarget]);

  return (
    <div className="space-y-6">
      {/* Missing Database Schema Setup Banner */}
      {isTableMissing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-bold text-amber-900">
                  Database Setup Required: Missing Sub-Admin Table
                </h4>
                <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-900 font-mono text-[11px]">
                  Schema Cache Notice
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-amber-800 leading-relaxed">
                The <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-semibold">sub_admin_profiles</code> table has not been created in your Supabase database yet. Please run the migration script once in your Supabase SQL Editor to enable Sub-Admin creation, role assignment, and agent routing.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyMigrationSql}
                  className="bg-amber-700 hover:bg-amber-800 text-white gap-1.5 text-xs font-semibold shadow-sm"
                >
                  {copiedSql ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedSql ? "SQL Copied to Clipboard!" : "Copy Migration SQL"}
                </Button>
                <a
                  href="https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition shadow-xs"
                >
                  Open Supabase SQL Editor <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("sub_admin_profiles").select("id").limit(1);
                    if (!error) {
                      setIsTableMissing(false);
                      toast.success("Database table found! Refreshing Sub-Admin data...");
                      refetch();
                      qc.invalidateQueries({ queryKey: ["allSubAdmins"] });
                      qc.invalidateQueries({ queryKey: ["activeSubAdmins"] });
                    } else {
                      toast.error("Table not found yet. Please paste the copied SQL and click 'Run' in Supabase SQL editor.");
                    }
                  }}
                  className="text-xs text-amber-900 hover:bg-amber-100/60"
                >
                  <RotateCw className="h-3.5 w-3.5 mr-1" /> Check Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Sub-Admins</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{subAdmins.length}</p>
          <span className="text-[11px] text-muted-foreground">{distinctOrgs} Partner Organizations</span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Sub-Admins</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <span className="text-[11px] text-muted-foreground">Eligible for agent assignment</span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Deactivated</span>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
          <span className="text-[11px] text-muted-foreground">Excluded from registration dropdown</span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Assigned Agents</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {allAgents.filter((a) => a.sub_admin_id).length}
          </p>
          <span className="text-[11px] text-muted-foreground">Across all organizations</span>
        </div>
      </div>

      {/* Control Bar: Search, Status Filter, Create Button */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, organization, email, or mobile..."
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex rounded-lg border bg-muted/30 p-1 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                statusFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({subAdmins.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                statusFilter === "active" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                statusFilter === "inactive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh list">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 shadow-sm"
            data-testid="create-subadmin-button"
          >
            <Plus className="h-4 w-4" />
            Create Sub-Admin
          </Button>
        </div>
      </div>

      {/* Sub-Admins Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <RotateCw className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">Loading Sub-Admin accounts...</p>
          </div>
        ) : filteredSubAdmins.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="rounded-full bg-muted p-3">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold">No Sub-Admins Found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? "No Sub-Admin matching your search criteria. Try modifying your filters."
                  : "No Sub-Admin accounts exist yet. Click 'Create Sub-Admin' to set up partner organization managers."}
              </p>
            </div>
            {!search.trim() && (
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2 mt-2">
                <Plus className="h-4 w-4" />
                Create First Sub-Admin
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Sub-Admin & Organization</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Assigned Agents</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubAdmins.map((subAdmin) => {
                  const assignedCount = agentsCountMap.get(subAdmin.id) || 0;
                  return (
                    <tr
                      key={subAdmin.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        !subAdmin.is_active ? "opacity-75 bg-muted/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                            {subAdmin.full_name?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {subAdmin.full_name}
                              {!subAdmin.is_active && (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                                  Deactivated
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                              <Building2 className="h-3 w-3" />
                              <span>{subAdmin.organization_name}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{subAdmin.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{subAdmin.mobile}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted font-medium text-foreground">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          {subAdmin.designation || "Sub-Admin"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={subAdmin.is_active}
                            onCheckedChange={() => openToggleDialog(subAdmin)}
                            aria-label={`Toggle active state for ${subAdmin.full_name}`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              subAdmin.is_active ? "text-emerald-700" : "text-destructive"
                            }`}
                          >
                            {subAdmin.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => openViewAgents(subAdmin)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          title="Click to view assigned agents"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>{assignedCount} {assignedCount === 1 ? "Agent" : "Agents"}</span>
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(subAdmin)}
                            title="Edit details"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetPasswordDialog(subAdmin)}
                            title="Reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Sub-Admin */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Create New Sub-Admin Account
            </DialogTitle>
          </DialogHeader>

          {isTableMissing && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Database migration required in Supabase</span>
              </div>
              <p>
                The table <code className="bg-amber-100 font-mono text-[11px] px-1 py-0.5 rounded font-semibold">sub_admin_profiles</code> needs to be created in your Supabase project before creating Sub-Admins.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyMigrationSql}
                  className="border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
                >
                  {copiedSql ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copiedSql ? "Copied SQL" : "Copy SQL"}
                </Button>
                <a
                  href="https://supabase.com/dashboard/project/vwzzljeawkerdugpmgvn/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-900 underline font-medium hover:text-amber-950"
                >
                  Open Supabase SQL Editor <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateSubAdmin} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-full-name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="create-full-name"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="e.g. Rajesh Kumar"
                />
              </div>

              <div>
                <Label htmlFor="create-org-name">Organization Name <span className="text-destructive">*</span></Label>
                <Input
                  id="create-org-name"
                  required
                  value={createForm.organizationName}
                  onChange={(e) => setCreateForm({ ...createForm, organizationName: e.target.value })}
                  placeholder="e.g. Navogiz Foundation"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-email">Email (Login ID) <span className="text-destructive">*</span></Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="subadmin@partner.org"
                />
              </div>

              <div>
                <Label htmlFor="create-mobile">Mobile Number <span className="text-destructive">*</span></Label>
                <Input
                  id="create-mobile"
                  required
                  maxLength={10}
                  value={createForm.mobile}
                  onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                  placeholder="10-digit mobile"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="create-designation">Designation <span className="text-destructive">*</span></Label>
              <Input
                id="create-designation"
                required
                value={createForm.designation}
                onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                placeholder="e.g. Regional Lead / Partner Director"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-password">Password <span className="text-destructive">*</span></Label>
                <PasswordInput
                  id="create-password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <Label htmlFor="create-confirm-password">Confirm Password <span className="text-destructive">*</span></Label>
                <PasswordInput
                  id="create-confirm-password"
                  required
                  minLength={6}
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="create-avatar">Profile Photo URL (Optional)</Label>
              <Input
                id="create-avatar"
                value={createForm.avatarUrl}
                onChange={(e) => setCreateForm({ ...createForm, avatarUrl: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                <b>Note:</b> Sub-Admins will use this email and password to log in through the portal.
                Creating this account will not interrupt your current Main Admin session.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={createBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBusy} className="gap-2">
                {createBusy && <RotateCw className="h-4 w-4 animate-spin" />}
                {createBusy ? "Creating Account..." : "Create Sub-Admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Edit Sub-Admin Details */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Sub-Admin Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-org">Organization Name</Label>
              <Input
                id="edit-org"
                required
                value={editForm.organizationName}
                onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                required
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-mobile">Mobile Number</Label>
              <Input
                id="edit-mobile"
                required
                maxLength={10}
                value={editForm.mobile}
                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-avatar">Profile Photo URL</Label>
              <Input
                id="edit-avatar"
                value={editForm.avatarUrl}
                onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={editBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy} className="gap-2">
                {editBusy && <RotateCw className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Reset Password */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Sub-Admin Password
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Set a new login password for <b>{passwordTarget?.full_name}</b> ({passwordTarget?.email}).
            </p>

            <div>
              <Label htmlFor="reset-new-password">New Password</Label>
              <PasswordInput
                id="reset-new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
              <PasswordInput
                id="reset-confirm-password"
                required
                minLength={6}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPasswordOpen(false)} disabled={passwordBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={passwordBusy} className="gap-2 bg-amber-600 hover:bg-amber-700">
                {passwordBusy && <RotateCw className="h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Toggle Active Confirmation */}
      <AlertDialog open={isToggleOpen} onOpenChange={setIsToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className={`h-5 w-5 ${toggleTarget?.is_active ? "text-destructive" : "text-emerald-600"}`} />
              {toggleTarget?.is_active ? "Deactivate Sub-Admin Account?" : "Reactivate Sub-Admin Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Are you sure you want to {toggleTarget?.is_active ? "deactivate" : "activate"} <b>{toggleTarget?.full_name}</b> ({toggleTarget?.organization_name})?
              </span>
              {toggleTarget?.is_active ? (
                <p className="text-destructive text-xs font-medium">
                  When deactivated, this Sub-Admin cannot log in, access the dashboard, or approve agents. Their organization will also be hidden from new agent registrations.
                </p>
              ) : (
                <p className="text-emerald-700 text-xs font-medium">
                  Once reactivated, this Sub-Admin will regain login access and will immediately appear as an option during agent registration.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={toggleBusy}
              className={toggleTarget?.is_active ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-emerald-600 text-white hover:bg-emerald-700"}
            >
              {toggleBusy ? "Updating..." : toggleTarget?.is_active ? "Deactivate Account" : "Activate Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL 5: View Assigned Agents */}
      <Dialog open={isViewAgentsOpen} onOpenChange={setIsViewAgentsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Agents Assigned to {viewAgentsTarget?.full_name} ({viewAgentsTarget?.organization_name})
              </span>
              <Badge variant="outline" className="text-xs">
                {agentsUnderSelectedSubAdmin.length} Assigned
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {agentsUnderSelectedSubAdmin.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No agents are currently assigned to this Sub-Admin.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border">
                {agentsUnderSelectedSubAdmin.map((agent) => (
                  <div key={agent.id} className="p-3.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{agent.full_name}</p>
                      <p className="text-xs text-muted-foreground">{agent.email} · {agent.mobile}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {agent.agency_name} · {agent.district}, {agent.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          agent.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : agent.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : agent.status === "suspended"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewAgentsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
