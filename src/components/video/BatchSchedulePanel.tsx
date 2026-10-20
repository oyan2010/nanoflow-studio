import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Play, Clock, Mail, Loader2, Sparkles, Shuffle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";

interface BatchSchedulePanelProps {
  batchPrompts: string;
  setBatchPrompts: (value: string) => void;
  dynamicBatchSize: number;
  isGenerating: boolean;
  onInstantGenerate: () => void;
}

export function BatchSchedulePanel({
  batchPrompts,
  setBatchPrompts,
  dynamicBatchSize,
  isGenerating,
  onInstantGenerate,
}: BatchSchedulePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isScheduling, setIsScheduling] = useState(false);
  const [useConsistentSeed, setUseConsistentSeed] = useState(false);
  const [quota, setQuota] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (user) {
      checkQuota();
    }
  }, [user]);

  const checkQuota = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('check_user_quota', { user_id: user.id });
    if (!error && data && data.length > 0) {
      setQuota({ current: data[0].current_usage, total: data[0].monthly_limit });
    }
  };

  const promptCount = batchPrompts.split("\n").filter((p) => p.trim()).length;

  const handleScheduleBatch = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to schedule batch generations.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    const prompts = batchPrompts.split("\n").filter((p) => p.trim());
    if (prompts.length === 0) return;

    // Check user quota before scheduling
    const { data: quotaData, error: quotaError } = await supabase
      .rpc('check_user_quota', { user_id: user.id });

    if (quotaError) {
      toast({
        title: "Error",
        description: "Failed to check quota. Please try again.",
        variant: "destructive",
      });
      console.error("Quota check error:", quotaError);
      return;
    }

    if (!quotaData || quotaData.length === 0 || !quotaData[0].can_generate) {
      const quota = quotaData?.[0] || { current_usage: 0, monthly_limit: 0 };
      toast({
        title: "Monthly Limit Reached",
        description: `You've used ${quota.current_usage}/${quota.monthly_limit} videos this month. Please upgrade your plan.`,
        variant: "destructive",
      });
      return;
    }

    const quota = quotaData[0];
    const remainingVideos = quota.monthly_limit - quota.current_usage;

    // Warn if batch exceeds remaining quota
    if (prompts.length > remainingVideos) {
      const proceed = confirm(
        `This batch has ${prompts.length} videos but you only have ${remainingVideos} videos remaining this month. ` +
        `Only the first ${remainingVideos} will be processed. Continue?`
      );
      if (!proceed) return;
    }

    setIsScheduling(true);

    try {
      // Generate batch seed if consistency mode is enabled
      const batchSeed = useConsistentSeed ? Math.floor(Math.random() * 1000000) : null;

      // Create batch job with consistency settings
      const { data: batchJob, error: batchError } = await supabase
        .from("batch_jobs")
        .insert({
          user_id: user.id,
          status: "pending",
          total_items: prompts.length,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create batch items
      const items = prompts.map((prompt) => ({
        batch_id: batchJob.id,
        prompt: prompt.trim(),
        status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("batch_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Trigger background processing (Queue Consumer)
      // Wait for the invocation to ensure it starts successfully
      const { data: queueResponse, error: queueError } = await supabase.functions.invoke("process-queue", {
        body: { retryLoop: 0 },
      });

      if (queueError) {
        console.error("Queue trigger error:", queueError);
        toast({
          title: "Warning",
          description: `Batch created but queue trigger failed: ${queueError.message}. You can manually retry from Analytics page.`,
          variant: "destructive",
        });
      } else {
        console.log("Queue triggered successfully:", queueResponse);
      }

      toast({
        title: "Batch Scheduled! 🎉",
        description: `${prompts.length} videos queued. Processing happens in the background - you can close this tab!`,
      });

      setBatchPrompts("");
      setUseConsistentSeed(false);

    } catch (error: any) {
      console.error("Error scheduling batch:", error);
      toast({
        title: "Scheduling Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="batch-prompts">Enter prompts (one per line)</Label>
        <span className="text-xs text-muted-foreground">
          {promptCount} prompts
        </span>
      </div>

      {quota && (
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className={quota.current >= quota.total ? "text-destructive font-medium" : "text-muted-foreground"}>
              Monthly Quota: {quota.current}/{quota.total} videos
            </span>
            <span className="text-muted-foreground">{Math.round((quota.current / quota.total) * 100)}%</span>
          </div>
          <Progress
            value={(quota.current / quota.total) * 100}
            className={quota.current >= quota.total ? "h-2 [&>div]:bg-destructive" : "h-2"}
          />
        </div>
      )}

      <Textarea
        id="batch-prompts"
        placeholder="A calm lake reflecting mountains&#10;Fire dancing in slow motion&#10;Aurora borealis over snowy peaks..."
        value={batchPrompts}
        onChange={(e) => setBatchPrompts(e.target.value)}
        className="min-h-[200px] resize-none font-mono text-sm"
      />

      {/* Consistency Mode Toggle */}
      <div className="p-4 rounded-xl glass border-primary/20 space-y-3 hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Consistency Mode</span>
          </div>
          <Switch
            checked={useConsistentSeed}
            onCheckedChange={setUseConsistentSeed}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {useConsistentSeed
            ? "All videos will use the same seed for a consistent visual style across the batch."
            : "Each video will use a random seed for varied results."}
        </p>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          Smart Load Balancing Active
        </div>
        <p className="text-xs text-muted-foreground">
          Videos will be distributed across our servers with {dynamicBatchSize} concurrent
          videos for optimal performance based on current server load.
        </p>
      </div>

      <Tabs defaultValue="scheduled" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="w-4 h-4" />
            Schedule (Background)
          </TabsTrigger>
          <TabsTrigger value="instant" className="gap-2">
            <Play className="w-4 h-4" />
            Instant (Wait)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          <div className="p-4 rounded-lg bg-chart-2/10 border border-chart-2/20">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-chart-2" />
              <span className="text-sm font-medium">Email Notification</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your videos will be processed in the background with smart auto-retry.
              Failed items will retry up to 3 times before being skipped.
              You'll receive an email when all videos are ready!
            </p>
          </div>

          <Button
            variant="hero"
            className="w-full gap-2"
            onClick={handleScheduleBatch}
            disabled={isScheduling || promptCount === 0}
          >
            {isScheduling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            Schedule {promptCount} Videos
          </Button>

          {/* View Status Link */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Track your scheduled batches in real-time
            </p>
            <Link to="/analytics">
              <Button variant="outline" size="sm" className="gap-2 w-full">
                <Package className="w-4 h-4" />
                View Scheduled Jobs
              </Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="instant" className="space-y-4">
          <div className="p-4 rounded-lg bg-chart-4/10 border border-chart-4/20">
            <p className="text-xs text-muted-foreground">
              Videos will be generated one by one while you wait. Keep this page open until
              processing completes. Best for small batches (1-5 videos).
            </p>
          </div>

          <Button
            variant="hero"
            className="w-full gap-2"
            onClick={onInstantGenerate}
            disabled={isGenerating || promptCount === 0}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start Instant Processing
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
