import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Key,
  Settings,
  Plus,
  Search,
  Trash2,
  Edit,
  Shield,
  LogOut,
  Loader2,
  CreditCard,
  TrendingUp,
  Activity,
  Video,
  Image as ImageIcon,
  BarChart3,
  RefreshCw,
  Calendar,
  Zap,
  Lock,
  Menu,
  Library,
  Mail,
  AlertTriangle,
  CloudUpload
} from "lucide-react";
import { PaymentRequestsTab } from "@/components/admin/PaymentRequestsTab";
import { GenerationSettingsCard } from "@/components/admin/GenerationSettingsCard";
import { ContentLibraryTab } from "@/components/admin/ContentLibraryTab";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  plan: "free" | "pro" | "enterprise";
  status: string;
  images_generated: number;
  videos_generated: number;
  monthly_usage?: number;
  monthly_limit?: number;
  created_at: string;
  subscription_ends_at?: string | null;
}

interface ApiKey {
  id: string;
  name: string;
  status: "active" | "inactive";
  usage_today: number;
  max_concurrent: number;
  cookie_data: string;
}

// Helper to extract session cookie expiration date from cookie JSON
function getCookieExpiration(cookieData: string): { date: Date | null; isExpired: boolean; daysLeft: number | null; hoursLeft: number | null } {
  try {
    const cookies = JSON.parse(cookieData);
    if (!Array.isArray(cookies)) return { date: null, isExpired: false, daysLeft: null, hoursLeft: null };

    // CRITICAL FIX: Look specifically for the session token cookie
    // This is the ACTUAL session cookie that expires, not analytics cookies
    const sessionCookie = cookies.find((c: any) =>
      c.name === '__Secure-next-auth.session-token' &&
      c.expirationDate &&
      typeof c.expirationDate === 'number'
    );

    // If no session cookie found, check for other critical auth cookies
    const criticalCookie = sessionCookie || cookies.find((c: any) =>
      (c.name === 'email' || c.name === 'EMAIL' || c.name?.includes('session')) &&
      c.expirationDate &&
      typeof c.expirationDate === 'number'
    );

    if (!criticalCookie) {
      // No session cookie with expiration - might be session-only (expires on browser close)
      return { date: null, isExpired: false, daysLeft: null, hoursLeft: null };
    }

    // expirationDate is Unix timestamp in seconds
    const expirationDate = new Date(criticalCookie.expirationDate * 1000);
    const now = new Date();
    const isExpired = expirationDate < now;

    const timeLeftMs = expirationDate.getTime() - now.getTime();
    const hoursLeft = isExpired ? 0 : Math.floor(timeLeftMs / (1000 * 60 * 60));
    const daysLeft = isExpired ? 0 : Math.ceil(timeLeftMs / (1000 * 60 * 60 * 24));

    return { date: expirationDate, isExpired, daysLeft, hoursLeft };
  } catch {
    return { date: null, isExpired: false, daysLeft: null, hoursLeft: null };
  }
}

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [apis, setApis] = useState<ApiKey[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Add user dialog
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<"pro" | "enterprise">("pro");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Add API dialog
  const [isAddApiOpen, setIsAddApiOpen] = useState(false);
  const [newApiName, setNewApiName] = useState("");
  const [newApiCookie, setNewApiCookie] = useState("");
  const [newApiMaxConcurrent, setNewApiMaxConcurrent] = useState("2");
  const [isAddingApi, setIsAddingApi] = useState(false);

  // Edit user dialog
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserPlan, setEditUserPlan] = useState<"pro" | "enterprise">("pro");
  const [editUserLimit, setEditUserLimit] = useState("");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Price editing
  const [proPriceEdit, setProPriceEdit] = useState("1999");
  const [ultraPriceEdit, setUltraPriceEdit] = useState("2899");
  const [isEditingPrices, setIsEditingPrices] = useState(false);

  // Cookie health check
  const [isCheckingCookies, setIsCheckingCookies] = useState(false);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [testingSessionId, setTestingSessionId] = useState<string | null>(null);
  const [isTestingGDrive, setIsTestingGDrive] = useState(false);
  const [isClearingVideos, setIsClearingVideos] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
      loadOnlineUsers();
    }
  }, [user, isAdmin]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      setUsers(profilesData || []);

      const { data: apisData, error: apisError } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (apisError) throw apisError;
      setApis(apisData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const { count } = await supabase
        .from("user_presence")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      setOnlineUsers(count || 0);
    } catch (error) {
      console.error("Error loading online users:", error);
    }
  };

  const handleTestGDrive = async () => {
    setIsTestingGDrive(true);
    try {
      console.log("[Admin] Testing Google Drive integration...");
      const { data, error } = await supabase.functions.invoke('test-gdrive');

      if (error) {
        console.error("[Admin] GDrive test error:", error);
        toast.error(`Google Drive Test Failed: ${error.message}`);
        return;
      }

      console.log("[Admin] GDrive test results:", data);
      console.table(data.user_folders);

      toast.success(`✅ Created ${data.folders_created}/${data.total_users} folders. Check console for details.`);

      if (data.test_upload?.webViewLink) {
        console.log("✅ Test upload successful:", data.test_upload.webViewLink);
      }
    } catch (error: any) {
      console.error("[Admin] GDrive test exception:", error);
      toast.error(error.message || "Failed to test Google Drive");
    } finally {
      setIsTestingGDrive(false);
    }
  };

  const handleClearAllVideos = async () => {
    if (!confirm('⚠️ DELETE ALL batch videos?\n\nThis will:\n- Delete all videos from storage\n- Clear video URLs from batch items\n- Clear download URLs from batch jobs\n\nThis action CANNOT be undone!')) {
      return;
    }

    setIsClearingVideos(true);
    try {
      console.log("[Admin] Clearing all videos...");
      const { data, error } = await supabase.functions.invoke('admin-clear-videos');

      if (error) {
        console.error("[Admin] Clear videos error:", error);
        toast.error(`Failed to clear videos: ${error.message}`);
        return;
      }

      console.log("[Admin] Clear results:", data);

      // Show detailed results
      const message = data.failed_deletes > 0
        ? `🗑️ Deleted ${data.deleted_files} files (${data.failed_deletes} failed)\nCleared ${data.cleared_batch_items} batch items and ${data.cleared_batch_jobs} batch jobs`
        : `🗑️ Successfully deleted ${data.deleted_files} files\nCleared ${data.cleared_batch_items} batch items and ${data.cleared_batch_jobs} batch jobs`;

      toast.success(message);

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error("[Admin] Clear videos exception:", error);
      toast.error(error.message || "Failed to clear videos");
    } finally {
      setIsClearingVideos(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Email and password are required");
      return;
    }

    setIsAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user-admin", {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserName,
          plan: newUserPlan
        }
      });

      if (error) {
        console.error("Function invocation error:", error);
        throw new Error(error.message || "Failed to create user");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error("User creation failed");
      }

      toast.success("User created successfully!");
      setIsAddUserOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserPlan("pro");
      loadData();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      const monthlyLimit = editUserLimit ? parseInt(editUserLimit) : (editUserPlan === "enterprise" ? 3000 : 2000);
      const { error } = await supabase
        .from("profiles")
        .update({
          plan: editUserPlan,
          monthly_limit: monthlyLimit,
          subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast.success("User updated successfully!");
      setEditingUser(null);
      loadData();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleAddApi = async () => {
    if (!newApiName || !newApiCookie) {
      toast.error("Name and cookie data are required");
      return;
    }

    setIsAddingApi(true);
    try {
      const { error } = await supabase
        .from("api_keys")
        .insert({
          name: newApiName,
          cookie_data: newApiCookie,
          max_concurrent: parseInt(newApiMaxConcurrent) || 2
        });

      if (error) throw error;

      toast.success("API key added successfully!");
      setIsAddApiOpen(false);
      setNewApiName("");
      setNewApiCookie("");
      setNewApiMaxConcurrent("2");
      loadData();
    } catch (error: any) {
      console.error("Error adding API:", error);
      toast.error(error.message || "Failed to add API key");
    } finally {
      setIsAddingApi(false);
    }
  };

  const handleDeleteApi = async (apiId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", apiId);

      if (error) throw error;
      toast.success("API key deleted");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete API key");
    }
  };

  const handleToggleApiStatus = async (api: ApiKey) => {
    try {
      const newStatus = api.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("api_keys")
        .update({ status: newStatus })
        .eq("id", api.id);

      if (error) throw error;
      toast.success(`API ${newStatus === "active" ? "activated" : "deactivated"}`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update API status");
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "suspended" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;
      toast.success(`User ${newStatus === "active" ? "activated" : "suspended"}`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user status");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const { data, error } = await supabase.functions.invoke("delete-user-admin", {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User deleted successfully");
      loadData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleCheckCookieHealth = async () => {
    setIsCheckingCookies(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-expiring-cookies", {
        body: { warningDays: 3 }
      });

      if (error) throw error;

      if (data.expired > 0 || data.expiring > 0) {
        toast.warning(`Found ${data.expired} expired and ${data.expiring} expiring API keys. Email sent to admin.`);
        loadData(); // Refresh to show updated statuses
      } else {
        toast.success("All API cookies are healthy!");
      }
    } catch (error: any) {
      console.error("Cookie check failed:", error);
      toast.error(error.message || "Failed to check cookie health");
    } finally {
      setIsCheckingCookies(false);
    }
  };

  const handleTestSession = async (apiId: string) => {
    setTestingSessionId(apiId);
    try {
      const { data, error } = await supabase.functions.invoke("test-session-health", {
        body: { apiKeyId: apiId },
      });

      console.log("[Test Session] Response:", { data, error });

      if (error) {
        console.error("[Test Session] Error details:", error);

        // Try to get actual error message from response
        if (error.context instanceof Response) {
          try {
            const errorBody = await error.context.json();
            console.error("[Test Session] Error body:", errorBody);
            toast.error(`Function error: ${errorBody.error || error.message}`);
          } catch {
            const errorText = await error.context.text();
            console.error("[Test Session] Error text:", errorText);
            toast.error(`Function error: ${errorText || error.message}`);
          }
        } else {
          toast.error(`Function error: ${error.message || JSON.stringify(error)}`);
        }
        throw error;
      }

      if (data.sessionValid) {
        toast.success(`Session is active and working! ✓`);
      } else {
        toast.error(`Session expired: ${data.error || 'Unknown error'}. Please update cookies!`);
      }

      // Refresh data to show updated session status
      await loadData();
    } catch (error: any) {
      console.error("Session test failed:", error);
      console.error("Error details:", {
        message: error.message,
        context: error.context,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      // Error already shown in toast above
    } finally {
      setTestingSessionId(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const totalStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === "active").length,
    proUsers: users.filter(u => u.plan === "pro").length,
    ultraUsers: users.filter(u => u.plan === "enterprise").length,
    totalImages: users.reduce((acc, u) => acc + u.images_generated, 0),
    totalVideos: users.reduce((acc, u) => acc + u.videos_generated, 0),
    totalUsage: users.reduce((acc, u) => acc + (u.monthly_usage || 0), 0),
    activeApis: apis.filter(a => a.status === "active").length,
    totalApis: apis.length,
    apiUsageToday: apis.reduce((acc, a) => acc + a.usage_today, 0),
    totalCapacity: apis.filter(a => a.status === "active").reduce((acc, a) => acc + a.max_concurrent, 0),
    onlineUsers
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading admin panel...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container px-4 py-16 text-center">
          <div className="max-w-md mx-auto glass rounded-2xl p-8">
            <Shield className="w-20 h-20 mx-auto text-destructive/50 mb-6" />
            <h1 className="font-display text-2xl font-bold mb-3">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have admin privileges to access this panel.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
              Go to Home
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container px-4 py-6 md:py-8">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-1">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Welcome back, {user.email?.split("@")[0]}
            </p>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => { loadData(); loadOnlineUsers(); }}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <ChangePasswordDialog />
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={newUserPlan} onValueChange={(v) => setNewUserPlan(v as any)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pro">Pro - 1,600 PKR (2,000/month)</SelectItem>
                        <SelectItem value="enterprise">Ultra - 2,199 PKR (3,000/month)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={handleAddUser}
                    disabled={isAddingUser}
                  >
                    {isAddingUser ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Create User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleClearAllVideos}
              disabled={isClearingVideos}
            >
              {isClearingVideos ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear Videos
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden gap-2">
            <Button variant="outline" size="icon" onClick={() => { loadData(); loadOnlineUsers(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-3 pt-6">
                  <ChangePasswordDialog trigger={
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Lock className="w-4 h-4" />
                      Change Password
                    </Button>
                  } />
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button variant="hero" className="w-full justify-start gap-2">
                        <Plus className="w-4 h-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Stats Overview - Mobile Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.totalUsers}</div>
            <div className="text-xs text-muted-foreground">Total Users</div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-chart-2/20 flex items-center justify-center">
                <Activity className="w-4 h-4 md:w-5 md:h-5 text-chart-2" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.onlineUsers}</div>
            <div className="text-xs text-muted-foreground">Online Now</div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-chart-3/20 flex items-center justify-center">
                <Video className="w-4 h-4 md:w-5 md:h-5 text-chart-3" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.totalVideos.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Videos</div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-chart-5/20 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-chart-5" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.totalImages.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Images</div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-chart-4/20 flex items-center justify-center">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-chart-4" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.activeApis}/{totalStats.totalApis}</div>
            <div className="text-xs text-muted-foreground">Active APIs</div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5 hover-lift">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground">{totalStats.totalCapacity}</div>
            <div className="text-xs text-muted-foreground">API Capacity</div>
          </div>
        </div>

        {/* Secondary Stats - Mobile Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:mb-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">User Plans Distribution</span>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pro Users</span>
                <Badge variant="secondary">{totalStats.proUsers}</Badge>
              </div>
              <Progress value={(totalStats.proUsers / totalStats.totalUsers) * 100} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ultra Users</span>
                <Badge>{totalStats.ultraUsers}</Badge>
              </div>
              <Progress value={(totalStats.ultraUsers / totalStats.totalUsers) * 100} className="h-2 [&>div]:bg-chart-4" />
            </div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Monthly Usage</span>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-2">{totalStats.totalUsage.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total generations this month</p>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">API calls today</span>
                <span className="font-medium">{totalStats.apiUsageToday}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl md:rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">System Health</span>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-chart-2 animate-pulse" />
                <span className="text-sm">All systems operational</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  totalStats.activeApis > 0 ? "bg-chart-2" : "bg-destructive"
                )} />
                <span className="text-sm">{totalStats.activeApis} API{totalStats.activeApis !== 1 ? "s" : ""} active</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-sm">Database connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Mobile Responsive Tabs */}
        <Tabs defaultValue="users" className="w-full animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <TabsList className="mb-4 md:mb-6 glass p-1 rounded-xl w-full md:w-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="users" className="gap-1 md:gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm flex-shrink-0">
              <Users className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1 md:gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm flex-shrink-0">
              <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="apis" className="gap-1 md:gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm flex-shrink-0">
              <Key className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-1 md:gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm flex-shrink-0">
              <Library className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 md:gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs md:text-sm flex-shrink-0">
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="glass rounded-xl md:rounded-2xl overflow-hidden">
              {/* Search */}
              <div className="p-3 md:p-4 border-b border-border">
                <div className="relative w-full md:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Table - Mobile Cards / Desktop Table */}
              {isLoadingData ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Usage</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Expires</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                              No users found
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((usr) => (
                            <tr key={usr.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                              <td className="p-4">
                                <div>
                                  <div className="font-medium text-foreground">{usr.full_name || "—"}</div>
                                  <div className="text-sm text-muted-foreground">{usr.email}</div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant={usr.plan === "enterprise" ? "default" : "secondary"}>
                                  {usr.plan === "enterprise" ? "Ultra" : "Pro"}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <Badge variant={usr.status === "active" ? "outline" : "destructive"} className={cn(
                                  usr.status === "active" && "border-chart-2/50 text-chart-2"
                                )}>
                                  {usr.status}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={((usr.monthly_usage || 0) / (usr.monthly_limit || 50)) * 100}
                                    className="h-2 w-20"
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    {usr.monthly_usage || 0}/{usr.monthly_limit || 50}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {usr.subscription_ends_at
                                  ? new Date(usr.subscription_ends_at).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingUser(usr);
                                      setEditUserPlan(usr.plan === "enterprise" ? "enterprise" : "pro");
                                      setEditUserLimit(String(usr.monthly_limit || 2000));
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleToggleUserStatus(usr.id, usr.status)}
                                  >
                                    <Shield className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteUser(usr.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No users found
                      </div>
                    ) : (
                      filteredUsers.map((usr) => (
                        <div key={usr.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-foreground">{usr.full_name || "—"}</div>
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">{usr.email}</div>
                            </div>
                            <div className="flex gap-1">
                              <Badge variant={usr.plan === "enterprise" ? "default" : "secondary"} className="text-xs">
                                {usr.plan === "enterprise" ? "Ultra" : "Pro"}
                              </Badge>
                              <Badge variant={usr.status === "active" ? "outline" : "destructive"} className={cn(
                                "text-xs",
                                usr.status === "active" && "border-chart-2/50 text-chart-2"
                              )}>
                                {usr.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={((usr.monthly_usage || 0) / (usr.monthly_limit || 50)) * 100}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {usr.monthly_usage || 0}/{usr.monthly_limit || 50}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Expires: {usr.subscription_ends_at
                                ? new Date(usr.subscription_ends_at).toLocaleDateString()
                                : "—"}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingUser(usr);
                                  setEditUserPlan(usr.plan === "enterprise" ? "enterprise" : "pro");
                                  setEditUserLimit(String(usr.monthly_limit || 2000));
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleToggleUserStatus(usr.id, usr.status)}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteUser(usr.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <PaymentRequestsTab />
          </TabsContent>

          {/* APIs Tab */}
          <TabsContent value="apis">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Manage API keys. Total capacity: {totalStats.totalCapacity} concurrent.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCheckCookieHealth}
                    disabled={isCheckingCookies}
                  >
                    {isCheckingCookies ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Check Cookie Health</span>
                    <span className="sm:hidden">Check</span>
                  </Button>
                  <Dialog open={isAddApiOpen} onOpenChange={setIsAddApiOpen}>
                    <DialogTrigger asChild>
                      <Button variant="hero" className="gap-2 w-full sm:w-auto">
                        <Plus className="w-4 h-4" />
                        Add API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl mx-4">
                      <DialogHeader>
                        <DialogTitle>Add API Key</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            placeholder="Primary API"
                            value={newApiName}
                            onChange={(e) => setNewApiName(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cookie Data (JSON)</Label>
                          <Textarea
                            placeholder='{"cookie": "...", "token": "..."}'
                            value={newApiCookie}
                            onChange={(e) => setNewApiCookie(e.target.value)}
                            className="min-h-[100px] font-mono text-sm rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Concurrent</Label>
                          <Input
                            type="number"
                            placeholder="2"
                            value={newApiMaxConcurrent}
                            onChange={(e) => setNewApiMaxConcurrent(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <Button
                          variant="hero"
                          className="w-full rounded-xl"
                          onClick={handleAddApi}
                          disabled={isAddingApi}
                        >
                          {isAddingApi ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Add API Key
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {isLoadingData ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </div>
              ) : apis.length === 0 ? (
                <div className="glass rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
                  <Key className="w-12 h-12 md:w-16 md:h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No API Keys</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Add your first API key to start generating images and videos.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:gap-4">
                  {apis.map((api) => {
                    const cookieExpiry = getCookieExpiration(api.cookie_data);
                    return (
                      <div key={api.id} className="glass rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-card/90 transition-all">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={cn(
                            "w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0",
                            api.status === "active" ? "bg-chart-2 animate-pulse" : "bg-muted-foreground"
                          )} />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{api.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Max {api.max_concurrent} concurrent • {api.usage_today} calls today
                            </div>
                            {cookieExpiry.date && (
                              <div className={cn(
                                "text-xs mt-1",
                                cookieExpiry.isExpired
                                  ? "text-destructive"
                                  : cookieExpiry.daysLeft !== null && cookieExpiry.daysLeft <= 7
                                    ? "text-chart-4"
                                    : "text-muted-foreground"
                              )}>
                                {cookieExpiry.isExpired ? (
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive" />
                                    Cookie expired on {cookieExpiry.date.toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span>
                                    Expires: {cookieExpiry.date.toLocaleDateString()}
                                    {cookieExpiry.daysLeft !== null && (
                                      cookieExpiry.daysLeft < 2 && cookieExpiry.hoursLeft !== null ? (
                                        <span className="ml-1 font-medium text-chart-4">
                                          ({cookieExpiry.hoursLeft}h left ⚠️)
                                        </span>
                                      ) : (
                                        ` (${cookieExpiry.daysLeft} days left)`
                                      )
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 justify-end">
                          {cookieExpiry.isExpired && (
                            <Badge variant="destructive" className="text-xs">
                              Expired
                            </Badge>
                          )}
                          <Badge variant={api.status === "active" ? "outline" : "secondary"} className={cn(
                            api.status === "active" && "border-chart-2/50 text-chart-2"
                          )}>
                            {api.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestSession(api.id)}
                            disabled={testingSessionId === api.id}
                            className="gap-1.5"
                          >
                            {testingSessionId === api.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Activity className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">Test Session</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleApiStatus(api)}
                          >
                            {api.status === "active" ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteApi(api.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <div className="glass rounded-xl md:rounded-2xl p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center">
                    <Settings className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">General Settings</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">Configure system preferences</p>
                  </div>
                </div>
                <div className="space-y-3 md:space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email Notifications</span>
                    <Badge variant="outline" className="border-chart-2/50 text-chart-2">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payment Verification</span>
                    <Badge variant="outline" className="border-chart-2/50 text-chart-2">Manual</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dynamic Batching</span>
                    <Badge variant="outline" className="border-chart-2/50 text-chart-2">Enabled</Badge>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl md:rounded-2xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-chart-4/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-chart-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm md:text-base">Plan Pricing</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">Edit subscription prices</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingPrices(!isEditingPrices)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3 md:space-y-4 pt-4 border-t border-border">
                  {isEditingPrices ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm">Pro Plan Price (PKR)</Label>
                        <Input
                          type="number"
                          value={proPriceEdit}
                          onChange={(e) => setProPriceEdit(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Ultra Plan Price (PKR)</Label>
                        <Input
                          type="number"
                          value={ultraPriceEdit}
                          onChange={(e) => setUltraPriceEdit(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setIsEditingPrices(false);
                            setProPriceEdit("1600");
                            setUltraPriceEdit("2199");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="hero"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            toast.success(`Prices updated: Pro PKR ${parseInt(proPriceEdit).toLocaleString()}, Ultra PKR ${parseInt(ultraPriceEdit).toLocaleString()}`);
                            setIsEditingPrices(false);
                          }}
                          disabled={isSavingPrices}
                        >
                          {isSavingPrices ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pro Plan Price</span>
                        <span className="font-medium text-sm">PKR {parseInt(proPriceEdit).toLocaleString()}/month</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Ultra Plan Price</span>
                        <span className="font-medium text-sm">PKR {parseInt(ultraPriceEdit).toLocaleString()}/month</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Payment Method</span>
                        <span className="font-medium text-sm">NayaPay</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Generation Settings */}
              <GenerationSettingsCard />
            </div>
          </TabsContent>

          {/* Content Library Tab */}
          <TabsContent value="content">
            <ContentLibraryTab />
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="rounded-2xl mx-4">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 pt-4">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="font-medium truncate">{editingUser.email}</p>
                  <p className="text-sm text-muted-foreground">{editingUser.full_name || "No name"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={editUserPlan} onValueChange={(v) => setEditUserPlan(v as any)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro">Pro (2,000/month)</SelectItem>
                      <SelectItem value="enterprise">Ultra (3,000/month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Limit</Label>
                  <Input
                    type="number"
                    value={editUserLimit}
                    onChange={(e) => setEditUserLimit(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  variant="hero"
                  className="w-full rounded-xl"
                  onClick={handleUpdateUser}
                  disabled={isUpdatingUser}
                >
                  {isUpdatingUser ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Update User
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
