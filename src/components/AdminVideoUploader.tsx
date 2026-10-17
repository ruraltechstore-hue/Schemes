import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Video,
  Youtube,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  Play,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  formatFileSize,
  isValidVideoFile,
  uploadSchemeVideo,
  getYouTubeEmbedUrl,
  isYouTubeUrl,
  deleteSchemeVideoFile,
} from "@/lib/video-helpers";

interface AdminVideoUploaderProps {
  videoUrl?: string | null;
  videoType?: "uploaded" | "youtube" | null;
  schemeId?: string | undefined;
  onChange: (url: string | null, type: "uploaded" | "youtube" | null) => void;
}

export function AdminVideoUploader({
  videoUrl,
  videoType,
  schemeId,
  onChange,
}: AdminVideoUploaderProps) {
  const [mode, setMode] = useState<"upload" | "youtube">(
    videoType === "youtube" ? "youtube" : "upload",
  );
  const [youtubeInput, setYoutubeInput] = useState(
    videoType === "youtube" && videoUrl ? videoUrl : "",
  );

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileSize, setUploadedFileSize] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync mode if videoType changes from parent
  useEffect(() => {
    if (videoType === "youtube") {
      setMode("youtube");
      setYoutubeInput(videoUrl || "");
    } else if (videoType === "uploaded") {
      setMode("upload");
    }
  }, [videoType, videoUrl]);

  // Handle local video file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video file
    const validation = isValidVideoFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      setUploadError(validation.error || "Invalid file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Starting upload…");
    setUploadedFileName(file.name);
    setUploadedFileSize(formatFileSize(file.size));

    try {
      setUploadStatus("Uploading video file…");
      const { url } = await uploadSchemeVideo(file, schemeId, (percent) => {
        setUploadProgress(percent);
        if (percent < 100) {
          setUploadStatus(`Uploading: ${percent}%`);
        } else {
          setUploadStatus("Finalizing…");
        }
      });

      setUploadStatus("Upload complete!");
      toast.success("Video uploaded successfully!");
      onChange(url, "uploaded");
    } catch (err: any) {
      console.error("Upload error:", err);
      const errMsg = err?.message || "Failed to upload video.";
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle YouTube URL change
  const handleYoutubeChange = (val: string) => {
    setYoutubeInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      onChange(null, null);
      return;
    }

    if (isYouTubeUrl(trimmed)) {
      onChange(trimmed, "youtube");
    } else {
      // Keep input for typing, but do not set invalid URL in scheme record
      onChange(null, null);
    }
  };

  // Remove video
  const handleRemove = async () => {
    if (!confirm("Remove this tutorial video?")) return;

    if (videoType === "uploaded" && videoUrl) {
      // Attempt background cleanup
      deleteSchemeVideoFile(videoUrl).catch(() => {});
    }

    onChange(null, null);
    setYoutubeInput("");
    setUploadedFileName("");
    setUploadedFileSize("");
    setUploadStatus("");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Video removed.");
  };

  const hasVideo = !!videoUrl;
  const ytEmbedUrl = videoType === "youtube" && videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-card/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Video className="h-4 w-4 text-primary" />
            Application Tutorial Video (Optional)
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provide a video guide for this scheme via cloud upload or YouTube link.
          </p>
        </div>

        {/* Mode Selector */}
        {!hasVideo && (
          <div className="inline-flex rounded-md border bg-muted/50 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("upload");
                setUploadError(null);
              }}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                mode === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-3 w-3" />
              Upload Video
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("youtube");
                setUploadError(null);
              }}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors ${
                mode === "youtube"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Youtube className="h-3 w-3 text-red-500" />
              YouTube URL
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE VIDEO DISPLAY (When a video is already attached) */}
      {hasVideo ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent/40 p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold truncate">
                  {videoType === "youtube"
                    ? "YouTube Tutorial Video Linked"
                    : uploadedFileName || "Cloud Tutorial Video Attached"}
                </p>
                <p className="text-muted-foreground text-[11px] truncate">
                  {videoType === "youtube" ? videoUrl : uploadedFileSize ? `Size: ${uploadedFileSize}` : "Ready to publish"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  if (fileInputRef.current && videoType === "uploaded") {
                    fileInputRef.current.click();
                  } else {
                    onChange(null, null);
                  }
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Replace
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleRemove}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>
          </div>

          {/* Video Preview */}
          <div className="rounded-md border bg-black/90 p-1.5">
            <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Play className="h-3 w-3" /> Video Preview (Shown to users):
            </p>
            <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
              {videoType === "youtube" && ytEmbedUrl ? (
                <iframe
                  src={ytEmbedUrl}
                  title="Tutorial Video Preview"
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoUrl || undefined}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* NO VIDEO YET - INPUT FORMS */
        <div className="space-y-3">
          {mode === "upload" ? (
            /* FILE UPLOAD MODE */
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />

              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                  isUploading
                    ? "border-primary/50 bg-primary/5 cursor-wait"
                    : "border-muted hover:border-primary/50 hover:bg-accent/40"
                }`}
              >
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                  <FileVideo className="h-6 w-6" />
                </div>
                <p className="mt-2 text-sm font-medium">
                  {isUploading ? "Uploading video…" : "Click or drag to upload tutorial video"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supported formats: <b>MP4</b>, <b>WebM</b>, <b>MOV</b> (Max 100 MB)
                </p>
              </div>

              {/* Upload Progress & Status */}
              {isUploading && (
                <div className="space-y-1.5 rounded-md border bg-accent/30 p-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 truncate">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                      {uploadedFileName} ({uploadedFileSize})
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {uploadProgress}%
                    </Badge>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">{uploadStatus}</p>
                </div>
              )}

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Upload failed</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{uploadError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-destructive/70 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* YOUTUBE URL MODE */
            <div className="space-y-2">
              <div>
                <Label htmlFor="youtube-url" className="text-xs">
                  YouTube Video Link
                </Label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="youtube-url"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeInput}
                      onChange={(e) => handleYoutubeChange(e.target.value)}
                      className="pr-8 text-sm"
                    />
                    {youtubeInput && isYouTubeUrl(youtubeInput) && (
                      <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-success" />
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Paste any YouTube watch, short, or share link (e.g. <code>https://youtu.be/videoId</code>).
                </p>
              </div>

              {/* YouTube Validation State */}
              {youtubeInput && !isYouTubeUrl(youtubeInput) && (
                <div className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Please enter a valid YouTube link format.</span>
                </div>
              )}

              {/* YouTube Live Preview */}
              {youtubeInput && isYouTubeUrl(youtubeInput) && (
                <div className="rounded-md border bg-black/90 p-1.5">
                  <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Play className="h-3 w-3" /> YouTube Video Preview:
                  </p>
                  <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
                    <iframe
                      src={getYouTubeEmbedUrl(youtubeInput)!}
                      title="YouTube Preview"
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
