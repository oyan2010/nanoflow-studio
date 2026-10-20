import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  Check,
  X,
  Eye,
  Search,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Key,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentRequest {
  id: string;
  email: string;
  whatsapp_number: string;
  plan: string;
  transaction_id: string;
  receipt_url: string;
  status: string;
  admin_notes: string | null;
  user_password: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function PaymentRequestsTab() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as PaymentRequest[]) || []);
    } catch (error) {
      console.error("Error loading payment requests:", error);
      toast.error("Failed to load payment requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: PaymentRequest) => {
    if (!request.user_password) {
      toast.error("This request doesn't have a password set. Please ask user to resubmit.");
      return;
    }

    setIsProcessing(true);
    try {
      let userCredentials = null;

      // Check if user already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", request.email)
        .single();

      if (profileCheckError && profileCheckError.code !== "PGRST116") {
        console.error("Profile check failed:", profileCheckError.message);
        throw new Error(`Failed to check existing user: ${profileCheckError.message}`);
      }

      if (existingProfile) {
        // Update existing user's plan
        const monthlyLimit = request.plan === "enterprise" ? 3000 : 2000;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            plan: request.plan as "pro" | "enterprise",
            monthly_limit: monthlyLimit,
            subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("email", request.email);

        if (profileError) {
          console.error("Profile update failed:", profileError.message);
          throw new Error(`Failed to update profile: ${profileError.message}`);
        }

        // Update payment request status
        const { error: updateError } = await supabase
          .from("payment_requests")
          .update({
            status: "approved",
            admin_notes: adminNotes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        if (updateError) {
          console.error("Payment update failed:", updateError.message);
          throw new Error(`Failed to update payment request: ${updateError.message}`);
        }

        toast.success("Existing user's subscription renewed!");

        // Prepare credentials for WhatsApp
        userCredentials = {
          email: request.email,
          password: request.user_password,
          plan: request.plan === "enterprise" ? "Ultra" : "Pro",
          monthlyLimit: monthlyLimit,
        };
      } else {
        // Create new user account via edge function
        const { data, error: createError } = await supabase.functions.invoke("create-user-account", {
          body: {
            email: request.email,
            password: request.user_password,
            plan: request.plan,
          },
        });

        if (createError) {
          console.error("User creation failed:", createError.message);
          throw new Error(`Function call failed: ${createError.message || JSON.stringify(createError)}`);
        }

        if (data?.error) {
          console.error("Function error:", data.error);
          throw new Error(`User creation failed: ${data.error}`);
        }

        if (!data?.success) {
          console.error("Function failed");
          throw new Error("User creation failed");
        }

        // Update payment request status
        const { error: updateError } = await supabase
          .from("payment_requests")
          .update({
            status: "approved",
            admin_notes: adminNotes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        if (updateError) {
          console.error("Payment update failed:", updateError.message);
          throw new Error(`Failed to update payment request: ${updateError.message}`);
        }

        toast.success("User account created successfully!");

        // Get credentials from response
        userCredentials = data.credentials || {
          email: request.email,
          password: request.user_password,
          plan: request.plan === "enterprise" ? "Ultra" : "Pro",
          monthlyLimit: request.plan === "enterprise" ? 3000 : 2000,
        };
      }

      setSelectedRequest(null);
      setAdminNotes("");
      loadRequests();

      // Redirect to WhatsApp with credentials
      if (userCredentials) {
        const planName = request.plan === "enterprise" ? "Ultra" : "Pro";
        const monthlyLimit = request.plan === "enterprise" ? 3000 : 2000;

        const whatsappMessage = encodeURIComponent(
          `Hi! Your ONanoFlow account is ready! 🎉

*Login Details:*
📧 Email: ${request.email}
🔑 Password: ${request.user_password}
📦 Plan: ${planName} (${monthlyLimit.toLocaleString()} videos/month)
🗓️ Valid for: 30 days

Login here: https://onanoflow.netlify.app/auth

Please change your password after first login for security!

Welcome to ONanoFlow! 🚀`
        );

        // Open WhatsApp in new tab
        const whatsappUrl = `https://wa.me/92${request.whatsapp_number.substring(1)}?text=${whatsappMessage}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (error: any) {
      console.error("Approval failed:", error?.message || "Unknown error");

      const errorMessage = error?.message || "Failed to approve payment";
      toast.error(errorMessage, {
        duration: 10000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: PaymentRequest) => {
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "rejected",
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Payment request rejected");
      setSelectedRequest(null);
      setAdminNotes("");
      loadRequests();
    } catch (error: any) {
      console.error("Error rejecting payment:", error);
      toast.error(error.message || "Failed to reject payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearProcessedRequests = async () => {
    if (!confirm("Are you sure you want to delete all processed (approved/rejected) payment requests?")) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .delete()
        .in("status", ["approved", "rejected"]);

      if (error) throw error;

      toast.success("Processed payment requests cleared");
      loadRequests();
    } catch (error: any) {
      console.error("Error clearing requests:", error);
      toast.error(error.message || "Failed to clear requests");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.whatsapp_number.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={cn(
            "glass rounded-xl p-4 cursor-pointer transition-all border-2",
            statusFilter === "pending" ? "border-chart-4 bg-chart-4/10" : "border-transparent hover:border-chart-4/50"
          )}
          onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "glass rounded-xl p-4 cursor-pointer transition-all border-2",
            statusFilter === "approved" ? "border-primary bg-primary/10" : "border-transparent hover:border-primary/50"
          )}
          onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{approvedCount}</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "glass rounded-xl p-4 cursor-pointer transition-all border-2",
            statusFilter === "rejected" ? "border-destructive bg-destructive/10" : "border-transparent hover:border-destructive/50"
          )}
          onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{rejectedCount}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-lg">Payment Requests</h3>
          <p className="text-sm text-muted-foreground">
            Review and manage payment submissions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl w-full sm:max-w-xs"
            />
          </div>
          {requests.filter(r => r.status !== "pending").length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleClearProcessedRequests}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear Processed
            </Button>
          )}
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <CreditCard className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Payment Requests</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Payment requests from users will appear here. When a user submits their payment proof, you'll be able to review and approve it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request, index) => (
            <div
              key={request.id}
              className="glass rounded-xl p-4 hover:bg-card/90 transition-all animate-fade-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Mobile-first stacked layout */}
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0",
                    request.status === "pending"
                      ? "bg-chart-4/20"
                      : request.status === "approved"
                        ? "bg-primary/20"
                        : "bg-destructive/20"
                  )}
                >
                  {request.status === "pending" ? (
                    <Clock className="w-5 h-5 md:w-6 md:h-6 text-chart-4" />
                  ) : request.status === "approved" ? (
                    <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  ) : (
                    <XCircle className="w-5 h-5 md:w-6 md:h-6 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                    <span className="truncate max-w-[180px] md:max-w-none">{request.email}</span>
                    {request.user_password && (
                      <Key className="w-3 h-3 text-chart-2 shrink-0" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant={request.plan === "enterprise" ? "default" : "secondary"} className="text-xs">
                      {request.plan === "enterprise" ? "Ultra" : "Pro"}
                    </Badge>
                    <span className="hidden md:inline">•</span>
                    <span className="text-xs md:text-sm truncate">TXN: {request.transaction_id}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 md:mt-2">
                    <span className="text-xs md:text-sm text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 hover:bg-primary/10 h-8 px-3"
                      onClick={() => {
                        setSelectedRequest(request);
                        setAdminNotes(request.admin_notes || "");
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Review</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Review Payment Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-5 pt-4">
              {/* Receipt Image */}
              {selectedRequest.receipt_url && (
                <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img
                    src={selectedRequest.receipt_url}
                    alt="Receipt"
                    className="w-full max-h-72 object-contain"
                  />
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <span className="text-xs text-muted-foreground block mb-1">Email</span>
                  <div className="font-medium text-sm">{selectedRequest.email}</div>
                </div>
                <div className="glass rounded-xl p-4">
                  <span className="text-xs text-muted-foreground block mb-1">WhatsApp</span>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {selectedRequest.whatsapp_number}
                    <a
                      href={`https://wa.me/92${selectedRequest.whatsapp_number.substring(1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
                  <span className="text-xs text-muted-foreground block mb-1">Plan</span>
                  <div className="font-medium text-sm">
                    {selectedRequest.plan === "enterprise" ? "Ultra (2,199 PKR)" : "Pro (1,600 PKR)"}
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
                  <span className="text-xs text-muted-foreground block mb-1">Transaction ID</span>
                  <div className="font-medium text-sm font-mono">{selectedRequest.transaction_id}</div>
                </div>
              </div>

              {/* Password Status */}
              {selectedRequest.status === "pending" && (
                <div className={cn(
                  "flex items-center gap-3 p-4 rounded-xl",
                  selectedRequest.user_password
                    ? "bg-chart-2/10 border border-chart-2/30"
                    : "bg-chart-4/10 border border-chart-4/30"
                )}>
                  {selectedRequest.user_password ? (
                    <>
                      <Key className="w-5 h-5 text-chart-2" />
                      <div>
                        <span className="text-sm font-medium text-chart-2">Password Ready</span>
                        <p className="text-xs text-muted-foreground">User will receive credentials via email on approval</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 text-chart-4" />
                      <div>
                        <span className="text-sm font-medium text-chart-4">Legacy Request</span>
                        <p className="text-xs text-muted-foreground">No password set - user needs to resubmit</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea
                  placeholder="Add notes (required for rejection)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  disabled={selectedRequest.status !== "pending"}
                  className="rounded-xl min-h-[80px]"
                />
              </div>

              {/* Actions */}
              {selectedRequest.status === "pending" ? (
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    onClick={() => handleReject(selectedRequest)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    variant="hero"
                    className="flex-1 gap-2 h-12 rounded-xl"
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={isProcessing || !selectedRequest.user_password}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Approve & Send WhatsApp
                  </Button>
                </div>
              ) : (
                <div className={cn(
                  "p-4 rounded-xl text-sm text-center",
                  selectedRequest.status === "approved" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                )}>
                  This request was {selectedRequest.status} on{" "}
                  {selectedRequest.reviewed_at
                    ? new Date(selectedRequest.reviewed_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })
                    : "N/A"}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
