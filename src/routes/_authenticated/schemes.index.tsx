import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin, useMatches, useUser } from "@/hooks/use-app-data";
import { SCHEME_CATEGORIES } from "@/lib/constants";
import { splitIntoPoints } from "@/lib/point-helpers";
import {
  CITIZEN_AUDIENCES,
  HOMEPAGE_CATEGORIES,
  schemeMatchesAudience,
  schemeMatchesCategoryFilter,
} from "@/lib/homepage-helpers";

export default AllSchemes;

function AllSchemes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  const groupParam = searchParams.get("group") ?? "";
  const urlQuery = searchParams.get("q") ?? "";
  const urlLevel = searchParams.get("level") ?? "All";

  const { all, isLoading } = useMatches();
  const { data: user } = useUser();
  const { data: isAdmin } = useIsAdmin();

  const [q, setQ] = useState(urlQuery);
  const [cats, setCats] = useState<string[]>([]);
  const [level, setLevel] = useState<string>(urlLevel || "All");

  useEffect(() => {
    setQ(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    setLevel(urlLevel || "All");
  }, [urlLevel]);

  useEffect(() => {
    if (categoryParam) {
      setCats([]);
    }
  }, [categoryParam]);

  const activeCategoryDef = HOMEPAGE_CATEGORIES.find(
    (c) =>
      c.slug.toLowerCase() === categoryParam.toLowerCase() ||
      c.title.toLowerCase() === categoryParam.toLowerCase() ||
      c.dbCategory?.toLowerCase() === categoryParam.toLowerCase()
  );
  const activeAudienceDef = CITIZEN_AUDIENCES.find(
    (a) => a.slug.toLowerCase() === groupParam.toLowerCase()
  );

  const clearUrlParam = (key: "category" | "group") => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const resetAllFilters = () => {
    setQ("");
    setCats([]);
    setLevel("All");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const toggle = (c: string) => {
    if (categoryParam) {
      clearUrlParam("category");
      setCats([c]);
      return;
    }
    setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  };

  const list = all.filter(({ scheme: s }) => {
    const matchesSearch =
      !q ||
      `${s.name} ${s.description ?? ""} ${s.ministry ?? ""} ${s.benefits ?? ""} ${s.category ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase());
    const matchesCategoryParam =
      !categoryParam || schemeMatchesCategoryFilter(s, categoryParam);
    const matchesManualCats =
      cats.length === 0 || (s.category ? cats.includes(s.category) : false);
    const matchesGroupParam =
      !groupParam || schemeMatchesAudience(s, groupParam);
    const matchesLevel = level === "All" || s.level === level;

    return (
      matchesSearch &&
      matchesCategoryParam &&
      matchesManualCats &&
      matchesGroupParam &&
      matchesLevel
    );
  });

  const hasActiveFilters =
    Boolean(q || categoryParam || groupParam || cats.length > 0 || level !== "All");

  return (
    <div>
      <PageHeader
        title="All Schemes"
        subtitle={
          isLoading
            ? "Loading government schemes..."
            : `${list.length} of ${all.length} schemes`
        }
      />

      {(categoryParam || groupParam) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <Filter className="h-4 w-4 text-primary" />
          <span className="font-medium text-primary">Active filter:</span>
          {categoryParam && (
            <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1">
              Category: {activeCategoryDef?.title ?? categoryParam}
              <button
                type="button"
                onClick={() => clearUrlParam("category")}
                aria-label="Clear category filter"
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {groupParam && (
            <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1">
              Group: {activeAudienceDef?.title ?? groupParam}
              <button
                type="button"
                onClick={() => clearUrlParam("group")}
                aria-label="Clear group filter"
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAllFilters}
            className="ml-auto h-7 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="mb-6 space-y-4 rounded-lg border bg-card p-4 shadow-card">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search schemes, ministries, benefits…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SCHEME_CATEGORIES.map((c) => {
            const isSelected =
              cats.includes(c) ||
              (cats.length === 0 &&
                Boolean(categoryParam) &&
                activeCategoryDef?.dbCategory === c);
            return (
              <Button
                key={c}
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => toggle(c)}
              >
                {c}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["All", "Central", "State"].map((l) => (
            <Button
              key={l}
              size="sm"
              variant={level === l ? "secondary" : "ghost"}
              onClick={() => setLevel(l)}
            >
              {l === "All" ? "All levels" : `${l} Government`}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-lg border bg-card p-5 shadow-card"
            >
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded bg-muted" />
                <div className="h-5 w-16 rounded bg-muted" />
              </div>
              <div className="mt-4 h-6 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
              <div className="mt-4 h-10 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center shadow-card">
          <h3 className="text-lg font-semibold text-primary">
            No schemes match the current filters
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try clearing your search or category selection to view all available government schemes.
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetAllFilters}
              className="mt-4"
            >
              Reset All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map(({ scheme: s, eligible, percent }) => (
            <Link
              key={s.id}
              to={`/schemes/${s.id}`}
              className="block rounded-lg border bg-card p-5 shadow-card transition hover:border-primary"
            >
              <div className="flex flex-wrap gap-2">
                {s.category && <Badge variant="secondary">{s.category}</Badge>}
                {s.level && <Badge variant="outline">{s.level}</Badge>}
                {user && !isAdmin && eligible && (
                  <Badge className="bg-success text-success-foreground">
                    You may be eligible · {percent}%
                  </Badge>
                )}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{s.name}</h3>
              {s.ministry && (
                <p className="text-xs text-muted-foreground">{s.ministry}</p>
              )}
              {s.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground whitespace-pre-line">
                  {s.description}
                </p>
              )}
              {s.benefits && (
                <p className="mt-2 text-sm font-medium line-clamp-2 whitespace-pre-line">
                  {s.benefits}
                </p>
              )}
              {s.eligibility_text && (
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/80">
                    Eligibility:{" "}
                  </span>
                  {splitIntoPoints(s.eligibility_text).join(" • ")}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
