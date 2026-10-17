import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, User, FileText, BadgeCheck, Library, ClipboardList, Settings, LogOut, ShieldCheck, Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsAdmin, useProfile, useUser } from "@/hooks/use-app-data";
import { getInitials } from "@/lib/profile-helpers";

export default Layout;

const userNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/documents", label: "My Documents", icon: FileText },
  { to: "/eligible", label: "Eligible Schemes", icon: BadgeCheck },
  { to: "/schemes", label: "All Schemes", icon: Library },
  { to: "/applications", label: "Applications", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schemes", label: "All Schemes", icon: Library },
  { to: "/admin/profile", label: "Profile", icon: User },
];

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const qc = useQueryClient(); const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();
  const logout = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };
  const cls = "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  return (
    <div className="flex h-full flex-col bg-sidebar p-4">
      <div className="mb-6 px-2"><Logo light /></div>
      <nav className="flex-1 space-y-1">
        {(isAdmin ? adminNav : userNav).map((n) => (
          <Link key={n.to} to={n.to} className={cls} onClick={onNavigate}>
            <n.icon className="h-4 w-4" />{n.label}
          </Link>
        ))}
      </nav>
      <button onClick={logout} className={cls}><LogOut className="h-4 w-4" />Logout</button>
    </div>
  );
}

function Layout() {
  const [open, setOpen] = useState(false);
  const { data: user, isLoading: userLoading } = useUser();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, userLoading, navigate]);

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || profile?.email || user?.email || "User";
  const avatarUrl = user?.user_metadata?.avatar_url || (profile as any)?.avatar_url || null;
  const initials = getInitials(displayName, user?.email);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block"><SideNav /></aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="tricolor-bar h-1" />
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0"><SideNav onNavigate={() => setOpen(false)} /></SheetContent>
          </Sheet>
          <span className="hidden text-sm text-muted-foreground md:block">Government Scheme Finder</span>
          <Link
            to={isAdmin ? "/admin/profile" : "/profile"}
            className="flex items-center gap-2.5 rounded-full px-2 py-1 hover:bg-muted/60 transition-colors group"
            title={isAdmin ? "View Admin Profile" : "View Profile"}
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
              {isAdmin && (
                <span className="text-[10px] text-muted-foreground leading-tight">Admin</span>
              )}
            </div>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
