import {
  Tractor,
  GraduationCap,
  HeartHandshake,
  Rocket,
  Briefcase,
  UserCheck,
  Home,
  Shield,
  type LucideIcon,
} from "lucide-react";
import {
  CITIZEN_AUDIENCES,
  getAudienceSchemeCount,
  type SchemeRecord,
} from "@/lib/homepage-helpers";

const AUDIENCE_ICON_MAP: Record<string, LucideIcon> = {
  farmers: Tractor,
  students: GraduationCap,
  women: HeartHandshake,
  entrepreneurs: Rocket,
  "job-seekers": Briefcase,
  "working-professionals": UserCheck,
  "rural-families": Home,
  "senior-citizens": Shield,
};

interface AudienceSupportSectionProps {
  schemes: SchemeRecord[] | undefined;
  isLoading: boolean;
}

export function AudienceSupportSection({
  schemes,
  isLoading,
}: AudienceSupportSectionProps) {
  return (
    <section className="border-t bg-muted/30 py-16">
      <div className="mx-auto max-w-6xl px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">
          Government Support for Every Citizen
        </h2>
        <p className="mt-3 text-muted-foreground">
          Overview of scheme groups matched against verified scheme categories and eligibility attributes in our database.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CITIZEN_AUDIENCES.map((aud) => {
          const Icon = AUDIENCE_ICON_MAP[aud.slug] ?? UserCheck;
          const count = getAudienceSchemeCount(schemes, aud.slug);
          const hasData = !isLoading && Array.isArray(schemes);

          return (
            <div
              key={aud.slug}
              className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-card"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron/15 text-saffron">
                    <Icon className="h-5 w-5" />
                  </div>
                  {isLoading ? (
                    <span className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                      {count} {count === 1 ? "Match" : "Matches"}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-lg font-semibold text-primary">
                  {aud.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {!hasData || count > 0
                    ? aud.fallbackDescription
                    : "No schemes in the current database are tagged for this citizen group yet."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}

