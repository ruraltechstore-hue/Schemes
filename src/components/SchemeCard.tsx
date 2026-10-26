import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PointWiseList } from "@/components/PointWiseList";
import type { MatchResult } from "@/lib/matching";
import { getSchemeVideo } from "@/lib/video-helpers";

export function SchemeCard({ m }: { m: MatchResult }) {
  const s = m.scheme;
  const hasVideo = !!getSchemeVideo(s).url;

  return (
    <div className="flex flex-col rounded-lg border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Badge variant="secondary">{s.category}</Badge>
            {hasVideo && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5 text-[11px]">
                <Video className="h-3 w-3" />
                Video Guide
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold leading-snug">{s.name}</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{m.percent}%</div>
          <div className="text-xs text-muted-foreground">match</div>
        </div>
      </div>
      <Progress value={m.percent} className="my-3 h-1.5" />
      <p className="text-sm font-medium text-success">You may be eligible</p>
      <div className="mt-1">
        <PointWiseList
          text={s.benefits}
          maxItems={2}
          inlineIfSingle
          itemClassName="text-sm text-muted-foreground line-clamp-2"
        />
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        {m.reasons.slice(0, 3).map((r) => (
          <div key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{r}</div>
        ))}
        {[...m.missing, ...m.missingDocs.map((d) => `Upload ${d}`)].slice(0, 3).map((r) => (
          <div key={r} className="flex gap-2 text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{r}</div>
        ))}
      </div>
      <div className="mt-auto flex gap-2 pt-5">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/schemes/${s.id}`}>View Details</Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <a href={s.apply_url} target="_blank" rel="noreferrer">Apply Now <ExternalLink className="h-3.5 w-3.5" /></a>
        </Button>
      </div>
    </div>
  );
}
