import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, AlertCircle, Eye, EyeOff, MessageCircle, Lock, Mail, ArrowLeft, CreditCard } from "lucide-react";
import { useAuth, getRedirectPath } from "@/hooks/useAuth";
import { toast } from "sonner";

const WHATSAPP_ACCESS_NUMBER = "03296125762";

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotRegistered, setShowNotRegistered] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(getRedirectPath(isAdmin));
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNotRegistered(false);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password.");
          setShowNotRegistered(true);
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Please verify your email before signing in.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      toast.success("Signed in successfully!");
      // Redirect handled by useEffect based on role
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[180px] animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(var(--gradient-end))] blur-[150px] opacity-20 animate-pulse-slow" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-[hsl(var(--gradient-mid))] blur-[100px] opacity-10 animate-float" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        {/* Animated Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-primary glow-lg mb-6 animate-float relative">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-primary animate-pulse opacity-50" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-2 text-gradient">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to access NanoFlow
          </p>
        </div>

        {/* Login Form Card */}
        <div
          className="glass rounded-3xl p-8 shadow-2xl shadow-primary/5 animate-scale-in border border-primary/10"
          style={{ animationDelay: "0.1s" }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span>{error}</span>
                  {showNotRegistered && (
                    <p className="mt-2 text-muted-foreground">
                      Don't have an account? See options below.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 pl-12 text-base rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 pl-12 pr-14 text-base rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg hover:bg-primary/10"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Eye className="w-5 h-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Don't have an account?</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className="space-y-3">
              {/* Go to Pricing */}
              <Link to="/pricing" className="block">
                <Button
                  variant="outline"
                  className="w-full h-12 gap-3 rounded-xl border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <CreditCard className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  <span>Subscribe & Get Access</span>
                </Button>
              </Link>

              {/* WhatsApp Contact */}
              <a
                href={`https://wa.me/92${WHATSAPP_ACCESS_NUMBER.substring(1)}?text=Hi, I would like to request access to NanoFlow. Please let me know the process.`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  variant="ghost"
                  className="w-full h-12 gap-3 rounded-xl hover:bg-chart-2/10 transition-all group"
                >
                  <MessageCircle className="w-5 h-5 text-chart-2 group-hover:scale-110 transition-transform" />
                  <span>Request Access on WhatsApp</span>
                </Button>
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
