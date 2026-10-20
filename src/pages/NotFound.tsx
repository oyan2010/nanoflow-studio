import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Sparkles } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px] animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[400px] h-[400px] rounded-full bg-[hsl(var(--gradient-end))] blur-[120px] opacity-20 animate-pulse-slow" />
      </div>

      <div className="relative text-center animate-fade-up">
        <div className="w-20 h-20 rounded-2xl bg-gradient-primary mx-auto mb-6 flex items-center justify-center glow animate-float">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="mb-2 text-8xl font-display font-bold text-gradient">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">
          Oops! This page doesn't exist
        </p>
        <Link to="/">
          <Button variant="hero" size="lg" className="gap-2">
            <Home className="w-4 h-4" />
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
