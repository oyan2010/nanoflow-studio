import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Video as VideoIcon,
  Layers,
  Download,
  RefreshCw,
  Sparkles,
  Loader2,
  Play,
  ImagePlus,
  Clock,
  Mail,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/hooks/usePresence";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { VideoCard, GeneratedVideo } from "@/components/video/VideoCard";
import { VideoPreviewModal } from "@/components/video/VideoPreviewModal";
import { ImageToVideoUpload } from "@/components/video/ImageToVideoUpload";
import { BatchSchedulePanel } from "@/components/video/BatchSchedulePanel";
import { GenerationHistory } from "@/components/video/GenerationHistory";

export default function VideoGen() {
  const [singlePrompt, setSinglePrompt] = useState("");
  const [batchPrompts, setBatchPrompts] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const { toast } = useToast();
  const { dynamicBatchSize, setGenerating } = usePresence();

  // Update presence when generating
  useEffect(() => {
    setGenerating(isGenerating);
  }, [isGenerating, setGenerating]);

  const generateVideo = async (
    prompt: string,
    onProgress: (progress: string) => void,
    providedImage?: string
  ): Promise<{ videoBase64: string }> => {
    onProgress("Creating your video...");

    const body: any = { prompt };

    if (providedImage) {
      body.action = "animate";
      body.imageBase64 = providedImage;
    } else {
      body.action = "full";
    }

    const { data, error } = await supabase.functions.invoke("generate-video", {
      body,
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Video generation failed");
    }

    return { videoBase64: data.videoBase64 };
  };

  const handleSingleGenerate = async () => {
    if (!singlePrompt.trim()) return;
    setIsGenerating(true);

    const video: GeneratedVideo = {
      id: Date.now(),
      prompt: singlePrompt,
      status: "generating",
      progress: "Starting video generation...",
    };
    setGeneratedVideos([video]);

    try {
      const { videoBase64 } = await generateVideo(singlePrompt, (progress) => {
        setGeneratedVideos([{ ...video, progress }]);
      });

      setGeneratedVideos([
        {
          ...video,
          status: "done",
          videoBase64,
        },
      ]);
      toast({
        title: "Video Ready!",
        description: "Your video has been generated successfully.",
      });
    } catch (error: any) {
      setGeneratedVideos([
        {
          ...video,
          status: "error",
          error: error.message,
        },
      ]);
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageToVideo = async (imageBase64: string, prompt: string) => {
    setIsGenerating(true);

    const video: GeneratedVideo = {
      id: Date.now(),
      prompt: prompt,
      status: "generating",
      progress: "Animating your image...",
    };
    setGeneratedVideos((prev) => [video, ...prev]);

    try {
      const { videoBase64 } = await generateVideo(
        prompt,
        (progress) => {
          setGeneratedVideos((prev) =>
            prev.map((v) => (v.id === video.id ? { ...v, progress } : v))
          );
        },
        imageBase64
      );

      setGeneratedVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, status: "done", videoBase64 } : v
        )
      );
      toast({
        title: "Animation Complete!",
        description: "Your image has been animated successfully.",
      });
    } catch (error: any) {
      setGeneratedVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, status: "error", error: error.message } : v
        )
      );
      toast({
        title: "Animation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchGenerate = async () => {
    const prompts = batchPrompts.split("\n").filter((p) => p.trim());
    if (prompts.length === 0) return;

    setIsGenerating(true);
    const videos: GeneratedVideo[] = prompts.map((prompt, i) => ({
      id: Date.now() + i,
      prompt: prompt.trim(),
      status: "pending" as const,
    }));
    setGeneratedVideos(videos);

    // Use dynamic batch size based on online users and available APIs
    const batchSize = dynamicBatchSize;

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (vid) => {
          setGeneratedVideos((prev) =>
            prev.map((v) =>
              v.id === vid.id
                ? { ...v, status: "generating" as const, progress: "Creating video..." }
                : v
            )
          );

          try {
            const { videoBase64 } = await generateVideo(vid.prompt, (progress) => {
              setGeneratedVideos((prev) =>
                prev.map((v) => (v.id === vid.id ? { ...v, progress } : v))
              );
            });

            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id ? { ...v, status: "done" as const, videoBase64 } : v
              )
            );
          } catch (error: any) {
            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id
                  ? { ...v, status: "error" as const, error: error.message }
                  : v
              )
            );
          }
        })
      );
    }

    setIsGenerating(false);
    toast({
      title: "Batch Complete",
      description: `Processed ${prompts.length} videos`,
    });
  };

  const handleRetryFailed = async () => {
    const failed = generatedVideos.filter((v) => v.status === "error");
    if (failed.length === 0) return;

    setIsGenerating(true);
    const batchSize = dynamicBatchSize;

    for (let i = 0; i < failed.length; i += batchSize) {
      const batch = failed.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (vid) => {
          setGeneratedVideos((prev) =>
            prev.map((v) =>
              v.id === vid.id
                ? {
                  ...v,
                  status: "generating" as const,
                  error: undefined,
                  progress: "Retrying...",
                }
                : v
            )
          );

          try {
            const { videoBase64 } = await generateVideo(vid.prompt, (progress) => {
              setGeneratedVideos((prev) =>
                prev.map((v) => (v.id === vid.id ? { ...v, progress } : v))
              );
            });

            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id ? { ...v, status: "done" as const, videoBase64 } : v
              )
            );
          } catch (error: any) {
            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id
                  ? { ...v, status: "error" as const, error: error.message }
                  : v
              )
            );
          }
        })
      );
    }

    setIsGenerating(false);
  };

  // Per-item retry handler
  const handleRetrySingle = async (vid: GeneratedVideo) => {
    setIsGenerating(true);

    setGeneratedVideos((prev) =>
      prev.map((v) =>
        v.id === vid.id
          ? { ...v, status: "generating" as const, error: undefined, progress: "Retrying..." }
          : v
      )
    );

    try {
      const { videoBase64 } = await generateVideo(vid.prompt, (progress) => {
        setGeneratedVideos((prev) =>
          prev.map((v) => (v.id === vid.id ? { ...v, progress } : v))
        );
      });

      setGeneratedVideos((prev) =>
        prev.map((v) =>
          v.id === vid.id ? { ...v, status: "done" as const, videoBase64 } : v
        )
      );
      toast({ title: "Retry Successful!", description: "Video generated successfully." });
    } catch (error: any) {
      setGeneratedVideos((prev) =>
        prev.map((v) =>
          v.id === vid.id ? { ...v, status: "error" as const, error: error.message } : v
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Retry all (regenerate everything from scratch)
  const handleRetryAll = async () => {
    if (generatedVideos.length === 0) return;

    setIsGenerating(true);

    // Reset all to pending
    setGeneratedVideos((prev) =>
      prev.map((v) => ({ ...v, status: "pending" as const, videoBase64: undefined, error: undefined }))
    );

    const batchSize = dynamicBatchSize;
    const videos = [...generatedVideos];

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (vid) => {
          setGeneratedVideos((prev) =>
            prev.map((v) =>
              v.id === vid.id
                ? { ...v, status: "generating" as const, progress: "Creating video..." }
                : v
            )
          );

          try {
            const { videoBase64 } = await generateVideo(vid.prompt, (progress) => {
              setGeneratedVideos((prev) =>
                prev.map((v) => (v.id === vid.id ? { ...v, progress } : v))
              );
            });

            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id ? { ...v, status: "done" as const, videoBase64 } : v
              )
            );
          } catch (error: any) {
            setGeneratedVideos((prev) =>
              prev.map((v) =>
                v.id === vid.id ? { ...v, status: "error" as const, error: error.message } : v
              )
            );
          }
        })
      );
    }

    setIsGenerating(false);
    toast({
      title: "Retry All Complete",
      description: `Processed all ${videos.length} videos`,
    });
  };

  const handleDownloadAll = async () => {
    const completed = generatedVideos.filter(
      (v) => v.status === "done" && v.videoBase64
    );
    if (completed.length === 0) return;

    const zip = new JSZip();

    completed.forEach((vid, index) => {
      if (vid.videoBase64) {
        const filename = `video_${index + 1}_${vid.prompt
          .slice(0, 30)
          .replace(/[^a-z0-9]/gi, "_")}.mp4`;
        zip.file(filename, vid.videoBase64, { base64: true });
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai_studio_videos_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingle = (video: GeneratedVideo) => {
    if (!video.videoBase64) return;

    const link = document.createElement("a");
    link.href = `data:video/mp4;base64,${video.videoBase64}`;
    link.download = `video_${video.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}.mp4`;
    link.click();
  };

  const doneCount = generatedVideos.filter((v) => v.status === "done").length;
  const processingCount = generatedVideos.filter((v) =>
    ["pending", "generating"].includes(v.status)
  ).length;
  const errorCount = generatedVideos.filter((v) => v.status === "error").length;

  return (
    <Layout>
      <div className="container px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="font-display text-3xl font-bold mb-2">Video Generation</h1>
          <p className="text-muted-foreground">
            Transform your prompts or images into stunning AI-generated videos
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="single" className="gap-2">
                  <VideoIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Text to Video</span>
                  <span className="sm:hidden">Single</span>
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2">
                  <ImagePlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Image to Video</span>
                  <span className="sm:hidden">Image</span>
                </TabsTrigger>
                <TabsTrigger value="batch" className="gap-2">
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">Batch</span>
                  <span className="sm:hidden">Batch</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                  <span className="sm:hidden">History</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div className="glass rounded-xl p-6 space-y-4">
                  <Label htmlFor="single-prompt">Describe your video</Label>
                  <Textarea
                    id="single-prompt"
                    placeholder="A serene ocean wave rolling onto a sandy beach at golden hour, slow motion..."
                    value={singlePrompt}
                    onChange={(e) => setSinglePrompt(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                  <Button
                    variant="hero"
                    className="w-full gap-2"
                    onClick={handleSingleGenerate}
                    disabled={isGenerating || !singlePrompt.trim()}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Generate Video
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Video generation typically takes 1-2 minutes
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                <ImageToVideoUpload
                  onGenerate={handleImageToVideo}
                  isGenerating={isGenerating}
                />
              </TabsContent>

              <TabsContent value="batch" className="space-y-4">
                <BatchSchedulePanel
                  batchPrompts={batchPrompts}
                  setBatchPrompts={setBatchPrompts}
                  dynamicBatchSize={dynamicBatchSize}
                  isGenerating={isGenerating}
                  onInstantGenerate={handleBatchGenerate}
                />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <GenerationHistory />
              </TabsContent>
            </Tabs>

            {/* Actions */}
            {generatedVideos.length > 0 && (
              <div className="flex flex-wrap gap-3 animate-fade-in">
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px] gap-2"
                  onClick={handleRetryFailed}
                  disabled={errorCount === 0 || isGenerating}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Failed ({errorCount})
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px] gap-2"
                  onClick={handleRetryAll}
                  disabled={generatedVideos.length === 0 || isGenerating}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry All
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px] gap-2"
                  onClick={handleDownloadAll}
                  disabled={doneCount === 0}
                >
                  <Download className="w-4 h-4" />
                  Download All
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {/* Stats */}
            {generatedVideos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-primary">{doneCount}</div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
                <div className="glass rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-chart-4">{processingCount}</div>
                  <div className="text-xs text-muted-foreground">Processing</div>
                </div>
                <div className="glass rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-destructive">{errorCount}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            )}

            {/* Video Grid */}
            <div className="glass rounded-xl p-4 min-h-[400px]">
              {generatedVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <VideoIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No videos yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter a prompt or upload an image to get started
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedVideos.map((vid) => (
                    <VideoCard
                      key={vid.id}
                      video={vid}
                      onPreview={(videoBase64) => setPreviewVideo(videoBase64)}
                      onDownload={handleDownloadSingle}
                      onRetry={handleRetrySingle}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen Preview Modal */}
      {previewVideo && (
        <VideoPreviewModal
          videoBase64={previewVideo}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </Layout>
  );
}
