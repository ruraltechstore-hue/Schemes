import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  FileText,
  BadgeCheck,
  Library,
  ClipboardList,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  UserPlus,
  Users,
  UploadCloud,
  CheckCircle2,
  FileBarChart,
  UserCheck,
  Clock,
  XCircle,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useProfile, useIsAdmin } from "@/hooks/use-app-data";
import { useAgentProfile } from "@/hooks/use-agent-data";
import { getInitials } from "@/lib/profile-helpers";

export default Layout;

const agentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users/new", label: "Add New User", icon: UserPlus },
  { to: "/users", label: "All Users", icon: Users },
  { to: "/eligible", label: "Check Scheme Eligibility", icon: BadgeCheck },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/profile", label: "Agent Profile", icon: UserCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schemes", label: "All Schemes", icon: Library },
  { to: "/admin/profile", label: "Profile", icon: User },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();

  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const cls =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";

  return (
    <div className="flex h-full flex-col bg-sidebar p-4">
      <div className="mb-6 px-2">
        <Logo light />
      </div>
      <nav className="flex-1 space-y-1">
        {(isAdmin ? adminNav : agentNav).map((n) => (
          <Link key={n.to} to={n.to} className={cls} onClick={onNavigate}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <button onClick={logout} className={cls}>
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}

function Layout() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile } = useProfile();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: agentProfile, isLoading: agentLoading, refetch: refetchAgent } = useAgentProfile(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, userLoading, navigate]);

  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (userLoading || adminLoading || (!isAdmin && agentLoading && typeof supabase?.from === "function")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication & permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Role-based Access Control Check:
  // Administrators bypass agent approval and proceed directly.
  // For non-admin agents: enforce pending, rejected, and suspended states.
  if (!isAdmin && agentProfile) {
    const status = agentProfile.status;

    if (status === "unverified" || agentProfile.email_verified === false) {
      return (
        <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
          <div className="tricolor-bar h-1 w-full fixed top-0 left-0" />
          <div className="max-w-md w-full rounded-2xl border bg-card p-6 md:p-8 shadow-card text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Email Verification Required</h2>
              <p className="mt-2 text-sm text-blue-900 bg-blue-50 rounded-lg p-3 border border-blue-200 font-medium">
                Your email has not been verified. Please verify your email with the 6-digit OTP code to complete registration.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Admin approval requests are only generated after successful email OTP verification. Once verified, your application will be submitted to the platform administrator.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                className="w-full"
                asChild
              >
                <Link to="/register">Complete Email Verification</Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={logout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (status === "pending") {
      return (
        <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
          <div className="tricolor-bar h-1 w-full fixed top-0 left-0" />
          <div className="max-w-md w-full rounded-2xl border bg-card p-6 md:p-8 shadow-card text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Clock className="h-9 w-9 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Registration Submitted</h2>
              <p className="mt-2 text-sm text-amber-900 bg-amber-50 rounded-lg p-3 border border-amber-200 font-medium">
                Your agent registration has been submitted. Please wait for admin approval.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Agent Name:</span>
                <span className="font-semibold">{agentProfile?.full_name || profile?.full_name || user.email}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Agency:</span>
                <span className="font-semibold">{agentProfile?.agency_name || "Agent Partner"}</span>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-semibold">{user.email}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-muted-foreground">Status:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  Pending Admin Approval
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Our administrative team is reviewing your agent profile. Once approved, you will have immediate access to the Agent Dashboard and beneficiary management.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => refetchAgent()}
              >
                <RotateCw className="h-4 w-4" />
                Refresh Approval Status
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (status === "rejected") {
      return (
        <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
          <div className="tricolor-bar h-1 w-full fixed top-0 left-0" />
          <div className="max-w-md w-full rounded-2xl border bg-card p-6 md:p-8 shadow-card text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-destructive">
              <XCircle className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Application Rejected</h2>
              <p className="mt-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20 font-medium">
                Your agent registration has been rejected by the administrator.
              </p>
            </div>
            {agentProfile?.rejection_reason && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left text-xs space-y-1">
                <span className="font-semibold text-destructive">Reason for Rejection:</span>
                <p className="text-muted-foreground">{agentProfile.rejection_reason}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Please contact platform administration if you believe this is in error or wish to re-apply.
            </p>
            <Button variant="default" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      );
    }

    if (status === "suspended") {
      return (
        <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
          <div className="tricolor-bar h-1 w-full fixed top-0 left-0" />
          <div className="max-w-md w-full rounded-2xl border bg-card p-6 md:p-8 shadow-card text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Account Suspended</h2>
              <p className="mt-2 text-sm text-amber-900 bg-amber-50 rounded-lg p-3 border border-amber-200 font-medium">
                Your agent account has been temporarily suspended by the administrator.
              </p>
            </div>
            {agentProfile?.suspension_reason && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left text-xs space-y-1">
                <span className="font-semibold text-amber-900">Suspension Notice:</span>
                <p className="text-muted-foreground">{agentProfile.suspension_reason}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Access to beneficiary records and scheme check services is suspended. Please contact the administrator to resolve account compliance.
            </p>
            <Button variant="default" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      );
    }
  }

  const displayName =
    agentProfile?.full_name ||
    profile?.full_name ||
    user?.user_metadata?.["full_name"] ||
    profile?.email ||
    user?.email ||
    "Agent";

  const agencyName = agentProfile?.agency_name;
  const avatarUrl = user?.user_metadata?.["avatar_url"] || (profile as any)?.avatar_url || null;
  const initials = getInitials(displayName, user?.email);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="tricolor-bar h-1" />
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SideNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Scheme Compass</span>
            <span>·</span>
            <span>{isAdmin ? "Admin Portal" : `Agent Portal ${agencyName ? `(${agencyName})` : ""}`}</span>
          </div>
          <Link
            to={isAdmin ? "/admin/profile" : "/profile"}
            className="flex items-center gap-2.5 rounded-full px-2 py-1 hover:bg-muted/60 transition-colors group"
            title={isAdmin ? "View Admin Profile" : "View Agent Profile"}
            data-testid="header-profile-link"
          >
            <Avatar className="h-8 w-8 border border-border group-hover:ring-2 group-hover:ring-primary/20 transition-all">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {isAdmin ? "Administrator" : agencyName || "Certified Agent"}
              </span>
            </div>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
