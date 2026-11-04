import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  Eye,
  Clock,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-app-data";
import { useAllAgentProfiles } from "@/hooks/use-agent-data";

export function AdminAgentManagement() {

  const { data: agents = [], isLoading, refetch } = useAllAgentProfiles();
  const { data: currentUser } = useUser();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Rejection Dialog State
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // Suspension Dialog State
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  // Pending agents are only those whose registration is verified and awaiting admin approval
  const pendingAgents = agents.filter((a) => a.status === "pending" && a.email_verified !== false);
  const approvedAgents = agents.filter((a) => a.status === "approved");
  const rejectedAgents = agents.filter((a) => a.status === "rejected");
  const suspendedAgents = agents.filter((a) => a.status === "suspended");

  const filterAgents = (list: typeof agents) => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (a) =>
        a.full_name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.mobile?.toLowerCase().includes(q) ||
        a.agency_name?.toLowerCase().includes(q) ||
        a.state?.toLowerCase().includes(q) ||
        a.district?.toLowerCase().includes(q)
    );
  };

  const handleApprove = async (agentId: string) => {
    setBusyId(agentId);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser?.id || null,
          rejection_reason: null,
          suspension_reason: null,
        })
        .eq("id", agentId);

      if (error) throw error;

      toast.success("Agent approved successfully! Access granted to Agent Dashboard.");
      qc.invalidateQueries({ queryKey: ["allAgentProfiles"] });
      if (selectedAgent?.id === agentId) {
        setSelectedAgent((prev: any) => ({ ...prev, status: "approved" }));
      }
    } catch (err: any) {
      toast.error("Failed to approve agent: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const openRejectDialog = (agentId: string) => {
    setRejectTargetId(agentId);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetId) return;
    setBusyId(rejectTargetId);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim() || "Application does not meet platform requirements.",
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser?.id || null,
        })
        .eq("id", rejectTargetId);

      if (error) throw error;

      toast.success("Agent registration rejected.");
      setIsRejectOpen(false);
      qc.invalidateQueries({ queryKey: ["allAgentProfiles"] });
      if (selectedAgent?.id === rejectTargetId) {
        setSelectedAgent((prev: any) => ({
          ...prev,
          status: "rejected",
          rejection_reason: rejectReason.trim(),
        }));
      }
    } catch (err: any) {
      toast.error("Failed to reject agent: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const openSuspendDialog = (agentId: string) => {
    setSuspendTargetId(agentId);
    setSuspendReason("");
    setIsSuspendOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTargetId) return;
    setBusyId(suspendTargetId);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "suspended",
          suspension_reason: suspendReason.trim() || "Account temporarily suspended for compliance review.",
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser?.id || null,
        })
        .eq("id", suspendTargetId);

      if (error) throw error;

      toast.success("Agent suspended. Access to dashboard blocked.");
      setIsSuspendOpen(false);
      qc.invalidateQueries({ queryKey: ["allAgentProfiles"] });
      if (selectedAgent?.id === suspendTargetId) {
        setSelectedAgent((prev: any) => ({
          ...prev,
          status: "suspended",
          suspension_reason: suspendReason.trim(),
        }));
      }
    } catch (err: any) {
      toast.error("Failed to suspend agent: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (agentId: string) => {
    setBusyId(agentId);
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({
          status: "approved",
          suspension_reason: null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser?.id || null,
        })
        .eq("id", agentId);

      if (error) throw error;

      toast.success("Agent reactivated successfully!");
      qc.invalidateQueries({ queryKey: ["allAgentProfiles"] });
      if (selectedAgent?.id === agentId) {
        setSelectedAgent((prev: any) => ({ ...prev, status: "approved" }));
      }
    } catch (err: any) {
      toast.error("Failed to reactivate agent: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const openViewModal = (agent: any) => {
    setSelectedAgent(agent);
    setIsViewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "suspended":
        return <Badge className="bg-orange-100 text-orange-900 hover:bg-orange-100 border-orange-300">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents by name, email, agency, district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RotateCw className="h-3.5 w-3.5" />
          Refresh Agents
        </Button>
      </div>

      {/* Tabs for Agent Categories */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <span>Pending</span>
            {pendingAgents.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                {pendingAgents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <span>Approved</span>
            <span className="text-xs text-muted-foreground">({approvedAgents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <span>Rejected</span>
            <span className="text-xs text-muted-foreground">({rejectedAgents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="suspended" className="flex items-center gap-2">
            <span>Suspended</span>
            <span className="text-xs text-muted-foreground">({suspendedAgents.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Requests */}
        <TabsContent value="pending" className="mt-4">
          <AgentTable
            agents={filterAgents(pendingAgents)}
            status="pending"
            isLoading={isLoading}
            onView={openViewModal}
            onApprove={handleApprove}
            onReject={openRejectDialog}
            busyId={busyId}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        {/* Tab 2: Approved Agents */}
        <TabsContent value="approved" className="mt-4">
          <AgentTable
            agents={filterAgents(approvedAgents)}
            status="approved"
            isLoading={isLoading}
            onView={openViewModal}
            onSuspend={openSuspendDialog}
            busyId={busyId}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        {/* Tab 3: Rejected Agents */}
        <TabsContent value="rejected" className="mt-4">
          <AgentTable
            agents={filterAgents(rejectedAgents)}
            status="rejected"
            isLoading={isLoading}
            onView={openViewModal}
            onApprove={handleApprove}
            busyId={busyId}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        {/* Tab 4: Suspended Agents */}
        <TabsContent value="suspended" className="mt-4">
          <AgentTable
            agents={filterAgents(suspendedAgents)}
            status="suspended"
            isLoading={isLoading}
            onView={openViewModal}
            onReactivate={handleReactivate}
            busyId={busyId}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* View Agent Profile Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Agent Profile Details</span>
              {selectedAgent && getStatusBadge(selectedAgent.status)}
            </DialogTitle>
          </DialogHeader>

          {selectedAgent && (
            <div className="space-y-4 py-2 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                  {selectedAgent.full_name?.charAt(0) || "A"}
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground">{selectedAgent.full_name}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {selectedAgent.agency_name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border p-2.5 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <span className="font-medium text-foreground block truncate">{selectedAgent.email}</span>
                </div>
                <div className="rounded-md border p-2.5 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Mobile
                  </span>
                  <span className="font-medium text-foreground block">{selectedAgent.mobile}</span>
                </div>
              </div>

              <div className="rounded-md border p-3 text-xs space-y-2">
                <div className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-foreground block">{selectedAgent.address}</span>
                    <span className="text-muted-foreground">
                      {selectedAgent.district}, {selectedAgent.state}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Applied on: {new Date(selectedAgent.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {selectedAgent.rejection_reason && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1">
                  <span className="font-semibold text-destructive flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Rejection Reason:
                  </span>
                  <p className="text-muted-foreground">{selectedAgent.rejection_reason}</p>
                </div>
              )}

              {selectedAgent.suspension_reason && (
                <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-xs space-y-1">
                  <span className="font-semibold text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Suspension Reason:
                  </span>
                  <p className="text-muted-foreground">{selectedAgent.suspension_reason}</p>
                </div>
              )}

              {/* Direct Actions Inside Modal */}
              <div className="pt-2 flex flex-wrap gap-2 justify-end border-t">
                {selectedAgent.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setIsViewOpen(false);
                        openRejectDialog(selectedAgent.id);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject Agent
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={busyId === selectedAgent.id}
                      onClick={() => handleApprove(selectedAgent.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve Agent
                    </Button>
                  </>
                )}

                {selectedAgent.status === "approved" && (
                  <Button
                    variant="outline"
                    className="text-amber-700 hover:bg-amber-50 border-amber-300"
                    onClick={() => {
                      setIsViewOpen(false);
                      openSuspendDialog(selectedAgent.id);
                    }}
                  >
                    <PauseCircle className="h-4 w-4 mr-1.5" />
                    Suspend Agent
                  </Button>
                )}

                {selectedAgent.status === "suspended" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busyId === selectedAgent.id}
                    onClick={() => handleReactivate(selectedAgent.id)}
                  >
                    <PlayCircle className="h-4 w-4 mr-1.5" />
                    Reactivate Agent
                  </Button>
                )}

                {selectedAgent.status === "rejected" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busyId === selectedAgent.id}
                    onClick={() => handleApprove(selectedAgent.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    Re-evaluate & Approve
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Agent Modal */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Agent Registration</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Please state the reason for rejecting this agent application. This reason will be recorded and displayed to the agent upon login.
            </p>
            <div>
              <Label htmlFor="reject-reason">Reason for Rejection</Label>
              <Textarea
                id="reject-reason"
                rows={3}
                placeholder="e.g. Incomplete verification details or unauthorized agency credentials..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={busyId === rejectTargetId}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Agent Modal */}
      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Approved Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Suspending an agent will immediately block their access to the Agent Dashboard and beneficiary records.
            </p>
            <div>
              <Label htmlFor="suspend-reason">Reason for Suspension</Label>
              <Textarea
                id="suspend-reason"
                rows={3}
                placeholder="e.g. Account under compliance review or policy breach..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmSuspend}
              disabled={busyId === suspendTargetId}
            >
              Suspend Agent Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentTable({
  agents,
  status,
  isLoading,
  onView,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  busyId,
  getStatusBadge,
}: {
  agents: any[];
  status: string;
  isLoading: boolean;
  onView: (a: any) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onSuspend?: (id: string) => void;
  onReactivate?: (id: string) => void;
  busyId: string | null;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <RotateCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
        Loading agent records...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <h3 className="mt-3 font-semibold text-foreground">No {status} agents</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {status === "pending"
            ? "No pending agent registration requests awaiting approval."
            : `There are currently no agents with '${status}' status.`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3">Agent & Agency</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Date Applied</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{agent.full_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" />
                    {agent.agency_name}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="text-foreground">{agent.email}</div>
                  <div className="text-muted-foreground">{agent.mobile}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="text-foreground">{agent.district}</div>
                  <div className="text-muted-foreground">{agent.state}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(agent.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">{getStatusBadge(agent.status)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      onClick={() => onView(agent)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>

                    {status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          disabled={busyId === agent.id}
                          onClick={() => onApprove?.(agent.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          disabled={busyId === agent.id}
                          onClick={() => onReject?.(agent.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}

                    {status === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-amber-700 hover:bg-amber-50 border-amber-300 gap-1"
                        disabled={busyId === agent.id}
                        onClick={() => onSuspend?.(agent.id)}
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        Suspend
                      </Button>
                    )}

                    {status === "suspended" && (
                      <Button
                        size="sm"
                        className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        disabled={busyId === agent.id}
                        onClick={() => onReactivate?.(agent.id)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Reactivate
                      </Button>
                    )}

                    {status === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-emerald-700 hover:bg-emerald-50 border-emerald-300 gap-1"
                        disabled={busyId === agent.id}
                        onClick={() => onApprove?.(agent.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
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
  );
}

export default AdminAgentManagement;
