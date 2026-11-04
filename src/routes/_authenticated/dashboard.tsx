import { Link } from "react-router-dom";
import {
  Users,
  UserPlus,
  CheckCircle2,
  FileText,
  BadgeCheck,
  Building2,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAgentProfile,
  useProfile,
  useManagedUsers,
  useEligibilityCheckHistory,
  useAllAgentSchemeMatches,
  useSchemes,
} from "@/hooks/use-app-data";

export default function Dashboard() {
  const { data: profile } = useProfile();
  const { data: agentProfile } = useAgentProfile();
  const { data: users = [], isLoading: usersLoading } = useManagedUsers();
  const { data: checkHistory = [] } = useEligibilityCheckHistory();
  const { data: allMatches = [] } = useAllAgentSchemeMatches();
  const { data: schemes = [] } = useSchemes();

  // Calculate statistics
  const totalUsers = users.length;
  const totalEligibilityChecks = checkHistory.length;
  const totalEligibleMatches = allMatches.filter((m) => m.status === "eligible").length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentlyAddedCount = users.filter((u) =>
    u.created_at ? new Date(u.created_at) >= sevenDaysAgo : false,
  ).length;

  // Recent 5 users
  const recentUsers = users.slice(0, 5);

  const agentDisplayName = agentProfile?.full_name || profile?.full_name || "Agent";
  const agencyName = agentProfile?.agency_name || "Authorized Partner";

  return (
    <div className="space-y-8" data-testid="agent-dashboard">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-6 text-white shadow-xl md:p-8">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                  Authorized Agent Portal
                </Badge>
                <span className="text-xs text-emerald-200/70 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {agencyName}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                Welcome back, {agentDisplayName}
              </h1>
              <p className="mt-1 text-sm text-emerald-100/80 max-w-2xl">
                Manage citizen beneficiaries, verify government scheme eligibility, and generate
                official enrollment reports.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                asChild
                className="bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 shadow-md"
              >
                <Link to="/users/new">
                  <UserPlus className="mr-2 h-4 w-4" /> Add Beneficiary
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <Link to="/users">
                  <Users className="mr-2 h-4 w-4" /> All Users
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <Link to="/eligible">
                  <BadgeCheck className="mr-2 h-4 w-4" /> Check Eligibility
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Total Users Managed</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">{totalUsers}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Registered beneficiaries under your account
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Eligibility Checks Run</span>
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">
            {totalEligibilityChecks}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Total individual & batch eligibility evaluations
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Eligible Scheme Matches</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">{totalEligibleMatches}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Citizens matched with welfare schemes
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Recently Added Users</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-foreground">{recentlyAddedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Added in the last 7 days</p>
        </div>
      </div>

      {/* Quick Access Sections */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
          Agent Management Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/users/new"
            className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/40 p-2.5 text-emerald-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">Add New User</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Register a citizen beneficiary with full demographic & socioeconomic details.
            </p>
          </Link>

          <Link
            to="/users"
            className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-950/40 p-2.5 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">All Users</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Search, filter, view, edit and manage all registered beneficiaries.
            </p>
          </Link>

          <Link
            to="/eligible"
            className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-2.5 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">Check Scheme Eligibility</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Execute multi-user eligibility engine in batches with live progress indicators.
            </p>
          </Link>

          <Link
            to="/reports"
            className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-teal-100 dark:bg-teal-950/40 p-2.5 text-teal-600">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">Reports</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Download individual dossiers and consolidated eligibility spreadsheets.
            </p>
          </Link>

          <Link
            to="/profile"
            className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-rose-100 dark:bg-rose-950/40 p-2.5 text-rose-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">Agent Profile</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              View agency credentials, approval status, and update operating details.
            </p>
          </Link>
        </div>
      </div>

      {/* Recently Added Users Section */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recently Added Beneficiaries</h2>
            <p className="text-xs text-muted-foreground">
              Showing the latest citizens registered under your agency
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/users">
                View All ({totalUsers}) <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {usersLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading users...</div>
        ) : recentUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-base font-semibold">No beneficiaries registered yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Start by registering citizen profiles to verify eligibility for central and state
              welfare schemes.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button asChild size="sm">
                <Link to="/users/new">
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add First User
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase text-muted-foreground">
                  <th className="pb-3">Beneficiary</th>
                  <th className="pb-3">Demographics</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">Income & Category</th>
                  <th className="pb-3">Added Date</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 font-medium text-foreground">
                      <div>{user.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.mobile || "No phone"}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {user.gender || "—"} {user.age ? `• ${user.age} yrs` : ""}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {user.district ? `${user.district}, ` : ""}
                      {user.state || "—"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      <div>{user.category || "General"}</div>
                      <div className="text-xs">
                        {user.annual_income != null
                          ? `₹${user.annual_income.toLocaleString("en-IN")}/yr`
                          : "—"}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                        <Link to={`/agent/users/${user.id}`}>
                          View Details <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Platform Schemes Overview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Popular Government Schemes</h2>
            <p className="text-xs text-muted-foreground">
              Key welfare programs available in the central scheme database
            </p>
          </div>
          <Link to="/schemes" className="text-sm font-medium text-primary hover:underline">
            View All ({schemes.length})
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schemes.slice(0, 3).map((s) => (
            <div
              key={s.id}
              className="rounded-xl border bg-card p-5 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {s.ministry || "Central Govt"}
                  </Badge>
                  {s.category && (
                    <span className="text-xs text-muted-foreground font-medium">{s.category}</span>
                  )}
                </div>
                <h3 className="mt-2.5 font-bold text-foreground text-base line-clamp-1">
                  {s.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {s.description || "Comprehensive central welfare scheme for citizen assistance."}
                </p>
                {s.benefits && (
                  <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">Benefits: </span>
                    <span className="line-clamp-2">{s.benefits}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {s.required_documents?.length || 0} Docs required
                </span>
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-primary">
                  <Link to={`/schemes/${s.id}`}>
                    Details <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
