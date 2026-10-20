import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Search,
  Download,
  Trash2,
  Video,
  Image as ImageIcon,
  RefreshCw,
  ExternalLink,
  FileText,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ContentItem {
  id: string;
  type: "text_to_video" | "image_to_video" | "batch";
  prompt: string;
  url: string | null;
  status: string;
  created_at: string;
  user_email: string;
  user_id: string;
}

interface UserProfile {
  id: string;
  email: string;
}

export function ContentLibraryTab() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email")
        .order("email");

      if (profilesData) setUsers(profilesData);

      // Load generation logs with user info
      const { data: logsData } = await supabase
        .from("generation_logs")
        .select("id, type, prompt, status, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(500);

      // Load batch items with job info
      const { data: batchItemsData } = await supabase
        .from("batch_items")
        .select(`
          id,
          prompt,
          status,
          video_url,
          created_at,
          batch_id,
          batch_jobs!inner(user_id)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      // Combine and format data
      const allItems: ContentItem[] = [];

      // Add generation logs
      logsData?.forEach((log: any) => {
        const userEmail = profilesData?.find(p => p.id === log.user_id)?.email || "Unknown";
        allItems.push({
          id: log.id,
          type: log.type,
          prompt: log.prompt || "No prompt",
          url: null,
          status: log.status,
          created_at: log.created_at,
          user_email: userEmail,
          user_id: log.user_id,
        });
      });

      // Add batch items
      batchItemsData?.forEach((item: any) => {
        const userId = item.batch_jobs?.user_id;
        const userEmail = profilesData?.find(p => p.id === userId)?.email || "Unknown";
        allItems.push({
          id: item.id,
          type: "batch",
          prompt: item.prompt,
          url: item.video_url,
          status: item.status,
          created_at: item.created_at,
          user_email: userEmail,
          user_id: userId,
        });
      });

      // Sort by date
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(allItems);
    } catch (error) {
      console.error("Error loading content:", error);
      toast.error("Failed to load content library");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCompleted = async () => {
    if (!confirm("This will delete all completed batch items and their video files. Continue?")) return;

    setIsClearing(true);
    try {
      // Get completed batch items
      const { data: completedItems } = await supabase
        .from("batch_items")
        .select("id, video_url, batch_id")
        .eq("status", "completed");

      if (completedItems && completedItems.length > 0) {
        // Delete from storage
        for (const item of completedItems) {
          if (item.video_url) {
            const path = item.video_url.split("/batch-videos/")[1];
            if (path) {
              await supabase.storage.from("batch-videos").remove([path]);
            }
          }
        }

        // Delete batch items
        const { error } = await supabase
          .from("batch_items")
          .delete()
          .eq("status", "completed");

        if (error) throw error;
      }

      toast.success(`Cleared ${completedItems?.length || 0} completed items`);
      loadData();
    } catch (error) {
      console.error("Error clearing completed:", error);
      toast.error("Failed to clear completed items");
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearFailed = async () => {
    if (!confirm("This will delete all failed batch items. Continue?")) return;

    setIsClearing(true);
    try {
      const { error } = await supabase
        .from("batch_items")
        .delete()
        .in("status", ["failed", "skipped"]);

      if (error) throw error;

      toast.success("Cleared all failed items");
      loadData();
    } catch (error) {
      console.error("Error clearing failed:", error);
      toast.error("Failed to clear failed items");
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportAll = () => {
    // Group by user
    const grouped: Record<string, ContentItem[]> = {};
    filteredItems.forEach((item) => {
      if (!grouped[item.user_email]) {
        grouped[item.user_email] = [];
      }
      grouped[item.user_email].push(item);
    });

    // Generate export text
    let exportText = `===============================================\n`;
    exportText += `NanoFlow Content Export\n`;
    exportText += `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}\n`;
    exportText += `Total Records: ${filteredItems.length}\n`;
    exportText += `===============================================\n\n`;

    Object.entries(grouped).forEach(([email, userItems]) => {
      exportText += `[USER: ${email}]\n`;
      exportText += `------------------------------------------\n`;

      userItems.forEach((item, index) => {
        exportText += `${index + 1}. Type: ${item.type}\n`;
        exportText += `   Prompt: "${item.prompt}"\n`;
        if (item.url) {
          exportText += `   URL: ${item.url}\n`;
        }
        exportText += `   Status: ${item.status}\n`;
        exportText += `   Created: ${format(new Date(item.created_at), "yyyy-MM-dd HH:mm:ss")}\n\n`;
      });

      exportText += `------------------------------------------\n\n`;
    });

    // Download as .txt file
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nanoflow-export-${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Export downloaded");
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterUser !== "all" && item.user_id !== filterUser) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (searchQuery && !item.prompt.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: items.length,
    completed: items.filter(i => i.status === "completed" || i.status === "success").length,
    failed: items.filter(i => i.status === "failed" || i.status === "skipped").length,
    withUrls: items.filter(i => i.url).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Records</p>
        </Card>
        <Card className="glass p-4 text-center">
          <p className="text-2xl font-bold text-chart-2">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="glass p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          <p className="text-xs text-muted-foreground">Failed/Skipped</p>
        </Card>
        <Card className="glass p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.withUrls}</p>
          <p className="text-xs text-muted-foreground">With URLs</p>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card className="glass p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full md:w-[180px] rounded-xl">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-[150px] rounded-xl">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text_to_video">Text to Video</SelectItem>
              <SelectItem value="image_to_video">Image to Video</SelectItem>
              <SelectItem value="batch">Batch</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[150px] rounded-xl">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAll}>
            <FileText className="w-4 h-4" />
            Export .txt
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-chart-2 hover:text-chart-2"
            onClick={handleClearCompleted}
            disabled={isClearing}
          >
            <Trash2 className="w-4 h-4" />
            Clear Completed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={handleClearFailed}
            disabled={isClearing}
          >
            <Trash2 className="w-4 h-4" />
            Clear Failed
          </Button>
        </div>
      </Card>

      {/* Content List */}
      <Card className="glass">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Content Library ({filteredItems.length})</h3>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No content found</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {item.type === "batch" ? (
                      <Package className="w-5 h-5 text-chart-5" />
                    ) : item.type === "image_to_video" ? (
                      <ImageIcon className="w-5 h-5 text-chart-2" />
                    ) : (
                      <Video className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.prompt}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{item.user_email}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        // Show as completed if URL exists OR status is completed/success
                        item.url || item.status === "completed" || item.status === "success"
                          ? "default"
                          : item.status === "failed" || item.status === "skipped"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {/* Show "Ready" if URL exists, otherwise show actual status */}
                      {item.url ? "Ready" : item.status}
                    </Badge>
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(item.url!, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
