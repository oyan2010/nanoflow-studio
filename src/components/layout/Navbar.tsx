import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Image, Video, Menu, X, CreditCard, LogIn, LogOut, Shield, FileVideo, Volume2, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { name: "Home", path: "/", icon: Sparkles },
  { name: "Image Studio", path: "/image-studio", icon: Image },
  { name: "Video Gen", path: "/video-gen", icon: Video },
  { name: "Text to Speech", path: "/text-to-speech", icon: Volume2 },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Pricing", path: "/pricing", icon: CreditCard },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setIsAdmin(false);
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center glow-sm">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
            <span className="font-display font-bold text-xl text-foreground group-hover:text-gradient transition-all duration-300">
              ONanoFlow
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "gap-2 transition-all duration-300",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
            {user ? (
              <Button variant="outline" className="gap-2" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="gradient" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden glass border-t border-border/50 animate-fade-in">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMobileOpen(false)}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 border border-primary/30 text-primary",
                    location.pathname === "/admin" && "bg-primary/10"
                  )}
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
            <div className="pt-4 border-t border-border/50">
              {user ? (
                <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              ) : (
                <Link to="/auth" className="block" onClick={() => setMobileOpen(false)}>
                  <Button variant="gradient" className="w-full gap-2">
                    <LogIn className="w-4 h-4" />
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
