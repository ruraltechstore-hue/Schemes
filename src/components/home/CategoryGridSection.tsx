import {
  Sprout,
  GraduationCap,
  HeartPulse,
  Home,
  Sparkles,
  Briefcase,
  Wrench,
  HandHeart,
  Coins,
  Bus,
  Accessibility,
  Trees,
  type LucideIcon,
} from "lucide-react";
import {
  HOMEPAGE_CATEGORIES,
  getCategorySchemeCount,
  type SchemeRecord,
} from "@/lib/homepage-helpers";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  agriculture: Sprout,
  education: GraduationCap,
  healthcare: HeartPulse,
  "housing-rural": Home,
  women: Sparkles,
  business: Briefcase,
  employment: Wrench,
  "social-welfare": HandHeart,
  "financial-assistance": Coins,
  "transport-infrastructure": Bus,
  "disability-welfare": Accessibility,
  "environment-rural": Trees,
};

interface CategoryGridSectionProps {
  schemes: SchemeRecord[] | undefined;
  isLoading: boolean;
}

export function CategoryGridSection({
  schemes,
  isLoading,
}: CategoryGridSectionProps) {
  return (
    <section id="categories" className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">
          Explore Government Schemes by Category
        </h2>
        <p className="mt-3 text-muted-foreground">
          Discover government benefits and support programs designed for different needs and communities.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {HOMEPAGE_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON_MAP[cat.slug] ?? Briefcase;
          const count = getCategorySchemeCount(schemes, cat.slug);

          return (
            <div
              key={cat.slug}
              className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-card"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  {isLoading ? (
                    <span className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-saffron/15 px-2.5 py-0.5 text-xs font-semibold text-saffron tabular-nums">
                      {count} {count === 1 ? "Scheme" : "Schemes"}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-base font-semibold text-primary">
                  {cat.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

