import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, FileCheck2, FileX2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Disclaimer } from "@/components/Disclaimer";
import { SchemeVideoPlayer } from "@/components/SchemeVideoPlayer";
import { SchemeRequiredDocuments } from "@/components/SchemeRequiredDocuments";
import { useApplications, useMatches } from "@/hooks/use-app-data";
import { getSchemeVideo } from "@/lib/video-helpers";
import { APP_STATUSES } from "@/lib/constants";

export default Detail;

function Detail() {
  const { id } = useParams();
  const { all, isLoading } = useMatches();
  const { data: apps } = useApplications();
  const qc = useQueryClient();
  const m = all.find((x) => x.scheme.id === id);
  const app = apps?.find((a) => a.scheme_id === id);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!m) return <p>Scheme not found. <Link to="/schemes" className="text-primary underline">Back</Link></p>;

  const s = m.scheme;
  const vid = getSchemeVideo(s);

  const track = async (status: string) => {
    const { error } = await supabase.from("applications").upsert(
      { scheme_id: id as string, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,scheme_id" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked as ${status}`);
    qc.invalidateQueries({ queryKey: ["applications"] });
  };

  return (
    <div className="space-y-6">
      <Link to="/schemes" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" />All schemes
      </Link>

      {/* Main Scheme Overview */}
      <div className="rounded-lg border bg-card p-6 shadow-card">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{s.category}</Badge>
          <Badge variant="outline">{s.level} Government</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-primary md:text-3xl">{s.name}</h1>
        <p className="text-sm text-muted-foreground">{s.ministry}</p>
        <p className="mt-4">{s.description}</p>
        <div className="mt-4 rounded-md bg-accent p-4"><b>Benefits:</b> {s.benefits}</div>
        {((s.eligibility as any)?.application_process || (s.eligibility as any)?.application_deadline) && (
          <div className="mt-4 text-sm">
            {(s.eligibility as any)?.application_process && (
              <p className="mb-2"><b>Application Process:</b> {(s.eligibility as any).application_process}</p>
            )}
            {(s.eligibility as any)?.application_deadline && (
              <p><b>Deadline:</b> {(s.eligibility as any).application_deadline}</p>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={s.apply_url} target="_blank" rel="noreferrer">
              Apply Now <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Select value={app?.status ?? ""} onValueChange={track}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Track this scheme" /></SelectTrigger>
            <SelectContent>{APP_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* How to Apply — Video Guide Section */}
      <SchemeVideoPlayer
        videoUrl={vid.url}
        videoType={vid.type}
        schemeName={s.name}
        applyUrl={s.apply_url}
      />

      {/* Match and Documents Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Your match</h2>
          <div className="mt-2 flex items-center gap-3"><Progress value={m.percent} className="h-2" /><b>{m.percent}%</b></div>
          <p className={`mt-2 text-sm font-medium ${m.eligible ? "text-success" : "text-destructive"}`}>
            {m.eligible ? "You may be eligible" : "You may not meet some criteria"}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Eligibility: {s.eligibility_text}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            {m.reasons.map((r) => <div key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />{r}</div>)}
            {m.missing.map((r) => <div key={r} className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 text-warning" />{r}</div>)}
          </div>
        </div>
        <SchemeRequiredDocuments
          documents={s.required_documents}
          missingDocs={m.missingDocs}
        />
      </div>
      <Disclaimer />
    </div>
  );
}
