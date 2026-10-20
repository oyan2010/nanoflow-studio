import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Crown,
  Sparkles,
  Upload,
  Loader2,
  MessageCircle,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Star,
  Clock,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { SimpleCaptcha } from "@/components/ui/SimpleCaptcha";

const WHATSAPP_PAYMENT_NUMBER = "03217426773";
const NAYAPAY_ACCOUNT_NAME = "Muhammad Imran";
const NAYAPAY_ACCOUNT_NUMBER = "03217426773";

// ─── Plans ──────────────────────────────────────────────────────────────────

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "1,500",
    currency: "PKR",
    period: "/month",
    description: "Perfect for getting started with AI generation",
    icon: Zap,
    color: "from-emerald-500 to-teal-500",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    features: [
      "800–1,200 scheduled videos/month",
      "50 fast videos/month",
      "2,000–3,000 images/month",
      "Standard queue priority",
      "Basic generation speed",
      "Email support",
    ],
    note: "Daily limits apply to prevent abuse",
    popular: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: "2,500",
    currency: "PKR",
    period: "/month",
    description: "Most popular — ideal for active creators",
    icon: Sparkles,
    color: "from-violet-500 to-purple-600",
    badgeColor: "bg-primary/10 text-primary border-primary/30",
    features: [
      "4,000–5,000 scheduled videos/month",
      "200 fast videos/month",
      "10,000 images/month",
      "Faster queue priority",
      "Scheduling priority",
      "Priority email support",
    ],
    note: null,
    popular: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    price: "4,000",
    currency: "PKR",
    period: "/month",
    description: "Maximum power for professionals",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    features: [
      "10,000+ scheduled videos/month",
      "500 fast videos/month",
      "25,000 images/month",
      "Highest queue priority",
      "Fastest processing",
      "Dedicated support",
      "Early access to new features",
      "6 credits/video (vs 8 standard)",
    ],
    note: "Fair use policy applies",
    popular: false,
  },
  {
    id: "custom",
    name: "Custom",
    price: "Contact",
    currency: "",
    period: "",
    description: "Enterprise needs? Let's talk",
    icon: Star,
    color: "from-blue-500 to-cyan-500",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    features: [
      "Unlimited generations",
      "Custom limits on request",
      "Dedicated processing slots",
      "API access",
      "Custom integrations",
      "Priority dedicated support",
    ],
    note: null,
    popular: false,
    contactOnly: true,
  },
];

// Credit system info
const creditInfo = [
  { label: "Single Image", credits: "0 credits (free)", icon: "🖼️" },
  { label: "Bulk Image (3+ each)", credits: "1 credit each", icon: "📦" },
  { label: "Single Video", credits: "2 credits", icon: "🎬" },
  { label: "Bulk Video (standard)", credits: "8 credits each", icon: "📹" },
  { label: "Scheduled Video (standard)", credits: "6 credits each", icon: "⏰" },
  { label: "Scheduled Video (Ultra plan)", credits: "5 credits each", icon: "⚡" },
];

// ─── Validation Schemas ──────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(50, "Password too long"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must be numeric"),
});

const paymentSchema = z.object({
  whatsappNumber: z
    .string()
    .min(10, "WhatsApp number must be at least 10 digits")
    .max(15, "Number too long")
    .regex(/^[0-9+]+$/, "Invalid phone number"),
  transactionId: z
    .string()
    .min(5, "Transaction ID must be at least 5 characters")
    .max(100, "Transaction ID too long"),
});

// ─── Step Types ──────────────────────────────────────────────────────────────

type Step = "plans" | "email" | "otp" | "payment" | "pending";

// ─── Component ───────────────────────────────────────────────────────────────

export default function Pricing() {
  const [step, setStep] = useState<Step>("plans");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  // ── Step: Plan Selection ──────────────────────────────────────────────────

  const handleSelectPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    if (plan.contactOnly) {
      window.open(
        `https://wa.me/92${WHATSAPP_PAYMENT_NUMBER.substring(1)}?text=Hi, I'm interested in the Custom NanoFlow plan. Please send me details.`,
        "_blank"
      );
      return;
    }

    setSelectedPlan(planId);
    setStep("email");
  };

  // ── Step: Email + Password ────────────────────────────────────────────────

  const handleSendOtp = async () => {
    setErrors({});
    const result = emailSchema.safeParse({ email, password });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim().toLowerCase(), type: "registration" },
      });

      if (error) {
        // Check if it's a server-offline error
        if (error.message?.includes("offline") || error.message?.includes("503")) {
          toast.error("Email service is temporarily offline. Please try again later.");
        } else {
          toast.error(error.message || "Failed to send OTP");
        }
        return;
      }

      toast.success("OTP sent! Check your email inbox.");
      setStep("otp");
      startResendCooldown();
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startResendCooldown = () => {
    setOtpResendCooldown(60);
    const interval = setInterval(() => {
      setOtpResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step: OTP Verification ────────────────────────────────────────────────

  const handleVerifyOtp = async () => {
    setErrors({});
    const result = otpSchema.safeParse({ otp });
    if (!result.success) {
      setErrors({ otp: result.error.errors[0]?.message || "Invalid OTP" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email: email.trim().toLowerCase(), otp: otp.trim() },
      });

      if (error || !data?.success) {
        setErrors({ otp: "Invalid or expired OTP. Please try again." });
        return;
      }

      toast.success("Email verified!");
      setStep("payment");
    } catch (err: any) {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step: Payment Proof ───────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = async () => {
    setErrors({});

    const result = paymentSchema.safeParse({ whatsappNumber: whatsapp, transactionId });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }

    if (!captchaVerified) {
      toast.error("Please complete the security verification");
      return;
    }
    if (!receiptFile || !receiptPreview) {
      toast.error("Please upload your payment receipt screenshot");
      return;
    }
    if (!selectedPlan) {
      toast.error("No plan selected");
      return;
    }

    setIsLoading(true);
    try {
      // Save payment request to DB
      const { error: dbError } = await supabase.from("payment_requests").insert({
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsapp.trim(),
        plan: selectedPlan,
        transaction_id: transactionId.trim(),
        receipt_url: receiptPreview,
        user_password: password,
        email_verified: true,
        status: "pending",
      });

      if (dbError) throw dbError;

      // Notify admin (non-blocking — server may be offline, that's OK)
      supabase.functions
        .invoke("notify-payment-request", {
          body: {
            email: email.trim().toLowerCase(),
            plan: selectedPlan,
            transaction_id: transactionId.trim(),
            whatsapp_number: whatsapp.trim(),
          },
        })
        .catch(() => {}); // fire and forget

      setStep("pending");
    } catch (err: any) {
      console.error("Payment submit error:", err);
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep("plans");
    setSelectedPlan(null);
    setEmail("");
    setPassword("");
    setOtp("");
    setWhatsapp("");
    setTransactionId("");
    setReceiptFile(null);
    setReceiptPreview(null);
    setCaptchaVerified(false);
    setErrors({});
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Layout>
      <Helmet>
        <title>Pricing — NanoFlow AI</title>
        <meta
          name="description"
          content="Choose your NanoFlow plan. Starter 1,500 PKR, Premium 2,500 PKR, Ultra 4,000 PKR per month."
        />
      </Helmet>

      <div className="min-h-screen py-20 relative">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[150px] animate-pulse-slow" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(var(--gradient-end))] blur-[120px] opacity-20 animate-pulse-slow" />
        </div>

        <div className="container relative z-10 px-4">
          {/* ── Header ── */}
          {step === "plans" && (
            <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <Badge
                variant="outline"
                className="mb-4 px-4 py-1.5 text-sm bg-primary/10 border-primary/30"
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Simple Pricing — No Free Trial
              </Badge>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                Choose Your <span className="text-gradient">Perfect Plan</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Pay as you go. Verify your email, send payment proof, and get approved within 24
                hours.
              </p>
            </div>
          )}

          {/* ── Step: Plans Grid ── */}
          {step === "plans" && (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
                {plans.map((plan, i) => {
                  const Icon = plan.icon;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={cn(
                        "relative glass rounded-2xl p-6 transition-all duration-500 hover:-translate-y-2 cursor-pointer animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-forwards border border-border/50 hover:border-primary/30",
                        plan.popular && "ring-2 ring-primary shadow-xl shadow-primary/20"
                      )}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    >
                      {plan.popular && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br",
                          plan.color
                        )}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      {/* Name + desc */}
                      <h3 className="font-display text-xl font-bold mb-1">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                      {/* Price */}
                      <div className="mb-6">
                        {plan.contactOnly ? (
                          <span className="font-display text-3xl font-bold">Contact Us</span>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-muted-foreground">{plan.currency}</span>
                            <span className="font-display text-4xl font-bold">{plan.price}</span>
                            <span className="text-muted-foreground text-sm">{plan.period}</span>
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-2.5 mb-6">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {plan.note && (
                        <p className="text-xs text-muted-foreground mb-4 italic">{plan.note}</p>
                      )}

                      {/* CTA */}
                      <Button
                        variant={plan.popular ? "hero" : "outline"}
                        className="w-full"
                        size="sm"
                      >
                        {plan.contactOnly ? (
                          <>
                            <MessageCircle className="w-4 h-4 mr-2" /> Contact on WhatsApp
                          </>
                        ) : (
                          `Get ${plan.name}`
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Credit system info */}
              <div className="max-w-2xl mx-auto glass rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-8 duration-700 mb-16">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Credit-Based System
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {creditInfo.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.credits}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Questions about pricing or payment?</p>
                <a
                  href={`https://wa.me/92${WHATSAPP_PAYMENT_NUMBER.substring(1)}?text=Hi, I have a question about NanoFlow pricing.`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Contact on WhatsApp
                  </Button>
                </a>
              </div>
            </>
          )}

          {/* ── Multi-step Registration Flow ── */}
          {step !== "plans" && (
            <div className="max-w-lg mx-auto">
              {/* Back button */}
              {step !== "pending" && (
                <button
                  onClick={step === "email" ? handleReset : () => setStep(step === "otp" ? "email" : step === "payment" ? "otp" : "plans")}
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Back
                </button>
              )}

              {/* Plan badge */}
              {selectedPlanData && step !== "pending" && (
                <div className="flex items-center gap-3 mb-6 glass rounded-xl p-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br",
                      selectedPlanData.color
                    )}
                  >
                    <selectedPlanData.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedPlanData.name} Plan</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPlanData.price !== "Contact"
                        ? `PKR ${selectedPlanData.price}/month`
                        : "Custom pricing"}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {step === "email" ? "Step 1/3" : step === "otp" ? "Step 2/3" : "Step 3/3"}
                  </Badge>
                </div>
              )}

              {/* ── Step 1: Email + Password ── */}
              {step === "email" && (
                <div className="glass rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="mb-6">
                    <h2 className="font-display text-2xl font-bold mb-1">Create Your Account</h2>
                    <p className="text-muted-foreground text-sm">
                      Enter your email and choose a password. We'll send a verification code.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 pl-10 rounded-xl"
                          onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Choose Password</Label>
                      <p className="text-xs text-muted-foreground">
                        This will be your login password after approval
                      </p>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 pl-10 pr-12 rounded-xl"
                          onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <Eye className="w-5 h-5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive">{errors.password}</p>
                      )}
                    </div>

                    <Button
                      variant="hero"
                      className="w-full h-12 rounded-xl mt-2"
                      onClick={handleSendOtp}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Send Verification Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2: OTP Verification ── */}
              {step === "otp" && (
                <div className="glass rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="mb-6">
                    <h2 className="font-display text-2xl font-bold mb-1">Verify Your Email</h2>
                    <p className="text-muted-foreground text-sm">
                      Enter the 6-digit code sent to{" "}
                      <span className="font-medium text-foreground">{email}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Verification Code</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          placeholder="123456"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                          className="h-14 pl-10 rounded-xl text-2xl tracking-widest text-center font-mono"
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        />
                      </div>
                      {errors.otp && (
                        <p className="text-xs text-destructive">{errors.otp}</p>
                      )}
                    </div>

                    <Button
                      variant="hero"
                      className="w-full h-12 rounded-xl"
                      onClick={handleVerifyOtp}
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Verify Code
                        </>
                      )}
                    </Button>

                    {/* Resend */}
                    <div className="text-center">
                      <button
                        disabled={otpResendCooldown > 0 || isLoading}
                        onClick={handleSendOtp}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {otpResendCooldown > 0
                          ? `Resend code in ${otpResendCooldown}s`
                          : "Didn't receive it? Resend"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Payment Proof ── */}
              {step === "payment" && (
                <div className="glass rounded-2xl p-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="mb-6">
                    <h2 className="font-display text-2xl font-bold mb-1">Complete Payment</h2>
                    <p className="text-muted-foreground text-sm">
                      Send payment and upload your receipt screenshot below.
                    </p>
                  </div>

                  {/* Payment instructions */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                      <MessageCircle className="w-4 h-4 text-primary" />
                      Payment Instructions
                    </h3>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Type</span>
                        <span className="font-medium">NayaPay</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Name</span>
                        <span className="font-medium">{NAYAPAY_ACCOUNT_NAME}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number</span>
                        <span className="font-medium font-mono">{NAYAPAY_ACCOUNT_NUMBER}</span>
                      </div>
                      {selectedPlanData && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-bold text-primary">
                            PKR {selectedPlanData.price} ({selectedPlanData.name})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* WhatsApp */}
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="03XXXXXXXXX"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className="h-12 rounded-xl"
                      />
                      {errors.whatsappNumber && (
                        <p className="text-xs text-destructive">{errors.whatsappNumber}</p>
                      )}
                    </div>

                    {/* Transaction ID */}
                    <div className="space-y-2">
                      <Label htmlFor="txn">Transaction / Reference ID</Label>
                      <Input
                        id="txn"
                        placeholder="Enter transaction ID from NayaPay"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="h-12 rounded-xl"
                      />
                      {errors.transactionId && (
                        <p className="text-xs text-destructive">{errors.transactionId}</p>
                      )}
                    </div>

                    {/* Receipt Upload */}
                    <div className="space-y-2">
                      <Label>Receipt Screenshot</Label>
                      {receiptPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img
                            src={receiptPreview}
                            alt="Receipt"
                            className="w-full h-48 object-cover"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                            onClick={() => {
                              setReceiptFile(null);
                              setReceiptPreview(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload receipt</span>
                          <span className="text-xs text-muted-foreground/60 mt-1">PNG, JPG up to 5MB</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      )}
                    </div>

                    {/* Captcha */}
                    <SimpleCaptcha
                      onVerify={setCaptchaVerified}
                      isVerified={captchaVerified}
                    />

                    <Button
                      variant="hero"
                      className="w-full h-12 rounded-xl"
                      onClick={handleSubmitPayment}
                      disabled={isLoading || !captchaVerified}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Payment Proof"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step: Pending Approval ── */}
              {step === "pending" && (
                <div className="glass rounded-2xl p-8 text-center animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-3">Request Submitted!</h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Your payment proof has been received. We'll review it and activate your account
                    within <strong>24 hours</strong>.
                  </p>
                  <div className="p-4 rounded-xl bg-muted/30 text-sm text-left space-y-2 mb-6">
                    <p>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{email}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Plan:</span>{" "}
                      <span className="font-medium capitalize">{selectedPlan}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge variant="outline" className="text-xs">
                        Pending Review
                      </Badge>
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    You'll receive an email once your account is approved.
                  </p>
                  <Button variant="outline" onClick={handleReset} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Plans
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
