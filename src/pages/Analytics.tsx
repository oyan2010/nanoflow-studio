import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Video,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  Package,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BatchItemEditDialog } from "@/components/video/BatchItemEditDialog";
import { useBatchRealtime } from "@/hooks/useBatchRealtime";
import { useBatchItems } from "@/hooks/useBatchItems";
import { GenerationHistory } from "@/components/video/GenerationHistory";

interface GenerationLog {
  id: string;
  type: string;
  status: string;
  prompt: string | null;
  created_at: string;
}

interface BatchJob {
  id: string;
  status: string;
  total_items: number;
  completed_items: number;
  failed_items: number;
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
}

interface BatchItem {
  id: string;
  prompt: string;
  status: string;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
}

interface UserProfile {
  plan: string;
  monthly_usage: number;
  monthly_limit: number;
  videos_generated: number;
  images_generated: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  // Real-time subscriptions
  const { batches: batchJobs, isLoading: batchesLoading } = useBatchRealtime(user?.id);
  const { items: batchItems, isLoading: itemsLoading, refresh: refreshItems } = useBatchItems(selectedBatch);

  const isLoading = batchesLoading;
  const [retryingBatchId, setRetryingBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("plan, monthly_usage, monthly_limit, videos_generated, images_generated")
        .eq("id", user?.id)
        .single();

      if (profileData) setProfile(profileData);

      // Fetch generation logs
      const { data: logsData } = await supabase
        .from("generation_logs")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsData) setLogs(logsData);

      // Batch jobs are loaded via useBatchRealtime hook
    } catch (error) {
      console.error("Error loading analytics:", error);
    }
  };

  const loadBatchItems = async (batchId: string) => {
    setSelectedBatch(batchId);
    // Batch items are loaded via useBatchItems hook
  };

  const downloadBatchVideo = (item: BatchItem) => {
    if (!item.video_url) return;
    window.open(item.video_url, "_blank");
  };

  const downloadAllVideos = async () => {
    const completedItems = batchItems.filter(
      (item) => item.video_url || item.image_url
    );

    if (completedItems.length === 0) {
      toast({
        title: "No videos to download",
        description: "There are no videos available in this batch.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Preparing ZIP file...",
      description: `Downloading ${completedItems.length} videos and creating ZIP archive.`,
    });

    try {
      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Fetch all videos and images and add to ZIP
      const fetchPromises = completedItems.map(async (item, index) => {
        const url = item.video_url || item.image_url; // Prioritize video if both exist, or download both? 
        // Logic: specific items usually have one or the other as "result". 
        // But our schema supports both. 
        // Let's check logic: if video exists, it's a video item. If only image, it's image.

        if (!url) return;
        const isVideo = !!item.video_url;

        try {
          const response = await fetch(url);
          const blob = await response.blob();

          // Create filename from prompt (sanitized)
          const sanitizedPrompt = item.prompt
            .substring(0, 50)
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
          const ext = isVideo ? 'mp4' : 'png'; // Assume png for images from ImageBB/GoogleFX
          const fileName = `${index + 1}_${sanitizedPrompt}.${ext}`;

          zip.file(fileName, blob);
        } catch (error) {
          console.error(`Failed to download item ${index + 1}:`, error);
        }
      });

      await Promise.all(fetchPromises);

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download the ZIP
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `batch_videos_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: "Download Complete!",
        description: `Successfully created ZIP file with ${completedItems.length} videos.`,
      });
    } catch (error) {
      console.error("Failed to create ZIP:", error);
      toast({
        title: "Download Failed",
        description: "Failed to create ZIP file. Please try downloading videos individually.",
        variant: "destructive",
      });
    }
  };

  const handleRetryBatch = async (batchId: string) => {
    setRetryingBatchId(batchId);
    try {
      // 1. Reset failed/pending items to 'pending' (and ensure parent job is processing/pending)
      const { error: resetError } = await supabase
        .from("batch_items")
        .update({ status: "pending", error_message: null, retry_count: 0 })
        .eq("batch_id", batchId)
        .in("status", ["failed", "skipped", "pending"]); // Only retry failed/stuck ones

      if (resetError) throw resetError;

      // 2. Reset parent status just in case
      await supabase.from("batch_jobs").update({ status: "pending" }).eq("id", batchId);

      // 3. Trigger queue
      const { error } = await supabase.functions.invoke("process-queue", {
        body: { retryLoop: 0 },
      });

      if (error) throw error;

      toast({
        title: "Batch Queued",
        description: "Your batch has been added to the processing queue.",
      });

      // Refresh after 2 seconds
      setTimeout(() => loadData(), 2000);
    } catch (error: any) {
      toast({
        title: "Retry Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRetryingBatchId(null);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container px-4 py-16">
          <div className="max-w-md mx-auto text-center glass rounded-2xl p-8">
            <BarChart3 className="w-16 h-16 mx-auto text-primary/50 mb-6" />
            <h1 className="font-display text-2xl font-bold mb-3">Analytics Dashboard</h1>
            <p className="text-muted-foreground mb-6">
              View your generation history, usage stats, and batch jobs.
            </p>
            <Link to="/auth">
              <Button variant="hero" className="gap-2">Login to Access</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const usagePercent = profile ? (profile.monthly_usage / profile.monthly_limit) * 100 : 0;

  return (
    <Layout>
      <div className="container px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="font-display text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your generations, view history, and manage batch jobs
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <Card className="glass p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profile?.videos_generated || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Videos</p>
                  </div>
                </div>
              </Card>

              <Card className="glass p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-chart-2/10 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profile?.images_generated || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Images</p>
                  </div>
                </div>
              </Card>

              <Card className="glass p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profile?.monthly_usage || 0}</p>
                    <p className="text-xs text-muted-foreground">This Month</p>
                  </div>
                </div>
              </Card>

              <Card className="glass p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-chart-5/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-chart-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{batchJobs.length}</p>
                    <p className="text-xs text-muted-foreground">Batch Jobs</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Usage Bar */}
            <Card className="glass p-6 mb-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Monthly Usage</h3>
                  <p className="text-sm text-muted-foreground">
                    {profile?.monthly_usage || 0} / {profile?.monthly_limit || 0} generations
                  </p>
                </div>
                <Badge variant={profile?.plan === "enterprise" ? "default" : "secondary"}>
                  {profile?.plan === "enterprise" ? "Ultra" : profile?.plan === "pro" ? "Pro" : "Free"}
                </Badge>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              {usagePercent >= 80 && (
                <p className="text-xs text-chart-4 mt-2">
                  ⚠️ You're running low on generations. Consider upgrading your plan.
                </p>
              )}
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="videos" className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="videos" className="gap-2">
                  <Video className="w-4 h-4" />
                  Video History
                </TabsTrigger>
                <TabsTrigger value="images" className="gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Image History
                </TabsTrigger>
                <TabsTrigger value="batch" className="gap-2">
                  <Package className="w-4 h-4" />
                  Scheduled Jobs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="videos">
                <div className="glass p-4 rounded-xl">
                  <GenerationHistory filter="video" />
                </div>
              </TabsContent>

              <TabsContent value="images">
                <div className="glass p-4 rounded-xl">
                  <GenerationHistory filter="image" />
                </div>
              </TabsContent>


              <TabsContent value="batch">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Batch Jobs List */}
                  <Card className="glass">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold">Scheduled Batch Jobs</h3>
                      <Button variant="ghost" size="sm" onClick={loadData}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                      {batchJobs.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No batch jobs yet</p>
                          <p className="text-xs mt-1">Schedule batch generations from the Video page</p>
                        </div>
                      ) : (
                        batchJobs.map((job) => (
                          <div
                            key={job.id}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedBatch === job.id ? "bg-primary/5" : ""
                              }`}
                            onClick={() => loadBatchItems(job.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">
                                  {job.total_items} videos
                                </span>
                              </div>
                              <Badge
                                variant={
                                  job.status === "completed"
                                    ? "default"
                                    : job.status === "processing"
                                      ? "secondary"
                                      : job.status === "failed"
                                        ? "destructive"
                                        : "outline"
                                }
                              >
                                {job.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-chart-2" />
                                {job.completed_items} done
                              </span>
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-destructive" />
                                {job.failed_items} failed
                              </span>
                              {(job.status === "pending" || job.status === "failed") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 text-xs ml-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetryBatch(job.id);
                                  }}
                                  disabled={retryingBatchId === job.id}
                                >
                                  {retryingBatchId === job.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(job.created_at), "MMM d, yyyy h:mm a")}
                            </p>

                            {/* Progress Bar for Processing Batches */}
                            {job.status === "processing" && job.total_items > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {job.completed_items} of {job.total_items} completed
                                  </span>
                                  <span className="text-primary font-medium">
                                    ~{Math.ceil((job.total_items - job.completed_items) * 1.5)} min left
                                  </span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-500"
                                    style={{
                                      width: `${(job.completed_items / job.total_items) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {job.status === "pending" &&
                              new Date().getTime() - new Date(job.created_at).getTime() >
                              10 * 60 * 1000 && (
                                <p className="text-xs text-chart-4 mt-1 flex items-center gap-1">
                                  ⚠️ Processing delayed. Try manual retry.
                                </p>
                              )}
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  {/* Batch Items Detail */}
                  <Card className="glass">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold">
                        {selectedBatch ? "Job Details" : "Select a job to view details"}
                      </h3>
                      <div className="flex items-center gap-2">
                        {selectedBatch && (
                          <Button variant="ghost" size="sm" onClick={refreshItems} title="Refresh items">
                            <RefreshCw className={`w-4 h-4 ${itemsLoading ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        {selectedBatch && batchItems.some(item => item.video_url) && (
                          <Button
                            size="sm"
                            onClick={downloadAllVideos}
                            className="gap-2"
                            variant="default"
                          >
                            <Package className="w-4 h-4" />
                            Download ZIP
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                      {!selectedBatch ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Click on a batch to see video details</p>
                        </div>
                      ) : itemsLoading ? (
                        <div className="p-8 flex justify-center">
                          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                        </div>
                      ) : batchItems.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <p>No items in this batch</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 p-4">
                          {batchItems.map((item) => (
                            <div key={item.id} className="glass rounded-lg overflow-hidden border border-border">
                              <div className="grid md:grid-cols-[300px_1fr] gap-4">
                                {/* Video Preview - Show if URL exists */}
                                {item.video_url ? (
                                  <div className="relative bg-black aspect-video md:aspect-auto">
                                    <video
                                      src={item.video_url}
                                      className="w-full h-full object-contain"
                                      controls
                                      preload="metadata"
                                      poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23000' width='400' height='300'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='sans-serif' font-size='18'%3ELoading video...%3C/text%3E%3C/svg%3E"
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-muted flex items-center justify-center aspect-video md:aspect-auto min-h-[200px]">
                                    <div className="text-center p-4">
                                      {item.status === "processing" ? (
                                        <>
                                          <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-primary" />
                                          <p className="text-sm text-muted-foreground">Generating video...</p>
                                        </>
                                      ) : item.status === "pending" ? (
                                        <>
                                          <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                                          <p className="text-sm text-muted-foreground">Waiting in queue...</p>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                                          <p className="text-sm text-destructive">Video unavailable</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Info Section */}
                                <div className="p-4 flex flex-col justify-between">
                                  <div className="space-y-3">
                                    {/* Prompt */}
                                    <div>
                                      <p className="text-sm font-medium leading-relaxed">{item.prompt}</p>
                                    </div>

                                    {/* Error Message */}
                                    {item.error_message && (
                                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                        <p className="text-xs text-destructive">{item.error_message}</p>
                                      </div>
                                    )}

                                    {/* Status Badge */}
                                    <div>
                                      <Badge
                                        variant={
                                          item.video_url && item.status === "completed"
                                            ? "default"
                                            : item.status === "processing"
                                              ? "secondary"
                                              : item.status === "failed" || item.status === "skipped"
                                                ? "destructive"
                                                : "outline"
                                        }
                                        className="text-xs"
                                      >
                                        {item.video_url ? "✓ Ready" : item.status}
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                                    {(item.status === "failed" || item.status === "skipped" || item.status === "completed") && (
                                      <BatchItemEditDialog
                                        itemId={item.id}
                                        originalPrompt={item.prompt}
                                        onSuccess={() => loadBatchItems(selectedBatch!)}
                                        mode={item.status === "completed" ? "regenerate" : "retry"}
                                      />
                                    )}
                                    {item.video_url && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => downloadBatchVideo(item)}
                                      >
                                        <Download className="w-4 h-4" />
                                        Download
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Email notification info */}
                <Card className="glass p-4 mt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        You'll receive an email when your scheduled batch jobs complete
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
