import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BatchItemEditDialogProps {
  itemId: string;
  originalPrompt: string;
  onSuccess: () => void;
  mode?: "retry" | "regenerate";
}

export function BatchItemEditDialog({
  itemId,
  originalPrompt,
  onSuccess,
  mode = "retry"
}: BatchItemEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(originalPrompt);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update the batch item with new prompt and reset status
      const { data: itemData, error: updateError } = await supabase
        .from("batch_items")
        .update({
          prompt: prompt.trim(),
          status: "pending",
          error_message: null,
          retry_count: 0,
          completed_at: null,
        })
        .eq("id", itemId)
        .select("batch_id")
        .single();

      if (updateError) throw updateError;

      // 2. Ensure parent batch is marked as pending/processing so queue picks it up
      if (itemData?.batch_id) {
        await supabase
          .from("batch_jobs")
          .update({ status: "pending" })
          .eq("id", itemData.batch_id);
      }

      // 3. Trigger the queue processor
      supabase.functions.invoke("process-queue", {
        body: { retryLoop: 0 },
      }).catch(console.error); // Fire and forget


      toast.success(mode === "regenerate" ? "Video queuing for regeneration" : "Item queued for retry");
      setIsOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast.error(error.message || "Failed to update item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
          {mode === "regenerate" ? (
            <>
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </>
          ) : (
            <>
              <Edit className="w-3 h-3" />
              Edit & Retry
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            {mode === "regenerate" ? "Regenerate Video" : "Edit & Retry"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Video Prompt</Label>
            <Textarea
              id="edit-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your video prompt..."
              className="min-h-[100px] resize-none rounded-xl"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "regenerate"
              ? "This will overwrite the existing video. The item will be queued for processing."
              : "The item will be re-queued for processing with the updated prompt."}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              className="flex-1 gap-2 rounded-xl"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {mode === "regenerate" ? "Regenerate" : "Retry Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
