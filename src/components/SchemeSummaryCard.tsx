import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, HelpCircle, XCircle, Building2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchResult } from "@/lib/matching";

export interface SchemeSummaryCardProps {
  matchResult: MatchResult;
  userId: string;
  activeTab?: string;
  from?: string;
}

export function SchemeSummaryCard({
  matchResult,
  userId,
  activeTab = "eligible",
  from,
}: SchemeSummaryCardProps) {
  const navigate = useNavigate();
  const { scheme, percent, status } = matchResult;

  // Build target URL preserving active tab and origin
  const queryParams = new URLSearchParams();
  if (activeTab && activeTab !== "eligible") queryParams.set("tab", activeTab);
  if (from) queryParams.set("from", from);
  const queryString = queryParams.toString();
  const schemeDetailUrl = `/agent/users/${userId}/schemes/${scheme.id}${queryString ? `?${queryString}` : ""}`;

  // Card border styling based on evaluation category:
  // - Light green border for eligible cards
  // - Light amber border for needs more info
  // - Light rose/red border for not eligible
  const borderClass =
    status === "eligible"
      ? "border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 dark:hover:border-emerald-600"
      : status === "needs_verification"
      ? "border-amber-200 dark:border-amber-800/60 hover:border-amber-400 dark:hover:border-amber-600"
      : "border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-700";

  // Top row: Eligibility Status Badge
  const renderStatusBadge = () => {
    switch (status) {
      case "eligible":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Eligible
          </Badge>
        );
      case "needs_verification":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <HelpCircle className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400 shrink-0" />
            Needs More Info
          </Badge>
        );
      case "ineligible":
      default:
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            <XCircle className="h-3.5 w-3.5 mr-1 text-rose-600 dark:text-rose-400 shrink-0" />
            Not Eligible
          </Badge>
        );
    }
  };

  // Top row: Match percentage badge in a light background badge aligned to the right
  const renderMatchBadge = () => {
    const bgClass =
      status === "eligible"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
        : status === "needs_verification"
        ? "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
        : "bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";

    return (
      <span
        className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${bgClass}`}
      >
        {percent}% Match
      </span>
    );
  };

  return (
    <div
      onClick={() => navigate(schemeDetailUrl)}
      className={`group cursor-pointer rounded-xl border bg-white dark:bg-card p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${borderClass}`}
      data-testid={`scheme-card-${scheme.id}`}
    >
      <div className="space-y-3">
        {/* Top row: Status badge, Category badge, Match percentage badge aligned right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {renderStatusBadge()}
            {scheme.category && (
              <Badge
                variant="outline"
                className="text-xs font-normal text-muted-foreground border-border/80 px-2.5 py-0.5 rounded-full"
              >
                {scheme.category}
              </Badge>
            )}
          </div>
          {renderMatchBadge()}
        </div>

        {/* Scheme information */}
        <div>
          <h3 className="text-base md:text-lg font-bold text-foreground leading-snug tracking-tight group-hover:text-primary transition-colors">
            {scheme.name}
          </h3>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span>{scheme.ministry || "Government Department"}</span>
          </p>
        </div>

        {/* Short description: max 2-3 lines with ellipsis */}
        <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed mt-2.5">
          {scheme.description ||
            "Click to view full scheme details, tailored criteria evaluation, benefits, and required document verification."}
        </p>
      </div>

      {/* Bottom row: Horizontal divider, "Click card to view details", prominent "View Details →" button */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
          Click card to view details
        </span>
        <Button
          asChild
          size="sm"
          className="bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-xs h-8 px-3.5 rounded-lg shadow-sm gap-1.5 inline-flex items-center dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Link to={schemeDetailUrl}>
            View Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
