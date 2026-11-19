import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  Users,
  FileText,
  FileBarChart,
  User,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  RotateCw,
  Search,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useUser, useIsSubAdmin, useSubAdminProfile } from "@/hooks/use-app-data";
import {
  useSubAdminAgents,
  useSubAdminApprovalHistory,
} from "@/hooks/use-agent-data";
import { editSubAdminDetails } from "@/lib/subadmin-client";

export default SubAdminDashboard;

function SubAdminDashboard() {
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { data: isSubAdmin, isLoading: roleLoading } = useIsSubAdmin();
  const { data: subAdminProfile, isLoading: profileLoading } = useSubAdminProfile(user?.id);
  const { data: myAgents = [], isLoading: agentsLoading, refetch: refetchAgents } = useSubAdminAgents(user?.id);
  const { data: approvalHistory = [] } = useSubAdminApprovalHistory(undefined, user?.id);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "overview" | "approvals" | "agents" | "beneficiaries" | "reports" | "profile"
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (
      tabParam &&
      ["overview", "approvals", "agents", "beneficiaries", "reports", "profile"].includes(tabParam)
    ) {
      return tabParam as any;
    }
    return "overview";
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (
      tabParam &&
      ["overview", "approvals", "agents", "beneficiaries", "reports", "profile"].includes(tabParam)
    ) {
      setActiveTab(tabParam as any);
    }
  }, [location.search]);

  // Query beneficiaries registered by agents of this Sub-Admin
  const agentIds = useMemo(() => myAgents.map((a) => a.id), [myAgents]);
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery({
    queryKey: ["subAdminBeneficiaries", agentIds],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("managed_users")
          .select("*")
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Error fetching beneficiaries:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("Failed fetching beneficiaries:", err);
        return [];
      }
    },
  });

  // Approvals & Action Dialog States
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isViewAgentOpen, setIsViewAgentOpen] = useState(false);

  // Approve Dialog
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<any | null>(null);

  // Reject Dialog
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Suspend Dialog
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Reactivate Dialog
  const [isReactivateOpen, setIsReactivateOpen] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState<any | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    mobile: "",
    designation: "",
    avatarUrl: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (subAdminProfile) {
      setProfileForm({
        fullName: subAdminProfile.full_name || "",
        mobile: subAdminProfile.mobile || "",
        designation: subAdminProfile.designation || "",
        avatarUrl: subAdminProfile.avatar_url || "",
      });
    }
  }, [subAdminProfile]);

  // Derived counts
  const pendingAgents = useMemo(() => myAgents.filter((a) => a.status === "pending" && a.email_verified !== false), [myAgents]);
  const approvedAgents = useMemo(() => myAgents.filter((a) => a.status === "approved"), [myAgents]);
  const suspendedAgents = useMemo(() => myAgents.filter((a) => a.status === "suspended"), [myAgents]);
  const rejectedAgents = useMemo(() => myAgents.filter((a) => a.status === "rejected"), [myAgents]);

  // Agent Map for lookup
  const agentMap = useMemo(() => new Map(myAgents.map((a) => [a.id, a])), [myAgents]);

  // Search states
  const [agentSearch, setAgentSearch] = useState("");
  const [beneficiarySearch, setBeneficiarySearch] = useState("");

  // Handler: Approve Agent
  const openApprove = (agent: any) => {
    setApproveTarget(agent);
    setIsApproveOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "approved",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
          suspension_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", approveTarget.id);

      if (error) throw error;

      // Insert audit history
      try {
        await supabase.from("agent_approval_history").insert({
          agent_id: approveTarget.id,
          sub_admin_id: user?.id ?? null,
          action: "approved",
          previous_status: approveTarget.status || "pending",
          new_status: "approved",
          actioned_by: user?.id || approveTarget.id,
        });
      } catch (auditErr) {
        console.warn("Audit log error:", auditErr);
      }

      toast.success(`Agent ${approveTarget.full_name} has been approved!`);
      setIsApproveOpen(false);
      refetchAgents();
      qc.invalidateQueries({ queryKey: ["subAdminAgents"] });
    } catch (err: any) {
      toast.error("Approval failed: " + (err.message || "Unknown error"));
    } finally {
      setActionBusy(false);
    }
  };

  // Handler: Reject Agent
  const openReject = (agent: any) => {
    setRejectTarget(agent);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim(),
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rejectTarget.id);

      if (error) throw error;

      try {
        await supabase.from("agent_approval_history").insert({
          agent_id: rejectTarget.id,
          sub_admin_id: user?.id ?? null,
          action: "rejected",
          previous_status: rejectTarget.status || "pending",
          new_status: "rejected",
          reason: rejectReason.trim(),
          actioned_by: user?.id || rejectTarget.id,
        });
      } catch (auditErr) {
        console.warn("Audit log error:", auditErr);
      }

      toast.success(`Agent registration for ${rejectTarget.full_name} has been rejected.`);
      setIsRejectOpen(false);
      refetchAgents();
      qc.invalidateQueries({ queryKey: ["subAdminAgents"] });
    } catch (err: any) {
      toast.error("Rejection failed: " + (err.message || "Unknown error"));
    } finally {
      setActionBusy(false);
    }
  };

  // Handler: Suspend Agent
  const openSuspend = (agent: any) => {
    setSuspendTarget(agent);
    setSuspendReason("");
    setIsSuspendOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "suspended",
          suspension_reason: suspendReason.trim() || "Suspended by organization Sub-Admin.",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", suspendTarget.id);

      if (error) throw error;

      try {
        await supabase.from("agent_approval_history").insert({
          agent_id: suspendTarget.id,
          sub_admin_id: user?.id ?? null,
          action: "suspended",
          previous_status: suspendTarget.status || "approved",
          new_status: "suspended",
          reason: suspendReason.trim(),
          actioned_by: user?.id || suspendTarget.id,
        });
      } catch (auditErr) {
        console.warn("Audit log error:", auditErr);
      }

      toast.success(`Agent ${suspendTarget.full_name} access suspended.`);
      setIsSuspendOpen(false);
      refetchAgents();
      qc.invalidateQueries({ queryKey: ["subAdminAgents"] });
    } catch (err: any) {
      toast.error("Suspension failed: " + (err.message || "Unknown error"));
    } finally {
      setActionBusy(false);
    }
  };

  // Handler: Reactivate Agent
  const openReactivate = (agent: any) => {
    setReactivateTarget(agent);
    setIsReactivateOpen(true);
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateTarget) return;
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "approved",
          suspension_reason: null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reactivateTarget.id);

      if (error) throw error;

      try {
        await supabase.from("agent_approval_history").insert({
          agent_id: reactivateTarget.id,
          sub_admin_id: user?.id ?? null,
          action: "reactivated",
          previous_status: reactivateTarget.status || "suspended",
          new_status: "approved",
          actioned_by: user?.id || reactivateTarget.id,
        });
      } catch (auditErr) {
        console.warn("Audit log error:", auditErr);
      }

      toast.success(`Agent ${reactivateTarget.full_name} has been reactivated!`);
      setIsReactivateOpen(false);
      refetchAgents();
      qc.invalidateQueries({ queryKey: ["subAdminAgents"] });
    } catch (err: any) {
      toast.error("Reactivation failed: " + (err.message || "Unknown error"));
    } finally {
      setActionBusy(false);
    }
  };

  // Handler: Save Profile Settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !subAdminProfile) return;
    setProfileSaving(true);
    try {
      await editSubAdminDetails({
        subAdminId: user.id,
        fullName: profileForm.fullName,
        organizationName: subAdminProfile.organization_name,
        designation: profileForm.designation,
        mobile: profileForm.mobile,
        avatarUrl: profileForm.avatarUrl,
      });

      toast.success("Profile updated successfully!");
      qc.invalidateQueries({ queryKey: ["subAdminProfile", user.id] });
    } catch (err: any) {
      toast.error("Failed to save profile: " + (err.message || "Unknown error"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    navigate(`/sub-admin?tab=${tab}`, { replace: true });
  };

  if (roleLoading || profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RotateCw className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading Sub-Admin Dashboard...</span>
      </div>
    );
  }

  if (!roleLoading && !isSubAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold">Unauthorized Access</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You do not have Sub-Admin privileges to view this portal.
        </p>
        <Button onClick={() => navigate("/dashboard")} variant="outline">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (!profileLoading && subAdminProfile && subAdminProfile.is_active === false) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold text-destructive">Account Deactivated</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your Sub-Admin account ({subAdminProfile.organization_name}) has been deactivated by the Main Administrator. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-md">
            {subAdminProfile?.organization_name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {subAdminProfile?.organization_name || "Partner Organization"}
              </h1>
              <Badge className="bg-primary/20 text-primary border-primary/30">
                Sub-Admin Portal
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome, <span className="font-semibold text-foreground">{subAdminProfile?.full_name}</span> ({subAdminProfile?.designation || "Sub-Admin"}) · Assigned agent routing & beneficiary governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchAgents();
              toast.success("Dashboard data refreshed");
            }}
            className="gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1 border-b">
        <button
          type="button"
          onClick={() => handleTabChange("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("approvals")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "approvals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Agent Approvals
          {pendingAgents.length > 0 && (
            <Badge className="bg-amber-500 text-white px-1.5 py-0 text-[11px] font-bold">
              {pendingAgents.length}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("agents")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "agents"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          My Agents ({approvedAgents.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("beneficiaries")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "beneficiaries"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Beneficiaries ({beneficiaries.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("reports")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "reports"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileBarChart className="h-4 w-4" />
          Performance
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("profile")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Profile
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics strictly isolated to this Sub-Admin */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Assigned Agents</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{myAgents.length}</p>
              <span className="text-[11px] text-muted-foreground">Under {subAdminProfile?.organization_name}</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Active Agents</span>
                <UserCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{approvedAgents.length}</p>
              <span className="text-[11px] text-muted-foreground">Approved and working</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Pending Approvals</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-600">{pendingAgents.length}</p>
              <span className="text-[11px] text-muted-foreground">Awaiting your review</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Beneficiaries Registered</span>
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-600">{beneficiaries.length}</p>
              <span className="text-[11px] text-muted-foreground">Citizens enrolled</span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Approval Actions</span>
                <TrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-indigo-600">{approvalHistory.length}</p>
              <span className="text-[11px] text-muted-foreground">Total decisions logged</span>
            </div>
          </div>

          {/* Pending Approval Requests Section */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Pending Agent Approval Requests
                </h3>
                <p className="text-xs text-muted-foreground">
                  New agents who registered and chose your organization for verification.
                </p>
              </div>
              {pendingAgents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTabChange("approvals")}
                  className="gap-1 text-xs"
                >
                  View All ({pendingAgents.length}) <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {pendingAgents.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                No pending registration requests for your organization.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border overflow-hidden">
                {pendingAgents.slice(0, 3).map((agent) => (
                  <div key={agent.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="font-semibold text-foreground">{agent.full_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{agent.agency_name}</span>
                        <span>·</span>
                        <span>{agent.district}, {agent.state}</span>
                        <span>·</span>
                        <span>{agent.mobile}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openApprove(agent)} className="h-8 gap-1 text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openReject(agent)} className="h-8 gap-1 text-destructive hover:bg-destructive/10">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AGENT APPROVALS */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pending Agent Approvals</h2>
              <p className="text-xs text-muted-foreground">
                Review and approve agents applying to represent {subAdminProfile?.organization_name}.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {pendingAgents.length} Pending
            </Badge>
          </div>

          {pendingAgents.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-semibold text-foreground">All Caught Up!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No pending registration requests are currently awaiting approval for your organization.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3">Agent & Agency</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Registered At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{agent.full_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {agent.agency_name}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground space-y-0.5">
                        <div>{agent.email}</div>
                        <div>{agent.mobile}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div>{agent.district}</div>
                        <div className="text-muted-foreground">{agent.state}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {agent.created_at
                          ? new Date(agent.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1"
                            onClick={() => openApprove(agent)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 h-8 gap-1"
                            onClick={() => openReject(agent)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
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
      )}

      {/* TAB 3: MY AGENTS */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search approved agents by name, email, district..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Badge variant="outline" className="text-xs">
              {approvedAgents.length} Active Agents
            </Badge>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Agency</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myAgents
                  .filter((a) => {
                    if (a.status === "pending") return false;
                    if (!agentSearch.trim()) return true;
                    const q = agentSearch.toLowerCase();
                    return (
                      a.full_name?.toLowerCase().includes(q) ||
                      a.email?.toLowerCase().includes(q) ||
                      a.agency_name?.toLowerCase().includes(q) ||
                      a.district?.toLowerCase().includes(q)
                    );
                  })
                  .map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        {agent.full_name}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {agent.agency_name}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div>{agent.email}</div>
                        <div>{agent.mobile}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {agent.district}, {agent.state}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          className={
                            agent.status === "approved"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : agent.status === "suspended"
                              ? "bg-orange-100 text-orange-900 border-orange-300"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {agent.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {agent.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-700 hover:bg-amber-50 h-8 gap-1"
                              onClick={() => openSuspend(agent)}
                            >
                              <PauseCircle className="h-3.5 w-3.5" />
                              Suspend
                            </Button>
                          )}
                          {agent.status === "suspended" && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1"
                              onClick={() => openReactivate(agent)}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BENEFICIARY DIRECTORY */}
      {activeTab === "beneficiaries" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search citizens by name, mobile, district..."
                value={beneficiarySearch}
                onChange={(e) => setBeneficiarySearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Badge variant="outline" className="text-xs">
              {beneficiaries.length} Registered Citizens
            </Badge>
          </div>

          {beneficiariesLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RotateCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading beneficiaries...
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center space-y-2">
              <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <h3 className="font-semibold text-foreground">No Beneficiaries Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Once approved agents register beneficiaries in the portal, they will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3">Beneficiary</th>
                    <th className="px-4 py-3">Category & Gender</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Added By Agent</th>
                    <th className="px-4 py-3">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {beneficiaries
                    .filter((b) => {
                      if (!beneficiarySearch.trim()) return true;
                      const q = beneficiarySearch.toLowerCase();
                      return (
                        b.full_name?.toLowerCase().includes(q) ||
                        b.mobile?.toLowerCase().includes(q) ||
                        b.district?.toLowerCase().includes(q)
                      );
                    })
                    .map((b) => {
                      const agent = agentMap.get(b.agent_id);
                      return (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-foreground">{b.full_name}</div>
                            <div className="text-xs text-muted-foreground">{b.mobile || "No mobile"}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div>{b.category || "General"}</div>
                            <div className="text-muted-foreground">{b.gender || "Not specified"} · {b.age ? `${b.age} yrs` : ""}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div>{b.district || ""}</div>
                            <div className="text-muted-foreground">{b.state || ""}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div className="font-medium text-foreground">{agent?.full_name || "Agent"}</div>
                            <div className="text-muted-foreground">{agent?.agency_name}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {b.created_at
                              ? new Date(b.created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PERFORMANCE & REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Total Citizens Enrolled</span>
              <p className="text-3xl font-bold text-foreground">{beneficiaries.length}</p>
              <p className="text-xs text-muted-foreground">Across all approved agents in your organization</p>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Avg Beneficiaries / Agent</span>
              <p className="text-3xl font-bold text-emerald-600">
                {approvedAgents.length > 0 ? (beneficiaries.length / approvedAgents.length).toFixed(1) : 0}
              </p>
              <p className="text-xs text-muted-foreground">Average productivity per active agent</p>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Agent Approval Rate</span>
              <p className="text-3xl font-bold text-primary">
                {myAgents.length > 0 ? `${Math.round((approvedAgents.length / myAgents.length) * 100)}%` : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">{approvedAgents.length} approved out of {myAgents.length} assigned</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-foreground text-sm">Agent Activity Breakdown</h3>
            <div className="divide-y divide-border rounded-lg border">
              {approvedAgents.map((agent) => {
                const count = beneficiaries.filter((b) => b.agent_id === agent.id).length;
                return (
                  <div key={agent.id} className="p-3.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{agent.full_name}</p>
                      <p className="text-xs text-muted-foreground">{agent.agency_name} · {agent.district}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{count} Citizens</p>
                      <p className="text-[11px] text-muted-foreground">Registered</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PROFILE SETTINGS */}
      {activeTab === "profile" && (
        <div className="max-w-xl rounded-xl border bg-card p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold">Sub-Admin Profile Settings</h2>
            <p className="text-xs text-muted-foreground">
              Manage your personal and designation details. Organization name is managed by the Main Administrator.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <Label>Partner Organization (Main Admin Managed)</Label>
              <Input value={subAdminProfile?.organization_name || ""} disabled className="bg-muted font-medium" />
            </div>

            <div>
              <Label>Email Address (Login ID)</Label>
              <Input value={subAdminProfile?.email || ""} disabled className="bg-muted font-mono text-xs" />
            </div>

            <div>
              <Label htmlFor="prof-name">Full Name</Label>
              <Input
                id="prof-name"
                required
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="prof-designation">Designation</Label>
              <Input
                id="prof-designation"
                required
                value={profileForm.designation}
                onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="prof-mobile">Mobile Number</Label>
              <Input
                id="prof-mobile"
                required
                maxLength={10}
                value={profileForm.mobile}
                onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="prof-avatar">Avatar / Photo URL</Label>
              <Input
                id="prof-avatar"
                value={profileForm.avatarUrl}
                onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <Button type="submit" disabled={profileSaving} className="w-full gap-2">
              {profileSaving && <RotateCw className="h-4 w-4 animate-spin" />}
              Save Profile Changes
            </Button>
          </form>
        </div>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      <AlertDialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Approve Agent Registration?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <b>{approveTarget?.full_name}</b> ({approveTarget?.agency_name})?
              Once approved, the agent will receive access to the Agent Dashboard and can begin registering beneficiaries for schemes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApprove}
              disabled={actionBusy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {actionBusy ? "Approving..." : "Approve Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* REJECT CONFIRMATION MODAL */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Reject Agent Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Please specify the reason why <b>{rejectTarget?.full_name}</b> is being rejected. This reason will be recorded and displayed to the applicant.
            </p>
            <div>
              <Label htmlFor="sub-reject-reason">Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="sub-reject-reason"
                required
                rows={3}
                placeholder="e.g. Incomplete agency documentation or location outside operational boundaries."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)} disabled={actionBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={actionBusy || !rejectReason.trim()}
            >
              {actionBusy ? "Rejecting..." : "Reject Registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUSPEND MODAL */}
      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-600" />
              Suspend Agent Access
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Suspending <b>{suspendTarget?.full_name}</b> will immediately block their dashboard access.
            </p>
            <div>
              <Label htmlFor="sub-suspend-reason">Suspension Reason</Label>
              <Textarea
                id="sub-suspend-reason"
                rows={3}
                placeholder="e.g. Account under compliance review..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuspendOpen(false)} disabled={actionBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmSuspend} disabled={actionBusy}>
              {actionBusy ? "Suspending..." : "Suspend Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REACTIVATE MODAL */}
      <AlertDialog open={isReactivateOpen} onOpenChange={setIsReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-emerald-600" />
              Reactivate Suspended Agent?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore full portal access for <b>{reactivateTarget?.full_name}</b>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReactivate}
              disabled={actionBusy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {actionBusy ? "Reactivating..." : "Reactivate Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
