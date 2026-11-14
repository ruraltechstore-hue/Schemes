import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GuestEligibilityCta({ schemeName }: { schemeName: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4 text-saffron" />
            <span>Check Your Personalized Eligibility Match</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Create an account or log in to see your estimated eligibility match percentage for{" "}
            <span className="font-medium text-foreground">{schemeName}</span>, track your application status, and review required documents.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/register">
              Get Started <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

