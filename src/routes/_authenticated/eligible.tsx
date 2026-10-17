import { Link } from "react-router-dom";
import { SchemeCard } from "@/components/SchemeCard";
import { Disclaimer } from "@/components/Disclaimer";
import { PageHeader } from "@/components/PageHeader";
import { useMatches, useProfile } from "@/hooks/use-app-data";
import { profileCompletion } from "@/lib/matching";

export default Eligible;

function Eligible() {
  const { eligible, isLoading } = useMatches(); const { data: profile } = useProfile();
  const pc = profileCompletion(profile ?? null);
  return (
    <div className="space-y-6">
      <PageHeader title="Schemes You May Be Eligible For" subtitle={`${eligible.length} schemes match your current profile`} />
      {pc < 100 && (
        <div className="rounded-lg border bg-accent p-4 text-sm">Your profile is {pc}% complete. <Link to="/profile" className="font-medium text-primary underline">Complete it</Link> for more accurate matches.</div>
      )}
      <Disclaimer />
      {isLoading ? <p className="text-muted-foreground">Checking eligibility…</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{eligible.map((m) => <SchemeCard key={m.scheme.id} m={m} />)}</div>
      )}
    </div>
  );
}
