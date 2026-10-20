import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Trash2,
  Download,
  Video,
  Image as ImageIcon,
  RefreshCw,
  Clock,
  Play,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface GenerationLog {
  id: string;
  type: string;
  status: string;
  prompt: string | null;
  result_url: string | null;
  image_url: string | null;
  created_at: string;
}

interface GenerationHistoryProps {
  filter?: "video" | "image" | "all";
}

export function GenerationHistory({ filter = "all" }: GenerationHistoryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"video" | "image">("video");

  const loadHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("generation_logs")
        .select("id, type, status, prompt, result_url, image_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter === "video") {
        query = query.in("type", ["text_to_video", "image_to_video", "video"]);
      } else if (filter === "image") {
        query = query.in("type", ["text_to_image", "image"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as GenerationLog[]) || []);
    } catch (error: any) {
      toast({ title: "Failed to load history", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadHistory();

    // Real-time subscription — auto-refresh when new logs are added
    const channel = supabase
      .channel(`generation_logs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "generation_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newLog = payload.new as GenerationLog;
          // Only add if it matches current filter
          const isVideo = ["text_to_video", "image_to_video", "video"].includes(newLog.type);
          const isImage = ["text_to_image", "image"].includes(newLog.type);
          if (
            filter === "all" ||
            (filter === "video" && isVideo) ||
            (filter === "image" && isImage)
          ) {
            setLogs((prev) => [newLog, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "generation_logs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setLogs((prev) => prev.filter((l) => l.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, filter]);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const { error } = await supabase.from("generation_logs").delete().eq("id", id);
      if (error) throw error;
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast({ title: "Deleted", description: "History item removed." });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const isVideoType = (type: string) =>
    ["text_to_video", "image_to_video", "video"].includes(type);

  const getDisplayUrl = (log: GenerationLog) => log.result_url || log.image_url || null;

  const handleDownload = (log: GenerationLog) => {
    const url = getDisplayUrl(log);
    if (!url) return;
    const ext = isVideoType(log.type) ? "mp4" : "png";
    const filename = `nanoflow_${log.type}_${log.id.slice(0, 8)}.${ext}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (log: GenerationLog) => {
    const url = getDisplayUrl(log);
    if (!url) return;
    setPreviewType(isVideoType(log.type) ? "video" : "image");
    setPreviewUrl(url);
  };

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generation History</h3>
        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading && logs.length === 0 ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center p-12 glass rounded-xl border border-dashed border-border">
          <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h4 className="font-medium text-lg mb-1">No history yet</h4>
          <p className="text-sm text-muted-foreground">
            Generated {filter === "all" ? "videos and images" : filter + "s"} will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {logs.map((log) => {
            const displayUrl = getDisplayUrl(log);
            const isVideo = isVideoType(log.type);
            const hasMedia = !!displayUrl;

            return (
              <Card
                key={log.id}
                className="glass overflow-hidden group hover:border-primary/40 transition-colors"
              >
                {/* Media Preview */}
                <div
                  className="aspect-video relative bg-black/30 cursor-pointer"
                  onClick={() => hasMedia && handlePreview(log)}
                >
                  {isVideo && displayUrl ? (
                    <>
                      <video
                        src={displayUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        onMouseOver={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseOut={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <Play className="w-10 h-10 text-white drop-shadow-lg" />
                      </div>
                    </>
                  ) : !isVideo && (log.image_url || displayUrl) ? (
                    <img
                      src={log.image_url || displayUrl || ""}
                      alt={log.prompt || "Generated image"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                      {isVideo ? (
                        <Video className="w-8 h-8 opacity-40" />
                      ) : (
                        <ImageIcon className="w-8 h-8 opacity-40" />
                      )}
                      <span className="text-xs opacity-60">
                        {log.status === "done" ? "No preview" : log.status}
                      </span>
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge
                      variant={log.status === "done" ? "default" : "secondary"}
                      className="text-[10px] h-5 gap-1"
                    >
                      {isVideo ? (
                        <Video className="w-3 h-3" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                      {log.status === "done" ? "Ready" : log.status}
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-3">
                  <p
                    className="text-sm font-medium line-clamp-2 min-h-[40px]"
                    title={log.prompt || ""}
                  >
                    {log.prompt || "Untitled Generation"}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, h:mm a")}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasMedia && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download"
                          onClick={() => handleDownload(log)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(log.id)}
                        disabled={isDeleting === log.id}
                      >
                        {isDeleting === log.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inline Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-10 right-0 text-white hover:text-white hover:bg-white/20"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-5 h-5" />
            </Button>
            {previewType === "video" ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full max-h-[85vh] rounded-xl"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-[85vh] object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
