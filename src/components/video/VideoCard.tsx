import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Loader2, Eye, Download, RefreshCw } from "lucide-react";

export interface GeneratedVideo {
  id: number;
  prompt: string;
  status: "pending" | "generating" | "done" | "error";
  videoBase64?: string;
  error?: string;
  progress?: string;
}

interface VideoCardProps {
  video: GeneratedVideo;
  onPreview: (videoBase64: string) => void;
  onDownload: (video: GeneratedVideo) => void;
  onRetry?: (video: GeneratedVideo) => void;
}

export function VideoCard({ video, onPreview, onDownload, onRetry }: VideoCardProps) {
  return (
    <div className="glass rounded-lg overflow-hidden animate-scale-in">
      {/* Media Preview */}
      <div
        className={cn(
          "relative aspect-video bg-muted",
          video.status === "done" && "cursor-pointer group"
        )}
        onClick={() => {
          if (video.status === "done" && video.videoBase64) {
            onPreview(video.videoBase64);
          }
        }}
      >
        {video.status === "done" && video.videoBase64 ? (
          <>
            <video
              src={`data:video/mp4;base64,${video.videoBase64}`}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Eye className="w-6 h-6 text-primary-foreground" />
            </div>
          </>
        ) : video.status === "generating" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <div className="absolute inset-0 blur-lg bg-primary/30 animate-pulse" />
            </div>
            <span className="text-xs text-muted-foreground text-center px-2">
              {video.progress || "Generating..."}
            </span>
          </div>
        ) : video.status === "pending" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Queued...</span>
          </div>
        ) : video.status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive gap-2 p-2">
            <XCircle className="w-6 h-6" />
            <span className="text-xs text-center line-clamp-2">{video.error}</span>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(video);
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-2">{video.prompt}</p>
        <div className="flex items-center justify-between">
          <Badge
            variant={
              video.status === "done"
                ? "default"
                : video.status === "error"
                  ? "destructive"
                  : "secondary"
            }
            className="text-[10px]"
          >
            {video.status === "done" && <CheckCircle className="w-3 h-3 mr-1" />}
            {video.status === "error" && <XCircle className="w-3 h-3 mr-1" />}
            {video.status === "generating" && (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            )}
            {video.status === "done"
              ? "Ready"
              : video.status === "generating"
                ? "Creating..."
                : video.status === "pending"
                  ? "Queued"
                  : "Error"}
          </Badge>

          {video.status === "done" && video.videoBase64 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(video);
              }}
            >
              <Download className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
