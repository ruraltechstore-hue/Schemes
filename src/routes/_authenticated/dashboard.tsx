import { Link } from "react-router-dom";
import { Upload, BadgeCheck, FileText, UserCheck, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SchemeCard } from "@/components/SchemeCard";
import { Disclaimer } from "@/components/Disclaimer";
import { useApplications, useDocuments, useMatches, useProfile } from "@/hooks/use-app-data";
import { profileCompletion } from "@/lib/matching";

export default Dashboard;

function Stat({ icon: Icon, label, value, children }: { icon: typeof FileText; label: string; value: string | number; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className="h-5 w-5 text-saffron" /></div>
      <div className="mt-2 text-3xl font-bold text-primary">{value}</div>
      {children}
    </div>
  );
}

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: docs } = useDocuments();
  const { data: apps } = useApplications();
  const { eligible } = useMatches();
  const pc = profileCompletion(profile ?? null);
  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-hero p-6 text-primary-foreground md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">Welcome, {profile?.full_name?.split(" ")[0] ?? "Citizen"}</h1>
        <p className="mt-1 text-primary-foreground/80">Keep your profile and documents up to date for better scheme matches.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="bg-saffron text-saffron-foreground hover:bg-saffron/90"><Link to="/documents"><Upload className="h-4 w-4" />Upload Documents</Link></Button>
          <Button asChild variant="secondary"><Link to="/eligible"><BadgeCheck className="h-4 w-4" />Check Eligibility</Link></Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={UserCheck} label="Profile completion" value={`${pc}%`}>
          <Progress value={pc} className="mt-3 h-1.5" />
          {pc < 100 && <Link to="/profile" className="mt-2 block text-xs text-primary underline">Complete profile</Link>}
        </Stat>
        <Stat icon={FileText} label="Uploaded documents" value={docs?.length ?? 0} />
        <Stat icon={BadgeCheck} label="Matching schemes" value={eligible.length} />
        <Stat icon={ClipboardList} label="Tracked applications" value={apps?.length ?? 0} />
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Top matches</h2>
          <Link to="/eligible" className="text-sm text-primary underline">See all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eligible.slice(0, 3).map((m) => <SchemeCard key={m.scheme.id} m={m} />)}
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
