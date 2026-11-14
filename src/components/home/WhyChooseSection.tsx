import {
  UserCheck,
  Globe,
  Lock,
  Percent,
  FileText,
  Compass,
  PlayCircle,
  ClipboardCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: UserCheck,
    title: "Personalized Scheme Eligibility Checking",
    description:
      "Evaluate schemes against your age, state, income, occupation, category, and household profile details.",
  },
  {
    icon: Globe,
    title: "Central and State Government Scheme Discovery",
    description:
      "Explore welfare programs across ministries and state departments in one searchable portal.",
  },
  {
    icon: Lock,
    title: "Secure Document Management",
    description:
      "Keep essential eligibility documents organized under authenticated access-controlled storage.",
  },
  {
    icon: Percent,
    title: "Eligibility Match Percentage",
    description:
      "See a clear match percentage indicating how closely your profile aligns with listed criteria.",
  },
  {
    icon: FileText,
    title: "Required Document Information",
    description:
      "Review checklists of mandatory documents for each scheme before starting an official application.",
  },
  {
    icon: Compass,
    title: "Application Process Guidance",
    description:
      "Follow structured scheme details, eligibility notes, and direct links to official application portals.",
  },
  {
    icon: PlayCircle,
    title: "Tutorial Videos",
    description:
      "Watch step-by-step video walkthroughs where available to understand how to complete applications.",
  },
  {
    icon: ClipboardCheck,
    title: "Easy Scheme Tracking",
    description:
      "Monitor scheme application statuses from saved to submitted or approved from your dashboard.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="border-y bg-primary/5 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            Why Choose Scheme Finder?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built by Rural Tech Store to simplify how citizens discover, prepare for, and track government welfare benefits.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron/50 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold leading-snug text-primary">
                  {feat.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

