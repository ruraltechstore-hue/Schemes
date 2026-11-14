import { Link, Outlet } from "react-router-dom";
import AuthenticatedLayout from "@/routes/_authenticated/route";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-app-data";

export function SchemePublicOrAuthLayout() {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading schemes...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <AuthenticatedLayout />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="tricolor-bar h-1" />
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link to="/" className="text-muted-foreground transition hover:text-primary">
              Home
            </Link>
            <Link to="/schemes" className="text-primary transition hover:text-primary/80">
              All Schemes
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <span>Rural Tech Store · Government Scheme Finder</span>
          <span>Eligibility results are informational; final approval rests with the concerned department.</span>
        </div>
      </footer>
    </div>
  );
}

