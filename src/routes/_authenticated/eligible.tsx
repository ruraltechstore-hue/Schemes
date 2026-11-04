import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Users,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  RotateCw,
  FileText,
  Building2,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useManagedUsers,
  useSchemes,
  useUser,
} from "@/hooks/use-app-data";
import { matchScheme, type MatchResult, type MatchStatus } from "@/lib/matching";
import { SchemeSummaryCard } from "@/components/SchemeSummaryCard";

interface UserMatchSummary {
  user: any;
  matches: MatchResult[];
  eligibleCount: number;
  needsVerificationCount: number;
  ineligibleCount: number;
}

export default function CheckSchemeEligibility() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: currentUser } = useUser();
  const { data: managedUsers = [], isLoading: usersLoading } = useManagedUsers();
  const { data: schemes = [], isLoading: schemesLoading } = useSchemes();

  // Mode: "all" | "selected" | "single"
  const [targetMode, setTargetMode] = useState<"all" | "selected" | "single">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [singleUserId, setSingleUserId] = useState<string>("");

  // Processing state
  const [isRunning, setIsRunning] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Evaluation results
  const [summaries, setSummaries] = useState<UserMatchSummary[]>([]);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // Filters for results
  const [statusFilter, setStatusFilter] = useState<"all" | MatchStatus>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [schemeSearch, setSchemeSearch] = useState("");
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  // Handle URL query parameters (e.g. ?userId=..., ?userIds=..., ?target=all)
  useEffect(() => {
    if (managedUsers.length === 0) return;

    const singleParam = searchParams.get("userId");
    const multipleParam = searchParams.get("userIds");
    const targetParam = searchParams.get("target");

    if (singleParam && managedUsers.some((u) => u.id === singleParam)) {
      setTargetMode("single");
      setSingleUserId(singleParam);
    } else if (multipleParam) {
      const ids = multipleParam.split(",").filter((id) => managedUsers.some((u) => u.id === id));
      if (ids.length > 0) {
        setTargetMode("selected");
        setSelectedUserIds(new Set(ids));
      }
    } else if (targetParam === "all") {
      setTargetMode("all");
    }
  }, [searchParams, managedUsers]);

  // Target users to evaluate based on current selection
  const getTargetUsers = () => {
    if (targetMode === "single") {
      const u = managedUsers.find((x) => x.id === singleUserId);
      return u ? [u] : [];
    }
    if (targetMode === "selected") {
      return managedUsers.filter((u) => selectedUserIds.has(u.id));
    }
    return managedUsers;
  };

  // Run Scheme Eligibility Evaluation with batching
  const runEligibilityCheck = async () => {
    const targets = getTargetUsers();
    if (targets.length === 0) {
      toast.error("Please select at least one beneficiary to evaluate.");
      return;
    }
    if (schemes.length === 0) {
      toast.error("No government schemes available to evaluate against.");
      return;
    }

    setIsRunning(true);
    setProgressPercent(0);
    setProgressMessage("Starting scheme eligibility checks...");

    const batchSize = 5;
    const totalUsers = targets.length;
    const allSummaries: UserMatchSummary[] = [];

    let totalEligibleMatches = 0;
    const batchId = `check_${Date.now()}`;

    try {
      for (let i = 0; i < totalUsers; i += batchSize) {
        const chunk = targets.slice(i, i + batchSize);
        const currentProcessed = Math.min(i + batchSize, totalUsers);

        setProgressPercent(Math.round((currentProcessed / totalUsers) * 100));
        setProgressMessage(
          `Evaluating beneficiaries ${i + 1}–${currentProcessed} of ${totalUsers}...`
        );

        // Process chunk of users
        for (const user of chunk) {
          const userDocs = ((user as any).extra_criteria?.documents || [])
            .map((d: any) => d.doc_type)
            .filter(Boolean);
          const userMatches: MatchResult[] = schemes.map((scheme) =>
            matchScheme(scheme, user, userDocs)
          );

          const eligible = userMatches.filter((m) => m.status === "eligible");
          const needsVerif = userMatches.filter((m) => m.status === "needs_verification");
          const ineligible = userMatches.filter((m) => m.status === "ineligible");

          totalEligibleMatches += eligible.length;

          allSummaries.push({
            user,
            matches: userMatches,
            eligibleCount: eligible.length,
            needsVerificationCount: needsVerif.length,
            ineligibleCount: ineligible.length,
          });

          // Save matches to database if authenticated agent
          if (currentUser) {
            const matchesToUpsert = userMatches.map((m) => ({
              agent_id: currentUser.id,
              user_id: user.id,
              scheme_id: m.scheme.id,
              status: m.status,
              match_percentage: m.percent,
              reasons: m.reasons,
              missing_criteria: m.missing,
              missing_documents: m.missingDocs,
              updated_at: new Date().toISOString(),
            }));

            // Silent upsert in chunks
            try {
              await supabase
                .from("user_scheme_matches")
                .upsert(matchesToUpsert as any, { onConflict: "user_id,scheme_id" });
            } catch (upsertErr) {
              console.warn("Failed to persist user_scheme_matches:", upsertErr);
            }
          }
        }

        // Small pause between batches for smooth UI update
        await new Promise((r) => setTimeout(r, 60));
      }

      // Record check history
      if (currentUser) {
        try {
          await supabase
            .from("eligibility_check_history")
            .insert({
              agent_id: currentUser.id,
              batch_id: batchId,
              check_type: targetMode,
              total_users: totalUsers,
              total_schemes_checked: schemes.length,
              total_eligible_matches: totalEligibleMatches,
              status: "completed",
            } as any);
        } catch (historyErr) {
          console.warn("Failed to record eligibility check history:", historyErr);
        }

        qc.invalidateQueries({ queryKey: ["eligibilityCheckHistory"] });
        qc.invalidateQueries({ queryKey: ["userSchemeMatches"] });
      }

      setSummaries(allSummaries);
      setHasEvaluated(true);
      // Auto-expand first 3 users
      setExpandedUserIds(new Set(allSummaries.slice(0, 3).map((s) => s.user.id)));

      toast.success(
        `Eligibility checks completed! Found ${totalEligibleMatches} eligible scheme matches across ${totalUsers} beneficiaries.`
      );
    } catch (err: any) {
      console.error("Evaluation error:", err);
      toast.error("Eligibility check failed: " + (err.message || "Unknown error"));
    } finally {
      setIsRunning(false);
    }
  };

  const toggleExpandUser = (userId: string) => {
    const next = new Set(expandedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setExpandedUserIds(next);
  };

  // Toggle user checkbox in selected mode
  const toggleUserCheck = (id: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUserIds(next);
  };

  // Aggregate metrics
  const totalBeneficiariesEvaluated = summaries.length;
  const totalEligibleCount = summaries.reduce((acc, s) => acc + s.eligibleCount, 0);
  const totalNeedsVerifCount = summaries.reduce((acc, s) => acc + s.needsVerificationCount, 0);
  const totalIneligibleCount = summaries.reduce((acc, s) => acc + s.ineligibleCount, 0);

  // Filtered summaries
  const displayedSummaries = summaries.filter((s) => {
    if (userFilter !== "all" && s.user.id !== userFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check Scheme Eligibility</h1>
          <p className="text-sm text-muted-foreground">
            Evaluate government schemes for single, selected, or all managed beneficiaries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/reports">
              <FileText className="h-4 w-4 mr-1.5" />
              View Eligibility Reports
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/users">
              <Users className="h-4 w-4 mr-1.5" />
              Manage Beneficiaries
            </Link>
          </Button>
        </div>
      </div>

      {/* Target Selector Card */}
      <div className="rounded-xl border bg-card p-5 shadow-card space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Select Beneficiaries to Evaluate
        </h2>

        {/* Target Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTargetMode("all")}
            className={`rounded-lg border p-3.5 text-left transition-all ${
              targetMode === "all"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "hover:bg-muted/30"
            }`}
          >
            <div className="font-semibold text-sm">All Managed Beneficiaries</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Check all {managedUsers.length} registered citizens
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetMode("selected")}
            className={`rounded-lg border p-3.5 text-left transition-all ${
              targetMode === "selected"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "hover:bg-muted/30"
            }`}
          >
            <div className="font-semibold text-sm">Select Specific Beneficiaries</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Choose from list ({selectedUserIds.size} selected)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetMode("single")}
            className={`rounded-lg border p-3.5 text-left transition-all ${
              targetMode === "single"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "hover:bg-muted/30"
            }`}
          >
            <div className="font-semibold text-sm">Single Beneficiary</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Check one specific citizen profile
            </div>
          </button>
        </div>

        {/* Single User Picker */}
        {targetMode === "single" && (
          <div className="pt-2 max-w-md">
            <Label htmlFor="single_picker">Choose Citizen Profile</Label>
            <Select value={singleUserId} onValueChange={setSingleUserId}>
              <SelectTrigger id="single_picker" className="mt-1">
                <SelectValue placeholder="Select a beneficiary..." />
              </SelectTrigger>
              <SelectContent>
                {managedUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.district}, {u.state}) · {u.gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected Users Checklist */}
        {targetMode === "selected" && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Select beneficiaries from directory:</span>
              <div className="space-x-2">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setSelectedUserIds(new Set(managedUsers.map((u) => u.id)))}
                >
                  Select All
                </button>
                <span>·</span>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border p-2 divide-y text-xs">
              {managedUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2.5 p-2 hover:bg-muted/40 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedUserIds.has(u.id)}
                    onCheckedChange={() => toggleUserCheck(u.id)}
                  />
                  <div className="flex-1 font-medium">{u.full_name}</div>
                  <div className="text-muted-foreground">
                    {u.district}, {u.state}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {u.category || "General"}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Action Button & Progress */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
          <div className="text-xs text-muted-foreground">
            Target: <b>{getTargetUsers().length} beneficiaries</b> against{" "}
            <b>{schemes.length} schemes</b>
          </div>
          <Button
            onClick={runEligibilityCheck}
            disabled={isRunning || getTargetUsers().length === 0}
            className="w-full sm:w-auto bg-saffron text-saffron-foreground hover:bg-saffron/90 gap-2 min-w-[200px]"
          >
            {isRunning ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Processing Checks...
              </>
            ) : hasEvaluated ? (
              <>
                <RotateCw className="h-4 w-4" />
                Re-Run Eligibility Checks
              </>
            ) : (
              <>
                <BadgeCheck className="h-4 w-4" />
                Run Scheme Eligibility Check
              </>
            )}
          </Button>
        </div>

        {/* Batch Progress Bar */}
        {isRunning && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span>{progressMessage}</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}
      </div>

      {/* Results View */}
      {hasEvaluated && (
        <div className="space-y-6">
          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="text-xs text-muted-foreground uppercase font-semibold">
                Beneficiaries
              </span>
              <p className="text-2xl font-bold mt-1">{totalBeneficiariesEvaluated}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <span className="text-xs text-emerald-800 uppercase font-semibold">
                Eligible Matches
              </span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{totalEligibleCount}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <span className="text-xs text-amber-800 uppercase font-semibold">
                Needs Information
              </span>
              <p className="text-2xl font-bold text-amber-700 mt-1">{totalNeedsVerifCount}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
              <span className="text-xs text-red-800 uppercase font-semibold">
                Ineligible Matches
              </span>
              <p className="text-2xl font-bold text-destructive mt-1">{totalIneligibleCount}</p>
            </div>
          </div>

          {/* Result Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
              {(["all", "eligible", "needs_verification", "ineligible"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st === "all"
                    ? "All Schemes"
                    : st === "eligible"
                    ? `Eligible (${totalEligibleCount})`
                    : st === "needs_verification"
                    ? `Needs Info (${totalNeedsVerifCount})`
                    : `Ineligible (${totalIneligibleCount})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter scheme name..."
                  value={schemeSearch}
                  onChange={(e) => setSchemeSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {summaries.length > 1 && (
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="All Beneficiaries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Beneficiaries</SelectItem>
                    {summaries.map((s) => (
                      <SelectItem key={s.user.id} value={s.user.id}>
                        {s.user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Breakdown Per Beneficiary */}
          <div className="space-y-4">
            {displayedSummaries.map(({ user, matches, eligibleCount, needsVerificationCount, ineligibleCount }) => {
              const isExpanded = expandedUserIds.has(user.id);

              const filteredMatches = matches.filter((m) => {
                if (statusFilter !== "all" && m.status !== statusFilter) return false;
                if (
                  schemeSearch &&
                  !m.scheme.name.toLowerCase().includes(schemeSearch.toLowerCase()) &&
                  !m.scheme.ministry.toLowerCase().includes(schemeSearch.toLowerCase())
                ) {
                  return false;
                }
                return true;
              });

              return (
                <div key={user.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
                  {/* User Accordion Header */}
                  <div
                    onClick={() => toggleExpandUser(user.id)}
                    className="flex flex-wrap items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors border-b"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {user.full_name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                          {user.full_name}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({user.gender} · {user.age ? `${user.age} yrs` : "Age N/A"} · {user.district}, {user.state})
                          </span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="font-normal text-[10px]">
                            {user.category || "General"}
                          </Badge>
                          <span>·</span>
                          <span>
                            {user.annual_income != null
                              ? `Income: ₹${Number(user.annual_income).toLocaleString("en-IN")}`
                              : "Income N/A"}
                          </span>
                          {user.is_farmer && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-700 font-medium">Farmer</span>
                            </>
                          )}
                          {user.has_disability && (
                            <>
                              <span>·</span>
                              <span className="text-purple-700 font-medium">PWD</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                          {eligibleCount} Eligible
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                          {needsVerificationCount} Needs Info
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 gap-1 text-xs"
                      >
                        <Link to={`/reports?userId=${user.id}`}>
                          <FileText className="h-3.5 w-3.5" />
                          Full Report
                        </Link>
                      </Button>

                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Schemes List */}
                  {isExpanded && (
                    <div className="p-4 bg-muted/10">
                      {filteredMatches.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          No schemes match the current status / search filter for this beneficiary.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredMatches.map((m) => (
                            <SchemeSummaryCard
                              key={m.scheme.id}
                              matchResult={m}
                              userId={user.id}
                              activeTab={statusFilter !== "all" ? statusFilter : undefined}
                              from="eligible"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
