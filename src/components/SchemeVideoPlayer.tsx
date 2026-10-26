import { Video, Youtube, ExternalLink, PlaySquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getYouTubeEmbedUrl, isYouTubeUrl } from "@/lib/video-helpers";

interface SchemeVideoPlayerProps {
  videoUrl?: string | null;
  videoType?: "uploaded" | "youtube" | null;
  schemeName: string;
  applyUrl?: string;
}

export function SchemeVideoPlayer({
  videoUrl,
  videoType,
  schemeName,
  applyUrl,
}: SchemeVideoPlayerProps) {
  const hasVideo = !!videoUrl?.trim();
  const isYoutube = videoType === "youtube" || (hasVideo && isYouTubeUrl(videoUrl!));
  const ytEmbedUrl = hasVideo && isYoutube ? getYouTubeEmbedUrl(videoUrl!) : null;
  const isUploaded = hasVideo && videoType === "uploaded";
  const hasPlayableVideo = (isYoutube && !!ytEmbedUrl) || isUploaded;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground md:text-xl">
              How to Apply — Video Guide
            </h2>
            <p className="text-xs text-muted-foreground">
              Step-by-step visual tutorial for {schemeName}
            </p>
          </div>
        </div>

        {hasPlayableVideo && (
          <div>
            {isYoutube ? (
              <Badge variant="outline" className="gap-1 border-red-500/30 text-red-600 bg-red-500/5 text-xs">
                <Youtube className="h-3 w-3" />
                YouTube Guide
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-xs">
                <PlaySquare className="h-3 w-3 text-primary" />
                Official Video Tutorial
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Video Content or Empty State */}
      {hasPlayableVideo ? (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 shadow-inner border border-border/50">
            {isYoutube && ytEmbedUrl ? (
              <iframe
                src={ytEmbedUrl}
                title={`How to Apply for ${schemeName} - Video Guide`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                src={videoUrl!}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Watch this walkthrough to learn about document preparation, online portal registration, and application submission for <b>{schemeName}</b>.
          </p>
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-10 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Video className="h-7 w-7 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No YouTube tutorial link provided for this scheme.
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
            A comprehensive, step-by-step video guide for <b>{schemeName}</b> is currently not available. In the meantime, you can review the required documents and application steps above.
          </p>
          {applyUrl && (
            <div className="mt-4">
              <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                <a href={applyUrl} target="_blank" rel="noreferrer">
                  Visit Official Application Portal
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
